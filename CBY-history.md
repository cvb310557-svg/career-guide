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
