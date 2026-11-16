#!/usr/bin/env python3
"""Emit a neutral, dialect-free seed from transcript_metadata.csv.

Writes two JSONL files into data/:
  - genes.jsonl      (one gene per line)
  - isoforms.jsonl   (one isoform per line)

These files contain no dialect-specific encoding. A dialect-aware loader
(scripts/load-db.ts) reads them and INSERTs via Drizzle, which handles the
target DB's quoting/types. Next time we switch DBs, only load-db.ts needs
to know about the new dialect — this script doesn't.

Gene names are recased on the way through (see recase_gene_name): the CSV
title-cases them, mangling the acronyms and symbols inside.

Usage:
  python3 scripts/build-db.py                        # CSV -> data/*.jsonl
  python3 scripts/build-db.py --recase-names FILE    # fix names in a genes JSONL
"""

import csv
import json
import os
import re
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


# --- Gene name casing --------------------------------------------------------
#
# The source CSV title-cases gene names ("Brca1 Dna Repair Associated"), which
# mangles the acronyms and gene symbols inside them. HGNC and MGI write names
# in lower case apart from those, so rebuild that: lower-case each word unless
# it is a known acronym, a gene symbol, an alphanumeric designation ("1A"), a
# Roman numeral, or a proper noun, then capitalize the first letter for
# display. A heuristic: it fixes the common cases and leaves rare ones
# readable, never worse than the title case it replaces.

# Lower-case form → canonical spelling.
NAME_ACRONYMS = {
    word.lower(): word
    for word in ["DNA", "RNA", "mRNA", "tRNA", "rRNA", "snRNA", "snoRNA", "miRNA", "lncRNA", "cDNA", "ATP", "ADP", "AMP", "cAMP", "GTP", "GDP", "GMP", "cGMP", "UDP", "NAD", "NADH", "NADP", "NADPH", "FAD", "CoA", "ATPase", "GTPase", "NTPase", "bHLH", "bZIP", "HMG", "KRAB", "BTB", "POZ", "PDZ", "SH2", "SH3", "WD", "LIM", "SET", "RecQ", "NFKB", "MHC", "HLA", "TNF", "EGF", "FGF", "IGF", "PDGF", "VEGF", "TGF", "BMP", "NF", "ER", "ABC", "ARF", "HECT", "SUMO", "UBX", "JAK", "STAT", "MAP", "MAPK", "CDC", "ITR", "UTR", "ORF"]
}

PROPER_NOUNS = {
    word.lower(): word
    for word in ["Fanconi", "Wilms", "Kruppel", "Wnt", "Golgi", "Willebrand", "Hippel", "Lindau", "Kirsten", "Harvey", "Moloney", "Abelson", "Wiskott", "Aldrich", "Bloom", "Werner", "Alzheimer", "Parkinson", "Usher", "Bardet", "Biedl", "Cockayne", "Marfan", "Noonan", "Duchenne", "Charcot", "Nijmegen", "Ewing", "Epstein", "Barr", "Rous", "Fas"]
}

ROMAN_NUMERALS = {
    "ii",
    "iii",
    "iv",
    "vi",
    "vii",
    "viii",
    "ix",
    "xi",
    "xii",
    "xiii",
    "xiv",
    "xv",
    "xvi",
    "xvii",
    "xviii",
    "xix",
    "xx",
}

# A single letter after one of these is a designation ("group A", "type I").
LETTER_DESIGNATORS = {
    "type",
    "class",
    "group",
    "complex",
    "family",
    "subfamily",
    "member",
    "subunit",
    "chain",
    "polypeptide",
    "factor",
    "domain",
    "isoform",
    "variant",
    "form",
    "site",
    "protein",
    "antigen",
    "locus",
    "region",
}

# English words that are also gene symbols; leave them lower case.
ENGLISH_WORDS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "via",
    "with",
    "like",
    "not",
    "no",
    "light",
    "large",
    "small",
    "long",
    "short",
    "rich",
    "low",
    "high",
    "early",
    "late",
    "cell",
    "clock",
    "white",
    "golden",
    "type",
    "family",
    "member",
    "protein",
    "factor",
}

# Letters then digits, optionally more letters/digits: Brca1, Nfe2, Sox9.
SYMBOL_SHAPED = re.compile(r"^[a-z]{2,}\d+[a-z0-9]*$")
# Digits then a letter suffix: the "1A" in "kinase inhibitor 1A".
NUMBER_SUFFIX = re.compile(r"^\d+[a-z]\d*$")
# One letter then digits: "annexin A1", "complement C3", "H2A". Not "p":
# protein names like p53 and p21 are written lower case.
LETTER_NUMBER = re.compile(r"^[a-oq-z]\d+[a-z0-9]*$")
# Phrases a per-word pass can't see.
PHRASE_FIXES = [(re.compile(r"\bg protein\b"), "G protein")]
WORD_PARTS = re.compile(r"([A-Za-z0-9]+)")


def _recase_word(word: str, prev_word: str, is_last: bool, symbols: set[str]) -> str:
    """Recase one alphanumeric run, given the word before it."""
    lower = word.lower()
    if lower in NAME_ACRONYMS:
        return NAME_ACRONYMS[lower]
    if lower in PROPER_NOUNS:
        return PROPER_NOUNS[lower]
    if lower in ROMAN_NUMERALS:
        return lower.upper()
    if len(lower) == 1 and lower.isalpha() and prev_word in LETTER_DESIGNATORS:
        return lower.upper()
    if lower in ("i", "v", "x") and is_last:
        return lower.upper()
    if NUMBER_SUFFIX.match(lower) or LETTER_NUMBER.match(lower):
        return lower.upper()
    if lower not in ENGLISH_WORDS and lower.upper() in symbols:
        return lower.upper()
    if SYMBOL_SHAPED.match(lower):
        return lower.upper()
    return lower


def recase_gene_name(name: str, symbols: set[str]) -> str:
    """Turn a title-cased gene name back into HGNC-style sentence case.

    `symbols` is the upper-cased set of primary gene symbols in the corpus,
    used to spot symbols embedded in names ("BRCA1 DNA repair associated").
    Names that already contain lower-case words are assumed to be correctly
    cased at the source and returned unchanged.
    """
    words = name.split()
    if not words or any(w[:1].islower() for w in words if w[:1].isalpha()):
        return name

    out: list[str] = []
    prev_word = ""
    for t, token in enumerate(words):
        parts = WORD_PARTS.split(token)
        last_part = len(parts) - 2
        for i in range(1, len(parts), 2):
            is_last = t == len(words) - 1 and i == last_part
            parts[i] = _recase_word(parts[i], prev_word, is_last, symbols)
            prev_word = parts[i].lower()
        out.append("".join(parts))

    result = " ".join(out)
    for pattern, replacement in PHRASE_FIXES:
        result = pattern.sub(replacement, result)
    # Sentence case for display; leaves "cAMP ..." or "p53 ..." alone.
    first = WORD_PARTS.search(result)
    if first and first.start() == 0 and first.group().isalpha() and first.group().islower():
        result = result[:1].upper() + result[1:]
    return result


def recase_genes_jsonl(path: str) -> None:
    """Recase the names in a genes JSONL file in place (e.g. the sample seed)."""
    with open(path) as f:
        rows = [json.loads(line) for line in f if line.strip()]
    symbols = {r["symbol"].upper() for r in rows}
    for r in rows:
        r["name"] = recase_gene_name(r["name"], symbols)
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"Recased {len(rows)} gene names in {path}")


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

    symbols = {g["symbol"].upper() for g in genes.values()}
    with open(GENES_OUT, "w") as f_genes:
        for g in genes.values():
            g["name"] = recase_gene_name(g["name"], symbols)
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
    if len(sys.argv) == 3 and sys.argv[1] == "--recase-names":
        recase_genes_jsonl(sys.argv[2])
    else:
        main()
