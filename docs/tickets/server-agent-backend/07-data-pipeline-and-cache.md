# Ticket 07: Data Pipeline And Cache

## Goal

Make local and server data production share the same pipeline shape.

## Scope

- Default to local production and server sync for large/front archive work.
- Allow the server to fill small gaps and build caches.
- Normalize raw/processed/cache/outputs paths across local and server.
- Add cache eviction for viewport JSON responses.
- Keep raw AIS/GFW and fine-grained intermediates outside Git.

## Acceptance

- Local and server path conventions are documented.
- Server-side cache can be warmed or rebuilt.
- Cache invalidation is tied to a version or output contract.
- Missing coverage remains unavailable, not zero.

## Checks

- Pipeline dry-run or smoke command documented when implemented.
- `node tools/data-check.mjs`
