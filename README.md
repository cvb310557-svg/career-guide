# Career Guide

职引官 Web 应用，包含 Express 后端、单页前端和本地静态素材。

## 目录结构

```text
.
├── certs/              # 数据库 SSL 根证书
├── db/                 # 数据库脚本
├── docs/               # 文档与截图
├── media/              # 视频等大体积演示素材
├── public/             # 前端页面与静态资源
│   └── assets/
├── scripts/            # 辅助脚本
├── src/                # 后端源码
├── .env.example        # 环境变量示例
├── package.json
└── package-lock.json
```

## 启动

```bash
npm install
npm start
```

默认服务地址为 `http://localhost:3000`。

## 配置

复制 `.env.example` 为 `.env`，按本地数据库配置填写变量。`.env` 不会进入版本库。

## 常用命令

```bash
npm start
npm run test:db
```
