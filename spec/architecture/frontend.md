# Website: routes, i18n, SEO and consent

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 14. Website routes

| Route | Source | Notes |
|---|---|---|
| `/` | page `home` (hero, SectionsOverview, CollectionList ×3) | Hero CTA "Join with GitHub, Google or email and contribute" (→ `/sign-up`; brief: "sign in (GitHub or Google)", extended by [ADR-020](../decisions/0020-email-registration-with-activation.md)). |
| `/news` | Posts listing | search `q` (title, summary), `source`, `tag`, `page`; sort newest first. Cards: imported → external URL (new tab, `rel="noopener noreferrer"`, source name); community → `/news/{slug}` (author, no external label). |
| `/news/[slug]` | community post | template post rendering; imported slugs 404. |
| `/resources` | Resources | `q` (title, description), `type`, `tag`, `sort` (`updated`, `newest`), `page`. Cards → `/resources/{slug}`. |
| `/resources/[slug]` | Resource detail | Title, type, tags, full description, submitter ("Former member" when anonymized), dates, **prominent "Visit {host}" button** to the external URL (new tab, `rel="noopener noreferrer"`). |
| `/plugins` | Plugins (not hidden) | `q` (name, description), `topic`, `sort` (`stars` default, `updated`), `page`. Card: name, description, created, last update, topics, stars, npm version, weekly downloads. Cards → `/plugins/{slug}`. |
| `/plugins/[slug]` | Plugin detail | Name, owner avatar, description, topics, stars, forks, license, archived/fork badges, GitHub created / last pushed dates, npm package with `pnpm add {package}` copy box, latest version, weekly downloads, last publish date, homepage; **prominent "View repository" button** (and "View on npm"). Hidden plugins 404. |
| `/builds` | Builds | `q` (name, description), `tag`, `version` (base Payload version), `sort` (`updated`, `newest`), `page`. Cards → `/builds/{slug}`. |
| `/builds/[slug]` | Build detail | Name, description, base Payload version, tags, npm install box, list of included changes (title → link, notes), homepage/docs; **prominent "View repository" button**. |
| `/community`, `/about`, `/privacy` | pages | `[slug]` route from template. |
| `/sign-in` | auth | GitHub/Google buttons (enabled only), email/password form, "Forgot password?" → `/admin/forgot`, link to `/sign-up`, resend activation. |
| `/sign-up` | auth | GitHub/Google buttons, registration form (name, email, password, confirmation), "check your inbox" state ([§12.2](auth.md#122-email-registration-and-password-sign-in)). |
| `/account` | auth | Profile summary, **connected accounts** (connect/disconnect GitHub and Google, [§12.3](auth.md#123-connect-another-provider-while-signed-in-approved-idea-i1)), set/change password link, links to admin (my entries, notification settings at `/admin/account`), sign out, **delete account** (confirmation; explains that content is anonymized). |
| `/submit/{posts,resources,plugins,builds}` | redirect | → `/admin/collections/{slug}/create` (sign-in first if anonymous). |
| `/sitemap.xml`, `/robots.txt`, `/pages-sitemap.xml`, `/news-sitemap.xml`, `/resources-sitemap.xml`, `/plugins-sitemap.xml`, `/builds-sitemap.xml` | next-sitemap + route handlers | |
| `/api/health/live`, `/api/health/ready` | Next route handlers | live: no I/O; ready: `getPayload()` + MongoDB `ping`. |
| `/site-config.json` | route handler | Runtime, non-secret client settings (`gaMeasurementId`), [ADR-028](../decisions/0028-website-chrome-runtime-config-and-consent.md). |
| `/admin/**` | Payload | + `/admin/moderation`. |

Detail pages (`/news/[slug]`, resources, plugins, builds) are server components using `findEntryBySlug` (`src/website/detail.ts`: `payload.find({ where: { slug }, draft: false, overrideAccess: false, limit: 1 })`, community posts only for news) with `generateStaticParams`, `revalidate = 300` and on-demand `revalidatePath` from the moderated collections' `afterChange`/`afterDelete` hooks ([ADR-029](../decisions/0029-website-page-caching-and-revalidation.md)), `generateMetadata` (title, description, canonical, OG image = post/meta image, owner avatar for plugins, or the default), and JSON-LD (`BlogPosting` for community posts, `SoftwareSourceCode` for plugins and builds, `CreativeWork` for resources). Submitters are shown through the virtual `populatedAuthor` field (all moderated collections; "Submitted by a former member" when the account was deleted; not shown for imported plugins). Moderators and owners preview drafts with the admin "Preview" button (template `/next/preview` route, Next.js draft mode; the page then reads the user's latest draft through access control).

Listing implementation (`src/website/listing/`): server components parse `searchParams` with `nuqs` loaders (`createLoader`; invalid values fall back to defaults, empty fields count as unset) and build page links with `createSerializer`; filters are a plain `<form method="get" role="search">` with native `<select>`s (works without JS; submitting resets the page), `payload.find({ where, sort, page, limit: 24, depth: 1, draft: false, overrideAccess: false })`. Filter options come from `payload.findDistinct` (`tags`, `topics`, `basePayloadVersion` sorted newest first, `type`, post `source`) as an anonymous reader, so only values of visible entries appear. Search = `or: [{ title|name: { like: q } }, { summary|description: { like: q } }]` (trimmed, max 100 chars). Sorts: news `-date`; resources and builds `updated` (default, `-updatedAt`) or `newest` (`-createdAt`); plugins `stars` (default, `-stars`) or `updated` (`-lastPushedAt`). Each listing has a "Submit …" button to `/submit/{collection}`, a result count, link pagination (`rel=prev/next`, `aria-current`), and `ItemList` JSON-LD. Pages past the last one return 404; filtered or searched views are `noindex, follow` with the plain listing as canonical; page 2+ is its own canonical URL.

Navigation (seeded `header.navItems`): Home `/`, News `/news`, Resources `/resources`, Plugins `/plugins`, Builds `/builds`, Community `/community`, About `/about`; the current section is marked with `aria-current`, small screens get a menu button. Header: text wordmark (not Payload's logo), theme switcher, and an account menu loaded in the browser from `/api/users/me` ("Sign in", or My account, My entries → `/admin`, Moderation queue for moderators/admins, Sign out), so pages stay static ([ADR-028](../decisions/0028-website-chrome-runtime-config-and-consent.md)). The Payload admin bar is shown to moderators and admins only.

Footer: wordmark, seeded links (Privacy policy, GitHub repository), "Cookie settings" (opens the consent preferences; only when GA is configured), and the Lingui note "Payload CMS Community Portal is a community project. It is not affiliated with or endorsed by Payload."

---

## 15. i18n

- Website: Lingui 6.9.0 (`@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/format-po`) with `@lingui/swc-plugin` **6.1.0** via `experimental.swcPlugins` (the newest release compatible with Next 16.3.3, [ADR-027](../decisions/0027-lingui-wiring.md)), locale `en`, config `lingui.config.ts`. Catalogs `src/locales/{locale}/messages.po` (tracked); compiled `messages.ts` is gitignored and produced by `lingui compile` at the start of `dev`, `build`, `typecheck` and `test:e2e`. RSC: `initLingui()` from `src/lingui/server.ts` in every layout and page (one instance per locale, `setI18n`); client components through `LinguiClientProvider` (`src/lingui/ClientProvider.tsx`). Scripts `i18n:extract` (`lingui extract --clean`), `i18n:compile` (`--strict`), `i18n:check` (`lingui check sync --clean`, CI drift check). `eslint-plugin-lingui` reports unwrapped strings in website code (`warn`).
- Admin panel: Payload `i18n` config with `supportedLanguages: { en }` and custom `translations.en.plc.*` keys for our admin components and error messages.
- Emails: `src/email/messages.ts` (not Lingui yet; ready to be moved).

---

## 16. SEO, analytics, consent, security

- SEO plugin titles `"{title} | Payload CMS Community Portal"`, OG image from `meta.image` / post image / default OG image; canonical URLs via `generateMetadata` (`alternates.canonical`); JSON-LD: `WebSite` (+ `SearchAction` for `/news?q=`) on home, `BlogPosting` on community posts, `ItemList` on listings.
- GA4: `@next/third-parties/google` `<GoogleAnalytics>` rendered only after consent; `vanilla-cookieconsent` v3 with one optional category `analytics` (`_ga*` cookies cleared on opt-out), texts translated with Lingui; Consent Mode v2 default `denied` (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) pushed to `dataLayer` by `ConsentProvider` (`src/website/consent/`) right before GA is rendered, then updated on every consent change. The GA ID comes from `GET /site-config.json` at runtime; nothing renders when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is empty ([ADR-028](../decisions/0028-website-chrome-runtime-config-and-consent.md)).
- Security headers in `next.config.ts` `headers()`: CSP (self, `S3_PUBLIC_URL`, `www.googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`, avatars `avatars.githubusercontent.com`, `lh3.googleusercontent.com`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'self'`. Payload `rateLimit`/`csrf`/`cors` set from `NEXT_PUBLIC_SERVER_URL`.
