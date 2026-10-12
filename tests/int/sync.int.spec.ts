// @vitest-environment node
import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Source, User } from '@/payload-types'
import type { GitHubClient, GitHubRepo } from '@/sync/plugins/github'
import { syncPlugins } from '@/sync/plugins'
import { syncSource } from '@/sync/posts'

import blogPage from '../fixtures/payload-blog-posts.json'
import { resetTestDatabase, testUsers } from '../helpers/testDatabase'

let payload: Payload
let source: Source
let png: Buffer
const users = {} as Record<keyof typeof testUsers, User>

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status })

beforeAll(async () => {
  process.env.JOBS_AUTORUN = 'false'
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@/payload.config'),
  ])
  payload = await getPayload({ config })
  await resetTestDatabase(payload)

  for (const key of Object.keys(testUsers) as (keyof typeof testUsers)[]) {
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: testUsers[key].email } },
    })
    users[key] = docs[0]
  }
  const { docs } = await payload.find({ collection: 'sources', limit: 1 })
  source = docs[0]
  png = await sharp({
    create: { background: '#336699', channels: 3, height: 8, width: 8 },
  })
    .png()
    .toBuffer()
}, 60_000)

afterAll(async () => {
  await payload?.destroy()
})

describe('post sync', () => {
  const blogFetch = (page: typeof blogPage) =>
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith(source.endpoint)) return json(page)
      return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })
    })

  it('imports published posts with images and is idempotent', async () => {
    const fetchMock = blogFetch(blogPage)
    const first = await syncSource(payload, source, fetchMock as unknown as typeof fetch)
    expect(first).toMatchObject({ created: 3, skipped: 1, status: 'success', updated: 0 })

    const { docs } = await payload.find({
      collection: 'posts',
      overrideAccess: false,
      where: { externalId: { in: blogPage.docs.map((doc) => doc.id) } },
    })
    expect(docs).toHaveLength(3)
    expect(docs.every((post) => post.image && post.moderation?.status === 'published')).toBe(true)
    const imageDownloads = fetchMock.mock.calls.filter(
      ([url]) => !String(url).startsWith(source.endpoint),
    )
    expect(imageDownloads).toHaveLength(3)

    fetchMock.mockClear()
    const second = await syncSource(payload, source, fetchMock as unknown as typeof fetch)
    expect(second).toMatchObject({ created: 0, unchanged: 3, updated: 0 })
    expect(
      fetchMock.mock.calls.filter(([url]) => !String(url).startsWith(source.endpoint)),
    ).toHaveLength(0)

    const updated = await payload.findByID({ collection: 'sources', id: source.id })
    expect(updated.lastSyncStatus).toBe('success')
    expect(updated.lastSyncedAt).toBeTruthy()
  })

  it('updates changed posts in place', async () => {
    const changed = {
      ...blogPage,
      docs: blogPage.docs.map((doc, index) =>
        index === 0 ? { ...doc, title: `${doc.title} (updated)` } : doc,
      ),
    }
    const result = await syncSource(payload, source, blogFetch(changed) as unknown as typeof fetch)
    expect(result).toMatchObject({ created: 0, updated: 1, unchanged: 2 })
    const { docs } = await payload.find({
      collection: 'posts',
      where: { externalId: { equals: blogPage.docs[0].id } },
    })
    expect(docs[0].title).toMatch(/\(updated\)$/)
  })

  it('records a failed source without throwing', async () => {
    const result = await syncSource(
      payload,
      source,
      vi.fn(async () => json({}, 500)) as unknown as typeof fetch,
    )
    expect(result.status).toBe('failed')
    const updated = await payload.findByID({ collection: 'sources', id: source.id })
    expect(updated.lastSyncStatus).toBe('failed')
    expect(updated.lastSyncError).toContain('HTTP 500')
  })
})

describe('plugin sync', () => {
  const repo = (name: string, overrides: Partial<GitHubRepo> = {}): GitHubRepo => ({
    archived: false,
    created_at: '2024-01-01T00:00:00Z',
    description: `${name} description`,
    fork: false,
    forks_count: 0,
    full_name: `owner/${name}`,
    homepage: null,
    html_url: `https://github.com/owner/${name}`,
    license: { spdx_id: 'MIT' },
    name,
    owner: { avatar_url: null },
    pushed_at: '2026-10-01T00:00:00Z',
    stargazers_count: 10,
    topics: ['payload-plugin'],
    ...overrides,
  })

  const npmFetch = vi.fn(async (input: RequestInfo | URL) =>
    String(input).startsWith('https://registry.npmjs.org/')
      ? json({ 'dist-tags': { latest: '1.2.3' }, time: { '1.2.3': '2026-09-01T00:00:00.000Z' } })
      : json({ downloads: 42 }),
  ) as unknown as typeof fetch

  const github = (repos: GitHubRepo[], incomplete = false): GitHubClient => ({
    getPackageJson: async (fullName) => ({ name: fullName.split('/')[1], version: '1.0.0' }),
    getRepo: async (fullName) => repos.find((r) => r.full_name === fullName) ?? null,
    searchPluginRepos: async () => ({ incomplete, invalid: 0, repos, totalCount: repos.length }),
  })

  const plugin = async (fullName: string) => {
    const { docs } = await payload.find({
      collection: 'plugins',
      draft: true,
      where: { fullName: { equals: fullName } },
    })
    return docs[0]
  }

  let now = new Date('2026-10-11T00:00:00Z')
  const later = () => (now = new Date(now.getTime() + 24 * 60 * 60 * 1000))

  it('imports repositories with npm data and skips small forks', async () => {
    const result = await syncPlugins(payload, {
      fetch: npmFetch,
      github: github([repo('alpha'), repo('fork', { fork: true, stargazers_count: 1 })]),
      now,
    })
    expect(result).toMatchObject({ created: 1, skipped: 1, status: 'success' })
    expect(await plugin('owner/alpha')).toMatchObject({
      _status: 'published',
      hidden: false,
      npmLatestVersion: '1.2.3',
      npmPackage: 'alpha',
      npmWeeklyDownloads: 42,
      origin: 'imported',
      stars: 10,
    })
  })

  it('only refreshes GitHub and npm fields of manual plugins', async () => {
    const manual = await payload.create({
      collection: 'plugins',
      data: {
        _status: 'published',
        description: 'Written by a person',
        name: 'Manual beta',
        npmPackage: 'beta-pkg',
        repositoryUrl: 'https://github.com/owner/beta',
      } as never,
      overrideAccess: true,
      user: users.admin,
    })
    expect(manual.origin).not.toBe('imported')

    later()
    await syncPlugins(payload, {
      fetch: npmFetch,
      github: github([repo('alpha'), repo('beta', { stargazers_count: 99 })]),
      now,
    })
    expect(await plugin('owner/beta')).toMatchObject({
      description: 'Written by a person',
      name: 'Manual beta',
      npmLatestVersion: '1.2.3',
      npmPackage: 'beta-pkg',
      origin: manual.origin,
      stars: 99,
    })
  })

  it('keeps pending edits of manual plugins as drafts while updating counters', async () => {
    const beta = await plugin('owner/beta')
    await payload.update({
      collection: 'plugins',
      data: { description: 'Pending edit' },
      draft: true,
      id: beta.id,
      overrideAccess: true,
      user: users.admin,
    })

    later()
    await syncPlugins(payload, {
      fetch: npmFetch,
      github: github([repo('alpha'), repo('beta', { stargazers_count: 50 })]),
      now,
    })
    const latest = await plugin('owner/beta')
    expect(latest).toMatchObject({ _status: 'draft', description: 'Pending edit', stars: 50 })
    const live = await payload.findByID({ collection: 'plugins', id: beta.id })
    expect(live).toMatchObject({ description: 'Written by a person', stars: 50 })
  })

  it('hides imported plugins that disappear, unless the search is incomplete', async () => {
    later()
    const incomplete = await syncPlugins(payload, {
      fetch: npmFetch,
      github: github([repo('beta')], true),
      now,
    })
    expect(incomplete).toMatchObject({ hidden: 0, incomplete: true, status: 'partial' })
    expect((await plugin('owner/alpha')).hidden).toBe(false)

    later()
    const complete = await syncPlugins(payload, {
      fetch: npmFetch,
      github: github([repo('beta')]),
      now,
    })
    expect(complete.hidden).toBe(1)
    expect((await plugin('owner/alpha')).hidden).toBe(true)

    later()
    const back = await syncPlugins(payload, {
      fetch: npmFetch,
      github: github([repo('alpha'), repo('beta')]),
      now,
    })
    expect(back.unhidden).toBe(1)
    expect((await plugin('owner/alpha')).hidden).toBe(false)
  })

  it('fails when the GitHub search fails', async () => {
    const result = await syncPlugins(payload, {
      fetch: npmFetch,
      github: {
        ...github([]),
        searchPluginRepos: async () => {
          throw new Error('rate limited')
        },
      },
      now: later(),
    })
    expect(result).toMatchObject({ error: 'rate limited', hidden: 0, status: 'failed' })
  })
})
