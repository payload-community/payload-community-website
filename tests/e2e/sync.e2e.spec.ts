import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { testUsers } from '../helpers/testDatabase'

// Jobs are not run here (JOBS_AUTORUN=false): queued sync jobs would call GitHub and the Payload blog.
test.describe('Sync triggers', () => {
  test('only admins and the cron secret can queue a sync, once at a time', async ({
    baseURL,
    playwright,
    request,
  }) => {
    const tokenOf = async (user: { email: string; password: string }) =>
      (await (await request.post('/api/users/login', { data: user })).json()).token as string
    const anonymous = await playwright.request.newContext({ baseURL })

    expect((await anonymous.post('/api/sync/plugins')).status()).toBe(401)
    for (const user of [testUsers.user, testUsers.moderator]) {
      const refused = await anonymous.post('/api/sync/plugins', {
        headers: { Authorization: `JWT ${await tokenOf(user)}` },
      })
      expect(refused.status(), user.email).toBe(403)
    }
    const wrongSecret = await anonymous.post('/api/sync/plugins', {
      headers: { Authorization: 'Bearer not-the-secret' },
    })
    expect(wrongSecret.status()).toBe(401)

    const admin = { Authorization: `JWT ${await tokenOf(testUsers.admin)}` }
    expect((await anonymous.post('/api/sync/unknown', { headers: admin })).status()).toBe(404)

    const first = await anonymous.post('/api/sync/plugins', { headers: admin })
    expect(first.status()).toBe(202)
    const queued = await first.json()
    expect(queued).toMatchObject({ alreadyQueued: false, jobId: expect.anything() })

    test.skip(!process.env.CRON_SECRET, 'CRON_SECRET is not set')
    const again = await anonymous.post('/api/sync/plugins', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    expect(again.status()).toBe(202)
    expect(await again.json()).toEqual({ alreadyQueued: true, jobId: queued.jobId })
    await anonymous.dispose()
  })

  test('the Sync now button is shown to admins only', async ({ page }) => {
    await login({ page, user: testUsers.admin })
    await page.goto('/admin/collections/sources')
    const button = page.locator('.plc-sync-now').getByRole('button', { name: 'Sync now' })
    await button.click()
    await expect(page.locator('.payload-toast-container')).toContainText(
      /Sync queued|already queued/,
    )

    await page.context().clearCookies()
    await login({ page, user: testUsers.user })
    await page.goto('/admin/collections/plugins')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.plc-sync-now')).toHaveCount(0)
  })
})
