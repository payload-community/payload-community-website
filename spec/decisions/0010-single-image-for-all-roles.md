# ADR-010: One image for web, worker and migrate

- Status: Superseded by [ADR-023](0023-small-image-with-bundled-cli-scripts.md) (2026-10-10)
- Proposed: 2026-10-09
- Accepted: 2026-10-10

Next.js `output: 'standalone'` for the web server, plus a `/app/cli` directory with production `node_modules` and `src/` for the Payload CLI (worker, migrations, seed). Larger image than standalone-only but a single artifact/tag for all three roles. Revisit if size becomes a problem (e.g. bundle the CLI entrypoints with `esbuild`).
