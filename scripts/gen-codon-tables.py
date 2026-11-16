"""Emit Rust source for the genetic code and codon-usage tables.

The Rust optimizer needs the same tables DNAChisel uses, but shipping data
files to a browser means extra fetches, so they are baked into the binary as
constants instead. Run this whenever Biopython or python_codon_tables changes:

    uv run python .claude/worktrees/rust-optimizer/scripts/gen-codon-tables.py \
        > rust/optimizer/src/tables.rs

`rust/optimizer/tests/table_parity.rs` re-checks the committed output against
Python, so a stale file fails the test suite rather than drifting silently.
"""

import math
import sys

import python_codon_tables as pct
from dnachisel import biotools
from dnachisel.biotools import get_backtranslation_table

BASES = "ACGT"
SPECIES = (("HUMAN", "h_sapiens"), ("MOUSE", "m_musculus"))


def main() -> None:
    codons = [a + b + c for a in BASES for b in BASES for c in BASES]
    genetic_code = {codon: biotools.translate(codon) for codon in codons}
    backtranslation = get_backtranslation_table("Standard")

    out: list[str] = [
        "//! Genetic code and codon-usage tables.",
        "//!",
        "//! GENERATED FILE — do not edit by hand. Produced by",
        "//! scripts/gen-codon-tables.py from Biopython's Standard genetic code",
        "//! and python_codon_tables, so the optimizer carries its tables in the",
        "//! binary instead of fetching data files in the browser.",
        "//! tests/table_parity.rs checks this file still matches Python.",
        "",
        "// A codon used exactly half the time has log frequency -0.693...,",
        "// which clippy reads as an approximation of LN_2. These are data,",
        "// not approximations, so the lint does not apply.",
        "#![allow(clippy::approx_constant)]",
        "",
        "/// Codon -> amino acid, in ACGT-sorted codon order ('*' is a stop).",
        "pub const GENETIC_CODE: [(&str, char); 64] = [",
    ]
    out += [f"    (\"{codon}\", '{genetic_code[codon]}')," for codon in codons]
    out += ["];", ""]

    amino_acids = sorted({genetic_code[codon] for codon in codons})
    out += [
        "/// Amino acid -> its synonymous codons, in DNAChisel's backtranslation",
        "/// order (Biopython forward-table order, with stop codons appended).",
        "/// EnforceTranslation turns these into the mutation space.",
        f"pub const BACKTRANSLATION: [(char, &[&str]); {len(amino_acids)}] = [",
    ]
    for amino_acid in amino_acids:
        synonyms = ", ".join(f'"{codon}"' for codon in backtranslation[amino_acid])
        out.append(f"    ('{amino_acid}', &[{synonyms}]),")
    out += ["];", ""]

    for const_prefix, species in SPECIES:
        table = pct.get_codons_table(species)
        per_amino_acid = {aa: freqs for aa, freqs in table.items() if len(aa) == 1}

        entries = [
            # MaximizeCAI scores log(frequency or 0.001), so a zero-frequency
            # codon must substitute 0.001 here too or the scores diverge.
            (codon, amino_acid, math.log(frequency or 0.001))
            for amino_acid, freqs in sorted(per_amino_acid.items())
            for codon, frequency in sorted(freqs.items())
        ]
        out += [
            f"/// {species}: codon -> (amino acid, log of its usage frequency).",
            f"pub const {const_prefix}_CODON_LOG_FREQ: [(&str, char, f64); {len(entries)}] = [",
        ]
        out += [
            f"    (\"{codon}\", '{amino_acid}', {log_frequency!r}),"
            for codon, amino_acid, log_frequency in entries
        ]
        out += ["];", ""]

        best = {
            amino_acid: math.log(max(freqs.values()))
            for amino_acid, freqs in per_amino_acid.items()
        }
        out += [
            f"/// {species}: amino acid -> log frequency of its most-used codon.",
            f"pub const {const_prefix}_LOG_BEST: [(char, f64); {len(best)}] = [",
        ]
        out += [f"    ('{aa}', {best[aa]!r})," for aa in sorted(best)]
        out += ["];", ""]

    sys.stdout.write("\n".join(out))


if __name__ == "__main__":
    main()
