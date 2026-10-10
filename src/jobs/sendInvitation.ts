import type { TaskConfig } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

import type { SendEmailInput } from './sendEmail'

export const INVITATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000

export const sendInvitationTask: TaskConfig<'sendInvitation'> = {
  slug: 'sendInvitation',
  inputSchema: [{ name: 'userId', type: 'text', required: true }],
  retries: 3,
  handler: async ({ input, req }) => {
    const { payload } = req
    const user = await payload.findByID({
      collection: 'users',
      disableErrors: true,
      id: input.userId,
      overrideAccess: true,
      req,
    })

    if (!user?.email) {
      payload.logger.info({ job: 'sendInvitation', outcome: 'skipped' }, 'job sendInvitation: user gone')
      return { output: {} }
    }

    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
      req,
    })

    if (!token) throw new Error('No reset token generated')

    await payload.db.updateOne({
      collection: 'users',
      data: {
        invitedAt: new Date().toISOString(),
        resetPasswordExpiration: new Date(Date.now() + INVITATION_VALIDITY_MS).toISOString(),
      },
      id: user.id,
      req,
    })

    const email: SendEmailInput<'invitation'> = {
      data: { url: `${getServerSideURL()}/admin/reset/${token}` },
      template: 'invitation',
      to: user.email,
    }
    await payload.jobs.queue({ input: email, queue: 'default', req, task: 'sendEmail' })

    payload.logger.info({ job: 'sendInvitation', outcome: 'queued' }, 'job sendInvitation: email queued')
    return { output: {} }
  },
}
