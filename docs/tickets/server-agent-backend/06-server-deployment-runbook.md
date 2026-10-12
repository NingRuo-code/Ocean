# Ticket 06: Existing Server Sync Runbook

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

- Shell/PowerShell parse checks for changed deploy scripts.
- Sensitive scan for IPs, keys, credentials, and personal paths.
