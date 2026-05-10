# CBY History

本文档用于同步记录本项目由 Codex 协助完成的全部修改。

## 2026-05-10

### 1. 整理项目目录结构

将原本集中在根目录的文件按用途重新归类：

```text
.
├── certs/              # 数据库 SSL 根证书
├── db/                 # 数据库脚本
├── docs/               # 文档与截图
├── media/              # 视频等大体积演示素材
├── public/             # 前端页面与静态资源
│   └── assets/
│       ├── images/     # Logo、人物头像、示例图
│       └── photos/     # 轮播图素材
├── scripts/            # 辅助脚本
├── src/                # 后端源码
├── .env.example        # 环境变量示例
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

主要迁移内容：

- `index.html` 移动到 `public/index.html`
- `server.js` 移动到 `src/server.js`
- `test-db.js` 移动到 `scripts/test-db.js`
- `zhiyinguan.sql` 移动到 `db/zhiyinguan.sql`
- `isrgrootx1.pem` 移动并重命名为 `certs/ca.pem`
- `images/` 素材移动到 `public/assets/images/`
- `photo/` 素材移动到 `public/assets/photos/`
- `example.jpg` 移动到 `public/assets/images/example.jpg`
- `3月7日.mp4` 移动到 `media/videos/3月7日.mp4`
- 屏幕截图移动到 `docs/screenshots/`

### 2. 更新前端资源路径

由于前端文件移动到了 `public/`，同步修改了 `public/index.html` 中的静态资源引用：

- `images/logo.jpg` 改为 `assets/images/logo.jpg`
- `images/*.png` 改为 `assets/images/*.png`
- `photo/*.png` 改为 `assets/photos/*.png`
- `example.jpg` 改为 `assets/images/example.jpg`

### 3. 优化后端入口与静态资源服务

修改 `src/server.js`：

- 增加 `path` 模块
- 使用 `express.static(...)` 托管 `public/`
- 增加 `/` 路由，返回 `public/index.html`
- 服务端口改为从 `process.env.PORT` 读取，默认 `3000`
- 数据库配置改为从环境变量读取

数据库环境变量包括：

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

### 4. 移除可跟踪文件中的明文数据库密码

原先代码中存在明文数据库密码和云数据库连接信息，已调整为环境变量配置。

新增 `.env.example`：

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=zhiguanguan
DB_SSL=false
DB_SSL_CA=certs/ca.pem
```

`.env` 和 `.env.*` 已加入 `.gitignore`，不会进入版本库。

### 5. 重写数据库测试脚本

重写 `scripts/test-db.js`：

- 使用环境变量读取数据库连接信息
- 支持 `DB_SSL=true`
- 支持通过 `DB_SSL_CA` 指定证书路径
- 连接成功或失败时输出清晰英文提示

### 6. 更新 package.json

修改 `package.json`：

- `main` 从 `server.js` 改为 `src/server.js`
- `npm start` 改为运行 `node src/server.js`
- 新增 `npm run test:db`
- 补充项目描述

### 7. 新增 .gitignore

新增 `.gitignore`，忽略：

- `node_modules/`
- `.env`
- `.env.*`
- 日志文件
- 系统文件
- 构建产物
- 测试覆盖率目录

### 8. 更新 README

重写 `README.md`，补充：

- 项目说明
- 目录结构
- 启动方式
- 环境变量配置说明
- 常用命令

### 9. 增加前端开发预览模式

修改 `public/index.html`，新增开发预览参数：

```text
http://localhost:3000/?dev=1
```

该模式会自动注入一个本地测试用户：

```js
{
    id: 1,
    username: 'dev',
    nickname: '开发预览',
    points: 999
}
```

可以直接查看不同前端模块：

```text
http://localhost:3000/?dev=1&tab=home
http://localhost:3000/?dev=1&tab=knowledge
http://localhost:3000/?dev=1&tab=interview
http://localhost:3000/?dev=1&tab=consult
http://localhost:3000/?dev=1&tab=profile
```

正常用户模式仍然是：

```text
http://localhost:3000
```

### 10. 验证记录

已执行以下检查：

```bash
node --check src/server.js
node --check scripts/test-db.js
```

结果：语法检查通过。

也检查过旧资源路径和明文密码残留，未发现仍需处理的匹配项。

### 11. Git 版本管理记录

当前分支：

```text
main
```

已完成提交：

```text
82477f8 Organize project structure
4d0aa75 Add frontend dev preview mode
```

已完成远程推送：

```text
82477f8 Organize project structure
```

说明：`4d0aa75 Add frontend dev preview mode` 是后续新增的本地提交，如需同步远程，可继续执行：

```bash
git push origin main
```

### 12. 新增变更历史文档

按要求新增 `CBY-history.md`，用于持续同步记录 Codex 对项目做过的修改、验证和版本管理状态。

### 13. 修复开发预览白屏问题

排查发现 `http://localhost:3000/api/knowledge` 在本地数据库未配置或未启动时会返回 `500`。浏览器 `fetch` 收到 `500` 不会自动进入 `catch`，原逻辑继续把 `{ error: ... }` 当数组渲染，导致首页执行 `.slice()` / `.map()` 时抛错并白屏。

修改 `public/index.html`：

- 新增 `fetchArray(endpoint)` 辅助函数
- 当接口不是 `2xx` 状态时主动抛错
- 当接口返回值不是数组时主动抛错
- `loadInitialData()` 捕获错误后继续使用现有模拟数据

这样在数据库不可用时，`http://localhost:3000/?dev=1` 仍可正常进入前端预览页面。

### 14. 修复底部 Tab 切换失败问题

继续排查发现，点击“知识库”时如果 `/api/knowledge` 返回 `500`，旧逻辑会先把错误对象写入全局变量 `knowledgeData`，再执行 `data.map()` 抛错并显示“加载失败”。之后再点击“首页”或“AI面试”，这些页面会继续调用 `knowledgeData.slice(...)`，因为 `knowledgeData` 已经不是数组，所以也会渲染失败。

修改 `public/index.html`：

- 新增 `asArray(value)`，统一保护数组数据
- 首页渲染前对 `knowledgeData`、`mentors`、`forumPosts` 做数组保护
- AI 面试页渲染前对 `knowledgeData` 做数组保护
- 知识库页改为使用 `fetchArray('/knowledge')`
- 知识库接口失败时保留初始化阶段的模拟数据，不再污染 `knowledgeData`
- 知识库为空或搜索无结果时显示空状态，而不是“加载失败”

### 15. 新增响应式桌面适配骨架

按“最小改动”原则，只在 `public/index.html` 的 CSS 中新增 `@media (min-width: 900px)`，不调整现有业务逻辑和页面渲染函数。

桌面端新增效果：

- 外层容器从手机窄屏扩展到最大 `1180px`
- 主结构切换为横向布局
- 原底部导航在桌面端变为左侧侧边栏
- 主内容区增加桌面端内边距和最大宽度
- 知识库卡片在桌面端变为三列
- 导师卡片在桌面端从横向滚动变为三列网格
- 手机端样式仍保留原来的底部导航和窄屏布局

### 16. 接入核心技术文档子页面

将下载目录中的文档页面 `D:\Users\cvb\Downloads\index.html` 作为独立静态子页面接入网站。

新增文件：

- `public/docs/core-tech.html`

修改 `public/index.html`：

- 在“我的”页面功能列表中新增“核心技术文档”入口
- 入口链接到 `/docs/core-tech.html`
- 使用 `target="_blank"` 和 `rel="noopener"` 打开独立文档页，避免影响当前主应用状态

验证：

- `http://localhost:3000/docs/core-tech.html` 返回 `200`
- `public/index.html` 和 `public/docs/core-tech.html` 内联脚本解析通过

### 17. 拆分主站前端代码

为降低后续开发维护成本，将原本集中在 `public/index.html` 中的样式和业务脚本拆分为独立文件。

新增文件：

- `public/css/styles.css`
- `public/js/app.js`

修改文件：

- `public/index.html` 仅保留 HTML 骨架、外部依赖、App 容器、CSS 引用和 JS 引用
- `README.md` 更新项目目录结构，补充 `public/css/`、`public/js/`、`public/docs/` 的职责说明

验证：

- `node --check public/js/app.js` 通过
- `http://localhost:3000/css/styles.css` 返回 `200`
- `http://localhost:3000/js/app.js` 返回 `200`
- `http://localhost:3000/?dev=1` 返回 `200`
