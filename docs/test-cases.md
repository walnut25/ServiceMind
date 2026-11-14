# Test case catalog

[English](test-cases.md) | [简体中文](test-cases.zh-CN.md)

**179 tests** in total: 152 API and 27 UI. Names state the intent: `test_<behaviour>_<expectation>`.

## API (152)

### `api/test_auth.py` — 25 tests

| Group | Coverage |
| --- | --- |
| Login success (4) | `Bearer` + `accessToken` + `expiresAt`; JWT claims (`iss`/`sub`/`scope`/`exp>iat`); case-insensitive username with canonical `sub`; token unlocks a protected endpoint |
| Login failure (8) | Wrong password returns 401 without revealing the user; unknown user returns the same response; disabled account returns 401; missing/blank password, username, and empty body — 5 parameterised 400 cases |
| Token validation (9) | Missing token → 401 with empty body and `WWW-Authenticate`; non-JWT token; tampered signature; `Basic` scheme; lowercase `bearer` accepted; token in query string rejected; expired token; token without `scope` authenticates but is rejected by business endpoints while actuator still answers; known risk: a forged token for an unknown subject is accepted |
| Role boundaries (4) | REQUESTER/AGENT listing users → 403 with empty body; REQUESTER reading metrics → 403; ADMIN listing users → 200 with the page envelope |

### `api/test_users.py` — 19 tests

| Group | Coverage |
| --- | --- |
| Creation (11) | 201 payload fields; the new account can log in; duplicate username (case-insensitive) → 409; username 2/101 characters, invalid characters, password 11/73 characters, empty roles — 6 parameterised 400 cases; unknown role → 400; AGENT/REQUESTER creating users → 403 |
| Reading (4) | Get by id → 200; unknown id → 404; pagination size is honoured; `/users/assignees` contains only enabled ADMIN/AGENT |
| Account state (4) | Disable → login returns 401; re-enable → 200; an administrator cannot disable their own account → 409; unknown user → 404; missing `enabled` field → 400 |

### `api/test_tickets.py` — 49 tests

| Group | Coverage |
| --- | --- |
| Creation (13) | `dueAt = createdAt + 4h/8h/24h/72h` for P1–P4; `requester` comes from the token (a body field of the same name is ignored); new ticket is `ON_TRACK`, unassigned, `version=0`; AGENT may also raise tickets; 5 invalid payloads → 400; 200/10000 character boundaries → 201 |
| Reading (4) | Detail → 200; unknown → 404; REQUESTER reading a foreign ticket → 404 (existence is not leaked); REQUESTER list contains only their own tickets |
| Filtering (5) | Page envelope; priority filter; status filter follows transitions; assignee filter is case-insensitive; a fresh ticket is not `slaBreached` |
| Metrics (1) | Fields match the schema; `byStatus`/`byPriority` carry every enum key; `sum(byStatus)=total`; `active=OPEN+IN_PROGRESS` |
| State machine (18) | Four legal paths (parameterised); resolving sets `resolvedAt` and `MET`; reopening clears it; eight illegal transitions → 409 with `cannot transition`; REQUESTER → 403; unknown ticket → 404; missing `status` → 400; unknown status value → 400 |
| Assignment (8) | Assignment succeeds; surrounding whitespace is stripped; assigning a REQUESTER → 422; unknown user → 422; an invalid assignee wins over a missing ticket; valid assignee with an unknown ticket → 404; blank assignee → 400; REQUESTER → 403 |

### `api/test_comments.py` — 12 tests

Adding a comment returns 201 with the author taken from the token (REQUESTER and AGENT); content
boundaries 0/blank/10000/10001; commenting on a foreign ticket → 404; unknown ticket → 404; comments
are listed oldest first; **a comment does not change the ticket `updatedAt`**; a closed ticket still
accepts comments; the database comment count matches the API `totalElements`.

### `api/test_audit.py` — 8 tests

Ticket creation emits `TICKET_CREATED` with an exact `details` string; a full lifecycle emits four
event types sorted newest first by default; `ASSIGNEE_CHANGED` and `STATUS_CHANGED` carry their exact
`details`; each event records its own actor; **a rejected transition writes no audit event**;
REQUESTER reading the trail → 403; unknown ticket → 404; database event order matches the API.

### `api/test_knowledge.py` — 30 tests

Creation returns 201 with `DRAFT`, `publishedAt=null`, `version=0`; REQUESTER → 403; eight field
length/blank cases → 400. Visibility: AGENT reads a draft (200), REQUESTER reads a draft (404),
REQUESTER reads a published article (200), the list contains only published articles, unknown → 404.
Lifecycle: publishing sets `publishedAt`, publishing again refreshes it, **a published article is
still editable**, archiving preserves `publishedAt`, editing or publishing an archived article → 409,
archiving twice → 409, `version` increments, updating an unknown article → 404, REQUESTER write
operations → 403. Search: a unique token finds the published article, drafts are excluded, archived
articles are excluded, missing/blank/oversized query → 400.

### `api/test_ai.py` — 9 tests

Anonymous → 401; missing, blank, whitespace-only and oversized `question` — 4 parameterised 400
cases; an unmatched question returns 200 with `grounded=false` and empty `sources`; a matched question
with AI disabled returns 503; REQUESTER and AGENT may both ask.

## UI (27)

### `ui/test_login.py` — 5 tests

Successful login lands on the dashboard and shows role-specific navigation; a wrong password shows
`用户名或密码错误` and stays on the login page; an empty form triggers client-side validation; a
protected route redirects to login and keeps the `redirect` parameter; logout returns to the login page.

### `ui/test_ticket_flow.py` — 8 tests

REQUESTER creates a ticket through the form and lands on its detail page (`待处理`); the empty form is
blocked by client-side validation; a REQUESTER detail page has **no** workflow buttons but does offer
comments; AGENT moves a ticket from `开始处理` to `关闭工单` including the confirmation dialog; AGENT
assigns the ticket through the dialog and sees the new owner; AGENT adds a comment; the list shows the
new ticket; the status filter writes to the URL.

### `ui/test_knowledge.py` — 4 tests

AGENT publishes an article through the editor and finds it by search; REQUESTER finds a published
article; REQUESTER has no `新建文章` button; AGENT has one.

### `ui/test_assistant.py` — 3 tests

An unmatched question shows `知识库中没有找到足够信息` with a `创建工单` shortcut; a matched question
with AI disabled shows `AI 服务当前未启用` with `提交工单`; Enter sends the question.

### `ui/test_permissions.py` — 7 tests

REQUESTER navigation has no `用户管理` or `新建知识文章`; AGENT has knowledge authoring but no user
administration; ADMIN has user administration; REQUESTER visiting `/admin/users` or `/knowledge/new`
lands on 403; AGENT can open the editor; an unknown route renders the 404 page.

## Running a subset

```bash
pytest tests/api/test_auth.py -v           # 25
pytest tests/api -v                        # 152
pytest tests/ui -v                         # 27
pytest tests -q                            # 179
```
