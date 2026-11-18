//! Fixed-length DNA pattern matching.
//!
//! The REJ design only ever avoids patterns of one shape: a run of single
//! positions, each allowing a set of bases, written as a regex like
//! `[CT]{2}[ACGT][CT]AG[GA]T`. Every such pattern has a fixed length, so a
//! four-bit mask per position and a sliding window replaces a regex engine —
//! smaller in a browser and faster than backtracking.
//!
//! Two DNAChisel behaviours are reproduced deliberately:
//!
//!   * **Overlapping matches count.** DNAChisel re-searches from one base past
//!     each match, so `AGGA` inside `AGGAGGA` is found twice. Scores are
//!     `-match_count`, so missing overlaps would change them.
//!   * **Both strands are searched** when the location has no strand, with
//!     reverse-strand hits reported against forward coordinates.

/// One position of a pattern: a bitmask over A, C, G, T.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BaseMask(u8);

const A: u8 = 1;
const C: u8 = 2;
const G: u8 = 4;
const T: u8 = 8;

impl BaseMask {
    fn from_base(base: u8) -> Option<Self> {
        match base {
            b'A' => Some(Self(A)),
            b'C' => Some(Self(C)),
            b'G' => Some(Self(G)),
            b'T' => Some(Self(T)),
            _ => None,
        }
    }

    fn matches(self, base: u8) -> bool {
        Self::from_base(base).is_some_and(|b| self.0 & b.0 != 0)
    }

    fn complement(self) -> Self {
        let mut out = 0;
        if self.0 & A != 0 {
            out |= T;
        }
        if self.0 & T != 0 {
            out |= A;
        }
        if self.0 & G != 0 {
            out |= C;
        }
        if self.0 & C != 0 {
            out |= G;
        }
        Self(out)
    }
}

/// A fixed-length pattern, kept alongside the expression it was parsed from so
/// evaluations can be labelled exactly as DNAChisel labels them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pattern {
    pub expression: String,
    masks: Vec<BaseMask>,
}

impl Pattern {
    /// Parse the fixed-length subset of regex the design uses: plain bases,
    /// `[...]` classes and `{n}` repeats. Anything else is rejected rather
    /// than silently mismatched.
    pub fn parse(expression: &str) -> Result<Self, String> {
        let bytes = expression.as_bytes();
        let mut masks: Vec<BaseMask> = Vec::new();
        let mut index = 0;

        while index < bytes.len() {
            let mask = match bytes[index] {
                b'[' => {
                    let close = expression[index..]
                        .find(']')
                        .map(|offset| index + offset)
                        .ok_or_else(|| format!("unclosed '[' in pattern {expression:?}"))?;
                    let mut combined = 0u8;
                    for base in &bytes[index + 1..close] {
                        let single = BaseMask::from_base(*base)
                            .ok_or_else(|| format!("unsupported base {:?}", *base as char))?;
                        combined |= single.0;
                    }
                    index = close + 1;
                    BaseMask(combined)
                }
                base => {
                    let mask = BaseMask::from_base(base)
                        .ok_or_else(|| format!("unsupported base {:?}", base as char))?;
                    index += 1;
                    mask
                }
            };

            // A `{n}` suffix repeats the position just parsed.
            let mut repeat = 1usize;
            if index < bytes.len() && bytes[index] == b'{' {
                let close = expression[index..]
                    .find('}')
                    .map(|offset| index + offset)
                    .ok_or_else(|| format!("unclosed '{{' in pattern {expression:?}"))?;
                repeat = expression[index + 1..close]
                    .parse()
                    .map_err(|_| format!("unsupported repeat in pattern {expression:?}"))?;
                index = close + 1;
            }
            masks.extend(std::iter::repeat_n(mask, repeat));
        }

        if masks.is_empty() {
            return Err(format!("empty pattern {expression:?}"));
        }
        Ok(Self {
            expression: expression.to_string(),
            masks,
        })
    }

    pub fn size(&self) -> usize {
        self.masks.len()
    }

    /// Reverse complement of the pattern, for searching the other strand.
    fn reverse_complement(&self) -> Self {
        Self {
            expression: self.expression.clone(),
            masks: self.masks.iter().rev().map(|m| m.complement()).collect(),
        }
    }

    fn matches_at(&self, sequence: &[u8], start: usize) -> bool {
        self.masks
            .iter()
            .enumerate()
            .all(|(offset, mask)| mask.matches(sequence[start + offset]))
    }

    /// Start positions of every match within `sequence[start..end]`, including
    /// overlapping ones, in ascending order.
    fn match_starts(&self, sequence: &[u8], start: usize, end: usize) -> Vec<usize> {
        let size = self.size();
        if end < start + size {
            return Vec::new();
        }
        (start..=end - size)
            .filter(|&position| self.matches_at(sequence, position))
            .collect()
    }

    /// Matches within `[start, end)` as forward-coordinate
    /// `(start, end, strand)` triples.
    ///
    /// `strand` selects which strands are searched: 1 forward, -1 reverse, 0
    /// both (forward first). The REJ design always passes 1, so a CpG is
    /// counted once rather than twice; the other arms exist because
    /// DNAChisel supports them and the port is checked against it.
    pub fn find_matches(
        &self,
        sequence: &str,
        start: usize,
        end: usize,
        strand: i8,
    ) -> Vec<(usize, usize, i8)> {
        let bytes = sequence.as_bytes();
        let end = end.min(bytes.len());
        let size = self.size();

        let forward = || {
            self.match_starts(bytes, start, end)
                .into_iter()
                .map(move |position| (position, position + size, 1i8))
        };
        // DNAChisel searches the reverse complement of the *subsequence* and
        // maps hits back, which lands on the same spans as scanning the
        // forward strand with the complemented pattern. Scanning the reverse
        // complement left to right walks the forward strand right to left, so
        // the hits come out descending — and since this order decides which
        // regions the solver optimizes first, it has to be preserved.
        let reverse = || {
            self.reverse_complement()
                .match_starts(bytes, start, end)
                .into_iter()
                .rev()
                .map(move |position| (position, position + size, -1i8))
        };

        match strand {
            1 => forward().collect(),
            -1 => reverse().collect(),
            _ => forward().chain(reverse()).collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bases_classes_and_repeats() {
        assert_eq!(Pattern::parse("CG").unwrap().size(), 2);
        assert_eq!(Pattern::parse("GT[AG]A").unwrap().size(), 4);
        // Two from {2}, then one each for the rest.
        assert_eq!(
            Pattern::parse("[CT]{2}[ACGT][CT]AG[GA]T").unwrap().size(),
            8
        );
    }

    #[test]
    fn rejects_patterns_it_cannot_represent() {
        assert!(Pattern::parse("A+").is_err());
        assert!(Pattern::parse("[AC").is_err());
        assert!(Pattern::parse("").is_err());
    }

    #[test]
    fn finds_overlapping_matches() {
        // AGGA appears at 0 and 3; a non-overlapping scan would miss the second.
        let pattern = Pattern::parse("[AT]GG[AT]").unwrap();
        let hits = pattern.find_matches("AGGAGGA", 0, 7, 1);
        assert_eq!(hits, vec![(0, 4, 1), (3, 7, 1)]);
    }

    #[test]
    fn searches_both_strands_when_strand_is_zero() {
        // CG is its own reverse complement, so each hit is reported twice:
        // once per strand, exactly as DNAChisel counts it.
        let pattern = Pattern::parse("CG").unwrap();
        let hits = pattern.find_matches("ACGT", 0, 4, 0);
        assert_eq!(hits, vec![(1, 3, 1), (1, 3, -1)]);
    }

    #[test]
    fn reverse_strand_hits_use_forward_coordinates() {
        // GTAA on the reverse strand reads TTAC forward.
        let pattern = Pattern::parse("GT[AG]A").unwrap();
        let hits = pattern.find_matches("TTAC", 0, 4, 0);
        assert_eq!(hits, vec![(0, 4, -1)]);
    }

    #[test]
    fn reverse_strand_hits_come_back_descending() {
        // Scanning the reverse complement left to right reaches the rightmost
        // forward hit first, and DNAChisel keeps that order.
        let pattern = Pattern::parse("GT[AG]A").unwrap();
        let hits = pattern.find_matches("TTACTTAC", 0, 8, -1);
        assert_eq!(hits, vec![(4, 8, -1), (0, 4, -1)]);
    }

    #[test]
    fn respects_the_search_window() {
        let pattern = Pattern::parse("CG").unwrap();
        assert!(pattern.find_matches("ACGT", 2, 4, 1).is_empty());
        assert_eq!(pattern.find_matches("ACGT", 1, 4, 1), vec![(1, 3, 1)]);
    }
}
