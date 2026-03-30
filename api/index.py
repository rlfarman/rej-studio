from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
import os
import zipfile
import io
import re

from .algorithm import process_single_request

# Create FastAPI instance with custom docs and openapi URL
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


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
        raise HTTPException(status_code=500, detail=f"Error processing gene: {str(e)}")

    # Check if the output files were created
    if not report_filename or not os.path.exists(report_filename):
        raise HTTPException(status_code=500, detail="Failed to generate report.")

    if not sequences_filename or not os.path.exists(sequences_filename):
        raise HTTPException(status_code=500, detail="Failed to generate optimized sequences. Check the report for details.")

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
