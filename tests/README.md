# ServiceMind Python automation suite

与 Java `src/main`、`src/test` 并列的**独立 Python 测试工程**：黑盒 HTTP API 测试 + Playwright UI 测试，
直接对真实运行的后端与 MySQL 执行，不 Mock 业务逻辑，不修改应用代码。

- **179 条用例**：API 152 + UI 27
- **三种运行方式**：本地 pytest / Docker Compose / GitHub Actions
- **报告**：Allure（成功率、耗时、步骤、失败堆栈、UI 失败截图）

## 快速开始

```bash
# 1) 后端 + 数据库
docker compose up -d mysql app          # 或已有 MySQL 时直接 java -jar

# 2) Python 环境（3.12 推荐，3.11+ 均可）
python -m venv .venv
.venv\Scripts\activate                   # Windows
pip install -r tests/requirements.txt

# 3) 配置（可选，默认值已能连本地 Compose）
copy tests\.env.example tests\.env

# 4) 运行
pytest tests/api -v                      # 152 条接口用例
pytest tests/ui -v                       # 27 条浏览器用例（需先构建 frontend）
pytest tests -q                          # 全部 179 条
```

UI 测试需要前端构建产物：

```bash
cd frontend && npm ci && npm run build && cd ..
```

## 目录

```
tests/
├── config/settings.py      # 唯一配置入口（env / .env）
├── api/                    # 152 条黑盒接口用例，按业务域拆分
├── ui/                     # 27 条 Playwright 用例
├── fixtures/               # 认证、用户、工单/文章、浏览器与 SPA 服务
├── utils/                  # api_client / assertions / jwt / db / logger / locators / ui_server
├── schemas/                # 响应 jsonschema
├── reports/                # 运行产物（git 忽略）
├── conftest.py             # 路径注入、fixture 汇总、健康门禁、失败截图
├── pytest.ini  requirements.txt  .env.example
```

## 约定

- **数据隔离**：后端没有删除接口，所有对象用 `qa_<run_id>_<时间>_<序号>_<随机>` 命名，只操作本次创建的数据；
  CI 每次使用全新数据库卷。
- **断言粒度**：状态码 + RFC 9457 `title/detail` + 业务字段 + jsonschema，不止断言 200。
  Spring Security 的 401/403 响应体为空，用 `assert_empty_body` 显式验证。
- **不 Mock**：AI 走天然的「无命中 200」与「未配置 503」两条确定性路径，不消耗真实模型额度。
- **可诊断**：断言失败自带响应体；UI 失败自动截图；日志同时写控制台与 `reports/logs/`（目录不可写时自动降级）。

## 文档

- [自动化测试说明](../docs/automation-testing.md)：架构、数据策略、Docker、Allure、CI、排错
- [测试用例清单](../docs/test-cases.md)：179 条用例的分组清单
- [已知问题](../docs/known-issues.md)：测试发现的行为问题与文档不一致
- [项目介绍（求职版）](../docs/portfolio.md)
