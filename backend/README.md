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
