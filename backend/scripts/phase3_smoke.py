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
    return response.json()


def _post_json(client: TestClient, endpoint: str, payload: dict[str, object]) -> dict[str, object]:
    response = client.post(endpoint, json=payload)
    if response.status_code != 200:
        raise RuntimeError(f"{endpoint} -> HTTP {response.status_code}: {response.text}")
    return response.json()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run phase-3 offline AI agent smoke checks.")
    parser.add_argument(
        "--message",
        default="分析 2024-08-05 东经124.5 北纬30.2 1度范围的锋面，并解释历史概率、连续3日变化和未来趋势",
    )
    parser.add_argument("--date", default="2024-08-05")
    parser.add_argument("--longitude", type=float, default=124.5)
    parser.add_argument("--latitude", type=float, default=30.2)
    parser.add_argument("--radius", type=float, default=1.0)
    args = parser.parse_args()

    client = TestClient(app)
    try:
        capabilities = _get_json(client, "/api/ai/capabilities")
        knowledge = _get_json(client, "/api/ai/knowledge")
        result = _post_json(
            client,
            "/api/ai/analyze",
            {
                "message": args.message,
                "default_date": args.date,
                "default_longitude": args.longitude,
                "default_latitude": args.latitude,
                "default_radius_deg": args.radius,
            },
        )
        evidence_ids = {item["id"] for item in result["evidence"]}
        _require(capabilities["offline"] is True, "AI 能力接口未声明离线")
        _require(len(capabilities["supported_tasks"]) >= 6, "AI 支持任务不完整")
        _require(len(knowledge["entries"]) >= 3, "本地知识库条目不足")
        _require(result["tool_calls"], "AI 未生成工具调用流程")
        _require(all(item["evidence_ids"] for item in result["tool_calls"]), "AI 工具调用缺少证据")
        _require(all(item["evidence_ids"] for item in result["conclusions"]), "AI 结论缺少证据")
        _require("structured-task-parameters" in evidence_ids, "AI 缺少结构化任务参数证据")
        _require("current-temperature-structure" in evidence_ids, "AI 缺少局地温度结构证据")
        _require("front-object-summary" in evidence_ids, "AI 缺少锋面对象证据")
        _require("front-tracking-summary" in evidence_ids, "AI 缺少锋面追踪证据")
        _require("front-prediction-baseline" in evidence_ids, "AI 缺少预测 baseline 证据")
        _require(
            any(item["name"] == "prediction.baseline" for item in result["tool_calls"]),
            "AI 工具调用缺少预测 baseline",
        )
    except RuntimeError as exc:
        print(f"Smoke 检查失败：{exc}", file=sys.stderr)
        return 1

    structured = result["structured_task"]
    print("第 9—12 周离线 AI 智能体 smoke 检查通过")
    print(f"- AI 模式：{capabilities['provider']} / {capabilities['model']}")
    print(f"- 支持任务数：{len(capabilities['supported_tasks'])}")
    print(f"- 本地知识条目：{len(knowledge['entries'])}")
    print(f"- 识别任务：{', '.join(structured['tasks'])}")
    print(f"- 结构化参数：{structured['parameters']}")
    print(f"- 工具调用数：{len(result['tool_calls'])}")
    print(f"- 证据数：{len(result['evidence'])}")
    print(f"- 结论数：{len(result['conclusions'])}")
    print(f"- 下一步推荐数：{len(result['recommendations'])}")
    print("- AI 答复摘要：")
    print(result["answer"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
