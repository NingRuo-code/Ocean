(function () {
  "use strict";

  window.OF_FRONT_RESPONSE = {
  "schema_version": "front-response/v1",
  "status": "real",
  "is_synthetic": false,
  "source": {
    "kind": "gfw_apparent_fishing_effort",
    "attribution": "Global Fishing Watch — AIS apparent fishing effort (4Wings report v3, public-global-fishing-effort:latest)",
    "license": "CC BY-NC 4.0 (non-commercial)",
    "accessed_at": "2026-09-23"
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
    ],
    "exploratory_window_days": [
      -7,
      7
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
    "control": "same-day non-front control area",
    "control_min_distance_km": 50,
    "control_area_ratio": 1,
    "control_sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
  },
  "public_boundary": {
    "commit_policy": "aggregate_only",
    "raw_or_fine_grained_data_committed": false,
    "note": "Aggregated front-response evidence derived from GFW apparent fishing effort. Not catch, production, revenue, or biomass. Raw GFW files stay outside the repository."
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
    "exploratory_window_days": [
      -7,
      7
    ],
    "control": "same-day non-front control area",
    "control_min_distance_km": 50,
    "control_area_ratio": 1,
    "control_sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density",
    "control_validation": "control pool excludes every 50 km front buffer on the same day; buffer area counted from GFW cells inside the radius",
    "enhancement_rule": "post1_3_hours >= pre7_hours * 1.2 and post1_3_hours > non_front_control_hours"
  },
  "note": "Aggregated front-response evidence derived from GFW apparent fishing effort. Not catch, production, revenue, or biomass. Raw GFW files stay outside the repository.",
  "generated_at": "2026-09-23",
  "generated_by": {
    "script": "tools/build-front-response.mjs",
    "input": "frontend/prototype/data/front_response/real-effort-input.json"
  },
  "events": [
    {
      "response_id": "FR-20240701-F012-10",
      "front_event_id": "2024-07-01:F012",
      "date": "2024-07-01",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-24",
        "end": "2024-06-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-02",
        "end": "2024-07-04",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-24",
        "end": "2024-07-08"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7364.87,
      "post1_3_hours": 3181.59,
      "non_front_control_hours": 109.32,
      "lift_percent": -57,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240701-F012-20",
      "front_event_id": "2024-07-01:F012",
      "date": "2024-07-01",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-24",
        "end": "2024-06-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-02",
        "end": "2024-07-04",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-24",
        "end": "2024-07-08"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7710.51,
      "post1_3_hours": 3237.95,
      "non_front_control_hours": 164.02,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240701-F012-30",
      "front_event_id": "2024-07-01:F012",
      "date": "2024-07-01",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-24",
        "end": "2024-06-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-02",
        "end": "2024-07-04",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-24",
        "end": "2024-07-08"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7834.82,
      "post1_3_hours": 3352.3,
      "non_front_control_hours": 246.09,
      "lift_percent": -57,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240702-F007-10",
      "front_event_id": "2024-07-02:F007",
      "date": "2024-07-02",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-25",
        "end": "2024-07-01",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-03",
        "end": "2024-07-05",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-25",
        "end": "2024-07-09"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7441.64,
      "post1_3_hours": 5294.22,
      "non_front_control_hours": 93.01,
      "lift_percent": -29,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240702-F007-20",
      "front_event_id": "2024-07-02:F007",
      "date": "2024-07-02",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-25",
        "end": "2024-07-01",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-03",
        "end": "2024-07-05",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-25",
        "end": "2024-07-09"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 9116.58,
      "post1_3_hours": 6695.44,
      "non_front_control_hours": 225.89,
      "lift_percent": -27,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240702-F007-30",
      "front_event_id": "2024-07-02:F007",
      "date": "2024-07-02",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-25",
        "end": "2024-07-01",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-03",
        "end": "2024-07-05",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-25",
        "end": "2024-07-09"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 13127.75,
      "post1_3_hours": 9345.06,
      "non_front_control_hours": 265.64,
      "lift_percent": -29,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240703-F003-10",
      "front_event_id": "2024-07-03:F003",
      "date": "2024-07-03",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-26",
        "end": "2024-07-02",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-04",
        "end": "2024-07-06",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-26",
        "end": "2024-07-10"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 2819.65,
      "post1_3_hours": 1196.56,
      "non_front_control_hours": 457.07,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240703-F003-20",
      "front_event_id": "2024-07-03:F003",
      "date": "2024-07-03",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-26",
        "end": "2024-07-02",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-04",
        "end": "2024-07-06",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-26",
        "end": "2024-07-10"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 6136.78,
      "post1_3_hours": 2665.25,
      "non_front_control_hours": 932.32,
      "lift_percent": -57,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240703-F003-30",
      "front_event_id": "2024-07-03:F003",
      "date": "2024-07-03",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-26",
        "end": "2024-07-02",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-04",
        "end": "2024-07-06",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-26",
        "end": "2024-07-10"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 9687.04,
      "post1_3_hours": 5086.48,
      "non_front_control_hours": 1443.85,
      "lift_percent": -47,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240704-F002-10",
      "front_event_id": "2024-07-04:F002",
      "date": "2024-07-04",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-27",
        "end": "2024-07-03",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-05",
        "end": "2024-07-07",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-27",
        "end": "2024-07-11"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 2432.43,
      "post1_3_hours": 1026.27,
      "non_front_control_hours": 657.05,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240704-F002-20",
      "front_event_id": "2024-07-04:F002",
      "date": "2024-07-04",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-27",
        "end": "2024-07-03",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-05",
        "end": "2024-07-07",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-27",
        "end": "2024-07-11"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 6840.33,
      "post1_3_hours": 3596.39,
      "non_front_control_hours": 1314.17,
      "lift_percent": -47,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240704-F002-30",
      "front_event_id": "2024-07-04:F002",
      "date": "2024-07-04",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-27",
        "end": "2024-07-03",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-05",
        "end": "2024-07-07",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-27",
        "end": "2024-07-11"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10335.15,
      "post1_3_hours": 5798,
      "non_front_control_hours": 1918.69,
      "lift_percent": -44,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240705-F011-10",
      "front_event_id": "2024-07-05:F011",
      "date": "2024-07-05",
      "front_id": "F011",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-28",
        "end": "2024-07-04",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-06",
        "end": "2024-07-08",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-28",
        "end": "2024-07-12"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 8003.05,
      "post1_3_hours": 6058.75,
      "non_front_control_hours": 160.45,
      "lift_percent": -24,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240705-F011-20",
      "front_event_id": "2024-07-05:F011",
      "date": "2024-07-05",
      "front_id": "F011",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-28",
        "end": "2024-07-04",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-06",
        "end": "2024-07-08",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-28",
        "end": "2024-07-12"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 16522.05,
      "post1_3_hours": 11607,
      "non_front_control_hours": 291.74,
      "lift_percent": -30,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240705-F011-30",
      "front_event_id": "2024-07-05:F011",
      "date": "2024-07-05",
      "front_id": "F011",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-28",
        "end": "2024-07-04",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-06",
        "end": "2024-07-08",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-28",
        "end": "2024-07-12"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 21364.88,
      "post1_3_hours": 14159.51,
      "non_front_control_hours": 379.44,
      "lift_percent": -34,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240706-F001-10",
      "front_event_id": "2024-07-06:F001",
      "date": "2024-07-06",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-29",
        "end": "2024-07-05",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-07",
        "end": "2024-07-09",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-29",
        "end": "2024-07-13"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 5256.36,
      "post1_3_hours": 4860.4,
      "non_front_control_hours": 352.38,
      "lift_percent": -8,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240706-F001-20",
      "front_event_id": "2024-07-06:F001",
      "date": "2024-07-06",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-29",
        "end": "2024-07-05",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-07",
        "end": "2024-07-09",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-29",
        "end": "2024-07-13"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11222.39,
      "post1_3_hours": 7561.54,
      "non_front_control_hours": 664.15,
      "lift_percent": -33,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240706-F001-30",
      "front_event_id": "2024-07-06:F001",
      "date": "2024-07-06",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-29",
        "end": "2024-07-05",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-07",
        "end": "2024-07-09",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-29",
        "end": "2024-07-13"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 15261.43,
      "post1_3_hours": 9386.35,
      "non_front_control_hours": 955.49,
      "lift_percent": -38,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240707-F005-10",
      "front_event_id": "2024-07-07:F005",
      "date": "2024-07-07",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-30",
        "end": "2024-07-06",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-08",
        "end": "2024-07-10",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-30",
        "end": "2024-07-14"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 1248.59,
      "post1_3_hours": 2072.2,
      "non_front_control_hours": 81.69,
      "lift_percent": 66,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240707-F005-20",
      "front_event_id": "2024-07-07:F005",
      "date": "2024-07-07",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-30",
        "end": "2024-07-06",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-08",
        "end": "2024-07-10",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-30",
        "end": "2024-07-14"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10732.02,
      "post1_3_hours": 8416.73,
      "non_front_control_hours": 183.78,
      "lift_percent": -22,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240707-F005-30",
      "front_event_id": "2024-07-07:F005",
      "date": "2024-07-07",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-06-30",
        "end": "2024-07-06",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-08",
        "end": "2024-07-10",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-06-30",
        "end": "2024-07-14"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11142.77,
      "post1_3_hours": 8686.53,
      "non_front_control_hours": 234.78,
      "lift_percent": -22,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240708-F012-10",
      "front_event_id": "2024-07-08:F012",
      "date": "2024-07-08",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-01",
        "end": "2024-07-07",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-09",
        "end": "2024-07-11",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-01",
        "end": "2024-07-15"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 563.96,
      "post1_3_hours": 345.61,
      "non_front_control_hours": 133.5,
      "lift_percent": -39,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240708-F012-20",
      "front_event_id": "2024-07-08:F012",
      "date": "2024-07-08",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-01",
        "end": "2024-07-07",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-09",
        "end": "2024-07-11",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-01",
        "end": "2024-07-15"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 19963.67,
      "post1_3_hours": 10155.01,
      "non_front_control_hours": 324.16,
      "lift_percent": -49,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240708-F012-30",
      "front_event_id": "2024-07-08:F012",
      "date": "2024-07-08",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-01",
        "end": "2024-07-07",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-09",
        "end": "2024-07-11",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-01",
        "end": "2024-07-15"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 20708.76,
      "post1_3_hours": 10321.17,
      "non_front_control_hours": 362.36,
      "lift_percent": -50,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240709-F014-10",
      "front_event_id": "2024-07-09:F014",
      "date": "2024-07-09",
      "front_id": "F014",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-02",
        "end": "2024-07-08",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-10",
        "end": "2024-07-12",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-02",
        "end": "2024-07-16"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10559.99,
      "post1_3_hours": 5222.7,
      "non_front_control_hours": 77.42,
      "lift_percent": -51,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240709-F014-20",
      "front_event_id": "2024-07-09:F014",
      "date": "2024-07-09",
      "front_id": "F014",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-02",
        "end": "2024-07-08",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-10",
        "end": "2024-07-12",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-02",
        "end": "2024-07-16"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 16566.24,
      "post1_3_hours": 7715.87,
      "non_front_control_hours": 146.19,
      "lift_percent": -53,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240709-F014-30",
      "front_event_id": "2024-07-09:F014",
      "date": "2024-07-09",
      "front_id": "F014",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-02",
        "end": "2024-07-08",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-10",
        "end": "2024-07-12",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-02",
        "end": "2024-07-16"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 22079.1,
      "post1_3_hours": 10539.24,
      "non_front_control_hours": 189.12,
      "lift_percent": -52,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240710-F012-10",
      "front_event_id": "2024-07-10:F012",
      "date": "2024-07-10",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-03",
        "end": "2024-07-09",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-11",
        "end": "2024-07-13",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-03",
        "end": "2024-07-17"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 1440.7,
      "post1_3_hours": 625.59,
      "non_front_control_hours": 101.07,
      "lift_percent": -57,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240710-F012-20",
      "front_event_id": "2024-07-10:F012",
      "date": "2024-07-10",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-03",
        "end": "2024-07-09",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-11",
        "end": "2024-07-13",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-03",
        "end": "2024-07-17"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 23978.53,
      "post1_3_hours": 9727.3,
      "non_front_control_hours": 230.92,
      "lift_percent": -59,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240710-F012-30",
      "front_event_id": "2024-07-10:F012",
      "date": "2024-07-10",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-03",
        "end": "2024-07-09",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-11",
        "end": "2024-07-13",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-03",
        "end": "2024-07-17"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 29774.49,
      "post1_3_hours": 13548.09,
      "non_front_control_hours": 331.95,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240711-F008-10",
      "front_event_id": "2024-07-11:F008",
      "date": "2024-07-11",
      "front_id": "F008",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-04",
        "end": "2024-07-10",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-12",
        "end": "2024-07-14",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-04",
        "end": "2024-07-18"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 13803.04,
      "post1_3_hours": 4633.14,
      "non_front_control_hours": 143.87,
      "lift_percent": -66,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240711-F008-20",
      "front_event_id": "2024-07-11:F008",
      "date": "2024-07-11",
      "front_id": "F008",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-04",
        "end": "2024-07-10",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-12",
        "end": "2024-07-14",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-04",
        "end": "2024-07-18"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 26121.67,
      "post1_3_hours": 10167.83,
      "non_front_control_hours": 261.6,
      "lift_percent": -61,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240711-F008-30",
      "front_event_id": "2024-07-11:F008",
      "date": "2024-07-11",
      "front_id": "F008",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-04",
        "end": "2024-07-10",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-12",
        "end": "2024-07-14",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-04",
        "end": "2024-07-18"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 31400.68,
      "post1_3_hours": 14333.57,
      "non_front_control_hours": 314.1,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240712-F002-10",
      "front_event_id": "2024-07-12:F002",
      "date": "2024-07-12",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-05",
        "end": "2024-07-11",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-13",
        "end": "2024-07-15",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-05",
        "end": "2024-07-19"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 2140.44,
      "post1_3_hours": 2356.72,
      "non_front_control_hours": 234.68,
      "lift_percent": 10,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240712-F002-20",
      "front_event_id": "2024-07-12:F002",
      "date": "2024-07-12",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-05",
        "end": "2024-07-11",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-13",
        "end": "2024-07-15",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-05",
        "end": "2024-07-19"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11163.52,
      "post1_3_hours": 7869.02,
      "non_front_control_hours": 523.5,
      "lift_percent": -30,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240712-F002-30",
      "front_event_id": "2024-07-12:F002",
      "date": "2024-07-12",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-05",
        "end": "2024-07-11",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-13",
        "end": "2024-07-15",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-05",
        "end": "2024-07-19"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 18532.25,
      "post1_3_hours": 11899.43,
      "non_front_control_hours": 794.15,
      "lift_percent": -36,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240713-F001-10",
      "front_event_id": "2024-07-13:F001",
      "date": "2024-07-13",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-06",
        "end": "2024-07-12",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-14",
        "end": "2024-07-16",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-06",
        "end": "2024-07-20"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14158.94,
      "post1_3_hours": 7767.09,
      "non_front_control_hours": 390.47,
      "lift_percent": -45,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240713-F001-20",
      "front_event_id": "2024-07-13:F001",
      "date": "2024-07-13",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-06",
        "end": "2024-07-12",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-14",
        "end": "2024-07-16",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-06",
        "end": "2024-07-20"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 15202.64,
      "post1_3_hours": 8300.04,
      "non_front_control_hours": 644.26,
      "lift_percent": -45,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240713-F001-30",
      "front_event_id": "2024-07-13:F001",
      "date": "2024-07-13",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-06",
        "end": "2024-07-12",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-14",
        "end": "2024-07-16",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-06",
        "end": "2024-07-20"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 24349.44,
      "post1_3_hours": 12329.48,
      "non_front_control_hours": 916.96,
      "lift_percent": -49,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240714-F001-10",
      "front_event_id": "2024-07-14:F001",
      "date": "2024-07-14",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-07",
        "end": "2024-07-13",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-15",
        "end": "2024-07-17",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-07",
        "end": "2024-07-21"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7748.27,
      "post1_3_hours": 4054.87,
      "non_front_control_hours": 739.29,
      "lift_percent": -48,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240714-F001-20",
      "front_event_id": "2024-07-14:F001",
      "date": "2024-07-14",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-07",
        "end": "2024-07-13",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-15",
        "end": "2024-07-17",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-07",
        "end": "2024-07-21"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 22222.45,
      "post1_3_hours": 9857.23,
      "non_front_control_hours": 1551.49,
      "lift_percent": -56,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240714-F001-30",
      "front_event_id": "2024-07-14:F001",
      "date": "2024-07-14",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-07",
        "end": "2024-07-13",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-15",
        "end": "2024-07-17",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-07",
        "end": "2024-07-21"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 26062.31,
      "post1_3_hours": 11137.9,
      "non_front_control_hours": 1996.69,
      "lift_percent": -57,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240715-F012-10",
      "front_event_id": "2024-07-15:F012",
      "date": "2024-07-15",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-08",
        "end": "2024-07-14",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-16",
        "end": "2024-07-18",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-08",
        "end": "2024-07-22"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11684.4,
      "post1_3_hours": 3903.27,
      "non_front_control_hours": 103.61,
      "lift_percent": -67,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240715-F012-20",
      "front_event_id": "2024-07-15:F012",
      "date": "2024-07-15",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-08",
        "end": "2024-07-14",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-16",
        "end": "2024-07-18",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-08",
        "end": "2024-07-22"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 22099.42,
      "post1_3_hours": 8740.34,
      "non_front_control_hours": 269.27,
      "lift_percent": -60,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240715-F012-30",
      "front_event_id": "2024-07-15:F012",
      "date": "2024-07-15",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-08",
        "end": "2024-07-14",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-16",
        "end": "2024-07-18",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-08",
        "end": "2024-07-22"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 24771.07,
      "post1_3_hours": 10329.12,
      "non_front_control_hours": 352.32,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240716-F012-10",
      "front_event_id": "2024-07-16:F012",
      "date": "2024-07-16",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-09",
        "end": "2024-07-15",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-17",
        "end": "2024-07-19",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-09",
        "end": "2024-07-23"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11173.24,
      "post1_3_hours": 3635.15,
      "non_front_control_hours": 190.06,
      "lift_percent": -67,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240716-F012-20",
      "front_event_id": "2024-07-16:F012",
      "date": "2024-07-16",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-09",
        "end": "2024-07-15",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-17",
        "end": "2024-07-19",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-09",
        "end": "2024-07-23"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 22936.48,
      "post1_3_hours": 9152.24,
      "non_front_control_hours": 403.84,
      "lift_percent": -60,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240716-F012-30",
      "front_event_id": "2024-07-16:F012",
      "date": "2024-07-16",
      "front_id": "F012",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-09",
        "end": "2024-07-15",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-17",
        "end": "2024-07-19",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-09",
        "end": "2024-07-23"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 30108.4,
      "post1_3_hours": 12611.38,
      "non_front_control_hours": 523,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240717-F009-10",
      "front_event_id": "2024-07-17:F009",
      "date": "2024-07-17",
      "front_id": "F009",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-10",
        "end": "2024-07-16",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-18",
        "end": "2024-07-20",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-10",
        "end": "2024-07-24"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11110.39,
      "post1_3_hours": 4347.11,
      "non_front_control_hours": 152.33,
      "lift_percent": -61,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240717-F009-20",
      "front_event_id": "2024-07-17:F009",
      "date": "2024-07-17",
      "front_id": "F009",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-10",
        "end": "2024-07-16",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-18",
        "end": "2024-07-20",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-10",
        "end": "2024-07-24"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 21254.62,
      "post1_3_hours": 9060.41,
      "non_front_control_hours": 274.12,
      "lift_percent": -57,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240717-F009-30",
      "front_event_id": "2024-07-17:F009",
      "date": "2024-07-17",
      "front_id": "F009",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-10",
        "end": "2024-07-16",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-18",
        "end": "2024-07-20",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-10",
        "end": "2024-07-24"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 31706.29,
      "post1_3_hours": 12810.18,
      "non_front_control_hours": 396.37,
      "lift_percent": -60,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240718-F009-10",
      "front_event_id": "2024-07-18:F009",
      "date": "2024-07-18",
      "front_id": "F009",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-11",
        "end": "2024-07-17",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-19",
        "end": "2024-07-21",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-11",
        "end": "2024-07-25"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 5513.72,
      "post1_3_hours": 1057.9,
      "non_front_control_hours": 721.11,
      "lift_percent": -81,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240718-F009-20",
      "front_event_id": "2024-07-18:F009",
      "date": "2024-07-18",
      "front_id": "F009",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-11",
        "end": "2024-07-17",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-19",
        "end": "2024-07-21",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-11",
        "end": "2024-07-25"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14673.93,
      "post1_3_hours": 4004.87,
      "non_front_control_hours": 1251.76,
      "lift_percent": -73,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240718-F009-30",
      "front_event_id": "2024-07-18:F009",
      "date": "2024-07-18",
      "front_id": "F009",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-11",
        "end": "2024-07-17",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-19",
        "end": "2024-07-21",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-11",
        "end": "2024-07-25"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 24761.05,
      "post1_3_hours": 6423.31,
      "non_front_control_hours": 1857.88,
      "lift_percent": -74,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240719-F007-10",
      "front_event_id": "2024-07-19:F007",
      "date": "2024-07-19",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-12",
        "end": "2024-07-18",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-20",
        "end": "2024-07-22",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-12",
        "end": "2024-07-26"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 3927.26,
      "post1_3_hours": 2009.17,
      "non_front_control_hours": 1034.4,
      "lift_percent": -49,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240719-F007-20",
      "front_event_id": "2024-07-19:F007",
      "date": "2024-07-19",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-12",
        "end": "2024-07-18",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-20",
        "end": "2024-07-22",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-12",
        "end": "2024-07-26"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7574.87,
      "post1_3_hours": 4169.14,
      "non_front_control_hours": 2099.77,
      "lift_percent": -45,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240719-F007-30",
      "front_event_id": "2024-07-19:F007",
      "date": "2024-07-19",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-12",
        "end": "2024-07-18",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-20",
        "end": "2024-07-22",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-12",
        "end": "2024-07-26"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11482.09,
      "post1_3_hours": 6532.43,
      "non_front_control_hours": 3164.85,
      "lift_percent": -43,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240720-F004-10",
      "front_event_id": "2024-07-20:F004",
      "date": "2024-07-20",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-13",
        "end": "2024-07-19",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-21",
        "end": "2024-07-23",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-13",
        "end": "2024-07-27"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7191.06,
      "post1_3_hours": 1768.93,
      "non_front_control_hours": 368.02,
      "lift_percent": -75,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240720-F004-20",
      "front_event_id": "2024-07-20:F004",
      "date": "2024-07-20",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-13",
        "end": "2024-07-19",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-21",
        "end": "2024-07-23",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-13",
        "end": "2024-07-27"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 13763.17,
      "post1_3_hours": 3258.61,
      "non_front_control_hours": 671.18,
      "lift_percent": -76,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240720-F004-30",
      "front_event_id": "2024-07-20:F004",
      "date": "2024-07-20",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-13",
        "end": "2024-07-19",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-21",
        "end": "2024-07-23",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-13",
        "end": "2024-07-27"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14867.59,
      "post1_3_hours": 3583.51,
      "non_front_control_hours": 909.2,
      "lift_percent": -76,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240721-F001-10",
      "front_event_id": "2024-07-21:F001",
      "date": "2024-07-21",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-14",
        "end": "2024-07-20",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-22",
        "end": "2024-07-24",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-14",
        "end": "2024-07-28"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 5836.56,
      "post1_3_hours": 1492.85,
      "non_front_control_hours": 320.98,
      "lift_percent": -74,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240721-F001-20",
      "front_event_id": "2024-07-21:F001",
      "date": "2024-07-21",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-14",
        "end": "2024-07-20",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-22",
        "end": "2024-07-24",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-14",
        "end": "2024-07-28"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 12865.74,
      "post1_3_hours": 2810.73,
      "non_front_control_hours": 662.38,
      "lift_percent": -78,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240721-F001-30",
      "front_event_id": "2024-07-21:F001",
      "date": "2024-07-21",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-14",
        "end": "2024-07-20",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-22",
        "end": "2024-07-24",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-14",
        "end": "2024-07-28"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14682.92,
      "post1_3_hours": 3288.98,
      "non_front_control_hours": 982.98,
      "lift_percent": -78,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240722-F001-10",
      "front_event_id": "2024-07-22:F001",
      "date": "2024-07-22",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-15",
        "end": "2024-07-21",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-23",
        "end": "2024-07-25",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-15",
        "end": "2024-07-29"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10158.02,
      "post1_3_hours": 3287.72,
      "non_front_control_hours": 397.87,
      "lift_percent": -68,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240722-F001-20",
      "front_event_id": "2024-07-22:F001",
      "date": "2024-07-22",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-15",
        "end": "2024-07-21",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-23",
        "end": "2024-07-25",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-15",
        "end": "2024-07-29"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10631.68,
      "post1_3_hours": 3437,
      "non_front_control_hours": 765.17,
      "lift_percent": -68,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240722-F001-30",
      "front_event_id": "2024-07-22:F001",
      "date": "2024-07-22",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-15",
        "end": "2024-07-21",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-23",
        "end": "2024-07-25",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-15",
        "end": "2024-07-29"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11193.38,
      "post1_3_hours": 3462.87,
      "non_front_control_hours": 1071.55,
      "lift_percent": -69,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240723-F007-10",
      "front_event_id": "2024-07-23:F007",
      "date": "2024-07-23",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-16",
        "end": "2024-07-22",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-24",
        "end": "2024-07-26",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-16",
        "end": "2024-07-30"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 5509.41,
      "post1_3_hours": 1732.28,
      "non_front_control_hours": 310.29,
      "lift_percent": -69,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240723-F007-20",
      "front_event_id": "2024-07-23:F007",
      "date": "2024-07-23",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-16",
        "end": "2024-07-22",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-24",
        "end": "2024-07-26",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-16",
        "end": "2024-07-30"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7159.4,
      "post1_3_hours": 1743.55,
      "non_front_control_hours": 621.06,
      "lift_percent": -76,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240723-F007-30",
      "front_event_id": "2024-07-23:F007",
      "date": "2024-07-23",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-16",
        "end": "2024-07-22",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-24",
        "end": "2024-07-26",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-16",
        "end": "2024-07-30"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11193.75,
      "post1_3_hours": 2247.98,
      "non_front_control_hours": 790.51,
      "lift_percent": -80,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240724-F011-10",
      "front_event_id": "2024-07-24:F011",
      "date": "2024-07-24",
      "front_id": "F011",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-17",
        "end": "2024-07-23",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-25",
        "end": "2024-07-27",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-17",
        "end": "2024-07-31"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 2342.39,
      "post1_3_hours": 2468.23,
      "non_front_control_hours": 38.17,
      "lift_percent": 5,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240724-F011-20",
      "front_event_id": "2024-07-24:F011",
      "date": "2024-07-24",
      "front_id": "F011",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-17",
        "end": "2024-07-23",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-25",
        "end": "2024-07-27",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-17",
        "end": "2024-07-31"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11551.97,
      "post1_3_hours": 9952.45,
      "non_front_control_hours": 89.07,
      "lift_percent": -14,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240724-F011-30",
      "front_event_id": "2024-07-24:F011",
      "date": "2024-07-24",
      "front_id": "F011",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-17",
        "end": "2024-07-23",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-25",
        "end": "2024-07-27",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-17",
        "end": "2024-07-31"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11899.33,
      "post1_3_hours": 10210.75,
      "non_front_control_hours": 114.52,
      "lift_percent": -14,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240725-F002-10",
      "front_event_id": "2024-07-25:F002",
      "date": "2024-07-25",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-18",
        "end": "2024-07-24",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-26",
        "end": "2024-07-28",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-18",
        "end": "2024-08-01"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10383.02,
      "post1_3_hours": 7512,
      "non_front_control_hours": 135.36,
      "lift_percent": -28,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240725-F002-20",
      "front_event_id": "2024-07-25:F002",
      "date": "2024-07-25",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-18",
        "end": "2024-07-24",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-26",
        "end": "2024-07-28",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-18",
        "end": "2024-08-01"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10691.05,
      "post1_3_hours": 7547.92,
      "non_front_control_hours": 168.72,
      "lift_percent": -29,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240725-F002-30",
      "front_event_id": "2024-07-25:F002",
      "date": "2024-07-25",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-18",
        "end": "2024-07-24",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-26",
        "end": "2024-07-28",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-18",
        "end": "2024-08-01"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11313.02,
      "post1_3_hours": 8285.84,
      "non_front_control_hours": 303.65,
      "lift_percent": -27,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240726-F001-10",
      "front_event_id": "2024-07-26:F001",
      "date": "2024-07-26",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-19",
        "end": "2024-07-25",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-27",
        "end": "2024-07-29",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-19",
        "end": "2024-08-02"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 4884.45,
      "post1_3_hours": 1409.06,
      "non_front_control_hours": 108.47,
      "lift_percent": -71,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240726-F001-20",
      "front_event_id": "2024-07-26:F001",
      "date": "2024-07-26",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-19",
        "end": "2024-07-25",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-27",
        "end": "2024-07-29",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-19",
        "end": "2024-08-02"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 6139.41,
      "post1_3_hours": 2326.84,
      "non_front_control_hours": 215.34,
      "lift_percent": -62,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240726-F001-30",
      "front_event_id": "2024-07-26:F001",
      "date": "2024-07-26",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-19",
        "end": "2024-07-25",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-27",
        "end": "2024-07-29",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-19",
        "end": "2024-08-02"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 9302.47,
      "post1_3_hours": 3581.82,
      "non_front_control_hours": 648.5,
      "lift_percent": -61,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240727-F004-10",
      "front_event_id": "2024-07-27:F004",
      "date": "2024-07-27",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-20",
        "end": "2024-07-26",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-28",
        "end": "2024-07-30",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-20",
        "end": "2024-08-03"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 4414.91,
      "post1_3_hours": 1644.16,
      "non_front_control_hours": 20.95,
      "lift_percent": -63,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240727-F004-20",
      "front_event_id": "2024-07-27:F004",
      "date": "2024-07-27",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-20",
        "end": "2024-07-26",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-28",
        "end": "2024-07-30",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-20",
        "end": "2024-08-03"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 6835.36,
      "post1_3_hours": 3608.38,
      "non_front_control_hours": 83.88,
      "lift_percent": -47,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240727-F004-30",
      "front_event_id": "2024-07-27:F004",
      "date": "2024-07-27",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-20",
        "end": "2024-07-26",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-28",
        "end": "2024-07-30",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-20",
        "end": "2024-08-03"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7594.28,
      "post1_3_hours": 4922.57,
      "non_front_control_hours": 167.71,
      "lift_percent": -35,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240728-F004-10",
      "front_event_id": "2024-07-28:F004",
      "date": "2024-07-28",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-21",
        "end": "2024-07-27",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-29",
        "end": "2024-07-31",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-21",
        "end": "2024-08-04"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 3714.33,
      "post1_3_hours": 1195.92,
      "non_front_control_hours": 442.52,
      "lift_percent": -68,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240728-F004-20",
      "front_event_id": "2024-07-28:F004",
      "date": "2024-07-28",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-21",
        "end": "2024-07-27",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-29",
        "end": "2024-07-31",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-21",
        "end": "2024-08-04"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 4374.64,
      "post1_3_hours": 2527.89,
      "non_front_control_hours": 783.41,
      "lift_percent": -42,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240728-F004-30",
      "front_event_id": "2024-07-28:F004",
      "date": "2024-07-28",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-21",
        "end": "2024-07-27",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-29",
        "end": "2024-07-31",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-21",
        "end": "2024-08-04"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 6361.39,
      "post1_3_hours": 5574.66,
      "non_front_control_hours": 1191.99,
      "lift_percent": -12,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240729-F003-10",
      "front_event_id": "2024-07-29:F003",
      "date": "2024-07-29",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-22",
        "end": "2024-07-28",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-30",
        "end": "2024-08-01",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-22",
        "end": "2024-08-05"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 157.12,
      "post1_3_hours": 1642.76,
      "non_front_control_hours": 130.14,
      "lift_percent": 946,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240729-F003-20",
      "front_event_id": "2024-07-29:F003",
      "date": "2024-07-29",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-22",
        "end": "2024-07-28",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-30",
        "end": "2024-08-01",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-22",
        "end": "2024-08-05"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 1894.27,
      "post1_3_hours": 3931.29,
      "non_front_control_hours": 372,
      "lift_percent": 108,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240729-F003-30",
      "front_event_id": "2024-07-29:F003",
      "date": "2024-07-29",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-22",
        "end": "2024-07-28",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-30",
        "end": "2024-08-01",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-22",
        "end": "2024-08-05"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 6401.36,
      "post1_3_hours": 6501.55,
      "non_front_control_hours": 483.3,
      "lift_percent": 2,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240730-F001-10",
      "front_event_id": "2024-07-30:F001",
      "date": "2024-07-30",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-23",
        "end": "2024-07-29",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-31",
        "end": "2024-08-02",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-23",
        "end": "2024-08-06"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 721.53,
      "post1_3_hours": 4792.03,
      "non_front_control_hours": 238.85,
      "lift_percent": 564,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240730-F001-20",
      "front_event_id": "2024-07-30:F001",
      "date": "2024-07-30",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-23",
        "end": "2024-07-29",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-31",
        "end": "2024-08-02",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-23",
        "end": "2024-08-06"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 3977.13,
      "post1_3_hours": 10514.1,
      "non_front_control_hours": 448.08,
      "lift_percent": 164,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240730-F001-30",
      "front_event_id": "2024-07-30:F001",
      "date": "2024-07-30",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-23",
        "end": "2024-07-29",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-07-31",
        "end": "2024-08-02",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-23",
        "end": "2024-08-06"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 9968.22,
      "post1_3_hours": 18831.38,
      "non_front_control_hours": 807.86,
      "lift_percent": 89,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240731-F001-10",
      "front_event_id": "2024-07-31:F001",
      "date": "2024-07-31",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-24",
        "end": "2024-07-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-01",
        "end": "2024-08-03",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-24",
        "end": "2024-08-07"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 934.76,
      "post1_3_hours": 10387.64,
      "non_front_control_hours": 644.17,
      "lift_percent": 1011,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240731-F001-20",
      "front_event_id": "2024-07-31:F001",
      "date": "2024-07-31",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-24",
        "end": "2024-07-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-01",
        "end": "2024-08-03",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-24",
        "end": "2024-08-07"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 1515.45,
      "post1_3_hours": 21551.62,
      "non_front_control_hours": 1119.27,
      "lift_percent": 1322,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240731-F001-30",
      "front_event_id": "2024-07-31:F001",
      "date": "2024-07-31",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-24",
        "end": "2024-07-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-01",
        "end": "2024-08-03",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-24",
        "end": "2024-08-07"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 1938.51,
      "post1_3_hours": 27882.2,
      "non_front_control_hours": 1364.43,
      "lift_percent": 1338,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240801-F003-10",
      "front_event_id": "2024-08-01:F003",
      "date": "2024-08-01",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-25",
        "end": "2024-07-31",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-02",
        "end": "2024-08-04",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-25",
        "end": "2024-08-08"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 188.57,
      "post1_3_hours": 3491.39,
      "non_front_control_hours": 639.21,
      "lift_percent": 1752,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240801-F003-20",
      "front_event_id": "2024-08-01:F003",
      "date": "2024-08-01",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-25",
        "end": "2024-07-31",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-02",
        "end": "2024-08-04",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-25",
        "end": "2024-08-08"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 444.57,
      "post1_3_hours": 8583.06,
      "non_front_control_hours": 1390.82,
      "lift_percent": 1831,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240801-F003-30",
      "front_event_id": "2024-08-01:F003",
      "date": "2024-08-01",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-25",
        "end": "2024-07-31",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-02",
        "end": "2024-08-04",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-25",
        "end": "2024-08-08"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 4558.07,
      "post1_3_hours": 15595.01,
      "non_front_control_hours": 2104.37,
      "lift_percent": 242,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240802-F005-10",
      "front_event_id": "2024-08-02:F005",
      "date": "2024-08-02",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-26",
        "end": "2024-08-01",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-03",
        "end": "2024-08-05",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-26",
        "end": "2024-08-09"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 995.03,
      "post1_3_hours": 4714.71,
      "non_front_control_hours": 1410.15,
      "lift_percent": 374,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240802-F005-20",
      "front_event_id": "2024-08-02:F005",
      "date": "2024-08-02",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-26",
        "end": "2024-08-01",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-03",
        "end": "2024-08-05",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-26",
        "end": "2024-08-09"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 2764.24,
      "post1_3_hours": 11987.91,
      "non_front_control_hours": 2556.22,
      "lift_percent": 334,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240802-F005-30",
      "front_event_id": "2024-08-02:F005",
      "date": "2024-08-02",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-26",
        "end": "2024-08-01",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-03",
        "end": "2024-08-05",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-26",
        "end": "2024-08-09"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 3440.52,
      "post1_3_hours": 20638.2,
      "non_front_control_hours": 3605.79,
      "lift_percent": 500,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240803-F003-10",
      "front_event_id": "2024-08-03:F003",
      "date": "2024-08-03",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-27",
        "end": "2024-08-02",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-04",
        "end": "2024-08-06",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-27",
        "end": "2024-08-10"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 1676.8,
      "post1_3_hours": 9055.18,
      "non_front_control_hours": 2150.16,
      "lift_percent": 440,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240803-F003-20",
      "front_event_id": "2024-08-03:F003",
      "date": "2024-08-03",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-27",
        "end": "2024-08-02",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-04",
        "end": "2024-08-06",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-27",
        "end": "2024-08-10"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 3790.3,
      "post1_3_hours": 19166.16,
      "non_front_control_hours": 4347.52,
      "lift_percent": 406,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240803-F003-30",
      "front_event_id": "2024-08-03:F003",
      "date": "2024-08-03",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-27",
        "end": "2024-08-02",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-04",
        "end": "2024-08-06",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-27",
        "end": "2024-08-10"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7126.72,
      "post1_3_hours": 26688.06,
      "non_front_control_hours": 6581.95,
      "lift_percent": 274,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240804-F003-10",
      "front_event_id": "2024-08-04:F003",
      "date": "2024-08-04",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-28",
        "end": "2024-08-03",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-05",
        "end": "2024-08-07",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-28",
        "end": "2024-08-11"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 2650.61,
      "post1_3_hours": 7313.02,
      "non_front_control_hours": 2714.78,
      "lift_percent": 176,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240804-F003-20",
      "front_event_id": "2024-08-04:F003",
      "date": "2024-08-04",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-28",
        "end": "2024-08-03",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-05",
        "end": "2024-08-07",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-28",
        "end": "2024-08-11"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 5653.38,
      "post1_3_hours": 15247.38,
      "non_front_control_hours": 5129.18,
      "lift_percent": 170,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240804-F003-30",
      "front_event_id": "2024-08-04:F003",
      "date": "2024-08-04",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-28",
        "end": "2024-08-03",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-05",
        "end": "2024-08-07",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-28",
        "end": "2024-08-11"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 12987.58,
      "post1_3_hours": 24450.81,
      "non_front_control_hours": 7544.28,
      "lift_percent": 88,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240805-F002-10",
      "front_event_id": "2024-08-05:F002",
      "date": "2024-08-05",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-29",
        "end": "2024-08-04",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-06",
        "end": "2024-08-08",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-29",
        "end": "2024-08-12"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 3315.93,
      "post1_3_hours": 6764.58,
      "non_front_control_hours": 2205.53,
      "lift_percent": 104,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240805-F002-20",
      "front_event_id": "2024-08-05:F002",
      "date": "2024-08-05",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-29",
        "end": "2024-08-04",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-06",
        "end": "2024-08-08",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-29",
        "end": "2024-08-12"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 9525.59,
      "post1_3_hours": 16977.78,
      "non_front_control_hours": 4452.4,
      "lift_percent": 78,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240805-F002-30",
      "front_event_id": "2024-08-05:F002",
      "date": "2024-08-05",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-29",
        "end": "2024-08-04",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-06",
        "end": "2024-08-08",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-29",
        "end": "2024-08-12"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 17643.66,
      "post1_3_hours": 27130.05,
      "non_front_control_hours": 6697.32,
      "lift_percent": 54,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240806-F002-10",
      "front_event_id": "2024-08-06:F002",
      "date": "2024-08-06",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-30",
        "end": "2024-08-05",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-07",
        "end": "2024-08-09",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-30",
        "end": "2024-08-13"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 9759.25,
      "post1_3_hours": 6292.83,
      "non_front_control_hours": 1322.05,
      "lift_percent": -36,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240806-F002-20",
      "front_event_id": "2024-08-06:F002",
      "date": "2024-08-06",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-30",
        "end": "2024-08-05",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-07",
        "end": "2024-08-09",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-30",
        "end": "2024-08-13"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 22800.8,
      "post1_3_hours": 16856.1,
      "non_front_control_hours": 2798.74,
      "lift_percent": -26,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240806-F002-30",
      "front_event_id": "2024-08-06:F002",
      "date": "2024-08-06",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-30",
        "end": "2024-08-05",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-07",
        "end": "2024-08-09",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-30",
        "end": "2024-08-13"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 35120.71,
      "post1_3_hours": 26109.14,
      "non_front_control_hours": 4081.33,
      "lift_percent": -26,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240807-F003-10",
      "front_event_id": "2024-08-07:F003",
      "date": "2024-08-07",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-31",
        "end": "2024-08-06",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-08",
        "end": "2024-08-10",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-31",
        "end": "2024-08-14"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11226.14,
      "post1_3_hours": 6595.05,
      "non_front_control_hours": 1636.51,
      "lift_percent": -41,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240807-F003-20",
      "front_event_id": "2024-08-07:F003",
      "date": "2024-08-07",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-31",
        "end": "2024-08-06",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-08",
        "end": "2024-08-10",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-31",
        "end": "2024-08-14"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 24976.25,
      "post1_3_hours": 19405.65,
      "non_front_control_hours": 3582.29,
      "lift_percent": -22,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240807-F003-30",
      "front_event_id": "2024-08-07:F003",
      "date": "2024-08-07",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-07-31",
        "end": "2024-08-06",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-08",
        "end": "2024-08-10",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-07-31",
        "end": "2024-08-14"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 41301.78,
      "post1_3_hours": 31368.88,
      "non_front_control_hours": 5351.8,
      "lift_percent": -24,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240808-F001-10",
      "front_event_id": "2024-08-08:F001",
      "date": "2024-08-08",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-01",
        "end": "2024-08-07",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-09",
        "end": "2024-08-11",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-01",
        "end": "2024-08-15"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 21106.27,
      "post1_3_hours": 7875.26,
      "non_front_control_hours": 2549.92,
      "lift_percent": -63,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240808-F001-20",
      "front_event_id": "2024-08-08:F001",
      "date": "2024-08-08",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-01",
        "end": "2024-08-07",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-09",
        "end": "2024-08-11",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-01",
        "end": "2024-08-15"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 45141.03,
      "post1_3_hours": 16338.23,
      "non_front_control_hours": 5659.48,
      "lift_percent": -64,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240808-F001-30",
      "front_event_id": "2024-08-08:F001",
      "date": "2024-08-08",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-01",
        "end": "2024-08-07",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-09",
        "end": "2024-08-11",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-01",
        "end": "2024-08-15"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 71191.74,
      "post1_3_hours": 28562.74,
      "non_front_control_hours": 8683.55,
      "lift_percent": -60,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240809-F001-10",
      "front_event_id": "2024-08-09:F001",
      "date": "2024-08-09",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-02",
        "end": "2024-08-08",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-10",
        "end": "2024-08-12",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-02",
        "end": "2024-08-16"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 16371.32,
      "post1_3_hours": 7625.47,
      "non_front_control_hours": 2033.03,
      "lift_percent": -53,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240809-F001-20",
      "front_event_id": "2024-08-09:F001",
      "date": "2024-08-09",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-02",
        "end": "2024-08-08",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-10",
        "end": "2024-08-12",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-02",
        "end": "2024-08-16"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 39668.55,
      "post1_3_hours": 18850.32,
      "non_front_control_hours": 4246.17,
      "lift_percent": -52,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240809-F001-30",
      "front_event_id": "2024-08-09:F001",
      "date": "2024-08-09",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-02",
        "end": "2024-08-08",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-10",
        "end": "2024-08-12",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-02",
        "end": "2024-08-16"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 65222.06,
      "post1_3_hours": 30073.62,
      "non_front_control_hours": 6119.87,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240810-F003-10",
      "front_event_id": "2024-08-10:F003",
      "date": "2024-08-10",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-03",
        "end": "2024-08-09",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-11",
        "end": "2024-08-13",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-03",
        "end": "2024-08-17"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14256.58,
      "post1_3_hours": 10993.57,
      "non_front_control_hours": 1157.64,
      "lift_percent": -23,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240810-F003-20",
      "front_event_id": "2024-08-10:F003",
      "date": "2024-08-10",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-03",
        "end": "2024-08-09",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-11",
        "end": "2024-08-13",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-03",
        "end": "2024-08-17"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 30197.71,
      "post1_3_hours": 18791.94,
      "non_front_control_hours": 2463.66,
      "lift_percent": -38,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240810-F003-30",
      "front_event_id": "2024-08-10:F003",
      "date": "2024-08-10",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-03",
        "end": "2024-08-09",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-11",
        "end": "2024-08-13",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-03",
        "end": "2024-08-17"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 46044.14,
      "post1_3_hours": 25296.56,
      "non_front_control_hours": 3887.23,
      "lift_percent": -45,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240811-F002-10",
      "front_event_id": "2024-08-11:F002",
      "date": "2024-08-11",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-04",
        "end": "2024-08-10",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-12",
        "end": "2024-08-14",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-04",
        "end": "2024-08-18"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 34662.13,
      "post1_3_hours": 16651.39,
      "non_front_control_hours": 3391.41,
      "lift_percent": -52,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240811-F002-20",
      "front_event_id": "2024-08-11:F002",
      "date": "2024-08-11",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-04",
        "end": "2024-08-10",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-12",
        "end": "2024-08-14",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-04",
        "end": "2024-08-18"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 65749.18,
      "post1_3_hours": 30456.22,
      "non_front_control_hours": 6705.86,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240811-F002-30",
      "front_event_id": "2024-08-11:F002",
      "date": "2024-08-11",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-04",
        "end": "2024-08-10",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-12",
        "end": "2024-08-14",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-04",
        "end": "2024-08-18"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 101264.04,
      "post1_3_hours": 47641.17,
      "non_front_control_hours": 10469.39,
      "lift_percent": -53,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240812-F002-10",
      "front_event_id": "2024-08-12:F002",
      "date": "2024-08-12",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-05",
        "end": "2024-08-11",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-13",
        "end": "2024-08-15",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-05",
        "end": "2024-08-19"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 28107.61,
      "post1_3_hours": 14343.8,
      "non_front_control_hours": 2439.6,
      "lift_percent": -49,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240812-F002-20",
      "front_event_id": "2024-08-12:F002",
      "date": "2024-08-12",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-05",
        "end": "2024-08-11",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-13",
        "end": "2024-08-15",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-05",
        "end": "2024-08-19"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 67916.22,
      "post1_3_hours": 30889.51,
      "non_front_control_hours": 5336.09,
      "lift_percent": -55,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240812-F002-30",
      "front_event_id": "2024-08-12:F002",
      "date": "2024-08-12",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-05",
        "end": "2024-08-11",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-13",
        "end": "2024-08-15",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-05",
        "end": "2024-08-19"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 107712.82,
      "post1_3_hours": 45083.63,
      "non_front_control_hours": 8170.42,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240813-F010-10",
      "front_event_id": "2024-08-13:F010",
      "date": "2024-08-13",
      "front_id": "F010",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-06",
        "end": "2024-08-12",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-14",
        "end": "2024-08-16",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-06",
        "end": "2024-08-20"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 8737.32,
      "post1_3_hours": 4659.83,
      "non_front_control_hours": 666.71,
      "lift_percent": -47,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240813-F010-20",
      "front_event_id": "2024-08-13:F010",
      "date": "2024-08-13",
      "front_id": "F010",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-06",
        "end": "2024-08-12",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-14",
        "end": "2024-08-16",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-06",
        "end": "2024-08-20"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14330.03,
      "post1_3_hours": 7105.33,
      "non_front_control_hours": 1208.06,
      "lift_percent": -50,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240813-F010-30",
      "front_event_id": "2024-08-13:F010",
      "date": "2024-08-13",
      "front_id": "F010",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-06",
        "end": "2024-08-12",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-14",
        "end": "2024-08-16",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-06",
        "end": "2024-08-20"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 21386.03,
      "post1_3_hours": 9533.23,
      "non_front_control_hours": 1790.72,
      "lift_percent": -55,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240814-F004-10",
      "front_event_id": "2024-08-14:F004",
      "date": "2024-08-14",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-07",
        "end": "2024-08-13",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-15",
        "end": "2024-08-17",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-07",
        "end": "2024-08-21"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 11939.4,
      "post1_3_hours": 5041.85,
      "non_front_control_hours": 1452.2,
      "lift_percent": -58,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240814-F004-20",
      "front_event_id": "2024-08-14:F004",
      "date": "2024-08-14",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-07",
        "end": "2024-08-13",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-15",
        "end": "2024-08-17",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-07",
        "end": "2024-08-21"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 25472.69,
      "post1_3_hours": 10175.73,
      "non_front_control_hours": 3195.65,
      "lift_percent": -60,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240814-F004-30",
      "front_event_id": "2024-08-14:F004",
      "date": "2024-08-14",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-07",
        "end": "2024-08-13",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-15",
        "end": "2024-08-17",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-07",
        "end": "2024-08-21"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 32674.76,
      "post1_3_hours": 16173.16,
      "non_front_control_hours": 4732.04,
      "lift_percent": -51,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240815-F006-10",
      "front_event_id": "2024-08-15:F006",
      "date": "2024-08-15",
      "front_id": "F006",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-08",
        "end": "2024-08-14",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-16",
        "end": "2024-08-18",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-08",
        "end": "2024-08-22"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 15561.64,
      "post1_3_hours": 7951.33,
      "non_front_control_hours": 923.79,
      "lift_percent": -49,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240815-F006-20",
      "front_event_id": "2024-08-15:F006",
      "date": "2024-08-15",
      "front_id": "F006",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-08",
        "end": "2024-08-14",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-16",
        "end": "2024-08-18",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-08",
        "end": "2024-08-22"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 29274.1,
      "post1_3_hours": 15223.49,
      "non_front_control_hours": 2216.08,
      "lift_percent": -48,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240815-F006-30",
      "front_event_id": "2024-08-15:F006",
      "date": "2024-08-15",
      "front_id": "F006",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-08",
        "end": "2024-08-14",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-16",
        "end": "2024-08-18",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-08",
        "end": "2024-08-22"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 44824.69,
      "post1_3_hours": 20810.25,
      "non_front_control_hours": 3581.82,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240816-F001-10",
      "front_event_id": "2024-08-16:F001",
      "date": "2024-08-16",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-09",
        "end": "2024-08-15",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-17",
        "end": "2024-08-19",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-09",
        "end": "2024-08-23"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 21441.11,
      "post1_3_hours": 8772.42,
      "non_front_control_hours": 2515.47,
      "lift_percent": -59,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240816-F001-20",
      "front_event_id": "2024-08-16:F001",
      "date": "2024-08-16",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-09",
        "end": "2024-08-15",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-17",
        "end": "2024-08-19",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-09",
        "end": "2024-08-23"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 47573.38,
      "post1_3_hours": 19703.03,
      "non_front_control_hours": 5065.63,
      "lift_percent": -59,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240816-F001-30",
      "front_event_id": "2024-08-16:F001",
      "date": "2024-08-16",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-09",
        "end": "2024-08-15",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-17",
        "end": "2024-08-19",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-09",
        "end": "2024-08-23"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 62130.23,
      "post1_3_hours": 28299.31,
      "non_front_control_hours": 7500.32,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240817-F003-10",
      "front_event_id": "2024-08-17:F003",
      "date": "2024-08-17",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-10",
        "end": "2024-08-16",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-18",
        "end": "2024-08-20",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-10",
        "end": "2024-08-24"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 17511.36,
      "post1_3_hours": 7861.42,
      "non_front_control_hours": 990.8,
      "lift_percent": -55,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240817-F003-20",
      "front_event_id": "2024-08-17:F003",
      "date": "2024-08-17",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-10",
        "end": "2024-08-16",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-18",
        "end": "2024-08-20",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-10",
        "end": "2024-08-24"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 45217.99,
      "post1_3_hours": 16214.71,
      "non_front_control_hours": 2107.34,
      "lift_percent": -64,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240817-F003-30",
      "front_event_id": "2024-08-17:F003",
      "date": "2024-08-17",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-10",
        "end": "2024-08-16",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-18",
        "end": "2024-08-20",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-10",
        "end": "2024-08-24"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 67416.03,
      "post1_3_hours": 22841.31,
      "non_front_control_hours": 3224.23,
      "lift_percent": -66,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240818-F003-10",
      "front_event_id": "2024-08-18:F003",
      "date": "2024-08-18",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-11",
        "end": "2024-08-17",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-19",
        "end": "2024-08-21",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-11",
        "end": "2024-08-25"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 20424.7,
      "post1_3_hours": 4738.54,
      "non_front_control_hours": 1340.45,
      "lift_percent": -77,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240818-F003-20",
      "front_event_id": "2024-08-18:F003",
      "date": "2024-08-18",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-11",
        "end": "2024-08-17",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-19",
        "end": "2024-08-21",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-11",
        "end": "2024-08-25"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 42908.57,
      "post1_3_hours": 9573.9,
      "non_front_control_hours": 2786.19,
      "lift_percent": -78,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240818-F003-30",
      "front_event_id": "2024-08-18:F003",
      "date": "2024-08-18",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-11",
        "end": "2024-08-17",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-19",
        "end": "2024-08-21",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-11",
        "end": "2024-08-25"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 68067.98,
      "post1_3_hours": 15013.79,
      "non_front_control_hours": 4371.77,
      "lift_percent": -78,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240819-F002-10",
      "front_event_id": "2024-08-19:F002",
      "date": "2024-08-19",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-12",
        "end": "2024-08-18",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-20",
        "end": "2024-08-22",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-12",
        "end": "2024-08-26"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 29824.75,
      "post1_3_hours": 3918.78,
      "non_front_control_hours": 1239.25,
      "lift_percent": -87,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240819-F002-20",
      "front_event_id": "2024-08-19:F002",
      "date": "2024-08-19",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-12",
        "end": "2024-08-18",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-20",
        "end": "2024-08-22",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-12",
        "end": "2024-08-26"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 52129.63,
      "post1_3_hours": 9529.14,
      "non_front_control_hours": 2387.25,
      "lift_percent": -82,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240819-F002-30",
      "front_event_id": "2024-08-19:F002",
      "date": "2024-08-19",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-12",
        "end": "2024-08-18",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-20",
        "end": "2024-08-22",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-12",
        "end": "2024-08-26"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 74459.08,
      "post1_3_hours": 15970.28,
      "non_front_control_hours": 3837.08,
      "lift_percent": -79,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240820-F004-10",
      "front_event_id": "2024-08-20:F004",
      "date": "2024-08-20",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-13",
        "end": "2024-08-19",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-21",
        "end": "2024-08-23",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-13",
        "end": "2024-08-27"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 21252.79,
      "post1_3_hours": 4202.31,
      "non_front_control_hours": 1057.47,
      "lift_percent": -80,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240820-F004-20",
      "front_event_id": "2024-08-20:F004",
      "date": "2024-08-20",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-13",
        "end": "2024-08-19",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-21",
        "end": "2024-08-23",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-13",
        "end": "2024-08-27"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 44087.14,
      "post1_3_hours": 10983.94,
      "non_front_control_hours": 2338.96,
      "lift_percent": -75,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240820-F004-30",
      "front_event_id": "2024-08-20:F004",
      "date": "2024-08-20",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-13",
        "end": "2024-08-19",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-21",
        "end": "2024-08-23",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-13",
        "end": "2024-08-27"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 62378,
      "post1_3_hours": 17172.23,
      "non_front_control_hours": 3654.55,
      "lift_percent": -72,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240821-F002-10",
      "front_event_id": "2024-08-21:F002",
      "date": "2024-08-21",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-14",
        "end": "2024-08-20",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-22",
        "end": "2024-08-24",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-14",
        "end": "2024-08-28"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 30666.83,
      "post1_3_hours": 15576.22,
      "non_front_control_hours": 1528,
      "lift_percent": -49,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240821-F002-20",
      "front_event_id": "2024-08-21:F002",
      "date": "2024-08-21",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-14",
        "end": "2024-08-20",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-22",
        "end": "2024-08-24",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-14",
        "end": "2024-08-28"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 61161.31,
      "post1_3_hours": 24278.22,
      "non_front_control_hours": 3054.31,
      "lift_percent": -60,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240821-F002-30",
      "front_event_id": "2024-08-21:F002",
      "date": "2024-08-21",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-14",
        "end": "2024-08-20",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-22",
        "end": "2024-08-24",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-14",
        "end": "2024-08-28"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 81966.75,
      "post1_3_hours": 32245.17,
      "non_front_control_hours": 4326.15,
      "lift_percent": -61,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240822-F005-10",
      "front_event_id": "2024-08-22:F005",
      "date": "2024-08-22",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-15",
        "end": "2024-08-21",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-23",
        "end": "2024-08-25",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-15",
        "end": "2024-08-29"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 17422.57,
      "post1_3_hours": 12689.98,
      "non_front_control_hours": 1597.86,
      "lift_percent": -27,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240822-F005-20",
      "front_event_id": "2024-08-22:F005",
      "date": "2024-08-22",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-15",
        "end": "2024-08-21",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-23",
        "end": "2024-08-25",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-15",
        "end": "2024-08-29"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 29676.54,
      "post1_3_hours": 21429.81,
      "non_front_control_hours": 3040.95,
      "lift_percent": -28,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240822-F005-30",
      "front_event_id": "2024-08-22:F005",
      "date": "2024-08-22",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-15",
        "end": "2024-08-21",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-23",
        "end": "2024-08-25",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-15",
        "end": "2024-08-29"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 39359.69,
      "post1_3_hours": 26849.6,
      "non_front_control_hours": 4360.25,
      "lift_percent": -32,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240823-F004-10",
      "front_event_id": "2024-08-23:F004",
      "date": "2024-08-23",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-16",
        "end": "2024-08-22",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-24",
        "end": "2024-08-26",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-16",
        "end": "2024-08-30"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14940,
      "post1_3_hours": 11287.9,
      "non_front_control_hours": 1311.93,
      "lift_percent": -24,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240823-F004-20",
      "front_event_id": "2024-08-23:F004",
      "date": "2024-08-23",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-16",
        "end": "2024-08-22",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-24",
        "end": "2024-08-26",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-16",
        "end": "2024-08-30"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 31368.52,
      "post1_3_hours": 22674.99,
      "non_front_control_hours": 2624.41,
      "lift_percent": -28,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240823-F004-30",
      "front_event_id": "2024-08-23:F004",
      "date": "2024-08-23",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-16",
        "end": "2024-08-22",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-24",
        "end": "2024-08-26",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-16",
        "end": "2024-08-30"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 52955.47,
      "post1_3_hours": 32699.02,
      "non_front_control_hours": 4000.42,
      "lift_percent": -38,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240824-F002-10",
      "front_event_id": "2024-08-24:F002",
      "date": "2024-08-24",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-17",
        "end": "2024-08-23",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-25",
        "end": "2024-08-27",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-17",
        "end": "2024-08-31"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 16457.21,
      "post1_3_hours": 4289.39,
      "non_front_control_hours": 2102.02,
      "lift_percent": -74,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240824-F002-20",
      "front_event_id": "2024-08-24:F002",
      "date": "2024-08-24",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-17",
        "end": "2024-08-23",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-25",
        "end": "2024-08-27",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-17",
        "end": "2024-08-31"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 37545.32,
      "post1_3_hours": 11065.2,
      "non_front_control_hours": 4412.47,
      "lift_percent": -71,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240824-F002-30",
      "front_event_id": "2024-08-24:F002",
      "date": "2024-08-24",
      "front_id": "F002",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-17",
        "end": "2024-08-23",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-25",
        "end": "2024-08-27",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-17",
        "end": "2024-08-31"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 61505.58,
      "post1_3_hours": 18763.07,
      "non_front_control_hours": 7017.35,
      "lift_percent": -69,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240825-F003-10",
      "front_event_id": "2024-08-25:F003",
      "date": "2024-08-25",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-18",
        "end": "2024-08-24",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-26",
        "end": "2024-08-28",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-18",
        "end": "2024-09-01"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 5838.03,
      "post1_3_hours": 8248.26,
      "non_front_control_hours": 1201.08,
      "lift_percent": 41,
      "enhanced_flag": true,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "响应增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240825-F003-20",
      "front_event_id": "2024-08-25:F003",
      "date": "2024-08-25",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-18",
        "end": "2024-08-24",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-26",
        "end": "2024-08-28",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-18",
        "end": "2024-09-01"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 12874.02,
      "post1_3_hours": 14555.2,
      "non_front_control_hours": 2359.07,
      "lift_percent": 13,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240825-F003-30",
      "front_event_id": "2024-08-25:F003",
      "date": "2024-08-25",
      "front_id": "F003",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-18",
        "end": "2024-08-24",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-26",
        "end": "2024-08-28",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-18",
        "end": "2024-09-01"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 19476.23,
      "post1_3_hours": 20797.01,
      "non_front_control_hours": 3562.64,
      "lift_percent": 7,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240826-F005-10",
      "front_event_id": "2024-08-26:F005",
      "date": "2024-08-26",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-19",
        "end": "2024-08-25",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-27",
        "end": "2024-08-29",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-19",
        "end": "2024-09-02"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 7636.32,
      "post1_3_hours": 4298.12,
      "non_front_control_hours": 1057.93,
      "lift_percent": -44,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240826-F005-20",
      "front_event_id": "2024-08-26:F005",
      "date": "2024-08-26",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-19",
        "end": "2024-08-25",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-27",
        "end": "2024-08-29",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-19",
        "end": "2024-09-02"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 18479.76,
      "post1_3_hours": 11698.9,
      "non_front_control_hours": 2508.16,
      "lift_percent": -37,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240826-F005-30",
      "front_event_id": "2024-08-26:F005",
      "date": "2024-08-26",
      "front_id": "F005",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-19",
        "end": "2024-08-25",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-27",
        "end": "2024-08-29",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-19",
        "end": "2024-09-02"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 29689.76,
      "post1_3_hours": 20434.36,
      "non_front_control_hours": 4219.68,
      "lift_percent": -31,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240827-F001-10",
      "front_event_id": "2024-08-27:F001",
      "date": "2024-08-27",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-20",
        "end": "2024-08-26",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-28",
        "end": "2024-08-30",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-20",
        "end": "2024-09-03"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 12839.59,
      "post1_3_hours": 9107.88,
      "non_front_control_hours": 2412.12,
      "lift_percent": -29,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240827-F001-20",
      "front_event_id": "2024-08-27:F001",
      "date": "2024-08-27",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-20",
        "end": "2024-08-26",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-28",
        "end": "2024-08-30",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-20",
        "end": "2024-09-03"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 28363.72,
      "post1_3_hours": 19356.8,
      "non_front_control_hours": 5093.62,
      "lift_percent": -32,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240827-F001-30",
      "front_event_id": "2024-08-27:F001",
      "date": "2024-08-27",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-20",
        "end": "2024-08-26",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-28",
        "end": "2024-08-30",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-20",
        "end": "2024-09-03"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 43374.57,
      "post1_3_hours": 27627.54,
      "non_front_control_hours": 8138.51,
      "lift_percent": -36,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240828-F007-10",
      "front_event_id": "2024-08-28:F007",
      "date": "2024-08-28",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-21",
        "end": "2024-08-27",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-29",
        "end": "2024-08-31",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-21",
        "end": "2024-09-04"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 22134.4,
      "post1_3_hours": 9842.44,
      "non_front_control_hours": 2259.9,
      "lift_percent": -56,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240828-F007-20",
      "front_event_id": "2024-08-28:F007",
      "date": "2024-08-28",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-21",
        "end": "2024-08-27",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-29",
        "end": "2024-08-31",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-21",
        "end": "2024-09-04"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 33179.13,
      "post1_3_hours": 14517.28,
      "non_front_control_hours": 4003.55,
      "lift_percent": -56,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240828-F007-30",
      "front_event_id": "2024-08-28:F007",
      "date": "2024-08-28",
      "front_id": "F007",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-21",
        "end": "2024-08-27",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-29",
        "end": "2024-08-31",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-21",
        "end": "2024-09-04"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 42495.12,
      "post1_3_hours": 19045.19,
      "non_front_control_hours": 5749.6,
      "lift_percent": -55,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240829-F004-10",
      "front_event_id": "2024-08-29:F004",
      "date": "2024-08-29",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-22",
        "end": "2024-08-28",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-30",
        "end": "2024-09-01",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-22",
        "end": "2024-09-05"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 10914.49,
      "post1_3_hours": 6153.96,
      "non_front_control_hours": 1463.99,
      "lift_percent": -44,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240829-F004-20",
      "front_event_id": "2024-08-29:F004",
      "date": "2024-08-29",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-22",
        "end": "2024-08-28",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-30",
        "end": "2024-09-01",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-22",
        "end": "2024-09-05"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 24245.1,
      "post1_3_hours": 11207.05,
      "non_front_control_hours": 3130.81,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240829-F004-30",
      "front_event_id": "2024-08-29:F004",
      "date": "2024-08-29",
      "front_id": "F004",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-22",
        "end": "2024-08-28",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-30",
        "end": "2024-09-01",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-22",
        "end": "2024-09-05"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 41726.55,
      "post1_3_hours": 19329.77,
      "non_front_control_hours": 5041.57,
      "lift_percent": -54,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240830-F001-10",
      "front_event_id": "2024-08-30:F001",
      "date": "2024-08-30",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-23",
        "end": "2024-08-29",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-31",
        "end": "2024-09-02",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-23",
        "end": "2024-09-06"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 14818.27,
      "post1_3_hours": 6624.84,
      "non_front_control_hours": 2177.07,
      "lift_percent": -55,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240830-F001-20",
      "front_event_id": "2024-08-30:F001",
      "date": "2024-08-30",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-23",
        "end": "2024-08-29",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-31",
        "end": "2024-09-02",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-23",
        "end": "2024-09-06"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 32146.45,
      "post1_3_hours": 12612.73,
      "non_front_control_hours": 4843.55,
      "lift_percent": -61,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240830-F001-30",
      "front_event_id": "2024-08-30:F001",
      "date": "2024-08-30",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-23",
        "end": "2024-08-29",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-08-31",
        "end": "2024-09-02",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-23",
        "end": "2024-09-06"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 51260.69,
      "post1_3_hours": 19393.42,
      "non_front_control_hours": 6978.21,
      "lift_percent": -62,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240831-F001-10",
      "front_event_id": "2024-08-31:F001",
      "date": "2024-08-31",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 10,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-24",
        "end": "2024-08-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-09-01",
        "end": "2024-09-03",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-24",
        "end": "2024-09-07"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 18944.56,
      "post1_3_hours": 6829.99,
      "non_front_control_hours": 2431.29,
      "lift_percent": -64,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240831-F001-20",
      "front_event_id": "2024-08-31:F001",
      "date": "2024-08-31",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 20,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-24",
        "end": "2024-08-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-09-01",
        "end": "2024-09-03",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-24",
        "end": "2024-09-07"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 39686.05,
      "post1_3_hours": 12036.27,
      "non_front_control_hours": 4859.47,
      "lift_percent": -70,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    },
    {
      "response_id": "FR-20240831-F001-30",
      "front_event_id": "2024-08-31:F001",
      "date": "2024-08-31",
      "front_id": "F001",
      "front_id_scope": "local_day",
      "buffer_km": 30,
      "pre_window": {
        "relative_days": [
          -7,
          -1
        ],
        "start": "2024-08-24",
        "end": "2024-08-30",
        "value_field": "pre7_hours"
      },
      "post_window": {
        "relative_days": [
          1,
          3
        ],
        "start": "2024-09-01",
        "end": "2024-09-03",
        "value_field": "post1_3_hours"
      },
      "exploratory_window": {
        "relative_days": [
          -7,
          7
        ],
        "start": "2024-08-24",
        "end": "2024-09-07"
      },
      "control": {
        "min_distance_km": 50,
        "area_ratio": 1,
        "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
      },
      "pre7_hours": 59952.81,
      "post1_3_hours": 19622.04,
      "non_front_control_hours": 7324.23,
      "lift_percent": -67,
      "enhanced_flag": false,
      "status": "available",
      "coverage_status": "available",
      "evidence_label": "无明显增强",
      "note": "Generated from authorized apparent fishing effort sample."
    }
  ],
  "by_date": {
    "2024-07-01": {
      "status": "available",
      "date": "2024-07-01",
      "by_range": {
        "10": {
          "response_id": "FR-20240701-F012-10",
          "front_event_id": "2024-07-01:F012",
          "date": "2024-07-01",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-24",
            "end": "2024-06-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-02",
            "end": "2024-07-04",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-24",
            "end": "2024-07-08"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7364.87,
          "post1_3_hours": 3181.59,
          "non_front_control_hours": 109.32,
          "lift_percent": -57,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240701-F012-20",
          "front_event_id": "2024-07-01:F012",
          "date": "2024-07-01",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-24",
            "end": "2024-06-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-02",
            "end": "2024-07-04",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-24",
            "end": "2024-07-08"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7710.51,
          "post1_3_hours": 3237.95,
          "non_front_control_hours": 164.02,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240701-F012-30",
          "front_event_id": "2024-07-01:F012",
          "date": "2024-07-01",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-24",
            "end": "2024-06-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-02",
            "end": "2024-07-04",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-24",
            "end": "2024-07-08"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7834.82,
          "post1_3_hours": 3352.3,
          "non_front_control_hours": 246.09,
          "lift_percent": -57,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-02": {
      "status": "available",
      "date": "2024-07-02",
      "by_range": {
        "10": {
          "response_id": "FR-20240702-F007-10",
          "front_event_id": "2024-07-02:F007",
          "date": "2024-07-02",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-25",
            "end": "2024-07-01",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-03",
            "end": "2024-07-05",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-25",
            "end": "2024-07-09"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7441.64,
          "post1_3_hours": 5294.22,
          "non_front_control_hours": 93.01,
          "lift_percent": -29,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240702-F007-20",
          "front_event_id": "2024-07-02:F007",
          "date": "2024-07-02",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-25",
            "end": "2024-07-01",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-03",
            "end": "2024-07-05",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-25",
            "end": "2024-07-09"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 9116.58,
          "post1_3_hours": 6695.44,
          "non_front_control_hours": 225.89,
          "lift_percent": -27,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240702-F007-30",
          "front_event_id": "2024-07-02:F007",
          "date": "2024-07-02",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-25",
            "end": "2024-07-01",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-03",
            "end": "2024-07-05",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-25",
            "end": "2024-07-09"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 13127.75,
          "post1_3_hours": 9345.06,
          "non_front_control_hours": 265.64,
          "lift_percent": -29,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-03": {
      "status": "available",
      "date": "2024-07-03",
      "by_range": {
        "10": {
          "response_id": "FR-20240703-F003-10",
          "front_event_id": "2024-07-03:F003",
          "date": "2024-07-03",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-26",
            "end": "2024-07-02",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-04",
            "end": "2024-07-06",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-26",
            "end": "2024-07-10"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 2819.65,
          "post1_3_hours": 1196.56,
          "non_front_control_hours": 457.07,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240703-F003-20",
          "front_event_id": "2024-07-03:F003",
          "date": "2024-07-03",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-26",
            "end": "2024-07-02",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-04",
            "end": "2024-07-06",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-26",
            "end": "2024-07-10"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 6136.78,
          "post1_3_hours": 2665.25,
          "non_front_control_hours": 932.32,
          "lift_percent": -57,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240703-F003-30",
          "front_event_id": "2024-07-03:F003",
          "date": "2024-07-03",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-26",
            "end": "2024-07-02",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-04",
            "end": "2024-07-06",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-26",
            "end": "2024-07-10"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 9687.04,
          "post1_3_hours": 5086.48,
          "non_front_control_hours": 1443.85,
          "lift_percent": -47,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-04": {
      "status": "available",
      "date": "2024-07-04",
      "by_range": {
        "10": {
          "response_id": "FR-20240704-F002-10",
          "front_event_id": "2024-07-04:F002",
          "date": "2024-07-04",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-27",
            "end": "2024-07-03",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-05",
            "end": "2024-07-07",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-27",
            "end": "2024-07-11"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 2432.43,
          "post1_3_hours": 1026.27,
          "non_front_control_hours": 657.05,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240704-F002-20",
          "front_event_id": "2024-07-04:F002",
          "date": "2024-07-04",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-27",
            "end": "2024-07-03",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-05",
            "end": "2024-07-07",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-27",
            "end": "2024-07-11"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 6840.33,
          "post1_3_hours": 3596.39,
          "non_front_control_hours": 1314.17,
          "lift_percent": -47,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240704-F002-30",
          "front_event_id": "2024-07-04:F002",
          "date": "2024-07-04",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-27",
            "end": "2024-07-03",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-05",
            "end": "2024-07-07",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-27",
            "end": "2024-07-11"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10335.15,
          "post1_3_hours": 5798,
          "non_front_control_hours": 1918.69,
          "lift_percent": -44,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-05": {
      "status": "available",
      "date": "2024-07-05",
      "by_range": {
        "10": {
          "response_id": "FR-20240705-F011-10",
          "front_event_id": "2024-07-05:F011",
          "date": "2024-07-05",
          "front_id": "F011",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-28",
            "end": "2024-07-04",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-06",
            "end": "2024-07-08",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-28",
            "end": "2024-07-12"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 8003.05,
          "post1_3_hours": 6058.75,
          "non_front_control_hours": 160.45,
          "lift_percent": -24,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240705-F011-20",
          "front_event_id": "2024-07-05:F011",
          "date": "2024-07-05",
          "front_id": "F011",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-28",
            "end": "2024-07-04",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-06",
            "end": "2024-07-08",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-28",
            "end": "2024-07-12"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 16522.05,
          "post1_3_hours": 11607,
          "non_front_control_hours": 291.74,
          "lift_percent": -30,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240705-F011-30",
          "front_event_id": "2024-07-05:F011",
          "date": "2024-07-05",
          "front_id": "F011",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-28",
            "end": "2024-07-04",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-06",
            "end": "2024-07-08",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-28",
            "end": "2024-07-12"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 21364.88,
          "post1_3_hours": 14159.51,
          "non_front_control_hours": 379.44,
          "lift_percent": -34,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-06": {
      "status": "available",
      "date": "2024-07-06",
      "by_range": {
        "10": {
          "response_id": "FR-20240706-F001-10",
          "front_event_id": "2024-07-06:F001",
          "date": "2024-07-06",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-29",
            "end": "2024-07-05",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-07",
            "end": "2024-07-09",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-29",
            "end": "2024-07-13"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 5256.36,
          "post1_3_hours": 4860.4,
          "non_front_control_hours": 352.38,
          "lift_percent": -8,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240706-F001-20",
          "front_event_id": "2024-07-06:F001",
          "date": "2024-07-06",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-29",
            "end": "2024-07-05",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-07",
            "end": "2024-07-09",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-29",
            "end": "2024-07-13"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11222.39,
          "post1_3_hours": 7561.54,
          "non_front_control_hours": 664.15,
          "lift_percent": -33,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240706-F001-30",
          "front_event_id": "2024-07-06:F001",
          "date": "2024-07-06",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-29",
            "end": "2024-07-05",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-07",
            "end": "2024-07-09",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-29",
            "end": "2024-07-13"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 15261.43,
          "post1_3_hours": 9386.35,
          "non_front_control_hours": 955.49,
          "lift_percent": -38,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-07": {
      "status": "available",
      "date": "2024-07-07",
      "by_range": {
        "10": {
          "response_id": "FR-20240707-F005-10",
          "front_event_id": "2024-07-07:F005",
          "date": "2024-07-07",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-30",
            "end": "2024-07-06",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-08",
            "end": "2024-07-10",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-30",
            "end": "2024-07-14"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 1248.59,
          "post1_3_hours": 2072.2,
          "non_front_control_hours": 81.69,
          "lift_percent": 66,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240707-F005-20",
          "front_event_id": "2024-07-07:F005",
          "date": "2024-07-07",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-30",
            "end": "2024-07-06",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-08",
            "end": "2024-07-10",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-30",
            "end": "2024-07-14"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10732.02,
          "post1_3_hours": 8416.73,
          "non_front_control_hours": 183.78,
          "lift_percent": -22,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240707-F005-30",
          "front_event_id": "2024-07-07:F005",
          "date": "2024-07-07",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-06-30",
            "end": "2024-07-06",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-08",
            "end": "2024-07-10",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-06-30",
            "end": "2024-07-14"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11142.77,
          "post1_3_hours": 8686.53,
          "non_front_control_hours": 234.78,
          "lift_percent": -22,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-08": {
      "status": "available",
      "date": "2024-07-08",
      "by_range": {
        "10": {
          "response_id": "FR-20240708-F012-10",
          "front_event_id": "2024-07-08:F012",
          "date": "2024-07-08",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-01",
            "end": "2024-07-07",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-09",
            "end": "2024-07-11",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-01",
            "end": "2024-07-15"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 563.96,
          "post1_3_hours": 345.61,
          "non_front_control_hours": 133.5,
          "lift_percent": -39,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240708-F012-20",
          "front_event_id": "2024-07-08:F012",
          "date": "2024-07-08",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-01",
            "end": "2024-07-07",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-09",
            "end": "2024-07-11",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-01",
            "end": "2024-07-15"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 19963.67,
          "post1_3_hours": 10155.01,
          "non_front_control_hours": 324.16,
          "lift_percent": -49,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240708-F012-30",
          "front_event_id": "2024-07-08:F012",
          "date": "2024-07-08",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-01",
            "end": "2024-07-07",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-09",
            "end": "2024-07-11",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-01",
            "end": "2024-07-15"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 20708.76,
          "post1_3_hours": 10321.17,
          "non_front_control_hours": 362.36,
          "lift_percent": -50,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-09": {
      "status": "available",
      "date": "2024-07-09",
      "by_range": {
        "10": {
          "response_id": "FR-20240709-F014-10",
          "front_event_id": "2024-07-09:F014",
          "date": "2024-07-09",
          "front_id": "F014",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-02",
            "end": "2024-07-08",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-10",
            "end": "2024-07-12",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-02",
            "end": "2024-07-16"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10559.99,
          "post1_3_hours": 5222.7,
          "non_front_control_hours": 77.42,
          "lift_percent": -51,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240709-F014-20",
          "front_event_id": "2024-07-09:F014",
          "date": "2024-07-09",
          "front_id": "F014",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-02",
            "end": "2024-07-08",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-10",
            "end": "2024-07-12",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-02",
            "end": "2024-07-16"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 16566.24,
          "post1_3_hours": 7715.87,
          "non_front_control_hours": 146.19,
          "lift_percent": -53,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240709-F014-30",
          "front_event_id": "2024-07-09:F014",
          "date": "2024-07-09",
          "front_id": "F014",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-02",
            "end": "2024-07-08",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-10",
            "end": "2024-07-12",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-02",
            "end": "2024-07-16"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 22079.1,
          "post1_3_hours": 10539.24,
          "non_front_control_hours": 189.12,
          "lift_percent": -52,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-10": {
      "status": "available",
      "date": "2024-07-10",
      "by_range": {
        "10": {
          "response_id": "FR-20240710-F012-10",
          "front_event_id": "2024-07-10:F012",
          "date": "2024-07-10",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-03",
            "end": "2024-07-09",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-11",
            "end": "2024-07-13",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-03",
            "end": "2024-07-17"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 1440.7,
          "post1_3_hours": 625.59,
          "non_front_control_hours": 101.07,
          "lift_percent": -57,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240710-F012-20",
          "front_event_id": "2024-07-10:F012",
          "date": "2024-07-10",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-03",
            "end": "2024-07-09",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-11",
            "end": "2024-07-13",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-03",
            "end": "2024-07-17"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 23978.53,
          "post1_3_hours": 9727.3,
          "non_front_control_hours": 230.92,
          "lift_percent": -59,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240710-F012-30",
          "front_event_id": "2024-07-10:F012",
          "date": "2024-07-10",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-03",
            "end": "2024-07-09",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-11",
            "end": "2024-07-13",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-03",
            "end": "2024-07-17"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 29774.49,
          "post1_3_hours": 13548.09,
          "non_front_control_hours": 331.95,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-11": {
      "status": "available",
      "date": "2024-07-11",
      "by_range": {
        "10": {
          "response_id": "FR-20240711-F008-10",
          "front_event_id": "2024-07-11:F008",
          "date": "2024-07-11",
          "front_id": "F008",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-04",
            "end": "2024-07-10",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-12",
            "end": "2024-07-14",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-04",
            "end": "2024-07-18"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 13803.04,
          "post1_3_hours": 4633.14,
          "non_front_control_hours": 143.87,
          "lift_percent": -66,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240711-F008-20",
          "front_event_id": "2024-07-11:F008",
          "date": "2024-07-11",
          "front_id": "F008",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-04",
            "end": "2024-07-10",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-12",
            "end": "2024-07-14",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-04",
            "end": "2024-07-18"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 26121.67,
          "post1_3_hours": 10167.83,
          "non_front_control_hours": 261.6,
          "lift_percent": -61,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240711-F008-30",
          "front_event_id": "2024-07-11:F008",
          "date": "2024-07-11",
          "front_id": "F008",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-04",
            "end": "2024-07-10",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-12",
            "end": "2024-07-14",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-04",
            "end": "2024-07-18"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 31400.68,
          "post1_3_hours": 14333.57,
          "non_front_control_hours": 314.1,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-12": {
      "status": "available",
      "date": "2024-07-12",
      "by_range": {
        "10": {
          "response_id": "FR-20240712-F002-10",
          "front_event_id": "2024-07-12:F002",
          "date": "2024-07-12",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-05",
            "end": "2024-07-11",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-13",
            "end": "2024-07-15",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-05",
            "end": "2024-07-19"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 2140.44,
          "post1_3_hours": 2356.72,
          "non_front_control_hours": 234.68,
          "lift_percent": 10,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240712-F002-20",
          "front_event_id": "2024-07-12:F002",
          "date": "2024-07-12",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-05",
            "end": "2024-07-11",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-13",
            "end": "2024-07-15",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-05",
            "end": "2024-07-19"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11163.52,
          "post1_3_hours": 7869.02,
          "non_front_control_hours": 523.5,
          "lift_percent": -30,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240712-F002-30",
          "front_event_id": "2024-07-12:F002",
          "date": "2024-07-12",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-05",
            "end": "2024-07-11",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-13",
            "end": "2024-07-15",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-05",
            "end": "2024-07-19"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 18532.25,
          "post1_3_hours": 11899.43,
          "non_front_control_hours": 794.15,
          "lift_percent": -36,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-13": {
      "status": "available",
      "date": "2024-07-13",
      "by_range": {
        "10": {
          "response_id": "FR-20240713-F001-10",
          "front_event_id": "2024-07-13:F001",
          "date": "2024-07-13",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-06",
            "end": "2024-07-12",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-14",
            "end": "2024-07-16",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-06",
            "end": "2024-07-20"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14158.94,
          "post1_3_hours": 7767.09,
          "non_front_control_hours": 390.47,
          "lift_percent": -45,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240713-F001-20",
          "front_event_id": "2024-07-13:F001",
          "date": "2024-07-13",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-06",
            "end": "2024-07-12",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-14",
            "end": "2024-07-16",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-06",
            "end": "2024-07-20"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 15202.64,
          "post1_3_hours": 8300.04,
          "non_front_control_hours": 644.26,
          "lift_percent": -45,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240713-F001-30",
          "front_event_id": "2024-07-13:F001",
          "date": "2024-07-13",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-06",
            "end": "2024-07-12",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-14",
            "end": "2024-07-16",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-06",
            "end": "2024-07-20"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 24349.44,
          "post1_3_hours": 12329.48,
          "non_front_control_hours": 916.96,
          "lift_percent": -49,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-14": {
      "status": "available",
      "date": "2024-07-14",
      "by_range": {
        "10": {
          "response_id": "FR-20240714-F001-10",
          "front_event_id": "2024-07-14:F001",
          "date": "2024-07-14",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-07",
            "end": "2024-07-13",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-15",
            "end": "2024-07-17",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-07",
            "end": "2024-07-21"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7748.27,
          "post1_3_hours": 4054.87,
          "non_front_control_hours": 739.29,
          "lift_percent": -48,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240714-F001-20",
          "front_event_id": "2024-07-14:F001",
          "date": "2024-07-14",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-07",
            "end": "2024-07-13",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-15",
            "end": "2024-07-17",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-07",
            "end": "2024-07-21"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 22222.45,
          "post1_3_hours": 9857.23,
          "non_front_control_hours": 1551.49,
          "lift_percent": -56,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240714-F001-30",
          "front_event_id": "2024-07-14:F001",
          "date": "2024-07-14",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-07",
            "end": "2024-07-13",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-15",
            "end": "2024-07-17",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-07",
            "end": "2024-07-21"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 26062.31,
          "post1_3_hours": 11137.9,
          "non_front_control_hours": 1996.69,
          "lift_percent": -57,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-15": {
      "status": "available",
      "date": "2024-07-15",
      "by_range": {
        "10": {
          "response_id": "FR-20240715-F012-10",
          "front_event_id": "2024-07-15:F012",
          "date": "2024-07-15",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-08",
            "end": "2024-07-14",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-16",
            "end": "2024-07-18",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-08",
            "end": "2024-07-22"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11684.4,
          "post1_3_hours": 3903.27,
          "non_front_control_hours": 103.61,
          "lift_percent": -67,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240715-F012-20",
          "front_event_id": "2024-07-15:F012",
          "date": "2024-07-15",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-08",
            "end": "2024-07-14",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-16",
            "end": "2024-07-18",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-08",
            "end": "2024-07-22"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 22099.42,
          "post1_3_hours": 8740.34,
          "non_front_control_hours": 269.27,
          "lift_percent": -60,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240715-F012-30",
          "front_event_id": "2024-07-15:F012",
          "date": "2024-07-15",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-08",
            "end": "2024-07-14",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-16",
            "end": "2024-07-18",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-08",
            "end": "2024-07-22"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 24771.07,
          "post1_3_hours": 10329.12,
          "non_front_control_hours": 352.32,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-16": {
      "status": "available",
      "date": "2024-07-16",
      "by_range": {
        "10": {
          "response_id": "FR-20240716-F012-10",
          "front_event_id": "2024-07-16:F012",
          "date": "2024-07-16",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-09",
            "end": "2024-07-15",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-17",
            "end": "2024-07-19",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-09",
            "end": "2024-07-23"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11173.24,
          "post1_3_hours": 3635.15,
          "non_front_control_hours": 190.06,
          "lift_percent": -67,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240716-F012-20",
          "front_event_id": "2024-07-16:F012",
          "date": "2024-07-16",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-09",
            "end": "2024-07-15",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-17",
            "end": "2024-07-19",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-09",
            "end": "2024-07-23"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 22936.48,
          "post1_3_hours": 9152.24,
          "non_front_control_hours": 403.84,
          "lift_percent": -60,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240716-F012-30",
          "front_event_id": "2024-07-16:F012",
          "date": "2024-07-16",
          "front_id": "F012",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-09",
            "end": "2024-07-15",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-17",
            "end": "2024-07-19",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-09",
            "end": "2024-07-23"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 30108.4,
          "post1_3_hours": 12611.38,
          "non_front_control_hours": 523,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-17": {
      "status": "available",
      "date": "2024-07-17",
      "by_range": {
        "10": {
          "response_id": "FR-20240717-F009-10",
          "front_event_id": "2024-07-17:F009",
          "date": "2024-07-17",
          "front_id": "F009",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-10",
            "end": "2024-07-16",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-18",
            "end": "2024-07-20",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-10",
            "end": "2024-07-24"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11110.39,
          "post1_3_hours": 4347.11,
          "non_front_control_hours": 152.33,
          "lift_percent": -61,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240717-F009-20",
          "front_event_id": "2024-07-17:F009",
          "date": "2024-07-17",
          "front_id": "F009",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-10",
            "end": "2024-07-16",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-18",
            "end": "2024-07-20",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-10",
            "end": "2024-07-24"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 21254.62,
          "post1_3_hours": 9060.41,
          "non_front_control_hours": 274.12,
          "lift_percent": -57,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240717-F009-30",
          "front_event_id": "2024-07-17:F009",
          "date": "2024-07-17",
          "front_id": "F009",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-10",
            "end": "2024-07-16",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-18",
            "end": "2024-07-20",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-10",
            "end": "2024-07-24"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 31706.29,
          "post1_3_hours": 12810.18,
          "non_front_control_hours": 396.37,
          "lift_percent": -60,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-18": {
      "status": "available",
      "date": "2024-07-18",
      "by_range": {
        "10": {
          "response_id": "FR-20240718-F009-10",
          "front_event_id": "2024-07-18:F009",
          "date": "2024-07-18",
          "front_id": "F009",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-11",
            "end": "2024-07-17",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-19",
            "end": "2024-07-21",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-11",
            "end": "2024-07-25"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 5513.72,
          "post1_3_hours": 1057.9,
          "non_front_control_hours": 721.11,
          "lift_percent": -81,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240718-F009-20",
          "front_event_id": "2024-07-18:F009",
          "date": "2024-07-18",
          "front_id": "F009",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-11",
            "end": "2024-07-17",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-19",
            "end": "2024-07-21",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-11",
            "end": "2024-07-25"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14673.93,
          "post1_3_hours": 4004.87,
          "non_front_control_hours": 1251.76,
          "lift_percent": -73,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240718-F009-30",
          "front_event_id": "2024-07-18:F009",
          "date": "2024-07-18",
          "front_id": "F009",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-11",
            "end": "2024-07-17",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-19",
            "end": "2024-07-21",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-11",
            "end": "2024-07-25"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 24761.05,
          "post1_3_hours": 6423.31,
          "non_front_control_hours": 1857.88,
          "lift_percent": -74,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-19": {
      "status": "available",
      "date": "2024-07-19",
      "by_range": {
        "10": {
          "response_id": "FR-20240719-F007-10",
          "front_event_id": "2024-07-19:F007",
          "date": "2024-07-19",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-12",
            "end": "2024-07-18",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-20",
            "end": "2024-07-22",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-12",
            "end": "2024-07-26"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 3927.26,
          "post1_3_hours": 2009.17,
          "non_front_control_hours": 1034.4,
          "lift_percent": -49,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240719-F007-20",
          "front_event_id": "2024-07-19:F007",
          "date": "2024-07-19",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-12",
            "end": "2024-07-18",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-20",
            "end": "2024-07-22",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-12",
            "end": "2024-07-26"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7574.87,
          "post1_3_hours": 4169.14,
          "non_front_control_hours": 2099.77,
          "lift_percent": -45,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240719-F007-30",
          "front_event_id": "2024-07-19:F007",
          "date": "2024-07-19",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-12",
            "end": "2024-07-18",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-20",
            "end": "2024-07-22",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-12",
            "end": "2024-07-26"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11482.09,
          "post1_3_hours": 6532.43,
          "non_front_control_hours": 3164.85,
          "lift_percent": -43,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-20": {
      "status": "available",
      "date": "2024-07-20",
      "by_range": {
        "10": {
          "response_id": "FR-20240720-F004-10",
          "front_event_id": "2024-07-20:F004",
          "date": "2024-07-20",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-13",
            "end": "2024-07-19",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-21",
            "end": "2024-07-23",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-13",
            "end": "2024-07-27"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7191.06,
          "post1_3_hours": 1768.93,
          "non_front_control_hours": 368.02,
          "lift_percent": -75,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240720-F004-20",
          "front_event_id": "2024-07-20:F004",
          "date": "2024-07-20",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-13",
            "end": "2024-07-19",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-21",
            "end": "2024-07-23",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-13",
            "end": "2024-07-27"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 13763.17,
          "post1_3_hours": 3258.61,
          "non_front_control_hours": 671.18,
          "lift_percent": -76,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240720-F004-30",
          "front_event_id": "2024-07-20:F004",
          "date": "2024-07-20",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-13",
            "end": "2024-07-19",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-21",
            "end": "2024-07-23",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-13",
            "end": "2024-07-27"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14867.59,
          "post1_3_hours": 3583.51,
          "non_front_control_hours": 909.2,
          "lift_percent": -76,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-21": {
      "status": "available",
      "date": "2024-07-21",
      "by_range": {
        "10": {
          "response_id": "FR-20240721-F001-10",
          "front_event_id": "2024-07-21:F001",
          "date": "2024-07-21",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-14",
            "end": "2024-07-20",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-22",
            "end": "2024-07-24",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-14",
            "end": "2024-07-28"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 5836.56,
          "post1_3_hours": 1492.85,
          "non_front_control_hours": 320.98,
          "lift_percent": -74,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240721-F001-20",
          "front_event_id": "2024-07-21:F001",
          "date": "2024-07-21",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-14",
            "end": "2024-07-20",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-22",
            "end": "2024-07-24",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-14",
            "end": "2024-07-28"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 12865.74,
          "post1_3_hours": 2810.73,
          "non_front_control_hours": 662.38,
          "lift_percent": -78,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240721-F001-30",
          "front_event_id": "2024-07-21:F001",
          "date": "2024-07-21",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-14",
            "end": "2024-07-20",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-22",
            "end": "2024-07-24",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-14",
            "end": "2024-07-28"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14682.92,
          "post1_3_hours": 3288.98,
          "non_front_control_hours": 982.98,
          "lift_percent": -78,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-22": {
      "status": "available",
      "date": "2024-07-22",
      "by_range": {
        "10": {
          "response_id": "FR-20240722-F001-10",
          "front_event_id": "2024-07-22:F001",
          "date": "2024-07-22",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-15",
            "end": "2024-07-21",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-23",
            "end": "2024-07-25",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-15",
            "end": "2024-07-29"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10158.02,
          "post1_3_hours": 3287.72,
          "non_front_control_hours": 397.87,
          "lift_percent": -68,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240722-F001-20",
          "front_event_id": "2024-07-22:F001",
          "date": "2024-07-22",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-15",
            "end": "2024-07-21",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-23",
            "end": "2024-07-25",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-15",
            "end": "2024-07-29"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10631.68,
          "post1_3_hours": 3437,
          "non_front_control_hours": 765.17,
          "lift_percent": -68,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240722-F001-30",
          "front_event_id": "2024-07-22:F001",
          "date": "2024-07-22",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-15",
            "end": "2024-07-21",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-23",
            "end": "2024-07-25",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-15",
            "end": "2024-07-29"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11193.38,
          "post1_3_hours": 3462.87,
          "non_front_control_hours": 1071.55,
          "lift_percent": -69,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-23": {
      "status": "available",
      "date": "2024-07-23",
      "by_range": {
        "10": {
          "response_id": "FR-20240723-F007-10",
          "front_event_id": "2024-07-23:F007",
          "date": "2024-07-23",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-16",
            "end": "2024-07-22",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-24",
            "end": "2024-07-26",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-16",
            "end": "2024-07-30"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 5509.41,
          "post1_3_hours": 1732.28,
          "non_front_control_hours": 310.29,
          "lift_percent": -69,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240723-F007-20",
          "front_event_id": "2024-07-23:F007",
          "date": "2024-07-23",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-16",
            "end": "2024-07-22",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-24",
            "end": "2024-07-26",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-16",
            "end": "2024-07-30"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7159.4,
          "post1_3_hours": 1743.55,
          "non_front_control_hours": 621.06,
          "lift_percent": -76,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240723-F007-30",
          "front_event_id": "2024-07-23:F007",
          "date": "2024-07-23",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-16",
            "end": "2024-07-22",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-24",
            "end": "2024-07-26",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-16",
            "end": "2024-07-30"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11193.75,
          "post1_3_hours": 2247.98,
          "non_front_control_hours": 790.51,
          "lift_percent": -80,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-24": {
      "status": "available",
      "date": "2024-07-24",
      "by_range": {
        "10": {
          "response_id": "FR-20240724-F011-10",
          "front_event_id": "2024-07-24:F011",
          "date": "2024-07-24",
          "front_id": "F011",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-17",
            "end": "2024-07-23",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-25",
            "end": "2024-07-27",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-17",
            "end": "2024-07-31"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 2342.39,
          "post1_3_hours": 2468.23,
          "non_front_control_hours": 38.17,
          "lift_percent": 5,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240724-F011-20",
          "front_event_id": "2024-07-24:F011",
          "date": "2024-07-24",
          "front_id": "F011",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-17",
            "end": "2024-07-23",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-25",
            "end": "2024-07-27",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-17",
            "end": "2024-07-31"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11551.97,
          "post1_3_hours": 9952.45,
          "non_front_control_hours": 89.07,
          "lift_percent": -14,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240724-F011-30",
          "front_event_id": "2024-07-24:F011",
          "date": "2024-07-24",
          "front_id": "F011",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-17",
            "end": "2024-07-23",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-25",
            "end": "2024-07-27",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-17",
            "end": "2024-07-31"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11899.33,
          "post1_3_hours": 10210.75,
          "non_front_control_hours": 114.52,
          "lift_percent": -14,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-25": {
      "status": "available",
      "date": "2024-07-25",
      "by_range": {
        "10": {
          "response_id": "FR-20240725-F002-10",
          "front_event_id": "2024-07-25:F002",
          "date": "2024-07-25",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-18",
            "end": "2024-07-24",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-26",
            "end": "2024-07-28",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-18",
            "end": "2024-08-01"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10383.02,
          "post1_3_hours": 7512,
          "non_front_control_hours": 135.36,
          "lift_percent": -28,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240725-F002-20",
          "front_event_id": "2024-07-25:F002",
          "date": "2024-07-25",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-18",
            "end": "2024-07-24",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-26",
            "end": "2024-07-28",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-18",
            "end": "2024-08-01"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10691.05,
          "post1_3_hours": 7547.92,
          "non_front_control_hours": 168.72,
          "lift_percent": -29,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240725-F002-30",
          "front_event_id": "2024-07-25:F002",
          "date": "2024-07-25",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-18",
            "end": "2024-07-24",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-26",
            "end": "2024-07-28",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-18",
            "end": "2024-08-01"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11313.02,
          "post1_3_hours": 8285.84,
          "non_front_control_hours": 303.65,
          "lift_percent": -27,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-26": {
      "status": "available",
      "date": "2024-07-26",
      "by_range": {
        "10": {
          "response_id": "FR-20240726-F001-10",
          "front_event_id": "2024-07-26:F001",
          "date": "2024-07-26",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-19",
            "end": "2024-07-25",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-27",
            "end": "2024-07-29",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-19",
            "end": "2024-08-02"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 4884.45,
          "post1_3_hours": 1409.06,
          "non_front_control_hours": 108.47,
          "lift_percent": -71,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240726-F001-20",
          "front_event_id": "2024-07-26:F001",
          "date": "2024-07-26",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-19",
            "end": "2024-07-25",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-27",
            "end": "2024-07-29",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-19",
            "end": "2024-08-02"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 6139.41,
          "post1_3_hours": 2326.84,
          "non_front_control_hours": 215.34,
          "lift_percent": -62,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240726-F001-30",
          "front_event_id": "2024-07-26:F001",
          "date": "2024-07-26",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-19",
            "end": "2024-07-25",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-27",
            "end": "2024-07-29",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-19",
            "end": "2024-08-02"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 9302.47,
          "post1_3_hours": 3581.82,
          "non_front_control_hours": 648.5,
          "lift_percent": -61,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-27": {
      "status": "available",
      "date": "2024-07-27",
      "by_range": {
        "10": {
          "response_id": "FR-20240727-F004-10",
          "front_event_id": "2024-07-27:F004",
          "date": "2024-07-27",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-20",
            "end": "2024-07-26",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-28",
            "end": "2024-07-30",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-20",
            "end": "2024-08-03"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 4414.91,
          "post1_3_hours": 1644.16,
          "non_front_control_hours": 20.95,
          "lift_percent": -63,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240727-F004-20",
          "front_event_id": "2024-07-27:F004",
          "date": "2024-07-27",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-20",
            "end": "2024-07-26",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-28",
            "end": "2024-07-30",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-20",
            "end": "2024-08-03"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 6835.36,
          "post1_3_hours": 3608.38,
          "non_front_control_hours": 83.88,
          "lift_percent": -47,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240727-F004-30",
          "front_event_id": "2024-07-27:F004",
          "date": "2024-07-27",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-20",
            "end": "2024-07-26",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-28",
            "end": "2024-07-30",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-20",
            "end": "2024-08-03"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7594.28,
          "post1_3_hours": 4922.57,
          "non_front_control_hours": 167.71,
          "lift_percent": -35,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-28": {
      "status": "available",
      "date": "2024-07-28",
      "by_range": {
        "10": {
          "response_id": "FR-20240728-F004-10",
          "front_event_id": "2024-07-28:F004",
          "date": "2024-07-28",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-21",
            "end": "2024-07-27",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-29",
            "end": "2024-07-31",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-21",
            "end": "2024-08-04"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 3714.33,
          "post1_3_hours": 1195.92,
          "non_front_control_hours": 442.52,
          "lift_percent": -68,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240728-F004-20",
          "front_event_id": "2024-07-28:F004",
          "date": "2024-07-28",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-21",
            "end": "2024-07-27",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-29",
            "end": "2024-07-31",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-21",
            "end": "2024-08-04"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 4374.64,
          "post1_3_hours": 2527.89,
          "non_front_control_hours": 783.41,
          "lift_percent": -42,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240728-F004-30",
          "front_event_id": "2024-07-28:F004",
          "date": "2024-07-28",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-21",
            "end": "2024-07-27",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-29",
            "end": "2024-07-31",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-21",
            "end": "2024-08-04"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 6361.39,
          "post1_3_hours": 5574.66,
          "non_front_control_hours": 1191.99,
          "lift_percent": -12,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-29": {
      "status": "available",
      "date": "2024-07-29",
      "by_range": {
        "10": {
          "response_id": "FR-20240729-F003-10",
          "front_event_id": "2024-07-29:F003",
          "date": "2024-07-29",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-22",
            "end": "2024-07-28",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-30",
            "end": "2024-08-01",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-22",
            "end": "2024-08-05"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 157.12,
          "post1_3_hours": 1642.76,
          "non_front_control_hours": 130.14,
          "lift_percent": 946,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240729-F003-20",
          "front_event_id": "2024-07-29:F003",
          "date": "2024-07-29",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-22",
            "end": "2024-07-28",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-30",
            "end": "2024-08-01",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-22",
            "end": "2024-08-05"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 1894.27,
          "post1_3_hours": 3931.29,
          "non_front_control_hours": 372,
          "lift_percent": 108,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240729-F003-30",
          "front_event_id": "2024-07-29:F003",
          "date": "2024-07-29",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-22",
            "end": "2024-07-28",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-30",
            "end": "2024-08-01",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-22",
            "end": "2024-08-05"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 6401.36,
          "post1_3_hours": 6501.55,
          "non_front_control_hours": 483.3,
          "lift_percent": 2,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-30": {
      "status": "available",
      "date": "2024-07-30",
      "by_range": {
        "10": {
          "response_id": "FR-20240730-F001-10",
          "front_event_id": "2024-07-30:F001",
          "date": "2024-07-30",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-23",
            "end": "2024-07-29",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-31",
            "end": "2024-08-02",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-23",
            "end": "2024-08-06"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 721.53,
          "post1_3_hours": 4792.03,
          "non_front_control_hours": 238.85,
          "lift_percent": 564,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240730-F001-20",
          "front_event_id": "2024-07-30:F001",
          "date": "2024-07-30",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-23",
            "end": "2024-07-29",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-31",
            "end": "2024-08-02",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-23",
            "end": "2024-08-06"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 3977.13,
          "post1_3_hours": 10514.1,
          "non_front_control_hours": 448.08,
          "lift_percent": 164,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240730-F001-30",
          "front_event_id": "2024-07-30:F001",
          "date": "2024-07-30",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-23",
            "end": "2024-07-29",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-07-31",
            "end": "2024-08-02",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-23",
            "end": "2024-08-06"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 9968.22,
          "post1_3_hours": 18831.38,
          "non_front_control_hours": 807.86,
          "lift_percent": 89,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-07-31": {
      "status": "available",
      "date": "2024-07-31",
      "by_range": {
        "10": {
          "response_id": "FR-20240731-F001-10",
          "front_event_id": "2024-07-31:F001",
          "date": "2024-07-31",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-24",
            "end": "2024-07-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-01",
            "end": "2024-08-03",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-24",
            "end": "2024-08-07"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 934.76,
          "post1_3_hours": 10387.64,
          "non_front_control_hours": 644.17,
          "lift_percent": 1011,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240731-F001-20",
          "front_event_id": "2024-07-31:F001",
          "date": "2024-07-31",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-24",
            "end": "2024-07-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-01",
            "end": "2024-08-03",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-24",
            "end": "2024-08-07"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 1515.45,
          "post1_3_hours": 21551.62,
          "non_front_control_hours": 1119.27,
          "lift_percent": 1322,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240731-F001-30",
          "front_event_id": "2024-07-31:F001",
          "date": "2024-07-31",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-24",
            "end": "2024-07-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-01",
            "end": "2024-08-03",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-24",
            "end": "2024-08-07"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 1938.51,
          "post1_3_hours": 27882.2,
          "non_front_control_hours": 1364.43,
          "lift_percent": 1338,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-01": {
      "status": "available",
      "date": "2024-08-01",
      "by_range": {
        "10": {
          "response_id": "FR-20240801-F003-10",
          "front_event_id": "2024-08-01:F003",
          "date": "2024-08-01",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-25",
            "end": "2024-07-31",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-02",
            "end": "2024-08-04",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-25",
            "end": "2024-08-08"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 188.57,
          "post1_3_hours": 3491.39,
          "non_front_control_hours": 639.21,
          "lift_percent": 1752,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240801-F003-20",
          "front_event_id": "2024-08-01:F003",
          "date": "2024-08-01",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-25",
            "end": "2024-07-31",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-02",
            "end": "2024-08-04",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-25",
            "end": "2024-08-08"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 444.57,
          "post1_3_hours": 8583.06,
          "non_front_control_hours": 1390.82,
          "lift_percent": 1831,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240801-F003-30",
          "front_event_id": "2024-08-01:F003",
          "date": "2024-08-01",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-25",
            "end": "2024-07-31",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-02",
            "end": "2024-08-04",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-25",
            "end": "2024-08-08"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 4558.07,
          "post1_3_hours": 15595.01,
          "non_front_control_hours": 2104.37,
          "lift_percent": 242,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-02": {
      "status": "available",
      "date": "2024-08-02",
      "by_range": {
        "10": {
          "response_id": "FR-20240802-F005-10",
          "front_event_id": "2024-08-02:F005",
          "date": "2024-08-02",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-26",
            "end": "2024-08-01",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-03",
            "end": "2024-08-05",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-26",
            "end": "2024-08-09"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 995.03,
          "post1_3_hours": 4714.71,
          "non_front_control_hours": 1410.15,
          "lift_percent": 374,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240802-F005-20",
          "front_event_id": "2024-08-02:F005",
          "date": "2024-08-02",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-26",
            "end": "2024-08-01",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-03",
            "end": "2024-08-05",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-26",
            "end": "2024-08-09"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 2764.24,
          "post1_3_hours": 11987.91,
          "non_front_control_hours": 2556.22,
          "lift_percent": 334,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240802-F005-30",
          "front_event_id": "2024-08-02:F005",
          "date": "2024-08-02",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-26",
            "end": "2024-08-01",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-03",
            "end": "2024-08-05",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-26",
            "end": "2024-08-09"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 3440.52,
          "post1_3_hours": 20638.2,
          "non_front_control_hours": 3605.79,
          "lift_percent": 500,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-03": {
      "status": "available",
      "date": "2024-08-03",
      "by_range": {
        "10": {
          "response_id": "FR-20240803-F003-10",
          "front_event_id": "2024-08-03:F003",
          "date": "2024-08-03",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-27",
            "end": "2024-08-02",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-04",
            "end": "2024-08-06",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-27",
            "end": "2024-08-10"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 1676.8,
          "post1_3_hours": 9055.18,
          "non_front_control_hours": 2150.16,
          "lift_percent": 440,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240803-F003-20",
          "front_event_id": "2024-08-03:F003",
          "date": "2024-08-03",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-27",
            "end": "2024-08-02",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-04",
            "end": "2024-08-06",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-27",
            "end": "2024-08-10"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 3790.3,
          "post1_3_hours": 19166.16,
          "non_front_control_hours": 4347.52,
          "lift_percent": 406,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240803-F003-30",
          "front_event_id": "2024-08-03:F003",
          "date": "2024-08-03",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-27",
            "end": "2024-08-02",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-04",
            "end": "2024-08-06",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-27",
            "end": "2024-08-10"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7126.72,
          "post1_3_hours": 26688.06,
          "non_front_control_hours": 6581.95,
          "lift_percent": 274,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-04": {
      "status": "available",
      "date": "2024-08-04",
      "by_range": {
        "10": {
          "response_id": "FR-20240804-F003-10",
          "front_event_id": "2024-08-04:F003",
          "date": "2024-08-04",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-28",
            "end": "2024-08-03",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-05",
            "end": "2024-08-07",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-28",
            "end": "2024-08-11"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 2650.61,
          "post1_3_hours": 7313.02,
          "non_front_control_hours": 2714.78,
          "lift_percent": 176,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240804-F003-20",
          "front_event_id": "2024-08-04:F003",
          "date": "2024-08-04",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-28",
            "end": "2024-08-03",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-05",
            "end": "2024-08-07",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-28",
            "end": "2024-08-11"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 5653.38,
          "post1_3_hours": 15247.38,
          "non_front_control_hours": 5129.18,
          "lift_percent": 170,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240804-F003-30",
          "front_event_id": "2024-08-04:F003",
          "date": "2024-08-04",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-28",
            "end": "2024-08-03",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-05",
            "end": "2024-08-07",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-28",
            "end": "2024-08-11"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 12987.58,
          "post1_3_hours": 24450.81,
          "non_front_control_hours": 7544.28,
          "lift_percent": 88,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-05": {
      "status": "available",
      "date": "2024-08-05",
      "by_range": {
        "10": {
          "response_id": "FR-20240805-F002-10",
          "front_event_id": "2024-08-05:F002",
          "date": "2024-08-05",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-29",
            "end": "2024-08-04",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-06",
            "end": "2024-08-08",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-29",
            "end": "2024-08-12"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 3315.93,
          "post1_3_hours": 6764.58,
          "non_front_control_hours": 2205.53,
          "lift_percent": 104,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240805-F002-20",
          "front_event_id": "2024-08-05:F002",
          "date": "2024-08-05",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-29",
            "end": "2024-08-04",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-06",
            "end": "2024-08-08",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-29",
            "end": "2024-08-12"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 9525.59,
          "post1_3_hours": 16977.78,
          "non_front_control_hours": 4452.4,
          "lift_percent": 78,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240805-F002-30",
          "front_event_id": "2024-08-05:F002",
          "date": "2024-08-05",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-29",
            "end": "2024-08-04",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-06",
            "end": "2024-08-08",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-29",
            "end": "2024-08-12"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 17643.66,
          "post1_3_hours": 27130.05,
          "non_front_control_hours": 6697.32,
          "lift_percent": 54,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-06": {
      "status": "available",
      "date": "2024-08-06",
      "by_range": {
        "10": {
          "response_id": "FR-20240806-F002-10",
          "front_event_id": "2024-08-06:F002",
          "date": "2024-08-06",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-30",
            "end": "2024-08-05",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-07",
            "end": "2024-08-09",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-30",
            "end": "2024-08-13"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 9759.25,
          "post1_3_hours": 6292.83,
          "non_front_control_hours": 1322.05,
          "lift_percent": -36,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240806-F002-20",
          "front_event_id": "2024-08-06:F002",
          "date": "2024-08-06",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-30",
            "end": "2024-08-05",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-07",
            "end": "2024-08-09",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-30",
            "end": "2024-08-13"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 22800.8,
          "post1_3_hours": 16856.1,
          "non_front_control_hours": 2798.74,
          "lift_percent": -26,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240806-F002-30",
          "front_event_id": "2024-08-06:F002",
          "date": "2024-08-06",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-30",
            "end": "2024-08-05",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-07",
            "end": "2024-08-09",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-30",
            "end": "2024-08-13"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 35120.71,
          "post1_3_hours": 26109.14,
          "non_front_control_hours": 4081.33,
          "lift_percent": -26,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-07": {
      "status": "available",
      "date": "2024-08-07",
      "by_range": {
        "10": {
          "response_id": "FR-20240807-F003-10",
          "front_event_id": "2024-08-07:F003",
          "date": "2024-08-07",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-31",
            "end": "2024-08-06",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-08",
            "end": "2024-08-10",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-31",
            "end": "2024-08-14"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11226.14,
          "post1_3_hours": 6595.05,
          "non_front_control_hours": 1636.51,
          "lift_percent": -41,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240807-F003-20",
          "front_event_id": "2024-08-07:F003",
          "date": "2024-08-07",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-31",
            "end": "2024-08-06",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-08",
            "end": "2024-08-10",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-31",
            "end": "2024-08-14"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 24976.25,
          "post1_3_hours": 19405.65,
          "non_front_control_hours": 3582.29,
          "lift_percent": -22,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240807-F003-30",
          "front_event_id": "2024-08-07:F003",
          "date": "2024-08-07",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-07-31",
            "end": "2024-08-06",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-08",
            "end": "2024-08-10",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-07-31",
            "end": "2024-08-14"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 41301.78,
          "post1_3_hours": 31368.88,
          "non_front_control_hours": 5351.8,
          "lift_percent": -24,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-08": {
      "status": "available",
      "date": "2024-08-08",
      "by_range": {
        "10": {
          "response_id": "FR-20240808-F001-10",
          "front_event_id": "2024-08-08:F001",
          "date": "2024-08-08",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-01",
            "end": "2024-08-07",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-09",
            "end": "2024-08-11",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-01",
            "end": "2024-08-15"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 21106.27,
          "post1_3_hours": 7875.26,
          "non_front_control_hours": 2549.92,
          "lift_percent": -63,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240808-F001-20",
          "front_event_id": "2024-08-08:F001",
          "date": "2024-08-08",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-01",
            "end": "2024-08-07",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-09",
            "end": "2024-08-11",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-01",
            "end": "2024-08-15"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 45141.03,
          "post1_3_hours": 16338.23,
          "non_front_control_hours": 5659.48,
          "lift_percent": -64,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240808-F001-30",
          "front_event_id": "2024-08-08:F001",
          "date": "2024-08-08",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-01",
            "end": "2024-08-07",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-09",
            "end": "2024-08-11",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-01",
            "end": "2024-08-15"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 71191.74,
          "post1_3_hours": 28562.74,
          "non_front_control_hours": 8683.55,
          "lift_percent": -60,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-09": {
      "status": "available",
      "date": "2024-08-09",
      "by_range": {
        "10": {
          "response_id": "FR-20240809-F001-10",
          "front_event_id": "2024-08-09:F001",
          "date": "2024-08-09",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-02",
            "end": "2024-08-08",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-10",
            "end": "2024-08-12",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-02",
            "end": "2024-08-16"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 16371.32,
          "post1_3_hours": 7625.47,
          "non_front_control_hours": 2033.03,
          "lift_percent": -53,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240809-F001-20",
          "front_event_id": "2024-08-09:F001",
          "date": "2024-08-09",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-02",
            "end": "2024-08-08",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-10",
            "end": "2024-08-12",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-02",
            "end": "2024-08-16"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 39668.55,
          "post1_3_hours": 18850.32,
          "non_front_control_hours": 4246.17,
          "lift_percent": -52,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240809-F001-30",
          "front_event_id": "2024-08-09:F001",
          "date": "2024-08-09",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-02",
            "end": "2024-08-08",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-10",
            "end": "2024-08-12",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-02",
            "end": "2024-08-16"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 65222.06,
          "post1_3_hours": 30073.62,
          "non_front_control_hours": 6119.87,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-10": {
      "status": "available",
      "date": "2024-08-10",
      "by_range": {
        "10": {
          "response_id": "FR-20240810-F003-10",
          "front_event_id": "2024-08-10:F003",
          "date": "2024-08-10",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-03",
            "end": "2024-08-09",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-11",
            "end": "2024-08-13",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-03",
            "end": "2024-08-17"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14256.58,
          "post1_3_hours": 10993.57,
          "non_front_control_hours": 1157.64,
          "lift_percent": -23,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240810-F003-20",
          "front_event_id": "2024-08-10:F003",
          "date": "2024-08-10",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-03",
            "end": "2024-08-09",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-11",
            "end": "2024-08-13",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-03",
            "end": "2024-08-17"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 30197.71,
          "post1_3_hours": 18791.94,
          "non_front_control_hours": 2463.66,
          "lift_percent": -38,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240810-F003-30",
          "front_event_id": "2024-08-10:F003",
          "date": "2024-08-10",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-03",
            "end": "2024-08-09",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-11",
            "end": "2024-08-13",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-03",
            "end": "2024-08-17"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 46044.14,
          "post1_3_hours": 25296.56,
          "non_front_control_hours": 3887.23,
          "lift_percent": -45,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-11": {
      "status": "available",
      "date": "2024-08-11",
      "by_range": {
        "10": {
          "response_id": "FR-20240811-F002-10",
          "front_event_id": "2024-08-11:F002",
          "date": "2024-08-11",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-04",
            "end": "2024-08-10",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-12",
            "end": "2024-08-14",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-04",
            "end": "2024-08-18"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 34662.13,
          "post1_3_hours": 16651.39,
          "non_front_control_hours": 3391.41,
          "lift_percent": -52,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240811-F002-20",
          "front_event_id": "2024-08-11:F002",
          "date": "2024-08-11",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-04",
            "end": "2024-08-10",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-12",
            "end": "2024-08-14",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-04",
            "end": "2024-08-18"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 65749.18,
          "post1_3_hours": 30456.22,
          "non_front_control_hours": 6705.86,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240811-F002-30",
          "front_event_id": "2024-08-11:F002",
          "date": "2024-08-11",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-04",
            "end": "2024-08-10",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-12",
            "end": "2024-08-14",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-04",
            "end": "2024-08-18"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 101264.04,
          "post1_3_hours": 47641.17,
          "non_front_control_hours": 10469.39,
          "lift_percent": -53,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-12": {
      "status": "available",
      "date": "2024-08-12",
      "by_range": {
        "10": {
          "response_id": "FR-20240812-F002-10",
          "front_event_id": "2024-08-12:F002",
          "date": "2024-08-12",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-05",
            "end": "2024-08-11",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-13",
            "end": "2024-08-15",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-05",
            "end": "2024-08-19"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 28107.61,
          "post1_3_hours": 14343.8,
          "non_front_control_hours": 2439.6,
          "lift_percent": -49,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240812-F002-20",
          "front_event_id": "2024-08-12:F002",
          "date": "2024-08-12",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-05",
            "end": "2024-08-11",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-13",
            "end": "2024-08-15",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-05",
            "end": "2024-08-19"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 67916.22,
          "post1_3_hours": 30889.51,
          "non_front_control_hours": 5336.09,
          "lift_percent": -55,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240812-F002-30",
          "front_event_id": "2024-08-12:F002",
          "date": "2024-08-12",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-05",
            "end": "2024-08-11",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-13",
            "end": "2024-08-15",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-05",
            "end": "2024-08-19"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 107712.82,
          "post1_3_hours": 45083.63,
          "non_front_control_hours": 8170.42,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-13": {
      "status": "available",
      "date": "2024-08-13",
      "by_range": {
        "10": {
          "response_id": "FR-20240813-F010-10",
          "front_event_id": "2024-08-13:F010",
          "date": "2024-08-13",
          "front_id": "F010",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-06",
            "end": "2024-08-12",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-14",
            "end": "2024-08-16",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-06",
            "end": "2024-08-20"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 8737.32,
          "post1_3_hours": 4659.83,
          "non_front_control_hours": 666.71,
          "lift_percent": -47,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240813-F010-20",
          "front_event_id": "2024-08-13:F010",
          "date": "2024-08-13",
          "front_id": "F010",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-06",
            "end": "2024-08-12",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-14",
            "end": "2024-08-16",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-06",
            "end": "2024-08-20"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14330.03,
          "post1_3_hours": 7105.33,
          "non_front_control_hours": 1208.06,
          "lift_percent": -50,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240813-F010-30",
          "front_event_id": "2024-08-13:F010",
          "date": "2024-08-13",
          "front_id": "F010",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-06",
            "end": "2024-08-12",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-14",
            "end": "2024-08-16",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-06",
            "end": "2024-08-20"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 21386.03,
          "post1_3_hours": 9533.23,
          "non_front_control_hours": 1790.72,
          "lift_percent": -55,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-14": {
      "status": "available",
      "date": "2024-08-14",
      "by_range": {
        "10": {
          "response_id": "FR-20240814-F004-10",
          "front_event_id": "2024-08-14:F004",
          "date": "2024-08-14",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-07",
            "end": "2024-08-13",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-15",
            "end": "2024-08-17",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-07",
            "end": "2024-08-21"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 11939.4,
          "post1_3_hours": 5041.85,
          "non_front_control_hours": 1452.2,
          "lift_percent": -58,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240814-F004-20",
          "front_event_id": "2024-08-14:F004",
          "date": "2024-08-14",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-07",
            "end": "2024-08-13",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-15",
            "end": "2024-08-17",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-07",
            "end": "2024-08-21"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 25472.69,
          "post1_3_hours": 10175.73,
          "non_front_control_hours": 3195.65,
          "lift_percent": -60,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240814-F004-30",
          "front_event_id": "2024-08-14:F004",
          "date": "2024-08-14",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-07",
            "end": "2024-08-13",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-15",
            "end": "2024-08-17",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-07",
            "end": "2024-08-21"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 32674.76,
          "post1_3_hours": 16173.16,
          "non_front_control_hours": 4732.04,
          "lift_percent": -51,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-15": {
      "status": "available",
      "date": "2024-08-15",
      "by_range": {
        "10": {
          "response_id": "FR-20240815-F006-10",
          "front_event_id": "2024-08-15:F006",
          "date": "2024-08-15",
          "front_id": "F006",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-08",
            "end": "2024-08-14",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-16",
            "end": "2024-08-18",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-08",
            "end": "2024-08-22"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 15561.64,
          "post1_3_hours": 7951.33,
          "non_front_control_hours": 923.79,
          "lift_percent": -49,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240815-F006-20",
          "front_event_id": "2024-08-15:F006",
          "date": "2024-08-15",
          "front_id": "F006",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-08",
            "end": "2024-08-14",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-16",
            "end": "2024-08-18",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-08",
            "end": "2024-08-22"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 29274.1,
          "post1_3_hours": 15223.49,
          "non_front_control_hours": 2216.08,
          "lift_percent": -48,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240815-F006-30",
          "front_event_id": "2024-08-15:F006",
          "date": "2024-08-15",
          "front_id": "F006",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-08",
            "end": "2024-08-14",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-16",
            "end": "2024-08-18",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-08",
            "end": "2024-08-22"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 44824.69,
          "post1_3_hours": 20810.25,
          "non_front_control_hours": 3581.82,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-16": {
      "status": "available",
      "date": "2024-08-16",
      "by_range": {
        "10": {
          "response_id": "FR-20240816-F001-10",
          "front_event_id": "2024-08-16:F001",
          "date": "2024-08-16",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-09",
            "end": "2024-08-15",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-17",
            "end": "2024-08-19",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-09",
            "end": "2024-08-23"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 21441.11,
          "post1_3_hours": 8772.42,
          "non_front_control_hours": 2515.47,
          "lift_percent": -59,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240816-F001-20",
          "front_event_id": "2024-08-16:F001",
          "date": "2024-08-16",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-09",
            "end": "2024-08-15",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-17",
            "end": "2024-08-19",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-09",
            "end": "2024-08-23"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 47573.38,
          "post1_3_hours": 19703.03,
          "non_front_control_hours": 5065.63,
          "lift_percent": -59,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240816-F001-30",
          "front_event_id": "2024-08-16:F001",
          "date": "2024-08-16",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-09",
            "end": "2024-08-15",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-17",
            "end": "2024-08-19",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-09",
            "end": "2024-08-23"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 62130.23,
          "post1_3_hours": 28299.31,
          "non_front_control_hours": 7500.32,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-17": {
      "status": "available",
      "date": "2024-08-17",
      "by_range": {
        "10": {
          "response_id": "FR-20240817-F003-10",
          "front_event_id": "2024-08-17:F003",
          "date": "2024-08-17",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-10",
            "end": "2024-08-16",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-18",
            "end": "2024-08-20",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-10",
            "end": "2024-08-24"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 17511.36,
          "post1_3_hours": 7861.42,
          "non_front_control_hours": 990.8,
          "lift_percent": -55,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240817-F003-20",
          "front_event_id": "2024-08-17:F003",
          "date": "2024-08-17",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-10",
            "end": "2024-08-16",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-18",
            "end": "2024-08-20",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-10",
            "end": "2024-08-24"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 45217.99,
          "post1_3_hours": 16214.71,
          "non_front_control_hours": 2107.34,
          "lift_percent": -64,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240817-F003-30",
          "front_event_id": "2024-08-17:F003",
          "date": "2024-08-17",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-10",
            "end": "2024-08-16",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-18",
            "end": "2024-08-20",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-10",
            "end": "2024-08-24"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 67416.03,
          "post1_3_hours": 22841.31,
          "non_front_control_hours": 3224.23,
          "lift_percent": -66,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-18": {
      "status": "available",
      "date": "2024-08-18",
      "by_range": {
        "10": {
          "response_id": "FR-20240818-F003-10",
          "front_event_id": "2024-08-18:F003",
          "date": "2024-08-18",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-11",
            "end": "2024-08-17",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-19",
            "end": "2024-08-21",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-11",
            "end": "2024-08-25"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 20424.7,
          "post1_3_hours": 4738.54,
          "non_front_control_hours": 1340.45,
          "lift_percent": -77,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240818-F003-20",
          "front_event_id": "2024-08-18:F003",
          "date": "2024-08-18",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-11",
            "end": "2024-08-17",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-19",
            "end": "2024-08-21",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-11",
            "end": "2024-08-25"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 42908.57,
          "post1_3_hours": 9573.9,
          "non_front_control_hours": 2786.19,
          "lift_percent": -78,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240818-F003-30",
          "front_event_id": "2024-08-18:F003",
          "date": "2024-08-18",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-11",
            "end": "2024-08-17",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-19",
            "end": "2024-08-21",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-11",
            "end": "2024-08-25"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 68067.98,
          "post1_3_hours": 15013.79,
          "non_front_control_hours": 4371.77,
          "lift_percent": -78,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-19": {
      "status": "available",
      "date": "2024-08-19",
      "by_range": {
        "10": {
          "response_id": "FR-20240819-F002-10",
          "front_event_id": "2024-08-19:F002",
          "date": "2024-08-19",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-12",
            "end": "2024-08-18",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-20",
            "end": "2024-08-22",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-12",
            "end": "2024-08-26"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 29824.75,
          "post1_3_hours": 3918.78,
          "non_front_control_hours": 1239.25,
          "lift_percent": -87,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240819-F002-20",
          "front_event_id": "2024-08-19:F002",
          "date": "2024-08-19",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-12",
            "end": "2024-08-18",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-20",
            "end": "2024-08-22",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-12",
            "end": "2024-08-26"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 52129.63,
          "post1_3_hours": 9529.14,
          "non_front_control_hours": 2387.25,
          "lift_percent": -82,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240819-F002-30",
          "front_event_id": "2024-08-19:F002",
          "date": "2024-08-19",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-12",
            "end": "2024-08-18",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-20",
            "end": "2024-08-22",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-12",
            "end": "2024-08-26"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 74459.08,
          "post1_3_hours": 15970.28,
          "non_front_control_hours": 3837.08,
          "lift_percent": -79,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-20": {
      "status": "available",
      "date": "2024-08-20",
      "by_range": {
        "10": {
          "response_id": "FR-20240820-F004-10",
          "front_event_id": "2024-08-20:F004",
          "date": "2024-08-20",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-13",
            "end": "2024-08-19",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-21",
            "end": "2024-08-23",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-13",
            "end": "2024-08-27"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 21252.79,
          "post1_3_hours": 4202.31,
          "non_front_control_hours": 1057.47,
          "lift_percent": -80,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240820-F004-20",
          "front_event_id": "2024-08-20:F004",
          "date": "2024-08-20",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-13",
            "end": "2024-08-19",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-21",
            "end": "2024-08-23",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-13",
            "end": "2024-08-27"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 44087.14,
          "post1_3_hours": 10983.94,
          "non_front_control_hours": 2338.96,
          "lift_percent": -75,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240820-F004-30",
          "front_event_id": "2024-08-20:F004",
          "date": "2024-08-20",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-13",
            "end": "2024-08-19",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-21",
            "end": "2024-08-23",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-13",
            "end": "2024-08-27"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 62378,
          "post1_3_hours": 17172.23,
          "non_front_control_hours": 3654.55,
          "lift_percent": -72,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-21": {
      "status": "available",
      "date": "2024-08-21",
      "by_range": {
        "10": {
          "response_id": "FR-20240821-F002-10",
          "front_event_id": "2024-08-21:F002",
          "date": "2024-08-21",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-14",
            "end": "2024-08-20",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-22",
            "end": "2024-08-24",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-14",
            "end": "2024-08-28"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 30666.83,
          "post1_3_hours": 15576.22,
          "non_front_control_hours": 1528,
          "lift_percent": -49,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240821-F002-20",
          "front_event_id": "2024-08-21:F002",
          "date": "2024-08-21",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-14",
            "end": "2024-08-20",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-22",
            "end": "2024-08-24",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-14",
            "end": "2024-08-28"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 61161.31,
          "post1_3_hours": 24278.22,
          "non_front_control_hours": 3054.31,
          "lift_percent": -60,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240821-F002-30",
          "front_event_id": "2024-08-21:F002",
          "date": "2024-08-21",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-14",
            "end": "2024-08-20",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-22",
            "end": "2024-08-24",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-14",
            "end": "2024-08-28"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 81966.75,
          "post1_3_hours": 32245.17,
          "non_front_control_hours": 4326.15,
          "lift_percent": -61,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-22": {
      "status": "available",
      "date": "2024-08-22",
      "by_range": {
        "10": {
          "response_id": "FR-20240822-F005-10",
          "front_event_id": "2024-08-22:F005",
          "date": "2024-08-22",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-15",
            "end": "2024-08-21",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-23",
            "end": "2024-08-25",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-15",
            "end": "2024-08-29"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 17422.57,
          "post1_3_hours": 12689.98,
          "non_front_control_hours": 1597.86,
          "lift_percent": -27,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240822-F005-20",
          "front_event_id": "2024-08-22:F005",
          "date": "2024-08-22",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-15",
            "end": "2024-08-21",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-23",
            "end": "2024-08-25",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-15",
            "end": "2024-08-29"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 29676.54,
          "post1_3_hours": 21429.81,
          "non_front_control_hours": 3040.95,
          "lift_percent": -28,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240822-F005-30",
          "front_event_id": "2024-08-22:F005",
          "date": "2024-08-22",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-15",
            "end": "2024-08-21",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-23",
            "end": "2024-08-25",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-15",
            "end": "2024-08-29"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 39359.69,
          "post1_3_hours": 26849.6,
          "non_front_control_hours": 4360.25,
          "lift_percent": -32,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-23": {
      "status": "available",
      "date": "2024-08-23",
      "by_range": {
        "10": {
          "response_id": "FR-20240823-F004-10",
          "front_event_id": "2024-08-23:F004",
          "date": "2024-08-23",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-16",
            "end": "2024-08-22",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-24",
            "end": "2024-08-26",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-16",
            "end": "2024-08-30"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14940,
          "post1_3_hours": 11287.9,
          "non_front_control_hours": 1311.93,
          "lift_percent": -24,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240823-F004-20",
          "front_event_id": "2024-08-23:F004",
          "date": "2024-08-23",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-16",
            "end": "2024-08-22",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-24",
            "end": "2024-08-26",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-16",
            "end": "2024-08-30"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 31368.52,
          "post1_3_hours": 22674.99,
          "non_front_control_hours": 2624.41,
          "lift_percent": -28,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240823-F004-30",
          "front_event_id": "2024-08-23:F004",
          "date": "2024-08-23",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-16",
            "end": "2024-08-22",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-24",
            "end": "2024-08-26",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-16",
            "end": "2024-08-30"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 52955.47,
          "post1_3_hours": 32699.02,
          "non_front_control_hours": 4000.42,
          "lift_percent": -38,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-24": {
      "status": "available",
      "date": "2024-08-24",
      "by_range": {
        "10": {
          "response_id": "FR-20240824-F002-10",
          "front_event_id": "2024-08-24:F002",
          "date": "2024-08-24",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-17",
            "end": "2024-08-23",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-25",
            "end": "2024-08-27",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-17",
            "end": "2024-08-31"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 16457.21,
          "post1_3_hours": 4289.39,
          "non_front_control_hours": 2102.02,
          "lift_percent": -74,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240824-F002-20",
          "front_event_id": "2024-08-24:F002",
          "date": "2024-08-24",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-17",
            "end": "2024-08-23",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-25",
            "end": "2024-08-27",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-17",
            "end": "2024-08-31"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 37545.32,
          "post1_3_hours": 11065.2,
          "non_front_control_hours": 4412.47,
          "lift_percent": -71,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240824-F002-30",
          "front_event_id": "2024-08-24:F002",
          "date": "2024-08-24",
          "front_id": "F002",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-17",
            "end": "2024-08-23",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-25",
            "end": "2024-08-27",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-17",
            "end": "2024-08-31"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 61505.58,
          "post1_3_hours": 18763.07,
          "non_front_control_hours": 7017.35,
          "lift_percent": -69,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-25": {
      "status": "available",
      "date": "2024-08-25",
      "by_range": {
        "10": {
          "response_id": "FR-20240825-F003-10",
          "front_event_id": "2024-08-25:F003",
          "date": "2024-08-25",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-18",
            "end": "2024-08-24",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-26",
            "end": "2024-08-28",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-18",
            "end": "2024-09-01"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 5838.03,
          "post1_3_hours": 8248.26,
          "non_front_control_hours": 1201.08,
          "lift_percent": 41,
          "enhanced_flag": true,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "响应增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240825-F003-20",
          "front_event_id": "2024-08-25:F003",
          "date": "2024-08-25",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-18",
            "end": "2024-08-24",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-26",
            "end": "2024-08-28",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-18",
            "end": "2024-09-01"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 12874.02,
          "post1_3_hours": 14555.2,
          "non_front_control_hours": 2359.07,
          "lift_percent": 13,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240825-F003-30",
          "front_event_id": "2024-08-25:F003",
          "date": "2024-08-25",
          "front_id": "F003",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-18",
            "end": "2024-08-24",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-26",
            "end": "2024-08-28",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-18",
            "end": "2024-09-01"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 19476.23,
          "post1_3_hours": 20797.01,
          "non_front_control_hours": 3562.64,
          "lift_percent": 7,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-26": {
      "status": "available",
      "date": "2024-08-26",
      "by_range": {
        "10": {
          "response_id": "FR-20240826-F005-10",
          "front_event_id": "2024-08-26:F005",
          "date": "2024-08-26",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-19",
            "end": "2024-08-25",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-27",
            "end": "2024-08-29",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-19",
            "end": "2024-09-02"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 7636.32,
          "post1_3_hours": 4298.12,
          "non_front_control_hours": 1057.93,
          "lift_percent": -44,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240826-F005-20",
          "front_event_id": "2024-08-26:F005",
          "date": "2024-08-26",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-19",
            "end": "2024-08-25",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-27",
            "end": "2024-08-29",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-19",
            "end": "2024-09-02"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 18479.76,
          "post1_3_hours": 11698.9,
          "non_front_control_hours": 2508.16,
          "lift_percent": -37,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240826-F005-30",
          "front_event_id": "2024-08-26:F005",
          "date": "2024-08-26",
          "front_id": "F005",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-19",
            "end": "2024-08-25",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-27",
            "end": "2024-08-29",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-19",
            "end": "2024-09-02"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 29689.76,
          "post1_3_hours": 20434.36,
          "non_front_control_hours": 4219.68,
          "lift_percent": -31,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-27": {
      "status": "available",
      "date": "2024-08-27",
      "by_range": {
        "10": {
          "response_id": "FR-20240827-F001-10",
          "front_event_id": "2024-08-27:F001",
          "date": "2024-08-27",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-20",
            "end": "2024-08-26",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-28",
            "end": "2024-08-30",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-20",
            "end": "2024-09-03"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 12839.59,
          "post1_3_hours": 9107.88,
          "non_front_control_hours": 2412.12,
          "lift_percent": -29,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240827-F001-20",
          "front_event_id": "2024-08-27:F001",
          "date": "2024-08-27",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-20",
            "end": "2024-08-26",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-28",
            "end": "2024-08-30",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-20",
            "end": "2024-09-03"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 28363.72,
          "post1_3_hours": 19356.8,
          "non_front_control_hours": 5093.62,
          "lift_percent": -32,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240827-F001-30",
          "front_event_id": "2024-08-27:F001",
          "date": "2024-08-27",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-20",
            "end": "2024-08-26",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-28",
            "end": "2024-08-30",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-20",
            "end": "2024-09-03"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 43374.57,
          "post1_3_hours": 27627.54,
          "non_front_control_hours": 8138.51,
          "lift_percent": -36,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-28": {
      "status": "available",
      "date": "2024-08-28",
      "by_range": {
        "10": {
          "response_id": "FR-20240828-F007-10",
          "front_event_id": "2024-08-28:F007",
          "date": "2024-08-28",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-21",
            "end": "2024-08-27",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-29",
            "end": "2024-08-31",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-21",
            "end": "2024-09-04"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 22134.4,
          "post1_3_hours": 9842.44,
          "non_front_control_hours": 2259.9,
          "lift_percent": -56,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240828-F007-20",
          "front_event_id": "2024-08-28:F007",
          "date": "2024-08-28",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-21",
            "end": "2024-08-27",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-29",
            "end": "2024-08-31",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-21",
            "end": "2024-09-04"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 33179.13,
          "post1_3_hours": 14517.28,
          "non_front_control_hours": 4003.55,
          "lift_percent": -56,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240828-F007-30",
          "front_event_id": "2024-08-28:F007",
          "date": "2024-08-28",
          "front_id": "F007",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-21",
            "end": "2024-08-27",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-29",
            "end": "2024-08-31",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-21",
            "end": "2024-09-04"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 42495.12,
          "post1_3_hours": 19045.19,
          "non_front_control_hours": 5749.6,
          "lift_percent": -55,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-29": {
      "status": "available",
      "date": "2024-08-29",
      "by_range": {
        "10": {
          "response_id": "FR-20240829-F004-10",
          "front_event_id": "2024-08-29:F004",
          "date": "2024-08-29",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-22",
            "end": "2024-08-28",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-30",
            "end": "2024-09-01",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-22",
            "end": "2024-09-05"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 10914.49,
          "post1_3_hours": 6153.96,
          "non_front_control_hours": 1463.99,
          "lift_percent": -44,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240829-F004-20",
          "front_event_id": "2024-08-29:F004",
          "date": "2024-08-29",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-22",
            "end": "2024-08-28",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-30",
            "end": "2024-09-01",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-22",
            "end": "2024-09-05"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 24245.1,
          "post1_3_hours": 11207.05,
          "non_front_control_hours": 3130.81,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240829-F004-30",
          "front_event_id": "2024-08-29:F004",
          "date": "2024-08-29",
          "front_id": "F004",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-22",
            "end": "2024-08-28",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-30",
            "end": "2024-09-01",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-22",
            "end": "2024-09-05"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 41726.55,
          "post1_3_hours": 19329.77,
          "non_front_control_hours": 5041.57,
          "lift_percent": -54,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-30": {
      "status": "available",
      "date": "2024-08-30",
      "by_range": {
        "10": {
          "response_id": "FR-20240830-F001-10",
          "front_event_id": "2024-08-30:F001",
          "date": "2024-08-30",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-23",
            "end": "2024-08-29",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-31",
            "end": "2024-09-02",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-23",
            "end": "2024-09-06"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 14818.27,
          "post1_3_hours": 6624.84,
          "non_front_control_hours": 2177.07,
          "lift_percent": -55,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240830-F001-20",
          "front_event_id": "2024-08-30:F001",
          "date": "2024-08-30",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-23",
            "end": "2024-08-29",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-31",
            "end": "2024-09-02",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-23",
            "end": "2024-09-06"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 32146.45,
          "post1_3_hours": 12612.73,
          "non_front_control_hours": 4843.55,
          "lift_percent": -61,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240830-F001-30",
          "front_event_id": "2024-08-30:F001",
          "date": "2024-08-30",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-23",
            "end": "2024-08-29",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-08-31",
            "end": "2024-09-02",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-23",
            "end": "2024-09-06"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 51260.69,
          "post1_3_hours": 19393.42,
          "non_front_control_hours": 6978.21,
          "lift_percent": -62,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    },
    "2024-08-31": {
      "status": "available",
      "date": "2024-08-31",
      "by_range": {
        "10": {
          "response_id": "FR-20240831-F001-10",
          "front_event_id": "2024-08-31:F001",
          "date": "2024-08-31",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 10,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-24",
            "end": "2024-08-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-09-01",
            "end": "2024-09-03",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-24",
            "end": "2024-09-07"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 18944.56,
          "post1_3_hours": 6829.99,
          "non_front_control_hours": 2431.29,
          "lift_percent": -64,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "20": {
          "response_id": "FR-20240831-F001-20",
          "front_event_id": "2024-08-31:F001",
          "date": "2024-08-31",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 20,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-24",
            "end": "2024-08-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-09-01",
            "end": "2024-09-03",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-24",
            "end": "2024-09-07"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 39686.05,
          "post1_3_hours": 12036.27,
          "non_front_control_hours": 4859.47,
          "lift_percent": -70,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        },
        "30": {
          "response_id": "FR-20240831-F001-30",
          "front_event_id": "2024-08-31:F001",
          "date": "2024-08-31",
          "front_id": "F001",
          "front_id_scope": "local_day",
          "buffer_km": 30,
          "pre_window": {
            "relative_days": [
              -7,
              -1
            ],
            "start": "2024-08-24",
            "end": "2024-08-30",
            "value_field": "pre7_hours"
          },
          "post_window": {
            "relative_days": [
              1,
              3
            ],
            "start": "2024-09-01",
            "end": "2024-09-03",
            "value_field": "post1_3_hours"
          },
          "exploratory_window": {
            "relative_days": [
              -7,
              7
            ],
            "start": "2024-08-24",
            "end": "2024-09-07"
          },
          "control": {
            "min_distance_km": 50,
            "area_ratio": 1,
            "sampling": "same-day cells at least 50 km away from every front line, scaled to the front-buffer area by that day's hours density"
          },
          "pre7_hours": 59952.81,
          "post1_3_hours": 19622.04,
          "non_front_control_hours": 7324.23,
          "lift_percent": -67,
          "enhanced_flag": false,
          "status": "available",
          "coverage_status": "available",
          "evidence_label": "无明显增强",
          "note": "Generated from authorized apparent fishing effort sample."
        }
      }
    }
  }
};
})();
