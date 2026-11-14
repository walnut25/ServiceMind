# 已知问题与验证记录

[English](known-issues.md) | [简体中文](known-issues.zh-CN.md)

本文件记录搭建自动化测试过程中被证实的行为。它把"已被用例固定"的行为与"仅靠静态审计得出"的结论
分开；没有为了让测试通过而修改任何应用代码。

## A. 已被测试固定（回归基线）

### A1. 已签发的 token 不校验用户是否存在

- **现象**：用已知 `JWT_SECRET` 签发、携带 `sub=qa_ghost_user` 与 `scope=ADMIN` 的 token，能被
  `GET /api/v1/users` 接受（200）。
- **原因**：资源服务器只校验签名与时间戳，角色转换器读取 `scope` 声明，从不查询 `user_accounts`。
- **复现**：`pytest tests/api/test_auth.py::TestTokenValidation::test_known_risk_token_for_unknown_subject_is_accepted -v`
- **影响**：任何获知 `JWT_SECRET` 的人都能伪造任意角色。该默认值直接写在 `application.yml` 与
  `compose.yaml`，生产部署必须注入强随机密钥。
- **测试立场**：这是对当前行为的特性化测试。若将来加固（查库或校验 `iss`），该用例会失败，应同步
  翻转断言。

### A2. 时间字段在 API 与数据库之间会舍入

- **现象**：`publishedAt` 首次返回 `...129371500Z`，归档后读回为 `...129372Z`。
- **原因**：API 序列化纳秒级 `Instant`，MySQL 存 `TIMESTAMP(6)`（微秒），往返时按微秒舍入。
- **复现**：`pytest tests/api/test_knowledge.py::TestLifecycle::test_archive_keeps_published_at -v`
- **影响**：客户端做等值比较会误判；断言需要容差（本套件用 10ms）。

### A3. 负责人保留调用方传入的大小写

- **现象**：`PATCH /tickets/{id}/assignee {"username":"AGENT_UPPER"}` 后，`assigneeUsername` 存的是大写。
- **原因**：服务端只做 `strip()`；查库用 `findByUsernameIgnoreCase`，但不回写规范拼写。
- **复现**：`pytest tests/api/test_tickets.py::TestFiltering::test_assignee_filter_is_exact_and_case_insensitive -v`
- **影响**：同一账号可能出现多种写法，精确匹配的客户端会不一致。

### A4. 401 / 403 响应体为空

- **现象**：未认证或越权时只返回状态码与 `WWW-Authenticate` 头。
- **原因**：没有注册自定义 `AuthenticationEntryPoint` 或 `AccessDeniedHandler`，走 Spring Security 默认实现。
- **影响**：调用方不能假设错误响应一定是 JSON；`assert_empty_body` 对此做了显式断言。

## B. 仅靠静态审计确认

### B1. `metrics.breached` 与 `slaBreached=true` 过滤口径不一致

- **代码**：列表过滤（`TicketRepository.findBreached`）包含"解决时间晚于截止时间"的工单；而
  `TicketService.metrics` 只统计未解决的超时工单。
- **后果**：同一张"迟到但已解决"的工单，在列表里算超时、在指标里不算。
- **为何不写用例**：稳定复现需要直接改写 `due_at`，等于绕过 API 改数据，不适合放进正式套件。

### B2. 乐观锁在 HTTP 层不可达

- **代码**：实体有 `@Version`，但请求 DTO 不暴露 `version`，也没有 `If-Match`；
  `ApiExceptionHandler` 未映射 `ObjectOptimisticLockingFailureException`。
- **后果**：并发写冲突表现为 500 而不是 409，README 中乐观锁的描述高估了 HTTP 契约。

### B3. 禁用账号不会吊销已签发的 token

- **代码**：JWT 校验从不查库，禁用只翻转 `enabled`。
- **后果**：被禁用用户的 token 在 `TTL + 60s`（默认 30 分钟）内仍然可用。

### B4. 缺少"最后一个管理员"保护

- **代码**：`UserAccountService.changeEnabled` 阻止管理员禁用**自己**，但不阻止禁用其他管理员。
- **后果**：可以把所有管理员互相禁用，之后只能改库恢复。

### B5. 文档与实现不一致

| 位置 | 文档说法 | 实际 |
| --- | --- | --- |
| `docs/testing.md:41` | "adds **three** Testcontainers tests" | 实际 4 个；同页第 43 行的 "4 MySQL tests / 46 tests" 才是对的 |
| `docs/testing.md:42` | 集成测试验证 "persistence, role storage, optimistic locking, and full-text search" | `MySqlRepositoryIT` 没有乐观锁用例 |
| `TicketController` OpenAPI 注解 | "Allowed workflow: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED" | 还允许 `OPEN→CLOSED`、`IN_PROGRESS→CLOSED`、`RESOLVED→IN_PROGRESS`；`docs/architecture.md` 的图是对的 |
| `README.md` 乐观锁描述 | "optimistic locking" 防丢更新 | 见 B2，HTTP 层没有版本条件更新 |
| `.env.example` / `compose.yaml` | 暗示端口、凭据与 AI 供应商可配置 | `JWT_ACCESS_TOKEN_TTL`、`AI_TIMEOUT`、`AI_MAX_CONTEXT_ARTICLES` 代码已支持但未透传（`tests/.env.example` 已记录三项） |

## C. 本轮质量改进中已修复

这次对测试框架本身的审查共发现五个缺陷。记录在这里是因为它们是真实存在的，并非业务缺陷；目前
全部修复，并由 `tests/unit` 覆盖。

| 缺陷 | 影响 | 修复 |
| --- | --- | --- |
| `ApiClient.with_token()` 把 `Authorization` 写进共享的 `requests.Session`，原客户端读的也是同一个 session | 两个客户端可能互相覆盖 token；无认证请求可能继承别人的 token | token 改为客户端私有并逐请求附加；session 不再保存 `Authorization` |
| UI 页面被追加到模块级列表后从不移除 | 引用在整轮会话中累积；截图可能抓到其他用例的页面 | fixture 在 teardown 注销页面；截图在 teardown 之前执行，失败时仍能抓到正确页面 |
| `UI_BROWSER_CHANNEL` 默认 `chrome`，而文档写的是"安装 Chromium 即可" | 按文档操作的新检出让然需要系统 Chrome | 默认改为空值（自带 Chromium）；`chrome`/`msedge` 变成显式选择 |
| 截图与日志目录固定在仓库内 | 只读检出下失败产物被静默丢弃 | `QA_SCREENSHOT_DIR` 与 `QA_LOG_DIR` 可覆盖位置；无法创建时记录警告并继续 |
| 后端健康门禁是全局 autouse | 框架单元测试无法脱离后端运行 | 门禁下放到 `tests/api/conftest.py` 与 `tests/ui/conftest.py`，`tests/unit` 独立运行 |

同时修正了两处不一致：内置 UI 静态服务现在遵循 `UI_PORT`（此前随机端口、文档却写 8090），以及新增
`UI_EXTERNAL_SERVER` 以复用已在运行的前端。

## D. 建议

1. 生产环境强制使用强 `JWT_SECRET`，并增加 `iss`/`aud` 与账号状态校验（可缓解 A1 与 B3）。
2. 为 `ObjectOptimisticLockingFailureException` 增加 409 映射，或在请求 DTO 中引入 `version`。
3. 让超时指标与列表过滤基于同一个仓储查询。
4. 在 Java 侧补 Controller 层的 409/404/422 断言；Python 套件已在 HTTP 层覆盖。
