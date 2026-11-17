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
one means a fixture was edited. (The directory holds one more file, which is
generated — see below.)

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
