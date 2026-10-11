# Ticket 04: Basic Query And Response Service

## Goal

Expose the basic deterministic query and response-analysis behavior needed before any Agent/AI layer is considered.

## Scope

- Provide stable backend or script entrypoints for current-state query, historical comparison, and front-response analysis.
- Reuse the viewport API and existing deterministic analysis code where possible.
- Return structured outputs with source, parameters, coverage, caveats, and unavailable/partial states.
- Keep outputs suitable for later Agent wrapping, but do not implement AI-specific tool schemas or LLM calls in this ticket.
- Add example calls and output snapshots for the basic query paths.

## Acceptance

- Numerical values come from deterministic code.
- Outputs include evidence and caveats.
- Missing data returns unavailable/partial, not zero.
- No AI/Agent integration is required for completion.

## Checks

- `python -m pytest backend/tests -q`
- Example snapshots can be regenerated.
