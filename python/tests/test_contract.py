"""Contract tests: verify the Python Pydantic models match the TypeScript interfaces.

These tests ensure the frontend and backend agree on the shape of shared
types. If a field is added/removed/renamed on one side, this test catches
the drift at CI time before it surfaces as a runtime bug.

Two committed fixtures back this up (see `regenerate_fixtures.py`):

* `fixtures/process-result.json` — a real successful run, validated against
  the result model here and shared with the TypeScript side.
* `fixtures/contract.schema.json` — the JSON Schema of the request and
  result models, so any field or bound change has to be regenerated
  deliberately rather than slipping through.

Regenerate both with:

    uv run python -m python.tests.regenerate_fixtures
"""

import json
from pathlib import Path

import pytest

from python.contracts import ProcessOptions, ProcessRequest
from python.index import (
    ObjectiveEvaluationEntry,
    ObjectiveLocation,
    ObjectivesReport,
    ProcessResult,
    RunRecord,
    RunRecordInput,
    RunRecordVersions,
    WggwSiteInfo,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
RESULT_FIXTURE = FIXTURES_DIR / "process-result.json"
SCHEMA_FIXTURE = FIXTURES_DIR / "contract.schema.json"
REGENERATE_HINT = "Run `uv run python -m python.tests.regenerate_fixtures` and commit the diff."


def _field_names(model) -> set[str]:
    """Extract field names from a Pydantic BaseModel."""
    return set(model.model_fields.keys())


# --- Canonical field sets from TypeScript interfaces ---
# These mirror src/features/design-tool/types/process-result.ts exactly.
# If the TS interface changes, update the set here and the Python model
# must follow (or vice versa).

TS_PROCESS_RESULT_FIELDS = {
    "name",
    "original_sequence",
    "optimized_sequence",
    "seq5",
    "seq3",
    "split_point",
    "used_wggw_as_split",
    "objectives_before",
    "objectives_after",
    "objectives_report_before",
    "objectives_report_after",
    "wggw_info",
    "processing_time_seconds",
    # The seed the run used, so a design can be reproduced. The TS
    # ProcessResult interface needs `seed?: number | null` to match.
    "seed",
    "run_record",
}

TS_RUN_RECORD_FIELDS = {
    "record_version",
    "started_at",
    "duration_seconds",
    "seed",
    "input",
    "options",
    "versions",
    "corpus_version",
}

TS_RUN_RECORD_INPUT_FIELDS = {
    "sha256",
    "length",
}

TS_RUN_RECORD_VERSIONS_FIELDS = {
    "algorithm_sha256",
    "dnachisel",
    "python",
    "commit",
}

TS_OBJECTIVES_REPORT_FIELDS = {
    "entries",
    "total_score",
}

TS_OBJECTIVE_EVALUATION_ENTRY_FIELDS = {
    "objective",
    "passes",
    "score",
    "message",
    "locations",
}

TS_OBJECTIVE_LOCATION_FIELDS = {
    "start",
    "end",
    "strand",
}

TS_WGGW_SITE_INFO_FIELDS = {
    "position",
    "motif",
    "distance_from_split",
    "original_codons",
    "new_codons",
}


class TestProcessResultContract:
    def test_field_parity(self):
        py_fields = _field_names(ProcessResult)
        assert py_fields == TS_PROCESS_RESULT_FIELDS, (
            f"Field mismatch.\n"
            f"  Python-only: {py_fields - TS_PROCESS_RESULT_FIELDS}\n"
            f"  TypeScript-only: {TS_PROCESS_RESULT_FIELDS - py_fields}"
        )

    def test_accepts_valid_payload(self):
        """Round-trip: a payload that satisfies the TS interface must also validate in Python."""
        payload = {
            "name": "Test",
            "original_sequence": "ATGAAATGA",
            "optimized_sequence": "ATGAAATGA",
            "seq5": "ATGAAA",
            "seq3": "TGA",
            "split_point": 6,
            "used_wggw_as_split": False,
            "objectives_before": "ok",
            "objectives_after": "ok",
            "objectives_report_before": {"entries": [], "total_score": None},
            "objectives_report_after": {"entries": [], "total_score": None},
            "wggw_info": None,
            "processing_time_seconds": 1.23,
            "run_record": {
                "record_version": 1,
                "started_at": "2026-11-16T09:30:00Z",
                "duration_seconds": 1.23,
                "seed": 12345,
                "input": {"sha256": "0" * 64, "length": 9},
                "options": {"split_point": 6},
                "versions": {
                    "algorithm_sha256": "0" * 12,
                    "dnachisel": "3.2.16",
                    "python": "3.14.10",
                },
            },
        }
        result = ProcessResult(**payload)
        assert result.name == "Test"
        assert result.split_point == 6
        # seed is optional so an older payload still validates.
        assert result.seed is None


class TestRunRecordContract:
    def test_field_parity(self):
        py_fields = _field_names(RunRecord)
        assert py_fields == TS_RUN_RECORD_FIELDS, (
            f"Field mismatch.\n"
            f"  Python-only: {py_fields - TS_RUN_RECORD_FIELDS}\n"
            f"  TypeScript-only: {TS_RUN_RECORD_FIELDS - py_fields}"
        )

    def test_input_field_parity(self):
        assert _field_names(RunRecordInput) == TS_RUN_RECORD_INPUT_FIELDS

    def test_versions_field_parity(self):
        assert _field_names(RunRecordVersions) == TS_RUN_RECORD_VERSIONS_FIELDS


class TestObjectivesReportContract:
    def test_field_parity(self):
        py_fields = _field_names(ObjectivesReport)
        assert py_fields == TS_OBJECTIVES_REPORT_FIELDS


class TestObjectiveEvaluationEntryContract:
    def test_field_parity(self):
        py_fields = _field_names(ObjectiveEvaluationEntry)
        assert py_fields == TS_OBJECTIVE_EVALUATION_ENTRY_FIELDS


class TestObjectiveLocationContract:
    def test_field_parity(self):
        py_fields = _field_names(ObjectiveLocation)
        assert py_fields == TS_OBJECTIVE_LOCATION_FIELDS


class TestWggwSiteInfoContract:
    def test_field_parity(self):
        py_fields = _field_names(WggwSiteInfo)
        assert py_fields == TS_WGGW_SITE_INFO_FIELDS

    def test_accepts_valid_payload(self):
        payload = {
            "position": 42,
            "motif": "TGGA",
            "distance_from_split": 10,
            "original_codons": ["GGT", "GAA"],
            "new_codons": ["GGA", "TGA"],
        }
        info = WggwSiteInfo(**payload)
        assert info.motif == "TGGA"


@pytest.fixture(scope="module")
def fixture_payload() -> dict:
    assert RESULT_FIXTURE.exists(), f"{RESULT_FIXTURE} is missing. {REGENERATE_HINT}"
    return json.loads(RESULT_FIXTURE.read_text())


@pytest.fixture(scope="module")
def committed_schema() -> dict:
    assert SCHEMA_FIXTURE.exists(), f"{SCHEMA_FIXTURE} is missing. {REGENERATE_HINT}"
    return json.loads(SCHEMA_FIXTURE.read_text())


class TestProcessResultFixture:
    """The committed output of a real run, shared with the TypeScript side."""

    def test_validates_against_the_result_model(self, fixture_payload):
        result = ProcessResult(**fixture_payload)
        assert result.optimized_sequence
        assert result.seq5
        assert result.seed is not None

    def test_field_set_matches_the_model(self, fixture_payload):
        """Catches a model field added or renamed without regenerating."""
        assert set(fixture_payload) == _field_names(ProcessResult), REGENERATE_HINT

    def test_describes_a_successful_run_with_objectives(self, fixture_payload):
        """A fixture produced with every objective off wouldn't prove much."""
        result = ProcessResult(**fixture_payload)
        assert len(result.optimized_sequence) == len(result.original_sequence)
        assert result.objectives_report_before.entries
        assert result.objectives_report_after.entries
        after = result.objectives_report_after.total_score
        before = result.objectives_report_before.total_score
        assert after is not None and before is not None
        assert after > before, "the fixture should show the optimizer improving the score"

    def test_fragments_reconstruct_the_optimized_sequence(self, fixture_payload):
        result = ProcessResult(**fixture_payload)
        clean = (result.seq5 + result.seq3).replace("[REJ5]", "").replace("[REJ3]", "")
        clean = clean.replace("[STIMINTRON]", "")
        assert clean == result.optimized_sequence


class TestSchemaDrift:
    """The exported JSON Schema is the cross-language source of truth for the
    request options and the result shape."""

    def test_request_schema_is_current(self, committed_schema):
        assert committed_schema["request"] == ProcessRequest.model_json_schema(), REGENERATE_HINT

    def test_options_schema_is_current(self, committed_schema):
        assert committed_schema["options"] == ProcessOptions.model_json_schema(), REGENERATE_HINT

    def test_result_schema_is_current(self, committed_schema):
        assert committed_schema["result"] == ProcessResult.model_json_schema(), REGENERATE_HINT

    def test_options_schema_documents_its_bounds(self, committed_schema):
        """The bounds are the point of the model — if they vanish, the schema
        test should say so."""
        options = committed_schema["options"]["properties"]
        assert options["codon_optimize_weight"]["maximum"] == 100.0
        assert options["reduce_kmer_complexity_k"]["minimum"] == 6
        assert committed_schema["options"]["additionalProperties"] is False
