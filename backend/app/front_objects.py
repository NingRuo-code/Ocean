from __future__ import annotations

from datetime import date, timedelta
from math import atan2, degrees
from pathlib import Path

import numpy as np

from .config import settings
from .data_access import (
    build_front_object_layers,
    extract_front_objects,
    load_front_intensity_subset,
    load_front_subset,
    load_sst_subset,
    match_front_intensity_record,
    match_front_record,
    match_sst_record,
    scan_front_intensity_records,
)
from .history import get_history_index
from .schemas import FrontObjectResponse, FrontTrackingResponse, FrontTrackStep


def compute_front_object_response(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> FrontObjectResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    daily = _load_daily_objects(
        observation_date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        raw_data_dir=raw_data_dir,
        cache_dir=cache_dir,
    )
    objects = daily["objects"]
    if not isinstance(objects, list):
        objects = []
    return FrontObjectResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        object_count=len(objects),
        nearest_front_id=str(objects[0]["front_id"]) if objects else None,
        objects=objects,
        layers=build_front_object_layers(objects),
        source_files=list(daily["source_files"]),
    )


def compute_front_tracking_response(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    days: int = 3,
    match_distance_km: float = 80.0,
    raw_data_dir: Path | None = None,
    cache_dir: Path | None = None,
) -> FrontTrackingResponse:
    raw_data_dir = raw_data_dir or settings.raw_data_dir
    cache_dir = cache_dir or settings.cache_dir
    bounded_days = max(1, min(31, days))
    bounded_match_distance = max(1.0, min(500.0, match_distance_km))
    steps: list[FrontTrackStep] = []
    source_files: set[str] = set()
    previous_object: dict[str, object] | None = None
    cumulative_distance = 0.0

    for offset in range(bounded_days):
        current_date = observation_date + timedelta(days=offset)
        try:
            daily = _load_daily_objects(
                observation_date=current_date,
                longitude=longitude,
                latitude=latitude,
                radius_deg=radius_deg,
                raw_data_dir=raw_data_dir,
                cache_dir=cache_dir,
            )
        except FileNotFoundError:
            steps.append(
                FrontTrackStep(
                    date=current_date,
                    front_id=None,
                    centroid_longitude=None,
                    centroid_latitude=None,
                    bbox=[],
                    pixel_count=0,
                    length_km=None,
                    mean_sst_celsius=None,
                    nearest_to_query_km=None,
                    distance_from_previous_km=None,
                    matched_by="missing_file",
                    candidates_considered=0,
                    status="缺少 front 文件",
                    source_files=[],
                )
            )
            continue

        for source in daily["source_files"]:
            source_files.add(str(source))
        objects = daily["objects"]
        if not isinstance(objects, list) or not objects:
            steps.append(
                FrontTrackStep(
                    date=current_date,
                    front_id=None,
                    centroid_longitude=None,
                    centroid_latitude=None,
                    bbox=[],
                    pixel_count=0,
                    length_km=None,
                    mean_sst_celsius=None,
                    nearest_to_query_km=None,
                    distance_from_previous_km=None,
                    matched_by="no_candidate",
                    candidates_considered=0,
                    status="范围内未检测到锋面对象",
                    source_files=list(daily["source_files"]),
                )
            )
            continue

        (
            nearest,
            matched_by,
            distance_from_previous,
            match_score,
            shape_similarity,
            bbox_overlap_ratio,
        ) = _select_tracking_object(
            objects=objects,
            previous_object=previous_object,
            match_distance_km=bounded_match_distance,
        )
        prior_object = previous_object
        centroid = (
            float(nearest["centroid_longitude"]),
            float(nearest["centroid_latitude"]),
        )
        speed_km_per_day = round(distance_from_previous, 3) if distance_from_previous is not None else None
        bearing_deg = (
            _bearing_deg(
                float(prior_object["centroid_longitude"]),
                float(prior_object["centroid_latitude"]),
                centroid[0],
                centroid[1],
            )
            if prior_object is not None and distance_from_previous is not None
            else None
        )
        if distance_from_previous is not None:
            cumulative_distance += distance_from_previous
        previous_object = nearest
        steps.append(
            FrontTrackStep(
                date=current_date,
                front_id=str(nearest["front_id"]),
                centroid_longitude=centroid[0],
                centroid_latitude=centroid[1],
                bbox=list(nearest["bbox"]),
                pixel_count=int(nearest["pixel_count"]),
                length_km=float(nearest["length_km"]),
                mean_sst_celsius=_optional_float(nearest.get("mean_sst_celsius")),
                nearest_to_query_km=_optional_float(nearest.get("nearest_to_query_km")),
                distance_from_previous_km=distance_from_previous,
                speed_km_per_day=speed_km_per_day,
                bearing_deg=bearing_deg,
                matched_by=matched_by,
                match_score=match_score,
                continuity_score=match_score,
                confidence_label=_match_confidence_label(match_score, matched_by),
                shape_similarity=shape_similarity,
                bbox_overlap_ratio=bbox_overlap_ratio,
                candidates_considered=len(objects),
                status=_step_status(
                    matched_by,
                    distance_from_previous,
                    bounded_match_distance,
                    match_score,
                ),
                source_files=list(daily["source_files"]),
            )
        )

    tracked_steps = [step for step in steps if step.front_id is not None]
    distance_values = [
        step.distance_from_previous_km
        for step in tracked_steps
        if step.distance_from_previous_km is not None
    ]
    match_scores = [
        step.match_score
        for step in tracked_steps
        if step.match_score is not None and step.matched_by != "query_anchor"
    ]
    gap_count = sum(1 for step in steps if step.front_id is None)
    reset_count = sum(1 for step in steps if step.matched_by == "query_anchor_reset")
    mean_match_score = round(float(np.mean(match_scores)), 3) if match_scores else None
    confidence_score = _track_confidence_score(
        tracked_count=len(tracked_steps),
        available_count=sum(1 for step in steps if step.status != "缺少 front 文件"),
        mean_match_score=mean_match_score,
        reset_count=reset_count,
        gap_count=gap_count,
    )
    return FrontTrackingResponse(
        date=observation_date,
        longitude=longitude,
        latitude=latitude,
        radius_deg=radius_deg,
        days=bounded_days,
        match_distance_km=bounded_match_distance,
        algorithm="centroid-shape-overlap",
        algorithm_version="v2",
        algorithm_notes=[
            "首日按查询点最近锋面对象锚定。",
            "后续日期综合质心距离、对象长度/像元数相似度与 bbox 重叠率打分。",
            "v2 额外输出每日速度、方位角、连续性评分和整体轨迹可信度。",
            "匹配分数越接近 1，表示跨日对象连续性越强；超过距离阈值会回退到查询点锚定。",
        ],
        available_step_count=sum(1 for step in steps if step.status != "缺少 front 文件"),
        tracked_step_count=len(tracked_steps),
        cumulative_displacement_km=round(cumulative_distance, 3) if len(tracked_steps) > 1 else None,
        mean_daily_displacement_km=round(float(np.mean(distance_values)), 3) if distance_values else None,
        max_daily_displacement_km=round(float(np.max(distance_values)), 3) if distance_values else None,
        gap_count=gap_count,
        reset_count=reset_count,
        mean_match_score=mean_match_score,
        confidence_score=confidence_score,
        confidence_label=_track_confidence_label(confidence_score),
        status=_tracking_status(steps),
        steps=steps,
        layers=_build_tracking_layers(steps),
        source_files=sorted(source_files),
    )


def _load_daily_objects(
    *,
    observation_date: date,
    longitude: float,
    latitude: float,
    radius_deg: float,
    raw_data_dir: Path,
    cache_dir: Path,
) -> dict[str, object]:
    index = get_history_index(raw_data_dir, cache_dir)
    front_record = match_front_record(list(index.front_records), observation_date)
    if front_record is None:
        raise FileNotFoundError(f"未找到 {observation_date} 的锋面文件")
    sst_record = match_sst_record(list(index.sst_records), observation_date)
    intensity_record = match_front_intensity_record(
        scan_front_intensity_records(raw_data_dir),
        observation_date,
    )
    front_var = load_front_subset(front_record.path, longitude, latitude, radius_deg)
    front_values = np.asarray(front_var.values)
    sst_celsius = None
    intensity_values = None
    source_files = [front_record.path.relative_to(raw_data_dir).as_posix()]
    if sst_record is not None:
        source_files.append(sst_record.path.relative_to(raw_data_dir).as_posix())
        sst_var = load_sst_subset(
            sst_record.path,
            observation_date,
            longitude,
            latitude,
            radius_deg,
        )
        if sst_var is not None:
            sst_celsius = np.asarray(sst_var.values) - 273.15
    if intensity_record is not None:
        source_files.append(intensity_record.path.relative_to(raw_data_dir).as_posix())
        intensity_var = load_front_intensity_subset(
            intensity_record.path,
            observation_date,
            longitude,
            latitude,
            radius_deg,
        )
        if intensity_var is not None:
            candidate_intensity = np.asarray(intensity_var.values, dtype=float)
            if candidate_intensity.shape == front_values.shape:
                intensity_values = candidate_intensity
    objects = extract_front_objects(
        front_values,
        front_var.lon.values,
        front_var.lat.values,
        observation_date=observation_date,
        query_longitude=longitude,
        query_latitude=latitude,
        sst_celsius=sst_celsius,
        intensity_values=intensity_values,
    )
    return {"objects": objects, "source_files": source_files}


def _build_tracking_layers(steps: list[FrontTrackStep]) -> dict[str, object]:
    point_features = []
    line_features = []
    previous: FrontTrackStep | None = None
    for step in steps:
        if step.front_id is None or step.centroid_longitude is None or step.centroid_latitude is None:
            continue
        coordinates = [step.centroid_longitude, step.centroid_latitude]
        point_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coordinates},
                "properties": {
                    "date": step.date.isoformat(),
                    "front_id": step.front_id,
                    "pixel_count": step.pixel_count,
                    "length_km": _property_float(step.length_km, 0),
                    "nearest_to_query_km": _property_float(step.nearest_to_query_km, -1),
                    "distance_from_previous_km": _property_float(
                        step.distance_from_previous_km,
                        -1,
                    ),
                    "speed_km_per_day": _property_float(step.speed_km_per_day, -1),
                    "bearing_deg": _property_float(step.bearing_deg, -1),
                    "matched_by": step.matched_by,
                    "match_score": _property_float(step.match_score, -1),
                    "continuity_score": _property_float(step.continuity_score, -1),
                    "confidence_label": step.confidence_label,
                    "shape_similarity": _property_float(step.shape_similarity, -1),
                    "bbox_overlap_ratio": _property_float(step.bbox_overlap_ratio, -1),
                    "candidates_considered": step.candidates_considered,
                },
            }
        )
        if (
            previous is not None
            and previous.front_id is not None
            and previous.centroid_longitude is not None
            and previous.centroid_latitude is not None
        ):
            line_features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [previous.centroid_longitude, previous.centroid_latitude],
                            coordinates,
                        ],
                    },
                    "properties": {
                        "from_date": previous.date.isoformat(),
                        "to_date": step.date.isoformat(),
                        "distance_km": _property_float(step.distance_from_previous_km, 0),
                        "speed_km_per_day": _property_float(step.speed_km_per_day, 0),
                        "bearing_deg": _property_float(step.bearing_deg, -1),
                        "match_score": _property_float(step.match_score, -1),
                        "continuity_score": _property_float(step.continuity_score, -1),
                        "matched_by": step.matched_by,
                    },
                }
            )
        previous = step
    return {
        "track_points": {"type": "FeatureCollection", "features": point_features},
        "track_lines": {"type": "FeatureCollection", "features": line_features},
    }


def _distance_km(lon_a: float, lat_a: float, lon_b: float, lat_b: float) -> float:
    reference_latitude = (lat_a + lat_b) / 2
    return float(
        np.sqrt(
            ((lon_b - lon_a) * np.cos(np.deg2rad(reference_latitude))) ** 2
            + (lat_b - lat_a) ** 2
        )
        * 111.195
    )


def _bearing_deg(lon_a: float, lat_a: float, lon_b: float, lat_b: float) -> float:
    reference_latitude = (lat_a + lat_b) / 2
    east_km = (lon_b - lon_a) * 111.195 * max(float(np.cos(np.deg2rad(reference_latitude))), 0.01)
    north_km = (lat_b - lat_a) * 111.195
    angle = (degrees(atan2(east_km, north_km)) + 360) % 360
    return round(float(angle), 1)


def _select_tracking_object(
    *,
    objects: list[dict[str, object]],
    previous_object: dict[str, object] | None,
    match_distance_km: float,
) -> tuple[dict[str, object], str, float | None, float | None, float | None, float | None]:
    if previous_object is None:
        return objects[0], "query_anchor", None, 1.0, None, None

    previous_centroid = (
        float(previous_object["centroid_longitude"]),
        float(previous_object["centroid_latitude"]),
    )

    ranked = sorted(
        (
            (
                *_tracking_match_metrics(
                    previous_object,
                    item,
                    match_distance_km,
                    _distance_km(
                        previous_centroid[0],
                        previous_centroid[1],
                        float(item["centroid_longitude"]),
                        float(item["centroid_latitude"]),
                    ),
                ),
                item,
            )
            for item in objects
        ),
        key=lambda pair: (-pair[0], pair[1]),
    )
    best_score, best_distance, best_shape_similarity, best_bbox_overlap_ratio, best_object = ranked[0]
    if best_distance <= match_distance_km:
        return (
            best_object,
            "centroid_shape_overlap",
            round(best_distance, 3),
            round(best_score, 3),
            round(best_shape_similarity, 3),
            round(best_bbox_overlap_ratio, 3),
        )
    return objects[0], "query_anchor_reset", None, None, None, None


def _tracking_match_metrics(
    previous_object: dict[str, object],
    current_object: dict[str, object],
    match_distance_km: float,
    distance_km: float,
) -> tuple[float, float, float, float]:
    distance_score = max(0.0, 1.0 - distance_km / match_distance_km)
    shape_similarity = _shape_similarity(previous_object, current_object)
    bbox_overlap_ratio = _bbox_overlap_ratio(
        list(previous_object.get("bbox", [])),
        list(current_object.get("bbox", [])),
    )
    score = 0.6 * distance_score + 0.25 * shape_similarity + 0.15 * bbox_overlap_ratio
    return score, distance_km, shape_similarity, bbox_overlap_ratio


def _match_confidence_label(match_score: float | None, matched_by: str) -> str:
    if matched_by == "query_anchor":
        return "首日锚定"
    if matched_by == "query_anchor_reset":
        return "重锚定"
    if match_score is None:
        return "无评分"
    if match_score >= 0.75:
        return "高"
    if match_score >= 0.5:
        return "中"
    if match_score >= 0.25:
        return "低"
    return "很低"


def _track_confidence_score(
    *,
    tracked_count: int,
    available_count: int,
    mean_match_score: float | None,
    reset_count: int,
    gap_count: int,
) -> float | None:
    if available_count <= 0 or tracked_count <= 0:
        return None
    coverage_score = tracked_count / available_count
    continuity_score = mean_match_score if mean_match_score is not None else (1.0 if tracked_count == 1 else 0.5)
    reset_penalty = min(reset_count * 0.12, 0.36)
    gap_penalty = min(gap_count * 0.08, 0.32)
    score = 0.55 * continuity_score + 0.45 * coverage_score - reset_penalty - gap_penalty
    return round(float(max(0.0, min(1.0, score))), 3)


def _track_confidence_label(score: float | None) -> str:
    if score is None:
        return "无可用轨迹"
    if score >= 0.75:
        return "高"
    if score >= 0.55:
        return "中"
    if score >= 0.35:
        return "低"
    return "很低"


def _shape_similarity(previous_object: dict[str, object], current_object: dict[str, object]) -> float:
    pixel_similarity = _ratio_similarity(
        float(previous_object.get("pixel_count", 0) or 0),
        float(current_object.get("pixel_count", 0) or 0),
    )
    length_similarity = _ratio_similarity(
        float(previous_object.get("length_km", 0) or 0),
        float(current_object.get("length_km", 0) or 0),
    )
    return float((pixel_similarity + length_similarity) / 2)


def _ratio_similarity(previous_value: float, current_value: float) -> float:
    denominator = max(abs(previous_value), abs(current_value), 1.0)
    return max(0.0, 1.0 - abs(previous_value - current_value) / denominator)


def _bbox_overlap_ratio(previous_bbox: list[object], current_bbox: list[object]) -> float:
    if len(previous_bbox) != 4 or len(current_bbox) != 4:
        return 0.0
    try:
        prev_west, prev_south, prev_east, prev_north = [float(value) for value in previous_bbox]
        curr_west, curr_south, curr_east, curr_north = [float(value) for value in current_bbox]
    except (TypeError, ValueError):
        return 0.0

    west = max(prev_west, curr_west)
    south = max(prev_south, curr_south)
    east = min(prev_east, curr_east)
    north = min(prev_north, curr_north)
    if east <= west or north <= south:
        return 0.0

    intersection = (east - west) * (north - south)
    previous_area = max(0.0, (prev_east - prev_west) * (prev_north - prev_south))
    current_area = max(0.0, (curr_east - curr_west) * (curr_north - curr_south))
    union = previous_area + current_area - intersection
    if union <= 0:
        return 0.0
    return float(intersection / union)


def _step_status(
    matched_by: str,
    distance_from_previous_km: float | None,
    match_distance_km: float,
    match_score: float | None = None,
) -> str:
    if matched_by == "query_anchor":
        return "首日按查询点最近对象锚定"
    if matched_by == "centroid_continuity":
        return (
            f"按上一日质心连续性匹配，位移 {distance_from_previous_km:.2f} km"
            if distance_from_previous_km is not None
            else "按上一日质心连续性匹配"
        )
    if matched_by == "centroid_shape_overlap":
        suffix = f"，匹配分数 {match_score:.2f}" if match_score is not None else ""
        return (
            f"综合质心/形态/bbox 匹配，位移 {distance_from_previous_km:.2f} km{suffix}"
            if distance_from_previous_km is not None
            else f"综合质心/形态/bbox 匹配{suffix}"
        )
    if matched_by == "query_anchor_reset":
        return f"上一日对象超过 {match_distance_km:.0f} km 阈值，已重新按查询点最近对象锚定"
    return "已匹配最近锋面对象"


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    result = float(value)
    return result if np.isfinite(result) else None


def _property_float(value: float | None, fallback: float) -> float:
    return value if value is not None else fallback


def _tracking_status(steps: list[FrontTrackStep]) -> str:
    tracked = [step for step in steps if step.front_id is not None]
    if not tracked:
        return "连续窗口内未检测到可追踪锋面对象"
    if len(tracked) == 1:
        return "仅检测到单日锋面对象，暂不能形成位移趋势"
    return f"已形成 {len(tracked)} 个日期的最近锋面对象追踪"
