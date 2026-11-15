# ServiceMind Python automation suite

A standalone Python project that sits next to the Java `src/main` and `src/test` trees. It drives the
running application over HTTP and a real browser, never mocks business logic, and never modifies
application code.

- **276 tests** in total
  - **97 framework unit tests** (`tests/unit/`) — validate the test framework itself, need no backend
  - **179 business tests** — 152 API + 27 UI
- **Three ways to run**: pytest locally, Docker Compose, GitHub Actions
- **Reporting**: Allure (totals, duration, steps, failure stack traces, UI screenshots)

## Quick start

```bash
# 1) Backend and database
docker compose up -d mysql app          # or `java -jar target/smart-service-*.jar`

# 2) Python environment (3.12 recommended, 3.11+ works)
python -m venv .venv
.venv\Scripts\Activate.ps1               # Windows
pip install -r tests/requirements.txt
python -m playwright install chromium    # browser for the UI tests

# 3) Configuration (optional; defaults target the local Compose stack)
copy tests\.env.example tests\.env

# 4) Run
pytest tests/unit -q                     # 97 framework tests, no backend needed
pytest tests/api -v                      # 152 API tests
pytest tests/ui -v                       # 27 browser tests (build frontend first)
pytest tests -q                          # all 276
pytest tests -m smoke -q                 # 8-test critical-path subset
```

The UI tests need a built frontend:

```bash
cd frontend && npm ci && npm run build && cd ..
```

## Layout

```text
tests/
├── config/settings.py      # single configuration entry point (env or .env)
├── unit/                   # 97 framework tests: ApiClient, settings, assertions, data factory, UI fixtures
├── api/                    # 152 black-box HTTP tests, one file per business area
├── ui/                     # 27 Playwright tests
├── fixtures/               # authentication, users, tickets/articles, browser and SPA server
├── utils/                  # API client, assertions, JWT, database, logger, locators, static server
├── schemas/                # response JSON schemas
├── reports/                # run artifacts (git ignored)
├── conftest.py             # path setup, fixture registry, failure screenshots
├── pytest.ini  requirements.txt  .env.example
```

`tests/unit/` is excluded from the 179 business-test count on purpose: those tests exercise the
framework's own contracts, so a change in the ApiClient or the data factory fails there first.

## Markers

| Marker | Purpose | Command |
| --- | --- | --- |
| `unit` | Framework tests, no external services | `pytest tests/unit` |
| `api` / `ui` | Test layer | `pytest tests/api`, `pytest tests/ui` |
| `smoke` | 8 critical-path cases for a quick gate | `pytest tests -m smoke` |
| `regression` | Everything in the business suites | `pytest tests/api tests/ui -m regression` |
| `security` | Authorization boundaries | `pytest tests -m security` |
| `serial` | Cannot run next to writes; executed alone | see below |

## Parallel execution

`tests/unit` and `tests/api` are xdist-safe: every test creates its own data and no test reads a
value another test writes. One API test is the exception by design - `TestMetrics` builds a single
response from six independent queries, so a concurrent write can legitimately break
`sum(byStatus) == total`.

That test is marked `serial` and calls `require_no_xdist()`, which **fails** (not skips) when an
xdist worker collects it, with the exact command to use. Run the API suite in two phases:

```bash
pytest tests/api -m "not serial" -n auto     # parallel, 151 tests
pytest tests/api -m serial                   # alone, 1 test
```

The unit suite runs in under a second; `-n auto` adds process startup and is only worth it when the
suite grows. CI still uses `-n auto` for both so the parallel path stays covered.

## Production frontend regression

The 27 UI tests can also run against the real deployment shape (`frontend/Dockerfile` -> nginx with
the history fallback and `/api` proxy) instead of the built-in static server:

```bash
docker compose up -d --wait mysql app frontend
UI_EXTERNAL_SERVER=true UI_BASE_URL=http://127.0.0.1:8085 \
API_BASE_URL=http://127.0.0.1:8081 pytest tests/ui -q
```

CI runs both variants, without executing the 27 cases twice for no extra signal: `python-ui-test`
runs the 2-case `smoke` subset against the built-in server (a fast check that the harness still
works), and `python-ui-prod-test` runs the full 27 against nginx. A final `allure-report` job merges
every job's Allure results into one HTML report artifact.

## Browser modes

The UI tests use Playwright's bundled Chromium by default, so a fresh checkout only needs
`python -m playwright install chromium`. To reuse an installed browser instead:

```powershell
$env:UI_BROWSER_CHANNEL = "chrome"      # or "msedge"
```

Leaving the variable unset (or setting it to an empty string) selects the bundled browser. To test an
already-running frontend, such as the nginx container, set `UI_EXTERNAL_SERVER=true` and
`UI_BASE_URL=http://127.0.0.1:8085`; no local frontend build is needed in that mode.

## Conventions

- **Test data**: the API has no delete endpoints, so every object is named
  `qa_<run_id>_<time>_<counter>_<random>` and tests only touch what they created. CI uses a fresh
  database volume per run.
- **Authentication isolation**: each `ApiClient` carries its own token and applies it per request; the
  shared `requests.Session` never holds an `Authorization` header, so `with_token()` and
  `without_auth()` cannot leak credentials between clients or parallel tests.
- **Assertion depth**: status code + RFC 9457 `title`/`detail` + business fields + JSON schema. A bare
  200 never passes. Spring Security's 401/403 responses carry no body, which `assert_empty_body`
  verifies explicitly.
- **No mocking of business logic**: the AI module is exercised through its two deterministic branches
  (unmatched → 200 ungrounded, matched but unconfigured → 503).
- **Diagnosability**: assertion failures embed the request headers (token redacted) and response body;
  UI failures capture a screenshot; logs go to the console and `reports/logs/` (falling back to
  console-only on a read-only checkout; `QA_LOG_DIR` and `QA_SCREENSHOT_DIR` can point elsewhere).

## Documentation

- [Automation guide](../docs/automation-testing.md): architecture, data strategy, Docker, Allure, CI, troubleshooting
- [Test case catalog](../docs/test-cases.md): the 179 business cases plus the 97 framework cases
- [Known issues](../docs/known-issues.md): behaviour proven by tests and mismatches found in the docs
- [Interview guide](../docs/interview-guide.md): how to present the project
