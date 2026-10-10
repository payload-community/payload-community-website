import type { Access, CollectionConfig, FieldAccess, TextField } from 'payload'

import { adminFieldOnly, isAdmin, isModerator, noOne, ROLES } from '@/access'
import { renderEmail } from '@/email/render'
import { emptyToNull } from '@/fields/hooks/emptyToNull'
import { getServerSideURL } from '@/utilities/getURL'

import { resendActivationEndpoint, verifyURL } from './endpoints/resendActivation'
import { anonymizeContent } from './hooks/anonymizeContent'
import {
  grantConfiguredAdminRole,
  markVerifiedAfterReset,
  queueInvitation,
} from './hooks/authHooks'
import { usersBeforeOperation } from './hooks/beforeOperation'

const self: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdmin(user)) return true
  return { id: { equals: user.id } }
}

const selfOrAdminField: FieldAccess = ({ doc, req: { user } }) =>
  isAdmin(user) || (Boolean(user) && String(doc?.id) === String(user?.id))

const providerField = (name: 'githubId' | 'googleId'): TextField => ({
  name,
  type: 'text',
  access: { create: noOne, read: selfOrAdminField, update: noOne },
  admin: { position: 'sidebar', readOnly: true },
  hooks: { beforeValidate: [emptyToNull] },
  index: true,
})

export const Users: CollectionConfig<'users'> = {
  slug: 'users',
  access: {
    admin: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => !user || isAdmin(user),
    delete: self,
    read: (args) => (isModerator(args.req.user) ? true : self(args)),
    unlock: ({ req: { user } }) => isAdmin(user),
    update: self,
  },
  defaultPopulate: {
    avatarUrl: true,
    githubLogin: true,
    name: true,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles', 'createdAt'],
    group: 'Administration',
    hidden: ({ user }) => !isAdmin(user),
    useAsTitle: 'name',
  },
  auth: {
    forgotPassword: {
      expiration: 60 * 60 * 1000,
      generateEmailHTML: async (args) =>
        (await renderEmail('forgotPassword', { url: `${getServerSideURL()}/admin/reset/${args?.token}` }))
          .html,
      generateEmailSubject: async () =>
        (await renderEmail('forgotPassword', { url: '' })).subject,
    },
    lockTime: 10 * 60 * 1000,
    maxLoginAttempts: 5,
    tokenExpiration: 7 * 24 * 60 * 60,
    useSessions: true,
    verify: {
      generateEmailHTML: async ({ token }) => (await renderEmail('verifyEmail', { url: verifyURL(token) })).html,
      generateEmailSubject: async () => (await renderEmail('verifyEmail', { url: '' })).subject,
    },
  },
  endpoints: [resendActivationEndpoint],
  fields: [
    {
      name: 'hidePasswordOnCreate',
      type: 'ui',
      admin: { components: { Field: '@/collections/Users/HidePasswordOnCreate#HidePasswordOnCreate' } },
    },
    {
      name: 'email',
      type: 'email',
      access: { read: selfOrAdminField, update: adminFieldOnly },
      required: true,
      unique: true,
    },
    { name: 'name', type: 'text' },
    {
      name: 'roles',
      type: 'select',
      access: { create: adminFieldOnly, read: selfOrAdminField, update: adminFieldOnly },
      admin: { position: 'sidebar' },
      hasMany: true,
      options: ROLES.map((role) => ({ label: role[0].toUpperCase() + role.slice(1), value: role })),
      saveToJWT: true,
    },
    {
      name: 'notifications',
      type: 'group',
      fields: [
        {
          name: 'moderation',
          type: 'checkbox',
          admin: {
            condition: (_data, _sibling, { user }) => isModerator(user),
            description: 'Email me when an entry is submitted for review.',
          },
          defaultValue: true,
        },
        {
          name: 'ownEntries',
          type: 'checkbox',
          admin: { description: 'Email me when my entries are approved or rejected.' },
          defaultValue: true,
        },
      ],
    },
    {
      name: 'avatarUrl',
      type: 'text',
      access: { create: noOne, update: noOne },
      admin: { position: 'sidebar', readOnly: true },
    },
    providerField('githubId'),
    {
      name: 'githubLogin',
      type: 'text',
      access: { create: noOne, update: noOne },
      admin: { position: 'sidebar', readOnly: true },
    },
    providerField('googleId'),
    { name: 'invitedAt', type: 'date', admin: { hidden: true } },
  ],
  hooks: {
    afterChange: [queueInvitation],
    afterOperation: [markVerifiedAfterReset],
    beforeDelete: [anonymizeContent],
    beforeLogin: [grantConfiguredAdminRole],
    beforeOperation: [usersBeforeOperation],
  },
  timestamps: true,
}
