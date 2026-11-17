//! The isoform identity matrices the gene corpus stores.
//!
//!     cargo run --release --quiet --example isoform-identities < in.json > out.json
//!
//! `scripts/build-gene-corpus.ts` runs this; nothing else needs to. It reads
//! a JSON array with one entry per gene, each an array of protein sequences
//! (the isoforms the gene page's matrix shows, in display order — the
//! TypeScript `selectIdentityIsoforms` picks them, so the choice lives in one
//! place), and writes an array of the same length: each gene's upper
//! triangle of identities in tenths of a percent
//! ([`identity_triangle_permille`]).
//!
//! Native rather than an export of the .wasm: only the corpus build needs
//! alignments, and every export is bytes every visitor downloads.
//!
//! Genes are independent, so they are spread over all cores (or
//! `ISOFORM_IDENTITY_THREADS`), largest first so one big gene does not
//! finish alone at the end.

use std::io::{BufWriter, Read, Write};
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

use rej_optimizer::align::identity_triangle_permille;

fn threads() -> usize {
    std::env::var("ISOFORM_IDENTITY_THREADS")
        .ok()
        .and_then(|v| v.parse().ok())
        .filter(|&n| n > 0)
        .unwrap_or_else(|| thread::available_parallelism().map_or(1, usize::from))
}

/// Dynamic programming cells for every pair: a rough cost, for ordering.
fn cost(proteins: &[String]) -> usize {
    proteins
        .iter()
        .enumerate()
        .flat_map(|(i, a)| proteins[i + 1..].iter().map(move |b| a.len() * b.len()))
        .sum()
}

fn main() {
    let mut input = String::new();
    std::io::stdin()
        .read_to_string(&mut input)
        .expect("read stdin");
    let genes: Vec<Vec<String>> = serde_json::from_str(&input).expect("a JSON array of arrays");

    let mut order: Vec<usize> = (0..genes.len()).collect();
    order.sort_by_key(|&g| std::cmp::Reverse(cost(&genes[g])));

    let next = AtomicUsize::new(0);
    let results: Mutex<Vec<Option<Vec<u16>>>> = Mutex::new(vec![None; genes.len()]);
    thread::scope(|scope| {
        for _ in 0..threads().min(genes.len().max(1)) {
            scope.spawn(|| {
                while let Some(&g) = order.get(next.fetch_add(1, Ordering::Relaxed)) {
                    let seqs: Vec<&[u8]> = genes[g].iter().map(String::as_bytes).collect();
                    let triangle = identity_triangle_permille(&seqs);
                    results.lock().expect("no panics hold the lock")[g] = Some(triangle);
                }
            });
        }
    });

    let results: Vec<Vec<u16>> = results
        .into_inner()
        .expect("no panics hold the lock")
        .into_iter()
        .map(|r| r.expect("every gene aligned"))
        .collect();
    let mut out = BufWriter::new(std::io::stdout().lock());
    serde_json::to_writer(&mut out, &results).expect("write stdout");
    writeln!(out)
        .and_then(|()| out.flush())
        .expect("write stdout");
}
