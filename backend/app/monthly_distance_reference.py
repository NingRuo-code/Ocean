"""Explicit owner calculation over a maintainer-registered synthetic geometry input."""

import json
import subprocess
import sys

from .analysis_support import read_regular_bytes
from .config import PROJECT_ROOT

MAX_INPUT_BYTES = 16 * 1024 * 1024
REFERENCE_ENGINE = PROJECT_ROOT / "tools" / "compute_monthly_distance.py"


class QualificationInputMismatch(ValueError):
    pass


def calculate_distance_reference(request, source, qualification=None):
    raw = read_regular_bytes(source, MAX_INPUT_BYTES)
    command = [sys.executable, str(REFERENCE_ENGINE), request.model_dump_json(exclude_none=True)]
    if qualification:
        command.append(json.dumps(qualification))
    try:
        child = subprocess.run(command, input=raw, capture_output=True, timeout=25, check=True)
    except subprocess.CalledProcessError as error:
        if error.stderr.strip() == b"qualification_input_or_conditions_mismatch":
            raise QualificationInputMismatch from None
        raise
    result = json.loads(child.stdout)
    if result.get("evidence_kind") != "synthetic" or result.get("research_ready") is not False:
        raise ValueError("reference_output_boundary")
    return result
