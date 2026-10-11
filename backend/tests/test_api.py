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


def test_catalog_hides_file_list_by_default_and_caches(tmp_path: Path, monkeypatch) -> None:
    from app import catalog as catalog_module

    raw_root = tmp_path / "raw"
    monkeypatch.setattr(settings, "raw_data_dir", raw_root)
    catalog_module.invalidate_catalog_cache()
    _write_front_file(
        raw_root / "front" / "2024" / "front_location20240805.nc",
        np.array([[0, 0], [0, 0]], dtype=np.int8),
        "2024-08-05",
    )

    first = client.get("/api/catalog")
    assert first.status_code == 200
    assert first.headers["X-Catalog-Cache"] == "miss"
    payload = first.json()
    assert payload["file_count"] == 1
    assert payload["available_dates"] == ["2024-08-05"]
    # 默认不返回逐文件清单：几千个文件时这个数组会把响应撑到几百 KB
    assert payload["files"] == []
    assert payload["files_included"] is False
    assert payload["cached"] is False

    # 第二次同样内容：目录指纹没变，直接命中缓存
    second = client.get("/api/catalog")
    assert second.headers["X-Catalog-Cache"] == "hit"
    assert second.json()["cached"] is True
    assert second.json()["file_count"] == 1

    # 需要清单的老调用方显式要：?files=true
    explicit = client.get("/api/catalog?files=true")
    assert explicit.json()["files_included"] is True
    assert [item["name"] for item in explicit.json()["files"]] == [
        "front/2024/front_location20240805.nc"
    ]
    assert explicit.json()["files"][0]["size_bytes"] > 0

    # 新文件落地（目录 mtime 变化）后必须立刻看到，不能吃旧缓存
    _write_front_file(
        raw_root / "front" / "2024" / "front_location20240806.nc",
        np.array([[0, 0], [0, 0]], dtype=np.int8),
        "2024-08-06",
    )
    third = client.get("/api/catalog")
    assert third.headers["X-Catalog-Cache"] == "miss"
    assert third.json()["file_count"] == 2
    assert third.json()["available_dates"] == ["2024-08-05", "2024-08-06"]

    # refresh=true 跳过缓存强制重扫
    refreshed = client.get("/api/catalog?refresh=true")
    assert refreshed.headers["X-Catalog-Cache"] == "miss"
    assert refreshed.json()["file_count"] == 2
    assert catalog_module.catalog_cache_stats()["misses"] >= 4


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
    _write_sst_file(raw_root / "_duplicates_backup" / "sst" / "2024" / "sst_backup_20240805.nc")

    catalog_response = client.get("/api/catalog")
    assert catalog_response.status_code == 200
    assert catalog_response.json()["file_count"] == 4

    analysis_response = client.get(
        "/api/analysis/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1"
    )
    assert analysis_response.status_code == 200
    analysis_payload = analysis_response.json()
    assert analysis_payload["sst"]["range_celsius"] == 1.5
    assert analysis_payload["sst"]["gradient_c_per_km"] > 0
    assert analysis_payload["sst"]["max_gradient_c_per_km"] >= analysis_payload["sst"]["gradient_c_per_km"]
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
    assert plan_payload["source_notes"]

    data_index_response = client.get("/api/data/index")
    assert data_index_response.status_code == 200
    data_index_payload = data_index_response.json()
    assert data_index_payload["ready"] is True
    assert data_index_payload["schema_version"] == "data-index-v1"
    assert data_index_payload["total_file_count"] == 4
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

    rebuild_index_response = client.post("/api/data/index/rebuild")
    assert rebuild_index_response.status_code == 200
    assert rebuild_index_response.json()["paired_date_count"] == 3

    date_index_response = client.get("/api/data/index/2024-08-05")
    assert date_index_response.status_code == 200
    date_index_payload = date_index_response.json()
    assert date_index_payload["complete"] is True
    assert date_index_payload["front_file_count"] == 1
    assert date_index_payload["sst_file_count"] == 1
    assert len(date_index_payload["files"]) == 2
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
    assert objects_payload["layers"]["centroids"]["features"][0]["geometry"]["type"] == "Point"

    tracking_response = client.get(
        "/api/front-tracking/2024-08-05?longitude=120.5&latitude=30.5&radius_deg=1&days=2"
    )
    assert tracking_response.status_code == 200
    tracking_payload = tracking_response.json()
    assert tracking_payload["days"] == 2
    assert tracking_payload["match_distance_km"] == 80.0
    assert tracking_payload["algorithm"] == "centroid-shape-overlap"
    assert tracking_payload["algorithm_notes"]
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
    assert payload["summary"]["same_period_sample_count"] == 2
    assert payload["summary"]["same_period_front_hit_count"] == 1
    assert payload["summary"]["same_period_probability"] == 0.5
    assert payload["summary"]["same_period_expected_sample_count"] == 43
    assert payload["summary"]["same_period_coverage_ratio"] == round(2 / 43, 4)
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
def _write_window_front_file(path: Path, observation_date: str) -> None:
    """写一份「全球风格」的小窗口测试文件：lon 100–110 / lat 20–30，0.05° 网格。

    内容：中间一条东西向锋面线（10，纬度 25.0），其北侧冷侧（-20）、南侧暖侧（20），
    西南角一块缺测（-128）；其余为 0（数据里 0 = 无锋面）。
    """
    lon = np.round(np.arange(100.0, 110.0 + 0.001, 0.05), 3)
    lat = np.round(np.arange(20.0, 30.0 + 0.001, 0.05), 3)
    values = np.zeros((lat.size, lon.size), dtype=np.int16)
    row = int(round((25.0 - lat[0]) / 0.05))     # 纬度 25.0 那一行
    values[row, 40:140] = 10                      # 锋面线（5° ≈ 500 km，够长，会被编号）
    values[row + 20:row + 80, 40:140] = -20       # 冷侧（北，约 1–4°）
    values[row - 80:row - 20, 40:140] = 20        # 暖侧（南，约 1–4°）
    values[0:20, 0:20] = -128                     # 西南角缺测块
    dataset = xr.Dataset(
        data_vars={"front": (("lat", "lon", "time"), values[:, :, np.newaxis].astype(np.int8))},
        coords={
            "lat": lat.astype(np.float32),
            "lon": lon.astype(np.float32),
            "time": np.array([np.datetime64(observation_date)], dtype="datetime64[ns]"),
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_netcdf(path, engine="h5netcdf")


def test_frontend_payload_window_bbox_and_lod(tmp_path: Path, monkeypatch) -> None:
    """按窗口取数（bbox）+ 大窗口自动降采样概览（step）—— 「数据铺满」的后端契约。"""
    raw_root = tmp_path / "raw"
    monkeypatch.setattr(settings, "raw_data_dir", raw_root)
    monkeypatch.setattr(settings, "cache_dir", tmp_path / "cache")
    _write_window_front_file(raw_root / "front" / "2024" / "front_location20240805.nc", "2024-08-05")
    _write_sst_file(raw_root / "sst" / "2024" / "sst_20240805.nc")   # 海温在 120–121°E：与下面的窗口无交集

    # ① 默认窗口（作业海域）：仍是 0.05° 明细；海温文件（120–121°E）落在窗口内 → 一起返回
    default = client.get("/api/frontend/day/2024-08-05")
    assert default.status_code == 200
    body = default.json()
    assert body["window"]["default"] is True
    assert body["window"]["step"] == 1 and body["window"]["mode"] == "detail"
    assert "overview" not in body["front"]
    assert body["front"]["grid"]["dlon"] == 0.05
    assert body["sst"] is not None and body["front"]["has_sst"] is True
    assert body["sst"]["grid"]["lon0"] == 120.0

    # ② 显式窗口：0.05° 明细，对象识别照常；该窗口与海温文件无交集 → 明说没有，不编
    detail = client.get("/api/frontend/day/2024-08-05", params={"bbox": "100,20,110,30"})
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["window"]["bbox"] == [100.0, 20.0, 110.0, 30.0]
    assert detail_body["window"]["step"] == 1
    assert detail_body["front"]["object_line_count"] == 1
    assert detail_body["front"]["objects"][0]["front_id"] == "F001"
    assert detail_body["sst"] is None and detail_body["front"]["has_sst"] is False

    # ③ 同窗口 + step=20：降采样概览——不做对象识别，但带/冷/暖/缺测都要在
    coarse = client.get("/api/frontend/day/2024-08-05", params={"bbox": "100,20,110,30", "step": 20})
    assert coarse.status_code == 200
    coarse_body = coarse.json()
    assert coarse_body["window"]["step"] == 20 and coarse_body["window"]["resolution_deg"] == 1.0
    assert coarse_body["window"]["mode"] == "overview"
    assert coarse_body["front"]["overview"]["step"] == 20
    assert "统计与对象清单仍用 0.05°" in coarse_body["front"]["overview"]["note"]
    assert coarse_body["front"]["grid"]["dlon"] == 1.0
    assert coarse_body["front"]["objects"] == [] and coarse_body["front"]["front_line"] == []
    assert coarse_body["front"]["object_line_count"] == 0
    # 25.0°N 的锋面线在第 100 行 → 1° 概览落在第 5 行（块内有线就记线，不会被邻居抹掉）
    assert any(run[0] == 5 for run in coarse_body["front"]["front_band_rle"])
    assert coarse_body["front"]["cold_side_rle"], "冷侧应聚合成概览格"
    assert coarse_body["front"]["warm_side_rle"], "暖侧应聚合成概览格"
    assert coarse_body["front"]["nodata_rle"], "整块缺测才记缺测"

    # ④ 同参数第二次：命中磁盘缓存
    again = client.get("/api/frontend/day/2024-08-05", params={"bbox": "100,20,110,30", "step": 20})
    assert again.headers["X-Payload-Cache"] == "hit"
    assert again.json()["cached"] is True

    # ⑤ 参数不合法：bbox 顺序/个数、step 档位
    assert client.get("/api/frontend/day/2024-08-05", params={"bbox": "110,20,100,30"}).status_code == 422
    assert client.get("/api/frontend/day/2024-08-05", params={"bbox": "1,2,3"}).status_code == 422
    assert client.get("/api/frontend/day/2024-08-05", params={"bbox": "100,20,110,30", "step": 3}).status_code == 422
    assert client.get("/api/frontend/day/2024-08-05", params={"bbox": "100,20,110,30", "step": 41}).status_code == 422

    # ⑥ 没有原始文件的那天：404（前端据此回退本地数据，不给空图）
    assert client.get("/api/frontend/day/2024-08-06").status_code == 404



def _write_global_sst_file(path: Path, cells: int = 40) -> None:
    """写一份「全球粗格」合成海温（cells×cells，覆盖 -180..180 / -90..90），用于验证隔格取样。"""
    lon = np.linspace(-180.0, 180.0, cells, dtype=np.float32)
    lat = np.linspace(-90.0, 90.0, cells, dtype=np.float32)
    values = np.full((cells, cells), 20.0, dtype=np.float32)
    dataset = xr.Dataset(
        data_vars={"analysed_sst": (("time", "latitude", "longitude"), values[np.newaxis, :, :])},
        coords={
            "time": np.array([np.datetime64("2024-08-05")], dtype="datetime64[ns]"),
            "latitude": lat,
            "longitude": lon,
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_netcdf(path, engine="h5netcdf")


def test_frontend_payload_thins_dense_global_sst(tmp_path: Path, monkeypatch) -> None:
    """全球粗格升到 0.25° 后，整球窗口必须被隔格取样（否则 payload 会有几十万条游程）。"""
    from app import frontend_payload as payload_module

    raw_root = tmp_path / "raw"
    monkeypatch.setattr(settings, "raw_data_dir", raw_root)
    monkeypatch.setattr(settings, "cache_dir", tmp_path / "cache")
    monkeypatch.setattr(payload_module, "SST_MAX_CELLS", 500)        # 40×40 = 1600 格 → 必须隔格
    _write_window_front_file(raw_root / "front" / "2024" / "front_location20240805.nc", "2024-08-05")
    _write_global_sst_file(raw_root / "sst_global" / "2024" / "sst_20240805.nc", cells=40)

    body = client.get("/api/frontend/day/2024-08-05",
                      params={"bbox": "-180,-90,180,90", "step": 40}).json()
    coarse = body["sst_coarse"]
    assert coarse is not None, "整球窗口应带全球粗格海温"
    grid = coarse["grid"]
    # 40×40 且上限 500 → 隔 2 格 → 20×20、步长翻倍、起点不变
    assert (grid["nx"], grid["ny"]) == (20, 20)
    assert grid["lon0"] == -180.0 and grid["lat0"] == -90.0
    assert grid["dlon"] == round(360.0 / 39 * 2, 3) and grid["dlat"] == round(180.0 / 39 * 2, 3)
    assert body["front"]["has_sst"] is True

    # 小窗口不该被隔格：同一份文件裁到很小一块时步长保持原样（起点/步长仍由坐标数组给出）
    small = client.get("/api/frontend/day/2024-08-05",
                       params={"bbox": "100,20,110,30", "step": 20}).json()["sst_coarse"]
    # 合成文件是 40×40（步长 9.23°），10°×10° 的窗口取不到 2 个点 → 明说没有，而不是给个错的格子
    assert small is None or small["grid"]["dlon"] == round(360.0 / 39, 3)

