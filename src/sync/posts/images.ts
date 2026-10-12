import path from 'node:path'

import type { Payload } from 'payload'

import { SYNC_CONTEXT } from '../write'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_TIMEOUT_MS = 15_000

/**
 * Returns the `post-media` ID for an image URL, downloading it into S3 only the first time
 * (looked up by `originalUrl`). Throws on download errors; callers import the post without image.
 */
export async function ensurePostImage(
  payload: Payload,
  image: { alt?: string; url: string },
  fallbackAlt: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const { docs } = await payload.find({
    collection: 'post-media',
    depth: 0,
    limit: 1,
    pagination: false,
    where: { originalUrl: { equals: image.url } },
  })
  if (docs[0]) return String(docs[0].id)

  const res = await fetchImpl(image.url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`image HTTP ${res.status}`)
  const mimetype = res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!mimetype.startsWith('image/'))
    throw new Error(`not an image: ${mimetype || 'no content-type'}`)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES)
    throw new Error('image too large')

  const data = Buffer.from(await res.arrayBuffer())
  if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('image too large')

  const name = decodeURIComponent(path.basename(new URL(image.url).pathname)) || 'image'
  const media = await payload.create({
    collection: 'post-media',
    context: SYNC_CONTEXT,
    data: { alt: image.alt || fallbackAlt, originalUrl: image.url },
    file: { data, mimetype, name, size: data.byteLength },
  })
  return String(media.id)
}
