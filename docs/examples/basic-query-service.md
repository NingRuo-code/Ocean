# Basic Query Service Examples

> Scope: deterministic product/research query summaries for Ticket 04. These endpoints are designed for frontend/server smoke checks and later Agent wrapping, but they do not call an AI model.

Full normalized snapshots are committed in `docs/examples/basic-query-service-snapshots.json`.

## Current State

Call:

```http
GET /api/query/current-state?date=2024-08-05&bbox=122,27,124.2,29.6&step=4
```

Expected output shape:

```json
{
  "kind": "current_state",
  "status": "ok",
  "source": {
    "service": "viewport",
    "query_service_version": "basic-query-v1",
    "viewport_source": "static_prototype"
  },
  "parameters": {
    "date": "2024-08-05",
    "bbox": [122.0, 27.0, 124.2, 29.6],
    "step": 4
  },
  "metrics": {
    "front_feature_count": 2,
    "sst_cell_count": 143,
    "fishing_effort_cell_count": 3,
    "total_apparent_fishing_hours": 50872.41
  },
  "coverage": {
    "status": "ok",
    "layers": {
      "fronts": "available",
      "sst": "available",
      "fishingEffort": "available"
    }
  }
}
```

## Front Response

Call:

```http
GET /api/query/front-response?date=2024-08-05&bbox=122,27,124.2,29.6&step=4
```

Expected output shape:

```json
{
  "kind": "front_response",
  "status": "ok",
  "metrics": {
    "response_record_count": 3,
    "buffer_km": [10, 20, 30],
    "post_window_apparent_fishing_hours": 50872.41,
    "pre7_apparent_fishing_hours": 30485.18,
    "non_front_control_hours": 13355.25,
    "enhanced_response_count": 3,
    "mean_lift_percent": 78.67
  },
  "caveats": [
    "Front-response output describes apparent fishing-effort response only; it must not be read as catch, yield, revenue, biomass, or guaranteed fishing success."
  ]
}
```

## Historical Comparison

Call:

```http
GET /api/query/historical-comparison?date=2024-08-05&longitude=120.5&latitude=30.5&radius_deg=1
```

When the local/server raw history directory is empty, the endpoint still returns a structured unavailable response:

```json
{
  "kind": "historical_comparison",
  "status": "unavailable",
  "metrics": {
    "same_period_probability": null,
    "same_period_sample_count": 0,
    "same_period_expected_sample_count": 43,
    "monthly_probability": null,
    "monthly_sample_count": 0
  },
  "coverage": {
    "status": "unavailable",
    "sample_count": 0,
    "expected_sample_count": 43,
    "coverage_ratio": 0.0
  }
}
```

With permitted local/server NetCDF samples under `data/raw/front` and `data/raw/sst`, the same endpoint returns same-period and monthly historical probabilities with source-file evidence.

## Regeneration

From the repository root:

```powershell
python backend/scripts/export_basic_query_examples.py
```

To inspect live responses through a running API server:

```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then call the three URLs above. Output may differ when local raw history data or viewport cache state changes.
