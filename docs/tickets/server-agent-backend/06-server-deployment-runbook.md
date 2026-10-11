# Ticket 06: Server Deployment Runbook

## Goal

Prepare the sanitized deployment path for the new Alibaba Cloud server.

## Scope

- Update deployment docs for the selected capacity: 4 vCPU, 8 GB RAM, 200 GB SSD/data disk.
- Document provisioning with a dedicated deploy user.
- Document `/opt/ocean`, `/srv/ocean/data`, and `/etc/ocean`.
- Keep first deployment on public IP + HTTP.
- Document later domain + HTTPS upgrade.
- Keep real server IPs, SSH key paths, credentials, and incident notes out of Git.

## Acceptance

- A new developer can provision the server from the runbook using placeholders.
- `/api/health`, viewport API, and response-analysis/basic-query smoke checks are included.
- Data sync and cache directories are documented.

## Checks

- Shell/PowerShell parse checks for changed deploy scripts.
- Sensitive scan for IPs, keys, credentials, and personal paths.
