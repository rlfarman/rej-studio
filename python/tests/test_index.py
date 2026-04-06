"""Tests for FastAPI Pydantic models in python.index."""

import pytest
from pydantic import ValidationError

from python.index import ProcessOptions, ProcessRequest


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

    def test_rejects_non_multiple_of_3(self):
        with pytest.raises(ValidationError, match="multiple of 3"):
            ProcessRequest(CDS="ATGAA", name="test", options=ProcessOptions())


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
# ProcessOptions defaults
# ---------------------------------------------------------------------------
class TestProcessOptions:
    def test_default_values(self):
        opts = ProcessOptions()
        assert opts.codon_optimize is None
        assert opts.codon_optimize_weight == 1.0
        assert opts.remove_cryptic_ss is True
        assert opts.minimize_CpGs is True
        assert opts.reduce_kmer_complexity is True
        assert opts.enforce_gc is True
        assert opts.stim_5 is True
        assert opts.stim_3 is True
        assert opts.split_point == 500
        assert opts.ensure_wggw is True
        assert opts.wggw_threshold == 300

    def test_custom_values(self):
        opts = ProcessOptions(
            codon_optimize="human",
            split_point=1000,
            ensure_wggw=False,
        )
        assert opts.codon_optimize == "human"
        assert opts.split_point == 1000
        assert opts.ensure_wggw is False
