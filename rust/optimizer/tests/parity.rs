//! Checks the Rust port against the Python optimizer it replaces.
//!
//! Fixtures in `tests/fixtures/` are produced by running the real DNAChisel
//! (see `scripts/gen-parity-fixtures.py`). Without these, the unit tests only
//! prove the port is self-consistent; these prove it agrees with the pipeline
//! that has been designing sequences to date.
//!
//! The three groups demand different things, because the pipeline is only
//! partly deterministic:
//!
//!   * **Scoring and the deterministic pipeline must match exactly.** Nothing
//!     random happens there, so any difference is a porting bug.
//!   * **Whole runs are compared on quality, not on bytes.** The search is
//!     random and Rust's draws diverge from NumPy's once the two implementations
//!     make different numbers of calls, so what is required is that Rust's
//!     design is as good as Python's by Python's own scoring, with the protein
//!     and every constraint intact.

use std::collections::BTreeMap;

use rej_optimizer::contract::{ObjectivesReport, ProcessOptions, ProcessResult};
use serde::Deserialize;

const SCORING: &str = include_str!("fixtures/scoring.json");
const PIPELINE: &str = include_str!("fixtures/pipeline.json");
const SEEDS: &str = include_str!("fixtures/seeds.json");
const RUNS: &str = include_str!("fixtures/runs.json");

/// Scores are floats; compare with a tolerance that is far tighter than any
/// real difference but immune to last-bit rounding.
const EPSILON: f64 = 1e-9;

#[derive(Deserialize)]
struct ScoringCase {
    name: String,
    sequence: String,
    options: ProcessOptions,
    report: ObjectivesReport,
    text_summary: String,
}

#[derive(Deserialize)]
struct SeedCase {
    name: String,
    sequence: String,
    options: ProcessOptions,
    seed: u32,
}

#[derive(Deserialize)]
struct PythonWggwSite {
    position: usize,
    motif: String,
    distance_from_split: usize,
    original_codons: (String, String),
    new_codons: (String, String),
}

#[derive(Deserialize)]
struct InsertedMotif {
    sequence: String,
    site: Option<PythonWggwSite>,
}

#[derive(Deserialize)]
struct SplitOutcome {
    final_sequence: String,
    actual_split_point: usize,
    used_wggw_as_split: bool,
    wggw_info: Option<BTreeMap<String, PythonWggwSite>>,
    seq5: String,
    seq3: String,
}

#[derive(Deserialize)]
struct PipelineCase {
    name: String,
    sequence: String,
    split_point: usize,
    wggw_threshold: usize,
    stim: bool,
    candidate_sites: Vec<usize>,
    inserted: InsertedMotif,
    split: SplitOutcome,
}

#[derive(Deserialize)]
struct RunResult {
    optimized_sequence: String,
    seq5: String,
    seq3: String,
    split_point: usize,
    used_wggw_as_split: bool,
    seed: u32,
}

#[derive(Deserialize)]
struct RunCase {
    name: String,
    sequence: String,
    options: ProcessOptions,
    result: RunResult,
    achieved_score: f64,
    starting_score: f64,
}

fn design(sequence: &str, options: &ProcessOptions) -> ProcessResult {
    rej_optimizer::process(sequence, "parity", options, |_, _| {})
        .unwrap_or_else(|error| panic!("design failed: {error}"))
}

/// Score a sequence with the same objectives, for comparing designs.
fn score(sequence: &str, options: &ProcessOptions) -> f64 {
    let scored = rej_optimizer::score_only(sequence, options)
        .unwrap_or_else(|error| panic!("scoring failed: {error}"));
    scored.total_score.unwrap_or(0.0)
}

#[test]
fn objective_scores_match_python_exactly() {
    let cases: Vec<ScoringCase> = serde_json::from_str(SCORING).expect("scoring fixtures");
    assert!(!cases.is_empty());

    for case in cases {
        let ours = rej_optimizer::score_only(&case.sequence, &case.options)
            .unwrap_or_else(|error| panic!("{}: scoring failed: {error}", case.name));

        assert_eq!(
            ours.entries.len(),
            case.report.entries.len(),
            "{}: objective count differs",
            case.name
        );

        for (ours, theirs) in ours.entries.iter().zip(case.report.entries.iter()) {
            assert_eq!(
                ours.objective, theirs.objective,
                "{}: objective label differs",
                case.name
            );
            assert!(
                (ours.score - theirs.score).abs() < EPSILON,
                "{}: {} scored {} but Python scored {}",
                case.name,
                theirs.objective,
                ours.score,
                theirs.score
            );
            assert_eq!(
                ours.passes, theirs.passes,
                "{}: {} pass/fail differs",
                case.name, theirs.objective
            );
            assert_eq!(
                ours.locations, theirs.locations,
                "{}: {} reported different locations",
                case.name, theirs.objective
            );
            assert_eq!(
                ours.message, theirs.message,
                "{}: {} message differs",
                case.name, theirs.objective
            );
        }

        let total_ours = ours.total_score.unwrap_or(0.0);
        let total_theirs = case.report.total_score.unwrap_or(0.0);
        assert!(
            (total_ours - total_theirs).abs() < EPSILON,
            "{}: total {total_ours} vs Python {total_theirs}",
            case.name
        );
    }
}

#[test]
fn the_text_summary_matches_python_exactly() {
    let cases: Vec<ScoringCase> = serde_json::from_str(SCORING).expect("scoring fixtures");
    for case in cases {
        let ours = rej_optimizer::text_summary(&case.sequence, &case.options)
            .unwrap_or_else(|error| panic!("{}: summary failed: {error}", case.name));
        assert_eq!(
            ours, case.text_summary,
            "{}: objectives_text_summary differs",
            case.name
        );
    }
}

#[test]
fn derived_seeds_match_python_exactly() {
    let cases: Vec<SeedCase> = serde_json::from_str(SEEDS).expect("seed fixtures");
    assert!(!cases.is_empty());

    for case in cases {
        let ours = rej_optimizer::derive_seed(&case.sequence, &case.options);
        assert_eq!(
            ours, case.seed,
            "{}: derived seed {ours} but Python derived {}",
            case.name, case.seed
        );
    }
}

#[test]
fn the_deterministic_pipeline_matches_python_exactly() {
    let cases: Vec<PipelineCase> = serde_json::from_str(PIPELINE).expect("pipeline fixtures");
    assert!(!cases.is_empty());

    for case in cases {
        assert_eq!(
            rej_optimizer::candidate_splice_sites(&case.sequence),
            case.candidate_sites,
            "{}: candidate WGGW sites differ",
            case.name
        );

        let (recoded, site) = rej_optimizer::insert_wggw_motif(&case.sequence, case.split_point);
        assert_eq!(
            recoded, case.inserted.sequence,
            "{}: recoded sequence differs",
            case.name
        );
        match (&site, &case.inserted.site) {
            (None, None) => {}
            (Some(ours), Some(theirs)) => {
                assert_eq!(
                    ours.position, theirs.position,
                    "{}: motif position",
                    case.name
                );
                assert_eq!(ours.motif, theirs.motif, "{}: motif", case.name);
                assert_eq!(
                    ours.distance_from_split, theirs.distance_from_split,
                    "{}: distance from split",
                    case.name
                );
                assert_eq!(
                    ours.original_codons, theirs.original_codons,
                    "{}: original codons",
                    case.name
                );
                assert_eq!(
                    ours.new_codons, theirs.new_codons,
                    "{}: new codons",
                    case.name
                );
            }
            (ours, theirs) => panic!(
                "{}: one side found a site and the other did not ({:?} vs {:?})",
                case.name,
                ours.is_some(),
                theirs.is_some()
            ),
        }

        let split = rej_optimizer::split_for_rej(
            &case.sequence,
            case.split_point,
            case.wggw_threshold,
            case.stim,
            case.stim,
        );
        assert_eq!(
            split.final_sequence, case.split.final_sequence,
            "{}: final sequence differs",
            case.name
        );
        assert_eq!(
            split.split_point, case.split.actual_split_point,
            "{}: split point differs",
            case.name
        );
        assert_eq!(
            split.used_wggw_as_split, case.split.used_wggw_as_split,
            "{}: used_wggw_as_split differs",
            case.name
        );
        assert_eq!(
            split.seq5, case.split.seq5,
            "{}: 5' fragment differs",
            case.name
        );
        assert_eq!(
            split.seq3, case.split.seq3,
            "{}: 3' fragment differs",
            case.name
        );

        let theirs = case.split.wggw_info.unwrap_or_default();
        assert_eq!(
            split.wggw.len(),
            theirs.len(),
            "{}: different number of WGGW sites recorded",
            case.name
        );
        for (label, ours) in &split.wggw {
            let theirs = theirs
                .get(label)
                .unwrap_or_else(|| panic!("{}: Python has no {label} site", case.name));
            assert_eq!(
                ours.position, theirs.position,
                "{}: {label} position",
                case.name
            );
            assert_eq!(ours.motif, theirs.motif, "{}: {label} motif", case.name);
        }
    }
}

/// Every fixture here carries an explicit seed, and the port reproduces
/// NumPy's random stream, so the designs must be identical — not merely
/// comparable. The score and improvement checks that follow would still catch
/// a divergence that somehow produced an equally good but different sequence.
#[test]
fn whole_seeded_runs_reproduce_pythons_design_exactly() {
    let cases: Vec<RunCase> = serde_json::from_str(RUNS).expect("run fixtures");
    assert!(!cases.is_empty());

    for case in cases {
        let ours = design(&case.sequence, &case.options);

        assert_eq!(ours.seed, Some(case.result.seed), "{}: seed", case.name);
        assert_eq!(
            ours.optimized_sequence, case.result.optimized_sequence,
            "{}: the design differs from Python's",
            case.name
        );
        assert_eq!(ours.seq5, case.result.seq5, "{}: 5' fragment", case.name);
        assert_eq!(ours.seq3, case.result.seq3, "{}: 3' fragment", case.name);
        assert_eq!(
            ours.split_point, case.result.split_point,
            "{}: split point",
            case.name
        );
        assert_eq!(
            ours.used_wggw_as_split, case.result.used_wggw_as_split,
            "{}: used_wggw_as_split",
            case.name
        );
    }
}

#[test]
fn whole_runs_design_a_sequence_at_least_as_good_as_pythons() {
    let cases: Vec<RunCase> = serde_json::from_str(RUNS).expect("run fixtures");
    for case in cases {
        let ours = design(&case.sequence, &case.options);

        // Scored by the same objectives, Rust's design must be no worse.
        let ours_score = score(&ours.optimized_sequence, &case.options);
        assert!(
            ours_score >= case.achieved_score - EPSILON,
            "{}: Rust scored {ours_score} but Python reached {} (started at {})",
            case.name,
            case.achieved_score,
            case.starting_score
        );

        // And it must still be a real improvement over the input.
        assert!(
            ours_score >= case.starting_score - EPSILON,
            "{}: Rust scored {ours_score}, worse than the unoptimized {}",
            case.name,
            case.starting_score
        );

        // The design must remain usable: same length, splittable, rejoinable.
        assert_eq!(
            ours.optimized_sequence.len(),
            case.sequence.len(),
            "{}: length changed",
            case.name
        );
        assert!(!ours.seq5.is_empty(), "{}: empty 5' fragment", case.name);
        assert!(!ours.seq3.is_empty(), "{}: empty 3' fragment", case.name);

        let rejoined = format!(
            "{}{}",
            ours.seq5.replace("[REJ5]", "").replace("[STIMINTRON]", ""),
            ours.seq3.replace("[REJ3]", "").replace("[STIMINTRON]", "")
        );
        assert_eq!(
            rejoined, ours.optimized_sequence,
            "{}: fragments do not rejoin into the design",
            case.name
        );
    }
}

#[test]
fn whole_runs_preserve_the_protein() {
    let cases: Vec<RunCase> = serde_json::from_str(RUNS).expect("run fixtures");
    for case in cases {
        let ours = design(&case.sequence, &case.options);
        assert_eq!(
            rej_optimizer::translate_dna(&ours.optimized_sequence),
            rej_optimizer::translate_dna(&case.sequence),
            "{}: the protein changed",
            case.name
        );
    }
}
