from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app

EXAMPLES = [
    {
        "name": "current-state-static-prototype",
        "method": "GET",
        "path": "/api/query/current-state",
        "params": {"date": "2024-08-05", "bbox": "122,27,124.2,29.6", "step": 4},
    },
    {
        "name": "front-response-static-prototype",
        "method": "GET",
        "path": "/api/query/front-response",
        "params": {"date": "2024-08-05", "bbox": "122,27,124.2,29.6", "step": 4},
    },
    {
        "name": "historical-comparison-empty-raw-data",
        "method": "GET",
        "path": "/api/query/historical-comparison",
        "params": {"date": "2024-08-05", "longitude": 120.5, "latitude": 30.5, "radius_deg": 1},
    },
    {
        "name": "current-state-unavailable-date",
        "method": "GET",
        "path": "/api/query/current-state",
        "params": {"date": "2024-09-01", "bbox": "122,27,124.2,29.6", "step": 4},
    },
]


def _normalize(value: Any) -> Any:
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if key in {"generated_at", "duration_ms", "path"}:
                normalized[key] = "<generated>"
            elif key == "hit":
                normalized[key] = "<cache-dependent>"
            else:
                normalized[key] = _normalize(item)
        return normalized
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    return value


def main() -> None:
    client = TestClient(app)
    snapshots = []
    for example in EXAMPLES:
        response = client.get(str(example["path"]), params=example["params"])
        snapshots.append(
            {
                **example,
                "status_code": response.status_code,
                "response": _normalize(response.json()),
            }
        )
    output_path = REPO_ROOT / "docs" / "examples" / "basic-query-service-snapshots.json"
    output_path.write_text(
        json.dumps({"snapshots": snapshots}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(output_path)


if __name__ == "__main__":
    main()
