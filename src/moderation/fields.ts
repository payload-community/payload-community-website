import type { Field } from 'payload'

import { noOne } from '@/access'

import { MODERATION_STATUSES } from './config'

const label = (value: string) => value[0].toUpperCase() + value.slice(1)

/**
 * Sidebar fields shared by moderated collections (spec §4.1). They are read-only in the admin
 * panel; hooks, moderation actions, sync jobs and seeds write them.
 */
export const moderationFields = (origins: readonly string[]): Field[] => [
  {
    name: 'moderation',
    type: 'group',
    access: { create: noOne, update: noOne },
    admin: { position: 'sidebar', readOnly: true },
    fields: [
      {
        name: 'status',
        type: 'select',
        defaultValue: 'pending',
        index: true,
        options: MODERATION_STATUSES.map((value) => ({ label: label(value), value })),
        required: true,
      },
      {
        name: 'rejectionReason',
        type: 'textarea',
        admin: { condition: (_data, sibling) => sibling?.status === 'rejected' },
      },
      { name: 'moderatedBy', type: 'relationship', relationTo: 'users' },
      { name: 'moderatedAt', type: 'date' },
      { name: 'submittedAt', type: 'date', index: true },
    ],
  },
  {
    name: 'createdBy',
    type: 'relationship',
    access: { create: noOne, update: noOne },
    admin: { position: 'sidebar', readOnly: true },
    index: true,
    relationTo: 'users',
  },
  {
    name: 'origin',
    type: 'select',
    access: { create: noOne, update: noOne },
    admin: { position: 'sidebar', readOnly: true },
    defaultValue: origins[origins.length - 1],
    options: origins.map((value) => ({ label: label(value), value })),
  },
]
