# Ocean Collaboration Branching And PR Flow

This document defines how Ocean work moves through the shared repository. Use it for normal feature work, server/backend changes, and future collaborator imports.

## Branch Roles

| Branch Type | Name Pattern | Purpose |
|---|---|---|
| Stable mainline | `main` or the repository default branch | Reviewed project history only |
| Phase integration | `codex/server-agent-backend` | Current server/basic-backend planning and integration branch |
| Topic branch | `codex/<ticket-or-topic>` | One reviewable slice for frontend, backend, data, docs, or deploy work |
| External reference | `JustPlayinger/ocean-front-prototype@restructure` | Source for selective topic integration only; do not directly overwrite local repo state |

`codex/server-agent-backend` is the current phase branch. Use smaller topic branches when a change is large enough to review separately, then merge back by PR after checks are recorded.

## Ticket To PR Rule

Every implementation PR should reference one or more tickets:

```text
Refs: docs/tickets/server-agent-backend/07-data-pipeline-and-cache.md
```

If GitHub Issues are available, also reference the issue number. If the GitHub CLI is not installed or authenticated, keep the ticket file as the source of truth and record that limitation in the ticket's residual risks or checks.

Before opening or merging a PR:

1. Update the matching ticket status.
2. Record the checks that actually ran.
3. Record residual risks.
4. Confirm `git status --short` contains only intentional changes.
5. Confirm no server IPs, SSH key paths, credentials, raw restricted data, or personal paths are staged.

## Topic Split

Prefer one logical slice per branch or PR:

| Work Type | Typical Scope | Required Checks |
|---|---|---|
| frontend | `frontend/prototype/**`, browser behavior, layout | `node tools/data-check.mjs`, `node tools/e2e-check.mjs`, `node tools/layout-check.mjs` when behavior/layout changes |
| backend | `backend/app/**`, `backend/scripts/**`, API contracts | targeted pytest, full backend pytest before merge |
| data/cache | `data/cache` docs, cache scripts, pipeline scripts | dry-run/smoke command, `node tools/data-check.mjs`, relevant backend tests |
| deploy/server | `deploy/**`, server runbook, systemd/nginx | shell/PowerShell parse checks, sensitive scan, smoke path documentation |
| docs/spec | `docs/**`, `AGENTS.md`, ticket files | `git diff --check`; run data or code checks if docs alter contracts |

Do not bundle unrelated frontend, backend, deployment, and data-governance rewrites into one PR unless the ticket explicitly requires the combined change.

## Collaborator Repo Integration

When importing or comparing against `JustPlayinger/ocean-front-prototype@restructure`:

- Follow `docs/collab-restructure-integration.md`.
- Record the source commit.
- Integrate by topic and file mapping.
- Do not direct-merge unrelated histories.
- Do not overwrite local deployment, credential, data, or incident material.
- Keep raw AIS/GFW, MMSI, vessel tracks, restricted grids, credentials, real server IPs, and key paths out of commits.

## Server Sync Rule

Server sync happens after a verified branch is pushed:

1. Run local checks for the touched area.
2. Push the topic or phase branch.
3. Sync the deployed server from the approved branch using `deploy/RUNBOOK.md`.
4. Run `deploy/server-smoke.ps1` or equivalent public HTTP smoke checks.
5. Record server smoke results in the ticket or issue.

Domain and HTTPS remain later operational work. The current sync path uses the existing public-IP HTTP deployment path.

## PR Body Checklist

Use `.github/pull_request_template.md` for PRs. Keep the body short but complete:

- ticket references;
- summary of code/docs/data/deploy changes;
- checks that passed;
- checks skipped with reason;
- data/security boundary confirmation;
- server sync status when relevant.
