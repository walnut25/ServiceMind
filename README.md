# Smart Service

AI-assisted enterprise ticket and knowledge platform. The project starts as a modular monolith so its
business boundaries remain explicit without adding distributed-system overhead too early.

## Current milestone

- Java 21 and Spring Boot 3
- Ticket creation, lookup, pagination, and controlled status transitions
- MySQL schema managed by Flyway
- Optimistic locking on ticket updates
- Database-backed users with BCrypt password hashing
- Stateless JWT authentication and role-based access control
- Ticket comments with authenticated authors
- Immutable audit trail for ticket creation, status changes, and comments
- Knowledge article lifecycle and MySQL full-text search
- Provider-neutral RAG answers with cited knowledge sources
- RFC 9457 problem responses for API errors
- Actuator health and metrics endpoints

## Run locally

Prerequisites: JDK 21, Maven 3.9+, and Docker.

```bash
docker compose up -d mysql
mvn spring-boot:run
```

The local development administrator is `admin` / `Admin123!`. Override it with the
`ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables outside local development.

Log in and copy the `accessToken` from the response:

```bash
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'
```

Create a ticket using the returned token:

```bash
curl -X POST http://localhost:8081/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"title":"VPN unavailable","description":"The whole team cannot connect","priority":"P1"}'
```

Start work on ticket 1:

```bash
curl -X PATCH http://localhost:8081/api/v1/tickets/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"status":"IN_PROGRESS"}'
```

## API documentation

With the application running, OpenAPI JSON is available at:

```text
http://localhost:8081/v3/api-docs
```

Interactive Swagger UI is available at:

```text
http://localhost:8081/swagger-ui.html
```

In Apifox, create or open a project, choose **Import Data**, select **URL Import**, and enter the
OpenAPI JSON URL. Use the same URL later to synchronize API changes.

## AI configuration

The AI assistant uses an OpenAI-compatible chat API. It defaults to DeepSeek but remains disabled until
credentials are supplied:

```bash
set AI_CHAT_ENABLED=true
set AI_API_KEY=your-api-key
mvn spring-boot:run
```

Use `AI_BASE_URL` and `AI_MODEL` to switch to another compatible provider. API keys must remain in
environment variables and must not be committed.

## Planned modules

`identity`, `ticket`, `knowledge`, `ai`, `notification`, and `analytics`. The next milestone adds
document chunking and vector retrieval, followed by asynchronous ingestion and answer evaluation.
