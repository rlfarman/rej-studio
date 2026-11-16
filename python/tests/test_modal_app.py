"""Tests for the Modal web endpoint (modal/app.py).

The Modal SDK calls (`spawn`, `FunctionCall.from_id`, the progress Dict) are
stubbed through the module-level indirection helpers, so the whole job
lifecycle — submit, poll, cancel, not_found, timeout mapping, auth — is
exercised without touching Modal.
"""

import pytest
from fastapi.testclient import TestClient

VALID_CDS = "ATGCGTAAGCTGGACTCCGAAGACGATCTGGAACGTCTGAAAGCGACCCTGGAAGGCGTTGACTCCGTGATCACCGATTGA"

JOB_BODY = {"CDS": VALID_CDS, "name": "Test", "options": {"split_point": 45}}


@pytest.fixture
def client(modal_app, monkeypatch):
    """TestClient with auth disabled and progress reads stubbed out."""
    monkeypatch.delenv("JOB_API_TOKEN", raising=False)
    monkeypatch.setattr(modal_app, "_forget_progress", lambda call_id: None)
    monkeypatch.setattr(modal_app, "_read_progress", lambda call_id: (None, None))
    return TestClient(modal_app.web_app)


class FakeCall:
    """Stand-in for a Modal FunctionCall."""

    def __init__(self, result=None, raises=None):
        self._result = result
        self._raises = raises
        self.cancelled = False

    def get(self, timeout=None):
        if self._raises is not None:
            raise self._raises
        return self._result

    def cancel(self):
        self.cancelled = True


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
class TestHealth:
    def test_is_public_and_minimal(self, client, modal_app, monkeypatch):
        monkeypatch.setenv("JOB_API_TOKEN", "s3cret")
        monkeypatch.setenv("GIT_SHA", "abc1234")
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "git_sha": "abc1234"}

    def test_reports_unknown_sha_without_env(self, client, monkeypatch):
        monkeypatch.delenv("GIT_SHA", raising=False)
        assert client.get("/health").json()["git_sha"] == "unknown"

    def test_docs_and_schema_are_off(self, client):
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TestAuth:
    def test_rejects_missing_token_when_configured(self, client, modal_app, monkeypatch):
        monkeypatch.setenv("JOB_API_TOKEN", "s3cret")
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        assert client.post("/jobs", json=JOB_BODY).status_code == 401
        assert client.get("/jobs/fc-1").status_code == 401
        assert client.delete("/jobs/fc-1").status_code == 401

    def test_rejects_wrong_token(self, client, modal_app, monkeypatch):
        monkeypatch.setenv("JOB_API_TOKEN", "s3cret")
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        response = client.post("/jobs", json=JOB_BODY, headers={"Authorization": "Bearer wrong"})
        assert response.status_code == 401

    def test_accepts_correct_token(self, client, modal_app, monkeypatch):
        monkeypatch.setenv("JOB_API_TOKEN", "s3cret")
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "fc-123")
        response = client.post("/jobs", json=JOB_BODY, headers={"Authorization": "Bearer s3cret"})
        assert response.status_code == 200
        assert response.json() == {"call_id": "fc-123"}

    def test_allows_requests_when_token_unset(self, client, modal_app, monkeypatch):
        """A deploy that lands before the secret exists must keep working."""
        monkeypatch.delenv("JOB_API_TOKEN", raising=False)
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "fc-open")
        response = client.post("/jobs", json=JOB_BODY)
        assert response.status_code == 200
        assert response.json()["call_id"] == "fc-open"


# ---------------------------------------------------------------------------
# POST /jobs validation
# ---------------------------------------------------------------------------
class TestCreateJobValidation:
    def test_resolves_split_point_default(self, client, modal_app, monkeypatch):
        seen = {}

        def fake_spawn(params):
            seen.update(params)
            return "fc-1"

        monkeypatch.setattr(modal_app, "_spawn_job", fake_spawn)
        body = {"CDS": VALID_CDS, "name": "Test", "options": {"split_point": None}}
        assert client.post("/jobs", json=body).status_code == 200
        assert seen["options"]["split_point"] == len(VALID_CDS) // 2

    def test_rejects_bad_alphabet(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        body = {**JOB_BODY, "CDS": "ATGNNNTGA"}
        response = client.post("/jobs", json=body)
        assert response.status_code == 422
        assert "A, C, G, T" in str(response.json()["detail"])

    def test_rejects_non_multiple_of_three(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        response = client.post("/jobs", json={**JOB_BODY, "CDS": "ATGAA"})
        assert response.status_code == 422
        assert "multiple of 3" in str(response.json()["detail"])

    def test_rejects_multiple_split_points(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        body = {
            "CDS": VALID_CDS,
            "name": "Test",
            "options": {"split_point": 30, "split_points": [30, 60]},
        }
        response = client.post("/jobs", json=body)
        assert response.status_code == 422
        assert "multiple split points aren't supported yet" in str(response.json()["detail"])

    def test_accepts_single_split_point_array(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "fc-1")
        body = {"CDS": VALID_CDS, "name": "Test", "options": {"split_points": [30]}}
        assert client.post("/jobs", json=body).status_code == 200

    def test_rejects_out_of_range_weight(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        body = {"CDS": VALID_CDS, "name": "Test", "options": {"codon_optimize_weight": 1e6}}
        assert client.post("/jobs", json=body).status_code == 422

    def test_rejects_unknown_option(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        body = {"CDS": VALID_CDS, "name": "Test", "options": {"make_it_fast": True}}
        response = client.post("/jobs", json=body)
        assert response.status_code == 422
        assert "make_it_fast" in str(response.json()["detail"])

    def test_rejects_invalid_json(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        response = client.post(
            "/jobs", content=b"{not json", headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422

    def test_rejects_oversized_body_by_content_length(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")
        oversized = "A" * (modal_app.MAX_REQUEST_BYTES + 1_000)
        response = client.post("/jobs", json={**JOB_BODY, "name": oversized})
        assert response.status_code == 413

    def test_enforces_cap_on_chunked_body(self, client, modal_app, monkeypatch):
        """No Content-Length to trust — the cap has to hold while reading."""
        monkeypatch.setattr(modal_app, "_spawn_job", lambda params: "never")

        def chunks():
            for _ in range(5):
                yield b"A" * 100_000

        response = client.post(
            "/jobs", content=chunks(), headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 413


# ---------------------------------------------------------------------------
# GET /jobs/{id}
# ---------------------------------------------------------------------------
class TestGetJob:
    def test_not_found_for_unknown_id(self, client, modal_app, monkeypatch):
        def boom(call_id):
            raise ValueError("no such call")

        monkeypatch.setattr(modal_app, "_function_call_from_id", boom)
        response = client.get("/jobs/fc-missing")
        assert response.status_code == 200
        assert response.json()["status"] == "not_found"

    def test_running_reports_progress(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(
            modal_app,
            "_function_call_from_id",
            lambda call_id: FakeCall(raises=TimeoutError()),
        )
        monkeypatch.setattr(modal_app, "_read_progress", lambda call_id: (0.42, "Optimizing"))
        body = client.get("/jobs/fc-1").json()
        assert body["status"] == "running"
        assert body["progress"] == 0.42
        assert body["stage"] == "Optimizing"

    def test_completed_returns_result(self, client, modal_app, monkeypatch):
        result = {"name": "Test", "optimized_sequence": VALID_CDS, "seed": 7}
        monkeypatch.setattr(
            modal_app, "_function_call_from_id", lambda call_id: FakeCall(result=result)
        )
        body = client.get("/jobs/fc-1").json()
        assert body["status"] == "completed"
        assert body["result"]["seed"] == 7

    def test_cancelled_is_reported_as_cancelled(self, client, modal_app, monkeypatch):
        """modal 1.6.4 surfaces a terminated call as RemoteError, not a
        dedicated cancellation class — polling after a cancel must still
        report "cancelled" rather than erroring."""
        import modal

        monkeypatch.setattr(
            modal_app,
            "_function_call_from_id",
            lambda call_id: FakeCall(
                raises=modal.exception.RemoteError("Input was cancelled by user")
            ),
        )
        body = client.get("/jobs/fc-1").json()
        assert body["status"] == "cancelled"
        assert body["error"]["code"] == "cancelled"
        assert body["error"]["retriable"] is True

    def test_timeout_maps_to_retriable_timeout(self, client, modal_app, monkeypatch):
        import modal

        monkeypatch.setattr(
            modal_app,
            "_function_call_from_id",
            lambda call_id: FakeCall(raises=modal.exception.FunctionTimeoutError("exceeded 600s")),
        )
        body = client.get("/jobs/fc-1").json()
        assert body["status"] == "failed"
        assert body["error"]["code"] == "timeout"
        assert body["error"]["retriable"] is True

    def test_value_error_maps_to_invalid_input(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(
            modal_app,
            "_function_call_from_id",
            lambda call_id: FakeCall(raises=ValueError("Coding sequence contains 'N'")),
        )
        body = client.get("/jobs/fc-1").json()
        assert body["status"] == "failed"
        assert body["error"]["code"] == "invalid_input"
        assert "N" in body["error"]["message"]
        assert body["error"]["retriable"] is False

    def test_unknown_error_is_generic(self, client, modal_app, monkeypatch):
        monkeypatch.setattr(
            modal_app,
            "_function_call_from_id",
            lambda call_id: FakeCall(raises=RuntimeError("psycopg://user:pw@host")),
        )
        body = client.get("/jobs/fc-1").json()
        assert body["status"] == "failed"
        assert body["error"]["code"] == "backend"
        # The raw error is logged, never returned.
        assert "psycopg" not in body["error"]["message"]


# ---------------------------------------------------------------------------
# DELETE /jobs/{id}
# ---------------------------------------------------------------------------
class TestCancelJob:
    def test_cancels_running_call(self, client, modal_app, monkeypatch):
        call = FakeCall()
        monkeypatch.setattr(modal_app, "_function_call_from_id", lambda call_id: call)
        body = client.delete("/jobs/fc-1").json()
        assert body["status"] == "cancelled"
        assert call.cancelled is True

    def test_not_found_for_unknown_id(self, client, modal_app, monkeypatch):
        def boom(call_id):
            raise ValueError("no such call")

        monkeypatch.setattr(modal_app, "_function_call_from_id", boom)
        assert client.delete("/jobs/fc-1").json()["status"] == "not_found"

    def test_cancel_failure_is_retriable(self, client, modal_app, monkeypatch):
        class Stubborn(FakeCall):
            def cancel(self):
                raise RuntimeError("modal unreachable")

        monkeypatch.setattr(modal_app, "_function_call_from_id", lambda call_id: Stubborn())
        body = client.delete("/jobs/fc-1").json()
        assert body["status"] == "failed"
        assert body["error"]["retriable"] is True


# ---------------------------------------------------------------------------
# Progress bookkeeping
# ---------------------------------------------------------------------------
class TestProgressBookkeeping:
    def test_prunes_stale_entries(self, modal_app, monkeypatch):
        """A worker killed mid-run never cleans up; the reader must."""
        import time

        store = {"fc-1": {"progress": 0.9, "stage": "Optimizing", "updated_at": 0.0}}
        popped = []
        monkeypatch.setattr(
            modal_app,
            "progress_dict",
            type(
                "FakeDict",
                (),
                {
                    "get": staticmethod(lambda key, default=None: store.get(key, default)),
                    "pop": staticmethod(lambda key, default=None: popped.append(key)),
                },
            )(),
        )
        assert modal_app._read_progress("fc-1") == (None, None)
        assert popped == ["fc-1"]

        store["fc-1"]["updated_at"] = time.time()
        assert modal_app._read_progress("fc-1") == (0.9, "Optimizing")

    def test_read_progress_survives_dict_errors(self, modal_app, monkeypatch):
        class Broken:
            def get(self, key, default=None):
                raise RuntimeError("Dict unavailable")

            def pop(self, key, default=None):
                raise RuntimeError("Dict unavailable")

        monkeypatch.setattr(modal_app, "progress_dict", Broken())
        assert modal_app._read_progress("fc-1") == (None, None)
        modal_app._forget_progress("fc-1")  # must not raise


# ---------------------------------------------------------------------------
# Deployment configuration
# ---------------------------------------------------------------------------
class TestDeploymentConfig:
    def test_job_function_has_a_container_ceiling(self, modal_app):
        """No ceiling means an unbounded compute bill."""
        assert modal_app.MAX_JOB_CONTAINERS > 0
        assert modal_app.MAX_WEB_CONTAINERS > 0

    def test_both_functions_use_the_runtime_secret(self, modal_app):
        assert modal_app.runtime_secret is not None
