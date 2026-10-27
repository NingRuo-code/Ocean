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
- [x] Static prototype data adapter for `/api/viewport`: reads committed front objects, SST, and aggregate apparent-fishing-effort response artifacts while preserving the backend contract.

## Checks

- [x] `python -m pytest tests/test_api.py -q -k "viewport" --basetemp .pytest-basetemp-codex -p no:cacheprovider` from `backend/` => 7 passed.
- [x] `python -m pytest tests/test_api.py -q -k "viewport" --tb=short --basetemp .pytest-basetemp-codex2 -p no:cacheprovider` from `backend/` => 8 passed.
- [x] `python -m ruff check app/main.py app/schemas.py app/viewport.py tests/test_api.py --select I,F,B` from `backend/` => passed.
- [x] `python -m py_compile app/viewport.py app/main.py app/schemas.py app/config.py` from `backend/` => passed.
- [x] `python -m pytest tests -q --basetemp .pytest-basetemp-codex -p no:cacheprovider` from `backend/` => 15 passed.
- [x] `python -m pytest tests -q --tb=short --basetemp .pytest-basetemp-codex2 -p no:cacheprovider` from `backend/` => 16 passed.
- [x] Local HTTP smoke after `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`: `/api/health` returned `ok`; `/api/viewport?date=2024-08-05&bbox=122,27,124.2,29.6&step=4` returned `status=ok`, `source=static_prototype`, 2 fronts, 143 SST cells, 3 fishing-effort cells.

## Residual Risks

- Cache is currently file-based JSON under `data/cache/viewport/<cache-version>/`; no eviction policy is implemented yet for `/api/viewport`.
- Server-side smoke through Nginx is deferred to the existing-server sync ticket.
- Current payloads adapt committed static prototype artifacts, not raw NetCDF or raw AIS/GFW ingestion. Later real-data integration must keep the same versioned-key and missing-coverage semantics.
- The #6 hardening extracts typed grid/front/SST/response inputs and rejects conflicting/ambiguous exports. See [input contract](../../data/static-viewport-inputs.md) and [2026-10-27 execution evidence](../../reports/ocean-static-viewport-implementation-2026-10-27.md). Fixed display-version caching does not yet fingerprint same-version hot replacement; source-version/P0 integration and eviction remain separate work.

## Static adapter hardening — 2026-10-27 (#6)

- Existing `/api/viewport` retains `meta/layers/coverage/caveats`, Celsius and stable display rounding. Bad inputs degrade the affected layer; unavailable auxiliary summary values remain null, explicit zero/false remain valid.
- Original local HTTP application read all 62 existing July/August display dates at the recorded sample viewport: 30 complete and 32 partial (response layer unavailable), 62 first cache misses and 62 repeat hits. All 62 front/SST layers available. This is display coverage, not a claim about whole-region/day or raw research qualification.
- 39 authored original-API cases, 245 full backend tests, 126 full tool/browser checks and 922 data checks pass; changed Python ruff and `git diff --check` pass. Checks include independently installed original application startup.
- No production deployment, raw download or old-server inspection. Parent #1 / frontend #8 and P0/P1 empirical gates are not completed by this API ticket.
