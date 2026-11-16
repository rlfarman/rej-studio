//! NumPy-compatible MT19937, so a Rust run makes the same random choices as
//! the Python optimizer.
//!
//! DNAChisel draws from `numpy.random`'s legacy global RandomState. Matching
//! it bit for bit is what lets the Rust port be checked against Python on
//! whole optimization runs rather than on scoring alone. Three behaviours
//! have to match exactly, all verified against NumPy in `tests/rng_parity`:
//!
//!   * `np.random.seed(n)` — the classic `init_genrand` key schedule.
//!   * `np.random.randint(n)` and the interval draws inside `shuffle` — both
//!     take 32-bit words, mask them down to the next power of two and reject
//!     until the value fits, so the number of words consumed is part of the
//!     observable behaviour.
//!   * `np.random.choice(n, k, replace=False)` — NumPy implements this as
//!     `permutation(n)[:k]`, a backwards Fisher-Yates shuffle.

const N: usize = 624;
const M: usize = 397;
const MATRIX_A: u32 = 0x9908_b0df;
const UPPER_MASK: u32 = 0x8000_0000;
const LOWER_MASK: u32 = 0x7fff_ffff;

pub struct NumpyRng {
    mt: [u32; N],
    index: usize,
}

impl NumpyRng {
    /// Seed exactly as `np.random.seed(seed)` does.
    pub fn seed(seed: u32) -> Self {
        let mut mt = [0u32; N];
        mt[0] = seed;
        for i in 1..N {
            let prev = mt[i - 1];
            mt[i] = 1_812_433_253u32
                .wrapping_mul(prev ^ (prev >> 30))
                .wrapping_add(i as u32);
        }
        // index == N marks the block as spent, so the first draw regenerates.
        Self { mt, index: N }
    }

    fn generate_block(&mut self) {
        for i in 0..N {
            let y = (self.mt[i] & UPPER_MASK) | (self.mt[(i + 1) % N] & LOWER_MASK);
            let mut next = self.mt[(i + M) % N] ^ (y >> 1);
            if y & 1 != 0 {
                next ^= MATRIX_A;
            }
            self.mt[i] = next;
        }
        self.index = 0;
    }

    /// One tempered 32-bit word: NumPy's `next_uint32`.
    pub fn next_u32(&mut self) -> u32 {
        if self.index >= N {
            self.generate_block();
        }
        let mut y = self.mt[self.index];
        self.index += 1;
        y ^= y >> 11;
        y ^= (y << 7) & 0x9d2c_5680;
        y ^= (y << 15) & 0xefc6_0000;
        y ^ (y >> 18)
    }

    /// Uniform integer in `0..=max`, NumPy's masked-rejection `random_interval`.
    ///
    /// The mask is the smallest `2^k - 1` that covers `max`; words that land
    /// above `max` are discarded and redrawn. Rejected words still advance the
    /// stream, which is why this has to be reproduced rather than approximated.
    fn bounded(&mut self, max: u32) -> u32 {
        if max == 0 {
            return 0;
        }
        let mut mask = max;
        mask |= mask >> 1;
        mask |= mask >> 2;
        mask |= mask >> 4;
        mask |= mask >> 8;
        mask |= mask >> 16;
        loop {
            let value = self.next_u32() & mask;
            if value <= max {
                return value;
            }
        }
    }

    /// `np.random.randint(n)` — uniform over `0..n`.
    pub fn randint(&mut self, n: usize) -> usize {
        debug_assert!(n > 0, "randint needs a positive bound");
        self.bounded((n - 1) as u32) as usize
    }

    /// `np.random.permutation(n)` — backwards Fisher-Yates, as NumPy shuffles.
    pub fn permutation(&mut self, n: usize) -> Vec<usize> {
        let mut items: Vec<usize> = (0..n).collect();
        for i in (1..n).rev() {
            let j = self.bounded(i as u32) as usize;
            items.swap(i, j);
        }
        items
    }

    /// `np.random.choice(n, k, replace=False)`, which NumPy derives from
    /// `permutation(n)[:k]` — so the whole permutation is drawn even when only
    /// the first few indices are used.
    pub fn choice_without_replacement(&mut self, n: usize, k: usize) -> Vec<usize> {
        let mut perm = self.permutation(n);
        perm.truncate(k);
        perm
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Values captured from NumPy 2.5.5 (see tests/rng_parity.rs for the
    /// generator script).
    #[test]
    fn seeding_matches_numpy_state() {
        let rng = NumpyRng::seed(1234);
        assert_eq!(
            &rng.mt[..4],
            &[1234, 3_159_640_283, 4_062_961_311, 3_954_462_607]
        );
    }

    #[test]
    fn randint_matches_numpy() {
        let mut rng = NumpyRng::seed(1234);
        let drawn: Vec<usize> = (0..8).map(|_| rng.randint(10)).collect();
        assert_eq!(drawn, vec![3, 6, 5, 4, 8, 9, 1, 7]);

        let mut rng = NumpyRng::seed(1234);
        let drawn: Vec<usize> = (0..8).map(|_| rng.randint(3)).collect();
        assert_eq!(drawn, vec![2, 1, 0, 0, 0, 1, 1, 1]);
    }

    #[test]
    fn permutation_and_choice_match_numpy() {
        let mut rng = NumpyRng::seed(42);
        assert_eq!(rng.permutation(10), vec![8, 1, 5, 0, 7, 2, 9, 4, 3, 6]);

        let mut rng = NumpyRng::seed(42);
        assert_eq!(rng.choice_without_replacement(10, 3), vec![8, 1, 5]);
    }

    #[test]
    fn rejection_consumes_the_same_words_as_numpy() {
        // NumPy reports randint(10) spending 2 words and randint(3) spending 3
        // for seed 1234: one and two rejected draws respectively.
        let mut rng = NumpyRng::seed(1234);
        rng.randint(10);
        assert_eq!(rng.index, 2);

        let mut rng = NumpyRng::seed(1234);
        rng.randint(3);
        assert_eq!(rng.index, 3);

        let mut rng = NumpyRng::seed(1234);
        rng.permutation(4);
        assert_eq!(rng.index, 4);
    }
}
