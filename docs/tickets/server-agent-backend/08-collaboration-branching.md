# Ticket 08: Collaboration Branching And PR Flow

## Goal

Keep server/Agent backend work reviewable as the project moves back to one shared repo.

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

- `git status --short`
- Relevant tests for the touched area
