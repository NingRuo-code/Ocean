# Decide Response Computation And Control Sampling

Labels: `wayfinder:grilling`

## Question

What exact computation should P1 use to decide whether a front event shows AIS operation response enhancement?

The decision must settle:

- Whether P1 uses 10/20/30 km buffers for all events, with 20 km as the product default.
- Whether `pre7_hours` excludes the event day and which days count as `post1_3_hours`.
- How to sample same-day non-front control areas at least 50 km away from fronts.
- How to avoid treating missing AIS coverage as zero effort.
- Whether response enhancement remains the current rule: post 1-3 days at least 20% higher than pre-7 baseline and higher than same-day non-front control.

Recommended default:

Use the ADR rule as P1 baseline: calculate all three radii, product-default 20 km, compare post 1-3 days against pre-7 average and same-day non-front controls, and mark missing coverage as unavailable rather than zero.

## Blocks

- Decide P1 Validation And Reporting Package

## Blocked By

- Decide P1 AIS/GFW Data Access And License Route
- Decide Front Response Event Identity And Table Schema
