# Ticket 01: Planning And Server Sizing

## Goal

Lock the first server/Agent backend direction before implementation starts.

## Scope

- Record the server sizing decision: Alibaba Cloud, 4 vCPU, 8 GB RAM, 200 GB SSD/data disk.
- Record first deployment path: public IP + HTTP, later domain + HTTPS.
- Record storage paths: `/opt/ocean` for app, `/srv/ocean/data` for raw/processed/cache/outputs, `/etc/ocean` for server-only env.
- Record first data scope: demo window plus historical same-period samples.
- Keep `frontal_intensity` out of first milestone.

## Acceptance

- `docs/server-agent-backend-roadmap.md` exists.
- `docs/agents/server-agent-backend.md` exists and is linked from `AGENTS.md`.
- `docs/ocean-server-integration-plan.md` points at the new roadmap.
- No real server IP, key path, or credential value is introduced.

## Checks

- Run a sensitive scan for real server IPs, private-key material, cloud instance IDs, and personal paths.
- `git diff --check`
