"""Controlled fixed-area front observations via the existing experiment.

Only synthetic, registered front inputs enter this path. The calculation never
consumes activity to choose a candidate or purports to qualify a response window.
"""

import hashlib
import json
import re
import sys
from datetime import timedelta
from pathlib import Path

import audit_regional_support as p0
import compute_monthly_distance as distance

METHOD = "observed-fixed-exposure/v1"
PARAMETER = "front-continuity/v1"
DAY = timedelta(days=1)
PHASES = ("near", "between_thresholds", "clear", "unknown")


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def days(first, last):
    return (first + i * DAY for i in range((last - first).days + 1))


def register(request, source, source_hash):
    require(
        request.keys()
        == {
            "purpose",
            "longitude",
            "latitude",
            "radius_km",
            "search_start",
            "search_end",
            "input_version",
            "method_version",
            "parameter_version",
        },
        "request_schema",
    )
    require(
        request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "request_source_identity",
    )
    require(
        source.keys() - {"front_source_version"}
        == {
            "schema",
            "id",
            "license",
            "front_source_id",
            "front_position_error_km",
            "geometry",
            "policy",
            "regional_cells",
            "front_days",
        },
        "front_source_schema",
    )
    require(
        source["schema"] == "ocean-fixed-region-front-observations/v1"
        and source["license"] == "CC0-1.0"
        and all(
            isinstance(source[key], str)
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", source[key])
            for key in ("id", "front_source_id")
        ),
        "synthetic_source_required",
    )
    version = source.get("front_source_version")
    require(
        version is None
        or (isinstance(version, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", version)),
        "invalid_front_source_version",
    )
    coordinates = (request["longitude"], request["latitude"])
    radius = request["radius_km"]
    first, last = map(p0.iso_day, (request["search_start"], request["search_end"]))
    require(
        1000 <= first.year <= last.year <= 2999
        and 0 <= (last - first).days <= 30
        and type(radius) is int
        and radius in (10, 20, 30)
        and source["geometry"]
        == dict(
            zip(
                ("longitude", "latitude", "radius_km"),
                (*coordinates, radius),
                strict=True,
            )
        ),
        "fixed_circle_and_search_range",
    )
    p0.validate_request(
        {
            "schema": "ocean-regional-request/v1",
            "purpose": "front_effort",
            "start": first.isoformat(),
            "end": last.isoformat(),
            "allocation": "overlap_uniform",
            "geometries": [
                {
                    "id": "circle",
                    "type": "circle",
                    "center": list(coordinates),
                    "radius_km": radius,
                }
            ],
        }
    )
    policy = source["policy"]
    require(
        policy.keys()
        == {"enter_distance_km", "exit_distance_km", "persistence_days", "clear_days"}
        and all(
            type(policy[name]) is int and 1 <= policy[name] <= 7
            for name in ("persistence_days", "clear_days")
        ),
        "continuity_policy",
    )
    enter, leave = policy["enter_distance_km"], policy["exit_distance_km"]
    error = source["front_position_error_km"]
    require(
        all(p0.finite(x) for x in (enter, leave, error))
        and 0 <= enter < leave <= 30
        and 0 <= error <= 5,
        "distance_policy",
    )
    return first, last, coordinates, radius, policy


def front_rows(source, first, last):
    rows = source["front_days"]
    require(isinstance(rows, list) and len(rows) <= 45, "front_calendar_budget")
    objects, converted = {}, []
    for row in rows:
        require(row.keys() == {"date", "source_id", "objects"}, "front_daily_schema")
        when = p0.iso_day(row["date"])
        require(
            when not in objects and isinstance(row["objects"], list),
            "duplicate_front_day",
        )
        ids, lines = [], []
        for front in row["objects"]:
            require(
                front.keys() == {"id", "points"}
                and isinstance(front["id"], str)
                and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,31}", front["id"]),
                "front_object_schema",
            )
            ids.append(front["id"])
            lines.append(front["points"])
        require(len(ids) == len(set(ids)), "duplicate_daily_front_object")
        objects[when] = ids
        converted.append(
            {"date": row["date"], "source_id": row["source_id"], "lines": lines}
        )
    lines = {}
    for i in range(0, len(converted), 31):
        lines.update(
            distance.front_days(
                converted[i : i + 31], first, last, source["front_source_id"]
            )
        )
    return objects, lines


def circle_distance(radius, lower, upper):
    return {
        "lower": None if lower is None else max(0, lower - radius),
        "upper": None if upper is None else max(0, upper - radius),
    }


def observe(
    when, layers, lines, object_ids, source, centre, circle, plane, edges, radius
):
    row = {
        "date": when.isoformat(),
        "state": "unknown",
        "phase": "unknown",
        "reasons": [],
        "object_ids": sorted(object_ids),
        "objects": [
            {
                "id": key,
                "phase": "unknown",
                "distance_km": circle_distance(radius, None, None),
            }
            for key in sorted(object_ids)
        ],
        "competing_objects": None,
        "distance_km": {"lower": None, "upper": None},
    }
    if lines is None:
        row["reasons"].append("front_line_material_missing")
    # Use the existing P0 day checks. Activity is absent by design for candidate selection.
    audited = p0.regional_day(
        when.isoformat(),
        layers,
        ["front", "activity"],
        circle,
        plane,
        "overlap_uniform",
        {"front": source["front_source_id"]},
    )
    front_support = audited["layer_support"]["front"]
    row["valid_area_km2"] = front_support["effective_area_km2"]
    row["unknown_area_km2"] = front_support["unknown_request_area_km2"]
    front_reasons = front_support["reasons"]
    if front_reasons or lines is None:
        row["reasons"].extend(front_reasons)
        return row
    front = next(layer for layer in layers if layer["kind"] == "front")
    valid = p0.prepare_layer_geometry(front, plane)["valid"]
    per_object = []
    sampled = distance.sample_geodesics(lines, plane, valid, per_object)
    error = source["front_position_error_km"]
    band, reason, lower, upper = distance.classify(
        centre, sampled, valid, plane, edges, error
    )
    row["phase"] = PHASES[band]
    row["state"] = ("satisfies", "does_not_satisfy", "does_not_satisfy", "unknown")[
        band
    ]
    row["reasons"].append(reason)
    row["distance_km"] = circle_distance(radius, lower, upper)
    if sampled is not None:
        row["competing_objects"] = distance.has_competing_fronts(
            centre, per_object, error
        )
        aliases = {}
        for key, line in zip(object_ids, lines, strict=True):
            path = tuple(map(tuple, line))
            aliases.setdefault(min(path, path[::-1]), []).append(key)
        relations = []
        for keys, samples in zip(aliases.values(), per_object, strict=True):
            object_band, _, low, high = distance.classify(
                centre, samples, valid, plane, edges, error
            )
            relations.extend(
                {
                    "id": key,
                    "phase": PHASES[object_band],
                    "distance_km": circle_distance(radius, low, high),
                }
                for key in keys
            )
        row["objects"] = sorted(relations, key=lambda relation: relation["id"])
    return row


def continuity(rows, first, last, policy):
    first, last = first.isoformat(), last.isoformat()
    episodes, pending_clear, clear_run, persistent = [], [], 0, 0
    episode = None
    for row in rows:
        when, phase = row["date"], row["phase"]
        if phase == "near":
            if episode is None:
                episode = {
                    "first_near_date": when,
                    "anchor_date": None,
                    "exit_observed_date": None,
                    "left_truncated": clear_run < policy["clear_days"],
                    "right_truncated": False,
                    "near_dates": [],
                    "unknown_dates": [],
                    "merged_dates": [],
                    "reason": None,
                }
                episodes.append(episode)
                persistent = 0
            episode["near_dates"].append(when)
            episode["merged_dates"].extend(pending_clear)
            pending_clear = []
            if persistent != -1:
                persistent += 1
            if (
                persistent == policy["persistence_days"]
                and not episode["left_truncated"]
            ):
                episode["anchor_date"] = episode["first_near_date"]
            clear_run = 0
            continue

        if phase == "clear":
            clear_run += 1
        else:
            clear_run = 0
        if episode is None:
            continue
        persistent = -1
        if phase == "clear":
            pending_clear.append(when)
            if clear_run == policy["clear_days"]:
                episode["exit_observed_date"] = when
                episode = None
                pending_clear = []
        else:
            episode["merged_dates"].extend(pending_clear)
            pending_clear = []
            key = "unknown_dates" if phase == "unknown" else "merged_dates"
            episode[key].append(when)

    if episode is not None:
        episode["right_truncated"] = True
        episode["merged_dates"].extend(pending_clear)
    for candidate in episodes:
        anchor = candidate["anchor_date"]
        candidate["accepted"] = anchor is not None and first <= anchor <= last
        if candidate["left_truncated"]:
            candidate["reason"] = "prior_clear_period_unproven"
        elif anchor is None:
            candidate["reason"] = "entry_persistence_unproven"
        elif not candidate["accepted"]:
            candidate["reason"] = "anchor_outside_search"
        candidate["active_at_search_start"] = candidate["first_near_date"] < first and (
            candidate["exit_observed_date"] is None
            or candidate["exit_observed_date"] >= first
        )
        candidate["continuity_uncertain"] = bool(candidate["unknown_dates"])
        candidate["near_segments"] = []
        for observed in candidate["near_dates"]:
            segments = candidate["near_segments"]
            if (
                segments
                and p0.iso_day(observed) - p0.iso_day(segments[-1]["end"]) == DAY
            ):
                segments[-1]["end"] = observed
            else:
                segments.append({"start": observed, "end": observed})
    return episodes


def evaluate(request, source, source_hash):
    first, last, centre, radius, policy = register(request, source, source_hash)
    before = first - policy["clear_days"] * DAY
    after = last + max(policy["persistence_days"], policy["clear_days"]) * DAY
    all_cells = p0.validate_cells(source["regional_cells"])
    require(
        source["regional_cells"]["evidence_kind"] == "synthetic"
        and all(
            layers and all(layer["kind"] == "front" for layer in layers)
            for layers in all_cells.values()
        ),
        "front_software_reference_only",
    )
    objects, lines = front_rows(source, before, after)
    require(
        set(all_cells) <= {when.isoformat() for when in days(before, after)},
        "front_calendar_input_mismatch",
    )
    plane = p0.MetricPlane(*centre)
    circle = plane.circle(centre, radius)
    edges = [radius + policy[key] for key in ("enter_distance_km", "exit_distance_km")]
    observations = [
        observe(
            when,
            all_cells.get(when.isoformat(), []),
            lines.get(when),
            objects.get(when, []),
            source,
            centre,
            circle,
            plane,
            edges,
            radius,
        )
        for when in days(before, after)
    ]
    events = continuity(observations, first, last, policy)
    accepted = sum(event["accepted"] for event in events)
    first_iso, last_iso = first.isoformat(), last.isoformat()
    uncertain = any(
        row["state"] == "unknown" and first_iso <= row["date"] <= last_iso
        for row in observations
    ) or any(
        (
            event["left_truncated"]
            or event["right_truncated"]
            or event["continuity_uncertain"]
        )
        and event["first_near_date"] <= last_iso
        and (
            event["exit_observed_date"] is None
            or event["exit_observed_date"] >= first_iso
        )
        for event in events
    )
    result = {
        "schema_version": "fixed-region-front-observation/v1",
        "kind": request["purpose"],
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "parameters": request,
        "source": {
            "id": source["id"],
            "input_sha256": source_hash,
            "license": source["license"],
            "front_source_id": source["front_source_id"],
            "front_source_version": source.get("front_source_version"),
        },
        "versions": {
            "event_engine": p0.file_digest(Path(__file__)),
            "distance_engine": p0.file_digest(Path(distance.__file__)),
            "regional_engine": p0.file_digest(Path(p0.__file__)),
            "source_reader": p0.file_digest(
                Path(p0.__file__).with_name("audit_daily_sources.py")
            ),
            "proj": p0.pyproj.proj_version_str,
            "geos": p0.shapely.geos_version_string,
        },
        "geometry": {
            **source["geometry"],
            "area_km2": circle.area / 1e6,
            "front_position_error_km": source["front_position_error_km"],
            "maximum_sample_gap_m": distance.STEP_M,
        },
        "selection": {"policy": policy, "observations": observations, "events": events},
        "read_range": {"start": before.isoformat(), "end": after.isoformat()},
        "status": "observation_incomplete"
        if uncertain
        else ("observed_entries" if accepted else "no_observed_entry"),
    }
    result["result_id"] = "sha256:" + p0.digest(result)
    return result


def main():
    try:
        raw = sys.stdin.buffer.read(4_194_305)
        require(len(raw) <= 4_194_304, "controlled_input_budget")
        envelope = json.loads(raw, object_pairs_hook=p0.unique_json_object)
        require(
            envelope.keys() == {"request_json", "input_json"}, "controlled_envelope"
        )
        request = json.loads(
            envelope["request_json"], object_pairs_hook=p0.unique_json_object
        )
        source = json.loads(
            envelope["input_json"], object_pairs_hook=p0.unique_json_object
        )
        source_hash = (
            "sha256:" + hashlib.sha256(envelope["input_json"].encode()).hexdigest()
        )
        print(
            json.dumps(
                {
                    "state": "completed",
                    "result": evaluate(request, source, source_hash),
                },
                allow_nan=False,
            )
        )
    except (
        OSError,
        ValueError,
        ArithmeticError,
        TypeError,
        KeyError,
        AttributeError,
        IndexError,
        RecursionError,
    ):
        print(
            json.dumps(
                {"state": "failed", "error": {"code": "controlled_event_failed"}}
            )
        )
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
