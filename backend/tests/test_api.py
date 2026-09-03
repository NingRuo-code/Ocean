from pathlib import Path

import numpy as np
import xarray as xr
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["offline"] is True
    ai_response = client.get("/api/ai/health")
    assert ai_response.status_code == 200
    ai_payload = ai_response.json()
    assert ai_payload["provider"]
    assert ai_payload["offline"] is True
    assert ai_payload["checked_at"]


def test_empty_catalog_is_explicit(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "raw_data_dir", tmp_path)
    response = client.get("/api/catalog")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is False
    assert payload["file_count"] == 0
    assert payload["message"]


def _write_front_file(path: Path, values: np.ndarray, observation_date: str) -> None:
    dataset = xr.Dataset(
        data_vars={
            "front": (("lat", "lon", "time"), values[:, :, np.newaxis].astype(np.int8)),
        },
        coords={
            "lat": np.array([30.0, 31.0], dtype=np.float32),
            "lon": np.array([120.0, 121.0], dtype=np.float32),
            "time": np.array([np.datetime64(observation_date)], dtype="datetime64[ns]"),
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_netcdf(path, engine="h5netcdf")


def _write_sst_file(path: Path) -> None:
    dataset = xr.Dataset(
        data_vars={
            "analysed_sst": (
                ("time", "latitude", "longitude"),
                np.array(
                    [
                        [[300.0, 300.5], [301.0, 301.5]],
                        [[302.0, 302.5], [303.0, 303.5]],
                        [[304.0, 304.5], [305.0, 305.5]],
                    ],
                    dtype=np.float32,
                ),
            ),
        },
        coords={
            "time": np.array(
                [
                    np.datetime64("2024-08-05"),
                    np.datetime64("2024-08-06"),
                    np.datetime64("2025-08-05"),
                ],
                dtype="datetime64[ns]",
            ),
            "latitude": np.array([30.0, 31.0], dtype=np.float32),
            "longitude": np.array([120.0, 121.0], dtype=np.float32),
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_netcdf(path, engine="h5netcdf")


def _write_intensity_file(path: Path, values: np.ndarray, observation_date: str) -> None:
    dataset = xr.Dataset(
        data_vars={
            "front_intensity": (("lat", "lon", "time"), values[:, :, np.newaxis].astype(np.float32)),
        },
        coords={
            "lat": np.array([30.0, 31.0], dtype=np.float32),
            "lon": np.array([120.0, 121.0], dtype=np.float32),
            "time": np.array([np.datetime64(observation_date)], dtype="datetime64[ns]"),
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_netcdf(path, engine="h5netcdf")


def test_history_endpoint_builds_cached_statistics(tmp_path: Path, monkeypatch) -> None:
    raw_root = tmp_path / "raw"
    cache_root = tmp_path / "cache"
    monkeypatch.setattr(settings, "raw_data_dir", raw_root)
    monkeypatch.setattr(settings, "cache_dir", cache_root)

    _write_front_file(
        raw_root / "front" / "2024" / "front_location20240805.nc",
        np.array([[ -10,   0], [-20,  20]], dtype=np.int8),
        "2024-08-05",
    )
    _write_front_file(
        raw_root / "front" / "2024" / "front_location20240806.nc",
        np.array([[0, 0], [0, 0]], dtype=np.int8),
        "2024-08-06",
    )
    _write_front_file(
        raw_root / "front" / "2025" / "front_location20250805.nc",
        np.array([[0, 0], [0, 0]], dtype=np.int8),
        "2025-08-05",
    )
    _write_sst_file(raw_root / "sst" / "2024" / "sst_20240805_20250805.nc")
    _write_intensity_file(
        raw_root / "front_intensity" / "2024" / "front_intensity20240805.nc",
        np.array([[0.1, 0.0], [0.4, 0.8]], dtype=np.float32),
        "2024-08-05",
    )
    _write_sst_file(raw_root / "_duplicates_backup" / "sst" / "2024" / "sst_backup_20240805.nc")

    catalog_response = client.get("/api/catalog")
    assert catalog_response.status_code == 200
    assert catalog_response.json()["file_count"] == 5

    analysis_response = client.get(
        "/api/analysis/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert analysis_response.status_code == 200
    analysis_payload = analysis_response.json()
    assert analysis_payload["sst"]["range_celsius"] == 1.5
    assert analysis_payload["sst"]["gradient_c_per_km"] > 0
    assert analysis_payload["sst"]["max_gradient_c_per_km"] >= analysis_payload["sst"]["gradient_c_per_km"]
    assert analysis_payload["intensity"]["available"] == "是"
    assert analysis_payload["intensity"]["active_pixel_count"] == 3
    assert analysis_payload["intensity"]["mean"] == 0.325
    assert analysis_payload["quality"]["geojson_sst_sample_step"] == 1
    assert analysis_payload["quality"]["geojson_front_sample_step"] == 1
    assert analysis_payload["rasters"]["sst"]["format"] == "image/png"
    assert analysis_payload["rasters"]["sst"]["width"] == 2
    assert analysis_payload["rasters"]["sst"]["height"] == 2
    assert analysis_payload["layers"]["sst"]["features"][0]["geometry"]["type"] == "Polygon"
    assert analysis_payload["layers"]["front_band"]["features"][0]["geometry"]["type"] == "Polygon"
    assert analysis_payload["layers"]["cold_side"]["features"][0]["geometry"]["type"] == "Polygon"
    assert analysis_payload["layers"]["front_object_centroids"]["features"][0]["properties"]["front_id"] == "20240805-F001"
    assert analysis_payload["layers"]["front_object_bboxes"]["features"][0]["geometry"]["type"] == "Polygon"
    assert len(analysis_payload["layers"]["front_intensity"]["features"]) == 3

    raster_response = client.get(
        "/api/analysis/2024-08-05/raster?longitude=120.5&latitude=30.5&radius_deg=1&kind=combined"
    )
    assert raster_response.status_code == 200
    assert raster_response.headers["content-type"] == "image/png"
    assert raster_response.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert raster_response.headers["x-raster-cache"] == "miss"
    cached_raster_response = client.get(
        "/api/analysis/2024-08-05/raster?longitude=120.5&latitude=30.5&radius_deg=1&kind=combined"
    )
    assert cached_raster_response.status_code == 200
    assert cached_raster_response.headers["x-raster-cache"] == "hit"

    manifest_response = client.get("/api/data/manifest")
    assert manifest_response.status_code == 200
    manifest_payload = manifest_response.json()
    assert manifest_payload["paired_date_count"] == 3
    assert manifest_payload["missing_sst_dates"] == []
    assert manifest_payload["missing_front_dates"] == []

    plan_response = client.get("/api/data/plan")
    assert plan_response.status_code == 200
    plan_payload = plan_response.json()
    assert plan_payload["front_file_count"] == 3
    assert plan_payload["sst_file_count"] == 1
    assert plan_payload["paired_date_count"] == 3
    assert plan_payload["historical_target_date_count"] > 0
    assert plan_payload["historical_download_commands"]
    assert plan_payload["missing_sst_dates"] == []
    assert plan_payload["missing_front_dates"] == []
    assert plan_payload["download_commands"][-1].endswith("phase1_12_smoke.py")
    assert 0 <= plan_payload["readiness_score"] <= 1
    assert plan_payload["readiness_level"]
    assert plan_payload["next_action"]
    assert plan_payload["required_front_sst_file_count"] >= 0
    assert plan_payload["optional_intensity_file_count"] >= 0
    assert plan_payload["priority_actions"]
    assert any(command.endswith("phase1_12_smoke.py") for command in plan_payload["acceptance_commands"])
    assert plan_payload["source_notes"]

    data_index_response = client.get("/api/data/index")
    assert data_index_response.status_code == 200
    data_index_payload = data_index_response.json()
    assert data_index_payload["ready"] is True
    assert data_index_payload["schema_version"] == "data-index-v2"
    assert data_index_payload["total_file_count"] == 5
    assert data_index_payload["indexed_date_count"] == 3
    assert data_index_payload["paired_date_count"] == 3
    assert data_index_payload["missing_sst_dates"] == []
    assert data_index_payload["missing_front_dates"] == []
    assert data_index_payload["index_path"].endswith("data_index.sqlite")
    assert data_index_payload["sqlite_size_bytes"] > 0
    assert data_index_payload["query_examples"]
    dataset_by_type = {item["dataset_type"]: item for item in data_index_payload["datasets"]}
    assert dataset_by_type["front_location"]["file_count"] == 3
    assert dataset_by_type["front_location"]["date_count"] == 3
    assert dataset_by_type["sst"]["file_count"] == 1
    assert dataset_by_type["sst"]["date_count"] == 3
    assert dataset_by_type["front_intensity"]["file_count"] == 1
    assert dataset_by_type["front_intensity"]["date_count"] == 1

    rebuild_index_response = client.post("/api/data/index/rebuild")
    assert rebuild_index_response.status_code == 200
    assert rebuild_index_response.json()["paired_date_count"] == 3

    date_index_response = client.get("/api/data/index/2024-08-05")
    assert date_index_response.status_code == 200
    date_index_payload = date_index_response.json()
    assert date_index_payload["complete"] is True
    assert date_index_payload["front_file_count"] == 1
    assert date_index_payload["sst_file_count"] == 1
    assert date_index_payload["intensity_file_count"] == 1
    assert len(date_index_payload["files"]) == 3
    assert any(item["dataset_type"] == "front_location" for item in date_index_payload["files"])
    assert any(item["dataset_type"] == "sst" for item in date_index_payload["files"])
    assert all(item["canonical"] is True for item in date_index_payload["files"])

    objects_response = client.get(
        "/api/front-objects/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert objects_response.status_code == 200
    objects_payload = objects_response.json()
    assert objects_payload["object_count"] == 1
    assert objects_payload["nearest_front_id"] == "20240805-F001"
    assert objects_payload["objects"][0]["length_km"] > 0
    assert objects_payload["objects"][0]["mean_intensity"] == 0.1
    assert objects_payload["objects"][0]["max_intensity"] == 0.1
    assert objects_payload["layers"]["centroids"]["features"][0]["geometry"]["type"] == "Point"

    tracking_response = client.get(
        "/api/front-tracking/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1&days=2"
    )
    assert tracking_response.status_code == 200
    tracking_payload = tracking_response.json()
    assert tracking_payload["days"] == 2
    assert tracking_payload["match_distance_km"] == 80.0
    assert tracking_payload["algorithm"] == "centroid-shape-overlap"
    assert tracking_payload["algorithm_version"] == "v2"
    assert tracking_payload["algorithm_notes"]
    assert tracking_payload["confidence_label"]
    assert tracking_payload["gap_count"] == 1
    assert tracking_payload["tracked_step_count"] == 1
    assert tracking_payload["steps"][0]["front_id"] == "20240805-F001"
    assert tracking_payload["steps"][0]["matched_by"] == "query_anchor"
    assert tracking_payload["steps"][0]["match_score"] == 1.0
    assert tracking_payload["steps"][1]["front_id"] is None
    assert tracking_payload["steps"][1]["matched_by"] == "no_candidate"
    assert tracking_payload["steps"][1]["match_score"] is None
    assert tracking_payload["layers"]["track_points"]["features"][0]["properties"]["front_id"] == "20240805-F001"

    point_response = client.get("/api/point/2024-08-05?longitude=120.5&latitude=30.5")
    assert point_response.status_code == 200
    point_payload = point_response.json()
    assert point_payload["temperature_range_celsius"] == 1.5
    assert point_payload["temperature_gradient_c_per_km"] > 0

    response = client.get("/api/history/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["available_years"] == [2024, 2025]
    assert payload["summary"]["probability_rule"] == "line_presence"
    assert payload["summary"]["probability_rule_label"] == "窗口内存在锋面线像元"
    assert "存在至少 1 个锋面线像元" in payload["summary"]["probability_rule_note"]
    assert payload["summary"]["same_period_sample_count"] == 2
    assert payload["summary"]["same_period_front_hit_count"] == 1
    assert payload["summary"]["same_period_probability"] == 0.5
    assert payload["summary"]["same_period_expected_sample_count"] == 43
    assert payload["summary"]["same_period_coverage_ratio"] == round(2 / 43, 4)
    assert payload["summary"]["same_period_covered_years"] == [2024, 2025]
    assert 1982 in payload["summary"]["same_period_missing_years"]
    assert payload["summary"]["next_missing_same_period_dates"]
    assert payload["summary"]["monthly_expected_sample_count"] == 31 * 43
    assert payload["summary"]["monthly_coverage_ratio"] == round(3 / (31 * 43), 4)
    assert payload["summary"]["sample_reliability_level"] == "low"
    assert payload["summary"]["sample_reliability_label"] == "样本偏少"
    assert "不等同于数学置信区间" in payload["summary"]["sample_coverage_note"]
    assert payload["summary"]["monthly_sample_count"] == 3
    assert payload["summary"]["monthly_front_hit_count"] == 1
    assert payload["summary"]["monthly_probability"] == round(1 / 3, 4)
    assert payload["summary"]["annual_sample_count"] == 3
    assert payload["summary"]["annual_front_hit_count"] == 1
    assert payload["summary"]["sst_gradient_c_per_km_mean"] > 0
    assert payload["timeline"][0]["date"] == "2024-08-05"
    assert payload["timeline"][0]["sst_gradient_c_per_km"] > 0
    assert payload["timeline"][0]["front_line_density_per_1000_pixels"] == 250.0
    assert payload["timeline"][0]["nearest_front_distance_km"] is not None
    assert payload["timeline"][1]["date"] == "2024-08-06"
    assert len(payload["same_period_records"]) == 2
    assert len(payload["monthly_records"]) == 3
    assert payload["cache"]["hit"] is False
    assert payload["cache"]["metadata_source"] in {"sqlite-index", "directory-scan"}
    assert payload["cache"]["records_evaluated"] == 3
    assert payload["cache"]["timeline_record_count"] == 3
    assert payload["cache"]["duration_ms"] is not None
    assert payload["source_files"]

    cached_response = client.get("/api/history/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1")
    assert cached_response.status_code == 200
    cached_payload = cached_response.json()
    assert cached_payload["cache"]["hit"] is True
    assert cached_payload["cache"]["records_evaluated"] == 0
    assert cached_payload["cache"]["timeline_record_count"] == 3
    assert cached_payload["summary"] == payload["summary"]

    probability_rules_response = client.get("/api/history/probability-rules")
    assert probability_rules_response.status_code == 200
    probability_rules_payload = probability_rules_response.json()
    assert probability_rules_payload["default_rule"] == "line_presence"
    assert {item["id"] for item in probability_rules_payload["options"]} == {
        "line_presence",
        "density_threshold",
        "distance_threshold",
    }

    distance_rule_response = client.get(
        "/api/history/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1"
        "&probability_rule=distance_threshold&max_front_distance_km=10"
    )
    assert distance_rule_response.status_code == 200
    distance_rule_payload = distance_rule_response.json()
    assert distance_rule_payload["summary"]["probability_rule"] == "distance_threshold"
    assert distance_rule_payload["summary"]["probability_threshold"] == 10.0
    assert distance_rule_payload["summary"]["same_period_probability"] == 0.0
    assert distance_rule_payload["timeline"][0]["front_present"] is False

    prediction_response = client.get(
        "/api/prediction/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1&horizon_days=3"
    )
    assert prediction_response.status_code == 200
    prediction_payload = prediction_response.json()
    assert prediction_payload["algorithm"] == "historical-climatology-recent-baseline"
    assert prediction_payload["forecast_count"] == 3
    assert prediction_payload["predictions"][0]["target_date"] == "2024-08-06"
    assert prediction_payload["predictions"][0]["probability"] is not None
    assert prediction_payload["predictions"][0]["observed_front_present"] is False
    assert prediction_payload["predictions"][0]["drivers"]

    prediction_evaluation_response = client.get(
        "/api/prediction/2024-08-05/evaluation?longitude=120.5&latitude=30.5"
        "&radius_deg=1&horizon_days=2&max_anchor_dates=4"
    )
    assert prediction_evaluation_response.status_code == 200
    prediction_evaluation_payload = prediction_evaluation_response.json()
    assert prediction_evaluation_payload["evaluation_mode"] == "in-sample-local-backtest"
    assert prediction_evaluation_payload["candidate_anchor_count"] == 1
    assert prediction_evaluation_payload["evaluated_count"] == 1
    assert prediction_evaluation_payload["brier_score"] is not None
    assert prediction_evaluation_payload["points"][0]["anchor_date"] == "2024-08-05"
    assert prediction_evaluation_payload["points"][0]["target_date"] == "2024-08-06"

    report_response = client.get(
        "/api/report/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1&days=2"
    )
    assert report_response.status_code == 200
    report_payload = report_response.json()
    assert report_payload["title"].startswith("海洋锋面离线分析报告")
    assert "锋面对象" in report_payload["markdown"]
    assert "样本覆盖可信度" in report_payload["markdown"]
    assert "<html" in report_payload["html"]
    assert report_payload["source_files"]

    index_response = client.get(
        "/api/history/index?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert index_response.status_code == 200
    index_payload = index_response.json()
    assert index_payload["ready"] is True
    assert index_payload["front_file_count"] == 3
    assert index_payload["sst_file_count"] == 1
    assert index_payload["available_date_start"] == "2024-08-05"
    assert index_payload["available_date_end"] == "2025-08-05"
    assert index_payload["available_years"] == [2024, 2025]
    assert index_payload["metadata_source"] in {"sqlite-index", "directory-scan"}
    assert index_payload["spatial"]["query_bbox"] == [119.5, 29.5, 121.5, 31.5]
    assert index_payload["spatial"]["front_grid"]["lon_resolution_deg"] == 1.0
    assert index_payload["spatial"]["sst_grid"]["lat_resolution_deg"] == 1.0

    probability_response = client.get(
        "/api/history/2024-08-05/probability?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert probability_response.status_code == 200
    probability_payload = probability_response.json()
    assert probability_payload["summary"]["same_period_probability"] == 0.5
    assert len(probability_payload["same_period_records"]) == 2
    assert len(probability_payload["monthly_records"]) == 3

    monthly_response = client.get(
        "/api/history/2024-08-05/monthly?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert monthly_response.status_code == 200
    monthly_payload = monthly_response.json()
    assert monthly_payload["selected_month"] == 8
    assert monthly_payload["selected"]["sample_count"] == 3
    assert monthly_payload["selected"]["front_hit_count"] == 1

    local_response = client.get(
        "/api/history/2024-08-05/local-records?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert local_response.status_code == 200
    local_payload = local_response.json()
    assert len(local_payload["same_period_records"]) == 2
    assert len(local_payload["monthly_records"]) == 3
    assert local_payload["same_period_records"][0]["matched_rule"] == "same-month-day"
    assert local_payload["monthly_records"][0]["matched_rule"] == "same-month"
    assert local_payload["source_files"]


def test_ai_agent_extracts_task_invokes_tools_and_links_evidence(
    tmp_path: Path,
    monkeypatch,
) -> None:
    raw_root = tmp_path / "raw"
    cache_root = tmp_path / "cache"
    monkeypatch.setattr(settings, "raw_data_dir", raw_root)
    monkeypatch.setattr(settings, "cache_dir", cache_root)
    monkeypatch.setattr(settings, "ai_provider", "rules")

    _write_front_file(
        raw_root / "front" / "2024" / "front_location20240805.nc",
        np.array([[-10, 0], [-20, 20]], dtype=np.int8),
        "2024-08-05",
    )
    _write_front_file(
        raw_root / "front" / "2024" / "front_location20240806.nc",
        np.array([[0, 0], [0, 0]], dtype=np.int8),
        "2024-08-06",
    )
    _write_front_file(
        raw_root / "front" / "2025" / "front_location20250805.nc",
        np.array([[0, 0], [0, 0]], dtype=np.int8),
        "2025-08-05",
    )
    _write_sst_file(raw_root / "sst" / "2024" / "sst_20240805_20250805.nc")

    capabilities = client.get("/api/ai/capabilities")
    assert capabilities.status_code == 200
    assert capabilities.json()["offline"] is True
    assert "calculate_historical_probability" in capabilities.json()["supported_tasks"]

    knowledge = client.get("/api/ai/knowledge")
    assert knowledge.status_code == 200
    assert {entry["id"] for entry in knowledge.json()["entries"]} >= {
        "front-code-semantics",
        "probability-rule",
        "evidence-boundary",
    }

    response = client.post(
        "/api/ai/analyze",
        json={
            "message": "分析8月5日东经120.5北纬30.5附近1度范围的锋面，解释历史概率并查看连续3日变化",
            "default_date": "2024-08-05",
            "default_longitude": 120.5,
            "default_latitude": 30.5,
            "default_radius_deg": 1,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    params = payload["structured_task"]["parameters"]
    assert params["date"] == "2024-08-05"
    assert params["longitude"] == 120.5
    assert params["latitude"] == 30.5
    assert params["radius_deg"] == 1
    assert "show_current_front" in payload["structured_task"]["tasks"]
    assert "calculate_historical_probability" in payload["structured_task"]["tasks"]
    assert "show_multi_day_change" in payload["structured_task"]["tasks"]

    tool_names = {item["name"] for item in payload["tool_calls"]}
    assert "analysis.current_front" in tool_names
    assert "front.objects" in tool_names
    assert "front.tracking" in tool_names
    assert "history.probability" in tool_names
    assert "history.timeline" in tool_names

    evidence = {item["id"]: item for item in payload["evidence"]}
    assert evidence["history-same-period-probability"]["value"] == "50.0%"
    assert "1/2" in evidence["history-same-period-probability"]["detail"]
    assert evidence["history-sample-coverage"]["value"] == "样本偏少"
    assert "structured-task-parameters" in evidence
    assert evidence["current-front-summary"]["value"] == "1 个锋面线像元"
    assert evidence["current-temperature-structure"]["value"] == "温差 1.50 °C"
    assert evidence["front-object-summary"]["value"] == "1 个对象"
    assert "1/3 日可追踪" in evidence["front-tracking-summary"]["value"]
    assert all(item["evidence_ids"] for item in payload["conclusions"])
    assert "50.0%" in payload["answer"]

    km_response = client.post(
        "/api/ai/analyze",
        json={
            "message": "把空间范围改成10公里，查看8月5日东经120.5北纬30.5的历史概率",
            "default_date": "2024-08-05",
            "default_longitude": 120.5,
            "default_latitude": 30.5,
            "default_radius_deg": 1,
        },
    )
    assert km_response.status_code == 200
    km_payload = km_response.json()
    assert km_payload["structured_task"]["parameters"]["radius_deg"] == round(10 / 111.195, 6)
    assert "空间范围由公里近似换算为纬度度数。" in km_payload["structured_task"]["assumptions"]
    assert all(item["evidence_ids"] for item in km_payload["conclusions"])

    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "local_llm_endpoint", "http://127.0.0.1:9/api/generate")
    monkeypatch.setattr(settings, "ai_timeout_seconds", 0.2)
    health_response = client.get("/api/ai/health")
    assert health_response.status_code == 200
    health_payload = health_response.json()
    assert health_payload["provider"] == "ollama"
    assert health_payload["local_model_available"] is False
    fallback_response = client.post(
        "/api/ai/analyze",
        json={
            "message": "分析8月5日东经120.5北纬30.5附近1度范围的锋面，解释历史概率",
            "default_date": "2024-08-05",
            "default_longitude": 120.5,
            "default_latitude": 30.5,
            "default_radius_deg": 1,
        },
    )
    assert fallback_response.status_code == 200
    fallback_payload = fallback_response.json()
    assert "本地模型不可用或返回无效 JSON，已回退到本地规则解析器。" in fallback_payload["structured_task"]["assumptions"]
    assert fallback_payload["structured_task"]["parameters"]["date"] == "2024-08-05"
