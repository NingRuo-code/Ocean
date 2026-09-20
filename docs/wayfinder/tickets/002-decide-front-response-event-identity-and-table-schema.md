# Decide Front Response Event Identity And Table Schema

Labels: `wayfinder:grilling`

## Question

What is the stable identity and minimum schema for one row in the P1 Front Response Table?

The decision must settle:

- Whether the event unit is `(date, front_id, buffer_km)`, `(date, front_id)` with nested ranges, or another shape.
- How to handle temporary front IDs that are local to one day and not long-term tracks.
- How to represent `pre7_hours`, `post1_3_hours`, `post7_hours`, `lift_percent`, `non_front_control_hours`, and `enhanced_flag`.
- How to represent unavailable data without implying zero fishing activity.
- How `data/front_response/events.js` should expose `by_date`, `by_front`, and/or `events`.

Recommended default:

Use an event table whose analytical row is `(front_event_id, date, front_id, buffer_km)`, where `front_event_id` is project-local and derived from date plus local front ID. Preserve one row per radius for research sensitivity, and let the frontend adapter return the current `date + rangeKm` summary.

## Blocks

- Decide Response Computation And Control Sampling
- Decide Product UI Scope For AIS Response Evidence
