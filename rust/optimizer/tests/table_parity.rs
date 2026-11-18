//! Checks the codon tables still match the ones DNAChisel used.
//!
//! `src/tables.rs` was generated once from Biopython and python_codon_tables
//! and is frozen, as is `fixtures/tables.json`, dumped from the same
//! libraries (see `fixtures/README.md`). An edited table would quietly change
//! every codon-optimization score without breaking anything visibly, so the
//! constants are compared against the fixture. Neither file should change.

use std::collections::BTreeMap;

use serde::Deserialize;

const TABLES: &str = include_str!("fixtures/tables.json");

#[derive(Deserialize)]
struct Tables {
    /// Codon -> amino acid.
    genetic_code: BTreeMap<String, String>,
    /// Amino acid -> its synonymous codons, in DNAChisel's order.
    backtranslation: BTreeMap<String, Vec<String>>,
    /// Species -> amino acid -> codon -> usage frequency.
    species: BTreeMap<String, BTreeMap<String, BTreeMap<String, f64>>>,
}

fn tables() -> Tables {
    serde_json::from_str(TABLES).expect("table fixtures")
}

#[test]
fn the_genetic_code_matches_biopython() {
    let expected = tables().genetic_code;
    assert_eq!(expected.len(), 64, "fixture should cover every codon");

    for (codon, amino_acid) in &expected {
        let ours = rej_optimizer::translate_dna(codon);
        assert_eq!(&ours, amino_acid, "{codon} translates differently");
    }
}

#[test]
fn translation_matches_biopython_on_multi_codon_sequences() {
    // Joining codons must give the same protein as translating them singly,
    // which also catches a frame or chunking mistake.
    let expected = tables().genetic_code;
    let codons: Vec<&String> = expected.keys().collect();
    let joined: String = codons.iter().map(|codon| codon.as_str()).collect();
    let protein: String = codons
        .iter()
        .map(|codon| expected[*codon].as_str())
        .collect();
    assert_eq!(rej_optimizer::translate_dna(&joined), protein);
}

#[test]
fn the_backtranslation_table_matches_dnachisel() {
    let expected = tables().backtranslation;
    for (amino_acid, codons) in &expected {
        let character = amino_acid.chars().next().expect("single character");
        let ours = rej_optimizer::synonymous_codons(character)
            .unwrap_or_else(|| panic!("{amino_acid} missing from the Rust table"));
        assert_eq!(
            ours, *codons,
            "{amino_acid} has different synonyms (order matters: it shapes the mutation space)"
        );
    }
}

#[test]
fn every_synonymous_codon_really_encodes_its_amino_acid() {
    // A sanity check on the table itself rather than on the port: a wrong
    // entry here would let the optimizer change the protein.
    for (amino_acid, codons) in &tables().backtranslation {
        for codon in codons {
            assert_eq!(
                &rej_optimizer::translate_dna(codon),
                amino_acid,
                "{codon} is listed under {amino_acid} but does not encode it"
            );
        }
    }
}

#[test]
fn codon_usage_frequencies_match_python_codon_tables() {
    for (species, by_amino_acid) in &tables().species {
        for (amino_acid, frequencies) in by_amino_acid {
            for (codon, frequency) in frequencies {
                let ours = rej_optimizer::codon_log_frequency(species, codon)
                    .unwrap_or_else(|| panic!("{species}/{codon} missing from the Rust table"));
                // The tables store logs, with Python's 0.001 floor for a
                // zero-frequency codon.
                let expected = if *frequency == 0.0 {
                    0.001_f64.ln()
                } else {
                    frequency.ln()
                };
                assert!(
                    (ours - expected).abs() < 1e-12,
                    "{species}/{codon} ({amino_acid}): {ours} vs {expected}"
                );
            }
        }
    }
}
