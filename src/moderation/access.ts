import type { CollectionConfig, Where } from 'payload'

import { isAdmin, isModerator, ownedBy, publishedOnly, signedIn } from '@/access'

type Options = {
  /** Plugins: hidden imported repositories are never public. */
  hiddenField?: string
  /** `origin` value of synchronized entries; only admins may edit those. */
  importedOrigin?: string
}

/** Access rules shared by Posts, Resources, Plugins and Builds (spec §5). */
export const moderatedAccess = ({
  hiddenField,
  importedOrigin,
}: Options = {}): NonNullable<CollectionConfig['access']> => {
  const publicWhere: Where = hiddenField
    ? { and: [publishedOnly, { [hiddenField]: { not_equals: true } }] }
    : publishedOnly
  const notImported: Where | null = importedOrigin ? { origin: { not_equals: importedOrigin } } : null

  return {
    create: signedIn,
    delete: ({ req: { user } }) => (isModerator(user) ? true : user ? ownedBy(user) : false),
    read: ({ req: { user } }) => {
      if (isModerator(user)) return true
      if (!user) return publicWhere
      return { or: [publicWhere, ownedBy(user)] }
    },
    readVersions: ({ req: { user } }) =>
      isModerator(user) ? true : user ? ownedBy(user, 'version.createdBy') : false,
    update: ({ req: { user } }) => {
      if (isAdmin(user)) return true
      if (isModerator(user)) return notImported ?? true
      if (!user) return false
      return notImported ? { and: [ownedBy(user), notImported] } : ownedBy(user)
    },
  }
}
