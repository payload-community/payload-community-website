import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  test('can load homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Payload Community/)
    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('Payload Community')
  })
})
