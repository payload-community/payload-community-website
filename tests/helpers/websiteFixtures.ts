import type { Payload } from 'payload'

import { markdownToLexical, SEED_CONTEXT } from '../../src/seed'
import { PAYLOAD_BLOG_SOURCE } from '../../src/seed/content'

/** Website entries the E2E tests read; the admin is the author so the regular user's pending slots stay free. */
export const fixtures = {
  build: { name: 'E2E build', slug: 'e2e-build' },
  importedPlugin: {
    fullName: 'e2e-owner/payload-plugin-imported',
    name: 'payload-plugin-imported',
    stars: 99,
  },
  importedPost: { title: 'E2E imported post', url: 'https://example.com/posts/e2e-imported' },
  pendingResource: { slug: 'e2e-pending-resource', title: 'E2E pending resource' },
  plugin: {
    name: 'E2E manual plugin',
    npmPackage: 'payload-plugin-e2e',
    slug: 'e2e-manual-plugin',
  },
  post: { slug: 'e2e-community-post', title: 'E2E community post' },
  resource: { slug: 'e2e-resource', title: 'E2E resource' },
  video: { slug: 'e2e-video-resource', title: 'E2E video resource' },
} as const

export async function createWebsiteFixtures(payload: Payload, authorId: string): Promise<void> {
  const context = SEED_CONTEXT
  const now = new Date().toISOString()
  const state = (status: 'pending' | 'published') => ({
    _status: status === 'published' ? ('published' as const) : ('draft' as const),
    createdBy: authorId,
    moderation: {
      moderatedAt: status === 'published' ? now : null,
      moderatedBy: status === 'published' ? authorId : null,
      status,
      submittedAt: now,
    },
  })

  const { docs: sources } = await payload.find({
    collection: 'sources',
    depth: 0,
    limit: 1,
    where: { endpoint: { equals: PAYLOAD_BLOG_SOURCE.endpoint } },
  })

  await payload.create({
    collection: 'posts',
    context,
    data: {
      ...state('published'),
      content: await markdownToLexical(payload, 'Written for the **E2E** website tests.'),
      date: now,
      origin: 'community',
      slug: fixtures.post.slug,
      summary: 'A community post for the E2E tests.',
      tags: ['Guides'],
      title: fixtures.post.title,
    },
  })
  await payload.create({
    collection: 'posts',
    context,
    data: {
      ...state('published'),
      date: now,
      externalId: 'e2e-imported',
      origin: 'imported',
      slug: 'e2e-imported-post',
      source: sources[0]?.id,
      summary: 'An imported post for the E2E tests.',
      tags: ['Releases'],
      title: fixtures.importedPost.title,
      url: fixtures.importedPost.url,
    },
  })

  for (const [entry, status, type] of [
    [fixtures.resource, 'published', 'docs'],
    [fixtures.video, 'published', 'video'],
    [fixtures.pendingResource, 'pending', 'docs'],
  ] as const) {
    await payload.create({
      collection: 'resources',
      context,
      data: {
        ...state(status),
        description: `${entry.title} for the E2E tests.`,
        origin: 'community',
        slug: entry.slug,
        tags: ['e2e'],
        title: entry.title,
        type,
        url: `https://example.com/resources/${entry.slug}`,
      },
    })
  }

  await payload.create({
    collection: 'plugins',
    context,
    data: {
      ...state('published'),
      description: 'A manually added plugin for the E2E tests.',
      name: fixtures.plugin.name,
      npmPackage: fixtures.plugin.npmPackage,
      origin: 'manual',
    },
  })
  await payload.create({
    collection: 'plugins',
    context,
    data: {
      ...state('published'),
      description: 'An imported plugin for the E2E tests.',
      fullName: fixtures.importedPlugin.fullName,
      lastPushedAt: now,
      name: fixtures.importedPlugin.name,
      origin: 'imported',
      repositoryUrl: `https://github.com/${fixtures.importedPlugin.fullName}`,
      stars: fixtures.importedPlugin.stars,
      topics: ['payload-plugin'],
    },
  })

  await payload.create({
    collection: 'builds',
    context,
    data: {
      ...state('published'),
      basePayloadVersion: '3.90.2',
      description: 'A build for the E2E tests.',
      includedChanges: [{ title: 'E2E fix', url: 'https://github.com/payloadcms/payload/pull/1' }],
      name: fixtures.build.name,
      origin: 'community',
      repositoryUrl: 'https://github.com/example/payload-e2e-build',
      slug: fixtures.build.slug,
      tags: ['e2e'],
    },
  })
}
