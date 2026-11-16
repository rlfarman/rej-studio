//! Time the optimizer on real coding sequences.
//!
//! Prints one JSON line per case so the numbers can be compared directly with
//! the Python and Pyodide runs (`scripts/bench-python.py` uses the same
//! sequences, options and seed).
//!
//!     cargo run --release --example bench -- cases.json

use std::time::Instant;

use rej_optimizer::contract::ProcessOptions;
use serde::Deserialize;

#[derive(Deserialize)]
struct Case {
    #[serde(alias = "id")]
    name: String,
    cds: String,
}

/// FNV-1a, matching scripts/wasm-harness.mjs so digests can be compared.
fn fnv1a(text: &str) -> String {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in text.bytes() {
        hash ^= u32::from(byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    format!("{hash:08x}")
}

fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| {
        eprintln!("usage: bench <cases.json>");
        std::process::exit(2);
    });
    let cases: Vec<Case> =
        serde_json::from_str(&std::fs::read_to_string(&path).expect("read cases"))
            .expect("parse cases");

    for case in cases {
        // Same options and seed as the Python benchmark, so the two runs do
        // comparable amounts of work.
        let options = ProcessOptions {
            codon_optimize: Some("human".to_string()),
            remove_cryptic_ss: true,
            minimize_cpgs: true,
            reduce_kmer_complexity: true,
            enforce_gc: true,
            ensure_wggw: true,
            seed: Some(1234),
            ..ProcessOptions::default()
        };

        let started = Instant::now();
        let result = rej_optimizer::process(&case.cds, &case.name, &options, |_, _| {})
            .unwrap_or_else(|error| panic!("{}: {error}", case.name));
        let elapsed = started.elapsed().as_secs_f64();

        let score = rej_optimizer::score_only(&result.optimized_sequence, &options)
            .expect("scoring the design")
            .total_score
            .unwrap_or(0.0);

        println!(
            "{}",
            serde_json::json!({
                "runtime": "rust",
                "name": case.name,
                "bp": case.cds.len(),
                "seconds": (elapsed * 100.0).round() / 100.0,
                "score": (score * 100.0).round() / 100.0,
                // Same digest the wasm harness prints, so the two builds can
                // be shown to produce identical designs.
                "optimized_sha": fnv1a(&result.optimized_sequence),
                "split_point": result.split_point,
            })
        );
    }
}
