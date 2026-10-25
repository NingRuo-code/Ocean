# Ocean Data Pipeline And Cache Boundary

This document defines the shared local/server data shape for the current basic-backend phase. It does not add raw archive ingestion or server-side source connectors; it keeps those as later work after the deployed server's capacity is measured.

## Path Contract

| Stage | Local Path | Server Path | Git Policy | Purpose |
|---|---|---|---|---|
| raw | `data/raw/` | `/srv/ocean/data/raw/` | ignored | permitted front/SST samples and other source files |
| processed | `data/processed/` | `/srv/ocean/data/processed/` | ignored | indexes, manifests, derived non-public working files |
| cache | `data/cache/` | `/srv/ocean/data/cache/` | ignored except docs | viewport JSON, raster, history, and query caches |
| outputs | `outputs/` | `/srv/ocean/data/outputs/` or `/opt/ocean/outputs/` for committed safe reports | commit only approved public artifacts | reproducible experiment summaries and safe reports |

Environment variables keep the code shape the same across machines:

```text
OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw
OCEAN_CACHE_DIR=/srv/ocean/data/cache
```

The backend derives the processed directory from the raw data parent unless a script accepts an explicit `--processed-dir`.

## Pipeline Shape

1. Plan source work.
   - Local: `python backend/scripts/plan_data_preparation.py`.
   - Server dry-run: `node tools/server-pull-job.mjs --source <source_id> --start YYYY-MM-DD --end YYYY-MM-DD --dry-run`.
2. Produce large archive data locally by default.
   - Local scripts may fill `data/raw` and `data/processed`.
   - Raw AIS/GFW, fine-grained tracks, MMSI, credentials, and restricted grids remain outside Git.
3. Sync only verified code, permitted samples, and safe outputs to the deployed server.
   - Follow `deploy/RUNBOOK.md`.
   - Do not put real server IPs, key paths, credentials, or incident notes into Git.
4. Let the server fill small gaps and build caches.
   - Small gap fills must write to `/srv/ocean/data/raw` or `/srv/ocean/data/processed`, never to source code paths.
   - Viewport cache warming writes only under `/srv/ocean/data/cache/viewport/<contract-version>/`.
5. Publish safe public artifacts only after validation.
   - Use `tools/server-process-artifact.mjs` for supported public artifact jobs.
   - Run `node tools/data-check.mjs` before committing or publishing artifacts.

## Viewport Cache Operations

From `backend/` locally:

```powershell
python scripts/manage_viewport_cache.py status
python scripts/manage_viewport_cache.py warm --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
python scripts/manage_viewport_cache.py rebuild --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
python scripts/manage_viewport_cache.py prune --max-files-per-version 2000
```

On the server:

```bash
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py status
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py warm --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py prune --max-files-per-version 2000
```

`warm` builds missing cache files. `rebuild` removes and regenerates only the requested `date + bbox + step + contract-version` cache entry. `prune` removes old contract-version directories and can cap files per active version.

## Coverage Boundary

Cache maintenance never changes scientific meaning. Missing coverage remains `empty`, `partial`, or `unavailable`. It must not be filled as zero front activity or zero apparent fishing effort.
