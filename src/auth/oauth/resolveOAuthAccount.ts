export type OAuthProvider = 'github' | 'google'

export const SUB_FIELDS = { github: 'githubId', google: 'googleId' } as const

export type ProviderProfile = {
  avatarUrl: string | null
  email: string | null
  emailVerified: boolean
  /** GitHub only. */
  login?: string | null
  name: string | null
  providerId: string
}

export type KnownUser = {
  _verified?: boolean | null
  githubId?: string | null
  googleId?: string | null
  id: number | string
}

export type AccountLookup = {
  findByEmail: (email: string) => Promise<KnownUser | null>
  findByProviderId: (provider: OAuthProvider, providerId: string) => Promise<KnownUser | null>
}

export type OAuthRefusal = 'email_unverified' | 'provider_conflict' | 'provider_in_use'

export type OAuthResolution =
  /** The provider ID is already linked to this user. */
  | { kind: 'existing'; userId: KnownUser['id'] }
  /** Attach the provider ID to a user found by verified email (or by a connect intent). */
  | { claimUnverified: boolean; kind: 'link'; userId: KnownUser['id'] }
  | { kind: 'create' }
  | { kind: 'refuse'; reason: OAuthRefusal }

const sameId = (a: KnownUser['id'], b: KnownUser['id']) => String(a) === String(b)

/**
 * Decides what an OAuth sign-in means for our accounts (spec §12.1, §12.3). Pure apart from the
 * injected lookups, so every branch is unit-tested.
 */
export async function resolveOAuthAccount({
  connectUserId,
  lookup,
  profile,
  provider,
}: {
  /** Signed-in user who asked to connect this provider (validated intent cookie). */
  connectUserId?: KnownUser['id'] | null
  lookup: AccountLookup
  profile: ProviderProfile
  provider: OAuthProvider
}): Promise<OAuthResolution> {
  const subField = SUB_FIELDS[provider]
  const owner = await lookup.findByProviderId(provider, profile.providerId)

  if (connectUserId != null) {
    if (owner && !sameId(owner.id, connectUserId)) return { kind: 'refuse', reason: 'provider_in_use' }
    if (owner) return { kind: 'existing', userId: owner.id }
    return { claimUnverified: false, kind: 'link', userId: connectUserId }
  }

  if (owner) return { kind: 'existing', userId: owner.id }

  if (!profile.email || !profile.emailVerified) return { kind: 'refuse', reason: 'email_unverified' }

  const byEmail = await lookup.findByEmail(profile.email.toLowerCase())
  if (byEmail) {
    if (byEmail[subField]) return { kind: 'refuse', reason: 'provider_conflict' }
    return { claimUnverified: !byEmail._verified, kind: 'link', userId: byEmail.id }
  }

  return { kind: 'create' }
}
