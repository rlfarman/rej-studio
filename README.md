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
| Database | PostgreSQL (Vercel Postgres / Neon), Drizzle ORM |
| Hosting  | Vercel                                           |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL database (or a Vercel Postgres / Neon instance)

### Setup

1. **Install dependencies**

   ```bash
   npm install
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
   | `POSTGRES_URL`          | PostgreSQL connection string         |
   | `SESSION_SECRET`        | Random hex string for JWT signing    |
   | `BASIC_AUTH_USER`       | Basic auth username for landing page |
   | `BASIC_AUTH_PASSWORD`   | Basic auth password                  |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (optional)         |

3. **Seed the database**

   ```bash
   npm run db:seed
   ```

### Development

```bash
npm run dev
```

This starts both the Next.js dev server (port 3000) and the local FastAPI compute backend (port 8000) concurrently. Next.js server actions call the FastAPI backend directly over HTTP. In production, set `COMPUTE_BACKEND=modal` and `MODAL_API_URL` to use the Modal-hosted backend instead.

To run them individually:

```bash
npm run next-dev      # Next.js only
npm run fastapi-dev   # FastAPI only
```

### Scripts

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `npm run dev`        | Start both servers concurrently  |
| `npm run build`      | Production build (Next.js)       |
| `npm run start`      | Start production server          |
| `npm run lint`       | Run ESLint                       |
| `npm run lint:fix`   | Auto-fix lint issues             |
| `npm run format`     | Format with Prettier             |
| `npm run type-check` | TypeScript type checking         |
| `npm run db:seed`    | Seed gene data into the database |

## Project Structure

```
app/
├── (search)/              # Gene search & detail pages
│   ├── genes/             # Search results
│   └── genes/[symbol]/    # Gene detail with isoforms
├── (design-tool)/         # Sequence design tool
└── api/                   # Next.js API routes

algorithm/                 # Local FastAPI compute backend (dev only)
├── index.py               # Job endpoints (POST /jobs, GET /jobs/{id})
└── algorithm.py           # DNA optimization algorithms

modal/                     # Modal-hosted compute backend (production)
└── app.py                 # Same /jobs contract as the local server

actions/                   # Next.js server actions
components/                # React components (+ shadcn/ui)
context/                   # React context providers
drizzle/                   # Database schema, migrations, seed
hooks/                     # Custom React hooks
lib/                       # Shared utilities
```

## Compute Backend

The optimization algorithm runs as an async job API. Both the local FastAPI server and the Modal deployment expose the same contract:

- **`POST /jobs`** — Accepts `{ CDS, name, options }` and returns `{ call_id }`.
- **`GET /jobs/{call_id}`** — Returns `{ status, result? }` where status is `running`, `completed`, `failed`, or `not_found`.

The Next.js server action (`actions/jobs.ts`) talks to whichever backend is selected by the `COMPUTE_BACKEND` env var (`modal` or unset for local).

## License

Private.
