/*
 * Ensembl IDs as people actually paste them: any case, and with or without
 * the version suffix Ensembl prints next to the id (`ENST00000269305.9`).
 * The corpus keys genes and transcripts by the unversioned uppercase id, so
 * `normalizeEnsemblId` turns a matched query into the key to look up.
 */

export const ENST_REGEX = /^(?:ENST|ENSMUST)\d+(?:\.\d+)?$/i
export const ENSG_REGEX = /^(?:ENSG|ENSMUSG)\d+(?:\.\d+)?$/i

/** An Ensembl id as the corpus stores it: uppercase, without its version. */
export function normalizeEnsemblId(id: string): string {
  return id
    .trim()
    .toUpperCase()
    .replace(/\.\d+$/, '')
}
