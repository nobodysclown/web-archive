import { Hono } from 'hono'
import type { HonoTypeUserInformation } from '~/constants/binding'
import { getHomeChartData } from '~/model/data'
import result from '~/utils/result'

const app = new Hono<HonoTypeUserInformation>()

app.get('/page_chart_data', async (c) => {
  const data = await getHomeChartData(c.env.DB)

  return c.json(result.success(data))
})

app.get('/r2_usage', async (c) => {
  const res = await c.env.BUCKET.list()
  return c.json(result.success({
    size: res.objects.reduce((acc, obj) => acc + obj.size, 0),
    count: res.objects.length,
  }))
})

export default app
