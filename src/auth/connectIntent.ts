import crypto from 'node:crypto'

import { z } from 'zod'

import type { OAuthProvider } from './oauth/resolveOAuthAccount'

export const CONNECT_COOKIE = 'plc_connect'
export const CONNECT_TTL_SECONDS = 10 * 60
/** OAuth return path while connecting; its route handler clears the cookie. */
export const CONNECT_RETURN_PATH = '/account/connected'

const intentSchema = z.object({
  exp: z.number(),
  provider: z.enum(['github', 'google']),
  userId: z.string().min(1),
})

export type ConnectIntent = z.infer<typeof intentSchema>

const hmac = (value: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(value).digest('base64url')

export const signConnectIntent = (
  { provider, userId }: { provider: OAuthProvider; userId: number | string },
  secret: string,
  now = Date.now(),
): string => {
  const body = Buffer.from(
    JSON.stringify({ exp: now + CONNECT_TTL_SECONDS * 1000, provider, userId: String(userId) }),
  ).toString('base64url')
  return `${body}.${hmac(body, secret)}`
}

/** The intent if the signature is valid and it has not expired, else `null`. */
export const verifyConnectIntent = (
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): ConnectIntent | null => {
  if (!token || !secret) return null
  const [body, signature, ...rest] = token.split('.')
  if (!body || !signature || rest.length) return null

  const expected = Buffer.from(hmac(body, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null

  try {
    const intent = intentSchema.parse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')))
    return intent.exp > now ? intent : null
  } catch {
    return null
  }
}

/** The signed-in user's connect intent for this provider, if any. */
export const connectUserIdFor = ({
  cookie,
  now,
  provider,
  secret,
  userId,
}: {
  cookie: string | null | undefined
  now?: number
  provider: OAuthProvider
  secret: string
  userId: number | string | null | undefined
}): string | null => {
  if (userId == null) return null
  const intent = verifyConnectIntent(cookie, secret, now)
  return intent && intent.provider === provider && intent.userId === String(userId)
    ? intent.userId
    : null
}
