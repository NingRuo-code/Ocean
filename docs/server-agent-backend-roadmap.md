# Ocean Server / Basic Backend Roadmap

> Status: in progress on `codex/server-agent-backend`.
> Purpose: move Ocean from a strong offline prototype to a server-assisted and research-verifiable system without losing offline fallback. Agent/AI work is deferred until the basic server, viewport, frontend server mode, data/cache, and response-analysis loop are stable.

## 0. Decisions So Far

The current project direction is:

- Product: fishery operation support, not yield or catch prediction.
- Research: front-event representation, historical comparison, apparent fishing-effort response, and human-AI evidence analysis.
- Server: frontend + FastAPI backend API, with server-side data production/cache.
- Viewport: `date + bbox + step` API returning light render/query payloads.
- AI/Agent: not part of the first implementation wave. Later Agent tools may wrap stable deterministic APIs, but they should not gate basic backend work.
- Response analysis: non-front controls plus bootstrap and permutation tests, first on the sample region/window.
- Frontend mode: auto-detect `/api/health`, show offline/server state, and allow manual fallback.
- Collaboration: one main repo, topic branches and ticket-driven PRs.

## 1. Server Strategy Recommendation

First server strategy:

| Item | Recommendation | Reason |
|---|---|---|
| Provider | Already-deployed Alibaba Cloud Ubuntu server | The collaborator/restructure deployment baseline already deployed this server; update project content and sync to it first |
| Capacity | Record current capacity, then constrain data/cache scope to what the deployed server can safely hold | The first goal is a working sync loop, not full historical/global storage |
| Upgrade path | Larger server or larger data disk only after the basic API, frontend server mode, cache, response-analysis loop, and smoke checks are stable | Avoid buying capacity before the workload shape is measured |
| Network | Existing public IP + HTTP path | Avoid domain/HTTPS blocking server sync validation |
| Later upgrade | Domain + HTTPS | Use after API and data behavior are stable |

Capacity notes:

- Current committed frontend data is about 4 MB.
- Current demo raw scope is documented as about 118 MB.
- Zenodo `front_location.zip` is about 18.3 GB, but the first server sync should use extracted day files rather than require the server to read the whole archive.
- `frontal_intensity` is about 100 GB and is out of first milestone scope.
- Coarse/global SST and viewport caches can grow; keep them under `/srv/ocean/data/cache` with eviction.
- Before expanding beyond the demo window and historical same-period samples, measure available disk, memory, and sustained cache growth on the deployed server.

## 2. Deployment Shape

Target paths:

```text
/opt/ocean                 # application checkout/package
/srv/ocean/data/raw        # raw permitted data
/srv/ocean/data/processed  # indexes/manifests
/srv/ocean/data/cache      # viewport/raster/query caches
/srv/ocean/data/outputs    # experiment outputs that are safe to keep server-side
/etc/ocean                 # server-only env files, later credentials
```

Existing server access mode:

1. Use the existing public IP + HTTP path.
2. Nginx serves frontend and proxies `/api/` to FastAPI.
3. FastAPI listens on `127.0.0.1:8000`.
4. Domain + HTTPS comes after endpoint behavior is stable.

Security and credential boundary:

- Use the existing server access model; keep real IPs, key paths, and incident notes out of Git.
- Do not expose backend port directly.
- Do not commit server IPs, SSH key paths, credentials, raw AIS/GFW, fine-grained grids, or incident notes.
- First milestone uses local authorized samples and public aggregate artifacts. Server-side GFW credentials can be added later through `/etc/ocean/gfw.env`.

## 3. Milestones

### M1. Planning And Ticket Baseline

Deliverables:

- This roadmap.
- Server/basic-backend agent instructions.
- Ticket set under `docs/tickets/server-agent-backend/`.
- Updated server plan pointing to the new direction.

Acceptance:

- Other conversations can discover the direction from `AGENTS.md`.
- The server choice, data scope, API boundary, and credential policy are explicit.

### M2. Viewport API

Deliverables:

- `GET /api/viewport?date=...&bbox=...&step=...`.
- Light payload for map rendering and deterministic backend querying.
- Structured coverage states for `ok`, `partial`, `empty`, and `unavailable`.
- Coverage fields distinguish requested bbox from actually covered bbox, and layer coverage is tracked separately for `fronts`, `sst`, and `fishingEffort`.
- JSON cache by `date + bbox + step`.
- Tests for in-range, partial, empty, invalid bbox, and cache hit.

Acceptance:

- Offline static data remains untouched.
- API includes source/date/bbox/step/resolution/status/coverage/caveats.
- Out-of-coverage windows return partial/empty rather than invented data.
- Empty or unavailable fishing-effort coverage is not treated as zero activity.

### M3. Frontend Server Mode

Deliverables:

- Auto-detect `/api/health`.
- Visible offline/server status.
- Manual mode switch and offline fallback.
- Globe/large-window viewport requests in server mode.

Acceptance:

- Server failure leaves the page usable in offline mode.
- Large/globe windows request viewport payloads only when server mode is active.

### M4. Response Analysis API And Experiment Package

Deliverables:

- Backend or script entrypoint for response-analysis runs over the sample region/window.
- 10/20/30 km buffers.
- Front vs non-front controls.
- Before/after 7-day windows.
- Lift/difference/sample/coverage metrics.
- Bootstrap confidence interval and permutation-test p value.
- Outputs under `outputs/experiments/front-response-*`.
- Markdown/Word-ready report source.

Acceptance:

- Results are reproducible from committed code and permitted data.
- Claims stay at apparent fishing-effort response, not catch/yield.
- The output can be reviewed without an AI layer.

### M5. Existing Server Sync And Smoke

Deliverables:

- Already-deployed Alibaba Cloud Ubuntu server inventoried for CPU, memory, disk, `/srv` free space, active services, and cache growth.
- Verified sync procedure for code, frontend assets, backend service files, and permitted data/cache artifacts.
- Nginx + systemd FastAPI service checked after sync.
- `/api/health`, viewport API, and response-analysis smoke path reachable through Nginx.
- Updated sanitized runbook.

Acceptance:

- Existing public IP + HTTP path continues to work after sync.
- Domain + HTTPS path is documented for later.
- Data and credentials remain outside Git.
- Capacity constraints are recorded before any larger data/cache expansion.

### M6. Deferred Agent/AI Extension

Deliverables:

- After M2-M5 are stable, define deterministic tool wrappers over existing APIs and experiments.
- Document tool schemas only when the underlying behavior is already implemented and tested.

Acceptance:

- Agent/AI work does not change numerical computation semantics.
- Agent/AI work remains optional for product demo and research validation.

## 4. Work Order

1. Finish M1.
2. Implement M2.
3. Implement M3.
4. Implement M4.
5. Implement M5.
6. Revisit M6 only after the basic backend and deployed-server sync loop are stable.

This order is deliberate: server sync waits until the API/data contract is useful enough to validate on the deployed server.

## 5. Execution Log

| Date | Item | Status | Notes |
|---|---|---|---|
| 2026-10-12 | M2 backend health and local run path | Done | `/api/health`, local backend run instructions, and backend smoke tests are in place. |
| 2026-10-12 | M2 fixture-backed viewport happy path | Done | `/api/viewport` returns `meta`, `layers`, `coverage`, and `caveats` from a deterministic fixture. |
| 2026-10-12 | M2 viewport validation and honest coverage states | Done | Valid partial/empty/unavailable requests return HTTP 200 with explicit coverage and caveats; invalid date/bbox/step requests fail as request errors. |
