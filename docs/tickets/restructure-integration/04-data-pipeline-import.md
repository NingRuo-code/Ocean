# Ticket 04: data pipeline import

## Goal

Import collaborator data-pipeline scripts only after credentials, storage, and artifact publication rules are clear.

## Scope

- GFW apparent-fishing-effort fetch, aggregation, manifest rebuild, and token cleanup.
- SST global/coarse pipeline and fallback-source scripts.
- Front gap-fill and server sync helpers.
- Pipeline runbooks that describe reproducible commands without embedding secrets.

## Acceptance

- Scripts support dry-run or manifest rebuild without credentials where practical.
- Tokens are read from environment or explicitly ignored local files.
- Generated raw or restricted data remains outside committed source.


## Progress

2026-10-11:

- Imported 	ools/pipeline/** from collaborator commit 4a907a1.
- Included scripts for GFW apparent-fishing-effort fetch/manifest rebuild, SST and global/coarse SST pipelines, front gap-fill, local front fetch, and front sync helpers.
- Verified Python syntax with compileall and verified etch_gfw_effort.py --dry-run prints the GFW request without calling the API or writing output.
- Did not import deploy/** or 	ools/ops/** in this batch because those files contain machine-specific server IPs, key handoff notes, personal paths, and production operations assumptions that require a cleanup pass.
- No raw AIS/GFW data, intermediate data, authorized aggregate data, or credential values were committed.

Checks:

- python -m compileall -q tools/pipeline: pass.
- python tools/pipeline/fetch_gfw_effort.py --start 2024-08-05 --end 2024-08-06 --dry-run: pass.
-
ode tools/data-check.mjs: 0 failures / 918.
-
ode tools/e2e-check.mjs: 0 failures / 116.
-
ode tools/layout-check.mjs: 0 failures.
- git diff --check: pass.
