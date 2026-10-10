import { render } from '@react-email/render'
import React from 'react'

import { messages } from './messages'
import { ActionEmail } from './templates/Layout'

type ActionTemplate = 'forgotPassword' | 'invitation' | 'verifyEmail'

export type EmailTemplateData = {
  entryApproved: { title: string; type: string; url: string }
  entryRejected: { editUrl: string; reason?: string | null; title: string; type: string }
  forgotPassword: { url: string }
  invitation: { url: string }
  submissionToModerators: {
    author: string
    dashboardUrl: string
    editUrl: string
    submittedAt: string
    title: string
    type: string
  }
  verifyEmail: { url: string }
}

export type EmailTemplate = keyof EmailTemplateData

export type RenderedEmail = { html: string; subject: string; text: string }

type Built = { element: React.ReactElement; subject: string }

const actionEmail = (template: ActionTemplate, { url }: { url: string }): Built => {
  const m = messages[template]
  return {
    element: React.createElement(ActionEmail, {
      body: m.body,
      button: m.button,
      heading: m.heading,
      note: template === 'invitation' ? undefined : messages.ignoreIfNotYou,
      preview: m.preview,
      url,
    }),
    subject: m.subject,
  }
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
    new Date(iso),
  ) + ' UTC'

const builders: { [T in EmailTemplate]: (data: EmailTemplateData[T]) => Built } = {
  entryApproved: ({ title, type, url }) => {
    const m = messages.entryApproved
    return {
      element: React.createElement(ActionEmail, {
        body: m.body(type, title),
        button: m.button,
        heading: m.heading,
        note: messages.ownEntriesNote,
        preview: m.preview,
        url,
      }),
      subject: m.subject(title),
    }
  },
  entryRejected: ({ editUrl, reason, title, type }) => {
    const m = messages.entryRejected
    return {
      element: React.createElement(ActionEmail, {
        body: m.body(type, title),
        button: m.button,
        details: [{ label: m.reasonLabel, value: reason?.trim() || m.noReason }],
        heading: m.heading,
        note: messages.ownEntriesNote,
        preview: m.preview,
        url: editUrl,
      }),
      subject: m.subject(title),
    }
  },
  forgotPassword: (data) => actionEmail('forgotPassword', data),
  invitation: (data) => actionEmail('invitation', data),
  submissionToModerators: ({ author, dashboardUrl, editUrl, submittedAt, title, type }) => {
    const m = messages.submissionToModerators
    return {
      element: React.createElement(ActionEmail, {
        body: m.body,
        button: m.button,
        details: [
          { label: m.labels.type, value: type },
          { label: m.labels.title, value: title },
          { label: m.labels.author, value: author },
          { label: m.labels.submitted, value: formatDate(submittedAt) },
        ],
        heading: m.heading,
        note: m.note,
        preview: m.preview,
        secondaryLink: { label: m.editLink, url: editUrl },
        url: dashboardUrl,
      }),
      subject: m.subject(type, title),
    }
  },
  verifyEmail: (data) => actionEmail('verifyEmail', data),
}

export async function renderEmail<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateData[T],
): Promise<RenderedEmail> {
  const { element, subject } = builders[template](data)

  return {
    html: await render(element),
    subject,
    text: await render(element, { plainText: true }),
  }
}
