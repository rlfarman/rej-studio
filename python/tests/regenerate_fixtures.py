"""Regenerate the contract fixtures in python/tests/fixtures/.

Run from the repo root:

    uv run python -m python.tests.regenerate_fixtures

Writes:

* ``process-result.json`` — the real output of a small successful run with
  objectives enabled and a fixed seed, used by the Python contract test and
  by the TypeScript side as a cross-language fixture.
* ``contract.schema.json`` — the JSON Schema of the request options and the
  result model, so a field added or renamed on either side fails a test
  instead of surfacing as a runtime bug.

Re-run it whenever the request or result models change, and commit the diff
together with the model change.
"""

import json
from pathlib import Path

from python.algorithm import process_single_request_json
from python.contracts import ProcessOptions, ProcessRequest, ProcessResult

FIXTURES_DIR = Path(__file__).parent / "fixtures"
RESULT_FIXTURE = FIXTURES_DIR / "process-result.json"
SCHEMA_FIXTURE = FIXTURES_DIR / "contract.schema.json"

# A 90bp CDS (M-R-K-L-D-S-E-...-D-stop) — small enough to optimize in
# milliseconds, long enough to exercise the objectives and the split.
FIXTURE_CDS = "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA"
FIXTURE_NAME = "Contract Fixture"
FIXTURE_SEED = 20261116

# Objectives on: the fixture should cover the real code path, not the
# everything-disabled one.
FIXTURE_OPTIONS = ProcessOptions(
    codon_optimize="human",
    remove_cryptic_ss=True,
    minimize_CpGs=True,
    reduce_kmer_complexity=True,
    enforce_gc=True,
    stim_5=False,
    stim_3=False,
    split_point=45,
    ensure_wggw=True,
    seed=FIXTURE_SEED,
)


def build_result() -> dict:
    """Run the optimizer and return the validated result payload."""
    request = ProcessRequest(CDS=FIXTURE_CDS, name=FIXTURE_NAME, options=FIXTURE_OPTIONS)
    raw = process_single_request_json(
        CDS=request.CDS,
        name=request.name,
        OPTIONS=request.to_options_dict(),
    )
    # Wall-clock timing would churn the fixture on every regeneration.
    raw["processing_time_seconds"] = 0.0
    return ProcessResult(**raw).model_dump(mode="json")


def build_schema() -> dict:
    """JSON Schema for the request and result contracts."""
    return {
        "request": ProcessRequest.model_json_schema(),
        "options": ProcessOptions.model_json_schema(),
        "result": ProcessResult.model_json_schema(),
    }


def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    RESULT_FIXTURE.write_text(json.dumps(build_result(), indent=2, sort_keys=True) + "\n")
    SCHEMA_FIXTURE.write_text(json.dumps(build_schema(), indent=2, sort_keys=True) + "\n")
    print(f"Wrote {RESULT_FIXTURE} and {SCHEMA_FIXTURE}")


if __name__ == "__main__":
    main()
