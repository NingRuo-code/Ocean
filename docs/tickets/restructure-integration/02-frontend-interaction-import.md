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

