# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

## Ocean project direction

For product, roadmap, or implementation work, use this current direction:

- Product direction: fishery operation support based on ocean fronts, SST/cold-warm-side evidence, historical context, and later AIS operation response evidence.
- Research direction: spatiotemporal front-event representation, matching, comparison, and human-AI visual analysis of front events and apparent fishing-effort response.
- First-stage fishery response signal: Global Fishing Watch-style AIS apparent fishing effort, measured as fishing hours, not catch, production, biomass, revenue, or guaranteed yield.
- Product wording: use "fishery possibility", "operation cue", "historical AIS response", and "response enhancement"; avoid "production forecast" and "yield prediction".
- AI boundary: AI organizes tasks and evidence, while deterministic code computes numerical values.

Before changing product behavior or data flow, also read:

- `docs/ocean-fishery-operation-roadmap.md` for the staged roadmap.
- `docs/requirements-fishing-ground.md` for UI and product requirements.
- `docs/ocean-gfw-response-issues.md` for the GFW/AIS response work breakdown.
- `docs/adr/0001-use-apparent-fishing-effort-for-front-response.md` for the apparent-fishing-effort decision.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```text
/
|-- CONTEXT.md
|-- docs/adr/
|   |-- 0001-event-sourced-orders.md
|   `-- 0002-postgres-for-write-model.md
`-- src/
```

Multi-context repo (presence of `CONTEXT-MAP.md` at the root):

```text
/
|-- CONTEXT-MAP.md
|-- docs/adr/                          <- system-wide decisions
`-- src/
    |-- ordering/
    |   |-- CONTEXT.md
    |   `-- docs/adr/                  <- context-specific decisions
    `-- billing/
        |-- CONTEXT.md
        `-- docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._
