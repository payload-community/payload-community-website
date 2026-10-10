import type { CollectionConfig } from 'payload'

import { adminOnly, anyone, isAdmin, noOne } from '@/access'

const readOnlyForEveryone = { create: noOne, update: noOne }

export const Sources: CollectionConfig<'sources'> = {
  slug: 'sources',
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['name', 'type', 'enabled', 'lastSyncedAt', 'lastSyncStatus'],
    group: 'Synchronization',
    hidden: ({ user }) => !isAdmin(user),
    useAsTitle: 'name',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'payload-rest',
      options: [{ label: 'Payload REST API', value: 'payload-rest' }],
      required: true,
    },
    {
      name: 'endpoint',
      type: 'text',
      admin: { description: 'e.g. https://payloadcms.com/api/posts' },
      required: true,
    },
    {
      name: 'siteUrl',
      type: 'text',
      admin: { description: 'Public site of the source, e.g. https://payloadcms.com/posts' },
      required: true,
    },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    {
      type: 'collapsible',
      admin: { position: 'sidebar' },
      label: 'Last synchronization',
      fields: [
        { name: 'lastSyncedAt', type: 'date', access: readOnlyForEveryone, admin: { readOnly: true } },
        {
          name: 'lastSyncStatus',
          type: 'select',
          access: readOnlyForEveryone,
          admin: { readOnly: true },
          options: ['success', 'partial', 'failed'],
        },
        { name: 'lastSyncError', type: 'textarea', access: readOnlyForEveryone, admin: { readOnly: true } },
        { name: 'lastSyncStats', type: 'json', access: readOnlyForEveryone, admin: { readOnly: true } },
      ],
    },
  ],
}
