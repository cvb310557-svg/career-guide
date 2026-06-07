
## 2026-06-07

### 阿里云 ECS 公网上线

- 在阿里云 ECS Ubuntu 22.04.5 LTS 上完成生产环境部署，公网入口为 `https://zhiyinguan.com`。
- 生产环境使用 Nginx 监听 `80/443`，反向代理到 PM2 托管的 `127.0.0.1:3000` Node 服务。
- 完成服务器本机 MySQL 初始化，创建 `zhiguanguan` 数据库和 `career_guide` 数据库用户，并执行 `npm run db:init`。
- 完成 HTTPS 证书签发，`http://zhiyinguan.com` 会跳转到 `https://zhiyinguan.com`。
- 配置本机 SSH 别名 `career-guide-aliyun`，并支持 VS Code Remote - SSH 打开服务器目录 `/var/www/career-guide`。
- 验证 `https://zhiyinguan.com/api/health` 返回 `status: ok`，PM2 应用 `career-guide` 在线。
- 更新 `DEPLOYMENT.md`，补充后续本地开发、GitHub 提交、服务器发布、`.env` 修改和生产状态说明。
- 当前待补：`www.zhiyinguan.com` 解析与证书、真实 AI API Key、账号安全增强和 MySQL 定期备份。

## 2026-05-30

### 公网部署准备

- 新增 `src/dbConfig.js`，统一数据库连接配置，并兼容本地 `DB_*` 与 Railway MySQL 的 `MYSQL*` 环境变量。
- 新增 `GET /api/health` 健康检查接口，用于公网平台部署时确认 Web 服务和数据库连接可用。
- 新增 `scripts/init-db.js` 与 `npm run db:init`，支持在托管 MySQL 上初始化 `db/zhiyinguan.sql`。
- 新增 `ecosystem.config.cjs`，用于阿里云 ECS 上通过 PM2 托管生产服务。
- 新增 `DEPLOYMENT.md`，整理阿里云 ECS、Ubuntu、MySQL、Nginx、PM2、域名和 HTTPS 的公网部署步骤。
- 修正文档中开发记录文件名，从 `CBY-history.md` 统一为实际存在的 `history.md`。

## 2026-05-13

### 正式面试闭环

- 完成“前端正式启动一次面试”的最小可用闭环：模板快速开始、自定义岗位开始、题目生成、session 创建、逐题保存、完成复盘、历史回看。
- 模板快速开始优先调用 `POST /api/ai/interview/generate`，携带岗位模板、简历摘要和面试官风格；AI 失败时使用本地模板题库继续。
- 新增并完善面试 session 接口：创建/读取会话、保存 turns、生成追问、结束面试、写入复盘报告。
- 最近面试和全部历史会区分 `in_progress` 与 `finished`：未完成记录显示“继续答题”，完成记录打开复盘报告。
- 前端状态提示覆盖未登录、模型失败、数据库短暂不可用、无历史记录等场景，避免白屏或流程中断。
- 前端 `API_BASE` 改为跟随当前页面来源，便于使用备用端口调试和验收。

### 岗位模板与简历

- 新增 `job_templates` 表和岗位模板服务，内置产品经理、Java 开发、金融数据分析、新媒体运营等模板。
- 新增岗位模板接口：`GET /api/job-templates`、`GET /api/job-templates/:id`、`GET /api/job-templates/search/:keyword`。
- 面试题生成结合岗位模板、JD、简历摘要和知识库，session 保存 `templateId/templateSummary`，为后续成长分析预留数据。
- 新增 `resumes` 表和简历接口，支持保存纯文本/txt 简历、AI 解析结构化摘要、本地规则兜底解析。
- 前端 AI 面试工作台接入真实简历模块，面试题生成、追问和复盘请求会携带 `resumeId` 与 `resumeSummary`。

### 代码结构

- 后端从 `src/server.js` 拆出：
  - `src/utils.js`
  - `src/resumeService.js`
  - `src/jobTemplateService.js`
  - `src/interviewService.js`
- 前端从 `public/js/app.js` 拆出 `public/js/app-core.js`，集中管理 API 地址、预览用户、JSON 解析、HTML 转义和历史记录工具。
- `public/index.html` 调整为先加载 `app-core.js`，再加载主逻辑 `app.js`。
- 后端服务启动时会补齐旧表缺失字段，降低已有本地数据库迁移失败风险。

### 本地数据库与文档

- 初始化本地 MySQL 8.4 开发数据目录 `C:\Users\cvb\.career-guide-mysql-data`，并导入 `db/zhiyinguan.sql`。
- 新增 `scripts/start-mysql-dev.ps1` 与 `npm run db:start`，用于启动本地开发 MySQL。
- 重写并精简 `README.md`，补充完整目录结构、快速启动、环境变量、数据库和常用命令。
- 重写 `开发计划.md`，整理当前阶段、已完成能力、主要缺口、下一阶段优先级、验收标准和下一步 prompt。
- 版本管理主线推进到 `feature/interview-mvp-loop`，并已在本地合并到 `main`。

### 验证记录

已通过：

```bash
node --check src/server.js
node --check src/prompts.js
node --check public/js/app.js
node --check public/js/app-core.js
npm run test:db
```

已用备用端口 `3100` 验证当前服务接口可用，`GET /api/job-templates` 返回模板数据。

GitHub 推送曾因当前环境无法连接 `github.com:443` 失败；本地 `main` 已生成合并提交，网络恢复后执行 `git push origin main` 即可。

## 2026-05-11

### 桌面工作台

- 将应用默认入口从首页切换为 `AI面试`，登录后和 `?dev=1` 预览模式默认进入面试工作台。
- 将导航改为网页顶部导航，栏目包括：首页、AI面试、热门面经、在职咨询，右上角保留个人中心入口。
- 去掉“手机壳”式固定容器，让页面铺满浏览器窗口，并为桌面端设置内容最大宽度和响应式留白。
- AI 面试页重构为桌面工作台：
  - 顶部展示热门岗位/练习入口。
  - 左侧为用户简历区域。
  - 中部为自定义岗位面试和视频面试入口。
  - 右侧为面试官风格选择。
  - 底部为最近面试记录。
- 新增相关样式类，如 `interview-workspace`、`hot-role-strip`、`interview-main-grid`、`resume-panel`、`interviewer-panel`、`video-launch-card`。

### 验证记录

已通过：

```bash
node --check public/js/app.js
```

已验证：

```text
http://localhost:3000/?dev=1
```

页面返回 `200`，CSS 与 JS 静态资源可正常加载。

## 2026-05-10

### 项目结构整理

- 将前端静态资源统一放入 `public/`，后端入口放入 `src/`，数据库脚本、证书、媒体素材、辅助脚本分别归入 `db/`、`certs/`、`media/`、`scripts/`。
- 后端入口调整为 `src/server.js`，通过 `express.static(...)` 托管 `public/`，并让 `/` 返回 `public/index.html`。
- 数据库连接配置改为从环境变量读取，新增 `.env.example` 与 `.gitignore`，避免明文配置进入版本库。
- 重写 `scripts/test-db.js`，支持环境变量配置和可选 SSL 证书。
- 新增开发预览模式 `http://localhost:3000/?dev=1`，可注入本地测试用户并在接口异常时使用模拟数据，减少前端白屏。
- 新增核心技术文档页 `public/docs/core-tech.html`，并在个人中心加入入口。
- 将原集中在 `public/index.html` 的样式和脚本拆分为 `public/css/styles.css` 与 `public/js/app.js`。

### 早期桌面适配

- 在保持移动端基本可用的前提下，新增桌面端响应式样式。
- 早期桌面端曾尝试侧栏导航、扩大内容容器、卡片网格和导师列表布局；后续产品方向调整为以桌面网页体验为主，移动端保留最低限度兼容。
