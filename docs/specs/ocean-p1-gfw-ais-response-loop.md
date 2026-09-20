# Spec: Ocean P1 GFW/AIS Response Loop

> Issue tracker publishing note: this spec is written locally because the repository is configured for GitHub Issues but `gh` is not available in the current environment. When GitHub CLI or another issue tool is available, publish this spec as an issue and apply the `ready-for-agent` label.

## Problem Statement

Ocean has a working offline fishery operation support prototype based on ocean fronts, cold/warm-side structure, SST, historical front frequency, rule-based forecast reference, and AI evidence organization. The project direction has shifted from a generic ocean-front map to a fishery operation support and research system focused on spatiotemporal front events and AIS operation response.

The current prototype already reserves a "historical AIS response" evidence block and a `data/front_response/events.js` entry point, but it does not yet close the P1 loop with real or sample GFW-style apparent fishing effort. Without a precise spec, later implementation could drift into unsupported claims such as catch prediction, production forecasting, or AI-generated scientific values.

The user needs an execution-ready specification for P1: connect a 2024-07-01 to 2024-08-31 East China Sea sample of GFW-style apparent fishing effort to the existing front-event prototype, compute front response evidence, display it honestly in the product UI, and validate the data and UI behavior.

## Solution

Implement a P1 GFW/AIS response loop that treats AIS-derived apparent fishing effort as a fishery activity response signal, measured in fishing hours. The loop will produce a front-response table and optional display artifact, expose that data through the existing `OFData` adapter, and update the current page, AI analysis page, and data说明 so the user can see whether historical AIS operation response appears enhanced near front events.

The system must preserve the current product language:

- Use "historical AIS response", "apparent fishing effort", "fishery possibility", "operation cue", and "response enhancement".
- Do not use "production forecast", "yield prediction", "guaranteed catch", "revenue prediction", or equivalent claims.
- Treat AI analysis as evidence organization and task planning only; deterministic code computes numerical values.
- Treat missing AIS/GFW coverage as unavailable, not zero fishing activity.

The highest test seam is the `OFData frontResponse adapter + prototype UI evidence path`: data enters as a front-response artifact, passes through `OFData`, and is verified through user-visible cards and evidence text.

## User Stories

1. As a fishery operation user, I want to see whether similar front situations historically showed AIS activity response, so that I can judge whether a current operation cue deserves attention.
2. As a fishery operation user, I want the current page to show "response enhancement" or "no clear enhancement" in plain language, so that I do not need to interpret raw fishing-hour tables first.
3. As a fishery operation user, I want the AIS response card to explain that fishing hours are apparent fishing effort, so that I do not mistake them for catch or production.
4. As a fishery operation user, I want the response evidence to stay linked to my selected date and operation range, so that the result matches the same decision context as the front evidence.
5. As a fishery operation user, I want the system to show "待接入" or "不可用" when AIS data is missing, so that I am not misled by fabricated numbers.
6. As a fishery operation user, I want the response evidence to include before/after context, so that I can see whether activity increased after a front event.
7. As a fishery operation user, I want the response evidence to mention non-front controls when available, so that I can distinguish front-associated activity from general background fishing activity.
8. As a fishery operation user, I want the prototype to avoid catch, yield, and revenue language, so that I understand the system as decision support rather than a guarantee.
9. As a fishery operation user, I want data说明 to explain GFW/AIS limitations, so that I know the evidence depends on vessel tracking and coverage.
10. As a fishery operation user, I want the AI analysis page to summarize AIS response as one evidence source, so that the final recommendation remains evidence-linked.
11. As a fishery operation user, I want AI analysis to avoid generating new scientific values, so that I can trust the displayed numbers as deterministic calculations.
12. As a researcher, I want front events represented with stable event identities, so that response records can be compared across dates, front IDs, and buffer ranges.
13. As a researcher, I want one response row per buffer radius, so that I can inspect 10/20/30 km sensitivity.
14. As a researcher, I want the product default to remain 20 km while preserving 10 and 30 km results, so that the UI stays simple and the analysis remains reproducible.
15. As a researcher, I want pre-event and post-event windows to be explicit, so that response enhancement has a reproducible meaning.
16. As a researcher, I want the post 1-3 day response window preserved, so that the product matches the current domain decision.
17. As a researcher, I want the wider pre-7 to post-7 window available for charts, so that response timing can be inspected beyond the default interpretation.
18. As a researcher, I want same-day non-front control values, so that front-buffer results can be compared to background fishing activity.
19. As a researcher, I want missing coverage represented separately from zero effort, so that incomplete AIS data does not produce false negatives.
20. As a researcher, I want the response table to include a clear enhancement flag, so that UI and research figures can use one shared result.
21. As a researcher, I want the response table to retain raw supporting values, so that qualitative labels can be audited.
22. As a researcher, I want the sample window to align with existing front and SST prototype dates, so that the P1 loop can close without expanding all historical data first.
23. As a researcher, I want an optional display grid aggregated to the front-data grid, so that fishing effort can be shown on the map if licensing and scope allow it.
24. As a researcher, I want the analysis source to preserve the finer fishing-effort granularity, so that buffer calculations are not distorted by display aggregation.
25. As a researcher, I want the response table to support later similar-front-event retrieval, so that P2 can expand toward pattern analysis.
26. As a maintainer, I want all new response data to enter through `OFData`, so that UI code does not read raw data structures directly.
27. As a maintainer, I want one frontend-facing contract for `frontResponse`, so that future data-generation scripts can change without rewriting UI logic.
28. As a maintainer, I want the placeholder `data/front_response/events.js` to keep working before real data arrives, so that the prototype remains usable.
29. As a maintainer, I want deterministic status handling for `not_available`, missing date, missing range, and real data, so that empty states are consistent.
30. As a maintainer, I want data-check coverage for the response artifact, so that malformed or incomplete response files fail early.
31. As a maintainer, I want e2e coverage for the historical AIS response card, so that user-visible evidence does not regress.
32. As a maintainer, I want layout coverage after adding response details, so that the right panel remains readable at supported viewports.
33. As a maintainer, I want product wording assertions where practical, so that "产量预测" or equivalent unsupported claims do not slip into the UI.
34. As a maintainer, I want data说明 updated with source, metric, unit, and caveats, so that every displayed response number has context.
35. As a maintainer, I want the implementation to avoid adding a second date or range control, so that the current single-source-of-truth interaction model remains intact.
36. As a maintainer, I want existing front, SST, history, forecast-reference, and AI evidence behavior to remain unchanged, so that P1 response evidence is additive.
37. As a collaborator, I want the docs to state which artifacts are safe to commit, so that raw or sensitive data is not accidentally pushed.
38. As a collaborator, I want the data license/public-display boundary recorded, so that classroom/local demo use is separated from public release.
39. As a collaborator, I want the validation package to include screenshots or tables, so that the P1 result can be shown to teachers or reviewers.
40. As a collaborator, I want claims in reports to stay at apparent fishing activity response, so that research communication remains defensible.

## Implementation Decisions

- The first-stage fishery response signal is GFW-style AIS apparent fishing effort, measured as fishing hours.
- Apparent fishing effort is not catch, production, biomass, revenue, or guaranteed yield.
- The P1 sample window is 2024-07-01 through 2024-08-31 in the East China Sea prototype window, matching the current front and SST sample.
- Raw or fine-grained AIS/GFW source files should not be committed until licensing and public-display boundaries are explicitly cleared.
- The source of record for response analysis is the event-level front response table, not the display grid.
- The analytical event row is keyed by a project-local front event identity, date, local front ID, and buffer radius.
- Local front IDs are temporary per-day IDs; the response table must not imply that they are long-term front tracks.
- The table must include, at minimum, date, front ID, buffer radius, pre-event effort, post-event effort, lift, non-front control effort, enhancement flag, and availability/status information.
- The table should preserve 10/20/30 km buffer results for research sensitivity.
- The product UI uses the currently selected operation range, with 20 km as the default product range.
- The default response interpretation is post 1-3 days after the front event.
- The exploratory response window should support front-event context from seven days before through seven days after the event.
- Response enhancement follows the current ADR baseline: post 1-3 day fishing hours must be at least 20% higher than the pre-7 baseline and higher than same-day non-front control areas.
- Non-front control areas are same-day comparison regions in the same sea area, at least 50 km away from fronts, with comparable area where practical.
- Missing AIS/GFW coverage must be represented as unavailable, not as zero fishing activity.
- A Fishing Effort Grid Artifact is optional for P1. If implemented, it is for map display only and should be aggregated to the current front grid for display.
- Buffer-response calculations should preserve the original finer apparent-fishing-effort granularity where data access allows it.
- The existing `OFData` adapter remains the only UI data entry point.
- UI code must not read raw response artifacts directly.
- The `frontResponse` adapter must handle not-available, missing-date, missing-range, and real-data states.
- The current "历史 AIS 响应" card remains on the current page.
- In the collapsed state, the response card should show a qualitative state and a short evidence/caveat sentence.
- In the expanded state, the response card should show fishing hours, lift, control value, and response-window method when data is available.
- When data is not available, the response card should clearly say that real AIS/GFW apparent fishing effort is not yet connected.
- The AI analysis page should include AIS response as an evidence source, not as model-generated reasoning.
- The data说明 page should document source, metric, unit, license/public-display boundary, and caveats.
- The product score should not be changed to include AIS response until real data is available and P1/P2 validation justifies the weight.
- The current `50% current front signal / 50% historical AIS response` score plan remains a future scoring decision, not a required P1 implementation.
- Similar Front Response Module can remain a future expansion unless enough real comparable events exist for P1 display.
- No new top-level control should be added for AIS response; date and range follow the existing global state.
- Existing front, SST, history, rule-based forecast reference, and AI evidence behavior should remain stable.
- Documentation must continue to distinguish product task from research task.
- Documentation must continue to state that AI organizes evidence while deterministic code computes values.

## Testing Decisions

- The main test seam is `OFData frontResponse adapter + prototype UI evidence path`.
- Tests should focus on external behavior and user-visible evidence, not internal DOM string assembly or small helper implementation details.
- Data contract tests should verify that the response artifact is structurally valid when present.
- Data contract tests should verify that unavailable or missing response data does not appear as zero fishing activity.
- Data contract tests should verify that response fields do not contain `NaN`, `Infinity`, or inconsistent status/value combinations.
- Data contract tests should verify that declared dates and ranges match available response records when real data is present.
- Existing data checks remain prior art: the current data-check validates generated files for structure, grid consistency, object IDs, RLE integrity, and missing invalid numeric values.
- UI tests should verify that the historical AIS response card renders the correct empty state when the placeholder file is present.
- UI tests should verify that the historical AIS response card renders response enhancement details when supplied with a small fixture response artifact.
- UI tests should verify that AI analysis mentions AIS response as evidence and does not imply AI-generated scientific values.
- UI tests should verify that data说明 includes apparent fishing effort caveats and does not describe the metric as catch or production.
- UI tests should verify that changing global date or operation range updates the response evidence context.
- UI tests should verify that missing response data for a date or range produces an unavailable state rather than a misleading conclusion.
- Layout tests should verify that the new response card and expanded details fit in supported desktop widths.
- Regression tests should verify that existing date, range, map, front, SST, history, forecast-reference, and AI evidence behavior still works.
- Where practical, wording tests should guard against unsupported phrases such as "产量预测", "收益预测", "guaranteed catch", or "yield prediction" in product UI surfaces.
- Browser-driven checks can follow existing e2e/layout prior art, but local browser CDP instability should be treated as environment failure rather than product failure when the connection itself times out.

## Out of Scope

- Real catch, production, biomass, revenue, or profit prediction.
- Public release of raw or reconstructable GFW-derived data files before licensing and attribution requirements are settled.
- A business-grade operational forecast product.
- A real online LLM service.
- Replacing the current prototype shell with a framework application.
- Full 2015-2024 multi-year AIS expansion.
- Formal long-term front tracking.
- Front intensity integration.
- P2 similar-event retrieval as a full research module, unless a minimal P1 display is justified by available sample data.
- Mobile UI redesign.
- Three-dimensional globe visualization.

## Further Notes

- This spec follows ADR-0001: use apparent fishing effort for front response analysis.
- This spec should be published to GitHub Issues with the `ready-for-agent` label when `gh` or another issue publishing tool is available.
- The existing wayfinder map remains useful for unresolved decisions. This spec is the implementation-oriented synthesis of the current agreed direction; it does not replace future decision tickets if the data-access route or license boundary changes.
- The current branch already contains a placeholder `data/front_response/events.js`; that placeholder is not real data and should stay honest until real or sample AIS/GFW response data is connected.
