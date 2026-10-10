import type { CollectionConfig } from 'payload'

import { generatePreviewPath } from '@/utilities/generatePreviewPath'

import { moderatedAccess } from './access'
import { populateAuthor, populatedAuthorField } from './author'
import { moderationFields } from './fields'
import { setOwnership } from './hooks'
import { revalidateDeletedEntry, revalidateEntry } from './revalidate'
import { applyModerationState, enforceDrafts, notifyTransitions } from './workflow'

type ModerationOptions = {
  hiddenField?: string
  /** `origin` value used by sync jobs; such entries are editable by admins only. */
  importedOrigin?: string
  /** Possible `origin` values; the last one is the default. */
  origins: readonly [string, ...string[]]
  /** `origin` for entries created by signed-in users. */
  userOrigin: string
}

const components = '@/moderation/components'

/**
 * Adds drafts, the shared moderation fields, workflow hooks, admin components and access rules
 * to Posts, Resources, Plugins and Builds. Collection-specific access entries override the shared
 * ones.
 */
export const moderatedCollection = (
  config: CollectionConfig,
  { hiddenField, importedOrigin, origins, userOrigin }: ModerationOptions,
): CollectionConfig => ({
  ...config,
  access: { ...moderatedAccess({ hiddenField, importedOrigin }), ...config.access },
  admin: {
    group: 'Content',
    ...config.admin,
    components: {
      ...config.admin?.components,
      beforeList: [`${components}/PendingSlotsBanner#PendingSlotsBanner`],
      edit: {
        ...config.admin?.components?.edit,
        beforeDocumentControls: [`${components}/PendingSlotsBanner#PendingSlotsNotice`],
        PublishButton: `${components}/ModeratedButtons#ModeratedPublishButton`,
        UnpublishButton: `${components}/ModeratedButtons#ModeratedUnpublishButton`,
      },
    },
    preview: (data, { req }) =>
      importedOrigin && data?.origin === importedOrigin && config.slug === 'posts'
        ? null
        : generatePreviewPath({
            collection: config.slug as 'builds' | 'plugins' | 'posts' | 'resources',
            req,
            slug: data?.slug as string,
          }),
  },
  fields: [...config.fields, ...moderationFields(origins), populatedAuthorField],
  hooks: {
    ...config.hooks,
    afterRead: [...(config.hooks?.afterRead ?? []), populateAuthor],
    afterChange: [...(config.hooks?.afterChange ?? []), notifyTransitions, revalidateEntry],
    afterDelete: [...(config.hooks?.afterDelete ?? []), revalidateDeletedEntry],
    beforeChange: [
      setOwnership({ systemOrigin: importedOrigin ?? userOrigin, userOrigin }),
      applyModerationState,
      ...(config.hooks?.beforeChange ?? []),
    ],
    beforeOperation: [enforceDrafts, ...(config.hooks?.beforeOperation ?? [])],
  },
  versions: { drafts: { validate: false }, maxPerDoc: 25 },
})
