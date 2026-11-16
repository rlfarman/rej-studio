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


def test_a_run_is_reproducible_so_there_is_no_seed_to_record():
    """The optimizer consumes no randomness, which is why the record has no seed.

    The record would be misleading if a run could not be repeated from it. This
    runs the same input under different global RNG states and checks the output
    is identical. If this ever fails, the algorithm has gained a random element
    and the record needs a seed to stay honest.
    """
    import random

    import numpy as np

    from python.algorithm import process_single_request_json

    cds = "ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCTATGGAAACTACTT"
    options = {
        "codon_optimize": "h_sapiens",
        "remove_cryptic_ss": True,
        "minimize_CpGs": True,
        "reduce_kmer_complexity": True,
        "enforce_gc": True,
        "stim_5": False,
        "stim_3": False,
        "split_point": 39,
        "ensure_wggw": True,
        "wggw_threshold": 30,
    }

    outputs = []
    for seed in (1, 999):
        random.seed(seed)
        np.random.seed(seed)
        result = process_single_request_json(CDS=cds, name="t", OPTIONS=dict(options))
        outputs.append((result["optimized_sequence"], result["seq5"], result["seq3"]))

    assert outputs[0] == outputs[1]
    assert outputs[0][0], "the optimizer returned nothing"
