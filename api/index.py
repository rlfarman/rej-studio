from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any
import os
import zipfile
import io

from .algorithm import process_single_request

# Create FastAPI instance with custom docs and openapi URL
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

# Define input model for the request
class ProcessRequest(BaseModel):
    CDS: str  # Coding sequence
    name: str  # Name identifier for the output files
    options: Dict[str, Any]  # Optimization options

@app.post("/api/py/process")
def process_gene(request: ProcessRequest):
    # Define results folder
    results_folder = "results"

    # Call the process_single_request function
    try:
        report_filename, sequences_filename = process_single_request(
            CDS=request.CDS,
            name=request.name,
            OPTIONS=request.options,
            results_folder=results_folder,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing gene: {str(e)}")

    # Check if the output files were created
    if not os.path.exists(report_filename) or not os.path.exists(sequences_filename):
        raise HTTPException(status_code=500, detail="Failed to process the gene.")

    # Create an in-memory zip file
    zip_buffer = io.BytesIO()
    # Write the report and sequences files to the zip file
    with zipfile.ZipFile(zip_buffer, "w") as zip_file:
        zip_file.write(report_filename, arcname=f"{request.name}_report.txt")
        zip_file.write(sequences_filename, arcname=f"{request.name}_sequences.txt")

    # Prepare the zip file for download
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={request.name}_results.zip"}
    )