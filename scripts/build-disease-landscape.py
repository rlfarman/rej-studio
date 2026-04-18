#!/usr/bin/env python3
"""Build the disease-landscape JSON from the OMIM curated CSV.

Reads drizzle/disease_associated_genes.csv and emits a pruned, parsed JSON
file consumed server-side by src/features/disease-landscape/. Only the four
scientifically interesting columns are retained (symbol, name, inheritance,
phenotypes) plus ensembl_gene_id for deep-linking into /genes/[symbol].

Run: python3 scripts/build-disease-landscape.py
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys

HERE = os.path.dirname(__file__)
CSV_PATH = os.path.join(HERE, "..", "drizzle", "disease_associated_genes.csv")
OUT_PATH = os.path.join(
    HERE, "..", "src", "features", "disease-landscape", "data", "landscape.json"
)

# Each OMIM phenotype record ends with: `NNNNNN (N), Inheritance` — or, for
# somatic / unspecified-inheritance records, just `NNNNNN (N)`.
# The name may contain commas, so we anchor on the 6-digit MIM + mapping key.
PHENO_RE = re.compile(r"^(.*), (\d{6}) \(([1-4])\)(?:, (.+))?$")


def parse_inheritance(raw: str) -> list[str]:
    return [t.strip() for t in raw.split(";") if t.strip()]


def parse_phenotype_record(record: str) -> dict | None:
    """Parse one OMIM phenotype record. Returns None if unparseable."""
    record = record.strip()
    if not record:
        return None

    # Strip OMIM status markers. See https://omim.org/help/faq for their meaning.
    status = "confirmed"
    if record.startswith("?"):
        status = "provisional"
        record = record[1:].strip()
    elif record.startswith("{") and "}" in record:
        status = "susceptibility"
        # {Foo}, ... — strip just the leading `{` and closing `}` around the name.
        # Match "{name}, rest" without regex to be safe.
        close = record.index("}")
        name_body = record[1:close]
        rest = record[close + 1 :]
        record = name_body + rest
    elif record.startswith("[") and "]" in record:
        status = "nondisease"
        close = record.index("]")
        name_body = record[1:close]
        rest = record[close + 1 :]
        record = name_body + rest

    m = PHENO_RE.match(record)
    if not m:
        return {
            "name": record,
            "mim": None,
            "mappingKey": None,
            "inheritance": None,
            "status": status,
        }

    name, mim, key, inh = m.groups()
    return {
        "name": name.strip(),
        "mim": int(mim),
        "mappingKey": int(key),
        "inheritance": inh.strip() if inh else None,
        "status": status,
    }


def parse_phenotypes(raw: str) -> list[dict]:
    if not raw:
        return []
    parsed = []
    for record in raw.split(";"):
        p = parse_phenotype_record(record)
        if p is not None:
            parsed.append(p)
    return parsed


def main() -> None:
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: {CSV_PATH} not found")
        sys.exit(1)

    rows: list[dict] = []
    unparsed = 0
    with open(CSV_PATH, newline="") as f:
        for r in csv.DictReader(f):
            phenos = parse_phenotypes(r["phenotypes_omim"])
            unparsed += sum(1 for p in phenos if p["mim"] is None)
            rows.append(
                {
                    "symbol": r["approved_gene_symbol"],
                    "name": r["gene_name_omim"],
                    "ensemblGeneId": r["ensembl_gene_id_omim"] or None,
                    "inheritance": parse_inheritance(r["inheritance_terms"]),
                    "phenotypes": phenos,
                }
            )

    rows.sort(key=lambda r: r["symbol"])

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump({"rows": rows}, f, indent=2, ensure_ascii=False)
        f.write("\n")

    total_phenos = sum(len(r["phenotypes"]) for r in rows)
    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(
        f"Wrote {len(rows)} genes, {total_phenos} phenotypes "
        f"({unparsed} records without MIM) to {OUT_PATH} ({size_kb:.1f} KB)"
    )


if __name__ == "__main__":
    main()
