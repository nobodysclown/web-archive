import { Hono } from 'hono'
import { ListObjectsV2Command, type _Object } from '@aws-sdk/client-s3'
import type { HonoTypeUserInformation } from '~/constants/binding'
import { getHomeChartData } from '~/model/data'
import result from '~/utils/result'
import { S3_BUCKET_NAME } from '~/constants/config'

const app = new Hono<HonoTypeUserInformation>()

app.get('/page_chart_data', async (c) => {
  const data = await getHomeChartData(c.env.DB)

  return c.json(result.success(data))
})

app.get('/r2_usage', async (c) => {
  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET_NAME,
  })
  const objects = await c.env.BUCKET.send(command)
  return c.json(result.success({
    size: objects.Contents?.reduce((acc: number, obj: _Object) => acc + (obj.Size ?? 0), 0) ?? 0,
    count: objects.Contents?.length ?? 0,
  }))
})

export default app
