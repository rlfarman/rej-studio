import os
import glob
import re
import contextlib
import random
import threading
import time
import sys
import shutil
from functools import partial
from concurrent.futures import ProcessPoolExecutor, TimeoutError
import concurrent.futures
from tqdm import tqdm
from dnachisel import *
from dnachisel import biotools
from collections import defaultdict

# proglog ships with dnachisel; if import shape shifts we fall back to a
# stub base that does nothing so the algorithm still runs.
try:
    from proglog import ProgressBarLogger as _ProgressBarLoggerBase
except Exception:  # pragma: no cover - defensive
    class _ProgressBarLoggerBase:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            pass

        def __call__(self, *args, **kwargs):
            pass


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

    def emit(self, frac, stage):
        if self._on_progress is None:
            return
        with self._lock:
            if frac <= self._last_frac:
                return
            self._last_frac = frac
            self._last_emit_at = time.monotonic()
        try:
            self._on_progress(frac, stage)
        except Exception:
            pass

    @property
    def last_frac(self):
        with self._lock:
            return self._last_frac

    @property
    def seconds_since_emit(self):
        with self._lock:
            if self._last_emit_at == 0.0:
                return float('inf')
            return time.monotonic() - self._last_emit_at


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
        if attr not in ('index', 'total'):
            return
        try:
            v = int(value)
        except (TypeError, ValueError):
            return
        if bar == 'objective':
            if attr == 'total':
                self._obj_total = max(0, v)
            elif attr == 'index':
                self._obj_index = max(0, v)
        elif bar == 'mutation':
            if attr == 'total':
                self._mut_total = max(0, v)
            elif attr == 'index':
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
def _progress_heartbeat(gate, frac_range, stage, expected_seconds, idle_after=2.0):
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
                gate.emit(frac, stage)
            stop_event.wait(1.5)

    t = threading.Thread(target=run, name='progress-heartbeat', daemon=True)
    t.start()
    try:
        yield
    finally:
        stop_event.set()
        t.join(timeout=0.5)

# A simple "tee" object for duplicating writes
class Tee:
    """Utility class to duplicate writes to multiple streams."""
    def __init__(self, *streams):
        self.streams = streams
    
    def write(self, data):
        """Write data to all streams."""
        for s in self.streams:
            s.write(data)
    
    def flush(self):
        """Flush all streams."""
        for s in self.streams:
            s.flush()

# WGGW Motif Insertion Functions
def get_codon_table():
    """Generate a dictionary mapping codons to amino acids."""
    codons = []
    for n1 in ['A', 'C', 'G', 'T']:
        for n2 in ['A', 'C', 'G', 'T']:
            for n3 in ['A', 'C', 'G', 'T']:
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
    weak_bases = ['A', 'T']
    
    for codon1, aa1 in CODON_TABLE.items():
        for codon2, aa2 in CODON_TABLE.items():
            dipeptide = aa1 + aa2
            hexamer = codon1 + codon2
            
            for i in range(len(hexamer) - 3):
                if (hexamer[i] in weak_bases and hexamer[i+1:i+3] == 'GG' and hexamer[i+3] in weak_bases):
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
    best_distance = float('inf')
    
    for i in range(len(protein_seq) - 1):
        dipeptide = protein_seq[i:i+2]
        
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
    current_codon1 = sequence[dna_position:dna_position+3]
    current_codon2 = sequence[dna_position+3:dna_position+6]
    
    # Get valid codon pairs for this dipeptide
    valid_pairs = WGGW_DIPEPTIDES[dipeptide]
    new_codon1, new_codon2 = valid_pairs[0]
    
    # Create recoded sequence
    recoded_sequence = sequence[:dna_position] + new_codon1 + new_codon2 + sequence[dna_position+6:]
    
    # Verify translation is preserved
    if biotools.translate(recoded_sequence) != protein_seq:
        return sequence, None
    
    # Get the position of the WGGW motif
    new_hexamer = recoded_sequence[dna_position:dna_position+6]
    wggw_pattern = re.compile('[AT]GG[AT]')
    wggw_match = wggw_pattern.search(new_hexamer)
    
    if wggw_match:
        wggw_position = dna_position + wggw_match.start()
        wggw_info = {
            'position': wggw_position,
            'motif': wggw_match.group(),
            'distance_from_split': abs(wggw_position - split_point),
            'original_codons': (current_codon1, current_codon2),
            'new_codons': (new_codon1, new_codon2)
        }
        return recoded_sequence, wggw_info
    
    return sequence, None

def _serialize_evaluation_location(loc):
    """Serialize a DNAChisel Location object to a JSON-safe dict."""
    try:
        start = int(getattr(loc, 'start', 0))
        end = int(getattr(loc, 'end', 0))
        strand = getattr(loc, 'strand', None)
        if strand is not None:
            try:
                strand = int(strand)
            except (TypeError, ValueError):
                strand = None
        return {'start': start, 'end': end, 'strand': strand}
    except Exception:
        return None


def _serialize_evaluation(ev):
    """Serialize a single DNAChisel ObjectiveEvaluation to a JSON-safe dict."""
    try:
        score = float(ev.score) if ev.score is not None else 0.0
    except (TypeError, ValueError):
        score = 0.0
    try:
        passes = bool(ev.passes)
    except Exception:
        passes = False
    try:
        spec = getattr(ev, 'specification', None) or getattr(ev, 'objective', None)
        objective_str = str(spec) if spec is not None else '<unknown>'
    except Exception:
        objective_str = '<unknown>'
    try:
        message = str(ev.message) if getattr(ev, 'message', None) else ''
    except Exception:
        message = ''
    locations = []
    raw_locs = getattr(ev, 'locations', None) or []
    for loc in raw_locs:
        sl = _serialize_evaluation_location(loc)
        if sl is not None:
            locations.append(sl)
    return {
        'objective': objective_str,
        'passes': passes,
        'score': score,
        'message': message,
        'locations': locations,
    }


def build_objectives_report(problem):
    """Build a structured JSON-safe report from DNAChisel objectives evaluations.

    Falls back to an empty report if the DNAChisel API differs from expected.
    """
    try:
        evaluations = problem.objectives_evaluations()
        items = getattr(evaluations, 'evaluations', None)
        if items is None and hasattr(evaluations, '__iter__'):
            items = list(evaluations)
        if items is None:
            return {'entries': [], 'total_score': None}
    except Exception:
        return {'entries': [], 'total_score': None}
    entries = [_serialize_evaluation(ev) for ev in items]
    total = sum(e['score'] for e in entries) if entries else None
    return {'entries': entries, 'total_score': total}


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
    CDS = CDS.upper()
    AAseq = biotools.translate(CDS)
    constraints = []
    objectives = []
    CDSlen = len(CDS)
    
    # Enforce that the translation remains unchanged
    constraints.append(EnforceTranslation(location=(0, CDSlen, 1), translation=AAseq))
    
    # Remove cryptic splice sites objective
    if OPTIONS.get('remove_cryptic_ss', False):
        remove_weight = OPTIONS.get('remove_cryptic_ss_weight', 1.0)
        splice_patterns = ['GT[AG]A', 'AAGTA', '[CTA]AG[GA]', 'CAG[GC]']
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
            "[CT]{5}[AG][ACGT][CT]AG[GA]T"
        ]
        splice_patterns += splice_acceptors
        objectives.extend(
            AvoidPattern(SequencePattern(p), location=(0, CDSlen, 1), boost=remove_weight)
            for p in splice_patterns
        )
    
    # Codon optimization objective
    if OPTIONS.get('codon_optimize') in ['human', 'mouse']:
        codon_weight = OPTIONS.get('codon_optimize_weight', 1.0)
        speciesmap = {'human': 'h_sapiens', 'mouse': 'm_musculus'}
        objectives.append(CodonOptimize(
            species=speciesmap[OPTIONS['codon_optimize']],
            location=(0, CDSlen, 1),
            boost=codon_weight
        ))
    
    # Minimize CpG dinucleotides objective
    if OPTIONS.get('minimize_CpGs', False):
        cpg_weight = OPTIONS.get('minimize_CpGs_weight', 1.0)
        objectives.append(AvoidPattern(
            SequencePattern("CG"),
            location=(0, CDSlen, 1),
            boost=cpg_weight
        ))
    
    # Reduce k-mer complexity objective
    if OPTIONS.get('reduce_kmer_complexity', False):
        k_val = OPTIONS.get('reduce_kmer_complexity_k', 10)  # Default to 10 as requested
        kmer_weight = OPTIONS.get('reduce_kmer_complexity_weight', 1.0)
        objectives.append(UniquifyAllKmers(
            k=k_val,
            location=(0, CDSlen, 1),
            boost=kmer_weight
        ))
    
    # Enforce GC content constraint
    if OPTIONS.get('enforce_gc', True):
        constraints.append(EnforceGCContent(location=(0, CDSlen, 1), mini=0.35, maxi=0.60))
    
    # Create and solve the optimization problem. We hand DNAChisel a custom
    # proglog logger that forwards its internal bar updates ('mutation',
    # 'objective', 'constraint') to our on_progress callback, so the frontend
    # can show real sub-progress during the long `problem.optimize()` call
    # instead of sitting frozen at 45% for most of the run.
    optimize_logger = _ProgressBridgeLogger(
        gate=progress_gate,
        frac_range=(0.45, 0.88),
        stage='Optimizing sequence',
    ) if on_progress is not None else 'bar'
    resolve_logger = _ProgressBridgeLogger(
        gate=progress_gate,
        frac_range=(0.15, 0.40),
        stage='Resolving constraints',
    ) if on_progress is not None else 'bar'

    _emit(0.10, 'Preparing constraints')
    problem = DnaOptimizationProblem(
        sequence=CDS,
        constraints=constraints,
        objectives=objectives,
        logger=resolve_logger,
    )
    _emit(0.15, 'Resolving constraints')
    problem.resolve_constraints()

    objectives_before = problem.objectives_text_summary()
    OPTIONS['objectives_report_before'] = build_objectives_report(problem)
    _emit(0.45, 'Optimizing sequence')
    # Swap in the optimize-phase logger. Some dnachisel versions look it up
    # as problem.logger; this reassignment is safe either way.
    problem.logger = optimize_logger
    # Also run a heartbeat thread as a safety net: if dnachisel doesn't emit
    # bar events frequently enough (short objective lists, tight loops,
    # different version internals), we still creep forward on wall-clock so
    # the UI never looks frozen.
    with _progress_heartbeat(
        gate=progress_gate,
        frac_range=(0.45, 0.87),
        stage='Optimizing sequence',
        expected_seconds=10.0,
    ):
        problem.optimize()
    objectives_after = problem.objectives_text_summary()
    OPTIONS['objectives_report_after'] = build_objectives_report(problem)
    _emit(0.92, 'Finalizing')

    return problem.sequence, objectives_before, objectives_after

def candidateSpliceSites(seq):
    """
    Identify candidate splice site locations using pattern '[AT]GG[AT]'.
    
    Returns a list of positions where the pattern starts.
    """
    motiflocs = []
    currind = 0
    while True:
        res = re.search('[AT]GG[AT]', seq[currind:])
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
    distpairs = list(zip(dists, motiflocs))
    distpairs.sort(key=lambda x: abs(x[0]))
    return distpairs

def insertSplitMarkers(optimized_sequence, OPTIONS):
    """
    Insert temporary markers into the optimized sequence for later splitting.
    First installs all WGGW motifs, verifies translation is preserved,
    and only then adds markers.
    
    Returns sequence with inserted markers.
    """
    CDSlen = len(optimized_sequence)
    split_point = OPTIONS.get('split_point', CDSlen // 2)
    wggw_threshold = OPTIONS.get('wggw_threshold', 300)
    
    # Original protein sequence for verification
    original_protein = biotools.translate(optimized_sequence)
    
    # Dictionary to store all WGGW information for reporting
    wggw_info_all = {}
    
    # Step 1: First identify and install all WGGW motifs
    working_sequence = optimized_sequence
    main_split = None
    stim5_point = None
    stim3_point = None
    
    # Find and install main WGGW motif
    if OPTIONS.get('ensure_wggw', True):
        sequence_with_wggw, wggw_info = insert_wggw_motif(working_sequence, split_point)
        
        # If a WGGW motif was successfully inserted, update the sequence
        if wggw_info:
            working_sequence = sequence_with_wggw
            wggw_info_all['main'] = wggw_info
            
            # If the WGGW motif is close enough to the split point, use it as the main split
            if wggw_info['distance_from_split'] <= wggw_threshold:
                main_split = wggw_info['position'] + 2  # Split in the middle of GG
                OPTIONS['used_wggw_as_split'] = True
    
    # If no main split point identified yet, find one based on candidate splice sites
    if main_split is None:
        motiflocs = candidateSpliceSites(working_sequence)
        if not motiflocs:
            main_split = split_point  # Default to original split point
        else:
            candidates = relativePosition(motiflocs, split_point)
            main_split = candidates[0][1] + 2
    
    # Step 2: Find and potentially install stim_5 WGGW motif
    if OPTIONS.get('stim_5', False):
        upstream_split = split_point - 150
        sequence_with_wggw, stim5_info = insert_wggw_motif(
            working_sequence, upstream_split, min_distance=150, direction=-1
        )
        
        if stim5_info:
            # Verify protein sequence is preserved
            if biotools.translate(sequence_with_wggw) == original_protein:
                working_sequence = sequence_with_wggw
                wggw_info_all['stim5'] = stim5_info
                stim5_point = stim5_info['position'] + 2
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
    if OPTIONS.get('stim_3', False):
        downstream_split = split_point + 150
        sequence_with_wggw, stim3_info = insert_wggw_motif(
            working_sequence, downstream_split, min_distance=150, direction=1
        )
        
        if stim3_info:
            # Verify protein sequence is preserved
            if biotools.translate(sequence_with_wggw) == original_protein:
                working_sequence = sequence_with_wggw
                wggw_info_all['stim3'] = stim3_info
                stim3_point = stim3_info['position'] + 2
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
    
    # Step 5: Add markers
    # Add main split marker
    seq_with_marker = working_sequence[:main_split] + '0' + working_sequence[main_split:]
    
    # Offset for adjusting stim points due to main marker insertion
    main_offset = 1  # Length of '0'
    
    # Add stim5 marker if needed
    if stim5_point is not None:
        # Adjust stim5_point if it's after the main split
        if stim5_point > main_split:
            stim5_point += main_offset
        seq_with_marker = seq_with_marker[:stim5_point] + '1' + seq_with_marker[stim5_point:]
        
        # Update offset for stim3
        if stim3_point is not None and stim3_point > stim5_point:
            main_offset += 1  # Length of '1'
    
    # Add stim3 marker if needed
    if stim3_point is not None:
        # Adjust stim3_point for any prior marker insertions
        if stim3_point > main_split:
            stim3_point += main_offset
        seq_with_marker = seq_with_marker[:stim3_point] + '1' + seq_with_marker[stim3_point:]
    
    # Add WGGW info to OPTIONS for reporting
    if wggw_info_all:
        OPTIONS['wggw_info'] = wggw_info_all
    
    return seq_with_marker

def replaceMarkersWithPlaceholders(seq_with_markers):
    """
    Replace temporary markers with final placeholder motifs.
    
    Returns tuple of 5' and 3' sequences.
    """
    # Check if there are any markers in the sequence
    if '0' not in seq_with_markers:
        # Handle the case where no markers were inserted - just return the original sequence
        print("Warning: No main split marker (0) found in sequence. Returning original sequence.")
        return seq_with_markers, ""
    
    REJ5 = "[REJ5]"
    REJ3 = "[REJ3]"
    STIMTRON = "[STIMINTRON]"
    
    # Replace markers with placeholders
    finalseq = seq_with_markers.replace('0', REJ5 + '.' + REJ3)
    finalseq = finalseq.replace('1', STIMTRON)
    
    # Split the sequence at the dot
    if '.' in finalseq:
        seq5, seq3 = finalseq.split('.')
        return seq5, seq3
    else:
        print("Warning: No split separator found in processed sequence. Returning complete sequence as seq5.")
        return finalseq, ""

def optimize_and_split(CDS, OPTIONS, on_progress=None):
    """
    Optimize a CDS and split it into final sequences.

    Returns:
        tuple: (seq5, seq3, objectives_before, objectives_after, optimized_seq)
    """
    try:
        optimized_seq, objectives_before, objectives_after = runOptimization(CDS, OPTIONS, on_progress=on_progress)
        seq_with_markers = insertSplitMarkers(optimized_seq, OPTIONS)
        
        # Check for numeric markers in sequence which could cause translation errors
        if re.search(r'[^ACGT]', seq_with_markers):
            # Count numeric markers
            num_0_markers = seq_with_markers.count('0')
            num_1_markers = seq_with_markers.count('1')
            print(f"Found {num_0_markers} main markers and {num_1_markers} stimulatory markers in sequence")
            
        seq5, seq3 = replaceMarkersWithPlaceholders(seq_with_markers)
        
        return seq5, seq3, objectives_before, objectives_after, optimized_seq
        
    except Exception as e:
        print(f"Error in optimize_and_split: {str(e)}")
        # Return empty values to indicate error
        return "", "", "Error occurred", f"Error: {str(e)}", ""

def process_gene(file_path, OPTIONS, results_folder="results"):
    """
    Process a single gene file.
    
    Args:
        file_path: Path to gene file
        OPTIONS: Optimization options dictionary
        results_folder: Folder to save output files
    
    Returns:
        tuple: (report_filename, sequences_filename)
    """
    try:
        gene_name = os.path.splitext(os.path.basename(file_path))[0]
        with open(file_path, "r", encoding="utf-8") as f:
            CDS = f.read().strip()
        
        seq5, seq3, obj_before, obj_after, optimized_seq = optimize_and_split(CDS, OPTIONS)
        
        # Prepare report text
        report_text = f"Gene Name: {gene_name}\n"
        report_text += "CDS:\n" + CDS + "\n\n"
        report_text += "Options Used:\n" + str(OPTIONS) + "\n\n"
        report_text += "Optimized Sequence (prior to splitting):\n" + optimized_seq + "\n\n"
        report_text += "Objectives Summary (Before optimization):\n" + obj_before + "\n\n"
        report_text += "Objectives Summary (After optimization):\n" + obj_after + "\n"
        
        # Add WGGW information if available
        if 'wggw_info' in OPTIONS:
            wggw_info_all = OPTIONS['wggw_info']
            report_text += "\nWGGW Motif Information:\n"
            
            for site_type, info in wggw_info_all.items():
                report_text += f"\n{site_type.upper()} Site:\n"
                report_text += f"  Position: {info['position']}\n"
                report_text += f"  Motif: {info['motif']}\n"
                report_text += f"  Distance from split point: {info['distance_from_split']} bp\n"
                report_text += f"  Original codons: {info['original_codons'][0]}|{info['original_codons'][1]}\n"
                report_text += f"  New codons: {info['new_codons'][0]}|{info['new_codons'][1]}\n"
                
                # Add specific location information for main/stim sites
                if site_type == 'main':
                    main_location = info['position'] + 2  # Middle of GG
                    report_text += f"  Main Split Location: {main_location}\n"
                elif site_type == 'stim5':
                    stim5_location = info['position'] + 2  # Middle of GG
                    report_text += f"  Stim5 Location: {stim5_location}\n"
                elif site_type == 'stim3':
                    stim3_location = info['position'] + 2  # Middle of GG
                    report_text += f"  Stim3 Location: {stim3_location}\n"
            
            if 'main' in wggw_info_all:
                report_text += f"\nUsed WGGW as main split point: {OPTIONS.get('used_wggw_as_split', False)}\n"
        
        # Create results folder - use absolute path
        results_folder = os.path.abspath(results_folder)
        os.makedirs(results_folder, exist_ok=True)
        
        # Write output files with explicit paths
        report_filename = os.path.join(results_folder, f"optimization_report.{gene_name}.txt")
        sequences_filename = os.path.join(results_folder, f"REJ.{gene_name}.txt")
        
        # Verify the paths
        print(f"Writing report to: {report_filename}")
        print(f"Writing sequences to: {sequences_filename}")
        
        with open(report_filename, "w", encoding="utf-8") as report_file:
            report_file.write(report_text)
        
        with open(sequences_filename, "w", encoding="utf-8") as seq_file:
            seq_file.write("5' Sequence:\n" + seq5 + "\n\n3' Sequence:\n" + seq3)
        
        # Verify files were created
        if not os.path.exists(report_filename):
            print(f"Warning: Failed to create report file: {report_filename}")
        if not os.path.exists(sequences_filename):
            print(f"Warning: Failed to create sequences file: {sequences_filename}")
        
        return report_filename, sequences_filename
    
    except Exception as e:
        print(f"Error in process_gene: {str(e)}")
        # Ensure the results folder exists even on error
        os.makedirs(results_folder, exist_ok=True)
        # Return placeholder filenames for error reporting
        error_report = os.path.join(results_folder, f"error_report.{os.path.basename(file_path)}.txt")
        with open(error_report, "w", encoding="utf-8") as f:
            f.write(f"Error processing {file_path}: {str(e)}\n")
        return error_report, None

def process_gene_silent(file_path, OPTIONS, suppress_stderr=True, results_folder="results", logs_folder="logs"):
    """
    Process a gene with logging and error handling.
    
    Args:
        file_path: Path to gene file
        OPTIONS: Optimization options dictionary
        suppress_stderr: Whether to suppress standard error output
        results_folder: Folder to save results
        logs_folder: Folder to save logs
    
    Returns:
        tuple: (report_filename, sequences_filename, gene_name, sequence_length, elapsed_time)
    """
    start_time = time.time()
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            CDS = f.read().strip()
        seq_len = len(CDS)
        gene_name = os.path.splitext(os.path.basename(file_path))[0]
        
        # Dynamically set the split point
        options_for_gene = OPTIONS.copy()
        options_for_gene['split_point'] = seq_len // 2
        
        # Convert to absolute paths
        results_folder = os.path.abspath(results_folder)
        logs_folder = os.path.abspath(logs_folder)
        
        # Create logs folder
        os.makedirs(logs_folder, exist_ok=True)
        stdout_log_filename = os.path.join(logs_folder, f"{gene_name}_stdout.txt")
        stderr_log_filename = os.path.join(logs_folder, f"{gene_name}_stderr.txt")
        
        with open(stdout_log_filename, "w") as stdout_file, open(stderr_log_filename, "w") as stderr_file:
            stderr_target = Tee(stderr_file, sys.stderr) if not suppress_stderr else stderr_file
            with contextlib.redirect_stdout(stdout_file), contextlib.redirect_stderr(stderr_target):
                result = process_gene(file_path, options_for_gene, results_folder)
        
        elapsed_time = time.time() - start_time

        # Make sure the result contains valid filenames
        if result is None or result[0] is None:
            if not suppress_stderr:
                print(f"Error: process_gene returned None for {gene_name}")
            # Create a placeholder report file
            error_report = os.path.join(results_folder, f"error_report.{gene_name}.txt")
            with open(error_report, "w", encoding="utf-8") as f:
                f.write(f"Error processing {file_path}: process_gene returned None\n")
                f.write(f"Processing Time (seconds): {elapsed_time:.2f}\n")
            return error_report, None, gene_name, seq_len, elapsed_time
        
        # Append processing time information to the optimization report
        report_filename = result[0]
        try:
            with open(report_filename, "a", encoding="utf-8") as report_file:
                report_file.write(f"\nProcessing Time (seconds): {elapsed_time:.2f}\n")
        except Exception as e:
            if not suppress_stderr:
                print(f"Warning: Could not append processing time to {report_filename}: {str(e)}")
        
        return result + (gene_name, seq_len, elapsed_time)
    
    except Exception as e:
        elapsed_time = time.time() - start_time
        if not suppress_stderr:
            print(f"Error in process_gene_silent for {os.path.basename(file_path)}: {str(e)}")
        
        # Ensure the results folder exists
        os.makedirs(results_folder, exist_ok=True)
        
        # Create an error report
        gene_name = os.path.splitext(os.path.basename(file_path))[0]
        error_report = os.path.join(results_folder, f"error_report.{gene_name}.txt")
        with open(error_report, "w", encoding="utf-8") as f:
            f.write(f"Error processing {file_path}: {str(e)}\n")
            f.write(f"Processing Time (seconds): {elapsed_time:.2f}\n")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                CDS = f.read().strip()
                seq_len = len(CDS)
        except:
            seq_len = 0
            
        return error_report, None, gene_name, seq_len, elapsed_time

def check_file(file_path, results_folder="results"):
    """
    Check if a gene file qualifies for processing.
    
    Returns the file_path if it qualifies; otherwise, returns None.
    """
    gene_name = os.path.splitext(os.path.basename(file_path))[0]
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            CDS = f.read().strip()
    except Exception:
        return None

    CDS = CDS.upper()
    if "N" in CDS or (len(CDS) % 3 != 0):
        error_folder = "coding_sequence_error"
        os.makedirs(error_folder, exist_ok=True)
        dest_path = os.path.join(error_folder, os.path.basename(file_path))
        shutil.move(file_path, dest_path)
        return None

    report_filename = os.path.join(results_folder, f"optimization_report.{gene_name}.txt")
    if os.path.exists(report_filename):
        return None
    return file_path

def process_all_genes(OPTIONS, max_files=300, suppress_stderr=True, randomize=True, 
                     skip_complex=True, results_folder="results", logs_folder="logs"):
    """
    Process multiple gene files in parallel with custom progress tracking.
    
    Args:
        OPTIONS: Optimization options dictionary
        max_files: Maximum number of files to process
        suppress_stderr: Whether to suppress standard error output
        randomize: Whether to randomize file order
        skip_complex: Whether to skip files that take too long
        results_folder: Folder to save results
        logs_folder: Folder to save logs
    
    Returns:
        list: Results from processing each gene
    """
    files = glob.glob(os.path.join("coding_sequences", "*.txt"))
    if not files:
        raise FileNotFoundError("No text files found in the 'coding_sequences' folder.")
    
    # Create results folder
    os.makedirs(results_folder, exist_ok=True)
    
    # Filter files quietly with minimal output
    print("Filtering files...")
    files_to_process = []
    for file_path in files:
        result = check_file(file_path, results_folder)
        if result is not None:
            files_to_process.append(result)
    print(f"Found {len(files_to_process)} files to process.")
    
    if randomize:
        random.shuffle(files_to_process)
    
    files_to_process = files_to_process[:max_files]
    num_files_to_process = len(files_to_process)
    
    print(f"Processing {num_files_to_process} files...")
    
    # Function to get completed files from results folder
    def get_completed_files():
        return set(glob.glob(os.path.join(results_folder, "optimization_report.*.txt")))
    
    # Get initial set of files
    initial_files = get_completed_files()
    
    # Function to display progress based on file count
    def display_progress():
        current_files = get_completed_files()
        new_files = current_files - initial_files
        completed = len(new_files)
        
        # Calculate progress percentage
        progress = min(1.0, completed / num_files_to_process) if num_files_to_process > 0 else 0
        percentage = progress * 100
        
        # Calculate elapsed time
        elapsed_time = time.time() - start_time
        
        # Calculate estimated time remaining
        if completed > 0:
            avg_time_per_file = elapsed_time / completed
            remaining_time = avg_time_per_file * (num_files_to_process - completed)
        else:
            remaining_time = 0
        
        # Calculate processing rate (files per second)
        if elapsed_time > 0:
            rate = completed / elapsed_time
        else:
            rate = 0
        
        # Create progress bar
        bar_length = 40
        filled_length = int(bar_length * progress)
        bar = '█' * filled_length + '░' * (bar_length - filled_length)
        
        # Format times nicely
        def format_time(seconds):
            if seconds < 0 or seconds > 9999999:
                return "???"
            hours, remainder = divmod(int(seconds), 3600)
            minutes, seconds = divmod(remainder, 60)
            if hours > 0:
                return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            else:
                return f"{minutes:02d}:{seconds:02d}"
        
        # Create status line
        status = (f"\r[{bar}] {percentage:.1f}% | "
                 f"{completed}/{num_files_to_process} | "
                 f"Elapsed: {format_time(elapsed_time)} | "
                 f"Remaining: {format_time(remaining_time)} | "
                 f"Rate: {rate:.2f} files/s")
        
        # Print status
        sys.stdout.write('\r' + ' ' * 100)  # Clear previous line
        sys.stdout.write(status)
        sys.stdout.flush()
        
        return completed
    
    # Process genes in parallel
    process_func = partial(process_gene_silent, OPTIONS=OPTIONS, 
                          suppress_stderr=suppress_stderr, 
                          results_folder=results_folder,
                          logs_folder=logs_folder)
    
    results = []
    start_time = time.time()
    last_update_time = start_time
    
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
        # Submit all jobs
        futures = [executor.submit(process_func, file_path) for file_path in files_to_process]
        
        # Monitor progress while jobs are running
        while True:
            # Only update display every second to avoid excessive updates
            current_time = time.time()
            if current_time - last_update_time >= 1.0:
                completed = display_progress()
                last_update_time = current_time
            
            # Check if all futures are done
            all_done = True
            for future in futures:
                if not future.done():
                    all_done = False
                    break
            
            if all_done:
                break
                
            # Sleep briefly to avoid high CPU usage in this loop
            time.sleep(0.5)
        
        # Collect results from completed futures
        for future in futures:
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                if not suppress_stderr:
                    print(f"\nError in processing: {str(e)}")
    
    # Final progress update
    completed = display_progress()
    print(f"\n\nCompleted {completed}/{num_files_to_process} files successfully.")
    
    return results

def process_single_request(CDS, name, OPTIONS, results_folder="/tmp/results"):
    """
    Process a single coding sequence directly (without reading from a file).
    Created for the web application.
    
    Args:
        CDS: The coding sequence string to process
        name: Name identifier for the output files
        OPTIONS: Optimization options dictionary
        results_folder: Folder to save output files
    
    Returns:
        tuple: (report_filename, sequences_filename)
    """
    try:
        # Resolve protein vs. DNA input, reverse-translating amino acids if
        # needed. See _resolve_sequence_input for the detection rules.
        requested_type = OPTIONS.get("input_type", "auto")
        CDS, _resolved_type, _original_protein = _resolve_sequence_input(
            CDS, requested_type
        )

        # Create a copy of OPTIONS without modifying the split point
        options_for_sequence = OPTIONS.copy()
        
        # Run the optimization and splitting
        seq5, seq3, obj_before, obj_after, optimized_seq = optimize_and_split(CDS, options_for_sequence)
        
        # Prepare report text
        report_text = f"Sequence Name: {name}\n"
        report_text += "CDS:\n" + CDS + "\n\n"
        report_text += "Options Used:\n" + str(options_for_sequence) + "\n\n"
        report_text += "Optimized Sequence (prior to splitting):\n" + optimized_seq + "\n\n"
        report_text += "Objectives Summary (Before optimization):\n" + obj_before + "\n\n"
        report_text += "Objectives Summary (After optimization):\n" + obj_after + "\n"
        
        # Add WGGW information if available
        if 'wggw_info' in options_for_sequence:
            wggw_info_all = options_for_sequence['wggw_info']
            report_text += "\nWGGW Motif Information:\n"
            
            for site_type, info in wggw_info_all.items():
                report_text += f"\n{site_type.upper()} Site:\n"
                report_text += f"  Position: {info['position']}\n"
                report_text += f"  Motif: {info['motif']}\n"
                report_text += f"  Distance from split point: {info['distance_from_split']} bp\n"
                report_text += f"  Original codons: {info['original_codons'][0]}|{info['original_codons'][1]}\n"
                report_text += f"  New codons: {info['new_codons'][0]}|{info['new_codons'][1]}\n"
                
                # Add specific location information for main/stim sites
                if site_type == 'main':
                    main_location = info['position'] + 2  # Middle of GG
                    report_text += f"  Main Split Location: {main_location}\n"
                elif site_type == 'stim5':
                    stim5_location = info['position'] + 2  # Middle of GG
                    report_text += f"  Stim5 Location: {stim5_location}\n"
                elif site_type == 'stim3':
                    stim3_location = info['position'] + 2  # Middle of GG
                    report_text += f"  Stim3 Location: {stim3_location}\n"
            
            if 'main' in wggw_info_all:
                report_text += f"\nUsed WGGW as main split point: {options_for_sequence.get('used_wggw_as_split', False)}\n"
        
        # Add processing timestamp
        current_time = time.strftime("%Y-%m-%d %H:%M:%S")
        report_text += f"\nProcessing Time: {current_time}\n"
        
        # Create results folder - use absolute path
        results_folder = os.path.abspath(results_folder)
        os.makedirs(results_folder, exist_ok=True)
        
        # Write output files with explicit paths
        report_filename = os.path.join(results_folder, f"optimization_report.{name}.txt")
        sequences_filename = os.path.join(results_folder, f"REJ.{name}.txt")
        
        # Write files
        with open(report_filename, "w", encoding="utf-8") as report_file:
            report_file.write(report_text)
        
        with open(sequences_filename, "w", encoding="utf-8") as seq_file:
            seq_file.write("5' Sequence:\n" + seq5 + "\n\n3' Sequence:\n" + seq3)
        
        return report_filename, sequences_filename
    
    except Exception as e:
        print(f"Error in process_single_request: {str(e)}")
        # Ensure the results folder exists even on error
        os.makedirs(results_folder, exist_ok=True)
        # Create an error report
        error_report = os.path.join(results_folder, f"error_report.{name}.txt")
        with open(error_report, "w", encoding="utf-8") as f:
            f.write(f"Error processing sequence '{name}': {str(e)}\n")
            f.write(f"CDS: {CDS[:100]}... (truncated if longer than 100 characters)\n")
        return error_report, None    

def _resolve_sequence_input(raw, requested_type):
    """Resolve a user-supplied sequence to a DNA CDS ready for optimization.

    Returns ``(CDS, resolved_type, original_protein)`` where:
      * ``CDS`` is an uppercase DNA string (length divisible by 3) to feed
        into dnachisel.
      * ``resolved_type`` is ``'dna'`` or ``'protein'``.
      * ``original_protein`` is the original amino-acid sequence when the
        input was protein, else ``None``.

    Protein input is reverse-translated with random codons; per-species
    harmonization still happens downstream via the CodonOptimize objective.
    """
    DNA_ALPHABET = set("ACGTU")
    PROTEIN_ALPHABET = set("ACDEFGHIKLMNPQRSTVWY*")
    # Letters that only appear in the AA alphabet (never in DNA/RNA). Their
    # presence unambiguously marks a protein sequence.
    PROTEIN_ONLY = set("DEFHIKLMNPQRSVWY*")

    seq = (raw or "").strip().upper()
    if not seq:
        raise ValueError("Sequence must not be empty")
    chars = set(seq)

    if requested_type not in ("auto", "dna", "protein"):
        raise ValueError(
            f"Unknown input_type {requested_type!r}; expected 'auto', 'dna', or 'protein'"
        )

    if requested_type == "auto":
        resolved_type = "protein" if chars & PROTEIN_ONLY else "dna"
    else:
        resolved_type = requested_type

    if resolved_type == "protein":
        invalid = chars - PROTEIN_ALPHABET
        if invalid:
            raise ValueError(
                "Protein sequence contains invalid characters: "
                + "".join(sorted(invalid))
            )
        # reverse_translate returns 3 bp per residue, so length is guaranteed
        # to be a multiple of 3 and contain no 'N'.
        dna = biotools.reverse_translate(seq, randomize_codons=True)
        return dna, "protein", seq

    # DNA path — normalize U→T and run the original validity checks.
    dna = seq.replace("U", "T")
    invalid = set(dna) - set("ACGT")
    if invalid:
        raise ValueError(
            "Coding sequence contains invalid nucleotides: "
            + "".join(sorted(invalid))
        )
    if "N" in dna:
        raise ValueError("Coding sequence contains ambiguous 'N' nucleotides")
    if len(dna) % 3 != 0:
        raise ValueError("Coding sequence length is not a multiple of 3")
    return dna, "dna", None


def process_single_request_json(CDS, name, OPTIONS, on_progress=None):
    """
    Process a single coding sequence and return structured results as a dict.
    Created for the web application JSON API.

    Args:
        CDS: The coding sequence (DNA) or amino-acid sequence to process.
            Protein input is auto-detected (or forced via
            ``OPTIONS['input_type']``) and reverse-translated to DNA before
            optimization.
        name: Name identifier for the sequence
        OPTIONS: Optimization options dictionary

    Returns:
        dict: Structured results including sequences, objectives, and WGGW info
    """
    import time as _time
    start = _time.monotonic()

    requested_type = OPTIONS.get("input_type", "auto")
    CDS, resolved_type, original_protein = _resolve_sequence_input(
        CDS, requested_type
    )

    # Create a copy of OPTIONS without modifying the original
    options_copy = OPTIONS.copy()

    if on_progress is not None:
        on_progress(0.05, 'Validating sequence')

    # Run the optimization and splitting
    seq5, seq3, obj_before, obj_after, optimized_seq = optimize_and_split(
        CDS, options_copy, on_progress=on_progress
    )

    elapsed = _time.monotonic() - start

    # Extract WGGW info, converting tuples to lists for JSON serialization
    wggw_info_raw = options_copy.get('wggw_info')
    wggw_info = None
    if wggw_info_raw:
        wggw_info = {}
        for site_type, info in wggw_info_raw.items():
            wggw_info[site_type] = {
                'position': info['position'],
                'motif': info['motif'],
                'distance_from_split': info['distance_from_split'],
                'original_codons': list(info['original_codons']),
                'new_codons': list(info['new_codons']),
            }

    return {
        'name': name,
        'original_sequence': CDS,
        'optimized_sequence': optimized_seq,
        'seq5': seq5,
        'seq3': seq3,
        'split_point': options_copy.get('split_point', OPTIONS.get('split_point')),
        'used_wggw_as_split': options_copy.get('used_wggw_as_split', False),
        'objectives_before': obj_before,
        'objectives_after': obj_after,
        'objectives_report_before': options_copy.get(
            'objectives_report_before'
        ) or {'entries': [], 'total_score': None},
        'objectives_report_after': options_copy.get(
            'objectives_report_after'
        ) or {'entries': [], 'total_score': None},
        'wggw_info': wggw_info,
        'processing_time_seconds': round(elapsed, 2),
        'input_type': resolved_type,
        'original_protein_sequence': original_protein,
    }


if __name__ == "__main__":
    OPTIONS = {
        'codon_optimize': 'human',
        'codon_optimize_weight': 1.0,
        'remove_cryptic_ss': True,
        'remove_cryptic_ss_weight': 1.0,
        'minimize_CpGs': True,
        'minimize_CpGs_weight': 1.0,
        'reduce_kmer_complexity': True,
        'reduce_kmer_complexity_k': 10,  # Changed from 15 to 10 as requested
        'reduce_kmer_complexity_weight': 1.0, # 
        'enforce_gc': True,         # Enforce GC content between 35% and 60%  // USE THIS + ^
        'induce_optimal_ss': True,  # Option remains (but not used)
        'stim_5': True,             # Option for stimulatory intron 5' // USE THIS
        'stim_3': True,             # Option for stimulatory intron 3' // USE THIS
        'split_point': 500,         # This value will be overridden per gene  // USE THIS
        'ensure_wggw': True,        # Ensure WGGW motif near split points
        'wggw_threshold': 300       # Distance threshold for WGGW from split point
    }
    
    # Added ability to specify results folder
    results_folder = "results4"  # Default, can be changed as needed
    logs_folder = "logs4"        # Default, can be changed as needed
    
    process_all_genes(
        OPTIONS, 
        max_files=200000, 
        suppress_stderr=True, 
        randomize=True, 
        skip_complex=False,
        results_folder=results_folder,
        logs_folder=logs_folder
    )