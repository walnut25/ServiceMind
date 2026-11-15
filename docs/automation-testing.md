# Automating Smart Service

[English](automation-testing.md) | [简体中文](automation-testing.zh-CN.md)

This guide describes the standalone Python suite under `tests/`. It verifies the running application
the way a client sees it: real HTTP requests, a real MySQL database, and a real browser. It never
mocks application logic and never imports Java classes.

The suite contains **276 tests**:

- **97 framework unit tests** (`tests/unit/`) that validate the test framework itself and need no
  backend, database or browser;
- **179 business tests**: 152 API tests and 27 UI tests.

## Prerequisites

- Python 3.12 (3.11 and 3.13 also work)
- A running backend and MySQL database: `docker compose up -d mysql app`
- Node 22 and a built frontend (`frontend/dist`) for the UI tests only
- The Playwright browser: `python -m playwright install chromium`

Run every command from the repository root.

## 1. Layout

```text
tests/
├── config/settings.py      # single configuration entry point (env or .env)
├── unit/                   # 97 framework tests: ApiClient, settings, assertions, data factory, UI fixtures
├── api/                    # 152 black-box HTTP tests, one file per business area
├── ui/                     # 27 Playwright browser tests
├── fixtures/               # authentication, users, tickets/articles, browser and SPA server
├── utils/                  # API client, assertions, JWT, database, logger, locators, static server
├── schemas/                # JSON schemas for API responses
├── reports/                # run artifacts (git ignored)
├── conftest.py             # path setup, fixture registry, failure screenshots
├── pytest.ini  requirements.txt  .env.example  README.md
```

## 2. Layers and responsibilities

| Layer | Responsibility | Rule |
| --- | --- | --- |
| `unit/` | The framework's own contracts | No network, no browser; every dependency is injected |
| `utils/` | Transport, assertions, logging, JWT, SQL, static serving | One concern per module, no business knowledge |
| `fixtures/` | Compose reusable logins and test data | Session-scoped login, function-scoped unique data |
| `api/` | Business rules over HTTP | Status + RFC 9457 `title`/`detail` + fields + schema |
| `ui/` | User-visible behaviour | API creates data, the browser verifies presentation |

The framework tests are the safety net for the suite itself: changing the ApiClient, the data factory
or an assertion helper fails there first, before the business suites start reporting confusing errors.

## 3. Authentication isolation

`ApiClient` keeps its token on the instance and applies it to every request individually. The shared
`requests.Session` only carries transport defaults (`Accept`, `User-Agent`); it never holds an
`Authorization` header. Consequences:

- `with_token()` returns a new client on the same connection pool and does not mutate the original;
- `without_auth()` cannot strip credentials from another client;
- parallel tests cannot overwrite each other's token;
- `request(token=...)` overrides the client token for a single call, and an explicit `headers=`
  argument wins over both (used to test the lowercase `bearer` scheme).

These guarantees are covered by `tests/unit/test_api_client.py`.

## 4. Test data

The API has no delete endpoints, so the suite does not try to clean up after itself. Instead:

- every object is created with a `qa_<run_id>_<time>_<counter>_<random>` name;
- assertions use the identifiers returned by the current test only;
- cross-role scenarios create fresh accounts through `user_factory` and `requester_factory`;
- CI and Docker runs use a new database volume per run (`docker compose down -v` and a per-run
  `COMPOSE_PROJECT_NAME`).

Database access is read-only and supplementary: audit rows, comment counts and `version` values that
the HTTP response cannot prove.

## 5. Configuration

Every value can be overridden through environment variables or `tests/.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | `http://127.0.0.1:8081` | Backend address; the suite waits for `/actuator/health` first |
| `API_PREFIX` | `/api/v1` | API prefix |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `Admin123!` | Bootstrap administrator created by `AdminBootstrap` |
| `JWT_SECRET` | empty | Needed to craft expired and forged tokens; those tests are skipped when empty |
| `DB_*` | `127.0.0.1:3307`, `smart_service` | Read-only consistency checks |
| `DB_CHECKS_ENABLED` | `true` | Set to `false` to skip database assertions |
| `AI_CHAT_ENABLED` | `false` | Selects the deterministic 503 or grounded branch |
| `QA_RUN_ID` | `local` | Prefix for every object this run creates |
| `FRONTEND_DIST` | `<repo>/frontend/dist` | Build output served to the browser tests |
| `UI_PORT` | `8090` | Port of the built-in static server (`0` picks a free port) |
| `UI_EXTERNAL_SERVER` | `false` | Serve an existing frontend instead of `frontend/dist` |
| `UI_BASE_URL` | `http://127.0.0.1:8090` | Address used when `UI_EXTERNAL_SERVER=true` |
| `UI_BROWSER_CHANNEL` | empty | Empty uses Playwright's bundled Chromium; `chrome`/`msedge` reuses a system browser |
| `UI_HEADLESS` | `true` | Headless mode |
| `UI_SCREENSHOTS` | `true` | Capture a screenshot when a UI test fails |
| `QA_LOG_DIR` / `QA_SCREENSHOT_DIR` | `tests/reports/...` | Move run artifacts on a read-only checkout |

## 6. Running locally

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r tests/requirements.txt
python -m playwright install chromium

docker compose up -d mysql app
cd frontend; npm ci; npm run build; cd ..
```

Run the suites:

```powershell
pytest tests/unit -q                     # 97 framework tests, no backend needed
pytest tests/api -v                      # 152 API tests
pytest tests/api/test_tickets.py -v      # one module
pytest tests/ui -v                       # 27 UI tests
pytest tests -q                          # all 276 tests
pytest tests -m smoke -q                 # 8 critical-path cases
```

Expected result:

```text
276 passed
```

### Parallel runs

`tests/unit` and `tests/api` are xdist-safe. One API test cannot be: `TestMetrics` assembles a single
response from six independent queries, so a concurrent write can break `sum(byStatus) == total`. It is
marked `serial` and fails loudly if an xdist worker collects it, so a parallel run never silently
executes it. Use two phases:

```powershell
pytest tests/api -m "not serial" -n auto   # 151 tests
pytest tests/api -m serial                 # 1 test, alone
pytest tests/unit -n auto                  # framework tests
```

The UI tests use Playwright's bundled Chromium by default. To reuse an installed browser:

```powershell
$env:UI_BROWSER_CHANNEL = "chrome"       # or "msedge"
```

To test an already-running frontend such as the nginx container:

```powershell
$env:UI_EXTERNAL_SERVER = "true"
$env:UI_BASE_URL = "http://127.0.0.1:8085"
pytest tests/ui -q
```

To enable the expired and forged token cases, start the backend with a known secret and expose the
same value to the tests:

```powershell
$env:JWT_SECRET = "qa-local-jwt-secret-at-least-32-bytes-long"
$env:JWT_ACCESS_TOKEN_TTL = "30m"
```

## 7. Running in Docker

The overlay `compose.test.yaml` pins a deterministic test configuration and adds an opt-in runner
container. It does not modify the application images.

```bash
docker compose -f compose.yaml -f compose.test.yaml up -d mysql app
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm pytest
docker compose -f compose.yaml -f compose.test.yaml down -v
```

Inside the network the tests reach `http://app:8081` and `mysql:3306`; Allure results are written to
the host directory `allure-results/`.

## 8. Allure reports

```bash
pytest tests/api --alluredir=allure-results
allure serve allure-results
allure generate allure-results -o allure-report --clean
```

The report shows totals, pass/fail/skip, duration, test names and steps, failure stack traces, and the
screenshot and browser log captured for every failing UI test. The `allure` command needs Java 8+;
`allure-commandline` is not a Python dependency.

## 9. Continuous integration

`.github/workflows/python-tests.yml` runs in parallel with the existing `ci.yml` and does not modify
it. Three independent jobs mean a UI failure never hides the API or unit result.

| Job | Steps | Artifacts |
| --- | --- | --- |
| `python-unit-test` | install dependencies, `pytest tests/unit -n auto` | Allure results |
| `python-api-test` | build the backend image, start MySQL and the app, wait for health, parallel `pytest tests/api -m "not serial" -n auto`, then `pytest tests/api -m serial` | Allure results, test logs |
| `python-ui-test` | install Chromium, build the frontend, start MySQL and the app, `pytest tests/ui` | Allure results, failure screenshots and logs |
| `python-ui-prod-test` | build both images, `docker compose up -d --wait`, verify SPA + deep link + API proxy, `pytest tests/ui` against nginx | Allure results, failure screenshots and logs |

The two container-backed API/UI jobs dump container logs when something fails and always tear the
stack down with `docker compose down -v`.

## 10. Production frontend regression

`python-ui-test` serves `frontend/dist` from the built-in static server, which keeps the browser tests
fast and independent of Docker. `python-ui-prod-test` covers the other half: the image that is actually
deployed (`frontend/Dockerfile` -> `nginx:1.27-alpine`, with `frontend/nginx.conf`).

That job:

1. builds `app` and `frontend` with `docker compose build`;
2. starts the stack with `docker compose up -d --wait --wait-timeout 240`, which relies on the
   healthchecks of all three services (the frontend gained one in this change);
3. asserts that nginx serves the SPA, that `/tickets/1` falls back to `index.html`, and that
   `/actuator/health` is proxied to the backend;
4. runs the same 27 UI tests with `UI_EXTERNAL_SERVER=true` and `UI_BASE_URL=http://127.0.0.1:8085`,
   so no test code differs between the two jobs.

The existing `python-ui-test` job is untouched; both variants run until the nginx job has a longer
history of green runs.

## Troubleshooting

### The backend never becomes healthy

The suite exits with code 3 instead of producing dozens of connection errors. Check
`docker compose logs app` for Flyway or MySQL connection failures.

### The browser cannot be launched

The suite prints which browser it tried and how to install it. Run
`python -m playwright install chromium`, or set `UI_BROWSER_CHANNEL=chrome` to reuse an installed
Chrome. An unknown channel or a missing system browser is reported the same way.

### An antivirus quarantines the browser

Endpoint protection occasionally flags Chromium binaries as heuristic false positives (for example
`chrome.dll`), after which the browser install is incomplete and the UI suite cannot start. Add the
Playwright browser directory to the antivirus exclusions - `PLAYWRIGHT_BROWSERS_PATH` if set, otherwise
`%LOCALAPPDATA%\ms-playwright` - and reinstall with `python -m playwright install chromium --force`.

### A 401 or 403 response has no JSON body

That is the application's real behaviour: no custom `AuthenticationEntryPoint` or
`AccessDeniedHandler` is registered, so Spring Security returns an empty body. `assert_empty_body`
covers it explicitly.

### A search test returns nothing

MySQL full-text search uses `innodb_ft_min_token_size=3` by default. Use unique tokens of at least
three characters, as the fixtures do.

### Timestamps differ by a few microseconds

The API serialises nanosecond `Instant` values while MySQL stores `TIMESTAMP(6)`. A round-trip
rounds to the nearest microsecond, so time assertions carry a tolerance.

### Screenshots or logs are missing on a read-only checkout

Point `QA_SCREENSHOT_DIR` and `QA_LOG_DIR` at a writable directory. The suite logs a warning and keeps
running when the default location cannot be created.

## Release checklist

- `pytest tests/unit` passes without any service running
- `pytest tests/api` passes against a running backend
- `pytest tests/ui` passes with a built frontend and an installed browser
- `pytest tests -m smoke` stays green
- `docker compose down -v` leaves no test containers behind
- Allure results are generated and render without console errors
- no secrets, `.env` files, or `tests/reports/` content is staged
