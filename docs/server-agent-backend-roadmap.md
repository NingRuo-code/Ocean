# Ocean Server / Agent Backend Roadmap

> Status: planned on `codex/server-agent-backend`.
> Purpose: move Ocean from a strong offline prototype to a server-assisted, research-verifiable, Agent-ready system without losing offline fallback.

## 0. Decisions So Far

The current project direction is:

- Product: fishery operation support, not yield or catch prediction.
- Research: front-event representation, historical comparison, apparent fishing-effort response, and human-AI evidence analysis.
- Server: frontend + FastAPI backend API, with server-side data production/cache.
- Viewport: `date + bbox + step` API returning light render/query payloads.
- Agent: Python functions as the core, HTTP API as the service boundary, tool schema as the future Agent contract.
- Response analysis: non-front controls plus bootstrap and permutation tests, first on the sample region/window.
- Frontend mode: auto-detect `/api/health`, show offline/server state, and allow manual fallback.
- Collaboration: one main repo, topic branches and ticket-driven PRs.

## 1. Server Sizing Recommendation

Recommended first server:

| Item | Recommendation | Reason |
|---|---|---|
| Provider | Alibaba Cloud, same Ubuntu/Nginx/systemd deployment shape | Existing deploy scripts and runbook already assume this shape |
| CPU | 4 vCPU | Enough for FastAPI, cache generation, and small batch analysis |
| RAM | 8 GB | Safer for NetCDF/SST/front processing than 4 GB |
| Disk | 200 GB SSD/data disk | Leaves room for raw samples, processed indexes, viewport cache, experiment outputs |
| Network | Public IP first | Avoid domain/HTTPS blocking initial deployment |
| Later upgrade | Domain + HTTPS | Use after API and data behavior are stable |

Capacity notes:

- Current committed frontend data is about 4 MB.
- Current demo raw scope is documented as about 118 MB.
- Zenodo `front_location.zip` is about 18.3 GB, but first deployment should sync extracted day files rather than require the server to read the whole archive.
- `frontal_intensity` is about 100 GB and is out of first milestone scope.
- Coarse/global SST and viewport caches can grow; keep them under `/srv/ocean/data/cache` with eviction.

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

First access mode:

1. Public IP + HTTP.
2. Nginx serves frontend and proxies `/api/` to FastAPI.
3. FastAPI listens on `127.0.0.1:8000`.
4. Domain + HTTPS comes after endpoint behavior is stable.

Security and credential boundary:

- Use a dedicated deployment user when provisioning the new server.
- Do not expose backend port directly.
- Do not commit server IPs, SSH key paths, credentials, raw AIS/GFW, fine-grained grids, or incident notes.
- First milestone uses local authorized samples and public aggregate artifacts. Server-side GFW credentials can be added later through `/etc/ocean/gfw.env`.

## 3. Milestones

### M1. Planning And Ticket Baseline

Deliverables:

- This roadmap.
- Server/Agent backend agent instructions.
- Ticket set under `docs/tickets/server-agent-backend/`.
- Updated server plan pointing to the new direction.

Acceptance:

- Other conversations can discover the direction from `AGENTS.md`.
- The server choice, data scope, API boundary, and credential policy are explicit.

### M2. Viewport API

Deliverables:

- `GET /api/viewport?date=...&bbox=...&step=...`.
- Light payload for map rendering and Agent querying.
- JSON cache by `date + bbox + step`.
- Tests for in-range, partial, empty, invalid bbox, and cache hit.

Acceptance:

- Offline static data remains untouched.
- API includes source/date/bbox/step/resolution/status/coverage/caveats.
- Out-of-coverage windows return partial/empty rather than invented data.

### M3. Frontend Server Mode

Deliverables:

- Auto-detect `/api/health`.
- Visible offline/server status.
- Manual mode switch and offline fallback.
- Globe/large-window viewport requests in server mode.

Acceptance:

- Server failure leaves the page usable in offline mode.
- Large/globe windows request viewport payloads only when server mode is active.

### M4. Agent Tool Contract

Deliverables:

- Python functions for current-state query, historical comparison, front-response analysis, and evidence explanation.
- Tool schema docs with inputs, outputs, caveats, and unavailable states.
- At least three example calls and snapshots.

Acceptance:

- Numerical values come from deterministic code.
- Tool outputs are suitable for later LLM/MCP callers.

### M5. Response Analysis Experiment Package

Deliverables:

- 10/20/30 km buffers.
- Front vs non-front controls.
- Before/after 7-day windows.
- Lift/difference/sample/coverage metrics.
- Bootstrap confidence interval and permutation-test p value.
- Outputs under `outputs/experiments/front-response-*`.
- Markdown/Word report source.

Acceptance:

- Results are reproducible from committed code and permitted data.
- Claims stay at apparent fishing-effort response, not catch/yield.

### M6. Server Deployment

Deliverables:

- New Alibaba Cloud Ubuntu server prepared with `/opt/ocean` and `/srv/ocean/data`.
- Nginx + systemd FastAPI service.
- `/api/health`, viewport API, and at least one Agent tool reachable through Nginx.
- Updated sanitized runbook.

Acceptance:

- Public IP works first.
- Domain + HTTPS path is documented for later.
- Data and credentials remain outside Git.

## 4. Work Order

1. Finish M1.
2. Implement M2.
3. Implement M3.
4. Implement M4.
5. Implement M5.
6. Prepare M6 when server access exists.

This order is deliberate: deployment waits until the API/data contract is useful enough to deploy.
