import crypto from 'node:crypto'

import type { Endpoint } from 'payload'
import { z } from 'zod'

import type { SendEmailInput } from '@/jobs/sendEmail'
import { getServerSideURL } from '@/utilities/getURL'

const bodySchema = z.object({ email: z.email() })

export const RESEND_ACTIVATION_MESSAGE =
  'If an account with this email is waiting for activation, a new activation link has been sent.'

/** `POST /api/users/resend-activation` — Payload has no built-in resend operation. No account enumeration. */
export const resendActivationEndpoint: Endpoint = {
  handler: async (req) => {
    const body = bodySchema.safeParse(await req.json?.().catch(() => null))
    if (!body.success) {
      return Response.json({ message: 'A valid email address is required.' }, { status: 400 })
    }

    const { docs } = await req.payload.find({
      collection: 'users',
      limit: 1,
      overrideAccess: true,
      req,
      showHiddenFields: true,
      where: { email: { equals: body.data.email.toLowerCase() }, _verified: { not_equals: true } },
    })
    const user = docs[0]

    if (user) {
      const token = crypto.randomBytes(20).toString('hex')
      await req.payload.db.updateOne({
        collection: 'users',
        data: { _verificationToken: token },
        id: user.id,
        req,
      })
      const email: SendEmailInput<'verifyEmail'> = {
        data: { url: verifyURL(token) },
        template: 'verifyEmail',
        to: user.email,
      }
      await req.payload.jobs.queue({ input: email, queue: 'default', req, task: 'sendEmail' })
    }

    return Response.json({ message: RESEND_ACTIVATION_MESSAGE })
  },
  method: 'post',
  path: '/resend-activation',
}

export const verifyURL = (token: string): string => `${getServerSideURL()}/admin/users/verify/${token}`
