# ADR-006: Storage: `@payloadcms/storage-s3`, files served by Garage's public web endpoint

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10
- Revised: 2026-10-10 (during the M0 review)

*Revised 2026-10-10:* files are delivered by **Garage's own web endpoint on its own public host** (e.g. `https://files.example.org` → Garage web port 3902), not by a separate CDN/public-URL service; `S3_PUBLIC_URL` holds that host. Garage itself is operated outside the portal's Helm chart. A CDN can be added later by changing only `S3_PUBLIC_URL`.

All uploads (`media`, `post-media`) go to S3 with `disablePayloadAccessControl: true` and `generateFileURL` → `S3_PUBLIC_URL/{prefix}/{filename}`; no proxying through the app, no local disk. `forcePathStyle` for Garage. `next/image` `remotePatterns` from `S3_PUBLIC_URL`. In DDEV the public hostname resolves to the router and the mkcert CA is trusted (`NODE_EXTRA_CA_CERTS`), so no dev-only workaround is expected (verify in M1).
