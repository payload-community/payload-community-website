import type { CollectionConfig } from 'payload'

import { anyone, isModerator, noOne, ownedBy, signedIn } from '@/access'
import { emptyToNull } from '@/fields/hooks/emptyToNull'
import { setCreatedBy } from '@/moderation/hooks'

const ownerOrModerator: NonNullable<CollectionConfig['access']>['update'] = ({ req: { user } }) =>
  isModerator(user) ? true : user ? ownedBy(user) : false

export const PostMedia: CollectionConfig<'post-media'> = {
  slug: 'post-media',
  labels: { plural: 'Post media', singular: 'Post media' },
  access: {
    create: signedIn,
    delete: ownerOrModerator,
    read: anyone,
    update: ownerOrModerator,
  },
  admin: {
    defaultColumns: ['filename', 'alt', 'createdBy', 'createdAt'],
    group: 'Media',
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
    {
      name: 'originalUrl',
      type: 'text',
      access: { create: noOne, update: noOne },
      admin: { position: 'sidebar', readOnly: true },
      hooks: { beforeValidate: [emptyToNull] },
      index: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      access: { create: noOne, update: noOne },
      admin: { position: 'sidebar', readOnly: true },
      index: true,
      relationTo: 'users',
    },
  ],
  hooks: {
    beforeChange: [setCreatedBy],
  },
  upload: {
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', width: 300 },
      { name: 'card', width: 768 },
      { crop: 'center', height: 630, name: 'og', width: 1200 },
    ],
    mimeTypes: ['image/*'],
  },
}
