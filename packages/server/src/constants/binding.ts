import type { Database } from 'better-sqlite3'
import type { S3Client } from '@aws-sdk/client-s3'

export type Bindings = {
  JWT_SECRET: string
  DB: Database
  BUCKET: S3Client
  AI: Ai
}

export type HonoTypeUserInformation = {
  Bindings: Bindings
}
