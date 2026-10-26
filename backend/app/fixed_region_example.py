"""B01 fixed-circle descriptive windows, using A's known-support arithmetic."""

import json
import sys
from collections import Counter
from datetime import date, timedelta

from .analysis_support import (
    content_id,
    decode_controlled_json,
    known_day_summary,
    known_period_summary,
)
from .fixed_region_models import FixedRegionInput, FixedRegionRequest
from .schemas import BasicQueryEvidence

WINDOWS = {"pre7": (-7, -1), "event_day": (0, 0), "post1_3": (1, 3), "post1_7": (1, 7)}


def _dates(start, end):
    return [start + timedelta(days=n) for n in range((end - start).days + 1)]


def _window_change(before, after):
    if before["status"] != "complete" or after["status"] != "complete":
        return {
            "absolute_density_change": None,
            "relative_density_change_percent": None,
            "reason": "incomplete_or_unknown_window_support",
        }
    pre, post = before["density_hours_per_km2_day"], after["density_hours_per_km2_day"]
    return {
        "absolute_density_change": post - pre,
        "relative_density_change_percent": (post - pre) / pre * 100 if pre > 0 else None,
        "reason": "zero_baseline" if pre == 0 else None,
    }


def run_fixed_region_example(request_payload, input_payload):
    """Explicit deterministic core shared by the existing experiment CLI adapter."""
    request = FixedRegionRequest.model_validate(request_payload)
    source = FixedRegionInput.model_validate(input_payload)
    if request.input_version != source.version:
        raise ValueError("Input version mismatch")
    circle = next(
        (
            c
            for c in source.conditions
            if all(
                getattr(c, key) == getattr(request, key)
                for key in ("longitude", "latitude", "radius_km")
            )
        ),
        None,
    )
    if circle is None:
        raise ValueError("No registered fixed circle")
    by_date = {d.date: d for d in circle.days}
    first, last = date.fromisoformat(request.search_start), date.fromisoformat(request.search_end)
    observations, candidates, uncertain = [], [], []
    for day in _dates(first, last):
        iso, previous = day.isoformat(), (day - timedelta(days=1)).isoformat()
        present = by_date[iso].front_present if iso in by_date else None
        prior = by_date[previous].front_present if previous in by_date else None
        observations.append({"date": iso, "front_present": present})
        if present is True and prior is False:
            candidates.append(iso)
        elif present is None or present is True and prior is None:
            uncertain.append(iso)
    result = {
        "schema_version": "fixed-region-event-example/v1",
        "kind": request.purpose,
        "parameters": request.model_dump(),
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "metric": "apparent_fishing_effort",
        "unit": "fishing_hours",
        "source": {
            "id": source.id,
            "version": source.version,
            "input_sha256": content_id(input_payload),
            "license": source.license,
            "support_evidence": source.support_evidence,
        },
        "selection": {
            "candidate_dates": candidates,
            "uncertain_dates": uncertain,
            "search_observations": observations,
            "rule": "single observed false-to-true entry; prior unknown is not exit",
        },
        "event": None,
        "windows": {},
        "changes": {},
        "daily": [],
        "readiness": {"software_example": True, "real_event_qualification": False},
        "caveats": [
            "Authored synthetic example only; not real event evidence or research qualification.",
            "Known fixed unit membership/areas are declared, not computed GIS circle geometry.",
            "Normalized descriptive changes are not causal effects, catch or success probability.",
            "No control, enhancement threshold, bootstrap or row-level significance is applied.",
            "Full event recognition, missing-day continuity and P0 admission belong to B02/B03.",
        ],
    }
    if len(candidates) != 1:
        result["status"] = (
            "multiple_candidates"
            if len(candidates) > 1
            else ("unknown" if uncertain else "no_observed_entry")
        )
        result["result_id"] = content_id(result)
        return result
    anchor = date.fromisoformat(candidates[0])
    result["event"] = {
        "anchor_date": anchor.isoformat(),
        "meaning": "first confirmed observed entry",
    }
    fixed = {u.id: u.area_km2 for u in circle.fixed_support}
    fixed_valid = all(area is not None and area > 0 for area in fixed.values())
    daily = {}
    for offset in range(-7, 8):
        iso = (anchor + timedelta(days=offset)).isoformat()
        day = by_date.get(iso)
        row = known_day_summary(iso, day)
        row["activity_state"] = row["state"]
        cohort_matches = day and {u.id: u.area_km2 for u in day.units} == fixed
        reason = None
        if row["state"] != "ready":
            reason = row["state"]
        elif not day or day.front_present is None:
            reason = "front_observation_unknown"
        elif not fixed_valid or not cohort_matches:
            reason = "fixed_support_unverified_or_changed"
        if reason:
            row.update(state=reason, hours=None, effective_area_km2=None, area_time_km2_days=None)
        row.update(relative_day=offset, front_present=day.front_present if day else None)
        daily[offset] = row
    result["daily"] = list(daily.values())
    for name, (a, b) in WINDOWS.items():
        rows = [daily[n] for n in range(a, b + 1)]
        metrics = known_period_summary(rows)
        result["windows"][name] = {
            **metrics,
            "status": "complete"
            if metrics["supported_days"] == len(rows)
            else ("incomplete" if metrics["supported_days"] else "unavailable"),
            "start_date": rows[0]["date"],
            "end_date": rows[-1]["date"],
            "relative_days": [a, b],
            "dates": [r["date"] for r in rows],
            "excluded_day_states": dict(Counter(r["state"] for r in rows if r["hours"] is None)),
        }
    for name in ["post1_3", "post1_7"]:
        result["changes"][name] = _window_change(result["windows"]["pre7"], result["windows"][name])
    result["status"] = (
        "available"
        if not uncertain and all(w["status"] == "complete" for w in result["windows"].values())
        else "partial"
    )
    result["read_range"] = {"start": daily[-7]["date"], "end": daily[7]["date"]}
    result["evidence"] = [
        BasicQueryEvidence(
            id="fixed-circle-windows",
            label="Fixed support descriptive windows",
            value="[-7,-1]; [0,0]; [1,3]; [1,7]",
            detail="Normalize H by its own same-support E; incomplete windows cannot supply changes.",
            source_files=[source.id],
        ).model_dump()
    ]
    result["result_id"] = content_id(result)
    return result


def main():
    try:
        envelope = decode_controlled_json(sys.stdin.buffer.read(4_194_305), 4_194_304)
        if not isinstance(envelope, dict) or set(envelope) != {"request_json", "input_json"}:
            raise ValueError("Invalid controlled envelope")
        request = decode_controlled_json(envelope["request_json"], 16_384)
        source = decode_controlled_json(envelope["input_json"])
        result = run_fixed_region_example(request, source)
        print(json.dumps({"state": "completed", "result": result}, allow_nan=False))
    except (OSError, ValueError, ArithmeticError, TypeError, RecursionError):
        print(json.dumps({"state": "failed", "error": {"code": "controlled_event_failed"}}))
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
