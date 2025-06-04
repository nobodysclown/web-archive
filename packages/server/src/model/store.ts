import { createHash } from 'node:crypto'
import type { Database } from 'better-sqlite3'
import { type AITagConfig, ConfigKey } from '@web-archive/shared/types'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function checkAdminExist(DB: Database): Promise<boolean> {
  const result = DB.prepare<unknown[], { count: number }>(`SELECT COUNT(*) as count FROM stores WHERE key = 'ADMIN_TOKEN'`).get() ?? { count: -1 }
  return result?.count > 0
}

async function verifyAdminToken(DB: Database, token: string): Promise<'new' | 'fail' | 'reject' | 'accept'> {
  if (typeof token !== 'string' || token.length < 8)
    return 'reject'
  token = hashToken(token)
  const result = DB.prepare<unknown[], { count: number }>(`SELECT COUNT(*) as count FROM stores WHERE key = 'ADMIN_TOKEN' AND value = ?`).get(token) ?? { count: -1 }
  if (result?.count > 0) {
    return 'accept'
  }
  const exist = await checkAdminExist(DB)
  if (!exist) {
    const success = await setAdminToken(DB, token)
    return success ? 'new' : 'fail'
  }
  return 'reject'
}

async function setAdminToken(DB: Database, token: string): Promise<boolean> {
  const exist = await checkAdminExist(DB)
  if (exist) {
    throw new Error('Admin token already exists')
  }
  const result = DB.prepare(`INSERT INTO stores (key, value) VALUES ('ADMIN_TOKEN', ?)`).run(token)
  return result.changes > 0
}

async function getShouldShowRecent(DB: Database): Promise<boolean> {
  const results = DB.prepare<unknown[], { value: string }>(`SELECT value FROM stores WHERE key = '${ConfigKey.shouldShowRecent}'`).all()
  if (results.length === 0) {
    return true
  }
  return results[0].value === 'true'
}

async function setShouldShowRecent(DB: Database, value: boolean): Promise<boolean> {
  const bindValue = value ? 'true' : 'false'
  const insertSql = `INSERT INTO stores (key, value) VALUES ('${ConfigKey.shouldShowRecent}', ?) ON CONFLICT(key) DO UPDATE SET value = ?`
  const result = DB.prepare(insertSql).run(bindValue, bindValue)
  return result.changes > 0
}

async function getAITagConfig(DB: Database): Promise<AITagConfig> {
  const results = DB.prepare<unknown[], { value: string }>(`SELECT value FROM stores WHERE key = '${ConfigKey.aiTag}'`).all()
  if (results.length === 0) {
    return {
      tagLanguage: 'en',
      type: 'cloudflare',
      model: '',
      preferredTags: [],
    }
  }
  return JSON.parse(results[0].value) as AITagConfig
}

async function setAITagConfig(DB: Database, config: AITagConfig): Promise<boolean> {
  const insertSql = `INSERT INTO stores (key, value) VALUES ('${ConfigKey.aiTag}', ?) ON CONFLICT(key) DO UPDATE SET value = ?`
  const bindValue = JSON.stringify(config)
  const result = DB.prepare(insertSql).run(bindValue, bindValue)
  return result.changes > 0
}

export {
  checkAdminExist,
  verifyAdminToken,
  setAdminToken,
  getShouldShowRecent,
  setShouldShowRecent,
  getAITagConfig,
  setAITagConfig,
}
