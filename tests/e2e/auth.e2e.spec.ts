import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { waitForEmailLink } from '../helpers/mailpit'
import { testUsers } from '../helpers/testDatabase'

const unique = (name: string) => `${name}-${Date.now()}@example.com`

test.describe('Email and password accounts', () => {
  test('an admin invites a user, who sets a password from the email', async ({ page, request }) => {
    const email = unique('invited')

    await login({ page, user: testUsers.admin })
    await page.goto('/admin/collections/users/create')
    await expect(page.locator('.auth-fields__changing-password')).toBeHidden()
    await page.fill('#field-email', email)
    await page.fill('#field-name', 'Invited Person')
    await page.click('#action-save')
    await expect(page.locator('.payload-toast-container')).toContainText(/success/i)

    const adminLogin = await request.post('/api/users/login', { data: testUsers.admin })
    const { token } = await adminLogin.json()
    // Two passes: sendInvitation queues sendEmail.
    for (let i = 0; i < 2; i++) {
      const run = await request.get('/api/payload-jobs/run?queue=default', {
        headers: { Authorization: `JWT ${token}` },
      })
      expect(run.ok()).toBe(true)
    }

    const { link, subject } = await waitForEmailLink(email, /https?:\/\/\S+\/admin\/reset\/[0-9a-f]+/)
    expect(subject).toContain('account')

    await page.context().clearCookies()
    await page.goto(new URL(link).pathname)
    await page.waitForLoadState('networkidle')
    await page.fill('#field-password', 'invited-password')
    await page.fill('#field-confirm-password', 'invited-password')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin$/)

    const me = await request.post('/api/users/login', {
      data: { email, password: 'invited-password' },
    })
    expect(me.ok()).toBe(true)
  })

  test('a visitor registers and activates the account from the email', async ({ page, request }) => {
    const email = unique('registered')
    const password = 'registered-password'

    const created = await request.post('/api/users', {
      data: { email, name: 'Registered Person', password, roles: ['admin'] },
    })
    expect(created.ok()).toBe(true)

    const before = await request.post('/api/users/login', { data: { email, password } })
    expect(before.status()).toBe(403)

    const { link } = await waitForEmailLink(email, /https?:\/\/\S+\/admin\/users\/verify\/[0-9a-f]+/)
    // In dev the verify view can render twice; the second render reports the used token.
    await page.goto(new URL(link).pathname)

    let after = await request.post('/api/users/login', { data: { email, password } })
    await expect
      .poll(async () => {
        after = await request.post('/api/users/login', { data: { email, password } })
        return after.status()
      })
      .toBe(200)
    const { user } = await after.json()
    expect(user.roles ?? []).toEqual([])
  })
})
