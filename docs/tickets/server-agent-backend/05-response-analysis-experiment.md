# Ticket 05: Response Analysis Experiment Package

Status: partial on `codex/server-agent-backend`.

## Goal

Create the first reproducible response-analysis experiment package.

## Scope

- Analyze 10/20/30 km front buffers.
- Compare front buffers with non-front controls.
- Use before/after 7-day windows.
- Compute lift, difference, sample count, coverage, bootstrap confidence interval, and permutation-test p value.
- Write outputs under `outputs/experiments/front-response-*`.
- Generate a Markdown/Word-ready report.

## Acceptance

- The experiment can be rerun from committed code and permitted local/server data.
- The report states apparent fishing-effort response only.
- The report does not claim catch, yield, revenue, biomass, or guaranteed fishing success.

## Checks

- `node --check tools/run-front-response-experiment.mjs`
- `node tools/run-front-response-experiment.mjs`
- Output manifest lists inputs, parameters, and generated artifacts.

## Implemented

- Added reproducible experiment runner: `tools/run-front-response-experiment.mjs`.
- Default input: `frontend/prototype/data/front_response/events.js`.
- Default output directory: `outputs/experiments/front-response-static-prototype/`.
- Generated artifacts:
  - `manifest.json`
  - `summary.json`
  - `report.md`
- The experiment groups records by 10/20/30 km front buffers.
- It compares front-buffer post-window apparent fishing hours with same-day non-front controls.
- It uses the current committed aggregate's `post1_3_hours` field as the post-event response metric and explicitly documents that full post-7 aggregation is not yet available.
- It reports:
  - sample count;
  - coverage ratio;
  - enhanced count and ratio;
  - pre-window total;
  - post-window total;
  - non-front control total;
  - mean post-minus-control difference;
  - mean post-minus-pre difference;
  - mean/median lift;
  - bootstrap confidence interval;
  - permutation-test p value.

## Run Command

From the repository root:

```powershell
node tools/run-front-response-experiment.mjs
```

Optional parameters:

```powershell
node tools/run-front-response-experiment.mjs --input frontend/prototype/data/front_response/events.js --output outputs/experiments/front-response-static-prototype --seed 20261013 --iterations 2000
```

## Residual Risks

- The current committed aggregate has `pre7_hours` and `post1_3_hours` inside a `-7 ~ +7` exploratory window. It does not contain a separate `post7_hours` aggregate. The experiment therefore does not fabricate a symmetric post-7-day total; adding full post-7 aggregation remains a data-pipeline follow-up.
- The experiment uses committed aggregate apparent-fishing-effort artifacts only. It does not ingest raw or fine-grained AIS/GFW files.
- Bootstrap and permutation tests are first-pass statistical checks over available aggregate records; they support research review but do not turn the output into a catch/yield forecast.

## Follow-Up Needed For Full Ticket Completion

- Extend the authorized aggregate input and `front-response/v1` artifact with a true `post7_hours` or equivalent seven-day after-event total.
- Rerun this experiment against the extended artifact and promote this ticket from `partial` to `done` only after the before/after 7-day acceptance item is satisfied.
