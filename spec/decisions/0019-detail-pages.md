# ADR-019: Detail pages for Resources, Plugins and Builds (extends the brief)

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

*Context.* The brief says cards link directly to external sites and there are no detail pages except community posts. Reviewed 2026-10-10: detail pages are wanted (Q12).

*Decision.* `/resources/{slug}`, `/plugins/{slug}`, `/builds/{slug}` show all public fields and a prominent external link (repository / website, new tab, `rel="noopener noreferrer"`); listing cards link to these pages. Imported posts keep linking to the original article. `slug` fields are added to Resources and Plugins (Builds already had one); plugin slugs are derived from `fullName` once and never change.

*Consequences.* Better SEO (indexable pages, JSON-LD) and room for richer data; three more page templates and sitemaps; E2E tests cover them. Proposed brief change P6.
