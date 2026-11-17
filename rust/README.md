# rej-optimizer

The RNA End-Joining sequence optimizer, built to WebAssembly so the design
tool runs in a browser tab. It is a port of the Python optimizer
(`python/algorithm.py` on DNAChisel 3.2.16), which it replaced: the Python
backend is deleted, and **this crate is now the reference implementation.**
An algorithm change is made here and nowhere else.

## Why

The optimizer was the only part of REJ Studio that needed a server. Running
it in the browser removed Modal, the job API, polling, bearer tokens and
submission rate limits, and keeps unpublished sequences on the user's
machine.

Python can run in a browser through Pyodide, but that means downloading a
Python runtime plus NumPy and Biopython — about 7 MB even after trimming, and
roughly twice as slow as native Python. This port is **120 KB** compressed and
**5–7× faster than Python**, so a design that took 21 seconds on the server
takes under 4 seconds in the tab.

## What it does

The same six DNAChisel objectives the Python version used, and nothing else:

| Specification        | Role       | What it does                          |
| -------------------- | ---------- | ------------------------------------- |
| `EnforceTranslation` | constraint | Keeps the protein identical           |
| `AvoidChanges`       | constraint | Freezes a user-chosen WGGW site       |
| `EnforceGCContent`   | constraint | Holds GC between 35% and 60%          |
| `AvoidPattern`       | objective  | Removes cryptic splice sites and CpGs |
| `MaximizeCAI`        | objective  | Codon-optimizes for human or mouse    |
| `UniquifyAllKmers`   | objective  | Breaks up repeated k-mers             |

Then the REJ-specific part: recode a WGGW motif near the split point and cut
the sequence into its 5′ and 3′ halves.

## How it is verified

The port reproduces NumPy's MT19937 generator exactly — including which draws
get rejected by its masked-rejection sampling — so a seeded run made the same
random choices Python made. That turned "is the port correct?" into a question
with a definite answer: **for the same seed, the designs must be identical**.

101 tests run in about 4 seconds:

| Test group              | What it establishes                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `tests/parity.rs`       | Scores, locations, messages, labels, text summaries, derived seeds and whole seeded runs all match DNAChisel exactly    |
| `tests/real_genes.rs`   | The same, on real human coding sequences of 600–3,633 bases                                                             |
| `tests/properties.rs`   | On ~150 generated sequences: the protein survives, the length and alphabet hold, fragments rejoin, scores never regress |
| `tests/table_parity.rs` | The codon tables still match Biopython and python_codon_tables                                                          |
| unit tests              | Each module against its Python counterpart                                                                              |

The fixtures under `optimizer/tests/fixtures/` were recorded by running the
real DNAChisel 3.2.16, so the tests compare against the pipeline that designed
sequences in production, not against a description of it. **They are frozen:**
the Python that produced them is gone, so they cannot be regenerated and must
not be edited. [`optimizer/tests/fixtures/README.md`](optimizer/tests/fixtures/README.md)
says what each holds, the library versions, and their digests. A change that
is meant to alter designs will fail these tests; record the new behaviour in
new Rust-owned tests rather than rewriting the snapshots.

### Measured against Python

Measured before the Python backend was retired. Three real coding sequences,
same options, same seed, on one machine:

| Sequence         | CPython | Pyodide (browser) | Rust       | Rust → WebAssembly |
| ---------------- | ------- | ----------------- | ---------- | ------------------ |
| 1,182 bp         | 0.95 s  | 1.96 s            | **0.13 s** | **0.17 s**         |
| 3,633 bp         | 7.95 s  | 16.28 s           | **1.22 s** | **1.35 s**         |
| 5,592 bp (BRCA1) | 21.14 s | 42.50 s           | **3.81 s** | **3.91 s**         |

All four runtimes produce the **same design, base for base** (verified by
digest), and the same objective scores: −67.03, −222.28 and −400.82.

Download size, the reason for the rewrite:

| Approach                             | Compressed                         |
| ------------------------------------ | ---------------------------------- |
| Pyodide + NumPy + Biopython, trimmed | ~7 MB                              |
| This crate as WebAssembly            | **120 KB** (Brotli), 150 KB (gzip) |

## Layout

```
optimizer/src/
  rng.rs             NumPy-compatible MT19937
  biotools.rs        translation, GC content, grouping helpers
  pattern.rs         fixed-length DNA pattern matching
  location.rs        sequence spans
  tables.rs          codon tables, generated once from Python and frozen
  spec.rs            the six specifications
  mutation_space.rs  which sequences the solver may reach
  problem.rs         constraint solver and objective optimizer
  rej.rs             WGGW motifs and the 5'/3' split
  reverse_translate.rs  protein -> DNA with the species-preferred codons
  contract.rs        request/result types (the retired python/contracts.py's JSON)
  exports.rs         the other JSON entry points (one exported, two generators)
  lib.rs             public API and the browser ABI
```

## Working on it

```bash
cargo test                 # everything, in about 3 seconds
cargo clippy --all-targets -- -D warnings
cargo fmt --all
```

Build for the browser and check it there:

```bash
cargo build --release --target wasm32-unknown-unknown
node ../scripts/wasm-smoke.mjs target/wasm32-unknown-unknown/release/rej_optimizer.wasm
```

Benchmark:

```bash
cargo run --release --example bench -- cases.json
```

The DNAChisel fixtures and `src/tables.rs` are frozen — there is nothing to
regenerate there (see [How it is verified](#how-it-is-verified)). The WGGW
reference the TypeScript parity test reads is not a recording but this crate's
own answers, so it is rewritten after any change to `optimizer/src/rej.rs`:

```bash
cargo run --release --example wggw-reference
```

## The browser interface

Deliberately not wasm-bindgen: the whole interface is one JSON string in and
one JSON string out, so generated glue would cost more bytes than it saves
effort. The module imports only `env.report_progress`.

```js
const { alloc, dealloc, free_response, memory, process, reverse_translate } =
  instance.exports
```

1. `alloc(len)` for the request; write UTF-8 bytes there.
2. `process(ptr, len)` returns a pointer to a 4-byte little-endian length
   followed by that many UTF-8 bytes.
3. `free_response(ptr)` and `dealloc(ptr, len)` when finished.

`reverse_translate` takes and returns JSON the same way, and frees with
`free_response` too.

| Export              | Request                  | Answer                                                      |
| ------------------- | ------------------------ | ----------------------------------------------------------- |
| `process`           | `{ CDS, name, options }` | the design (`ProcessResult`)                                |
| `reverse_translate` | `{ protein, species }`   | `{ CDS }` — species-preferred codons, a stop codon appended |

`reverse_translate` exists because the frontend has no codon table: protein
input is translated here, with the very codons [`MaximizeCAI`] scores against.
A tie goes to the earlier codon in DNAChisel's backtranslation order, which is
why mouse arginine is AGA. The seed is unaffected — `derive_seed` hashes the
coding sequence it is handed, and this function is pure, so the same protein
and species reproduce the design.

These two are the whole browser interface, and deliberately so: every export
is bytes every visitor downloads. Two more entry points exist in
`optimizer/src/exports.rs` — `codon_tables_json` and `wggw_report_json` — but
nothing in a page calls them, so they are not exported from the module.
Instead each feeds a `cargo run --example` that writes a committed file, which
cost 6.4 KB of Brotli as wasm exports and nothing as files:

| Generated file                                                 | Example          | Read by                              |
| -------------------------------------------------------------- | ---------------- | ------------------------------------ |
| `src/features/design-tool/utils/codon-preference.generated.ts` | `codon-tables`   | the design tool's codon charts       |
| `optimizer/tests/fixtures/wggw_reference.json`                 | `wggw-reference` | `sequence-utils.wggw-parity.test.ts` |

`pnpm wasm:build` writes the first; the second is written by
`cargo run --release --example wggw-reference`. Rust CI runs both and fails if
either committed file differs, so neither can fall behind the crate — and a
chart cannot show frequencies the optimizer did not score with.

`scripts/wasm-harness.mjs` wraps this in about 20 lines and is what the worker
would use. Errors come back as `{"error": "..."}`, never as a panic.

## How it is wired in

```
use-job.ts                     runs a design, owns its history entry
  browser-optimizer.ts         owns the worker; returns a JobActionResult
    optimizer.worker.ts        loads the .wasm, runs one design at a time
      public/optimizer/*.wasm  this crate, fetched with ?v=<sha256>
```

A design gets a history entry, a progress bar, a Cancel button and a place in
Recent jobs. Its id starts with `browser-` and is never written to the URL —
the design exists only on that device.

Cancelling terminates the worker, since a run inside WebAssembly cannot be
interrupted from outside; the next design starts a fresh one. A browser that
lacks Workers or WebAssembly gets a failed run that says why.

The worker starts when the design form mounts, so the ~150 KB arrives while
the user is still entering a sequence.

Measured in Chrome through the real UI: a 5,592 bp gene designs in **1.9 s**
with no network calls beyond fetching the module once.

### Keeping the committed .wasm honest

`public/optimizer/rej-optimizer.wasm` is committed so `pnpm build` works
without a Rust toolchain. That means a stale asset is possible — source edited,
module not rebuilt — and three cheap checks rule it out:

```bash
pnpm wasm:build     # build and install the asset
pnpm wasm:verify    # the .wasm and its digest manifest agree
pnpm wasm:smoke     # run the committed module against the fixtures
```

`wasm:smoke` is the one that matters: it designs the fixture genes with the
committed module and compares against what DNAChisel produced, so an asset
that has fallen behind the source fails as soon as it designs a different
sequence.

It is tempting to rebuild in CI and compare digests instead, and the first
version of this did. It does not work: the same source, toolchain and
lockfile produce **different `.wasm` bytes on different machines**. CI and a
local WSL2 box on identical `rustc 1.100.0 (0ef1bc386 2026-11-09)`, with the
same `Cargo.lock`, built modules whose digests differed; the same tree
rebuilt locally from a different directory, clean, matched. So the check
failed on honest commits while saying nothing about behaviour.

Whether two such modules _behave_ the same is what `wasm:smoke` answers, and
CI now runs it against both the committed asset and a module built fresh on
the runner. The staleness case the digest check was really aimed at is caught
directly instead: if a PR changes code in `rust/optimizer/src/` (or the
toolchain, manifests or lockfile) and leaves `public/optimizer/` alone, the
build fails and says to run `pnpm wasm:build`. An edit that touches only `//`
comments and blank lines is exempt: it builds the same module.

### Making these required on main

`Rust tests, format and lint`, `WebAssembly build and smoke test` and
`cargo deny` (in the Security workflow) are **not** in the Protect main
ruleset yet, deliberately. Add them only once `.github/workflows/rust-ci.yml`
and the `cargo-deny` job in `security.yml` are on `main`.

A required check that never reports is never satisfied, and for
`pull_request` GitHub takes the workflow from the PR's merge ref. While the
workflow exists only on a feature branch, no PR to `main` can report these
two — so requiring them early blocks every open PR to `main` instead of
protecting anything.

Both jobs are `if:`-gated on the path filter and report `skipped` when Rust
is untouched, which _does_ satisfy a requirement. The hazard is the workflow
not running at all, not the jobs skipping. The cutover checklist in
[docs/cloudflare-migration.md](../docs/cloudflare-migration.md) (step 4) swaps
the Python checks for these in the same change that points the integration
branch at `main`.

## Limitations

- **Only the options the design tool sends are supported.** Other DNAChisel
  specifications, circular sequences and multi-split designs are not ported.
- **Patterns must be fixed-length** (bases, `[ACGT]` classes, `{n}` repeats),
  which covers every pattern the design uses; anything else is refused at
  parse time rather than silently mismatched.
- **Timing is not measured inside WebAssembly.** `processing_time_seconds` is
  zero there; the caller should time the call, as the harness does.
