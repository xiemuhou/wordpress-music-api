# WordPress Music API

一个面向 WordPress / Argon 主题 / APlayer / MetingJS 的轻量音乐 API 代理服务。项目基于 `metowolf/Meting-API` 调整，主要用于把歌单数据提供给博客前端播放器，并支持通过 Docker Compose 部署到 VPS。

> 来源声明：本项目基于 [metowolf/Meting-API](https://github.com/metowolf/Meting-API) 修改。  
> 原项目作者：metowolf  
> 原项目许可证：MIT License  
> 当前仓库会在上游项目基础上继续做个人博客部署相关适配。

## 功能定位

- 给 WordPress / Argon 主题提供音乐播放器后端
- 支持 APlayer + MetingJS 前端播放器
- 支持 QQ 音乐、网易云音乐、酷狗、酷我、百度音乐等平台
- 支持在 `.env` 中配置平台 Cookie
- 支持 GHCR 镜像发布与 Docker Compose 部署
- 默认使用 VPS `9400` 端口对外访问，容器内部服务端口为 `80`

## 技术栈

- 运行时：Bun
- HTTP 服务：Bun.serve
- 音乐数据：`@meting/core`
- 缓存：`lru-cache`
- 日志：`pino`
- 鉴权：HMAC-SHA1
- 镜像：GitHub Actions + GHCR

## 支持平台

| 平台 | `server` 参数 |
| --- | --- |
| 网易云音乐 | `netease` |
| QQ 音乐 | `tencent` |
| 酷狗音乐 | `kugou` |
| 百度音乐 | `baidu` |
| 酷我音乐 | `kuwo` |

## 目录结构

```text
src/
  index.js              # 服务入口、路由、CORS
  config.js             # 环境变量配置
  service/
    api.js              # 核心 API、签名、缓存、上游调用
    demo.js             # APlayer + MetingJS 演示页
  middleware/
    errors.js           # 错误处理
    logger.js           # 请求日志
  utils/
    cookie.js           # Cookie 读取与来源白名单
    http-exception.js   # HTTP 异常
    lyric.js            # 歌词格式化
```

## Docker Compose 部署

复制环境变量示例：

```bash
cp .env.example .env
nano .env
```

推荐配置：

```env
PUBLIC_PORT=9400
HTTP_PORT=80
METING_URL=https://meting.xmhweb.cn
METING_TOKEN=change-this-token
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn,meting.xmhweb.cn

METING_COOKIE_NETEASE=
METING_COOKIE_TENCENT=
METING_COOKIE_KUGOU=
METING_COOKIE_BAIDU=
METING_COOKIE_KUWO=
```

说明：

- `PUBLIC_PORT` 是 VPS 暴露端口，默认 `9400`
- `HTTP_PORT` 是容器内服务端口，默认 `80`
- `METING_URL` 必须是纯 URL，不要写成 Markdown 链接格式
- `METING_TOKEN` 用于生成 `url` / `pic` / `lrc` 的签名
- `METING_COOKIE_ALLOW_HOSTS` 是允许使用 Cookie 的来源域名
- Cookie 不要提交到 GitHub，也不要发给别人

启动服务：

```bash
docker compose pull
docker compose up -d
```

查看状态：

```bash
docker ps
docker compose logs -f
```

端口映射应类似：

```text
0.0.0.0:9400->80/tcp
```

如果使用 Nginx / Cloudflare 反代，反代目标填写：

```text
http://127.0.0.1:9400
```

## GHCR 镜像

当前 `docker-compose.yml` 默认使用：

```text
ghcr.io/xiemuhou/wordpress-music-api:latest
```

更新镜像并重启：

```bash
docker compose pull
docker compose down
docker compose up -d
```

如果担心本地仍在使用旧镜像，可以查看镜像创建时间：

```bash
docker image inspect ghcr.io/xiemuhou/wordpress-music-api:latest --format '{{.Created}}'
```

## API 使用

基础接口：

```text
GET /api
```

常用参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `server` | 是 | 音乐平台：`netease` / `tencent` / `kugou` / `baidu` / `kuwo` |
| `type` | 是 | 操作类型：`search` / `song` / `album` / `artist` / `playlist` / `lrc` / `url` / `pic` |
| `id` | 是 | 搜索关键词、歌曲 ID、歌单 ID 等 |
| `auth` | 部分需要 | `url` / `pic` / `lrc` 需要签名 |

示例：

```bash
curl 'https://meting.xmhweb.cn/api?server=tencent&type=playlist&id=9776449724'
```

返回数据示例：

```json
[
  {
    "title": "歌曲名",
    "author": "歌手",
    "url": "https://meting.xmhweb.cn/api?server=tencent&type=url&id=xxx&auth=xxx",
    "pic": "https://meting.xmhweb.cn/api?server=tencent&type=pic&id=xxx&auth=xxx",
    "lrc": "https://meting.xmhweb.cn/api?server=tencent&type=lrc&id=xxx&auth=xxx"
  }
]
```

`url`、`pic`、`lrc` 的签名会自动生成，正常配合 MetingJS 使用时不需要手动计算。

## WordPress / Argon 使用

在 Argon 主题选项的“页尾脚本”中加入下面代码。

### 完整吸底播放器

```html
<!-- 底部音乐播放器 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css">
<script src="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/meting@2.0.2/dist/Meting.min.js"></script>

<meting-js
  server="tencent"
  type="playlist"
  id="9776449724"
  fixed="true"
  mini="false"
  order="list"
  loop="all"
  preload="auto"
  list-folded="false"
  lrc-type="1"
  api="https://meting.xmhweb.cn/api?server=:server&type=:type&id=:id&r=:r">
</meting-js>
```

### 小按钮模式

```html
<!-- 底部音乐播放器：小按钮模式 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css">
<script src="https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/meting@2.0.2/dist/Meting.min.js"></script>

<meting-js
  server="tencent"
  type="playlist"
  id="9776449724"
  fixed="true"
  mini="true"
  order="list"
  loop="all"
  preload="auto"
  list-folded="true"
  lrc-type="0"
  api="https://meting.xmhweb.cn/api?server=:server&type=:type&id=:id&r=:r">
</meting-js>
```

把示例中的域名、平台和歌单 ID 改成自己的即可。

## 演示页

部署后可以打开：

```text
https://meting.xmhweb.cn/demo?server=tencent&type=playlist&id=9776449724
```

如果演示页能看到歌曲但不能播放，通常是歌曲直链接口没有拿到真实音频地址。优先检查 Cookie、白名单、歌曲版权和 VIP 限制。

## Cookie 配置

优先使用 `.env` 环境变量：

```env
METING_COOKIE_TENCENT=uin=你的QQ号; qm_keyst=...; qqmusic_key=...;
```

注意：

- 每个环境变量必须独占一行
- Cookie 要写在一整行里，不要换行
- Cookie 会过期，过期后需要重新获取
- VIP 或受版权限制歌曲不保证一定能播放
- 不要把 `.env` 提交到 GitHub

检查 Cookie 是否进入容器时，不要打印完整 Cookie，可以只看长度：

```bash
docker compose exec meting-api sh -c 'echo ${#METING_COOKIE_TENCENT}'
```

也可以使用文件方式配置 Cookie：

```text
cookie/
  netease
  tencent
  kugou
  baidu
  kuwo
```

## Cookie 白名单

`METING_COOKIE_ALLOW_HOSTS` 用于限制哪些来源可以使用 Cookie：

```env
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn,meting.xmhweb.cn
```

如果你只在 WordPress 使用，可以只保留博客域名：

```env
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn
```

如果还要使用内置 `/demo` 页面，需要把 API 域名也加入白名单：

```env
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn,meting.xmhweb.cn
```

`Referer` 可以被伪造，所以这个白名单主要用于减少普通滥用，不是严格安全认证。

## 常见问题

### 能获取歌曲，但不能播放

播放器能显示歌名和封面，说明 `playlist` 接口正常。不能播放通常是 `type=url` 没有拿到真实音频地址。

测试播放地址：

```bash
curl -v -L \
  -H "Referer: https://blog.xmhweb.cn/" \
  "http://127.0.0.1:9400/api?server=tencent&type=url&id=歌曲ID&auth=签名"
```

如果返回 `404`，常见原因是 Cookie 未生效、Cookie 已过期、歌曲是 VIP / 版权受限、歌曲本身没有可用直链。

### 演示页能显示歌曲，但播放失败

如果打开的是：

```text
https://meting.xmhweb.cn/demo
```

需要把 `meting.xmhweb.cn` 加入：

```env
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn,meting.xmhweb.cn
```

然后重启容器。

### 所有人都能访问我的 API 吗

公开的 `playlist` / `search` 接口知道地址后可以访问。`url` / `pic` / `lrc` 使用签名地址，并且 Cookie 使用受白名单影响。

这个项目适合个人博客轻量使用，不建议作为公开通用音乐 API 服务。

### 修改 `.env` 后没有生效

修改 `.env` 后需要重启容器：

```bash
docker compose down
docker compose up -d
```

## 本地开发

安装依赖：

```bash
bun install
```

开发运行：

```bash
bun run dev
```

生产运行：

```bash
bun run start
```

代码检查：

```bash
bun run lint
```

## 许可证

MIT License。当前项目基于 [metowolf/Meting-API](https://github.com/metowolf/Meting-API) 修改，请保留来源与许可证说明。

## 相关项目

- [metowolf/Meting-API](https://github.com/metowolf/Meting-API)
- [@meting/core](https://www.npmjs.com/package/@meting/core)
- [DIYgod/APlayer](https://github.com/DIYgod/APlayer)
- [MetingJS](https://github.com/metowolf/MetingJS)
