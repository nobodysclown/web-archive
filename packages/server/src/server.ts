import 'dotenv/config'
import Database from 'better-sqlite3'
import { Hono } from 'hono'
import { S3Client } from '@aws-sdk/client-s3'
import type { Bindings, HonoTypeUserInformation } from './constants/binding'
import tokenMiddleware from './middleware/token'
import data from './api/data'
import { S3_ACCESS_KEY_ID, S3_ENDPOINT, S3_REGION, S3_SECRET_ACCESS_KEY, SQLITE_DB_PATH } from './constants/config'
import showcase from '~/api/showcase'
import pages from '~/api/pages'
import auth from '~/api/auth'
import folders from '~/api/folders'
import tags from '~/api/tags'
import config from '~/api/config'

const app = new Hono<{ Bindings: Bindings }>()

// Initialize SQLite database
const sqlite = new Database(SQLITE_DB_PATH)

// Initialize S3 client
const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  maxAttempts: 3,
  retryMode: 'standard',
})

// Add SQLite and S3 to the environment
app.use('*', async (c, next) => {
  c.env.DB = sqlite
  c.env.BUCKET = s3
  await next()
})

app.get('/', async (c) => {
  return c.html(
    `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="/static/index.js"></script>
  <link rel="stylesheet" href="/static/index.css">
  <link rel="icon" href="/static/logo.svg" />
  <title>Web Archive</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
  )
})

const api = new Hono<HonoTypeUserInformation>()
api.route('/showcase', showcase)

api.use(tokenMiddleware)

api.route('/pages', pages)
api.route('/auth', auth)
api.route('/folders', folders)
api.route('/tags', tags)
api.route('/data', data)
api.route('/config', config)
app.route('/api', api)

export default app
