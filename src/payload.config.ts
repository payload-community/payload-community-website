import { mongooseAdapter } from '@payloadcms/db-mongodb'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Builds } from './collections/Builds'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Plugins } from './collections/Plugins'
import { PostMedia } from './collections/PostMedia'
import { Posts } from './collections/Posts'
import { Resources } from './collections/Resources'
import { Sources } from './collections/Sources'
import { Users } from './collections/Users'
import { emailAdapter } from './email/adapter'
import { defaultLexical } from './fields/defaultLexical'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { i18n } from './i18n'
import { jobs } from './jobs'
import { moderationEndpoint } from './moderation/endpoint'
import { plugins } from './plugins'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      afterNavLinks: ['@/moderation/components/ModerationNavLink#ModerationNavLink'],
      beforeDashboard: ['@/moderation/components/ModerationWidget#ModerationWidget'],
      beforeLogin: ['@/components/BeforeLogin'],
      views: {
        moderation: {
          Component: '@/moderation/components/ModerationView#ModerationView',
          path: '/moderation',
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' | Payload CMS Community Portal',
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  editor: defaultLexical,
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  collections: [Posts, Resources, Plugins, Builds, PostMedia, Media, Pages, Sources, Users],
  cors: [getServerSideURL()].filter(Boolean),
  email: emailAdapter,
  endpoints: [moderationEndpoint],
  globals: [Header, Footer],
  i18n,
  jobs,
  logger: {
    options: { level: process.env.LOG_LEVEL || 'info' },
  },
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  serverURL: getServerSideURL(),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
