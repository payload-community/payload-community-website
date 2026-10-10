import type { Block } from 'payload'

export const COLLECTION_LIST_SORTS = {
  builds: ['latest'],
  plugins: ['stars', 'latest'],
  posts: ['latest'],
} as const

/** Lists entries of a portal collection (latest news, top plugins, featured builds). */
export const CollectionList: Block = {
  slug: 'collectionList',
  interfaceName: 'CollectionListBlock',
  labels: { plural: 'Collection lists', singular: 'Collection list' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'relationTo',
      type: 'select',
      options: [
        { label: 'News (posts)', value: 'posts' },
        { label: 'Plugins', value: 'plugins' },
        { label: 'Builds', value: 'builds' },
      ],
      required: true,
    },
    {
      name: 'sort',
      type: 'select',
      defaultValue: 'latest',
      options: [
        { label: 'Latest first', value: 'latest' },
        { label: 'Most stars (plugins)', value: 'stars' },
      ],
      required: true,
      validate: (value: unknown, { siblingData }: { siblingData: { relationTo?: string } }) => {
        const allowed = COLLECTION_LIST_SORTS[siblingData.relationTo as keyof typeof COLLECTION_LIST_SORTS]
        return !allowed || (allowed as readonly unknown[]).includes(value) || 'Not available for this collection.'
      },
    },
    { name: 'limit', type: 'number', defaultValue: 6, max: 24, min: 1, required: true },
    {
      name: 'link',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text', admin: { description: 'e.g. /news' } },
      ],
    },
  ],
}
