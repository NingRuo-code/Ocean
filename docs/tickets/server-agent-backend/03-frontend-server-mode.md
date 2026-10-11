# Ticket 03: Frontend Server Mode

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
