# 自动化测试工程说明

本目录（`tests/`）是与 Java 后端、React 前端并列的**独立 Python 测试工程**，只通过公开 HTTP 接口和浏览器
访问系统，不引用任何 Java 内部类，也不修改业务代码。

- 用例总数：**179**（API 152 + UI 27）
- 覆盖范围：认证与 Token、用户、工单状态机、评论、审计、知识库、AI 助手、权限矩阵、浏览器端主流程
- 执行方式：本地 pytest、Docker Compose、GitHub Actions 三种

## 1. 目录结构

```
tests/
├── config/settings.py        # 唯一的配置入口（环境变量 / .env）
├── api/                      # 黑盒 HTTP 测试，一个文件一个业务域
│   ├── test_auth.py          # 登录、Token 校验、角色边界
│   ├── test_users.py         # 用户创建/查询/禁用、重复用户名、参数校验
│   ├── test_tickets.py       # 创建、SLA、过滤、状态机、指派
│   ├── test_comments.py      # 评论作者、排序、可见性、幂等副作用
│   ├── test_audit.py         # 四类审计事件、排序、数据库交叉校验
│   ├── test_knowledge.py     # 文章生命周期、可见性、全文搜索
│   └── test_ai.py            # 参数校验、grounded 语义、未配置 503
├── ui/                       # Playwright 浏览器测试
│   ├── test_login.py         # 登录成功/失败/校验/重定向/登出
│   ├── test_ticket_flow.py   # 建单→详情→指派→流转→评论
│   ├── test_knowledge.py     # 文章发布与检索
│   ├── test_assistant.py     # AI 未命中与未启用两条确定性路径
│   └── test_permissions.py   # 角色菜单差异与路由守卫
├── fixtures/                 # 认证、用户、工单/文章、UI 浏览器与 SPA 服务
├── utils/
│   ├── api_client.py         # 统一基址/超时/鉴权/日志/耗时
│   ├── assertions.py         # ProblemDetail、分页信封、jsonschema、业务字段
│   ├── jwt_utils.py          # 自签 HS256 token（构造过期/篡改/无 scope）
│   ├── db_helper.py          # 只读 PyMySQL，补 API 观察不到的断言
│   ├── data_factory.py       # 全局唯一命名的测试数据
│   ├── ui_locators.py        # 兼容 antd「登 录」空格问题的定位器
│   ├── ui_server.py          # 静态站点 + /api 反向代理（替代 nginx/vite）
│   └── logger.py             # 控制台 + 文件日志（目录不可写时自动降级）
├── schemas/definitions.py    # 9 个响应 DTO 的 jsonschema
├── conftest.py               # 路径注入、fixture 汇总、健康门禁、失败截图
├── pytest.ini  requirements.txt  .env.example  README.md
└── reports/                  # 运行产物（git 忽略）
```

## 2. 分层设计

| 层 | 作用 | 原则 |
| --- | --- | --- |
| `utils/` | 与业务无关的能力 | 请求、断言、日志、JWT、DB、静态服务各自独立 |
| `fixtures/` | 组合出可用的登录态与数据 | 会话级登录只做一次；用例级数据唯一命名 |
| `api/` | 业务规则断言 | 状态码 + RFC 9457 `title/detail` + 业务字段 + schema |
| `ui/` | 用户可见行为 | 只覆盖核心链路，API 负责造数据，UI 负责验证呈现 |

**不做的事**：不 Mock 后端、不跳过失败用例、不用固定 `sleep` 掩盖同步问题、不为了通过而放宽断言。

## 3. 数据管理策略

- 后端没有删除接口，因此**不追求"清空数据"**，而是保证「只碰自己创建的对象」：
  - 用户名、工单标题、文章标题都带 `qa_<run_id>_<时间>_<序号>_<随机>` 后缀；
  - 断言使用本次创建对象的 `id`，不依赖固定 ID；
  - 需要跨角色验证时，用 `user_factory` / `requester_factory` 现场建号。
- CI 与 Docker 场景每次用**全新的 MySQL 卷**（`docker compose down -v` + 每次 run 独立 `COMPOSE_PROJECT_NAME`），
  从根上避免历史数据干扰。
- 数据库只做**只读**辅助断言（审计行、评论数、`version`），不绕过 API 写数据。

## 4. 配置项

所有配置都能用环境变量覆盖（也支持 `tests/.env`）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `API_BASE_URL` | `http://127.0.0.1:8081` | 后端地址，测试会自动等待 `/actuator/health` |
| `API_PREFIX` | `/api/v1` | 接口前缀 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `Admin123!` | `AdminBootstrap` 创建的初始管理员 |
| `JWT_SECRET` | 空 | 用于构造过期/伪造 token；为空时这组用例**显式 skip** |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` | `127.0.0.1` / `3307` / `smart_service` / ... | 只读校验用 |
| `DB_CHECKS_ENABLED` | `true` | 关掉后 DB 相关用例 skip |
| `AI_CHAT_ENABLED` | `false` | 决定走 503 还是走 grounded 分支 |
| `QA_RUN_ID` | `local` | 数据唯一前缀 |
| `FRONTEND_DIST` | `<repo>/frontend/dist` | UI 测试要服务的构建产物 |
| `UI_BROWSER_CHANNEL` | `chrome` | 复用系统 Chrome；置空则用 Playwright 自带 Chromium |
| `UI_HEADLESS` | `true` | 无头模式 |
| `UI_SCREENSHOTS` | `true` | 失败自动截图 |

## 5. 本地运行

```powershell
# 0) 依赖：JDK 21 + Python 3.12（或 3.13）+ Node 22（仅 UI 测试需要）
python -m venv .venv
.venv\Scripts\activate
pip install -r tests/requirements.txt

# 1) 起后端（Compose 最省事）
docker compose up -d mysql app

# 2) 起前端构建产物（UI 测试用内置静态服务器，不需要 nginx）
cd frontend; npm ci; npm run build; cd ..

# 3) 跑测试
pytest tests/api -v                      # 152 条 API 用例
pytest tests/api/test_tickets.py -v      # 单个模块
pytest tests/ui -v                       # 27 条 UI 用例
pytest tests -q                          # 全部 179 条
```

可选：让后端暴露固定密钥，激活「过期/伪造 token」用例：

```powershell
$env:JWT_SECRET = "qa-local-jwt-secret-at-least-32-bytes-long"
$env:JWT_ACCESS_TOKEN_TTL = "30m"
```

## 6. Docker 运行

```bash
# 只起依赖栈
docker compose -f compose.yaml -f compose.test.yaml up -d mysql app

# 在容器里跑 API 测试（无需本机 Python）
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm pytest

# 结束后清理
docker compose -f compose.yaml -f compose.test.yaml down -v
```

容器内通过服务名访问（`http://app:8081`、`mysql:3306`），结果写到宿主机 `allure-results/`。

## 7. Allure 报告

```bash
pytest tests/api --alluredir=tests/reports/allure-results
allure serve tests/reports/allure-results          # 本地实时预览
allure generate tests/reports/allure-results -o tests/reports/allure-report --clean
```

报告包含：用例总数/成功/失败/跳过、耗时、用例名与步骤、失败堆栈；UI 用例失败时同时保留截图与控制台日志。
`allure-commandline` 需要 Java 8+，CI 中可用 `simple-elf/allure-report-action` 或 `allure generate` 生成后上传。

## 8. GitHub Actions

新增独立工作流 `.github/workflows/python-tests.yml`，与现有 `ci.yml` **并行且互不影响**：

| Job | 内容 | 产物 |
| --- | --- | --- |
| `api-tests` | 构建后端镜像 → 起 mysql+app → 等健康 → `pytest tests/api` | `allure-results-api`、`api-test-logs` |
| `ui-tests` | 安装 Chromium → 构建前端 → 起 mysql+app → `pytest tests/ui` | `allure-results-ui`、失败截图与日志 |

失败时自动 `docker compose logs` 并 `down -v`；两个 Job 互不阻塞，后端结果不会被 UI 失败掩盖。

## 9. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `Backend did not become healthy` | 后端未起或端口不对；`docker compose logs app` 看 Flyway/MySQL 连接 |
| 401/403 断言拿不到 JSON | 这是设计：Spring Security 的 401/403 响应体为空，`assert_empty_body` 专门验证 |
| 搜索类用例偶发为空 | MySQL 全文索引默认 `innodb_ft_min_token_size=3`，检索词需 ≥3 字符且足够独特 |
| UI 用例报 `Executable doesn't exist` | 本机没装 Playwright 浏览器：`UI_BROWSER_CHANNEL=chrome` 复用系统 Chrome，或 `python -m playwright install chromium` |
| 时间断言差几微秒 | API 输出纳秒 `Instant`，MySQL 存 `TIMESTAMP(6)`，往返会舍入到微秒，断言应带容差 |
| 本机 Windows 沙箱里 UI 测试起不来 | Playwright 需要带管道的子进程，受限令牌下会失败；用普通（非受限）终端或 CI 运行 |
| --alluredir 报 Permission denied | 该目录属于构建产物且可能被其他工具占用了 ACL；把结果目录指到可写位置，例如 --alluredir=D:\tmp\allure-results |
