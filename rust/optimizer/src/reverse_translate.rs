//! Protein -> DNA, using the species-preferred codon for each amino acid.
//!
//! The design tool accepts a protein sequence, which has to become DNA before
//! anything else can happen: the optimizer works on codons and the splice
//! slider places the split on DNA positions. That translation used to live in
//! TypeScript with a codon table of its own, which disagreed with the table
//! the optimizer scores against (mouse arginine, where the two tables rank
//! AGA and AGG the other way round). It lives here now so there is one table.
//!
//! Preference is read from the same generated tables [`crate::spec`] scores
//! CAI with, so the codon this picks is by construction the one the optimizer
//! would move towards. Ties go to the codon that comes first in DNAChisel's
//! backtranslation order — the same order the mutation space is built in —
//! which is what makes mouse arginine AGA.
//!
//! **Seeds.** A protein request's seed is derived from the DNA this produces,
//! not from the protein: the crate's `derive_seed` hashes the coding sequence
//! it is handed, and the caller hands it this DNA. Nothing special is needed
//! for that to be well defined, because this function is pure — the same
//! protein and species always give the same DNA, hence the same seed and the
//! same design. Hashing the protein instead would be a second seed derivation
//! to keep in step with Python's, for no gain.

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::biotools::backtranslation;
use crate::spec::log_frequency;

/// The stop codons, for checking a sequence already ends in one.
const STOP_CODONS: [&str; 3] = ["TAA", "TAG", "TGA"];

/// The codon-usage table name for a species as the UI spells it.
fn table_name(species: &str) -> Option<&'static str> {
    match species {
        "human" | "h_sapiens" => Some("h_sapiens"),
        "mouse" | "m_musculus" => Some("m_musculus"),
        _ => None,
    }
}

/// Amino acid -> its most-used codon in one species, built once.
fn preferred_codons(table: &'static str) -> &'static HashMap<char, &'static str> {
    static HUMAN: OnceLock<HashMap<char, &'static str>> = OnceLock::new();
    static MOUSE: OnceLock<HashMap<char, &'static str>> = OnceLock::new();
    let cell = if table == "h_sapiens" { &HUMAN } else { &MOUSE };
    cell.get_or_init(|| {
        backtranslation()
            .iter()
            .map(|(amino_acid, codons)| (*amino_acid, most_used(table, codons)))
            .collect()
    })
}

/// The most-used codon of a synonymous group.
///
/// Strictly greater, so a tie keeps the earlier codon: the group arrives in
/// DNAChisel's backtranslation order, and that order is what decides it.
fn most_used(table: &'static str, codons: &'static [&'static str]) -> &'static str {
    let frequency = |codon: &str| log_frequency(table, codon).unwrap_or(f64::NEG_INFINITY);
    let mut best = codons[0];
    let mut best_frequency = frequency(best);
    for codon in &codons[1..] {
        let candidate = frequency(codon);
        if candidate > best_frequency {
            best = codon;
            best_frequency = candidate;
        }
    }
    best
}

/// Reverse-translate a protein into DNA with `species`-preferred codons.
///
/// `species` is "human" or "mouse" (the table names `h_sapiens` and
/// `m_musculus` are accepted too). Whitespace is ignored and the input is
/// case-insensitive. `*` becomes the most-preferred stop codon, and a
/// sequence that does not already end in a stop codon gets one appended, so
/// the result is always a complete coding sequence.
pub fn reverse_translate(protein: &str, species: &str) -> Result<String, String> {
    let table = table_name(species)
        .ok_or_else(|| format!("Unknown species for reverse translation: \"{species}\""))?;
    let preferred = preferred_codons(table);

    let mut dna = String::with_capacity(protein.len() * 3 + 3);
    let mut invalid: Vec<char> = Vec::new();
    for amino_acid in protein
        .chars()
        .filter(|character| !character.is_whitespace())
        .flat_map(char::to_uppercase)
    {
        match preferred.get(&amino_acid) {
            Some(codon) => dna.push_str(codon),
            None if !invalid.contains(&amino_acid) => invalid.push(amino_acid),
            None => {}
        }
    }
    if !invalid.is_empty() {
        let listed: Vec<String> = invalid.iter().map(char::to_string).collect();
        return Err(format!(
            "Invalid amino acid character(s): {}",
            listed.join(", ")
        ));
    }
    if dna.is_empty() {
        return Ok(dna);
    }

    if !STOP_CODONS.contains(&&dna[dna.len() - 3..]) {
        dna.push_str(preferred[&'*']);
    }
    Ok(dna)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::biotools::translate;

    #[test]
    fn mouse_arginine_is_aga() {
        // AGA and AGG are used equally often in mouse, so the backtranslation
        // order decides; the TypeScript table this replaced picked AGG, which
        // is the disagreement that motivated moving the table here.
        assert_eq!(reverse_translate("R", "mouse").unwrap(), "AGATGA");
        assert_eq!(reverse_translate("R", "human").unwrap(), "AGATGA");
    }

    #[test]
    fn picks_the_most_used_codon_for_every_amino_acid() {
        for species in ["human", "mouse"] {
            let table = table_name(species).unwrap();
            for (amino_acid, codons) in backtranslation() {
                let chosen = preferred_codons(table)[amino_acid];
                let best = codons
                    .iter()
                    .map(|codon| log_frequency(table, codon).unwrap())
                    .fold(f64::NEG_INFINITY, f64::max);
                assert_eq!(
                    log_frequency(table, chosen).unwrap(),
                    best,
                    "{species} {amino_acid} picked {chosen}"
                );
            }
        }
    }

    #[test]
    fn the_protein_survives_the_round_trip() {
        let protein = "MRKLDSEDDLERLKATLEGVDSVITD*";
        for species in ["human", "mouse"] {
            let dna = reverse_translate(protein, species).unwrap();
            assert_eq!(translate(&dna), protein);
        }
    }

    #[test]
    fn a_stop_codon_is_appended_when_the_protein_lacks_one() {
        let dna = reverse_translate("MK", "human").unwrap();
        assert_eq!(translate(&dna), "MK*");
        // The most-preferred stop, the same codon an explicit `*` produces.
        assert_eq!(
            &dna[dna.len() - 3..],
            reverse_translate("*", "human").unwrap()
        );
    }

    #[test]
    fn whitespace_and_case_do_not_matter() {
        assert_eq!(
            reverse_translate("m k\n*", "mouse").unwrap(),
            reverse_translate("MK*", "mouse").unwrap()
        );
    }

    #[test]
    fn an_empty_protein_gives_an_empty_sequence() {
        assert_eq!(reverse_translate("", "human").unwrap(), "");
        assert_eq!(reverse_translate("  \n", "human").unwrap(), "");
    }

    #[test]
    fn reports_every_character_that_is_not_an_amino_acid() {
        let error = reverse_translate("MXBX", "human").unwrap_err();
        assert_eq!(error, "Invalid amino acid character(s): X, B");
    }

    #[test]
    fn an_unknown_species_is_refused() {
        assert!(reverse_translate("MK*", "rat").is_err());
    }
}
