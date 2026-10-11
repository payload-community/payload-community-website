import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { waitForEmail } from '../helpers/mailpit'
import { testUsers } from '../helpers/testDatabase'
import { fixtures } from '../helpers/websiteFixtures'

const runJobs = async (request: APIRequestContext) => {
  const adminLogin = await request.post('/api/users/login', { data: testUsers.admin })
  const { token } = await adminLogin.json()
  const run = await request.get('/api/payload-jobs/run?queue=default', {
    headers: { Authorization: `JWT ${token}` },
  })
  expect(run.ok()).toBe(true)
}

const switchUser = async (page: Page, user: { email: string; password: string }) => {
  await page.context().clearCookies()
  await login({ page, user })
}

const queueRow = (page: Page, title: string) =>
  page.locator('tr[data-collection="resources"]').filter({ hasText: title })

test.describe('Pre-moderation', () => {
  test('a submission is rejected with a reason, then re-published, with emails', async ({ page, request }) => {
    const title = `E2E resource ${Date.now()}`

    await login({ page, user: testUsers.user })
    await page.goto('/admin/collections/resources/create')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.plc-pending-slots-notice')).toContainText('3 of 3 slots free')
    await expect(page.locator('#action-save')).toHaveCount(0)

    await page.fill('#field-title', title)
    await page.fill('#field-url', `https://example.com/${Date.now()}`)
    await page.fill('#field-description', 'Submitted from the E2E test.')
    await page.locator('#field-type .rs__control').click()
    await page.locator('.rs__option', { hasText: 'Docs' }).click()
    await page.click('#action-save-draft')
    await expect(page.locator('.payload-toast-container')).toContainText(/success/i)

    await runJobs(request)
    const submitted = await waitForEmail(testUsers.moderator.email, title)
    expect(submitted.subject).toBe(`New resource to review: ${title}`)
    expect(submitted.text).toContain('/admin/moderation')

    await switchUser(page, testUsers.moderator)
    await page.goto('/admin/moderation')
    await page.waitForLoadState('networkidle')
    const row = queueRow(page, title)
    await row.getByRole('button', { name: 'Reject' }).click()
    await row.getByLabel(/Reason/).fill('Please describe what the resource covers.')
    await row.getByRole('button', { name: 'Confirm rejection' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText('Entry rejected.')
    await expect(row).toHaveCount(0)

    await runJobs(request)
    const rejected = await waitForEmail(testUsers.user.email, `Your entry was not approved: ${title}`)
    expect(rejected.text).toContain('Please describe what the resource covers.')

    await page.goto('/admin/moderation?tab=rejected')
    await page.waitForLoadState('networkidle')
    await queueRow(page, title).getByRole('button', { name: 'Re-publish' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText('Entry published again.')

    await runJobs(request)
    const approved = await waitForEmail(testUsers.user.email, `Your entry is published: ${title}`)
    expect(approved.text).toMatch(/\/resources\/e2e-resource-\d+/)

    const published = await request.get(
      `/api/resources?where[title][equals]=${encodeURIComponent(title)}&depth=0`,
    )
    expect((await published.json()).totalDocs).toBe(1)
  })

  test('authors can unpublish their own entries, but nobody else’s', async ({
    baseURL,
    page,
    playwright,
    request,
  }) => {
    const title = `E2E author unpublish ${Date.now()}`
    const tokenOf = async (user: { email: string; password: string }) =>
      (await (await request.post('/api/users/login', { data: user })).json()).token as string
    const auth = (token: string) => ({ Authorization: `JWT ${token}` })
    const userToken = await tokenOf(testUsers.user)

    const created = await request.post('/api/resources', {
      data: { description: 'Unpublished by its author.', title, type: 'docs', url: `https://example.com/${Date.now()}` },
      headers: auth(userToken),
    })
    expect(created.ok()).toBe(true)
    const { doc } = await created.json()
    const approve = await request.post(`/api/moderation/resources/${doc.id}/approve`, {
      headers: auth(await tokenOf(testUsers.moderator)),
    })
    expect(approve.ok()).toBe(true)

    const others = await request.get(`/api/resources?where[slug][equals]=${fixtures.resource.slug}&depth=0`)
    const otherId = (await others.json()).docs[0].id
    for (const action of ['unpublish', 'approve']) {
      const refused = await request.post(`/api/moderation/resources/${otherId}/${action}`, {
        headers: auth(userToken),
      })
      expect(refused.status(), action).toBe(403)
    }

    await login({ page, user: testUsers.user })
    await page.goto(`/admin/collections/resources/${doc.id}`)
    await page.waitForLoadState('networkidle')
    const actions = page.locator('.plc-moderation-actions')
    await actions.getByRole('button', { name: 'Unpublish' }).click()
    // The edit view reloads; authors see no actions on an unpublished entry.
    await expect(actions).toHaveCount(0)

    const anonymous = await playwright.request.newContext({ baseURL })
    const visible = await anonymous.get(`/api/resources?where[id][equals]=${doc.id}&depth=0`)
    expect((await visible.json()).totalDocs).toBe(0)
    await anonymous.dispose()
  })
})
