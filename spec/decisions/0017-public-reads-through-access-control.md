# ADR-017: Public reads go through access control

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

Website queries use the Local API with `overrideAccess: false`, `draft: false`, and no user, so the same access rules protect REST, GraphQL and the website. Author names for community posts come from an `afterRead`-populated `populatedAuthor` field (template pattern), not from public read access on `users`.
