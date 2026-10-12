import type { JobsConfig } from 'payload'

import { isAdmin } from '@/access'

import { isCronRequest } from './access'
import { sendEmailTask } from './sendEmail'
import { sendInvitationTask } from './sendInvitation'
import { syncPluginsTask } from './syncPlugins'
import { syncPostsTask } from './syncPosts'

const autoRun = process.env.JOBS_AUTORUN !== 'false'

export const jobs: JobsConfig = {
  access: {
    cancel: ({ req }) => isAdmin(req.user) || isCronRequest(req.headers),
    queue: ({ req }) => isAdmin(req.user) || isCronRequest(req.headers),
    run: ({ req }) => isAdmin(req.user) || isCronRequest(req.headers),
  },
  autoRun: autoRun ? [{ allQueues: true, cron: '* * * * *', limit: 20 }] : [],
  jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
    ...defaultJobsCollection,
    access: {
      ...defaultJobsCollection.access,
      create: ({ req }) => isAdmin(req.user),
      delete: ({ req }) => isAdmin(req.user),
      read: ({ req }) => isAdmin(req.user),
      update: ({ req }) => isAdmin(req.user),
    },
    admin: {
      ...defaultJobsCollection.admin,
      group: 'Administration',
      hidden: ({ user }) => !isAdmin(user),
    },
  }),
  shouldAutoRun: () => autoRun,
  tasks: [sendEmailTask, sendInvitationTask, syncPostsTask, syncPluginsTask],
}
