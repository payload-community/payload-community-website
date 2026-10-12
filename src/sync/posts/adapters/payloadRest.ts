import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import { slugify } from 'payload/shared'
import { z } from 'zod'

import type { Source } from '@/payload-types'

import type { AdapterContext, AdapterResult, NormalizedPost, PostSourceAdapter } from '../types'

export const PAGE_SIZE = 50
/** Upper bound for one run; the Payload blog has about 3 pages. */
const MAX_PAGES = 20
const SUMMARY_LENGTH = 500

const imageSchema = z.object({ alt: z.string().nullish(), url: z.string().nullish() })
/** Unpopulated relations arrive as IDs and are ignored. */
const maybeImage = z.union([imageSchema, z.string()]).nullish()

const postSchema = z.object({
  authors: z
    .array(
      z.union([
        z.object({ firstName: z.string().nullish(), lastName: z.string().nullish() }),
        z.string(),
      ]),
    )
    .nullish(),
  authorType: z.string().nullish(),
  category: z.union([z.object({ name: z.string(), slug: z.string() }), z.string()]).nullish(),
  excerpt: z.unknown(),
  guestAuthor: z.string().nullish(),
  id: z.string(),
  image: maybeImage,
  meta: z.object({ image: maybeImage }).nullish(),
  publishedOn: z.string().nullish(),
  slug: z.string(),
  thumbnail: maybeImage,
  title: z.string(),
})

const pageSchema = z.object({
  docs: z.array(z.unknown()),
  hasNextPage: z.boolean(),
})

export type PayloadBlogPost = z.infer<typeof postSchema>

/** Text of a Slate-style value (`[{ children: [{ text }] }]`), as used by older posts. */
const slateText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(slateText).join(' ')
  if (!value || typeof value !== 'object') return ''
  const node = value as { children?: unknown; text?: unknown }
  return typeof node.text === 'string' ? node.text : slateText(node.children)
}

export const excerptToSummary = (excerpt: unknown): string | undefined => {
  let text = ''
  if (excerpt && typeof excerpt === 'object' && 'root' in excerpt) {
    text = convertLexicalToPlaintext({
      data: excerpt as Parameters<typeof convertLexicalToPlaintext>[0]['data'],
    })
  } else {
    text = slateText(excerpt)
  }
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (!collapsed) return undefined
  return collapsed.length > SUMMARY_LENGTH
    ? `${collapsed.slice(0, SUMMARY_LENGTH - 1).trimEnd()}…`
    : collapsed
}

const authorOf = (post: PayloadBlogPost): string | undefined => {
  if (post.authorType === 'guest' && post.guestAuthor?.trim()) return post.guestAuthor.trim()
  const names = (post.authors ?? [])
    .map((author) =>
      typeof author === 'string'
        ? ''
        : [author.firstName, author.lastName].filter(Boolean).join(' ').trim(),
    )
    .filter(Boolean)
  return names.length ? names.join(', ') : post.guestAuthor?.trim() || undefined
}

/** The post image, else the video thumbnail, else the SEO image. */
const imageOf = (post: PayloadBlogPost): NormalizedPost['image'] => {
  for (const candidate of [post.image, post.thumbnail, post.meta?.image]) {
    if (candidate && typeof candidate === 'object' && candidate.url) {
      return { alt: candidate.alt?.trim() || undefined, url: candidate.url }
    }
  }
  return undefined
}

/**
 * Maps one blog post (spec §11.1). Returns null for posts without a public page: future-dated
 * placeholders and posts without a category.
 */
export const mapPayloadBlogPost = (
  post: PayloadBlogPost,
  source: Pick<Source, 'name' | 'siteUrl'>,
  now = new Date(),
): NormalizedPost | null => {
  if (!post.publishedOn || new Date(post.publishedOn) > now) return null
  if (!post.category || typeof post.category === 'string') return null

  const origin = new URL(source.siteUrl).origin
  return {
    author: authorOf(post),
    date: new Date(post.publishedOn).toISOString(),
    externalId: post.id,
    image: imageOf(post),
    slug: `${slugify(source.name) ?? 'source'}-${post.slug}`,
    summary: excerptToSummary(post.excerpt),
    tags: [post.category.name],
    title: post.title.trim(),
    url: `${origin}/posts/${post.category.slug}/${post.slug}`,
  }
}

const pageURL = (endpoint: string, page: number): string => {
  const url = new URL(endpoint)
  url.searchParams.set('depth', '1')
  url.searchParams.set('sort', '-publishedOn')
  url.searchParams.set('limit', String(PAGE_SIZE))
  url.searchParams.set('page', String(page))
  url.searchParams.set('where[_status][equals]', 'published')
  return url.toString()
}

export const payloadRestAdapter: PostSourceAdapter = {
  type: 'payload-rest',
  async fetchItems(source: Source, ctx: AdapterContext): Promise<AdapterResult> {
    const items: NormalizedPost[] = []
    let skipped = 0

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await ctx.fetch(pageURL(source.endpoint, page), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`GET ${source.endpoint} page ${page}: HTTP ${res.status}`)
      const body = pageSchema.parse(await res.json())

      let newOnPage = 0
      for (const doc of body.docs) {
        const parsed = postSchema.safeParse(doc)
        if (!parsed.success) {
          skipped++
          ctx.logger.warn(
            { issues: parsed.error.issues.slice(0, 3), source: source.name },
            'sync posts: invalid item skipped',
          )
          continue
        }
        const item = mapPayloadBlogPost(parsed.data, source)
        if (!item) {
          skipped++
          continue
        }
        items.push(item)
        if (!ctx.knownExternalIds.has(item.externalId)) newOnPage++
      }

      if (!body.hasNextPage || newOnPage === 0) break
    }

    return { items, skipped }
  },
}
