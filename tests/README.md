# ServiceMind Python automation suite

A standalone Python project that sits next to the Java `src/main` and `src/test` trees. It drives the
running application over HTTP and a real browser, never mocks business logic, and never modifies
application code.

- **179 tests**: 152 API + 27 UI
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

# 3) Configuration (optional; defaults target the local Compose stack)
copy tests\.env.example tests\.env

# 4) Run
pytest tests/api -v                      # 152 API tests
pytest tests/ui -v                       # 27 browser tests (build frontend first)
pytest tests -q                          # all 179
```

The UI tests need a built frontend:

```bash
cd frontend && npm ci && npm run build && cd ..
```

## Layout

```text
tests/
├── config/settings.py      # single configuration entry point (env or .env)
├── api/                    # 152 black-box HTTP tests, one file per business area
├── ui/                     # 27 Playwright tests
├── fixtures/               # authentication, users, tickets/articles, browser and SPA server
├── utils/                  # API client, assertions, JWT, database, logger, locators, static server
├── schemas/                # response JSON schemas
├── reports/                # run artifacts (git ignored)
├── conftest.py             # path setup, fixture registry, health gate, failure screenshots
├── pytest.ini  requirements.txt  .env.example
```

## Conventions

- **Test data**: the API has no delete endpoints, so every object is named
  `qa_<run_id>_<time>_<counter>_<random>` and tests only touch what they created. CI uses a fresh
  database volume per run.
- **Assertion depth**: status code + RFC 9457 `title`/`detail` + business fields + JSON schema. A bare
  200 never passes. Spring Security's 401/403 responses carry no body, which `assert_empty_body`
  verifies explicitly.
- **No mocking**: the AI module is exercised through its two deterministic branches (unmatched → 200
  ungrounded, matched but unconfigured → 503), so no real model quota is consumed.
- **Diagnosability**: assertion failures embed the response body; UI failures capture a screenshot;
  logs go to the console and `reports/logs/` (falling back to console-only on a read-only checkout).

## Documentation

- [Automation guide](../docs/automation-testing.md): architecture, data strategy, Docker, Allure, CI, troubleshooting
- [Test case catalog](../docs/test-cases.md): all 179 cases grouped by module
- [Known issues](../docs/known-issues.md): behaviour proven by tests and mismatches found in the docs
- [Interview guide](../docs/interview-guide.md): how to present the project
