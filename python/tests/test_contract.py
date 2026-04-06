"""Contract tests: verify the Python Pydantic models match the TypeScript interfaces.

These tests ensure the frontend and backend agree on the shape of shared
types. If a field is added/removed/renamed on one side, this test catches
the drift at CI time before it surfaces as a runtime bug.
"""


from python.index import (
    ObjectiveEvaluationEntry,
    ObjectiveLocation,
    ObjectivesReport,
    ProcessResult,
    WggwSiteInfo,
)


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
        }
        result = ProcessResult(**payload)
        assert result.name == "Test"
        assert result.split_point == 6


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
