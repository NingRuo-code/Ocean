"""Explicit owner calculation over a maintainer-registered synthetic geometry input."""

import json
import subprocess
import sys

from .config import PROJECT_ROOT

MAX_INPUT_BYTES = 16 * 1024 * 1024
REFERENCE_ENGINE = PROJECT_ROOT / "tools" / "compute_monthly_distance.py"


def calculate_distance_reference(request, source):
    with source.open("rb") as stream:
        raw = stream.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ValueError("reference_input_budget_exceeded")
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
