import { z } from 'zod'

import type { OAuthProvider, ProviderProfile } from './resolveOAuthAccount'

const githubUserSchema = z.object({
  avatar_url: z.string().nullish(),
  id: z.number(),
  login: z.string(),
  name: z.string().nullish(),
})

const githubEmailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }),
)

const googleUserSchema = z.object({
  email: z.string().nullish(),
  email_verified: z.boolean().nullish(),
  name: z.string().nullish(),
  picture: z.string().nullish(),
  sub: z.string(),
})

async function getJSON(url: string, accessToken: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, ...headers },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`)
  return response.json()
}

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'payload-community-portal',
  'X-GitHub-Api-Version': '2022-11-28',
}

export const parseGitHubProfile = (user: unknown, emails: unknown): ProviderProfile => {
  const u = githubUserSchema.parse(user)
  const primary = githubEmailsSchema.parse(emails).find((e) => e.primary && e.verified)

  return {
    avatarUrl: u.avatar_url ?? null,
    email: primary?.email ?? null,
    emailVerified: Boolean(primary),
    login: u.login,
    name: u.name || u.login,
    providerId: String(u.id),
  }
}

export const parseGoogleProfile = (user: unknown): ProviderProfile => {
  const u = googleUserSchema.parse(user)

  return {
    avatarUrl: u.picture ?? null,
    email: u.email ?? null,
    emailVerified: u.email_verified === true,
    name: u.name ?? null,
    providerId: u.sub,
  }
}

export const fetchProfile: Record<OAuthProvider, (accessToken: string) => Promise<ProviderProfile>> = {
  github: async (accessToken) => {
    const [user, emails] = await Promise.all([
      getJSON('https://api.github.com/user', accessToken, GITHUB_HEADERS),
      getJSON('https://api.github.com/user/emails', accessToken, GITHUB_HEADERS),
    ])
    return parseGitHubProfile(user, emails)
  },
  google: async (accessToken) =>
    parseGoogleProfile(await getJSON('https://openidconnect.googleapis.com/v1/userinfo', accessToken)),
}
