# XBoard-Admin 部署文档

> XBoard-Admin 是适配 [Xboard](https://github.com/cedar2025/Xboard) 后端的独立管理面板。本文档覆盖本地开发、生产构建，以及多种部署方案。

---

## 目录

- [环境要求](#环境要求)
- [环境配置](#环境配置)
- [本地开发](#本地开发)
- [生产构建](#生产构建)
- [方案一：Cloudflare Pages 部署（推荐）](#方案一cloudflare-pages-部署推荐)
- [方案二：Nginx 直接托管](#方案二nginx-直接托管)
- [方案三：Docker 容器](#方案三docker-容器)
- [GitHub Actions 自动化构建](#github-actions-自动化构建)
- [常见问题排查](#常见问题排查)

---

## 环境要求

| 组件 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 18.x | 20.x LTS / 22.x |
| npm | 9.x | 10.x |
| Xboard 后端 | latest | latest master |

---

## 环境配置

```bash
cp .env.example .env
```

编辑 `.env`，共 5 个变量（2 个必须、3 个可选）：

### 必须配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_API_BASE_URL` | Xboard 后端根地址（**不含**尾部 `/`），所有 API 请求的基础 URL | `https://board.yoursite.com` |
| `VITE_DASHBOARD_SECURE_PATH` | 后台安全路径，拼接到 API URL 中（如 `/api/v2/{此路径}/user/fetch`）。**必须与 Xboard 后端设置一致** | `admin` |

> ⚠️ `VITE_DASHBOARD_SECURE_PATH` 与 Xboard 后端「系统设置 → 安全 → 后台路径」**必须完全匹配**，否则所有 API 请求将返回 404。

### 可选配置

| 变量 | 说明 | 默认行为 |
|------|------|---------|
| `VITE_FRONTEND_SECURE_PATH` | 管理面板的**前端路由访问路径**（隐藏后台登录口）。设置后，只有访问 `域名/{路径}` 才能进入后台，直接访问根域名显示 404 NotFound，从而防止被扫描。 | 留空时自动读取 `VITE_DASHBOARD_SECURE_PATH` |
| `VITE_DASHBOARD_API_TOKEN` | 管理面板 API 调试 Token。设置后可**跳过登录页面**，直接以 `Bearer {token}` 身份调用后端 API。**⚠️ 这不是节点对接 token**，是 Xboard 后端管理员登录后返回的 `auth_data`，仅用于开发调试。**生产环境必须留空或删除此行** | 留空时需通过登录页面获取鉴权 |
| `VITE_DASHBOARD_STATS_URL` | 自定义仪表盘统计 API 完整地址。适用于统计接口部署在独立服务上的场景 | 留空时自动拼接为 `{BASE_URL}/api/v3/{SECURE_PATH}/stat/getStats` |
| `VITE_AUTH_LOGIN_URL` | 自定义登录接口完整地址。适用于登录 API 走不同域名或路径的场景 | 留空时自动拼接为 `{BASE_URL}/api/v2/passport/auth/login` |

> 💡 **大多数部署只需配置前两个必须变量**。后 3 个仅在特殊场景（调试、多域名、API 网关分流）下使用。

---

## 本地开发

```bash
npm install
npm run dev
# 默认访问 http://localhost:5173
```

---

## 生产构建

```bash
npm run build
# 产物输出至 dist/ 目录
```

---

## 方案一：Cloudflare Pages 部署（推荐）

Cloudflare Pages 提供全球 CDN、自动 HTTPS、DDoS 防护，且免费额度充足，是管理面板部署的最佳选择。

### 1.1 基础部署

1. 将本仓库 Fork 到你的 GitHub 账户（或直接使用本仓库）
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择你的仓库，配置构建参数：

| 配置项 | 值 |
|-------|---|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node.js 版本 | `20` （在环境变量中设 `NODE_VERSION=20`） |

4. 添加环境变量（**Settings → Environment Variables**）：

| 变量名 | 值 | 必须 |
|--------|---|------|
| `NODE_VERSION` | `20` | ✅ |
| `VITE_API_BASE_URL` | `https://board.yoursite.com` | ✅ |
| `VITE_DASHBOARD_SECURE_PATH` | `admin`（与后端一致） | ✅ |
| `VITE_FRONTEND_SECURE_PATH` | `自定义的后台路径`（如 `/2f809b7b`） | ❌ |
| `VITE_DASHBOARD_API_TOKEN` | **留空或不设置**（生产环境禁止填写） | ❌ |
| `VITE_DASHBOARD_STATS_URL` | 留空（自动拼接） | ❌ |
| `VITE_AUTH_LOGIN_URL` | 留空（自动拼接） | ❌ |

5. 在项目 `public/` 目录创建 `_redirects` 文件实现 SPA 路由：

```
/*    /index.html   200
```

6. 点击 **Save and Deploy**，等待构建完成。

### 1.2 自定义域名

1. 进入 Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入你的域名，例如 `admin.yoursite.com`
3. Cloudflare 会自动添加 CNAME 记录并签发 SSL 证书

### 1.3 安全加固（重点）

管理面板包含敏感操作，必须做额外安全防护：

#### A. Cloudflare Access 零信任认证（强烈推荐）

这是最核心的安全措施，在 Cloudflare 网络层拦截未授权访问，**即使攻击者知道面板 URL 也无法进入**。

1. 进入 Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications**
2. **Add an application** → 选择 **Self-hosted**
3. 填写配置：
   - **Application name**: `XBoard Admin`
   - **Session Duration**: `24 hours`
   - **Application domain**: 你的管理面板域名 `admin.yoursite.com`
4. 配置 **Policy**：
   - **Policy name**: `Admin Access`
   - **Action**: `Allow`
   - **Include**: 选择验证条件（三种方式任选）
     - **Emails**: 指定允许的管理员邮箱列表
     - **Access Groups**: 预定义的用户组
     - **IP ranges**: 限定 IP 范围

5. 访问时会先经过 Cloudflare 的登录页面，验证通过后才能看到管理面板。

#### B. WAF 防火墙规则

在 **Security → WAF → Custom rules** 中创建规则：

```
规则名: Block non-admin countries
表达式: (ip.geoip.country ne "CN" and ip.geoip.country ne "HK")
动作: Block
```

或限制特定 IP 范围：

```
规则名: Allow admin IPs only
表达式: (not ip.src in {1.2.3.4/32 5.6.7.0/24})
动作: Block
```

#### C. Bot 防护 & 质询

1. **Security → Bots** → 开启 **Bot Fight Mode**
2. **Security → Settings** → 将 **Security Level** 设为 `High`
3. 考虑对管理面板域名开启 **Under Attack Mode**（仅在遭受攻击时开启）

#### D. 页面访问限制（Page Rules）

```
URL: admin.yoursite.com/*
设置: Security Level = I'm Under Attack
```

#### E. CORS 与 API 安全

管理面板和 Xboard 后端跨域时，后端需配置 CORS：

在 Xboard 后端的 `.env` 或中间件中：

```php
// 仅允许管理面板域名
'allowed_origins' => ['https://admin.yoursite.com']
```

如果不方便修改后端 CORS，可使用 Cloudflare Workers 做反向代理：

```javascript
// _worker.js (放在 Pages 项目根目录)
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 将 /api/ 请求代理到后端
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = 'https://board.yoursite.com' + url.pathname + url.search
      const modifiedRequest = new Request(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
      return fetch(modifiedRequest)
    }

    // 其他请求交给 Pages 处理
    return env.ASSETS.fetch(request)
  },
}
```

使用 Worker 代理时，将 `VITE_API_BASE_URL` 设为空字符串或 `/`，即可避免跨域。

### 1.4 安全检查清单

| 项目 | 状态 |
|------|------|
| ✅ Cloudflare Access 零信任认证 | 必须 |
| ✅ 自定义域名 + HTTPS | 必须 |
| ✅ WAF 地理位置/IP 限制 | 推荐 |
| ✅ Bot Fight Mode | 推荐 |
| ✅ CORS 或 Worker 反向代理 | 按需 |
| ✅ 移除 `.env` 中的调试 Token | 生产必须 |

---

## 方案二：Nginx 直接托管

### 上传构建产物

```bash
npm run build
rsync -avz --delete dist/ user@server:/var/www/xboard-admin/
```

### Nginx 配置

```nginx
server {
    listen 80;
    server_name admin.yoursite.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.yoursite.com;

    ssl_certificate     /etc/ssl/certs/yoursite.com.pem;
    ssl_certificate_key /etc/ssl/private/yoursite.com.key;

    root /var/www/xboard-admin;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 反向代理 API（可选，解决跨域）
    location /api/ {
        proxy_pass https://board.yoursite.com/api/;
        proxy_set_header Host board.yoursite.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 安全头
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;
}
```

### IP 白名单（推荐）

```nginx
location / {
    allow 10.0.0.0/8;
    allow 你的IP/32;
    deny all;
    try_files $uri $uri/ /index.html;
}
```

---

## 方案三：Docker 容器

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG VITE_API_BASE_URL=/
ARG VITE_DASHBOARD_SECURE_PATH=admin
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DASHBOARD_SECURE_PATH=${VITE_DASHBOARD_SECURE_PATH}
RUN npm run build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 构建并运行

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://board.yoursite.com \
  --build-arg VITE_DASHBOARD_SECURE_PATH=admin \
  -t xboard-admin:latest .

docker run -d -p 8080:80 --restart unless-stopped xboard-admin:latest
```

> ⚠️ Vite 环境变量在**构建阶段**内联到 JS 中。运行时修改环境变量**不会**生效。

---

## GitHub Actions 自动化构建

`.github/workflows/build.yml`：

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
          VITE_DASHBOARD_SECURE_PATH: ${{ secrets.VITE_DASHBOARD_SECURE_PATH }}
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

如果使用 Cloudflare Pages 的 Git 集成，则**无需此 Action**——Pages 会自动构建。

---

## 常见问题排查

| 问题 | 解决方案 |
|------|---------|
| 构建后页面空白 | 检查 `vite.config.js` 中 `base` 配置；确认 Nginx `try_files` 含 `/index.html` |
| API 返回 401/403 | 确认 `VITE_DASHBOARD_SECURE_PATH` 与后端一致 |
| CORS 错误 | 使用 Nginx 反向代理 `/api/` 或 Cloudflare Worker 代理 |
| Cloudflare Pages 构建失败 | 检查 `NODE_VERSION` 环境变量是否设为 `20` |
| Docker 环境变量不生效 | Vite 变量在构建时写入 JS，需通过 `--build-arg` 传递 |

---

## 技术栈

| 组件 | 版本 |
|------|------|
| Vue | 3.5.x |
| Vite | 8.x |
| Element Plus | 2.11.x |
| Pinia | 3.x |
| vue-router | 4.5.x |
| vue-i18n | 10.x |
