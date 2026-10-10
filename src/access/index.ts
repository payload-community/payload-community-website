import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

export const ROLES = ['admin', 'moderator'] as const
export type Role = (typeof ROLES)[number]

type UserLike = { id: number | string; roles?: Role[] | null } | null | undefined

export const hasRole = (user: UserLike, role: Role): boolean => Boolean(user?.roles?.includes(role))

export const isAdmin = (user: UserLike): boolean => hasRole(user, 'admin')

/** Moderator or admin. */
export const isModerator = (user: UserLike): boolean => isAdmin(user) || hasRole(user, 'moderator')

export const isSignedIn = (user: UserLike): boolean => Boolean(user)

/** Jobs, seeds and migrations mark their requests with `context.system` (always with `overrideAccess`). */
export const isSystem = (req: Pick<PayloadRequest, 'context'>): boolean => req.context?.system === true

export const anyone: Access = () => true
export const adminOnly: Access = ({ req }) => isAdmin(req.user)
export const moderatorOnly: Access = ({ req }) => isModerator(req.user)
export const signedIn: Access = ({ req }) => isSignedIn(req.user)

export const adminFieldOnly: FieldAccess = ({ req }) => isAdmin(req.user)
export const moderatorFieldOnly: FieldAccess = ({ req }) => isModerator(req.user)
export const noOne: FieldAccess = () => false

/** Fields written by synchronization jobs: read-only in the admin panel for everyone but admins. */
export const syncFieldAccess = { create: adminFieldOnly, update: adminFieldOnly }

export const ownedBy = (user: NonNullable<UserLike>, field = 'createdBy'): Where => ({
  [field]: { equals: user.id },
})

export const publishedOnly: Where = { _status: { equals: 'published' } }
