# Ticket 07: Data Pipeline And Cache

Status: done on `codex/server-agent-backend`.

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

- Cache maintenance tests: `python -m pytest tests/test_api.py -q -k "viewport_cache_maintenance" --tb=short --basetemp .pytest-basetemp-ticket07-cache-final3 -p no:cacheprovider` passed with 3 tests.
- Pipeline/cache smoke: `python scripts/manage_viewport_cache.py rebuild --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4 --cache-dir .tmp/cache-ticket07` removed and regenerated one requested `static-prototype-v1-contract-v1` viewport cache entry.
- Lint/import check: `python -m ruff check app/cache_maintenance.py scripts/manage_viewport_cache.py tests/test_api.py --select I,F,B` passed.
- Backend regression: `python -m pytest tests -q --tb=short --basetemp .pytest-basetemp-ticket07-full2 -p no:cacheprovider` passed with 23 tests.
- Data contract check: `node tools/data-check.mjs` passed with `FAIL 0/914`.

## Implemented

- Added backend cache maintenance functions for viewport cache status, warming, and pruning.
- Added `backend/scripts/manage_viewport_cache.py` with `status`, `warm`, `rebuild`, and `prune` actions.
- Documented local and deployed server cache path conventions in `data/cache/README.md`, `backend/README.md`, and `deploy/RUNBOOK.md`.
- Added `docs/data-pipeline-cache.md` to define the shared local/server `raw`, `processed`, `cache`, and `outputs` path contract and the current pipeline shape.
- Tied viewport cache invalidation to `VIEWPORT_CACHE_VERSION` and made old contract-version directories prunable.
- Made viewport `rebuild` remove only the requested `date + bbox + step + contract-version` cache entry before warming it again.
- Kept cache operations scoped to generated viewport JSON only; raw AIS/GFW and fine-grained intermediates remain outside Git.
- Missing coverage behavior remains owned by the viewport contract: `empty`, `partial`, and `unavailable` are preserved and are not converted to zero.

## Residual Risks

- This ticket does not implement raw archive ingestion or new server-side source connectors; it documents the shared pipeline shape and reuses existing dry-run/process job entrypoints.
- Cache pruning currently targets viewport JSON caches only. Raster/history/query cache eviction can be added after their growth is measured on the deployed server.
- Server cache warming still needs to be run by an operator with server access after the pushed branch is synced.
