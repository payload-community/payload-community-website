import { render } from '@react-email/render'
import React from 'react'

import { messages } from './messages'
import { ActionEmail } from './templates/Layout'

type ActionTemplate = 'forgotPassword' | 'invitation' | 'verifyEmail'

export type EmailTemplateData = {
  forgotPassword: { url: string }
  invitation: { url: string }
  verifyEmail: { url: string }
}

export type EmailTemplate = keyof EmailTemplateData

export type RenderedEmail = { html: string; subject: string; text: string }

const actionEmail = (template: ActionTemplate, url: string) => {
  const m = messages[template]
  return React.createElement(ActionEmail, {
    body: m.body,
    button: m.button,
    heading: m.heading,
    note: template === 'invitation' ? undefined : messages.ignoreIfNotYou,
    preview: m.preview,
    url,
  })
}

export async function renderEmail<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateData[T],
): Promise<RenderedEmail> {
  const element = actionEmail(template, data.url)

  return {
    html: await render(element),
    subject: messages[template].subject,
    text: await render(element, { plainText: true }),
  }
}
