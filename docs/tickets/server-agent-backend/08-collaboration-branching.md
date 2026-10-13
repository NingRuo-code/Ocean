# Ticket 08: Collaboration Branching And PR Flow

Status: done on `codex/server-agent-backend`.

## Goal

Keep server/basic-backend work reviewable as the project moves back to one shared repo.

## Scope

- Use topic branches for frontend, backend, data, and docs tickets.
- Keep `codex/server-agent-backend` as the planning/integration branch for this phase.
- Record ticket status in the ticket files or GitHub Issues.
- Avoid direct overwrite imports from collaborator repos; integrate by topic and preserve data/security boundaries.

## Acceptance

- Each implementation PR references one or more tickets.
- Tests/checks are recorded in the ticket before merge.
- Server IPs, credentials, raw restricted data, and personal paths remain out of commits.

## Checks

- `git status --short --branch` showed only the intentional collaboration-flow changes plus unrelated untracked `项目进度分析报告.md`.
- `git diff --check` passed.
- `node tools/data-check.mjs` passed with `FAIL 0/914`.
- Sensitive scan found only boundary reminder text and loopback `127.0.0.1`; no real server IP, SSH key path, credential, token, or personal path was added.

## Implemented

- Added `docs/collaboration-pr-flow.md` as the shared branching, ticket, PR, collaborator-import, and server-sync workflow.
- Added `.github/pull_request_template.md` so implementation PRs record ticket references, checks, data/security boundaries, and server-sync status.
- Updated `AGENTS.md` so future agent conversations can discover the collaboration/PR flow.
- Linked the collaboration flow from `README.md`.

## Residual Risks

- GitHub Issue/PR synchronization could not be performed locally through `gh` because the CLI is not installed in this environment.
- The existing server still needs an operator with access to sync the pushed branch and record public HTTP smoke results.
