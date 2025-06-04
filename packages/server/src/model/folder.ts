import type { Database } from 'better-sqlite3'
import { isNotNil } from '@web-archive/shared/utils'
import type { Folder } from '~/sql/types'

async function checkFolderExists(DB: Database, name: string) {
  const sql = `
    SELECT 
      id
    FROM folders
    WHERE name = ? AND isDeleted == 0
  `
  const result = DB.prepare<unknown[], { id: number }>(sql).get(name)
  return isNotNil(result)
}

async function insertFolder(DB: Database, name: string) {
  const sql = `
    INSERT INTO folders (name)
    VALUES (?)
  `
  const result = DB.prepare(sql).run(name)
  return result.lastInsertRowid
}

async function updateFolder(DB: Database, options: { id: number, name: string }) {
  const sql = `
    UPDATE folders
    SET name = ?
    WHERE id = ?
  `
  const result = DB.prepare(sql).run(options.name, options.id)
  return result.changes > 0
}

async function selectAllFolders(DB: Database) {
  const sql = `
    SELECT 
      *
    FROM folders
    WHERE isDeleted == 0
  `
  const results = DB.prepare<unknown[], Folder>(sql).all()
  return results
}

async function deleteFolderById(DB: Database, id: number) {
  const folderResult = DB.prepare(`
    UPDATE folders
    SET 
      isDeleted = 1,
      deletedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id)

  const pageResult = DB.prepare(`
    UPDATE pages
    SET 
      isDeleted = 1,
      deletedAt = CURRENT_TIMESTAMP
    WHERE folderId = ?
  `).run(id)

  return {
    folderResult,
    pageResult,
  }
}

async function getFolderById(DB: Database, options: { id: number, isDeleted?: boolean }) {
  const { id, isDeleted } = options
  const sql = `
    SELECT 
      *
    FROM folders
    WHERE id = ?
  `
  const folder = DB.prepare<unknown[], Folder>(sql).get(id)
  if (isNotNil(isDeleted) && folder?.isDeleted !== Number(isDeleted)) {
    return null
  }
  return folder
}

async function queryDeletedFolders(DB: Database) {
  const sql = `
    SELECT 
      *
    FROM folders
    WHERE isDeleted == 1
    ORDER BY deletedAt DESC
  `
  const results = DB.prepare<unknown[], Folder>(sql).all()
  return results
}

async function selectDeletedFolderTotalCount(DB: Database) {
  const sql = `
    SELECT 
      COUNT(id) as count
    FROM folders
    WHERE isDeleted == 1
  `
  const result = DB.prepare(sql).get() as { count: number }
  return result.count
}

async function restoreFolder(DB: Database, id: number) {
  const sql = `
    UPDATE folders
    SET 
      isDeleted = 0,
      deletedAt = NULL
    WHERE id = ?
  `
  const result = DB.prepare(sql).run(id)
  return result.changes > 0
}

export {
  deleteFolderById,
  checkFolderExists,
  insertFolder,
  updateFolder,
  selectAllFolders,
  getFolderById,
  queryDeletedFolders,
  selectDeletedFolderTotalCount,
  restoreFolder,
}
