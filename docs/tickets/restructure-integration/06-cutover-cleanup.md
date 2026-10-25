# Ticket 06: cutover cleanup

## Goal

After selected collaborator functionality is integrated, remove duplicate transitional paths and make the new layout canonical.

## Scope

- Remove obsolete root-level prototype files if `frontend/prototype/**` is canonical.
- Update README, docs, and tool defaults to the canonical paths.
- Archive or rewrite old collaboration notes that point at the wrong source of truth.

## Acceptance

- One documented canonical run path exists for offline prototype use.
- One documented canonical server-enhanced run path exists.
- All checks pass from a clean checkout.

## Progress

- Removed root-level `prototype-fishing.html`, `prototype-fishing.js`, and `prototype-data.js` transitional entries.
- Removed root-level generated static `data/**` duplicate; canonical static data is now `frontend/prototype/data/**`.
- Kept `data/raw`, `data/processed`, and `data/cache` as ignored local/server workspaces by convention rather than committed static payload paths.
- Updated README and data README links to point at the canonical offline and server-enhanced run paths.

## Verification

- `node tools/data-check.mjs`
- `node tools/e2e-check.mjs`
- `node tools/layout-check.mjs`
- `git diff --check`
