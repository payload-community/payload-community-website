import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import type { Plugin } from 'payload'

import { adminOnly, anyone, isAdmin } from '@/access'
import { oauthPlugins } from '@/auth/oauth'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import type { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

import { storagePlugin } from './storage'

const SITE_NAME = 'Payload CMS Community Portal'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) =>
  doc?.title ? `${doc.title} | ${SITE_NAME}` : SITE_NAME

const generateURL: GenerateURL<Post | Page> = ({ collectionConfig, doc }) => {
  const url = getServerSideURL()
  if (!doc?.slug) return url
  return collectionConfig?.slug === 'posts' ? `${url}/news/${doc.slug}` : `${url}/${doc.slug}`
}

export const plugins: Plugin[] = [
  storagePlugin,
  ...oauthPlugins,
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      access: {
        create: adminOnly,
        delete: adminOnly,
        read: anyone,
        update: adminOnly,
      },
      admin: {
        group: 'Website',
        hidden: ({ user }) => !isAdmin(user),
      },
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
]
