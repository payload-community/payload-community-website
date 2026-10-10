import type { CollectionAfterReadHook } from 'payload'

/**
 * Anonymous readers cannot read `users`; expose only the author's public profile on community
 * posts (a missing author means the account was deleted: "Former member").
 */
export const populateAuthor: CollectionAfterReadHook = async ({ doc, req }) => {
  const authorId = typeof doc?.createdBy === 'object' ? doc.createdBy?.id : doc?.createdBy
  if (!authorId) return doc

  const author = await req.payload.findByID({
    collection: 'users',
    depth: 0,
    disableErrors: true,
    id: authorId,
    overrideAccess: true,
    req,
    select: { avatarUrl: true, name: true },
  })

  return {
    ...doc,
    populatedAuthor: author
      ? { avatarUrl: author.avatarUrl ?? null, id: String(author.id), name: author.name ?? null }
      : null,
  }
}
