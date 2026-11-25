import { describe, expect, it } from 'vitest'

import { PREVIOUS_SITE_NAME, replaceSiteName } from '@/migrations/20261125_145500_site_name'
import { SITE_NAME } from '@/website/siteName'

describe('replaceSiteName', () => {
  it('replaces the previous public name and keeps BSON values', () => {
    const id = { _bsontype: 'ObjectID', toHexString: () => 'abc' }
    const createdAt = new Date('2026-10-10T00:00:00.000Z')
    const doc = {
      _id: id,
      createdAt,
      hero: { text: PREVIOUS_SITE_NAME },
      meta: { title: `About | ${PREVIOUS_SITE_NAME}` },
      untouched: 'Payload CMS',
    }

    const result = replaceSiteName(doc, PREVIOUS_SITE_NAME, SITE_NAME)

    expect(result.changed).toBe(true)
    expect(result.value).toEqual({
      _id: id,
      createdAt,
      hero: { text: SITE_NAME },
      meta: { title: `About | ${SITE_NAME}` },
      untouched: 'Payload CMS',
    })
    expect((result.value as typeof doc)._id).toBe(id)
    expect((result.value as typeof doc).createdAt).toBe(createdAt)
  })

  it('returns the same value when the name is absent', () => {
    const doc = { title: 'News', note: 'visible on the portal' }
    const result = replaceSiteName(doc, PREVIOUS_SITE_NAME, SITE_NAME)
    expect(result).toEqual({ changed: false, value: doc })
  })
})
