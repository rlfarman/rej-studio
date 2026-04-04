# REJ Studio

A web application for RNA End-Joining sequence design and optimization. Scientists can search human and mouse gene databases, view isoforms, and run codon-optimized sequence designs through an interactive design tool.

## Features

- **Gene Search** — Full-text search across human and mouse genes by symbol, name, or Ensembl ID (ENSG/ENST). Species filtering and autocomplete.
- **Gene Detail & Isoforms** — View gene metadata, browse transcript isoforms, and inspect coding/protein sequences.
- **Design Tool** — Submit coding sequences for optimization with configurable parameters:
  - Codon optimization
  - Cryptic splice site removal
  - CpG minimization
  - K-mer complexity reduction
  - GC content enforcement
  - WGGW motif insertion
  - Stimulatory intron options
- **User Features** — Favorite genes, search history, dark/light theme.

## Tech Stack

| Layer    | Technology                                       |
| -------- | ------------------------------------------------ |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS   |
| UI       | shadcn/ui, Radix UI primitives                   |
| Backend  | FastAPI (Python) with dnachisel                  |
| Database | SQLite (better-sqlite3), Drizzle ORM             |
| Hosting  | Vercel                                           |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+

### Setup

1. **Install dependencies**

   ```bash
   pnpm install
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment**

   Copy `.env.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable                | Description                          |
   | ----------------------- | ------------------------------------ |
   | `SESSION_SECRET`        | Random hex string for JWT signing    |
   | `BASIC_AUTH_USER`       | Basic auth username for landing page |
   | `BASIC_AUTH_PASSWORD`   | Basic auth password                  |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (optional)         |

3. **Unpack the database** (if not already present)

   The SQLite database is committed as `data/rej-studio.db.gz`. Decompress it to `data/rej-studio.db` before running the app, or rebuild from source data with `pnpm db:build`.

### Development

```bash
pnpm dev
```

This starts both the Next.js dev server (port 3000) and the FastAPI server (port 8000) concurrently. API requests to `/api/py/*` are proxied to FastAPI in development.

To run them individually:

```bash
pnpm next-dev      # Next.js only
pnpm fastapi-dev   # FastAPI only
```

### Scripts

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `pnpm dev`        | Start both servers concurrently  |
| `pnpm build`      | Production build (Next.js)       |
| `pnpm start`      | Start production server          |
| `pnpm lint`       | Run ESLint                       |
| `pnpm lint:fix`   | Auto-fix lint issues             |
| `pnpm format`     | Format with Prettier             |
| `pnpm type-check` | TypeScript type checking         |
| `pnpm db:build`   | Rebuild SQLite database from source data |

## Project Structure

```
app/
├── (search)/              # Gene search & detail pages
│   ├── genes/             # Search results
│   └── genes/[symbol]/    # Gene detail with isoforms
├── (design-tool)/         # Sequence design tool
└── api/                   # Next.js API routes (auth)

api/                       # FastAPI backend
├── index.py               # Endpoints (POST /api/py/process)
└── algorithm.py           # DNA optimization algorithms

actions/                   # Next.js server actions
components/                # React components (+ shadcn/ui)
context/                   # React context providers
drizzle/                   # Database schema, migrations, seed
hooks/                     # Custom React hooks
lib/                       # Shared utilities
```

## API

The FastAPI backend exposes a single optimization endpoint:

- **`POST /api/py/process`** — Accepts a coding sequence and optimization options, returns a ZIP file containing a report and optimized sequences.

Swagger docs are available at `/docs` in development.

## License

Private.
