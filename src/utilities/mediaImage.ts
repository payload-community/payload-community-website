const MAX_WIDTH = 3840

const ORIGIN_ENV = ['S3_PUBLIC_URL', 'NEXT_PUBLIC_SERVER_URL'] as const

export class MediaImageRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'MediaImageRequestError'
    this.status = status
  }
}

/** Origins allowed to be fetched and resized. Read at request time, not at image build. */
export const allowedMediaOrigins = (
  env: Record<string, string | undefined> = process.env,
): Set<string> => {
  const origins = new Set<string>()
  for (const name of ORIGIN_ENV) {
    const value = env[name]
    if (!value) continue
    try {
      origins.add(new URL(value).origin)
    } catch {
      // A malformed deployment URL does not widen the allowlist.
    }
  }
  return origins
}

export const parseMediaImageQuery = (
  params: { q: string | null; url: string | null; w: string | null },
  env: Record<string, string | undefined> = process.env,
): { quality: number; target: URL; width: number } => {
  if (!params.url) throw new MediaImageRequestError(400, 'missing url')

  let target: URL
  try {
    target = new URL(params.url)
  } catch {
    throw new MediaImageRequestError(400, 'invalid url')
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new MediaImageRequestError(400, 'invalid url')
  }
  if (target.username || target.password) throw new MediaImageRequestError(400, 'invalid url')
  if (!allowedMediaOrigins(env).has(target.origin)) {
    throw new MediaImageRequestError(400, 'url is not allowed')
  }

  const width = Number(params.w)
  if (!Number.isInteger(width) || width < 1 || width > MAX_WIDTH) {
    throw new MediaImageRequestError(400, 'invalid width')
  }

  const quality = params.q == null || params.q === '' ? 75 : Number(params.q)
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new MediaImageRequestError(400, 'invalid quality')
  }

  return { quality, target, width }
}
