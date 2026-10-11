# Ticket 02: frontend interaction import

## Goal

Import the collaborator frontend interaction improvements after the layout is stable.

## Scope

- `prototype-map.js` projection and view model.
- Globe/plane view switching and view memory.
- Layer drawer behavior.
- GFW apparent-fishing-effort layer display.
- Pointer query simplification and selected-object feedback.

## Acceptance

- Existing P1 GFW/AIS response card still works.
- Missing AIS/GFW data is displayed as unavailable, not zero.
- The map remains usable offline.
- Regression checks pass or blockers are recorded.

## Progress

2026-10-11:

- Imported the low-risk layer-drawer interaction pattern into `frontend/prototype/prototype-fishing.html` and `frontend/prototype/prototype-fishing.js`.
- The drawer opens from the `☰` button or left-edge hover, and closes from `✕` or mouse leave.
- Existing layer toggles still drive the same offline `state.layers` rendering path.
- Globe/projection, server bbox loading, and real GFW fishing-effort layer are intentionally deferred to later sub-batches.

Checks:

- `node tools/data-check.mjs`: 0 failures / 914.
- `node tools/e2e-check.mjs`: 0 failures / 112.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

2026-10-11:

- Imported `data/base/asia.js` and `data/base/world.js` from the collaborator branch into the canonical frontend data directory.
- `prototype-fishing.html` now loads East China Sea, west-Pacific, and world basemap payloads before the data adapter.
- `OFData` exposes `basemapAsia` and `basemapWorld` for later globe / large-area viewport batches.
- Current rendering intentionally still uses the East China Sea detail basemap; this batch only adds offline data contracts and checks.

Checks:

- `node tools/data-check.mjs`: 0 failures / 917.
- `node tools/e2e-check.mjs`: 0 failures / 114.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

2026-10-11:

- Added a disabled-by-default `ground` layer for GFW/AIS apparent fishing-effort cells.
- `OFData` now exposes `fishingDay()` and a placeholder `ensureFishing()` contract around `window.OF_DATA_FISHING`.
- The map renders only public aggregate `fishing_hours` cells as a dot layer; missing data draws nothing and is not interpreted as 0.
- E2E injects a small in-memory aggregate fixture to verify draw/clear behavior without committing raw AIS/GFW or restricted data.

Checks:

- `node tools/data-check.mjs`: 0 failures / 918.
- `node tools/e2e-check.mjs`: 0 failures / 116.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

2026-10-11:

- Imported `frontend/prototype/prototype-map.js` from the collaborator branch as an isolated geometry module.
- Routed current plane projection constants and `xy` / `geoOfXY` conversions through `window.OFMap`.
- Kept the existing viewport model, zoom bounds, offline data window, and rendering behavior unchanged.
- Added an e2e assertion that `OFMap` is loaded and maps the project anchor to/from the expected SVG center.
- Deferred globe mode, viewport memory, world/Asia base layers, and server bbox data loading.

Checks:

- `node tools/data-check.mjs`: 0 failures / 914.
- `node tools/e2e-check.mjs`: 0 failures / 113.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

2026-10-11:

- Added local viewport memory under `localStorage["of.view.v1"]`.
- The current plane-only map now restores saved zoom and SVG center before initial render.
- e2e checks verify that a zoom writes finite `zoom/cx/cy` values to local storage.
- This remains a local browser convenience only; it does not change data scope, projection mode, or server loading.

Checks:

- `node tools/data-check.mjs`: 0 failures / 914.
- `node tools/e2e-check.mjs`: 0 failures / 114.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

2026-10-11:

- Imported the full SVG orthographic globe viewport from collaborator commit `4a907a1`.
- Added the `🌍` globe/data-window control, plane/globe view switching, globe drag rotation, globe coverage boxes, globe scale caveat, and persisted `{lon0, lat0, zoom}` view memory.
- Aligned frontend data loading with viewport patches: offline remains local-only, while server mode can request `bbox` + `step` overview payloads for large-area/globe windows.
- Imported the real aggregate front-response input and regenerated `events.js` from public GFW apparent fishing-effort aggregates; raw/fine-grained AIS/GFW data remains out of repo.
- Updated data/e2e/layout checks so globe behavior is regression-tested, including whole-earth view, globe round-trip projection, drag rotation, center stability, return-to-data-window, and view-memory restore.

Checks:

- `node tools/data-check.mjs`: 0 failures / 914.
- `node tools/e2e-check.mjs`: 0 failures / 127.
- `node tools/layout-check.mjs`: 0 failures.
- Sensitive scan for real server/key/personal-path material: no matches after sanitizing one documentation example.
- `git diff --check`: pass.
