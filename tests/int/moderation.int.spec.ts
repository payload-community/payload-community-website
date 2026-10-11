// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { ModerationContext } from '@/moderation/workflow'
import type { User } from '@/payload-types'

import { resetTestDatabase, testUsers } from '../helpers/testDatabase'

let payload: Payload
const users = {} as Record<keyof typeof testUsers, User>

const asUser = (user: User) => ({ overrideAccess: false, user })

type QueuedEmail = { data: Record<string, unknown>; template: string; to: string }

const queuedEmails = async (): Promise<QueuedEmail[]> => {
  const { docs } = await payload.find({
    collection: 'payload-jobs',
    limit: 0,
    where: { taskSlug: { equals: 'sendEmail' } },
  })
  return docs.map((job) => job.input as QueuedEmail)
}

let counter = 0
const resourceData = (title = `Resource ${++counter}`) => ({
  description: `${title} description`,
  slug: `resource-${counter}`,
  title,
  type: 'docs' as const,
  url: `https://example.com/resource-${counter}`,
})

/** What `POST /api/moderation/:collection/:id/:action` does for each action. */
const moderate = (
  id: number | string,
  action: NonNullable<ModerationContext['moderationAction']>,
  reason?: string,
  user = users.moderator,
) =>
  payload.update({
    collection: 'resources',
    context: { moderationAction: action, moderationReason: reason },
    data: { _status: action === 'reject' || action === 'unpublish' ? 'draft' : 'published' },
    draft: action === 'reject',
    id,
    overrideAccess: true,
    user,
  })

const latest = (id: number | string) => payload.findByID({ collection: 'resources', draft: true, id })
const published = (id: number | string) =>
  payload.find({ collection: 'resources', overrideAccess: false, where: { id: { equals: id } } })

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

beforeEach(async () => {
  await payload.delete({ collection: 'payload-jobs', where: { id: { exists: true } } })
})

afterAll(async () => {
  await payload?.destroy()
})

describe('pre-moderation workflow', () => {
  let entryId: number | string

  it('keeps a regular user submission as a pending draft and notifies moderators (T1)', async () => {
    const created = await payload.create({
      collection: 'resources',
      data: { ...resourceData('First submission'), _status: 'published' } as never,
      ...asUser(users.user),
    })
    entryId = created.id

    expect(created._status).toBe('draft')
    expect(created.moderation.status).toBe('pending')
    expect(created.moderation.submittedAt).toBeTruthy()
    expect((await published(entryId)).totalDocs).toBe(0)

    const emails = await queuedEmails()
    expect(emails.map((e) => e.to).sort()).toEqual([testUsers.admin.email, testUsers.moderator.email])
    expect(emails[0]).toMatchObject({
      data: { author: 'Uma User', title: 'First submission', type: 'Resource' },
      template: 'submissionToModerators',
    })
  })

  it('ignores moderation values sent by the author', async () => {
    const updated = await payload.update({
      collection: 'resources',
      data: { moderation: { status: 'published' } } as never,
      id: entryId,
      ...asUser(users.user),
    })
    expect(updated.moderation.status).toBe('pending')
    expect(await queuedEmails()).toEqual([])
  })

  it('refuses moderation actions from regular users', async () => {
    await expect(moderate(entryId, 'approve', undefined, users.user)).rejects.toMatchObject({ status: 403 })
  })

  it('publishes the latest draft on approval and emails the author (T5)', async () => {
    const approved = await moderate(entryId, 'approve')

    expect(approved._status).toBe('published')
    expect(approved.moderation).toMatchObject({ status: 'published' })
    expect(approved.moderation.moderatedBy).toMatchObject({ id: users.moderator.id })
    expect((await published(entryId)).totalDocs).toBe(1)

    expect(await queuedEmails()).toEqual([
      {
        data: { title: 'First submission', type: 'Resource', url: expect.stringMatching(/\/resources\/resource-\d+$/) },
        template: 'entryApproved',
        to: testUsers.user.email,
      },
    ])
  })

  it('keeps the published version live while an edit waits for review (T3)', async () => {
    await payload.update({
      collection: 'resources',
      data: { title: 'Edited title' },
      id: entryId,
      ...asUser(users.user),
    })

    expect((await latest(entryId)).moderation.status).toBe('pending')
    expect((await published(entryId)).docs[0]).toMatchObject({ title: 'First submission' })
    expect((await queuedEmails()).map((e) => e.template)).toEqual([
      'submissionToModerators',
      'submissionToModerators',
    ])
  })

  it('keeps the published version on rejection and emails the reason (T6)', async () => {
    await moderate(entryId, 'reject', 'Please add a better description.')

    const current = await latest(entryId)
    expect(current.moderation).toMatchObject({
      rejectionReason: 'Please add a better description.',
      status: 'rejected',
    })
    expect((await published(entryId)).docs[0]).toMatchObject({ title: 'First submission' })
    expect(await queuedEmails()).toEqual([
      {
        data: {
          editUrl: expect.stringMatching(new RegExp(`/admin/collections/resources/${entryId}$`)),
          reason: 'Please add a better description.',
          title: 'Edited title',
          type: 'Resource',
        },
        template: 'entryRejected',
        to: testUsers.user.email,
      },
    ])
  })

  it('resubmits a rejected entry as pending (T4)', async () => {
    const resubmitted = await payload.update({
      collection: 'resources',
      data: { description: 'A much better description' },
      id: entryId,
      ...asUser(users.user),
    })
    expect(resubmitted.moderation).toMatchObject({ rejectionReason: null, status: 'pending' })
    expect(await queuedEmails()).toHaveLength(2)
  })

  it('treats Payload’s Unpublish control as the unpublish action (T7)', async () => {
    const unpublished = await payload.update({
      collection: 'resources',
      data: { _status: 'draft' },
      id: entryId,
      ...asUser(users.moderator),
    })
    expect(unpublished._status).toBe('draft')
    expect(unpublished.moderation.status).toBe('unpublished')
    expect((await published(entryId)).totalDocs).toBe(0)
    expect(await queuedEmails()).toEqual([])
  })

  it('re-publishes an unpublished entry', async () => {
    const republished = await moderate(entryId, 'republish')
    expect(republished._status).toBe('published')
    expect(republished.moderation.status).toBe('published')
    expect((await queuedEmails()).map((e) => e.template)).toEqual(['entryApproved'])
  })

  it('lets the author unpublish their own entry', async () => {
    const unpublished = await moderate(entryId, 'unpublish', undefined, users.user)
    expect(unpublished._status).toBe('draft')
    expect(unpublished.moderation.status).toBe('unpublished')
    expect(unpublished.moderation.moderatedBy).toMatchObject({ id: users.user.id })
    expect((await published(entryId)).totalDocs).toBe(0)
    expect(await queuedEmails()).toEqual([])
  })

  it('resubmits an entry the author unpublished as pending', async () => {
    const resubmitted = await payload.update({
      collection: 'resources',
      data: { title: 'Back again' },
      id: entryId,
      ...asUser(users.user),
    })
    expect(resubmitted._status).toBe('draft')
    expect(resubmitted.moderation.status).toBe('pending')
    expect((await published(entryId)).totalDocs).toBe(0)
  })

  it('refuses unpublishing entries of other users', async () => {
    const other = await payload.create({
      collection: 'resources',
      data: { ...resourceData(), _status: 'published' } as never,
      ...asUser(users.moderator),
    })
    expect(other.moderation.status).toBe('published')
    await expect(moderate(other.id, 'unpublish', undefined, users.user)).rejects.toMatchObject({ status: 403 })
    expect((await published(other.id)).totalDocs).toBe(1)
  })
})

describe('submission limit', () => {
  it('refuses a fourth pending submission with a 429 and allows editing pending entries (T2)', async () => {
    const { totalDocs: before } = await payload.find({
      collection: 'resources',
      draft: true,
      where: { and: [{ createdBy: { equals: users.user.id } }, { 'moderation.status': { equals: 'pending' } }] },
    })
    const ids: (number | string)[] = []
    for (let i = before; i < 3; i++) {
      const created = await payload.create({ collection: 'resources', data: resourceData() as never, ...asUser(users.user) })
      ids.push(created.id)
    }

    await expect(
      payload.create({ collection: 'builds', data: { name: 'Fourth', description: 'x' } as never, ...asUser(users.user) }),
    ).rejects.toMatchObject({
      data: { limit: 3, pending: 3 },
      message: expect.stringMatching(/You have 3 submissions waiting for review/),
      status: 429,
    })

    await expect(
      payload.update({ collection: 'resources', data: { title: 'Still pending' }, id: ids[0], ...asUser(users.user) }),
    ).resolves.toMatchObject({ moderation: { status: 'pending' } })

    await payload.delete({ collection: 'resources', id: ids[0], ...asUser(users.user) })
    await expect(
      payload.create({ collection: 'resources', data: resourceData() as never, ...asUser(users.user) }),
    ).resolves.toMatchObject({ moderation: { status: 'pending' } })
  })

  it('does not limit moderators', async () => {
    for (let i = 0; i < 4; i++) {
      await payload.create({ collection: 'resources', data: resourceData(), draft: true, ...asUser(users.moderator) })
    }
  })
})

describe('moderators and system writes', () => {
  it('publishes directly on Publish (T8) and keeps new drafts pending (T9) without emails', async () => {
    const live = await payload.create({
      collection: 'resources',
      data: { ...resourceData(), _status: 'published' } as never,
      ...asUser(users.moderator),
    })
    expect(live.moderation.status).toBe('published')

    const draft = await payload.create({
      collection: 'resources',
      data: resourceData(),
      draft: true,
      ...asUser(users.moderator),
    })
    expect(draft.moderation.status).toBe('pending')
    expect(await queuedEmails()).toEqual([])
  })

  it('counts publishing someone else’s pending entry as an approval', async () => {
    const { docs } = await payload.find({
      collection: 'resources',
      draft: true,
      limit: 1,
      where: { and: [{ createdBy: { equals: users.user.id } }, { 'moderation.status': { equals: 'pending' } }] },
    })
    const approved = await payload.update({
      collection: 'resources',
      data: { _status: 'published' },
      id: docs[0].id,
      ...asUser(users.moderator),
    })
    expect(approved.moderation.status).toBe('published')
    expect((await queuedEmails()).map((e) => e.template)).toEqual(['entryApproved'])
  })

  it('publishes system imports and keeps their status on updates (T11)', async () => {
    const imported = await payload.create({
      collection: 'posts',
      context: { system: true },
      data: { _status: 'published', origin: 'imported', slug: 'imported-post', title: 'Imported post' } as never,
    })
    expect(imported.moderation.status).toBe('published')

    const updated = await payload.update({
      collection: 'posts',
      context: { system: true },
      data: { title: 'Imported post (updated)' },
      id: imported.id,
    })
    expect(updated.moderation.status).toBe('published')
    expect(await queuedEmails()).toEqual([])
  })

  it('does not email authors who turned notifications off', async () => {
    await payload.update({
      collection: 'users',
      data: { notifications: { ownEntries: false } },
      id: users.user.id,
    })
    const created = await payload.create({ collection: 'resources', data: resourceData() as never, ...asUser(users.user) })
    await payload.delete({ collection: 'payload-jobs', where: { id: { exists: true } } })

    await moderate(created.id, 'reject', 'No')
    expect(await queuedEmails()).toEqual([])
  })
})
