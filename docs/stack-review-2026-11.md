# Stack review — November 2026

A decision record, not a survey. Everything here was checked against the repo
as it stands at `feat/rust-optimizer`, and the Rust/WASM claims were measured
on this machine rather than taken from guidance. Where a measurement
contradicted the standard advice, the measurement wins and the number is
written down so the next person does not redo it.

**Verdict: the stack is in good shape and most of it should not change.** Deps
are current, the toolchain choices are deliberate and documented, and the three
tempting "modernizations" of late 2026 all measured or researched out. The real
gaps are narrow: Rust is the least-governed language in the repo, and the
agent-facing surface describes the project without encoding any of its
procedures.

## What was measured

### wasm-opt — skip it

The Rust and WebAssembly book reports 15–20% code-size savings from
post-processing with Binaryen's `wasm-opt`. That did not reproduce here, because
the release profile already does the work: `lto = true`, `opt-level = 3`,
`codegen-units = 1`, `panic = "abort"`, `strip = true`.

Binaryen 132, run over the committed module, all levels with `-all`:

| build        | raw     | gzip    | brotli  |
| ------------ | ------- | ------- | ------- |
| baseline     | 393,233 | 149,707 | 119,805 |
| wasm-opt -O2 | 356,778 | 145,926 | 118,352 |
| wasm-opt -O3 | 354,968 | 147,668 | 119,197 |
| wasm-opt -O4 | 356,002 | 148,586 | 120,074 |
| wasm-opt -Os | 353,790 | 147,491 | 118,968 |
| wasm-opt -Oz | 350,721 | 147,959 | 119,342 |

Raw size drops ~10%, but **brotli — what actually ships — moves at most 1.2%**,
and `-O4` is worse than not running it. wasm-opt's transformations compress less
well than what they replace.

On speed, a first pass suggested 6–9%, but that was mostly noise. An interleaved
A/B (9 reps, 3 alternating rounds, median of medians) gave baseline 1617 ms vs
`-O2` 1567 ms — about 3%, with overlapping ranges (1550–1623 vs 1555–1594).

So: ~1% off the wire and a speed difference that does not clear measurement
noise, in exchange for a build-time dependency on Binaryen. Not worth it.
Revisit if the module grows substantially or the release profile is relaxed.

### `+simd128` — actively harmful

| build    | correct | medians       | result          |
| -------- | ------- | ------------- | --------------- |
| baseline | yes     | 1692, 1622 ms | —               |
| simd128  | yes     | 1866, 1827 ms | **~11% slower** |

Ranges do not overlap. Designs stayed byte-exact, so this is purely a
performance regression — presumably LLVM vectorizing branchy single-byte
comparisons where the lane setup costs more than it saves. The optimizer's hot
loops are pattern scans over `u8`, which is not the shape SIMD rewards.

Do not enable it. This is the clearest case in the review of a best-practice
list being wrong for this workload.

### The hand-written ABI — keep it

`rust/optimizer/src/lib.rs` exports `alloc` / `dealloc` / `process` /
`free_response` plus an `env.report_progress` import, with no wasm-bindgen. That
remains the right call: the module exchanges byte buffers with a hand-written
loader, which is exactly the case where bindgen's generated glue buys nothing
and costs size. wasm-bindgen earns its place when JS objects, strings or
promises cross the boundary. They do not here — JSON in, JSON out.

## Add

### Done, 16 November

1. **`rust/rust-toolchain.toml`.** Pins `1.100.0` with clippy, rustfmt and the
   wasm target. CI installs from it with a bare `rustup toolchain install` and
   the `RUST_VERSION` env var is gone, so the version lives in one place.
   `pnpm doctor` now reports it.

2. **Type-aware linting**, via `options.typeAware` in `.oxlintrc.json` and
   `oxlint-tsgolint`. About a second for the whole repo, so it runs in the
   pre-commit hook too. All 13 first-run findings are fixed. The one that most
   changed my view is the splice slider indexing spread strings (code points)
   against `indexOf` (UTF-16 code units). It only worked because the text is
   ASCII, so `split('')` there fixes an inconsistency rather than quieting a
   rule. The others: a `FormData` coercion on login, the decorative
   `SpeciesFilter | string` union, an unreachable `COMPUTE_BACKEND` branch
   (typed `never`), an unawaited `invalidateQueries`, and a test stub whose
   `...globalThis.crypto` copied nothing.

3. **`[workspace.lints]`.** The premise I gave above was off. Local clippy
   showed the same warnings as CI, just not as errors, and CI keeps
   `-D warnings` for that. The real gaps turned out to be different and
   larger:

   - The crate's only unsafe code, the wasm ABI in `optimizer/src/lib.rs`, is
     `cfg(target_arch = "wasm32")`. The native clippy run in CI **never
     compiled it**. CI now also lints the wasm32 build.
   - Writing the `SAFETY` comments that `undocumented_unsafe_blocks` requires
     exposed two real soundness bugs. `dealloc` rebuilt a
     `Vec::with_capacity(len)` buffer with capacity `len`, but `with_capacity`
     only promises _at least_ `len`, so this was UB by the documented contract,
     and the response buffer had the same shape. `process` could also read
     memory `alloc` never initialized. Both buffers are now boxed slices
     (allocation exactly equals length) and `alloc` zero-fills. Designs are
     unchanged byte for byte.

4. **`cargo-deny`**, in the Security workflow beside `pnpm audit` and
   `pip-audit`. It runs on every PR, on main, and weekly. `rust/deny.toml` is
   strict: advisories, unmaintained and yanked crates, duplicate versions,
   crates.io only, and exactly MIT / Apache-2.0 / Unicode-3.0. Removing a
   needed license fails it, so the policy is doing work.

### Still open

5. **Project-specific skills.** `.agents/skills/` holds 27 skills, all generic
   design and framework ones (`critique`, `typeset`, `next-best-practices`, …).
   **None are about this project.** This is the largest agent-experience gap:
   `AGENTS.md` describes the architecture well but encodes no procedure, so
   every agent re-derives the multi-step workflows from prose. The three worth
   writing, in order:

   - **Optimizer parity**: regenerate fixtures, run the Rust parity suite,
     rebuild the `.wasm`, and commit the artifact and manifest together. This
     is the repo's most error-prone sequence, with the sharpest failure mode
     (shipping an optimizer that designs different sequences). It shrinks if
     Python goes; see below.
   - **Corpus publishing**: the maintainer-only release steps in `AGENTS.md`,
     including the `gh release upload`-separately quirk for ~250 MB assets.
   - **Feature scaffolding**: the `src/features/<name>/` layout plus the
     boundary rules, so the ESLint failure is avoided rather than hit.

6. **Criterion benchmarks** for the optimizer. `rust/optimizer/examples/bench.rs`
   is ad hoc. A real bench suite would have caught the SIMD regression above
   automatically, and it guards the performance claim that justified the port.

## Change

- ~~`@electric-sql/pglite` 0.4.6 → 0.5.16~~ **Withdrawn.** PGlite is a
  devDependency used only for local dev and CI, and the Cloudflare plan deletes
  it along with Neon and Drizzle when gene data moves to static files on R2.
  There is no advisory in the gap either. Upgrading it would be work on code
  that already has a removal date. Revisit only if a bug or advisory forces it.
- **`lint-staged` 17.6.0 → 17.6.1.** Trivial.
- **The crate's license. Done.** It said `MIT` while the project is Clear BSD.
  It is now `BSD-3-Clause-Clear AND MIT AND BSD-3-Clause`: the project's
  license plus those of the code ported into it, DNAChisel (MIT) and NumPy's
  MT19937. Their notices, which the old field did not carry either, are in
  `rust/optimizer/THIRD-PARTY-NOTICES.md` and are served beside the `.wasm`,
  since every browser that loads it receives a binary copy.

## Remove

Very little, honestly — the stack is already tight, and `pnpm outdated` lists
three packages total. Two suspicions I checked and withdrew:

- The `cn` package looked like a duplicate of a local helper. It is not: the
  shadcn `base-rhea` primitives import from it and there is no local `cn`. Keep.
- `openapi-typescript` looked unused. It runs via `scripts/generate-api-types.sh`
  through npx and is deliberately in knip's `ignoreDependencies`. Keep — until
  the FastAPI backend goes, which takes it with it.

Genuinely removable, but all gated on the Cloudflare migration rather than on
this review: `@upstash/ratelimit` + `@upstash/redis` (→ KV or Durable Objects),
the Modal deployment, the FastAPI backend, and `openapi-typescript` with it. See
[cloudflare-migration.md](./cloudflare-migration.md).

Marginal: `auto-assign.yml` and `stale.yml` are 2 of 14 workflows doing
multi-maintainer housekeeping on a single-maintainer repo.

### Python, and why it should go entirely

Python still has two jobs, and both should end.

**It serves production today.** The browser optimizer sits behind
`NEXT_PUBLIC_ENABLE_BROWSER_OPTIMIZER`, which is off by default
(`src/features/design-tool/utils/feature-flags.ts`). Unless that is set in
production, every design still runs in Python on Modal. Once the flag is on,
the server is only a fallback for browsers without WebAssembly and module
workers, which in 2026 means effectively none. Modal, FastAPI, `python/index.py`,
`contracts.py`, `telemetry.py`, `modal/`, the job API and its polling can then
all go. That is step 1 of the Cloudflare plan.

**It is the specification.** The Rust port's fixtures come from running
`python/algorithm.py` against real DNAChisel (`scripts/gen-parity-fixtures.py`,
`scripts/gen-codon-tables.py`). This is the job people assume justifies keeping
Python. It does not survive a close look:

- **Nothing checks the two stay in step.** Rust CI re-runs on `python/**`, but
  it replays the _committed_ fixtures. Python CI tests Python against its own
  contract fixtures. Nothing compares Python's current output with what Rust
  replays. So editing `algorithm.py` without regenerating leaves **both**
  suites green while the implementations diverge.
- **Once Rust serves, Rust is where changes happen.** Mirroring each one back
  into Python means writing every algorithm change twice, in two languages,
  for a reference nothing enforces.
- **The fixtures already pin one DNAChisel.** The port reproduces two of its
  quirks on purpose. The fixtures are a snapshot of a specific DNAChisel's
  behaviour, and they should be named and kept as exactly that.

Order of removal:

1. Turn the flag on in production and watch real designs.
2. Delete the server path: Modal, FastAPI, the job API, polling, the circuit
   breaker and `openapi-typescript`.
3. Freeze the fixtures as Rust-owned regression snapshots. Delete
   `algorithm.py`, the generators, `pyproject.toml`/`uv.lock`, Python CI,
   `pip-audit` and the Python half of the SBOM.
4. The data scripts (`build-db.py`, `build-disease-associations.py`) feed the
   database the R2 step replaces. Rewrite whatever survives in TypeScript —
   `tsx` scripts already exist — so the repo ends on two toolchains, not three.

Do step 3 once step 1 has run long enough that nobody would reach for Python to
settle a disagreement about a design.

## Don't — things that look like upgrades and are not

| Tempting                      | Why not                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| wasm-opt in the build         | ~1% off the wire, speed within noise. Measured above.                                                                                                                                                                               |
| `+simd128`                    | ~11% slower. Measured above.                                                                                                                                                                                                        |
| wasm-bindgen                  | Adds glue and size for a JSON-in/JSON-out module.                                                                                                                                                                                   |
| Drop ESLint, keep only oxlint | Verified against oxlint 1.93: `import/no-restricted-paths` and `no-restricted-syntax` are both unimplemented — and they are the _only_ two rules ESLint still runs.                                                                 |
| Replace Prettier with oxfmt   | Still pre-1.0. Prettier also carries `prettier-plugin-tailwindcss` for class sorting, which would need an equivalent first.                                                                                                         |
| TypeScript 7 as sole compiler | 7.0 is GA but ships no programmatic API; typescript-eslint, knip and Storybook all need one. The existing split (`typescript` 6.x as library, `typescript-native` 7 for `type-check`) is the documented workaround and should stay. |
| Next.js 17                    | Not released. 16.4.x is current and this repo is on 16.4.6, with `cacheComponents` already enabled — which is what 17 makes the default.                                                                                            |

## Dated triggers

- **TypeScript 7.1** — RC on 10 Nov 2026, stable targeted 24 Nov 2026. It adds
  the programmatic API. That is not the signal to collapse the dual-TypeScript
  setup; **typescript-eslint shipping 7.1 support is** (unannounced, estimated
  Q1 2027). Re-check then.
- **oxfmt 1.0** — reconsider replacing Prettier, Tailwind class sorting
  permitting.
- **Rust 1.100.0** is current as of 9 Nov 2026, so the pin in point 1 is not
  already stale. Bump it in its own PR and fix new lints there.
- **Requiring the Rust CI checks on `main`** is already tracked in
  [rust/README.md](../rust/README.md) and blocked on the workflow reaching
  `main`.
