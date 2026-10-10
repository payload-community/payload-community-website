import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { slugField } from 'payload'

import { syncFieldAccess } from '@/access'
import { Banner } from '@/blocks/Banner/config'
import { Code } from '@/blocks/Code/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { emptyToNull } from '@/fields/hooks/emptyToNull'
import { moderatedCollection } from '@/moderation/collection'

import { populateAuthor } from './hooks/populateAuthor'

const isImported = (data: Record<string, unknown> | undefined) => data?.origin === 'imported'

const syncField = { access: syncFieldAccess, admin: { position: 'sidebar' as const } }

export const Posts = moderatedCollection(
  {
    slug: 'posts',
    admin: {
      defaultColumns: ['title', 'origin', 'source', 'date', 'moderation.status'],
      useAsTitle: 'title',
    },
    defaultPopulate: { date: true, image: true, slug: true, summary: true, title: true },
    defaultSort: '-date',
    fields: [
      { name: 'title', type: 'text', required: true },
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Content',
            fields: [
              { name: 'summary', type: 'textarea' },
              { name: 'image', type: 'upload', relationTo: 'post-media' },
              {
                name: 'content',
                type: 'richText',
                admin: { condition: (data) => !isImported(data) },
                editor: lexicalEditor({
                  features: ({ rootFeatures }) => [
                    ...rootFeatures,
                    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                    BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                    HorizontalRuleFeature(),
                  ],
                }),
                validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
                  isImported(siblingData) || Boolean(value) || 'Content is required.',
              },
              { name: 'tags', type: 'text', hasMany: true, index: true },
            ],
          },
          {
            name: 'meta',
            label: 'SEO',
            admin: { condition: (data) => !isImported(data) },
            fields: [
              OverviewField({
                descriptionPath: 'meta.description',
                imagePath: 'meta.image',
                titlePath: 'meta.title',
              }),
              MetaTitleField({ hasGenerateFn: true }),
              MetaImageField({ relationTo: 'post-media' }),
              MetaDescriptionField({}),
              PreviewField({
                descriptionPath: 'meta.description',
                hasGenerateFn: true,
                titlePath: 'meta.title',
              }),
            ],
          },
        ],
      },
      {
        name: 'date',
        type: 'date',
        admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar' },
        index: true,
      },
      slugField(),
      { name: 'source', type: 'relationship', relationTo: 'sources', ...syncField },
      { name: 'author', type: 'text', ...syncField },
      {
        name: 'url',
        type: 'text',
        ...syncField,
        hooks: { beforeValidate: [emptyToNull] },
        index: true,
      },
      { name: 'externalId', type: 'text', ...syncField, index: true },
      {
        name: 'populatedAuthor',
        type: 'group',
        admin: { hidden: true },
        fields: [
          { name: 'id', type: 'text' },
          { name: 'name', type: 'text' },
          { name: 'avatarUrl', type: 'text' },
        ],
        virtual: true,
      },
    ],
    hooks: {
      afterRead: [populateAuthor],
    },
  },
  { importedOrigin: 'imported', origins: ['imported', 'community'], userOrigin: 'community' },
)
