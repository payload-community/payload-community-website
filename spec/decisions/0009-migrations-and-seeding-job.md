# ADR-009: Migrations and seeding

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

Helm `pre-install,pre-upgrade` hook Job runs `payload migrate` then `pnpm seed` (idempotent: create-if-missing only). Web/worker never migrate on start. MongoDB still uses Payload migrations (`payload migrate:create`) for data/index changes. During a rolling upgrade the old pods run against the migrated DB, so migrations must stay backward compatible (expand/contract) — documented in `docs/deployment.md`.
