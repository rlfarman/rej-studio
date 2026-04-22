#!/usr/bin/env python3
"""Emit a neutral, dialect-free seed from transcript_metadata.csv.

Writes two JSONL files into data/:
  - genes.jsonl      (one gene per line)
  - isoforms.jsonl   (one isoform per line)

These files contain no dialect-specific encoding. A dialect-aware loader
(scripts/load-db.ts) reads them and INSERTs via Drizzle, which handles the
target DB's quoting/types. Next time we switch DBs, only load-db.ts needs
to know about the new dialect — this script doesn't.
"""

import csv
import json
import os
import sys
import time

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "drizzle", "transcript_metadata.csv")
GENES_OUT = os.path.join(os.path.dirname(__file__), "..", "data", "genes.jsonl")
ISOFORMS_OUT = os.path.join(os.path.dirname(__file__), "..", "data", "isoforms.jsonl")


def derive_species(transcript_id: str) -> str:
    if transcript_id.startswith("ENSMUST"):
        return "mouse"
    return "human"


def serialize_alternate_symbols(symbols: list[str]) -> str:
    """Pipe-delimited with sentinels: ["Abca1","Cerp"] -> "|Abca1|Cerp|".

    Matches serializeAlternateSymbols() in src/lib/bio/gene-symbols.ts.
    """
    if not symbols:
        return ""
    return "|" + "|".join(symbols) + "|"


# Required keys in each JSONL row — mirrors the Drizzle schema.
GENE_REQUIRED_KEYS = {"id", "symbol", "name", "species", "alternateSymbols"}
ISOFORM_REQUIRED_KEYS = {
    "id",
    "geneId",
    "codingSequenceLength",
    "proteinSequenceLength",
    "codingSequence",
    "proteinSequence",
    "species",
}


def _validate_jsonl(path: str, required_keys: set[str], label: str) -> None:
    """Validate every row in a JSONL file has the expected shape."""
    errors: list[str] = []
    with open(path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"  {label}:{lineno}: invalid JSON — {e}")
                continue
            if not isinstance(obj, dict):
                errors.append(f"  {label}:{lineno}: expected object, got {type(obj).__name__}")
                continue
            missing = required_keys - set(obj.keys())
            if missing:
                errors.append(f"  {label}:{lineno}: missing keys: {', '.join(sorted(missing))}")
    if errors:
        print(f"ERROR: {len(errors)} validation error(s) in {label}:")
        for err in errors[:20]:
            print(err)
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")
        sys.exit(1)


def main():
    print(f"Reading CSV from {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: CSV not found at {CSV_PATH}")
        sys.exit(1)

    os.makedirs(os.path.dirname(GENES_OUT), exist_ok=True)

    genes: dict[str, dict] = {}
    n_isoforms = 0
    start = time.time()

    with open(CSV_PATH, newline="") as f_in, open(ISOFORMS_OUT, "w") as f_iso:
        reader = csv.DictReader(f_in)
        for i, row in enumerate(reader):
            gene_id = row["gene_id"]
            transcript_id = row["transcript_id"]
            species = derive_species(transcript_id)

            if gene_id not in genes:
                sym_cols = [row.get(f"sym{j}", "") for j in range(1, 29)]
                symbols = [s for s in sym_cols if s]
                primary_symbol = symbols[0] if symbols else row["gene_name"]
                genes[gene_id] = {
                    "id": gene_id,
                    "symbol": primary_symbol,
                    "name": row["gene_name"],
                    "species": species,
                    "alternateSymbols": serialize_alternate_symbols(symbols[1:]),
                }

            f_iso.write(
                json.dumps(
                    {
                        "id": transcript_id,
                        "geneId": gene_id,
                        "codingSequenceLength": int(row["coding_sequence_length"]),
                        "proteinSequenceLength": int(row["protein_length"]),
                        "codingSequence": row["coding_sequence"],
                        "proteinSequence": row["protein_sequence"],
                        "species": species,
                    }
                )
                + "\n"
            )
            n_isoforms += 1

            if (i + 1) % 25000 == 0:
                print(f"  Parsed {i + 1} rows...")

    with open(GENES_OUT, "w") as f_genes:
        for g in genes.values():
            f_genes.write(json.dumps(g) + "\n")

    elapsed = time.time() - start
    genes_mb = os.path.getsize(GENES_OUT) / 1024 / 1024
    iso_mb = os.path.getsize(ISOFORMS_OUT) / 1024 / 1024
    print(
        f"Done! {len(genes)} genes ({genes_mb:.1f} MB) + "
        f"{n_isoforms} isoforms ({iso_mb:.1f} MB) in {elapsed:.1f}s"
    )
    print(f"  {GENES_OUT}")
    print(f"  {ISOFORMS_OUT}")

    # Validate output JSONL — catch malformed rows before load-db.ts chokes.
    print("\nValidating JSONL output...")
    _validate_jsonl(GENES_OUT, GENE_REQUIRED_KEYS, "genes")
    _validate_jsonl(ISOFORMS_OUT, ISOFORM_REQUIRED_KEYS, "isoforms")
    print("Validation passed.")


if __name__ == "__main__":
    main()
