# Ticket 05: Response Analysis Experiment Package

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

- Experiment smoke command documented in the ticket when implemented.
- Output manifest lists inputs, parameters, and generated artifacts.
