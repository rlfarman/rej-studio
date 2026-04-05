import modal
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any

app = modal.App("rej-studio")

project_root = Path(__file__).parent.parent

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("dnachisel", "tqdm", "fastapi[standard]")
    .add_local_file(project_root / "api" / "algorithm.py", remote_path="/root/algorithm.py")
)

# Shared key-value store for in-flight job progress. Keyed by Modal call_id
# so the worker can write {progress, stage, updated_at} as it advances and
# the web endpoint can look it up when polling. Entries are cleaned up when
# the job reaches a terminal state (see get_job / cancel_job below).
progress_dict = modal.Dict.from_name("rej-studio-progress", create_if_missing=True)

# Per-call_id stamp of when we spawned — used to bound how long stale
# progress entries can linger in the Dict if a worker dies without cleanup.
PROGRESS_TTL_SECONDS = 30 * 60


@app.function(image=image, timeout=600)
def run_job(params: dict) -> dict:
    """Long-running gene optimization job."""
    import sys
    import time

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

    # Throttled progress writer. dnachisel's inner loops would hammer this
    # Dict unthrottled; we only push on a meaningful delta or once every
    # couple of seconds. Keep the payload to JSON primitives.
    last_written = {"at": 0.0, "frac": -1.0}

    def on_progress(frac: float, stage: str):
        if not call_id:
            return
        now = time.monotonic()
        if (
            frac - last_written["frac"] < 0.05
            and now - last_written["at"] < 2.0
        ):
            return
        last_written["at"] = now
        last_written["frac"] = frac
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
        return result
    finally:
        # Clear progress on exit (success, error, or cancellation) so
        # get_job doesn't ever read stale "90%" after the call settled.
        if call_id:
            progress_dict.pop(call_id, None)


# --- FastAPI web endpoint served on Modal ---

web_app = FastAPI()


class JobRequest(BaseModel):
    CDS: str
    name: str
    options: dict[str, Any]


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
    import time

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
