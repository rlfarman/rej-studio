//! Global protein alignment for the isoform identity matrix.
//!
//! Needleman–Wunsch with Gotoh's affine gaps, scored with BLOSUM62 and the
//! BLAST protein defaults: a gap of `k` residues costs `GAP_OPEN + k *
//! GAP_EXTEND` = `11 + k`. (Biopython's `PairwiseAligner` counts the opening
//! residue separately, so the same scoring there is `open_gap_score = -12,
//! extend_gap_score = -1`.) End gaps are scored like any other gap, which is
//! the textbook global alignment and Biopython's default.
//!
//! # Which optimal alignment
//!
//! Several alignments often share the best score and differ in how many
//! identical residues they line up, so "the identity of the alignment"
//! depends on a tie-break that aligners rarely document. This one is
//! explicit: among the highest-scoring alignments it takes the one with the
//! most identical pairs, then the most aligned pairs (the fewest columns).
//! Every quantity is additive along the path, so the dynamic programming
//! maximises the triple `(score, identities, pairs)` lexicographically and
//! never needs a traceback. That keeps memory linear in the shorter sequence
//! and makes the result exactly symmetric in its two arguments.
//!
//! The triple is packed into one `i64` — score in the high bits, the two
//! counts in 20-bit fields below it — so a cell update is a handful of
//! integer adds and maxes. Comparing packed values compares the triples
//! lexicographically because both counts stay in `0..2^20`.

/// Cost of opening a gap, on top of the per-residue extension (BLAST's
/// "existence" cost for protein searches with BLOSUM62).
pub const GAP_OPEN: i32 = 11;
/// Cost of each residue in a gap, including the first.
pub const GAP_EXTEND: i32 = 1;

/// Longest sequence the packed cell can count. Titin, the longest human
/// protein, is about 35,000 residues.
pub const MAX_LEN: usize = (1 << COUNT_BITS) - 1;

const COUNT_BITS: u32 = 20;
const COUNT_MASK: i64 = (1 << COUNT_BITS) - 1;
const SCORE_SHIFT: u32 = 2 * COUNT_BITS;
/// Far below any reachable cell, with headroom so subtracting gap costs from
/// it cannot overflow.
const NEG_INF: i64 = i64::MIN / 4;

/// BLOSUM62 in NCBI order, as distributed with BLAST and Biopython.
const ALPHABET: &[u8; 24] = b"ARNDCQEGHILKMFPSTWYVBZX*";
#[rustfmt::skip]
const BLOSUM62: [[i8; 24]; 24] = [
    [ 4,-1,-2,-2, 0,-1,-1, 0,-2,-1,-1,-1,-1,-2,-1, 1, 0,-3,-2, 0,-2,-1, 0,-4], // A
    [-1, 5, 0,-2,-3, 1, 0,-2, 0,-3,-2, 2,-1,-3,-2,-1,-1,-3,-2,-3,-1, 0,-1,-4], // R
    [-2, 0, 6, 1,-3, 0, 0, 0, 1,-3,-3, 0,-2,-3,-2, 1, 0,-4,-2,-3, 3, 0,-1,-4], // N
    [-2,-2, 1, 6,-3, 0, 2,-1,-1,-3,-4,-1,-3,-3,-1, 0,-1,-4,-3,-3, 4, 1,-1,-4], // D
    [ 0,-3,-3,-3, 9,-3,-4,-3,-3,-1,-1,-3,-1,-2,-3,-1,-1,-2,-2,-1,-3,-3,-2,-4], // C
    [-1, 1, 0, 0,-3, 5, 2,-2, 0,-3,-2, 1, 0,-3,-1, 0,-1,-2,-1,-2, 0, 3,-1,-4], // Q
    [-1, 0, 0, 2,-4, 2, 5,-2, 0,-3,-3, 1,-2,-3,-1, 0,-1,-3,-2,-2, 1, 4,-1,-4], // E
    [ 0,-2, 0,-1,-3,-2,-2, 6,-2,-4,-4,-2,-3,-3,-2, 0,-2,-2,-3,-3,-1,-2,-1,-4], // G
    [-2, 0, 1,-1,-3, 0, 0,-2, 8,-3,-3,-1,-2,-1,-2,-1,-2,-2, 2,-3, 0, 0,-1,-4], // H
    [-1,-3,-3,-3,-1,-3,-3,-4,-3, 4, 2,-3, 1, 0,-3,-2,-1,-3,-1, 3,-3,-3,-1,-4], // I
    [-1,-2,-3,-4,-1,-2,-3,-4,-3, 2, 4,-2, 2, 0,-3,-2,-1,-2,-1, 1,-4,-3,-1,-4], // L
    [-1, 2, 0,-1,-3, 1, 1,-2,-1,-3,-2, 5,-1,-3,-1, 0,-1,-3,-2,-2, 0, 1,-1,-4], // K
    [-1,-1,-2,-3,-1, 0,-2,-3,-2, 1, 2,-1, 5, 0,-2,-1,-1,-1,-1, 1,-3,-1,-1,-4], // M
    [-2,-3,-3,-3,-2,-3,-3,-3,-1, 0, 0,-3, 0, 6,-4,-2,-2, 1, 3,-1,-3,-3,-1,-4], // F
    [-1,-2,-2,-1,-3,-1,-1,-2,-2,-3,-3,-1,-2,-4, 7,-1,-1,-4,-3,-2,-2,-1,-2,-4], // P
    [ 1,-1, 1, 0,-1, 0, 0, 0,-1,-2,-2, 0,-1,-2,-1, 4, 1,-3,-2,-2, 0, 0, 0,-4], // S
    [ 0,-1, 0,-1,-1,-1,-1,-2,-2,-1,-1,-1,-1,-2,-1, 1, 5,-2,-2, 0,-1,-1, 0,-4], // T
    [-3,-3,-4,-4,-2,-2,-3,-2,-2,-3,-2,-3,-1, 1,-4,-3,-2,11, 2,-3,-4,-3,-2,-4], // W
    [-2,-2,-2,-3,-2,-1,-2,-3, 2,-1,-1,-2,-1, 3,-3,-2,-2, 2, 7,-1,-3,-2,-1,-4], // Y
    [ 0,-3,-3,-3,-1,-2,-2,-3,-3, 3, 1,-2, 1,-1,-2,-2, 0,-3,-1, 4,-3,-2,-1,-4], // V
    [-2,-1, 3, 4,-3, 0, 1,-1, 0,-3,-4, 0,-3,-3,-2, 0,-1,-4,-3,-3, 4, 1,-1,-4], // B
    [-1, 0, 0, 1,-3, 3, 4,-2, 0,-3,-3, 1,-1,-3,-1, 0,-1,-3,-2,-2, 1, 4,-1,-4], // Z
    [ 0,-1,-1,-1,-2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-2, 0, 0,-2,-1,-1,-1,-1,-1,-4], // X
    [-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4, 1], // *
];

/// Row/column of a residue in [`BLOSUM62`]. Lower case is folded to upper;
/// anything outside the alphabet (selenocysteine `U`, pyrrolysine `O`, stray
/// symbols) scores as `X`. Identity is still decided on the letters
/// themselves, so `U` matches `U` but not `O`.
const fn code(residue: u8) -> u8 {
    let upper = residue.to_ascii_uppercase();
    let mut i = 0;
    while i < ALPHABET.len() {
        if ALPHABET[i] == upper {
            return i as u8;
        }
        i += 1;
    }
    22 // X
}

const CODES: [u8; 256] = {
    let mut table = [0u8; 256];
    let mut b = 0;
    while b < 256 {
        table[b] = code(b as u8);
        b += 1;
    }
    table
};

/// BLOSUM62 score of two residues.
pub fn substitution(a: u8, b: u8) -> i32 {
    i32::from(BLOSUM62[usize::from(CODES[usize::from(a)])][usize::from(CODES[usize::from(b)])])
}

fn same(a: u8, b: u8) -> bool {
    a.eq_ignore_ascii_case(&b)
}

/// The best global alignment of two proteins, summarised.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Alignment {
    /// BLOSUM62 score with affine gaps.
    pub score: i32,
    /// Columns pairing two identical residues.
    pub identities: u32,
    /// Columns pairing two residues, identical or not (everything but gaps).
    pub aligned_pairs: u32,
    pub len_a: u32,
    pub len_b: u32,
}

impl Alignment {
    /// Alignment length: every residue of both sequences appears in exactly
    /// one column, and an aligned pair shares one.
    pub fn columns(&self) -> u32 {
        self.len_a + self.len_b - self.aligned_pairs
    }

    /// Identical positions over the shorter sequence's length: "how much of
    /// the smaller isoform is found, unchanged, in the larger one". 100 for a
    /// pure truncation or a clean exon skip.
    pub fn percent_of_shorter(&self) -> f64 {
        percent(self.identities, self.len_a.min(self.len_b))
    }

    /// Identical positions over the longer sequence's length, the denominator
    /// the gene page's retired prefix/suffix proxy used.
    pub fn percent_of_longer(&self) -> f64 {
        percent(self.identities, self.len_a.max(self.len_b))
    }

    /// Identical positions over alignment columns (gaps included), the
    /// "identity" EMBOSS `needle` reports.
    pub fn percent_of_columns(&self) -> f64 {
        percent(self.identities, self.columns())
    }

    /// [`percent_of_columns`](Self::percent_of_columns) in tenths of a
    /// percent, rounded half up: the integer the gene corpus stores. Integer
    /// arithmetic, so a stored value never depends on float rounding.
    pub fn permille_of_columns(&self) -> u16 {
        let columns = u64::from(self.columns());
        if columns == 0 {
            return 1000;
        }
        let rounded = (2000 * u64::from(self.identities) + columns) / (2 * columns);
        // identities <= columns, so this is at most 1000 and the cast is exact.
        rounded as u16
    }
}

fn percent(count: u32, total: u32) -> f64 {
    if total == 0 {
        100.0
    } else {
        f64::from(count) * 100.0 / f64::from(total)
    }
}

const fn pack(score: i64, identities: i64, pairs: i64) -> i64 {
    (score << SCORE_SHIFT) + (identities << COUNT_BITS) + pairs
}

/// Score of a gap `len` residues long, as a packed cell.
fn gap(len: usize) -> i64 {
    // `len` is at most MAX_LEN, so the cast is exact.
    pack(
        -i64::from(GAP_OPEN) - i64::from(GAP_EXTEND) * len as i64,
        0,
        0,
    )
}

const EXTEND: i64 = pack(GAP_EXTEND as i64, 0, 0);
const OPEN_EXTEND: i64 = pack((GAP_OPEN + GAP_EXTEND) as i64, 0, 0);

/// Align two protein sequences (one-letter codes, `*` for stop).
///
/// Identical sequences cost one comparison, and the longest identical
/// prefix and suffix are scored directly so only the differing middles go
/// through the dynamic programming. The tests check the shortcut against
/// [`align_exhaustive`] on every isoform pair in the sample corpus.
///
/// # Panics
///
/// If either sequence is longer than [`MAX_LEN`].
pub fn align(a: &[u8], b: &[u8]) -> Alignment {
    assert!(
        a.len() <= MAX_LEN && b.len() <= MAX_LEN,
        "sequence too long"
    );
    let prefix = a.iter().zip(b).take_while(|(x, y)| same(**x, **y)).count();
    let suffix = a[prefix..]
        .iter()
        .rev()
        .zip(b[prefix..].iter().rev())
        .take_while(|(x, y)| same(**x, **y))
        .count();

    let core = dp(&a[prefix..a.len() - suffix], &b[prefix..b.len() - suffix]);
    let anchored: i64 = a[..prefix]
        .iter()
        .chain(&a[a.len() - suffix..])
        .map(|&r| i64::from(substitution(r, r)))
        .sum();
    let kept = (prefix + suffix) as i64;
    unpack(core + pack(anchored, kept, kept), a.len(), b.len())
}

/// [`align`] without the prefix/suffix shortcut: the whole of both sequences
/// goes through the dynamic programming. For tests and benchmarks.
///
/// # Panics
///
/// If either sequence is longer than [`MAX_LEN`].
pub fn align_exhaustive(a: &[u8], b: &[u8]) -> Alignment {
    assert!(
        a.len() <= MAX_LEN && b.len() <= MAX_LEN,
        "sequence too long"
    );
    unpack(dp(a, b), a.len(), b.len())
}

fn unpack(cell: i64, len_a: usize, len_b: usize) -> Alignment {
    // Lengths are at most MAX_LEN and the score's magnitude is bounded by
    // 11 × (len_a + len_b + 1), so every cast below is exact.
    Alignment {
        score: (cell >> SCORE_SHIFT) as i32,
        identities: ((cell >> COUNT_BITS) & COUNT_MASK) as u32,
        aligned_pairs: (cell & COUNT_MASK) as u32,
        len_a: len_a as u32,
        len_b: len_b as u32,
    }
}

/// Gotoh's three-state recurrence in linear space, returning the packed
/// best `(score, identities, pairs)` for aligning all of `a` with all of `b`.
fn dp(a: &[u8], b: &[u8]) -> i64 {
    // Rows over the longer sequence, columns over the shorter, so the two
    // rolling arrays are as short as possible.
    let (rows, cols) = if a.len() >= b.len() { (a, b) } else { (b, a) };
    let m = cols.len();
    if m == 0 {
        return if rows.is_empty() { 0 } else { gap(rows.len()) };
    }

    // Query profile: for each distinct residue in `rows`, its packed
    // substitution value against every column, so the inner loop is one
    // sequential load instead of two table lookups and a comparison.
    let mut slot = [usize::MAX; 256];
    let mut profile: Vec<i64> = Vec::new();
    for &r in rows {
        if slot[usize::from(r)] == usize::MAX {
            slot[usize::from(r)] = profile.len();
            profile.extend(
                cols.iter()
                    .map(|&c| pack(i64::from(substitution(r, c)), i64::from(same(r, c)), 1)),
            );
        }
    }

    // h[j]: best alignment of the rows so far with cols[..j].
    // f[j]: the same, constrained to end in a gap in `cols` (a vertical gap).
    let mut h: Vec<i64> = (0..=m).map(|j| if j == 0 { 0 } else { gap(j) }).collect();
    let mut f: Vec<i64> = vec![NEG_INF; m + 1];

    for (i, &r) in rows.iter().enumerate() {
        let start = slot[usize::from(r)];
        let sub = &profile[start..start + m];
        let mut diag = h[0];
        h[0] = gap(i + 1);
        let mut left = h[0];
        // e: best ending in a gap in `rows` (a horizontal gap) at this column.
        let mut e = NEG_INF;
        for ((hj, fj), &s) in h[1..].iter_mut().zip(&mut f[1..]).zip(sub) {
            let up = *hj;
            *fj = (*fj - EXTEND).max(up - OPEN_EXTEND);
            e = (e - EXTEND).max(left - OPEN_EXTEND);
            let best = (diag + s).max(e).max(*fj);
            diag = up;
            *hj = best;
            left = best;
        }
    }
    h[m]
}

/// Pairwise alignments of every isoform against every other, as a dense
/// row-major `n × n` matrix with `out[i * n + j]` aligning `sequences[i]`
/// (as `a`) with `sequences[j]`. Each distinct pair of distinct sequences is
/// aligned once; duplicates and the diagonal cost nothing.
pub fn identity_matrix(sequences: &[&[u8]]) -> Vec<Alignment> {
    let mut unique: Vec<&[u8]> = Vec::new();
    let index: Vec<usize> = sequences
        .iter()
        .map(|s| {
            unique.iter().position(|u| u == s).unwrap_or_else(|| {
                unique.push(s);
                unique.len() - 1
            })
        })
        .collect();

    let u = unique.len();
    let mut cache: Vec<Option<Alignment>> = vec![None; u * u];
    for x in 0..u {
        for y in x + 1..u {
            let found = align(unique[x], unique[y]);
            cache[x * u + y] = Some(found);
            cache[y * u + x] = Some(Alignment {
                len_a: found.len_b,
                len_b: found.len_a,
                ..found
            });
        }
    }

    index
        .iter()
        .flat_map(|&x| index.iter().map(move |&y| (x, y)))
        .map(|(x, y)| cache[x * u + y].unwrap_or_else(|| self_alignment(unique[x])))
        .collect()
}

/// The upper triangle of [`identity_matrix`] as
/// [`Alignment::permille_of_columns`], row-major: `(0, 1), (0, 2), …,
/// (0, n-1), (1, 2), …`. This is the `isoformIdentity.permille` array a gene
/// file stores for the isoforms the gene page's matrix shows, in that order.
pub fn identity_triangle_permille(sequences: &[&[u8]]) -> Vec<u16> {
    let n = sequences.len();
    let matrix = identity_matrix(sequences);
    (0..n)
        .flat_map(|i| (i + 1..n).map(move |j| (i, j)))
        .map(|(i, j)| matrix[i * n + j].permille_of_columns())
        .collect()
}

fn self_alignment(s: &[u8]) -> Alignment {
    let len = s.len() as u32;
    Alignment {
        score: s.iter().map(|&r| substitution(r, r)).sum(),
        identities: len,
        aligned_pairs: len,
        len_a: len,
        len_b: len,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blosum62_is_symmetric() {
        for (i, row) in BLOSUM62.iter().enumerate() {
            for (j, &v) in row.iter().enumerate() {
                assert_eq!(v, BLOSUM62[j][i]);
            }
        }
    }

    #[test]
    fn packing_orders_lexicographically() {
        assert!(pack(-3, 0, 0) > pack(-4, 999, 999));
        assert!(pack(5, 2, 0) > pack(5, 1, 999));
        let cell = unpack(pack(-7, 12, 34), 0, 0);
        assert_eq!(
            (cell.score, cell.identities, cell.aligned_pairs),
            (-7, 12, 34)
        );
    }

    #[test]
    fn unknown_letters_score_as_x() {
        assert_eq!(substitution(b'U', b'A'), 0);
        assert_eq!(substitution(b'a', b'A'), 4);
    }
}
