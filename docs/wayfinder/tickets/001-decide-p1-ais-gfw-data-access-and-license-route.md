# Decide P1 AIS/GFW Data Access And License Route

Labels: `wayfinder:grilling`

## Question

Which concrete data-access route will supply the P1 sample loop for 2024-07-01 to 2024-08-31 in the East China Sea window?

The decision must settle:

- Whether P1 uses GFW public apparent fishing effort, a lab-provided AIS derivative, or another source.
- Whether the project is allowed to store the working files locally, commit derived aggregate files, or only show aggregate figures.
- Whether the first sample is obtained manually, by API, by a downloaded archive, or by a teacher/cooperator handoff.
- What attribution and license notes must appear in `docs/data-schema.md`, the UI data说明, and reports.

Recommended default:

Use GFW-style apparent fishing effort only for local/classroom P1 closure, keep raw or fine-grained source files out of Git, commit only small placeholder/contracts and derived non-sensitive aggregate artifacts after license review, and keep all UI wording at "historical AIS response" / "apparent fishing effort".

## Blocks

- Decide Response Computation And Control Sampling
- Decide P1 Validation And Reporting Package
