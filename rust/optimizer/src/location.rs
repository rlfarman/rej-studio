//! A span of sequence, ported from `dnachisel.Location`.
//!
//! Half-open like Python slices: `Location::new(5, 10)` covers indices 5-9.
//! `strand` is 1, -1 or 0 ("either"), and is carried through to the result
//! report, so the frontend highlights the same spans as before.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub struct Location {
    pub start: usize,
    pub end: usize,
    pub strand: i8,
}

impl Location {
    pub fn new(start: usize, end: usize) -> Self {
        Self {
            start,
            end,
            strand: 0,
        }
    }

    pub fn with_strand(start: usize, end: usize, strand: i8) -> Self {
        Self { start, end, strand }
    }

    /// The overlapping span, or `None` when the two are disjoint.
    pub fn overlap(&self, other: &Location) -> Option<Location> {
        let start = self.start.max(other.start);
        let end = self.end.min(other.end);
        (start < end).then(|| Location::with_strand(start, end, self.strand))
    }

    /// Widen by `amount` on each side, clamped to `[0, limit]`.
    pub fn extended(&self, amount: usize, limit: usize, right: bool) -> Location {
        Location::with_strand(
            self.start.saturating_sub(amount),
            if right {
                (self.end + amount).min(limit)
            } else {
                self.end
            },
            self.strand,
        )
    }

    pub fn extract<'a>(&self, sequence: &'a str) -> &'a str {
        &sequence[self.start.min(sequence.len())..self.end.min(sequence.len())]
    }
}

impl std::fmt::Display for Location {
    /// Formats as DNAChisel does ("10-20", "10-20(+)"), since these strings
    /// appear verbatim in the objective report the UI renders.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}-{}", self.start, self.end)?;
        match self.strand {
            1 => f.write_str("(+)"),
            -1 => f.write_str("(-)"),
            _ => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlap_is_none_when_disjoint() {
        assert_eq!(Location::new(0, 5).overlap(&Location::new(5, 10)), None);
        assert_eq!(
            Location::new(0, 6).overlap(&Location::new(5, 10)),
            Some(Location::new(5, 6))
        );
    }

    #[test]
    fn extension_clamps_at_both_ends() {
        assert_eq!(
            Location::new(2, 8).extended(5, 10, true),
            Location::new(0, 10)
        );
        // right=false leaves the end alone, used when breaches overlap.
        assert_eq!(
            Location::new(2, 8).extended(5, 100, false),
            Location::new(0, 8)
        );
    }

    #[test]
    fn formats_like_dnachisel() {
        assert_eq!(Location::new(10, 20).to_string(), "10-20");
        assert_eq!(Location::with_strand(10, 20, 1).to_string(), "10-20(+)");
        assert_eq!(Location::with_strand(10, 20, -1).to_string(), "10-20(-)");
    }
}
