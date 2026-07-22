# ServiceMind Frontend

ServiceMind 智能服务管理平台前端，基于 React + TypeScript + Vite 构建。

## 功能

- 用户认证与 JWT 鉴权
- 三种角色：管理员、客服、普通用户，不同导航与权限
- 工单管理：创建、查看、分配、状态流转、评论、审计
- 知识库：Markdown 文章编写、发布、归档、搜索
- AI 助手：基于知识库的智能问答，引用来源
- 用户管理：管理员创建、启用/禁用用户
- 响应式布局：桌面端侧边栏 + 移动端抽屉

## 技术栈

- React 19 + TypeScript 5.7
- Vite 6
- Ant Design 5 + @ant-design/icons
- React Router 7
- TanStack Query 5
- Zustand 5
- React Hook Form + Zod
- Axios
- react-markdown + remark-gfm + rehype-sanitize
- Vitest + React Testing Library
- Playwright (E2E)

## 目录结构

```
frontend/
├── src/
│   ├── api/            # Axios 实例与接口请求
│   ├── assets/         # 静态资源
│   ├── components/
│   │   └── common/     # 通用组件
│   ├── hooks/          # TanStack Query hooks
│   ├── layouts/        # AppLayout（侧边栏 + 头部）
│   ├── pages/
│   │   ├── admin/      # 用户管理
│   │   ├── assistant/  # AI 助手
│   │   ├── dashboard/  # 工作台
│   │   ├── errors/     # 403 / 404
│   │   ├── knowledge/  # 知识库列表 / 详情 / 编辑
│   │   ├── login/      # 登录页
│   │   └── tickets/    # 工单列表 / 新建 / 详情
│   ├── router/         # 路由配置 + AuthGuard + RoleGuard
│   ├── stores/         # Zustand 状态
│   ├── types/          # TypeScript 类型
│   └── utils/          # 工具函数
├── Dockerfile          # 多阶段构建 (Node + Nginx)
├── nginx.conf          # Nginx SPA 配置 + API 代理
├── .env.example        # 环境变量模板
├── vite.config.ts      # Vite 配置 + 路径别名
├── vitest.config.ts    # Vitest 配置
└── playwright.config.ts
```

## 本地启动

```bash
# 安装依赖
npm install

# 启动开发服务器 (默认 http://localhost:5173)
npm run dev

# API 代理到后端 (vite.config.ts 中配置)
# 默认代理 /api -> http://localhost:8081
```

## Docker 启动

```bash
# 在仓库根目录执行
docker compose up -d

# 前端访问 http://localhost
# 后端 API 通过 Nginx 代理到 app 服务
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://localhost:8081` |
| `E2E_BASE_URL` | E2E 测试前端地址 | `http://localhost:5173` |
| `E2E_API_URL` | E2E 测试后端地址 | `http://localhost:8081` |
| `E2E_REQUESTER_USERNAME` | 普通用户测试账号 | — |
| `E2E_REQUESTER_PASSWORD` | 普通用户测试密码 | — |
| `E2E_AGENT_USERNAME` | 客服测试账号 | — |
| `E2E_AGENT_PASSWORD` | 客服测试密码 | — |
| `E2E_ADMIN_USERNAME` | 管理员测试账号 | — |
| `E2E_ADMIN_PASSWORD` | 管理员测试密码 | — |

## 角色权限

| 功能 | REQUESTER | AGENT | ADMIN |
|------|-----------|-------|-------|
| 工作台 | ✓ | ✓ | ✓ |
| 我的工单 / 工单中心 | ✓ | ✓ | ✓ |
| 新建工单 | ✓ | ✓ | ✓ |
| 工单评论 | ✓ | ✓ | ✓ |
| 分配负责人 | ✗ | ✓ | ✓ |
| 工单状态流转 | ✗ | ✓ | ✓ |
| 审计记录 | ✗ | ✓ | ✓ |
| 知识库查阅 | ✓ | ✓ | ✓ |
| 知识文章编辑 | ✗ | ✓ | ✓ |
| AI 助手 | ✓ | ✓ | ✓ |
| 用户管理 | ✗ | ✗ | ✓ |

## 测试

```bash
# 单元测试 + 组件测试
npm test

# 监听模式
npm run test:watch

# E2E 测试（需要先启动后端）
npx playwright install
npx playwright test
```

## AI 配置

AI 助手功能依赖后端 AI 模块。通过环境变量启用：

| 变量 | 说明 |
|------|------|
| `AI_CHAT_ENABLED=true` | 启用 AI |
| `AI_BASE_URL` | LLM API 地址 |
| `AI_API_KEY` | LLM API 密钥 |
| `AI_MODEL` | 模型名称 |

如未启用 AI，前端 503 时显示"AI 服务当前未启用"并提供搜索知识库和提交工单入口。

## 当前限制

- 用户管理不支持编辑用户名/角色，仅创建与启用/禁用
- 知识库文章仅支持纯 Markdown 编辑，无 WYSIWYG
- AI 会话不持久化到服务端，仅存储在 sessionStorage
- 工作台无聚合统计数据，仅显示最近工单
- 工单列表无关键词全文搜索，筛选依赖后端已支持的参数
- 无附件上传功能

## Roadmap

- [ ] 工单全文搜索
- [ ] Dashboard 聚合统计接口
- [ ] WYSIWYG 知识文章编辑器
- [ ] 附件上传
- [ ] AI 会话历史
- [ ] 通知系统
- [ ] 用户自我信息修改
- [ ] 密码修改
- [ ] 国际化 (i18n)
