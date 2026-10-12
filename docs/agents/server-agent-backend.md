# Server / Basic Backend

Use this when work touches server deployment, viewport APIs, data/cache pipelines, response-analysis experiments, or later Agent tool contracts.

## Current Direction

- Branch topic: `codex/server-agent-backend`.
- Server goal: frontend + FastAPI backend API, with server-side data production/cache under `/srv/ocean/data`.
- Hosting target: the existing configured Alibaba Cloud Ubuntu server from the prior deployment baseline. Use that server first; consider larger capacity only after the basic API, frontend server mode, cache, response-analysis loop, and smoke checks are stable.
- Capacity policy: inventory CPU, memory, disk, `/srv` free space, and existing services before expanding data scope. Keep first deployment data small enough for the existing server.
- Deployment path: public IP + HTTP first, then domain + HTTPS after API/data behavior is stable.
- Storage path: keep code under `/opt/ocean`; mount or reserve data storage for `/srv/ocean/data`.
- Credentials: begin without server-side GFW/AIS credentials; later store them in a server-only env file such as `/etc/ocean/gfw.env`. Credentials, server IPs, key paths, and incident notes stay out of Git.
- Agent/AI priority: deferred. Do not implement AI-specific tooling before viewport API, frontend server mode, data/cache behavior, response-analysis experiments, and deployment basics are working.

## Execution Order

1. Update docs and tickets before implementation.
2. Implement viewport API: `date + bbox + step`, returning light render/query payloads with source/status/caveats.
3. Add frontend server mode: auto-detect `/api/health`, show offline/server state, allow manual fallback.
4. Add response-analysis experiment package: controls, bootstrap, permutation test, reproducible outputs.
5. Prepare deployment runbook and server smoke path.
6. Revisit Agent tool contracts only after the basic backend is demonstrably stable.
7. Revisit server replacement or larger capacity only after the existing server proves the loop and exposes real bottlenecks.

## Data Scope

First deployment data scope is:

- Current demo window: 2024-07-01 to 2024-08-31, East China Sea.
- Historical same-period samples needed by the current UI and response-analysis loop.
- No `frontal_intensity` archive in the first server milestone; it is about 100 GB and should wait until the core loop is stable.
- No raw or fine-grained AIS/GFW in Git. Public artifacts may contain only approved aggregate apparent-fishing-effort outputs.

## API Boundary

Viewport responses should be designed for rendering and deterministic backend querying, not as a clone of the static `frontend/prototype/data/day/*.js` shape.

Required response behavior:

- Accept `date`, `bbox`, and `step`.
- Include `source`, `date`, `bbox`, `step`, `resolution`, `status`, `coverage`, and `caveats`.
- Return partial/empty status when a requested window exceeds available data. Do not fake global coverage.
- Cache first as `date + bbox + step` JSON; tile/pyramid caching is a later optimization.

## Deferred Agent Boundary

Agent tools are a later layer over stable project computations. Do not introduce LLM calls, MCP contracts, or AI-specific orchestration in the first backend wave.

When this layer is eventually revisited, tools should be deterministic wrappers over already-tested computations:

- `query_current_state`
- `compare_history`
- `analyze_front_response`
- `explain_evidence`

AI may organize tasks and evidence only after the basic functionality is stable. Deterministic code computes numerical values. Tool outputs must expose caveats and unavailable states.

## Done Criteria

A server/basic-backend change is not done until:

- Offline mode still works.
- Backend tests or smoke checks cover the new API or experiment path.
- Data and credential boundaries are documented.
- The corresponding ticket records checks and residual risks.
