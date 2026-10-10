import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { testUsers } from '../helpers/testDatabase'

test.describe('Admin panel', () => {
  test('admin sees every admin group', async ({ page }) => {
    await login({ page, user: testUsers.admin })
    for (const group of ['Content', 'Media', 'Website', 'Synchronization', 'Administration']) {
      await expect(page.getByRole('heading', { level: 2, name: group })).toBeVisible()
    }
  })

  test('regular user sees only content and media they can submit', async ({ page }) => {
    await login({ page, user: testUsers.user })
    await expect(page.getByRole('heading', { level: 2, name: 'Content' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Website' })).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 2, name: 'Administration' })).toHaveCount(0)
  })

  test('the login page explains OAuth refusals', async ({ page }) => {
    await page.goto('/admin/login?error=email_unverified')
    await expect(page.locator('.plc-before-login__error')).toContainText('not verified')
  })
})
