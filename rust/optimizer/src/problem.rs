//! The constraint solver and objective optimizer.
//!
//! Ported from `dnachisel.DnaOptimizationProblem`. The shape is:
//!
//!   1. `resolve_constraints` makes the sequence legal — for this design that
//!      means pulling GC content inside its bounds. Translation and frozen
//!      regions need no work, being guaranteed by the mutation space.
//!   2. `optimize` then improves each objective in turn. For each one it finds
//!      the spots scoring below par and reworks them one at a time, searching
//!      a small window exhaustively when it is small enough and sampling it
//!      randomly when it is not.
//!
//! Only ever accepting a strictly better score is what keeps this safe: a
//! candidate that breaks a constraint is discarded, so the protein and any
//! frozen region survive the whole search.

use crate::location::Location;
use crate::mutation_space::MutationSpace;
use crate::rng::NumpyRng;
use crate::spec::{Evaluation, Spec, format_score};

/// Search limits, matching DNAChisel's class attributes.
const RANDOMIZATION_THRESHOLD: f64 = 10_000.0;
const MAX_RANDOM_ITERS: usize = 1_000;
const MUTATIONS_PER_ITERATION: usize = 2;
const STAGNATION_TOLERANCE: usize = 100;
/// Widen a stubborn window by these amounts, in order, before giving up.
const LOCAL_EXTENSIONS: [usize; 2] = [0, 5];

#[derive(Debug)]
pub enum SolveError {
    /// A constraint could not be satisfied anywhere in the search.
    NoSolution(String),
}

impl std::fmt::Display for SolveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SolveError::NoSolution(message) => write!(f, "{message}"),
        }
    }
}

pub struct Problem {
    pub sequence: String,
    pub constraints: Vec<Spec>,
    pub objectives: Vec<Spec>,
    pub space: MutationSpace,
}

impl Problem {
    pub fn new(sequence: String, constraints: Vec<Spec>, objectives: Vec<Spec>) -> Self {
        let space = MutationSpace::from_constraints(&sequence, &constraints);
        Self {
            sequence,
            constraints,
            objectives,
            space,
        }
    }

    /// Constraints that actually need checking: those the mutation space does
    /// not already guarantee.
    fn checkable(&self) -> impl Iterator<Item = &Spec> {
        self.constraints
            .iter()
            .filter(|constraint| !constraint.enforced_by_nucleotide_restrictions())
    }

    fn all_constraints_pass(&self, sequence: &str) -> bool {
        self.checkable()
            .all(|constraint| constraint.evaluate(sequence).passes())
    }

    pub fn objective_evaluations(&self) -> Vec<(&Spec, Evaluation)> {
        self.objectives
            .iter()
            .map(|objective| (objective, objective.evaluate(&self.sequence)))
            .collect()
    }

    /// Total objective score, each weighted by its boost.
    fn objective_score(&self, sequence: &str) -> f64 {
        self.objectives
            .iter()
            .map(|objective| objective.boost() * objective.evaluate(sequence).score)
            .sum()
    }

    /// DNAChisel's `objectives_text_summary()`, reproduced because the result
    /// contract carries it as a human-readable before/after report.
    pub fn objectives_text_summary(&self) -> String {
        let evaluations = self.objective_evaluations();
        let header = if evaluations.is_empty() {
            "No specifications".to_string()
        } else {
            let total: f64 = evaluations
                .iter()
                .map(|(spec, evaluation)| spec.boost() * evaluation.score)
                .sum();
            format!("TOTAL OBJECTIVES SCORE: {}", format_score(total))
        };

        let mut lines = vec![format!("===> {header}")];
        for (spec, evaluation) in &evaluations {
            let optimal = if evaluation.score == spec.best_possible_score() {
                "✔"
            } else {
                " "
            };
            lines.push(format!(
                "{optimal}{} ┍ {} \n{}",
                format_score(evaluation.score),
                spec.label(),
                wrap_message(&evaluation.message),
            ));
        }
        format!("{}\n\n", lines.join("\n"))
    }

    /// Step 1: make the sequence satisfy every constraint.
    pub fn resolve_constraints(&mut self, rng: &mut NumpyRng) -> Result<(), SolveError> {
        let mut constraints: Vec<Spec> = self.checkable().cloned().collect();
        if constraints.is_empty() {
            return Ok(());
        }
        // Highest priority first, as DNAChisel sorts them.
        constraints.sort_by_key(|constraint| -constraint.priority());

        for constraint in &constraints {
            self.resolve_constraint(constraint, rng)?;
        }

        // A late fix can undo an earlier one, so check the whole set again.
        for constraint in self.checkable() {
            let evaluation = constraint.evaluate(&self.sequence);
            if !evaluation.passes() {
                return Err(SolveError::NoSolution(format!(
                    "Could not satisfy {} ({})",
                    constraint.label(),
                    evaluation.message
                )));
            }
        }
        Ok(())
    }

    fn resolve_constraint(
        &mut self,
        constraint: &Spec,
        rng: &mut NumpyRng,
    ) -> Result<(), SolveError> {
        let evaluation = constraint.evaluate(&self.sequence);
        if evaluation.passes() {
            return Ok(());
        }
        let mut locations = evaluation.locations.clone();
        locations.sort();

        for (position, location) in locations.iter().enumerate() {
            let mut resolved = false;
            let mut last_error: Option<SolveError> = None;

            for (attempt, extension) in LOCAL_EXTENSIONS.iter().enumerate() {
                let widened = location.extended(*extension, self.sequence.len(), true);
                let space = self.space.localized(&widened);
                let Some((span_start, span_end)) = space.choices_span() else {
                    // Nothing here can move; a wider window may still help.
                    last_error = Some(SolveError::NoSolution(format!(
                        "Constraint breach in region that cannot be mutated: {widened}"
                    )));
                    continue;
                };
                let window = Location::new(span_start, span_end);

                // When the next breach overlaps this window, only widen left so
                // the two repairs do not undo each other.
                let with_righthand = !locations
                    .get(position + 1)
                    .is_some_and(|next| next.overlap(&window).is_some());

                let Some(local_constraint) =
                    constraint.localized(&window, &self.sequence, with_righthand)
                else {
                    resolved = true;
                    break;
                };
                if local_constraint.evaluate(&self.sequence).passes() {
                    // Already fixed as a side effect of an earlier repair.
                    resolved = true;
                    break;
                }

                let others: Vec<Spec> = self
                    .checkable()
                    .filter(|other| other.label() != constraint.label())
                    .filter_map(|other| other.localized(&window, &self.sequence, true))
                    .filter(|other| other.evaluate(&self.sequence).passes())
                    .collect();

                match self.search_for_constraint(&local_constraint, &others, &space, rng, attempt) {
                    Ok(sequence) => {
                        self.sequence = sequence;
                        resolved = true;
                        break;
                    }
                    Err(error) => last_error = Some(error),
                }
            }

            if !resolved && let Some(error) = last_error {
                return Err(error);
            }
        }
        Ok(())
    }

    /// Search a window for a sequence satisfying `focus` without breaking
    /// `others`: exhaustively when the window is small, randomly otherwise.
    fn search_for_constraint(
        &self,
        focus: &Spec,
        others: &[Spec],
        space: &MutationSpace,
        rng: &mut NumpyRng,
        attempt: usize,
    ) -> Result<String, SolveError> {
        let accepts = |candidate: &str| {
            focus.evaluate(candidate).passes()
                && others
                    .iter()
                    .all(|other| other.evaluate(candidate).passes())
        };

        if space.size() < RANDOMIZATION_THRESHOLD {
            for candidate in space.all_variants(&self.sequence) {
                if accepts(&candidate) {
                    return Ok(candidate);
                }
            }
            return Err(SolveError::NoSolution(format!(
                "Exhaustive search failed to satisfy {} (attempt {attempt})",
                focus.label()
            )));
        }

        // Hill-climb on the focus constraint's score, keeping only moves that
        // improve it and leave the others passing.
        let mut best = self.sequence.clone();
        let mut best_score = focus.evaluate(&best).score;
        for _ in 0..MAX_RANDOM_ITERS {
            let candidate = space.apply_random_mutations(MUTATIONS_PER_ITERATION, &best, rng);
            let evaluation = focus.evaluate(&candidate);
            if evaluation.score > best_score
                && others
                    .iter()
                    .all(|other| other.evaluate(&candidate).passes())
            {
                best_score = evaluation.score;
                best = candidate;
                if evaluation.passes() {
                    return Ok(best);
                }
            }
        }
        Err(SolveError::NoSolution(format!(
            "Random search did not satisfy {} in {MAX_RANDOM_ITERS} attempts",
            focus.label()
        )))
    }

    /// Step 2: improve each objective in turn.
    ///
    /// `on_progress` receives `(fraction done, objective index, objective
    /// count)`. It reports position rather than a label because the wording
    /// shown to a user belongs with the rest of the app's copy, not in the
    /// solver.
    pub fn optimize(&mut self, rng: &mut NumpyRng, mut on_progress: impl FnMut(f64, usize, usize)) {
        let objectives: Vec<Spec> = self
            .objectives
            .iter()
            .filter(|objective| objective.boost() != 0.0)
            .cloned()
            .collect();
        let total = objectives.len();

        for (index, objective) in objectives.iter().enumerate() {
            on_progress(index as f64 / total.max(1) as f64, index, total);
            self.optimize_objective(objective, rng);
        }
    }

    fn optimize_objective(&mut self, objective: &Spec, rng: &mut NumpyRng) {
        let evaluation = objective.evaluate(&self.sequence);
        if evaluation.score == objective.best_possible_score() {
            return;
        }

        for location in evaluation.locations {
            let space = self.space.localized(&location);
            if space.size() == 0.0 {
                continue;
            }
            let Some((span_start, span_end)) = space.choices_span() else {
                continue;
            };
            let window = Location::new(span_start, span_end);

            // Local problems carry every spec narrowed to this window, so the
            // score being maximized is still the global one, just cheaper.
            let local_constraints: Vec<Spec> = self
                .constraints
                .iter()
                .filter_map(|constraint| constraint.localized(&window, &self.sequence, true))
                .collect();
            let local_objectives: Vec<Spec> = self
                .objectives
                .iter()
                .filter(|other| other.boost() != 0.0)
                .filter_map(|other| other.localized(&window, &self.sequence, true))
                .collect();

            let local = Problem {
                sequence: self.sequence.clone(),
                constraints: local_constraints,
                objectives: local_objectives,
                space,
            };
            self.sequence = local.maximize(rng);
        }
    }

    /// Best sequence this (local) problem can reach without breaking a
    /// constraint. Exhaustive for a small space, hill-climbing otherwise.
    fn maximize(&self, rng: &mut NumpyRng) -> String {
        if !self.all_constraints_pass(&self.sequence) {
            // The window is already illegal; leave it to the constraint solver.
            return self.sequence.clone();
        }
        let mut best = self.sequence.clone();
        let mut best_score = self.objective_score(&best);
        let best_possible: f64 = self
            .objectives
            .iter()
            .map(|objective| objective.boost() * objective.best_possible_score())
            .sum();

        if self.space.size() < RANDOMIZATION_THRESHOLD {
            for candidate in self.space.all_variants(&self.sequence) {
                if !self.all_constraints_pass(&candidate) {
                    continue;
                }
                let score = self.objective_score(&candidate);
                if score > best_score {
                    best_score = score;
                    best = candidate;
                    if best_score >= best_possible {
                        break;
                    }
                }
            }
            return best;
        }

        let mut stagnating = 0usize;
        for _ in 0..MAX_RANDOM_ITERS {
            if best_score >= best_possible || stagnating > STAGNATION_TOLERANCE {
                break;
            }
            let candidate = self
                .space
                .apply_random_mutations(MUTATIONS_PER_ITERATION, &best, rng);
            if self.all_constraints_pass(&candidate) {
                let score = self.objective_score(&candidate);
                if score > best_score {
                    best_score = score;
                    best = candidate;
                    stagnating = 0;
                }
            }
            stagnating += 1;
        }
        best
    }
}

/// DNAChisel's message truncation: anything over 500 characters keeps its
/// first and last 250 with an ellipsis between. Long location lists hit this,
/// so skipping it would produce a different summary.
const MAX_MESSAGE_LENGTH: usize = 500;

fn truncate_message(message: &str) -> String {
    if message.chars().count() <= MAX_MESSAGE_LENGTH {
        return message.to_string();
    }
    let half = MAX_MESSAGE_LENGTH / 2;
    let characters: Vec<char> = message.chars().collect();
    let head: String = characters[..half].iter().collect();
    let tail: String = characters[characters.len() - half..].iter().collect();
    format!("{head} ... {tail}")
}

/// Split a word the way Python's `textwrap` does, after a hyphen that sits
/// between letters.
///
/// This is why "non-unique" can wrap as "non-" / "unique" while a location
/// like "10-18" never splits: Python requires letters on both sides, and
/// digits do not qualify.
fn split_on_hyphens(word: &str) -> Vec<String> {
    let characters: Vec<char> = word.chars().collect();
    let is_letter = |index: usize| {
        characters
            .get(index)
            .is_some_and(|c| c.is_alphabetic() || *c == '_')
    };

    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();
    for (index, character) in characters.iter().enumerate() {
        current.push(*character);
        if *character != '-' || index + 1 == characters.len() {
            continue;
        }
        // Two letters before the hyphen, and a letter (optionally after one
        // more hyphen) after it.
        let letters_before = index >= 2 && is_letter(index - 1) && is_letter(index - 2);
        let letters_after = is_letter(index + 1)
            && (is_letter(index + 2)
                || (characters.get(index + 2) == Some(&'-') && is_letter(index + 3)));
        if letters_before && letters_after {
            chunks.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

/// Python's `textwrap.wrap` at width 80 with DNAChisel's objective indent.
fn wrap_message(message: &str) -> String {
    const WIDTH: usize = 80;
    let indent = format!("{}│ ", " ".repeat(11));
    let indent_width = indent.chars().count();
    let message = truncate_message(message);

    // Each chunk knows whether a space precedes it: hyphen-split pieces join
    // straight on, whitespace-separated words do not.
    let mut chunks: Vec<(String, bool)> = Vec::new();
    for word in message.split_whitespace() {
        for (position, piece) in split_on_hyphens(word).into_iter().enumerate() {
            chunks.push((piece, position == 0));
        }
    }

    let mut lines: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut current_width = 0usize;

    for (chunk, needs_space) in chunks {
        let chunk_width = chunk.chars().count();
        let separator = usize::from(needs_space && !current.is_empty());
        if !current.is_empty() && current_width + separator + chunk_width + indent_width > WIDTH {
            lines.push(format!("{indent}{current}"));
            current.clear();
            current_width = 0;
        } else if separator == 1 {
            current.push(' ');
            current_width += 1;
        }
        current.push_str(&chunk);
        current_width += chunk_width;
    }
    if !current.is_empty() || lines.is_empty() {
        lines.push(format!("{indent}{current}"));
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::biotools::translate;
    use crate::pattern::Pattern;
    use crate::spec::Species;

    const CDS: &str =
        "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA";

    fn problem_for(sequence: &str) -> Problem {
        let whole = Location::with_strand(0, sequence.len(), 1);
        Problem::new(
            sequence.to_string(),
            vec![
                Spec::EnforceTranslation {
                    location: whole,
                    translation: translate(sequence),
                },
                Spec::EnforceGcContent {
                    location: whole,
                    mini: 0.35,
                    maxi: 0.60,
                    boost: 1.0,
                },
            ],
            vec![
                Spec::AvoidPattern {
                    pattern: Pattern::parse("CG").unwrap(),
                    location: whole,
                    boost: 1.0,
                },
                Spec::MaximizeCai {
                    location: whole,
                    species: Species::Human,
                    boost: 1.0,
                },
            ],
        )
    }

    #[test]
    fn optimization_preserves_the_protein() {
        let mut problem = problem_for(CDS);
        let mut rng = NumpyRng::seed(1234);
        problem.resolve_constraints(&mut rng).unwrap();
        problem.optimize(&mut rng, |_, _, _| {});
        assert_eq!(translate(&problem.sequence), translate(CDS));
        assert_eq!(problem.sequence.len(), CDS.len());
    }

    #[test]
    fn optimization_does_not_make_the_score_worse() {
        let before = problem_for(CDS);
        let baseline = before.objective_score(CDS);

        let mut problem = problem_for(CDS);
        let mut rng = NumpyRng::seed(1234);
        problem.resolve_constraints(&mut rng).unwrap();
        problem.optimize(&mut rng, |_, _, _| {});

        let after = problem.objective_score(&problem.sequence);
        assert!(after >= baseline, "score regressed: {baseline} -> {after}");
    }

    #[test]
    fn constraints_hold_after_optimizing() {
        let mut problem = problem_for(CDS);
        let mut rng = NumpyRng::seed(99);
        problem.resolve_constraints(&mut rng).unwrap();
        problem.optimize(&mut rng, |_, _, _| {});
        for constraint in problem.checkable() {
            let evaluation = constraint.evaluate(&problem.sequence);
            assert!(
                evaluation.passes(),
                "{} failed: {}",
                constraint.label(),
                evaluation.message
            );
        }
    }

    #[test]
    fn a_frozen_region_survives_optimization() {
        let whole = Location::with_strand(0, CDS.len(), 1);
        let locked = Location::with_strand(9, 15, 1);
        let mut problem = Problem::new(
            CDS.to_string(),
            vec![
                Spec::EnforceTranslation {
                    location: whole,
                    translation: translate(CDS),
                },
                Spec::AvoidChanges {
                    location: locked,
                    target: locked.extract(CDS).to_string(),
                },
            ],
            vec![Spec::MaximizeCai {
                location: whole,
                species: Species::Human,
                boost: 1.0,
            }],
        );
        let mut rng = NumpyRng::seed(5);
        problem.resolve_constraints(&mut rng).unwrap();
        problem.optimize(&mut rng, |_, _, _| {});
        assert_eq!(&problem.sequence[9..15], &CDS[9..15]);
    }

    #[test]
    fn optimization_is_reproducible_for_a_seed() {
        let run = |seed: u32| {
            let mut problem = problem_for(CDS);
            let mut rng = NumpyRng::seed(seed);
            problem.resolve_constraints(&mut rng).unwrap();
            problem.optimize(&mut rng, |_, _, _| {});
            problem.sequence
        };
        assert_eq!(run(2026), run(2026));
    }

    #[test]
    fn progress_is_reported_in_order() {
        let mut problem = problem_for(CDS);
        let mut rng = NumpyRng::seed(1);
        problem.resolve_constraints(&mut rng).unwrap();
        let mut seen: Vec<f64> = Vec::new();
        problem.optimize(&mut rng, |fraction, _, _| seen.push(fraction));
        assert_eq!(seen.len(), problem.objectives.len());
        assert!(seen.windows(2).all(|pair| pair[0] <= pair[1]));
    }

    #[test]
    fn wrapping_indents_every_line() {
        let wrapped = wrap_message(&"word ".repeat(40));
        assert!(wrapped.lines().count() > 1);
        assert!(
            wrapped
                .lines()
                .all(|line| line.starts_with("           │ "))
        );
        assert!(wrapped.lines().all(|line| line.chars().count() <= 80));
    }
}
