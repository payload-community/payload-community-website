import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

/** Unique-when-set fields (ADR-024): missing and null values are excluded from the index. */
export const UNIQUE_OPTIONAL_FIELDS = [
  ['users', 'githubId'],
  ['users', 'googleId'],
  ['posts', 'url'],
  ['post-media', 'originalUrl'],
  ['plugins', 'fullName'],
] as const

const nativeCollection = (payload: MigrateUpArgs['payload'], slug: string) =>
  (payload.db as unknown as MongooseAdapter).collections[slug].collection

export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  for (const [slug, field] of UNIQUE_OPTIONAL_FIELDS) {
    await nativeCollection(payload, slug).createIndex(
      { [field]: 1 },
      {
        name: `uniq_${field}`,
        partialFilterExpression: { [field]: { $type: 'string' } },
        session,
        unique: true,
      },
    )
  }
}

export async function down({ payload, session }: MigrateDownArgs): Promise<void> {
  for (const [slug, field] of UNIQUE_OPTIONAL_FIELDS) {
    await nativeCollection(payload, slug)
      .dropIndex(`uniq_${field}`, { session })
      .catch(() => undefined)
  }
}
