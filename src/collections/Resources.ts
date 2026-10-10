import { slugField } from 'payload'

import { moderatedCollection } from '@/moderation/collection'
import { validateURL } from '@/fields/validateURL'

export const RESOURCE_TYPES = [
  'website',
  'blog',
  'docs',
  'video',
  'course',
  'tool',
  'community',
  'other',
] as const

export const Resources = moderatedCollection(
  {
    slug: 'resources',
    admin: {
      defaultColumns: ['title', 'type', 'url', 'moderation.status', 'updatedAt'],
      useAsTitle: 'title',
    },
    fields: [
      { name: 'title', type: 'text', index: true, required: true },
      { name: 'url', type: 'text', required: true, unique: true, validate: validateURL },
      { name: 'description', type: 'textarea', required: true },
      {
        name: 'type',
        type: 'select',
        index: true,
        options: RESOURCE_TYPES.map((value) => ({
          label: value[0].toUpperCase() + value.slice(1),
          value,
        })),
        required: true,
      },
      { name: 'tags', type: 'text', hasMany: true, index: true },
      slugField(),
    ],
  },
  { origins: ['community'], userOrigin: 'community' },
)
