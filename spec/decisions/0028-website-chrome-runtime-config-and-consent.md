# ADR-028: Website header, footer, runtime client config and consent

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-11

## Context

[ADR-013](0013-next-public-env-at-runtime.md) says the server reads `NEXT_PUBLIC_GA_MEASUREMENT_ID` at request time and passes it to client components, with "dynamic rendering for the layout part that needs them". Without Partial Prerendering, a dynamic API in the root layout makes **every** page dynamic, and a static layout would freeze the value at build time (the image is built without production env). The same applies to the signed-in state in the header.

[§16](../architecture/frontend.md#16-seo-analytics-consent-security) asks for Consent Mode v2 defaults "in an inline script before GA". The template header used Payload's logo, and the template admin bar shows "New Page" to every signed-in user.

## Decision

- **Runtime client config:** `GET /site-config.json` (route handler, `force-dynamic`, `Cache-Control: public, max-age=300`) returns `{ gaMeasurementId }`. Client components fetch it; pages stay static. Only non-secret values go there.
- **Consent:** `ConsentProvider` (client) runs `vanilla-cookieconsent` only when a GA ID is configured, with one optional `analytics` category (Lingui-translated texts, equal-weight buttons, `_ga*` cookies auto-cleared on opt-out). GA is rendered with `@next/third-parties` only after consent; immediately before, the provider pushes `gtag('consent', 'default', {all four: 'denied'})` and then `gtag('consent', 'update', { analytics_storage })`. GA never loads before that, so no inline `<head>` script is needed (simpler CSP in M6). The footer's "Cookie settings" opens the preferences and is hidden when GA is not configured.
- **Header:** seeded nav (current page marked with `aria-current`), theme selector, and an account menu that loads `/api/users/me` in the browser: "Sign in" when anonymous; otherwise My account (`/account`), My entries (`/admin`), Moderation queue (moderators/admins), Sign out. Small screens get a menu button.
- **Wordmark:** a translated text logo ("Payload CMS / Community Portal") instead of Payload's logo, because the portal is not affiliated with Payload.
- **Admin bar:** shown to moderators and admins only, mapped to the portal collections. Its "New …/Edit …/Logout" texts are hard-coded in `@payloadcms/admin-bar` and stay English (editor-only tool; the admin panel is English).

## Consequences

- One small extra request per page view for the config (browser-cached for 5 minutes); GA starts loading slightly later than with server-rendered config.
- The account menu renders a placeholder until `/api/users/me` answers.
- Metadata (`metadataBase`, canonical URLs) still reads `NEXT_PUBLIC_SERVER_URL` when a page is rendered; M6 must make sure pages are rendered with the production value (not at image build time).
