# ADR-033: Image build without a database, and runtime image optimization

- Status: Proposed
- Proposed: 2026-11-25
- Amends: [ADR-029](0029-website-page-caching-and-revalidation.md) (what is prerendered at build time), [ADR-013](0013-next-public-env-at-runtime.md) (how the server reads `NEXT_PUBLIC_*`)

## Context

[M6.4](../roadmap.md#m64-container-image) builds one image with `output: 'standalone'` and a bundled `cli.mjs` ([ADR-023](0023-small-image-with-bundled-cli-scripts.md)). Two facts block that:

- `pnpm build` called Payload from `generateStaticParams` (pages, news, resources, plugins, builds). With no MongoDB in `docker build` the build stops at "Failed to collect page data". Section sitemaps had the same problem: their `GET` handlers are static unless opted out, and they query Payload.
- `images.remotePatterns` is serialized into the standalone server at **build** time (Next.js `server.js` embeds `nextConfig`). `S3_PUBLIC_URL` and `NEXT_PUBLIC_SERVER_URL` are different on every deployment, so a pattern computed while building the image cannot name the file host. Direct `process.env.NEXT_PUBLIC_*` reads are also replaced at build time, including on the server, which defeated ADR-013 for `getServerSideURL` and `/site-config.json`.

`esbuild` is the bundler ADR-023 already chose (0.28 line, last published 2026-08-08, on the order of 300M weekly downloads, Node 24 and our TypeScript sources). It was only a transitive dependency of `tsx`; it is now a direct devDependency, `esbuild@0.28.2`.

## Decision

- During `NEXT_PHASE=phase-production-build`, `generateStaticParams` returns `[]`. No page is prerendered from the database. The first request renders it and `revalidate = 300` caches it, which is the same path ADR-029 already uses for entries that were not in the build. Section sitemap routes are `force-dynamic` so they are not prerendered either; `unstable_cache` still caches them at runtime.
- Absolute `next/image` URLs use a custom loader (`src/imageLoader.ts`) that sends them to `GET /media-image`. That route allowlists the **request-time** origins of `S3_PUBLIC_URL` and `NEXT_PUBLIC_SERVER_URL`, refuses credentials and redirects, and resizes with `sharp` (already a dependency) to webp. Relative URLs still use `/_next/image`. Avatars stay `unoptimized`. This replaces build-time `remotePatterns` for uploaded files.
- Server code reads those public variables through `publicEnv` (`process.env[name]`), which Next does not inline. The admin bar uses an empty `cmsURL`, so its links and `/api/users/me` stay on the current host. Live preview receives `getServerSideURL()` from the server page.
- `self-test` imports the Payload config, every job task, the migration list and the production seed, and does not call `getPayload`. The Dockerfile runs it in the final stage.
- `cli.mjs` bundles npm packages as well as our code. The standalone trace inlines Payload into the Next server and does not leave an importable package, so leaving those imports external fails at `node cli.mjs`. `sharp` stays external (native addon, traced for the image optimizer). `next/cache` is replaced with a no-op stub. Classic JSX is emitted so the bundle does not named-import the CJS `react/jsx-runtime`. A banner defines `require`, `__dirname` and `__filename` for bundled CommonJS. Measured bundle: 15 MB.
- `/` is rendered per request. Postponing the prerender (`connection()` only while `NEXT_PHASE=phase-production-build`) makes Next classify that route as dynamic. Detail routes stay ISR (`revalidate = 300`) with no paths generated at build.

## Consequences

- `docker build` needs no database and no production `.env`. Pages fill in on first request (within the existing 5-minute revalidation), including after a deploy, instead of being baked for one environment.
- The file host can change with the environment. Only that host and the site host can be resized; other remote images are rejected. The route does not use Next's private-IP block, because the host is an explicit operator setting (DDEV's Garage hostname is private). Redirects are not followed.
- Image size is measured when the image is built. Docker is not available in the web container; the owner builds on the host (`docker build --build-arg APP_VERSION=<version> .`).
