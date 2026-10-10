import type { CollectionConfig } from 'payload'

import { moderatedAccess } from './access'
import { moderationFields } from './fields'
import { setOwnership } from './hooks'

type ModerationOptions = {
  hiddenField?: string
  /** `origin` value used by sync jobs; such entries are editable by admins only. */
  importedOrigin?: string
  /** Possible `origin` values; the last one is the default. */
  origins: readonly [string, ...string[]]
  /** `origin` for entries created by signed-in users. */
  userOrigin: string
}

/**
 * Adds drafts, the shared moderation fields, ownership hooks and access rules to Posts, Resources,
 * Plugins and Builds. Collection-specific access entries override the shared ones.
 */
export const moderatedCollection = (
  config: CollectionConfig,
  { hiddenField, importedOrigin, origins, userOrigin }: ModerationOptions,
): CollectionConfig => ({
  ...config,
  access: { ...moderatedAccess({ hiddenField, importedOrigin }), ...config.access },
  admin: { group: 'Content', ...config.admin },
  fields: [...config.fields, ...moderationFields(origins)],
  hooks: {
    ...config.hooks,
    beforeChange: [
      setOwnership({ systemOrigin: importedOrigin ?? userOrigin, userOrigin }),
      ...(config.hooks?.beforeChange ?? []),
    ],
  },
  versions: { drafts: { validate: false }, maxPerDoc: 25 },
})
