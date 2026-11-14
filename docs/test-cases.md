# 测试用例清单

共 **179** 条：API 152 条、UI 27 条。用例按业务域分组，命名即意图（`test_<行为>_<预期>`）。

## API（152）

### `api/test_auth.py` — 25 条

| 分组 | 覆盖点 |
| --- | --- |
| 登录成功（4） | 返回 `Bearer` + `accessToken` + `expiresAt`；JWT claims（`iss`/`sub`/`scope`/`exp>iat`）；用户名大小写不敏感且 `sub` 用库中规范大小写；token 可访问受保护端点 |
| 登录失败（8） | 密码错误 401 且不泄露用户是否存在；不存在用户与密码错误响应一致；禁用账号 401；缺失/空白密码、用户名、空 body 共 5 组参数化 400 |
| Token 校验（9） | 无 token 401 + 空响应体 + `WWW-Authenticate`；非 JWT 401；篡改签名 401；`Basic` 方案 401；小写 `bearer` 可用；query 参数传 token 被拒；过期 token 401；无 `scope` 时「认证通过但业务 403、actuator 200」；已知风险：合法密钥伪造不存在用户的 token 被接受 |
| 角色边界（4） | REQUESTER/AGENT 列用户 403 且空体；REQUESTER 读指标 403；ADMIN 列用户 200 且分页信封正确 |

### `api/test_users.py` — 19 条

| 分组 | 覆盖点 |
| --- | --- |
| 创建（11） | 201 响应字段；创建后即可登录；用户名唯一（大小写不敏感冲突 409）；用户名 2/101 字符、非法字符、密码 11/73 字符、空角色共 6 组参数化 400；未知角色枚举 400；AGENT/REQUESTER 创建用户 403 |
| 查询（4） | 按 ID 200；不存在 404；分页 size 生效；`/users/assignees` 只含启用的 ADMIN/AGENT |
| 账号状态（4） | 禁用后登录 401、重新启用后 200；管理员不能禁用自己（409）；禁用不存在用户 404；缺少 `enabled` 字段 400 |

### `api/test_tickets.py` — 49 条

| 分组 | 覆盖点 |
| --- | --- |
| 创建（13） | P1/P2/P3/P4 各自 `dueAt = createdAt + 4h/8h/24h/72h`；`requester` 取自 token（body 中同名字段被忽略）；新单 `ON_TRACK`、`assignee` 为空、`version=0`；AGENT 也可建单；5 组非法载荷 400；200/10000 字符边界 201 |
| 读取（4） | 详情 200；不存在 404；REQUESTER 读他人工单 404（不泄露存在性）；REQUESTER 列表只含自己的工单 |
| 过滤（5） | 列表分页信封；优先级过滤；状态随流转变化；负责人过滤大小写不敏感；新单不在 `slaBreached=true` 中 |
| 指标（1） | 字段 schema；`byStatus`/`byPriority` 包含全部枚举键且 `sum(byStatus)=total`、`active=OPEN+IN_PROGRESS` |
| 状态机（18） | 4 条合法路径参数化；解决设置 `resolvedAt` 且 SLA `MET`；重开清空 `resolvedAt`；8 条非法流转 409 且 `detail` 含 `cannot transition`；REQUESTER 流转 403；不存在工单 404；缺 `status` 400；未知状态值 400 |
| 指派（8） | 指派成功；首尾空格被 strip；指派 REQUESTER 422；不存在用户 422；**非法 assignee 优先于 404**；合法 assignee + 不存在工单 404；空白 assignee 400；REQUESTER 指派 403 |

### `api/test_comments.py` — 12 条

添加评论 201 且作者取自 token（REQUESTER/AGENT 两种）；内容 0/空白/10000/10001 四组边界；他人票据评论 404；
不存在工单 404；列表按 `createdAt` 升序；**评论不改变工单 `updatedAt`**；已关闭工单仍可评论；
数据库评论行数与 API `totalElements` 一致。

### `api/test_audit.py` — 8 条

建单产生 `TICKET_CREATED` 且 `details` 精确匹配；完整生命周期产生 4 类事件且默认 DESC 排序；
`ASSIGNEE_CHANGED` / `STATUS_CHANGED` 的 `details` 原文；不同事件记录各自 actor；
**非法流转不写审计**；REQUESTER 读审计 403；不存在工单 404；数据库事件顺序与 API 一致。

### `api/test_knowledge.py` — 30 条

创建 201 且 `DRAFT`/`publishedAt=null`/`version=0`；REQUESTER 创建 403；8 组字段长度/空白参数化 400；
可见性：AGENT 读草稿 200、REQUESTER 读草稿 404、REQUESTER 读已发布 200、列表只含 PUBLISHED、不存在 404；
生命周期：发布设置 `publishedAt`、重复发布刷新、**已发布仍可编辑**、归档保留 `publishedAt`、
归档后编辑/发布 409、重复归档 409、`version` 递增、更新不存在 404、REQUESTER 写操作 403；
搜索：唯一 token 命中已发布、不返回草稿、不返回已归档、缺/空/超长 query 400。

### `api/test_ai.py` — 9 条

匿名 401；缺/空/纯空白/超长 question 4 组 400；无命中 200 且 `grounded=false`、`sources=[]`；
命中已发布文章但 AI 未配置 503；REQUESTER 与 AGENT 均可提问。

## UI（27）

### `ui/test_login.py` — 5 条

登录成功进入工作台并看到角色菜单；密码错误显示「用户名或密码错误」且停留登录页；
空表单触发前端校验；访问受保护路由跳转登录并保留 `redirect`；登出回到登录页。

### `ui/test_ticket_flow.py` — 8 条

REQUESTER 通过表单建单并落到详情页（状态「待处理」）；空表单被前端校验拦截；
REQUESTER 详情页**没有**流转按钮但有评论框；AGENT「开始处理 → 关闭工单（含二次确认）」状态正确；
AGENT 通过弹窗指派负责人并回显；AGENT 添加评论可见；列表页显示新单；状态筛选写入 URL。

### `ui/test_knowledge.py` — 4 条

AGENT 通过编辑器「保存并发布」并在搜索中验证；REQUESTER 能搜到已发布文章；
REQUESTER 看不到「新建文章」；AGENT 能看到。

### `ui/test_assistant.py` — 3 条

无命中时显示「知识库中没有找到足够信息」并提供「创建工单」入口；
命中但 AI 未启用时显示「AI 服务当前未启用」并提供「提交工单」；Enter 可发送。

### `ui/test_permissions.py` — 7 条

REQUESTER 菜单无「用户管理/新建知识文章」；AGENT 有知识库写作但无用户管理；ADMIN 有用户管理；
REQUESTER 访问 `/admin/users` 与 `/knowledge/new` 跳 403；AGENT 可进编辑器；未知路由显示 404 页。

## 运行对应关系

```bash
pytest tests/api/test_auth.py -v           # 25
pytest tests/api -v                        # 152
pytest tests/ui -v                         # 27
pytest tests -q                            # 179
```
