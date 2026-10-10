import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { CollectionBeforeDeleteHook, CollectionSlug } from 'payload'

export const MODERATED_COLLECTIONS = ['posts', 'resources', 'plugins', 'builds'] as const satisfies
  readonly CollectionSlug[]

const OWNED_COLLECTIONS = [...MODERATED_COLLECTIONS, 'post-media'] as const satisfies
  readonly CollectionSlug[]

/**
 * Account deletion anonymizes the user's content in every status (ADR-011): `createdBy` is cleared
 * on the documents and on their latest versions (pending drafts). Older versions keep the bare ID.
 */
export const anonymizeContent: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const db = req.payload.db as MongooseAdapter

  for (const collection of OWNED_COLLECTIONS) {
    await db.updateMany({
      collection,
      data: { createdBy: null },
      req,
      returning: false,
      where: { createdBy: { equals: id } },
    })
  }

  for (const collection of MODERATED_COLLECTIONS) {
    await db.versions[collection]?.updateMany(
      { latest: true, 'version.createdBy': id },
      { $set: { 'version.createdBy': null } },
    )
  }

  req.payload.logger.info({ userId: id }, 'Anonymized content of deleted user')
}
