"""Read-only S01: explicitly allowed authored exploration cases, no target-data intake."""

import calendar
import re
from datetime import date
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import Field, model_validator

from .analysis_support import content_id, read_controlled_input
from .comparison_models import Identity, SnapshotPack
from .monthly_models import ClosedModel
from .published_months import project_public_month

EXAMPLES = Path(__file__).parent / "examples"
LIBRARY = "authored-exploration/v1"
METHOD = "exact-known-circle-month-order/v1"


class CaseEntry(ClosedModel):
    case_id: Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")]
    case_type: Literal["monthly_background", "fixed_region_event", "environment", "private_case"]
    collection: Literal["exploration", "validation_holdout", "unknown"]
    access: Literal["public_aggregate", "owner_only", "unknown"]
    public_aggregate_allowed: Annotated[bool, Field(strict=True)]
    evidence_kind: Literal["synthetic_example", "real", "unknown"]
    source_result_id: Identity
    snapshot_sha256: Identity


class CaseCatalog(ClosedModel):
    schema_version: Literal["ocean-known-case-catalog/v1"] = Field(alias="schema")
    library_id: Literal["authored-exploration/v1"]
    version: Literal["known-month-cases/v1"]
    entries: Annotated[list[CaseEntry], Field(max_length=16)]

    @model_validator(mode="after")
    def unique_cases(self):
        for key in ("case_id", "source_result_id"):
            values = [getattr(entry, key) for entry in self.entries]
            if len(values) != len(set(values)):
                raise ValueError("Duplicate catalog identity")
        return self


class CaseConditions(ClosedModel):
    reference_date: Annotated[str, Field(pattern=r"^[12]\d{3}-\d{2}-\d{2}$")]
    longitude: Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
    latitude: Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
    radius_km: int
    library_id: Literal["authored-exploration/v1"] = LIBRARY
    case_type: Literal["monthly_background"] = "monthly_background"

    @model_validator(mode="after")
    def canonical_conditions(self):
        if date.fromisoformat(
            self.reference_date
        ).isoformat() != self.reference_date or self.radius_km not in {10, 20, 30}:
            raise ValueError("Unsupported condition")
        return self


class CaseSearch(CaseConditions):
    offset: Annotated[int, Field(ge=0, le=16)] = 0
    limit: Annotated[int, Field(ge=1, le=3)] = 3
    library_version: Identity | None = None

    @model_validator(mode="after")
    def stable_next_page(self):
        if self.offset and not self.library_version:
            raise ValueError("Further pages require the original library version")
        return self


class CaseDetail(CaseConditions):
    library_version: Identity


def _error(status, detail):
    raise HTTPException(status, detail, headers={"Cache-Control": "no-store"})


def _metadata(entry, original):
    p = original["parameters"]
    year, month = map(int, p["month"].split("-"))
    return {
        "case_id": entry.case_id,
        "case_type": "monthly_background",
        "month": p["month"],
        "period_start": p["month"] + "-01",
        "period_end": f"{p['month']}-{calendar.monthrange(year, month)[1]:02d}",
        "longitude": p["longitude"],
        "latitude": p["latitude"],
        "radius_km": p["radius_km"],
        "source_result_id": original["result_id"],
        "source_projection_id": original["projection_id"],
        "snapshot_sha256": entry.snapshot_sha256,
        "evidence_kind": "synthetic_example",
        "research_ready": False,
        "public_aggregate_allowed": True,
        "response_status": "not_event_response",
        "similarities": ["同一登记固定点", "相同公里范围"],
        "differences": ["A完整月背景，不是B事件响应", "季节窗口与温度/形态特征尚未接入"],
    }


def create_known_case_router(
    api_prefix="/api",
    *,
    catalog_path=EXAMPLES / "known-case-catalog.json",
    snapshots_path=EXAMPLES / "g3-known-snapshots.json",
):
    router = APIRouter(prefix=api_prefix + "/query/known-cases")

    def load():
        try:
            catalog, _ = read_controlled_input(catalog_path, CaseCatalog)
            pack, _ = read_controlled_input(snapshots_path, SnapshotPack)
        except (OSError, ValueError, TypeError):
            _error(503, "Known exploration library unavailable")
        indexed = {entry.result["result_id"]: entry for entry in pack.snapshots}
        allowed = []
        unready = 0
        for case in catalog.entries:
            if (
                case.collection != "exploration"
                or case.access != "public_aggregate"
                or case.public_aggregate_allowed is not True
                or case.evidence_kind != "synthetic_example"
                or case.case_type != "monthly_background"
            ):
                continue
            entry = indexed.get(case.source_result_id)
            if (
                entry is None
                or entry.access != "public_aggregate"
                or entry.public_aggregate_allowed is not True
            ):
                continue  # Neither enumerate nor count sources with unknown/private access.
            try:
                if entry.snapshot_sha256 != case.snapshot_sha256:
                    raise ValueError("Catalog content changed")
                original = project_public_month(entry)
                if (
                    original["source"]["id"] != "g3-known-unit-months"
                    or original["source"]["version"] != "g3-synthetic-months/v1"
                ):
                    raise ValueError("Only the registered authored source family is supported")
                allowed.append((_metadata(case, original), original))
            except (OSError, ValueError, TypeError, KeyError, ArithmeticError, AttributeError):
                unready += 1
        allowed.sort(key=lambda pair: pair[0]["case_id"])
        version = content_id(
            {
                "library": catalog.library_id,
                "version": catalog.version,
                "public_cases": [meta for meta, _ in allowed],
                "unready_public_count": unready,
            }
        )
        return allowed, version, unready

    def select(query, allowed):
        return sorted(
            [
                (meta, original)
                for meta, original in allowed
                if all(
                    meta[key] == getattr(query, key)
                    for key in ("longitude", "latitude", "radius_km")
                )
                and meta["period_end"] < query.reference_date
            ],
            key=lambda pair: (pair[0]["month"], pair[0]["case_id"]),
            reverse=True,
        )

    def conditions(query):
        return {key: getattr(query, key) for key in CaseConditions.model_fields}

    def search_id(query, version):
        return content_id(
            {"request": conditions(query), "library_version": version, "method": METHOD}
        )

    @router.get("")
    def search(query: Annotated[CaseSearch, Query()], response: Response):
        response.headers["Cache-Control"] = "no-store"
        allowed, version, unready = load()
        if query.library_version and query.library_version != version:
            _error(409, "Library version changed; start a new explicit search")
        matches = select(query, allowed)
        page = matches[query.offset : query.offset + query.limit]
        supported = any(
            all(meta[key] == getattr(query, key) for key in ("longitude", "latitude", "radius_km"))
            for meta, _ in allowed
        )
        payload = {
            "schema_version": "ocean-known-case-search/v1",
            "library_id": LIBRARY,
            "library_version": version,
            "method_version": METHOD,
            "request": conditions(query),
            "search_id": search_id(query, version),
            "evidence_kind": "synthetic_example",
            "research_ready": False,
            "exploration_only": True,
            "status": "partial"
            if unready
            else "unsupported_condition"
            if allowed and not supported
            else "available"
            if matches
            else "empty",
            "offset": query.offset,
            "limit": query.limit,
            "total": len(matches),
            "next_offset": query.offset + len(page)
            if query.offset + len(page) < len(matches)
            else None,
            "candidates": [meta for meta, _ in page],
            "unready_public_count": unready,
            "scope": {
                "kind": "registered_fixed_circles",
                "public_case_count": len(allowed),
                "first_month": min((meta["month"] for meta, _ in allowed), default=None),
                "last_month": max((meta["month"] for meta, _ in allowed), default=None),
            },
            "limitations": [
                "仅自建合成探索库，不是真实相似性或独立验证。",
                "当前严格匹配登记点/半径，按月份与ID排序；季节与环境特征未启用。",
                "A月背景不代表B事件或活动响应；私人保存案例与真实目录未接入。",
                "查询无匹配仅指当前允许且已就绪库；定位与短窗匹配待接入。",
            ],
        }
        payload["page_id"] = content_id(payload)
        return payload

    @router.get("/{case_id}")
    def detail(case_id: str, query: Annotated[CaseDetail, Query()], response: Response):
        response.headers["Cache-Control"] = "no-store"
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", case_id):
            _error(404, "Case unavailable")
        allowed, version, _ = load()
        item = next(
            (pair for pair in select(query, allowed) if pair[0]["case_id"] == case_id), None
        )
        if item is None:
            _error(404, "Case unavailable")
        if query.library_version != version:
            _error(409, "Library version changed; start a new explicit search")
        payload = {
            "schema_version": "ocean-known-case-detail/v1",
            "library_id": LIBRARY,
            "library_version": version,
            "request": conditions(query),
            "search_id": search_id(query, version),
            "case": item[0],
            "original": item[1],
            "evidence_kind": "synthetic_example",
            "research_ready": False,
            "read_only": True,
        }
        payload["detail_id"] = content_id(payload)
        return payload

    return router
