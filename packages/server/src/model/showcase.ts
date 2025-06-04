import type { Page } from '~/sql/types'

interface QueryShowcaseOptions {
  pageNumber: number
  pageSize: number
}

async function queryShowcase(DB: D1Database, options: QueryShowcaseOptions) {
  const { pageNumber, pageSize } = options
  const querySql = `
    SELECT * FROM pages WHERE isShowcased = 1 AND isDeleted = 0 ORDER BY createdAt DESC LIMIT ? OFFSET ?
  `
  const countSql = `
    SELECT COUNT(*) AS count FROM pages WHERE isShowcased = 1 AND isDeleted = 0
  `
  const [sqlResult, countResult] = await Promise.all([
    DB.prepare(querySql).bind(pageSize, (pageNumber - 1) * pageSize).all<Page>(),
    DB.prepare(countSql).first<{ count: number }>(),
  ])

  return {
    list: sqlResult.results,
    total: countResult.count,
  }
}

interface UpdateShowcaseOptions {
  id: number
  isShowcased: number
}

async function updateShowcase(DB: D1Database, options: UpdateShowcaseOptions) {
  const { id, isShowcased } = options
  const sql = `
    UPDATE pages SET isShowcased = ? WHERE id = ?
  `
  const result = await DB.prepare(sql).bind(isShowcased, id).run()
  return result.success
}

async function getShowcaseDetailById(DB: D1Database, options: { id: number }) {
  const { id } = options
  const sql = `
    SELECT 
      *
    FROM pages
    WHERE isShowcased = 1 AND isDeleted = 0 AND id = ?
  `
  const page = await DB.prepare(sql).bind(id).first<Page>()
  return page
}

async function getNextShowcasePageId(DB: D1Database, lastId: number) {
  const sql = `
    SELECT id
    FROM pages
    WHERE isShowcased = 1 AND isDeleted = 0 AND id > ?
    ORDER BY id ASC
    LIMIT 1
  `

  const result = await DB.prepare(sql).bind(lastId).first<{ id: number }>()

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

  const firstResult = await DB.prepare(firstShowcaseSql).first<{ id: number }>()

  return firstResult ? firstResult.id : null
}

export {
  queryShowcase,
  updateShowcase,
  getShowcaseDetailById,
  getNextShowcasePageId,
}
