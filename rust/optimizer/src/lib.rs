//! RNA End-Joining sequence design, ported from `python/algorithm.py`.
//!
//! A port exists so the optimizer can run in the browser without shipping a
//! Python runtime. It follows the Python original closely — same objectives,
//! same search, same random draws — and `tests/parity.rs` checks it against
//! fixtures produced by the real DNAChisel so the two cannot drift apart
//! unnoticed.
//!
//! The entry point is [`process`], which takes a coding sequence plus options
//! and returns the same JSON shape the FastAPI backend returns today.

mod biotools;
mod exports;
mod location;
mod mutation_space;
mod pattern;
mod problem;
pub mod rej;
mod reverse_translate;
mod rng;
mod spec;
mod tables;

pub mod contract;

pub use crate::exports::{
    codon_relative_preferences, codon_tables_json, reverse_translate_json, wggw_report_json,
};
pub use crate::reverse_translate::reverse_translate;

use sha2::{Digest, Sha256};

use crate::contract::{
    ObjectiveEntry, ObjectiveLocation, ObjectivesReport, ProcessOptions, ProcessResult,
    WggwSiteInfo,
};
use crate::location::Location;
use crate::pattern::Pattern;
use crate::problem::Problem;
use crate::rej::{SelectedWggwSite, SplitOptions};
use crate::rng::NumpyRng;
use crate::spec::Spec;

pub use crate::contract::SelectedWggwSiteInput;

/// Splice-site motifs the design removes. Copied verbatim from
/// `build_optimization_problem`; the long acceptor list covers polypyrimidine
/// tracts of varying length ahead of an AG dinucleotide.
const SPLICE_PATTERNS: &[&str] = &[
    "GT[AG]A",
    "AAGTA",
    "[CTA]AG[GA]",
    "CAG[GC]",
    "[CT]{2}[ACGT][CT]AG[GA]T",
    "[AG][CT][ACGT][CT]AG[GA]T",
    "[CT][AG][ACGT][CT]AG[GA]T",
    "[CT]{3}[ACGT][CT]AG[GA]T",
    "[AG][CT]{2}[ACGT][CT]AG[GA]T",
    "[CT][AG][CT][ACGT][CT]AG[GA]T",
    "[CT]{2}[AG][ACGT][CT]AG[GA]T",
    "[CT]{4}[ACGT][CT]AG[GA]T",
    "[AG][CT]{3}[ACGT][CT]AG[GA]T",
    "[CT][AG][CT]{2}[ACGT][CT]AG[GA]T",
    "[CT]{2}[AG][CT][ACGT][CT]AG[GA]T",
    "[CT]{3}[AG][ACGT][CT]AG[GA]T",
    "[CT]{5}[ACGT][CT]AG[GA]T",
    "[AG][CT]{4}[ACGT][CT]AG[GA]T",
    "[CT][AG][CT]{3}[ACGT][CT]AG[GA]T",
    "[CT]{2}[AG][CT]{2}[ACGT][CT]AG[GA]T",
    "[CT]{3}[AG][CT][ACGT][CT]AG[GA]T",
    "[CT]{4}[AG][ACGT][CT]AG[GA]T",
    "[CT]{6}[ACGT][CT]AG[GA]T",
    "[AG][CT]{5}[ACGT][CT]AG[GA]T",
    "[CT][AG][CT]{4}[ACGT][CT]AG[GA]T",
    "[CT]{2}[AG][CT]{3}[ACGT][CT]AG[GA]T",
    "[CT]{3}[AG][CT]{2}[ACGT][CT]AG[GA]T",
    "[CT]{4}[AG][CT][ACGT][CT]AG[GA]T",
    "[CT]{5}[AG][ACGT][CT]AG[GA]T",
];

/// GC bounds the design enforces, as in `build_optimization_problem`.
const GC_MIN: f64 = 0.35;
const GC_MAX: f64 = 0.60;
/// Default k for the k-mer uniqueness objective.
const DEFAULT_KMER_K: usize = 10;

/// Progress caption for the optimization phase, matching python/algorithm.py
/// so the UI reads the same whichever backend ran the design.
const OPTIMIZING_STAGE: &str = "Optimizing sequence";

#[derive(Debug)]
pub enum OptimizeError {
    /// The caller's input cannot be designed from.
    InvalidInput(String),
    /// The optimizer ran but could not produce a usable design.
    NoSolution(String),
}

impl std::fmt::Display for OptimizeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OptimizeError::InvalidInput(message) | OptimizeError::NoSolution(message) => {
                write!(f, "{message}")
            }
        }
    }
}

impl std::error::Error for OptimizeError {}

/// Derive a seed from the inputs so the same request always designs the same
/// sequence, matching Python's `derive_seed`: SHA-256 over the canonical JSON
/// of `[CDS, options-without-seed]`, first four bytes big-endian.
pub fn derive_seed(cds: &str, options: &ProcessOptions) -> u32 {
    let payload = options.canonical_seed_payload(cds);
    let digest = Sha256::digest(payload.as_bytes());
    u32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]])
}

/// Build the constraints and objectives for a request.
fn build_problem(
    cds: &str,
    options: &ProcessOptions,
    locked: Option<(usize, usize)>,
) -> Result<Problem, OptimizeError> {
    let whole = Location::with_strand(0, cds.len(), 1);
    let mut constraints = vec![Spec::EnforceTranslation {
        location: whole,
        translation: biotools::translate(cds),
    }];
    if let Some((start, end)) = locked {
        let location = Location::with_strand(start, end, 1);
        constraints.push(Spec::AvoidChanges {
            location,
            target: location.extract(cds).to_string(),
        });
    }

    let mut objectives = Vec::new();
    if options.remove_cryptic_ss {
        for expression in SPLICE_PATTERNS {
            let pattern = Pattern::parse(expression)
                .map_err(|error| OptimizeError::InvalidInput(error.to_string()))?;
            objectives.push(Spec::AvoidPattern {
                pattern,
                location: whole,
                boost: options.remove_cryptic_ss_weight,
            });
        }
    }
    if let Some(species) = options.species() {
        objectives.push(Spec::MaximizeCai {
            location: whole,
            species,
            boost: options.codon_optimize_weight,
        });
    }
    if options.minimize_cpgs {
        let pattern =
            Pattern::parse("CG").map_err(|error| OptimizeError::InvalidInput(error.to_string()))?;
        objectives.push(Spec::AvoidPattern {
            pattern,
            location: whole,
            boost: options.minimize_cpgs_weight,
        });
    }
    if options.reduce_kmer_complexity {
        objectives.push(Spec::UniquifyAllKmers {
            location: whole,
            reference: whole,
            k: options.reduce_kmer_complexity_k.unwrap_or(DEFAULT_KMER_K),
            boost: options.reduce_kmer_complexity_weight,
            localization: None,
        });
    }
    // GC content is a constraint, so it is resolved before objectives run.
    if options.enforce_gc {
        constraints.push(Spec::EnforceGcContent {
            location: whole,
            mini: GC_MIN,
            maxi: GC_MAX,
            boost: 1.0,
        });
    }

    Ok(Problem::new(cds.to_string(), constraints, objectives))
}

fn build_report(problem: &Problem) -> ObjectivesReport {
    let entries: Vec<ObjectiveEntry> = problem
        .objective_evaluations()
        .into_iter()
        .map(|(spec, evaluation)| ObjectiveEntry {
            objective: spec.label(),
            passes: evaluation.passes(),
            score: evaluation.score,
            message: evaluation.message,
            locations: evaluation
                .locations
                .iter()
                .map(|location| ObjectiveLocation {
                    start: location.start,
                    end: location.end,
                    strand: Some(location.strand),
                })
                .collect(),
        })
        .collect();
    let total = (!entries.is_empty()).then(|| entries.iter().map(|entry| entry.score).sum());
    ObjectivesReport {
        entries,
        total_score: total,
    }
}

/// Design a coding sequence: optimize it, then split it for RNA end-joining.
///
/// `on_progress` receives a fraction in 0..1 and a stage label, matching the
/// Python callback so the UI's progress bar behaves the same.
pub fn process(
    cds: &str,
    name: &str,
    options: &ProcessOptions,
    mut on_progress: impl FnMut(f64, &str),
) -> Result<ProcessResult, OptimizeError> {
    let start = now_seconds();
    let cds = cds.trim().to_uppercase().replace('U', "T");

    if cds.is_empty() {
        return Err(OptimizeError::InvalidInput(
            "Coding sequence must not be empty".to_string(),
        ));
    }
    if !cds
        .bytes()
        .all(|base| matches!(base, b'A' | b'C' | b'G' | b'T'))
    {
        return Err(OptimizeError::InvalidInput(
            "Coding sequence must contain only A, C, G, T, or U".to_string(),
        ));
    }
    if !cds.len().is_multiple_of(3) {
        return Err(OptimizeError::InvalidInput(
            "Coding sequence length is not a multiple of 3".to_string(),
        ));
    }

    let seed = options.seed.unwrap_or_else(|| derive_seed(&cds, options));
    let mut rng = NumpyRng::seed(seed);
    on_progress(0.05, "Checking sequence");

    // A caller-chosen WGGW site is applied up front and then frozen, so the
    // optimizer cannot undo the user's choice.
    let requested_split = options.split_point.unwrap_or(cds.len() / 2);
    let (working, selected_site, locked) = match &options.selected_wggw_site {
        Some(selected) => {
            let input = SelectedWggwSite {
                position: selected.position,
                motif_start: selected.motif_start,
                hexamer_start: selected.hexamer_start,
                motif: selected.motif.to_uppercase().replace('U', "T"),
                new_hexamer: selected.new_hexamer.to_uppercase().replace('U', "T"),
                original_codons: (
                    selected.original_codons.0.to_uppercase().replace('U', "T"),
                    selected.original_codons.1.to_uppercase().replace('U', "T"),
                ),
                new_codons: (
                    selected.new_codons.0.to_uppercase().replace('U', "T"),
                    selected.new_codons.1.to_uppercase().replace('U', "T"),
                ),
            };
            let (recoded, site, locked) = rej::apply_selected_site(&cds, &input, requested_split)
                .map_err(OptimizeError::InvalidInput)?;
            (recoded, Some(site), Some(locked))
        }
        None => (cds.clone(), None, None),
    };

    on_progress(0.10, "Preparing constraints");
    let mut problem = build_problem(&working, options, locked)?;

    on_progress(0.15, "Resolving constraints");
    problem
        .resolve_constraints(&mut rng)
        .map_err(|error| OptimizeError::NoSolution(error.to_string()))?;

    let objectives_before = problem.objectives_text_summary();
    let report_before = build_report(&problem);

    on_progress(0.45, OPTIMIZING_STAGE);
    problem.optimize(&mut rng, |fraction, index, total| {
        // Same wording the Python backend reports, so the progress caption
        // reads the same whichever one ran the design.
        let stage = format!("{OPTIMIZING_STAGE} ({}/{total})", (index + 1).min(total));
        on_progress(0.45 + 0.42 * fraction, &stage);
    });

    on_progress(0.92, "Finalizing");
    let optimized = problem.sequence.clone();
    if optimized.is_empty() {
        return Err(OptimizeError::NoSolution(
            "Optimization produced an empty sequence".to_string(),
        ));
    }

    let split = rej::split_sequence(
        &optimized,
        &SplitOptions {
            split_point: requested_split,
            wggw_threshold: options.wggw_threshold,
            ensure_wggw: options.ensure_wggw,
            stim_5: options.stim_5,
            stim_3: options.stim_3,
            selected_site,
        },
    );
    if split.final_sequence.is_empty() || split.seq5.is_empty() {
        return Err(OptimizeError::NoSolution(
            "Optimization produced an empty design fragment".to_string(),
        ));
    }

    // Re-score the design as it will be delivered, since the split step can
    // recode codons after the optimizer finished.
    let final_problem = build_problem(&split.final_sequence, options, locked)?;
    let objectives_after = final_problem.objectives_text_summary();
    let report_after = build_report(&final_problem);

    Ok(ProcessResult {
        name: name.to_string(),
        original_sequence: cds,
        optimized_sequence: split.final_sequence,
        seq5: split.seq5,
        seq3: split.seq3,
        split_point: split.split_point,
        used_wggw_as_split: split.used_wggw_as_split,
        objectives_before,
        objectives_after,
        objectives_report_before: report_before,
        objectives_report_after: report_after,
        wggw_info: (!split.wggw.is_empty()).then(|| {
            split
                .wggw
                .into_iter()
                .map(|(label, site)| {
                    (
                        label,
                        WggwSiteInfo {
                            position: site.position,
                            motif: site.motif,
                            distance_from_split: site.distance_from_split,
                            original_codons: [site.original_codons.0, site.original_codons.1],
                            new_codons: [site.new_codons.0, site.new_codons.1],
                        },
                    )
                })
                .collect()
        }),
        processing_time_seconds: ((now_seconds() - start) * 100.0).round() / 100.0,
        seed: Some(seed),
    })
}

// --- Pieces exposed for testing and for callers that want one step ---------
//
// The parity tests compare these against the Python originals one at a time,
// so a mismatch points at a single function instead of the whole pipeline.

/// Translate DNA to protein with the Standard genetic code.
pub fn translate_dna(sequence: &str) -> String {
    biotools::translate(sequence)
}

/// The codons encoding an amino acid, in the order that shapes the mutation
/// space. `None` for a character that is not an amino acid.
pub fn synonymous_codons(amino_acid: char) -> Option<Vec<String>> {
    biotools::backtranslation()
        .get(&amino_acid)
        .map(|codons| codons.iter().map(|codon| codon.to_string()).collect())
}

/// Log usage frequency of a codon in a species ("h_sapiens"/"m_musculus"),
/// as the codon-optimization objective scores it.
pub fn codon_log_frequency(species: &str, codon: &str) -> Option<f64> {
    spec::log_frequency(species, codon)
}

/// Score a sequence against the objectives `options` selects, without
/// optimizing anything.
pub fn score_only(
    sequence: &str,
    options: &ProcessOptions,
) -> Result<ObjectivesReport, OptimizeError> {
    Ok(build_report(&build_problem(sequence, options, None)?))
}

/// DNAChisel's `objectives_text_summary()` for a sequence.
pub fn text_summary(sequence: &str, options: &ProcessOptions) -> Result<String, OptimizeError> {
    Ok(build_problem(sequence, options, None)?.objectives_text_summary())
}

/// Start positions of every WGGW motif, overlaps included.
pub fn candidate_splice_sites(sequence: &str) -> Vec<usize> {
    rej::candidate_splice_sites(sequence)
}

/// Recode the codon pair nearest `split_point` to carry a WGGW motif.
pub fn insert_wggw_motif(sequence: &str, split_point: usize) -> (String, Option<rej::WggwSite>) {
    rej::insert_wggw_motif(sequence, split_point, 0, 0)
}

/// Place the split (and optional stimulatory points) and cut the sequence.
pub fn split_for_rej(
    sequence: &str,
    split_point: usize,
    wggw_threshold: usize,
    stim_5: bool,
    stim_3: bool,
) -> rej::SplitResult {
    rej::split_sequence(
        sequence,
        &SplitOptions {
            split_point,
            wggw_threshold,
            ensure_wggw: true,
            stim_5,
            stim_3,
            selected_site: None,
        },
    )
}

/// Wall-clock seconds. The browser has no system clock API through `std`, so
/// timing is reported as zero there and measured by the caller instead.
fn now_seconds() -> f64 {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs_f64())
            .unwrap_or(0.0)
    }
    #[cfg(target_arch = "wasm32")]
    {
        0.0
    }
}

/// The request shape the browser sends, mirroring the FastAPI endpoint.
#[derive(serde::Deserialize)]
struct JsonRequest {
    #[serde(rename = "CDS")]
    cds: String,
    name: String,
    options: ProcessOptions,
}

/// Design a sequence from a JSON request, returning a JSON response.
///
/// Errors come back as `{"error": "..."}` rather than a panic, so a bad
/// request from the UI is reported instead of tearing down the worker.
pub fn process_json(request: &str, on_progress: impl FnMut(f64, &str)) -> String {
    let parsed: Result<JsonRequest, _> = serde_json::from_str(request);
    let response = match parsed {
        Err(error) => serde_json::json!({ "error": format!("invalid request: {error}") }),
        Ok(request) => match process(&request.cds, &request.name, &request.options, on_progress) {
            Ok(result) => serde_json::to_value(result)
                .unwrap_or_else(|error| serde_json::json!({ "error": error.to_string() })),
            Err(error) => serde_json::json!({ "error": error.to_string() }),
        },
    };
    response.to_string()
}

// --- Browser interface ------------------------------------------------------
//
// A hand-written ABI rather than wasm-bindgen: the whole interface is one
// JSON string in and one JSON string out, so the generated glue would cost
// more bytes than it saves effort. Strings cross as (pointer, length) pairs
// into the module's own memory.
//
// The caller's side of the contract:
//   1. `alloc(len)` for the request, write the UTF-8 bytes there.
//   2. `process(ptr, len)` -> pointer to the response, laid out as a 4-byte
//      little-endian length followed by that many UTF-8 bytes.
//   3. `free_response(ptr)` once the response has been copied out, and
//      `dealloc(ptr, len)` for the request buffer.
//
// The host must also supply one import, `env.report_progress`, which the
// optimizer calls as it works. A design can take seconds to minutes, so
// without it the progress bar would sit still for the whole run.
#[cfg(target_arch = "wasm32")]
mod wasm_abi {
    use super::process_json;

    // Declared against the "env" module, which is what a plain
    // `{ env: { report_progress } }` imports object supplies.
    #[link(wasm_import_module = "env")]
    unsafe extern "C" {
        /// Host callback: `(fraction in 0..1, pointer to a UTF-8 stage label,
        /// its length)`. The bytes are only valid for the duration of the
        /// call, so the host must copy anything it keeps.
        fn report_progress(fraction: f64, stage_pointer: *const u8, stage_len: usize);
    }

    /// Reserve `len` bytes for the caller to write a request into.
    ///
    /// A zeroed boxed slice, not `Vec::with_capacity(len)`. A boxed slice's
    /// allocation is exactly `len` bytes, which is all [`dealloc`] is told, so
    /// it can rebuild the same allocation; `with_capacity` only promises *at
    /// least* `len`. Zeroing means [`process`] never reads uninitialized memory
    /// even if the host writes fewer bytes than it reserved.
    #[unsafe(no_mangle)]
    pub extern "C" fn alloc(len: usize) -> *mut u8 {
        Box::into_raw(vec![0u8; len].into_boxed_slice()).cast::<u8>()
    }

    /// Release a buffer obtained from [`alloc`].
    ///
    /// # Safety
    /// `pointer` and `len` must come from a single `alloc(len)` call that has
    /// not already been freed.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn dealloc(pointer: *mut u8, len: usize) {
        if pointer.is_null() {
            return;
        }
        // SAFETY: the caller guarantees `pointer` came from `alloc(len)` and
        // has not been freed. `alloc` made it with `Box::into_raw` on a
        // `Box<[u8]>` of exactly `len` bytes, so this rebuilds that box with
        // the same pointer, length and layout, and drops it exactly once.
        drop(unsafe { Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer, len)) });
    }

    /// Design a sequence. See the module comment for the calling sequence.
    ///
    /// # Safety
    /// `pointer` must be non-null and valid for reads of `len` initialized
    /// bytes for the whole call, with nothing writing to them meanwhile. A
    /// buffer from `alloc(len)` qualifies. The bytes need not be valid UTF-8:
    /// that is checked, and reported as an error response.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn process(pointer: *const u8, len: usize) -> *mut u8 {
        // SAFETY: the caller guarantees `pointer` is non-null and readable for
        // `len` initialized bytes until we return (`alloc` zero-fills, so a
        // buffer from it is initialized even where the host wrote nothing).
        // `u8` has no alignment requirement, and `len` bytes inside a wasm32
        // address space cannot exceed `isize::MAX`.
        let request = unsafe { std::slice::from_raw_parts(pointer, len) };
        let response = match std::str::from_utf8(request) {
            Ok(request) => process_json(request, |fraction, stage| {
                // SAFETY: `report_progress` is the host import declared above
                // and takes only plain values. `stage` stays borrowed for the
                // whole call, so the bytes it points at are valid while the
                // host copies them, which its contract says it does before
                // returning.
                unsafe { report_progress(fraction, stage.as_ptr(), stage.len()) };
            }),
            Err(_) => r#"{"error":"request was not valid UTF-8"}"#.to_string(),
        };

        // Length-prefixed so the caller can read it back without a second
        // call, and boxed for the same reason as `alloc`: the allocation is
        // exactly the framed length, which is all `free_response` can recover.
        // `as u32` is lossless here: `usize` is 32 bits on wasm32.
        let bytes = response.into_bytes();
        let mut framed = Vec::with_capacity(4 + bytes.len());
        framed.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
        framed.extend_from_slice(&bytes);
        Box::into_raw(framed.into_boxed_slice()).cast::<u8>()
    }

    /// Release a response buffer returned by [`process`].
    ///
    /// # Safety
    /// `pointer` must be a response pointer from [`process`] that has not
    /// already been freed.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn free_response(pointer: *mut u8) {
        if pointer.is_null() {
            return;
        }
        // SAFETY: every response from `process` starts with a 4-byte length
        // prefix, and the caller guarantees the buffer is still live.
        let prefix = unsafe { std::slice::from_raw_parts(pointer, 4) };
        let len =
            u32::from_le_bytes(prefix.try_into().expect("four bytes of length prefix")) as usize;
        // SAFETY: `process` made this with `Box::into_raw` on a boxed slice of
        // exactly `4 + len` bytes, `len` being the prefix just read, so this
        // rebuilds that box with the same pointer, length and layout. The
        // caller guarantees it has not been freed, so it is dropped once.
        drop(unsafe { Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer, 4 + len)) });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CDS: &str =
        "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA";

    fn options() -> ProcessOptions {
        ProcessOptions {
            codon_optimize: Some("human".to_string()),
            remove_cryptic_ss: true,
            minimize_cpgs: true,
            reduce_kmer_complexity: true,
            enforce_gc: true,
            stim_5: false,
            stim_3: false,
            split_point: Some(45),
            ensure_wggw: true,
            seed: Some(20_261_116),
            ..ProcessOptions::default()
        }
    }

    #[test]
    fn designs_a_sequence_end_to_end() {
        let result = process(CDS, "test", &options(), |_, _| {}).unwrap();
        assert_eq!(result.original_sequence, CDS);
        assert_eq!(
            biotools::translate(&result.optimized_sequence),
            biotools::translate(CDS)
        );
        assert!(!result.seq5.is_empty());
        assert!(!result.seq3.is_empty());
        assert_eq!(result.seed, Some(20_261_116));
    }

    #[test]
    fn the_same_seed_designs_the_same_sequence() {
        let first = process(CDS, "test", &options(), |_, _| {}).unwrap();
        let second = process(CDS, "test", &options(), |_, _| {}).unwrap();
        assert_eq!(first.optimized_sequence, second.optimized_sequence);
    }

    #[test]
    fn an_omitted_seed_is_derived_from_the_inputs() {
        let mut without_seed = options();
        without_seed.seed = None;
        let first = process(CDS, "test", &without_seed, |_, _| {}).unwrap();
        let second = process(CDS, "test", &without_seed, |_, _| {}).unwrap();
        assert_eq!(first.seed, second.seed);
        assert_eq!(first.optimized_sequence, second.optimized_sequence);
    }

    #[test]
    fn rejects_sequences_it_cannot_design_from() {
        let bad_inputs = ["", "ATGCC", "ATGXYZ"];
        for input in bad_inputs {
            let error = process(input, "test", &options(), |_, _| {});
            assert!(
                matches!(error, Err(OptimizeError::InvalidInput(_))),
                "{input:?} was accepted"
            );
        }
    }

    #[test]
    fn lowercase_and_rna_input_are_normalised() {
        let rna = CDS.to_lowercase().replace('t', "u");
        let result = process(&rna, "test", &options(), |_, _| {}).unwrap();
        assert_eq!(result.original_sequence, CDS);
    }

    #[test]
    fn progress_runs_from_start_to_finish_without_going_backwards() {
        let mut fractions: Vec<f64> = Vec::new();
        process(CDS, "test", &options(), |fraction, _| {
            fractions.push(fraction)
        })
        .unwrap();
        assert!(fractions.windows(2).all(|pair| pair[0] <= pair[1]));
        assert!(fractions.first().is_some_and(|first| *first <= 0.05));
        assert!(fractions.last().is_some_and(|last| *last >= 0.9));
    }

    #[test]
    fn progress_stages_read_the_way_the_python_backend_words_them() {
        // The caption is shown to the user verbatim, so it must be the same
        // phrasing whichever backend ran the design — never a raw objective
        // label like "AvoidPattern[0-81(+)](pattern:CG)".
        let mut stages: Vec<String> = Vec::new();
        process(CDS, "test", &options(), |_, stage| {
            stages.push(stage.to_string())
        })
        .unwrap();

        assert!(stages.iter().any(|stage| stage == "Checking sequence"));
        assert!(stages.iter().any(|stage| stage == "Resolving constraints"));
        assert!(stages.iter().any(|stage| stage == "Finalizing"));
        // Numbered while optimizing, as Python reports it.
        assert!(
            stages
                .iter()
                .any(|stage| stage.starts_with("Optimizing sequence (") && stage.ends_with("/32)")),
            "no numbered optimizing stage in {stages:?}"
        );
        assert!(
            !stages.iter().any(|stage| stage.contains('[')),
            "a raw objective label leaked into the progress stages: {stages:?}"
        );
    }

    #[test]
    fn the_report_lists_every_objective() {
        let result = process(CDS, "test", &options(), |_, _| {}).unwrap();
        // 29 splice patterns + CpG + CAI + k-mers.
        assert_eq!(result.objectives_report_before.entries.len(), 32);
        assert!(
            result
                .objectives_before
                .starts_with("===> TOTAL OBJECTIVES SCORE:")
        );
    }
}
