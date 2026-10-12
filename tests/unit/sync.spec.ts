// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { GitHubRepo } from '@/sync/plugins/github'
import { fetchNpmInfo, packageNameFrom } from '@/sync/plugins/npm'
import { githubFields, importedFields, keepRepo } from '@/sync/plugins/mapper'
import {
  excerptToSummary,
  mapPayloadBlogPost,
  payloadRestAdapter,
  type PayloadBlogPost,
} from '@/sync/posts/adapters/payloadRest'
import { changedFields } from '@/sync/write'

import blogPage from '../fixtures/payload-blog-posts.json'

const source = {
  endpoint: 'https://payloadcms.com/api/posts',
  name: 'Payload Blog',
  siteUrl: 'https://payloadcms.com/posts',
}
const NOW = new Date('2026-10-11T00:00:00Z')
const posts = blogPage.docs as PayloadBlogPost[]
const bySlug = (slug: string) => posts.find((post) => post.slug === slug)!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status })

const logger = { warn: vi.fn() } as never

describe('payload-rest adapter mapping', () => {
  it('maps a team post with its image, category and canonical URL', () => {
    const item = mapPayloadBlogPost(
      bySlug('new-in-payload-nextjs-compatibility-uploads-and-mcp-fixes'),
      source,
      NOW,
    )
    expect(item).toMatchObject({
      author: 'Payload Team',
      externalId: '6ab5672e5178ba9e8b5c70fe',
      image: { url: expect.stringContaining('release-og-v3.90.2') },
      slug: 'payload-blog-new-in-payload-nextjs-compatibility-uploads-and-mcp-fixes',
      tags: ['Releases'],
      url: 'https://payloadcms.com/posts/releases/new-in-payload-nextjs-compatibility-uploads-and-mcp-fixes',
    })
    expect(item?.summary).toBeTruthy()
    expect(item?.summary!.length).toBeLessThanOrEqual(500)
  })

  it('uses the guest author and falls back to the video thumbnail', () => {
    const item = mapPayloadBlogPost(
      bySlug('setting-up-auth-and-role-based-access-control-in-nextjs-payload'),
      source,
      NOW,
    )
    expect(item?.author).toBe('Nick Vogel')
    expect(item?.image?.url).toContain('auth-rbac-payload-vogel')
  })

  it('skips future-dated placeholders and posts without a category', () => {
    const draft = bySlug('draft')
    expect(mapPayloadBlogPost(draft, source, NOW)).toBeNull()
    expect(
      mapPayloadBlogPost({ ...draft, publishedOn: '2020-01-01T00:00:00Z' }, source, NOW),
    ).toBeNull()
  })

  it('reads Lexical and Slate excerpts and truncates long ones', () => {
    expect(excerptToSummary([{ children: [{ text: 'Hello' }, { text: 'world' }] }])).toBe(
      'Hello world',
    )
    expect(
      excerptToSummary({
        root: {
          children: [
            {
              children: [{ text: 'Lexical text', type: 'text', version: 1 }],
              type: 'paragraph',
              version: 1,
            },
          ],
          type: 'root',
          version: 1,
        },
      }),
    ).toBe('Lexical text')
    expect(excerptToSummary(null)).toBeUndefined()
    const long = excerptToSummary([{ text: 'a '.repeat(400) }])!
    expect(long.length).toBe(500)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('payloadRestAdapter.fetchItems', () => {
  it('requests published posts and skips invalid and non-public items', async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      json({ ...blogPage, docs: [...blogPage.docs, { title: 'no id' }] }),
    )
    const result = await payloadRestAdapter.fetchItems(source as never, {
      fetch: fetchMock as unknown as typeof fetch,
      knownExternalIds: new Set(),
      logger,
    })
    expect(result.items.map((item) => item.externalId)).toHaveLength(3)
    expect(result.skipped).toBe(2)
    const url = new URL(fetchMock.mock.calls[0]![0])
    expect(url.searchParams.get('where[_status][equals]')).toBe('published')
    expect(url.searchParams.get('sort')).toBe('-publishedOn')
  })

  it('stops paging once a page brings nothing new', async () => {
    const fetchMock = vi.fn(async () => json({ ...blogPage, hasNextPage: true }))
    const known = new Set(posts.map((post) => post.id))
    await payloadRestAdapter.fetchItems(source as never, {
      fetch: fetchMock as unknown as typeof fetch,
      knownExternalIds: known,
      logger,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails the source on HTTP errors', async () => {
    const fetchMock = vi.fn(async () => json({}, 503))
    await expect(
      payloadRestAdapter.fetchItems(source as never, {
        fetch: fetchMock as unknown as typeof fetch,
        knownExternalIds: new Set(),
        logger,
      }),
    ).rejects.toThrow('HTTP 503')
  })
})

const repo = (overrides: Partial<GitHubRepo> = {}): GitHubRepo => ({
  archived: false,
  created_at: '2024-01-01T00:00:00Z',
  description: 'A plugin',
  fork: false,
  forks_count: 1,
  full_name: 'Owner/Plugin',
  homepage: '',
  html_url: 'https://github.com/Owner/Plugin',
  license: { spdx_id: 'MIT' },
  name: 'plugin',
  owner: { avatar_url: 'https://avatars.githubusercontent.com/u/1' },
  pushed_at: '2026-10-01T00:00:00Z',
  stargazers_count: 5,
  topics: ['payload-plugin'],
  ...overrides,
})

describe('plugin mapping', () => {
  it('keeps originals and forks with more than 2 stars', () => {
    expect(keepRepo({ fork: false, stargazers_count: 0 })).toBe(true)
    expect(keepRepo({ fork: true, stargazers_count: 2 })).toBe(false)
    expect(keepRepo({ fork: true, stargazers_count: 3 })).toBe(true)
  })

  it('normalizes GitHub fields', () => {
    expect(githubFields(repo({ license: { spdx_id: 'NOASSERTION' } }))).toMatchObject({
      fullName: 'owner/plugin',
      license: null,
      stars: 5,
      topics: ['payload-plugin'],
    })
  })

  it('drops empty or non-http homepages and falls back to the full name', () => {
    expect(importedFields(repo({ description: ' ', homepage: 'example.com' }))).toEqual({
      description: 'Owner/Plugin',
      homepage: null,
      name: 'plugin',
      repositoryUrl: 'https://github.com/Owner/Plugin',
    })
    expect(importedFields(repo({ homepage: 'https://example.com' })).homepage).toBe(
      'https://example.com',
    )
  })
})

describe('npm enrichment', () => {
  it.each([
    [{ name: '@scope/plugin', version: '1.0.0' }, '@scope/plugin'],
    [{ name: 'plugin', private: true }, null],
    [{ name: 'root', workspaces: ['packages/*'] }, null],
    [{ name: 'root', version: '1.0.0', workspaces: ['packages/*'] }, 'root'],
    [{ name: 'Not Valid' }, null],
    [null, null],
  ])('packageNameFrom(%j) -> %s', (pkg, expected) => {
    expect(packageNameFrom(pkg)).toBe(expected)
  })

  it('reads the latest version, its date and weekly downloads', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith('https://registry.npmjs.org/')
        ? json({ 'dist-tags': { latest: '2.0.0' }, time: { '2.0.0': '2026-09-01T00:00:00.000Z' } })
        : json({ downloads: 1234 }),
    )
    await expect(
      fetchNpmInfo('@scope/plugin', fetchMock as unknown as typeof fetch),
    ).resolves.toEqual({
      npmLastPublishedAt: '2026-09-01T00:00:00.000Z',
      npmLatestVersion: '2.0.0',
      npmWeeklyDownloads: 1234,
    })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://registry.npmjs.org/@scope%2Fplugin')
  })

  it('retries rate-limited requests and reports downloads that stay unavailable', async () => {
    const registry = json({ 'dist-tags': { latest: '1.0.0' }, time: {} })
    let downloadCalls = 0
    const flaky = vi.fn(async (url: string) => {
      if (url.startsWith('https://registry.npmjs.org/')) return registry.clone()
      return ++downloadCalls === 1 ? json({}, 429) : json({ downloads: 7 })
    })
    await expect(
      fetchNpmInfo('plugin', flaky as unknown as typeof fetch, { retryDelayMs: 0 }),
    ).resolves.toMatchObject({ npmWeeklyDownloads: 7 })

    const limited = vi.fn(async (url: string) =>
      url.startsWith('https://registry.npmjs.org/') ? registry.clone() : json({}, 429),
    )
    const info = await fetchNpmInfo('plugin', limited as unknown as typeof fetch, {
      retries: 2,
      retryDelayMs: 0,
    })
    expect(info).toMatchObject({ downloadsUnavailable: true, npmLatestVersion: '1.0.0' })
    expect(limited).toHaveBeenCalledTimes(4)
  })

  it('returns null for unknown packages', async () => {
    const fetchMock = vi.fn(async () => json({ error: 'Not found' }, 404))
    await expect(fetchNpmInfo('missing', fetchMock as unknown as typeof fetch)).resolves.toBeNull()
  })
})

describe('changedFields', () => {
  it('returns only fields whose JSON value differs', () => {
    expect(
      changedFields({ a: 1, b: ['x'], c: null }, { a: 1, b: ['x', 'y'], c: undefined }),
    ).toEqual({
      b: ['x', 'y'],
    })
  })
})
