# Ticket 06: Existing Server Sync Runbook

Status: done on `codex/server-agent-backend`.

## Goal

Prepare the sanitized update/sync path for the already-deployed Alibaba Cloud server.

## Scope

- Update deployment docs for the existing deployed-server sync strategy.
- Include a capacity inventory section for CPU, memory, disk, `/srv` free space, active services, sync user/access model, Nginx, and systemd.
- Document how local verified project updates are synced to the deployed server.
- Document `/opt/ocean`, `/srv/ocean/data`, and `/etc/ocean`.
- Keep the current public IP + HTTP path.
- Document later domain + HTTPS upgrade.
- Keep real server IPs, SSH key paths, credentials, and incident notes out of Git.
- Document the later upgrade path to a larger server or data disk without making it part of the first milestone.

## Acceptance

- A developer can sync verified updates to the deployed server from the runbook using placeholders.
- `/api/health`, viewport API, and response-analysis/basic-query smoke checks are included.
- Data sync and cache directories are documented.

## Checks

- Shell parse: `deploy/inventory-server.sh` and `deploy/remote-setup.sh` passed `bash -n` through WSL. WSL emitted a local `localhost` forwarding warning, but the parser check exited successfully.
- PowerShell parse: `deploy/server-smoke.ps1`, `deploy/deploy.ps1`, and `deploy/probe-ports.ps1` parsed successfully.
- Server smoke contract check: `deploy/server-smoke.ps1` now includes `/api/fishing/availability` and `/api/fishing/<date>` checks, requires the sampled fishing day to contain at least one cell, and provides `-FishingDate` override plus explicit `-SkipFishing` escape hatch.
- Static regression check: `tools/data-check.mjs` now asserts that the smoke helper keeps the fishing availability/day endpoints and the non-empty fishing-cell guard.
- Whitespace: `git diff --check` passed.
- Sensitive scan: changed deploy/docs files contained no real public IP, SSH key path, token, credential, or personal path. Only loopback `127.0.0.1` and sample viewport bbox decimals were present.
- Data contract check: `node tools/data-check.mjs` passed with `FAIL 0/918`.
- Backend regression: `python -m pytest tests -q --tb=short --basetemp .pytest-basetemp-ticket06-final -p no:cacheprovider` passed with 20 tests.

## Implemented

- Expanded `deploy/RUNBOOK.md` into the sanitized existing-server sync runbook.
- Added read-only server inventory helper: `deploy/inventory-server.sh`.
- Added public HTTP smoke helper: `deploy/server-smoke.ps1`.
- Extended the smoke helper so deployed-server validation catches stale or missing fishing-effort manifests, including empty day payloads that would otherwise leave the frontend `ground` layer empty.
- Locked that fishing smoke contract into the repository data check so later edits cannot silently remove the deployed-server guard.
- Updated `deploy/remote-setup.sh` to create `/srv/ocean/data/outputs`.
- Updated `deploy/systemd/ocean-api.service` so the API service may write cache, processed data, and outputs under `/srv/ocean/data`.
- The runbook covers:
  - local pre-sync checks;
  - capacity inventory for CPU, memory, disk, `/srv` free space, sync/access model, active services, Nginx, systemd, and cache counts;
  - code-only sync and optional permitted data sync;
  - `/opt/ocean`, `/srv/ocean/data`, and `/etc/ocean` boundaries;
  - public-IP HTTP smoke checks;
  - `/api/health`, viewport, basic-query, and response-analysis artifact checks;
  - later domain/HTTPS and capacity upgrade path.

## Residual Risks

- The runbook uses placeholders and does not prove access to the real server. Actual server inventory values must be collected by the operator with server access.
- Cache eviction is documented as a policy boundary here; implementation belongs to Ticket 07.
- The initial implementation did not synchronize the GitHub issue. The 2026-10-27 follow-up uses the configured GitHub CLI; current remote status is tracked under #10.

## Follow-up — 2026-10-27 (#10)

- Updated the existing-server runbook for the user's planned replacement: old-server deep inventory/deploy is deferred; a minimal migration inventory and actual-target admission remain required.
- Separated source-checkout sync from the platform-specific O01 isolated read-only package. Legacy broad deploy/setup helpers are retained but no longer recommended as the current full production release route.
- Fixed-commit/asset manifest, environment/data boundaries, browser fallback and compatible rollback are explicit. #11 real sync, #12 completion review and OPS release/backup gates remain open.
- The original PowerShell smoke command now emits sanitized scoped JSON, validates conditions/units/counts and distinguishes ready, limited and failed. `-RequireReady` rejects limited/skipped support; zero hours remains valid. It accepts the current frontend contract and UTF-8 native API metadata.
- Test seam follows the original #1/#10 API/CLI entry: original FastAPI and page behind a path-only loopback ingress, plus explicitly controlled boundary failures. No production connection, deployment or raw download.
- Checks and actual execution evidence are recorded in the implementation report before merge.
