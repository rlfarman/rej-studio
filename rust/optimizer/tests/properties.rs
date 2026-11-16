//! Invariants that must hold for every input, not just the recorded ones.
//!
//! The fixture tests pin the port to Python's answers on specific sequences.
//! These complement them by generating many random coding sequences and
//! asserting the properties a design must always have — the ones that would
//! make a result unusable in a lab if they ever broke:
//!
//!   * the protein is unchanged,
//!   * the sequence stays the same length and remains pure ACGT,
//!   * a chosen WGGW site is left exactly as the user chose it,
//!   * the two fragments reassemble into the design,
//!   * and the design scores no worse than the input.
//!
//! Sequences are generated from a fixed seed, so a failure is reproducible.

use rej_optimizer::contract::{ProcessOptions, SelectedWggwSiteInput};

/// Small deterministic generator — good enough to vary sequences, and
/// reproducible so any failure can be replayed.
struct Generator(u64);

impl Generator {
    fn next(&mut self) -> u64 {
        // xorshift64*: short, well-distributed, and no dependency needed.
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }

    /// A valid coding sequence: ATG, `codons` random sense codons, then a stop.
    fn coding_sequence(&mut self, codons: usize) -> String {
        const BASES: [char; 4] = ['A', 'C', 'G', 'T'];
        let mut sequence = String::from("ATG");
        while sequence.len() < 3 * (codons + 1) {
            let codon: String = (0..3).map(|_| BASES[self.below(4)]).collect();
            // Skip stop codons so the protein has no premature end.
            if !matches!(codon.as_str(), "TAA" | "TAG" | "TGA") {
                sequence.push_str(&codon);
            }
        }
        sequence.push_str("TGA");
        sequence
    }
}

fn options() -> ProcessOptions {
    ProcessOptions {
        codon_optimize: Some("human".to_string()),
        remove_cryptic_ss: true,
        minimize_cpgs: true,
        reduce_kmer_complexity: true,
        enforce_gc: true,
        ensure_wggw: true,
        wggw_threshold: 300,
        ..ProcessOptions::default()
    }
}

/// Run the design, failing the test with context if it errors.
fn design(sequence: &str, options: &ProcessOptions) -> rej_optimizer::contract::ProcessResult {
    rej_optimizer::process(sequence, "property", options, |_, _| {})
        .unwrap_or_else(|error| panic!("design failed on {sequence}: {error}"))
}

#[test]
fn every_design_preserves_the_protein_and_the_alphabet() {
    let mut generator = Generator(0x5EED_1234);
    for _ in 0..40 {
        let extra = generator.below(60);
        let sequence = generator.coding_sequence(20 + extra);
        let designed = design(&sequence, &options());

        assert_eq!(
            rej_optimizer::translate_dna(&designed.optimized_sequence),
            rej_optimizer::translate_dna(&sequence),
            "protein changed for {sequence}"
        );
        assert_eq!(
            designed.optimized_sequence.len(),
            sequence.len(),
            "length changed for {sequence}"
        );
        assert!(
            designed
                .optimized_sequence
                .bytes()
                .all(|base| matches!(base, b'A' | b'C' | b'G' | b'T')),
            "non-ACGT base in the design for {sequence}"
        );
    }
}

#[test]
fn every_design_scores_at_least_as_well_as_its_input() {
    let mut generator = Generator(0xC0FF_EE42);
    for _ in 0..40 {
        let extra = generator.below(60);
        let sequence = generator.coding_sequence(20 + extra);
        let options = options();
        let before = rej_optimizer::score_only(&sequence, &options)
            .expect("scoring the input")
            .total_score
            .unwrap_or(0.0);

        let designed = design(&sequence, &options);
        let after = rej_optimizer::score_only(&designed.optimized_sequence, &options)
            .expect("scoring the design")
            .total_score
            .unwrap_or(0.0);

        assert!(
            after >= before - 1e-9,
            "score regressed from {before} to {after} for {sequence}"
        );
    }
}

#[test]
fn the_fragments_always_reassemble_into_the_design() {
    let mut generator = Generator(0xFEED_BEEF);
    for _ in 0..40 {
        let extra = generator.below(60);
        let sequence = generator.coding_sequence(20 + extra);
        let designed = design(&sequence, &options());

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
            "fragments do not rejoin for {sequence}"
        );
        // The cut must fall strictly inside the sequence, never at an end.
        assert!(
            designed.split_point > 0 && designed.split_point < designed.optimized_sequence.len(),
            "split point {} is outside {sequence}",
            designed.split_point
        );
    }
}

#[test]
fn stimulatory_introns_do_not_corrupt_the_design() {
    let mut generator = Generator(0x1234_ABCD);
    let mut options = options();
    options.stim_5 = true;
    options.stim_3 = true;

    for _ in 0..15 {
        // Long enough that the +/-150 base stimulatory points fall inside.
        let extra = generator.below(60);
        let sequence = generator.coding_sequence(150 + extra);
        let designed = design(&sequence, &options);

        assert_eq!(
            rej_optimizer::translate_dna(&designed.optimized_sequence),
            rej_optimizer::translate_dna(&sequence),
            "protein changed for {sequence}"
        );
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
            "fragments do not rejoin"
        );
    }
}

#[test]
fn a_chosen_wggw_site_is_left_exactly_where_the_user_put_it() {
    let mut generator = Generator(0x0BAD_C0DE);
    for _ in 0..15 {
        let extra = generator.below(40);
        let sequence = generator.coding_sequence(40 + extra);

        // Find a codon pair that can be recoded to ATG+GAT: AGGA spans the
        // join, so the pair encodes Met-Asp wherever that pair already sits.
        let protein = rej_optimizer::translate_dna(&sequence);
        let Some(index) = protein.as_bytes().windows(2).position(|pair| pair == b"MD") else {
            continue;
        };
        let hexamer_start = index * 3;
        let current = &sequence[hexamer_start..hexamer_start + 6];
        let new_hexamer = "ATGGAT";
        // The motif inside ATGGAT is TGGA, starting at offset 1.
        let selected = SelectedWggwSiteInput {
            position: hexamer_start + 2,
            motif_start: hexamer_start + 1,
            motif: "TGGA".to_string(),
            hexamer_start: hexamer_start + 1,
            original_codons: (current[..3].to_string(), current[3..].to_string()),
            new_codons: ("ATG".to_string(), "GAT".to_string()),
            new_hexamer: new_hexamer.to_string(),
        };

        let mut options = options();
        options.selected_wggw_site = Some(selected);
        options.split_point = Some(hexamer_start + 2);

        let designed = design(&sequence, &options);
        assert_eq!(
            &designed.optimized_sequence[hexamer_start..hexamer_start + 6],
            new_hexamer,
            "the chosen site was overwritten in {sequence}"
        );
        assert!(
            designed.used_wggw_as_split,
            "a chosen site should always be used as the split"
        );
    }
}

#[test]
fn malformed_requests_are_refused_rather_than_designed_around() {
    let options = options();
    for bad in ["", "AT", "ATGXX", "ATGCCCC", "atg cgt"] {
        assert!(
            rej_optimizer::process(bad, "property", &options, |_, _| {}).is_err(),
            "{bad:?} should have been refused"
        );
    }
}
