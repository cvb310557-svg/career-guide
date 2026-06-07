# 职引官 Career Guide

职引官是一个面向求职者的 AI 面试实战平台。当前版本以原生单页前端、Express 后端和 MySQL 数据库为基础，支持岗位模板快速开始、自定义岗位面试、简历解析、逐题保存、AI 追问、复盘报告和历史回看。项目已部署到阿里云 ECS，公网入口为 `https://zhiyinguan.com`。

详细阶段计划见 [开发计划.md](./开发计划.md)，开发记录见 [history.md](./history.md)，公网部署见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 当前能力

- AI 面试工作台：岗位模板、自定义岗位、面试官风格、最近面试。
- 正式面试闭环：生成题目、创建 session、保存 turns、完成复盘、历史回看。
- 岗位模板库：内置产品经理、Java 开发、金融数据分析、新媒体运营等模板。
- 简历模块：支持粘贴文本或上传 txt，保存原文并生成结构化摘要。
- 本地 fallback：AI 题目、追问、报告失败时仍可继续完成流程。
- 本地 MySQL 开发脚本：`npm run db:start` 和 `npm run test:db`。
- 阿里云 ECS 生产部署：Nginx 反向代理、PM2 托管、HTTPS、`/api/health` 健康检查。

## 技术栈

- 前端：HTML、CSS、原生 JavaScript、Chart.js
- 后端：Node.js、Express
- 数据库：MySQL、mysql2
- AI：OpenAI-compatible Chat Completions API
- 登录：bcrypt 密码哈希

## 目录结构

```text
.
├── .env.example                         # 环境变量示例
├── .gitignore
├── DEPLOYMENT.md                        # 公网部署指南
├── ecosystem.config.cjs                 # PM2 生产进程配置
├── history.md                           # 开发历史记录
├── README.md
├── package.json
├── package-lock.json
├── 开发计划.md                          # 阶段计划与下一步 prompt
├── certs/
│   └── ca.pem                           # 可选数据库 SSL CA
├── db/
│   └── zhiyinguan.sql                   # MySQL 初始化脚本
├── docs/
│   └── screenshots/                     # 项目截图
│       ├── 屏幕截图-2026-03-15-160146.png
│       └── 屏幕截图-2026-03-15-160232.png
├── media/
│   └── videos/
│       └── 3月7日.mp4                   # 演示视频素材
├── public/
│   ├── index.html                       # 单页应用入口
│   ├── assets/
│   │   ├── images/                      # Logo 与面试官头像
│   │   │   ├── doria.png
│   │   │   ├── example.jpg
│   │   │   ├── jackson.png
│   │   │   ├── jessica.png
│   │   │   ├── kelly.png
│   │   │   ├── leo.png
│   │   │   └── logo.jpg
│   │   └── photos/                      # 页面照片素材
│   │       ├── 1.png
│   │       ├── 2.png
│   │       ├── 3.png
│   │       ├── 4.png
│   │       └── 5.png
│   ├── css/
│   │   └── styles.css                   # 主样式
│   ├── docs/
│   │   └── core-tech.html               # 技术说明页面
│   └── js/
│       ├── app-core.js                  # 前端配置与通用工具
│       └── app.js                       # 前端主逻辑
├── scripts/
│   ├── init-db.js                       # 初始化当前环境连接的 MySQL
│   ├── start-mysql-dev.ps1              # 本地 MySQL 启动脚本
│   └── test-db.js                       # 数据库连接测试
└── src/
    ├── dbConfig.js                      # 数据库连接配置
    ├── aiClient.js                      # AI 调用封装
    ├── interviewService.js              # 面试 session、turn、报告服务
    ├── jobTemplateService.js            # 岗位模板初始化和匹配
    ├── prompts.js                       # 面试、报告、简历 prompts
    ├── resumeService.js                 # 简历解析 fallback 与序列化
    ├── server.js                        # Express 路由入口
    └── utils.js                         # 通用工具函数
```

## 快速开始

```bash
npm install
copy .env.example .env
npm run db:start
npm run test:db
npm start
```

访问：

```text
http://localhost:3000
```

开发预览模式：

```text
http://localhost:3000/?dev=1
```

## 环境变量

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=zhiguanguan
DB_SSL=false
DB_SSL_CA=certs/ca.pem

AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=your_api_key_here
AI_MODEL=deepseek-v4-flash
AI_TIMEOUT_MS=60000
```

`.env` 不进入版本库。AI 未配置或调用失败时，系统会使用本地 fallback。

## 数据库

初始化脚本：

```text
db/zhiyinguan.sql
```

主要表：

```text
users, knowledge_base, job_templates, resumes,
interview_sessions, interview_turns, interview_records,
forum_posts, comments, mentors, bookings
```

全新数据库可执行：

```sql
SOURCE D:/career-guide/db/zhiyinguan.sql;
```

## 常用命令

```bash
npm run db:start      # 启动本地开发 MySQL
npm run db:init       # 初始化当前环境连接的 MySQL
npm run test:db       # 测试数据库连接
npm start             # 启动 Express 服务
```

## 生产环境

```text
公网地址：https://zhiyinguan.com
服务器目录：/var/www/career-guide
SSH 别名：career-guide-aliyun
PM2 应用名：career-guide
```

常用运维命令：

```bash
ssh career-guide-aliyun
cd /var/www/career-guide
pm2 status
pm2 logs career-guide
pm2 restart career-guide --update-env
curl https://zhiyinguan.com/api/health
```

生产服务器 `.env` 只保存在服务器上，不进入 GitHub。

语法检查：

```bash
node --check src/server.js
node --check src/prompts.js
node --check public/js/app.js
node --check public/js/app-core.js
```

## 当前分支

当前主线分支：

```text
main
```
