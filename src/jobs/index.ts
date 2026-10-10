import type { JobsConfig } from 'payload'

import { isAdmin } from '@/access'

import { sendEmailTask } from './sendEmail'
import { sendInvitationTask } from './sendInvitation'

const autoRun = process.env.JOBS_AUTORUN !== 'false'

const isCronRequest = (headers: Headers): boolean => {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && headers.get('authorization') === `Bearer ${secret}`
}

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
  tasks: [sendEmailTask, sendInvitationTask],
}
