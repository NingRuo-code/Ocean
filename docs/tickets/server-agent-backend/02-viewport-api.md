# Ticket 02: Viewport API

## Goal

Implement a backend viewport API for server mode, frontend rendering, and deterministic research queries.

## Scope

- Add `GET /api/viewport`.
- Accept `date`, `bbox`, and `step`.
- Return a light payload for rendering/querying, not a clone of static day JS.
- Include metadata: `source`, `date`, `bbox`, `step`, `resolution`, `status`, `coverage`, `caveats`, and `cached`.
- Cache responses by `date + bbox + step` under `/srv/ocean/data/cache` or local `data/cache`.
- Return `partial`, `empty`, or `unavailable` when data coverage is incomplete.

## Acceptance

- In-range East China Sea sample returns front/SST/mask payloads.
- Out-of-range bbox returns explicit partial/empty status.
- Cache hit is observable in response metadata or headers.
- Unit/API tests cover valid, partial, empty, invalid bbox, and cache hit paths.

## Checks

- `python -m pytest backend/tests -q`
- `curl http://127.0.0.1:8000/api/viewport?...` smoke after local server starts
