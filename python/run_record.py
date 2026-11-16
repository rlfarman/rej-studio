"""The run record: what a design run was, in enough detail to repeat or cite it.

A result on its own says what came out. It does not say what went in, which
version of the algorithm produced it, or when. Without that, a sequence in a
lab notebook cannot be traced back to the run that produced it, and a run
cannot be repeated six months later with any confidence that it is the same
run.

Every field here is a fact about the run. Nothing is inferred, and nothing is
summarised: the summary that the app shows is built from these fields, not the
other way round.

Reproducibility: the optimizer consumes no randomness, so the same sequence and
the same options give the same output. There is therefore no seed to record.
That was verified by running identical inputs under different global RNG states
and comparing the output; see `test_run_record.py`.
"""

from __future__ import annotations

import hashlib
import os
import platform
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as package_version
from pathlib import Path
from typing import Any

#: Incremented when the shape of a run record changes, so a stored record can
#: still be read back by code that has moved on.
RUN_RECORD_VERSION = 1

#: Keys the algorithm writes back into its options dict as it works. They are
#: results, not inputs, and they are reported elsewhere, so they are kept out
#: of the record's `options`.
_INTERNAL_OPTION_KEYS = frozenset(
    {
        "actual_split_point",
        "explicit_lock_region",
        "explicit_wggw_main",
        "objectives_report_after",
        "objectives_report_before",
        "used_wggw_as_split",
        "wggw_info",
    }
)

_ALGORITHM_SOURCE = Path(__file__).with_name("algorithm.py")


def sequence_digest(sequence: str) -> str:
    """A sha256 of a sequence, for identifying an input without copying it.

    Normalised the way the algorithm normalises its input, so the digest does
    not change with surrounding whitespace or case.
    """
    return hashlib.sha256(sequence.strip().upper().encode("ascii")).hexdigest()


def _installed_version(package: str) -> str:
    try:
        return package_version(package)
    except PackageNotFoundError:  # pragma: no cover - only when run from a source tree
        return "unknown"


def _algorithm_digest() -> str:
    """A short digest of the algorithm source.

    The commit SHA is the better identifier, but it is only present when the
    environment provides one. This is always available, so a record taken from
    a container with no git metadata still pins the code that ran.
    """
    try:
        return hashlib.sha256(_ALGORITHM_SOURCE.read_bytes()).hexdigest()[:12]
    except OSError:  # pragma: no cover - the module cannot run without its own source
        return "unknown"


def _commit_sha() -> str | None:
    for name in ("REJ_ALGORITHM_SHA", "GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"):
        value = os.environ.get(name)
        if value:
            return value
    return None


def build_run_record(
    *,
    cds: str,
    options: dict[str, Any],
    started_at: datetime,
    duration_seconds: float,
    corpus_version: str | None = None,
) -> dict[str, Any]:
    """Describe one design run.

    Args:
        cds: The coding sequence as submitted.
        options: The options as applied, after validation and defaults.
        started_at: When the run began, timezone-aware.
        duration_seconds: How long it took.
        corpus_version: The gene corpus the input came from, when it came from
            one. A pasted sequence has no corpus, and the field is omitted.
    """
    record: dict[str, Any] = {
        "record_version": RUN_RECORD_VERSION,
        "started_at": started_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        "duration_seconds": round(duration_seconds, 3),
        "input": {
            "sha256": sequence_digest(cds),
            "length": len(cds.strip()),
        },
        "options": {
            key: value for key, value in sorted(options.items()) if key not in _INTERNAL_OPTION_KEYS
        },
        "versions": {
            "algorithm_sha256": _algorithm_digest(),
            "dnachisel": _installed_version("dnachisel"),
            "python": platform.python_version(),
        },
    }

    commit = _commit_sha()
    if commit:
        record["versions"]["commit"] = commit
    if corpus_version:
        record["corpus_version"] = corpus_version

    return record
