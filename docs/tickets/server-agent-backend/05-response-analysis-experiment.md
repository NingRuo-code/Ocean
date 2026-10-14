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
- `node --check tools/build-front-response.mjs`
- `node --check tools/data-check.mjs`
- `node tools/run-front-response-experiment.mjs`
- `node tools/build-front-response.mjs --input frontend/prototype/data/front_response/fixture-effort-sample.json --output .tmp/front-response-fixture.js`
- `node tools/build-front-response.mjs --input frontend/prototype/data/front_response/real-effort-input.json --output .tmp/front-response-real.js`
- `node tools/run-front-response-experiment.mjs --input .tmp/front-response-fixture.js --output .tmp/front-response-fixture-experiment --iterations 100 --seed 20261013`
- `node tools/data-check.mjs`
- `git diff --check`
- Output manifest lists inputs, parameters, and generated artifacts.
- Temporary synthetic experiment selects `post_response_field = post7_hours`; committed real experiment remains `post_response_field = post1_3_hours` because the real aggregate still lacks `post7_hours`.
- `node tools/data-check.mjs` now validates the committed experiment package, including its `readiness` status and post-7 completion gap.

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
- The front-response converter, contract checks, synthetic authorized-aggregate examples, and experiment runner now support optional `post7_hours` with `time_window.post7_window_days = [1, 7]`.
- When every available event has a true `post7_hours` field, the experiment uses `post7_hours` as the post-response metric; otherwise it keeps using `post1_3_hours` and records the limitation in manifest/report caveats.
- The experiment summary, manifest, and Markdown report now include a machine-readable/readable `readiness` section for the `before_after_7day_windows` acceptance item.
- The committed real experiment currently records `readiness.status = partial`, `before_after_7day_complete = false`, `post_response_field = post1_3_hours`, and `missing_complete_post7_records = 186`.
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

- The current committed real aggregate has `pre7_hours` and `post1_3_hours` inside a `-7 ~ +7` exploratory window. It does not contain a separate `post7_hours` aggregate. The experiment therefore does not fabricate a symmetric post-7-day total; adding full post-7 aggregation remains a data-pipeline follow-up.
- The committed experiment package makes that limitation machine-readable through `summary.json.readiness` and `manifest.json.readiness`, and the report exposes it under `## Readiness`.
- Synthetic examples carry `post7_hours` only to validate the conversion and experiment contract. They are not AIS/GFW evidence and must not be used as research results.
- The experiment uses committed aggregate apparent-fishing-effort artifacts only. It does not ingest raw or fine-grained AIS/GFW files.
- Bootstrap and permutation tests are first-pass statistical checks over available aggregate records; they support research review but do not turn the output into a catch/yield forecast.

## Follow-Up Needed For Full Ticket Completion

- Produce a true `post7_hours` or equivalent seven-day after-event total from authorized real aggregate input.
- Rerun this experiment against the extended artifact and promote this ticket from `partial` to `done` only after the before/after 7-day acceptance item is satisfied.
