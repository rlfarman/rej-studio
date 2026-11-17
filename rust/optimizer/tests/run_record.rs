//! The Rust run record against the Python one and against the TypeScript
//! contract.
//!
//! Two fixtures:
//!
//!   * `python/tests/fixtures/process-result.json` is a real result from the
//!     Python backend. The facts both runtimes record (the input's digest and
//!     length, the seed, the shared options) must agree, so a design is
//!     identified the same way whichever runtime ran it.
//!   * `tests/fixtures/run_record.json` is a Rust record. The TypeScript
//!     schema test parses it (`backend-contract.test.ts`), so if this crate's
//!     record changes shape without the fixture, this test fails, and if the
//!     fixture changes without the schema, that one does.

use rej_optimizer::contract::{BuildInfo, ProcessOptions, RunRecord};
use serde_json::Value;

const PYTHON_RESULT: &str = include_str!("../../../python/tests/fixtures/process-result.json");
const RUST_RECORD: &str = include_str!("fixtures/run_record.json");

/// Run the design the Python fixture describes, with the options it recorded.
fn design_python_case() -> (Value, RunRecord) {
    let python: Value = serde_json::from_str(PYTHON_RESULT).expect("python fixture");
    let python_record = python["run_record"].clone();
    let mut options = python_record["options"].clone();
    // Python accepts keys the Rust port has no use for; they are all null or
    // false in this fixture, so dropping them changes nothing about the run.
    for unused in ["induce_optimal_ss", "split_points", "selected_wggw_sites"] {
        options.as_object_mut().unwrap().remove(unused);
    }
    options["seed"] = python_record["seed"].clone();
    let options: ProcessOptions = serde_json::from_value(options).expect("options");

    let cds = python["original_sequence"].as_str().unwrap();
    // What the worker passes in: the module's digest and the deployment's
    // commit. Test values, recognisably so.
    let build = BuildInfo {
        wasm_sha256: Some("ab".repeat(32)),
        commit: Some("0123456789abcdef0123456789abcdef01234567".to_string()),
    };
    let result = rej_optimizer::process_with_build(cds, "fixture", &options, &build, |_, _| {})
        .expect("design");
    (python_record, result.run_record)
}

#[test]
fn the_input_is_identified_as_python_identifies_it() {
    let (python, rust) = design_python_case();
    assert_eq!(rust.input.sha256, python["input"]["sha256"]);
    assert_eq!(rust.input.length as u64, python["input"]["length"]);
    assert_eq!(u64::from(rust.seed), python["seed"]);
    assert_eq!(rust.record_version as u64, python["record_version"]);
}

#[test]
fn shared_options_are_recorded_with_pythons_values() {
    let (python, rust) = design_python_case();
    let python_options = python["options"].as_object().unwrap();
    for (key, value) in &rust.options {
        let expected = python_options
            .get(key)
            .unwrap_or_else(|| panic!("Rust records {key}, which Python does not"));
        // Weights are floats in both; compare numerically so 1 and 1.0 agree.
        match (value.as_f64(), expected.as_f64()) {
            (Some(rust_number), Some(python_number)) => {
                assert_eq!(rust_number, python_number, "{key}")
            }
            _ => assert_eq!(value, expected, "{key}"),
        }
    }
}

#[test]
fn the_record_has_the_shape_the_typescript_schema_reads() {
    let (_, rust) = design_python_case();
    let mut actual = serde_json::to_value(&rust).unwrap();
    let expected: Value = serde_json::from_str(RUST_RECORD).expect("rust record fixture");

    // The clock and the build differ from run to run and host to host; the
    // fixture pins everything else.
    for key in ["started_at", "duration_seconds"] {
        actual[key] = expected[key].clone();
    }
    actual["versions"]["optimizer"] = expected["versions"]["optimizer"].clone();

    assert_eq!(
        actual,
        expected,
        "the Rust run record no longer matches tests/fixtures/run_record.json; \
         if the change is intended, update the fixture and runRecordSchema in \
         src/features/design-tool/types/backend-contract.ts together:\n{}",
        serde_json::to_string_pretty(&actual).unwrap()
    );
}
