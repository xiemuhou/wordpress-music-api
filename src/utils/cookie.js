import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { URL } from 'node:url'
import config from '../config.js'

/**
 * 读取指定平台的 Cookie，环境变量优先，否则每次读取文件以支持热更新。
 * @param {string} server - 平台名称 (netease, tencent 等)
 * @returns {Promise<string>} cookie 字符串，失败时返回空字符串
 */
export async function readCookieFile (server) {
  // 优先从环境变量读取
  const envKey = `METING_COOKIE_${server.toUpperCase()}`
  const envCookie = process.env[envKey]?.trim()
  if (envCookie) {
    return envCookie
  }

  // 从文件读取
  try {
    const cookiePath = resolve(process.cwd(), 'cookie', server)
    const cookie = await readFile(cookiePath, 'utf-8')
    return cookie.trim()
  } catch {
    return ''
  }
}

/**
 * 验证 referrer 是否在允许的主机列表中
 * @param {string} referrer - 请求的 referrer
 * @returns {boolean} 是否允许
 */
export function isAllowedHost (referrer) {
  if (config.meting.cookie.allowHosts.length === 0) return true
  if (!referrer) return false

  try {
    const url = new URL(referrer)
    const hostname = url.hostname.toLowerCase()
    return config.meting.cookie.allowHosts.includes(hostname)
  } catch {
    return false
  }
}
