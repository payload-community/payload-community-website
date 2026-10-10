# Website: routes, i18n, SEO and consent

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 14. Website routes

| Route | Source | Notes |
|---|---|---|
| `/` | page `home` (hero, SectionsOverview, CollectionList ×3) | Hero CTA "Join with GitHub, Google or email and contribute" (→ `/sign-up`; brief: "sign in (GitHub or Google)", extended by [ADR-020](../decisions/0020-email-registration-with-activation.md)). |
| `/news` | Posts listing | search `q` (title, summary), `source`, `tag`, `page`; sort newest first. Cards: imported → external URL (new tab, `rel="noopener noreferrer"`, source name); community → `/news/{slug}` (author, no external label). |
| `/news/[slug]` | community post | template post rendering; imported slugs 404. |
| `/resources` | Resources | `q` (title, description), `type`, `tag`, `sort` (`updated`), `page`. Cards → `/resources/{slug}`. |
| `/resources/[slug]` | Resource detail | Title, type, tags, full description, submitter ("Former member" when anonymized), dates, **prominent "Visit {host}" button** to the external URL (new tab, `rel="noopener noreferrer"`). |
| `/plugins` | Plugins (not hidden) | `q` (name, description), `topic`, `sort` (`stars` default, `updated`), `page`. Card: name, description, created, last update, topics, stars, npm version, weekly downloads. Cards → `/plugins/{slug}`. |
| `/plugins/[slug]` | Plugin detail | Name, owner avatar, description, topics, stars, forks, license, archived/fork badges, GitHub created / last pushed dates, npm package with `pnpm add {package}` copy box, latest version, weekly downloads, last publish date, homepage; **prominent "View repository" button** (and "View on npm"). Hidden plugins 404. |
| `/builds` | Builds | `q`, `tag`, `version` (base Payload version), `sort` (`updated`), `page`. Cards → `/builds/{slug}`. |
| `/builds/[slug]` | Build detail | Name, description, base Payload version, tags, npm install box, list of included changes (title → link, notes), homepage/docs; **prominent "View repository" button**. |
| `/community`, `/about`, `/privacy` | pages | `[slug]` route from template. |
| `/sign-in` | auth | GitHub/Google buttons (enabled only), email/password form, "Forgot password?" → `/admin/forgot`, link to `/sign-up`, resend activation. |
| `/sign-up` | auth | GitHub/Google buttons, registration form (name, email, password, confirmation), "check your inbox" state ([§12.2](auth.md#122-email-registration-and-password-sign-in)). |
| `/account` | auth | Profile summary, **connected accounts** (connect/disconnect GitHub and Google, [§12.3](auth.md#123-connect-another-provider-while-signed-in-approved-idea-i1)), set/change password link, links to admin (my entries, notification settings at `/admin/account`), sign out, **delete account** (confirmation; explains that content is anonymized). |
| `/submit/{posts,resources,plugins,builds}` | redirect | → `/admin/collections/{slug}/create` (sign-in first if anonymous). |
| `/sitemap.xml`, `/robots.txt`, `/pages-sitemap.xml`, `/news-sitemap.xml`, `/resources-sitemap.xml`, `/plugins-sitemap.xml`, `/builds-sitemap.xml` | next-sitemap + route handlers | |
| `/api/health/live`, `/api/health/ready` | Next route handlers | live: no I/O; ready: `getPayload()` + MongoDB `ping`. |
| `/admin/**` | Payload | + `/admin/moderation`. |

Detail pages (resources, plugins, builds) are server components using `payload.find({ where: { slug }, draft: false, overrideAccess: false, limit: 1 })` with `generateStaticParams` + on-demand revalidation by cache tag (`afterChange` hooks), `generateMetadata` (title, description, canonical, OG image = default or owner avatar), and JSON-LD (`SoftwareSourceCode` for plugins and builds, `CreativeWork`/`WebPage` for resources). Moderators/owners preview drafts through the template's live preview route.

Listing implementation: server components reading `searchParams` through `nuqs` server cache (`createSearchParamsCache`), filters as `<form method="get">`/links (works without JS), `payload.find({ where, sort, page, limit: 24, draft: false, overrideAccess: false })`. Distinct values for filters via `payload.findDistinct` (`tags`, `topics`, `basePayloadVersion`, `type`). Search = `or: [{ title: { like: q } }, { summary|description: { like: q } }]`.

Navigation (seeded `header.navItems`): Home `/`, News `/news`, Resources `/resources`, Plugins `/plugins`, Builds `/builds`, Community `/community`, About `/about`. Header right: theme switcher, Sign in / account menu.

Footer: seeded links (Privacy policy, GitHub repository), "Cookie settings" (opens the consent preferences; only when GA is configured), and the Lingui note "Payload CMS Community Portal is a community project. It is not affiliated with or endorsed by Payload."

---

## 15. i18n

- Website: Lingui 6 (`@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/swc-plugin` via `experimental.swcPlugins`), locale `en`, catalogs `src/locales/{locale}/messages.po`, compiled at build. RSC: `setI18n`/`initLingui` per request (Lingui's Next.js App Router pattern); client components through `I18nProvider`. Scripts `i18n:extract` (`lingui extract --clean`), `i18n:compile`. CI check: extract produces no missing translations for `en`.
- Admin panel: Payload `i18n` config with `supportedLanguages: { en }` and custom `translations.en.plc.*` keys for our admin components and error messages.
- Emails: `src/email/messages.ts` (not Lingui yet; ready to be moved).

---

## 16. SEO, analytics, consent, security

- SEO plugin titles `"{title} | Payload CMS Community Portal"`, OG image from `meta.image` / post image / default OG image; canonical URLs via `generateMetadata` (`alternates.canonical`); JSON-LD: `WebSite` (+ `SearchAction` for `/news?q=`) on home, `BlogPosting` on community posts, `ItemList` on listings.
- GA4: `@next/third-parties/google` `<GoogleAnalytics>` rendered only after consent; `vanilla-cookieconsent` v3 with one optional category `analytics`; Consent Mode v2 default `denied` (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) set in an inline script before GA, updated on consent change. Nothing renders when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is empty.
- Security headers in `next.config.ts` `headers()`: CSP (self, `S3_PUBLIC_URL`, `www.googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`, avatars `avatars.githubusercontent.com`, `lh3.googleusercontent.com`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'self'`. Payload `rateLimit`/`csrf`/`cors` set from `NEXT_PUBLIC_SERVER_URL`.
