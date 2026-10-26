"""Per-metric compatibility of existing known snapshots, without scientific recalculation."""

import copy
import math
from datetime import date
from itertools import combinations

from .comparability_models import ComparisonFacts

DEFINITIONS = {
    "total_hours": ("apparent_fishing_effort", "same-support-H/v1", "additive-hours/v1"),
    "area_time_km2_days": ("support_exposure", "same-support-E/v1", "additive-area-time/v1"),
    "mean_hours_per_supported_day": ("apparent_fishing_effort", "H-over-D/v1", "supported-days/v1"),
    "density_hours_per_km2_day": ("apparent_fishing_effort", "H-over-E/v1", "area-time/v1"),
}
UNITS = {
    "total_hours": ("fishing_hours", "fishing_minutes"),
    "area_time_km2_days": ("km2*d",),
    "mean_hours_per_supported_day": ("fishing_hours/d", "fishing_minutes/d"),
    "density_hours_per_km2_day": ("fishing_hours/(km2*d)", "fishing_minutes/(km2*d)"),
}
# These aliases are a frozen label-only equivalence, not inferred from a version name.
PROCESSING = {
    "known-support-sum/v1": "known-support-sum/v1",
    "known-support-sum/v1.0-label": "known-support-sum/v1",
}
CONTEXT = {
    "product": {"authored-apparent-effort/v1"},
    "quality": {"explicit-valid-units/v1"},
    "day_boundary": {"UTC-day/v1", "local-day/v1"},
    "geometry": {"declared-km-circle/v1"},
    "grain": {"declared-unit-areas/v1", "grid-0.01-degree/v1", "grid-0.05-degree/v1"},
    "boundary_rule": {"declared-membership/v1", "cell-centre-membership/v1"},
    "support_policy": {"observed-known-units/v1"},
}


def reason(code, *, field=None, actual=None, expected=None, required=None):
    return {
        k: v
        for k, v in {
            "code": code,
            "field": field,
            "actual": actual,
            "expected": expected,
            "required": required,
        }.items()
        if v is not None
    }


def assessment(status, reasons, **values):
    return {"status": status, "reasons": reasons, **values}


def _support(row):
    daily = row.get("comparison_daily")
    result = {
        "verified": False,
        "dates": [],
        "effective_area_by_date_km2": {},
        "reported": copy.deepcopy(row.get("metrics", {})),
        "excluded_day_states": {},
        "excluded_units": None,
        "partial_support_dates": [],
    }
    try:
        if not isinstance(daily, list) or not 1 <= len(daily) <= 31:
            return result
        seen, areas, excluded = set(), {}, {}
        excluded_units, partial_dates = 0, []
        for day in daily:
            iso = day["date"]
            month = row["original_parameters"].get("month")
            if (
                date.fromisoformat(iso).isoformat() != iso
                or iso in seen
                or month is not None
                and iso[:7] != month
            ):
                return result
            seen.add(iso)
            count = day.get("excluded_units")
            if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                return result
            excluded_units += count
            if count:
                partial_dates.append(iso)
            if day["hours"] is not None:
                area = day["area_time_km2_days"]
                hours = day["hours"]
                if (
                    day["state"] not in {"ready", "partial_support"}
                    or isinstance(hours, bool)
                    or not isinstance(hours, (float, int))
                    or not math.isfinite(hours)
                    or hours < 0
                    or isinstance(area, bool)
                    or not isinstance(area, (int, float))
                    or not math.isfinite(area)
                    or area <= 0
                ):
                    return result
                areas[iso] = area
            else:
                state = day["state"]
                if state not in {
                    "unprepared",
                    "missing",
                    "read_failed",
                    "no_records",
                    "unknown_support",
                    "partial_support",
                    "front_observation_unknown",
                    "fixed_support_unverified_or_changed",
                }:
                    return result
                excluded[state] = excluded.get(state, 0) + 1
        m = row["metrics"]
        if len(areas) != m["supported_days"] or len(seen) != m["calendar_days"]:
            return result
        if areas and not math.isclose(
            math.fsum(areas.values()), m["area_time_km2_days"], rel_tol=1e-12
        ):
            return result
        result.update(
            verified=bool(areas),
            dates=sorted(areas),
            effective_area_by_date_km2=dict(sorted(areas.items())),
            excluded_day_states=excluded,
            excluded_units=excluded_units,
            partial_support_dates=sorted(partial_dates),
        )
    except (ValueError, TypeError, KeyError, ArithmeticError):
        pass
    return result


def _facts(row, entry):
    if not row.get("source_result_id") or entry is None:
        return None
    try:
        f = ComparisonFacts.model_validate(entry.comparison_facts)
        if f.result_id != row.get("source_result_id") or f.snapshot_sha256 != row.get(
            "snapshot_sha256"
        ):
            raise ValueError("Comparison facts are for another snapshot")
        return f
    except (ValueError, TypeError, AttributeError):
        return None


def source_lifecycle(entry, candidate):
    try:
        f = ComparisonFacts.model_validate(entry.comparison_facts)
        if f.result_id == candidate.result_id and f.snapshot_sha256 == candidate.snapshot_sha256:
            return f.source_state
    except (ValueError, TypeError):
        pass
    return None


def _cell(row, key, f, support, request):
    value = row.get("metrics", {}).get(key)
    unit = row.get("units", {}).get(key)
    values = {
        "original_value": value,
        "original_unit": unit,
        "value": None,
        "unit": UNITS[key][0],
        "conversion": None,
    }
    if not row.get("source_result_id"):
        return assessment(
            "not_ready",
            [reason(row["reason"], actual=row.get("differences"), required=row.get("required"))],
            **values,
        )
    if f is None:
        return assessment(
            "not_ready",
            [reason("comparison_facts_unverified", required="bound_comparison_facts")],
            **values,
        )
    if f.source_state != "completed":
        return assessment(
            "not_ready",
            [reason("source_" + f.source_state, required="completed_source_result")],
            **values,
        )
    if row.get("window_issue"):
        return assessment(
            "not_ready",
            [reason(row["window_issue"], required="existing_B_window_result")],
            **values,
        )
    issues = []
    for field, accepted in CONTEXT.items():
        actual = getattr(f, field)
        if actual not in accepted:
            issues.append(
                reason(
                    "semantic_contract_unverified",
                    field=field,
                    actual=actual,
                    required="verified_semantic_equivalence",
                )
            )
    if f.processing not in PROCESSING:
        issues.append(
            reason(
                "processing_semantics_unverified",
                field="processing",
                actual=f.processing,
                required="verified_processing_equivalence",
            )
        )
    definition = f.definitions.get(key)
    if definition is None:
        return assessment("not_ready", [reason("metric_definition_missing", field=key)], **values)
    actual = (definition.quantity, definition.estimand, definition.weighting)
    if actual != DEFINITIONS[key]:
        return assessment(
            "incomparable",
            [
                reason(
                    "metric_semantics_mismatch",
                    field=key,
                    actual=list(actual),
                    expected=list(DEFINITIONS[key]),
                )
            ],
            **values,
        )
    if unit not in UNITS[key]:
        return assessment(
            "incomparable",
            [
                reason(
                    "unit_conversion_unregistered", field=key, actual=unit, expected=UNITS[key][0]
                )
            ],
            **values,
        )
    if value is None:
        return assessment(
            "not_ready",
            [reason("metric_unknown", field=key, required="known_source_support")],
            **values,
        )
    if issues:
        return assessment("not_ready", issues, **values)
    values["value"] = value / 60 if unit != UNITS[key][0] else value
    if unit != UNITS[key][0]:
        values["conversion"] = {
            "id": "fishing-minutes-to-hours/v1",
            "numerator": 1,
            "denominator": 60,
            "inverse": "multiply_by_60",
        }
    limitations = []
    if not support["verified"]:
        limitations.append(reason("effective_support_unverified", required="source_daily_support"))
    if f.sea_area_km2 is None:
        limitations.append(reason("sea_area_unknown", required="source_water_area_evidence"))
    elif (
        support["effective_area_by_date_km2"]
        and max(support["effective_area_by_date_km2"].values()) > f.sea_area_km2
    ):
        limitations.append(reason("water_area_support_conflict", required="verified_water_area"))
    if f.freshness != "verified_frozen":
        limitations.append(
            reason("source_freshness_" + f.freshness, required="source_freshness_evidence")
        )
    if request.support_policy != "verify_existing_support":
        limitations.append(
            reason(
                "support_comparison_policy_not_selected",
                required="explicit_verify_existing_support",
            )
        )
    return assessment(
        "limited_side_by_side" if limitations else "comparable", limitations, **values
    )


def _pair_metric(a, b, key, facts_by_id):
    ca, cb = a["metric_assessments"][key], b["metric_assessments"][key]
    blocked = [c for c in [ca, cb] if c["status"] in {"not_ready", "incomparable"}]
    if blocked:
        state = "not_ready" if any(c["status"] == "not_ready" for c in blocked) else "incomparable"
        return assessment(
            state, [reason("source_metric_" + c["status"], actual=c["reasons"]) for c in blocked]
        )
    fa, fb = facts_by_id[a["candidate"]["id"]], facts_by_id[b["candidate"]["id"]]
    window, base = key.split(".", 1) if "." in key else (None, key)
    conflicts = []
    for field in CONTEXT:
        if getattr(fa, field) != getattr(fb, field):
            conflicts.append(
                reason(
                    "semantic_dimension_mismatch",
                    field=field,
                    actual=[getattr(fa, field), getattr(fb, field)],
                )
            )
    if PROCESSING[fa.processing] != PROCESSING[fb.processing]:
        conflicts.append(reason("processing_mismatch"))
    groups = lambda f: sorted(
        (g.model_dump() for g in f.definitions[base].groups), key=lambda g: g["id"]
    )
    if groups(fa) != groups(fb):
        conflicts.append(
            reason("group_definition_mismatch", field=key, actual=[groups(fa), groups(fb)])
        )
    if conflicts:
        return assessment("incomparable", conflicts)
    limits = [*ca["reasons"], *cb["reasons"]]
    sa, sb = a["effective_support"], b["effective_support"]
    if window:
        sa, sb = sa[window], sb[window]
    if sa["dates"] != sb["dates"]:
        limits.append(
            reason(
                "effective_dates_differ",
                actual=[sa["dates"], sb["dates"]],
                required="A_B_support_alignment",
            )
        )
    if (
        base != "density_hours_per_km2_day"
        and sa["effective_area_by_date_km2"] != sb["effective_area_by_date_km2"]
    ):
        limits.append(reason("effective_areas_differ", required="existing_common_support_result"))
    return assessment("limited_side_by_side" if limits else "comparable", limits)


def _dates_for(row):
    support = row["effective_support"]
    if "dates" in support:
        return set(support["dates"])
    return {iso for window in support.values() for iso in window["dates"]}


def _warnings(a, b, fa, fb, radius):
    warnings = []
    p, q = a["candidate"], b["candidate"]
    lat1, lat2 = map(math.radians, [p["latitude"], q["latitude"]])
    dlon = math.radians(q["longitude"] - p["longitude"])
    hav = (
        math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    distance = 2 * 6371 * math.asin(math.sqrt(min(1, max(0, hav))))
    if distance < radius * 2:
        warnings.append(
            reason(
                "nominal_circles_overlap",
                actual={
                    "centre_distance_km": distance,
                    "method": "sphere-6371km/v1; advisory, not water-area intersection",
                },
            )
        )
    shared = sorted(_dates_for(a) & _dates_for(b))
    if shared:
        warnings.append(reason("shared_dates", actual=shared))
    if fa and fb:
        controls = sorted(set(fa.control_ids) & set(fb.control_ids))
        if controls:
            warnings.append(reason("shared_controls", actual=controls))
    warnings.append(reason("not_independent_samples"))
    return warnings


def add_compatibility(result, request, snapshots):
    facts_by_id = {}
    for row in result["rows"]:
        entry = snapshots.get(row["candidate"]["result_id"])
        f = _facts(row, entry)
        facts_by_id[row["candidate"]["id"]] = f
        views = {None: row}
        if request.analysis_kind == "fixed_region_event_example":
            views = {}
            for window in ["pre7", "event_day", "post1_3", "post1_7"]:
                metrics = row.get("windows", {}).get(window, {})
                dates = metrics.get("dates", [])
                views[window] = {
                    **row,
                    "metrics": {
                        k: metrics.get(k) for k in [*DEFINITIONS, "supported_days", "calendar_days"]
                    },
                    "comparison_daily": [
                        day
                        for day in (row.get("comparison_daily") or [])
                        if isinstance(day, dict) and day.get("date") in dates
                    ]
                    if isinstance(row.get("comparison_daily"), list)
                    else None,
                    "window_issue": row.get("window_issues", {}).get(window)
                    or (None if metrics else "window_source_unavailable"),
                }
        row["metric_assessments"], supports = {}, {}
        for window, view in views.items():
            support = _support(view)
            support["sea_area_km2"] = f.sea_area_km2 if f else None
            supports[window] = support
            for key in DEFINITIONS:
                name = f"{window}.{key}" if window else key
                row["metric_assessments"][name] = _cell(view, key, f, support, request)
        row["effective_support"] = supports.get(None, supports)
        if f:
            row["comparison_facts"] = f.model_dump(by_alias=True)
        statuses = [c["status"] for c in row["metric_assessments"].values()]
        if row.get("source_result_id"):
            row["status"] = (
                "comparable" if all(s == "comparable" for s in statuses) else "limited_side_by_side"
            )
            row["reason"] = "see_metric_assessments"
        row.pop("comparison_daily", None)
    keys = list(result["rows"][0]["metric_assessments"])
    result["pairs"] = [
        {
            "candidates": [a["candidate"]["id"], b["candidate"]["id"]],
            "metrics": {key: _pair_metric(a, b, key, facts_by_id) for key in keys},
            "warnings": _warnings(
                a,
                b,
                facts_by_id[a["candidate"]["id"]],
                facts_by_id[b["candidate"]["id"]],
                request.radius_km,
            ),
        }
        for a, b in combinations(result["rows"], 2)
    ]
    cells = [cell for pair in result["pairs"] for cell in pair["metrics"].values()]
    result["status"] = (
        "comparable"
        if all(c["status"] == "comparable" for c in cells)
        else "partial"
        if any(c["status"] == "comparable" for c in cells)
        else "no_comparable_pairs"
    )
    result["comparison_scope"] = "synthetic_known_support_only"
