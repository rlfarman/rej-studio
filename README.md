# REJ Studio

A web application for RNA End-Joining sequence design and optimization. Scientists can search human and mouse genes, browse isoforms, and run codon-optimized sequence designs through an interactive design tool.

Everything runs in the browser. Gene data is a set of static, versioned files; designs run in a WebAssembly build of the optimizer, in a worker on the user's machine. There is no application server, database or compute backend: one Cloudflare Worker serves the built app (see [docs/cloudflare-migration.md](./docs/cloudflare-migration.md) for where the move from Vercel stands).

## Features

- **Gene Search** — Search human and mouse genes by symbol, name, alias or Ensembl ID (ENSG/ENST), ranked in the browser against a static search index.
- **Gene Detail & Isoforms** — Gene metadata, transcript isoforms with length charts, sequence identity matrices, and downloadable coding/protein sequences.
- **Design Tool** — Optimize a coding sequence (DNA or protein, reverse-translated with species-preferred codons) with:
  - Codon optimization
  - Cryptic splice site removal
  - CpG minimization
  - K-mer complexity reduction
  - GC content enforcement
  - WGGW motif insertion
  - Stimulatory intron options
- **Disease associations** — OMIM gene–disease associations, filterable by inheritance.
- **User Features** — Favorite genes, recent genes, design history (kept in this browser), dark/light theme, keyboard shortcuts (Cmd+K search).

## Tech Stack

| Layer     | Technology                                                                  |
| --------- | --------------------------------------------------------------------------- |
| Frontend  | TanStack Start (SPA mode), React 19, TypeScript, Tailwind CSS 4             |
| Toolchain | Vite+ (`vp`: Vite, Vitest, Oxlint), Oxfmt                                   |
| UI        | shadcn/ui (base-rhea style on Base UI)                                      |
| State     | TanStack Query, Zustand; design history in IndexedDB                        |
| Optimizer | Rust, compiled to WebAssembly (`rust/`), running in a Web Worker            |
| Gene data | Static JSON corpus (`pnpm corpus:build`), served from R2 at cutover         |
| Hosting   | One Cloudflare Worker serving the static build (Cloudflare Access gates it) |

## Getting Started

### Prerequisites

- Node.js 26 (see `.nvmrc`)
- pnpm 12 (`npm install -g pnpm@12`; the `packageManager` field pins the exact version)
- Rust, only to rebuild the optimizer (`pnpm wasm:build`); the `.wasm` is committed

### Setup

```bash
pnpm install
pnpm dev           # vp dev on :3000, the Worker in workerd
```

Nothing else is needed: the app reads the committed 24-gene sample corpus and runs designs in the browser. `.env.example` lists the optional build-time settings; a deployment for the lab must set `VITE_GENE_DATA_URL` to the full corpus.

### Verify everything works

```bash
pnpm verify        # lint + format check + knip + type-check + unit tests (also the pre-push hook)
pnpm test:e2e      # Playwright against vp dev on :3000 (E2E_SERVER=preview for the build)
```

## Scripts

| Command                           | Description                                                    |
| --------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                        | Dev server on :3000                                            |
| `pnpm build`                      | Client bundle, Worker and prerendered SPA shell in `dist/`     |
| `pnpm preview`                    | Serve `dist/` on workerd at :3000                              |
| `pnpm cf:deploy`                  | Check `VITE_GENE_DATA_URL`, build, `wrangler deploy`           |
| `pnpm lint` / `lint:fix`          | Oxlint, with the feature-boundary rules                        |
| `pnpm format` / `format:check`    | Oxfmt                                                          |
| `pnpm type-check`                 | TypeScript 7                                                   |
| `pnpm knip`                       | Unused files, exports and dependencies                         |
| `pnpm test`                       | Unit tests (Vitest)                                            |
| `pnpm test:e2e`                   | Playwright tests                                               |
| `pnpm verify`                     | Everything CI checks before the build                          |
| `pnpm data:genes`                 | Source CSV → `data/genes.jsonl` + `data/isoforms.jsonl`        |
| `pnpm data:associations`          | OMIM CSV → the disease-associations JSON the app ships         |
| `pnpm corpus:build`               | JSONL seed → a static gene corpus version                      |
| `pnpm wasm:build`                 | Build the Rust optimizer and install it in `public/`           |
| `pnpm wasm:verify` / `wasm:smoke` | Check the committed `.wasm`'s digest / run it against fixtures |
| `pnpm doctor`                     | Check local dev environment health                             |

## Project Structure

```
src/
├── routes/                       # TanStack Start file routes; __root.tsx is the shell
├── router.tsx                    # Router factory and its query client
├── features/                     # Self-contained feature modules
│   ├── gene-search/              # Static corpus client, search, gene pages
│   ├── design-tool/              # Form, in-browser optimizer worker, results, history
│   └── disease-associations/     # Gene–disease association table
├── components/                   # Shared UI components (ui/ = shadcn primitives, bio/ = bio widgets)
├── lib/                          # Shared utilities (bio/ = species, FASTA, sequences)
├── hooks/                        # Shared React hooks
└── stores/                       # Shared Zustand stores

rust/                             # The optimizer (Rust → WebAssembly); see rust/README.md
scripts/                          # Data pipeline, wasm build and checks, dev tooling
data/                             # The committed sample seed (24 genes)
public/gene-data/sample/          # The sample corpus the app reads by default
```

Features are self-contained modules (`api/`, `components/`, `hooks/`, `stores/`, `types/`, `utils/`). Cross-feature imports are lint errors.

## Gene data

Source CSV → JSONL seed (`pnpm data:genes`) → static corpus (`pnpm corpus:build`) → published to R2 at cutover, one immutable directory per version. `AGENTS.md` ("Gene data") has the details.

## CI

GitHub Actions runs on every PR and push to `main`:

- **CI** — Lint, Format, Type Check, Knip, Test (Vitest, with a coverage comment), E2E (Playwright), Build (with per-route first-load JS budgets reported in a PR comment), Storybook (test build), and Workflow Security (zizmor).
- **Rust CI** — format, Clippy (native and wasm32), the parity suite against the frozen DNAChisel fixtures, and a smoke test of the committed and a freshly built `.wasm`.
- **Security** — Dependency Review on PRs, `pnpm audit` and `cargo deny` (also weekly), and a CycloneDX SBOM on `main`.
- **Lighthouse CI** — performance, accessibility and SEO audits of `/`.
- **Conventions** — PR title, commit messages, and branch names (advisory).

See [CONTRIBUTING.md](./CONTRIBUTING.md#required-status-checks) for which checks block merging.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions, branch naming, and PR guidelines.

## License

Copyright (c) 2026 The Salk Institute for Biological Studies. Released under the [BSD 3-Clause Clear License](./LICENSE).

Note that this license grants **no** express or implied license to any party's patent rights. Commercial use may require separately licensing the relevant patent claims.
