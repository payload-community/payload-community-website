import type {
  CollectionAfterChangeHook,
  CollectionAfterOperationHook,
  CollectionBeforeLoginHook,
} from 'payload'

import { isAdmin, isSystem } from '@/access'
import type { User } from '@/payload-types'

const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

export const isConfiguredAdmin = (
  user: Pick<User, 'email' | 'githubLogin'>,
  env: { ADMIN_EMAILS?: string; ADMIN_GITHUB_LOGINS?: string } = process.env,
): boolean => {
  const logins = parseList(env.ADMIN_GITHUB_LOGINS)
  const emails = parseList(env.ADMIN_EMAILS)
  return (
    (Boolean(user.githubLogin) && logins.includes(user.githubLogin!.toLowerCase())) ||
    (Boolean(user.email) && emails.includes(user.email.toLowerCase()))
  )
}

/** Grants the admin role on sign-in (any strategy) to users listed in ADMIN_GITHUB_LOGINS / ADMIN_EMAILS. Never revokes. */
export const grantConfiguredAdminRole: CollectionBeforeLoginHook<User> = async ({ req, user }) => {
  if (!user._verified || isAdmin(user) || !isConfiguredAdmin(user)) return user

  const roles = [...(user.roles ?? []), 'admin' as const]
  await req.payload.update({
    collection: 'users',
    data: { roles },
    id: user.id,
    overrideAccess: true,
    req,
  })
  req.payload.logger.info({ userId: user.id }, 'Granted admin role from ADMIN_* configuration')

  return { ...user, roles }
}

/** A successful password reset proves mailbox access, so the account counts as verified. */
export const markVerifiedAfterReset: CollectionAfterOperationHook<'users'> = async ({
  operation,
  req,
  result,
}) => {
  if (operation !== 'resetPassword') return result

  const user = (result as unknown as { user?: User }).user
  if (user && !user._verified) {
    await req.payload.db.updateOne({
      collection: 'users',
      data: { _verificationToken: null, _verified: true },
      id: user.id,
      req,
    })
  }

  return result
}

/** Users created by an admin in the panel (not via OAuth) get an invitation email from a job. */
export const queueInvitation: CollectionAfterChangeHook<User> = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !isAdmin(req.user) || isSystem(req)) return doc
  if (doc.githubId || doc.googleId) return doc

  try {
    await req.payload.jobs.queue({
      input: { userId: String(doc.id) },
      queue: 'default',
      req,
      task: 'sendInvitation',
    })
  } catch (error) {
    req.payload.logger.error({ err: error, userId: doc.id }, 'Failed to queue invitation')
  }

  return doc
}
