# CBY History

## 2026-05-13

### 开发计划重写

- 重写 `开发计划.md`，将项目定位、已完成能力、当前问题、下一阶段优先级、技术原则和验收标准分区整理。
- 将下一阶段优先级调整为：面试 session 化、岗位模板库建模、真实成长曲线、简历解析增强、视频面试流程打通。
- 在开发计划末尾补充“立即下一步 Prompt”，用于后续直接启动面试 session 化开发。

### README 与版本管理

- 精简 `开发计划.md`，改为当前阶段、已完成、主要缺口、下一阶段优先级、技术原则和下一步 prompt。
- 重写 `README.md`，补充功能状态、技术栈、目录结构、快速开始、环境变量、数据库、本地 MySQL、接口清单、开发规范和 Git 工作流。
- 从 `ai-interview-model` 切出 `feature/resume-readme-roadmap` 分支，用于承接简历解析闭环、README、路线图和本地 MySQL 脚本相关改动。

### 简历上传与解析：后端模型

- 新增 `resumes` 数据表脚本，保存用户、文件名/来源、目标岗位、原始简历文本、结构化摘要、摘要文本和解析来源。
- 新增简历解析 prompt，并让面试题生成、追问、复盘接口预留/接收简历摘要上下文。
- 新增 `POST /api/resumes`、`GET /api/resumes/:userId`、`GET /api/resume/:id` 基础接口。
- 简历解析优先调用大模型，失败时使用本地规则兜底抽取姓名/目标岗位/教育/项目/技能/亮点/短板，保证页面可用。

### 简历上传与解析：前端闭环

- 将 AI 面试工作台左侧“用户简历”占位卡改为真实简历模块，支持查看最新简历摘要、技能标签、优势亮点和潜在短板。
- 新增简历编辑页内交互，支持粘贴纯文本或上传 txt 文件，提交后调用后端保存并解析。
- 自定义 AI 面试生成、面试追问和复盘报告请求会携带当前 `resumeId` 与 `resumeSummary`，后续题目生成可结合简历上下文。
- 补充简历模块样式，保持现有 AI 面试工作台卡片风格。

### 验证记录

- 已通过 `node --check src/server.js`。
- 已通过 `node --check src/prompts.js`。
- 已通过 `node --check public/js/app.js`。
- 已尝试执行 `npm run test:db`，当前环境数据库连接失败，需在可连接 MySQL 的环境执行 `db/zhiyinguan.sql` 以创建 `resumes` 表。

### 本地 MySQL 安装与初始化

- 通过 `winget install --id Oracle.MySQL --source winget --silent` 安装 MySQL 8.4.9。
- 初始化本地开发数据目录 `C:\Users\cvb\.career-guide-mysql-data`，root 使用空密码以匹配当前 `.env`。
- 导入 `db/zhiyinguan.sql`，已创建 `zhiguanguan` 数据库和 `resumes` 等项目表。
- 新增 `scripts/start-mysql-dev.ps1` 与 `npm run db:start`，用于下次启动本地开发 MySQL。
- 已重新执行 `npm run test:db`，数据库连接成功。

## 2026-05-10

### 项目结构整理

- 将前端静态资源统一放入 `public/`，后端入口放入 `src/`，数据库脚本、证书、媒体素材、辅助脚本分别归入 `db/`、`certs/`、`media/`、`scripts/`。
- 更新静态资源路径，统一使用 `public/assets/images/` 和 `public/assets/photos/`。
- 将后端入口调整为 `src/server.js`，通过 `express.static(...)` 托管 `public/`，并让 `/` 返回 `public/index.html`。
- 将数据库连接配置改为从环境变量读取，并新增 `.env.example` 与 `.gitignore`，避免明文数据库密码进入版本库。
- 重写 `scripts/test-db.js`，支持环境变量配置和可选 SSL 证书。
- 更新 `package.json` 和 `README.md`，补充启动方式、目录结构和常用命令。

### 前端预览与稳定性

- 新增开发预览模式：`http://localhost:3000/?dev=1`。
- 预览模式会注入本地测试用户，便于不登录直接查看前端页面。
- 增加 `fetchArray(endpoint)` 和 `asArray(value)`，避免数据库接口不可用或返回非数组时导致首页、知识库、AI 面试页白屏。
- 在数据库不可用时保留模拟数据，保证前端预览可继续运行。

### 文档与前端拆分

- 新增核心技术文档页：`public/docs/core-tech.html`，并在个人中心加入入口。
- 将原先集中在 `public/index.html` 的样式和脚本拆分为：
  - `public/css/styles.css`
  - `public/js/app.js`
- `public/index.html` 保留为基础 HTML 骨架，只负责加载 CSS、JS、外部依赖和 App 容器。

### 初版桌面端适配

- 在保持移动端基本可用的前提下，新增桌面端响应式样式。
- 早期桌面端尝试将原底部导航转为侧栏，并扩大内容容器、卡片网格和导师列表布局。
- 后续确认项目主要目标转向桌面网页体验，移动端只做最低限度兼容。

## 2026-05-11

### 顶部导航与桌面网页化

- 将原底部/侧栏导航改为网页顶部导航。
- 顶部栏目调整为：
  - 首页
  - AI面试
  - 热门面经
  - 在职咨询
- 右上角增加圆形个人中心入口。
- 去掉应用外围“手机壳”式固定宽度、圆角、阴影和边框，让页面铺满浏览器窗口。
- 桌面端内容区改为网页式最大宽度与响应式左右留白，不再是手机页面放大版。

### 首页桌面布局尝试

- 首页首屏曾调整为左侧欢迎/行动引导、右侧大幅轮播图的桌面双栏布局。
- 卡片、热门面经、推荐导师等区域同步调整为更适合桌面浏览的栅格比例。
- 该版本作为过渡尝试保留代码，但产品方向随后调整为暂时弱化首页。

### AI 面试作为默认工作台

- 将应用默认入口从“首页”切换为“AI面试”。
- `?dev=1` 未指定 tab 时默认进入 AI 面试页。
- 登录成功后也默认进入 AI 面试页。
- 导航激活状态改为由 `loadTabContent(tab)` 统一维护，避免默认页切换后高亮状态不一致。

### AI 面试页三列重构

- 将 AI 面试页重构为桌面工作台结构：
  - 顶部横向展示“热门岗位”，即原“热门练习”，并提供“查看全部”跳转到热门面经/知识库页。
  - 左侧放置“用户简历”区块，目前为示意性缩略展示，点击后提示后续接入简历上传与缩略显示。
  - 中部放置“自定义岗位面试”设置区块和“视频面试 · 真人模拟”启动区块。
  - 右侧竖向排列“面试官风格”选择。
  - 页面底部放置“最近面试”，并保留“查看全部”入口。
- 新增相关样式类，包括 `interview-workspace`、`hot-role-strip`、`interview-main-grid`、`resume-panel`、`interviewer-panel`、`video-launch-card` 等。
- 中等桌面宽度下三列布局自动降为纵向布局，移动端维持可运行优先。

### 验证记录

已执行并通过：

```bash
node --check public/js/app.js
```

已验证：

```text
http://localhost:3000/?dev=1
```

返回 `200`，CSS 与 JS 静态资源可正常加载。
