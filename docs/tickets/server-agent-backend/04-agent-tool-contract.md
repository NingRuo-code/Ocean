# Ticket 04: Agent Tool Contract

## Goal

Define and implement deterministic tool contracts for future Agent workflows.

## Scope

- Add Python functions for:
  - `query_current_state`
  - `compare_history`
  - `analyze_front_response`
  - `explain_evidence`
- Document tool schemas: inputs, outputs, caveats, unavailable states, and forbidden claims.
- Add at least three example calls and output snapshots.
- Expose HTTP wrappers only where they naturally share backend service boundaries.

## Acceptance

- Tools do not call an LLM.
- Numerical values come from deterministic code.
- Tool outputs include evidence and caveats.
- Missing data returns unavailable/partial, not zero.

## Checks

- `python -m pytest backend/tests -q`
- Tool example snapshots can be regenerated.
