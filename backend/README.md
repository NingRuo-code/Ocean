# Ocean Backend

This backend is the local FastAPI entrypoint for the Ocean server/basic-backend phase.
The first stable probe is `GET /api/health`; frontend server-mode detection and deployed-server
smoke checks should use this endpoint before calling heavier data APIs.

## Local Run

Install the backend in editable mode with development test dependencies:

```powershell
cd backend
python -m pip install -e ".[dev]"
cd ..
```

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\start_api.ps1
```

Or run Uvicorn directly from the backend directory:

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Then check the health probe:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Expected minimal response:

```json
{
  "status": "ok",
  "service": "Ocean Front Offline API",
  "offline": true
}
```

The local run path does not require deployed-server access, real server IPs, SSH keys,
GFW/AIS credentials, or raw AIS/GFW files.

## Basic Query Service

Ticket 04 adds deterministic query summaries that are suitable for frontend/server
smoke checks and later Agent wrapping, without adding any AI-specific runtime:

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/api/query/current-state?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
Invoke-RestMethod "http://127.0.0.1:8000/api/query/front-response?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
Invoke-RestMethod "http://127.0.0.1:8000/api/query/historical-comparison?date=2024-08-05&longitude=120.5&latitude=30.5&radius_deg=1"
```

Responses include `source`, `parameters`, `metrics`, `evidence`, `coverage`, and
`caveats`. Missing historical data returns `unavailable` with sample coverage fields,
not zero probability. Front-response outputs describe apparent fishing-effort response
only, not catch, yield, revenue, biomass, or guaranteed fishing success. See
`docs/examples/basic-query-service.md` for example snapshots.

## Viewport Cache Operations

Viewport JSON cache files are versioned by output contract. From `backend/`:

```powershell
python scripts/manage_viewport_cache.py status
python scripts/manage_viewport_cache.py warm --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
python scripts/manage_viewport_cache.py rebuild --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
python scripts/manage_viewport_cache.py prune --max-files-per-version 2000
```

Local defaults use `data/cache`; the deployed server should set `OCEAN_CACHE_DIR=/srv/ocean/data/cache`.
The cache script warms or prunes generated viewport JSON only. It does not fetch raw data, expose raw AIS/GFW,
or reinterpret unavailable coverage as zero activity.

See `docs/data-pipeline-cache.md` for the shared local/server `raw`, `processed`, `cache`, and `outputs`
path contract.

## Tests

From the backend directory:

```powershell
python -m pytest tests -q
```

For the health probe only:

```powershell
python -m pytest tests/test_api.py -q -k health
```

## Deployment Boundary

The deployed server should proxy `/api/` to this FastAPI app. Keep real server IPs,
SSH key paths, credentials, raw AIS/GFW data, and incident notes out of Git. Use
`/api/health` as the first post-sync smoke check before viewport or response-analysis calls.
