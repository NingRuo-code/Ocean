# Server / Agent Backend

Use this when work touches server deployment, viewport APIs, data/cache pipelines, response-analysis experiments, or Agent tool contracts.

## Current Direction

- Branch topic: `codex/server-agent-backend`.
- Server goal: frontend + FastAPI backend API, with server-side data production/cache under `/srv/ocean/data`.
- Hosting target: larger Alibaba Cloud Ubuntu server in the same deployment shape as the existing runbook.
- Recommended first server: 4 vCPU, 8 GB RAM, 200 GB SSD/data disk. Use 2 vCPU / 4 GB / 80 GB only for throwaway demos; use 16 GB / 500 GB when multi-year experiments become routine.
- Deployment path: public IP + HTTP first, then domain + HTTPS after API/data behavior is stable.
- Storage path: keep code under `/opt/ocean`; mount or reserve data storage for `/srv/ocean/data`.
- Credentials: begin without server-side GFW/AIS credentials; later store them in a server-only env file such as `/etc/ocean/gfw.env`. Credentials, server IPs, key paths, and incident notes stay out of Git.

## Execution Order

1. Update docs and tickets before implementation.
2. Implement viewport API: `date + bbox + step`, returning light render/query payloads with source/status/caveats.
3. Add frontend server mode: auto-detect `/api/health`, show offline/server state, allow manual fallback.
4. Add Agent tool contracts: Python functions first, HTTP boundary where useful, schema/docs for future LLM/MCP callers.
5. Add response-analysis experiment package: controls, bootstrap, permutation test, reproducible outputs.

## Data Scope

First deployment data scope is:

- Current demo window: 2024-07-01 to 2024-08-31, East China Sea.
- Historical same-period samples needed by the current UI and response-analysis loop.
- No `frontal_intensity` archive in the first server milestone; it is about 100 GB and should wait until the core loop is stable.
- No raw or fine-grained AIS/GFW in Git. Public artifacts may contain only approved aggregate apparent-fishing-effort outputs.

## API Boundary

Viewport responses should be designed for rendering and Agent querying, not as a clone of the static `frontend/prototype/data/day/*.js` shape.

Required response behavior:

- Accept `date`, `bbox`, and `step`.
- Include `source`, `date`, `bbox`, `step`, `resolution`, `status`, `coverage`, and `caveats`.
- Return partial/empty status when a requested window exceeds available data. Do not fake global coverage.
- Cache first as `date + bbox + step` JSON; tile/pyramid caching is a later optimization.

## Agent Boundary

Agent tools are deterministic wrappers over project computations:

- `query_current_state`
- `compare_history`
- `analyze_front_response`
- `explain_evidence`

AI may organize tasks and evidence. Deterministic code computes numerical values. Tool outputs must expose caveats and unavailable states.

## Done Criteria

A server/Agent backend change is not done until:

- Offline mode still works.
- Backend tests or smoke checks cover the new API/tool path.
- Data and credential boundaries are documented.
- The corresponding ticket records checks and residual risks.
