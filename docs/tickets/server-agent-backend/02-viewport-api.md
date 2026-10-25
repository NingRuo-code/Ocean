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
- Static adapter still reads prototype JS artifacts as raw dictionaries; if the adapter grows beyond this first slice, extract typed static-data adapters for grid, front objects, SST runs, and front-response records.
