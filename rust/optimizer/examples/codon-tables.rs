//! Emit the codon-preference table the charts read, as a TypeScript module.
//!
//! The optimizer scores codons against the generated tables in `tables.rs`;
//! the design tool's codon charts and the splice slider's rewrite scores draw
//! the same numbers, so they take them from here rather than from a table of
//! their own. `scripts/build-optimizer-wasm.sh` writes the output to
//! `src/features/design-tool/utils/codon-preference.generated.ts`, and
//! `pnpm wasm:verify` checks it still matches the committed .wasm.
//!
//!   cargo run --release --example codon-tables

fn main() {
    let tables = rej_optimizer::codon_relative_preferences();

    println!("// GENERATED FILE — do not edit by hand.");
    println!("// Produced by `cargo run --example codon-tables` in rust/, through");
    println!("// scripts/build-optimizer-wasm.sh. `pnpm wasm:verify` checks these numbers");
    println!("// against the committed optimizer module.");
    println!("//");
    println!("// Each value is a codon's usage frequency divided by that of the most-used");
    println!("// synonym for its amino acid: 1 for the preferred codon, towards 0 for rare");
    println!("// ones. It is the ratio DNAChisel's CAI objective maximizes, so a chart drawn");
    println!("// from it is drawn from what the optimizer scored.");
    println!();
    println!("export const CODON_RELATIVE_PREFERENCE = {{");
    for (species, preferences) in &tables {
        println!("  {species}: {{");
        for (codon, preference) in preferences {
            println!("    {codon}: {preference:?},");
        }
        println!("  }},");
    }
    println!("}} as const satisfies Record<string, Record<string, number>>");
}
