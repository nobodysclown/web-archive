import { isNotNil } from '@web-archive/shared/utils'
import type { Database } from 'better-sqlite3'
import type { S3Client } from '@aws-sdk/client-s3'
import type { TagBindRecord } from './tag'
import { generateUpdateTagSql } from './tag'
import type { Page } from '~/sql/types'
import { removeBucketFile } from '~/utils/file'

async function selectPageTotalCount(DB: Database, options: { folderId?: number, keyword?: string, tagId?: number }) {
  const { folderId, keyword, tagId } = options
  let sql = `
    SELECT COUNT(*) as count FROM pages
    WHERE isDeleted = 0
  `
  const bindParams: (number | string)[] = []

  if (isNotNil(folderId)) {
    sql += ` AND folderId = ?`
    bindParams.push(folderId)
  }

  if (keyword) {
    sql += ` AND title LIKE ?`
    bindParams.push(`${keyword}%`)
  }

  if (isNotNil(tagId)) {
    sql += ` AND id IN (SELECT value FROM json_each((SELECT pageIdDict FROM tags WHERE id = ?)))`
    bindParams.push(tagId)
  }

  const result = DB.prepare<unknown[], { count: number }>(sql).get(...bindParams)
  return result?.count ?? 0
}

async function selectAllPageCount(DB: Database) {
  const sql = `
    SELECT COUNT(*) as count FROM pages
    WHERE isDeleted = 0
  `
  const result = DB.prepare<unknown[], { count: number }>(sql).get()
  return result?.count ?? 0
}

async function queryPage(DB: Database, options: { folderId?: number, pageNumber?: number, pageSize?: number, keyword?: string, tagId?: number }) {
  const { folderId, pageNumber, pageSize, keyword, tagId } = options
  let sql = `
    SELECT
      id,
      title,
      contentUrl,
      pageUrl,
      folderId,
      pageDesc,
      screenshotId,
      createdAt,
      updatedAt,
      isShowcased
    FROM pages
    WHERE isDeleted = 0
  `
  const bindParams: (number | string)[] = []

  if (isNotNil(folderId)) {
    console.log('folderId', folderId)
    sql += ` AND folderId = ?`
    bindParams.push(folderId)
  }

  if (keyword) {
    sql += ` AND title LIKE ?`
    bindParams.push(`%${keyword}%`)
  }

  if (isNotNil(tagId)) {
    sql += ` AND id IN (SELECT value FROM json_each((SELECT pageIdDict FROM tags WHERE id = ?)))`
    bindParams.push(tagId)
  }

  sql += ` ORDER BY createdAt DESC`

  if (isNotNil(pageNumber) && isNotNil(pageSize)) {
    sql += ` LIMIT ? OFFSET ?`
    bindParams.push(pageSize)
    bindParams.push((pageNumber - 1) * pageSize)
  }

  const results = DB.prepare<unknown[], Page>(sql).all(...bindParams)
  return results
}

async function queryPageByUrl(DB: Database, pageUrl: string) {
  const sql = `SELECT * FROM pages WHERE pageUrl = ? AND isDeleted = 0`
  const results = DB.prepare<unknown[], Page>(sql).all(pageUrl)
  return results
}

async function selectDeletedPageTotalCount(DB: Database) {
  const sql = `
    SELECT COUNT(*) as count FROM pages
    WHERE isDeleted = 1
  `
  const result = DB.prepare<unknown[], { count: number }>(sql).get()
  return result?.count ?? 0
}

async function queryDeletedPage(DB: Database) {
  const sql = `
    SELECT
      id,
      title,
      contentUrl,
      pageUrl,
      folderId,
      pageDesc,
      createdAt,
      updatedAt,
      deletedAt
    FROM pages
    WHERE isDeleted = 1
    ORDER BY updatedAt DESC
  `
  const results = DB.prepare<unknown[], Page>(sql).all()
  return results
}

async function deletePageById(DB: Database, pageId: number) {
  const sql = `
    UPDATE pages
    SET 
      isDeleted = 1,
      deletedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  const result = DB.prepare(sql).run(pageId)
  return result.changes > 0
}

async function restorePage(DB: Database, id: number) {
  const sql = `
    UPDATE pages
    SET 
      isDeleted = 0,
      deletedAt = NULL
    WHERE id = ?
  `
  const result = DB.prepare(sql).run(id)
  return result.changes > 0
}

async function getPageById(DB: Database, options: { id: number, isDeleted?: boolean }) {
  const { id, isDeleted } = options
  const sql = `
    SELECT 
      *
    FROM pages
    WHERE id = ?
  `
  const page = DB.prepare(sql).get(id) as Page | undefined
  if (isNotNil(isDeleted) && page?.isDeleted !== Number(isDeleted)) {
    return null
  }
  return page
}

interface InsertPageOptions {
  title: string
  pageDesc: string
  pageUrl: string
  contentUrl: string
  folderId: number
  screenshotId?: string
  isShowcased: boolean
}

async function insertPage(DB: Database, pageOptions: InsertPageOptions) {
  console.log('insertPage', pageOptions)
  const { title, pageDesc, pageUrl, contentUrl, folderId, screenshotId = null, isShowcased } = pageOptions
  const result = DB
    .prepare(
      'INSERT INTO pages (title, pageDesc, pageUrl, contentUrl, folderId, screenshotId, isShowcased) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(title, pageDesc, pageUrl, contentUrl, folderId, screenshotId, isShowcased ? 1 : 0)
  return result.lastInsertRowid
}

async function clearDeletedPage(DB: Database, BUCKET: S3Client) {
  const pageListSql = `
    SELECT * FROM pages WHERE isDeleted = 1
  `
  const pages = DB.prepare<unknown[], Page>(pageListSql).all()
  const deleteBucketKeys = pages
    .map(page => [page.screenshotId, page.contentUrl])
    .flat()
    .filter(isNotNil)
  await removeBucketFile(BUCKET, deleteBucketKeys)

  const sql = `
    DELETE FROM pages WHERE isDeleted = 1
  `
  const result = DB.prepare(sql).run()
  return result.changes > 0
}

async function queryRecentSavePage(DB: Database) {
  const sql = `
    SELECT * FROM pages WHERE isDeleted = 0 ORDER BY createdAt DESC LIMIT 20
  `
  const results = DB.prepare<unknown[], Page>(sql).all()
  return results
}

interface UpdatePageOptions {
  id: number
  folderId: number
  title: string
  isShowcased: boolean
  pageDesc: string
  pageUrl: string
  bindTags?: Array<TagBindRecord>
  unbindTags?: Array<TagBindRecord>
}

async function updatePage(DB: Database, options: UpdatePageOptions) {
  const { id, folderId, title, isShowcased, pageDesc, pageUrl, bindTags = [], unbindTags = [] } = options
  const sql = `
    UPDATE pages
    SET
      folderId = ?,
      title = ?,
      isShowcased = ?,
      pageDesc = ?,
      pageUrl = ?
    WHERE id = ?
  `
  const updateSql = DB.prepare(sql).run(folderId, title, isShowcased, pageDesc, pageUrl, id)
  const updateSqlList = generateUpdateTagSql(DB, bindTags, unbindTags)
  const results = updateSqlList.map(stmt => stmt.run())
  return updateSql.changes > 0 && results.every(r => r.changes > 0)
}

async function queryAllPageIds(DB: Database, folderId: number) {
  const sql = `
    SELECT id FROM pages WHERE folderId = ? AND isDeleted = 0
  `
  const results = DB.prepare<unknown[], { id: number }>(sql).all(folderId)
  return results.map(r => r.id)
}

export {
  selectPageTotalCount,
  queryPage,
  queryPageByUrl,
  selectDeletedPageTotalCount,
  queryDeletedPage,
  deletePageById,
  restorePage,
  getPageById,
  insertPage,
  clearDeletedPage,
  queryRecentSavePage,
  selectAllPageCount,
  updatePage,
  queryAllPageIds,
}
