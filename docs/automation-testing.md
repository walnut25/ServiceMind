# Automating Smart Service

[English](automation-testing.md) | [简体中文](automation-testing.zh-CN.md)

This guide describes the standalone Python suite under `tests/`. It verifies the running application
the way a client sees it: real HTTP requests, a real MySQL database, and a real browser. It never
mocks application logic and never imports Java classes.

The suite contains **179 tests**: 152 API tests and 27 UI tests.

## Prerequisites

- Python 3.12 (3.11 and 3.13 also work)
- A running backend and MySQL database: `docker compose up -d mysql app`
- Node 22 and a built frontend (`frontend/dist`) for the UI tests only
- A Chromium-based browser, or Playwright's bundled Chromium

Run every command from the repository root.

## 1. Layout

```text
tests/
├── config/settings.py      # single configuration entry point (env or .env)
├── api/                    # 152 black-box HTTP tests, one file per business area
├── ui/                     # 27 Playwright browser tests
├── fixtures/               # authentication, users, tickets/articles, browser and SPA server
├── utils/                  # API client, assertions, JWT, database, logger, locators, static server
├── schemas/                # JSON schemas for API responses
├── reports/                # run artifacts (git ignored)
├── conftest.py             # path setup, fixture registry, health gate, failure screenshots
├── pytest.ini  requirements.txt  .env.example  README.md
```

## 2. Layers and responsibilities

| Layer | Responsibility | Rule |
| --- | --- | --- |
| `utils/` | Transport, assertions, logging, JWT, SQL, static serving | One concern per module, no business knowledge |
| `fixtures/` | Compose reusable logins and test data | Session-scoped login, function-scoped unique data |
| `api/` | Business rules over HTTP | Status + RFC 9457 `title`/`detail` + fields + schema |
| `ui/` | User-visible behaviour | API creates data, the browser verifies presentation |

Assertions are deliberately layered: an HTTP 200 alone never passes a test.

## 3. Test data

The API has no delete endpoints, so the suite does not try to clean up after itself. Instead:

- every object is created with a `qa_<run_id>_<time>_<counter>_<random>` name;
- assertions use the identifiers returned by the current test only;
- cross-role scenarios create fresh accounts through `user_factory` and `requester_factory`;
- CI and Docker runs use a new database volume per run (`docker compose down -v` and a per-run
  `COMPOSE_PROJECT_NAME`).

Database access is read-only and supplementary: audit rows, comment counts and `version` values that
the HTTP response cannot prove.

## 4. Configuration

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
| `UI_BROWSER_CHANNEL` | `chrome` | Reuses an installed browser; leave empty for bundled Chromium |
| `UI_HEADLESS` | `true` | Headless mode |
| `UI_SCREENSHOTS` | `true` | Capture a screenshot when a UI test fails |

## 5. Running locally

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r tests/requirements.txt

docker compose up -d mysql app
cd frontend; npm ci; npm run build; cd ..
```

Run the suites:

```powershell
pytest tests/api -v                      # 152 API tests
pytest tests/api/test_tickets.py -v      # one module
pytest tests/ui -v                       # 27 UI tests
pytest tests -q                          # all 179 tests
```

Expected result:

```text
179 passed
```

To enable the expired and forged token cases, start the backend with a known secret and expose the
same value to the tests:

```powershell
$env:JWT_SECRET = "qa-local-jwt-secret-at-least-32-bytes-long"
$env:JWT_ACCESS_TOKEN_TTL = "30m"
```

## 6. Running in Docker

The overlay `compose.test.yaml` pins a deterministic test configuration and adds an opt-in runner
container. It does not modify the application images.

```bash
docker compose -f compose.yaml -f compose.test.yaml up -d mysql app
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm pytest
docker compose -f compose.yaml -f compose.test.yaml down -v
```

Inside the network the tests reach `http://app:8081` and `mysql:3306`; Allure results are written to
the host directory `allure-results/`.

## 7. Allure reports

```bash
pytest tests/api --alluredir=allure-results
allure serve allure-results
allure generate allure-results -o allure-report --clean
```

The report shows totals, pass/fail/skip, duration, test names and steps, failure stack traces, and the
screenshot and browser log captured for every failing UI test. The `allure` command needs Java 8+;
`allure-commandline` is not a Python dependency.

## 8. Continuous integration

`.github/workflows/python-tests.yml` runs in parallel with the existing `ci.yml` and does not modify
it. Two independent jobs mean a UI failure never hides the API result.

| Job | Steps | Artifacts |
| --- | --- | --- |
| `python-api-test` | build the backend image, start MySQL and the app, wait for health, `pytest tests/api` | Allure results, test logs |
| `python-ui-test` | install Chromium, build the frontend, start MySQL and the app, `pytest tests/ui` | Allure results, failure screenshots and logs |

Both jobs dump container logs when something fails and always tear the stack down with
`docker compose down -v`.

## Troubleshooting

### The backend never becomes healthy

The suite exits with code 3 instead of producing dozens of connection errors. Check
`docker compose logs app` for Flyway or MySQL connection failures.

### A 401 or 403 response has no JSON body

That is the application's real behaviour: no custom `AuthenticationEntryPoint` or
`AccessDeniedHandler` is registered, so Spring Security returns an empty body. `assert_empty_body`
covers it explicitly.

### A search test returns nothing

MySQL full-text search uses `innodb_ft_min_token_size=3` by default. Use unique tokens of at least
three characters, as the fixtures do.

### `Executable doesn't exist` from Playwright

Install the browser (`python -m playwright install chromium`) or reuse an installed one with
`UI_BROWSER_CHANNEL=chrome`.

### Timestamps differ by a few microseconds

The API serialises nanosecond `Instant` values while MySQL stores `TIMESTAMP(6)`. A round-trip
rounds to the nearest microsecond, so time assertions carry a tolerance.

### UI tests cannot start in a restricted terminal

Playwright launches a Node driver with piped stdio, which a restricted token can block. Run the UI
suite from a normal terminal or in CI.

## Release checklist

- `pytest tests/api` passes against a running backend
- `pytest tests/ui` passes with a built frontend
- `docker compose down -v` leaves no test containers behind
- Allure results are generated and render without console errors
- no secrets, `.env` files, or `tests/reports/` content is staged
