# Ticket 03: Frontend Server Mode

Status: Done.

## Goal

Let the frontend use server data when available while preserving offline fallback.

## Scope

- Auto-detect `/api/health`.
- Show current data mode: offline or server.
- Provide a manual mode switch.
- Use viewport API for globe/large-window requests in server mode.
- On server failure, show the reason and fall back to offline data.

## Acceptance

- Opening the page without a server still works.
- Opening the page with a healthy server displays server mode.
- Manual fallback returns to offline mode.
- Globe/large-window server requests are covered by e2e checks.

## Checks

- `node tools/e2e-check.mjs`
- `node tools/layout-check.mjs`

## Completion Notes

- The frontend now detects `/api/health`, exposes the current server/offline mode, and supports a manual mode switch.
- Server mode defaults to same-origin `/api` on HTTP(S) pages, and also accepts `window.OF_API_BASE` or `?api=...` for local/deployed smoke checks.
- The viewport response is adapted into the existing frontend patch model so the current map renderer can continue to draw fronts, SST, and apparent-fishing-effort evidence without changing the offline data path.
- Manual offline fallback hides server patches and returns the page to the local static payload.
- E2E coverage now includes both default offline startup and an opt-in server-mode run with `EXPECT_SERVER=1`.

Verified on 2026-10-13:

- `node tools/e2e-check.mjs`
- `node tools/layout-check.mjs`
- `EXPECT_SERVER=1 PAGE=http://127.0.0.1:5173/frontend/prototype/prototype-fishing.html?api=http://127.0.0.1:8000/api node tools/e2e-check.mjs`

## Residual Risks

- The frontend adapts `/api/viewport` into the existing patch renderer rather than replacing the renderer with a native viewport renderer. This keeps the first server-mode slice small, but some richer backend metadata is still not exposed in the UI.
- The current server viewport source is the static prototype adapter. Raw NetCDF-backed global serving and raw AIS/GFW ingestion remain later data-pipeline tasks.
- The server-mode e2e check verifies real `/api/viewport` network requests against a local backend/static-server setup; deployed-server smoke checks still belong to the later existing-server sync ticket.

## Viewport consumption follow-up — 2026-10-27 (#8)

The #6/#7 prerequisites are closed. The current follow-up binds settled coverage to actual patch/request identity, displays partial/empty/unavailable outcomes, removes planar global prewarming, and keeps historical response markers separate from daily activity. Local data retained after day or viewport failure is labelled explicitly. Original map projections and layout stay in place.

The [display boundary](../../data/viewport-display-state.md) and [implementation evidence](../../reports/ocean-viewport-display-implementation-2026-10-27.md) record actual loopback browser reads, controlled counterexamples and 1440/390 screenshots separately. Production deployment, global raw serving, P0 research qualification and P1 performance/capacity targets remain open under their original tickets. The user plans server replacement; old-server deep inspection and deployment remain deferred.
