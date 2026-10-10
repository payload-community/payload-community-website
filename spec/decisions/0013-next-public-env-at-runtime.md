# ADR-013: `NEXT_PUBLIC_*` at runtime

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

`NEXT_PUBLIC_*` values are inlined at build time, which conflicts with "one image, configuration only through env". The server reads `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` from `process.env` at request time (dynamic rendering for the layout part that needs them) and passes them to client components as props; no client code reads `process.env.NEXT_PUBLIC_*` directly. Variable names are kept for compatibility with `.env`.
