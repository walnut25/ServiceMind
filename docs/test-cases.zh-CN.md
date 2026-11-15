# 测试用例清单

[English](test-cases.md) | [简体中文](test-cases.zh-CN.md)

共 **288** 条：109 条框架单元测试 + 179 条业务测试（152 API + 27 UI）。用例名即意图
（`test_<行为>_<预期>`）。

## 框架单元测试（109）

这些用例验证测试框架自身。它们不需要后端、数据库或浏览器，几百毫秒内跑完，因此 ApiClient 或
fixture 的错误会先在这里暴露，而不是等到业务套件报出难以理解的错误。

### `unit/test_api_client.py` — 27 条

| 分组 | 覆盖点 |
| --- | --- |
| 传输默认值（3） | `Accept`/`User-Agent` 属于 session；session 永不携带 `Authorization`；session 上预置的旧认证头会被清除 |
| 认证隔离（10） | 每次请求附加 token；无 token 不发送认证头；`with_token()` 不修改原客户端及其 token；派生客户端共享传输；`without_auth()` 不影响其他客户端且保留自身 token；显式 token 覆盖默认值；显式空 token 清除认证头；显式 `headers=` 优先；同一 session 上两个客户端各自持有 token |
| 请求装配与 URL（9） | JSON/params/headers 正确转发；默认超时取自配置；显式超时覆盖默认；`health()` 使用短超时；`login()` 以 JSON 提交凭据；api 前缀、actuator、绝对地址共 4 组 URL 构造 |
| 响应处理（4） | 非 2xx 不抛异常而是返回；非法 JSON 返回 `None`；`describe()` 脱敏 token；记录耗时 |
| 配置注入（1） | 注入的 `Settings` 能改变基址与前缀 |

### `unit/test_settings.py` — 24 条

本地 Compose 默认值；浏览器默认使用自带 Chromium；UI 静态服务默认值；`api_root`/`health_url`
组合；末尾斜杠归一化；字符串与整数覆盖；5 种真值 + 4 种假值布尔写法；空布尔回落默认；非数字整数
显式报错；浏览器通道未设置/空值/显式值；不可变；实例之间互不影响。

### `unit/test_assertions.py` — 23 条

`assert_status` 整数与集合两种形式、失败信息含状态码与响应体；`assert_empty_body`；`assert_problem`
对 title/detail/type/非 JSON 的失败；`assert_page` 正常、缺 content、缺 page 字段、size 不符、页码
越界、空结果；`assert_fields` 子集匹配与差异输出；`assert_schema` 通过、枚举违规、缺必填字段。

### `unit/test_data_factory.py` — 14 条

后缀唯一性（200 次）与 run_id 前缀；用户名形状/字符集/长度与唯一性；密码长度策略与唯一性；工单
载荷结构、优先级与标题覆盖、唯一性；文章载荷结构与唯一性；用户载荷角色透传与显式覆盖。

### `unit/test_ui_fixtures.py` — 9 条

页面登记：登记/注销、重复登记幂等、注销未知页面安全、模拟 20 条用例后不增长；截图：采集未关闭页面、
跳过已关闭页面、多页面编号、单个页面截图异常不影响失败上报、可关闭截图。

### `unit/test_ui_server.py` — 12 条

UI 测试本地使用的静态 SPA 服务：提供 `index.html` 与静态资源；缺失资源返回 404 而不是回退到首页；
`/tickets/1`、`/knowledge`、`/tickets/12?tab=audit` 回退到 `index.html`；GET/POST 与 `/actuator`
请求被转发到后端（含请求体与 `Authorization`）；后端不可达返回 502；未启动时访问 `url` 报错；
`frontend/dist` 不存在时给出明确报错。这些用例取代了此前"只跑两条浏览器用例来保证脚手架可用"的 Job。

## API（152）

其中 `TestMetrics::test_metrics_shape_consistent_with_buckets` 标记为 `serial`：它验证的响应由六次
独立查询拼成，因此被排除在并行阶段之外、单独执行。见[自动化测试手册](automation-testing.zh-CN.md#并行执行)。

### `api/test_auth.py` — 25 条

| 分组 | 覆盖点 |
| --- | --- |
| 登录成功（4） | `Bearer` + `accessToken` + `expiresAt`；JWT claims（`iss`/`sub`/`scope`/`exp>iat`）；用户名大小写不敏感且 `sub` 使用库中规范大小写；token 可访问受保护端点 |
| 登录失败（8） | 密码错误返回 401 且不泄露用户是否存在；不存在用户返回相同响应；禁用账号返回 401；缺失/空白密码、用户名、空 body 共 5 组参数化 400 |
| Token 校验（9） | 无 token → 401 且空响应体并带 `WWW-Authenticate`；非 JWT token；篡改签名；`Basic` 方案；小写 `bearer` 可用；query 参数传 token 被拒；过期 token；无 `scope` 的 token 认证通过但业务端点 403、actuator 仍可用；已知风险：为不存在用户伪造的 token 会被接受 |
| 角色边界（4） | REQUESTER/AGENT 列用户 → 403 且空响应体；REQUESTER 读指标 → 403；ADMIN 列用户 → 200 且分页信封正确 |

### `api/test_users.py` — 19 条

| 分组 | 覆盖点 |
| --- | --- |
| 创建（11） | 201 响应字段；新账号可登录；重复用户名（大小写不敏感）→ 409；用户名 2/101 字符、非法字符、密码 11/73 字符、空角色共 6 组参数化 400；未知角色 → 400；AGENT/REQUESTER 创建用户 → 403 |
| 查询（4） | 按 ID 查询 → 200；不存在 → 404；分页 size 生效；`/users/assignees` 只含启用的 ADMIN/AGENT |
| 账号状态（4） | 禁用后登录 401、重新启用后 200；管理员不能禁用自己 → 409；禁用不存在用户 → 404；缺少 `enabled` 字段 → 400 |

### `api/test_tickets.py` — 49 条

| 分组 | 覆盖点 |
| --- | --- |
| 创建（13） | P1–P4 各自 `dueAt = createdAt + 4h/8h/24h/72h`；`requester` 取自 token（请求体同名字段被忽略）；新单为 `ON_TRACK`、未指派、`version=0`；AGENT 也可建单；5 组非法载荷 → 400；200/10000 字符边界 → 201 |
| 读取（4） | 详情 → 200；不存在 → 404；REQUESTER 读他人工单 → 404（不泄露存在性）；REQUESTER 列表只含自己的工单 |
| 过滤（5） | 分页信封；优先级过滤；状态过滤随流转变化；负责人过滤大小写不敏感；新单不在 `slaBreached` 中 |
| 指标（1） | 字段符合 schema；`byStatus`/`byPriority` 含全部枚举键；`sum(byStatus)=total`；`active=OPEN+IN_PROGRESS` |
| 状态机（18） | 4 条合法路径（参数化）；解决设置 `resolvedAt` 且 SLA 为 `MET`；重开清空该字段；8 条非法流转 → 409 且含 `cannot transition`；REQUESTER → 403；不存在工单 → 404；缺 `status` → 400；未知状态值 → 400 |
| 指派（8） | 指派成功；首尾空白被 strip；指派 REQUESTER → 422；不存在用户 → 422；非法负责人优先于工单不存在；合法负责人 + 不存在工单 → 404；空白负责人 → 400；REQUESTER → 403 |

### `api/test_comments.py` — 12 条

添加评论返回 201 且作者取自 token（REQUESTER 与 AGENT 各一）；内容边界 0/空白/10000/10001；评论他人
票据 → 404；不存在工单 → 404；评论按时间升序返回；**评论不改变工单 `updatedAt`**；已关闭工单仍可
评论；数据库评论数与 API `totalElements` 一致。

### `api/test_audit.py` — 8 条

建单产生 `TICKET_CREATED` 且 `details` 精确匹配；完整生命周期产生四类事件且默认按时间倒序；
`ASSIGNEE_CHANGED` 与 `STATUS_CHANGED` 的 `details` 原文；每条事件记录各自的操作者；**被拒绝的流转
不写审计**；REQUESTER 读审计 → 403；不存在工单 → 404；数据库事件顺序与 API 一致。

### `api/test_knowledge.py` — 30 条

创建返回 201 且为 `DRAFT`、`publishedAt=null`、`version=0`；REQUESTER → 403；八组字段长度/空白 →
400。可见性：AGENT 读草稿（200）、REQUESTER 读草稿（404）、REQUESTER 读已发布（200）、列表只含
已发布、不存在 → 404。生命周期：发布设置 `publishedAt`、重复发布会刷新、**已发布仍可编辑**、归档
保留 `publishedAt`、归档后编辑或发布 → 409、重复归档 → 409、`version` 递增、更新不存在文章 → 404、
REQUESTER 写操作 → 403。搜索：唯一 token 可命中已发布文章、草稿被排除、已归档被排除、缺失/空白/
超长 query → 400。

### `api/test_ai.py` — 9 条

匿名 → 401；缺失、空白、纯空白与超长 `question` 共 4 组参数化 400；无命中返回 200 且
`grounded=false`、`sources` 为空；命中但 AI 未配置返回 503；REQUESTER 与 AGENT 都可提问。

## UI（27）

### `ui/test_login.py` — 5 条

登录成功进入工作台并显示按角色区分导航；密码错误显示 `用户名或密码错误` 且停留在登录页；空表单触发
前端校验；访问受保护路由跳转登录并保留 `redirect`；登出回到登录页。

### `ui/test_ticket_flow.py` — 8 条

REQUESTER 通过表单建单并落到详情页（`待处理`）；空表单被前端校验拦截；REQUESTER 详情页**没有**流转
按钮但有评论框；AGENT 从 `开始处理` 到 `关闭工单`（含确认弹窗）状态正确；AGENT 通过弹窗指派并看到新
负责人；AGENT 添加评论；列表显示新工单；状态筛选写入 URL。

### `ui/test_knowledge.py` — 4 条

AGENT 通过编辑器发布文章并能在搜索中找到；REQUESTER 能找到已发布文章；REQUESTER 没有 `新建文章`
按钮；AGENT 有。

### `ui/test_assistant.py` — 3 条

无命中时显示 `知识库中没有找到足够信息` 与 `创建工单` 入口；命中但 AI 未启用时显示
`AI 服务当前未启用` 与 `提交工单`；Enter 可发送。

### `ui/test_permissions.py` — 7 条

REQUESTER 导航没有 `用户管理` 与 `新建知识文章`；AGENT 有知识写作但没有用户管理；ADMIN 有用户管理；
REQUESTER 访问 `/admin/users` 或 `/knowledge/new` 落到 403；AGENT 可打开编辑器；未知路由渲染 404 页。

## 运行子集

```bash
pytest tests/unit -q                       # 109 条框架测试
pytest tests/api/test_auth.py -v           # 25
pytest tests/api -v                        # 152
pytest tests/ui -v                         # 27
pytest tests -m smoke -q                   # 8
pytest tests -q                            # 288
```
