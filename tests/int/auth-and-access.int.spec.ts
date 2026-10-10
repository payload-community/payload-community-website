// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { resetTestDatabase, testUsers } from '../helpers/testDatabase'

let payload: Payload
const users = {} as Record<keyof typeof testUsers, User>

const asUser = (user: User) => ({ overrideAccess: false, user })

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
}, 60_000)

afterAll(async () => {
  await payload?.destroy()
})

describe('users', () => {
  it('lets a regular user read only their own account', async () => {
    const { docs } = await payload.find({ collection: 'users', ...asUser(users.user) })
    expect(docs.map((u) => u.email)).toEqual([testUsers.user.email])
  })

  it('ignores roles a regular user tries to give themselves', async () => {
    const updated = await payload.update({
      collection: 'users',
      data: { roles: ['admin'] },
      id: users.user.id,
      ...asUser(users.user),
    })
    expect(updated.roles ?? []).toEqual([])
  })

  it('keeps only name, email and password on self-registration', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: 'self@example.com', name: 'Self', password: 'long-enough-pw', roles: ['admin'] },
      disableVerificationEmail: true,
      overrideAccess: false,
    })
    const stored = await payload.findByID({ collection: 'users', id: created.id, showHiddenFields: true })
    expect(stored.roles ?? []).toEqual([])
    expect(stored._verified).toBe(false)
  })

  it('rejects short passwords on registration', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: { email: 'short@example.com', name: 'Short', password: 'short' },
        disableVerificationEmail: true,
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      data: { errors: [{ message: expect.stringMatching(/at least 10 characters/), path: 'password' }] },
    })
  })

  it('invites users created by an admin: verified, random password, 7-day reset link', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: 'invited@example.com', name: 'Invited' },
      ...asUser(users.admin),
    })
    expect(created._verified).toBe(true)

    await payload.jobs.run({ queue: 'default' })
    const stored = await payload.findByID({ collection: 'users', id: created.id, showHiddenFields: true })
    expect(stored.resetPasswordToken).toBeTruthy()
    const validForDays = (Date.parse(stored.resetPasswordExpiration!) - Date.now()) / 86_400_000
    expect(validForDays).toBeGreaterThan(6.9)

    const { docs } = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'sendEmail' } },
    })
    expect(docs.some((job) => (job.input as { to?: string }).to === 'invited@example.com')).toBe(true)
  })

  it('allows several users without a GitHub ID but no duplicate GitHub IDs', async () => {
    const make = (email: string, githubId: string | null) =>
      payload.create({
        collection: 'users',
        data: { _verified: true, email, githubId, name: email },
      })
    await make('nogh1@example.com', null)
    await make('nogh2@example.com', null)
    await make('gh1@example.com', '1001')
    await expect(make('gh2@example.com', '1001')).rejects.toThrow()
  })
})

describe('moderated collections', () => {
  it('shows anonymous visitors only published entries and owners their own drafts', async () => {
    const draft = await payload.create({
      collection: 'resources',
      data: {
        description: 'Draft',
        slug: 'draft-resource',
        title: 'Draft resource',
        type: 'docs',
        url: 'https://example.com/draft',
      },
      draft: true,
      ...asUser(users.user),
    })
    expect(draft.createdBy).toMatchObject({ id: users.user.id })
    expect(draft.origin).toBe('community')
    expect(draft.moderation.status).toBe('pending')

    const anon = await payload.find({ collection: 'resources', overrideAccess: false })
    expect(anon.docs.map((d) => d.id)).not.toContain(draft.id)

    const own = await payload.find({ collection: 'resources', ...asUser(users.user) })
    expect(own.docs.map((d) => d.id)).toContain(draft.id)

    const other = await payload.find({ collection: 'resources', ...asUser(users.admin) })
    expect(other.docs.map((d) => d.id)).toContain(draft.id)
  })

  it('derives fullName and a stable slug for manual plugins and drops sync fields', async () => {
    const plugin = await payload.create({
      collection: 'plugins',
      data: {
        description: 'A plugin',
        name: 'My Plugin',
        repositoryUrl: 'https://github.com/Some/Thing',
        stars: 999,
      },
      draft: true,
      ...asUser(users.user),
    })
    expect(plugin.fullName).toBe('some/thing')
    expect(plugin.slug).toBe('some-thing')
    expect(plugin.stars ?? null).toBeNull()
    expect(plugin.origin).toBe('manual')

    const renamed = await payload.update({
      collection: 'plugins',
      data: { name: 'Renamed' },
      draft: true,
      id: plugin.id,
      ...asUser(users.user),
    })
    expect(renamed.slug).toBe('some-thing')
  })

  it('does not let moderators edit imported plugins', async () => {
    const imported = await payload.create({
      collection: 'plugins',
      context: { system: true },
      data: {
        _status: 'published',
        description: 'Imported',
        fullName: 'acme/imported',
        moderation: { status: 'published' },
        name: 'imported',
        origin: 'imported',
        repositoryUrl: 'https://github.com/acme/imported',
        slug: 'acme-imported',
      },
    })
    await expect(
      payload.update({
        collection: 'plugins',
        data: { name: 'changed' },
        id: imported.id,
        ...asUser(users.moderator),
      }),
    ).rejects.toThrow()
  })

  it('keeps content and removes the author when a user is deleted', async () => {
    const author = await payload.create({
      collection: 'users',
      data: { _verified: true, email: 'leaving@example.com', name: 'Leaving' },
    })
    const build = await payload.create({
      collection: 'builds',
      data: {
        basePayloadVersion: '3.90.2',
        description: 'A build',
        name: 'Leaving build',
        repositoryUrl: 'https://github.com/example/leaving',
        slug: 'leaving-build',
      },
      draft: true,
      ...asUser(author),
    })
    await payload.delete({ collection: 'users', id: author.id })

    const after = await payload.findByID({ collection: 'builds', draft: true, id: build.id })
    expect(after.createdBy ?? null).toBeNull()
  })
})

describe('pages', () => {
  it('lets moderators edit only the Community page', async () => {
    const { docs } = await payload.find({ collection: 'pages', limit: 10 })
    const community = docs.find((p) => p.slug === 'community')!
    const about = docs.find((p) => p.slug === 'about')!
    const context = { disableRevalidate: true }

    await expect(
      payload.update({ collection: 'pages', context, data: { title: 'Community' }, id: community.id, ...asUser(users.moderator) }),
    ).resolves.toBeTruthy()
    await expect(
      payload.update({ collection: 'pages', context, data: { title: 'About' }, id: about.id, ...asUser(users.moderator) }),
    ).rejects.toThrow()
  })
})
