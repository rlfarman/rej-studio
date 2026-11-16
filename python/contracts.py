"""Request/response contracts shared by the local FastAPI app and Modal.

Both boundaries (``python/index.py`` for local dev and ``modal/app.py`` in
production) validate the same payloads, so the models live here instead of
being duplicated — a bound that only one boundary enforces is a bound an
attacker or a buggy client can route around.

This module is imported two ways and must stay standalone (no relative
imports, no project-local dependencies):

* ``from python.contracts import ...`` locally (dev server, tests, deploy).
* ``from contracts import ...`` inside the Modal container, where the file is
  mounted flat at ``/root/contracts.py`` next to ``algorithm.py``.
"""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Accepted nucleotide alphabet. RNA ("U") is normalized to DNA ("T") by the
# algorithm; anything else (including "N") is rejected rather than silently
# optimized into nonsense.
NUCLEOTIDE_RE = re.compile(r"^[ACGTU]+$")

# Hard ceiling on input length. Mirrors the frontend's own cap; the Modal
# worker's 10-minute timeout is the real constraint behind it.
MAX_CDS_LENGTH = 50_000
MAX_NAME_LENGTH = 250

# Weights feed DNAChisel's `boost` parameters. Anything outside this range is
# either a no-op or so lopsided that the solver effectively ignores the other
# objectives, so reject it instead of accepting a nonsense design.
Weight = Annotated[float, Field(ge=0.0, le=100.0)]


def normalize_cds(value: str) -> str:
    """Uppercase, strip, and validate a coding sequence.

    Raises ValueError (Pydantic turns it into a 422) when the sequence is
    empty, too long, contains a character outside ACGTU, or isn't a whole
    number of codons.
    """
    value = value.strip().upper()
    if not value:
        raise ValueError("Coding sequence must not be empty")
    if len(value) > MAX_CDS_LENGTH:
        raise ValueError(f"Coding sequence must be {MAX_CDS_LENGTH:,} characters or less")
    if not NUCLEOTIDE_RE.match(value):
        raise ValueError("Coding sequence must contain only A, C, G, T, or U")
    if len(value) % 3 != 0:
        raise ValueError("Coding sequence length must be a multiple of 3")
    return value


def normalize_name(value: str) -> str:
    """Strip and bound a design name."""
    value = value.strip()
    if not value:
        raise ValueError("Name must not be empty")
    if len(value) > MAX_NAME_LENGTH:
        raise ValueError(f"Name must be {MAX_NAME_LENGTH} characters or less")
    return value


class SelectedWggwSite(BaseModel):
    """A WGGW-capable codon rewrite the user picked in the splice slider."""

    model_config = ConfigDict(extra="forbid")

    position: int = Field(ge=0)
    motif_start: int = Field(ge=0)
    motif: str = Field(min_length=1, max_length=16)
    hexamer_start: int = Field(ge=1)
    original_codons: tuple[str, str]
    new_codons: tuple[str, str]
    new_hexamer: str = Field(min_length=6, max_length=6)

    @field_validator("motif", "new_hexamer")
    @classmethod
    def validate_motif(cls, v: str) -> str:
        v = v.strip().upper()
        if not NUCLEOTIDE_RE.match(v):
            raise ValueError("WGGW motif must contain only A, C, G, T, or U")
        return v

    @field_validator("original_codons", "new_codons")
    @classmethod
    def validate_codons(cls, v: tuple[str, str]) -> tuple[str, str]:
        normalized = []
        for codon in v:
            codon = codon.strip().upper()
            if len(codon) != 3 or not NUCLEOTIDE_RE.match(codon):
                raise ValueError("Codons must be three nucleotides (A, C, G, T, or U)")
            normalized.append(codon)
        return (normalized[0], normalized[1])


class ProcessOptions(BaseModel):
    """Optimization options.

    ``extra="forbid"`` is deliberate: an unknown key used to be dropped
    silently, which is how a second splice junction (``split_points``) could
    be requested and ignored. A 422 naming the key is better than a design
    that quietly isn't what was asked for. Adding a frontend option therefore
    means adding it here too.
    """

    model_config = ConfigDict(extra="forbid")

    codon_optimize: Literal["human", "mouse"] | None = None
    codon_optimize_weight: Weight = 1.0
    remove_cryptic_ss: bool = True
    remove_cryptic_ss_weight: Weight = 1.0
    minimize_CpGs: bool = True
    minimize_CpGs_weight: Weight = 1.0
    reduce_kmer_complexity: bool = True
    reduce_kmer_complexity_weight: Weight = 1.0
    # k for UniquifyAllKmers. Below ~6 every k-mer in a real CDS repeats, so
    # the objective is unsatisfiable; very large k makes it a no-op.
    reduce_kmer_complexity_k: int = Field(default=10, ge=6, le=100)
    enforce_gc: bool = True
    stim_5: bool = True
    stim_3: bool = True
    # None means "halfway through the sequence" (the algorithm's default).
    # The frontend sends null when the user hasn't moved the splice slider.
    split_point: int | None = Field(default=None, ge=0)
    selected_wggw_site: SelectedWggwSite | None = None
    ensure_wggw: bool = True
    wggw_threshold: int = Field(default=300, ge=0, le=MAX_CDS_LENGTH)
    # Accepted, but not used by the algorithm (kept for payload compatibility).
    induce_optimal_ss: bool = False
    # Multi-split UI (behind a feature flag) sends these. One junction is
    # supported; more are rejected rather than silently dropped.
    split_points: list[int] | None = None
    selected_wggw_sites: list[SelectedWggwSite | None] | None = None
    # Deterministic runs: when omitted, the backend derives a seed from the
    # inputs and echoes it in the result so a run can be reproduced.
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)

    @model_validator(mode="after")
    def validate_single_split(self):
        if self.split_points is not None:
            if len(self.split_points) > 1:
                raise ValueError(
                    "multiple split points aren't supported yet — send a single split_point"
                )
            if any(p < 0 for p in self.split_points):
                raise ValueError("split_points must not be negative")
        if self.selected_wggw_sites is not None and len(self.selected_wggw_sites) > 1:
            raise ValueError(
                "multiple split points aren't supported yet — send a single selected_wggw_site"
            )
        return self

    def resolved_split_point(self, sequence_length: int) -> int:
        """The split point to design around, defaulting to the midpoint."""
        if self.split_point is not None:
            return self.split_point
        if self.split_points:
            return self.split_points[0]
        return sequence_length // 2


class ProcessRequest(BaseModel):
    """A single optimization request."""

    model_config = ConfigDict(extra="forbid")

    CDS: str
    name: str
    options: ProcessOptions = ProcessOptions()
    # The gene dataset the calling deployment is serving, when it knows its
    # name. Goes into the run record as a fact about the deployment, not about
    # where this sequence came from — the caller cannot tell.
    corpus_version: str | None = Field(default=None, max_length=200)

    @field_validator("CDS")
    @classmethod
    def validate_cds(cls, v: str) -> str:
        return normalize_cds(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return normalize_name(v)

    @model_validator(mode="after")
    def validate_split_point_in_sequence(self):
        length = len(self.CDS)
        candidates = [p for p in (self.options.split_point,) if p is not None]
        candidates += self.options.split_points or []
        for point in candidates:
            if point > length:
                raise ValueError(
                    f"split_point {point} is past the end of the {length}-base sequence"
                )
        site = self.options.selected_wggw_site
        if site is not None and site.hexamer_start - 1 + 6 > length:
            raise ValueError("selected_wggw_site lies outside the coding sequence")
        return self

    def to_options_dict(self) -> dict:
        """Options as the algorithm wants them: a plain dict with the split
        point resolved, so no layer below has to re-derive the default."""
        options = self.options.model_dump()
        options["split_point"] = self.options.resolved_split_point(len(self.CDS))
        return options


# --- Result models ----------------------------------------------------------


class WggwSiteInfo(BaseModel):
    position: int
    motif: str
    distance_from_split: int
    original_codons: list[str]
    new_codons: list[str]


class ObjectiveLocation(BaseModel):
    start: int
    end: int
    strand: int | None = None


class ObjectiveEvaluationEntry(BaseModel):
    objective: str
    passes: bool
    score: float
    message: str
    locations: list[ObjectiveLocation] = []


class ObjectivesReport(BaseModel):
    entries: list[ObjectiveEvaluationEntry] = []
    total_score: float | None = None


class RunRecordInput(BaseModel):
    sha256: str
    length: int


class RunRecordVersions(BaseModel):
    algorithm_sha256: str
    dnachisel: str
    python: str
    commit: str | None = None


class RunRecord(BaseModel):
    """What this run was, in enough detail to repeat or cite it.

    Built in `python/run_record.py`; every field is a fact about the run.
    """

    record_version: int
    started_at: str
    duration_seconds: float
    seed: int
    input: RunRecordInput
    options: dict[str, object]
    versions: RunRecordVersions
    corpus_version: str | None = None


class ProcessResult(BaseModel):
    name: str
    original_sequence: str
    optimized_sequence: str
    seq5: str
    seq3: str
    split_point: int
    used_wggw_as_split: bool
    objectives_before: str
    objectives_after: str
    objectives_report_before: ObjectivesReport = ObjectivesReport()
    objectives_report_after: ObjectivesReport = ObjectivesReport()
    wggw_info: dict[str, WggwSiteInfo] | None = None
    processing_time_seconds: float
    # The seed the run actually used (supplied or derived). Replaying the same
    # sequence + options + seed reproduces the same design. Also carried in
    # `run_record`, which is the field a notebook should cite.
    seed: int | None = None
    run_record: RunRecord
