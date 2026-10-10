import type { PayloadRequest } from 'payload'

import type { SendEmailInput } from '@/jobs/sendEmail'
import type { User } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

import { PORTAL_PATHS, type ModeratedCollection } from './config'

export const COLLECTION_LABELS: Record<ModeratedCollection, string> = {
  builds: 'Build',
  plugins: 'Plugin',
  posts: 'Post',
  resources: 'Resource',
}

export type NotifiedEntry = {
  authorId: number | string | null
  collection: ModeratedCollection
  id: number | string
  slug?: string | null
  submittedAt?: string | null
  title: string
}

export type ModerationEvent =
  | { type: 'submitted' }
  | { type: 'approved' }
  | { reason?: string | null; type: 'rejected' }

const adminURL = (path: string) => `${getServerSideURL()}/admin${path}`

const queueEmail = (req: PayloadRequest, input: SendEmailInput) =>
  req.payload.jobs.queue({ input, queue: 'default', req, task: 'sendEmail' })

const findAuthor = async (req: PayloadRequest, id: number | string | null) => {
  if (id === null) return null
  const user = (await req.payload.findByID({
    collection: 'users',
    depth: 0,
    disableErrors: true,
    id,
    overrideAccess: true,
    req,
  })) as User | null
  return user
}

/**
 * Queues one `sendEmail` job per recipient for a moderation transition (spec §10). Runs inside the
 * request transaction, so a failed save queues nothing. Returns the number of queued emails.
 */
export async function queueModerationEmails(
  req: PayloadRequest,
  entry: NotifiedEntry,
  event: ModerationEvent,
): Promise<number> {
  const type = COLLECTION_LABELS[entry.collection]
  const editUrl = adminURL(`/collections/${entry.collection}/${entry.id}`)
  const author = await findAuthor(req, entry.authorId)

  if (event.type === 'submitted') {
    const { docs: moderators } = await req.payload.find({
      collection: 'users',
      depth: 0,
      limit: 0,
      overrideAccess: true,
      pagination: false,
      req,
      where: {
        and: [
          { roles: { in: ['admin', 'moderator'] } },
          { 'notifications.moderation': { not_equals: false } },
          ...(entry.authorId === null ? [] : [{ id: { not_equals: entry.authorId } }]),
        ],
      },
    })
    for (const moderator of moderators) {
      await queueEmail(req, {
        data: {
          author: author?.name || author?.githubLogin || 'Unknown',
          dashboardUrl: adminURL('/moderation'),
          editUrl,
          submittedAt: entry.submittedAt ?? new Date().toISOString(),
          title: entry.title,
          type,
        },
        template: 'submissionToModerators',
        to: moderator.email,
      })
    }
    return moderators.length
  }

  if (!author?.email || author.notifications?.ownEntries === false) return 0

  if (event.type === 'approved') {
    await queueEmail(req, {
      data: {
        title: entry.title,
        type,
        url: `${getServerSideURL()}${PORTAL_PATHS[entry.collection]}/${entry.slug ?? ''}`,
      },
      template: 'entryApproved',
      to: author.email,
    })
  } else {
    await queueEmail(req, {
      data: { editUrl, reason: event.reason, title: entry.title, type },
      template: 'entryRejected',
      to: author.email,
    })
  }
  return 1
}
