import { isNotNil } from '@web-archive/shared/utils'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import type { HonoTypeUserInformation } from '~/constants/binding'
import { getNextShowcasePageId, getShowcaseDetailById, queryShowcase } from '~/model/showcase'
import type { Page } from '~/sql/types'
import { getBase64FileFromBucket } from '~/utils/file'
import result from '~/utils/result'
import { S3_BUCKET_NAME } from '~/constants/config'
import { getPageById } from '~/model/page'

const app = new Hono<HonoTypeUserInformation>()

app.post(
  '/query',
  validator('json', (value, c) => {
    if (!value.pageNumber || typeof value.pageNumber !== 'number') {
      return c.json(result.error(400, 'Page number is required and should be a number'))
    }
    if (!value.pageSize || typeof value.pageSize !== 'number') {
      return c.json(result.error(400, 'Page size is required and should be a number'))
    }

    return {
      pageNumber: Number(value.pageNumber),
      pageSize: Number(value.pageSize),
    }
  }),
  async (c) => {
    const { pageNumber, pageSize } = c.req.valid('json')
    const pages = await queryShowcase(c.env.DB, { pageNumber, pageSize })

    pages.list = await Promise.all(pages.list.map(async (page) => {
      const screenshot = isNotNil(page.screenshotId) && await getBase64FileFromBucket(c.env.BUCKET, page.screenshotId, 'image/png')
      return {
        ...page,
        screenshot,
      }
    }))
    return c.json(result.success(pages))
  },
)

app.get('/content', async (c) => {
  const pageId = c.req.query('pageId')
  // redirect to 404
  if (!pageId) {
    return c.redirect('/error')
  }

  // todo refactor
  const page = await getPageById(c.env.DB, { id: Number(pageId), isDeleted: false })
  if (!page || !page.isShowcased) {
    return c.json(result.error(500, 'Page not found'))
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: page.contentUrl,
  })
  const content = await c.env.BUCKET.send(command)
  if (!content.Body) {
    return c.redirect('/error')
  }

  return c.html(
    await content.Body.transformToString(),
  )
})

app.get(
  '/detail',
  validator('query', (value, c) => {
    if (!value.id || Number.isNaN(Number(value.id))) {
      return c.json(result.error(400, 'ID is required'))
    }
    return {
      id: Number(value.id),
    }
  }),
  async (c) => {
    const { id } = c.req.valid('query')

    const page = await getShowcaseDetailById(c.env.DB, {
      id,
    })
    if (page) {
      return c.json(result.success(page))
    }

    return c.json(result.success(null))
  },
)

app.get(
  '/next_id',
  validator('query', (value, c) => {
    if (!value.id || Number.isNaN(Number(value.id))) {
      return c.json(result.error(400, 'ID is required'))
    }
    return {
      id: Number(value.id),
    }
  }),
  async (c) => {
    const { id } = c.req.valid('query')
    const nextId = await getNextShowcasePageId(c.env.DB, id)
    return c.json(result.success(nextId))
  },
)

export default app
