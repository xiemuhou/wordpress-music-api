import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rename, unlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHmac } from 'node:crypto'
import Meting from '@meting/core'
import config from '../src/config.js'
import apiService from '../src/service/api.js'
import { readCookieFile } from '../src/utils/cookie.js'

test('Cookie 文件热更新、环境变量优先级和 API 缓存隔离', async (t) => {
  const originalCwd = process.cwd()
  const originalCookie = process.env.METING_COOKIE_TENCENT
  const originalHosts = config.meting.cookie.allowHosts
  const directory = await mkdtemp(join(tmpdir(), 'meting-cookie-test-'))
  const cookiePath = join(directory, 'cookie', 'tencent')
  t.after(async () => {
    process.chdir(originalCwd)
    if (originalCookie === undefined) delete process.env.METING_COOKIE_TENCENT
    else process.env.METING_COOKIE_TENCENT = originalCookie
    config.meting.cookie.allowHosts = originalHosts
    await rm(directory, { recursive: true, force: true })
  })
  process.chdir(directory)
  delete process.env.METING_COOKIE_TENCENT
  config.meting.cookie.allowHosts = ['blog.example.com']

  // 启动时目录不存在，之后新建文件也应在下一次读取生效。
  assert.equal(await readCookieFile('tencent'), '')
  await mkdir(join(directory, 'cookie'))
  await writeFile(cookiePath, ' session=old; \n')
  assert.equal(await readCookieFile('tencent'), 'session=old;')

  process.env.METING_COOKIE_TENCENT = ' session=env; '
  assert.equal(await readCookieFile('tencent'), 'session=env;')
  process.env.METING_COOKIE_TENCENT = '   '
  assert.equal(await readCookieFile('tencent'), 'session=old;')
  delete process.env.METING_COOKIE_TENCENT

  let calls = 0
  t.mock.method(Meting.prototype, 'url', async function () {
    calls++
    return JSON.stringify({
      url: this.header.Cookie === 'session=new;' ? 'https://audio.example.com/song.mp3' : ''
    })
  })
  const id = `cookie-test-${directory}`
  const auth = createHmac('sha1', config.meting.token).update(`tencenturl${id}`).digest('hex')
  const url = new URL('http://localhost/api')
  url.search = new URLSearchParams({ server: 'tencent', type: 'url', id, auth })
  const request = async (referer = 'https://blog.example.com/') => {
    const ctx = { responseHeaders: new Headers() }
    const response = await apiService(new Request(url, { headers: { referer } }), ctx)
    return { response, headers: ctx.responseHeaders }
  }

  assert.equal((await request()).response.status, 404)
  assert.equal((await request()).response.status, 404)
  assert.equal(calls, 1, '旧凭证的失败结果已被缓存')

  // 原子替换后应跳过旧缓存，不需要等待 TTL 或重启。
  await writeFile(`${cookiePath}.new`, 'session=new;')
  await rename(`${cookiePath}.new`, cookiePath)
  const updated = await request()
  assert.equal(updated.response.status, 302)
  assert.equal(updated.response.headers.get('location'), 'https://audio.example.com/song.mp3')
  assert.equal(updated.headers.get('x-cache'), 'miss')
  assert.equal(calls, 2)
  assert.equal((await request()).response.status, 302)
  assert.equal(calls, 2, '相同 Cookie 仍可复用缓存')

  assert.equal((await request('https://other.example.com/')).response.status, 404)
  assert.equal(calls, 3, '白名单外请求不能复用登录结果')
  assert.equal((await request()).response.status, 302)
  assert.equal(calls, 3, '匿名结果不能覆盖登录缓存')

  await unlink(cookiePath)
  assert.equal(await readCookieFile('tencent'), '')
  assert.equal((await request()).response.status, 404)
})
