/**
 * Upper bound on a gene symbol's length. HGNC and MGI symbols are short
 * (the longest are ~20 characters, e.g. RIKEN clone names like
 * `4933400A11Rik`); Ensembl clone-based names such as `AC012345.1` are
 * shorter still. Anything longer is not a symbol.
 */
export const MAX_GENE_SYMBOL_LENGTH = 40

// Letters, digits, and the punctuation that appears in HGNC/MGI/Ensembl
// symbols: `-` (HLA-A, MT-CO1), `.` (AC012345.1), `_` (Y_RNA), `@` (legacy
// gene-cluster symbols). Must start with a letter or digit.
const GENE_SYMBOL_PATTERN = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9._@-]{0,${MAX_GENE_SYMBOL_LENGTH - 1}}$`,
)

/**
 * Cheap shape check for a gene symbol taken from a URL, run before anything
 * that costs a database query or a cache entry. It says nothing about
 * whether the gene exists.
 */
export function isPlausibleGeneSymbol(value: string): boolean {
  return GENE_SYMBOL_PATTERN.test(value)
}
