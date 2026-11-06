"""Qualify explicit monthly requests using frozen P0 evidence."""

from calendar import monthrange
from typing import NoReturn

from fastapi import HTTPException

from .audited_support import read_audited_support
from .monthly_models import MonthlyResearchRequest


def _reject(reason, support) -> NoReturn:
    raise HTTPException(
        409,
        {"reason": reason, "can_execute": False, "support": support},
        headers={"Cache-Control": "no-store"},
    )


def qualify_execution(settings, request):
    support = read_audited_support(
        settings.support_snapshot_path,
        {
            "purpose": "A_month",
            **request.model_dump(
                include={"longitude", "latitude", "radius_km", "month", "layer_use"}
            ),
        },
        settings.support_state_path,
    )
    if support["status"] != "audited_snapshot":
        _reject(support["reason"], support)
    if support["snapshot_id"] != request.support_snapshot_id:
        _reject("support_snapshot_identity_mismatch", support)
    year, month = map(int, request.month.split("-"))
    dates = [f"{request.month}-{day:02d}" for day in range(1, monthrange(year, month)[1] + 1)]
    period = support["month"]
    if (
        sorted(row["date"] for row in support["days"]) != dates
        or any(not row["included"] for row in support["days"])
        or period["expected_days"] != len(dates)
        or period["included_days"] != len(dates)
        or period["computational_support"] != "supported"
    ):
        _reject("incomplete_required_support", support)
    if isinstance(request, MonthlyResearchRequest):
        if support["evidence_kind"] == "synthetic" or not period["data_gate_passed"]:
            _reject("formal_research_qualification_missing", support)
        # P0 reports frozen declarations. It cannot attest current originals or approve research.
        _reject("current_source_identity_and_research_approval_not_verified", support)
    if support["evidence_kind"] != "synthetic":
        _reject("synthetic_reference_requires_synthetic_support", support)
    return {
        "snapshot_id": support["snapshot_id"],
        "scope": "frozen_synthetic_validation",
        "versions": {
            key: support["versions"][key]
            for key in (
                "input_sha256",
                "parameter",
                "auditor_sha256",
                "regional_engine_sha256",
                "source_reader_sha256",
            )
        },
    }
