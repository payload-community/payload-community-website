// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { githubFullName } from '@/collections/Plugins'
import { isHttpURL } from '@/fields/validateURL'

describe('githubFullName', () => {
  it.each([
    ['https://github.com/Owner/Repo', 'owner/repo'],
    ['https://github.com/owner/repo.git', 'owner/repo'],
    ['https://www.github.com/owner/repo/tree/main', 'owner/repo'],
    ['https://gitlab.com/owner/repo', null],
    ['https://github.com/owner', null],
    ['not a url', null],
    [null, null],
  ])('%s -> %s', (url, expected) => {
    expect(githubFullName(url)).toBe(expected)
  })
})

describe('isHttpURL', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isHttpURL('https://example.com')).toBe(true)
    expect(isHttpURL('javascript:alert(1)')).toBe(false)
    expect(isHttpURL('/relative')).toBe(false)
  })
})
