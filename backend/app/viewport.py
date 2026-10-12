from __future__ import annotations

from .schemas import (
    ViewportCacheMetadata,
    ViewportCoverage,
    ViewportLayerCoverage,
    ViewportLayers,
    ViewportMeta,
    ViewportRequest,
    ViewportResolution,
    ViewportResponse,
)

FIXTURE_VERSION = "viewport-fixture-v1"


def build_fixture_viewport(request: ViewportRequest) -> ViewportResponse:
    min_lon, min_lat, max_lon, max_lat = request.bbox
    rounded_bbox = [round(value, 4) for value in request.bbox]
    center_lon = round((min_lon + max_lon) / 2, 4)
    center_lat = round((min_lat + max_lat) / 2, 4)
    front_start_lon = round(min_lon + (max_lon - min_lon) * 0.25, 4)
    front_end_lon = round(min_lon + (max_lon - min_lon) * 0.75, 4)
    front_lat = round(center_lat, 4)

    return ViewportResponse(
        meta=ViewportMeta(
            status="ok",
            source="fixture",
            date=request.date,
            bbox=rounded_bbox,
            step=request.step,
            resolution=ViewportResolution(spatial_deg=0.05),
            cache=ViewportCacheMetadata(enabled=False, hit=False, version=FIXTURE_VERSION),
        ),
        layers=ViewportLayers(
            fronts={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "frontId": "fixture-front-001",
                            "kind": "ocean_front",
                            "sideStructure": "cold_warm_side_fixture",
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[front_start_lon, front_lat], [front_end_lon, front_lat]],
                        },
                    }
                ],
            },
            sst={
                "unit": "celsius",
                "cells": [
                    {
                        "lon": center_lon,
                        "lat": center_lat,
                        "value": 24.6,
                    }
                ],
            },
            fishing_effort={
                "metric": "apparent_fishing_effort",
                "unit": "fishing_hours",
                "cells": [
                    {
                        "lon": center_lon,
                        "lat": center_lat,
                        "hours": 2.5,
                    }
                ],
            },
        ),
        coverage=ViewportCoverage(
            status="ok",
            bbox=rounded_bbox,
            layers=ViewportLayerCoverage(
                fronts="available",
                sst="available",
                fishing_effort="available",
            ),
        ),
        caveats=[
            "Fixture viewport payload for API contract validation; not a scientific result.",
            "Fishing layer uses apparent fishing effort measured as fishing hours, not catch or yield.",
        ],
    )
