import { describe, expect, it } from 'vitest'

import {
  connectUserIdFor,
  CONNECT_TTL_SECONDS,
  signConnectIntent,
  verifyConnectIntent,
} from '@/auth/connectIntent'
import { failurePath, OAuthSignInError } from '@/auth/oauth'
import { signUpErrors, signUpSchema, websiteReturnPath } from '@/website/auth/schemas'

const SECRET = 'test-secret'
const NOW = 1_800_000_000_000

describe('connect intent cookie', () => {
  const token = signConnectIntent({ provider: 'github', userId: 'u1' }, SECRET, NOW)

  it('round-trips a signed intent', () => {
    expect(verifyConnectIntent(token, SECRET, NOW + 1000)).toEqual({
      exp: NOW + CONNECT_TTL_SECONDS * 1000,
      provider: 'github',
      userId: 'u1',
    })
  })

  it('rejects expired, tampered or foreign tokens', () => {
    expect(verifyConnectIntent(token, SECRET, NOW + CONNECT_TTL_SECONDS * 1000 + 1)).toBeNull()
    expect(verifyConnectIntent(token, 'other-secret', NOW)).toBeNull()
    const [body, signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ exp: NOW + 1e9, provider: 'github', userId: 'admin' }),
    ).toString('base64url')
    expect(verifyConnectIntent(`${forged}.${signature}`, SECRET, NOW)).toBeNull()
    expect(verifyConnectIntent(`${body}.`, SECRET, NOW)).toBeNull()
    expect(verifyConnectIntent('garbage', SECRET, NOW)).toBeNull()
    expect(verifyConnectIntent(undefined, SECRET, NOW)).toBeNull()
  })

  it('applies only to the same signed-in user and provider', () => {
    const base = { cookie: token, now: NOW, secret: SECRET }
    expect(connectUserIdFor({ ...base, provider: 'github', userId: 'u1' })).toBe('u1')
    expect(connectUserIdFor({ ...base, provider: 'google', userId: 'u1' })).toBeNull()
    expect(connectUserIdFor({ ...base, provider: 'github', userId: 'u2' })).toBeNull()
    expect(connectUserIdFor({ ...base, provider: 'github', userId: null })).toBeNull()
  })

  it('sends connect failures back to the account page', () => {
    expect(failurePath('/account/connected', new OAuthSignInError('provider_in_use'))).toBe(
      '/account/connected?error=provider_in_use',
    )
  })
})

describe('website auth helpers', () => {
  it.each([
    [undefined, '/'],
    ['/news', '/news'],
    ['/submit/posts', '/submit/posts'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/api/users/logout', '/'],
    [['/plugins', '/x'], '/plugins'],
  ])('websiteReturnPath(%s) = %s', (next, expected) => {
    expect(websiteReturnPath(next as string | string[] | undefined)).toBe(expected)
  })

  const valid = {
    confirm: 'correct horse battery',
    email: ' Someone@Example.com ',
    name: ' Sam ',
    password: 'correct horse battery',
    privacy: 'on',
  }

  it('accepts a valid registration and trims values', () => {
    const result = signUpSchema.safeParse(valid)
    expect(result.success && result.data).toMatchObject({
      email: 'Someone@Example.com',
      name: 'Sam',
    })
  })

  it('reports one error code per field', () => {
    const result = signUpSchema.safeParse({
      ...valid,
      confirm: 'different',
      email: 'nope',
      name: '  ',
      password: 'short',
      privacy: undefined,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(signUpErrors(result.error)).toEqual({
        email: 'invalid',
        name: 'required',
        password: 'too_short',
        privacy: 'required',
      })
    }
    const mismatch = signUpSchema.safeParse({ ...valid, confirm: 'different but long' })
    expect(!mismatch.success && signUpErrors(mismatch.error)).toEqual({ confirm: 'mismatch' })
  })
})
