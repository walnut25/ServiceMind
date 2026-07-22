# ServiceMind Frontend

ServiceMind 智能服务管理平台前端，基于 React + TypeScript + Vite 构建。

## 技术栈

- React 19 + TypeScript 5.7
- Vite 6
- Ant Design 5
- React Router 7
- TanStack Query 5
- Zustand 5
- Axios
- React Hook Form + Zod
- dayjs

## 前置条件

- Node.js >= 20
- 后端服务已启动（默认 `http://localhost:8081`）

## 安装依赖

```bash
cd frontend
npm install
```

## 环境变量

复制 `.env.example` 到 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://localhost:8081` |

## 启动开发服务器

```bash
npm run dev
```

前端默认运行在 `http://localhost:5173`。

Vite 开发服务器会将 `/api` 请求代理到后端 `http://localhost:8081`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## Lint

```bash
npm run lint
```

## 端口说明

| 服务 | 默认端口 |
|------|----------|
| 前端开发服务器 | 5173 |
| 后端 API | 8081 |

## 项目结构

```
frontend/
├── public/
├── src/
│   ├── api/             # API 客户端和接口请求
│   ├── assets/          # 静态资源
│   ├── components/      # 公共组件
│   │   └── common/      # 通用组件
│   ├── hooks/           # 自定义 Hooks
│   ├── layouts/         # 页面布局
│   ├── pages/           # 页面组件
│   │   ├── login/       # 登录页
│   │   ├── dashboard/   # 工作台
│   │   └── errors/      # 错误页面 (403, 404)
│   ├── router/          # 路由配置
│   ├── stores/          # Zustand 状态管理
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数和枚举映射
│   ├── App.tsx          # 根组件
│   ├── main.tsx         # 入口文件
│   └── index.css        # 全局样式
├── .env.example         # 环境变量示例
├── eslint.config.js     # ESLint 配置
├── index.html           # HTML 入口
├── package.json
├── tsconfig.json        # TypeScript 配置
└── vite.config.ts       # Vite 配置
```
