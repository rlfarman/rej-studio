"""Local FastAPI server that mirrors the Modal job API.

This exists purely for offline development. It exposes the same
`/jobs` + `/jobs/{call_id}` contract as `modal/app.py`, so the
Next.js server action can talk to either backend with a URL swap.

Jobs run synchronously inline; the first status poll returns
`completed`. That's fine — the frontend polls regardless.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any
import uuid

from .algorithm import process_single_request_json

app = FastAPI()

# In-memory job store. Keys are fake call_ids; values are completed results.
_jobs: dict[str, dict[str, Any]] = {}


class JobRequest(BaseModel):
    CDS: str
    name: str
    options: dict[str, Any]


class JobResponse(BaseModel):
    call_id: str


class JobStatus(BaseModel):
    status: str
    result: dict[str, Any] | None = None


@app.post("/jobs", response_model=JobResponse)
def create_job(request: JobRequest):
    call_id = str(uuid.uuid4())
    try:
        result = process_single_request_json(
            CDS=request.CDS,
            name=request.name,
            OPTIONS=request.options,
        )
        _jobs[call_id] = {"status": "completed", "result": result}
    except Exception as e:
        _jobs[call_id] = {"status": "failed", "result": {"error": str(e)}}
    return JobResponse(call_id=call_id)


@app.get("/jobs/{call_id}", response_model=JobStatus)
def get_job(call_id: str):
    job = _jobs.get(call_id)
    if job is None:
        return JobStatus(status="not_found")
    return JobStatus(status=job["status"], result=job["result"])
