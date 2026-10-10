import type { CollectionAfterReadHook, Field } from 'payload'

type PublicAuthor = { avatarUrl: string | null; id: string; name: string | null }

/** Virtual public profile of the submitter; `null` means the account was deleted. */
export const populatedAuthorField: Field = {
  name: 'populatedAuthor',
  type: 'group',
  admin: { hidden: true },
  fields: [
    { name: 'id', type: 'text' },
    { name: 'name', type: 'text' },
    { name: 'avatarUrl', type: 'text' },
  ],
  virtual: true,
}

const CACHE_KEY = 'plcPublicAuthors'

/**
 * Anonymous readers cannot read `users`; expose only the submitter's public profile. Lookups are
 * memoized per request so a listing page does not fetch the same user repeatedly.
 */
export const populateAuthor: CollectionAfterReadHook = async ({ doc, req }) => {
  const authorId = typeof doc?.createdBy === 'object' ? doc.createdBy?.id : doc?.createdBy
  if (!authorId) return doc

  const cache = (req.context[CACHE_KEY] ??= new Map()) as Map<string, Promise<PublicAuthor | null>>
  const key = String(authorId)
  if (!cache.has(key)) {
    cache.set(
      key,
      req.payload
        .findByID({
          collection: 'users',
          depth: 0,
          disableErrors: true,
          id: authorId,
          overrideAccess: true,
          req,
          select: { avatarUrl: true, name: true },
        })
        .then((author) =>
          author
            ? {
                avatarUrl: author.avatarUrl ?? null,
                id: String(author.id),
                name: author.name ?? null,
              }
            : null,
        ),
    )
  }

  return { ...doc, populatedAuthor: await cache.get(key) }
}
