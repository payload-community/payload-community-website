import { APIError, type Payload, type PayloadRequest } from 'payload'

import { plcTranslations } from '@/i18n'

import { MAX_PENDING_SUBMISSIONS, MODERATED_COLLECTIONS } from './config'

/** Latest versions of the user's entries waiting for review, over the four moderated collections. */
export async function countPendingSubmissions(
  payload: Payload,
  userId: number | string,
  req?: PayloadRequest,
): Promise<number> {
  let total = 0
  // Sequential: with `req`, the queries share the request's MongoDB transaction session.
  for (const collection of MODERATED_COLLECTIONS) {
    const { totalDocs } = await payload.find({
      collection,
      depth: 0,
      draft: true,
      limit: 1,
      overrideAccess: true,
      req,
      select: {},
      where: {
        and: [{ createdBy: { equals: userId } }, { 'moderation.status': { equals: 'pending' } }],
      },
    })
    total += totalDocs
  }
  return total
}

/** Throws a public 429 error when the user already has `MAX_PENDING_SUBMISSIONS` pending entries. */
export async function assertSubmissionSlot(req: PayloadRequest, userId: number | string): Promise<void> {
  const pending = await countPendingSubmissions(req.payload, userId, req)
  if (pending < MAX_PENDING_SUBMISSIONS) return

  req.payload.logger.info({ pending, userId }, 'moderation: submission refused (pending limit)')
  // REST requests get an API-only `req.t` without the custom `plc` namespace.
  const message = plcTranslations.en.plc.pendingLimitReached.replace(
    '{{count}}',
    String(MAX_PENDING_SUBMISSIONS),
  )
  throw new APIError(
    message,
    429,
    { limit: MAX_PENDING_SUBMISSIONS, pending },
    true,
  )
}
