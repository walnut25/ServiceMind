# Smart Service architecture

## Design goals

Smart Service is structured as a modular monolith to keep the first deployment operationally simple
without losing clear business boundaries. Each module owns its API, application services, domain model,
and persistence abstractions.

The current architecture optimizes for:

- explicit ticket, identity, knowledge, and AI boundaries;
- secure multi-role workflows and requester data isolation;
- auditable changes and controlled domain transitions;
- provider-neutral AI integration;
- repeatable local, CI, and container environments.

## Component view

```mermaid
flowchart TB
    User["Requester / Agent / Administrator"]

    subgraph HTTP["HTTP layer"]
        Security["Spring Security JWT filter"]
        Controllers["REST controllers"]
        Errors["RFC 9457 exception handler"]
        OpenAPI["OpenAPI / Swagger"]
    end

    subgraph Modules["Application modules"]
        AuthService["Identity application services"]
        TicketService["Ticket application service"]
        KnowledgeService["Knowledge application service"]
        RagService["RAG answer service"]
        Retriever["Knowledge context retriever"]
        Gateway["Chat model gateway"]
    end

    subgraph Persistence["Persistence"]
        UserRepo["User repository"]
        TicketRepos["Ticket / comment / audit repositories"]
        ArticleRepo["Knowledge repository"]
        Database[("MySQL")]
    end

    User --> Security --> Controllers
    Controllers --> AuthService
    Controllers --> TicketService
    Controllers --> KnowledgeService
    Controllers --> RagService
    Controllers -. errors .-> Errors
    OpenAPI -. describes .-> Controllers

    AuthService --> UserRepo --> Database
    TicketService --> TicketRepos --> Database
    TicketService --> AuthService
    KnowledgeService --> ArticleRepo --> Database
    RagService --> Retriever --> KnowledgeService
    RagService --> Gateway --> Provider["OpenAI-compatible provider"]
```

## Module dependencies

| Source module | Dependency | Reason |
| --- | --- | --- |
| `ticket` | `identity` | Validate that an assignee exists, is enabled, and has an agent/admin role |
| `ai` | `knowledge` | Retrieve published support articles as grounded context |
| all HTTP modules | `common` | Consistent Problem Details, page serialization, and OpenAPI configuration |

The identity and knowledge modules do not depend on ticket or AI code, keeping the dependency direction
acyclic.

## Data model

```mermaid
erDiagram
    USER_ACCOUNTS ||--o{ USER_ROLES : has
    TICKETS ||--o{ TICKET_COMMENTS : contains
    TICKETS ||--o{ TICKET_AUDIT_EVENTS : records

    USER_ACCOUNTS {
        BIGINT id PK
        VARCHAR username UK
        VARCHAR password_hash
        BOOLEAN enabled
        TIMESTAMP created_at
    }

    USER_ROLES {
        BIGINT user_id PK, FK
        VARCHAR role PK
    }

    TICKETS {
        BIGINT id PK
        VARCHAR title
        TEXT description
        VARCHAR priority
        VARCHAR status
        VARCHAR requester_username
        VARCHAR assignee_username
        TIMESTAMP created_at
        TIMESTAMP updated_at
        BIGINT version
    }

    TICKET_COMMENTS {
        BIGINT id PK
        BIGINT ticket_id FK
        VARCHAR author_username
        TEXT content
        TIMESTAMP created_at
    }

    TICKET_AUDIT_EVENTS {
        BIGINT id PK
        BIGINT ticket_id FK
        VARCHAR event_type
        VARCHAR actor_username
        VARCHAR details
        TIMESTAMP created_at
    }

    KNOWLEDGE_ARTICLES {
        BIGINT id PK
        VARCHAR title
        VARCHAR summary
        LONGTEXT content
        VARCHAR category
        VARCHAR status
        VARCHAR created_by
        VARCHAR updated_by
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP published_at
        BIGINT version
    }
```

Actor, requester, and assignee usernames are stored as operational snapshots rather than foreign keys.
The application validates assignees through the identity module, while historical audit records remain
readable even if account management changes later.

## Ticket workflow

```mermaid
stateDiagram-v2
    [*] --> OPEN
    OPEN --> IN_PROGRESS
    OPEN --> CLOSED
    IN_PROGRESS --> RESOLVED
    IN_PROGRESS --> CLOSED
    RESOLVED --> IN_PROGRESS
    RESOLVED --> CLOSED
    CLOSED --> [*]
```

Transitions are enforced in the domain model. The application service records the authenticated actor,
previous state, and target state in the audit trail inside the same database transaction.

## Authentication and authorization flow

```mermaid
sequenceDiagram
    participant Client
    participant Auth as Authentication API
    participant Users as User repository
    participant JWT as JWT encoder
    participant API as Protected API

    Client->>Auth: POST /auth/login
    Auth->>Users: Load user and BCrypt hash
    Users-->>Auth: Account and roles
    Auth->>Auth: Verify password
    Auth->>JWT: Sign subject, scope, issued/expiry time
    JWT-->>Client: Bearer access token
    Client->>API: Request with Authorization header
    API->>API: Verify signature and role
    API-->>Client: Scoped resource or 401/403/404
```

Requester ticket reads and comments are checked again in the ticket application service. Unauthorized
requesters receive `404` for another user's ticket so the API does not disclose whether it exists.

## Grounded answer flow

```mermaid
sequenceDiagram
    participant Client
    participant AI as AI answer API
    participant RAG as RAG answer service
    participant KB as Knowledge service
    participant DB as MySQL full-text index
    participant Model as Chat provider

    Client->>AI: Submit question
    AI->>RAG: answer(question)
    RAG->>KB: Search published articles
    KB->>DB: MATCH title, summary, content
    DB-->>RAG: Ranked article contexts
    alt no matching context
        RAG-->>Client: Ungrounded "not enough information"
    else context available
        RAG->>RAG: Limit article count and content length
        RAG->>Model: System boundary + untrusted context + question
        Model-->>RAG: Answer with article citations
        RAG-->>Client: Answer, grounded=true, source metadata
    end
```

Knowledge text is explicitly treated as untrusted reference data in the system prompt. The provider
adapter checks configuration and translates upstream failures into `503` or `502` Problem Details.

## Consistency and failure handling

- Ticket mutations and their audit events share a transaction.
- JPA optimistic locking prevents silent lost updates to tickets and articles.
- Flyway validates and applies schema changes before Hibernate validates mappings.
- Validation, missing resources, invalid transitions, AI configuration, and provider failures use
  consistent RFC 9457 responses.
- The application waits for MySQL health in Compose and exposes its own Actuator health endpoint.
- Testcontainers executes migrations and repository queries against the same MySQL major version used
  in local Compose.

## Current trade-offs

- MySQL full-text search keeps the MVP small; vector search is a planned retrieval upgrade.
- Access tokens are stateless and short-lived; refresh-token rotation is not implemented yet.
- Roles are assigned when an account is created; password reset and later role editing are not implemented yet.
- Notification and analytics boundaries are planned but intentionally excluded from the MVP.
