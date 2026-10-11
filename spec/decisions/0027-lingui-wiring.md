# ADR-027: Lingui wiring on Next.js 16 (SWC plugin pin, compiled catalogs, lint guardrail)

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-11

## Context

[ADR-016](0016-libraries.md) picked Lingui 6 with `@lingui/swc-plugin` 6.7.1 and left the SWC compatibility with Next 16.3.3 open (T2). Each SWC plugin release is built against one `swc_core` version; Next.js embeds its own SWC, so only the Next.js version decides what loads.

Checked in M4 (following the official `lingui/skills` *swc-plugin-compatibility* procedure):

- Next 16.3.3 pins `swc_core` 73.0.0 (`Cargo.toml` of tag `v16.3.3`; plugin runner 30.0.1).
- `@lingui/swc-plugin` 6.7.x (`swc_core` 77.1.1) and 6.2.0–6.6.0 (`swc_core` 66.0.3) fail on every macro file with "Failed to deserialize program received from host".
- 6.1.0 (`swc_core` 50.2.3 built with `swc_ast_unknown`, the cross-version mode) compiles; a changed string in the compiled catalog reaches the server-rendered HTML. Its peer range `@lingui/core: 5 || 6` admits 6.9.0.

Lingui 6.9.1 was published one day before M4 and is blocked by pnpm's `minimumReleaseAge`; ADR-016 already named 6.9.0.

## Decision

- `@lingui/core`, `@lingui/react`, `@lingui/cli`, `@lingui/format-po` **6.9.0**; `@lingui/swc-plugin` **6.1.0**, all pinned exactly. The plugin is configured as the tuple `['@lingui/swc-plugin', {}]` in `experimental.swcPlugins`.
- Next.js upgrades are plugin upgrades: after bumping `next`, re-check `swc_core` and rebuild a page that uses a macro.
- Catalogs: `src/locales/{locale}/messages.po` (tracked, no line numbers), compiled to `messages.ts` (`compileNamespace: 'ts'`, gitignored). `lingui compile` runs at the start of `dev`, `build`, `typecheck` and `test:e2e`; pnpm does not run `pre`/`post` scripts, so the template's `postbuild` (next-sitemap) moved into `build` too. `pnpm i18n:check` (`lingui check sync --clean`) is the CI drift check.
- Server components call `initLingui()` (one `I18n` instance per locale at module scope, `setI18n` per layout/page); client components get the same catalog through `LinguiClientProvider`. Strings outside a render use `msg` descriptors; `generateMetadata` uses `t(i18n)` with the instance from `initLingui()`.
- `eslint-plugin-lingui` **0.16.0** (≈ 302k weekly downloads, published 2026-09-17, peers ESLint 8–10 and TypeScript 5–6): `flat/recommended` plus `no-unlocalized-strings` at `warn`, scoped to website code (admin components use Payload's i18n; `components/ui` is vendored shadcn). Ignores were grown from the first scan's false positives only.

## Consequences

- Plugin 6.1.0 does not ship the `linguiMacroSwcPlugin()` options helper; we use the defaults, which match our config.
- A fresh clone needs `pnpm i18n:compile` (or any of the scripts above) before the app imports the catalog; the Dockerfile (M6) runs `pnpm build`, which compiles.
- Fallback if a future Next.js has no compatible plugin: the Babel macro (`@lingui/babel-plugin-lingui-macro` with `.babelrc`), which disables Next's SWC compiler for the whole project.
