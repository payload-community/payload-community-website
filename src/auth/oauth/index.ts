import { parseCookies, type PayloadRequest, type Plugin, type Where } from 'payload'
import { OAuth2Plugin } from 'payload-oauth2'

import { randomPassword } from '@/collections/Users/hooks/beforeOperation'
import { getServerSideURL } from '@/utilities/getURL'

import { CONNECT_COOKIE, CONNECT_RETURN_PATH, connectUserIdFor } from '../connectIntent'

import { fetchProfile } from './providers'
import {
  resolveOAuthAccount,
  SUB_FIELDS,
  type KnownUser,
  type OAuthProvider,
  type OAuthRefusal,
} from './resolveOAuthAccount'

export class OAuthSignInError extends Error {
  constructor(readonly reason: OAuthRefusal) {
    super(`OAuth sign-in refused: ${reason}`)
  }
}

/** Only relative paths on this site are accepted as return targets. */
export const safeReturnPath = (state: string | null | undefined): string =>
  state && /^\/(?!\/)[^\\\s]*$/.test(state) ? state : '/admin'

export const failurePath = (state: string | null | undefined, error: unknown): string => {
  const returnPath = safeReturnPath(state)
  const base = returnPath.startsWith('/admin')
    ? '/admin/login'
    : returnPath.startsWith(CONNECT_RETURN_PATH)
      ? CONNECT_RETURN_PATH
      : '/sign-in'
  const reason = error instanceof OAuthSignInError ? error.reason : 'oauth'
  return `${base}?error=${reason}`
}

const knownUserSelect = { _verified: true, githubId: true, googleId: true } as const

const createGetUserInfo =
  (provider: OAuthProvider) =>
  async (accessToken: string, req: PayloadRequest): Promise<Record<string, unknown>> => {
    const { payload } = req
    const profile = await fetchProfile[provider](accessToken)
    const subField = SUB_FIELDS[provider]

    const findOne = async (where: Where): Promise<KnownUser | null> => {
      const { docs } = await payload.find({
        collection: 'users',
        limit: 1,
        overrideAccess: true,
        req,
        select: knownUserSelect,
        showHiddenFields: true,
        where,
      })
      return (docs[0] as KnownUser | undefined) ?? null
    }

    const connectUserId = connectUserIdFor({
      cookie: parseCookies(req.headers).get(CONNECT_COOKIE),
      provider,
      secret: payload.secret,
      userId: req.user?.id,
    })

    const resolution = await resolveOAuthAccount({
      connectUserId,
      lookup: {
        findByEmail: (email) => findOne({ email: { equals: email } }),
        findByProviderId: (p, id) => findOne({ [SUB_FIELDS[p]]: { equals: id } }),
      },
      profile,
      provider,
    })

    const providerData = {
      [subField]: profile.providerId,
      avatarUrl: profile.avatarUrl,
      ...(provider === 'github' ? { githubLogin: profile.login } : {}),
    }

    switch (resolution.kind) {
      case 'refuse':
        throw new OAuthSignInError(resolution.reason)
      case 'existing':
        return providerData
      case 'link':
        await payload.update({
          collection: 'users',
          context: { oauthSignIn: true },
          data: {
            ...providerData,
            ...(resolution.claimUnverified ? { _verified: true, password: randomPassword() } : {}),
          },
          id: resolution.userId,
          overrideAccess: true,
          req,
        })
        payload.logger.info(
          {
            claimUnverified: resolution.claimUnverified,
            connect: Boolean(connectUserId),
            provider,
            userId: resolution.userId,
          },
          'Linked OAuth provider to existing account',
        )
        return providerData
      case 'create':
        req.context.oauthSignIn = true
        return {
          ...providerData,
          _verified: true,
          email: profile.email!.toLowerCase(),
          name: profile.name,
        }
    }
  }

const providerConfigs = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    providerAuthorizationUrl: 'https://github.com/login/oauth/authorize',
    scopes: ['read:user', 'user:email'],
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    providerAuthorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['openid', 'email', 'profile'],
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  },
} satisfies Record<OAuthProvider, unknown>

export const isProviderEnabled = (provider: OAuthProvider): boolean =>
  Boolean(providerConfigs[provider].clientId && providerConfigs[provider].clientSecret)

export const oauthPlugins: Plugin[] = (['github', 'google'] as const).map((provider) => {
  const config = providerConfigs[provider]

  return OAuth2Plugin({
    authCollection: 'users',
    authorizePath: `/oauth/${provider}`,
    callbackPath: `/oauth/${provider}/callback`,
    clientId: config.clientId ?? '',
    clientSecret: config.clientSecret ?? '',
    enabled: isProviderEnabled(provider),
    failureRedirect: (req, error) => {
      req.payload.logger.warn({ err: error, provider }, 'OAuth sign-in failed')
      return `${getServerSideURL()}${failurePath(req.searchParams.get('state'), error)}`
    },
    getUserInfo: createGetUserInfo(provider),
    pkceEnabled: true,
    providerAuthorizationUrl: config.providerAuthorizationUrl,
    scopes: config.scopes,
    serverURL: getServerSideURL(),
    strategyName: provider,
    subFieldName: SUB_FIELDS[provider],
    successRedirect: (req) => `${getServerSideURL()}${safeReturnPath(req.searchParams.get('state'))}`,
    tokenEndpoint: config.tokenEndpoint,
    useEmailAsIdentity: false,
  })
})
