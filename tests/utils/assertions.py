"""Assertion helpers that fail with actionable context.

Plain ``assert`` would hide the response body; these helpers always attach it.
"""

from __future__ import annotations

from typing import Any, Iterable

import jsonschema

from utils.api_client import ApiResponse


def assert_status(response: ApiResponse, expected: int | Iterable[int]) -> ApiResponse:
    expected_set = {expected} if isinstance(expected, int) else set(expected)
    assert response.status in expected_set, (
        f"expected status {sorted(expected_set)}, got {response.status}\n{response.describe()}"
    )
    return response


def assert_empty_body(response: ApiResponse) -> ApiResponse:
    """Spring Security answers 401/403 with an empty body by design."""
    assert response.text.strip() == "", f"expected an empty body, got:\n{response.describe()}"
    return response


def assert_problem(
    response: ApiResponse,
    *,
    status: int,
    title: str | None = None,
    detail_contains: str | None = None,
) -> ApiResponse:
    """Assert an RFC 9457 problem response."""
    assert_status(response, status)
    body = response.json()
    assert isinstance(body, dict), f"expected a JSON object, got:\n{response.describe()}"
    assert body.get("status") == status, f"problem.status mismatch:\n{response.describe()}"
    assert body.get("type") == "about:blank", f"unexpected problem type:\n{response.describe()}"
    if title is not None:
        assert body.get("title") == title, f"problem.title != {title!r}:\n{response.describe()}"
    if detail_contains is not None:
        detail = body.get("detail") or ""
        assert detail_contains in detail, (
            f"problem.detail does not contain {detail_contains!r} (was {detail!r}):\n{response.describe()}"
        )
    return response


def assert_page(body: Any, *, size: int | None = None) -> dict:
    """Assert the Spring Data VIA_DTO page envelope: {content, page:{...}}."""
    assert isinstance(body, dict), f"expected a JSON object, got {type(body)!r}"
    assert "content" in body and isinstance(body["content"], list), "missing 'content' list"
    page = body.get("page")
    assert isinstance(page, dict), "missing 'page' object"
    for field_name in ("size", "number", "totalElements", "totalPages"):
        assert field_name in page, f"page is missing {field_name!r}: {page!r}"
    if size is not None:
        assert page["size"] == size, f"expected page.size={size}, got {page['size']}"
    assert 0 <= page["number"] < max(page["totalPages"], 1), f"page.number out of range: {page!r}"
    return body


def assert_fields(body: Any, expected: dict[str, Any]) -> None:
    """Assert a subset of fields (ignoring any extra server fields)."""
    assert isinstance(body, dict), f"expected an object, got {type(body)!r}"
    mismatched = {
        key: (value, body.get(key))
        for key, value in expected.items()
        if body.get(key) != value
    }
    assert not mismatched, f"field mismatches (expected, actual): {mismatched}\nbody={body}"


def assert_schema(response: ApiResponse, schema: dict[str, Any]) -> Any:
    """Validate the response body against a jsonschema definition."""
    body = response.json()
    try:
        jsonschema.validate(instance=body, schema=schema)
    except jsonschema.ValidationError as exc:
        location = "/".join(str(part) for part in exc.absolute_path) or "<root>"
        raise AssertionError(
            f"response does not match schema at '{location}': {exc.message}\n{response.describe()}"
        ) from exc
    return body
