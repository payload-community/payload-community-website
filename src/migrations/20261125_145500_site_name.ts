import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

import { SITE_NAME } from '@/website/siteName'

/** Public name before ADR-032. */
export const PREVIOUS_SITE_NAME = 'Payload CMS Community Portal'

const CONTENT_SLUGS = ['pages', 'posts'] as const

const isBsonValue = (value: object): boolean =>
  value instanceof Date || '_bsontype' in value

/**
 * Replaces `from` with `to` in strings, leaving BSON values (ids, dates) untouched.
 * Returns the original reference when nothing changed.
 */
export const replaceSiteName = (
  value: unknown,
  from: string,
  to: string,
): { changed: boolean; value: unknown } => {
  if (typeof value === 'string') {
    if (!value.includes(from)) return { changed: false, value }
    return { changed: true, value: value.replaceAll(from, to) }
  }
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const result = replaceSiteName(item, from, to)
      changed = changed || result.changed
      return result.value
    })
    return changed ? { changed: true, value: next } : { changed: false, value }
  }
  if (value && typeof value === 'object') {
    if (isBsonValue(value)) return { changed: false, value }
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const result = replaceSiteName(item, from, to)
      changed = changed || result.changed
      next[key] = result.value
    }
    return changed ? { changed: true, value: next } : { changed: false, value }
  }
  return { changed: false, value }
}

const renameIn = async (
  payload: MigrateUpArgs['payload'],
  slug: string,
  versions: boolean,
  from: string,
  to: string,
  session: MigrateUpArgs['session'],
): Promise<number> => {
  const db = payload.db as MongooseAdapter
  const model = versions ? db.versions[slug] : db.collections[slug]
  if (!model) return 0

  const docs = await model.collection.find({}, { session }).toArray()
  let updated = 0
  for (const doc of docs) {
    const result = replaceSiteName(doc, from, to)
    if (!result.changed) continue
    await model.collection.replaceOne({ _id: doc._id }, result.value as typeof doc, { session })
    updated += 1
  }
  return updated
}

const renameContent = async ({
  from,
  payload,
  session,
  to,
}: {
  from: string
  payload: MigrateUpArgs['payload']
  session: MigrateUpArgs['session']
  to: string
}): Promise<void> => {
  const summary: Record<string, number> = {}
  for (const slug of CONTENT_SLUGS) {
    summary[slug] = await renameIn(payload, slug, false, from, to, session)
    summary[`${slug} versions`] = await renameIn(payload, slug, true, from, to, session)
  }
  payload.logger.info({ from, summary, to }, 'site name migration finished')
}

export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  await renameContent({ from: PREVIOUS_SITE_NAME, payload, session, to: SITE_NAME })
}

export async function down({ payload, session }: MigrateDownArgs): Promise<void> {
  await renameContent({ from: SITE_NAME, payload, session, to: PREVIOUS_SITE_NAME })
}
