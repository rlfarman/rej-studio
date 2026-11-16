//! Sequence helpers, ported from `dnachisel.biotools`.
//!
//! Each function mirrors one DNAChisel helper closely enough to be compared
//! against it directly; the grouping helpers in particular reproduce its
//! "spread" rule exactly, because the groups become the locations the solver
//! visits and so decide which parts of the sequence get optimized.

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::tables::{BACKTRANSLATION, GENETIC_CODE};

/// Codon -> amino acid, built once from the generated table.
fn genetic_code() -> &'static HashMap<&'static str, char> {
    static CODE: OnceLock<HashMap<&'static str, char>> = OnceLock::new();
    CODE.get_or_init(|| GENETIC_CODE.iter().copied().collect())
}

/// Amino acid -> synonymous codons, built once from the generated table.
pub fn backtranslation() -> &'static HashMap<char, &'static [&'static str]> {
    static TABLE: OnceLock<HashMap<char, &'static [&'static str]>> = OnceLock::new();
    TABLE.get_or_init(|| BACKTRANSLATION.iter().copied().collect())
}

/// Translate DNA to protein with the Standard genetic code.
///
/// Trailing bases that do not complete a codon are dropped, matching
/// Biopython's behaviour (it warns; we stay silent since every caller here
/// works on in-frame coding sequences).
pub fn translate(dna: &str) -> String {
    let bytes = dna.as_bytes();
    let code = genetic_code();
    let mut protein = String::with_capacity(bytes.len() / 3);
    for codon in bytes.as_chunks::<3>().0 {
        let codon = std::str::from_utf8(codon).unwrap_or("NNN");
        protein.push(code.get(codon).copied().unwrap_or('X'));
    }
    protein
}

/// Reverse complement of an ACGT sequence.
pub fn reverse_complement(dna: &str) -> String {
    dna.bytes()
        .rev()
        .map(|base| match base {
            b'A' => 'T',
            b'T' => 'A',
            b'G' => 'C',
            b'C' => 'G',
            other => other as char,
        })
        .collect()
}

/// Fraction of G and C bases.
pub fn gc_content(sequence: &str) -> f64 {
    if sequence.is_empty() {
        return 0.0;
    }
    let gc = sequence
        .bytes()
        .filter(|b| *b == b'G' || *b == b'C')
        .count();
    gc as f64 / sequence.len() as f64
}

/// Group sorted indices so that each group spans less than `max_spread`.
///
/// DNAChisel compares against the group's *first* element, not the previous
/// one, so a run of adjacent indices still starts a new group once it has
/// spread far enough. The groups become optimization locations, so this rule
/// has to match or the two implementations visit different windows.
pub fn group_nearby_indices(indices: &[usize], max_spread: usize) -> Vec<Vec<usize>> {
    if indices.is_empty() {
        return Vec::new();
    }
    let mut sorted = indices.to_vec();
    sorted.sort_unstable();

    let mut groups: Vec<Vec<usize>> = vec![vec![sorted[0]]];
    for &index in &sorted[1..] {
        let current = groups.last_mut().expect("groups starts non-empty");
        if index - current[0] < max_spread {
            current.push(index);
        } else {
            groups.push(vec![index]);
        }
    }
    groups
}

/// Indices where two equal-length sequences differ.
pub fn differing_indices(a: &str, b: &str) -> Vec<usize> {
    a.bytes()
        .zip(b.bytes())
        .enumerate()
        .filter_map(|(i, (x, y))| (x != y).then_some(i))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn translates_including_stop_codons() {
        assert_eq!(translate("ATGTAA"), "M*");
        assert_eq!(translate("ATGCGTAAGCTGGAC"), "MRKLD");
        // A trailing partial codon is dropped, as Biopython does.
        assert_eq!(translate("ATGA"), "M");
    }

    #[test]
    fn reverse_complements() {
        assert_eq!(reverse_complement("ATGC"), "GCAT");
        assert_eq!(reverse_complement(""), "");
    }

    #[test]
    fn computes_gc_content() {
        assert_eq!(gc_content("GCGC"), 1.0);
        assert_eq!(gc_content("ATAT"), 0.0);
        assert_eq!(gc_content("ATGC"), 0.5);
        assert_eq!(gc_content(""), 0.0);
    }

    #[test]
    fn groups_indices_by_spread_from_the_group_start() {
        // Spread is measured from 10, so 13 fits (3 < 5) and 15 does not.
        assert_eq!(
            group_nearby_indices(&[10, 11, 13, 15, 40], 5),
            vec![vec![10, 11, 13], vec![15], vec![40]]
        );
        assert!(group_nearby_indices(&[], 5).is_empty());
    }

    #[test]
    fn finds_differing_indices() {
        assert_eq!(differing_indices("ATGC", "ATGC"), Vec::<usize>::new());
        assert_eq!(differing_indices("ATGC", "ATCC"), vec![2]);
    }
}
