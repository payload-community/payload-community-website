# ADR-009: Migrations and seeding

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10
- Amended by [ADR-023](0023-small-image-with-bundled-cli-scripts.md): the hook Job runs `node cli.mjs migrate && node cli.mjs seed` (same steps, no Payload CLI in the image).

Helm `pre-install,pre-upgrade` hook Job runs `payload migrate` then `pnpm seed` (idempotent: create-if-missing only). Web/worker never migrate on start. MongoDB still uses Payload migrations (`payload migrate:create`) for data/index changes. During a rolling upgrade the old pods run against the migrated DB, so migrations must stay backward compatible (expand/contract) — documented in `docs/deployment.md`.
