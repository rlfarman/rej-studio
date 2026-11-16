import contextlib
import hashlib
import json
import random
import re
import threading
import time
from collections import defaultdict
from dataclasses import dataclass

import numpy as np
from dnachisel import (
    AvoidChanges,
    AvoidPattern,
    CodonOptimize,
    DnaOptimizationProblem,
    EnforceGCContent,
    EnforceTranslation,
    SequencePattern,
    UniquifyAllKmers,
    biotools,
)

# proglog ships with dnachisel; if import shape shifts we fall back to a
# stub base that does nothing so the algorithm still runs.
try:
    from proglog import ProgressBarLogger as _ProgressBarLoggerBase  # type: ignore[assignment]
except Exception:  # pragma: no cover - defensive

    class _ProgressBarLoggerBase:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            pass

        def __call__(self, *args, **kwargs):
            pass


class OptimizationError(RuntimeError):
    """The optimizer ran but could not produce a usable design.

    Raised instead of returning empty strings: an empty sequence serializes
    as a perfectly valid-looking "success" the frontend will happily show.
    """


class _MonotonicProgress:
    """Shared gate that both the proglog bridge and the heartbeat thread
    write through, so the UI never sees progress regress. Also exposes
    last-emit time so the heartbeat can act as a watchdog (only tick when
    the real logger has gone quiet).
    """

    def __init__(self, on_progress):
        self._on_progress = on_progress
        self._lock = threading.Lock()
        self._last_frac = 0.0
        self._last_emit_at = 0.0
        self._last_stage = ""

    def emit(self, frac, stage):
        """Emit a new progress checkpoint. Pass stage=None to keep the last
        stage label — used by the heartbeat so it doesn't overwrite the
        bridge's "(N/M)" suffix with a bare stage and cause UI flicker.
        """
        if self._on_progress is None:
            return
        with self._lock:
            if frac <= self._last_frac:
                return
            self._last_frac = frac
            self._last_emit_at = time.monotonic()
            if stage is None:
                stage = self._last_stage
            else:
                self._last_stage = stage
        with contextlib.suppress(Exception):
            self._on_progress(frac, stage)

    @property
    def last_frac(self):
        with self._lock:
            return self._last_frac

    @property
    def seconds_since_emit(self):
        with self._lock:
            if self._last_emit_at == 0.0:
                return float("inf")
            return time.monotonic() - self._last_emit_at


@dataclass
class SplitMarkerResult:
    final_sequence: str
    sequence_with_markers: str
    actual_split_point: int
    wggw_info: dict | None
    used_wggw_as_split: bool


class _ProgressBridgeLogger(_ProgressBarLoggerBase):
    """Translate dnachisel's proglog bar updates into on_progress() calls.

    DNAChisel drives bars named 'mutation', 'objective', and 'constraint'
    via `self.logger(bar__total=N)` and `self.logger(bar__index=i)`. The
    long-running work during `problem.optimize()` advances the 'mutation'
    bar (iteration count / total mutation space) along with 'objective'
    (which objective is currently being worked on). We map those into a
    monotonically-increasing fraction in frac_range and emit a stage label
    like 'Optimizing sequence (obj 2/5)'.
    """

    def __init__(self, gate, frac_range, stage):
        super().__init__()
        self._gate = gate
        self._frac_lo, self._frac_hi = frac_range
        self._base_stage = stage
        # Per-bar (index, total) so we can compute combined progress.
        self._obj_index = 0
        self._obj_total = 0
        self._mut_index = 0
        self._mut_total = 0

    def bars_callback(self, bar, attr, value, old_value=None):
        if attr not in ("index", "total"):
            return
        try:
            v = int(value)
        except TypeError, ValueError:
            return
        if bar == "objective":
            if attr == "total":
                self._obj_total = max(0, v)
            elif attr == "index":
                self._obj_index = max(0, v)
        elif bar == "mutation":
            if attr == "total":
                self._mut_total = max(0, v)
            elif attr == "index":
                self._mut_index = max(0, v)
        else:
            return  # ignore 'constraint' etc. during optimize phase
        self._emit()

    def _emit(self):
        if self._gate is None:
            return
        if self._obj_total > 0:
            obj_portion = min(self._obj_index, self._obj_total) / self._obj_total
        else:
            obj_portion = 0.0
        mut_portion = 0.0
        if self._obj_total > 0 and self._mut_total > 0:
            mut_fraction = min(self._mut_index, self._mut_total) / self._mut_total
            mut_portion = mut_fraction / self._obj_total
        raw = obj_portion + mut_portion
        frac = self._frac_lo + (self._frac_hi - self._frac_lo) * min(raw, 0.999)
        stage = self._base_stage
        if self._obj_total > 0:
            stage = f"{self._base_stage} ({min(self._obj_index + 1, self._obj_total)}/{self._obj_total})"
        self._gate.emit(frac, stage)


@contextlib.contextmanager
def _progress_heartbeat(gate, frac_range, expected_seconds, idle_after=0.5):
    """Watchdog thread that creeps progress forward on wall-clock, but only
    when the real proglog bridge has gone quiet for `idle_after` seconds.

    Shares a monotonic gate with the bridge so the bridge's real updates
    always win, and the heartbeat only fills silence. Uses an asymptotic
    curve so it approaches but never reaches frac_hi, leaving headroom for
    the next real checkpoint to overtake it.
    """
    if gate is None or gate._on_progress is None:
        yield
        return

    stop_event = threading.Event()
    frac_lo, frac_hi = frac_range
    span = max(1e-6, frac_hi - frac_lo)
    started = time.monotonic()

    def run():
        import math

        # Heartbeat never reaches frac_hi — bridge events own the last few
        # percent of the range.
        cap = frac_hi
        while not stop_event.is_set():
            if gate.seconds_since_emit >= idle_after:
                elapsed = time.monotonic() - started
                # Primary asymptotic approach based on expected_seconds.
                # Saturates at ~80% of span over ~3τ.
                ratio = 1.0 - math.exp(-elapsed / max(1.0, expected_seconds))
                frac_primary = frac_lo + span * ratio * 0.80
                # Secondary creep: close 1.5% of the remaining gap-to-cap
                # per tick so the bar keeps moving on long runs after the
                # primary curve saturates, and continues creeping from
                # wherever the bridge last left it.
                last = max(gate.last_frac, frac_lo)
                frac_secondary = last + max(0.0, cap - last) * 0.015
                frac = max(frac_primary, frac_secondary)
                if frac > cap:
                    frac = cap
                # stage=None → gate reuses the bridge's last stage label
                # (with its "(N/M)" suffix) so the subtitle doesn't flicker.
                gate.emit(frac, None)
            stop_event.wait(1.5)

    t = threading.Thread(target=run, name="progress-heartbeat", daemon=True)
    t.start()
    try:
        yield
    finally:
        stop_event.set()
        t.join(timeout=0.5)


# --- Reproducibility -------------------------------------------------------
# DNAChisel's mutation space sampling falls back to the unseeded global
# numpy RNG, so two runs of the same request can return different designs.
# Seeding both RNGs per job makes a run reproducible, and the seed is echoed
# in the result so a design can be regenerated exactly.
SEED_MODULUS = 2**32


def derive_seed(CDS, OPTIONS):
    """Derive a stable seed from the inputs.

    Same sequence + same options (ignoring any supplied seed) always yields
    the same seed, so repeat submissions are reproducible without the caller
    having to track one.
    """
    relevant = {k: v for k, v in sorted(OPTIONS.items()) if k != "seed"}
    payload = json.dumps([CDS, relevant], sort_keys=True, default=str)
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % SEED_MODULUS


def resolve_seed(CDS, OPTIONS):
    """Return the seed to use: the caller's if given, else a derived one."""
    seed = OPTIONS.get("seed")
    if seed is None:
        return derive_seed(CDS, OPTIONS)
    return int(seed) % SEED_MODULUS


def apply_seed(seed):
    """Seed every RNG DNAChisel might reach for."""
    random.seed(seed)
    np.random.seed(seed)


def resolve_split_point(OPTIONS, sequence_length):
    """The split point to design around, defaulting to the midpoint.

    `OPTIONS.get("split_point", default)` isn't enough: the frontend sends an
    explicit null when the user hasn't moved the splice slider, so the key is
    present and the default never applies.
    """
    split_point = OPTIONS.get("split_point")
    if split_point is None:
        return sequence_length // 2
    return int(split_point)


# WGGW Motif Insertion Functions
def get_codon_table():
    """Generate a dictionary mapping codons to amino acids."""
    codons = []
    for n1 in ["A", "C", "G", "T"]:
        for n2 in ["A", "C", "G", "T"]:
            for n3 in ["A", "C", "G", "T"]:
                codons.append(n1 + n2 + n3)

    codon_table = {}
    for codon in codons:
        aa = biotools.translate(codon)
        codon_table[codon] = aa

    return codon_table


def find_wggw_compatible_dipeptides():
    """Find all dipeptides that can be coded with a WGGW motif."""
    CODON_TABLE = get_codon_table()
    dipeptide_codons = defaultdict(list)
    weak_bases = ["A", "T"]

    for codon1, aa1 in CODON_TABLE.items():
        for codon2, aa2 in CODON_TABLE.items():
            dipeptide = aa1 + aa2
            hexamer = codon1 + codon2

            for i in range(len(hexamer) - 3):
                if (
                    hexamer[i] in weak_bases
                    and hexamer[i + 1 : i + 3] == "GG"
                    and hexamer[i + 3] in weak_bases
                ):
                    dipeptide_codons[dipeptide].append((codon1, codon2))
                    break

    return {dipeptide: codons for dipeptide, codons in dipeptide_codons.items() if codons}


# Global cache of WGGW-compatible dipeptides (computed once)
WGGW_DIPEPTIDES = find_wggw_compatible_dipeptides()


def find_closest_wggw_site(protein_seq, split_point_aa, min_distance_aa=0, direction=0):
    """
    Find the dipeptide closest to the split point that can be coded with a WGGW motif.

    Args:
        protein_seq: The amino acid sequence
        split_point_aa: The split point in amino acid coordinates
        min_distance_aa: Minimum distance in amino acids (default 0)
        direction: 0=both, -1=upstream only, 1=downstream only

    Returns:
        Best site tuple or None if no site found
    """
    best_site = None
    best_distance = float("inf")

    for i in range(len(protein_seq) - 1):
        dipeptide = protein_seq[i : i + 2]

        if dipeptide in WGGW_DIPEPTIDES:
            # Calculate distance and direction from split point
            distance = i - split_point_aa
            abs_distance = abs(distance)

            # Check minimum distance constraint
            if abs_distance < min_distance_aa:
                continue

            # Check direction constraint
            if (direction < 0 and distance >= 0) or (direction > 0 and distance <= 0):
                continue

            if abs_distance < best_distance:
                best_distance = abs_distance
                best_site = (i, dipeptide, abs_distance)

    return best_site


def insert_wggw_motif(sequence, split_point, min_distance=0, direction=0):
    """
    Insert a WGGW motif near the requested split point.

    Args:
        sequence: The DNA sequence
        split_point: The target split point
        min_distance: Minimum distance from split point in bases
        direction: 0=both directions, -1=upstream only, 1=downstream only

    Returns:
        Tuple of (recoded_sequence, wggw_info) or (sequence, None) if unsuccessful
    """
    # Translate to protein
    protein_seq = biotools.translate(sequence)
    split_point_aa = split_point // 3
    min_distance_aa = (min_distance + 2) // 3  # Convert to amino acids, adding buffer

    # Find the closest compatible site
    best_site = find_closest_wggw_site(protein_seq, split_point_aa, min_distance_aa, direction)

    if not best_site:
        # No compatible site found, return original sequence
        return sequence, None

    # Get site details
    position, dipeptide, _ = best_site
    dna_position = position * 3

    # Get current codons
    current_codon1 = sequence[dna_position : dna_position + 3]
    current_codon2 = sequence[dna_position + 3 : dna_position + 6]

    # Get valid codon pairs for this dipeptide
    valid_pairs = WGGW_DIPEPTIDES[dipeptide]
    new_codon1, new_codon2 = valid_pairs[0]

    # Create recoded sequence
    recoded_sequence = (
        sequence[:dna_position] + new_codon1 + new_codon2 + sequence[dna_position + 6 :]
    )

    # Verify translation is preserved
    if biotools.translate(recoded_sequence) != protein_seq:
        return sequence, None

    # Get the position of the WGGW motif
    new_hexamer = recoded_sequence[dna_position : dna_position + 6]
    wggw_pattern = re.compile("[AT]GG[AT]")
    wggw_match = wggw_pattern.search(new_hexamer)

    if wggw_match:
        wggw_position = dna_position + wggw_match.start()
        wggw_info = {
            "position": wggw_position,
            "motif": wggw_match.group(),
            "distance_from_split": abs(wggw_position - split_point),
            "original_codons": (current_codon1, current_codon2),
            "new_codons": (new_codon1, new_codon2),
        }
        return recoded_sequence, wggw_info

    return sequence, None


def apply_explicit_wggw_site(sequence, explicit_site, split_point):
    """
    Apply an explicitly selected WGGW-capable codon rewrite.

    Args:
        sequence: Original CDS sequence
        explicit_site: Dict describing the selected site/rewrite
        split_point: Requested split point in 1-based cut coordinates

    Returns:
        Tuple of (recoded_sequence, site_info, lock_region)
    """
    if explicit_site is None:
        return sequence, None, None

    normalized_sequence = sequence.upper().replace("U", "T")
    protein_seq = biotools.translate(normalized_sequence)

    position = int(explicit_site["position"])
    motif_start = int(explicit_site["motif_start"])
    hexamer_start = int(explicit_site["hexamer_start"])
    motif = str(explicit_site["motif"]).upper().replace("U", "T")
    new_hexamer = str(explicit_site["new_hexamer"]).upper().replace("U", "T")
    original_codons = tuple(
        codon.upper().replace("U", "T") for codon in explicit_site["original_codons"]
    )
    new_codons = tuple(codon.upper().replace("U", "T") for codon in explicit_site["new_codons"])

    if len(original_codons) != 2 or len(new_codons) != 2:
        raise ValueError("Selected WGGW site must provide exactly two original and new codons")

    hexamer_start_idx = hexamer_start - 1
    if hexamer_start_idx < 0 or hexamer_start_idx + 6 > len(normalized_sequence):
        raise ValueError("Selected WGGW site lies outside the coding sequence")

    current_hexamer = normalized_sequence[hexamer_start_idx : hexamer_start_idx + 6]
    current_codons = (current_hexamer[:3], current_hexamer[3:])
    if current_codons != original_codons:
        raise ValueError(
            "Selected WGGW site no longer matches the current coding sequence at the chosen codons"
        )

    if "".join(new_codons) != new_hexamer:
        raise ValueError("Selected WGGW site new codons do not match the provided hexamer")

    if biotools.translate(current_hexamer) != biotools.translate(new_hexamer):
        raise ValueError("Selected WGGW rewrite changes the encoded amino acids")

    local_match = re.search("[AT]GG[AT]", new_hexamer)
    if local_match is None:
        raise ValueError("Selected WGGW rewrite does not actually create a WGGW motif")

    expected_motif_start = hexamer_start + local_match.start()
    expected_split = hexamer_start + local_match.start() + 1
    if motif_start != expected_motif_start or position != expected_split:
        raise ValueError("Selected WGGW coordinates do not match the provided codon rewrite")
    if motif != local_match.group():
        raise ValueError("Selected WGGW motif does not match the provided codon rewrite")

    recoded_sequence = (
        normalized_sequence[:hexamer_start_idx]
        + new_hexamer
        + normalized_sequence[hexamer_start_idx + 6 :]
    )

    if biotools.translate(recoded_sequence) != protein_seq:
        raise ValueError("Selected WGGW rewrite does not preserve the translated protein")

    site_info = {
        "position": motif_start - 1,  # 0-based motif start, matching existing report shape
        "motif": motif,
        "distance_from_split": abs(position - split_point),
        "original_codons": original_codons,
        "new_codons": new_codons,
        "split_position": position,
    }

    return recoded_sequence, site_info, (hexamer_start_idx, hexamer_start_idx + 6)


def _serialize_evaluation_location(loc):
    """Serialize a DNAChisel Location object to a JSON-safe dict."""
    try:
        start = int(getattr(loc, "start", 0))
        end = int(getattr(loc, "end", 0))
        strand = getattr(loc, "strand", None)
        if strand is not None:
            try:
                strand = int(strand)
            except TypeError, ValueError:
                strand = None
        return {"start": start, "end": end, "strand": strand}
    except Exception:
        return None


def _serialize_evaluation(ev):
    """Serialize a single DNAChisel ObjectiveEvaluation to a JSON-safe dict."""
    try:
        score = float(ev.score) if ev.score is not None else 0.0
    except TypeError, ValueError:
        score = 0.0
    try:
        passes = bool(ev.passes)
    except Exception:
        passes = False
    try:
        spec = getattr(ev, "specification", None) or getattr(ev, "objective", None)
        objective_str = str(spec) if spec is not None else "<unknown>"
    except Exception:
        objective_str = "<unknown>"
    try:
        message = str(ev.message) if getattr(ev, "message", None) else ""
    except Exception:
        message = ""
    locations = []
    raw_locs = getattr(ev, "locations", None) or []
    for loc in raw_locs:
        sl = _serialize_evaluation_location(loc)
        if sl is not None:
            locations.append(sl)
    return {
        "objective": objective_str,
        "passes": passes,
        "score": score,
        "message": message,
        "locations": locations,
    }


def build_objectives_report(problem):
    """Build a structured JSON-safe report from DNAChisel objectives evaluations.

    Falls back to an empty report if the DNAChisel API differs from expected.
    """
    try:
        evaluations = problem.objectives_evaluations()
        items = getattr(evaluations, "evaluations", None)
        if items is None and hasattr(evaluations, "__iter__"):
            items = list(evaluations)
        if items is None:
            return {"entries": [], "total_score": None}
    except Exception:
        return {"entries": [], "total_score": None}
    entries = [_serialize_evaluation(ev) for ev in items]
    total = sum(e["score"] for e in entries) if entries else None
    return {"entries": entries, "total_score": total}


# `logger` is either proglog's "bar" shorthand or a ProgressBarLogger instance
# (see _ProgressBridgeLogger); annotated so pyright doesn't infer `str` from
# the default.
def build_optimization_problem(
    CDS, OPTIONS, logger: str | _ProgressBarLoggerBase = "bar", explicit_lock_region=None
):
    """Create a DNAChisel problem using the configured objectives."""
    CDS = CDS.upper().replace("U", "T")
    AAseq = biotools.translate(CDS)
    constraints = []
    objectives = []
    CDSlen = len(CDS)

    # Enforce that the translation remains unchanged
    constraints.append(EnforceTranslation(location=(0, CDSlen, 1), translation=AAseq))
    if explicit_lock_region is not None:
        constraints.append(
            AvoidChanges(location=(explicit_lock_region[0], explicit_lock_region[1], 1))
        )

    # Remove cryptic splice sites objective
    if OPTIONS.get("remove_cryptic_ss", False):
        remove_weight = OPTIONS.get("remove_cryptic_ss_weight", 1.0)
        splice_patterns = ["GT[AG]A", "AAGTA", "[CTA]AG[GA]", "CAG[GC]"]
        splice_acceptors = [
            "[CT]{2}[ACGT][CT]AG[GA]T",
            "[AG][CT][ACGT][CT]AG[GA]T",
            "[CT][AG][ACGT][CT]AG[GA]T",
            "[CT]{3}[ACGT][CT]AG[GA]T",
            "[AG][CT]{2}[ACGT][CT]AG[GA]T",
            "[CT][AG][CT][ACGT][CT]AG[GA]T",
            "[CT]{2}[AG][ACGT][CT]AG[GA]T",
            "[CT]{4}[ACGT][CT]AG[GA]T",
            "[AG][CT]{3}[ACGT][CT]AG[GA]T",
            "[CT][AG][CT]{2}[ACGT][CT]AG[GA]T",
            "[CT]{2}[AG][CT][ACGT][CT]AG[GA]T",
            "[CT]{3}[AG][ACGT][CT]AG[GA]T",
            "[CT]{5}[ACGT][CT]AG[GA]T",
            "[AG][CT]{4}[ACGT][CT]AG[GA]T",
            "[CT][AG][CT]{3}[ACGT][CT]AG[GA]T",
            "[CT]{2}[AG][CT]{2}[ACGT][CT]AG[GA]T",
            "[CT]{3}[AG][CT][ACGT][CT]AG[GA]T",
            "[CT]{4}[AG][ACGT][CT]AG[GA]T",
            "[CT]{6}[ACGT][CT]AG[GA]T",
            "[AG][CT]{5}[ACGT][CT]AG[GA]T",
            "[CT][AG][CT]{4}[ACGT][CT]AG[GA]T",
            "[CT]{2}[AG][CT]{3}[ACGT][CT]AG[GA]T",
            "[CT]{3}[AG][CT]{2}[ACGT][CT]AG[GA]T",
            "[CT]{4}[AG][CT][ACGT][CT]AG[GA]T",
            "[CT]{5}[AG][ACGT][CT]AG[GA]T",
        ]
        splice_patterns += splice_acceptors
        objectives.extend(
            AvoidPattern(SequencePattern(p), location=(0, CDSlen, 1), boost=remove_weight)
            for p in splice_patterns
        )

    # Codon optimization objective
    if OPTIONS.get("codon_optimize") in ["human", "mouse"]:
        codon_weight = OPTIONS.get("codon_optimize_weight", 1.0)
        speciesmap = {"human": "h_sapiens", "mouse": "m_musculus"}
        objectives.append(
            CodonOptimize(
                species=speciesmap[OPTIONS["codon_optimize"]],
                method="use_best_codon",
                location=(0, CDSlen, 1),
                boost=codon_weight,
            )
        )

    # Minimize CpG dinucleotides objective
    if OPTIONS.get("minimize_CpGs", False):
        cpg_weight = OPTIONS.get("minimize_CpGs_weight", 1.0)
        objectives.append(
            AvoidPattern(SequencePattern("CG"), location=(0, CDSlen, 1), boost=cpg_weight)
        )

    # Reduce k-mer complexity objective
    if OPTIONS.get("reduce_kmer_complexity", False):
        k_val = OPTIONS.get("reduce_kmer_complexity_k", 10)  # Default to 10 as requested
        kmer_weight = OPTIONS.get("reduce_kmer_complexity_weight", 1.0)
        objectives.append(UniquifyAllKmers(k=k_val, location=(0, CDSlen, 1), boost=kmer_weight))

    # Enforce GC content constraint
    if OPTIONS.get("enforce_gc", True):
        constraints.append(EnforceGCContent(location=(0, CDSlen, 1), mini=0.35, maxi=0.60))  # type: ignore[arg-type]

    return DnaOptimizationProblem(
        sequence=CDS,
        constraints=constraints,
        objectives=objectives,
        logger=logger,  # type: ignore[arg-type]
    )


def evaluate_objectives_for_sequence(sequence, OPTIONS):
    """Re-evaluate configured objectives on an already-finalized sequence."""
    problem = build_optimization_problem(
        sequence,
        OPTIONS,
        logger="bar",
        explicit_lock_region=OPTIONS.get("explicit_lock_region"),
    )
    return problem.objectives_text_summary(), build_objectives_report(problem)


def runOptimization(CDS, OPTIONS, on_progress=None):
    """
    Optimize a coding sequence (CDS) based on provided options.

    Returns a tuple:
        (optimized_sequence, objectives_before, objectives_after)

    on_progress is an optional callable (fraction: float, stage: str) used
    to surface progress to callers that want to report it (e.g. Modal web
    endpoint polling a shared Dict). None by default so the synchronous
    local FastAPI path stays callback-free.
    """
    # Shared monotonic gate: every progress write goes through here, so
    # the UI only ever sees frac advance, never regress.
    progress_gate = _MonotonicProgress(on_progress)

    def _emit(frac, stage):
        progress_gate.emit(frac, stage)

    CDS = CDS.upper().replace("U", "T")
    explicit_main_site = OPTIONS.get("selected_wggw_site")
    explicit_main_info = None
    explicit_lock_region = None
    if explicit_main_site:
        CDS, explicit_main_info, explicit_lock_region = apply_explicit_wggw_site(
            CDS,
            explicit_main_site,
            resolve_split_point(OPTIONS, len(CDS)),
        )
        OPTIONS["explicit_wggw_main"] = explicit_main_info
    if explicit_lock_region is not None:
        OPTIONS["explicit_lock_region"] = explicit_lock_region

    # Create and solve the optimization problem. We hand DNAChisel a custom
    # proglog logger that forwards its internal bar updates ('mutation',
    # 'objective', 'constraint') to our on_progress callback, so the frontend
    # can show real sub-progress during the long `problem.optimize()` call
    # instead of sitting frozen at 45% for most of the run.
    #
    # Both loggers are None when no progress callback was supplied. "bar" is
    # only ever a *constructor* argument — DNAChisel turns it into a proglog
    # logger itself. Assigning the string to `problem.logger` afterwards
    # replaces the real logger and makes optimize() fail on
    # logger.iter_bar(), so the swap below is guarded.
    optimize_logger = (
        _ProgressBridgeLogger(
            gate=progress_gate,
            frac_range=(0.45, 0.88),
            stage="Optimizing sequence",
        )
        if on_progress is not None
        else None
    )
    resolve_logger = (
        _ProgressBridgeLogger(
            gate=progress_gate,
            frac_range=(0.15, 0.40),
            stage="Resolving constraints",
        )
        if on_progress is not None
        else None
    )

    _emit(0.10, "Preparing constraints")
    problem = build_optimization_problem(
        CDS,
        OPTIONS,
        logger=resolve_logger if resolve_logger is not None else "bar",
        explicit_lock_region=explicit_lock_region,
    )
    _emit(0.15, "Resolving constraints")
    problem.resolve_constraints()

    objectives_before = problem.objectives_text_summary()
    OPTIONS["objectives_report_before"] = build_objectives_report(problem)
    _emit(0.45, "Optimizing sequence")
    # Swap in the optimize-phase bridge, but only when there is one: the
    # logger DNAChisel built for us stays in place otherwise.
    if optimize_logger is not None:
        # dnachisel's annotation only admits its own two logger classes, but
        # any proglog ProgressBarLogger works at runtime.
        problem.logger = optimize_logger  # type: ignore[assignment]
    # Also run a heartbeat thread as a safety net: if dnachisel doesn't emit
    # bar events frequently enough (short objective lists, tight loops,
    # different version internals), we still creep forward on wall-clock so
    # the UI never looks frozen.
    with _progress_heartbeat(
        gate=progress_gate,
        frac_range=(0.45, 0.87),
        expected_seconds=10.0,
    ):
        problem.optimize()
    objectives_after = problem.objectives_text_summary()
    OPTIONS["objectives_report_after"] = build_objectives_report(problem)
    _emit(0.92, "Finalizing")

    return problem.sequence, objectives_before, objectives_after


def candidateSpliceSites(seq):
    """
    Identify candidate splice site locations using pattern '[AT]GG[AT]'.

    Returns a list of positions where the pattern starts.
    """
    motiflocs = []
    currind = 0
    while True:
        res = re.search("[AT]GG[AT]", seq[currind:])
        if res is None:
            break
        motiflocs.append(res.start() + currind)
        currind += res.start() + 1
    return motiflocs


def relativePosition(motiflocs, pos):
    """
    Calculate distances of candidate motifs relative to a given position.

    Returns sorted list of (distance, position) pairs, ordered by absolute distance.
    """
    dists = [x - pos for x in motiflocs]
    distpairs = list(zip(dists, motiflocs, strict=True))
    distpairs.sort(key=lambda x: abs(x[0]))
    return distpairs


def insertSplitMarkers(optimized_sequence, OPTIONS):
    """
    Insert temporary markers into the optimized sequence for later splitting.
    First installs all WGGW motifs, verifies translation is preserved,
    and only then adds markers.

    Returns the final parent sequence plus the marked sequence used to
    generate the 5' and 3' outputs.
    """
    CDSlen = len(optimized_sequence)
    split_point = resolve_split_point(OPTIONS, CDSlen)
    wggw_threshold = OPTIONS.get("wggw_threshold", 300)

    # Original protein sequence for verification
    original_protein = biotools.translate(optimized_sequence)

    # Dictionary to store all WGGW information for reporting
    wggw_info_all = {}

    # Step 1: First identify and install all WGGW motifs
    working_sequence = optimized_sequence
    main_split = None
    stim5_point = None
    stim3_point = None
    used_wggw_as_split = False

    explicit_main_info = OPTIONS.get("explicit_wggw_main")
    if explicit_main_info:
        main_split = explicit_main_info["split_position"]
        wggw_info_all["main"] = explicit_main_info
        used_wggw_as_split = True
    # Find and install main WGGW motif
    elif OPTIONS.get("ensure_wggw", True):
        sequence_with_wggw, wggw_info = insert_wggw_motif(working_sequence, split_point)

        # If a WGGW motif was successfully inserted, update the sequence
        if wggw_info:
            working_sequence = sequence_with_wggw
            wggw_info_all["main"] = wggw_info

            # If the WGGW motif is close enough to the split point, use it as the main split
            if wggw_info["distance_from_split"] <= wggw_threshold:
                main_split = wggw_info["position"] + 2  # Split in the middle of GG
                used_wggw_as_split = True

    # If no main split point identified yet, find one based on candidate splice sites
    if main_split is None:
        motiflocs = candidateSpliceSites(working_sequence)
        if not motiflocs:
            main_split = split_point  # Default to original split point
        else:
            candidates = relativePosition(motiflocs, split_point)
            main_split = candidates[0][1] + 2

    # Step 2: Find and potentially install stim_5 WGGW motif
    if OPTIONS.get("stim_5", False):
        upstream_split = split_point - 150
        sequence_with_wggw, stim5_info = insert_wggw_motif(
            working_sequence, upstream_split, min_distance=150, direction=-1
        )

        if stim5_info:
            # Verify protein sequence is preserved
            if biotools.translate(sequence_with_wggw) == original_protein:
                working_sequence = sequence_with_wggw
                wggw_info_all["stim5"] = stim5_info
                stim5_point = stim5_info["position"] + 2
            else:
                print("Warning: Stim5 WGGW insertion altered protein sequence - not using")

        # If no stim5 point identified yet, find one based on candidate splice sites
        if stim5_point is None:
            motiflocs = candidateSpliceSites(working_sequence)
            if motiflocs:
                candidates = relativePosition(motiflocs, split_point - 150)
                candidates = [c for c in candidates if c[0] < 0]
                if candidates:
                    stim5_point = candidates[0][1] + 2

    # Step 3: Find and potentially install stim_3 WGGW motif
    if OPTIONS.get("stim_3", False):
        downstream_split = split_point + 150
        sequence_with_wggw, stim3_info = insert_wggw_motif(
            working_sequence, downstream_split, min_distance=150, direction=1
        )

        if stim3_info:
            # Verify protein sequence is preserved
            if biotools.translate(sequence_with_wggw) == original_protein:
                working_sequence = sequence_with_wggw
                wggw_info_all["stim3"] = stim3_info
                stim3_point = stim3_info["position"] + 2
            else:
                print("Warning: Stim3 WGGW insertion altered protein sequence - not using")

        # If no stim3 point identified yet, find one based on candidate splice sites
        if stim3_point is None:
            motiflocs = candidateSpliceSites(working_sequence)
            if motiflocs:
                candidates = relativePosition(motiflocs, split_point + 150)
                candidates = [c for c in candidates if c[0] > 0]
                if candidates:
                    stim3_point = candidates[0][1] + 2

    # Step 4: Verify final sequence translation is preserved before adding markers
    final_protein = biotools.translate(working_sequence)
    if final_protein != original_protein:
        print("Warning: Final sequence with WGGW motifs alters protein sequence")
        # Revert to original sequence
        working_sequence = optimized_sequence

        # Recompute split points
        motiflocs = candidateSpliceSites(working_sequence)
        if not motiflocs:
            main_split = split_point
        else:
            candidates = relativePosition(motiflocs, split_point)
            main_split = candidates[0][1] + 2

        # Clear WGGW info since we reverted
        wggw_info_all = {}
        used_wggw_as_split = False

    # Step 5: Add markers
    # Add main split marker
    seq_with_marker = working_sequence[:main_split] + "0" + working_sequence[main_split:]

    # Offset for adjusting stim points due to main marker insertion
    main_offset = 1  # Length of '0'

    # Add stim5 marker if needed
    if stim5_point is not None:
        # Adjust stim5_point if it's after the main split
        if stim5_point > main_split:
            stim5_point += main_offset
        seq_with_marker = seq_with_marker[:stim5_point] + "1" + seq_with_marker[stim5_point:]

        # Update offset for stim3
        if stim3_point is not None and stim3_point > stim5_point:
            main_offset += 1  # Length of '1'

    # Add stim3 marker if needed
    if stim3_point is not None:
        # Adjust stim3_point for any prior marker insertions
        if stim3_point > main_split:
            stim3_point += main_offset
        seq_with_marker = seq_with_marker[:stim3_point] + "1" + seq_with_marker[stim3_point:]

    # Add WGGW info to OPTIONS for reporting
    if wggw_info_all:
        OPTIONS["wggw_info"] = wggw_info_all
    else:
        OPTIONS.pop("wggw_info", None)
    OPTIONS["used_wggw_as_split"] = used_wggw_as_split

    return SplitMarkerResult(
        final_sequence=working_sequence,
        sequence_with_markers=seq_with_marker,
        actual_split_point=main_split,
        wggw_info=wggw_info_all or None,
        used_wggw_as_split=used_wggw_as_split,
    )


def replaceMarkersWithPlaceholders(seq_with_markers):
    """
    Replace temporary markers with final placeholder motifs.

    Returns tuple of 5' and 3' sequences.
    """
    # Check if there are any markers in the sequence
    if "0" not in seq_with_markers:
        # Handle the case where no markers were inserted - just return the original sequence
        print("Warning: No main split marker (0) found in sequence. Returning original sequence.")
        return seq_with_markers, ""

    REJ5 = "[REJ5]"
    REJ3 = "[REJ3]"
    STIMTRON = "[STIMINTRON]"

    # Replace markers with placeholders
    finalseq = seq_with_markers.replace("0", REJ5 + "." + REJ3)
    finalseq = finalseq.replace("1", STIMTRON)

    # Split the sequence at the dot
    if "." in finalseq:
        seq5, seq3 = finalseq.split(".")
        return seq5, seq3
    else:
        print(
            "Warning: No split separator found in processed sequence. Returning complete sequence as seq5."
        )
        return finalseq, ""


def optimize_and_split(CDS, OPTIONS, on_progress=None):
    """
    Optimize a CDS and split it into final sequences.

    Returns:
        tuple: (seq5, seq3, objectives_before, objectives_after, optimized_seq)

    Raises:
        OptimizationError: the optimizer finished but the design is unusable.
        Anything DNAChisel raises propagates unchanged — callers turn it into
        an error response. Returning empty strings here (as this used to) made
        a failed run look like a successful empty design.
    """
    optimized_seq, objectives_before, objectives_after = runOptimization(
        CDS, OPTIONS, on_progress=on_progress
    )
    if not optimized_seq:
        raise OptimizationError("Optimization produced an empty sequence")

    split_result = insertSplitMarkers(optimized_seq, OPTIONS)
    seq_with_markers = split_result.sequence_with_markers

    # Check for numeric markers in sequence which could cause translation errors
    if re.search(r"[^ACGT]", seq_with_markers):
        # Count numeric markers
        num_0_markers = seq_with_markers.count("0")
        num_1_markers = seq_with_markers.count("1")
        print(
            f"Found {num_0_markers} main markers and {num_1_markers} stimulatory markers in sequence"
        )

    seq5, seq3 = replaceMarkersWithPlaceholders(seq_with_markers)
    OPTIONS["actual_split_point"] = split_result.actual_split_point
    try:
        objectives_after, objectives_report_after = evaluate_objectives_for_sequence(
            split_result.final_sequence,
            OPTIONS,
        )
        OPTIONS["objectives_report_after"] = objectives_report_after
    except Exception as report_error:
        # The design itself is fine; only the (cosmetic) re-scored report is
        # missing, so keep the summary from the optimize phase.
        print(f"Warning: Final objective re-evaluation failed: {report_error}")

    if not split_result.final_sequence or not seq5:
        raise OptimizationError("Optimization produced an empty design fragment")

    return seq5, seq3, objectives_before, objectives_after, split_result.final_sequence


def process_single_request_json(CDS, name, OPTIONS, on_progress=None):
    """
    Process a single coding sequence and return structured results as a dict.
    Created for the web application JSON API.

    Args:
        CDS: The coding sequence string to process
        name: Name identifier for the sequence
        OPTIONS: Optimization options dictionary. An optional "seed" makes the
            run reproducible; without one a seed is derived from the inputs.
        on_progress: Optional (fraction, stage) progress callback

    Returns:
        dict: Structured results including sequences, objectives, WGGW info
        and the seed the run used
    """
    import time as _time

    start = _time.monotonic()

    # Clean up the input sequence
    CDS = CDS.strip().upper().replace("U", "T")

    # Ensure the CDS is valid
    if not CDS:
        raise ValueError("Coding sequence must not be empty")
    if not re.match(r"^[ACGT]+$", CDS):
        raise ValueError("Coding sequence must contain only A, C, G, T, or U")
    if len(CDS) % 3 != 0:
        raise ValueError("Coding sequence length is not a multiple of 3")

    # Create a copy of OPTIONS without modifying the original
    options_copy = OPTIONS.copy()

    # Seed before touching DNAChisel so the design is reproducible.
    seed = resolve_seed(CDS, options_copy)
    apply_seed(seed)

    if on_progress is not None:
        on_progress(0.05, "Checking sequence")

    # Run the optimization and splitting
    seq5, seq3, obj_before, obj_after, optimized_seq = optimize_and_split(
        CDS, options_copy, on_progress=on_progress
    )

    elapsed = _time.monotonic() - start

    # Extract WGGW info, converting tuples to lists for JSON serialization
    wggw_info_raw = options_copy.get("wggw_info")
    wggw_info = None
    if wggw_info_raw:
        wggw_info = {}
        for site_type, info in wggw_info_raw.items():
            wggw_info[site_type] = {
                "position": info["position"],
                "motif": info["motif"],
                "distance_from_split": info["distance_from_split"],
                "original_codons": list(info["original_codons"]),
                "new_codons": list(info["new_codons"]),
            }

    return {
        "name": name,
        "original_sequence": CDS,
        "optimized_sequence": optimized_seq,
        "seq5": seq5,
        "seq3": seq3,
        "split_point": options_copy.get(
            "actual_split_point",
            resolve_split_point(options_copy, len(CDS)),
        ),
        "used_wggw_as_split": options_copy.get("used_wggw_as_split", False),
        "objectives_before": obj_before,
        "objectives_after": obj_after,
        "objectives_report_before": options_copy.get("objectives_report_before")
        or {"entries": [], "total_score": None},
        "objectives_report_after": options_copy.get("objectives_report_after")
        or {"entries": [], "total_score": None},
        "wggw_info": wggw_info,
        "processing_time_seconds": round(elapsed, 2),
        "seed": seed,
    }
