# Known issues and verification notes

[English](known-issues.md) | [简体中文](known-issues.zh-CN.md)

This file records what building the automation suite proved about the application. It separates
behaviour that is now pinned by a test from findings that only static review establishes. No
application code was changed to make a test pass.

## A. Pinned by a test (regression baseline)

### A1. An issued token is not checked against the user table

- **Symptom**: a token signed with the known `JWT_SECRET`, carrying `sub=qa_ghost_user` and
  `scope=ADMIN`, is accepted by `GET /api/v1/users` (200).
- **Cause**: the resource server validates the signature and timestamps only; the role converter reads
  the `scope` claim and never queries `user_accounts`.
- **Reproduce**: `pytest tests/api/test_auth.py::TestTokenValidation::test_known_risk_token_for_unknown_subject_is_accepted -v`
- **Impact**: anyone who learns `JWT_SECRET` can mint any role. The default value is committed in
  `application.yml` and `compose.yaml`, so production deployments must inject a strong secret.
- **Test stance**: this is a characterisation test of current behaviour. If the service is hardened
  later (lookup or `iss` validation), it fails and the assertion should be flipped.

### A2. Timestamps are rounded between the API and the database

- **Symptom**: `publishedAt` is returned as `...129371500Z` and read back after archiving as `...129372Z`.
- **Cause**: the API serialises nanosecond `Instant` values while MySQL stores `TIMESTAMP(6)`
  (microseconds), so a round-trip rounds.
- **Reproduce**: `pytest tests/api/test_knowledge.py::TestLifecycle::test_archive_keeps_published_at -v`
- **Impact**: clients comparing timestamps for equality will be wrong; assertions need a tolerance
  (10 ms is used here).

### A3. The assignee keeps the casing sent by the caller

- **Symptom**: `PATCH /tickets/{id}/assignee {"username":"AGENT_UPPER"}` stores the uppercase form in
  `assigneeUsername`.
- **Cause**: the service only applies `strip()`; the lookup uses `findByUsernameIgnoreCase` but the
  canonical spelling is not written back.
- **Reproduce**: `pytest tests/api/test_tickets.py::TestFiltering::test_assignee_filter_is_exact_and_case_insensitive -v`
- **Impact**: the same account can appear under several spellings; exact-match clients will disagree.

### A4. 401 and 403 responses have an empty body

- **Symptom**: unauthenticated or unauthorised requests return only a status code and
  `WWW-Authenticate`.
- **Cause**: no custom `AuthenticationEntryPoint` or `AccessDeniedHandler` is registered, so Spring
  Security defaults apply.
- **Impact**: callers must not assume an error response is JSON. `assert_empty_body` covers this
  explicitly.

## B. Established by static review only

### B1. `metrics.breached` and the `slaBreached=true` filter disagree

- **Code**: the list filter (`TicketRepository.findBreached`) includes tickets resolved after their
  due date; `TicketService.metrics` counts only unresolved overdue tickets.
- **Consequence**: a late-but-resolved ticket counts as breached in the list and not in the metrics.
- **Why not a test**: reproducing it reliably means rewriting `due_at` in the database, which would
  make the suite mutate data behind the API.

### B2. Optimistic locking is unreachable over HTTP

- **Code**: entities carry `@Version`, but no request DTO exposes `version` and there is no
  `If-Match`; `ApiExceptionHandler` does not map `ObjectOptimisticLockingFailureException`.
- **Consequence**: a concurrent write conflict surfaces as a 500 rather than a 409, and the README's
  optimistic-locking claim overstates the HTTP contract.

### B3. Disabling an account does not revoke issued tokens

- **Code**: JWT validation never queries the database, and disabling only flips `enabled`.
- **Consequence**: a disabled user's token keeps working for up to `TTL + 60s` (30 minutes by default).

### B4. No last-administrator protection

- **Code**: `UserAccountService.changeEnabled` prevents an administrator from disabling **themselves**
  but not from disabling other administrators.
- **Consequence**: every administrator can be disabled, leaving the console inaccessible until the
  database is edited.

### B5. Documentation and implementation differ

| Location | Claim | Reality |
| --- | --- | --- |
| `docs/testing.md:41` | "adds **three** Testcontainers tests" | Four; line 43's "4 MySQL tests / 46 tests" is the correct statement |
| `docs/testing.md:42` | integration tests verify "persistence, role storage, optimistic locking, and full-text search" | `MySqlRepositoryIT` has no optimistic-locking case |
| `TicketController` OpenAPI annotation | "Allowed workflow: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED" | Also allows `OPEN→CLOSED`, `IN_PROGRESS→CLOSED`, `RESOLVED→IN_PROGRESS`; the diagram in `docs/architecture.md` is correct |
| `README.md` optimistic locking | "optimistic locking" prevents lost updates | See B2: no version-conditional update over HTTP |
| `.env.example` / `compose.yaml` | implies ports, credentials and the AI provider are configurable | `JWT_ACCESS_TOKEN_TTL`, `AI_TIMEOUT` and `AI_MAX_CONTEXT_ARTICLES` are supported by the code but never passed through (`tests/.env.example` documents all three) |

## C. Resolved during the quality pass

The review of the automation framework itself found five defects. They are listed here because they
were real, not because they were business bugs; all are fixed and covered by `tests/unit`.

| Defect | Impact | Fix |
| --- | --- | --- |
| `ApiClient.with_token()` wrote `Authorization` into the shared `requests.Session` and the original client read that same session | Two clients could overwrite each other's token; an unauthenticated request could inherit a token | The token is now per client and applied per request; the session no longer carries `Authorization` |
| UI pages were appended to a module-level list and never removed | References accumulated for the whole session; screenshots could pick up pages from other tests | Fixtures untrack their pages on teardown; screenshots run before teardown, so failures still capture the right page |
| `UI_BROWSER_CHANNEL` defaulted to `chrome` while the docs said "install Chromium" | A fresh checkout following the docs still required a system Chrome | The default is now empty (bundled Chromium); `chrome`/`msedge` are explicit opt-ins |
| Screenshot and log directories were fixed under the checkout | On a read-only checkout the failure artifacts were silently lost | `QA_SCREENSHOT_DIR` and `QA_LOG_DIR` override the locations; the suite logs a warning and continues |
| The backend health gate was session-autouse for every test | Framework unit tests could not run without a backend | The gate moved into `tests/api/conftest.py` and `tests/ui/conftest.py`; `tests/unit` runs standalone |

Two further inconsistencies were corrected at the same time: the built-in UI server now honours
`UI_PORT` instead of binding an arbitrary port while the docs claimed `8090`, and the suite can point
at an already-running frontend through `UI_EXTERNAL_SERVER`.

## D. Recommendations

1. Require a strong `JWT_SECRET` in production and add `iss`/`aud` and account-state validation
   (mitigates A1 and B3).
2. Map `ObjectOptimisticLockingFailureException` to 409, or accept `version` in the request DTO.
3. Compute the breached metric and the list filter from the same repository query.
4. Add controller-level 409/404/422 assertions in Java; the Python suite already covers them over HTTP.
