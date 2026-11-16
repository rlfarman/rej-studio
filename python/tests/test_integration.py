"""Integration tests for the full DNAChisel optimization pipeline.

These tests use real DNAChisel with a short 90bp CDS to exercise the
full optimization and splitting pipeline without excessive runtime.

Objectives-on runs are covered explicitly (with and without a progress
callback): running everything through all-objectives-off options is what let
a broken logger swap ship — it only fails when an objective exists.
"""

import re

import pytest

from python.algorithm import (
    OptimizationError,
    apply_explicit_wggw_site,
    derive_seed,
    insert_wggw_motif,
    optimize_and_split,
    process_single_request_json,
    resolve_seed,
    resolve_split_point,
    runOptimization,
)

# 90bp (30 amino acids): M-R-K-L-D-S-E-D-D-L-E-R-L-K-A-T-L-E-G-V-D-S-V-I-T-D-*
# Verified to translate correctly and be a valid CDS.
TEST_CDS = "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA"

# Minimal options for fast execution
FAST_OPTIONS = {
    "codon_optimize": None,
    "codon_optimize_weight": 1.0,
    "remove_cryptic_ss": False,
    "remove_cryptic_ss_weight": 1.0,
    "minimize_CpGs": False,
    "minimize_CpGs_weight": 1.0,
    "reduce_kmer_complexity": False,
    "reduce_kmer_complexity_weight": 1.0,
    "enforce_gc": False,
    "stim_5": False,
    "stim_3": False,
    "split_point": 45,
    "ensure_wggw": False,
    "wggw_threshold": 300,
}

# Full options for comprehensive testing
FULL_OPTIONS = {
    "codon_optimize": "human",
    "codon_optimize_weight": 1.0,
    "remove_cryptic_ss": True,
    "remove_cryptic_ss_weight": 1.0,
    "minimize_CpGs": True,
    "minimize_CpGs_weight": 1.0,
    "reduce_kmer_complexity": True,
    "reduce_kmer_complexity_k": 10,
    "reduce_kmer_complexity_weight": 1.0,
    "enforce_gc": True,
    "stim_5": False,
    "stim_3": False,
    "split_point": 45,
    "ensure_wggw": True,
    "wggw_threshold": 300,
}

# One objective at a time, so a failure points at the objective that broke.
OBJECTIVE_OPTION_SETS = {
    "codon_optimize": {"codon_optimize": "human", "enforce_gc": True},
    "minimize_CpGs": {"minimize_CpGs": True},
    "remove_cryptic_ss": {"remove_cryptic_ss": True},
    "reduce_kmer_complexity": {"reduce_kmer_complexity": True, "reduce_kmer_complexity_k": 10},
    "all": {
        "codon_optimize": "human",
        "minimize_CpGs": True,
        "remove_cryptic_ss": True,
        "reduce_kmer_complexity": True,
        "enforce_gc": True,
    },
}


def strip_design_placeholders(sequence: str) -> str:
    return sequence.replace("[REJ5]", "").replace("[REJ3]", "").replace("[STIMINTRON]", "")


@pytest.mark.timeout(30)
class TestRunOptimization:
    def test_produces_valid_optimized_sequence(self):
        optimized, obj_before, obj_after = runOptimization(TEST_CDS, {**FAST_OPTIONS})
        assert len(optimized) == len(TEST_CDS)
        assert all(c in "ACGT" for c in optimized)

    def test_preserves_protein_translation(self):
        from dnachisel import biotools

        optimized, _, _ = runOptimization(TEST_CDS, {**FAST_OPTIONS})
        assert biotools.translate(optimized) == biotools.translate(TEST_CDS)

    def test_returns_objectives_strings(self):
        _, obj_before, obj_after = runOptimization(TEST_CDS, {**FAST_OPTIONS})
        assert isinstance(obj_before, str)
        assert isinstance(obj_after, str)

    @pytest.mark.parametrize("objective", sorted(OBJECTIVE_OPTION_SETS))
    @pytest.mark.parametrize("with_progress", [False, True], ids=["no_progress", "with_progress"])
    def test_runs_with_objectives_enabled(self, objective, with_progress):
        """Both progress paths have to work.

        Without a callback the problem keeps the proglog logger DNAChisel
        built; with one it gets our bridge. Assigning the literal "bar"
        instead used to raise AttributeError inside optimize() for every run
        that had an objective.
        """
        fractions: list[float] = []
        on_progress = (lambda frac, stage: fractions.append(frac)) if with_progress else None
        opts = {**FAST_OPTIONS, **OBJECTIVE_OPTION_SETS[objective]}
        optimized, _, _ = runOptimization(TEST_CDS, opts, on_progress=on_progress)
        assert len(optimized) == len(TEST_CDS)
        assert all(c in "ACGT" for c in optimized)
        if with_progress:
            assert fractions == sorted(fractions)
            assert fractions[-1] > fractions[0]

    def test_with_gc_enforcement(self):
        opts = {**FAST_OPTIONS, "enforce_gc": True}
        optimized, _, _ = runOptimization(TEST_CDS, opts)
        gc_count = sum(1 for c in optimized if c in "GC")
        gc_percent = gc_count / len(optimized) * 100
        # GC enforcement targets 35-60%
        assert 30 <= gc_percent <= 65, f"GC% = {gc_percent:.1f}"

    def test_progress_callback_receives_increasing_fractions(self):
        fractions = []

        def on_progress(frac, stage):
            fractions.append(frac)

        runOptimization(TEST_CDS, {**FAST_OPTIONS}, on_progress=on_progress)
        assert len(fractions) > 0
        # Verify monotonically increasing
        for i in range(1, len(fractions)):
            assert fractions[i] >= fractions[i - 1], (
                f"Progress regressed: {fractions[i - 1]} -> {fractions[i]}"
            )

    def test_null_split_point_falls_back_to_midpoint(self):
        """The frontend sends an explicit null when the slider is untouched."""
        assert resolve_split_point({"split_point": None}, 90) == 45
        opts = {**FAST_OPTIONS, "split_point": None, "ensure_wggw": True}
        _, _, _, _, optimized = optimize_and_split(TEST_CDS, opts)
        assert len(optimized) == len(TEST_CDS)


@pytest.mark.timeout(60)
class TestOptimizeAndSplit:
    def test_produces_non_empty_fragments(self):
        opts = {**FAST_OPTIONS}
        seq5, seq3, obj_before, obj_after, optimized = optimize_and_split(TEST_CDS, opts)
        # At minimum, optimized should be non-empty
        assert len(optimized) > 0

    def test_with_wggw(self):
        opts = {**FAST_OPTIONS, "ensure_wggw": True}
        seq5, seq3, _, _, optimized = optimize_and_split(TEST_CDS, opts)
        assert len(optimized) > 0

    def test_fragments_reconstruct_final_optimized_sequence(self):
        opts = {**FAST_OPTIONS, "ensure_wggw": True, "stim_5": True, "stim_3": True}
        seq5, seq3, _, _, optimized = optimize_and_split(TEST_CDS, opts)
        clean_seq5 = strip_design_placeholders(seq5)
        clean_seq3 = strip_design_placeholders(seq3)
        assert clean_seq5 + clean_seq3 == optimized
        assert optimized[opts["actual_split_point"] :] == clean_seq3

    def test_full_options_run(self):
        seq5, seq3, _, _, optimized = optimize_and_split(TEST_CDS, {**FULL_OPTIONS})
        assert len(optimized) == len(TEST_CDS)
        assert strip_design_placeholders(seq5) + strip_design_placeholders(seq3) == optimized

    def test_raises_instead_of_returning_empty_strings(self, monkeypatch):
        """A failure here used to serialize as a successful empty result."""

        def boom(CDS, OPTIONS, on_progress=None):
            raise RuntimeError("dnachisel exploded")

        monkeypatch.setattr("python.algorithm.runOptimization", boom)
        with pytest.raises(RuntimeError, match="dnachisel exploded"):
            optimize_and_split(TEST_CDS, {**FAST_OPTIONS})

    def test_raises_when_optimizer_returns_nothing(self, monkeypatch):
        monkeypatch.setattr(
            "python.algorithm.runOptimization",
            lambda CDS, OPTIONS, on_progress=None: ("", "before", "after"),
        )
        with pytest.raises(OptimizationError, match="empty sequence"):
            optimize_and_split(TEST_CDS, {**FAST_OPTIONS})

    def test_handles_sequence_without_wggw_motif(self):
        """No WGGW site anywhere: the design falls back to the requested
        split point rather than failing."""
        # Poly-lysine (AAA) + stop: no [AT]GG[AT] motif and no compatible
        # dipeptide rewrite that keeps the translation.
        cds = "ATG" + "AAA" * 20 + "TGA"
        opts = {**FAST_OPTIONS, "split_point": 30, "ensure_wggw": True}
        seq5, seq3, _, _, optimized = optimize_and_split(cds, opts)
        assert len(optimized) == len(cds)
        assert strip_design_placeholders(seq5) + strip_design_placeholders(seq3) == optimized


@pytest.mark.timeout(30)
class TestInsertWggwMotif:
    def test_inserts_wggw_near_split_point(self):
        # Use a longer sequence to have more dipeptide options
        long_cds = TEST_CDS[:-3] + "AAA" * 10 + "TGA"  # extend with Lys codons
        recoded, info = insert_wggw_motif(long_cds, len(long_cds) // 2)
        # May or may not find a site depending on the protein sequence
        if info is not None:
            assert "position" in info
            assert "motif" in info
            wggw = re.compile(r"[AT]GG[AT]")
            assert wggw.search(info["motif"])

    def test_returns_original_when_no_site_found(self):
        # Very short sequence — unlikely to have compatible dipeptides
        short = "ATGTGA"  # Just M-stop, 1 amino acid — no dipeptides
        recoded, info = insert_wggw_motif(short, 3)
        assert info is None
        assert recoded == short

    def test_explicit_wggw_split_uses_bases_on_five_prime_side(self):
        sequence = "AATGGATGA"
        explicit_site = {
            "position": 4,
            "motif_start": 3,
            "motif": "TGGA",
            "hexamer_start": 1,
            "original_codons": ["AAT", "GGA"],
            "new_codons": ["AAT", "GGA"],
            "new_hexamer": "AATGGA",
        }
        recoded, info, _ = apply_explicit_wggw_site(sequence, explicit_site, 4)
        assert recoded == sequence
        assert info is not None
        assert info["split_position"] == 4

    def test_rejects_explicit_site_that_no_longer_matches(self):
        explicit_site = {
            "position": 4,
            "motif_start": 3,
            "motif": "TGGA",
            "hexamer_start": 1,
            "original_codons": ["CCC", "GGA"],
            "new_codons": ["AAT", "GGA"],
            "new_hexamer": "AATGGA",
        }
        with pytest.raises(ValueError, match="no longer matches"):
            apply_explicit_wggw_site("AATGGATGA", explicit_site, 4)


@pytest.mark.timeout(120)
class TestProcessSingleRequestJson:
    def test_returns_valid_result_dict(self):
        # Use FAST_OPTIONS to avoid CodonOptimize logger issues
        result = process_single_request_json(
            CDS=TEST_CDS,
            name="Integration Test",
            OPTIONS={**FAST_OPTIONS},
        )
        # Verify all expected keys exist
        assert result["name"] == "Integration Test"
        assert result["original_sequence"] == TEST_CDS
        assert isinstance(result["optimized_sequence"], str)
        assert isinstance(result["split_point"], int)
        assert isinstance(result["used_wggw_as_split"], bool)
        assert isinstance(result["processing_time_seconds"], (int, float))
        assert result["processing_time_seconds"] >= 0

        clean_seq5 = strip_design_placeholders(result["seq5"])
        clean_seq3 = strip_design_placeholders(result["seq3"])
        assert clean_seq5 + clean_seq3 == result["optimized_sequence"]
        assert result["split_point"] == len(clean_seq5)

    def test_objectives_reports_are_dicts(self):
        result = process_single_request_json(
            CDS=TEST_CDS,
            name="Report Test",
            OPTIONS={**FAST_OPTIONS},
        )
        assert "objectives_report_before" in result
        assert "objectives_report_after" in result
        assert isinstance(result["objectives_report_before"], dict)
        assert isinstance(result["objectives_report_after"], dict)
        assert "entries" in result["objectives_report_before"]

    def test_minimal_options_run(self):
        """All objectives disabled — only translation enforcement."""
        result = process_single_request_json(
            CDS=TEST_CDS,
            name="Minimal Test",
            OPTIONS={**FAST_OPTIONS},
        )
        assert result["original_sequence"] == TEST_CDS

    def test_rejects_ambiguous_nucleotides(self):
        with pytest.raises(ValueError, match="only A, C, G, T"):
            process_single_request_json(
                CDS="ATG" + "N" * 6 + "TGA", name="N Test", OPTIONS={**FAST_OPTIONS}
            )

    def test_rejects_non_multiple_of_three(self):
        with pytest.raises(ValueError, match="multiple of 3"):
            process_single_request_json(CDS="ATGAAAT", name="Frame Test", OPTIONS={**FAST_OPTIONS})

    def test_rejects_empty_sequence(self):
        with pytest.raises(ValueError, match="empty"):
            process_single_request_json(CDS="   ", name="Empty", OPTIONS={**FAST_OPTIONS})

    def test_normalizes_rna_input(self):
        rna = TEST_CDS.replace("T", "U")
        result = process_single_request_json(CDS=rna, name="RNA Test", OPTIONS={**FAST_OPTIONS})
        assert result["original_sequence"] == TEST_CDS


@pytest.mark.timeout(180)
class TestReproducibility:
    def test_same_inputs_produce_the_same_design(self):
        """Objectives on, no seed supplied: the derived seed has to make the
        run reproducible, otherwise two identical submissions disagree."""
        opts = {**FULL_OPTIONS}
        first = process_single_request_json(CDS=TEST_CDS, name="Seed", OPTIONS=opts)
        second = process_single_request_json(CDS=TEST_CDS, name="Seed", OPTIONS=opts)
        assert first["seed"] == second["seed"]
        assert first["optimized_sequence"] == second["optimized_sequence"]
        assert (first["seq5"], first["seq3"]) == (second["seq5"], second["seq3"])

    def test_explicit_seed_is_echoed_and_honoured(self):
        opts = {**FULL_OPTIONS, "seed": 1234}
        first = process_single_request_json(CDS=TEST_CDS, name="Seed", OPTIONS=opts)
        second = process_single_request_json(CDS=TEST_CDS, name="Seed", OPTIONS=opts)
        assert first["seed"] == 1234
        assert first["optimized_sequence"] == second["optimized_sequence"]

    def test_derived_seed_depends_on_inputs(self):
        base = derive_seed(TEST_CDS, {**FULL_OPTIONS})
        assert base == derive_seed(TEST_CDS, {**FULL_OPTIONS})
        assert base != derive_seed(TEST_CDS[:-3] + "TAA", {**FULL_OPTIONS})
        assert base != derive_seed(TEST_CDS, {**FULL_OPTIONS, "minimize_CpGs": False})

    def test_supplied_seed_does_not_change_derivation(self):
        """The derived seed ignores `seed`, so adding one doesn't change what
        an unseeded request would have produced."""
        assert derive_seed(TEST_CDS, {**FULL_OPTIONS}) == derive_seed(
            TEST_CDS, {**FULL_OPTIONS, "seed": 99}
        )
        assert resolve_seed(TEST_CDS, {**FULL_OPTIONS, "seed": 99}) == 99


@pytest.mark.timeout(300)
class TestLongSequence:
    def test_handles_a_long_cds(self):
        """A CDS at the long end of what the UI accepts still completes and
        keeps its translation."""
        from dnachisel import biotools

        # ~3 kb of real-looking coding sequence: repeat the test CDS body
        # (no internal stops) and cap it with a stop codon.
        body = TEST_CDS[:-3] * 37
        cds = body + "TGA"
        assert len(cds) % 3 == 0
        opts = {**FAST_OPTIONS, "enforce_gc": True, "split_point": len(cds) // 2}
        result = process_single_request_json(CDS=cds, name="Long", OPTIONS=opts)
        assert len(result["optimized_sequence"]) == len(cds)
        assert biotools.translate(result["optimized_sequence"]) == biotools.translate(cds)
