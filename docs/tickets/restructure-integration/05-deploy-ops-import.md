# Ticket 05: deploy and operations import

## Goal

Import deploy and operations material after removing stale, machine-specific, and sensitive assumptions.

## Scope

- Deployment scripts.
- Nginx/systemd examples.
- Server handover and runbook content.
- Teammate onboarding scripts and operational incident notes.

## Acceptance

- Docs distinguish reusable procedure from historical incident notes.
- No private key material, credential value, or personal machine path is committed.
- Server-specific values are examples or environment variables.


## Progress

- Imported sanitized deployment templates from collaborator commit `4a907a1`:
  - `deploy/deploy.ps1`
  - `deploy/remote-setup.sh`
  - `deploy/probe-ports.ps1`
  - `deploy/nginx/ocean.conf`
  - `deploy/nginx/ocean-test.conf`
  - `deploy/systemd/ocean-api.service`
- Imported server operations helpers from `tools/ops/**` after confirming they do not contain credential values.
- Added `deploy/RUNBOOK.md` as the reusable runbook for future developers and agents.
- Deliberately did not import historical handover docs, teammate key-management docs, VS Code remote tasks, or collaborator-specific incident notes because they include real server IPs, key fingerprints, personal paths, and machine-specific state.

## Verification

- Sensitive scan target: imported deploy/ops files must not contain the collaborator real server IP, public key material, private-key markers, or personal machine paths.
- Shell syntax: run `bash -n` for imported `.sh` files.
- PowerShell syntax: parse imported `.ps1` files.
- Standard gates: `data-check`, `e2e-check`, `layout-check`, and `diff --check`.
