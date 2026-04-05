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


@app.function(image=image, timeout=600)
def run_job(params: dict) -> dict:
    """Long-running gene optimization job."""
    import sys

    sys.path.insert(0, "/root")
    from algorithm import process_single_request_json

    result = process_single_request_json(
        CDS=params["CDS"],
        name=params["name"],
        OPTIONS=params["options"],
    )
    return result


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


@web_app.post("/jobs", response_model=JobResponse)
async def create_job(request: JobRequest):
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
        return JobStatus(status="running")
    except modal.exception.FunctionCallCancelledError:
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
        return JobStatus(
            status="failed",
            error=JobError(
                code="backend",
                message=str(e) or "Job failed",
                retriable=False,
            ),
        )

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
