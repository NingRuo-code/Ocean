# Server Data Workspace

This directory defines the server-side data boundary for Ocean.

Tracked files in this directory are only examples and public contracts:

- `sources/sources.example.json`: source registry example. It records source identity, license, credential mode, retention policy, and public display boundary.
- `public_artifacts/artifact-manifest.example.json`: frontend-facing artifact manifest example. It records public layer status, source references, caveats, and fallback behavior.
- `job_records/pull-job-record.example.json`: pull job record example. It records source/date/status/error fields without exposing credentials or publishing artifacts.

The following directories are local/server workspaces and must not be committed:

- `raw/`: downloaded source files and API responses.
- `intermediate/`: fine-grained grids, spatial joins, and processing tables.
- `authorized_aggregate/`: reviewed aggregate inputs before publication.
- `logs/`: job records, audit logs, and failure reports.

GFW/AIS raw data, API responses, MMSI, vessel names, tracks, 0.01 degree working grids, and reconstructable source data must stay outside Git unless a later go/no-go review explicitly clears a narrower aggregate artifact.

Run `node tools/data-check.mjs` to validate the example registry and manifest together with the existing offline data artifacts.

Use `node tools/server-pull-job.mjs --source <source_id> --start YYYY-MM-DD --end YYYY-MM-DD` to create a dry-run pull job record under `server_data/logs/jobs/`. Use `--check-latest` to create a latest-date check job record for scheduled or manual freshness checks. The default dry-run mode does not download raw data and does not publish public artifacts.
