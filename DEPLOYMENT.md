# 职引官生产环境运维手册

本文档只记录当前生产环境状态和后续发布/运维流程。初次购买服务器、安装 Node/MySQL/Nginx、签发证书等一次性步骤已经完成，不再放在这里。

## 当前环境

```text
公网地址：https://zhiyinguan.com
健康检查：https://zhiyinguan.com/api/health
ECS 公网 IP：39.97.236.13
服务器系统：Ubuntu 22.04.5 LTS
服务器项目目录：/var/www/career-guide
SSH 别名：career-guide-aliyun
PM2 应用名：career-guide
Node 监听：127.0.0.1:3000
Nginx 监听：80/443
MySQL：服务器本机 localhost:3306
```

当前已完成：

- `zhiyinguan.com` 指向 ECS，并已启用 HTTPS。
- HTTP 会跳转到 HTTPS。
- Nginx 反向代理到本机 Node 服务。
- PM2 托管 `career-guide`，并已配置开机恢复。
- MySQL 已初始化，应用使用 `career_guide` 用户连接。
- VS Code Remote - SSH 可通过 `career-guide-aliyun` 连接服务器。

当前待补：

- `www.zhiyinguan.com` 的 DNS 解析和 HTTPS 证书补全。
- 真实 AI API Key 稳定性验证。
- MySQL 定期备份。
- 登录态、限流、密码强度校验等生产安全增强。

## 日常开发流程

推荐保持三段式流转：

```text
本地开发
  -> 本地验证
  -> 提交并推送 GitHub
  -> 服务器拉取并重启
```

不要长期直接在生产服务器上改业务代码。服务器只用于部署、配置 `.env`、查看日志和排查线上问题。

## 本地验证

本地开发前：

```bash
npm install
npm run db:start
npm run db:init
npm run test:db
npm start
```

本地访问：

```text
http://localhost:3000/?dev=1
```

修改后至少执行：

```bash
node --check src/server.js
node --check src/prompts.js
node --check public/js/app.js
node --check public/js/app-core.js
npm run test:db
```

如果改了数据库结构，同步更新：

```text
db/zhiyinguan.sql
scripts/init-db.js，如有需要
history.md
```

## 提交代码

```bash
git status
git add .
git commit -m "描述本次修改"
git push origin main
```

不要提交：

```text
.env
node_modules/
服务器证书或私钥
数据库导出里的真实用户敏感数据
```

## 发布到服务器

终端登录：

```bash
ssh career-guide-aliyun
```

发布命令：

```bash
cd /var/www/career-guide
git pull origin main
npm install --omit=dev
npm run db:init
pm2 restart career-guide --update-env
```

发布后验证：

```bash
pm2 status
curl https://zhiyinguan.com/api/health
```

查看日志：

```bash
pm2 logs career-guide
```

## 修改服务器 .env

服务器 `.env` 路径：

```text
/var/www/career-guide/.env
```

编辑：

```bash
ssh career-guide-aliyun
cd /var/www/career-guide
nano .env
pm2 restart career-guide --update-env
curl https://zhiyinguan.com/api/health
```

只配置 AI 时通常修改：

```env
AI_BASE_URL=...
AI_API_KEY=...
AI_MODEL=...
```

不要随意修改 `DB_PASSWORD`。如果必须改，需要同步修改 MySQL 用户密码。

## VS Code Remote - SSH

在 VS Code 中：

```text
Remote-SSH: Connect to Host
Host: career-guide-aliyun
Open Folder: /var/www/career-guide
```

适合在远程环境中做：

- 查看 `.env`
- 查看 PM2 日志
- 检查 Nginx 配置
- 执行发布命令

不建议用远程服务器作为主要开发目录。

## 常用运维命令

```bash
pm2 status
pm2 logs career-guide
pm2 restart career-guide --update-env
systemctl status nginx
nginx -t
systemctl reload nginx
systemctl status mysql
curl https://zhiyinguan.com/api/health
```

## Nginx 配置

站点配置文件：

```text
/etc/nginx/sites-available/career-guide
```

修改后执行：

```bash
nginx -t
systemctl reload nginx
```

## HTTPS 证书

当前证书：

```bash
certbot certificates
```

证书续期通常由 Certbot 自动处理。手动测试：

```bash
certbot renew --dry-run
```

如果 `www.zhiyinguan.com` 解析生效后需要补进证书：

```bash
certbot --nginx -d zhiyinguan.com -d www.zhiyinguan.com
```

## 数据库

生产 MySQL 在服务器本机，仅允许本机连接。不要在阿里云安全组开放 `3306`。

临时手动备份：

```bash
mkdir -p /var/backups/career-guide
mysqldump -u career_guide -p zhiguanguan > /var/backups/career-guide/zhiguanguan-$(date +%F-%H%M%S).sql
```

后续应补充自动备份脚本和异地保存策略。

## 故障排查

页面打不开：

```bash
curl https://zhiyinguan.com/api/health
systemctl status nginx
pm2 status
```

接口 500：

```bash
pm2 logs career-guide
```

数据库异常：

```bash
systemctl status mysql
cd /var/www/career-guide
npm run test:db
```

AI 一直 fallback：

- 检查服务器 `.env` 的 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`。
- 重启时使用 `pm2 restart career-guide --update-env`。
- 查看 `pm2 logs career-guide` 中的 AI 调用错误。
