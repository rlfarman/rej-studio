//! The run record, ported from `python/run_record.py`.
//!
//! Every field is a fact about the run. Where the Rust build cannot know
//! something the Python one records (the DNAChisel and Python versions), the
//! field is left out rather than filled with a stand-in, and
//! `versions.runtime` says which runtime produced the record.

use std::collections::BTreeMap;

use sha2::{Digest, Sha256};

use crate::contract::{
    BuildInfo, ProcessOptions, RUNTIME_RUST, RunRecord, RunRecordInput, RunRecordVersions,
};

/// Incremented when the shape of a run record changes. Kept in step with
/// `RUN_RECORD_VERSION` in python/run_record.py: the shared fields are the
/// same, and readers tell the runtimes apart by `versions.runtime`.
pub const RUN_RECORD_VERSION: u32 = 1;

/// SHA-256 of a normalised sequence, hex-encoded.
pub(crate) fn sequence_digest(cds: &str) -> String {
    Sha256::digest(cds.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Describe one design run.
///
/// `cds` is the normalised sequence the optimizer ran on, `options` the
/// options as applied ([`ProcessOptions::applied`]), and `started_at_ms` the
/// wall-clock start in milliseconds since the Unix epoch.
pub(crate) fn build_run_record(
    cds: &str,
    options: &ProcessOptions,
    seed: u32,
    started_at_ms: f64,
    duration_seconds: f64,
    build: &BuildInfo,
) -> RunRecord {
    RunRecord {
        record_version: RUN_RECORD_VERSION,
        started_at: iso8601_utc(started_at_ms),
        duration_seconds: (duration_seconds * 1000.0).round() / 1000.0,
        seed,
        input: RunRecordInput {
            sha256: sequence_digest(cds),
            length: cds.len(),
        },
        options: recorded_options(options),
        versions: RunRecordVersions {
            runtime: RUNTIME_RUST.to_string(),
            optimizer: env!("CARGO_PKG_VERSION").to_string(),
            wasm_sha256: non_empty(build.wasm_sha256.as_deref()),
            commit: non_empty(build.commit.as_deref()),
        },
    }
}

/// The options as a sorted JSON map, without the seed: the seed the run used
/// is a field of its own, as in the Python record.
fn recorded_options(options: &ProcessOptions) -> BTreeMap<String, serde_json::Value> {
    let serde_json::Value::Object(map) = serde_json::to_value(options).unwrap_or_default() else {
        return BTreeMap::new();
    };
    map.into_iter().filter(|(key, _)| key != "seed").collect()
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

/// Format milliseconds since the Unix epoch as ISO 8601 UTC with
/// millisecond precision, e.g. `2026-11-16T09:30:00.250Z`.
///
/// Hand-rolled because the crate has no date dependency and needs only this
/// one conversion.
pub(crate) fn iso8601_utc(epoch_ms: f64) -> String {
    let total_ms = if epoch_ms.is_finite() {
        epoch_ms.round() as i64
    } else {
        0
    };
    let millis = total_ms.rem_euclid(1000);
    let seconds = total_ms.div_euclid(1000);
    let (year, month, day) = civil_from_days(seconds.div_euclid(86_400));
    let second_of_day = seconds.rem_euclid(86_400);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        second_of_day / 3600,
        second_of_day % 3600 / 60,
        second_of_day % 60,
    )
}

/// Days since 1970-01-01 to a proleptic Gregorian (year, month, day).
///
/// Howard Hinnant's `civil_from_days`
/// (<https://howardhinnant.github.io/date_algorithms.html#civil_from_days>).
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_are_iso8601_utc() {
        assert_eq!(iso8601_utc(0.0), "1970-01-01T00:00:00.000Z");
        assert_eq!(iso8601_utc(951_782_400_000.0), "2000-02-29T00:00:00.000Z");
        assert_eq!(iso8601_utc(1_700_000_000_250.0), "2023-11-14T22:13:20.250Z");
        assert_eq!(iso8601_utc(-1.0), "1969-12-31T23:59:59.999Z");
        assert_eq!(iso8601_utc(f64::NAN), "1970-01-01T00:00:00.000Z");
    }

    #[test]
    fn the_input_digest_matches_pythons() {
        // hashlib.sha256(b"ATGTGA").hexdigest()
        assert_eq!(
            sequence_digest("ATGTGA"),
            "e1210d89e61e7432bf32968a8c46b41bdf17736d4e91640c3a1ff60390c1f8f9"
        );
    }

    #[test]
    fn blank_build_facts_are_left_out() {
        let record = build_run_record(
            "ATG",
            &ProcessOptions::default().applied(),
            7,
            0.0,
            0.0,
            &BuildInfo {
                wasm_sha256: Some("  ".to_string()),
                commit: None,
            },
        );
        assert_eq!(record.versions.wasm_sha256, None);
        assert_eq!(record.versions.commit, None);
        let json = serde_json::to_value(&record).unwrap();
        let versions = json["versions"].as_object().unwrap();
        assert!(!versions.contains_key("wasm_sha256"));
        assert!(!versions.contains_key("commit"));
        assert!(!versions.contains_key("dnachisel"));
        assert!(!versions.contains_key("python"));
    }

    #[test]
    fn the_seed_is_kept_out_of_the_options() {
        let options = ProcessOptions {
            seed: Some(9),
            ..ProcessOptions::default()
        };
        let recorded = recorded_options(&options.applied());
        assert!(!recorded.contains_key("seed"));
        assert!(recorded.contains_key("minimize_CpGs"));
    }
}
