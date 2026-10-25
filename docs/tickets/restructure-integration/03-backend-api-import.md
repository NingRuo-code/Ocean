# Ticket 03: backend API import

## Goal

Bring the collaborator FastAPI backend into the main Ocean repository after frontend contracts are stable.

## Scope

- API health and catalog endpoints.
- `/api/frontend/day/{date}` server-enhanced frontend payload.
- `/api/fishing/**` apparent fishing-effort endpoints.
- `/api/history/**`, `/api/front-objects/**`, and report/point-query endpoints.

## Acceptance

- The backend can start locally.
- API responses preserve the same data semantics as the offline frontend contract.
- Credential and raw-data boundaries remain compatible with `docs/data-governance-gfw-ais.md`.

## Progress

2026-10-11:

- Imported `backend/**` from collaborator commit `4a907a1`.
- Added the FastAPI backend package, app modules, backend scripts, and `backend/tests/test_api.py`.
- Installed backend development dependencies from `backend/pyproject.toml` in the Codex runtime environment.
- Verified the backend test suite with an explicit repository-local pytest base temp directory because the default Windows temp pytest directory was not readable in this session.
- This batch imports code only; no raw AIS/GFW data, reconstructable restricted data, credentials, or local server artifacts are committed.

Checks:

- `python -m pytest --basetemp D:\VscodeProject\Ocean\.tmp\pytest\basetemp` from `backend/`: 7 passed.
- `node tools/data-check.mjs`: 0 failures / 918.
- `node tools/e2e-check.mjs`: 0 failures / 116.
- `node tools/layout-check.mjs`: 0 failures.
- `git diff --check`: pass.

