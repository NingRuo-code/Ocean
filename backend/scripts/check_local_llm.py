from __future__ import annotations

import argparse
import shutil
import sys
from datetime import date

from app.ai_agent import analyze_request, capabilities_response, health_response
from app.config import settings
from app.schemas import AiAnalysisRequest

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check local LLM integration for the offline AI agent.")
    parser.add_argument("--provider", choices=["rules", "ollama", "llamacpp", "llama.cpp", "openai-compatible"])
    parser.add_argument("--endpoint")
    parser.add_argument("--model")
    parser.add_argument("--timeout", type=float)
    parser.add_argument(
        "--run-parser",
        action="store_true",
        help="run one sample task through the AI parser and deterministic tool planner",
    )
    args = parser.parse_args()

    if args.provider:
        settings.ai_provider = args.provider
    if args.endpoint:
        settings.local_llm_endpoint = args.endpoint
    if args.model:
        settings.local_llm_model = args.model
    if args.timeout is not None:
        settings.ai_timeout_seconds = args.timeout

    provider = settings.ai_provider.lower()
    command_hint = _command_hint(provider)
    capabilities = capabilities_response()
    health = health_response()
    print("离线 AI 本地模型诊断")
    print(f"- provider：{settings.ai_provider}")
    print(f"- active model：{health.model}")
    print(f"- configured local model：{settings.local_llm_model}")
    print(f"- endpoint：{settings.local_llm_endpoint}")
    print(f"- timeout：{settings.ai_timeout_seconds}s")
    if command_hint:
        executable = shutil.which(command_hint)
        print(f"- 本地命令 {command_hint}：{'已发现 ' + executable if executable else '未发现'}")

    print(f"- 支持工具数：{len(capabilities.supported_tools)}")
    print(f"- 健康状态：{'可用' if health.local_model_available else '不可用'}")
    print(f"- 说明：{health.local_model_status}")

    if args.run_parser:
        response = analyze_request(
            AiAnalysisRequest(
                message="分析 2024-08-05 东经124.5 北纬30.2 附近1度范围的锋面，并解释历史概率",
                default_date=date(2024, 8, 5),
                default_longitude=124.5,
                default_latitude=30.2,
                default_radius_deg=1.0,
            )
        )
        print("样例解析：")
        print(f"- intent：{response.structured_task.intent}")
        print(f"- tasks：{', '.join(response.structured_task.tasks)}")
        print(f"- assumptions：{'; '.join(response.structured_task.assumptions) or '无'}")
        print(f"- tool_calls：{len(response.tool_calls)}")
        print(f"- evidence：{len(response.evidence)}")
    return 0 if health.local_model_available else 2


def _command_hint(provider: str) -> str | None:
    if provider == "ollama":
        return "ollama"
    if provider in {"llamacpp", "llama.cpp"}:
        return "llama-server"
    return None


if __name__ == "__main__":
    raise SystemExit(main())
