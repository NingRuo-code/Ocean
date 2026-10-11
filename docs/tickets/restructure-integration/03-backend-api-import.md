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

