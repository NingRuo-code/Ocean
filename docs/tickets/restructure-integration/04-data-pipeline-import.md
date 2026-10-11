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

