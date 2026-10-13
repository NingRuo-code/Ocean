# Collaborator restructure integration

This document is the source of truth for bringing the collaborator productized branch back into the Ocean main repository.

## Current decision

- Main repository: `https://github.com/NingRuo-code/Ocean`.
- Current mainline branch in this checkout: `codex-sync-current-ocean`.
- Integration branch: `codex/integrate-restructure`.
- Collaborator source: `https://github.com/JustPlayinger/ocean-front-prototype/tree/restructure`.
- Last inspected collaborator commit: `48b42d0f22996219a492cbc1d8345ade09d27da6`.

The two repositories represent the same Ocean project, but their Git histories and layouts diverged. Treat the collaborator branch as a parallel project line that must be integrated by topic, not as an ordinary upstream branch.

## Why this is not a direct merge

`git merge-base HEAD FETCH_HEAD` returns no merge base for the inspected states. The branches have unrelated histories and different layouts:

- Current Ocean layout keeps the prototype and generated demo data at the repository root: `prototype-fishing.html`, `prototype-fishing.js`, `prototype-data.js`, and `data/**`.
- The collaborator layout moves the prototype to `frontend/prototype/**`, adds `backend/**`, `deploy/**`, `tools/pipeline/**`, and `tools/ops/**`.

Use selective file/topic integration. Do not run a direct merge with unrelated histories as the integration mechanism.

## Integration order

1. Governance and ledger: record source commit, mapping rules, selected files, skipped files, and verification results.
2. Frontend layout migration: move the static prototype to `frontend/prototype/**` while preserving offline opening behavior.
3. Frontend interaction import: bring in map projection/view logic, layer drawer, GFW apparent-fishing-effort layer, and pointer/query UI changes.
4. Data contract alignment: reconcile `data/**`, `frontend/prototype/data/**`, `server_data/**`, and generated public artifacts with the existing GFW/AIS governance rules.
5. Backend API import: add FastAPI service and endpoints such as `/api/frontend/day/{date}`, `/api/fishing/**`, `/api/history/**`, and `/api/front-objects/**`.
6. Data pipeline import: add GFW, SST, front gap-fill, manifest, and queue scripts after credential and raw-data boundaries are checked.
7. Deploy and operations import: add deploy/runbook material only after removing machine-specific secrets, paths, and stale infrastructure assumptions.
8. Cutover cleanup: remove obsolete root-level duplicates only after checks pass and docs point to the new canonical layout.

## Acceptance gates

Each integration batch must end with:

- A short ledger entry in this document or a linked ticket.
- `node tools/data-check.mjs`.
- `node tools/layout-check.mjs`.
- `node tools/e2e-check.mjs`.
- `git diff --check`.

If a check cannot run, record the reason in the ledger before moving to the next batch.

## File mapping

| Collaborator path | Ocean target path |
|---|---|
| `prototype-fishing.html` | `frontend/prototype/prototype-fishing.html` |
| `prototype-fishing.js` | `frontend/prototype/prototype-fishing.js` |
| `prototype-data.js` | `frontend/prototype/prototype-data.js` |
| `data/{base,clim,day,sst,front_response}` | `frontend/prototype/data/{base,clim,day,sst,front_response}` |
| `backend/**` | `backend/**` |
| `deploy/**` | `deploy/**` |
| `tools/pipeline/**` | `tools/pipeline/**` |
| `tools/ops/**` | `tools/ops/**` |

## Protected project boundaries

- Preserve the product direction in `docs/agents/domain.md`: fishery operation support, front-event representation, historical context, and AIS apparent fishing-effort response.
- Preserve the AI boundary: deterministic code computes numerical values; AI organizes tasks and evidence.
- Preserve the data boundary in `docs/data-governance-gfw-ais.md`: do not commit raw AIS/GFW source data, reconstructable restricted data, or credential values.
- Preserve the current server credential/access-control work unless an integration ticket explicitly replaces it with a reviewed equivalent.

## Integration ledger

| Date | Batch | Source | Result | Checks |
|---|---|---|---|---|
| 2026-10-11 | G0 governance | `4a907a1` | Created integration branch and documented the selective integration route. | `data-check` 0/914; `e2e-check` 0/112; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B1 frontend layout | Current Ocean root prototype + `4a907a1` layout target | Added canonical `frontend/prototype/**`, copied offline prototype/data there, switched checks to the new path, kept root prototype as a temporary compatibility entry. | `data-check` 0/914; `e2e-check` 0/112; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B2a layer drawer | `4a907a1` frontend interaction pattern | Replaced the always-visible map legend with a left-side layer drawer opened by `☰` or left-edge hover; kept existing offline layer semantics and did not yet import globe/viewport data loading. | `data-check` 0/914; `e2e-check` 0/112; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B2b map geometry module | `4a907a1` `prototype-map.js` | Imported `prototype-map.js` and routed current plane projection constants/conversion through `OFMap`; globe mode and server bbox loading remain disabled for later batches. | `data-check` 0/914; `e2e-check` 0/113; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B2c viewport memory | `4a907a1` viewport-memory pattern | Added local `of.view.v1` persistence for map zoom and SVG center while keeping the current plane-only viewport model. | `data-check` 0/914; `e2e-check` 0/114; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B2d multi-level basemap data | `4a907a1` `data/base/{asia,world}.js` | Imported west-Pacific and world Natural Earth basemap payloads into `frontend/prototype/data/base/**` and exposed them through `OFData` for later large-area/globe rendering; current East China Sea plane rendering remains unchanged. | `data-check` 0/917; `e2e-check` 0/114; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B2e GFW/AIS effort layer contract | `4a907a1` frontend fishing-effort pattern | Added a disabled-by-default `ground` map layer and `OF_DATA_FISHING` adapter contract for public aggregate apparent fishing-effort cells; no raw or restricted AIS/GFW data is committed, and missing cells render as empty rather than zero. | `data-check` 0/918; `e2e-check` 0/116; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B3 backend API baseline | `4a907a1` `backend/**` | Imported the collaborator FastAPI backend, scripts, tests, and backend packaging metadata as the first server baseline for catalog, frontend payload, history, front-object, AI analysis, and GFW/AIS fishing-effort endpoints. | `backend pytest` 7 passed with `--basetemp`; `data-check` 0/918; `e2e-check` 0/116; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B4 data pipeline baseline | `4a907a1` `tools/pipeline/**` | Imported GFW apparent-fishing-effort, SST/global SST, front gap-fill, local front fetch, and sync helper scripts. Deployment and ops materials remain deferred because they contain machine-specific server/IP/key handoff details requiring a cleanup pass. | `compileall tools/pipeline` pass; `fetch_gfw_effort --dry-run` pass; `data-check` 0/918; `e2e-check` 0/116; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B5 deploy and ops baseline | `4a907a1` sanitized `deploy/**` and `tools/ops/**` | Imported reusable deployment scripts, nginx/systemd templates, a sanitized runbook, and server ops helpers. Skipped historical handover/key-management/VS Code task material because it contains real server addresses, key fingerprints, personal paths, and incident-specific state. | sensitive scan pass; shell parse pass; PowerShell parse pass; `data-check` 0/918; `e2e-check` 0/116; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B6 cutover cleanup | canonical `frontend/prototype/**` | Removed root-level prototype and generated static `data/**` duplicates, kept `data/raw|processed|cache` as ignored local/server workspaces, and updated docs to the canonical offline/server-enhanced run paths. | `data-check` 0/918; `e2e-check` 0/116; `layout-check` 0; `diff --check` pass |
| 2026-10-11 | B7 globe viewport parity | `4a907a1` `frontend/prototype/**` + checks/docs | Imported the target SVG orthographic globe viewport, globe/data-window control, globe drag rotation, viewport memory, server-mode viewport patch contract, real aggregate front-response input, and globe regression checks. Sanitized target docs to avoid stale server/handover references. | sensitive scan pass; `data-check` 0/914; `e2e-check` 0/127; `layout-check` 0; `diff --check` pass |
| 2026-10-13 | B8 fishing-effort layer demand-load fix | `48b42d0` frontend fix + sanitized runbook note | Integrated the collaborator fix by wiring the `ground` layer to `OFData.ensureFishing(iso)` when the layer opens or the date changes while the layer is active. Aligned failed fishing fetches with the retryable timestamp window and added static contract checks so the layer cannot silently regress to reading an empty cache only. Added sanitized server manifest rebuild guidance without real server addresses, credentials, or raw data. | `data-check` 0/916; `e2e-check` 0/128; `layout-check` 0; `diff --check` pass |
