//! Record this crate's WGGW answers for the TypeScript parity test.
//!
//! WGGW split sites are ranked twice: here, and in TypeScript
//! (`src/lib/bio/sequence-utils.ts`), which the gene pages use because they
//! never load the optimizer's WebAssembly. `sequence-utils.wggw-parity.test.ts`
//! holds the two to the same answers, and it reads them from the file this
//! writes rather than from the module — asking the module would mean shipping
//! an export every visitor downloads and no page calls.
//!
//! The inputs are every isoform in the committed sample corpus and the
//! crate's frozen DNAChisel fixtures. Rust CI reruns this and fails if the
//! committed file differs, so it cannot fall behind the crate.
//!
//!   cargo run --release --example wggw-reference

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};

/// How many of the distance-ordered candidates to record per split point.
///
/// The whole ordering is the same list in a different order, so recording all
/// of it for every split point would multiply the file by five for nothing.
/// The nearest few are what a split actually chooses between.
const ORDER_PREFIX: usize = 8;

fn main() {
    let repository = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("the crate sits two directories below the repository root")
        .to_path_buf();

    let mut sequences: Vec<(String, String)> = Vec::new();
    sequences.extend(sample_corpus(&repository));
    sequences.extend(fixtures(&repository));

    let entries: Vec<Value> = sequences
        .iter()
        .map(|(id, cds)| {
            let whole: WggwReport = report(cds, None);
            let by_split: BTreeMap<String, Value> = split_points(cds.len())
                .into_iter()
                .map(|split_point| {
                    let at: WggwReport = report(cds, Some(split_point));
                    let mut order = at.by_distance;
                    order.truncate(ORDER_PREFIX);
                    (
                        split_point.to_string(),
                        json!({
                            "nearest": order,
                            "inserted": at.inserted,
                            "split": at.split,
                        }),
                    )
                })
                .collect();
            json!({
                "id": id,
                "length": cds.len(),
                "candidates": whole.candidates,
                "at": by_split,
            })
        })
        .collect();

    let destination = repository.join("rust/optimizer/tests/fixtures/wggw_reference.json");
    let document = json!({
        "generated_by": "cargo run --release --example wggw-reference",
        "order_prefix": ORDER_PREFIX,
        "entries": entries,
    });
    fs::write(
        &destination,
        format!(
            "{}\n",
            serde_json::to_string(&document).expect("serializes")
        ),
    )
    .expect("the fixtures directory is writable");
    eprintln!(
        "wrote {} sequences to {}",
        sequences.len(),
        destination.display()
    );
}

/// The pieces of a `wggw_report` answer this file records.
struct WggwReport {
    candidates: Vec<usize>,
    by_distance: Vec<usize>,
    inserted: Value,
    split: Value,
}

fn report(cds: &str, split_point: Option<usize>) -> WggwReport {
    let request = match split_point {
        Some(split_point) => json!({ "sequence": cds, "split_point": split_point }),
        None => json!({ "sequence": cds }),
    };
    let answer: Value =
        serde_json::from_str(&rej_optimizer::wggw_report_json(&request.to_string()))
            .expect("the report is JSON");
    // The recoded sequence itself is left out: it is as long as the input, so
    // keeping one per split point made the file 2.3 MB, and the parity test
    // compares positions and codons, not sequences.
    let mut inserted = answer["inserted"].clone();
    if let Some(site) = inserted.as_object_mut() {
        site.remove("recoded");
    }
    WggwReport {
        candidates: serde_json::from_value(answer["candidates"].clone()).expect("candidates"),
        by_distance: serde_json::from_value(answer["by_distance"].clone()).expect("by_distance"),
        inserted,
        split: answer["split"].clone(),
    }
}

/// The split points each sequence is recorded at: the midpoint the form
/// defaults to, the thirds the two-fragment default uses, the ends, and the
/// point TypeScript's balance ranking is equivalent to — the rounded midpoint
/// less the two bases between a motif's start and the cut inside its GG
/// (`Math.round(length / 2) - 2`, rounding halves up as JavaScript does).
fn split_points(length: usize) -> Vec<usize> {
    vec![
        1,
        length / 3,
        length / 2,
        length * 2 / 3,
        length - 1,
        length.div_ceil(2).saturating_sub(2),
    ]
}

/// Every isoform coding sequence in `public/gene-data/sample`.
fn sample_corpus(repository: &Path) -> Vec<(String, String)> {
    let directory = repository.join("public/gene-data/sample/genes");
    let mut files: Vec<PathBuf> = fs::read_dir(&directory)
        .expect("the committed sample corpus is present")
        .map(|entry| entry.expect("readable directory entry").path())
        .collect();
    files.sort();

    let mut sequences = Vec::new();
    for file in files {
        let gene: Value =
            serde_json::from_str(&fs::read_to_string(&file).expect("readable gene file"))
                .expect("the gene file is JSON");
        let symbol = gene["symbol"].as_str().unwrap_or("?").to_string();
        for isoform in gene["isoforms"].as_array().into_iter().flatten() {
            let cds = isoform["codingSequence"].as_str().unwrap_or_default();
            if cds.len() < 6 {
                continue;
            }
            sequences.push((
                format!("{symbol}/{}", isoform["id"].as_str().unwrap_or("?")),
                cds.to_string(),
            ));
        }
    }
    sequences
}

/// The crate's frozen DNAChisel recordings.
fn fixtures(repository: &Path) -> Vec<(String, String)> {
    let directory = repository.join("rust/optimizer/tests/fixtures");
    let read = |name: &str, key: &str| -> Vec<(String, String)> {
        let cases: Vec<Value> =
            serde_json::from_str(&fs::read_to_string(directory.join(name)).expect("readable"))
                .expect("the fixture is a JSON array");
        cases
            .into_iter()
            .map(|case| {
                (
                    case[key].as_str().unwrap_or("?").to_string(),
                    case["sequence"].as_str().unwrap_or_default().to_string(),
                )
            })
            .filter(|(_, cds)| cds.len() >= 6)
            .collect()
    };
    [read("pipeline.json", "name"), read("real_genes.json", "id")].concat()
}
