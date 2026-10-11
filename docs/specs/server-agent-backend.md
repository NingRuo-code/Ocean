# Spec: Server / Basic Backend Phase

## Problem Statement

Ocean already has a strong offline fishery-operation prototype with front, SST, apparent-fishing-effort response, and globe/viewport interaction. The next problem is that the project cannot yet behave like a server-assisted analysis system: large or globe-scale viewports are still constrained by static offline payloads, research experiments are not yet packaged as reproducible server-side outputs, and deployment remains a later operational step rather than a verified path.

The user needs the project to move toward a deployable and research-verifiable system while preserving the offline demo path. The server must support frontend and backend API deployment, data production/cache, viewport responses, and reproducible response-analysis outputs without exposing raw restricted data or overstating the scientific claim. Agent/AI tooling is deliberately deferred until the basic functionality is stable.

## Solution

Build a server/basic-backend phase around a single high-level seam: the server API boundary. The first server milestone will run the frontend plus FastAPI backend on a larger Alibaba Cloud Ubuntu server, with data under a server data directory and Nginx proxying `/api`.

The backend will first add a viewport API that accepts `date`, `bbox`, and `step`, then returns a light render/query payload with explicit source, resolution, coverage, status, and caveats. The frontend will auto-detect server availability, show the current offline/server mode, allow manual fallback, and use the viewport API for large or globe-scale windows only when server mode is active.

The response-analysis research path will be packaged as reproducible experiment outputs using non-front controls, bootstrap confidence intervals, and permutation tests over the first sample region/window. Deployment planning will target a 4 vCPU / 8 GB RAM / 200 GB SSD or data-disk Alibaba Cloud server, initially public IP + HTTP, later domain + HTTPS.

Agent/AI contracts are not part of the first implementation wave. Later Agent tools may wrap stable deterministic APIs and experiment outputs, but they should not gate viewport, server mode, data/cache, research validation, or deployment work.

## User Stories

1. As a project owner, I want the offline prototype to keep working, so that classroom, interview, and no-network demos are not broken by server work.
2. As a project owner, I want a server mode, so that the same product can grow beyond committed static payloads.
3. As a project owner, I want the server to run frontend and backend API together, so that demonstrations can use a realistic deployment shape.
4. As a project owner, I want a clear first server size, so that I can buy or upgrade an Alibaba Cloud server without guessing.
5. As a project owner, I want raw, processed, cache, and output data separated, so that server operations do not leak restricted or reconstructable data.
6. As a project owner, I want server IPs, key paths, credentials, and incident notes kept out of Git, so that collaboration does not create security debt.
7. As a project owner, I want first deployment to work by public IP and HTTP, so that domain and HTTPS setup do not block API validation.
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

## Implementation Decisions

- Use the server API boundary as the highest testing and integration seam. The viewport API is the first concrete seam.
- Preserve offline mode as a first-class path. Server work must not make the static prototype depend on a running backend.
- Target Alibaba Cloud Ubuntu with the existing Nginx/systemd deployment shape.
- Recommend the first server as 4 vCPU, 8 GB RAM, and 200 GB SSD or data disk.
- Deploy first through public IP and HTTP, then add domain and HTTPS after behavior is stable.
- Keep application code and server data in separate operational roots. The application root and data root should remain separately replaceable.
- Treat credentials, real server IPs, SSH key paths, raw AIS/GFW, fine-grained grids, and incident notes as non-committable material.
- Begin without server-side GFW/AIS credentials. Later credentials should live in a server-only environment file or equivalent secret store.
- First deployment data scope is the current demo window plus historical same-period samples needed by the UI and response-analysis loop.
- Exclude `frontal_intensity` from the first milestone because its archive size is around 100 GB and it is not required for the core loop.
- Produce large archive data locally by default and sync permitted outputs to the server. Let the server fill small gaps and build caches.
- The viewport API accepts `date`, `bbox`, and `step`.
- Viewport payloads are designed for rendering and querying, not as a direct clone of the static offline payload structure.
- Viewport payloads include explicit source, date, bbox, step, resolution, status, coverage, caveats, and cache metadata.
- Viewport queries outside available coverage return partial, empty, or unavailable statuses.
- Cache viewport responses first as JSON keyed by date, bbox, and step. Tile or pyramid caching is a later optimization.
- Frontend server mode auto-detects backend health, shows the current mode, supports manual fallback, and limits server viewport requests to server mode.
- Agent/AI-specific tooling is deferred until the basic backend is demonstrably stable.
- Future Agent tools, if added, should wrap deterministic project computations instead of introducing new numerical semantics.
- AI may eventually organize tasks and evidence, but deterministic code computes numerical values.
- Response-analysis experiments use front buffers, non-front controls, before/after windows, lift/difference/sample/coverage metrics, bootstrap confidence intervals, and permutation tests.
- Experiment outputs should be written as reproducible artifacts with a report-ready summary.
- Collaboration continues through topic branches and ticket-driven PRs in the main repository.

## Testing Decisions

- Tests should cover externally visible behavior at the highest seam possible. Prefer API responses, frontend mode behavior, and experiment artifacts over private helper implementation details.
- The primary seam is the server API boundary. A good viewport test sends date, bbox, and step inputs and verifies response status, coverage, caveats, payload shape, and cache behavior.
- Backend tests should cover healthy in-range viewport queries, partial coverage, empty coverage, invalid bbox/date inputs, cache miss/hit, and unavailable SST/front cases.
- Frontend tests should cover offline startup, server-health detection, visible mode state, manual fallback, server-mode globe or large-window request behavior, and graceful failure when the server is down.
- Deferred Agent/AI tests are out of the first wave; once added, they should verify wrapper semantics, caveats, unavailable states, and the absence of forbidden claims without changing numerical outputs.
- Response-analysis tests should verify control-region calculation, buffer radius behavior, before/after windowing, bootstrap output shape, permutation-test output shape, and report caveats.
- Existing prior art includes backend pytest tests, data contract checks, e2e browser checks, and layout checks. Reuse these patterns rather than introducing a separate test framework.
- Deployment checks should include backend health, proxied health through Nginx, viewport smoke, response-analysis smoke where available, and a sensitive scan for credentials and real server details.

## Out of Scope

- No full production multi-user permission system in this spec.
- No domain, HTTPS, or certificate automation in the first implementation milestone; it is documented as a later upgrade.
- No first-milestone `frontal_intensity` download or processing.
- No raw AIS/GFW, MMSI, vessel tracks, or fine-grained working grids in Git.
- No claim that apparent fishing effort equals catch, yield, production, biomass, revenue, or guaranteed fishing success.
- No required real LLM integration or Agent-tool implementation in the first backend wave.
- No global high-resolution tile pyramid in the first viewport implementation.
- No long-term monitoring, alerting, or autoscaling beyond basic runbook checks.

## Further Notes

The agreed work order is: docs and tickets first, viewport API second, viewport cache/coverage states third, frontend server mode fourth, response-analysis experiment package fifth, and server deployment preparation when server access exists. Agent/AI work is revisited only after those basics are working.

The server is expected to support the current product/research direction rather than replace it: fishery operation support, front-event evidence, historical context, and apparent fishing-effort response under explicit data and AI boundaries.
