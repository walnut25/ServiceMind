# Testing Smart Service

[English](testing.md) | [简体中文](testing.zh-CN.md)

This guide covers the verification path used before presenting or submitting the project. It starts
with isolated tests, continues with a real MySQL database, and finishes with an end-to-end workflow
through the public HTTP API.

## Prerequisites

- JDK 21
- Internet access on the first Maven Wrapper run (it downloads the pinned Maven 3.9.11)
- Docker Desktop with the Docker engine running
- PowerShell 5.1 or newer for the automated smoke test

Run every command from the repository root.

## 1. Fast tests

```powershell
.\mvnw.cmd clean test
```

This runs 30 unit, domain, and MockMvc API/security tests. It does not need Docker.

Expected result:

```text
Tests run: 30, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## 2. Complete automated suite

Start Docker Desktop, then run:

```powershell
.\mvnw.cmd verify -Pintegration
```

The integration profile adds three Testcontainers tests against MySQL 8.4. Flyway applies the real
migrations and the tests verify persistence, role storage, optimistic locking, and full-text search.
The complete suite therefore runs 33 tests.

## 3. End-to-end system test

The smoke test builds the production Docker image, starts the application and MySQL, waits for health,
then exercises the system as an administrator, agent, and requester:

- JWT login and user administration
- role-based access control and requester ticket isolation
- ticket creation, assignment, transition, comments, and audit history
- knowledge drafting, publishing, and MySQL full-text search
- account disabling and login rejection

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -MysqlPort 3307 -StopAfter
```

Port `3307` avoids a common conflict with a MySQL instance already using `3306`. Omit `-StopAfter` if
you want to leave the application running for a demonstration. Success ends with:

```text
SMART SERVICE END-TO-END SMOKE TEST PASSED
```

The script uses unique usernames and content each time, so it can safely run repeatedly against the
same local database. Custom ports and credentials can be supplied as parameters:

```powershell
.\scripts\smoke-test.ps1 `
  -MysqlPort 3307 `
  -ServerPort 8082 `
  -AdminUsername admin `
  -AdminPassword "Admin123!"
```

## 4. Manual API test with Swagger

Leave the containers running and open
[Swagger UI](http://localhost:8081/swagger-ui.html).

1. Call `POST /api/v1/auth/login` with `admin` / `Admin123!`.
2. Copy `accessToken` from the response.
3. Click **Authorize** and enter `Bearer <accessToken>`.
4. Create an agent and requester under **Users**.
5. Create, assign, transition, and comment on a ticket under **Tickets**.
6. Confirm four corresponding entries under the ticket audit endpoint.
7. Create and publish an article under **Knowledge**, then search for a word in it.

Useful runtime checks:

- Health: [http://localhost:8081/actuator/health](http://localhost:8081/actuator/health)
- OpenAPI JSON: [http://localhost:8081/v3/api-docs](http://localhost:8081/v3/api-docs)
- Container state: `docker compose ps`
- Application logs: `docker compose logs -f app`

## 5. Optional live AI-provider test

The default suite avoids paid and nondeterministic external AI calls. Retrieval, prompt construction,
fallback behavior, and provider mapping are covered with local automated tests.

To perform one live provider test, set an OpenAI-compatible API key before starting Compose:

```powershell
$env:AI_CHAT_ENABLED = "true"
$env:AI_API_KEY = "your-api-key"
$env:AI_BASE_URL = "https://api.deepseek.com"
$env:AI_MODEL = "deepseek-chat"
docker compose up -d --build
```

Publish a relevant knowledge article first, log in, and call `POST /api/v1/ai/answers`:

```json
{"question":"How do I troubleshoot the VPN connection?"}
```

The response should set `grounded` to `true` and include the source article. Do not commit `.env` or
an API key.

## Troubleshooting

### Port is already allocated

Use another host port:

```powershell
$env:MYSQL_PORT = "3307"
$env:SERVER_PORT = "8082"
docker compose up -d --build
```

### Administrator login fails after changing credentials

The bootstrap administrator is only created when the database is empty. Existing Docker volumes keep
the original password. Either use the original credentials or, if local data can be discarded, reset
the database:

```powershell
docker compose down -v
```

This command permanently deletes the project's local database volume.

### Docker-based tests cannot connect

Confirm Docker Desktop reports that the engine is running, then check `docker version` and
`docker info`.

### Warnings in otherwise successful builds

Mockito may warn about dynamic Java-agent attachment, and Flyway may warn that a newer MySQL 8.4
minor release has not yet been explicitly tested. They are non-blocking when the build and all tests
finish successfully; failures and errors must still be zero.

## Release checklist

- `.\mvnw.cmd clean test` passes
- `.\mvnw.cmd verify -Pintegration` passes with Docker running
- `scripts/smoke-test.ps1` reports success
- Swagger UI opens and the health endpoint reports `UP`
- no secrets or `.env` files are staged
- `git diff --check` reports no whitespace errors
- the README, architecture guide, and API behavior agree
