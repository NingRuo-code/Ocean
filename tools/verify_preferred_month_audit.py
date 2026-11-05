"""Verify the public preferred-month evidence bundle; optionally check local frozen outputs."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path


def read_json(path):
    with path.open("rb") as stream:
        raw = stream.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("evidence_budget_exceeded")

    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate_json_key")
            result[key] = value
        return result

    return json.loads(raw.decode("utf-8"), object_pairs_hook=unique), hashlib.sha256(
        raw
    ).hexdigest()


def identity(value, *, sorted_keys=True):
    return (
        "sha256:"
        + hashlib.sha256(
            json.dumps(
                value,
                sort_keys=sorted_keys,
                separators=(",", ":"),
                ensure_ascii=False,
                allow_nan=False,
            ).encode("utf-8")
        ).hexdigest()
    )


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def verify(bundle_path, projection_path, snapshot_root=None):
    bundle, _ = read_json(bundle_path)
    projection, projection_sha = read_json(projection_path)
    require(
        bundle.get("schema") == "ocean-preferred-month-audit/v1",
        "invalid_bundle_schema",
    )
    require(
        bundle.get("audit_bundle_id")
        == identity({k: v for k, v in bundle.items() if k != "audit_bundle_id"}),
        "invalid_bundle_identity",
    )
    require(
        bundle["qualification_projection"]["sha256"] == projection_sha,
        "projection_bytes_mismatch",
    )
    require(
        projection.get("schema") == "ocean-candidate-support-verification/v1",
        "invalid_projection_schema",
    )
    runs = projection["runs"]
    outcomes = projection["outcomes"]
    require(
        1 <= len(runs) <= 32 and 1 <= len(outcomes) <= 32, "invalid_evidence_budget"
    )
    require(
        bundle["qualification_projection"]["runs"] == len(runs), "run_count_mismatch"
    )
    require(
        bundle["qualification_projection"]["support_snapshot_ids"]
        == [r["support_snapshot_id"] for r in runs],
        "run_identity_mismatch",
    )
    require(
        bundle["daily_snapshot_id"] == projection["source_daily_snapshot_id"],
        "daily_identity_mismatch",
    )
    require(
        bundle["gd_research_gate"] == "unverified"
        and bundle["a_research_unblocked"] is False
        and bundle["b_research_unblocked"] is False,
        "research_status_mismatch",
    )
    for key, outcome in outcomes.items():
        require(key == identity(outcome), "invalid_outcome_identity")
        for period in [outcome["month"], *outcome["windows"].values()]:
            require(
                period["support_level"] == "unverified"
                and period["included_days"] == 0,
                "unexpected_qualified_result",
            )
            require(
                period["total_hours"] is None and period["area_time_km2_days"] is None,
                "unexpected_numeric_denominator",
            )
    geometries = 0
    for run in runs:
        require(1 <= len(run["regions"]) <= 3, "invalid_geometry_budget")
        actual = None
        if snapshot_root is not None:
            require(
                re.fullmatch(r"[a-z_]{1,32}", run["place"]) is not None,
                "invalid_place_id",
            )
            if run["purpose"] == "A_month" and run["event_date"] is None:
                label = "A"
            elif run["purpose"] == "B_event" and run["event_date"] in {
                "2024-08-01",
                "2024-08-31",
            }:
                label = "B-start" if run["event_date"] == "2024-08-01" else "B-end"
            else:
                raise ValueError("unsupported_snapshot_locator")
            actual, _ = read_json(
                snapshot_root / f"support41-{run['place']}-{label}.json"
            )
            require(
                actual["support_snapshot_id"] == run["support_snapshot_id"]
                and actual["support_snapshot_id"]
                == identity(
                    {k: v for k, v in actual.items() if k != "support_snapshot_id"},
                    sorted_keys=False,
                ),
                "invalid_frozen_snapshot_identity",
            )
            require(
                actual["input_daily_snapshot_id"] == bundle["daily_snapshot_id"],
                "frozen_source_identity_mismatch",
            )
            require(
                all(
                    actual[k] == run[k]
                    for k in [
                        "input_sha256",
                        "regional_engine_sha256",
                        "auditor_sha256",
                    ]
                ),
                "frozen_method_identity_mismatch",
            )
        for region in run["regions"]:
            geometries += 1
            outcome = outcomes[region["outcome_id"]]
            if actual is not None:
                matches = [
                    r for r in actual["regions"] if r["geometry"] == region["geometry"]
                ]
                require(len(matches) == 1, "frozen_geometry_mismatch")
                frozen = matches[0]
                require(
                    frozen["requested_area_km2"] == region["requested_area_km2"],
                    "frozen_area_mismatch",
                )
                for name, compact in {
                    "month": outcome["month"],
                    **outcome["windows"],
                }.items():
                    period = (
                        frozen["month"] if name == "month" else frozen["windows"][name]
                    )
                    for key, value in compact.items():
                        require(
                            value
                            == (
                                period["summary"][key]
                                if key in period["summary"]
                                else period[key]
                            ),
                            "frozen_projection_mismatch",
                        )
    require(
        all(v == 0 for v in bundle["source_parse_errors"].values()),
        "source_errors_present",
    )
    require(
        bundle["legacy_comparison"]["rows"] == 186
        and bundle["legacy_comparison"]["post7_finite_rows"] == 0,
        "legacy_gap_mismatch",
    )
    return {
        "bundle_id": bundle["audit_bundle_id"],
        "runs": len(runs),
        "geometries": geometries,
        "outcomes": len(outcomes),
        "local_snapshots_checked": snapshot_root is not None,
        "gd_research_gate": "unverified",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--projection", type=Path, required=True)
    parser.add_argument("--snapshot-root", type=Path)
    args = parser.parse_args()
    try:
        print(
            json.dumps(
                verify(args.bundle, args.projection, args.snapshot_root),
                ensure_ascii=False,
                allow_nan=False,
            )
        )
    except (
        ValueError,
        TypeError,
        KeyError,
        IndexError,
        OSError,
        OverflowError,
        RecursionError,
    ) as error:
        message = str(error)
        print(
            "Evidence verification failed: "
            + (message if re.fullmatch("[a-z_]+", message) else type(error).__name__),
            file=sys.stderr,
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
