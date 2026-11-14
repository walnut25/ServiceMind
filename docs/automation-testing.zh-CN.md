# Smart Service 自动化测试

[English](automation-testing.md) | [简体中文](automation-testing.zh-CN.md)

本手册说明 `tests/` 下独立的 Python 测试工程。它从客户端视角验证运行中的应用：真实 HTTP 请求、真实
MySQL 数据库、真实浏览器；不 Mock 业务逻辑，也不引用 Java 内部类。

套件共 **179 条用例**：152 条 API、27 条 UI。

## 前置条件

- Python 3.12（3.11、3.13 亦可）
- 已运行的后端与 MySQL：`docker compose up -d mysql app`
- 仅 UI 测试需要 Node 22 与构建好的前端（`frontend/dist`）
- Chromium 内核浏览器，或 Playwright 自带的 Chromium

所有命令都在仓库根目录执行。

## 1. 目录结构

```text
tests/
├── config/settings.py      # 唯一配置入口（环境变量或 .env）
├── api/                    # 152 条黑盒 HTTP 用例，一个文件一个业务域
├── ui/                     # 27 条 Playwright 浏览器用例
├── fixtures/               # 认证、用户、工单/文章、浏览器与 SPA 服务
├── utils/                  # API 客户端、断言、JWT、数据库、日志、定位器、静态服务
├── schemas/                # 响应 JSON schema
├── reports/                # 运行产物（git 忽略）
├── conftest.py             # 路径注入、fixture 汇总、健康门禁、失败截图
├── pytest.ini  requirements.txt  .env.example  README.md
```

## 2. 分层与职责

| 层 | 职责 | 约束 |
| --- | --- | --- |
| `utils/` | 传输、断言、日志、JWT、SQL、静态服务 | 一个模块一个关注点，不含业务知识 |
| `fixtures/` | 组合可复用的登录态与测试数据 | 登录会话级复用，数据用例级唯一 |
| `api/` | 通过 HTTP 验证业务规则 | 状态码 + RFC 9457 `title`/`detail` + 字段 + schema |
| `ui/` | 验证用户可见行为 | API 造数据，浏览器只验证呈现 |

断言是分层的：单独一个 HTTP 200 永远不会让用例通过。

## 3. 测试数据

后端没有删除接口，因此套件不试图"清理现场"，而是：

- 每个对象都以 `qa_<run_id>_<时间>_<序号>_<随机>` 命名；
- 断言只使用当前用例返回的标识；
- 跨角色场景通过 `user_factory`、`requester_factory` 现场建号；
- CI 与 Docker 每次使用全新的数据库卷（`docker compose down -v` 加独立的 `COMPOSE_PROJECT_NAME`）。

数据库访问是只读的辅助手段：只用来验证 HTTP 响应无法证明的审计行、评论数与 `version`。

## 4. 配置

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
| `UI_BROWSER_CHANNEL` | `chrome` | 复用已安装浏览器；置空使用自带 Chromium |
| `UI_HEADLESS` | `true` | 无头模式 |
| `UI_SCREENSHOTS` | `true` | UI 用例失败时自动截图 |

## 5. 本地运行

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r tests/requirements.txt

docker compose up -d mysql app
cd frontend; npm ci; npm run build; cd ..
```

运行套件：

```powershell
pytest tests/api -v                      # 152 条 API 用例
pytest tests/api/test_tickets.py -v      # 单个模块
pytest tests/ui -v                       # 27 条 UI 用例
pytest tests -q                          # 全部 179 条
```

预期结果：

```text
179 passed
```

要启用过期与伪造 token 用例，用已知密钥启动后端，并把同一个值给测试进程：

```powershell
$env:JWT_SECRET = "qa-local-jwt-secret-at-least-32-bytes-long"
$env:JWT_ACCESS_TOKEN_TTL = "30m"
```

## 6. Docker 运行

`compose.test.yaml` 固定测试配置，并增加一个按需启动的运行容器；它不修改应用镜像。

```bash
docker compose -f compose.yaml -f compose.test.yaml up -d mysql app
docker compose -f compose.yaml -f compose.test.yaml --profile test run --rm pytest
docker compose -f compose.yaml -f compose.test.yaml down -v
```

容器网络内通过 `http://app:8081` 与 `mysql:3306` 访问，Allure 结果写到宿主机的
`allure-results/`。

## 7. Allure 报告

```bash
pytest tests/api --alluredir=allure-results
allure serve allure-results
allure generate allure-results -o allure-report --clean
```

报告包含总数、成功/失败/跳过、耗时、用例名与步骤、失败堆栈；UI 用例失败时保留截图与浏览器日志。
`allure` 命令需要 Java 8+，`allure-commandline` 不是 Python 依赖。

## 8. 持续集成

`.github/workflows/python-tests.yml` 与既有 `ci.yml` 并行，且不修改它。两个独立 Job 保证 UI 失败
不会掩盖 API 结果。

| Job | 步骤 | 产物 |
| --- | --- | --- |
| `python-api-test` | 构建后端镜像 → 起 MySQL 与应用 → 等健康 → `pytest tests/api` | Allure 结果、测试日志 |
| `python-ui-test` | 安装 Chromium → 构建前端 → 起 MySQL 与应用 → `pytest tests/ui` | Allure 结果、失败截图与日志 |

两个 Job 失败时都会打印容器日志，并且总是用 `docker compose down -v` 收尾。

## 故障排查

### 后端一直不健康

套件会以退出码 3 结束，而不是抛出几十条连接错误。用 `docker compose logs app` 查看 Flyway 或
MySQL 连接问题。

### 401 / 403 响应没有 JSON 体

这是应用的真实行为：没有注册自定义 `AuthenticationEntryPoint` 或 `AccessDeniedHandler`，
Spring Security 返回空响应体。`assert_empty_body` 对此做了显式断言。

### 搜索类用例结果为空

MySQL 全文索引默认 `innodb_ft_min_token_size=3`。使用至少 3 个字符的唯一检索词，fixture 已经这样处理。

### Playwright 报 `Executable doesn't exist`

安装浏览器（`python -m playwright install chromium`），或用 `UI_BROWSER_CHANNEL=chrome` 复用已安装的浏览器。

### 时间戳差几微秒

API 序列化纳秒级 `Instant`，MySQL 存 `TIMESTAMP(6)`，往返会舍入到微秒，因此时间断言带容差。

### 受限终端里 UI 测试起不来

Playwright 会以带管道的 stdio 启动 Node 驱动，受限令牌可能拦截。请在普通终端或 CI 中运行 UI 套件。

## 验收清单

- `pytest tests/api` 对运行中的后端通过
- `pytest tests/ui` 在已构建前端下通过
- `docker compose down -v` 不残留测试容器
- Allure 结果已生成且控制台无报错
- 没有提交密钥、`.env` 或 `tests/reports/` 内容
