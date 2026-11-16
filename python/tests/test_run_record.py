"""Tests for the run record: what a design run was, in enough detail to repeat it."""

import re
from datetime import UTC, datetime, timedelta, timezone

from python.run_record import RUN_RECORD_VERSION, build_run_record, sequence_digest

STARTED_AT = datetime(2026, 11, 16, 9, 30, 0, tzinfo=UTC)

OPTIONS = {
    "codon_optimize": "h_sapiens",
    "enforce_gc": True,
    "split_point": 180,
}


def record(**overrides):
    params = {
        "cds": "ATGAAATGA",
        "options": dict(OPTIONS),
        "started_at": STARTED_AT,
        "duration_seconds": 1.2345,
        "seed": 12345,
    }
    params.update(overrides)
    return build_run_record(**params)


class TestInput:
    def test_identifies_the_sequence_without_copying_it(self):
        result = record()

        assert result["input"]["length"] == 9
        assert re.fullmatch(r"[0-9a-f]{64}", result["input"]["sha256"])
        assert "ATGAAATGA" not in str(result)

    def test_digest_ignores_case_and_surrounding_whitespace(self):
        assert sequence_digest("  atgaaatga \n") == sequence_digest("ATGAAATGA")

    def test_digest_distinguishes_different_sequences(self):
        assert sequence_digest("ATGAAATGA") != sequence_digest("ATGAAATGG")

    def test_length_is_of_the_sequence_not_the_whitespace(self):
        assert record(cds="  ATGAAATGA  ")["input"]["length"] == 9


class TestOptions:
    def test_records_the_options_as_applied(self):
        assert record()["options"] == OPTIONS

    def test_leaves_out_the_working_keys_the_algorithm_writes_back(self):
        # The algorithm stuffs its own results into the options dict as it
        # goes. Those are results, not inputs, and they are reported elsewhere.
        noisy = dict(OPTIONS)
        noisy.update(
            {
                "actual_split_point": 183,
                "used_wggw_as_split": True,
                "wggw_info": {"main": {}},
                "objectives_report_before": {"entries": []},
                "objectives_report_after": {"entries": []},
                "explicit_wggw_main": {},
                "explicit_lock_region": (1, 2),
            }
        )

        assert record(options=noisy)["options"] == OPTIONS

    def test_does_not_alias_the_caller_s_options(self):
        options = dict(OPTIONS)
        result = record(options=options)
        options["split_point"] = 999

        assert result["options"]["split_point"] == 180


class TestVersions:
    def test_pins_the_code_and_the_libraries_that_ran(self):
        versions = record()["versions"]

        assert re.fullmatch(r"[0-9a-f]{12}", versions["algorithm_sha256"])
        assert re.match(r"\d+\.\d+", versions["dnachisel"])
        assert re.match(r"3\.\d+", versions["python"])

    def test_includes_the_commit_when_the_environment_provides_one(self, monkeypatch):
        monkeypatch.setenv("GIT_COMMIT_SHA", "abc1234")

        assert record()["versions"]["commit"] == "abc1234"

    def test_omits_the_commit_when_there_is_none(self, monkeypatch):
        for name in ("REJ_ALGORITHM_SHA", "GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"):
            monkeypatch.delenv(name, raising=False)

        assert "commit" not in record()["versions"]


class TestTiming:
    def test_states_when_the_run_began_in_utc(self):
        assert record()["started_at"] == "2026-11-16T09:30:00Z"

    def test_converts_a_local_start_time_to_utc(self):
        local = datetime(2026, 11, 16, 11, 30, 0, tzinfo=timezone(timedelta(hours=2)))

        assert record(started_at=local)["started_at"] == "2026-11-16T09:30:00Z"

    def test_keeps_duration_to_milliseconds(self):
        assert record(duration_seconds=1.23456789)["duration_seconds"] == 1.235


class TestCorpus:
    def test_records_the_corpus_a_sequence_came_from(self):
        assert record(corpus_version="v2")["corpus_version"] == "v2"

    def test_omits_the_corpus_for_a_pasted_sequence(self):
        assert "corpus_version" not in record()


def test_record_is_versioned_so_a_stored_one_can_be_read_back():
    assert record()["record_version"] == RUN_RECORD_VERSION


def test_record_is_json_serialisable():
    import json

    assert json.loads(json.dumps(record()))["input"]["length"] == 9


class TestSeed:
    def test_records_the_seed_the_run_used(self):
        assert record(seed=42)["seed"] == 42

    def test_keeps_the_requested_seed_out_of_the_options(self):
        # The caller's "seed" is usually None, because the backend derives one.
        # The seed that was actually used is the field above, so recording both
        # would mean recording a null beside the real answer.
        options = dict(OPTIONS) | {"seed": None}

        result = record(options=options, seed=7)

        assert "seed" not in result["options"]
        assert result["seed"] == 7


def test_a_recorded_run_can_be_repeated_from_its_seed():
    """The record is only worth citing if a run can be repeated from it.

    DNAChisel's mutation sampling draws on the global RNGs, so the algorithm
    seeds them per run and reports the seed it used. This submits the same
    sequence twice with that seed, from different global RNG states, and checks
    the design is identical both times.
    """
    import random

    import numpy as np

    from python.algorithm import process_single_request_json

    cds = "ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTT"
    options = {
        "codon_optimize": "human",
        "remove_cryptic_ss": True,
        "minimize_CpGs": True,
        "reduce_kmer_complexity": True,
        "enforce_gc": True,
        "stim_5": False,
        "stim_3": False,
        "split_point": 39,
        "ensure_wggw": True,
        "wggw_threshold": 30,
        "seed": 4242,
    }

    outputs = []
    seeds = []
    for noise in (1, 999):
        random.seed(noise)
        np.random.seed(noise)
        result = process_single_request_json(CDS=cds, name="t", OPTIONS=dict(options))
        outputs.append((result["optimized_sequence"], result["seq5"], result["seq3"]))
        seeds.append(result["run_record"]["seed"])

    assert outputs[0] == outputs[1]
    assert outputs[0][0], "the optimizer returned nothing"
    assert seeds == [4242, 4242]
