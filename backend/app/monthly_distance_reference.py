"""Owner calculation over bounded, maintainer-registered geometry inputs."""

import hashlib
import json
import subprocess
import sys

from .analysis_support import read_regular_bytes
from .config import PROJECT_ROOT
from .monthly_models import MonthlyResearchRequest

MAX_INPUT_BYTES = 16 * 1024 * 1024
REFERENCE_ENGINE = PROJECT_ROOT / "tools" / "compute_monthly_distance.py"


class QualificationInputMismatch(ValueError):
    pass


def distance_engine_id():
    return "sha256:" + hashlib.sha256(read_regular_bytes(REFERENCE_ENGINE, 1024 * 1024)).hexdigest()


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
    evidence_kind = "audited_cells" if isinstance(request, MonthlyResearchRequest) else "synthetic"
    if (
        result.get("evidence_kind") != evidence_kind
        or result.get("research_ready") is not False
        or result.get("kind") != request.purpose
        or result.get("qualification") != qualification
    ):
        raise ValueError("reference_output_boundary")
    return result
