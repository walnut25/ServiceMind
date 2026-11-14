"""Unit tests for assertion helpers: messages must carry enough context."""

from __future__ import annotations

import pytest

from unit.conftest import FakeResponse
from utils.api_client import ApiResponse
from utils.assertions import (
    assert_empty_body,
    assert_fields,
    assert_page,
    assert_problem,
    assert_schema,
    assert_status,
)

pytestmark = pytest.mark.unit


def response(status: int, payload=None, text: str | None = None) -> ApiResponse:
    return ApiResponse(
        response=FakeResponse(status_code=status, payload=payload, text=text),  # type: ignore[arg-type]
        method="GET",
        url="http://backend/api/v1/x",
        elapsed_ms=5.0,
    )


class TestStatus:
    @pytest.mark.parametrize("status", [200, 201, 204])
    def test_accepts_an_integer(self, status):
        assert assert_status(response(status), status).status == status

    def test_accepts_an_iterable(self):
        assert_status(response(409), {200, 409})

    def test_failure_mentions_status_and_body(self):
        with pytest.raises(AssertionError) as excinfo:
            assert_status(response(500, {"detail": "boom"}), 200)

        message = str(excinfo.value)
        assert "expected status [200], got 500" in message
        assert "boom" in message


class TestEmptyBody:
    def test_passes_for_an_empty_body(self):
        assert_empty_body(response(401, text=""))

    def test_fails_and_shows_the_body(self):
        with pytest.raises(AssertionError) as excinfo:
            assert_empty_body(response(401, text='{"detail":"x"}'))

        assert "expected an empty body" in str(excinfo.value)


class TestProblem:
    def problem(self, status=409, title="Conflict", detail="x"):
        return response(
            status,
            {"type": "about:blank", "title": title, "status": status, "detail": detail},
        )

    def test_accepts_a_matching_problem(self):
        assert_problem(self.problem(), status=409, title="Conflict", detail_contains="x")

    def test_rejects_a_wrong_title(self):
        with pytest.raises(AssertionError, match="problem.title"):
            assert_problem(self.problem(), status=409, title="Nope")

    def test_rejects_a_missing_detail_fragment(self):
        with pytest.raises(AssertionError, match="does not contain"):
            assert_problem(self.problem(), status=409, detail_contains="absent")

    def test_rejects_a_non_json_body(self):
        with pytest.raises(AssertionError, match="expected a JSON object"):
            assert_problem(response(409, text="plain text"), status=409)

    def test_rejects_a_wrong_problem_type(self):
        with pytest.raises(AssertionError, match="unexpected problem type"):
            assert_problem(response(409, {"type": "other", "status": 409}), status=409)


class TestPage:
    def page(self, number=0, size=20, total=40, total_pages=2, content=None):
        return {
            "content": content if content is not None else [{"id": 1}],
            "page": {
                "size": size,
                "number": number,
                "totalElements": total,
                "totalPages": total_pages,
            },
        }

    def test_accepts_a_valid_envelope(self):
        assert_page(self.page(), size=20)

    def test_rejects_missing_content(self):
        with pytest.raises(AssertionError, match="content"):
            assert_page({"page": {"size": 1, "number": 0, "totalElements": 0, "totalPages": 0}})

    def test_rejects_missing_page_fields(self):
        with pytest.raises(AssertionError, match="missing"):
            assert_page({"content": [], "page": {"size": 1}})

    def test_rejects_a_size_mismatch(self):
        with pytest.raises(AssertionError, match="page.size"):
            assert_page(self.page(size=10), size=20)

    def test_rejects_an_out_of_range_page_number(self):
        with pytest.raises(AssertionError, match="out of range"):
            assert_page(self.page(number=2, total_pages=2))

    def test_empty_result_is_valid(self):
        assert_page({"content": [], "page": {"size": 20, "number": 0, "totalElements": 0, "totalPages": 0}})


class TestFields:
    def test_subset_match_ignores_extra_fields(self):
        assert_fields({"id": 1, "status": "OPEN", "extra": True}, {"status": "OPEN"})

    def test_reports_expected_and_actual(self):
        with pytest.raises(AssertionError) as excinfo:
            assert_fields({"status": "CLOSED"}, {"status": "OPEN"})

        assert "CLOSED" in str(excinfo.value)
        assert "OPEN" in str(excinfo.value)


class TestSchema:
    SCHEMA = {
        "type": "object",
        "required": ["id", "status"],
        "properties": {"id": {"type": "integer"}, "status": {"enum": ["OPEN", "CLOSED"]}},
    }

    def test_accepts_a_matching_body(self):
        assert_schema(response(200, {"id": 1, "status": "OPEN"}), self.SCHEMA)

    def test_reports_the_failing_location(self):
        with pytest.raises(AssertionError) as excinfo:
            assert_schema(response(200, {"id": 1, "status": "DONE"}), self.SCHEMA)

        message = str(excinfo.value)
        assert "status" in message
        assert "not one of" in message or "DONE" in message

    def test_reports_missing_required_fields(self):
        with pytest.raises(AssertionError, match="'id' is a required property"):
            assert_schema(response(200, {"status": "OPEN"}), self.SCHEMA)
