# Publish Wayfinder Map To GitHub Issues

Labels: `wayfinder:task`

## Question

Publish this local wayfinder draft to the repo's GitHub issue tracker so future sessions can use native issue labels, child tickets, assignees, and blockers.

The task is blocked in the current environment because `gh` is not installed.

Done means:

- Create label `wayfinder:map`.
- Create labels `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, and `wayfinder:task`.
- Create one map issue from `docs/wayfinder/ocean-p1-gfw-ais-map.md`.
- Create one issue per file in `docs/wayfinder/tickets/`.
- Link tickets to the map as GitHub sub-issues if available; otherwise add a task list to the map and `Part of #<map>` to each ticket.
- Add dependency edges or `Blocked by` lines according to each ticket file.

Recommended default:

Install or expose GitHub CLI, then publish these local files as the canonical GitHub Issues map. After publishing, keep GitHub Issues canonical and treat this local folder as a bootstrap copy.
