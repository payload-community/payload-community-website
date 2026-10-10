import { nodemailerAdapter } from '@payloadcms/email-nodemailer'

import { messages } from './messages'

export const emailAdapter = nodemailerAdapter({
  defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com',
  defaultFromName: process.env.EMAIL_FROM_NAME || messages.siteName,
  skipVerify: true,
  transportOptions: {
    auth: process.env.SMTP_USER
      ? { pass: process.env.SMTP_PASS, user: process.env.SMTP_USER }
      : undefined,
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
  },
})
