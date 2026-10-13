# Spec: Server / Basic Backend Phase

## Problem Statement

Ocean already has a strong offline fishery-operation prototype with front, SST, apparent-fishing-effort response, and globe/viewport interaction. The next problem is that the project cannot yet behave like a server-assisted analysis system: large or globe-scale viewports are still constrained by static offline payloads, research experiments are not yet packaged as reproducible server-side outputs, and deployment remains a later operational step rather than a verified path.

The user needs the project to move toward a deployable and research-verifiable system while preserving the offline demo path. The server must support frontend and backend API deployment, data production/cache, viewport responses, and reproducible response-analysis outputs without exposing raw restricted data or overstating the scientific claim. Agent/AI tooling is deliberately deferred until the basic functionality is stable.

## Solution

Build a server/basic-backend phase around a single high-level seam: the server API boundary. The first server milestone will update the already-deployed Alibaba Cloud Ubuntu server from the collaborator/restructure deployment baseline, with data under a server data directory and Nginx proxying `/api`.

The backend will first add a viewport API that accepts `date`, `bbox`, and `step`, then returns a light render/query payload with explicit source, resolution, coverage, status, and caveats. The frontend will auto-detect server availability, show the current offline/server mode, allow manual fallback, and use the viewport API for large or globe-scale windows only when server mode is active.

The first implementation slice is the backend-first API contract, not a new product direction and not a server replacement task. It will add FastAPI and Pydantic under the backend module, expose `/api/health` and `/api/viewport`, serve the first viewport response from existing static data or fixtures, write viewport JSON caches under the server data boundary, and document how to run and verify the backend locally before any server sync.

The response-analysis research path will be packaged as reproducible experiment outputs using non-front controls, bootstrap confidence intervals, and permutation tests over the first sample region/window. Server work will start by syncing verified project updates to the existing deployed server, initially through its public IP + HTTP path, later domain + HTTPS. Larger capacity is a later decision after the basic loop exposes real CPU, memory, disk, or cache pressure.

Agent/AI contracts are not part of the first implementation wave. Later Agent tools may wrap stable deterministic APIs and experiment outputs, but they should not gate viewport, server mode, data/cache, research validation, or deployment work.

## User Stories

1. As a project owner, I want the offline prototype to keep working, so that classroom, interview, and no-network demos are not broken by server work.
2. As a project owner, I want a server mode, so that the same product can grow beyond committed static payloads.
3. As a project owner, I want the server to run frontend and backend API together, so that demonstrations can use a realistic deployment shape.
4. As a project owner, I want the already-deployed server capacity and constraints inventoried first, so that I can avoid premature server replacement.
5. As a project owner, I want raw, processed, cache, and output data separated, so that server operations do not leak restricted or reconstructable data.
6. As a project owner, I want server IPs, key paths, credentials, and incident notes kept out of Git, so that collaboration does not create security debt.
7. As a project owner, I want project updates to keep working through the existing public IP and HTTP path, so that domain and HTTPS setup do not block API validation.
8. As a project owner, I want a later path to domain and HTTPS, so that the demo can become presentable once the service is stable.
9. As a frontend user, I want the page to detect whether the backend is healthy, so that I can understand whether I am seeing offline or server-enhanced data.
10. As a frontend user, I want a visible offline/server state, so that data freshness and behavior are explainable.
11. As a frontend user, I want a manual fallback to offline mode, so that a failing server does not break the demo.
12. As a frontend user, I want large or globe-scale windows to request server viewport data when available, so that the globe view is not limited to static local data forever.
13. As a frontend user, I want unavailable coverage to be shown as unavailable, so that missing data is not misread as zero front activity or zero fishing effort.
14. As a developer, I want a viewport API based on `date`, `bbox`, and `step`, so that frontend, backend, and research workflows share one high-level query seam.
15. As a developer, I want viewport responses to include source, date, bbox, step, resolution, coverage, status, and caveats, so that downstream UI and tools can remain honest.
16. As a developer, I want out-of-range windows to return partial, empty, or unavailable statuses, so that the server never invents global coverage.
17. As a developer, I want viewport responses cached by query parameters, so that repeated globe and large-window interactions stay responsive.
18. As a developer, I want cache invalidation tied to a versioned output contract, so that stale payloads can be safely retired when semantics change.
19. As a backend developer, I want local and server data production to share the same pipeline shape, so that the server does not become a second source of truth.
20. As a backend developer, I want local production to remain the default for large archive work, so that unreliable server-side archive reads do not block progress.
21. As a backend developer, I want the server to fill small gaps and build caches, so that the deployed environment can improve without forcing all processing onto a laptop.
22. As a research user, I want front-response experiments to compare front buffers against non-front controls, so that response claims have a baseline.
23. As a research user, I want 10/20/30 km buffers and before/after 7-day windows, so that the method matches the product’s existing analysis vocabulary.
24. As a research user, I want bootstrap confidence intervals and permutation-test p values, so that the response analysis is more than descriptive statistics.
25. As a research user, I want experiment outputs to be reproducible, so that results can be reviewed by a developer, teacher, or collaborator.
26. As a research user, I want reports to claim apparent fishing-effort response only, so that the project does not imply catch, yield, revenue, biomass, or guaranteed fishing success.
27. As a backend developer, I want response-analysis outputs exposed through a stable script or API path, so that the research loop can be checked without an AI layer.
28. As a backend developer, I want AI/Agent work explicitly deferred, so that basic server, viewport, data/cache, and deployment work is not blocked by model-integration design.
29. As a future Agent developer, I want later tools to wrap already-stable deterministic behavior, so that an Agent layer does not change scientific or numerical semantics.
30. As a collaborator, I want server and backend work split into topic tickets, so that frontend, backend, data, docs, and deployment changes remain reviewable.
31. As a maintainer, I want each ticket to record checks and residual risk, so that follow-up work can continue without rereading the whole conversation.
32. As a maintainer, I want the server/basic-backend direction discoverable from agent-facing docs, so that other conversations can execute the same plan.
33. As a backend developer, I want FastAPI and Pydantic to define the first API contract, so that the request and response shapes are explicit rather than implied by frontend code.
34. As a backend developer, I want `/api/health` to report whether the backend is reachable, so that local development, frontend server mode, and deployed-server smoke checks have a stable probe.
35. As a backend developer, I want `/api/viewport` to accept `YYYY-MM-DD` dates and `minLon,minLat,maxLon,maxLat` bboxes, so that clients share one simple geographic query format.
36. As a backend developer, I want `step` to mean spatial sampling or downsampling interval, so that large or globe-scale requests can stay light enough for interactive use.
37. As a backend developer, I want the first viewport response to include `fronts`, `sst`, and `fishingEffort` layers, so that the API serves the current product evidence loop rather than a single decorative map layer.
38. As a frontend developer, I want viewport payloads to use a `meta`, `layers`, `coverage`, and `caveats` structure, so that rendering data, source information, coverage limits, and risk statements are not mixed together.
39. As a frontend developer, I want fishing-effort values named and documented as fishing hours or apparent fishing effort, so that no UI or downstream logic mistakes them for catch, fish count, or yield.
40. As a frontend developer, I want SST values returned in Celsius, so that display code and users do not need to infer or convert units.
41. As a backend developer, I want coordinates rounded to a stable display precision, so that payloads remain compact without pretending to have more meaningful precision than the source supports.
42. As a backend developer, I want missing or insufficient coverage to return `partial`, `empty`, or `unavailable`, so that missing front, SST, or fishing-effort coverage is never interpreted as zero activity.
43. As a backend developer, I want viewport caches keyed by query parameters and data/build version, so that cache hits are reproducible and stale semantics can be retired safely.
44. As a developer, I want the first viewport slice to use existing static data or fixtures before raw archive ingestion, so that the server boundary can be validated before the data pipeline becomes larger.
45. As a maintainer, I want the first backend slice to include local run instructions and API contract documentation, so that later frontend and server-sync work can proceed without reverse-engineering the API.

## Implementation Decisions

- Use the server API boundary as the highest testing and integration seam. The viewport API is the first concrete seam.
- Preserve offline mode as a first-class path. Server work must not make the static prototype depend on a running backend.
- Target Alibaba Cloud Ubuntu with the existing Nginx/systemd deployment shape.
- Use the already-deployed Alibaba Cloud Ubuntu server first.
- Inventory CPU, memory, disk, `/srv` free space, data directories, existing services, and sync permissions before deciding whether to expand capacity.
- Defer larger server or larger disk decisions until viewport API, frontend server mode, response-analysis smoke checks, and cache behavior are stable.
- Sync first through the existing public IP + HTTP deployment path, then add domain and HTTPS after behavior is stable.
- Keep application code and server data in separate operational roots. The application root and data root should remain separately replaceable.
- Treat credentials, real server IPs, SSH key paths, raw AIS/GFW, fine-grained grids, and incident notes as non-committable material.
- Begin without server-side GFW/AIS credentials. Later credentials should live in a server-only environment file or equivalent secret store.
- First-stage deployed data scope is the current demo window plus historical same-period samples needed by the UI and response-analysis loop.
- Exclude `frontal_intensity` from the first milestone because its archive size is around 100 GB and it is not required for the core loop.
- Produce large archive data locally by default and sync permitted outputs to the server. Let the server fill small gaps and build caches.
- The first backend implementation lives under the existing backend module.
- Use FastAPI for the server API and Pydantic for request and response models.
- The first backend slice includes `/api/health` and `/api/viewport`.
- The viewport API accepts `date`, `bbox`, and `step`.
- The `date` parameter uses `YYYY-MM-DD`.
- The `bbox` parameter uses `minLon,minLat,maxLon,maxLat`.
- The `step` parameter means spatial sampling or downsampling interval, not temporal step or map zoom.
- Viewport payloads are designed for rendering and querying, not as a direct clone of the static offline payload structure.
- Viewport payloads use a top-level `meta`, `layers`, `coverage`, and `caveats` structure.
- Viewport payloads include explicit source, date, bbox, step, resolution, status, coverage, caveats, and cache metadata.
- Viewport `coverage` distinguishes the requested bbox from the actually covered bbox. `requestBbox` records the client request; `coveredBbox`/`bbox` records the covered area and may be `null` when the request is syntactically valid but coverage is empty or unavailable.
- The first viewport layers are `fronts`, `sst`, and `fishingEffort`.
- `fishingEffort` values must be expressed as fishing hours or apparent fishing effort and must not be named as catch, fish count, yield, production, revenue, or biomass.
- SST values are returned in Celsius. If a source uses Kelvin, conversion belongs in deterministic backend code and should be reflected in metadata.
- Coordinates in viewport output should be rounded to four decimal places unless a later data contract justifies a different precision.
- Viewport business status values are `ok`, `partial`, `empty`, `unavailable`, and `invalid`.
- A syntactically valid request with `partial`, `empty`, or `unavailable` data returns HTTP 200 with explicit coverage and caveats. Invalid parameters return HTTP 400 or 422.
- Viewport queries outside available coverage return partial, empty, or unavailable statuses. Do not fill missing data with zero.
- Layer coverage is tracked per layer, so future real-data responses can express mixed states such as fronts available while SST or fishing-effort coverage is unavailable.
- Cache viewport responses first as JSON keyed by date, bbox, step, and data/build version. Tile or pyramid caching is a later optimization.
- Local development stores viewport cache outputs under `data/cache/viewport/<cache-version>/`; the deployed equivalent belongs under `/srv/ocean/data/cache/viewport/<cache-version>/`. Generated cache files are ignored and must not be committed. Commit only directory documentation or small examples when useful.
- The first viewport slice should serve existing frontend static data or fixtures through the backend contract. Direct raw NetCDF, Zenodo archive, or GFW/AIS ingestion is a later data-pipeline task.
- Current viewport adapter reads committed static prototype front objects, SST artifacts, and aggregate front-response outputs under `frontend/prototype/data`, then maps them into the backend `meta`, `layers`, `coverage`, and `caveats` response structure.
- Frontend server mode auto-detects backend health, shows the current mode, supports manual fallback, and limits server viewport requests to server mode.
- Current frontend server mode accepts `window.OF_API_BASE` or a local `?api=...` query parameter for development and deployed smoke checks.
- The frontend adapts `/api/viewport` payloads into its existing patch/render model for globe and large-window views while keeping the committed static payload as the offline fallback.
- Manual offline fallback must stop using server viewport patches and return to local data only.
- Basic deterministic query summaries are exposed under `/api/query/current-state`, `/api/query/front-response`, and `/api/query/historical-comparison`.
- Basic query responses use a shared shape: `kind`, `status`, `source`, `parameters`, `metrics`, `evidence`, `coverage`, and `caveats`.
- Basic query endpoints summarize existing deterministic viewport and history behavior; they do not introduce AI-specific tool schemas, LLM calls, or new numerical semantics.
- Missing raw historical data returns `unavailable` with sample coverage fields, not zero probability.
- Front-response query output describes apparent fishing-effort response only and must not claim catch, yield, revenue, biomass, or guaranteed fishing success.
- Provide local backend run instructions and a lightweight backend start command or script before server sync.
- Agent/AI-specific tooling is deferred until the basic backend is demonstrably stable.
- Future Agent tools, if added, should wrap deterministic project computations instead of introducing new numerical semantics.
- AI may eventually organize tasks and evidence, but deterministic code computes numerical values.
- Response-analysis experiments use front buffers, non-front controls, before/after windows, lift/difference/sample/coverage metrics, bootstrap confidence intervals, and permutation tests.
- Experiment outputs should be written as reproducible artifacts with a report-ready summary.
- The first response-analysis experiment runner is `tools/run-front-response-experiment.mjs`; it reads the committed aggregate `front-response/v1` artifact and writes manifest, JSON summary, and Markdown report under `outputs/experiments/front-response-static-prototype/`.
- Response-analysis experiment outputs must keep the claim to apparent fishing-effort response only. They must preserve missing/unavailable records as coverage limitations rather than filling missing effort with zero.
- The current aggregate response artifact contains `pre7_hours` and `post1_3_hours` inside a `-7 ~ +7` exploratory window. The first experiment package is therefore a foundation over the current committed aggregate, not full completion of the before/after 7-day acceptance item. A full symmetric post-7-day aggregate is a later data-pipeline enhancement and must not be fabricated by experiment code.
- Collaboration continues through topic branches and ticket-driven PRs in the main repository.

## Testing Decisions

- Tests should cover externally visible behavior at the highest seam possible. Prefer API responses, frontend mode behavior, and experiment artifacts over private helper implementation details.
- The primary seam is the server API boundary. A good viewport test sends date, bbox, and step inputs and verifies response status, coverage, caveats, payload shape, and cache behavior.
- Backend API tests use pytest and FastAPI TestClient for the first slice.
- Backend tests should cover `/api/health`, healthy in-range viewport queries, partial coverage, empty coverage, invalid bbox/date inputs, cache miss/hit, and unavailable SST/front/fishing-effort cases.
- Tests should assert the public API contract: HTTP status, business status, top-level payload shape, layer names, units, caveats, coverage, and cache metadata. Avoid tests that depend on private helper implementation details.
- Frontend tests should cover offline startup, server-health detection, visible mode state, manual fallback, server-mode globe or large-window request behavior, and graceful failure when the server is down.
- Deferred Agent/AI tests are out of the first wave; once added, they should verify wrapper semantics, caveats, unavailable states, and the absence of forbidden claims without changing numerical outputs.
- Response-analysis tests should verify control-region calculation, buffer radius behavior, before/after windowing, bootstrap output shape, permutation-test output shape, and report caveats.
- Existing prior art includes backend pytest tests, data contract checks, e2e browser checks, and layout checks. Reuse these patterns rather than introducing a separate test framework.
- Deployment checks should include backend health, proxied health through Nginx, viewport smoke, response-analysis smoke where available, and a sensitive scan for credentials and real server details.

## Out of Scope

- No full production multi-user permission system in this spec.
- No domain, HTTPS, or certificate automation in the first implementation milestone; it is documented as a later upgrade.
- No first-milestone `frontal_intensity` download or processing.
- No first-slice direct raw NetCDF, Zenodo archive, or GFW/AIS ingestion through `/api/viewport`.
- No requirement for raw NetCDF-backed global viewport serving before the static-prototype viewport and frontend server-mode loop are stable.
- No raw AIS/GFW, MMSI, vessel tracks, or fine-grained working grids in Git.
- No claim that apparent fishing effort equals catch, yield, production, biomass, revenue, or guaranteed fishing success.
- No required real LLM integration or Agent-tool implementation in the first backend wave.
- No global high-resolution tile pyramid in the first viewport implementation.
- No long-term monitoring, alerting, or autoscaling beyond basic runbook checks.

## Further Notes

The agreed work order is: docs and tickets first, viewport API second, viewport cache/coverage states third, frontend server mode fourth, response-analysis experiment package fifth, and existing-server sync preparation. Agent/AI work is revisited only after those basics are working.

The server is expected to support the current product/research direction rather than replace it: fishery operation support, front-event evidence, historical context, and apparent fishing-effort response under explicit data and AI boundaries.
