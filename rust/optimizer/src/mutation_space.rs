//! The set of sequences the solver is allowed to reach.
//!
//! Ported from `dnachisel.MutationSpace`. The sequence is carved into
//! segments, each with a list of interchangeable variants: for a coding
//! sequence that means one segment per codon holding its synonymous codons,
//! with any frozen region collapsed to a single variant. Every candidate the
//! solver tries is built from these segments, so the protein cannot change no
//! matter what the search does.

use crate::location::Location;
use crate::rng::NumpyRng;
use crate::spec::Spec;

/// One stretch of sequence and the variants allowed there.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MutationChoice {
    pub start: usize,
    pub end: usize,
    /// Sorted and deduplicated; the order decides which variant a given random
    /// draw selects, so it has to match Python's `sorted(variants)`.
    pub variants: Vec<String>,
}

impl MutationChoice {
    pub fn new(start: usize, end: usize, variants: Vec<String>) -> Self {
        let mut variants = variants;
        variants.sort();
        variants.dedup();
        Self {
            start,
            end,
            variants,
        }
    }

    /// Trim the fixed prefix and suffix shared by every variant.
    ///
    /// DNAChisel does this so a choice spans only what actually varies, which
    /// keeps localized windows tight. A single-variant choice is returned
    /// unchanged — it is already fixed.
    fn extract_varying_region(&self) -> Vec<MutationChoice> {
        if self.variants.len() <= 1 {
            return vec![self.clone()];
        }
        let reference = self.variants[0].as_bytes();
        let mut first_difference: Option<usize> = None;
        let mut last_difference = reference.len();

        for (index, base) in reference.iter().enumerate() {
            let differs = self.variants[1..]
                .iter()
                .any(|variant| variant.as_bytes()[index] != *base);
            if differs {
                first_difference.get_or_insert(index);
                last_difference = index + 1;
            }
        }

        let Some(first) = first_difference else {
            return vec![self.clone()];
        };

        let mut parts = Vec::new();
        if first > 0 {
            parts.push(MutationChoice::new(
                self.start,
                self.start + first,
                vec![self.variants[0][..first].to_string()],
            ));
        }
        parts.push(MutationChoice::new(
            self.start + first,
            self.start + last_difference,
            self.variants
                .iter()
                .map(|variant| variant[first..last_difference].to_string())
                .collect(),
        ));
        if last_difference < reference.len() {
            parts.push(MutationChoice::new(
                self.start + last_difference,
                self.end,
                vec![self.variants[0][last_difference..].to_string()],
            ));
        }
        parts
    }

    /// Variants other than what is currently there, sorted.
    ///
    /// DNAChisel sorts before drawing specifically so runs are reproducible,
    /// and the Rust port depends on that same order.
    fn alternatives(&self, sequence: &str) -> Vec<&str> {
        let current = &sequence[self.start..self.end];
        self.variants
            .iter()
            .map(String::as_str)
            .filter(|variant| *variant != current)
            .collect()
    }
}

#[derive(Debug, Clone)]
pub struct MutationSpace {
    /// Position -> the choice governing it, or `None` where nothing applies.
    choices_by_index: Vec<Option<usize>>,
    choices: Vec<MutationChoice>,
    /// Indices into `choices` with more than one variant: the only places a
    /// mutation can actually happen.
    multichoices: Vec<usize>,
}

impl MutationSpace {
    /// Build the space from a sequence and its constraints.
    pub fn from_constraints(sequence: &str, constraints: &[Spec]) -> Self {
        let length = sequence.len();
        // Start with every position free, as DNAChisel does, then let the
        // constraints narrow it.
        let mut choices: Vec<MutationChoice> = (0..length)
            .map(|index| {
                MutationChoice::new(
                    index,
                    index + 1,
                    ["A", "C", "G", "T"].iter().map(|b| b.to_string()).collect(),
                )
            })
            .collect();
        let mut is_free: Vec<bool> = vec![true; length];

        // Shortest restrictions first, so a wide frozen region (AvoidChanges)
        // is applied after the per-codon ones and wins.
        let mut restrictions: Vec<((usize, usize), Vec<String>)> = constraints
            .iter()
            .flat_map(|constraint| constraint.restrict_nucleotides(sequence))
            .collect();
        restrictions.sort_by_key(|((start, end), _)| (end - start, *start));

        for ((start, end), variants) in restrictions {
            let choice = MutationChoice::new(start, end, variants);
            let covers_only_free =
                (start..end).all(|index| is_free.get(index).copied().unwrap_or(false));
            let merged = if covers_only_free {
                choice
            } else {
                // Overlapping an existing restriction: keep only the variants
                // that agree with what is already pinned there.
                merge_with_existing(&choice, &choices, sequence)
            };
            for part in merged.extract_varying_region() {
                for index in part.start..part.end.min(length) {
                    choices[index] = part.clone();
                    is_free[index] = false;
                }
            }
        }

        Self::from_choices_by_index(&choices, length)
    }

    fn from_choices_by_index(per_index: &[MutationChoice], length: usize) -> Self {
        let mut choices: Vec<MutationChoice> = Vec::new();
        let mut choices_by_index: Vec<Option<usize>> = vec![None; length];

        for index in 0..length {
            let choice = &per_index[index];
            let same_as_previous = choices.last().is_some_and(|previous| previous == choice);
            if !same_as_previous {
                choices.push(choice.clone());
            }
            choices_by_index[index] = Some(choices.len() - 1);
        }

        let multichoices = choices
            .iter()
            .enumerate()
            .filter(|(_, choice)| choice.variants.len() > 1)
            .map(|(index, _)| index)
            .collect();

        Self {
            choices_by_index,
            choices,
            multichoices,
        }
    }

    /// Restrict to the choices overlapping a window, for a local search.
    pub fn localized(&self, window: &Location) -> MutationSpace {
        let mut kept: Vec<usize> = Vec::new();
        let end = window.end.min(self.choices_by_index.len());
        for slot in &self.choices_by_index[window.start.min(end)..end] {
            if let Some(choice) = slot
                && !kept.contains(choice)
            {
                kept.push(*choice);
            }
        }
        let choices: Vec<MutationChoice> = kept
            .iter()
            .map(|&index| self.choices[index].clone())
            .collect();

        let mut choices_by_index: Vec<Option<usize>> = vec![None; self.choices_by_index.len()];
        for (position, choice) in choices.iter().enumerate() {
            for index in choice.start..choice.end.min(choices_by_index.len()) {
                choices_by_index[index] = Some(position);
            }
        }
        let multichoices = choices
            .iter()
            .enumerate()
            .filter(|(_, choice)| choice.variants.len() > 1)
            .map(|(index, _)| index)
            .collect();

        MutationSpace {
            choices_by_index,
            choices,
            multichoices,
        }
    }

    /// How many distinct sequences the space can produce, capped like
    /// DNAChisel's `exp(min(100, sum(log(sizes))))` to avoid overflow. The
    /// solver only compares it against a threshold.
    pub fn size(&self) -> f64 {
        if self.multichoices.is_empty() {
            return 0.0;
        }
        let log_total: f64 = self
            .multichoices
            .iter()
            .map(|&index| (self.choices[index].variants.len() as f64).ln())
            .sum();
        log_total.min(100.0).exp()
    }

    /// The span from the first to the last mutable choice.
    pub fn choices_span(&self) -> Option<(usize, usize)> {
        let first = self.multichoices.first()?;
        let last = self.multichoices.last()?;
        Some((self.choices[*first].start, self.choices[*last].end))
    }

    /// Apply `count` random mutations, drawing exactly as NumPy does.
    pub fn apply_random_mutations(
        &self,
        count: usize,
        sequence: &str,
        rng: &mut NumpyRng,
    ) -> String {
        let count = count.min(self.multichoices.len());
        if count == 0 {
            return sequence.to_string();
        }
        let mut bytes = sequence.as_bytes().to_vec();

        // One mutation takes a plain randint; several take a without-
        // replacement draw. DNAChisel splits these cases, and they consume
        // different numbers of random words, so the split is preserved.
        let picked: Vec<usize> = if count == 1 {
            vec![rng.randint(self.multichoices.len())]
        } else {
            rng.choice_without_replacement(self.multichoices.len(), count)
        };

        for slot in picked {
            let choice = &self.choices[self.multichoices[slot]];
            let alternatives = choice.alternatives(sequence);
            if alternatives.is_empty() {
                continue;
            }
            let variant = alternatives[rng.randint(alternatives.len())];
            bytes[choice.start..choice.end].copy_from_slice(variant.as_bytes());
        }
        String::from_utf8(bytes).expect("variants are ASCII")
    }

    /// Every sequence in the space, for an exhaustive search.
    ///
    /// Variants are visited nearest-first: DNAChisel orders each choice by
    /// distance from the current subsequence so the search favours small
    /// edits, and the first acceptable candidate is the one kept.
    pub fn all_variants(&self, sequence: &str) -> Vec<String> {
        let Some((span_start, span_end)) = self.choices_span() else {
            return vec![sequence.to_string()];
        };

        let slots: Vec<(usize, usize, Vec<String>)> = self
            .multichoices
            .iter()
            .map(|&index| {
                let choice = &self.choices[index];
                let current = &sequence[choice.start..choice.end];
                let current_rank = choice
                    .variants
                    .iter()
                    .position(|variant| variant == current)
                    .unwrap_or(0);
                let mut ordered: Vec<(usize, String)> = choice
                    .variants
                    .iter()
                    .enumerate()
                    .map(|(rank, variant)| (rank.abs_diff(current_rank), variant.clone()))
                    .collect();
                ordered.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
                (
                    choice.start,
                    choice.end,
                    ordered.into_iter().map(|(_, variant)| variant).collect(),
                )
            })
            .collect();

        let mut results = Vec::new();
        let mut buffer = sequence.as_bytes().to_vec();
        let original = sequence.as_bytes()[span_start..span_end].to_vec();
        cartesian(&slots, 0, &mut buffer, &original, span_start, &mut results);
        results
    }
}

/// Depth-first walk over every combination of slot variants.
fn cartesian(
    slots: &[(usize, usize, Vec<String>)],
    depth: usize,
    buffer: &mut [u8],
    original: &[u8],
    span_start: usize,
    out: &mut Vec<String>,
) {
    if depth == slots.len() {
        out.push(String::from_utf8(buffer.to_vec()).expect("variants are ASCII"));
        return;
    }
    let (start, end, variants) = &slots[depth];
    for variant in variants {
        buffer[*start..*end].copy_from_slice(variant.as_bytes());
        cartesian(slots, depth + 1, buffer, original, span_start, out);
    }
    // Restore this slot before unwinding so siblings start from the original.
    let restore_from = start - span_start;
    buffer[*start..*end].copy_from_slice(&original[restore_from..restore_from + (end - start)]);
}

/// Keep only the variants of `choice` that agree with the restrictions already
/// recorded over the same span.
fn merge_with_existing(
    choice: &MutationChoice,
    existing: &[MutationChoice],
    sequence: &str,
) -> MutationChoice {
    let compatible: Vec<String> = choice
        .variants
        .iter()
        .filter(|candidate| {
            (choice.start..choice.end).step_by(1).all(|index| {
                let Some(other) = existing.get(index) else {
                    return true;
                };
                // Only positions fully inside the candidate can be checked.
                if other.start < choice.start || other.end > choice.end {
                    return true;
                }
                let slice = &candidate[other.start - choice.start..other.end - choice.start];
                other.variants.iter().any(|variant| variant == slice)
            })
        })
        .cloned()
        .collect();

    if compatible.is_empty() {
        // Nothing agrees: fall back to freezing what is there, which is what
        // AvoidChanges wants anyway.
        return MutationChoice::new(
            choice.start,
            choice.end,
            vec![sequence[choice.start..choice.end].to_string()],
        );
    }
    MutationChoice::new(choice.start, choice.end, compatible)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::biotools::translate;
    use crate::location::Location;

    const CDS: &str =
        "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA";

    fn translation_constraint(sequence: &str) -> Spec {
        Spec::EnforceTranslation {
            location: Location::with_strand(0, sequence.len(), 1),
            translation: translate(sequence),
        }
    }

    #[test]
    fn every_variant_keeps_the_protein() {
        let space = MutationSpace::from_constraints(CDS, &[translation_constraint(CDS)]);
        let mut rng = NumpyRng::seed(1);
        let protein = translate(CDS);
        for _ in 0..200 {
            let mutated = space.apply_random_mutations(2, CDS, &mut rng);
            assert_eq!(translate(&mutated), protein);
            assert_eq!(mutated.len(), CDS.len());
        }
    }

    #[test]
    fn a_frozen_region_never_changes() {
        let locked = Location::with_strand(9, 15, 1);
        let constraints = vec![
            translation_constraint(CDS),
            Spec::AvoidChanges {
                location: locked,
                target: locked.extract(CDS).to_string(),
            },
        ];
        let space = MutationSpace::from_constraints(CDS, &constraints);
        let mut rng = NumpyRng::seed(7);
        for _ in 0..200 {
            let mutated = space.apply_random_mutations(3, CDS, &mut rng);
            assert_eq!(&mutated[9..15], &CDS[9..15], "locked region changed");
        }
    }

    #[test]
    fn single_codon_space_enumerates_its_synonyms() {
        // Leucine has six codons, so a one-codon window has six variants.
        let sequence = "CTG";
        let space = MutationSpace::from_constraints(sequence, &[translation_constraint(sequence)]);
        let variants = space.all_variants(sequence);
        assert_eq!(variants.len(), 6);
        assert!(variants.contains(&"CTG".to_string()));
        assert!(variants.contains(&"TTA".to_string()));
        for variant in &variants {
            assert_eq!(translate(variant), "L");
        }
    }

    #[test]
    fn exhaustive_search_starts_from_the_current_sequence() {
        // Nearest-first ordering means no edit at all comes first.
        let sequence = "CTG";
        let space = MutationSpace::from_constraints(sequence, &[translation_constraint(sequence)]);
        assert_eq!(space.all_variants(sequence)[0], "CTG");
    }

    #[test]
    fn methionine_and_tryptophan_are_immovable() {
        // ATG (M) and TGG (W) have one codon each, so nothing can mutate.
        let sequence = "ATGTGG";
        let space = MutationSpace::from_constraints(sequence, &[translation_constraint(sequence)]);
        assert_eq!(space.size(), 0.0);
        let mut rng = NumpyRng::seed(3);
        assert_eq!(
            space.apply_random_mutations(2, sequence, &mut rng),
            sequence
        );
    }

    #[test]
    fn space_size_counts_combinations() {
        // L (6 codons) x D (2 codons) = 12 sequences; M adds nothing.
        let sequence = "ATGCTGGAC";
        let space = MutationSpace::from_constraints(sequence, &[translation_constraint(sequence)]);
        assert!(
            (space.size() - 12.0).abs() < 1e-9,
            "size was {}",
            space.size()
        );
        assert_eq!(space.all_variants(sequence).len(), 12);
    }

    #[test]
    fn localizing_keeps_only_overlapping_choices() {
        let space = MutationSpace::from_constraints(CDS, &[translation_constraint(CDS)]);
        let local = space.localized(&Location::new(3, 9));
        // Two codons, each with at least two synonyms.
        assert!(local.size() > 0.0);
        assert_eq!(local.choices_span(), Some((3, 9)));
    }
}
