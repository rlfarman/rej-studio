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

1. **`rust-toolchain.toml`** (highest value, ~5 minutes). Node is pinned by
   `.nvmrc`, Python by `.python-version`; Rust is pinned **only** inside
   `rust-ci.yml`'s `RUST_VERSION` env. A contributor gets whatever their rustup
   default happens to be, and nothing local reproduces CI. Pin `channel =
"1.100.0"` with `components = ["clippy", "rustfmt"]` and `targets =
["wasm32-unknown-unknown"]`, then have CI install from the file and delete
   the env var, so there is one source of truth. Omit the `rust-analyzer`
   component — pinning it degrades editors that ship a newer one.

2. **Type-aware linting** — `oxlint --type-aware` with `oxlint-tsgolint`. The
   repo has **zero** type-aware rules today; `eslint-config-next` does not turn
   them on and typescript-eslint cannot run against TypeScript 7. A trial run
   found 13 issues, several real:

   - `src/features/gene-search/hooks/use-gene-search.ts:119` — floating promise
     (`queryClient.invalidateQueries` unawaited in the `retry` handler).
   - `src/components/bio/species-icon.tsx:8` — `species?: SpeciesFilter | string`
     collapses to `string`, so the union constrains nothing. A real type-design
     bug: the `SpeciesFilter` half is decorative.
   - `src/app/api/login/route.ts:41-42` — `String(form.get('password') ?? '')`.
     `FormData.get` returns `string | File | null`, so a `File` part stringifies
     to `[object File]`. Mild — it simply fails to match rather than opening a
     hole — but it should be a `typeof === 'string'` guard.
   - Several `no-misused-spread` on strings (`[...sequence]`). Benign for ASCII
     DNA; worth an explicit `allow` with a comment rather than silence.

   This catches a class of bug nothing else in the pipeline looks for. It did
   not uncover a crisis, and should not be sold as one.

3. **`[workspace.lints]` in `rust/Cargo.toml`.** Clippy's severity currently
   lives only in CI's `cargo clippy --all-targets -- -D warnings`, so a local
   `cargo clippy` is quieter than CI. Move it into the manifest with `[lints]
workspace = true` in the crate, and local matches CI by construction.

4. **`cargo-deny` in CI.** Rust is the only language here without a supply-chain
   gate — JS has `pnpm audit` plus Dependency Review, Python has `pip-audit`,
   Rust has nothing. Only three dependencies today (`serde`, `serde_json`,
   `sha2`), so it is cheap now and stays cheap. Make it blocking, and add a
   scheduled run: RUSTSEC advisories land without any commit, so a PR-only gate
   never sees them.

5. **Project-specific skills.** `.agents/skills/` holds 27 skills, all generic
   design and framework ones (`critique`, `typeset`, `next-best-practices`, …).
   **None are about this project.** This is the largest agent-experience gap:
   `AGENTS.md` describes the architecture well but encodes no procedure, so
   every agent re-derives the multi-step workflows from prose. The three worth
   writing, in order:

   - **Optimizer parity** — regenerate fixtures from Python, run the Rust parity
     suite, rebuild the `.wasm`, commit artifact and manifest together. This is
     the repo's most error-prone sequence and the one with the sharpest failure
     mode (shipping an optimizer that designs different sequences).
   - **Corpus publishing** — the maintainer-only release steps in `AGENTS.md`,
     including the `gh release upload`-separately quirk for ~250 MB assets.
   - **Feature scaffolding** — the `src/features/<name>/` layout plus the
     boundary rules, so the ESLint failure is avoided rather than hit.

6. **Criterion benchmarks** for the optimizer. `rust/optimizer/examples/bench.rs`
   is ad hoc. A real bench suite would have caught the SIMD regression above
   automatically, and it guards the performance claim that justified the port.

## Change

- **`@electric-sql/pglite` 0.4.6 → 0.5.16.** A full minor behind, and it is what
  every contributor and every CI job boots as the database. The most overdue
  update in the tree.
- **`lint-staged` 17.6.0 → 17.6.1.** Trivial.
- Fix the `SpeciesFilter | string` union from finding 2 above regardless of
  whether type-aware linting is adopted.

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
