# 已知问题与验证记录

本文件记录在搭建自动化测试过程中**确认**的问题，区分「测试已覆盖的行为」与「仅代码审计结论」。
这不是缺陷清单的堆砌——每一条都写清复现方式与影响，且**没有为了让用例通过而修改业务代码**。

## A. 已由测试固定下来（可作为回归基线）

### A1. 已签发的 token 不校验用户是否存在

- **现象**：用已知 `JWT_SECRET` 自签一个 `sub=qa_ghost_user`、`scope=ADMIN` 的 token，`GET /api/v1/users` 返回 200。
- **原因**：资源服务器只校验签名与时间，`JwtAuthenticationConverter` 直接把 `scope` 映射为权限，运行期不查 `user_accounts`。
- **复现**：`pytest tests/api/test_auth.py::TestTokenValidation::test_known_risk_token_for_unknown_subject_is_accepted -v`
- **影响**：只要 `JWT_SECRET` 泄露（默认值就写在 `application.yml`/`compose.yaml` 里），即可伪造任意角色。生产部署必须注入强随机密钥。
- **测试态度**：这是**特性化测试**，断言当前真实行为。若将来加固（查库或校验 `iss`），该用例会失败并提示翻转断言。

### A2. 时间字段在 API 与数据库之间会舍入

- **现象**：`publishedAt` 首次返回 `...129371500Z`，归档后读取为 `...129372Z`。
- **原因**：API 序列化纳秒级 `Instant`，MySQL 列是 `TIMESTAMP(6)`（微秒），往返按微秒舍入。
- **复现**：`pytest tests/api/test_knowledge.py::TestLifecycle::test_archive_keeps_published_at -v`
- **影响**：客户端做等值比较会误判；断言应带容差（已用 10ms）。

### A3. 负责人保留调用方传入的大小写

- **现象**：`PATCH /tickets/{id}/assignee {"username":"AGENT_UPPER"}` 后，`assigneeUsername` 存的是大写形式。
- **原因**：服务端只做 `strip()`，查库用 `findByUsernameIgnoreCase`，但不回写规范大小写。
- **复现**：`pytest tests/api/test_tickets.py::TestFiltering::test_assignee_filter_is_exact_and_case_insensitive -v`
- **影响**：同一用户可能出现多种写法；前端按名字精确比较会不一致。

### A4. 401/403 响应体为空

- **现象**：未认证/越权时返回空 body，只有状态码和 `WWW-Authenticate` 头。
- **原因**：未自定义 `AuthenticationEntryPoint`/`AccessDeniedHandler`，走 Spring Security 默认实现。
- **影响**：调用方不能假设错误响应一定是 JSON；测试中用 `assert_empty_body` 显式覆盖。

## B. 仅代码审计结论（未写入用例，避免篡改数据或长等待）

### B1. `metrics.breached` 与列表 `slaBreached=true` 口径不一致

- **代码**：`TicketRepository.findBreached`（列表）包含「已解决但 `resolvedAt > dueAt`」；`TicketService.metrics` 的
  `breached` 只统计未解决且超时。
- **后果**：同一张"迟到解决"的工单，在列表筛选中算超时、在指标中不算。
- **为何不写用例**：稳定复现要把 `due_at` 改到过去（需要直接改库），属于篡改数据，不适合放进正式套件。

### B2. 乐观锁在 HTTP 层不可达，冲突会返回 500

- **代码**：实体有 `@Version`，但请求 DTO 没有 `version` 字段，也没有 `If-Match`；`ApiExceptionHandler` 未映射
  `ObjectOptimisticLockingFailureException`。
- **后果**：并发写冲突会走 Spring Boot 默认错误页（500），而不是 409；README 中"optimistic locking"描述偏乐观。

### B3. 禁用账号不会吊销已签发的 token

- **代码**：JWT 校验不查库，禁用只改 `enabled` 标志。
- **后果**：最长 `TTL + 60s`（默认 30 分钟）内，被禁用账号的旧 token 仍可用。

### B4. 缺少"最后一个管理员"保护

- **代码**：`UserAccountService.changeEnabled` 只阻止管理员禁用**自己**，不阻止禁用其他管理员。
- **后果**：可以把所有管理员互相禁用，导致无法登录后台（只能改库恢复）。

### B5. 文档与实现不一致

| 位置 | 文档说法 | 实际 |
| --- | --- | --- |
| `docs/testing.md:41` | "adds **three** Testcontainers tests" | 实际 4 个（同页第 43 行的 "4 MySQL tests / 46 tests" 才是对的） |
| `docs/testing.md:42` | 集成测试验证 "persistence, role storage, optimistic locking, and full-text search" | `MySqlRepositoryIT` 的 4 个用例里没有乐观锁验证 |
| `TicketController` OpenAPI 注解 | "Allowed workflow: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED" | 还允许 `OPEN→CLOSED`、`IN_PROGRESS→CLOSED`、`RESOLVED→IN_PROGRESS`（`docs/architecture.md` 的图是对的） |
| `README.md` 乐观锁描述 | "optimistic locking" 防丢更新 | 见 B2，HTTP 层没有版本条件更新 |
| `.env.example` / `compose.yaml` | 声称可配置端口、凭据、AI 供应商 | 未透传代码已支持的 `JWT_ACCESS_TOKEN_TTL`、`AI_TIMEOUT`、`AI_MAX_CONTEXT_ARTICLES`（`tests/.env.example` 已补齐这三项） |

## C. 建议（不阻塞本次交付）

1. 生产环境强制注入 `JWT_SECRET`，并增加 `iss`/`aud` 校验与用户状态校验（可缓解 B1 之外的 A1、B3）。
2. 为 `ObjectOptimisticLockingFailureException` 增加 409 映射，或在请求 DTO 中引入 `version`。
3. 统一 `breached` 口径：指标与列表筛选应基于同一个 repository 查询。
4. 补测 `UserAccountController` 的 409/404/422 接口级断言（当前 Python 侧已覆盖）。
