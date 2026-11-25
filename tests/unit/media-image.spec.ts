import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaImageRequestError, parseMediaImageQuery } from '@/utilities/mediaImage'
import { entrySlugs } from '@/website/detail'
import { isProductionBuild } from '@/website/staticParams'

const env = {
  NEXT_PUBLIC_SERVER_URL: 'https://community.example.org',
  S3_PUBLIC_URL: 'https://files.example.org/garage',
}

describe('parseMediaImageQuery', () => {
  it('allows the configured file host and the site host', () => {
    expect(
      parseMediaImageQuery(
        { q: '100', url: 'https://files.example.org/media/a.png', w: '640' },
        env,
      ),
    ).toMatchObject({ quality: 100, width: 640 })

    expect(
      parseMediaImageQuery({ q: null, url: 'https://community.example.org/og-image.png', w: '1200' }, env)
        .quality,
    ).toBe(75)
  })

  it('rejects other hosts, redirects tricks and bad sizes', () => {
    expect(() =>
      parseMediaImageQuery({ q: '75', url: 'https://evil.example/a.png', w: '640' }, env),
    ).toThrow(MediaImageRequestError)
    expect(() =>
      parseMediaImageQuery(
        { q: '75', url: 'https://user:pass@files.example.org/a.png', w: '640' },
        env,
      ),
    ).toThrow(MediaImageRequestError)
    expect(() =>
      parseMediaImageQuery({ q: '75', url: 'https://files.example.org/a.png', w: '9999' }, env),
    ).toThrow(MediaImageRequestError)
    expect(() =>
      parseMediaImageQuery({ q: '0', url: 'https://files.example.org/a.png', w: '640' }, env),
    ).toThrow(MediaImageRequestError)
  })
})

describe('isProductionBuild', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is true only during next build', () => {
    expect(isProductionBuild()).toBe(false)
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    expect(isProductionBuild()).toBe(true)
  })

  it('returns no slugs during next build, without a database', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    await expect(entrySlugs('posts')).resolves.toEqual([])
  })
})
