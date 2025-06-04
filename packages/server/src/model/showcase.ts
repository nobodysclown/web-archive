import type { Database } from 'better-sqlite3'
import type { Page } from '~/sql/types'

interface QueryShowcaseOptions {
  pageNumber: number
  pageSize: number
}

async function queryShowcase(DB: Database, options: QueryShowcaseOptions) {
  const { pageNumber, pageSize } = options
  const querySql = `
    SELECT * FROM pages WHERE isShowcased = 1 AND isDeleted = 0 ORDER BY createdAt DESC LIMIT ? OFFSET ?
  `
  const countSql = `
    SELECT COUNT(*) AS count FROM pages WHERE isShowcased = 1 AND isDeleted = 0
  `
  const [results, countResult] = [
    DB.prepare<unknown[], Page>(querySql).all(pageSize, (pageNumber - 1) * pageSize),
    DB.prepare<unknown[], { count: number }>(countSql).get(),
  ]

  return {
    list: results,
    total: countResult?.count ?? 0,
  }
}

interface UpdateShowcaseOptions {
  id: number
  isShowcased: number
}

async function updateShowcase(DB: Database, options: UpdateShowcaseOptions) {
  const { id, isShowcased } = options
  const sql = `
    UPDATE pages SET isShowcased = ? WHERE id = ?
  `
  const result = DB.prepare(sql).run(isShowcased, id)
  return result.changes > 0
}

async function getShowcaseDetailById(DB: Database, options: { id: number }) {
  const { id } = options
  const sql = `
    SELECT 
      *
    FROM pages
    WHERE isShowcased = 1 AND isDeleted = 0 AND id = ?
  `
  const page = DB.prepare<unknown[], Page>(sql).get(id)
  return page
}

async function getNextShowcasePageId(DB: Database, lastId: number) {
  const sql = `
    SELECT id
    FROM pages
    WHERE isShowcased = 1 AND isDeleted = 0 AND id > ?
    ORDER BY id ASC
    LIMIT 1
  `

  const result = DB.prepare<unknown[], { id: number }>(sql).get(lastId)

  if (result) {
    return result.id
  }

  const firstShowcaseSql = `
    SELECT id
    FROM pages
    WHERE isShowcased = 1 AND isDeleted = 0
    ORDER BY id ASC
    LIMIT 1
  `

  const firstResult = DB.prepare<unknown[], { id: number }>(firstShowcaseSql).get()

  return firstResult ? firstResult.id : null
}

export {
  queryShowcase,
  updateShowcase,
  getShowcaseDetailById,
  getNextShowcasePageId,
}
