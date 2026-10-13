# Ocean Existing Server Sync Runbook

This runbook describes how to sync verified Ocean updates to the already-deployed Alibaba Cloud Ubuntu server. It is intentionally sanitized: keep real server IPs, SSH key paths, passwords, tokens, raw AIS/GFW data, and incident notes out of Git.

## 0. Current Deployment Shape

- Application root: `/opt/ocean`
- Data root: `/srv/ocean/data`
- Server-only environment files: `/etc/ocean`
- Frontend: Nginx serves `/opt/ocean/frontend/prototype`
- Backend: FastAPI listens on `127.0.0.1:8000`
- Public entry: existing public IP + HTTP
- Nginx proxies `/api/` to FastAPI
- Later upgrade: domain + HTTPS after the API, cache, experiment, and smoke loop are stable

Data directories:

```text
/srv/ocean/data/raw        # permitted raw samples only; no raw/fine-grained AIS/GFW in Git
/srv/ocean/data/processed  # indexes and manifests
/srv/ocean/data/cache      # viewport/raster/query caches
/srv/ocean/data/outputs    # safe experiment outputs
```

## 1. Local Preconditions

Before any server sync, verify locally from the repository root:

```powershell
cd backend
python -m pytest tests -q
cd ..
node tools/e2e-check.mjs
node tools/layout-check.mjs
node tools/run-front-response-experiment.mjs
git diff --check
git status --short
```

If browser-based checks cannot run, record the reason in the ticket or issue before syncing.

## 2. Server Capacity Inventory

Run the inventory helper on the server after uploading or pulling the latest code:

```bash
bash /opt/ocean/deploy/inventory-server.sh
```

Record only sanitized results:

- CPU model and core count
- memory total/free
- disk free for `/`, `/opt`, and `/srv`
- size of `/srv/ocean/data/raw`, `processed`, `cache`, and `outputs`
- active services: `ocean-api`, `nginx`
- sync/access model: current server user, whether passwordless sudo is available, `ocean` service user, owners of `/opt/ocean`, `/srv/ocean/data`, and `/etc/ocean`
- whether `/api/health` and viewport local smoke succeed
- cache file counts and rough cache growth

Do not record:

- real public IPs or private IPs
- SSH usernames tied to a personal machine, key filenames, or key fingerprints
- credential values
- raw AIS/GFW filenames if they expose restricted data
- incident-specific handoff notes

## 3. Sync Strategy

Use the existing server first. Do not replace or resize the server until capacity and cache growth are measured.

Recommended path:

1. Push verified commits to the shared repo.
2. On the server, update `/opt/ocean` from the approved branch, or use `deploy/deploy.ps1` from a local machine to upload a sanitized package.
3. Keep raw/processed/cache/output data under `/srv/ocean/data`.
4. Restart `ocean-api`.
5. Reload Nginx only after `nginx -t` passes.
6. Run public smoke checks.

Code-only sync from Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\probe-ports.ps1 -ServerIp <server-ip> -Ports "22,80"
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -ServerIp <server-ip> -KeyFile <key-file> -SkipData
```

Data upload is optional and must use only permitted local/server data:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -ServerIp <server-ip> -KeyFile <key-file>
```

When using direct server commands instead of the PowerShell deploy helper, keep the same path layout and service checks:

```bash
cd /opt/ocean
git fetch --all --prune
git checkout codex/server-agent-backend
git pull --ff-only
/opt/ocean/venv/bin/pip install /opt/ocean/backend
systemctl restart ocean-api
nginx -t && systemctl reload nginx
```

## 4. Server Service Checks

Run on the server:

```bash
systemctl status ocean-api --no-pager
journalctl -u ocean-api -n 80 --no-pager
nginx -t
systemctl status nginx --no-pager
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS 'http://127.0.0.1:8000/api/viewport?date=2024-08-05&bbox=122,27,124.2,29.6&step=4' | head -c 500
```

If Nginx uses the public IP as `server_name`, local Nginx checks should include the correct `Host` header:

```bash
curl -fsS -H "Host: <server-ip>" http://127.0.0.1/api/health
```

## 5. Public Smoke Checks

From a local Windows machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\server-smoke.ps1 -BaseUrl "http://<server-ip>"
```

The smoke script checks:

- frontend root page
- `/api/health`
- `/api/viewport`
- `/api/query/current-state`
- `/api/query/front-response`
- `/api/query/historical-comparison`

Manual equivalents:

```powershell
curl.exe -fsS "http://<server-ip>/api/health"
curl.exe -fsS "http://<server-ip>/api/viewport?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
curl.exe -fsS "http://<server-ip>/api/query/current-state?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
curl.exe -fsS "http://<server-ip>/api/query/front-response?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
curl.exe -fsS "http://<server-ip>/api/query/historical-comparison?date=2024-08-05&longitude=120.5&latitude=30.5&radius_deg=1"
```

The committed response-analysis experiment output can also be checked on the server filesystem:

```bash
test -f /opt/ocean/outputs/experiments/front-response-static-prototype/manifest.json
test -f /opt/ocean/outputs/experiments/front-response-static-prototype/summary.json
test -f /opt/ocean/outputs/experiments/front-response-static-prototype/report.md
```

## 6. Cache And Data Policy

- Local production remains the default for large archive work.
- The server may fill small gaps and build caches.
- Viewport JSON caches live under `/srv/ocean/data/cache/viewport/<contract-version>/`.
- Query/history/raster caches live under `/srv/ocean/data/cache`.
- Missing coverage must remain `empty`, `partial`, or `unavailable`; never fill missing fishing effort with zero.
- Raw AIS/GFW, MMSI, vessel tracks, restricted grids, and credentials stay outside Git.

Recommended cache observation commands:

```bash
find /srv/ocean/data/cache -type f | wc -l
du -sh /srv/ocean/data/cache
find /srv/ocean/data/cache/viewport -name '*.json' | wc -l
```

Eviction policy is implemented later in Ticket 07. Until then, keep cache scope small and record growth after smoke checks.

## 7. Rollback

For code rollback:

```bash
cd /opt/ocean
git log --oneline -n 5
git checkout <known-good-commit>
/opt/ocean/venv/bin/pip install /opt/ocean/backend
systemctl restart ocean-api
nginx -t && systemctl reload nginx
```

For data/cache issues:

- Prefer moving suspect cache directories aside instead of deleting immediately.
- Keep raw/processed data untouched unless the data source or permission boundary is known.
- Do not commit incident logs.

## 8. Later Upgrade Path

Only consider a larger server, larger data disk, domain, or HTTPS after:

- `/api/health`, viewport API, and basic-query smoke are stable through Nginx
- response-analysis artifacts can be regenerated and reviewed
- cache growth is measured
- `/srv` free space and memory pressure are known
- no credentials or restricted raw data have leaked into Git

Domain + HTTPS should be handled as a later operational change, not a blocker for the current public-IP HTTP smoke loop.
