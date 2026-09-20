(function () {
  "use strict";

  window.OF_FRONT_RESPONSE = {
  "schema_version": "front-response/v1",
  "status": "synthetic_fixture",
  "is_synthetic": true,
  "source": {
    "kind": "synthetic_fixture",
    "attribution": "Synthetic fixture generated for Ocean P1 conversion-path validation.",
    "license": "not_applicable",
    "accessed_at": null
  },
  "metric": "apparent_fishing_effort",
  "unit": "fishing_hours",
  "time_window": {
    "sample_start": "2024-07-01",
    "sample_end": "2024-08-31",
    "pre_window_days": 7,
    "post_window_days": [
      1,
      3
    ]
  },
  "spatial_window": {
    "region": "East China Sea prototype window",
    "bbox": [
      120,
      27,
      128,
      34
    ],
    "buffer_km": [
      10,
      20,
      30
    ],
    "control": "same-day non-front control area"
  },
  "public_boundary": {
    "commit_policy": "fixture_only",
    "raw_or_fine_grained_data_committed": false,
    "note": "Synthetic aggregated fixture only. Not real AIS/GFW data and not evidence of actual fishing activity."
  },
  "method": {
    "buffer_km": [
      10,
      20,
      30
    ],
    "pre_window_days": 7,
    "post_window_days": [
      1,
      3
    ],
    "control": "same-day non-front control area",
    "enhancement_rule": "post1_3_hours >= pre7_hours * 1.2 and post1_3_hours > non_front_control_hours"
  },
  "note": "Synthetic aggregated fixture only. Not real AIS/GFW data and not evidence of actual fishing activity.",
  "generated_at": "2026-09-20",
  "generated_by": {
    "script": "tools/build-front-response.mjs",
    "input": "data/front_response/fixture-effort-sample.json"
  },
  "events": [
    {
      "response_id": "FR-20240805-F001-10",
      "front_event_id": "2024-08-05:F001",
      "date": "2024-08-05",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre7_hours": 31.2,
      "post1_3_hours": 34,
      "non_front_control_hours": 28.7,
      "lift_percent": 9,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
    },
    {
      "response_id": "FR-20240805-F001-20",
      "front_event_id": "2024-08-05:F001",
      "date": "2024-08-05",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre7_hours": 42.5,
      "post1_3_hours": 57.8,
      "non_front_control_hours": 36.4,
      "lift_percent": 36,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
    },
    {
      "response_id": "FR-20240805-F001-30",
      "front_event_id": "2024-08-05:F001",
      "date": "2024-08-05",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre7_hours": 61,
      "post1_3_hours": 78.7,
      "non_front_control_hours": 52.3,
      "lift_percent": 29,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
    },
    {
      "response_id": "FR-20240806-F001-20",
      "front_event_id": "2024-08-06:F001",
      "date": "2024-08-06",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre7_hours": 39.6,
      "post1_3_hours": 41.1,
      "non_front_control_hours": 40.8,
      "lift_percent": 4,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
    }
  ],
  "by_date": {
    "2024-08-05": {
      "status": "available",
      "date": "2024-08-05",
      "by_range": {
        "10": {
          "response_id": "FR-20240805-F001-10",
          "front_event_id": "2024-08-05:F001",
          "date": "2024-08-05",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre7_hours": 31.2,
          "post1_3_hours": 34,
          "non_front_control_hours": 28.7,
          "lift_percent": 9,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
        },
        "20": {
          "response_id": "FR-20240805-F001-20",
          "front_event_id": "2024-08-05:F001",
          "date": "2024-08-05",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre7_hours": 42.5,
          "post1_3_hours": 57.8,
          "non_front_control_hours": 36.4,
          "lift_percent": 36,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
        },
        "30": {
          "response_id": "FR-20240805-F001-30",
          "front_event_id": "2024-08-05:F001",
          "date": "2024-08-05",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre7_hours": 61,
          "post1_3_hours": 78.7,
          "non_front_control_hours": 52.3,
          "lift_percent": 29,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
        }
      }
    },
    "2024-08-06": {
      "status": "available",
      "date": "2024-08-06",
      "by_range": {
        "20": {
          "response_id": "FR-20240806-F001-20",
          "front_event_id": "2024-08-06:F001",
          "date": "2024-08-06",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre7_hours": 39.6,
          "post1_3_hours": 41.1,
          "non_front_control_hours": 40.8,
          "lift_percent": 4,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
        }
      }
    }
  }
};
})();
