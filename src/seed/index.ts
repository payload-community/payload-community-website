import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { Payload, RequestContext } from 'payload'

import type { Page } from '@/payload-types'

import {
  ABOUT_MARKDOWN,
  COMMUNITY_MARKDOWN,
  FOOTER_NAV,
  HEADER_NAV,
  HOME_INTRO,
  PAYLOAD_BLOG_SOURCE,
  PRIVACY_MARKDOWN,
  SECTIONS,
} from './content'

export const SEED_CONTEXT: RequestContext = { disableRevalidate: true, system: true }

export type SeedSummary = Record<string, 'created' | 'exists'>

export const markdownToLexical = async (payload: Payload, markdown: string) =>
  convertMarkdownToLexical({
    editorConfig: await editorConfigFactory.default({ config: payload.config }),
    markdown,
  })

const contentBlock = async (payload: Payload, markdown: string): Promise<Page['layout'][0]> => ({
  blockType: 'content',
  columns: [{ richText: await markdownToLexical(payload, markdown), size: 'full' }],
})

const pageData = async (payload: Payload, slug: string): Promise<Omit<Page, 'createdAt' | 'id' | 'updatedAt'>> => {
  const lowImpact = async (markdown: string): Promise<Page['hero']> => ({
    richText: await markdownToLexical(payload, markdown),
    type: 'lowImpact',
  })

  switch (slug) {
    case 'home':
      return {
        _status: 'published',
        hero: await lowImpact(HOME_INTRO),
        layout: [
          { blockType: 'sectionsOverview', sections: SECTIONS.map((section) => ({ ...section })) },
          {
            blockType: 'collectionList',
            heading: 'Latest news',
            limit: 6,
            link: { href: '/news', label: 'All news' },
            relationTo: 'posts',
            sort: 'latest',
          },
          {
            blockType: 'collectionList',
            heading: 'Popular plugins',
            limit: 6,
            link: { href: '/plugins', label: 'All plugins' },
            relationTo: 'plugins',
            sort: 'stars',
          },
        ],
        slug,
        title: 'Home',
      }
    case 'community':
      return {
        _status: 'published',
        hero: await lowImpact('# Community'),
        layout: [await contentBlock(payload, COMMUNITY_MARKDOWN)],
        slug,
        title: 'Community',
      }
    case 'about':
      return {
        _status: 'published',
        hero: await lowImpact('# About'),
        layout: [await contentBlock(payload, ABOUT_MARKDOWN)],
        slug,
        title: 'About',
      }
    default:
      return {
        _status: 'published',
        hero: await lowImpact('# Privacy policy'),
        layout: [await contentBlock(payload, PRIVACY_MARKDOWN)],
        slug,
        title: 'Privacy policy',
      }
  }
}

const navItems = (items: readonly (readonly [string, string])[]) =>
  items.map(([label, url]) => ({
    link: { label, newTab: url.startsWith('http'), type: 'custom' as const, url },
  }))

/**
 * Production seed: creates missing base content and never updates existing documents,
 * so editors' changes survive every deployment.
 */
export const seed = async (payload: Payload): Promise<SeedSummary> => {
  const summary: SeedSummary = {}
  const context = SEED_CONTEXT

  const { totalDocs: sources } = await payload.count({
    collection: 'sources',
    where: { endpoint: { equals: PAYLOAD_BLOG_SOURCE.endpoint } },
  })
  if (sources === 0) {
    await payload.create({ collection: 'sources', context, data: { ...PAYLOAD_BLOG_SOURCE } })
  }
  summary['source:payload-blog'] = sources === 0 ? 'created' : 'exists'

  for (const slug of ['home', 'community', 'about', 'privacy']) {
    const { totalDocs } = await payload.count({
      collection: 'pages',
      where: { slug: { equals: slug } },
    })
    if (totalDocs === 0) {
      await payload.create({ collection: 'pages', context, data: await pageData(payload, slug) })
    }
    summary[`page:${slug}`] = totalDocs === 0 ? 'created' : 'exists'
  }

  for (const [slug, items] of [
    ['header', HEADER_NAV],
    ['footer', FOOTER_NAV],
  ] as const) {
    const global = await payload.findGlobal({ slug, depth: 0 })
    const empty = !global.navItems?.length
    if (empty) {
      await payload.updateGlobal({ slug, context, data: { navItems: navItems(items) } })
    }
    summary[`global:${slug}`] = empty ? 'created' : 'exists'
  }

  payload.logger.info({ summary }, 'seed finished')
  return summary
}
