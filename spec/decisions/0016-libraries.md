# ADR-016: Libraries

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

| Need | Library | Version | Weekly DL | Why |
|---|---|---|---|---|
| Email | `@payloadcms/email-nodemailer` | 3.90.2 | official | plain SMTP, provider-agnostic |
| Email templates | `@react-email/components` (+ `@react-email/render`) | 1.0.12 | 7.4M | HTML + plain text, React |
| i18n | `@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/swc-plugin` | 6.9.0 / swc 6.7.1 | 1.6M / 0.4M | required by brief; swc plugin for Next (risk: SWC ABI compatibility with Next 16.3 — verify in M4, fallback in open questions) |
| URL state | `nuqs` | 2.10.2 | 5.2M | typed search params, server cache |
| Consent | `vanilla-cookieconsent` | 3.1.0 (2025-02) | 0.5M | most used maintained consent UI; no React wrapper needed |
| GA | `@next/third-parties` | match Next | 2.8M | official |
| OTel | `@opentelemetry/sdk-node` 0.223, `auto-instrumentations-node` 0.81, `instrumentation-pino`, `exporter-*-otlp-proto`, `resource-detector-container` | | 20M / 9.6M | full control over traces/metrics/logs; `@vercel/otel` (2.9M) lacks log export and MongoDB/pino instrumentation |
| GitHub | `@octokit/rest` 22 + `@octokit/plugin-throttling` + `@octokit/plugin-retry` | | 20M | rate-limit handling |
| Validation | `zod` | 4.x | 324M | external payloads |
| Concurrency | `p-limit` | | 274M | bounded parallel requests |
| A11y tests | `@axe-core/playwright` | 4.13 | 13.6M | |
| Sitemap | `next-sitemap` (template) | 4.2.3 (2023) | 0.5M | already in template; unmaintained since 2023 — replace with Next `sitemap.ts` if it breaks |
| Lexical → text | `@payloadcms/richtext-lexical/plaintext` `convertLexicalToPlaintext` | 3.90.2 | official | |
