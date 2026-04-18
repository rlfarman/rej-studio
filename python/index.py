import asyncio
import io
import json
import os
import queue
import re
import threading
import zipfile

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from .algorithm import process_single_request, process_single_request_json
from .telemetry import init_telemetry

# Create FastAPI instance with custom docs and openapi URL
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

# OpenTelemetry — auto-instruments FastAPI routes. No-ops when
# OTEL_EXPORTER_OTLP_ENDPOINT is not set (local dev without Axiom).
init_telemetry(app)


# Define input model for the request
class ProcessOptions(BaseModel):
    codon_optimize: str | None = None
    codon_optimize_weight: float = 1.0
    remove_cryptic_ss: bool = True
    remove_cryptic_ss_weight: float = 1.0
    minimize_CpGs: bool = True
    minimize_CpGs_weight: float = 1.0
    reduce_kmer_complexity: bool = True
    reduce_kmer_complexity_weight: float = 1.0
    enforce_gc: bool = True
    stim_5: bool = True
    stim_3: bool = True
    split_point: int = 500
    ensure_wggw: bool = True
    wggw_threshold: int = 300


class ProcessRequest(BaseModel):
    CDS: str  # Coding sequence
    name: str  # Name identifier for the output files
    options: ProcessOptions

    @field_validator("CDS")
    @classmethod
    def validate_cds(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Coding sequence must not be empty")
        if not re.match(r"^[ACGTU]+$", v):
            raise ValueError("Coding sequence must contain only A, C, G, T, or U")
        if len(v) % 3 != 0:
            raise ValueError("Coding sequence length must be a multiple of 3")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty")
        if len(v) > 250:
            raise ValueError("Name must be 250 characters or less")
        return v


@app.post("/api/py/process")
def process_gene(request: ProcessRequest):
    # Define results folder
    results_folder = "/tmp/results"

    # Call the process_single_request function
    try:
        report_filename, sequences_filename = process_single_request(
            CDS=request.CDS,
            name=request.name,
            OPTIONS=request.options.model_dump(),
            results_folder=results_folder,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing gene: {str(e)}") from e

    # Check if the output files were created
    if not report_filename or not os.path.exists(report_filename):
        raise HTTPException(status_code=500, detail="Failed to generate report.")

    if not sequences_filename or not os.path.exists(sequences_filename):
        raise HTTPException(
            status_code=500,
            detail="Failed to generate optimized sequences. Check the report for details.",
        )

    try:
        # Create an in-memory zip file
        zip_buffer = io.BytesIO()
        safe_name = re.sub(r"[^\w\-. ]", "_", request.name)
        with zipfile.ZipFile(zip_buffer, "w") as zip_file:
            zip_file.write(report_filename, arcname=f"{safe_name}_report.txt")
            zip_file.write(sequences_filename, arcname=f"{safe_name}_sequences.txt")

        # Prepare the zip file for download
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}_results.zip"'},
        )
    finally:
        # Clean up temp files
        for f in [report_filename, sequences_filename]:
            if f and os.path.exists(f):
                os.remove(f)


class WggwSiteInfo(BaseModel):
    position: int
    motif: str
    distance_from_split: int
    original_codons: list[str]
    new_codons: list[str]


class ObjectiveLocation(BaseModel):
    start: int
    end: int
    strand: int | None = None


class ObjectiveEvaluationEntry(BaseModel):
    objective: str
    passes: bool
    score: float
    message: str
    locations: list[ObjectiveLocation] = []


class ObjectivesReport(BaseModel):
    entries: list[ObjectiveEvaluationEntry] = []
    total_score: float | None = None


class ProcessResult(BaseModel):
    name: str
    original_sequence: str
    optimized_sequence: str
    seq5: str
    seq3: str
    split_point: int
    used_wggw_as_split: bool
    objectives_before: str
    objectives_after: str
    objectives_report_before: ObjectivesReport = ObjectivesReport()
    objectives_report_after: ObjectivesReport = ObjectivesReport()
    wggw_info: dict[str, WggwSiteInfo] | None = None
    processing_time_seconds: float


@app.post("/api/py/process-json", response_model=ProcessResult)
def process_gene_json(request: ProcessRequest):
    try:
        result = process_single_request_json(
            CDS=request.CDS,
            name=request.name,
            OPTIONS=request.options.model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing gene: {str(e)}") from e

    return result


# Sentinel the worker thread pushes onto the queue when it has no more events
# to emit, so the SSE generator knows to stop consuming. A bare object is used
# because None could be a legitimate payload someday.
_STREAM_DONE = object()


def _sse_format(event: str, payload: dict) -> str:
    """Encode a dict as one SSE frame: `event:` line + `data:` line + blank."""
    return f"event: {event}\ndata: {json.dumps(payload, default=str)}\n\n"


@app.post("/api/py/process-stream")
async def process_gene_stream(request: ProcessRequest):
    """Streaming variant of /process-json. Emits Server-Sent Events as the
    optimization progresses, then a final `done` event carrying the full
    ProcessResult payload. Shape:

        event: init     data: {name, length}
        event: progress data: {frac, stage}
        ... (many progress events) ...
        event: done     data: <ProcessResult>
        -- or --
        event: error    data: {message}

    The worker runs `process_single_request_json` on a thread and hands events
    through a thread-safe queue. The generator polls the queue via
    run_in_executor so it doesn't block the event loop.
    """
    loop = asyncio.get_running_loop()
    events: queue.Queue = queue.Queue()
    cds_length = len(request.CDS)
    req_name = request.name
    req_cds = request.CDS
    req_options = request.options.model_dump()

    def on_progress(frac: float, stage: str) -> None:
        # Called from the worker thread. Thread-safe because Queue.put is.
        events.put(("progress", {"frac": float(frac), "stage": str(stage)}))

    def worker() -> None:
        try:
            result = process_single_request_json(
                CDS=req_cds,
                name=req_name,
                OPTIONS=req_options,
                on_progress=on_progress,
            )
            events.put(("done", result))
        except Exception as e:
            events.put(("error", {"message": str(e) or "Optimization failed"}))
        finally:
            events.put(_STREAM_DONE)

    threading.Thread(target=worker, name="process-stream-worker", daemon=True).start()

    async def generator():
        # Announce up-front so the client can size the ribbon before any
        # progress events arrive.
        yield _sse_format("init", {"name": req_name, "length": cds_length})
        while True:
            item = await loop.run_in_executor(None, events.get)
            if item is _STREAM_DONE:
                return
            event, payload = item
            yield _sse_format(event, payload)
            # Terminal events; worker will still push DONE right after.
            if event in ("done", "error"):
                # Drain the sentinel so run_in_executor returns promptly.
                try:
                    tail = events.get_nowait()
                    if tail is not _STREAM_DONE:
                        events.put(tail)
                except queue.Empty:
                    pass
                return

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            # Let proxies know not to buffer SSE frames.
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
