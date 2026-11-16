"""Local dev FastAPI app for the optimizer.

Dev-only: production runs the same algorithm on Modal (`modal/app.py`) and
Vercel has no Python runtime. The single endpoint is
`POST /api/py/process-json`; request/response models are shared with the
Modal boundary in `python/contracts.py`.
"""

from fastapi import FastAPI, HTTPException

from .algorithm import OptimizationError, process_single_request_json
from .contracts import (
    ObjectiveEvaluationEntry,
    ObjectiveLocation,
    ObjectivesReport,
    ProcessOptions,
    ProcessRequest,
    ProcessResult,
    RunRecord,
    RunRecordInput,
    RunRecordVersions,
    SelectedWggwSite,
    WggwSiteInfo,
)
from .telemetry import init_telemetry

# Re-exported so callers (and the contract tests) have one import site for
# the request/response shapes.
__all__ = [
    "ObjectiveEvaluationEntry",
    "ObjectiveLocation",
    "ObjectivesReport",
    "ProcessOptions",
    "ProcessRequest",
    "ProcessResult",
    "RunRecord",
    "RunRecordInput",
    "RunRecordVersions",
    "SelectedWggwSite",
    "WggwSiteInfo",
    "app",
]

# Create FastAPI instance with custom docs and openapi URL
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

# OpenTelemetry — auto-instruments FastAPI routes. No-ops when
# OTEL_EXPORTER_OTLP_ENDPOINT is not set (local dev without Axiom).
init_telemetry(app)


@app.post("/api/py/process-json", response_model=ProcessResult)
def process_gene_json(request: ProcessRequest):
    try:
        result = process_single_request_json(
            CDS=request.CDS,
            name=request.name,
            OPTIONS=request.to_options_dict(),
            corpus_version=request.corpus_version,
        )
    except ValueError as e:
        # Bad input that got past the model (e.g. an explicit WGGW rewrite
        # that no longer matches the sequence).
        raise HTTPException(status_code=422, detail=str(e)) from e
    except OptimizationError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing gene: {str(e)}") from e

    return result
