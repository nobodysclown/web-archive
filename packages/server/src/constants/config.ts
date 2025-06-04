import process from 'node:process'

export const S3_REGION = process.env.S3_REGION ?? ''
export const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? ''
export const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY ?? ''
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ?? ''
export const S3_ENDPOINT = process.env.S3_ENDPOINT ?? ''

export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH ?? 'database.sqlite'
