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
