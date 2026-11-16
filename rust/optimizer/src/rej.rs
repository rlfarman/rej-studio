//! The RNA End-Joining pipeline: recode a WGGW motif near the split point,
//! then cut the optimized sequence into 5' and 3' halves.
//!
//! Ported from the WGGW and split-marker half of `python/algorithm.py`. This
//! part is fully deterministic — no random draws — so Rust and Python must
//! agree exactly on it, which `tests/parity.rs` checks directly.
//!
//! "WGGW" is the motif `[AT]GG[AT]`: a weak base, GG, a weak base. Splitting
//! inside its GG is what makes the two halves rejoin efficiently, so the
//! design recodes a nearby pair of codons to create one without changing the
//! protein.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use crate::biotools::translate;
use crate::pattern::Pattern;

/// Where a WGGW motif sits, and what it cost to put it there.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WggwSite {
    /// 0-based start of the four-base motif.
    pub position: usize,
    pub motif: String,
    pub distance_from_split: usize,
    pub original_codons: (String, String),
    pub new_codons: (String, String),
    /// Only set for a caller-chosen site: the 1-based cut position.
    pub split_position: Option<usize>,
}

/// A dipeptide (two amino acids) and the codon pair that spells it with a
/// WGGW motif across the join.
type DipeptideTable = BTreeMap<String, Vec<(String, String)>>;

/// Every dipeptide that some codon pair can encode while containing WGGW.
///
/// Built once by walking all 4096 codon pairs, matching Python's
/// `find_wggw_compatible_dipeptides`. Only the first qualifying pair per
/// dipeptide is ever used, so insertion order matters and is preserved.
fn wggw_dipeptides() -> &'static DipeptideTable {
    static TABLE: OnceLock<DipeptideTable> = OnceLock::new();
    TABLE.get_or_init(|| {
        let bases = ["A", "C", "G", "T"];
        let codons: Vec<String> = bases
            .iter()
            .flat_map(|a| bases.iter().map(move |b| (a, b)))
            .flat_map(|(a, b)| bases.iter().map(move |c| format!("{a}{b}{c}")))
            .collect();

        let mut table: DipeptideTable = BTreeMap::new();
        for first in &codons {
            let aa1 = translate(first);
            for second in &codons {
                let hexamer = format!("{first}{second}");
                // Scan for a weak base, GG, weak base window inside the pair.
                let bytes = hexamer.as_bytes();
                let has_motif = (0..bytes.len() - 3).any(|i| {
                    matches!(bytes[i], b'A' | b'T')
                        && &bytes[i + 1..i + 3] == b"GG"
                        && matches!(bytes[i + 3], b'A' | b'T')
                });
                if has_motif {
                    let dipeptide = format!("{aa1}{}", translate(second));
                    table
                        .entry(dipeptide)
                        .or_default()
                        .push((first.clone(), second.clone()));
                }
            }
        }
        table
    })
}

/// The WGGW motif pattern, compiled once.
fn wggw_pattern() -> &'static Pattern {
    static PATTERN: OnceLock<Pattern> = OnceLock::new();
    PATTERN.get_or_init(|| Pattern::parse("[AT]GG[AT]").expect("valid WGGW pattern"))
}

/// Start positions of every WGGW motif, overlaps included.
pub fn candidate_splice_sites(sequence: &str) -> Vec<usize> {
    wggw_pattern()
        .find_matches(sequence, 0, sequence.len(), 1)
        .into_iter()
        .map(|(start, _, _)| start)
        .collect()
}

/// Reorder candidate positions by how close they are to `position`.
///
/// Ties keep their original order, matching Python's stable sort, so the
/// chosen split point is the same on both sides.
pub fn by_distance_from(candidates: &[usize], position: usize) -> Vec<(i64, usize)> {
    let mut pairs: Vec<(i64, usize)> = candidates
        .iter()
        .map(|&candidate| (candidate as i64 - position as i64, candidate))
        .collect();
    pairs.sort_by_key(|(distance, _)| distance.abs());
    pairs
}

/// Find the dipeptide nearest the split that can be recoded to carry WGGW.
///
/// `direction` is -1 for upstream only, 1 for downstream only, 0 for either.
fn find_closest_site(
    protein: &str,
    split_point_aa: usize,
    min_distance_aa: usize,
    direction: i8,
) -> Option<(usize, String)> {
    let bytes = protein.as_bytes();
    let table = wggw_dipeptides();
    let mut best: Option<(usize, String, usize)> = None;

    for index in 0..bytes.len().saturating_sub(1) {
        let dipeptide = &protein[index..index + 2];
        if !table.contains_key(dipeptide) {
            continue;
        }
        let distance = index as i64 - split_point_aa as i64;
        let magnitude = distance.unsigned_abs() as usize;
        if magnitude < min_distance_aa {
            continue;
        }
        let wrong_side = (direction < 0 && distance >= 0) || (direction > 0 && distance <= 0);
        if wrong_side {
            continue;
        }
        if best
            .as_ref()
            .is_none_or(|(_, _, best_distance)| magnitude < *best_distance)
        {
            best = Some((index, dipeptide.to_string(), magnitude));
        }
    }
    best.map(|(index, dipeptide, _)| (index, dipeptide))
}

/// Recode the codon pair nearest `split_point` so it contains WGGW.
///
/// Returns the sequence unchanged (and `None`) when no site qualifies or the
/// rewrite would alter the protein.
pub fn insert_wggw_motif(
    sequence: &str,
    split_point: usize,
    min_distance: usize,
    direction: i8,
) -> (String, Option<WggwSite>) {
    let protein = translate(sequence);
    let split_point_aa = split_point / 3;
    // Round up, leaving a codon of slack as Python does.
    let min_distance_aa = min_distance.div_ceil(3);

    let Some((position, dipeptide)) =
        find_closest_site(&protein, split_point_aa, min_distance_aa, direction)
    else {
        return (sequence.to_string(), None);
    };

    let dna_position = position * 3;
    if dna_position + 6 > sequence.len() {
        return (sequence.to_string(), None);
    }
    let original = (
        sequence[dna_position..dna_position + 3].to_string(),
        sequence[dna_position + 3..dna_position + 6].to_string(),
    );
    let (new_first, new_second) = wggw_dipeptides()
        .get(&dipeptide)
        .and_then(|pairs| pairs.first())
        .cloned()
        .expect("dipeptide came from the table");

    let recoded = format!(
        "{}{new_first}{new_second}{}",
        &sequence[..dna_position],
        &sequence[dna_position + 6..]
    );
    if translate(&recoded) != protein {
        return (sequence.to_string(), None);
    }

    let hexamer = &recoded[dna_position..dna_position + 6];
    let Some((motif_start, motif_end, _)) = wggw_pattern()
        .find_matches(hexamer, 0, hexamer.len(), 1)
        .into_iter()
        .next()
    else {
        return (sequence.to_string(), None);
    };

    let wggw_position = dna_position + motif_start;
    let site = WggwSite {
        position: wggw_position,
        motif: hexamer[motif_start..motif_end].to_string(),
        distance_from_split: wggw_position.abs_diff(split_point),
        original_codons: original,
        new_codons: (new_first, new_second),
        split_position: None,
    };
    (recoded, Some(site))
}

/// A caller-chosen WGGW site, as the design tool's motif picker sends it.
#[derive(Debug, Clone)]
pub struct SelectedWggwSite {
    pub position: usize,
    pub motif_start: usize,
    pub hexamer_start: usize,
    pub motif: String,
    pub new_hexamer: String,
    pub original_codons: (String, String),
    pub new_codons: (String, String),
}

/// Apply a caller-chosen site, rejecting anything inconsistent.
///
/// Every check mirrors Python's: a stale selection (the sequence changed under
/// the user) must fail loudly rather than silently designing something else.
/// Returns the recoded sequence, the site, and the span to freeze.
pub fn apply_selected_site(
    sequence: &str,
    selected: &SelectedWggwSite,
    split_point: usize,
) -> Result<(String, WggwSite, (usize, usize)), String> {
    let protein = translate(sequence);
    let hexamer_start = selected
        .hexamer_start
        .checked_sub(1)
        .ok_or("Selected WGGW site lies outside the coding sequence")?;
    if hexamer_start + 6 > sequence.len() {
        return Err("Selected WGGW site lies outside the coding sequence".to_string());
    }

    let current = &sequence[hexamer_start..hexamer_start + 6];
    let current_codons = (current[..3].to_string(), current[3..].to_string());
    if current_codons != selected.original_codons {
        return Err(
            "Selected WGGW site no longer matches the current coding sequence at the chosen codons"
                .to_string(),
        );
    }
    if format!("{}{}", selected.new_codons.0, selected.new_codons.1) != selected.new_hexamer {
        return Err("Selected WGGW site new codons do not match the provided hexamer".to_string());
    }
    if translate(current) != translate(&selected.new_hexamer) {
        return Err("Selected WGGW rewrite changes the encoded amino acids".to_string());
    }

    let Some((motif_offset, motif_end, _)) = wggw_pattern()
        .find_matches(&selected.new_hexamer, 0, selected.new_hexamer.len(), 1)
        .into_iter()
        .next()
    else {
        return Err("Selected WGGW rewrite does not actually create a WGGW motif".to_string());
    };

    let expected_motif_start = selected.hexamer_start + motif_offset;
    let expected_split = expected_motif_start + 1;
    if selected.motif_start != expected_motif_start || selected.position != expected_split {
        return Err(
            "Selected WGGW coordinates do not match the provided codon rewrite".to_string(),
        );
    }
    if selected.motif != selected.new_hexamer[motif_offset..motif_end] {
        return Err("Selected WGGW motif does not match the provided codon rewrite".to_string());
    }

    let recoded = format!(
        "{}{}{}",
        &sequence[..hexamer_start],
        selected.new_hexamer,
        &sequence[hexamer_start + 6..]
    );
    if translate(&recoded) != protein {
        return Err("Selected WGGW rewrite does not preserve the translated protein".to_string());
    }

    let site = WggwSite {
        // 0-based motif start, matching the report shape.
        position: selected.motif_start - 1,
        motif: selected.motif.clone(),
        distance_from_split: selected.position.abs_diff(split_point),
        original_codons: selected.original_codons.clone(),
        new_codons: selected.new_codons.clone(),
        split_position: Some(selected.position),
    };
    Ok((recoded, site, (hexamer_start, hexamer_start + 6)))
}

/// Where the design is cut, and what it took to get there.
#[derive(Debug, Clone)]
pub struct SplitResult {
    pub final_sequence: String,
    pub split_point: usize,
    pub seq5: String,
    pub seq3: String,
    pub wggw: BTreeMap<String, WggwSite>,
    pub used_wggw_as_split: bool,
}

/// Options the split step reads.
pub struct SplitOptions {
    pub split_point: usize,
    pub wggw_threshold: usize,
    pub ensure_wggw: bool,
    pub stim_5: bool,
    pub stim_3: bool,
    pub selected_site: Option<WggwSite>,
}

/// Place the main split (and optional stimulatory intron points), then cut.
///
/// Mirrors `insertSplitMarkers` + `replaceMarkersWithPlaceholders`: markers go
/// in first so later insertions shift earlier ones consistently, then become
/// the `[REJ5]`/`[REJ3]`/`[STIMINTRON]` placeholders.
pub fn split_sequence(optimized: &str, options: &SplitOptions) -> SplitResult {
    let original_protein = translate(optimized);
    let mut working = optimized.to_string();
    let mut wggw: BTreeMap<String, WggwSite> = BTreeMap::new();
    let mut main_split: Option<usize> = None;
    let mut used_wggw_as_split = false;

    if let Some(site) = &options.selected_site {
        main_split = site.split_position;
        wggw.insert("main".to_string(), site.clone());
        used_wggw_as_split = true;
    } else if options.ensure_wggw {
        let (recoded, site) = insert_wggw_motif(&working, options.split_point, 0, 0);
        if let Some(site) = site {
            working = recoded;
            // Close enough to the requested point to be worth splitting there.
            if site.distance_from_split <= options.wggw_threshold {
                // Cut between the two Gs.
                main_split = Some(site.position + 2);
                used_wggw_as_split = true;
            }
            wggw.insert("main".to_string(), site);
        }
    }

    // No usable motif: fall back to the nearest existing WGGW, else the
    // requested point.
    let mut main_split = main_split.unwrap_or_else(|| {
        let candidates = candidate_splice_sites(&working);
        match by_distance_from(&candidates, options.split_point).first() {
            Some((_, position)) => position + 2,
            None => options.split_point,
        }
    });

    let mut stim5_point = options
        .stim_5
        .then(|| {
            place_stimulatory_site(
                &mut working,
                &mut wggw,
                &original_protein,
                options.split_point,
                -1,
            )
        })
        .flatten();
    let mut stim3_point = options
        .stim_3
        .then(|| {
            place_stimulatory_site(
                &mut working,
                &mut wggw,
                &original_protein,
                options.split_point,
                1,
            )
        })
        .flatten();

    // A recode that broke the protein means starting over without any motif.
    if translate(&working) != original_protein {
        working = optimized.to_string();
        let candidates = candidate_splice_sites(&working);
        main_split = match by_distance_from(&candidates, options.split_point).first() {
            Some((_, position)) => position + 2,
            None => options.split_point,
        };
        wggw.clear();
        used_wggw_as_split = false;
        stim5_point = None;
        stim3_point = None;
    }

    // Markers: '0' for the main cut, '1' for stimulatory points. Each
    // insertion shifts everything after it, so later points are nudged.
    let mut marked = format!("{}0{}", &working[..main_split], &working[main_split..]);
    let mut offset = 1usize;

    if let Some(point) = stim5_point.as_mut() {
        if *point > main_split {
            *point += offset;
        }
        marked = format!("{}1{}", &marked[..*point], &marked[*point..]);
        if stim3_point.is_some_and(|stim3| stim3 > *point) {
            offset += 1;
        }
    }
    if let Some(point) = stim3_point.as_mut() {
        if *point > main_split {
            *point += offset;
        }
        marked = format!("{}1{}", &marked[..*point], &marked[*point..]);
    }

    let (seq5, seq3) = markers_to_placeholders(&marked);
    SplitResult {
        final_sequence: working,
        split_point: main_split,
        seq5,
        seq3,
        wggw,
        used_wggw_as_split,
    }
}

/// Try to add a stimulatory-intron WGGW 150 bases out from the split, falling
/// back to the nearest existing motif on that side.
fn place_stimulatory_site(
    working: &mut String,
    wggw: &mut BTreeMap<String, WggwSite>,
    original_protein: &str,
    split_point: usize,
    direction: i8,
) -> Option<usize> {
    const OFFSET: usize = 150;
    let target = if direction < 0 {
        split_point.saturating_sub(OFFSET)
    } else {
        split_point + OFFSET
    };
    let label = if direction < 0 { "stim5" } else { "stim3" };

    let (recoded, site) = insert_wggw_motif(working, target, OFFSET, direction);
    if let Some(site) = site
        && translate(&recoded) == original_protein
    {
        let point = site.position + 2;
        *working = recoded;
        wggw.insert(label.to_string(), site);
        return Some(point);
    }

    // Nothing recodable: use an existing motif on the correct side.
    let candidates = candidate_splice_sites(working);
    by_distance_from(&candidates, target)
        .into_iter()
        .find(|(distance, _)| {
            if direction < 0 {
                *distance < 0
            } else {
                *distance > 0
            }
        })
        .map(|(_, position)| position + 2)
}

/// Turn the numeric markers into the final placeholders and cut in two.
fn markers_to_placeholders(marked: &str) -> (String, String) {
    if !marked.contains('0') {
        return (marked.to_string(), String::new());
    }
    let joined = marked
        .replace('0', "[REJ5].[REJ3]")
        .replace('1', "[STIMINTRON]");
    match joined.split_once('.') {
        Some((seq5, seq3)) => (seq5.to_string(), seq3.to_string()),
        None => (joined, String::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CDS: &str =
        "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA";

    #[test]
    fn dipeptide_table_covers_the_expected_ground() {
        let table = wggw_dipeptides();
        assert!(!table.is_empty());
        // Every listed pair really does contain the motif.
        for pairs in table.values() {
            for (first, second) in pairs {
                let hexamer = format!("{first}{second}");
                assert!(
                    !wggw_pattern().find_matches(&hexamer, 0, 6, 1).is_empty(),
                    "{hexamer} has no WGGW"
                );
            }
        }
    }

    #[test]
    fn candidate_sites_include_overlaps() {
        assert_eq!(candidate_splice_sites("AGGAGGA"), vec![0, 3]);
        assert!(candidate_splice_sites("CCCCCC").is_empty());
    }

    #[test]
    fn candidates_sort_by_absolute_distance() {
        assert_eq!(
            by_distance_from(&[10, 30, 50], 31),
            vec![(-1, 30), (19, 50), (-21, 10)]
        );
    }

    #[test]
    fn inserting_a_motif_keeps_the_protein() {
        let (recoded, site) = insert_wggw_motif(CDS, CDS.len() / 2, 0, 0);
        let site = site.expect("a WGGW site should be reachable in this CDS");
        assert_eq!(translate(&recoded), translate(CDS));
        assert_eq!(recoded.len(), CDS.len());
        assert_eq!(&recoded[site.position..site.position + 4], site.motif);
    }

    #[test]
    fn splitting_reassembles_into_the_original() {
        let options = SplitOptions {
            split_point: CDS.len() / 2,
            wggw_threshold: 0,
            ensure_wggw: true,
            stim_5: false,
            stim_3: false,
            selected_site: None,
        };
        let result = split_sequence(CDS, &options);
        // Strip the placeholders and the two halves rejoin into the design.
        let rejoined = format!(
            "{}{}",
            result.seq5.replace("[REJ5]", ""),
            result.seq3.replace("[REJ3]", "")
        );
        assert_eq!(rejoined, result.final_sequence);
        assert_eq!(translate(&result.final_sequence), translate(CDS));
    }

    #[test]
    fn the_split_lands_inside_a_motif_when_one_is_close() {
        let options = SplitOptions {
            split_point: CDS.len() / 2,
            // A generous threshold means the recoded motif is used as the cut.
            wggw_threshold: 300,
            ensure_wggw: true,
            stim_5: false,
            stim_3: false,
            selected_site: None,
        };
        let result = split_sequence(CDS, &options);
        assert!(result.used_wggw_as_split);
        let site = result.wggw.get("main").expect("main site recorded");
        assert_eq!(result.split_point, site.position + 2);
        // Cutting between the GG of [AT]GG[AT].
        assert_eq!(
            &result.final_sequence[site.position + 1..site.position + 3],
            "GG"
        );
    }

    #[test]
    fn stimulatory_points_add_their_own_placeholders() {
        let long = CDS.repeat(6);
        let options = SplitOptions {
            split_point: long.len() / 2,
            wggw_threshold: 300,
            ensure_wggw: true,
            stim_5: true,
            stim_3: true,
            selected_site: None,
        };
        let result = split_sequence(&long, &options);
        let combined = format!("{}{}", result.seq5, result.seq3);
        assert_eq!(combined.matches("[STIMINTRON]").count(), 2);
        let rejoined = combined
            .replace("[REJ5]", "")
            .replace("[REJ3]", "")
            .replace("[STIMINTRON]", "");
        assert_eq!(rejoined, result.final_sequence);
    }

    #[test]
    fn a_selected_site_is_rejected_when_the_sequence_moved_on() {
        let selected = SelectedWggwSite {
            position: 11,
            motif_start: 10,
            hexamer_start: 10,
            motif: "AGGA".to_string(),
            new_hexamer: "AGGATG".to_string(),
            // Deliberately wrong: these are not the codons at position 10.
            original_codons: ("TTT".to_string(), "TTT".to_string()),
            new_codons: ("AGG".to_string(), "ATG".to_string()),
        };
        let error = apply_selected_site(CDS, &selected, 40).unwrap_err();
        assert!(error.contains("no longer matches"), "unexpected: {error}");
    }
}
