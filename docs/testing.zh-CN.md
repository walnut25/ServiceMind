# Smart Service 测试手册

[English](testing.md) | [简体中文](testing.zh-CN.md)

本手册说明项目在演示或提交前采用的完整验证流程：先执行隔离的快速测试，再连接真实 MySQL，
最后通过公开 HTTP API 验证完整端到端业务流程。

## 前置条件

- JDK 21
- 首次运行 Maven Wrapper 时可访问网络，用于下载固定版本 Maven 3.9.11
- Docker Desktop 已启动，Docker 引擎正在运行
- PowerShell 5.1 或更高版本，用于自动化冒烟测试

以下命令均在项目根目录执行。

## 1. 快速测试

```powershell
.\mvnw.cmd clean test
```

该命令运行 30 项单元、领域和 MockMvc API/安全测试，不需要 Docker。

预期结果：

```text
Tests run: 30, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## 2. 完整自动化测试

先启动 Docker Desktop，然后运行：

```powershell
.\mvnw.cmd verify -Pintegration
```

集成测试配置会通过 Testcontainers 启动 MySQL 8.4，并额外运行 3 项测试。Flyway 会执行真实
迁移，测试会验证数据持久化、角色存储、乐观锁和全文搜索。因此完整测试共 33 项。

## 3. 端到端系统测试

冒烟测试会构建生产 Docker 镜像，启动应用和 MySQL，等待健康检查通过，然后分别以管理员、
坐席和请求人的身份验证：

- JWT 登录和用户管理
- 基于角色的访问控制与请求人工单隔离
- 工单创建、指派、状态流转、评论和审计历史
- 知识文章草稿、发布和 MySQL 全文搜索
- 账号禁用和登录拒绝

运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -MysqlPort 3307 -StopAfter
```

使用 `3307` 可以避开本机已有 MySQL 占用 `3306` 的常见冲突。如果想在测试结束后保留应用用于
演示，请去掉 `-StopAfter`。成功时结尾会显示：

```text
SMART SERVICE END-TO-END SMOKE TEST PASSED
```

脚本每次都会生成唯一用户名和内容，因此可以在同一套本地数据库上重复运行。也可以传入自定义
端口和管理员凭据：

```powershell
.\scripts\smoke-test.ps1 `
  -MysqlPort 3307 `
  -ServerPort 8082 `
  -AdminUsername admin `
  -AdminPassword "Admin123!"
```

## 4. 使用 Swagger 手动测试 API

保持容器运行，打开 [Swagger UI](http://localhost:8081/swagger-ui.html)。

1. 调用 `POST /api/v1/auth/login`，使用 `admin` / `Admin123!` 登录。
2. 复制响应中的 `accessToken`。
3. 点击 **Authorize**，输入 `Bearer <accessToken>`。
4. 在 **Users** 下创建坐席和请求人。
5. 在 **Tickets** 下创建、指派、流转工单并添加评论。
6. 调用工单审计接口，确认对应的 4 类审计事件。
7. 在 **Knowledge** 下创建并发布文章，然后搜索文章中的关键词。

常用运行检查：

- 健康检查：[http://localhost:8081/actuator/health](http://localhost:8081/actuator/health)
- OpenAPI JSON：[http://localhost:8081/v3/api-docs](http://localhost:8081/v3/api-docs)
- 容器状态：`docker compose ps`
- 应用日志：`docker compose logs -f app`

## 5. 可选的真实 AI 供应商测试

默认测试套件不会调用付费且结果不确定的外部 AI。知识检索、提示词构造、降级行为和供应商响应
映射均由本地自动化测试覆盖。

如需执行一次真实调用，请在启动 Compose 前设置 OpenAI 兼容 API 密钥：

```powershell
$env:AI_CHAT_ENABLED = "true"
$env:AI_API_KEY = "your-api-key"
$env:AI_BASE_URL = "https://api.deepseek.com"
$env:AI_MODEL = "deepseek-chat"
docker compose up -d --build
```

先发布一篇相关知识文章，登录后调用 `POST /api/v1/ai/answers`：

```json
{"question":"How do I troubleshoot the VPN connection?"}
```

响应中的 `grounded` 应为 `true`，并包含来源文章。不要提交 `.env` 或任何 API 密钥。

## 故障排查

### 端口已被占用

使用其他宿主机端口：

```powershell
$env:MYSQL_PORT = "3307"
$env:SERVER_PORT = "8082"
docker compose up -d --build
```

### 修改凭据后管理员无法登录

只有数据库为空时，系统才会创建初始管理员。现有 Docker 卷会保留原来的密码。可以使用原凭据，
或者在确认本地数据可以删除后重置数据库：

```powershell
docker compose down -v
```

该命令会永久删除本项目的本地数据库卷。

### Docker 测试无法连接

确认 Docker Desktop 显示引擎正在运行，然后检查 `docker version` 和 `docker info`。

### 构建成功但出现警告

Mockito 可能提示 Java Agent 动态挂载，Flyway 也可能提示当前 MySQL 8.4 小版本尚未被明确验证。
只要构建成功且失败、错误数量均为零，这些提示就不是阻断问题；真正的测试失败仍必须处理。

## 发布前检查清单

- `.\mvnw.cmd clean test` 通过
- Docker 运行时，`.\mvnw.cmd verify -Pintegration` 通过
- `scripts/smoke-test.ps1` 报告成功
- Swagger UI 可以打开，健康端点返回 `UP`
- 没有暂存密钥或 `.env` 文件
- `git diff --check` 没有空白错误
- README、架构说明和 API 实际行为保持一致
