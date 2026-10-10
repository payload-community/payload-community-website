import { slugField } from 'payload'

import { validateURL } from '@/fields/validateURL'
import { moderatedCollection } from '@/moderation/collection'

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export const Builds = moderatedCollection(
  {
    slug: 'builds',
    admin: {
      defaultColumns: ['name', 'basePayloadVersion', 'moderation.status', 'updatedAt'],
      useAsTitle: 'name',
    },
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'textarea', required: true },
      { name: 'repositoryUrl', type: 'text', required: true, validate: validateURL },
      { name: 'homepage', type: 'text', validate: validateURL },
      { name: 'npmPackage', type: 'text' },
      {
        name: 'basePayloadVersion',
        type: 'text',
        admin: { description: 'The Payload version this build is based on, e.g. 3.90.2' },
        index: true,
        required: true,
        validate: (value: string | null | undefined) =>
          (Boolean(value) && SEMVER.test(value!)) || 'Use a version like 3.90.2',
      },
      {
        name: 'includedChanges',
        type: 'array',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'url', type: 'text', required: true, validate: validateURL },
          { name: 'notes', type: 'textarea' },
        ],
      },
      { name: 'tags', type: 'text', hasMany: true, index: true },
      slugField({ useAsSlug: 'name' }),
    ],
  },
  { origins: ['community'], userOrigin: 'community' },
)
