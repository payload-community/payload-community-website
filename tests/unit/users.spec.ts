// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isConfiguredAdmin } from '@/collections/Users/hooks/authHooks'

describe('isConfiguredAdmin', () => {
  const env = { ADMIN_EMAILS: ' Boss@Example.com , ops@example.com', ADMIN_GITHUB_LOGINS: 'Octo,,cat' }

  it('matches GitHub logins and emails case-insensitively', () => {
    expect(isConfiguredAdmin({ email: 'x@example.com', githubLogin: 'octo' }, env)).toBe(true)
    expect(isConfiguredAdmin({ email: 'boss@example.com', githubLogin: null }, env)).toBe(true)
  })

  it('ignores users that are not listed and empty configuration', () => {
    expect(isConfiguredAdmin({ email: 'x@example.com', githubLogin: 'dog' }, env)).toBe(false)
    expect(isConfiguredAdmin({ email: 'boss@example.com', githubLogin: 'octo' }, {})).toBe(false)
  })
})
