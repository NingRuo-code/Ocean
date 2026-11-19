"""Project one family of frozen B outputs into a local aggregate reading pack."""

import json
import sys
from pathlib import Path
from xml.etree import ElementTree

import audit_regional_support as p0
from fixed_region_window_qualification import (
    REQUEST_KEYS,
    json_object,
    read_frozen_input,
    require,
    text_digest,
)

METHOD = "fixed-event-reading-pack/v1"
PARAMETER = "frozen-aggregate-evidence/v1"
SHAPES = {"svg", "title", "desc", "rect", "g", "text", "path", "circle"}
ATTRIBUTES = {
    "viewBox",
    "role",
    "aria-labelledby",
    "id",
    "width",
    "height",
    "fill",
    "font-family",
    "font-size",
    "x",
    "y",
    "d",
    "stroke",
    "text-anchor",
    "data-series",
    "cx",
    "cy",
    "r",
    "data-offset",
}


def read_artifact(artifact, request, schema):
    require(
        artifact.keys() == {"summary_json", "manifest_json"}, "reading_artifact_schema"
    )
    return read_frozen_input(
        artifact["summary_json"], artifact["manifest_json"], request, schema
    )


def verify_chart(text, manifest):
    require(
        isinstance(text, str)
        and len(text.encode()) <= 262144
        and text_digest(text) == manifest["artifacts"]["lag.svg"],
        "frozen_lag_chart_identity",
    )
    require("<!" not in text and "<?" not in text, "static_lag_chart_required")
    chart = ElementTree.fromstring(text)
    namespace = "{http://www.w3.org/2000/svg}"
    require(chart.tag == namespace + "svg", "static_lag_chart_required")
    for element in chart.iter():
        require(
            element.tag.startswith(namespace)
            and element.tag[len(namespace) :] in SHAPES
            and element.attrib.keys() <= ATTRIBUTES
            and all("url(" not in value.lower() for value in element.attrib.values()),
            "static_lag_chart_required",
        )


def interpretation(event):
    if event["matching"]["selected"] is None:
        return "no_fixed_control"
    if event["contrasts"]["post7"] is None:
        return "no_complete_post7"
    delta = event["contrasts"]["post7"]["change_difference"]
    return (
        "equal_change"
        if delta == 0
        else (
            "negative_change_difference" if delta < 0 else "positive_change_difference"
        )
    )


def project_event(event, timed, inference_group_id):
    require(
        event["contrasts"] == timed["contrasts"]
        and event["target_changes"] == timed["target_changes"],
        "lag_comparison_evidence_mismatch",
    )
    selected = event["matching"]["selected"]
    return {
        "anchor_date": event["anchor_date"],
        "lag_group_id": timed["group_id"],
        "inference_group_id": inference_group_id,
        "front_event": timed["front_event"],
        "target_support_snapshot_id": event.get("target_support_snapshot_id"),
        "target_changes": event["target_changes"],
        "windows": event["contrasts"],
        "target_windows": event.get("target_windows", {}),
        "daily": timed["daily"],
        "selected_control": {
            key: selected[key]
            for key in (
                "id",
                "geometry",
                "weight",
                "support_snapshot_id",
                "front_result_id",
            )
        }
        if selected
        else None,
        "candidates": [
            {
                key: candidate.get(key)
                for key in (
                    "id",
                    "reason",
                    "exposure_dates",
                    "missing_observation_dates",
                    "unproven_clearance_dates",
                )
            }
            for candidate in event["matching"]["candidates"]
        ],
        "interpretation": interpretation(event),
    }


def evaluate(request, bundle, source_hash):
    require(
        request.keys() == REQUEST_KEYS
        and request["purpose"] == "fixed_region_event_example"
        and request["method_version"] == METHOD
        and request["parameter_version"] == PARAMETER
        and request["input_version"] == source_hash,
        "reading_pack_request_identity",
    )
    require(
        bundle.keys() == {"schema", "use", "controls", "inference", "lag", "lag_svg"}
        and bundle["schema"] == "ocean-fixed-region-reading-pack-input/v1"
        and bundle["use"] == "local_allowed_aggregate",
        "reading_pack_use",
    )
    control = read_artifact(
        bundle["controls"], request, "fixed-region-comparable-controls/v1"
    )
    inference = read_artifact(
        bundle["inference"], request, "fixed-region-event-group-uncertainty/v1"
    )
    lag = read_artifact(bundle["lag"], request, "fixed-region-event-lag/v1")
    require(
        inference["control_result_ids"].get(str(request["radius_km"]))
        == lag["control_result_id"]
        == control["result_id"],
        "reading_pack_different_control_results",
    )
    verify_chart(bundle["lag_svg"], json_object(bundle["lag"]["manifest_json"]))
    by_anchor = {event["anchor_date"]: event for event in lag["events"]}
    source_events = control["events"]
    require(
        len(source_events) == len(lag["events"]) == len(by_anchor)
        and by_anchor.keys() == {event["anchor_date"] for event in source_events},
        "reading_pack_event_identity",
    )
    inference_membership = {
        member: group["id"]
        for group in inference["groups"]
        for member in group["members"]
    }
    lag_membership = {}
    events = []
    for event in source_events:
        anchor = event["anchor_date"]
        timed = by_anchor[anchor]
        lag_membership.setdefault(timed["group_id"], []).append(anchor)
        group_id = inference_membership.get(f"{anchor}/{request['radius_km']}km")
        events.append(project_event(event, timed, group_id))
    result = {
        "schema_version": "fixed-region-event-reading-pack/v1",
        "kind": request["purpose"],
        "parameters": request,
        "use": bundle["use"],
        "source": {"id": "frozen-b-reading-evidence", "input_sha256": source_hash},
        "projection_sha256": p0.file_digest(Path(__file__)),
        "source_results": {
            "control": control["result_id"],
            "inference": inference["result_id"],
            "lag": lag["result_id"],
        },
        "front_observation_status": control.get("front_observation_status"),
        "front_lineage": control.get("front_lineage"),
        "matching_policy": control["policy"],
        "cohorts": lag["cohorts"],
        "lag_svg": bundle["lag_svg"],
        "lag_svg_sha256": text_digest(bundle["lag_svg"]),
        "events": events,
        "grouping": {
            "inference": {
                "policy": inference["policy"],
                "groups": inference["groups"],
                "links": inference["dependence_links"],
            },
            "lag": {
                "policy": lag["policy"],
                "groups": [
                    {"id": key, "anchors": value}
                    for key, value in sorted(lag_membership.items())
                ],
                "links": lag["dependence_links"],
            },
        },
        "inference": {
            **inference["inference"],
            "window": inference["policy"]["window"],
            "estimand": inference["policy"]["estimand"],
        },
        "units": lag["units"],
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "limitations": [
            "local aggregate reading only",
            "retrospective descriptive association",
            "event-day diagnosis",
            "the lag plot does not imply per-day confidence intervals",
        ],
    }
    result["result_id"] = "sha256:" + p0.digest(result)
    return result


def main():
    try:
        raw = sys.stdin.buffer.read(4_194_305)
        require(len(raw) <= 4_194_304, "controlled_input_budget")
        envelope = json_object(raw)
        require(
            envelope.keys() == {"request_json", "input_json"}, "controlled_envelope"
        )
        request, source = (
            json_object(envelope[key]) for key in ("request_json", "input_json")
        )
        result = evaluate(request, source, text_digest(envelope["input_json"]))
        print(json.dumps({"state": "completed", "result": result}, allow_nan=False))
    except (
        OSError,
        ValueError,
        ArithmeticError,
        TypeError,
        KeyError,
        AttributeError,
        IndexError,
        RecursionError,
        ElementTree.ParseError,
    ):
        print(
            json.dumps(
                {"state": "failed", "error": {"code": "controlled_event_failed"}}
            )
        )
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
