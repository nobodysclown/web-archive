import { isNil } from '@web-archive/shared/utils'
import type { Database } from 'better-sqlite3'
import type { Tag } from '~/sql/types'

async function selectAllTags(DB: Database) {
  const sql = `
    SELECT 
      *
    FROM tags
  `
  const results = DB.prepare<unknown[], Tag>(sql).all()
  const tagList = results.map((tag) => {
    const pageIdDict = JSON.parse(tag.pageIdDict) as Record<string, number>
    return {
      ...tag,
      pageIds: Object.values(pageIdDict),
    }
  })
  return tagList
}

async function getTagById(DB: Database, id: number) {
  const sql = `
    SELECT 
      *
    FROM tags
    WHERE id = ?
  `
  const tag = DB.prepare<unknown[], Tag>(sql).get(id)
  if (!tag) {
    return null
  }
  const pageIdDict = JSON.parse(tag.pageIdDict) as Record<string, number>
  return {
    ...tag,
    pageIds: Object.values(pageIdDict),
  }
}

async function insertTag(DB: Database, options: { name: string, color: string }) {
  const { name, color } = options
  const sql = `
    INSERT INTO tags (name, color) 
    VALUES (?, ?)
  `
  const result = DB.prepare(sql).run(name, color)
  return result.changes > 0
}

async function updateTag(DB: Database, options: { id: number, name?: string, color?: string }) {
  const { id, name, color } = options
  if (isNil(id)) {
    throw new Error('Tag id is required')
  }
  if (isNil(name) && isNil(color)) {
    throw new Error('At least one field is required')
  }
  let sql = `
    UPDATE tags
    SET 
  `
  const bindParams: (number | string)[] = []
  if (name) {
    sql += `name = ?, `
    bindParams.push(name)
  }
  if (color) {
    sql += `color = ?, `
    bindParams.push(color)
  }
  sql = `${sql.slice(0, -2)} WHERE id = ?`
  bindParams.push(id)
  const result = DB.prepare(sql).run(...bindParams)
  return result.changes > 0
}

async function deleteTagById(DB: Database, id: number) {
  const sql = `
    DELETE FROM tags
    WHERE id = ?
  `
  const result = DB.prepare(sql).run(id)
  return result.changes > 0
}

interface TagBindRecord {
  tagName: string
  pageIds: Array<number>
}

function generateUpdateTagSql(
  DB: Database,
  bindList: Array<TagBindRecord>,
  unbindList: Array<TagBindRecord>,
) {
  const bindCommands = bindList.map(({ tagName, pageIds }) => {
    const updateStmt = DB.prepare(`
      INSERT INTO tags (name, pageIdDict) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET pageIdDict = json_patch(pageIdDict, ?) WHERE name = ?
      `)
    const mergePageJson = pageIdsToBindDictString(pageIds)
    return updateStmt.bind(tagName, mergePageJson, mergePageJson, tagName)
  })

  const unbindCommands = unbindList.map(({ tagName, pageIds }) => {
    const updateStmt = DB.prepare(`
      INSERT INTO tags (name, pageIdDict) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET pageIdDict = json_patch(pageIdDict, ?) WHERE name = ?
      `)
    const mergePageJson = pageIdsToUnbindDictString(pageIds)
    return updateStmt.bind(tagName, mergePageJson, mergePageJson, tagName)
  })

  return bindCommands.concat(unbindCommands)
}

async function updateBindPageByTagName(
  DB: Database,
  bindList: Array<TagBindRecord>,
  unbindList: Array<TagBindRecord>,
) {
  const commands = generateUpdateTagSql(DB, bindList, unbindList)
  if (commands.length === 0) {
    return true
  }

  const results = commands.map(stmt => stmt.run())
  return results.every(result => result.changes > 0)
}

function pageIdsToBindDictString(pageIds: Array<number>) {
  const dict: Record<string, number> = {}
  pageIds.forEach((id) => {
    dict[id.toString()] = id
  })
  return JSON.stringify(dict)
}

function pageIdsToUnbindDictString(pageIds: Array<number>) {
  const dict: Record<string, null> = {}
  pageIds.forEach((id) => {
    dict[id.toString()] = null
  })
  return JSON.stringify(dict)
}

export {
  selectAllTags,
  insertTag,
  getTagById,
  updateTag,
  deleteTagById,
  updateBindPageByTagName,
  generateUpdateTagSql,
  TagBindRecord,
}
