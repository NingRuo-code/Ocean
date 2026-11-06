"""Qualify explicit monthly requests using frozen P0 evidence."""

from calendar import monthrange
from typing import NoReturn, get_args

from fastapi import HTTPException

from .audited_support import PROTOCOL_HASHES, evidence_id, read_audited_support
from .monthly_distance_reference import distance_engine_id
from .monthly_models import DistanceMethod, DistanceParameters, MonthlyResearchRequest


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
    if request.method_version not in get_args(
        DistanceMethod
    ) or request.parameter_version not in get_args(DistanceParameters):
        _reject("analysis_method_or_parameter_version_mismatch", support)
    if evidence_id(request.input_version) is None:
        _reject("analysis_input_version_unverified", support)
    if "geometry_runtime" not in support["versions"]:
        _reject("geometry_runtime_version_unverified", support)
    year, month = map(int, request.month.split("-"))
    dates = [f"{request.month}-{day:02d}" for day in range(1, monthrange(year, month)[1] + 1)]
    period = support["month"]
    if any(proof and proof["state"] == "blocked" for proof in support["evidence"].values()):
        _reject("support_evidence_explicitly_blocked", support)
    if (
        sorted(row["date"] for row in support["days"]) != dates
        or any(not row["included"] for row in support["days"])
        or period["expected_days"] != len(dates)
        or period["included_days"] != len(dates)
        or period["computational_support"] != "supported"
    ):
        _reject("incomplete_required_support", support)
    approved_reference = {}
    if isinstance(request, MonthlyResearchRequest):
        if request.analysis_scope == "side":
            _reject("side_specific_support_not_verified", support)
        if support["evidence_kind"] != "audited_cells" or not period["data_gate_passed"]:
            _reject("formal_research_qualification_missing", support)
        approval = settings.monthly_research_approval
        # A self-declared P0 data gate is not independent authorization.
        if approval is None or settings.monthly_research_input_path is None:
            _reject("current_source_identity_and_research_approval_not_verified", support)
        if any(
            getattr(approval, field) != getattr(request, field)
            for field in (
                "support_snapshot_id",
                "input_version",
                "method_version",
                "parameter_version",
            )
        ):
            _reject("research_approval_identity_mismatch", support)
        try:
            engine = distance_engine_id()
        except (OSError, ValueError):
            _reject("analysis_engine_version_unverified", support)
        if engine != approval.distance_engine_sha256:
            _reject("research_approval_engine_version_mismatch", support)
        approved_reference = {
            "approval_id": approval.approval_id,
            "distance_engine_sha256": engine,
        }
    elif support["evidence_kind"] != "synthetic":
        _reject("synthetic_reference_requires_synthetic_support", support)
    return {
        "snapshot_id": support["snapshot_id"],
        "scope": "approved_frozen_input_direct_reference"
        if approved_reference
        else "frozen_synthetic_validation",
        **approved_reference,
        "versions": {
            key: support["versions"][key]
            for key in (
                "input_sha256",
                "parameter",
                "geometry_runtime",
                *PROTOCOL_HASHES,
            )
        },
    }
