# Ticket 01: Existing Server Inventory And Safety Baseline

## Goal

Lock the first server/basic-backend direction around the existing configured server before implementation starts.

## Scope

- Record the server strategy decision: use the existing configured Alibaba Cloud Ubuntu server first.
- Inventory current CPU, memory, disk, `/srv` free space, existing services, deployment user, Nginx/systemd state, and data directory layout when server access is available.
- Record constraints that limit first-stage data/cache scope.
- Record first deployment path: public IP + HTTP, later domain + HTTPS.
- Record storage paths: `/opt/ocean` for app, `/srv/ocean/data` for raw/processed/cache/outputs, `/etc/ocean` for server-only env.
- Record first data scope: demo window plus historical same-period samples.
- Keep `frontal_intensity` out of first milestone.
- Defer larger server or larger data disk until the basic loop exposes real bottlenecks.

## Acceptance

- `docs/server-agent-backend-roadmap.md` exists.
- `docs/agents/server-agent-backend.md` exists and is linked from `AGENTS.md`.
- `docs/ocean-server-integration-plan.md` points at the new roadmap.
- No real server IP, key path, or credential value is introduced.

## Checks

- Run a sensitive scan for real server IPs, private-key material, cloud instance IDs, and personal paths.
- `git diff --check`
