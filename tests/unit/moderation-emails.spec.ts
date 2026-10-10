// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { renderEmail } from '@/email/render'

describe('moderation emails', () => {
  it('lists the submission details and links for moderators', async () => {
    const email = await renderEmail('submissionToModerators', {
      author: 'Uma User',
      dashboardUrl: 'https://plc.test/admin/moderation',
      editUrl: 'https://plc.test/admin/collections/resources/1',
      submittedAt: '2026-10-10T12:00:00.000Z',
      title: 'Great resource',
      type: 'Resource',
    })
    expect(email.subject).toBe('New resource to review: Great resource')
    expect(email.text).toContain('Uma User')
    expect(email.text).toContain('10 Oct 2026, 12:00 UTC')
    expect(email.html).toContain('https://plc.test/admin/moderation')
    expect(email.html).toContain('https://plc.test/admin/collections/resources/1')
  })

  it('links approved entries to their portal page', async () => {
    const email = await renderEmail('entryApproved', {
      title: 'My plugin',
      type: 'Plugin',
      url: 'https://plc.test/plugins/my-plugin',
    })
    expect(email.subject).toBe('Your entry is published: My plugin')
    expect(email.html).toContain('https://plc.test/plugins/my-plugin')
  })

  it('includes the rejection reason, or says none was given', async () => {
    const data = { editUrl: 'https://plc.test/admin/collections/posts/2', title: 'My post', type: 'Post' }
    expect((await renderEmail('entryRejected', { ...data, reason: 'Off topic' })).text).toContain('Off topic')
    expect((await renderEmail('entryRejected', { ...data, reason: null })).text).toContain('No reason was given.')
  })
})
