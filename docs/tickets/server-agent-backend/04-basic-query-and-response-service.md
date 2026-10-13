# Ticket 04: Basic Query And Response Service

Status: done on `codex/server-agent-backend`.

## Goal

Expose the basic deterministic query and response-analysis behavior needed before any Agent/AI layer is considered.

## Scope

- Provide stable backend or script entrypoints for current-state query, historical comparison, and front-response analysis.
- Reuse the viewport API and existing deterministic analysis code where possible.
- Return structured outputs with source, parameters, coverage, caveats, and unavailable/partial states.
- Keep outputs suitable for later Agent wrapping, but do not implement AI-specific tool schemas or LLM calls in this ticket.
- Add example calls and output snapshots for the basic query paths.

## Acceptance

- Numerical values come from deterministic code.
- Outputs include evidence and caveats.
- Missing data returns unavailable/partial, not zero.
- No AI/Agent integration is required for completion.

## Checks

- `python -m pytest tests/test_api.py -q -k "basic_query" --tb=short --basetemp .pytest-basetemp-query3 -p no:cacheprovider` from `backend` passed with 3 tests.
- Example snapshots can be regenerated with `python backend/scripts/export_basic_query_examples.py`.

## Implemented

- Added deterministic query-summary endpoints:
  - `GET /api/query/current-state`
  - `GET /api/query/front-response`
  - `GET /api/query/historical-comparison`
- Added `BasicQueryResponse` schema with `source`, `parameters`, `metrics`, `evidence`, `coverage`, and `caveats`.
- Reused existing deterministic viewport and history code; no LLM calls or Agent-specific runtime were added.
- Added tests for:
  - current-state summary over static prototype viewport data;
  - apparent fishing-effort response summary with explicit forbidden-claim boundary;
  - unavailable historical comparison when raw history data is missing.
- Added query examples under `docs/examples/basic-query-service.md`.
- Added normalized snapshots under `docs/examples/basic-query-service-snapshots.json`.

## Residual Risks

- The response-analysis summary still uses the committed aggregate front-response artifact through the viewport adapter. Ticket 05 must add the reproducible experiment package with controls, bootstrap confidence intervals, and permutation tests.
- Historical comparison depends on permitted local/server NetCDF samples under `data/raw`; empty raw data is reported as `unavailable`.
- Query endpoints are stable enough for smoke checks and later wrapping, but frontend UI integration is still optional.
- Snapshot cache metadata is normalized because cache hit/miss, generated timestamps, and local cache paths vary by machine.
