# ADR-018: Post sync specifics (verified against live data 2026-10-09)

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

- Public URL is `{siteOrigin}/posts/{category.slug}/{slug}` (category changes the path; `blog`, `releases`, `guides` exist).
- Items without a category (4 of 119, no public page) and future-dated items (a placeholder `draft` post dated 2038) are skipped.
- Tags come from `category.name`.
