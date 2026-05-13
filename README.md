# 职引官 Career Guide

职引官是一个面向求职者的 AI 面试规划与实战提升平台。当前版本以桌面端 AI 面试工作台为核心，支持简历上传解析、岗位/JD 生成面试题、AI 面试官追问、复盘报告和历史记录。

## 功能状态

已完成：

- Express + MySQL + 原生单页前端基础结构。
- AI 面试工作台：热门岗位、自定义岗位面试、面试官风格、最近面试。
- AI 题目生成：结合岗位、公司、JD、知识库和简历摘要。
- AI 追问：根据用户回答生成一次追问，失败时使用本地兜底。
- AI 复盘：生成总分、能力雷达、逐题分析、优势短板和训练建议。
- 简历模块：支持粘贴纯文本或上传 txt，保存原文，解析结构化摘要。
- 数据库：用户、知识库、论坛、导师、预约、面试记录、简历表。
- 本地 MySQL 开发启动脚本：`npm run db:start`。

下一步重点：

- 面试流程 session 化。
- 岗位模板库建模。
- 真实成长曲线。
- pdf/docx 简历解析增强。
- 视频面试复用真实问答与复盘流程。

更详细路线见 [开发计划.md](./开发计划.md)。

## 技术栈

- 后端：Node.js、Express
- 数据库：MySQL、mysql2
- 前端：原生 HTML/CSS/JavaScript 单页应用
- AI：OpenAI-compatible Chat Completions API
- 鉴权基础：bcrypt 密码哈希

## 目录结构

```text
.
├── certs/                    # 数据库 SSL 根证书，可选
├── db/                       # MySQL 初始化脚本
│   └── zhiyinguan.sql
├── docs/                     # 截图、项目资料
├── media/                    # 演示视频等素材
├── public/                   # 前端静态资源
│   ├── assets/               # 图片、头像、Logo
│   ├── css/styles.css        # 主样式
│   ├── docs/core-tech.html   # 技术文档页面
│   ├── js/app.js             # 前端主逻辑
│   └── index.html            # 页面骨架
├── scripts/
│   ├── start-mysql-dev.ps1   # 本地开发 MySQL 启动脚本
│   └── test-db.js            # 数据库连接测试
├── src/
│   ├── aiClient.js           # OpenAI-compatible 调用封装
│   ├── prompts.js            # 面试/报告/简历解析 prompts
│   └── server.js             # Express 后端入口
├── .env.example              # 环境变量示例
├── CBY-history.md            # 开发历史记录
├── 开发计划.md               # 阶段路线图
└── package.json
```

## 快速开始

安装依赖：

```bash
npm install
```

复制环境变量：

```bash
copy .env.example .env
```

启动本地开发 MySQL：

```bash
npm run db:start
```

验证数据库连接：

```bash
npm run test:db
```

启动应用：

```bash
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

`.env` 示例：

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

说明：

- `.env` 不进入版本库。
- 当前本地开发 MySQL 使用 root 空密码，仅适合本机开发。
- 如果使用自己的 MySQL，请修改 `DB_*` 配置，并导入 `db/zhiyinguan.sql`。
- AI 未配置或调用失败时，系统会使用本地 fallback，页面仍可用。

## 数据库

初始化脚本：

```text
db/zhiyinguan.sql
```

主要表：

- `users`
- `knowledge_base`
- `forum_posts`
- `comments`
- `mentors`
- `bookings`
- `interview_records`
- `resumes`

本地开发 MySQL：

- 安装位置：`C:\Program Files\MySQL\MySQL Server 8.4`
- 数据目录：`C:\Users\cvb\.career-guide-mysql-data`
- 启动命令：`npm run db:start`
- 连接验证：`npm run test:db`

如果数据库是全新安装，可以用 MySQL 客户端或 Workbench 执行：

```sql
SOURCE D:/career-guide/db/zhiyinguan.sql;
```

## 常用命令

```bash
npm run db:start      # 启动本地开发 MySQL
npm run test:db       # 测试数据库连接
npm start             # 启动 Express 服务
```

语法检查：

```bash
node --check src/server.js
node --check src/prompts.js
node --check public/js/app.js
```

## 主要接口

用户：

- `POST /api/register`
- `POST /api/login`
- `GET /api/user/:id/points`

简历：

- `POST /api/resumes`
- `GET /api/resumes/:userId`
- `GET /api/resume/:id`

AI 面试：

- `POST /api/ai/interview/generate`
- `POST /api/ai/interview/followup`
- `POST /api/ai/interview/report`
- `POST /api/interview/save`
- `GET /api/interview/history/:userId`

知识库、论坛、导师：

- `GET /api/knowledge`
- `GET /api/knowledge/search/:keyword`
- `GET /api/forum/posts`
- `POST /api/forum/post`
- `GET /api/mentors`
- `POST /api/bookings`

## 开发规范

- 保持 Express + MySQL + 单页前端结构，避免大型框架重构。
- 数据库脚本使用可重复执行写法，例如 `CREATE TABLE IF NOT EXISTS`。
- AI 功能必须保留本地 fallback。
- 前端优先保持 AI 面试工作台风格，不新增割裂的大页面。
- 每完成一个较完整模块，更新 `CBY-history.md`。
- 提交前至少运行语法检查和 `npm run test:db`。

## Git 工作流

当前建议：

```bash
git switch main
git pull
git switch -c feature/<scope>
```

本次简历、README、路线图和本地 MySQL 脚本相关改动已放在：

```text
feature/resume-readme-roadmap
```

提交前检查：

```bash
git status --short
git diff
```

提交示例：

```bash
git add .
git commit -m "完善简历解析闭环和项目文档"
```

## 历史记录

开发过程记录在 [CBY-history.md](./CBY-history.md)。  
阶段计划记录在 [开发计划.md](./开发计划.md)。
