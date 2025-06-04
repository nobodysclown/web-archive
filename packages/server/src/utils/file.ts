import { Buffer } from 'node:buffer'
import { isNil } from '@web-archive/shared/utils'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
import { S3_BUCKET_NAME } from '~/constants/config'

export async function formFileToArrayBuffer(file: File | string) {
  if (typeof file === 'string') {
    const encoder = new TextEncoder()
    return encoder.encode(file).buffer
  }
  else {
    return await file.arrayBuffer()
  }
}

export async function removeBucketFile(BUCKET: S3Client, ids: string | string[]) {
  if (isNil(ids)) {
    return
  }

  const keys = Array.isArray(ids) ? ids : [ids]
  await Promise.all(keys.map(key =>
    BUCKET.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    })),
  ))
}

export async function saveFileToBucket(BUCKET: S3Client, file: File | string) {
  if (isNil(file)) {
    return
  }
  const id = crypto.randomUUID()
  const fileArraybuffer = await formFileToArrayBuffer(file)
  await BUCKET.send(new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: id,
    Body: Buffer.from(fileArraybuffer),
  }))
  return id
}

export async function getFileFromBucket(BUCKET: S3Client, id: string) {
  try {
    const response = await BUCKET.send(new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: id,
    }))
    if (!response.Body) {
      return null
    }
    const arrayBuffer = await response.Body.transformToByteArray()
    return new Response(arrayBuffer)
  }
  catch (error) {
    return null
  }
}

export async function getBase64FileFromBucket(BUCKET: S3Client, id: string, type?: string) {
  const file = await getFileFromBucket(BUCKET, id)
  if (isNil(file)) {
    return
  }
  const blob = await file.blob()
  return await blobToBase64(blob, type)
}

export async function blobToBase64(blob: Blob, type?: string) {
  const buffer = await blob.arrayBuffer()
  const base64String = Buffer.from(buffer).toString('base64')
  return `data:${type ?? blob.type};base64,${base64String}`
}
