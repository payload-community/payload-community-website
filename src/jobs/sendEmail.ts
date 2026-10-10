import type { TaskConfig } from 'payload'

import { renderEmail, type EmailTemplate, type EmailTemplateData } from '@/email/render'

export type SendEmailInput<T extends EmailTemplate = EmailTemplate> = {
  data: EmailTemplateData[T]
  template: T
  to: string
}

export const sendEmailTask: TaskConfig<'sendEmail'> = {
  slug: 'sendEmail',
  inputSchema: [
    { name: 'to', type: 'email', required: true },
    { name: 'template', type: 'text', required: true },
    { name: 'data', type: 'json', required: true },
  ],
  retries: { attempts: 5, backoff: { type: 'exponential', delay: 30_000 } },
  handler: async ({ input, req }) => {
    const { data, template, to } = input as unknown as SendEmailInput
    const email = await renderEmail(template, data)

    await req.payload.sendEmail({ html: email.html, subject: email.subject, text: email.text, to })
    req.payload.logger.info({ job: 'sendEmail', template }, 'job sendEmail: sent')

    return { output: {} }
  },
}
