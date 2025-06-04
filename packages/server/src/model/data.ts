import type { Database } from 'better-sqlite3'
import { selectAllPageCount, selectPageTotalCount } from './page'
import { selectAllFolders } from './folder'

async function getHomeChartData(DB: Database) {
  const folderList = await selectAllFolders(DB)
  const folderPageCountList = await Promise.all(folderList.map(async (folder) => {
    const pageCount = await selectPageTotalCount(DB, { folderId: folder.id })
    return {
      id: folder.id,
      name: folder.name,
      pageCount: pageCount as number,
    }
  }))

  const sortedFolderPageCountList = folderPageCountList
    .sort((a, b) => b.pageCount - a.pageCount)
    .slice(0, 5)

  const allPageCount = await selectAllPageCount(DB)
  return {
    folders: sortedFolderPageCountList,
    all: allPageCount,
  }
}

export {
  getHomeChartData,
}
