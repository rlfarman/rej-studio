//! Parity and safety checks against real human coding sequences.
//!
//! `parity.rs` works from short synthetic sequences that are easy to reason
//! about. These are sequences the tool is actually asked to design — 600 to
//! 3,633 bases of TP53 and friends, with the repeats, GC swings and rare
//! codons that only turn up in real genes.
//!
//! Scoring and the split pipeline are deterministic, so they must match
//! Python exactly here too. The optimization itself is checked on outcomes: a
//! design is acceptable only if it keeps the protein, improves the score, and
//! can still be cut in two.

use rej_optimizer::contract::{ObjectivesReport, ProcessOptions};
use serde::Deserialize;

const REAL_GENES: &str = include_str!("fixtures/real_genes.json");
const EPSILON: f64 = 1e-9;

#[derive(Deserialize)]
struct PythonSplit {
    final_sequence: String,
    actual_split_point: usize,
    used_wggw_as_split: bool,
    seq5: String,
    seq3: String,
}

#[derive(Deserialize)]
struct SeededRun {
    optimized_sequence: String,
    seq5: String,
    seq3: String,
    split_point: usize,
    used_wggw_as_split: bool,
}

#[derive(Deserialize)]
struct GeneCase {
    id: String,
    sequence: String,
    options: ProcessOptions,
    seeded_options: ProcessOptions,
    seeded_run: SeededRun,
    report: ObjectivesReport,
    split: PythonSplit,
}

fn cases() -> Vec<GeneCase> {
    let cases: Vec<GeneCase> = serde_json::from_str(REAL_GENES).expect("real gene fixtures");
    assert!(!cases.is_empty(), "no real gene fixtures");
    cases
}

#[test]
fn scores_real_genes_exactly_as_python_does() {
    for case in cases() {
        let ours = rej_optimizer::score_only(&case.sequence, &case.options)
            .unwrap_or_else(|error| panic!("{}: scoring failed: {error}", case.id));

        assert_eq!(
            ours.entries.len(),
            case.report.entries.len(),
            "{}: objective count differs",
            case.id
        );
        for (ours, theirs) in ours.entries.iter().zip(case.report.entries.iter()) {
            assert_eq!(ours.objective, theirs.objective, "{}: label", case.id);
            assert!(
                (ours.score - theirs.score).abs() < EPSILON,
                "{}: {} scored {} but Python scored {}",
                case.id,
                theirs.objective,
                ours.score,
                theirs.score
            );
            assert_eq!(
                ours.locations, theirs.locations,
                "{}: {} locations differ",
                case.id, theirs.objective
            );
            assert_eq!(
                ours.message, theirs.message,
                "{}: {} message differs",
                case.id, theirs.objective
            );
        }
    }
}

#[test]
fn splits_real_genes_exactly_as_python_does() {
    for case in cases() {
        let split_point = case.options.split_point.unwrap_or(case.sequence.len() / 2);
        let ours = rej_optimizer::split_for_rej(
            &case.sequence,
            split_point,
            case.options.wggw_threshold,
            case.options.stim_5,
            case.options.stim_3,
        );
        assert_eq!(
            ours.final_sequence, case.split.final_sequence,
            "{}: final sequence differs",
            case.id
        );
        assert_eq!(
            ours.split_point, case.split.actual_split_point,
            "{}: split point differs",
            case.id
        );
        assert_eq!(
            ours.used_wggw_as_split, case.split.used_wggw_as_split,
            "{}: used_wggw_as_split differs",
            case.id
        );
        assert_eq!(ours.seq5, case.split.seq5, "{}: 5' fragment", case.id);
        assert_eq!(ours.seq3, case.split.seq3, "{}: 3' fragment", case.id);
    }
}

/// The strictest check in the suite.
///
/// The port reproduces NumPy's MT19937 stream, including which draws get
/// rejected, so a seeded run makes exactly the same sequence of random
/// choices Python makes. That means the designs must be identical base for
/// base — not merely equally good. If this fails while the scoring tests
/// still pass, the divergence is in the search, not in the objectives.
#[test]
fn a_seeded_run_designs_the_very_same_sequence_as_python() {
    for case in cases() {
        let ours =
            rej_optimizer::process(&case.sequence, &case.id, &case.seeded_options, |_, _| {})
                .unwrap_or_else(|error| panic!("{}: design failed: {error}", case.id));

        assert_eq!(
            ours.optimized_sequence, case.seeded_run.optimized_sequence,
            "{}: the design differs from Python's",
            case.id
        );
        assert_eq!(ours.seq5, case.seeded_run.seq5, "{}: 5' fragment", case.id);
        assert_eq!(ours.seq3, case.seeded_run.seq3, "{}: 3' fragment", case.id);
        assert_eq!(
            ours.split_point, case.seeded_run.split_point,
            "{}: split point",
            case.id
        );
        assert_eq!(
            ours.used_wggw_as_split, case.seeded_run.used_wggw_as_split,
            "{}: used_wggw_as_split",
            case.id
        );
    }
}

#[test]
fn designing_a_real_gene_improves_it_without_breaking_it() {
    for case in cases() {
        let before = rej_optimizer::score_only(&case.sequence, &case.options)
            .expect("scoring the input")
            .total_score
            .unwrap_or(0.0);

        let designed = rej_optimizer::process(&case.sequence, &case.id, &case.options, |_, _| {})
            .unwrap_or_else(|error| panic!("{}: design failed: {error}", case.id));

        // The protein is the whole point: it must survive untouched.
        assert_eq!(
            rej_optimizer::translate_dna(&designed.optimized_sequence),
            rej_optimizer::translate_dna(&case.sequence),
            "{}: the protein changed",
            case.id
        );
        assert_eq!(
            designed.optimized_sequence.len(),
            case.sequence.len(),
            "{}: length changed",
            case.id
        );

        let after = rej_optimizer::score_only(&designed.optimized_sequence, &case.options)
            .expect("scoring the design")
            .total_score
            .unwrap_or(0.0);
        assert!(
            after > before,
            "{}: design scored {after}, no better than the input's {before}",
            case.id
        );

        // And the two fragments must still reassemble into the design.
        let rejoined = format!(
            "{}{}",
            designed
                .seq5
                .replace("[REJ5]", "")
                .replace("[STIMINTRON]", ""),
            designed
                .seq3
                .replace("[REJ3]", "")
                .replace("[STIMINTRON]", "")
        );
        assert_eq!(
            rejoined, designed.optimized_sequence,
            "{}: fragments do not rejoin",
            case.id
        );
    }
}

#[test]
fn gc_content_lands_inside_the_enforced_band() {
    for case in cases() {
        let designed = rej_optimizer::process(&case.sequence, &case.id, &case.options, |_, _| {})
            .unwrap_or_else(|error| panic!("{}: design failed: {error}", case.id));

        let sequence = &designed.optimized_sequence;
        let gc = sequence
            .bytes()
            .filter(|base| *base == b'G' || *base == b'C')
            .count() as f64
            / sequence.len() as f64;
        assert!(
            (0.35..=0.60).contains(&gc),
            "{}: GC content {gc:.3} is outside the 35-60% the design enforces",
            case.id
        );
    }
}

#[test]
fn designs_are_reproducible_from_their_seed() {
    for case in cases() {
        let first = rej_optimizer::process(&case.sequence, &case.id, &case.options, |_, _| {})
            .expect("first design");
        let second = rej_optimizer::process(&case.sequence, &case.id, &case.options, |_, _| {})
            .expect("second design");
        assert_eq!(
            first.optimized_sequence, second.optimized_sequence,
            "{}: two runs of the same request disagreed",
            case.id
        );
        assert_eq!(first.seed, second.seed, "{}: seed differs", case.id);
    }
}
