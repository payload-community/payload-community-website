import type { CollectionConfig } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateFileURL } from '@/plugins/storage'

const collection = { slug: 'media' } as CollectionConfig

describe('generateFileURL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds a public Garage URL from the prefix and filename', () => {
    vi.stubEnv('S3_PUBLIC_URL', 'https://files.example.org/')

    expect(generateFileURL({ collection, filename: 'logo.png', prefix: 'media/abc123' })).toBe(
      'https://files.example.org/media/abc123/logo.png',
    )
  })

  it('encodes path segments but keeps separators', () => {
    vi.stubEnv('S3_PUBLIC_URL', 'https://files.example.org/base')

    expect(generateFileURL({ collection, filename: 'my photo #1.png', prefix: 'e2e/media' })).toBe(
      'https://files.example.org/base/e2e/media/my%20photo%20%231.png',
    )
  })

  it('works without a prefix', () => {
    vi.stubEnv('S3_PUBLIC_URL', 'https://files.example.org')

    expect(generateFileURL({ collection, filename: 'a.png' })).toBe(
      'https://files.example.org/a.png',
    )
  })
})
