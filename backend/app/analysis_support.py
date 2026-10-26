"""Shared known-support arithmetic and bounded controlled-input reading for A/B."""

import hashlib
import json
import math

from .monthly_models import KnownDay


def content_id(value):
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def decode_controlled_json(raw, max_bytes=1_048_576):
    if isinstance(raw, str):
        raw = raw.encode("utf-8")
    if len(raw) > max_bytes:
        raise ValueError("Controlled input exceeds budget")
    try:
        return json.loads(raw, object_pairs_hook=_unique_object)
    except RecursionError:
        raise ValueError("Controlled input exceeds nesting budget") from None


def read_controlled_input(path, model):
    with path.open("rb") as stream:
        raw = stream.read(1_048_577)
    value = decode_controlled_json(raw)
    return model.model_validate(value), content_id(value)


def known_day_summary(iso: str, day: KnownDay | None):
    row = {
        "date": iso,
        "state": day.state if day else "unprepared",
        "hours": None,
        "effective_area_km2": None,
        "area_time_km2_days": None,
        "excluded_units": 0,
    }
    if day and day.state == "ready":
        valid = [
            u
            for u in day.units
            if u.front_support == "valid"
            and u.effort_support == "valid"
            and u.hours is not None
            and u.area_km2 is not None
            and u.area_km2 > 0
        ]
        row["excluded_units"] = len(day.units) - len(valid)
        if valid:
            hours, area = math.fsum(u.hours for u in valid), math.fsum(u.area_km2 for u in valid)
            row.update(
                state="partial_support" if row["excluded_units"] else "ready",
                hours=hours,
                effective_area_km2=area,
                area_time_km2_days=area,
            )
        else:
            row["state"] = "unknown_support" if day.units else "no_records"
    return row


def known_period_summary(rows):
    supported = [row for row in rows if row["hours"] is not None]
    hours = math.fsum(row["hours"] for row in supported) if supported else None
    area_time = math.fsum(row["area_time_km2_days"] for row in supported) if supported else None
    return {
        "total_hours": hours,
        "supported_days": len(supported),
        "calendar_days": len(rows),
        "area_time_km2_days": area_time,
        "mean_hours_per_supported_day": hours / len(supported) if supported else None,
        "density_hours_per_km2_day": hours / area_time if supported else None,
    }
