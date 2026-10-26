"""Explicitly regenerate authored G3 fixtures through the existing real A API."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.analysis_support import content_id
from app.config import settings
from app.monthly_analysis import create_monthly_router
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr


def build():
    path = ROOT / "backend/app/examples/g3-known-month-input.json"
    authored = json.loads(path.read_text(encoding="utf-8"))
    app = FastAPI()
    app.include_router(
        create_monthly_router(
            settings.model_copy(
                update={"monthly_execution_token": SecretStr("authored-fixture-only")}
            ),
            example_path=path,
        )
    )
    snapshots, candidates = [], []
    with TestClient(app) as client:
        versions = client.get("/api/query/monthly-analysis/examples").json()
        for condition in authored["conditions"]:
            month = condition["month"]
            request = {
                "purpose": "monthly_spatial_example",
                **{
                    key: condition[key]
                    for key in ("longitude", "latitude", "radius_km", "month")
                },
                **{
                    key: versions[key]
                    for key in ("input_version", "method_version", "parameter_version")
                },
            }
            response = client.post(
                "/api/query/monthly-analysis",
                json=request,
                headers={"Authorization": "Bearer authored-fixture-only"},
            )
            response.raise_for_status()
            result = response.json()["result"]
            assert result and result["research_ready"] is False
            identity = content_id(result)
            snapshots.append(
                {
                    "access": "public_aggregate",
                    "public_aggregate_allowed": month != "2024-07",
                    "snapshot_sha256": identity,
                    "result": result,
                }
            )
            candidates.append(
                {
                    "id": "month-" + month,
                    "month": month,
                    "season": "winter" if month[5:] in {"01", "02", "12"} else "summer",
                    "result_id": result["result_id"],
                    "snapshot_sha256": identity,
                }
            )
    candidates.append(
        {
            "id": "missing-2023-01",
            "month": "2023-01",
            "season": "winter",
            "result_id": "sha256:" + "0" * 64,
            "snapshot_sha256": "sha256:" + "0" * 64,
        }
    )
    request = {
        "purpose": "stratified_validation_example",
        "analysis_kind": "monthly_spatial_example",
        "method_version": "known-strata/v1",
        "protocol_ref": "synthetic-descriptive/v1",
        "partition_ref": "synthetic-exploration/v1",
        "source_ref": content_id(snapshots[0]["result"]["source"]),
        "region": {
            "id": "authored-circle",
            "name": "合成固定区",
            "longitude": 124.5,
            "latitude": 30.2,
        },
        "radius_km": 20,
        "season_year_rule": "calendar_year",
        "seasons": {"winter": [1, 2, 12], "summer": [6, 7, 8]},
        "aggregation": "sum_known_nonoverlapping_H_over_E",
        "candidates": candidates,
    }
    return {
        ROOT / "backend/app/examples/g3-known-snapshots.json": {
            "schema": "ocean-controlled-comparison-snapshots/v1",
            "snapshots": snapshots,
        },
        ROOT / "docs/data/g3-known-validation.example.json": request,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for path, value in build().items():
        text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            if path.read_text(encoding="utf-8") != text:
                raise SystemExit("Authored G3 fixture drift")
        else:
            path.write_text(text, encoding="utf-8")
    print(
        "Authored G3 fixtures verified"
        if args.check
        else "Authored G3 fixtures generated through A API"
    )


if __name__ == "__main__":
    main()
