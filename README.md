# WordPress Music API

基于 [metowolf/Meting-API](https://github.com/metowolf/Meting-API) 的多平台音乐 API 代理服务，用于给 WordPress / Argon 主题 / APlayer / MetingJS 提供音乐数据。

> 来源声明：当前项目已手动替换为 `metowolf/Meting-API` 的代码结构与实现，并会在此基础上继续修改。  
> 原项目作者：metowolf  
> 原项目地址：[https://github.com/metowolf/Meting-API](https://github.com/metowolf/Meting-API)  
> 原项目许可证：MIT License

## 当前定位111

- 作为个人 WordPress / 博客音乐播放器后端
- 通过 GHCR 镜像部署到 VPS
- 使用 Docker Compose 映射到 VPS 的 `9400` 端口
- 通过 APlayer + MetingJS 在 WordPress 前台渲染播放器
- 支持在 `.env` 中配置各音乐平台 Cookie

## 技术栈

- 运行时：Bun
- HTTP 服务：Bun.serve
- 核心音乐库：`@meting/core`
- 缓存：`lru-cache`
- 日志：`pino`
- 鉴权：HMAC-SHA1
- 镜像发布：GitHub Actions + GHCR

## 支持平台

| 平台 | `server` 参数 |
| --- | --- |
| 网易云音乐 | `netease` |
| QQ 音乐 | `tencent` |
| 酷狗音乐 | `kugou` |
| 百度音乐 | `baidu` |
| 酷我音乐 | `kuwo` |

## 项目结构

```text
src/
  index.js              # Bun 服务入口、路由调度、CORS
  config.js             # 环境变量配置
  service/
    api.js              # 核心 API：参数校验、鉴权、缓存、上游调用
    demo.js             # APlayer + MetingJS 演示页
  middleware/
    errors.js           # 统一错误处理
    logger.js           # 请求日志
  utils/
    cookie.js           # 平台 Cookie 读取与白名单判断
    http-exception.js   # HTTP 异常
    lyric.js            # 歌词格式化
```

## Docker Compose 部署

创建 `.env`：

```bash
cp .env.example .env
nano .env
```

推荐配置：

```env
PUBLIC_PORT=9400
HTTP_PORT=80
METING_URL=https://meting.xmhweb.cn
METING_TOKEN=换成你自己的密钥
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn

METING_COOKIE_NETEASE=
METING_COOKIE_TENCENT=
METING_COOKIE_KUGOU=
METING_COOKIE_BAIDU=
METING_COOKIE_KUWO=
```

启动：

```bash
docker compose pull
docker compose up -d
```

查看状态：

```bash
docker ps
docker compose logs -f
```

端口映射应该类似：

```text
0.0.0.0:9400->80/tcp
```

如果前面有 Nginx / Cloudflare，反代到：

```text
http://127.0.0.1:9400
```

健康测试：

```bash
curl 'http://127.0.0.1:9400/api?server=netease&type=search&id=周杰伦'
```

## GHCR 镜像

GitHub Actions 会在 `main` 分支推送后构建镜像：

```text
ghcr.io/xiemuhou/wordpress-music-api:latest
```

当前 `docker-compose.yml` 已默认使用该镜像。

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
| `token` / `auth` | 部分需要 | `url` / `pic` / `lrc` 需要 HMAC-SHA1 签名 |

示例：

```bash
curl 'https://meting.xmhweb.cn/api?server=tencent&type=playlist&id=9776449724'
```

返回列表数据示例：

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

## WordPress / Argon 使用

在 Argon 主题选项的“页尾脚本”里放入下面代码。注意：当前项目不再提供旧版自定义 `/meting-js.js`，前端需要加载 APlayer 和 MetingJS 官方脚本。

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

如果想要左下角小按钮，把 `mini` 改成 `true`：

```html
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

如果页面没有播放器，先直接打开这个地址确认后端是否有数据：

```text
https://meting.xmhweb.cn/api?server=tencent&type=playlist&id=9776449724
```

如果返回空数组，说明后端没有拿到可用歌曲数据，通常需要检查平台 Cookie、歌单权限、版权或地区限制。

## 内置演示页

部署后可直接访问：

```text
https://meting.xmhweb.cn/demo?server=tencent&type=playlist&id=9776449724
```

## Cookie 配置

优先使用环境变量：

```env
METING_COOKIE_TENCENT=uin=你的QQ号; qm_keyst=...; qqmusic_key=...;
```

也可以在容器工作目录下使用文件：

```text
cookie/
  netease
  tencent
  kugou
  baidu
  kuwo
```

建议使用环境变量方式，避免额外挂载文件。

## Cookie 白名单

`METING_COOKIE_ALLOW_HOSTS` 用于限制哪些来源可以使用 Cookie：

```env
METING_COOKIE_ALLOW_HOSTS=blog.xmhweb.cn
```

为空时不限制来源。公网部署建议填写你的博客域名。

## 鉴权说明

`url`、`pic`、`lrc` 会自动在列表响应中生成签名地址。签名算法来自上游项目：

```text
HMAC-SHA1(METING_TOKEN, server + type + id)
```

正常使用 MetingJS 时不需要你手动计算 token。

## 开发

本地开发需要 Bun：

```bash
bun install
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

## 当前检查结果

- 文件结构已检查
- `src/*.js` 主要入口已通过 `node --check` 静态语法检查
- 本机未安装 Bun 和 Docker，无法在本机实际启动或构建镜像
- 当前目录不是 Git 仓库；如需提交，需要重新 `git init` 或恢复 `.git`

## 许可证

MIT License。当前项目基于 [metowolf/Meting-API](https://github.com/metowolf/Meting-API) 修改，请保留来源与许可证说明。

## 相关项目

- [metowolf/Meting-API](https://github.com/metowolf/Meting-API)
- [@meting/core](https://www.npmjs.com/package/@meting/core)
- [DIYgod/APlayer](https://github.com/DIYgod/APlayer)
- [MetingJS](https://github.com/metowolf/MetingJS)
