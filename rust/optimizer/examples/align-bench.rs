//! Time the isoform aligner and compare it with the prefix/suffix proxy the
//! gene page used before it read stored alignments.
//!
//!     cargo run --release --example align-bench -- sample [SYMBOL...]
//!     cargo run --release --example align-bench -- corpus genes.jsonl [THREADS]
//!     cargo run --release --example align-bench -- verify genes.jsonl [THREADS]
//!
//! `sample` reads `public/gene-data/sample/genes/*.json`, times the named
//! genes (default NFE2L2, NF1, BRCA1) and compares every pair in the sample
//! with the proxy. `corpus` reads one JSON object per line,
//! `{"symbol", "species", "proteins": [...]}`, and times the whole thing on
//! `THREADS` threads (default: all cores), as a corpus build step would.
//! `verify` checks the prefix/suffix shortcut on every pair the page shows.

use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use rej_optimizer::align::{Alignment, align, align_exhaustive, identity_matrix};
use serde::Deserialize;

/// Isoforms the gene page's matrix shows, longest first
/// (`MAX_IDENTITY_ISOFORMS` in gene-search/corpus/identity.ts; this
/// skips its tie-break by transcript id, which timing does not need).
const UI_ISOFORMS: usize = 16;

struct Gene {
    name: String,
    /// In the corpus's order; the page sorts by length, stably.
    proteins: Vec<String>,
}

impl Gene {
    fn shown(&self) -> Vec<&[u8]> {
        let mut by_length: Vec<&[u8]> = self.proteins.iter().map(String::as_bytes).collect();
        by_length.sort_by_key(|p| std::cmp::Reverse(p.len()));
        by_length.truncate(UI_ISOFORMS);
        by_length
    }

    fn all(&self) -> Vec<&[u8]> {
        self.proteins.iter().map(String::as_bytes).collect()
    }
}

/// Port of the retired `proteinIdentity()` from isoform-identity-matrix.tsx:
/// shared prefix plus shared suffix, over the longer length.
fn proxy(a: &[u8], b: &[u8]) -> f64 {
    if a == b {
        return 100.0;
    }
    let (shorter, longer) = if a.len() <= b.len() { (a, b) } else { (b, a) };
    if shorter.is_empty() {
        return 0.0;
    }
    let prefix = shorter
        .iter()
        .zip(longer)
        .take_while(|(x, y)| x == y)
        .count();
    let suffix = shorter[prefix..]
        .iter()
        .rev()
        .zip(longer.iter().rev())
        .take_while(|(x, y)| x == y)
        .count();
    (prefix + suffix) as f64 / longer.len() as f64 * 100.0
}

fn load_sample() -> Vec<Gene> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Isoform {
        protein_sequence: String,
    }
    #[derive(Deserialize)]
    struct Json {
        symbol: String,
        species: String,
        isoforms: Vec<Isoform>,
    }
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../public/gene-data/sample/genes");
    let mut paths: Vec<_> = std::fs::read_dir(dir)
        .expect("sample corpus")
        .map(|e| e.unwrap().path())
        .collect();
    paths.sort();
    paths
        .into_iter()
        .map(|p| {
            let g: Json = serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap();
            Gene {
                name: format!("{} ({})", g.symbol, g.species),
                proteins: g.isoforms.into_iter().map(|i| i.protein_sequence).collect(),
            }
        })
        .collect()
}

fn load_jsonl(path: &str) -> Vec<Gene> {
    #[derive(Deserialize)]
    struct Line {
        #[serde(default)]
        id: String,
        symbol: String,
        species: String,
        proteins: Vec<String>,
    }
    std::fs::read_to_string(path)
        .expect("read corpus")
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            let g: Line = serde_json::from_str(l).unwrap();
            Gene {
                name: format!("{} {} ({})", g.symbol, g.id, g.species),
                proteins: g.proteins,
            }
        })
        .collect()
}

/// Dynamic-programming cells the full alignment would fill, before any
/// shortcut: the honest measure of how big a gene is.
fn cells(seqs: &[&[u8]]) -> u64 {
    let mut unique = seqs.to_vec();
    unique.sort();
    unique.dedup();
    let mut total = 0;
    for (i, a) in unique.iter().enumerate() {
        for b in &unique[i + 1..] {
            total += (a.len() * b.len()) as u64;
        }
    }
    total
}

fn time<T>(f: impl FnOnce() -> T) -> (T, Duration) {
    let start = Instant::now();
    let out = f();
    (out, start.elapsed())
}

fn exhaustive_matrix(seqs: &[&[u8]]) -> usize {
    let mut unique = seqs.to_vec();
    unique.sort();
    unique.dedup();
    let mut n = 0;
    for (i, a) in unique.iter().enumerate() {
        for b in &unique[i + 1..] {
            n += align_exhaustive(a, b).identities as usize;
        }
    }
    n
}

fn ms(d: Duration) -> String {
    format!("{:.1}", d.as_secs_f64() * 1e3)
}

fn timing(genes: &[Gene], symbols: &[String]) {
    println!("## Timing (single thread)\n");
    println!(
        "| gene | isoforms (distinct) | Mcells | full matrix ms | without shortcuts ms | top {UI_ISOFORMS} Mcells | top {UI_ISOFORMS} ms |"
    );
    println!("|---|---|---|---|---|---|---|");
    for symbol in symbols {
        let named = |g: &&Gene| g.name.starts_with(&format!("{symbol} "));
        let Some(gene) = genes
            .iter()
            .filter(named)
            .find(|g| g.name.ends_with("(human)"))
            .or_else(|| genes.iter().find(named))
        else {
            println!("| {symbol} | not found |");
            continue;
        };
        let all = gene.all();
        let shown = gene.shown();
        let mut distinct = all.clone();
        distinct.sort();
        distinct.dedup();
        // Best of three, so a cold cache or a scheduler hiccup doesn't count;
        // genes too big for that are timed once, and without the slow path.
        let huge = cells(&all) > 2_000_000_000;
        let best = |f: &dyn Fn()| {
            (0..if huge { 1 } else { 3 })
                .map(|_| time(f).1)
                .min()
                .unwrap()
        };
        let full = ms(best(&|| {
            std::hint::black_box(identity_matrix(&all));
        }));
        let exhaustive = if huge {
            "—".to_string()
        } else {
            ms(best(&|| {
                std::hint::black_box(exhaustive_matrix(&all));
            }))
        };
        let top = best(&|| {
            std::hint::black_box(identity_matrix(&shown));
        });
        println!(
            "| {} | {} ({}) | {:.0} | {} | {} | {:.0} | {} |",
            gene.name,
            all.len(),
            distinct.len(),
            cells(&all) as f64 / 1e6,
            full,
            exhaustive,
            cells(&shown) as f64 / 1e6,
            ms(top),
        );
    }
    println!();
}

struct Pair {
    gene: String,
    a: usize,
    b: usize,
    proxy: f64,
    found: Alignment,
}

fn compare(genes: &[Gene], label: &str, pick: fn(&Gene) -> Vec<&[u8]>) -> Vec<Pair> {
    let mut pairs = Vec::new();
    for gene in genes {
        let seqs = pick(gene);
        let n = seqs.len();
        let matrix = identity_matrix(&seqs);
        for i in 0..n {
            for j in i + 1..n {
                pairs.push(Pair {
                    gene: gene.name.clone(),
                    a: seqs[i].len(),
                    b: seqs[j].len(),
                    proxy: proxy(seqs[i], seqs[j]),
                    found: matrix[i * n + j],
                });
            }
        }
    }
    println!("## Alignment vs proxy, {label}: {} pairs\n", pairs.len());
    println!("| alignment identity over | mean Δ | |Δ| > 5 | |Δ| > 20 | max |Δ| |");
    println!("|---|---|---|---|---|");
    type Metric = fn(&Alignment) -> f64;
    let metrics: [(&str, Metric); 3] = [
        (
            "longer length (proxy's denominator)",
            Alignment::percent_of_longer,
        ),
        ("alignment columns", Alignment::percent_of_columns),
        ("shorter length", Alignment::percent_of_shorter),
    ];
    for (name, metric) in metrics {
        let deltas: Vec<f64> = pairs.iter().map(|p| metric(&p.found) - p.proxy).collect();
        let over = |t: f64| deltas.iter().filter(|d| d.abs() > t).count();
        let pct = |c: usize| 100.0 * c as f64 / pairs.len().max(1) as f64;
        println!(
            "| {name} | {:+.1} | {} ({:.0}%) | {} ({:.0}%) | {:.1} |",
            deltas.iter().sum::<f64>() / deltas.len().max(1) as f64,
            over(5.0),
            pct(over(5.0)),
            over(20.0),
            pct(over(20.0)),
            deltas.iter().fold(0.0f64, |m, d| m.max(d.abs())),
        );
    }
    // Same denominator as the proxy, so this isolates what the alignment
    // finds that prefix+suffix misses.
    let below = pairs
        .iter()
        .filter(|p| p.found.percent_of_longer() + 1e-9 < p.proxy)
        .count();
    println!("\nPairs where the alignment finds fewer identities than the proxy: {below}\n");
    pairs
}

fn examples(pairs: &mut [Pair], count: usize) {
    pairs.sort_by(|x, y| {
        let d = |p: &Pair| (p.found.percent_of_columns() - p.proxy).abs();
        d(y).total_cmp(&d(x))
    });
    println!("Largest moves (alignment columns vs proxy):\n");
    println!("| gene | lengths | proxy | identities | columns | % columns | % shorter |");
    println!("|---|---|---|---|---|---|---|");
    for p in pairs.iter().take(count) {
        println!(
            "| {} | {} / {} | {:.1} | {} | {} | {:.1} | {:.1} |",
            p.gene,
            p.a,
            p.b,
            p.proxy,
            p.found.identities,
            p.found.columns(),
            p.found.percent_of_columns(),
            p.found.percent_of_shorter(),
        );
    }
    println!();
}

fn parallel<'a>(
    genes: &'a [Gene],
    threads: usize,
    pick: fn(&'a Gene) -> Vec<&'a [u8]>,
    work: fn(&[&[u8]]),
) -> (Duration, Vec<(Duration, &'a str)>) {
    // Biggest first, so one large gene doesn't start last and run alone.
    let mut order: Vec<(u64, usize)> = genes
        .iter()
        .enumerate()
        .map(|(i, g)| (cells(&pick(g)), i))
        .collect();
    order.sort_unstable_by(|x, y| y.cmp(x));
    let next = AtomicUsize::new(0);
    let slowest = Mutex::new(Vec::new());
    let (_, wall) = time(|| {
        std::thread::scope(|s| {
            for _ in 0..threads {
                s.spawn(|| {
                    loop {
                        let k = next.fetch_add(1, Ordering::Relaxed);
                        let Some(&(_, i)) = order.get(k) else { break };
                        let seqs = pick(&genes[i]);
                        let (_, took) = time(|| work(&seqs));
                        if took > Duration::from_millis(100) {
                            slowest.lock().unwrap().push((took, genes[i].name.as_str()));
                        }
                    }
                });
            }
        });
    });
    let mut slowest = slowest.into_inner().unwrap();
    slowest.sort_unstable_by(|x, y| y.cmp(x));
    (wall, slowest)
}

/// Check the prefix/suffix shortcut against the full dynamic programming on
/// every pair the page would show.
fn verify(path: &str, threads: usize) {
    let genes = load_corpus(path);
    let (wall, _) = parallel(&genes, threads, Gene::shown, |seqs| {
        for (i, a) in seqs.iter().enumerate() {
            for b in &seqs[i + 1..] {
                assert_eq!(align(a, b), align_exhaustive(a, b));
            }
        }
    });
    println!(
        "shortcut matches the full alignment on every shown pair of {} genes ({:.1} s)",
        genes.len(),
        wall.as_secs_f64()
    );
}

fn load_corpus(path: &str) -> Vec<Gene> {
    let mut genes = load_jsonl(path);
    // The v1 corpus has one "gene" with an empty id and symbol holding
    // ~14,000 orphaned mouse isoforms; no gene page shows it.
    let orphans: Vec<String> = genes
        .iter()
        .filter(|g| g.proteins.len() > 1000)
        .map(|g| format!("{} ({} isoforms)", g.name, g.proteins.len()))
        .collect();
    genes.retain(|g| g.proteins.len() <= 1000);
    if !orphans.is_empty() {
        println!("Skipped as malformed: {}\n", orphans.join(", "));
    }
    genes
}

fn corpus(path: &str, threads: usize) {
    let genes = load_corpus(path);
    let total_all: u64 = genes.iter().map(|g| cells(&g.all())).sum();
    let total_shown: u64 = genes.iter().map(|g| cells(&g.shown())).sum();
    println!("{} genes, {threads} threads\n", genes.len());
    println!("| isoforms aligned | Gcells | wall s | slowest genes (ms) |");
    println!("|---|---|---|---|");
    for (label, total, pick) in [
        ("all", total_all, Gene::all as fn(&Gene) -> Vec<&[u8]>),
        ("top 16 (what the page shows)", total_shown, Gene::shown),
    ] {
        let (wall, slowest) = parallel(&genes, threads, pick, |seqs| {
            std::hint::black_box(identity_matrix(seqs));
        });
        let top: Vec<String> = slowest
            .iter()
            .take(5)
            .map(|(d, n)| format!("{n} {}", ms(*d)))
            .collect();
        println!(
            "| {label} | {:.1} | {:.1} | {} |",
            total as f64 / 1e9,
            wall.as_secs_f64(),
            top.join(", ")
        );
    }
    println!();
    timing(
        &genes,
        &["GOLGB1", "ANK2", "AKAP9", "KMT2C"].map(String::from),
    );
    let mut pairs = compare(&genes, "full corpus, top 16 per gene", Gene::shown);
    examples(&mut pairs, 10);
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("sample") => {
            let genes = load_sample();
            let symbols: Vec<String> = if args.len() > 1 {
                args[1..].to_vec()
            } else {
                ["NFE2L2", "NF1", "BRCA1"].map(String::from).to_vec()
            };
            timing(&genes, &symbols);
            compare(&genes, "sample, every pair", Gene::all);
            let mut pairs = compare(&genes, "sample, top 16 per gene", Gene::shown);
            examples(&mut pairs, 10);
        }
        Some("corpus" | "verify") if args.len() > 1 => {
            let threads = args.get(2).map_or_else(
                || std::thread::available_parallelism().map_or(1, usize::from),
                |t| t.parse().expect("THREADS"),
            );
            if args[0] == "corpus" {
                corpus(&args[1], threads);
            } else {
                verify(&args[1], threads);
            }
        }
        _ => {
            eprintln!(
                "usage: isoform_identity sample [SYMBOL...] | corpus|verify <genes.jsonl> [THREADS]"
            );
            std::process::exit(2);
        }
    }
}
