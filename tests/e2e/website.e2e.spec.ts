import { expect, test, type Page } from '@playwright/test'

import { waitForEmailLink } from '../helpers/mailpit'
import { testUsers } from '../helpers/testDatabase'
import { E2E_GA_MEASUREMENT_ID } from '../helpers/testEnv'
import { fixtures } from '../helpers/websiteFixtures'

const jsonLdTypes = async (page: Page): Promise<string[]> =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (text) => JSON.parse(text)['@type'],
  )

const signIn = async (page: Page, user: { email: string; password: string }, next = '/account') => {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`)
  await page.waitForLoadState('networkidle')
  const form = page.getByTestId('sign-in-form')
  await form.getByLabel('Email').fill(user.email)
  await form.getByLabel('Password').fill(user.password)
  await form.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(next)
}

test.describe('Layout and consent', () => {
  test('header navigation and the not-affiliated footer note', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const label of ['News', 'Resources', 'Plugins', 'Builds']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible()
    }
    await expect(page.getByTestId('not-affiliated-note')).toContainText('not affiliated')
    // The account menu loads the session in the browser.
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('Google Analytics loads only after consent', async ({ page }) => {
    // vanilla-cookieconsent hides itself from automated browsers (`hideFromBots`).
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'webdriver', { get: () => false }),
    )
    const gaRequests: string[] = []
    await page.route('https://www.googletagmanager.com/**', (route) => {
      gaRequests.push(route.request().url())
      return route.fulfill({ body: '', contentType: 'text/javascript' })
    })

    await page.goto('/')
    const banner = page.locator('#cc-main .cm')
    await banner.getByRole('button', { exact: true, name: 'Reject' }).click()
    await expect(banner).toBeHidden()
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(gaRequests).toEqual([])

    await page.getByRole('button', { name: 'Cookie settings' }).click()
    await page.locator('#cc-main .pm').getByRole('button', { name: 'Accept all' }).click()
    await expect.poll(() => gaRequests.length).toBeGreaterThan(0)
    expect(gaRequests[0]).toContain(E2E_GA_MEASUREMENT_ID)
  })
})

test.describe('Listings', () => {
  test('resources: published entries only, search and type filter', async ({ page }) => {
    await page.goto('/resources')
    const list = page.getByTestId('resources-list')
    await expect(
      list.getByRole('link', { exact: true, name: fixtures.resource.title }),
    ).toBeVisible()
    await expect(list.getByText(fixtures.pendingResource.title)).toHaveCount(0)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/resources$/)

    await page.getByLabel('Type').selectOption('video')
    await page.getByRole('button', { name: 'Apply' }).click()
    await page.waitForURL(/type=video/)
    await expect(page.getByTestId('result-count')).toHaveText('1 result')
    await expect(list.getByRole('link', { exact: true, name: fixtures.video.title })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)

    await page.goto('/resources?q=does-not-exist')
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await page.getByRole('link', { name: 'Clear' }).click()
    await page.waitForURL(/\/resources$/)
  })

  test('news lists community posts and links imported posts to their source', async ({ page }) => {
    await page.goto('/news')
    const list = page.getByTestId('news-list')
    await expect(
      list.getByRole('link', { exact: true, name: fixtures.post.title }),
    ).toHaveAttribute('href', `/news/${fixtures.post.slug}`)
    await expect(
      list.getByRole('link', { exact: true, name: fixtures.importedPost.title }),
    ).toHaveAttribute('href', fixtures.importedPost.url)
  })

  test('plugins sort by stars by default', async ({ page }) => {
    await page.goto('/plugins')
    const cards = page.getByTestId('plugin-card')
    await expect(cards.first()).toContainText(fixtures.importedPlugin.name)
    await expect(cards.filter({ hasText: fixtures.plugin.name })).toHaveCount(1)
  })

  test('pages past the last one are not found', async ({ page }) => {
    const response = await page.goto('/builds?page=99')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Detail pages', () => {
  test('community post', async ({ page }) => {
    await page.goto(`/news/${fixtures.post.slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixtures.post.title)
    await expect(page.getByTestId('post-detail')).toContainText('by Ada Admin')
    expect(await jsonLdTypes(page)).toContain('BlogPosting')
    await expect(page).toHaveTitle(`${fixtures.post.title} | Payload CMS Community Portal`)
  })

  test('resource, plugin and build', async ({ page }) => {
    await page.goto(`/resources/${fixtures.resource.slug}`)
    await expect(page.getByTestId('resource-detail')).toContainText(fixtures.resource.title)

    await page.goto(`/plugins/${fixtures.plugin.slug}`)
    await expect(page.getByTestId('install-box')).toContainText(
      `pnpm add ${fixtures.plugin.npmPackage}`,
    )

    await page.goto(`/builds/${fixtures.build.slug}`)
    await expect(page.getByTestId('included-changes')).toContainText('E2E fix')
    expect(await jsonLdTypes(page)).toContain('SoftwareSourceCode')
  })

  test('pending entries and unknown slugs are not found', async ({ page }) => {
    for (const path of [`/resources/${fixtures.pendingResource.slug}`, '/news/no-such-post']) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(404)
    }
  })
})

test.describe('SEO files', () => {
  test('robots.txt and sitemaps use the runtime URL', async ({ baseURL, request }) => {
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`)

    const index = await (await request.get('/sitemap.xml')).text()
    expect(index).toContain(`${baseURL}/resources-sitemap.xml`)

    const resources = await (await request.get('/resources-sitemap.xml')).text()
    expect(resources).toContain(`${baseURL}/resources/${fixtures.resource.slug}`)
    expect(resources).not.toContain(fixtures.pendingResource.slug)

    const image = await request.get('/og-image.png')
    expect(image.headers()['content-type']).toBe('image/png')
  })
})

test.describe('Website accounts', () => {
  test('submit links send visitors to sign in, then to the admin create form', async ({ page }) => {
    await page.goto('/submit/resources')
    await page.waitForURL(/\/sign-in\?next=%2Fsubmit%2Fresources/)

    await signIn(page, testUsers.user, '/account')
    await expect(page.getByTestId('account-page')).toBeVisible()
    await page.goto('/submit/resources')
    await page.waitForURL(/\/admin\/collections\/resources\/create/)
  })

  test('a visitor signs up, activates the account, signs in and deletes it', async ({
    page,
    request,
  }) => {
    const email = `website-${Date.now()}@example.com`
    const password = 'website-password'

    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')
    const form = page.getByTestId('sign-up-form')
    await form.getByLabel('Name').fill('Website Person')
    await form.getByLabel('Email').fill(email)
    await form.getByLabel('Password', { exact: true }).fill(password)
    await form.getByLabel('Repeat password').fill(password)
    await form.locator('#sign-up-privacy').check()
    await form.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Check your inbox')).toBeVisible()

    const { link } = await waitForEmailLink(
      email,
      /https?:\/\/\S+\/admin\/users\/verify\/[0-9a-f]+/,
    )
    const token = link.split('/').pop()
    expect((await request.post(`/api/users/verify/${token}`)).ok()).toBe(true)

    await signIn(page, { email, password })
    const deleteForm = page.getByTestId('delete-account-form')
    await deleteForm.getByRole('checkbox').check()
    await deleteForm.getByRole('button', { name: 'Delete my account' }).click()
    await page.waitForURL(/\/sign-in\?deleted=1/)
    await expect(page.getByText('Your account was deleted.')).toBeVisible()

    expect((await request.post('/api/users/login', { data: { email, password } })).status()).toBe(
      401,
    )
  })
})
