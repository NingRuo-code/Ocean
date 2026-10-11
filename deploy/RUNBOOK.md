# Ocean Deployment Runbook

This runbook describes the reusable deployment shape for the Ocean project. It intentionally excludes historical handover notes, real server addresses, key fingerprints, personal paths, and credential values from the collaborator branch.

## Deployment Shape

- Frontend static prototype is served from `/opt/ocean/frontend/prototype`.
- FastAPI backend listens on `127.0.0.1:8000`; do not expose the backend port directly to the public network.
- Nginx listens on `80` and proxies `/api/` to the backend.
- Raw, processed, cache, and manifest data live under `/srv/ocean/data` by default.
- GFW/AIS credentials are never committed. If server-side data fetches are needed, store the token in a server-only environment file such as `/etc/ocean/gfw.env` with restrictive permissions.

## Local To Server Deploy

From a Windows machine with OpenSSH, tar, and PowerShell 5.1+ available:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\probe-ports.ps1 -ServerIp <server-ip> -Ports "22,80"
powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -ServerIp <server-ip> -KeyFile <key-file> -SkipData
```

Use `-SkipData` when only code/config changed. Raw data upload is optional and should only use permitted local data.

## Server Setup

`deploy/remote-setup.sh` is intended to run on an Ubuntu server as root. It installs runtime dependencies, unpacks the application into `/opt/ocean`, creates `/srv/ocean/data`, installs the systemd unit, and installs the Nginx site template.

```bash
bash /tmp/ocean-remote-setup.sh <server-ip> /tmp/ocean-app.tar.gz
```

The script is idempotent, but it is still an operations script: review it before running on a production-like host.

## Service Operations

Common checks after deployment:

```bash
systemctl status ocean-api
journalctl -u ocean-api -n 50 --no-pager
nginx -t
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS -H "Host: <server-ip>" http://127.0.0.1/api/health
```

Optional server-side helpers live in `tools/ops/`:

- `server-ops.sh`: read-only health, data coverage, performance, logs, and ERDDAP probes.
- `probe-erddap.sh`: read-only upstream ERDDAP availability probe.
- `start-server-pipelines.sh`: starts long-running SST and GFW apparent-fishing-effort fetch pipelines.
- `start-gap-fills.sh`: starts gap-fill queues for known missing windows.
- `kill-orphans.sh`: cleans orphaned fetch worker processes.
- `start-test-instance.sh`: starts a local-only backend test instance on `127.0.0.1:8001`.

## Boundaries

- Do not commit private keys, public key handover state, credential files, raw/reconstructable restricted AIS/GFW data, or real server incident notes.
- Keep server IPs, domains, key paths, and personal paths as parameters or placeholders.
- Keep AI analysis separate from deterministic computation: deployment does not change the project rule that code computes values and AI organizes evidence.
