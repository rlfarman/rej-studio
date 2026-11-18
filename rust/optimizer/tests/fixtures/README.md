# Parity fixtures (frozen)

These files are a recording of what the Python optimizer (`python/algorithm.py`
on DNAChisel) did, made once and kept as regression snapshots. The Python
backend and the scripts that produced them are deleted, so they cannot be
regenerated, and they must not be edited.

**The Rust crate is now the reference implementation.** A change to the
optimizer is made in Rust only. If it is meant to change a design, the test
that compares against these fixtures should fail; record the new behaviour
in a new Rust-owned fixture or test, and leave these as the record of what
DNAChisel did.

## Where they came from

Recorded by `scripts/gen-parity-fixtures.py` (deleted in step 4 of
`docs/cloudflare-migration.md`; last version at commit `8ea23611`), which ran
`python/algorithm.py` in the environment `uv.lock` pinned when the fixtures
were committed in #284:

| Package             | Version |
| ------------------- | ------- |
| DNAChisel           | 3.2.16  |
| Biopython           | 1.88    |
| python_codon_tables | 0.1.18  |
| NumPy               | 2.5.5   |
| Python              | 3.14    |

`src/tables.rs` came from the same environment through
`scripts/gen-codon-tables.py` (also deleted) and is frozen the same way.

## The files

| File                     | SHA-256 (first 16)  | What it holds                                                                                                             | Read by                 |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `scoring.json`           | `dab8d7f13a5d2d0a`  | Every objective's score, locations, message and text summary for 4 fixed sequences and option sets                       | `parity.rs`             |
| `pipeline.json`          | `7e0704620301e93a`  | The deterministic WGGW and split-marker steps for 4 split configurations                                                  | `parity.rs`             |
| `seeds.json`             | `8b6a9b73d4c7c06f`  | Seeds Python derived from 5 sequence and option combinations                                                              | `parity.rs`             |
| `runs.json`              | `79bb3a96ef408433`  | 3 whole seeded runs: starting and achieved score, and the result                                                          | `parity.rs`             |
| `real_genes_input.json`  | `2a01250f4756be05`  | Input, not output: 3 real human CDSs (600, 1,182 and 3,633 bases), picked by hand                                         | the generator           |
| `real_genes.json`        | `3c21e60e03751ab3`  | For each of those: the objectives report, the split pipeline and a full seeded design (seed 1234), base for base          | `real_genes.rs`, `wasm-smoke.mjs` |
| `tables.json`            | `1caa6a8026a43480`  | Biopython's Standard genetic code, DNAChisel's back-translation order, and python_codon_tables' human and mouse usage     | `table_parity.rs`       |

`sha256sum` over the files above should still print those digests; a different
one means a fixture was edited. (The directory holds two more files: one
generated, and one recorded from Biopython rather than DNAChisel — see below.)

## Not a recording: the WGGW reference

| File                   | SHA-256 (first 16) | What it holds                                                                                                | Read by                                   |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `wggw_reference.json`  | `953a670ff6ca2c43` | This crate's own WGGW answers — candidates, their distance order, the recode and the chosen split — for every isoform in `public/gene-data/sample` and every sequence above | `sequence-utils.wggw-parity.test.ts` |

`wggw_reference.json` is **generated, not frozen**: it is what the crate says
today, written by `cargo run --release --example wggw-reference`, and it exists
so the TypeScript WGGW ranking the gene pages use can be compared against this
crate without loading the WebAssembly. Regenerate it whenever
`optimizer/src/rej.rs` changes and commit the result — Rust CI reruns the
example and fails if the committed file differs. Its digest will change with
it, so the line above is a record of the current file, not a seal on it.

## A second recording: the alignment reference

| File                   | SHA-256 (first 16) | What it holds                                                                                                              | Read by    |
| ---------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `align_reference.json` | `0e70ce285ccac53f` | 21 protein pairs (6 constructed, 15 isoform pairs from the sample corpus) with Biopython's global alignment score, and the identities and aligned pairs of the alignment `src/align.rs` picks among the optimal ones | `align.rs` |

Frozen like the DNAChisel files above: it is an independent implementation's
answer, so it is never regenerated to match the crate. If `src/align.rs`
changes on purpose, add new cases in Rust and leave this one alone.

It was recorded with `scripts/gen-align-fixtures.py` (deleted with the rest
of the Python; last version at commit `95891ab5`), which is reproduced below
so the recording can be repeated. Biopython is not a project dependency; `uvx`
ran it in a throwaway environment:

| Package   | Version |
| --------- | ------- |
| Biopython | 1.88    |
| NumPy     | 2.5.5   |
| Python    | 3.14.10 |

```bash
uvx --from biopython==1.88 python -I gen-align-fixtures.py > align_reference.json
sha256sum align_reference.json   # 0e70ce285ccac53f7e60409359182a07f342424b7f0c8a006efb8d9c02ac2b38
```

The script looks up the TP53, CDKN2A, NFE2L2, BRCA1, MYC and ACTB pairs in
`public/gene-data/sample/genes/`, so run it from a directory where
`../public` is that sample (it resolves paths from its own location). Rerun
on 2026-11-16 with the versions above, it reproduced the committed file byte
for byte.

The scoring is `PairwiseAligner` in global mode with BLOSUM62, `open_gap_score
= -12` and `extend_gap_score = -1` — BLAST's gap existence 11 plus extension 1,
which Biopython counts with the opening residue included. Biopython returns
_an_ optimal alignment, not the one with the most identities that `align.rs`
picks, so the script gets an independent value for that tie-break by scoring
again with a scaled matrix: `K² · BLOSUM62(x, y) + K · [x = y] + 1`, gaps
scaled by `K²`, `K = 4096`. With `K` larger than any count, the optimum of the
scaled score is the lexicographic optimum of (score, identities, pairs), and
all three decode exactly from it (every value stays below 2⁵³, so float64 is
exact). `biopython_first_alignment_identities` records Biopython's own
alignment, for information only.

```python
"""Reference values for rust/optimizer/src/align.rs, from Biopython."""

import json
import sys
from pathlib import Path

from Bio.Align import PairwiseAligner, substitution_matrices

GAP_OPEN = -12  # BLAST existence 11 + extension 1 for the first residue
GAP_EXTEND = -1
K = 4096

ROOT = Path(__file__).resolve().parent.parent
GENES = ROOT / "public/gene-data/sample/genes"

blosum = substitution_matrices.load("BLOSUM62")
alphabet = blosum.alphabet


def aligner(matrix, scale):
    a = PairwiseAligner()
    a.mode = "global"
    a.substitution_matrix = matrix
    a.open_gap_score = GAP_OPEN * scale
    a.extend_gap_score = GAP_EXTEND * scale
    return a


plain = aligner(blosum, 1)
scaled_matrix = substitution_matrices.Array(alphabet, dims=2)
for x in alphabet:
    for y in alphabet:
        scaled_matrix[x, y] = blosum[x, y] * K * K + (K if x == y else 0) + 1
scaled = aligner(scaled_matrix, K * K)


def reference(name, a, b):
    best = plain.align(a, b)[0]
    biopython_identities = int(best.counts().identities)
    total = int(scaled.score(a, b))
    score, rest = divmod(total, K * K)
    identities, pairs = divmod(rest, K)
    assert score == int(best.score), (name, score, best.score)
    assert biopython_identities <= identities
    return {
        "name": name,
        "a": a,
        "b": b,
        "score": score,
        "identities": identities,
        "aligned_pairs": pairs,
        "biopython_first_alignment_identities": biopython_identities,
    }


def gene(symbol):
    for path in sorted(GENES.glob("*.json")):
        data = json.loads(path.read_text())
        if data["symbol"] == symbol and data["species"] == "human":
            # Longest first, the order the identity matrix uses.
            return sorted(
                (i["proteinSequence"] for i in data["isoforms"]),
                key=len,
                reverse=True,
            )
    raise SystemExit(f"{symbol} not in the sample corpus")


EXON1 = "MEEPQSDPSVEPPLSQETFSDLWKLL"
EXON2 = "PENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP"
EXON3 = "DEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSS"
EXON4 = "SVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQ"
EXON5 = "LAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDG"

cases = [
    ("identical", EXON1 + EXON2, EXON1 + EXON2),
    ("one substitution", "MEEPQSDPSVEPPLSQ", "MEEPQSDPSIEPPLSQ"),
    ("internal deletion", EXON1 + EXON2 + EXON3, EXON1 + EXON3),
    (
        "two exon skips",
        EXON1 + EXON2 + EXON3 + EXON4 + EXON5,
        EXON1 + EXON3 + EXON5,
    ),
    ("frame-shifted tail", EXON1 + EXON2 + EXON3, EXON1 + EXON2 + "RPWRRGSCWPGPRAPAHPLWGEAPCRP*"),
    ("no similarity", "WWWWWWWWWW", "PPPPPP"),
]

for symbol, pairs in [
    ("TP53", [(0, 1), (0, 5), (2, 9), (4, 12)]),
    ("CDKN2A", [(0, 1), (0, 3), (1, 5)]),
    ("NFE2L2", [(0, 7), (3, 20), (10, 40)]),
    ("BRCA1", [(0, 1), (0, 9), (3, 14)]),
    ("MYC", [(0, 6)]),
    ("ACTB", [(0, 4)]),
]:
    seqs = gene(symbol)
    for i, j in pairs:
        cases.append((f"{symbol} {i} vs {j}", seqs[i], seqs[j]))

json.dump([reference(*c) for c in cases], sys.stdout, indent=1)
sys.stdout.write("\n")
```
