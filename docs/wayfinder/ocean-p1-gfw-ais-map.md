# Wayfinder Map: Ocean P1 GFW/AIS Response Loop

> Local draft because the repo's tracker is GitHub Issues but `gh` is not available in this environment. Publish this map and the ticket files as GitHub issues once `gh` or an equivalent GitHub Issues tool is available.

## Destination

Reach an execution-ready plan for Ocean P1: close the 2024-07-01 to 2024-08-31 East China Sea sample loop using GFW-style AIS apparent fishing effort, so the team knows exactly how to acquire data, transform it, compute front-response evidence, display it, and validate it without drifting into catch or production prediction claims.

## Notes

- Product direction: fishery operation support, not a generic map system.
- Research direction: spatiotemporal front-event representation, matching, comparison, and human-AI visual analysis.
- Required vocabulary: use `CONTEXT.md`.
- Required docs before working a ticket:
  - `docs/ocean-fishery-operation-roadmap.md`
  - `docs/requirements-fishing-ground.md`
  - `docs/ocean-gfw-response-issues.md`
  - `docs/adr/0001-use-apparent-fishing-effort-for-front-response.md`
  - `docs/data-schema.md`
- Product wording: use "fishery possibility", "operation cue", "historical AIS response", and "response enhancement".
- Do not write "production forecast", "yield prediction", "guaranteed catch", or "revenue prediction".
- AI boundary: AI organizes tasks and evidence; deterministic code computes numerical values.
- Current implementation status: `data/front_response/events.js` is only a placeholder contract, not real AIS/GFW data.

## Decisions So Far

- No tickets have been resolved yet.

## Frontier Tickets

- [Decide P1 AIS/GFW Data Access And License Route](tickets/001-decide-p1-ais-gfw-data-access-and-license-route.md)
- [Decide Front Response Event Identity And Table Schema](tickets/002-decide-front-response-event-identity-and-table-schema.md)
- [Decide Fishing Effort Grid Artifact Contract](tickets/003-decide-fishing-effort-grid-artifact-contract.md)
- [Decide Response Computation And Control Sampling](tickets/004-decide-response-computation-and-control-sampling.md)
- [Decide Product UI Scope For AIS Response Evidence](tickets/005-decide-product-ui-scope-for-ais-response-evidence.md)
- [Decide P1 Validation And Reporting Package](tickets/006-decide-p1-validation-and-reporting-package.md)
- [Publish Wayfinder Map To GitHub Issues](tickets/007-publish-wayfinder-map-to-github-issues.md)

## Not Yet Specified

- The exact implementation tickets that follow P1 decisions. These should not be created until the data-access route, schema, computation method, and UI scope are settled.
- Whether P2 should prioritize full-month historical AIS expansion, front intensity, or a more formal paper-facing retrieval/evaluation module. This depends on P1 evidence quality.
- Whether the current static prototype should remain the primary product shell or be reintroduced into a framework app. This is out of focus until P1 data/evidence requirements are known.

## Out Of Scope

- Real catch, production, revenue, or biomass prediction.
- Public release of raw or reconstructable GFW-derived data files before licensing and attribution requirements are settled.
- Building a true business-grade forecast product in this P1 map.
- Adding a real online LLM service before the deterministic data path and evidence boundaries are settled.
