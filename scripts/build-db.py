#!/usr/bin/env python3
"""Build the SQLite database from transcript_metadata.csv."""

import csv
import json
import os
import sqlite3
import sys
import time

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "drizzle", "transcript_metadata.csv")
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "rej-studio.db")

DDL = """
CREATE TABLE IF NOT EXISTS genes (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    alternate_symbols TEXT
);

CREATE TABLE IF NOT EXISTS isoforms (
    id TEXT PRIMARY KEY,
    gene_id TEXT NOT NULL REFERENCES genes(id),
    coding_sequence_length INTEGER NOT NULL,
    protein_length INTEGER NOT NULL,
    coding_sequence TEXT NOT NULL DEFAULT '',
    protein_sequence TEXT NOT NULL DEFAULT '',
    species TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_genes_symbol ON genes(symbol);
CREATE INDEX IF NOT EXISTS idx_genes_name ON genes(name);
CREATE INDEX IF NOT EXISTS idx_genes_species ON genes(species);
CREATE INDEX IF NOT EXISTS idx_isoforms_gene_id ON isoforms(gene_id);
CREATE INDEX IF NOT EXISTS idx_isoforms_enst ON isoforms(id);

CREATE VIRTUAL TABLE IF NOT EXISTS genes_fts USING fts5(
    id,
    symbol,
    name,
    alternate_symbols,
    content='genes',
    content_rowid='rowid'
);
"""


def derive_species(transcript_id: str) -> str:
    if transcript_id.startswith("ENSMUST"):
        return "mouse"
    return "human"


def main():
    print(f"Reading CSV from {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: CSV not found at {CSV_PATH}")
        sys.exit(1)

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")
    conn.executescript(DDL)

    genes: dict[str, tuple] = {}
    isoforms: list[tuple] = []
    start = time.time()

    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            gene_id = row["gene_id"]
            transcript_id = row["transcript_id"]
            species = derive_species(transcript_id)

            if gene_id not in genes:
                sym_cols = [row.get(f"sym{j}", "") for j in range(1, 29)]
                symbols = [s for s in sym_cols if s]
                primary_symbol = symbols[0] if symbols else row["gene_name"]
                alt_symbols = json.dumps(symbols[1:]) if len(symbols) > 1 else None

                genes[gene_id] = (
                    gene_id,
                    primary_symbol,
                    row["gene_name"],
                    species,
                    alt_symbols,
                )

            isoforms.append((
                transcript_id,
                gene_id,
                int(row["coding_sequence_length"]),
                int(row["protein_length"]),
                row["coding_sequence"],
                row["protein_sequence"],
                species,
            ))

            if (i + 1) % 25000 == 0:
                print(f"  Parsed {i + 1} rows...")

    print(f"Parsed {len(genes)} genes and {len(isoforms)} isoforms in {time.time() - start:.1f}s")

    print("Inserting genes...")
    conn.executemany(
        "INSERT INTO genes (id, symbol, name, species, alternate_symbols) VALUES (?, ?, ?, ?, ?)",
        genes.values(),
    )

    print("Inserting isoforms...")
    conn.executemany(
        "INSERT INTO isoforms (id, gene_id, coding_sequence_length, protein_length, coding_sequence, protein_sequence, species) VALUES (?, ?, ?, ?, ?, ?, ?)",
        isoforms,
    )

    print("Building FTS index...")
    conn.execute(
        "INSERT INTO genes_fts(rowid, id, symbol, name, alternate_symbols) SELECT rowid, id, symbol, name, alternate_symbols FROM genes"
    )

    conn.commit()

    print("Running VACUUM and ANALYZE...")
    conn.execute("VACUUM")
    conn.execute("ANALYZE")
    conn.close()

    size_mb = os.path.getsize(DB_PATH) / 1024 / 1024
    elapsed = time.time() - start
    print(f"Done! {DB_PATH} ({size_mb:.1f} MB) built in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
