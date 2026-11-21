"""Owner calculation over bounded, maintainer-registered geometry inputs."""

import hashlib
import json
import re
import subprocess
import sys
from calendar import monthrange
from importlib.metadata import version
from pathlib import Path
from tempfile import TemporaryDirectory

from .analysis_support import read_regular_bytes
from .config import PROJECT_ROOT
from .monthly_distance_process import run_cancellable_distance
from .monthly_models import MonthlyResearchRequest

DISTANCE_EXECUTION_TIMEOUT_SECONDS = 25
MAX_INPUT_BYTES = 16 * 1024 * 1024
REFERENCE_ENGINE = PROJECT_ROOT / "tools" / "compute_monthly_distance.py"
EXECUTION_SOURCES = (
    "audit_daily_sources.py",
    "audit_regional_support.py",
    "audit_support_qualification.py",
    "compute_monthly_distance.py",
    "monthly_block_uncertainty.py",
    "monthly_distance_background.py",
    "monthly_sensitivity_plan.py",
    "monthly_side_environment.py",
)


class QualificationInputMismatch(ValueError):
    pass


def distance_engine_id():
    return "sha256:" + hashlib.sha256(read_regular_bytes(REFERENCE_ENGINE, 1024 * 1024)).hexdigest()


def read_distance_input(source):
    return read_regular_bytes(source, MAX_INPUT_BYTES)


def distance_execution_sources():
    return {
        name: read_regular_bytes(REFERENCE_ENGINE.with_name(name), 1024 * 1024)
        for name in EXECUTION_SOURCES
    }


def distance_execution_environment(sources):
    # The optional compiled dependencies are needed only for controlled distance work.
    import pyproj
    import shapely

    return {
        "engines": {name: hashlib.sha256(raw).hexdigest() for name, raw in sources.items()},
        "python": sys.version,
        "packages": {name: version(name) for name in ("numpy", "pyproj", "shapely", "xarray")},
        "geometry_runtime": (pyproj.proj_version_str, shapely.geos_version_string),
    }


def calculate_distance_reference(request, raw, sources, qualification, cancelled=None):
    parameters = request.model_dump(exclude_none=True)
    try:
        # Each child imports the same helper bytes used in its execution identity.
        with TemporaryDirectory(prefix="ocean-month-engine-") as directory:
            root = Path(directory)
            for name, source in sources.items():
                (root / name).write_bytes(source)
            command = [sys.executable, "-B", str(root / REFERENCE_ENGINE.name),
                       request.model_dump_json(exclude_none=True)]
            if qualification:
                command.append(json.dumps(qualification))
            if cancelled is None:
                child = subprocess.run(
                    command, input=raw, capture_output=True,
                    timeout=DISTANCE_EXECUTION_TIMEOUT_SECONDS, check=True,
                )
            else:
                child = run_cancellable_distance(command, raw, DISTANCE_EXECUTION_TIMEOUT_SECONDS, cancelled)
    except subprocess.CalledProcessError as error:
        if error.stderr.strip() == b"qualification_input_or_conditions_mismatch":
            raise QualificationInputMismatch from None
        raise
    result = json.loads(child.stdout)
    evidence_kind = "audited_cells" if isinstance(request, MonthlyResearchRequest) else "synthetic"
    if (
        not isinstance(result, dict)
        or result.get("evidence_kind") != evidence_kind
        or result.get("research_ready") is not False
        or result.get("kind") != request.purpose
        or result.get("qualification") != qualification
        or result.get("parameters") != parameters
        or not isinstance(result.get("versions"), dict)
        or not isinstance(result.get("result_id"), str)
        or not re.fullmatch(r"sha256:[0-9a-f]{64}", result["result_id"])
        or not isinstance(result.get("p0_conditions"), dict)
        or not isinstance(result.get("distance_edges_km"), list)
        or not result["distance_edges_km"]
        or not isinstance(result.get("month"), dict)
        or not {"common", "bands", "activity_accounting"} <= result["month"].keys()
        or not isinstance(result.get("days"), list)
        or len(result["days"]) != monthrange(*map(int, request.month.split("-")))[1]
        or not all(isinstance(day, dict) and {"date", "common", "bands"} <= day.keys()
                   for day in result["days"])
    ):
        raise ValueError("reference_output_boundary")
    direct = {key: value for key, value in result.items() if key != "result_id"}
    digest = hashlib.sha256(
        json.dumps(direct, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()
    if result["result_id"] != "sha256:" + digest:
        raise ValueError("reference_output_digest")
    return result
