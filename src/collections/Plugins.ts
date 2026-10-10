import { ValidationError, type CollectionBeforeValidateHook, type FieldHook } from 'payload'
import { slugify } from 'payload/shared'

import { noOne, syncFieldAccess } from '@/access'
import { emptyToNull } from '@/fields/hooks/emptyToNull'
import { validateURL } from '@/fields/validateURL'
import { moderatedCollection } from '@/moderation/collection'

/** `owner/repo` (lower-case) from a GitHub repository URL, or null. */
export const githubFullName = (url: string | null | undefined): string | null => {
  if (!url) return null
  try {
    const { hostname, pathname } = new URL(url)
    if (hostname !== 'github.com' && hostname !== 'www.github.com') return null
    const [owner, repo] = pathname.split('/').filter(Boolean)
    if (!owner || !repo) return null
    return `${owner}/${repo.replace(/\.git$/, '')}`.toLowerCase()
  } catch {
    return null
  }
}

/** Slugs never change after creation, so plugin URLs stay stable. */
const slugOnCreate: FieldHook = ({ data, operation, value }) => {
  if (operation !== 'create' || value) return value
  const fullName = data?.fullName || githubFullName(data?.repositoryUrl)
  const base = fullName ? String(fullName).replace('/', '-') : data?.name
  return base ? slugify(String(base)) : value
}

const deriveFullName: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data
  const fromUrl = githubFullName(data.repositoryUrl)
  return fromUrl && !data.fullName ? { ...data, fullName: fromUrl } : data
}

const requireRepositoryOrPackage: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const merged = { ...originalDoc, ...data }
  if (merged.origin === 'imported' || merged._status !== 'published') return data
  if (!merged.repositoryUrl && !merged.npmPackage) {
    throw new ValidationError({
      collection: 'plugins',
      errors: [{ message: 'Add a repository URL or an npm package.', path: 'repositoryUrl' }],
    })
  }
  return data
}

const syncField = { access: syncFieldAccess, admin: { position: 'sidebar' as const } }

export const Plugins = moderatedCollection(
  {
    slug: 'plugins',
    admin: {
      defaultColumns: ['name', 'fullName', 'stars', 'origin', 'hidden', 'moderation.status'],
      useAsTitle: 'name',
    },
    defaultSort: '-stars',
    fields: [
      { name: 'name', type: 'text', required: true },
      {
        name: 'slug',
        type: 'text',
        access: { update: noOne },
        admin: { position: 'sidebar', readOnly: true },
        hooks: { beforeValidate: [slugOnCreate] },
        index: true,
        unique: true,
      },
      { name: 'description', type: 'textarea', required: true },
      { name: 'repositoryUrl', type: 'text', validate: validateURL },
      { name: 'homepage', type: 'text', validate: validateURL },
      { name: 'npmPackage', type: 'text' },
      {
        name: 'fullName',
        type: 'text',
        ...syncField,
        admin: { ...syncField.admin, description: 'owner/repo on GitHub' },
        hooks: { beforeValidate: [emptyToNull] },
        index: true,
      },
      {
        type: 'collapsible',
        admin: { position: 'sidebar' },
        label: 'GitHub and npm',
        fields: [
          { name: 'ownerAvatarUrl', type: 'text', ...syncField },
          { name: 'topics', type: 'text', hasMany: true, index: true, ...syncField },
          { name: 'stars', type: 'number', index: true, ...syncField },
          { name: 'forks', type: 'number', ...syncField },
          { name: 'isFork', type: 'checkbox', ...syncField },
          { name: 'license', type: 'text', ...syncField },
          { name: 'archived', type: 'checkbox', ...syncField },
          { name: 'githubCreatedAt', type: 'date', ...syncField },
          { name: 'lastPushedAt', type: 'date', index: true, ...syncField },
          { name: 'npmLatestVersion', type: 'text', ...syncField },
          { name: 'npmWeeklyDownloads', type: 'number', ...syncField },
          { name: 'npmLastPublishedAt', type: 'date', ...syncField },
          { name: 'lastSyncedAt', type: 'date', ...syncField },
        ],
      },
      {
        name: 'hidden',
        type: 'checkbox',
        ...syncField,
        admin: {
          ...syncField.admin,
          description: 'Imported repositories no longer found by the GitHub search are hidden.',
        },
        index: true,
      },
    ],
    hooks: {
      beforeValidate: [deriveFullName, requireRepositoryOrPackage],
    },
  },
  {
    hiddenField: 'hidden',
    importedOrigin: 'imported',
    origins: ['imported', 'manual'],
    userOrigin: 'manual',
  },
)
