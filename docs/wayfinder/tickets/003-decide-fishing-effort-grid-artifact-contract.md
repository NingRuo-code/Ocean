# Decide Fishing Effort Grid Artifact Contract

Labels: `wayfinder:grilling`

## Question

What frontend-facing Fishing Effort Grid Artifact should P1 produce, if any, alongside the event-level response table?

The decision must settle:

- Whether P1 needs a visible fishing-effort map layer, or only the current-page evidence block.
- Whether the display artifact is aggregated to the existing 0.05 degree front grid or kept at 0.01 degree.
- Whether files live under `data/fishing_effort/<date>.js`.
- Which fields are safe and useful for UI display.
- Whether the artifact can be committed, or must remain local because of licensing/data sensitivity.

Recommended default:

Keep the analysis source at the original 0.01 degree working granularity, but expose only a small 0.05 degree display artifact if the license/public-boundary decision allows it. If not allowed, skip the map layer and use only aggregate response table values in UI evidence cards.

## Blocks

- Decide Product UI Scope For AIS Response Evidence
