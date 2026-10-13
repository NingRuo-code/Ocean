# Front Response Experiment

## Scope

This report summarizes deterministic apparent fishing-effort response around ocean-front events. It uses aggregate fishing-hour records from the committed public-boundary artifact and compares front buffers with same-day non-front controls.

## Method

- Buffers: 10, 20, 30 km
- Pre window: 7 days before the event
- Post response metric: post1_3_hours
- Post response window: days 1 to 3 after the event
- Analysis context window: days -7 to 7
- Control: same-day non-front control area
- Bootstrap/permutation iterations: 2000
- Random seed: 20261013

## Results

| Buffer km | Samples | Coverage | Enhanced | Mean post-control hours | 95% bootstrap CI | Permutation p | Mean lift % |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 62 | 100% | 10 (16.13%) | 4585.8985 | 3851.4906 to 5361.7404 | 0.0005 | 45.371 |
| 20 | 62 | 100% | 8 (12.9%) | 9447.4434 | 8095.0366 to 10803.4791 | 0.0005 | 27.2258 |
| 30 | 62 | 100% | 7 (11.29%) | 13646.3369 | 11629.0347 to 15719.5368 | 0.0005 | -1.7419 |

## Boundaries

- The metric is apparent fishing effort measured in fishing hours.
- These results are evidence for activity response only, not catch, yield, revenue, biomass, or guaranteed fishing success.
- Missing coverage is represented through coverage fields and exclusions, not by filling missing values with zero.
- A full post-7-day aggregate should be added later if the research question requires symmetric 7-day before/after totals.
