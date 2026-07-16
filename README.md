# Smart Service

AI-assisted enterprise ticket and knowledge platform. The project starts as a modular monolith so its
business boundaries remain explicit without adding distributed-system overhead too early.

## Current milestone

- Java 21 and Spring Boot 3
- Ticket creation, lookup, pagination, and controlled status transitions
- MySQL schema managed by Flyway
- Optimistic locking on ticket updates
- RFC 9457 problem responses for API errors
- Actuator health and metrics endpoints

## Run locally

Prerequisites: JDK 21, Maven 3.9+, and Docker.

```bash
docker compose up -d mysql
mvn spring-boot:run
```

Create a ticket:

```bash
curl -X POST http://localhost:8080/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"VPN unavailable","description":"The whole team cannot connect","priority":"P1"}'
```

Start work on ticket 1:

```bash
curl -X PATCH http://localhost:8080/api/v1/tickets/1/status \
  -H "Content-Type: application/json" \
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

## Planned modules

`identity`, `ticket`, `knowledge`, `ai`, `notification`, and `analytics`. The next milestone adds
authentication and RBAC, ticket comments and audit events. RAG ingestion and model integration follow
after the core workflow is reliable.
