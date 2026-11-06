"""Explicit owner calculation over a maintainer-registered synthetic geometry input."""

import json
import subprocess
import sys

from .analysis_support import read_regular_bytes
from .config import PROJECT_ROOT

MAX_INPUT_BYTES = 16 * 1024 * 1024
REFERENCE_ENGINE = PROJECT_ROOT / "tools" / "compute_monthly_distance.py"


def calculate_distance_reference(request, source):
    raw = read_regular_bytes(source, MAX_INPUT_BYTES)
    child = subprocess.run(
        [sys.executable, str(REFERENCE_ENGINE), request.model_dump_json()],
        input=raw,
        capture_output=True,
        timeout=25,
        check=True,
    )
    result = json.loads(child.stdout)
    if result.get("evidence_kind") != "synthetic" or result.get("research_ready") is not False:
        raise ValueError("reference_output_boundary")
    return result
