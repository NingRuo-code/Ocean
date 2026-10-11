from __future__ import annotations

import argparse
import sys
import warnings
from dataclasses import dataclass

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


@dataclass(frozen=True)
class Query:
    observation_date: str
    longitude: float
    latitude: float
    radius_deg: float

    @property
    def params(self) -> str:
        return (
            f"longitude={self.longitude}"
            f"&latitude={self.latitude}"
            f"&radius_deg={self.radius_deg}"
        )


def _get_json(client: TestClient, endpoint: str) -> dict[str, object]:
    response = client.get(endpoint)
    if response.status_code != 200:
        raise RuntimeError(f"{endpoint} -> HTTP {response.status_code}: {response.text}")
    return response.json()


def run_smoke(query: Query) -> None:
    client = TestClient(app)
    index = _get_json(client, f"/api/history/index?{query.params}")
    history = _get_json(client, f"/api/history/{query.observation_date}?{query.params}")
    probability = _get_json(
        client,
        f"/api/history/{query.observation_date}/probability?{query.params}",
    )
    monthly = _get_json(client, f"/api/history/{query.observation_date}/monthly?{query.params}")
    local = _get_json(
        client,
        f"/api/history/{query.observation_date}/local-records?{query.params}",
    )

    summary = history["summary"]
    selected_month = monthly["selected"]
    print("第 5—8 周历史统计 smoke 检查通过")
    print(f"- 数据就绪：{index['ready']}")
    print(f"- front 文件数：{index['front_file_count']}")
    print(f"- SST 文件数：{index['sst_file_count']}")
    print(f"- 日期范围：{index['available_date_start']} / {index['available_date_end']}")
    print(f"- 同期概率：{summary['same_period_probability']}")
    print(f"- 月度概率：{summary['monthly_probability']}")
    print(f"- 概率接口同期样本：{len(probability['same_period_records'])}")
    print(
        "- 选中月份样本："
        f"{selected_month['sample_count'] if selected_month else 0}"
    )
    print(f"- 局地追溯源文件：{len(local['source_files'])}")
    print(f"- 缓存状态：{history['cache']['hit']} / {history['cache']['key']}")
    print(
        "- 查询引擎："
        f"{history['cache']['metadata_source']} / "
        f"{history['cache']['records_evaluated']} 条实时计算 / "
        f"{history['cache']['timeline_record_count']} 条时间线 / "
        f"{history['cache']['duration_ms']} ms"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run phase-2 history statistics smoke checks.")
    parser.add_argument("--date", default="2024-08-05")
    parser.add_argument("--longitude", type=float, default=124.5)
    parser.add_argument("--latitude", type=float, default=30.2)
    parser.add_argument("--radius", type=float, default=1.0)
    args = parser.parse_args()
    try:
        run_smoke(
            Query(
                observation_date=args.date,
                longitude=args.longitude,
                latitude=args.latitude,
                radius_deg=args.radius,
            )
        )
    except RuntimeError as exc:
        print(f"Smoke 检查失败：{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
