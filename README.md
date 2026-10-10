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
- 支持在 `.env` 中配置平台 Cookie，或通过文件热更新 Cookie
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
mkdir -p cookie
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

### 自动生成镜像（GitHub Actions）

仓库的 `.github/workflows/docker-publish.yml` 会在推送到 `main`、推送 `v*` 标签时构建镜像并发布到 GHCR；Pull Request 只验证构建，不发布。默认分支的构建会更新 `latest`，同时提供 `linux/amd64` 和 `linux/arm64` 镜像。

修改代码并推送到 `main` 后，打开 [GitHub Actions](https://github.com/xiemuhou/wordpress-music-api/actions)，等待对应提交的 **Docker Build and Push** 工作流成功，再更新 VPS。构建期间拉取 `latest` 仍可能拿到上一次的镜像。

流程使用仓库自动提供的 `GITHUB_TOKEN` 发布镜像，不需要把个人 Token 写入源码。如果匿名拉取提示无权限，检查 GHCR 包的可见性；公开部署可将包设为 Public，私有包则需要先在服务器上登录 GHCR。

### 已有 VPS 服务更新

在 VPS 上进入保存 `docker-compose.yml` 和 `.env` 的项目目录。如果该目录是 Git 克隆的仓库，先更新源码和 Compose 配置：

```bash
git pull --ff-only origin main
```

如果之前只上传了 Compose 文件，则手动同步仓库里的最新 `docker-compose.yml`，其中包含 Cookie 目录挂载。保留自己原来的 `.env` 和 Cookie 文件。随后拉取镜像并重建服务：

```bash
mkdir -p cookie
docker compose pull
docker compose up -d --force-recreate meting-api
docker compose ps
docker compose logs --tail=100 meting-api
```

服务仍使用 `.env` 中配置的公网 URL、Cookie、白名单和端口，默认对外端口为 `9400`。更新后可打开 [QQ 音乐歌单演示](https://meting.xmhweb.cn/demo?server=tencent&type=playlist&id=7717421203) 检查。全新服务器先按前文“Docker Compose 部署”配置 `.env` 再启动。

### 在 VPS 上直接构建镜像

如果不等待 GitHub Actions，可在已有 Docker 环境的 VPS 上，从最新源码的项目根目录构建（需要包含 `Dockerfile`、`package.json`、`bun.lock` 和 `src/`）：

```bash
docker build --pull -t ghcr.io/xiemuhou/wordpress-music-api:latest .
mkdir -p cookie
docker compose up -d --force-recreate --pull never meting-api
docker compose logs --tail=100 meting-api
```

这里的标签与 Compose 的 `image` 一致，`--pull never` 让服务使用刚构建的本地镜像。此方法只生成当前服务器架构的镜像，不会发布到 GHCR；启动前不要再执行 `docker compose pull`，否则本地的 `latest` 标签可能被远程镜像覆盖。

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

直接访问 `/demo` 时，默认使用网易云音乐（`server=netease`）搜索关键词 `hello`（`type=search&id=hello`）。要加载特定平台的特定歌单，在演示页地址后填写以下参数：

```text
https://你的API域名/demo?server=平台代码&type=playlist&id=歌单ID
```

| 参数 | 填写方式 |
| --- | --- |
| `server` | QQ 音乐填 `tencent`，网易云填 `netease`，酷狗填 `kugou`，百度音乐填 `baidu`，酷我填 `kuwo` |
| `type` | 加载歌单时固定填写 `playlist` |
| `id` | 对应平台的歌单 ID，填写 ID 本身，不要填写完整歌单链接或歌曲 ID |

例如，加载 **QQ 音乐歌单 `7717421203`**：

```text
https://meting.xmhweb.cn/demo?server=tencent&type=playlist&id=7717421203
```

[点击打开这个 QQ 音乐歌单演示](https://meting.xmhweb.cn/demo?server=tencent&type=playlist&id=7717421203)

切换到其他歌单时，修改 `id`；切换平台时，同时修改 `server` 和该平台对应的歌单 ID。参数之间使用普通的 `&` 连接，不要写成 `\&`。这种方式无需修改服务代码或重启容器。

如果要在 WordPress / Argon 的播放器里使用同一个歌单，将 `<meting-js>` 的属性改为：

```html
server="tencent"
type="playlist"
id="7717421203"
```

这些属性填写在已有的 `<meting-js ...>` 标签内，`api` 仍使用前文中的 API 地址模板。演示页 URL 的参数只影响该演示页，不会自动修改博客播放器的歌单。

如果演示页能看到歌曲但不能播放，通常是歌曲直链接口没有拿到真实音频地址。优先检查 Cookie、白名单、歌曲版权和 VIP 限制。

## Cookie 获取、配置与替换

### 如何查看和复制 Cookie

以 QQ 音乐和网易云音乐为例，使用电脑上的 Chrome / Edge：

1. 打开 [QQ 音乐](https://y.qq.com/) 或 [网易云音乐](https://music.163.com/)，登录自己的账号。
2. 按 `F12` 打开开发者工具，切换到 **Network / 网络**，然后刷新页面，打开歌单或播放一首歌曲。
3. 选择发往该音乐平台的接口请求（可以先筛选 **Fetch/XHR**），打开 **Headers / 标头**。
4. 在 **Request Headers / 请求标头** 中找到 `Cookie`，复制完整的值，也就是 `name=value; name2=value2` 这一部分。不要带 `Cookie:` 前缀，不要复制响应中的 `Set-Cookie`，也不要复制整条 cURL 命令。
5. 如果没有 `Cookie` 请求头，检查是否登录，或换一个发往音乐平台接口域名的请求。不要选择封面、音频 CDN 等资源请求。

也可以在 **Application / 应用 → Storage / 存储 → Cookies** 中查看各域名下的 Cookie。这里的 **Expires / Max-Age** 表示浏览器保存期限，`Session` 表示会话 Cookie；服务端仍可能提前撤销登录，所以这个时间不能保证 Cookie 一直可用。通过网络请求复制完整 Cookie，通常比手动拼接各项更方便。

其他平台使用相同方法：登录对应网站，再复制其接口请求携带的 Cookie。不同平台的 Cookie 不能混用，也不要只照抄下面示例中的字段名；应以自己浏览器实际发送的完整值为准。

Cookie 相当于登录凭证。不要分享、写入日志或提交到 GitHub；项目已忽略 `.env` 和 `cookie/`。Cookie 只能使用账号已有的权限，VIP 或受版权限制歌曲不保证一定能播放。

### 方式一：通过 `.env` 配置

非空环境变量优先于同平台的 Cookie 文件：

```env
METING_COOKIE_TENCENT='uin=你的QQ号; qm_keyst=实际值; qqmusic_key=实际值;'
METING_COOKIE_NETEASE='从网易云接口请求复制的完整Cookie值'
```

每个变量独占一行，Cookie 不要换行。在 Docker Compose 的 `.env` 中可用单引号包住值，避免其中的 `$` 或 `#` 被当作插值或注释；引号不属于 Cookie 本身。较复杂的值建议使用文件方式。

**过期后的替换步骤：**重新登录平台并复制 Cookie → 修改 `.env` → 重建服务容器：

```bash
docker compose up -d --force-recreate meting-api
```

容器启动时才会注入 `.env` 的环境变量，`docker compose restart` 不会重新读取 `.env`。重建后，进程内 API 缓存也会清空。无需修改 WordPress / MetingJS 的配置或重新生成签名。

检查环境变量是否进入容器，可以只查看长度，不输出凭证：

```bash
docker compose exec meting-api sh -c 'echo ${#METING_COOKIE_TENCENT}'
```

长度大于 `0` 只表示已经配置，不能证明登录仍然有效。本地使用 `bun run start` 时，修改 `.env` 后也需要停止并重新启动进程。

### 方式二：通过文件热更新（适合经常替换）

当前 `docker-compose.yml` 已将宿主机 `./cookie` 只读挂载到容器 `/app/cookie`。文件名使用平台的 `server` 参数，不带扩展名：

```text
cookie/
  netease
  tencent
  kugou
  baidu
  kuwo
```

例如配置 QQ 音乐：

1. 将 `.env` 中的 `METING_COOKIE_TENCENT` 留空，否则环境变量会覆盖文件。
2. 在 Compose 所在目录执行 `mkdir -p cookie`，创建 `cookie/tencent` 文件，内容是完整 Cookie 值，一整行，不带外层引号或 `Cookie:` 前缀。
3. 首次加入挂载、或清空已有环境变量后，执行 `docker compose up -d --force-recreate meting-api`。
4. 后续过期时，重新获取 Cookie 并替换宿主机上的 `cookie/tencent`，**无需重启容器，下一次 API 请求会读取新值**。

为避免保存过程中读到空文件，VPS 上推荐先写临时文件，再在同一目录替换（以下命令适用于 Linux）：

```bash
nano cookie/tencent.new
chmod 600 cookie/tencent.new
mv cookie/tencent.new cookie/tencent
```

容器运行用户需要有读取该文件的权限。本地运行时，文件放在启动命令所在目录的 `cookie/` 下。

服务每次请求读取当前 Cookie，并将 Cookie 的 SHA-256 摘要加入 API 缓存键，因此新 Cookie 不会复用旧 Cookie 的结果。没有获准使用 Cookie 的请求也使用独立缓存。替换前已发出的请求仍可能使用旧值，浏览器或 CDN 自己缓存的内容需要另行刷新。

文件挂载和缓存改进需要运行包含本次修改的镜像；仅编辑宿主机文件不能升级旧服务。可拉取包含改动的发布镜像，或在源码目录本地构建并启动：

```bash
docker build -t ghcr.io/xiemuhou/wordpress-music-api:latest .
docker compose up -d --force-recreate --pull never meting-api
```

### 替换后如何确认生效

打开已加入 Cookie 白名单的 `/demo` 页面，刷新后播放歌曲；也可以按下方“能获取歌曲，但不能播放”的命令，携带允许的 `Referer` 请求歌单返回的签名 `url` 地址。成功拿到音频重定向只能说明该次请求可用；建议选一首平时依赖账号权限才能播放的歌曲做检查，免费歌曲不一定需要 Cookie。

若仍返回 `404`，依次检查：是否使用了新镜像、`.env` 是否覆盖文件、容器是否重建、`Referer` 是否符合白名单、Cookie 是否来自正确平台，以及账号权限与歌曲版权。单次播放失败不能直接判定 Cookie 过期。

### 能否自动续期

**当前项目不支持自动续期；仅保存 Cookie 无法保证自动延长平台登录。** 项目调用 `@meting/core` 获取音乐数据，没有平台登录、扫码登录或刷新凭证流程，也没有自动保存上游新 Cookie 的逻辑。

自动续期需要平台提供可用的刷新或登录机制，再按平台分别接入、保存新凭证并处理失效情况。刷新凭证本身也可能过期，扫码、验证码或账号验证可能仍需人工完成。定时调用歌曲接口、刷新页面或修改 Cookie 的过期时间，不能保证服务端延长登录有效期。

当前推荐使用文件热更新：人工获取新 Cookie，或由你已有的可信登录工具将新 Cookie 写入 `cookie/{server}`，本服务负责在下一次请求使用新凭证。**自动读取替换后的文件是热更新，不等于自动续期。** 如果以后接入自动刷新，应优先针对实际使用的平台实现，而不是给所有平台加一个通用的“保活”定时器。

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

然后执行 `docker compose up -d --force-recreate meting-api`，让新的环境变量生效。

### 所有人都能访问我的 API 吗

公开的 `playlist` / `search` 接口知道地址后可以访问。`url` / `pic` / `lrc` 使用签名地址，并且 Cookie 使用受白名单影响。

这个项目适合个人博客轻量使用，不建议作为公开通用音乐 API 服务。

### 修改 `.env` 后没有生效

修改 `.env` 后需要重建容器，单纯执行 `restart` 不会更新环境变量：

```bash
docker compose up -d --force-recreate meting-api
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

Cookie 热更新与缓存隔离回归测试（不访问真实音乐平台）：

```bash
bun run test
# 也可使用 Node.js 运行
node --test
```

## 许可证

MIT License。当前项目基于 [metowolf/Meting-API](https://github.com/metowolf/Meting-API) 修改，请保留来源与许可证说明。

## 相关项目

- [metowolf/Meting-API](https://github.com/metowolf/Meting-API)
- [@meting/core](https://www.npmjs.com/package/@meting/core)
- [DIYgod/APlayer](https://github.com/DIYgod/APlayer)
- [MetingJS](https://github.com/metowolf/MetingJS)
