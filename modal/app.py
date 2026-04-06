import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import modal
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

# Sentry — initialise early so errors during module import are captured.
# Only active when SENTRY_DSN is set (production deploys).
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

project_root = Path(__file__).parent.parent

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("dnachisel", "tqdm", "fastapi[standard]", "sentry-sdk[fastapi]")
    .add_local_file(project_root / "python" / "algorithm.py", remote_path="/root/algorithm.py")
)

# Shared key-value store for in-flight job progress. Keyed by Modal call_id
# so the worker can write {progress, stage, updated_at} as it advances and
# the web endpoint can look it up when polling. Entries are cleaned up when
# the job reaches a terminal state (see get_job / cancel_job below).
progress_dict = modal.Dict.from_name("rej-studio-progress", create_if_missing=True)

# Per-call_id stamp of when we spawned — used to bound how long stale
# progress entries can linger in the Dict if a worker dies without cleanup.
PROGRESS_TTL_SECONDS = 30 * 60

# Cold-start tracking: record module-level import time so the worker can
# detect a cold start vs. a warm invocation.
_MODULE_IMPORT_TIME = time.monotonic()


@app.function(image=image, timeout=600)
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
        )
        _close_stage(time.monotonic())
        _log(
            "job.complete",
            call_id=call_id,
            name=params.get("name"),
            total_s=round(time.monotonic() - job_started, 3),
            stage_timings_s={k: round(v, 3) for k, v in stage_timings.items()},
            cold_start=is_cold_start,
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
        if call_id:
            progress_dict.pop(call_id, None)


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
    ALLOWED_ORIGINS.extend(
        ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

# Request-size cap (bytes). CDS max is 50k chars ≈ 50 KB; add generous
# headroom for JSON overhead + options but reject truly absurd payloads
# (e.g. someone POSTing a 10 MB body to tie up the worker).
MAX_REQUEST_BYTES = 256 * 1024  # 256 KB

web_app = FastAPI()

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@web_app.middleware("http")
async def enforce_request_size(request: Request, call_next):
    """Reject payloads exceeding MAX_REQUEST_BYTES before parsing."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BYTES:
        return JSONResponse(
            {"detail": f"Request body too large (max {MAX_REQUEST_BYTES} bytes)."},
            status_code=413,
        )
    return await call_next(request)


class JobRequest(BaseModel):
    CDS: str
    name: str
    options: dict[str, Any]

    @field_validator("CDS")
    @classmethod
    def validate_cds(cls, v: str) -> str:
        if len(v) > 50_000:
            raise ValueError("CDS too long (max 50,000 characters)")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v) > 250:
            raise ValueError("Name too long (max 250 characters)")
        return v


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


@web_app.post("/jobs", response_model=JobResponse)
async def create_job(request: JobRequest):
    # The worker introspects its own call_id via modal.current_function_call_id()
    # and writes progress under that key — no need to thread it through here.
    call = run_job.spawn(request.model_dump())
    return JobResponse(call_id=call.object_id)


@web_app.get("/jobs/{call_id}", response_model=JobStatus)
async def get_job(call_id: str):
    from modal.functions import FunctionCall

    try:
        call = FunctionCall.from_id(call_id)
    except Exception:
        return JobStatus(status="not_found")

    try:
        result = call.get(timeout=0)
    except TimeoutError:
        # Still running — look up the latest progress the worker pushed.
        # Filter stale entries (worker died, Dict never cleaned up).
        progress = None
        stage = None
        snap = progress_dict.get(call_id)
        if snap is not None:
            updated_at = snap.get("updated_at", 0)
            if time.time() - updated_at < PROGRESS_TTL_SECONDS:
                progress = snap.get("progress")
                stage = snap.get("stage")
        return JobStatus(status="running", progress=progress, stage=stage)
    except modal.exception.FunctionCallCancelledError:
        progress_dict.pop(call_id, None)
        return JobStatus(
            status="cancelled",
            error=JobError(
                code="cancelled",
                message="Job was cancelled",
                retriable=True,
            ),
        )
    except Exception as e:
        # Backend error — the algorithm itself failed. These are usually
        # input-dependent (bad sequence, impossible constraints) so not
        # retriable with the same inputs.
        progress_dict.pop(call_id, None)
        return JobStatus(
            status="failed",
            error=JobError(
                code="backend",
                message=str(e) or "Job failed",
                retriable=False,
            ),
        )

    # Reaching here means call.get() returned — the worker's finally block
    # should have already cleared progress, but this is a cheap safety net
    # against races (web read seeing the settled call before the worker's
    # cleanup lands in the Dict).
    progress_dict.pop(call_id, None)
    return JobStatus(status="completed", result=result)


@web_app.delete("/jobs/{call_id}", response_model=JobStatus)
async def cancel_job(call_id: str):
    from modal.functions import FunctionCall

    try:
        call = FunctionCall.from_id(call_id)
    except Exception:
        return JobStatus(status="not_found")

    try:
        call.cancel()
        progress_dict.pop(call_id, None)
    except Exception as e:
        return JobStatus(
            status="failed",
            error=JobError(
                code="backend",
                message=f"Failed to cancel: {e}",
                retriable=True,
            ),
        )

    return JobStatus(
        status="cancelled",
        error=JobError(code="cancelled", message="Job cancelled", retriable=True),
    )


@app.function(image=image)
@modal.asgi_app()
def web():
    return web_app
