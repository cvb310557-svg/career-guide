# Career Guide

职引官 Web 应用，包含 Express 后端、单页前端、本地静态素材和独立文档子页面。

## 目录结构

```text
.
├── certs/                    # 数据库 SSL 根证书
├── db/                       # 数据库脚本
├── docs/                     # 项目说明截图等文档材料
├── media/                    # 视频等大体积演示素材
├── public/                   # 前端静态资源根目录
│   ├── assets/
│   │   ├── images/           # Logo、人物头像、示例图
│   │   └── photos/           # 首页轮播图
│   ├── css/
│   │   └── styles.css        # 主站样式
│   ├── docs/
│   │   └── core-tech.html    # 核心技术文档子页面
│   ├── js/
│   │   └── app.js            # 主站前端逻辑
│   └── index.html            # 主站 HTML 骨架
├── scripts/                  # 辅助脚本
├── src/
│   └── server.js             # Express 后端入口
├── .env.example              # 环境变量示例
├── .gitignore
├── CBY-history.md            # 项目修改历史
├── package.json
└── package-lock.json
```

## 启动

```bash
npm install
npm start
```


## 配置

复制 `.env.example` 为 `.env`，按本地数据库配置填写变量。`.env` 不会进入版本库。

常用变量：

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

## 常用命令

```bash
npm start
npm run test:db
```
