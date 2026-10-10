import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  page: Page
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page (relative to Playwright's `baseURL`).
 */
export async function login({ page, user }: LoginOptions): Promise<void> {
  await page.goto('/admin/login')
  // Submitting before hydration posts the form natively and stays on the login page.
  await page.waitForLoadState('networkidle')

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(/\/admin$/)

  const dashboardArtifact = page.locator('span[title="Dashboard"]')
  await expect(dashboardArtifact).toBeVisible()
}
