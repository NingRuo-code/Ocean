"""Owner-visible task evidence with explicit artifact roles and availability."""

import stat
from pathlib import Path

from .owner_task_history import catalog_status

SCHEMA = "ocean-owner-task-evidence/v1"


def path_state(path):
    """Observe one registered file without scanning or opening source data."""
    if path is None:
        return "unknown"
    try:
        path = Path(path)
        # A configured input reached through a link does not attest source identity.
        if path.resolve(strict=True) != path.absolute() or not stat.S_ISREG(path.lstat().st_mode):
            return "unknown"
        return "present_unverified"
    except FileNotFoundError:
        return "missing"
    except (OSError, RuntimeError):
        return "unknown"


def artifact_role(role, state, *, identity=None, readable=False, source=False):
    return {
        "role": role,
        "identity": identity,
        "physical_state": state,
        "readable_by_owner": readable,
        "published_in_project": False,
        "referenced": None,
        "source_use": "original_input" if source else None,
    }


def task_evidence(record_id, task_id, purpose, status, versions, summary, roles):
    return {
        "schema_version": SCHEMA,
        "task_id": task_id,
        "record_id": record_id,
        "purpose": purpose,
        "status": status,
        "versions": versions,
        "aggregate": summary,
        "roles": [
            artifact_role("task_summary", "stored", identity=record_id, readable=True),
            *roles,
            artifact_role("service_cache", "not_registered"),
        ],
        "original_recomputation": "source_missing" if any(
            role["role"] == "source_data" and role["physical_state"] == "missing" for role in roles
        ) else "unknown",
    }


def analysis_evidence(record, input_path):
    purpose = record["request"]["purpose"]
    result = record["result"]
    distance = purpose == "monthly_distance_reference"
    aggregate = None
    if result is not None:
        metrics = result["month"]["common"] if distance else result["metrics"]
        aggregate = {
            "hours": metrics["hours" if distance else "total_hours"],
            "area_time_km2_days": metrics["area_time_km2_days"],
            "supported_days": (
                sum(day["common"]["hours"] is not None for day in result["days"])
                if distance else metrics["supported_days"]
            ),
            "calendar_days": len(result["days"]) if distance else metrics["calendar_days"],
            "research_ready": False,
        }
    source_state = path_state(input_path)
    result_id = result["result_id"] if result is not None else None
    return task_evidence(
        record["record_id"], record["id"], purpose, catalog_status(record),
        {"input": record["input_sha256"], "environment": record.get("execution_environment_id"),
         "qualification": (record.get("qualification") or {}).get("snapshot_id")},
        aggregate,
        [
            artifact_role("aggregate_result", "stored" if result is not None else "not_recorded",
                          identity=result_id, readable=result is not None),
            artifact_role("ordinary_artifact", "not_registered"),
            artifact_role("staging", "not_registered"),
            artifact_role("source_data", source_state, identity=record["input_sha256"], source=True),
        ],
    )


def preparation_evidence(record, status, artifact_state, source_state):
    artifact = status["artifact"]
    expected = record["expected"]
    registration = expected["registration"]
    aggregate = {**artifact["support"], "research_ready": False} if artifact is not None else None
    artifact_id = artifact["artifact_id"] if artifact is not None else None
    result = task_evidence(
        record["record_id"], record["id"], "archive_preparation", status["state"],
        {"input": "sha256:" + expected["raw_sha256"], "source": registration["source_version"],
         "processor": registration["processor_id"], "plan": status["plan_id"]},
        aggregate,
        [
            artifact_role("aggregate_result", "stored" if artifact is not None else "not_recorded",
                          identity=artifact_id, readable=artifact is not None),
            artifact_role("ordinary_artifact", artifact_state, identity=artifact_id, readable=artifact_state == "stored"),
            artifact_role("staging", "unknown" if status["state"] not in {"ready", "failed"} else "not_registered"),
            artifact_role("source_data", source_state, identity="sha256:" + expected["raw_sha256"], source=True),
        ],
    )
    return {
        **result, "request": status["request"], "artifact": artifact, "error": status["error"],
        "state_history": status["state_history"], "license": "CC BY 4.0",
    }
