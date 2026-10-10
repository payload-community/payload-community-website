import type { CollectionSlug, Payload } from 'payload'
import { slugify } from 'payload/shared'
import sharp from 'sharp'

import type { User } from '@/payload-types'

import { markdownToLexical, seed, SEED_CONTEXT, type SeedSummary } from './index'
import { PAYLOAD_BLOG_SOURCE } from './content'

/** Known local-only password for the sample accounts. */
export const DEV_PASSWORD = 'plc-dev-password'

export const DEV_USERS = [
  { email: 'admin@example.com', name: 'Ada Admin', roles: ['admin'] },
  { email: 'moderator@example.com', name: 'Mo Moderator', roles: ['moderator'] },
  { email: 'user@example.com', name: 'Uma User', roles: [] },
] as const satisfies readonly Pick<User, 'email' | 'name' | 'roles'>[]

type Status = 'pending' | 'published' | 'rejected'

const moderationState = (status: Status, moderatorId: string) => ({
  _status: status === 'published' ? ('published' as const) : ('draft' as const),
  moderation: {
    moderatedAt: status === 'pending' ? null : new Date().toISOString(),
    moderatedBy: status === 'pending' ? null : moderatorId,
    rejectionReason: status === 'rejected' ? 'Sample rejection: please add more details.' : null,
    status,
    submittedAt: new Date().toISOString(),
  },
})

const sampleImage = async (color: string): Promise<Buffer> =>
  sharp({ create: { background: color, channels: 3, height: 630, width: 1200 } })
    .png()
    .toBuffer()

/** Local sample data on top of the production seed. Idempotent; never run in production. */
export const seedDev = async (payload: Payload): Promise<SeedSummary> => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:dev refuses to run with NODE_ENV=production')
  }

  const summary = await seed(payload)
  const context = SEED_CONTEXT

  const ensure = async (
    collection: CollectionSlug,
    key: string,
    where: Record<string, { equals: unknown }>,
    create: () => Promise<{ id: number | string }>,
  ): Promise<string> => {
    const { docs } = await payload.find({ collection, depth: 0, limit: 1, where })
    if (docs[0]) {
      summary[key] = 'exists'
      return String(docs[0].id)
    }
    const doc = await create()
    summary[key] = 'created'
    return String(doc.id)
  }

  const users: Record<string, string> = {}
  for (const user of DEV_USERS) {
    users[user.email] = await ensure('users', `user:${user.email}`, { email: { equals: user.email } }, () =>
      payload.create({
        collection: 'users',
        context,
        data: { ...user, _verified: true, password: DEV_PASSWORD, roles: [...user.roles] },
      }),
    )
  }
  const author = users['user@example.com']
  const moderator = users['moderator@example.com']

  const imageId = await ensure(
    'post-media',
    'post-media:sample',
    { alt: { equals: 'Sample image' } },
    async () =>
      payload.create({
        collection: 'post-media',
        context,
        data: { alt: 'Sample image', createdBy: author },
        file: {
          data: await sampleImage('#4f46e5'),
          mimetype: 'image/png',
          name: 'sample-image.png',
          size: 0,
        },
      }),
  )

  const sourceId = await ensure(
    'sources',
    'source:payload-blog',
    { endpoint: { equals: PAYLOAD_BLOG_SOURCE.endpoint } },
    () => payload.create({ collection: 'sources', context, data: { ...PAYLOAD_BLOG_SOURCE } }),
  )

  const statuses: Status[] = ['published', 'pending', 'rejected']

  await ensure('posts', 'post:imported', { url: { equals: 'https://payloadcms.com/posts/sample' } }, () =>
    payload.create({
      collection: 'posts',
      context,
      data: {
        ...moderationState('published', moderator),
        date: new Date().toISOString(),
        externalId: 'sample',
        origin: 'imported',
        slug: 'sample-imported-post',
        source: sourceId,
        summary: 'An imported sample post from the Payload blog source.',
        tags: ['Releases'],
        title: 'Sample imported post',
        url: 'https://payloadcms.com/posts/sample',
      },
    }),
  )

  for (const status of statuses) {
    const title = `Sample community post (${status})`
    await ensure('posts', `post:${status}`, { title: { equals: title } }, async () =>
      payload.create({
        collection: 'posts',
        context,
        data: {
          ...moderationState(status, moderator),
          content: await markdownToLexical(
            payload,
            `This is a **${status}** sample post written by a community member.`,
          ),
          createdBy: author,
          date: new Date().toISOString(),
          image: imageId,
          origin: 'community',
          slug: slugify(title) ?? '',
          summary: `A ${status} community post for local development.`,
          tags: ['Guides'],
          title,
        },
      }),
    )

    const resourceTitle = `Sample resource (${status})`
    await ensure('resources', `resource:${status}`, { title: { equals: resourceTitle } }, () =>
      payload.create({
        collection: 'resources',
        context,
        data: {
          ...moderationState(status, moderator),
          createdBy: author,
          description: `A ${status} sample resource.`,
          origin: 'community',
          slug: slugify(resourceTitle) ?? '',
          tags: ['sample'],
          title: resourceTitle,
          type: 'docs',
          url: `https://example.com/resources/${status}`,
        },
      }),
    )

    const pluginName = `Sample manual plugin (${status})`
    await ensure('plugins', `plugin:${status}`, { name: { equals: pluginName } }, () =>
      payload.create({
        collection: 'plugins',
        context,
        data: {
          ...moderationState(status, moderator),
          createdBy: author,
          description: `A ${status} manually added sample plugin.`,
          name: pluginName,
          npmPackage: `payload-plugin-sample-${status}`,
          origin: 'manual',
        },
      }),
    )

    const buildName = `Sample build (${status})`
    await ensure('builds', `build:${status}`, { name: { equals: buildName } }, () =>
      payload.create({
        collection: 'builds',
        context,
        data: {
          ...moderationState(status, moderator),
          basePayloadVersion: '3.90.2',
          createdBy: author,
          description: `A ${status} sample build.`,
          includedChanges: [
            { title: 'Sample fix', url: 'https://github.com/payloadcms/payload/pull/1' },
          ],
          name: buildName,
          origin: 'community',
          repositoryUrl: `https://github.com/example/payload-build-${status}`,
          slug: slugify(buildName) ?? '',
          tags: ['sample'],
        },
      }),
    )
  }

  await ensure('plugins', 'plugin:imported', { fullName: { equals: 'payloadcms/payload' } }, () =>
    payload.create({
      collection: 'plugins',
      context,
      data: {
        ...moderationState('published', moderator),
        description: 'An imported sample plugin.',
        fullName: 'payloadcms/payload',
        lastPushedAt: new Date().toISOString(),
        name: 'payload',
        origin: 'imported',
        repositoryUrl: 'https://github.com/payloadcms/payload',
        stars: 42,
        topics: ['payload-plugin'],
      },
    }),
  )

  payload.logger.info({ summary }, 'seed:dev finished')
  return summary
}
