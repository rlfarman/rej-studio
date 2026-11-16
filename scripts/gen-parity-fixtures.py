"""Record what the Python optimizer does, so the Rust port can be checked.

The Rust port is only trustworthy if it agrees with the DNAChisel pipeline it
replaces. This script runs the real thing and writes down its answers;
`rust/optimizer/tests/parity.rs` replays the same inputs through Rust and
compares. Regenerate after any change to python/algorithm.py:

    uv run python .claude/worktrees/rust-optimizer/scripts/gen-parity-fixtures.py

Three groups are captured, from strictest to loosest:

  * `scoring` — every objective's score, locations and message on a fixed
    sequence. Pure functions of the sequence, so Rust must match exactly.
  * `pipeline` — the deterministic WGGW and split-marker steps, which involve
    no randomness and so must also match exactly.
  * `runs` — whole optimization runs. The search is random, so these record
    Python's achieved score for Rust to be measured against rather than
    required to reproduce byte for byte.
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3]))

from python import algorithm  # noqa: E402
from python.contracts import ProcessOptions, ProcessRequest  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parent.parent / "rust" / "optimizer" / "tests" / "fixtures"

# A short in-frame CDS: long enough to exercise every objective, short enough
# that a full run finishes in milliseconds.
CDS = "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA"
# A second sequence with deliberate repeats and CpGs, to give the k-mer and
# CpG objectives something to find.
REPETITIVE = "ATG" + ("CGCGATCCGGAA" * 6) + "TAA"


def base_options(**overrides) -> dict:
    options = {
        "codon_optimize": "human",
        "codon_optimize_weight": 1.0,
        "remove_cryptic_ss": True,
        "remove_cryptic_ss_weight": 1.0,
        "minimize_CpGs": True,
        "minimize_CpGs_weight": 1.0,
        "reduce_kmer_complexity": True,
        "reduce_kmer_complexity_weight": 1.0,
        "enforce_gc": True,
        "stim_5": False,
        "stim_3": False,
        "split_point": None,
        "selected_wggw_site": None,
        "ensure_wggw": True,
        "wggw_threshold": 0,
    }
    options.update(overrides)
    return options


def scoring_cases() -> list[dict]:
    """Objective scores on untouched sequences — no randomness involved."""
    cases = []
    for name, sequence, options in (
        ("human_all_objectives", CDS, base_options()),
        ("mouse_all_objectives", CDS, base_options(codon_optimize="mouse")),
        ("repetitive_kmers", REPETITIVE, base_options(reduce_kmer_complexity_k=8)),
        ("no_codon_optimization", CDS, base_options(codon_optimize=None)),
    ):
        problem = algorithm.build_optimization_problem(sequence, dict(options), logger=None)
        report = algorithm.build_objectives_report(problem)
        cases.append(
            {
                "name": name,
                "sequence": sequence,
                "options": options,
                "report": report,
                "text_summary": problem.objectives_text_summary(),
            }
        )
    return cases


def pipeline_cases() -> list[dict]:
    """The deterministic WGGW and split steps."""
    cases = []
    for name, sequence, split_point, threshold, stim in (
        ("midpoint_no_threshold", CDS, len(CDS) // 2, 0, False),
        ("midpoint_wide_threshold", CDS, len(CDS) // 2, 300, False),
        ("offset_split", CDS, 30, 300, False),
        ("with_stim_introns", CDS * 6, len(CDS * 6) // 2, 300, True),
    ):
        options = base_options(
            split_point=split_point, wggw_threshold=threshold, stim_5=stim, stim_3=stim
        )
        recoded, site = algorithm.insert_wggw_motif(sequence, split_point)
        split = algorithm.insertSplitMarkers(sequence, dict(options))
        seq5, seq3 = algorithm.replaceMarkersWithPlaceholders(split.sequence_with_markers)
        cases.append(
            {
                "name": name,
                "sequence": sequence,
                "split_point": split_point,
                "wggw_threshold": threshold,
                "stim": stim,
                "candidate_sites": algorithm.candidateSpliceSites(sequence),
                "inserted": {"sequence": recoded, "site": site},
                "split": {
                    "final_sequence": split.final_sequence,
                    "actual_split_point": split.actual_split_point,
                    "used_wggw_as_split": split.used_wggw_as_split,
                    "wggw_info": split.wggw_info,
                    "seq5": seq5,
                    "seq3": seq3,
                },
            }
        )
    return cases


def seed_cases() -> list[dict]:
    """Seed derivation, which hashes the canonical JSON of the request."""
    cases = []
    for name, sequence, options in (
        ("default", CDS, base_options()),
        ("mouse", CDS, base_options(codon_optimize="mouse")),
        ("explicit_k", CDS, base_options(reduce_kmer_complexity_k=8)),
        ("split_and_stim", CDS, base_options(split_point=45, stim_5=True, stim_3=True)),
        ("repetitive", REPETITIVE, base_options()),
    ):
        cases.append(
            {
                "name": name,
                "sequence": sequence,
                "options": options,
                "seed": algorithm.derive_seed(sequence, dict(options)),
            }
        )
    return cases


def run_cases() -> list[dict]:
    """Whole runs: the design Python produced and how well it scored."""
    cases = []
    for name, sequence, overrides in (
        ("cds_seeded", CDS, {"split_point": 45, "seed": 20261116}),
        ("cds_other_seed", CDS, {"split_point": 45, "seed": 7}),
        ("repetitive_seeded", REPETITIVE, {"seed": 99, "reduce_kmer_complexity_k": 8}),
    ):
        options = base_options(**{k: v for k, v in overrides.items() if k != "seed"})
        options["seed"] = overrides["seed"]
        request = ProcessRequest(CDS=sequence, name=name, options=ProcessOptions(**options))
        result = algorithm.process_single_request_json(
            CDS=request.CDS, name=request.name, OPTIONS=request.to_options_dict()
        )
        # Re-score the delivered design so Rust can be compared on equal terms.
        problem = algorithm.build_optimization_problem(
            result["optimized_sequence"], dict(options), logger=None
        )
        cases.append(
            {
                "name": name,
                "sequence": sequence,
                "options": options,
                "result": {
                    "optimized_sequence": result["optimized_sequence"],
                    "seq5": result["seq5"],
                    "seq3": result["seq3"],
                    "split_point": result["split_point"],
                    "used_wggw_as_split": result["used_wggw_as_split"],
                    "seed": result["seed"],
                    "wggw_info": result["wggw_info"],
                },
                "achieved_score": algorithm.build_objectives_report(problem)["total_score"],
                "starting_score": algorithm.build_objectives_report(
                    algorithm.build_optimization_problem(sequence, dict(options), logger=None)
                )["total_score"],
            }
        )
    return cases


def real_gene_cases() -> list[dict]:
    """The same checks against real human coding sequences.

    The short synthetic sequences above are easy to reason about; these are
    what the tool actually designs, with the repeats, GC swings and rare
    codons that only show up in real genes.
    """
    inputs = json.loads((OUT / "real_genes_input.json").read_text())
    cases = []
    for entry in inputs:
        sequence, options = entry["cds"], base_options(split_point=len(entry["cds"]) // 2)
        problem = algorithm.build_optimization_problem(sequence, dict(options), logger=None)
        split = algorithm.insertSplitMarkers(sequence, dict(options))
        seq5, seq3 = algorithm.replaceMarkersWithPlaceholders(split.sequence_with_markers)

        # A full seeded run. Because the Rust port reproduces NumPy's random
        # stream exactly, its design must equal this one base for base — the
        # strictest check in the suite, and the one that would catch a subtle
        # divergence in the search itself.
        seeded = dict(options)
        seeded["seed"] = 1234
        run = algorithm.process_single_request_json(
            CDS=sequence, name=entry["id"], OPTIONS=dict(seeded)
        )
        cases.append(
            {
                "id": entry["id"],
                "sequence": sequence,
                "options": options,
                "seeded_options": seeded,
                "seeded_run": {
                    "optimized_sequence": run["optimized_sequence"],
                    "seq5": run["seq5"],
                    "seq3": run["seq3"],
                    "split_point": run["split_point"],
                    "used_wggw_as_split": run["used_wggw_as_split"],
                },
                "report": algorithm.build_objectives_report(problem),
                "split": {
                    "final_sequence": split.final_sequence,
                    "actual_split_point": split.actual_split_point,
                    "used_wggw_as_split": split.used_wggw_as_split,
                    "seq5": seq5,
                    "seq3": seq3,
                },
            }
        )
    return cases


def table_cases() -> dict:
    """The codon tables, so the generated Rust constants can be re-checked.

    src/tables.rs is generated, and a stale copy would silently change every
    codon-optimization score, so the committed file is compared against
    Python rather than trusted.
    """
    import python_codon_tables as pct
    from dnachisel import biotools
    from dnachisel.biotools import get_backtranslation_table

    bases = "ACGT"
    codons = [a + b + c for a in bases for b in bases for c in bases]
    backtranslation = get_backtranslation_table("Standard")
    return {
        "genetic_code": {codon: biotools.translate(codon) for codon in codons},
        "backtranslation": {
            aa: backtranslation[aa]
            for aa in sorted({biotools.translate(codon) for codon in codons})
        },
        "species": {
            key: {
                aa: freqs for aa, freqs in sorted(pct.get_codons_table(key).items()) if len(aa) == 1
            }
            for key in ("h_sapiens", "m_musculus")
        },
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, builder in (
        ("scoring.json", scoring_cases),
        ("pipeline.json", pipeline_cases),
        ("seeds.json", seed_cases),
        ("runs.json", run_cases),
        ("real_genes.json", real_gene_cases),
        ("tables.json", table_cases),
    ):
        payload = builder()
        (OUT / filename).write_text(json.dumps(payload, indent=1, sort_keys=True) + "\n")
        print(f"wrote {filename} ({len(payload)} entries)")


if __name__ == "__main__":
    main()
