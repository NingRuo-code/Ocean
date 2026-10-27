# Ocean Existing Server Sync Runbook

This runbook describes how to sync verified Ocean updates to the already-deployed Alibaba Cloud Ubuntu server. It is intentionally sanitized: keep real server IPs, SSH key paths, passwords, tokens, raw AIS/GFW data, and incident notes out of Git.

## Current execution decision — 2026-10-27

The user plans to replace the server. Do not run the old-server inventory, SSH deployment, tuning, package upload or service restart as part of this local work. #47/#228 remain open; the actual new target, access method, resource limits and admitted scope must be recorded before a separately arranged sync. Do not accept an unknown SSH host identity automatically.

This document completes preparation under #10, not the real sync in #11 or the completion review in #12. Local HTTP checks do not verify production deployment, release identity, research qualification or capacity. Before eventual migration, retain a private minimal inventory of existing permitted data, configuration, results and backups; replacing a machine does not remove that requirement.

There are two different delivery paths:

- **Existing source checkout:** the legacy layout below describes the already-running service. Sync only a fixed reviewed commit and explicitly approved aggregate assets after target admission and compatibility checks.
- **O01 isolated release package:** [the isolated release instructions](../docs/reports/ocean-isolated-release-implementation-2026-10-27.md) build an allowlisted, platform-specific package and run a loopback read-only profile. That profile is not a drop-in Linux production deployment. It excludes real activity inputs and does not activate persistent tasks, private cases, reports or AI. Do not copy a Windows package to Ubuntu and infer compatibility.

`deploy/deploy.ps1` and `remote-setup.sh` are retained legacy helpers, not the current production release mechanism. Their broad staging/setup/data-upload behavior and SSH defaults need separate review before use; this runbook does not authorize running them. OPS release switching, permissions, task fencing, backups and recovery remain separate gates.

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
node tools/data-check.mjs
git diff --check
git status --short
```

If browser-based checks cannot run, record the reason in the ticket or issue before syncing.

Pin the approved 40-character source commit and asset/data versions. Check that the target checkout has no unrelated changes before switching it. Review the exact staged file list for credentials, server addresses, private locators and restricted data; `git diff --check` alone is not a sensitive-data scan. Regenerating research outputs is not a required side effect of a code sync. #9's committed historical aggregate still lacks a true full post-7-day window; keep that gap explicit.

## 2. Server Capacity Inventory

When server work is separately arranged, run the existing read-only inventory helper on the actual target before changing code or expanding data scope:

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

The original source-checkout procedure applies only after target admission. The user's replacement plan supersedes the old requirement to finish deep inventory on the old machine first. Measure the admitted new target; do not infer its capacity from the local release ZIP size.

Recommended path:

1. Push verified commits to the shared repo.
2. Verify existing checkout state and record the current commit, approved target commit, data versions and compatible recovery point privately. Update `/opt/ocean` only to that reviewed commit; do not deploy a moving branch tip.
3. Keep raw/processed/cache/output data under `/srv/ocean/data`.
4. Restart `ocean-api`.
5. Reload Nginx only after `nginx -t` passes.
6. Run public smoke checks.

Do not stage the whole workspace or copy `data/raw` by default. Prepare an explicit manifest of allowed frontend/code/service files and any permitted aggregates, with hashes and destination paths. Environment values remain in server-only files; no local `.env`, credential store, private results or unrestricted `outputs/` tree goes into a public package. Review Nginx/systemd changes and data schema compatibility before restarting anything.

For an admitted existing source checkout, an operator may use a fixed-commit update like the following, replacing the placeholder first. These commands are instructions for a later arranged sync, not commands executed by this ticket:

```bash
cd /opt/ocean
git status --short
git rev-parse HEAD
git fetch origin main
git switch --detach REVIEWED_40_CHARACTER_COMMIT
git rev-parse HEAD
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

The smoke script makes bounded GET requests and checks structured conditions, kinds, coverage and units, rather than searching for a word in a response. GETs can populate the service's existing caches; the helper does not submit analysis, prepare archives, invoke models or change services. It reads:

- frontend root page
- `/api/health`
- `/api/viewport`
- `/api/query/current-state`
- `/api/query/front-response`
- `/api/query/historical-comparison`
- `/api/fishing/availability`
- `/api/fishing/<date>` with a non-empty fishing-cell payload

Output is one sanitized `ocean-server-smoke/v2` JSON object. It omits the target URL, response bodies, source paths and raw errors. Interpret both the status and process exit code:

If the actual activity index declares no ready days, availability and the selected day are marked unavailable; no day body is claimed to have been checked. An index that declares ready data must contain exactly the requested sample date and agree with its returned cell count. This is a smoke consistency check, not a source-coverage audit.

| Status | Exit | Meaning |
|---|---|---|
| `ready` | 0 | The selected API sample contracts are readable and declared ready; not a research or production certificate |
| `limited` | 0 | Contracts readable but some support is partial/unavailable or explicitly skipped |
| `limited` with `-RequireReady` | 2 | Strict selected-scope readiness has not passed |
| `failed` | 1 | Transport/authorization, malformed response, wrong conditions or a contract conflict |

For a strict selected-scope check, add `-RequireReady`. A non-strict exit 0 with `limited` must not be recorded as all data ready. Explicit `-SkipFishing` always leaves the result limited and fails the strict gate. Full production acceptance still needs the actual entry, version/asset identity, permissions, fallback browser checks and OPS evidence.

By default the fishing-effort day smoke uses `2024-08-05`. Override it when validating a different permitted server-side fishing sample:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\server-smoke.ps1 -BaseUrl "http://<server-ip>" -FishingDate "2024-08-05"
```

If the deployed server intentionally has no permitted fishing-effort files yet, make that explicit instead of silently accepting an untested layer:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\server-smoke.ps1 -BaseUrl "http://<server-ip>" -SkipFishing
```

Manual equivalents:

These are troubleshooting reads only. HTTP 200 or finding a `coverage` key does not prove that the selected data are available; inspect the actual response conditions, support and caveats.

```powershell
curl.exe -fsS "http://<server-ip>/api/health"
curl.exe -fsS "http://<server-ip>/api/viewport?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
curl.exe -fsS "http://<server-ip>/api/query/current-state?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
curl.exe -fsS "http://<server-ip>/api/query/front-response?date=2024-08-05&bbox=122,27,124.2,29.6&step=4"
curl.exe -fsS "http://<server-ip>/api/query/historical-comparison?date=2024-08-05&longitude=120.5&latitude=30.5&radius_deg=1"
curl.exe -fsS "http://<server-ip>/api/fishing/availability"
curl.exe -fsS "http://<server-ip>/api/fishing/2024-08-05"
```

The committed response-analysis experiment files can also be checked on the server filesystem, without regenerating them:

```bash
test -f /opt/ocean/outputs/experiments/front-response-static-prototype/manifest.json
test -f /opt/ocean/outputs/experiments/front-response-static-prototype/summary.json
test -f /opt/ocean/outputs/experiments/front-response-static-prototype/report.md
```

File existence is not research acceptance. Read the manifest's input/method versions and readiness: the current historical aggregate uses post-1–3-day hours and is not a symmetric post-7-day result. Real preparation and formal A/B evidence retain their P0 gates.

### Actual browser fallback checks after an arranged sync

Open the actual frontend entry and inspect its network requests while panning, zooming, changing date and switching globe/plane. The viewport echo must match the current conditions. Partial/empty/unavailable support stays visible; historical response windows must not appear as daily activity. Interrupt or deny a viewport request in a controlled browser session: existing same-day data remains usable and is marked as retained data. Use the mode button to switch offline and confirm map controls still work; the old server response must not overwrite that choice. Repeat a small-screen check and record browser/runtime, source commit, data versions and the actual limitations privately or as a sanitized projection.

## 6. Cache And Data Policy

- Local production remains the default for large archive work.
- The server may fill small gaps and build caches.
- Local/server pipeline conventions are documented in `docs/data-pipeline-cache.md`.
- Viewport JSON caches live under `/srv/ocean/data/cache/viewport/<contract-version>/`.
- Query/history/raster caches live under `/srv/ocean/data/cache`.
- Missing coverage must remain `empty`, `partial`, or `unavailable`; never fill missing fishing effort with zero.
- Raw AIS/GFW, MMSI, vessel tracks, restricted grids, and credentials stay outside Git.
- Cache invalidation is tied to the viewport cache contract version. Old version directories can be pruned after a new contract is deployed.

Fishing-effort map layer runtime notes:

- The frontend loads `/api/fishing/<date>` on demand only when the `ground` layer is opened or the date changes while that layer is open.
- A successful response redraws only the map dots and does not change the deterministic front/SST panels.
- Missing or unavailable fishing-effort cells draw nothing and must not be interpreted as zero fishing activity.
- Browser self-check after opening the layer:

```javascript
document.querySelectorAll('#mapSvg [data-layer="ground"]').length
```

The value should be greater than zero for dates that have public aggregate fishing-effort cells. If it remains zero while the server has permitted fishing files, check `/api/fishing/availability` and rebuild the server raw fishing manifest if the manifest is stale:

```bash
cd /opt/ocean
OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw /opt/ocean/venv/bin/python tools/pipeline/fetch_gfw_effort.py --rebuild-manifest
```

Back up the existing manifest before rebuilding. Do not record real server addresses, raw file names that expose restricted data, tokens, or incident notes in Git.

Recommended cache observation commands:

```bash
find /srv/ocean/data/cache -type f | wc -l
du -sh /srv/ocean/data/cache
find /srv/ocean/data/cache/viewport -name '*.json' | wc -l
```

Recommended viewport cache maintenance commands, run from `/opt/ocean/backend` on the server:

```bash
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py status
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py warm --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py prune --max-files-per-version 2000
```

Use `rebuild` instead of `warm` when the active contract version should be regenerated for a known query:

```bash
OCEAN_CACHE_DIR=/srv/ocean/data/cache /opt/ocean/venv/bin/python scripts/manage_viewport_cache.py rebuild --date 2024-08-05 --bbox 122,27,124.2,29.6 --step 4
```

`rebuild` removes only that query's viewport cache entry. Use `prune` for old contract-version directories.

Keep cache scope small and record growth after smoke checks.

## 7. Rollback

Do not assume a code checkout is a safe rollback for a system with persistent tasks or newer data/result schemas. Before a sync, record a compatible recovery point, permitted backup references and the service/configuration versions. If compatibility or recovery has not been verified, stop the rollout; do not remove newer results or retry running tasks. Real release fallback, worker fencing and empty-environment restore belong to the later OPS gates.

For a source-only change whose compatibility and recovery point have already been checked, an operator may follow the existing layout:

```bash
cd /opt/ocean
git log --oneline -n 5
git status --short
git switch --detach VERIFIED_COMPATIBLE_40_CHARACTER_COMMIT
/opt/ocean/venv/bin/pip install /opt/ocean/backend
systemctl restart ocean-api
nginx -t && systemctl reload nginx
```

For data/cache issues:

- Prefer moving suspect cache directories aside instead of deleting immediately.
- Keep raw/processed data untouched unless the data source or permission boundary is known.
- Do not commit incident logs.

## 8. Later Upgrade Path

For the planned replacement server or larger data disk, record actual capacity and supported workload before admitting the target. The old implementation's working software is not evidence that the new target can host full archives. Required evidence includes:

- `/api/health`, viewport API, and basic-query smoke are stable through Nginx
- response-analysis artifacts can be regenerated and reviewed
- cache growth is measured
- `/srv` free space and memory pressure are known
- no credentials or restricted raw data have leaked into Git

Domain + HTTPS should be handled as a later operational change, not a blocker for the current public-IP HTTP smoke loop.
