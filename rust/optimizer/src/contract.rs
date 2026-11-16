//! The request and result shapes, matching `python/contracts.py`.
//!
//! Field names stay in the Python spelling (`minimize_CpGs`, `stim_5`) so the
//! JSON the browser sends and receives is byte-identical to what the FastAPI
//! backend uses today. That is what lets the two run side by side during a
//! migration, and it is what `tests/parity.rs` compares.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::spec::Species;

/// A caller-chosen WGGW site, as the design tool's motif picker sends it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectedWggwSiteInput {
    pub position: usize,
    pub motif_start: usize,
    pub motif: String,
    pub hexamer_start: usize,
    pub original_codons: (String, String),
    pub new_codons: (String, String),
    pub new_hexamer: String,
}

/// Everything the optimizer can be asked to do.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProcessOptions {
    /// "human", "mouse", or absent to leave codon usage alone.
    pub codon_optimize: Option<String>,
    pub codon_optimize_weight: f64,
    pub remove_cryptic_ss: bool,
    pub remove_cryptic_ss_weight: f64,
    #[serde(rename = "minimize_CpGs")]
    pub minimize_cpgs: bool,
    #[serde(rename = "minimize_CpGs_weight")]
    pub minimize_cpgs_weight: f64,
    pub reduce_kmer_complexity: bool,
    pub reduce_kmer_complexity_weight: f64,
    pub reduce_kmer_complexity_k: Option<usize>,
    pub enforce_gc: bool,
    pub stim_5: bool,
    pub stim_3: bool,
    /// Absent means "halfway through the sequence".
    pub split_point: Option<usize>,
    pub selected_wggw_site: Option<SelectedWggwSiteInput>,
    pub ensure_wggw: bool,
    pub wggw_threshold: usize,
    /// Absent means "derive one from the inputs and echo it back".
    pub seed: Option<u32>,
}

impl Default for ProcessOptions {
    fn default() -> Self {
        Self {
            codon_optimize: None,
            codon_optimize_weight: 1.0,
            remove_cryptic_ss: false,
            remove_cryptic_ss_weight: 1.0,
            minimize_cpgs: false,
            minimize_cpgs_weight: 1.0,
            reduce_kmer_complexity: false,
            reduce_kmer_complexity_weight: 1.0,
            reduce_kmer_complexity_k: None,
            enforce_gc: true,
            stim_5: false,
            stim_3: false,
            split_point: None,
            selected_wggw_site: None,
            ensure_wggw: true,
            wggw_threshold: 0,
            seed: None,
        }
    }
}

impl ProcessOptions {
    pub(crate) fn species(&self) -> Option<Species> {
        match self.codon_optimize.as_deref() {
            Some("human") => Some(Species::Human),
            Some("mouse") => Some(Species::Mouse),
            _ => None,
        }
    }

    /// The exact string Python hashes to derive a seed.
    ///
    /// Python builds `json.dumps([CDS, options_without_seed], sort_keys=True)`
    /// from the options dict it was handed, so this reproduces that dict —
    /// keys sorted, Python's `True`/`False`/`None` spelled as JSON, and
    /// separators `", "` / `": "`. Any difference here changes every derived
    /// seed, so `tests/parity.rs` compares it against Python directly.
    pub(crate) fn canonical_seed_payload(&self, cds: &str) -> String {
        let mut fields: Vec<(&str, String)> = vec![
            (
                "codon_optimize",
                json_option_str(self.codon_optimize.as_deref()),
            ),
            (
                "codon_optimize_weight",
                json_float(self.codon_optimize_weight),
            ),
            ("remove_cryptic_ss", json_bool(self.remove_cryptic_ss)),
            (
                "remove_cryptic_ss_weight",
                json_float(self.remove_cryptic_ss_weight),
            ),
            ("minimize_CpGs", json_bool(self.minimize_cpgs)),
            (
                "minimize_CpGs_weight",
                json_float(self.minimize_cpgs_weight),
            ),
            (
                "reduce_kmer_complexity",
                json_bool(self.reduce_kmer_complexity),
            ),
            (
                "reduce_kmer_complexity_weight",
                json_float(self.reduce_kmer_complexity_weight),
            ),
            ("enforce_gc", json_bool(self.enforce_gc)),
            ("stim_5", json_bool(self.stim_5)),
            ("stim_3", json_bool(self.stim_3)),
            ("split_point", json_option_number(self.split_point)),
            ("ensure_wggw", json_bool(self.ensure_wggw)),
            ("wggw_threshold", self.wggw_threshold.to_string()),
            (
                "selected_wggw_site",
                match &self.selected_wggw_site {
                    None => "null".to_string(),
                    Some(site) => {
                        serde_json::to_string(site).unwrap_or_else(|_| "null".to_string())
                    }
                },
            ),
        ];
        if let Some(k) = self.reduce_kmer_complexity_k {
            fields.push(("reduce_kmer_complexity_k", k.to_string()));
        }
        fields.sort_by_key(|(key, _)| *key);

        let body = fields
            .iter()
            .map(|(key, value)| format!("\"{key}\": {value}"))
            .collect::<Vec<_>>()
            .join(", ");
        format!("[\"{cds}\", {{{body}}}]")
    }
}

fn json_bool(value: bool) -> String {
    if value { "true" } else { "false" }.to_string()
}

/// Render a float as Python's `json.dumps` does: a whole float keeps its
/// `.0` ("1.0", not "1"). The weights are floats in python/contracts.py while
/// `wggw_threshold` and the k-mer size are ints, and the two spellings hash
/// differently, so they must not be conflated.
fn json_float(value: f64) -> String {
    if value == value.trunc() && value.is_finite() {
        format!("{value:.1}")
    } else {
        format!("{value}")
    }
}

fn json_option_number(value: Option<usize>) -> String {
    value.map_or_else(|| "null".to_string(), |inner| inner.to_string())
}

fn json_option_str(value: Option<&str>) -> String {
    value.map_or_else(|| "null".to_string(), |inner| format!("\"{inner}\""))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ObjectiveLocation {
    pub start: usize,
    pub end: usize,
    pub strand: Option<i8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ObjectiveEntry {
    pub objective: String,
    pub passes: bool,
    pub score: f64,
    pub message: String,
    pub locations: Vec<ObjectiveLocation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ObjectivesReport {
    pub entries: Vec<ObjectiveEntry>,
    pub total_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WggwSiteInfo {
    pub position: usize,
    pub motif: String,
    pub distance_from_split: usize,
    pub original_codons: [String; 2],
    pub new_codons: [String; 2],
}

/// The finished design, matching `ProcessResult` in python/contracts.py.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessResult {
    pub name: String,
    pub original_sequence: String,
    pub optimized_sequence: String,
    pub seq5: String,
    pub seq3: String,
    pub split_point: usize,
    pub used_wggw_as_split: bool,
    pub objectives_before: String,
    pub objectives_after: String,
    pub objectives_report_before: ObjectivesReport,
    pub objectives_report_after: ObjectivesReport,
    pub wggw_info: Option<BTreeMap<String, WggwSiteInfo>>,
    pub processing_time_seconds: f64,
    pub seed: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn options_round_trip_through_python_field_names() {
        let json = r#"{
            "codon_optimize": "human",
            "minimize_CpGs": true,
            "minimize_CpGs_weight": 2.5,
            "stim_5": true,
            "split_point": 45
        }"#;
        let options: ProcessOptions = serde_json::from_str(json).unwrap();
        assert_eq!(options.codon_optimize.as_deref(), Some("human"));
        assert!(options.minimize_cpgs);
        assert_eq!(options.minimize_cpgs_weight, 2.5);
        assert!(options.stim_5);
        assert_eq!(options.split_point, Some(45));
        // Unmentioned fields fall back to the Python defaults.
        assert!(options.enforce_gc);
        assert_eq!(options.codon_optimize_weight, 1.0);
    }

    #[test]
    fn seed_payload_sorts_keys_and_omits_the_seed() {
        let options = ProcessOptions {
            codon_optimize: Some("human".to_string()),
            seed: Some(42),
            ..ProcessOptions::default()
        };
        let payload = options.canonical_seed_payload("ATG");
        assert!(payload.starts_with("[\"ATG\", {"));
        assert!(!payload.contains("\"seed\""));
        // Keys ascend: codon_optimize, enforce_gc, then ensure_wggw.
        let codon = payload.find("codon_optimize").unwrap();
        let gc = payload.find("enforce_gc").unwrap();
        let ensure = payload.find("ensure_wggw").unwrap();
        assert!(codon < gc && gc < ensure, "keys not sorted: {payload}");
    }

    #[test]
    fn whole_floats_keep_their_decimal_point_like_python() {
        assert_eq!(json_float(1.0), "1.0");
        assert_eq!(json_float(2.5), "2.5");
    }

    #[test]
    fn the_seed_payload_matches_pythons_json_dumps() {
        // Captured from json.dumps([CDS, options], sort_keys=True) in Python.
        let options = ProcessOptions {
            codon_optimize: Some("human".to_string()),
            remove_cryptic_ss: true,
            minimize_cpgs: true,
            reduce_kmer_complexity: true,
            enforce_gc: true,
            ensure_wggw: true,
            ..ProcessOptions::default()
        };
        assert_eq!(
            options.canonical_seed_payload("ATG"),
            "[\"ATG\", {\"codon_optimize\": \"human\", \"codon_optimize_weight\": 1.0, \"enforce_gc\": true, \"ensure_wggw\": true, \"minimize_CpGs\": true, \"minimize_CpGs_weight\": 1.0, \"reduce_kmer_complexity\": true, \"reduce_kmer_complexity_weight\": 1.0, \"remove_cryptic_ss\": true, \"remove_cryptic_ss_weight\": 1.0, \"selected_wggw_site\": null, \"split_point\": null, \"stim_3\": false, \"stim_5\": false, \"wggw_threshold\": 0}]"
        );
    }
}
