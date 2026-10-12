# Ticket 02: Viewport API

## Goal

Implement a backend viewport API for server mode, frontend rendering, and deterministic research queries.

## Scope

- Add `GET /api/viewport`.
- Accept `date`, `bbox`, and `step`.
- Return a light payload for rendering/querying, not a clone of static day JS.
- Include metadata: `source`, `date`, `bbox`, `step`, `resolution`, `status`, `coverage`, `caveats`, and `cached`.
- In `coverage`, distinguish `requestBbox` from `coveredBbox`; `coveredBbox` is `null` when a valid request has no covered cells.
- Track `fronts`, `sst`, and `fishingEffort` coverage separately so mixed missing-data states can be represented later.
- Cache responses by `date + bbox + step` under `/srv/ocean/data/cache` or local `data/cache`.
- Return `partial`, `empty`, or `unavailable` when data coverage is incomplete.

## Acceptance

- In-range East China Sea sample returns front/SST/mask payloads.
- Out-of-range bbox returns explicit partial/empty status.
- Cache hit is observable in response metadata or headers.
- Unit/API tests cover valid, partial, empty, invalid bbox, and cache hit paths.

## Progress

- [x] Backend health and local run path.
- [x] Fixture-backed `/api/viewport` happy path.
- [x] Viewport validation and honest coverage states: partial, empty, unavailable, invalid date, invalid bbox, invalid step.
- [x] Versioned viewport JSON cache.

## Checks

- [x] `python -m pytest tests/test_api.py -q -k "viewport" --basetemp .pytest-basetemp-codex -p no:cacheprovider` from `backend/` => 7 passed.
- [x] `python -m ruff check app/main.py app/schemas.py app/viewport.py tests/test_api.py --select I,F,B` from `backend/` => passed.
- [x] `python -m py_compile app/viewport.py app/main.py app/schemas.py` from `backend/` => passed.
- [x] `python -m pytest tests -q --basetemp .pytest-basetemp-codex -p no:cacheprovider` from `backend/` => 15 passed.
- [ ] `curl http://127.0.0.1:8000/api/viewport?...` smoke after local server starts.

## Residual Risks

- Cache is currently file-based JSON under `data/cache/viewport/<cache-version>/`; no eviction policy is implemented yet for `/api/viewport`.
- Server-side smoke through Nginx is deferred to the existing-server sync ticket.
- Current cache payloads are fixture-backed. Real data integration must keep the same versioned-key and missing-coverage semantics.
