# Ticket 06: Server Deployment Runbook

## Goal

Prepare the sanitized deployment path for the existing configured Alibaba Cloud server.

## Scope

- Update deployment docs for the existing server-first strategy.
- Include a capacity inventory section for CPU, memory, disk, `/srv` free space, active services, deployment user, Nginx, and systemd.
- Document provisioning with a dedicated deploy user.
- Document `/opt/ocean`, `/srv/ocean/data`, and `/etc/ocean`.
- Keep first deployment on public IP + HTTP.
- Document later domain + HTTPS upgrade.
- Keep real server IPs, SSH key paths, credentials, and incident notes out of Git.
- Document the later upgrade path to a larger server or data disk without making it part of the first milestone.

## Acceptance

- A new developer can provision the server from the runbook using placeholders.
- `/api/health`, viewport API, and response-analysis/basic-query smoke checks are included.
- Data sync and cache directories are documented.

## Checks

- Shell/PowerShell parse checks for changed deploy scripts.
- Sensitive scan for IPs, keys, credentials, and personal paths.
