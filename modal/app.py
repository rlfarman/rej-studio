# pyright: reportMissingImports=false, reportAttributeAccessIssue=false
import contextlib
import hmac
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ValidationError

import modal

project_root = Path(__file__).parent.parent

# Request/response contracts are shared with the local FastAPI app. Two import
# paths on purpose: the package layout at deploy time (and in tests), the flat
# /root layout inside the container where the file is mounted next to
# algorithm.py.
sys.path.insert(0, str(project_root))
sys.path.insert(0, "/root")
try:
    from python.contracts import ProcessOptions, normalize_cds, normalize_name
except ImportError:  # pragma: no cover - container import path
    from contracts import ProcessOptions, normalize_cds, normalize_name

# Sentry — initialise early so errors during module import are captured.
# Only active when SENTRY_DSN is set (supplied by the rej-studio-runtime
# Modal secret; absent locally and during deploys).
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=_sentry_dsn,
            traces_sample_rate=0.1,
            environment=os.environ.get("MODAL_ENVIRONMENT", "production"),
            release=os.environ.get("GIT_SHA", "unknown"),
        )
    except ImportError:
        pass  # sentry-sdk not installed — skip silently


# --- Structured logging ---
# Emit one JSON object per line to stdout. Modal captures stdout into its log
# viewer; shipping structured payloads means we can grep/jq for specific jobs,
# stages, and failure modes without regexing free-form strings.
def _log(event: str, **fields: Any) -> None:
    """Emit a single structured log line."""
    payload = {"ts": time.time(), "event": event, **fields}
    try:
        sys.stdout.write(json.dumps(payload, default=str) + "\n")
        sys.stdout.flush()
    except Exception:
        # Never let logging take down a worker.
        pass


# Silence FastAPI/Uvicorn's default access logs since we emit our own.
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = modal.App("rej-studio")

# Runtime configuration lives in one Modal secret, attached to both functions.
# Keys: JOB_API_TOKEN (required for auth), SENTRY_DSN,
# OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS, CORS_ORIGIN.
# from_name is lazy: a missing secret fails at deploy time, not import time.
runtime_secret = modal.Secret.from_name("rej-studio-runtime")

# Install from uv.lock (every package pinned, transitive ones included) so the
# image only changes when the lock does. `uv sync --frozen` runs inside the
# image with the repo-root pyproject.toml + uv.lock. Modal doesn't pass
# --no-dev itself, so do it here: ruff/pyright/pytest stay out of production,
# and the `deploy` group (the Modal client) isn't requested either.
# Python 3.14 matches pyproject's requires-python and CI.
# uv_sync and Python 3.14 both need image builder 2025.06+; deploys pin
# MODAL_IMAGE_BUILDER_VERSION=2026.10 (see modal-deploy.yml / modal/README.md).
# UV_VERSION matches the uv used to write the lock (and setup-uv in CI).
UV_VERSION = "0.13.8"
image = (
    modal.Image.debian_slim(python_version="3.14")
    .uv_sync(str(project_root), extra_options="--no-dev", uv_version=UV_VERSION)
    .add_local_file(project_root / "python" / "algorithm.py", remote_path="/root/algorithm.py")
    .add_local_file(project_root / "python" / "contracts.py", remote_path="/root/contracts.py")
    .add_local_file(project_root / "python" / "telemetry.py", remote_path="/root/telemetry.py")
    # GIT_SHA is set by the deploy workflow; containers read it for Sentry
    # releases, job logs and /health.
    .env({"GIT_SHA": os.environ.get("GIT_SHA", "unknown")})
)

# Shared key-value store for in-flight job progress. Keyed by Modal call_id
# so the worker can write {progress, stage, updated_at} as it advances and
# the web endpoint can look it up when polling. Entries are cleaned up when
# the job reaches a terminal state (see get_job / cancel_job below).
progress_dict = modal.Dict.from_name("rej-studio-progress", create_if_missing=True)

# Per-call_id stamp of when we spawned — used to bound how long stale
# progress entries can linger in the Dict if a worker dies without cleanup.
PROGRESS_TTL_SECONDS = 30 * 60

# Cost ceiling. Each container runs one job (the optimizer is CPU-bound), so
# this caps concurrent jobs — and therefore spend — at a level a single team
# can't blow past. The web app needs far fewer containers because every
# request is a short Modal API call handled concurrently.
MAX_JOB_CONTAINERS = 10
MAX_WEB_CONTAINERS = 2
WEB_CONCURRENT_INPUTS = 50

# Cold-start tracking: record module-level import time so the worker can
# detect a cold start vs. a warm invocation.
_MODULE_IMPORT_TIME = time.monotonic()


@app.function(
    image=image,
    timeout=600,
    secrets=[runtime_secret],
    max_containers=MAX_JOB_CONTAINERS,
    # Keep a finished worker around briefly so a burst of submissions reuses
    # it instead of paying a cold start each time. No min_containers: idle
    # capacity would cost money around the clock for a low-traffic app.
    scaledown_window=120,
    # No automatic retries: a failure here is almost always deterministic
    # (impossible constraints, bad rewrite), so a retry burns the same
    # minutes for the same error. The frontend offers a manual retry.
    retries=0,
)
def run_job(params: dict) -> dict:
    """Long-running gene optimization job."""
    sys.path.insert(0, "/root")
    from algorithm import process_single_request_json

    # The worker looks up its own FunctionCall id so it can write progress
    # into the shared Dict under the same key the web endpoint reads from.
    # Falls back to "" if the helper isn't available — progress writes
    # become no-ops, but the job still runs.
    try:
        call_id = modal.current_function_call_id() or ""
    except Exception:
        call_id = ""

    # Cold-start detection. If the worker spins up and immediately runs
    # this function within a short window of module import, it's a cold
    # start. Log it so we can quantify cold-start prevalence.
    now = time.monotonic()
    is_cold_start = (now - _MODULE_IMPORT_TIME) < 5.0

    # Per-stage timing: track when each stage started so we can log cumulative
    # wall-clock per stage at completion. Helps identify which constraint is
    # dominating runtime when dnachisel is slow.
    stage_timings: dict[str, float] = {}
    current_stage = {"name": "", "started_at": 0.0}

    def _close_stage(now: float) -> None:
        if current_stage["name"]:
            elapsed = now - current_stage["started_at"]
            stage_timings[current_stage["name"]] = (
                stage_timings.get(current_stage["name"], 0.0) + elapsed
            )

    cds_len = len(params.get("CDS", ""))
    job_started = time.monotonic()
    _log(
        "job.start",
        call_id=call_id,
        name=params.get("name"),
        cds_length=cds_len,
        options=params.get("options"),
        cold_start=is_cold_start,
        git_sha=os.environ.get("GIT_SHA", "unknown"),
    )

    # Throttled progress writer. dnachisel's inner loops would hammer this
    # Dict unthrottled; we only push on a meaningful delta or once every
    # couple of seconds. Keep the payload to JSON primitives.
    last_written = {"at": 0.0, "frac": -1.0, "stage": ""}

    def on_progress(frac: float, stage: str):
        now = time.monotonic()

        # Log every stage transition (unthrottled — stages are coarse-grained).
        if stage != current_stage["name"]:
            _close_stage(now)
            _log(
                "job.stage",
                call_id=call_id,
                stage=stage,
                elapsed_s=round(now - job_started, 3),
            )
            current_stage["name"] = stage
            current_stage["started_at"] = now

        if not call_id:
            return

        stage_changed = stage != last_written["stage"]
        # Write on: stage change, OR >=2% frac delta, OR >=1s since last write.
        # This keeps dnachisel's hot inner loop from hammering the Dict while
        # still feeding the 2s-poll frontend fresh numbers between checkpoints.
        if (
            not stage_changed
            and frac - last_written["frac"] < 0.02
            and now - last_written["at"] < 1.0
        ):
            return
        last_written["at"] = now
        last_written["frac"] = frac
        last_written["stage"] = stage
        progress_dict[call_id] = {
            "progress": float(frac),
            "stage": str(stage),
            "updated_at": time.time(),
        }

    try:
        result = process_single_request_json(
            CDS=params["CDS"],
            name=params["name"],
            OPTIONS=params["options"],
            on_progress=on_progress,
            corpus_version=params.get("corpus_version"),
        )
        _close_stage(time.monotonic())
        _log(
            "job.complete",
            call_id=call_id,
            name=params.get("name"),
            total_s=round(time.monotonic() - job_started, 3),
            stage_timings_s={k: round(v, 3) for k, v in stage_timings.items()},
            cold_start=is_cold_start,
            seed=result.get("seed"),
        )
        return result
    except Exception as e:
        _close_stage(time.monotonic())
        _log(
            "job.error",
            call_id=call_id,
            name=params.get("name"),
            total_s=round(time.monotonic() - job_started, 3),
            stage_timings_s={k: round(v, 3) for k, v in stage_timings.items()},
            error_type=type(e).__name__,
            error_message=str(e),
            cold_start=is_cold_start,
        )
        raise
    finally:
        # Clear progress on exit (success, error, or cancellation) so
        # get_job doesn't ever read stale "90%" after the call settled.
        _forget_progress(call_id)


# --- FastAPI web endpoint served on Modal ---

# CORS: restrict to production + preview origins only. "*" is the default
# for FastAPI, which would let any site submit jobs via the browser.
ALLOWED_ORIGINS = [
    o
    for o in [
        os.environ.get("CORS_ORIGIN"),  # explicit override
        "https://rej-studio.vercel.app",
        "https://rejstudio.com",
    ]
    if o
]
# In development, allow localhost. Keep this behind an env guard so prod
# never accidentally opens the door.
if os.environ.get("MODAL_ENVIRONMENT") == "dev":
    ALLOWED_ORIGINS.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

# Request-size cap (bytes). CDS max is 50k chars ≈ 50 KB; add generous
# headroom for JSON overhead + options but reject truly absurd payloads
# (e.g. someone POSTing a 10 MB body to tie up the worker).
MAX_REQUEST_BYTES = 256 * 1024  # 256 KB

# Docs and the OpenAPI schema are off: this app is called by the Next.js
# server, not browsed, and an unauthenticated schema just advertises the
# surface. /health stays public and minimal.
web_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# OpenTelemetry — auto-instruments FastAPI routes. No-ops when
# OTEL_EXPORTER_OTLP_ENDPOINT is not set. In production, set the env var
# in the Modal secret (rej-studio-runtime) to ship traces to an OTLP backend.
try:
    sys.path.insert(0, "/root")
    from telemetry import init_telemetry

    init_telemetry(web_app)
except Exception:
    pass  # OTEL packages not available or misconfigured — skip silently

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


# --- Auth -------------------------------------------------------------------
# Every /jobs route requires `Authorization: Bearer <JOB_API_TOKEN>`. The
# token comes from the rej-studio-runtime Modal secret; the Next.js server
# sends the same value. Without it anyone with the URL could spend compute.
_bearer = HTTPBearer(auto_error=False)
_warned_missing_token = False


def _job_api_token() -> str:
    return os.environ.get("JOB_API_TOKEN", "")


def require_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    """Reject /jobs requests without the shared bearer token.

    When JOB_API_TOKEN is unset the endpoint stays open and logs a warning
    once, so a deploy that lands before the secret exists doesn't take
    production down. Set the secret and the gate engages on the next cold
    container.
    """
    expected = _job_api_token()
    if not expected:
        global _warned_missing_token
        if not _warned_missing_token:
            _warned_missing_token = True
            _log("auth.disabled", reason="JOB_API_TOKEN is not set — /jobs is unauthenticated")
        return
    supplied = credentials.credentials if credentials else ""
    if not hmac.compare_digest(supplied, expected):
        _log("auth.rejected", has_credentials=bool(credentials))
        raise HTTPException(status_code=401, detail="Invalid or missing API token")


@web_app.middleware("http")
async def enforce_request_size(request: Request, call_next):
    """Reject oversized payloads up front using the declared length.

    Content-Length is a client-supplied hint, so it's only the cheap first
    check — `_read_capped_body` enforces the cap on the bytes actually read.
    """
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared = int(content_length)
        except ValueError:
            return JSONResponse({"detail": "Invalid Content-Length header."}, status_code=400)
        if declared > MAX_REQUEST_BYTES:
            return JSONResponse(
                {"detail": f"Request body too large (max {MAX_REQUEST_BYTES} bytes)."},
                status_code=413,
            )
    return await call_next(request)


async def _read_capped_body(request: Request) -> bytes:
    """Read the body, aborting once it exceeds the cap.

    A chunked request can omit Content-Length or understate it, so the real
    enforcement has to happen while streaming rather than before it.
    """
    total = 0
    chunks: list[bytes] = []
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_REQUEST_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Request body too large (max {MAX_REQUEST_BYTES} bytes).",
            )
        chunks.append(chunk)
    return b"".join(chunks)


class JobRequest(BaseModel):
    """A submitted job. Options are validated with the same model the local
    FastAPI app uses, so a bound can't be enforced on one path only."""

    CDS: str
    name: str
    options: ProcessOptions = ProcessOptions()
    # The gene corpus the sequence came from, when the caller knows it. Goes
    # into the run record; a pasted sequence has none.
    corpus_version: str | None = None

    def to_params(self) -> dict:
        """Payload for the worker, with the split point already resolved."""
        cds = normalize_cds(self.CDS)
        options = self.options.model_dump()
        options["split_point"] = self.options.resolved_split_point(len(cds))
        return {
            "CDS": cds,
            "name": normalize_name(self.name),
            "options": options,
            "corpus_version": self.corpus_version,
        }


class JobResponse(BaseModel):
    call_id: str


class JobError(BaseModel):
    code: str
    message: str
    retriable: bool


class JobStatus(BaseModel):
    # "running" | "completed" | "failed" | "cancelled" | "not_found"
    status: str
    result: dict[str, Any] | None = None
    error: JobError | None = None
    # Optional progress signal (0..1) and human-readable stage label. Only
    # populated while status == "running".
    progress: float | None = None
    stage: str | None = None


class HealthStatus(BaseModel):
    status: str
    git_sha: str


# --- Progress bookkeeping ---------------------------------------------------


def _forget_progress(call_id: str) -> None:
    """Drop a call's progress entry; never raise."""
    if not call_id:
        return
    with contextlib.suppress(Exception):
        progress_dict.pop(call_id, None)


def _read_progress(call_id: str) -> tuple[float | None, str | None]:
    """Latest progress for a call, or (None, None) when there's nothing fresh.

    Also deletes entries past the TTL: a worker killed mid-run (OOM, machine
    loss) never reaches its cleanup, and those rows would otherwise sit in the
    Dict forever.
    """
    try:
        snap = progress_dict.get(call_id)
    except Exception:
        return None, None
    if snap is None:
        return None, None
    updated_at = snap.get("updated_at", 0)
    if time.time() - updated_at >= PROGRESS_TTL_SECONDS:
        _forget_progress(call_id)
        return None, None
    return snap.get("progress"), snap.get("stage")


# --- Modal call indirection -------------------------------------------------
# Wrapped in module-level helpers so the handlers stay readable and the unit
# tests can stub the Modal SDK out.


def _function_call_from_id(call_id: str):
    from modal.functions import FunctionCall

    return FunctionCall.from_id(call_id)


def _spawn_job(params: dict) -> str:
    call = run_job.spawn(params)
    return call.object_id


# A cancelled call has no dedicated exception in modal 1.6.4 — a terminated
# input comes back as RemoteError — and older/newer clients may expose one, so
# look the names up instead of importing them.
_CANCELLATION_EXCEPTIONS = tuple(
    exc
    for exc in (
        getattr(modal.exception, name, None)
        for name in ("FunctionCallCancelledError", "InputCancellation")
    )
    if isinstance(exc, type)
)


def is_cancellation(exc: BaseException) -> bool:
    """Whether a failed `.get()` means "someone cancelled this job"."""
    if _CANCELLATION_EXCEPTIONS and isinstance(exc, _CANCELLATION_EXCEPTIONS):
        return True
    return isinstance(exc, modal.exception.RemoteError) and bool(
        re.search(r"cancel|terminat", str(exc), re.IGNORECASE)
    )


def _validation_detail(exc: ValidationError) -> list[dict[str, Any]]:
    """Field/message pairs for a 422 body.

    Pydantic's own `errors()` carries the original exception object in `ctx`,
    which can't be JSON-encoded, so build a plain payload.
    """
    return [
        {"loc": [str(part) for part in error["loc"]], "msg": error["msg"]} for error in exc.errors()
    ]


def _classify_error(exc: BaseException) -> JobError:
    """Map a worker failure to the error contract the frontend branches on.

    Validation failures are the caller's to fix; a timeout is worth retrying;
    anything else gets a generic message because the exception text can carry
    internals, and the real one is logged.
    """
    if is_cancellation(exc):
        return JobError(code="cancelled", message="Job was cancelled", retriable=True)
    if isinstance(exc, modal.exception.FunctionTimeoutError):
        return JobError(
            code="timeout",
            message="The optimization timed out. Try a shorter sequence or fewer objectives.",
            retriable=True,
        )
    # The worker's exception class may not be importable here (it lives in the
    # job image), so match on the name Modal preserves.
    if type(exc).__name__ in ("ValueError", "ValidationError", "RequestValidationError"):
        return JobError(code="invalid_input", message=str(exc), retriable=False)
    return JobError(
        code="backend",
        message="The optimization failed. Please try again or adjust the design options.",
        retriable=False,
    )


# --- Routes -----------------------------------------------------------------
# GET/DELETE handlers are sync `def` on purpose: FastAPI runs them in a
# threadpool, so the blocking Modal SDK calls inside can't stall the event
# loop (and with it every other in-flight poll).


@web_app.get("/health", response_model=HealthStatus)
def health() -> HealthStatus:
    """Public liveness probe. Deliberately says nothing about config."""
    return HealthStatus(status="ok", git_sha=os.environ.get("GIT_SHA", "unknown"))


@web_app.post("/jobs", response_model=JobResponse, dependencies=[Depends(require_token)])
async def create_job(request: Request):
    body = await _read_capped_body(request)
    try:
        payload = json.loads(body)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON body: {e}") from e
    try:
        job = JobRequest.model_validate(payload)
        params = job.to_params()
    except ValidationError as e:
        # 422 naming the offending field(s), so a bad or unknown option is
        # obvious rather than silently ignored.
        raise HTTPException(status_code=422, detail=_validation_detail(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # The worker introspects its own call_id via modal.current_function_call_id()
    # and writes progress under that key — no need to thread it through here.
    call_id = await run_in_threadpool(_spawn_job, params)
    return JobResponse(call_id=call_id)


@web_app.get("/jobs/{call_id}", response_model=JobStatus, dependencies=[Depends(require_token)])
def get_job(call_id: str) -> JobStatus:
    try:
        call = _function_call_from_id(call_id)
    except Exception:
        return JobStatus(status="not_found")

    try:
        result = call.get(timeout=0)
    except TimeoutError:
        # Still running — surface the latest progress the worker pushed.
        progress, stage = _read_progress(call_id)
        return JobStatus(status="running", progress=progress, stage=stage)
    except Exception as e:
        _forget_progress(call_id)
        if is_cancellation(e):
            return JobStatus(
                status="cancelled",
                error=JobError(code="cancelled", message="Job was cancelled", retriable=True),
            )
        _log("job.failed", call_id=call_id, error_type=type(e).__name__, error_message=str(e))
        return JobStatus(status="failed", error=_classify_error(e))

    # Reaching here means call.get() returned — the worker's finally block
    # should have already cleared progress, but this is a cheap safety net
    # against races (web read seeing the settled call before the worker's
    # cleanup lands in the Dict).
    _forget_progress(call_id)
    return JobStatus(status="completed", result=result)


@web_app.delete("/jobs/{call_id}", response_model=JobStatus, dependencies=[Depends(require_token)])
def cancel_job(call_id: str) -> JobStatus:
    try:
        call = _function_call_from_id(call_id)
    except Exception:
        return JobStatus(status="not_found")

    try:
        call.cancel()
    except Exception as e:
        _log("job.cancel_failed", call_id=call_id, error_type=type(e).__name__)
        return JobStatus(
            status="failed",
            error=JobError(
                code="backend",
                message=f"Failed to cancel: {e}",
                retriable=True,
            ),
        )
    finally:
        _forget_progress(call_id)

    return JobStatus(
        status="cancelled",
        error=JobError(code="cancelled", message="Job cancelled", retriable=True),
    )


@app.function(
    image=image,
    secrets=[runtime_secret],
    max_containers=MAX_WEB_CONTAINERS,
    scaledown_window=300,
    # The web app only brokers Modal API calls, so one container can snapshot
    # its imports and resume quickly.
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=WEB_CONCURRENT_INPUTS)
@modal.asgi_app()
def web():
    return web_app
