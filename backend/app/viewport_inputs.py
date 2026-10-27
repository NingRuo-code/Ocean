"""Typed display-export inputs; never qualify raw sources for research."""

import math
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

Finite = Annotated[float, Field(strict=True, allow_inf_nan=False)]
Positive = Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]
Count = Annotated[int, Field(strict=True, gt=0)]
NonNegative = Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)]


def _verify_hours_meaning(value):
    if not isinstance(value, dict):
        return value
    for metadata in (value, value.get("source")):
        if not isinstance(metadata, dict):
            continue
        if "unit" in metadata and metadata["unit"] not in ("fishing_hours", "hours", "h"):
            raise ValueError("Response is not declared in hours")
        if "metric" in metadata and metadata["metric"] not in (
            "apparent_fishing_effort",
            "fishing_hours",
        ):
            raise ValueError("Response metric conflicts with activity")
    return value


class StaticGrid(BaseModel):
    lon0: Finite
    lat0: Finite
    dlon: Positive
    dlat: Positive
    nx: Count
    ny: Count

    @model_validator(mode="after")
    def verify_display_grid(self):
        if self.nx * self.ny > 2_000_000:
            raise ValueError("Static display grid exceeds input budget")
        if not (-180 <= self.lon0 <= 180 and -90 <= self.lat0 <= 90):
            raise ValueError("Invalid display origin")
        if (
            self.lon0 + self.dlon * (self.nx - 1) > 180 + 1e-6
            or self.lat0 + self.dlat * (self.ny - 1) > 90 + 1e-6
        ):
            raise ValueError("Invalid display extent")
        return self


Point = tuple[Finite, Finite]


class FrontObject(BaseModel):
    front_id: Annotated[str, Field(strict=True, min_length=1)]
    line: Annotated[list[Point], Field(min_length=2)]
    centroid: Point
    bbox: tuple[Finite, Finite, Finite, Finite]
    pixel_count: Annotated[int, Field(strict=True, ge=0)] | None = None
    length_km: NonNegative | None = None
    codes: list[StrictInt] = Field(default_factory=list)

    @model_validator(mode="after")
    def verify_geometry(self):
        west, south, east, north = self.bbox
        if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
            raise ValueError("Invalid front bounds")
        for lon, lat in [*self.line, self.centroid]:
            if not (west - 1e-4 <= lon <= east + 1e-4 and south - 1e-4 <= lat <= north + 1e-4):
                raise ValueError("Front coordinates conflict with bounds")
        return self


class DayExport(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: str | None = None
    grid: StaticGrid
    objects: list[Any]


class SstExport(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: str | None = None
    grid: StaticGrid
    bin_c: Positive
    product: dict[str, Any]
    runs: list[tuple[StrictInt, StrictInt, StrictInt, StrictInt]]

    @model_validator(mode="after")
    def verify_display_encoding(self):
        if self.product.get("unit") != "degree_C":
            raise ValueError("Unverified display temperature unit")
        if "bin_c" in self.product and self.product["bin_c"] != self.bin_c:
            raise ValueError("Conflicting display bin size")
        for row, start, count, _ in self.runs:
            if not (
                0 <= row < self.grid.ny
                and 0 <= start < self.grid.nx
                and count > 0
                and start + count <= self.grid.nx
            ):
                raise ValueError("Invalid display run")
        for _, _, _, bin_value in self.runs:
            try:
                finite = math.isfinite(bin_value * self.bin_c)
            except OverflowError:
                finite = False
            if not finite:
                raise ValueError("Decoded temperature is not finite")
        previous_row, previous_end = -1, -1
        for row, start, count, _ in sorted(self.runs):
            if row == previous_row and start < previous_end:
                raise ValueError("Overlapping display runs")
            previous_row, previous_end = row, start + count
        return self


class ResponseIdentity(BaseModel):
    model_config = ConfigDict(extra="ignore")

    front_id: Annotated[str, Field(strict=True, min_length=1)]
    buffer_km: NonNegative | None = None


class ResponseRecord(ResponseIdentity):
    model_config = ConfigDict(extra="allow")

    date: str | None = None
    coverage_status: Literal["available", "ready", "valid", "complete", "partial"]
    status: Literal["available", "ready", "valid", "complete", "partial", "ok"] | None = None
    post1_3_hours: NonNegative
    pre7_hours: NonNegative | None = None
    non_front_control_hours: NonNegative | None = None
    lift_percent: Finite | None = None
    enhanced_flag: Annotated[bool, Field(strict=True)] | None = None

    @model_validator(mode="before")
    @classmethod
    def verify_meaning(cls, value):
        return _verify_hours_meaning(value)


class ResponseExport(BaseModel):
    model_config = ConfigDict(extra="ignore")

    source: dict[str, Any] | None = None
    unit: str | None = None
    metric: str | None = None
    status: str | None = None
    by_date: dict[str, Any] = Field(default_factory=dict)
    events: list[Any] = Field(default_factory=list)
    time_window: dict[str, Any] | None = None
    spatial_window: dict[str, Any] | None = None

    @model_validator(mode="before")
    @classmethod
    def verify_meaning(cls, value):
        return _verify_hours_meaning(value)

    @model_validator(mode="after")
    def verify_explicit_meaning(self):
        if "status" in self.model_fields_set and self.status not in {
            "real",
            "synthetic",
            "fixture",
            "available",
            "ready",
            "complete",
            "partial",
            "ok",
        }:
            raise ValueError("Response source is not available")
        return self
