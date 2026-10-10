// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { failurePath, OAuthSignInError, safeReturnPath } from '@/auth/oauth'
import { parseGitHubProfile, parseGoogleProfile } from '@/auth/oauth/providers'
import {
  resolveOAuthAccount,
  type KnownUser,
  type ProviderProfile,
} from '@/auth/oauth/resolveOAuthAccount'

const profile = (overrides: Partial<ProviderProfile> = {}): ProviderProfile => ({
  avatarUrl: null,
  email: 'Ada@Example.com',
  emailVerified: true,
  name: 'Ada',
  providerId: '42',
  ...overrides,
})

const lookup = ({
  byEmail = null,
  byProvider = null,
}: {
  byEmail?: KnownUser | null
  byProvider?: KnownUser | null
}) => ({
  findByEmail: async (email: string) => {
    expect(email).toBe(email.toLowerCase())
    return byEmail
  },
  findByProviderId: async () => byProvider,
})

describe('resolveOAuthAccount', () => {
  it('signs in the user that already has this provider ID', async () => {
    await expect(
      resolveOAuthAccount({
        lookup: lookup({ byProvider: { id: 'u1' } }),
        profile: profile(),
        provider: 'github',
      }),
    ).resolves.toEqual({ kind: 'existing', userId: 'u1' })
  })

  it('refuses when the provider email is not verified', async () => {
    await expect(
      resolveOAuthAccount({
        lookup: lookup({}),
        profile: profile({ emailVerified: false }),
        provider: 'google',
      }),
    ).resolves.toEqual({ kind: 'refuse', reason: 'email_unverified' })
  })

  it('links a verified account found by email', async () => {
    await expect(
      resolveOAuthAccount({
        lookup: lookup({ byEmail: { _verified: true, id: 'u2' } }),
        profile: profile(),
        provider: 'github',
      }),
    ).resolves.toEqual({ claimUnverified: false, kind: 'link', userId: 'u2' })
  })

  it('claims an unverified account found by email', async () => {
    await expect(
      resolveOAuthAccount({
        lookup: lookup({ byEmail: { _verified: false, id: 'u3' } }),
        profile: profile(),
        provider: 'google',
      }),
    ).resolves.toEqual({ claimUnverified: true, kind: 'link', userId: 'u3' })
  })

  it('refuses when the email account has another ID for this provider', async () => {
    await expect(
      resolveOAuthAccount({
        lookup: lookup({ byEmail: { _verified: true, githubId: '7', id: 'u4' } }),
        profile: profile(),
        provider: 'github',
      }),
    ).resolves.toEqual({ kind: 'refuse', reason: 'provider_conflict' })
  })

  it('creates an account when nothing matches', async () => {
    await expect(
      resolveOAuthAccount({ lookup: lookup({}), profile: profile(), provider: 'github' }),
    ).resolves.toEqual({ kind: 'create' })
  })

  describe('with a connect intent', () => {
    it('links the provider to the signed-in user, even with an unverified provider email', async () => {
      await expect(
        resolveOAuthAccount({
          connectUserId: 'me',
          lookup: lookup({}),
          profile: profile({ emailVerified: false }),
          provider: 'github',
        }),
      ).resolves.toEqual({ claimUnverified: false, kind: 'link', userId: 'me' })
    })

    it('refuses a provider ID that belongs to someone else', async () => {
      await expect(
        resolveOAuthAccount({
          connectUserId: 'me',
          lookup: lookup({ byProvider: { id: 'other' } }),
          profile: profile(),
          provider: 'google',
        }),
      ).resolves.toEqual({ kind: 'refuse', reason: 'provider_in_use' })
    })
  })
})

describe('provider profiles', () => {
  it('uses the primary verified GitHub email and falls back to the login as name', () => {
    expect(
      parseGitHubProfile({ avatar_url: 'https://a/1', id: 1, login: 'octo', name: null }, [
        { email: 'old@example.com', primary: false, verified: true },
        { email: 'octo@example.com', primary: true, verified: true },
      ]),
    ).toEqual({
      avatarUrl: 'https://a/1',
      email: 'octo@example.com',
      emailVerified: true,
      login: 'octo',
      name: 'octo',
      providerId: '1',
    })
  })

  it('treats a GitHub account without a verified primary email as unverified', () => {
    const parsed = parseGitHubProfile({ id: 2, login: 'x' }, [
      { email: 'x@example.com', primary: true, verified: false },
    ])
    expect(parsed.email).toBeNull()
    expect(parsed.emailVerified).toBe(false)
  })

  it('requires email_verified === true from Google', () => {
    expect(parseGoogleProfile({ email: 'g@example.com', sub: 's1' }).emailVerified).toBe(false)
    expect(
      parseGoogleProfile({ email: 'g@example.com', email_verified: true, sub: 's1' }).emailVerified,
    ).toBe(true)
  })

  it('rejects malformed provider payloads', () => {
    expect(() => parseGitHubProfile({ id: 'nope' }, [])).toThrow()
    expect(() => parseGoogleProfile({})).toThrow()
  })
})

describe('OAuth redirects', () => {
  it.each([
    [undefined, '/admin'],
    ['/admin/collections/posts', '/admin/collections/posts'],
    ['/account?tab=1', '/account?tab=1'],
    ['//evil.example.com', '/admin'],
    ['https://evil.example.com', '/admin'],
    ['/\\evil.example.com', '/admin'],
  ])('safeReturnPath(%s) = %s', (state, expected) => {
    expect(safeReturnPath(state)).toBe(expected)
  })

  it('sends admin sign-ins back to the admin login with the refusal reason', () => {
    expect(failurePath('/admin', new OAuthSignInError('provider_conflict'))).toBe(
      '/admin/login?error=provider_conflict',
    )
    expect(failurePath('/news', new Error('boom'))).toBe('/sign-in?error=oauth')
  })
})
