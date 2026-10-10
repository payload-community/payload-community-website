import type { Block } from 'payload'

export const SectionsOverview: Block = {
  slug: 'sectionsOverview',
  interfaceName: 'SectionsOverviewBlock',
  labels: { plural: 'Sections overviews', singular: 'Sections overview' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'sections',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea', required: true },
        {
          name: 'href',
          type: 'text',
          admin: { description: 'Relative path such as /plugins' },
          required: true,
        },
      ],
    },
  ],
}
