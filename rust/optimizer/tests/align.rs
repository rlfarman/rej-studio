//! Checks for the isoform-identity aligner in `src/align.rs`.
//!
//! `fixtures/align_reference.json` comes from Biopython's `PairwiseAligner`
//! with the same scoring (a frozen recording; `fixtures/README.md` has the
//! recipe), so agreement there is agreement with an independent
//! implementation, tie-break included.

use std::collections::HashMap;
use std::path::PathBuf;

use rej_optimizer::align::{
    Alignment, align, align_exhaustive, identity_matrix, identity_triangle_permille,
};
use serde::Deserialize;

const REFERENCE: &str = include_str!("fixtures/align_reference.json");

#[derive(Deserialize)]
struct Reference {
    name: String,
    a: String,
    b: String,
    score: i32,
    identities: u32,
    aligned_pairs: u32,
}

fn reference(name: &str) -> Reference {
    serde_json::from_str::<Vec<Reference>>(REFERENCE)
        .unwrap()
        .into_iter()
        .find(|r| r.name == name)
        .unwrap_or_else(|| panic!("no fixture named {name}"))
}

fn run(name: &str) -> Alignment {
    let r = reference(name);
    align(r.a.as_bytes(), r.b.as_bytes())
}

#[test]
fn matches_biopython_on_every_fixture() {
    let cases: Vec<Reference> = serde_json::from_str(REFERENCE).unwrap();
    assert!(cases.len() >= 20);
    for case in cases {
        for found in [
            align(case.a.as_bytes(), case.b.as_bytes()),
            align_exhaustive(case.a.as_bytes(), case.b.as_bytes()),
        ] {
            assert_eq!(
                (found.score, found.identities, found.aligned_pairs),
                (case.score, case.identities, case.aligned_pairs),
                "{}",
                case.name
            );
        }
    }
}

#[test]
fn identical_sequences_are_100() {
    let found = run("identical");
    assert_eq!(found.identities, 60);
    assert_eq!(found.percent_of_shorter(), 100.0);
    assert_eq!(found.percent_of_columns(), 100.0);
}

#[test]
fn one_substitution_costs_one_position() {
    // V -> I: BLOSUM62 scores it +3, so it stays aligned, not gapped.
    let found = run("one substitution");
    assert_eq!((found.identities, found.aligned_pairs), (15, 16));
    assert_eq!(found.percent_of_shorter(), 15.0 * 100.0 / 16.0);
}

#[test]
fn an_internal_deletion_keeps_every_shorter_residue() {
    // 95 aa with a 34 aa exon skipped: all 61 residues of the shorter one
    // align, in 95 columns.
    let found = run("internal deletion");
    assert_eq!(found.identities, 61);
    assert_eq!(found.columns(), 95);
    assert_eq!(found.percent_of_shorter(), 100.0);
    assert!((found.percent_of_columns() - 61.0 * 100.0 / 95.0).abs() < 1e-9);
}

#[test]
fn two_separate_exon_skips_are_both_recovered() {
    // The prefix/suffix proxy can only see one skip; here both are gaps and
    // all three shared exons align.
    let found = run("two exon skips");
    assert_eq!((found.identities, found.columns()), (112, 187));
    assert_eq!(found.percent_of_shorter(), 100.0);
}

#[test]
fn a_frame_shifted_tail_counts_only_the_shared_part() {
    // 60 shared residues, then 35 aa against 28 aa of out-of-frame
    // translation. The tails still pair up (28 pairs, 8 coincidental
    // matches) because two long gaps would cost more than the mismatches.
    let found = run("frame-shifted tail");
    assert_eq!((found.identities, found.aligned_pairs), (68, 88));
    assert!(found.identities < 60 + 28);
}

#[test]
fn unrelated_sequences_prefer_gaps_to_bad_pairs() {
    let found = run("no similarity");
    assert_eq!(found.identities, 0);
    assert_eq!(found.score, -38); // gap 10 (-21) + gap 6 (-17)
}

#[test]
fn empty_sequences() {
    let found = align(b"", b"");
    assert_eq!(found.score, 0);
    assert_eq!(found.percent_of_shorter(), 100.0);
    let found = align(b"MEEP", b"");
    assert_eq!((found.score, found.identities), (-15, 0));
    assert_eq!(found.percent_of_shorter(), 100.0);
    assert_eq!(found.percent_of_columns(), 0.0);
}

/// Distinct protein sequences of every gene in the sample corpus.
fn sample_genes() -> Vec<(String, Vec<String>)> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Isoform {
        protein_sequence: String,
    }
    #[derive(Deserialize)]
    struct Gene {
        symbol: String,
        species: String,
        isoforms: Vec<Isoform>,
    }
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../public/gene-data/sample/genes");
    let mut paths: Vec<_> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    paths.sort();
    paths
        .into_iter()
        .map(|p| {
            let gene: Gene = serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap();
            let mut seqs: Vec<String> = gene
                .isoforms
                .into_iter()
                .map(|i| i.protein_sequence)
                .collect();
            seqs.sort();
            seqs.dedup();
            (format!("{} ({})", gene.symbol, gene.species), seqs)
        })
        .collect()
}

/// Every distinct isoform pair in the sample, except that unoptimised test
/// builds skip the largest so `cargo test` stays quick; `cargo test
/// --release` covers all of them.
fn sample_pairs() -> Vec<(String, String, String)> {
    let limit = if cfg!(debug_assertions) {
        250_000
    } else {
        usize::MAX
    };
    let mut out = Vec::new();
    for (gene, seqs) in sample_genes() {
        for (i, a) in seqs.iter().enumerate() {
            for b in &seqs[i + 1..] {
                if a.len() * b.len() <= limit {
                    out.push((gene.clone(), a.clone(), b.clone()));
                }
            }
        }
    }
    out
}

#[test]
fn shortcuts_and_symmetry_hold_on_the_sample_corpus() {
    let pairs = sample_pairs();
    assert!(pairs.len() > 300, "only {} pairs", pairs.len());
    for (gene, a, b) in pairs {
        let (a, b) = (a.as_bytes(), b.as_bytes());
        let ab = align(a, b);
        let ba = align(b, a);
        assert_eq!(
            ab,
            align_exhaustive(a, b),
            "{gene}: shortcut changed the result"
        );
        assert_eq!(
            (ab.score, ab.identities, ab.aligned_pairs),
            (ba.score, ba.identities, ba.aligned_pairs),
            "{gene}: not symmetric"
        );
        assert!(ab.identities <= ab.aligned_pairs);
        assert!(ab.aligned_pairs <= ab.len_a.min(ab.len_b));
    }
}

#[test]
fn matrix_agrees_with_pairwise_alignment() {
    let seqs = ["MEEPQSDPSV", "MEEPQSDPSV", "MEEPSDPSV", "MKKPQSDPSVW"].map(str::as_bytes);
    let matrix = identity_matrix(&seqs);
    let n = seqs.len();
    for i in 0..n {
        for j in 0..n {
            let cell = matrix[i * n + j];
            assert_eq!(
                (cell.len_a, cell.len_b),
                (seqs[i].len() as u32, seqs[j].len() as u32)
            );
            if seqs[i] == seqs[j] {
                assert_eq!(cell.percent_of_shorter(), 100.0);
            } else {
                assert_eq!(cell, align(seqs[i], seqs[j]));
            }
        }
    }
}

#[test]
fn permille_rounds_half_up_over_columns() {
    let at = |identities, aligned_pairs, len_a, len_b| {
        Alignment {
            score: 0,
            identities,
            aligned_pairs,
            len_a,
            len_b,
        }
        .permille_of_columns()
    };
    // 61 of 95 columns = 64.21% -> 642.
    assert_eq!(at(61, 61, 95, 61), 642);
    // 1 of 8 = 12.5% exactly; 1 of 16 = 6.25% -> 62.5 -> 63 (half up).
    assert_eq!(at(1, 8, 8, 8), 125);
    assert_eq!(at(1, 16, 16, 16), 63);
    assert_eq!(at(0, 0, 0, 0), 1000);
    assert_eq!(at(0, 0, 4, 0), 0);
    assert_eq!(at(7, 7, 7, 7), 1000);
}

#[test]
fn triangle_is_the_upper_half_of_the_matrix_row_major() {
    let seqs = ["MEEPQSDPSV", "MEEPSDPSV", "MKKPQSDPSVW", "MEEPQSDPSV"].map(str::as_bytes);
    let triangle = identity_triangle_permille(&seqs);
    let pair = |i: usize, j: usize| align(seqs[i], seqs[j]).permille_of_columns();
    assert_eq!(
        triangle,
        vec![
            pair(0, 1),
            pair(0, 2),
            1000,
            pair(1, 2),
            pair(1, 3),
            pair(2, 3)
        ]
    );
    assert!(identity_triangle_permille(&seqs[..1]).is_empty());
}

/// The committed sample corpus stores what this aligner computes: every
/// gene file's `isoformIdentity` is recomputed from its own isoforms. Catches
/// a sample built before an aligner change, or a hand edit. (Which isoforms
/// are listed is the TypeScript build's choice, and `build.test.ts` checks
/// it.)
#[test]
fn the_sample_corpus_stores_these_identities() {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Isoform {
        id: String,
        protein_sequence: String,
    }
    #[derive(Deserialize)]
    struct Stored {
        isoforms: Vec<String>,
        permille: Vec<u16>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Gene {
        symbol: String,
        isoforms: Vec<Isoform>,
        isoform_identity: Stored,
    }

    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../public/gene-data/sample/genes");
    let mut checked = 0;
    for entry in std::fs::read_dir(dir).unwrap() {
        let text = std::fs::read_to_string(entry.unwrap().path()).unwrap();
        let gene: Gene = serde_json::from_str(&text).unwrap();
        let proteins: HashMap<&str, &[u8]> = gene
            .isoforms
            .iter()
            .map(|i| (i.id.as_str(), i.protein_sequence.as_bytes()))
            .collect();
        let shown: Vec<&[u8]> = gene
            .isoform_identity
            .isoforms
            .iter()
            .map(|id| proteins[id.as_str()])
            .collect();
        // The big genes take a while unoptimised; `--release` covers them.
        if cfg!(debug_assertions) && shown.iter().map(|s| s.len()).sum::<usize>() > 4000 {
            continue;
        }
        assert_eq!(
            identity_triangle_permille(&shown),
            gene.isoform_identity.permille,
            "{}: stored identities differ from the aligner; rerun `pnpm corpus:build --force`",
            gene.symbol
        );
        checked += 1;
    }
    assert!(checked >= 10, "only {checked} genes checked");
}
