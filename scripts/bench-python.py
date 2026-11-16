"""Time the Python optimizer on the same cases as the Rust benchmark.

Prints one JSON line per case, matching rust/optimizer/examples/bench.rs, so
the two can be compared directly on both speed and the score they reach.

    PYTHONPATH=. uv run python scripts/bench-python.py cases.json
"""

import contextlib
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3]))

from python import algorithm  # noqa: E402

OPTIONS = {
    "codon_optimize": "human",
    "codon_optimize_weight": 1.0,
    "remove_cryptic_ss": True,
    "remove_cryptic_ss_weight": 1.0,
    "minimize_CpGs": True,
    "minimize_CpGs_weight": 1.0,
    "reduce_kmer_complexity": True,
    "reduce_kmer_complexity_weight": 1.0,
    "enforce_gc": True,
    "stim_5": False,
    "stim_3": False,
    "split_point": None,
    "selected_wggw_site": None,
    "ensure_wggw": True,
    "wggw_threshold": 0,
    "seed": 1234,
}


def main() -> None:
    if sys.platform == "emscripten":
        # WebAssembly has no threads, so the progress heartbeat cannot run.
        algorithm._progress_heartbeat = lambda **kwargs: contextlib.nullcontext()

    cases = json.loads(pathlib.Path(sys.argv[1]).read_text())
    for case in cases:
        name = case.get("name") or case["id"]
        started = time.perf_counter()
        result = algorithm.process_single_request_json(
            CDS=case["cds"], name=name, OPTIONS=dict(OPTIONS)
        )
        elapsed = time.perf_counter() - started

        problem = algorithm.build_optimization_problem(
            result["optimized_sequence"], dict(OPTIONS), logger=None
        )
        score = algorithm.build_objectives_report(problem)["total_score"]
        print(
            json.dumps(
                {
                    "runtime": "pyodide" if sys.platform == "emscripten" else "cpython",
                    "name": name,
                    "bp": len(case["cds"]),
                    "seconds": round(elapsed, 2),
                    "score": round(score, 2),
                }
            ),
            flush=True,
        )


if __name__ == "__main__":
    main()
