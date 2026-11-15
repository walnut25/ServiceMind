# Smart Service 自动化测试

[English](automation-testing.md) | [简体中文](automation-testing.zh-CN.md)

本手册说明 `tests/` 下独立的 Python 测试工程。它从客户端视角验证运行中的应用：真实 HTTP 请求、真实
MySQL 数据库、真实浏览器；不 Mock 业务逻辑，也不引用 Java 内部类。

套件共 **288 条用例**：

- **109 条框架单元测试**（`tests/unit/`），验证测试框架自身，不需要后端、数据库或浏览器；
- **179 条业务测试**：152 条 API、27 条 UI。

## 前置条件

- Python 3.12（3.11、3.13 亦可）
- 已运行的后端与 MySQL：`docker compose up -d mysql app`
- 仅 UI 测试需要 Node 22 与构建好的前端（`frontend/dist`）
- Playwright 浏览器：`python -m playwright install chromium`

所有命令都在仓库根目录执行。

## 1. 目录结构

```text
tests/
├── config/settings.py      # 唯一配置入口（环境变量或 .env）
├── unit/                   # 109 条框架测试：ApiClient、配置、断言、数据工厂、UI fixture
├── api/                    # 152 条黑盒 HTTP 用例，一个文件一个业务域
├── ui/                     # 27 条 Playwright 浏览器用例
├── fixtures/               # 认证、用户、工单/文章、浏览器与 SPA 服务
├── utils/                  # API 客户端、断言、JWT、数据库、日志、定位器、静态服务
├── schemas/                # 响应 JSON schema
├── reports/                # 运行产物（git 忽略）
├── conftest.py             # 路径注入、fixture 汇总、失败截图
├── pytest.ini  requirements.txt  .env.example  README.md
```

## 2. 分层与职责

| 层 | 职责 | 约束 |
| --- | --- | --- |
| `unit/` | 框架自身的契约 | 不走网络、不开浏览器，依赖全部注入 |
| `utils/` | 传输、断言、日志、JWT、SQL、静态服务 | 一个模块一个关注点，不含业务知识 |
| `fixtures/` | 组合可复用的登录态与测试数据 | 登录会话级复用，数据用例级唯一 |
| `api/` | 通过 HTTP 验证业务规则 | 状态码 + RFC 9457 `title`/`detail` + 字段 + schema |
| `ui/` | 验证用户可见行为 | API 造数据，浏览器只验证呈现 |

框架测试是套件自身的安全网：改动 ApiClient、数据工厂或断言工具时，会先在这里失败，而不是等到
业务用例报出一堆难以理解的错误。

## 3. 认证隔离

`ApiClient` 的 token 存在实例上，并在每次请求时单独附加。共享的 `requests.Session` 只携带传输层
默认头（`Accept`、`User-Agent`），**永远不保存 `Authorization`**。因此：

- `with_token()` 返回共享连接池的新客户端，不修改原客户端；
- `without_auth()` 不会把别的客户端的凭据摘掉；
- 并行测试之间不会互相覆盖 token；
- `request(token=...)` 可对单次请求覆盖客户端 token，显式 `headers=` 的优先级最高（用于测试小写
  `bearer` 方案）。

这些保证由 `tests/unit/test_api_client.py` 覆盖。

## 4. 测试数据

后端没有删除接口，因此套件不试图"清理现场"，而是：

- 每个对象都以 `qa_<run_id>_<时间>_<序号>_<随机>` 命名；
- 断言只使用当前用例返回的标识；
- 跨角色场景通过 `user_factory`、`requester_factory` 现场建号；
- CI 与 Docker 每次使用全新的数据库卷（`docker compose down -v` 加独立的 `COMPOSE_PROJECT_NAME`）。

数据库访问是只读的辅助手段：只用来验证 HTTP 响应无法证明的审计行、评论数与 `version`。

## 5. 配置

所有配置都能用环境变量或 `tests/.env` 覆盖。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `API_BASE_URL` | `http://127.0.0.1:8081` | 后端地址；套件会先等待 `/actuator/health` |
| `API_PREFIX` | `/api/v1` | 接口前缀 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `Admin123!` | `AdminBootstrap` 创建的初始管理员 |
| `JWT_SECRET` | 空 | 构造过期/伪造 token 用；为空时相关用例显式跳过 |
| `DB_*` | `127.0.0.1:3307`、`smart_service` | 只读一致性校验 |
| `DB_CHECKS_ENABLED` | `true` | 置 `false` 可跳过数据库断言 |
| `AI_CHAT_ENABLED` | `false` | 决定走确定性的 503 还是 grounded 分支 |
| `QA_RUN_ID` | `local` | 本次运行创建对象的统一前缀 |
| `FRONTEND_DIST` | `<repo>/frontend/dist` | 供浏览器用例访问的构建产物 |
| `UI_PORT` | `8090` | 内置静态服务端口（`0` 表示随机空闲端口） |
| `UI_EXTERNAL_SERVER` | `false` | 改为使用已运行的前端，而不是 `frontend/dist` |
| `UI_BASE_URL` | `http://127.0.0.1:8090` | `UI_EXTERNAL_SERVER=true` 时使用的地址 |
| `UI_BROWSER_CHANNEL` | 空 | 空值使用 Playwright 自带 Chromium；`chrome`/`msedge` 复用系统浏览器 |
| `UI_HEADLESS` | `true` | 无头模式 |
| `UI_SCREENSHOTS` | `true` | UI 用例失败时自动截图 |
| `QA_LOG_DIR` / `QA_SCREENSHOT_DIR` | `tests/reports/...` | 只读检出时把运行产物指到可写目录 |

## 6. 本地运行

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r tests/requirements.txt
python -m playwright install chromium

docker compose up -d mysql app
cd frontend; npm ci; npm run build; cd ..
```

运行套件：

```powershell
pytest tests/unit -q                     # 109 条框架测试，无需后端
pytest tests/api -v                      # 152 条 API 用例
pytest tests/api/test_tickets.py -v      # 单个模块
pytest tests/ui -v                       # 27 条 UI 用例
pytest tests -q                          # 全部 288 条
pytest tests -m smoke -q                 # 8 条关键路径用例
```

预期结果：

```text
288 passed
```

### 并行执行

`tests/unit` 与 `tests/api` 可以安全并行。只有一条 API 用例不行：`TestMetrics` 用六次独立查询拼出
同一个响应，并发写入会打破 `sum(byStatus) == total`。它被标记为 `serial`，一旦被 xdist worker
收集就会**硬失败**，因此并行运行绝不会悄悄跳过它。分两阶段执行：

```powershell
pytest tests/api -m "not serial" -n auto   # 151 条
pytest tests/api -m serial                 # 1 条，单独执行
pytest tests/unit -n auto                  # 框架测试
```

UI 用例默认使用 Playwright 自带 Chromium。要复用已安装的浏览器：

```powershell
$env:UI_BROWSER_CHANNEL = "chrome"       # 或 "msedge"
```

要测试已运行的前端（例如 nginx 容器）：

```powershell
$env:UI_EXTERNAL_SERVER = "true"
$env:UI_BASE_URL = "http://127.0.0.1:8085"
pytest tests/ui -q
```

要启用过期与伪造 token 用例，用已知密钥启动后端，并把同一个值给测试进程：

```powershell
$env:JWT_SECRET = "qa-local-jwt-secret-at-least-32-bytes-long"
$env:JWT_ACCESS_TOKEN_TTL = "30m"
```

## 7. Docker 运行

`compose.test.yaml` 固定测试配置，并增加一个按需启动的运行容器；它不修改应用镜像。

```bash
docker compose -f compose.yaml -f compose.test.yaml up -d mysql app
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm pytest
docker compose -f compose.yaml -f compose.test.yaml down -v
```

容器网络内通过 `http://app:8081` 与 `mysql:3306` 访问，Allure 结果写到宿主机的
`allure-results/`。

## 8. Allure 报告

```bash
pytest tests/api --alluredir=allure-results
allure serve allure-results
allure generate allure-results -o allure-report --clean
```

报告包含总数、成功/失败/跳过、耗时、用例名与步骤、失败堆栈；UI 用例失败时保留截图与浏览器日志。
`allure` 命令需要 Java 8+，`allure-commandline` 不是 Python 依赖。CI 会把四个测试 Job 的结果合并、
生成 HTML 并作为 `allure-report` 产物发布，不需要本地运行即可打开。

## 9. 持续集成

`.github/workflows/python-tests.yml` 与既有 `ci.yml` 并行，且不修改它。三个独立 Job 保证 UI 失败
不会掩盖 API 或单元测试结果。

| Job | 步骤 | 产物 |
| --- | --- | --- |
| `python-unit-test` | 安装依赖 → `pytest tests/unit -n auto` | Allure 结果 |
| `python-api-test` | 构建后端镜像 → 起 MySQL 与应用 → 等健康 → 并行 `pytest tests/api -m "not serial" -n auto`，再跑 `pytest tests/api -m serial` | Allure 结果、测试日志 |
| `python-ui-prod-test` | 构建前后端镜像 → `docker compose up -d --wait` → 校验 SPA/深链/API 代理 → 对 nginx 跑完整 `pytest tests/ui` | Allure 结果、失败截图与日志 |
| `allure-report` | 汇总所有 `allure-results-*` 产物并生成 HTML 报告 | `allure-report` 产物 |
| `deploy-report` | 在 `main` 的 push 上把报告发布到 GitHub Pages | Pages 站点 |

UI 用例每轮只执行一次，跑在 nginx 提供的生产构建上。内置静态服务只是本地测试脚手架，因此改用
12 条单元测试覆盖，不再占用一个浏览器 Job。依赖容器的 Job 失败时会打印容器日志，并且总是用
`docker compose down -v` 收尾。

## 10. 生产前端回归

`python-ui-test` 用内置静态服务提供 `frontend/dist`，让浏览器测试保持快速且不依赖 Docker；
`python-ui-prod-test` 覆盖另一半：真正部署的镜像（`frontend/Dockerfile` → `nginx:1.27-alpine`，
配置在 `frontend/nginx.conf`）。

该 Job 会：

1. 用 `docker compose build` 构建 `app` 与 `frontend`；
2. 用 `docker compose up -d --wait --wait-timeout 240` 启动整套栈，依赖三个服务各自的健康检查
   （前端健康检查是本次新增的）；
3. 断言 nginx 能提供 SPA、`/tickets/1` 会回退到 `index.html`、`/actuator/health` 被代理到后端；
4. 用 `UI_EXTERNAL_SERVER=true` 和 `UI_BASE_URL=http://127.0.0.1:8085` 运行同一套 27 条 UI 用例，
   两个 Job 之间没有任何测试代码差异。

内置静态服务不属于部署产物，因此不再用浏览器 Job 验证；改用 12 条单元测试覆盖它的静态服务、历史
回退与代理行为。完整 27 条跑在真正部署的产物上，生成的报告会在 `main` 上发布到 GitHub Pages。

## 故障排查

### 后端一直不健康

套件会以退出码 3 结束，而不是抛出几十条连接错误。用 `docker compose logs app` 查看 Flyway 或
MySQL 连接问题。

### 浏览器无法启动

套件会打印实际尝试的浏览器与安装方法。执行 `python -m playwright install chromium`，或设置
`UI_BROWSER_CHANNEL=chrome` 复用已安装的 Chrome；通道名错误或系统浏览器缺失都会给出同样清晰的提示。

### 杀毒软件隔离了浏览器文件

企业杀软常把 Chromium 二进制误判为启发式威胁（例如 `chrome.dll`），导致浏览器安装不完整、UI 套件
无法启动。把 Playwright 浏览器目录加入杀软排除项——设置了 `PLAYWRIGHT_BROWSERS_PATH` 时用它，否则
是 `%LOCALAPPDATA%\ms-playwright`——再执行 `python -m playwright install chromium --force` 重装。

### 401 / 403 响应没有 JSON 体

这是应用的真实行为：没有注册自定义 `AuthenticationEntryPoint` 或 `AccessDeniedHandler`，
Spring Security 返回空响应体。`assert_empty_body` 对此做了显式断言。

### 搜索类用例结果为空

MySQL 全文索引默认 `innodb_ft_min_token_size=3`。使用至少 3 个字符的唯一检索词，fixture 已经这样处理。

### 时间戳差几微秒

API 序列化纳秒级 `Instant`，MySQL 存 `TIMESTAMP(6)`，往返会舍入到微秒，因此时间断言带容差。

### 只读检出下截图或日志缺失

把 `QA_SCREENSHOT_DIR` 与 `QA_LOG_DIR` 指向可写目录。默认位置无法创建时，套件会记录警告并继续运行。

## 验收清单

- `pytest tests/unit` 在没有任何服务时通过
- `pytest tests/api` 对运行中的后端通过
- `pytest tests/ui` 在已构建前端与已安装浏览器下通过
- `pytest tests -m smoke` 保持通过
- `docker compose down -v` 不残留测试容器
- Allure 结果已生成且控制台无报错
- 没有提交密钥、`.env` 或 `tests/reports/` 内容
