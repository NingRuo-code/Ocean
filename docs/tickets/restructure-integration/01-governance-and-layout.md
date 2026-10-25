# Ticket 01: governance and layout migration

## Goal

Establish the integration branch, document the collaborator source, and migrate the static prototype into the canonical `frontend/prototype/**` layout without changing behavior.

## Scope

- Add integration documentation and agent pointer.
- Create `frontend/prototype/**`.
- Move or copy the current root prototype files and generated demo data into the new layout.
- Keep root-level compatibility files only if needed for a temporary transition.

## Acceptance

- `frontend/prototype/prototype-fishing.html` opens with relative data paths.
- Existing offline prototype behavior is preserved.
- Data, layout, e2e, and diff checks are recorded.

## Result

Completed on 2026-10-11.

- Added `docs/collab-restructure-integration.md` and the local restructure-integration ticket set.
- Added the `AGENTS.md` pointer for future restructure integration work.
- Created `frontend/prototype/**` and copied the current offline prototype/data into that canonical layout.
- Switched `tools/data-check.mjs`, `tools/e2e-check.mjs`, and `tools/layout-check.mjs` to the canonical path.
- Hardened browser checks to use isolated debug ports/profiles and non-zero exit codes on failures.
- Moved the current page's historical AIS response card above the operation-cue list so the research-mainline evidence remains visible at 1280 px.

Checks:

- `node tools/data-check.mjs`: 0 failures / 914.
- `node tools/e2e-check.mjs`: 0 failures / 112.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

