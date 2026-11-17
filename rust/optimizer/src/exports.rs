//! The crate's other JSON entry points.
//!
//! [`crate::process`] designs a sequence; these three answer the questions the
//! UI needs answered *before* a design, or needs the crate's data for:
//!
//!   * [`reverse_translate_json`] — protein to DNA, so the form has a coding
//!     sequence to place a split on. The TypeScript side has no codon table
//!     any more, so this is the only implementation, and the browser needs
//!     it: it is the one of the three with a wasm export, using the ABI
//!     [`crate::process`] uses (a JSON string in, a length-prefixed JSON
//!     string out, freed with `free_response`).
//!   * [`codon_tables_json`] — the codon preferences the charts draw, which
//!     `examples/codon-tables.rs` turns into a TypeScript module.
//!   * [`wggw_report_json`] — the crate's WGGW candidates, their ordering and
//!     the split it would choose, which `examples/wggw-reference.rs` records
//!     for `sequence-utils.wggw-parity.test.ts` to check the TypeScript
//!     ranking against.
//!
//! Only the first is reachable from the browser. The other two are read at
//! build time by those examples and would otherwise cost every visitor 6.4 KB
//! of compressed WebAssembly for data that is committed to the repository;
//! Rust CI regenerates both files and fails if they have gone stale.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::rej;
use crate::reverse_translate::reverse_translate;
use crate::spec::Species;

/// `{ "protein": "...", "species": "human" }`.
#[derive(Deserialize)]
struct ReverseTranslateRequest {
    protein: String,
    species: String,
}

/// Reverse-translate a protein, answering `{ "CDS": "..." }` or an error.
pub fn reverse_translate_json(request: &str) -> String {
    let response = match serde_json::from_str::<ReverseTranslateRequest>(request) {
        Err(error) => serde_json::json!({ "error": format!("invalid request: {error}") }),
        Ok(request) => match reverse_translate(&request.protein, &request.species) {
            Ok(cds) => serde_json::json!({ "CDS": cds }),
            Err(message) => serde_json::json!({ "error": message }),
        },
    };
    response.to_string()
}

/// Every codon's preference relative to the most-used synonym of its amino
/// acid, per species: 1.0 for that codon, down towards 0 for rare ones.
///
/// The same ratio DNAChisel's CAI objective maximizes, so a chart drawn from
/// this is drawn from what the optimizer was scoring.
///
/// Rounded to six decimals, which is four more than any chart renders and is
/// what lets the generated TypeScript module be compared against the module
/// for exact equality: the tables are logs, so the ratio comes out of `exp`,
/// and `exp` differs by one unit in the last place between a native build and
/// a wasm32 one.
pub fn codon_relative_preferences() -> BTreeMap<&'static str, BTreeMap<&'static str, f64>> {
    [("human", Species::Human), ("mouse", Species::Mouse)]
        .into_iter()
        .map(|(name, species)| {
            let table = species.table_name();
            let preferences = crate::tables::GENETIC_CODE
                .iter()
                .map(|(codon, amino_acid)| {
                    let log_frequency = crate::spec::log_frequency(table, codon)
                        .expect("the generated table covers every codon");
                    let log_best = crate::spec::log_best_frequency(table, *amino_acid)
                        .expect("the generated table covers every amino acid");
                    let preference = (log_frequency - log_best).exp();
                    (*codon, (preference * 1e6).round() / 1e6)
                })
                .collect();
            (name, preferences)
        })
        .collect()
}

/// The codon preferences as JSON, keyed by species then codon.
pub fn codon_tables_json() -> String {
    serde_json::to_string(&codon_relative_preferences())
        .expect("codon preferences serialize as JSON")
}

/// `{ "sequence": "...", "split_point": 120, "wggw_threshold": 300 }`.
#[derive(Deserialize)]
struct WggwRequest {
    sequence: String,
    split_point: Option<usize>,
    wggw_threshold: Option<usize>,
}

/// The crate's view of the WGGW sites in a sequence.
///
/// Positions are 0-based starts of the four-base motif, as the crate works in
/// (TypeScript reports them 1-based); `split_point` counts the bases on the
/// 5' side, which both sides spell the same way.
pub fn wggw_report_json(request: &str) -> String {
    let parsed: WggwRequest = match serde_json::from_str(request) {
        Ok(parsed) => parsed,
        Err(error) => {
            return serde_json::json!({ "error": format!("invalid request: {error}") }).to_string();
        }
    };
    let sequence = parsed.sequence.to_uppercase().replace('U', "T");
    let split_point = parsed.split_point.unwrap_or(sequence.len() / 2);
    let threshold = parsed.wggw_threshold.unwrap_or(300);

    let candidates = rej::candidate_splice_sites(&sequence);
    let by_distance: Vec<usize> = rej::by_distance_from(&candidates, split_point)
        .into_iter()
        .map(|(_, position)| position)
        .collect();

    let (recoded, inserted) = rej::insert_wggw_motif(&sequence, split_point, 0, 0);
    let inserted = inserted.map(|site| {
        serde_json::json!({
            "position": site.position,
            "motif": site.motif,
            "distance_from_split": site.distance_from_split,
            "original_codons": [site.original_codons.0, site.original_codons.1],
            "new_codons": [site.new_codons.0, site.new_codons.1],
            "recoded": recoded,
        })
    });

    let split = crate::split_for_rej(&sequence, split_point, threshold, false, false);
    serde_json::json!({
        "candidates": candidates,
        "by_distance": by_distance,
        "inserted": inserted,
        "split": {
            "split_point": split.split_point,
            "used_wggw_as_split": split.used_wggw_as_split,
        },
    })
    .to_string()
}

// --- Browser interface ------------------------------------------------------
//
// Same contract as `process` (see the `wasm_abi` module in lib.rs): the host
// writes a UTF-8 request into a buffer from `alloc`, calls this, reads the
// 4-byte little-endian length and that many bytes, then `free_response`s the
// pointer. The framing is identical, so `free_response` frees these too.
//
// Reverse translation is the only one of this module's entry points the
// browser can reach. The other two feed build-time generators, and an export
// no page calls is 6.4 KB of compressed download for everyone.
#[cfg(target_arch = "wasm32")]
mod wasm_abi {
    use super::reverse_translate_json;

    /// Box a response as a 4-byte little-endian length followed by its bytes.
    ///
    /// Exactly what `free_response` in lib.rs expects to free: a boxed slice
    /// of `4 + len` bytes. `as u32` is lossless — `usize` is 32 bits here.
    fn frame(response: String) -> *mut u8 {
        let bytes = response.into_bytes();
        let mut framed = Vec::with_capacity(4 + bytes.len());
        framed.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
        framed.extend_from_slice(&bytes);
        Box::into_raw(framed.into_boxed_slice()).cast::<u8>()
    }

    /// Run `answer` on a request buffer, or report that it was not UTF-8.
    ///
    /// # Safety
    /// `pointer` must be non-null and valid for reads of `len` initialized
    /// bytes for the whole call, with nothing writing to them meanwhile. A
    /// buffer from `alloc(len)` qualifies.
    unsafe fn with_request(
        pointer: *const u8,
        len: usize,
        answer: impl FnOnce(&str) -> String,
    ) -> *mut u8 {
        // SAFETY: the caller guarantees `pointer` is non-null and readable for
        // `len` initialized bytes until we return (`alloc` zero-fills, so a
        // buffer from it is initialized even where the host wrote nothing).
        // `u8` has no alignment requirement, and `len` bytes inside a wasm32
        // address space cannot exceed `isize::MAX`.
        let request = unsafe { std::slice::from_raw_parts(pointer, len) };
        frame(match std::str::from_utf8(request) {
            Ok(request) => answer(request),
            Err(_) => r#"{"error":"request was not valid UTF-8"}"#.to_string(),
        })
    }

    /// Reverse-translate a protein. Request and response are JSON.
    ///
    /// # Safety
    /// As [`with_request`]: `pointer` must be readable for `len` bytes.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn reverse_translate(pointer: *const u8, len: usize) -> *mut u8 {
        // SAFETY: forwarded unchanged; this function's contract is the one
        // `with_request` asks for.
        unsafe { with_request(pointer, len, reverse_translate_json) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reverse_translation_answers_with_dna() {
        let response = reverse_translate_json(r#"{"protein":"MK*","species":"mouse"}"#);
        assert_eq!(response, r#"{"CDS":"ATGAAGTGA"}"#);
    }

    #[test]
    fn a_bad_reverse_translation_request_is_an_error_not_a_panic() {
        for request in [
            "not json",
            r#"{"protein":"MK*"}"#,
            r#"{"protein":"MK*","species":"rat"}"#,
            r#"{"protein":"MZ*","species":"human"}"#,
        ] {
            assert!(
                reverse_translate_json(request).contains("error"),
                "{request} was accepted"
            );
        }
    }

    #[test]
    fn preferences_top_out_at_one_for_the_most_used_codon() {
        let tables = codon_relative_preferences();
        for (species, preferences) in &tables {
            assert_eq!(preferences.len(), 64, "{species}");
            for (codon, preference) in preferences {
                assert!(
                    *preference > 0.0 && *preference <= 1.0,
                    "{species} {codon} = {preference}"
                );
            }
            // Arginine's most-used mouse codon is AGA, the case the
            // TypeScript table used to get the other way round.
            assert_eq!(preferences["AGA"], 1.0, "{species} AGA");
        }
        assert_eq!(tables["human"]["CTG"], 1.0);
        assert!(tables["human"]["CTA"] < 0.2);
    }

    #[test]
    fn the_wggw_report_describes_the_split_it_would_choose() {
        let cds =
            "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA";
        let request = serde_json::json!({ "sequence": cds, "split_point": 45 }).to_string();
        let report: serde_json::Value = serde_json::from_str(&wggw_report_json(&request)).unwrap();

        let candidates: Vec<usize> = serde_json::from_value(report["candidates"].clone()).unwrap();
        assert_eq!(candidates, rej::candidate_splice_sites(cds));
        let by_distance: Vec<usize> =
            serde_json::from_value(report["by_distance"].clone()).unwrap();
        assert_eq!(by_distance.len(), candidates.len());
        assert!(report["split"]["split_point"].as_u64().is_some());
    }

    #[test]
    fn a_bad_wggw_request_is_an_error_not_a_panic() {
        assert!(wggw_report_json("[]").contains("error"));
    }
}
