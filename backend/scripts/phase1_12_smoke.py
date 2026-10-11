from __future__ import annotations

import argparse
import sys
import warnings

warnings.filterwarnings(
    "ignore",
    message="Using `httpx` with `starlette.testclient` is deprecated.*",
    category=Warning,
)

from fastapi.testclient import TestClient

from app.main import app

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def _get_json(client: TestClient, endpoint: str) -> dict[str, object]:
    response = client.get(endpoint)
    if response.status_code != 200:
        raise RuntimeError(f"{endpoint} -> HTTP {response.status_code}: {response.text}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError(f"{endpoint} 未返回 JSON object")
    return payload


def _post_json(client: TestClient, endpoint: str, payload: dict[str, object]) -> dict[str, object]:
    response = client.post(endpoint, json=payload)
    if response.status_code != 200:
        raise RuntimeError(f"{endpoint} -> HTTP {response.status_code}: {response.text}")
    result = response.json()
    if not isinstance(result, dict):
        raise TypeError(f"{endpoint} 未返回 JSON object")
    return result


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run integrated week-1-to-12 smoke checks.")
    parser.add_argument("--date", default="2024-08-05")
    parser.add_argument("--longitude", type=float, default=124.5)
    parser.add_argument("--latitude", type=float, default=30.2)
    parser.add_argument("--radius", type=float, default=1.0)
    args = parser.parse_args()
    params = (
        f"longitude={args.longitude}"
        f"&latitude={args.latitude}"
        f"&radius_deg={args.radius}"
    )
    client = TestClient(app)
    try:
        health = _get_json(client, "/api/health")
        catalog = _get_json(client, "/api/catalog")
        manifest = _get_json(client, "/api/data/manifest")
        data_plan = _get_json(client, "/api/data/plan")
        data_index = _get_json(client, "/api/data/index")
        data_index_date = _get_json(client, f"/api/data/index/{args.date}")
        _require(health["offline"] is True, "health 未声明离线运行")
        _require(catalog["ready"] is True, "catalog 未发现本地样例数据")
        _require(manifest["paired_date_count"] > 0, "数据清单未发现 front/SST 配对日期")
        _require(data_plan["recommended_steps"], "数据准备计划缺少推荐步骤")
        _require(data_plan["download_commands"], "数据准备计划缺少参考命令")
        _require(data_index["ready"] is True, "SQLite 数据索引未就绪")
        _require(data_index["schema_version"] == "data-index-v1", "SQLite 数据索引 schema 不匹配")
        _require(data_index["paired_date_count"] > 0, "SQLite 数据索引未发现配对日期")
        _require(data_index_date["complete"] is True, f"SQLite 数据索引未命中 {args.date} 的配对文件")

        analysis = _get_json(client, f"/api/analysis/{args.date}?{params}")
        _require("layers" in analysis, "analysis 未返回地图图层")
        _require("front_band" in analysis["layers"], "analysis 未返回锋面带图层")
        _require("rasters" in analysis and "sst" in analysis["rasters"], "analysis 未返回 raster 元信息")
        _require(analysis["sst"]["range_celsius"] is not None, "analysis 未返回局地温差")
        _require(analysis["sst"]["gradient_c_per_km"] is not None, "analysis 未返回温度梯度")
        raster_response = client.get(f"/api/analysis/{args.date}/raster?{params}&kind=combined")
        _require(raster_response.status_code == 200, "raster 图像接口不可用")
        _require(raster_response.content.startswith(b"\x89PNG\r\n\x1a\n"), "raster 图像不是 PNG")
        cached_raster_response = client.get(f"/api/analysis/{args.date}/raster?{params}&kind=combined")
        _require(cached_raster_response.status_code == 200, "raster 缓存复查失败")
        _require(cached_raster_response.headers.get("x-raster-cache") == "hit", "raster 缓存未命中")

        front_objects = _get_json(client, f"/api/front-objects/{args.date}?{params}")
        tracking = _get_json(client, f"/api/front-tracking/{args.date}?{params}&days=3")
        _require("objects" in front_objects, "锋面对象接口缺少 objects")
        _require("layers" in front_objects, "锋面对象接口缺少地图图层")
        _require("steps" in tracking, "锋面追踪接口缺少 steps")
        _require("layers" in tracking, "锋面追踪接口缺少地图图层")
        _require("match_distance_km" in tracking, "锋面追踪接口缺少匹配阈值")
        _require(tracking["algorithm"] == "centroid-shape-overlap", "锋面追踪算法标识不正确")
        _require("match_score" in tracking["steps"][0], "锋面追踪缺少匹配分数字段")

        report = _get_json(client, f"/api/report/{args.date}?{params}&days=3")
        _require("html" in report and "<html" in report["html"], "HTML 报告生成失败")
        _require("锋面对象" in report["markdown"], "报告缺少锋面对象章节")

        point = _get_json(
            client,
            f"/api/point/{args.date}?longitude={args.longitude}&latitude={args.latitude}",
        )
        _require("front_class" in point, "point 未返回锋面类别")
        _require("nearest_front_distance_km" in point, "point 未返回最近锋面距离字段")
        _require(point["temperature_range_celsius"] is not None, "point 未返回局地温差")
        _require(point["temperature_gradient_c_per_km"] is not None, "point 未返回温度梯度")

        history_index = _get_json(client, f"/api/history/index?{params}")
        history = _get_json(client, f"/api/history/{args.date}?{params}")
        probability = _get_json(client, f"/api/history/{args.date}/probability?{params}")
        monthly = _get_json(client, f"/api/history/{args.date}/monthly?{params}")
        local = _get_json(client, f"/api/history/{args.date}/local-records?{params}")
        _require(history_index["ready"] is True, "history index 未就绪")
        _require(history["summary"]["same_period_probability"] is not None, "历史同期概率为空")
        _require(history["summary"]["same_period_expected_sample_count"] > 0, "历史统计缺少同期目标样本数")
        _require(history["summary"]["sample_reliability_label"], "历史统计缺少样本可信度标签")
        _require(history["summary"]["sample_coverage_note"], "历史统计缺少样本覆盖说明")
        _require("duration_ms" in history["cache"], "历史统计缓存信息缺少耗时字段")
        _require("records_evaluated" in history["cache"], "历史统计缓存信息缺少实时计算记录数")
        _require("timeline_record_count" in history["cache"], "历史统计缓存信息缺少时间线记录数")
        _require("metadata_source" in history["cache"], "历史统计缓存信息缺少索引来源")
        _require(probability["same_period_records"], "概率接口缺少参与计算记录")
        _require(monthly["monthly"], "月度统计为空")
        _require(local["source_files"], "局地历史记录缺少源文件追溯")

        capabilities = _get_json(client, "/api/ai/capabilities")
        ai_health = _get_json(client, "/api/ai/health")
        ai = _post_json(
            client,
            "/api/ai/analyze",
            {
                "message": (
                    f"分析 {args.date} 东经{args.longitude} 北纬{args.latitude} "
                    f"{args.radius}度范围的锋面，并解释历史概率和连续3日变化"
                ),
                "default_date": args.date,
                "default_longitude": args.longitude,
                "default_latitude": args.latitude,
                "default_radius_deg": args.radius,
            },
        )
        _require(capabilities["offline"] is True, "AI 能力接口未声明离线")
        _require(ai_health["checked_at"], "AI 健康检查缺少检测时间")
        _require(ai["structured_task"]["parameters"]["date"] == args.date, "AI 日期解析不正确")
        _require(ai["tool_calls"], "AI 未生成工具调用流程")
        _require(all(item["evidence_ids"] for item in ai["conclusions"]), "AI 结论缺少证据")
        _require(
            any(item["id"] == "current-temperature-structure" for item in ai["evidence"]),
            "AI 证据缺少局地温度结构",
        )
        _require(
            any(item["id"] == "front-object-summary" for item in ai["evidence"]),
            "AI 证据缺少锋面对象识别",
        )
        _require(
            any(item["name"] == "front.tracking" for item in ai["tool_calls"]),
            "AI 工具调用缺少锋面对象追踪",
        )

        ai_km = _post_json(
            client,
            "/api/ai/analyze",
            {
                "message": (
                    f"分析 {args.date} 东经{args.longitude} 北纬{args.latitude} "
                    "附近10公里锋面，并解释历史概率"
                ),
                "default_date": args.date,
                "default_longitude": args.longitude,
                "default_latitude": args.latitude,
                "default_radius_deg": args.radius,
            },
        )
        expected_10km_radius = round(10 / 111.195, 6)
        parsed_radius = ai_km["structured_task"]["parameters"]["radius_deg"]
        _require(
            abs(parsed_radius - expected_10km_radius) < 0.00001,
            "AI 未正确换算 10 km 查询范围",
        )
        _require(
            "空间范围由公里近似换算为纬度度数。"
            in ai_km["structured_task"]["assumptions"],
            "AI 未说明公里换算假设",
        )
    except RuntimeError as exc:
        print(f"前 1—12 周总体验收 smoke 失败：{exc}", file=sys.stderr)
        return 1

    print("前 1—12 周总体验收 smoke 检查通过")
    print(f"- 数据文件：{catalog['file_count']} 个")
    print(f"- 配对日期：{manifest['paired_date_count']} 个")
    print(f"- SQLite 索引：{data_index['indexed_date_count']} 日期 / {data_index['paired_date_count']} 配对")
    print(f"- 当前日期索引命中：{len(data_index_date['files'])} 个文件")
    print(f"- 数据准备建议：{len(data_plan['recommended_steps'])} 条")
    print(f"- 单日图层：{', '.join(analysis['layers'].keys())}")
    print(f"- 当前锋面线像元：{analysis['front']['line_pixels']}")
    print(f"- 锋面对象数：{front_objects['object_count']}")
    print(f"- 三日追踪状态：{tracking['status']}")
    print(f"- 追踪算法：{tracking['algorithm']}")
    print(f"- HTML 报告标题：{report['title']}")
    print(f"- 局地温差：{analysis['sst']['range_celsius']} °C")
    print(f"- 温度梯度：{analysis['sst']['gradient_c_per_km']} °C/km")
    print(f"- 点位类别：{point['front_class']}")
    print(f"- 点位温差：{point['temperature_range_celsius']} °C")
    print(f"- 历史日期范围：{history_index['available_date_start']} / {history_index['available_date_end']}")
    print(f"- 历史同期概率：{history['summary']['same_period_probability']}")
    print(f"- 样本可信度：{history['summary']['sample_reliability_label']}")
    print(f"- 同期覆盖：{history['summary']['same_period_sample_count']}/{history['summary']['same_period_expected_sample_count']}")
    print(
        "- 历史查询引擎："
        f"{'缓存命中' if history['cache']['hit'] else '现场计算'} / "
        f"{history['cache']['metadata_source']} / "
        f"{history['cache']['duration_ms']} ms"
    )
    print(f"- 月度统计样本：{monthly['selected']['sample_count'] if monthly['selected'] else 0}")
    print(f"- AI 模式：{capabilities['provider']} / {capabilities['model']}")
    print(f"- AI 健康状态：{ai_health['local_model_status']}")
    print(f"- AI 工具调用数：{len(ai['tool_calls'])}")
    print(f"- AI 证据数：{len(ai['evidence'])}")
    print(f"- AI 10km 换算半径：{ai_km['structured_task']['parameters']['radius_deg']}°")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
