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
- Whitespace: `git diff --check` passed.
- Sensitive scan: changed deploy/docs files contained no real public IP, SSH key path, token, credential, or personal path. Only loopback `127.0.0.1` and sample viewport bbox decimals were present.
- Data contract check: `node tools/data-check.mjs` passed with `FAIL 0/916`.
- Backend regression: `python -m pytest tests -q --tb=short --basetemp .pytest-basetemp-ticket06-final -p no:cacheprovider` passed with 20 tests.

## Implemented

- Expanded `deploy/RUNBOOK.md` into the sanitized existing-server sync runbook.
- Added read-only server inventory helper: `deploy/inventory-server.sh`.
- Added public HTTP smoke helper: `deploy/server-smoke.ps1`.
- Extended the smoke helper so deployed-server validation catches stale or missing fishing-effort manifests, including empty day payloads that would otherwise leave the frontend `ground` layer empty.
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
- GitHub Issue synchronization could not be completed through `gh` on this machine because the CLI is not installed.
