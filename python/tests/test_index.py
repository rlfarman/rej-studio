"""Tests for the request contracts and the local FastAPI app."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from python.algorithm import OptimizationError
from python.index import ProcessOptions, ProcessRequest, app

client = TestClient(app)

VALID_CDS = "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA"


# ---------------------------------------------------------------------------
# ProcessRequest.validate_cds
# ---------------------------------------------------------------------------
class TestValidateCds:
    def test_accepts_valid_dna(self):
        req = ProcessRequest(CDS="ATGAAATGA", name="test", options=ProcessOptions())
        assert req.CDS == "ATGAAATGA"

    def test_uppercases_input(self):
        req = ProcessRequest(CDS="atgaaatga", name="test", options=ProcessOptions())
        assert req.CDS == "ATGAAATGA"

    def test_strips_whitespace(self):
        req = ProcessRequest(CDS="  ATGAAATGA  ", name="test", options=ProcessOptions())
        assert req.CDS == "ATGAAATGA"

    def test_accepts_rna(self):
        req = ProcessRequest(CDS="AUGAAAUAA", name="test", options=ProcessOptions())
        assert req.CDS == "AUGAAAUAA"

    def test_rejects_empty(self):
        with pytest.raises(ValidationError, match="empty"):
            ProcessRequest(CDS="", name="test", options=ProcessOptions())

    def test_rejects_invalid_chars(self):
        with pytest.raises(ValidationError, match="only A, C, G, T"):
            ProcessRequest(CDS="ATGXYZ", name="test", options=ProcessOptions())

    def test_rejects_ambiguous_n(self):
        with pytest.raises(ValidationError, match="only A, C, G, T"):
            ProcessRequest(CDS="ATGNNNTGA", name="test", options=ProcessOptions())

    def test_rejects_non_multiple_of_3(self):
        with pytest.raises(ValidationError, match="multiple of 3"):
            ProcessRequest(CDS="ATGAA", name="test", options=ProcessOptions())

    def test_rejects_over_max_length(self):
        with pytest.raises(ValidationError, match="50,000 characters or less"):
            ProcessRequest(CDS="ATG" * 20_000, name="test", options=ProcessOptions())


# ---------------------------------------------------------------------------
# ProcessRequest.validate_name
# ---------------------------------------------------------------------------
class TestValidateName:
    def test_accepts_valid_name(self):
        req = ProcessRequest(CDS="ATGAAATGA", name="Test Gene", options=ProcessOptions())
        assert req.name == "Test Gene"

    def test_strips_whitespace(self):
        req = ProcessRequest(CDS="ATGAAATGA", name="  Test  ", options=ProcessOptions())
        assert req.name == "Test"

    def test_rejects_empty(self):
        with pytest.raises(ValidationError, match="empty"):
            ProcessRequest(CDS="ATGAAATGA", name="", options=ProcessOptions())

    def test_rejects_too_long(self):
        with pytest.raises(ValidationError, match="250"):
            ProcessRequest(CDS="ATGAAATGA", name="A" * 251, options=ProcessOptions())


# ---------------------------------------------------------------------------
# ProcessOptions
# ---------------------------------------------------------------------------
class TestProcessOptions:
    def test_default_values(self):
        opts = ProcessOptions()
        assert opts.codon_optimize is None
        assert opts.codon_optimize_weight == 1.0
        assert opts.remove_cryptic_ss is True
        assert opts.minimize_CpGs is True
        assert opts.reduce_kmer_complexity is True
        assert opts.reduce_kmer_complexity_k == 10
        assert opts.enforce_gc is True
        assert opts.stim_5 is True
        assert opts.stim_3 is True
        assert opts.split_point is None
        assert opts.ensure_wggw is True
        assert opts.wggw_threshold == 300
        assert opts.seed is None

    def test_custom_values(self):
        opts = ProcessOptions(
            codon_optimize="human",
            split_point=1000,
            ensure_wggw=False,
        )
        assert opts.codon_optimize == "human"
        assert opts.split_point == 1000
        assert opts.ensure_wggw is False

    def test_split_point_defaults_to_midpoint(self):
        assert ProcessOptions().resolved_split_point(90) == 45
        assert ProcessOptions(split_point=12).resolved_split_point(90) == 12
        assert ProcessOptions(split_points=[21]).resolved_split_point(90) == 21

    def test_rejects_unknown_species(self):
        with pytest.raises(ValidationError):
            ProcessOptions.model_validate({"codon_optimize": "zebrafish"})

    @pytest.mark.parametrize(
        "field,value",
        [
            ("codon_optimize_weight", -1.0),
            ("codon_optimize_weight", 1_000.0),
            ("minimize_CpGs_weight", -0.5),
            ("remove_cryptic_ss_weight", 101.0),
            ("reduce_kmer_complexity_weight", 500.0),
            ("reduce_kmer_complexity_k", 2),
            ("reduce_kmer_complexity_k", 10_000),
            ("wggw_threshold", -1),
            ("split_point", -5),
            ("seed", -1),
            ("seed", 2**32),
        ],
    )
    def test_rejects_out_of_range(self, field, value):
        with pytest.raises(ValidationError):
            ProcessOptions.model_validate({field: value})

    def test_rejects_unknown_option(self):
        """Unknown keys used to be dropped silently — that's how a second
        splice junction could be requested and ignored."""
        with pytest.raises(ValidationError, match="make_it_fast"):
            ProcessOptions.model_validate({"make_it_fast": True})

    def test_rejects_multiple_split_points(self):
        with pytest.raises(ValidationError, match="multiple split points aren't supported yet"):
            ProcessOptions(split_points=[30, 60])

    def test_rejects_multiple_wggw_sites(self):
        with pytest.raises(ValidationError, match="multiple split points aren't supported yet"):
            ProcessOptions(selected_wggw_sites=[None, None])

    def test_accepts_single_split_point_array(self):
        assert ProcessOptions(split_points=[30]).split_points == [30]


class TestProcessRequestCrossValidation:
    def test_rejects_split_point_past_end(self):
        with pytest.raises(ValidationError, match="past the end"):
            ProcessRequest(
                CDS="ATGAAATGA",
                name="test",
                options=ProcessOptions(split_point=500),
            )

    def test_resolves_split_point_in_options_dict(self):
        req = ProcessRequest(CDS=VALID_CDS, name="test", options=ProcessOptions())
        assert req.to_options_dict()["split_point"] == len(VALID_CDS) // 2


# ---------------------------------------------------------------------------
# POST /api/py/process-json
# ---------------------------------------------------------------------------
class TestProcessJsonEndpoint:
    def test_rejects_bad_sequence_with_422(self):
        response = client.post(
            "/api/py/process-json",
            json={"CDS": "ATGNNNTGA", "name": "test", "options": {}},
        )
        assert response.status_code == 422

    def test_rejects_multiple_split_points_with_422(self):
        response = client.post(
            "/api/py/process-json",
            json={
                "CDS": VALID_CDS,
                "name": "test",
                "options": {"split_points": [20, 50]},
            },
        )
        assert response.status_code == 422
        assert "multiple split points aren't supported yet" in response.text

    def test_algorithm_failure_is_not_a_200(self, monkeypatch):
        """A failed run must never serialize as a successful empty design."""

        def boom(**kwargs):
            raise OptimizationError("Optimization produced an empty sequence")

        monkeypatch.setattr("python.index.process_single_request_json", boom)
        response = client.post(
            "/api/py/process-json",
            json={"CDS": VALID_CDS, "name": "test", "options": {"split_point": 45}},
        )
        assert response.status_code == 500
        assert "empty sequence" in response.text

    def test_value_error_maps_to_422(self, monkeypatch):
        def boom(**kwargs):
            raise ValueError("Selected WGGW site no longer matches")

        monkeypatch.setattr("python.index.process_single_request_json", boom)
        response = client.post(
            "/api/py/process-json",
            json={"CDS": VALID_CDS, "name": "test", "options": {"split_point": 45}},
        )
        assert response.status_code == 422
        assert "WGGW" in response.text

    def test_zip_endpoint_is_gone(self):
        """The old /api/py/process zip route (path traversal via `name`,
        no callers) was removed; the client builds zips itself."""
        response = client.post(
            "/api/py/process",
            json={"CDS": VALID_CDS, "name": "test", "options": {}},
        )
        assert response.status_code == 404
