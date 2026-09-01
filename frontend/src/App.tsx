import { Activity, BarChart3, Bot, CalendarDays, Database, Download, Eye, Layers3, MapPin, RotateCcw, Search, Sparkles, ThermometerSun, Waves, X } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { getAiCapabilities, getAiHealth, getAnalysis, getCatalog, getDataIndex, getDataIndexDate, getDataManifest, getDataPreparationPlan, getFrontObjects, getFrontTracking, getHistory, getHistoryIndex, getPointQuery, getReport, runAiAnalysis, type AiAnalysisData, type AiCapabilities, type AiHealth, type Analysis, type Catalog, type DataIndex, type DataIndexDate, type DataManifest, type DataPreparationPlan, type FrontObjectData, type FrontTrackingData, type HistoryData, type HistoryIndexData, type PointQuery, type ReportData } from "./api";

const EMPTY_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "ocean-background",
      type: "background",
      paint: { "background-color": "#dce9ec" },
    },
  ],
};

const TEN_KM_RADIUS_DEG = Number((10 / 111.195).toFixed(6));
const RADIUS_OPTIONS = [
  { value: String(TEN_KM_RADIUS_DEG), label: "10 km（约 ±0.09°）" },
  { value: "0.25", label: "±0.25°" },
  { value: "0.5", label: "±0.5°" },
  { value: "1", label: "±1°" },
];
const PRESET_RADIUS_VALUES = RADIUS_OPTIONS.map((item) => item.value);
const DEFAULT_SELECTED_DATE = "2024-08-05";
const DATA_LAYER_IDS = ["sst-raster", "sst-field", "cold-zone", "warm-zone", "front-band", "front-line-glow", "front-line"] as const;
const DATA_SOURCE_IDS = ["source-sst-raster", "source-sst", "source-cold-side", "source-warm-side", "source-front-band", "source-front-line"] as const;
const OBJECT_LAYER_IDS = ["front-object-bboxes", "front-object-centroids", "front-track-lines", "front-track-points"] as const;
const OBJECT_SOURCE_IDS = ["source-front-object-bboxes", "source-front-object-centroids", "source-front-track-lines", "source-front-track-points"] as const;
const QUERY_LAYER_IDS = ["query-bounds-fill", "query-bounds-line", "query-point-halo", "query-point"] as const;
const QUERY_SOURCE_IDS = ["query-bounds", "query-point"] as const;

function normalizeRadiusValue(value: number): string {
  const preset = RADIUS_OPTIONS.find((item) => Math.abs(Number(item.value) - value) < 0.0001);
  if (preset) return preset.value;
  return String(Math.round(value * 10000) / 10000);
}

function formatRadiusLabel(value: number): string {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value - TEN_KM_RADIUS_DEG) < 0.0001) return "10 km（约 ±0.09°）";
  return `±${value.toFixed(value < 0.1 ? 4 : 2)}°`;
}

type SimpleGeoJsonFeature = {
  type: "Feature";
  properties: Record<string, string | number>;
  geometry: { type: "LineString"; coordinates: number[][] };
};

function buildGraticule(): { type: "FeatureCollection"; features: SimpleGeoJsonFeature[] } {
  const features: SimpleGeoJsonFeature[] = [];
  for (let lon = -180; lon <= 180; lon += 30) {
    features.push({
      type: "Feature",
      properties: { kind: "longitude", value: lon },
      geometry: { type: "LineString", coordinates: [[lon, -90], [lon, 90]] },
    });
  }
  for (let lat = -90; lat <= 90; lat += 15) {
    features.push({
      type: "Feature",
      properties: { kind: "latitude", value: lat },
      geometry: { type: "LineString", coordinates: [[-180, lat], [180, lat]] },
    });
  }
  return { type: "FeatureCollection", features };
}

function rasterCoordinates(bounds: number[]): [[number, number], [number, number], [number, number], [number, number]] {
  const [west, south, east, north] = bounds;
  return [[west, north], [east, north], [east, south], [west, south]];
}

function sampleTimeline<T extends { date: string }>(points: T[], limit = 72): T[] {
  if (points.length <= limit) return points;
  const stride = Math.max(1, Math.ceil(points.length / limit));
  const sampled = points.filter((_, index) => index % stride === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1)?.date !== last.date) sampled.push(last);
  return sampled.slice(0, limit);
}

function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "--";
  return `${start} / ${end}`;
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? "--" : `${(value * 100).toFixed(1)}%`;
}

function formatTemperature(value: number | null | undefined): string {
  return value == null ? "--" : `${value.toFixed(2)} °C`;
}

function formatGradient(value: number | null | undefined): string {
  return value == null ? "--" : `${value.toFixed(5)} °C/km`;
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}`;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value < 1000 ? `${value.toFixed(1)} ms` : `${(value / 1000).toFixed(2)} s`;
}

function formatMetadataSource(value: string | null | undefined): string {
  if (value === "sqlite-index") return "SQLite 元数据索引";
  if (value === "directory-scan") return "目录扫描";
  return value || "--";
}

function formatDatePreview(dates: string[], limit = 5): string {
  if (!dates.length) return "--";
  const preview = dates.slice(0, limit).join(" / ");
  return dates.length > limit ? `${preview} 等 ${dates.length} 个` : preview;
}

function App() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [dataManifest, setDataManifest] = useState<DataManifest | null>(null);
  const [dataManifestError, setDataManifestError] = useState<string | null>(null);
  const [dataIndex, setDataIndex] = useState<DataIndex | null>(null);
  const [dataIndexError, setDataIndexError] = useState<string | null>(null);
  const [dataIndexDate, setDataIndexDate] = useState<DataIndexDate | null>(null);
  const [dataIndexDateError, setDataIndexDateError] = useState<string | null>(null);
  const [dataPlan, setDataPlan] = useState<DataPreparationPlan | null>(null);
  const [dataPlanError, setDataPlanError] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState<HistoryIndexData | null>(null);
  const [historyIndexError, setHistoryIndexError] = useState<string | null>(null);
  const [aiCapabilities, setAiCapabilities] = useState<AiCapabilities | null>(null);
  const [aiHealth, setAiHealth] = useState<AiHealth | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedDate, setSelectedDate] = useState(DEFAULT_SELECTED_DATE);
  const [longitude, setLongitude] = useState("124.5");
  const [latitude, setLatitude] = useState("30.2");
  const [radius, setRadius] = useState("1");
  const [querying, setQuerying] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [frontObjectError, setFrontObjectError] = useState<string | null>(null);
  const [frontTrackingError, setFrontTrackingError] = useState<string | null>(null);
  const [visibleLayers, setVisibleLayers] = useState({ sst: true, front_band: true, front_line: true, cold_side: true, warm_side: true, front_objects: true, tracking: true });
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [pointQuery, setPointQuery] = useState<PointQuery | null>(null);
  const [frontObjects, setFrontObjects] = useState<FrontObjectData | null>(null);
  const [frontTracking, setFrontTracking] = useState<FrontTrackingData | null>(null);
  const [aiPrompt, setAiPrompt] = useState("分析 2024-08-05 东经124.5 北纬30.2 1度范围的锋面，并解释历史概率");
  const [aiResult, setAiResult] = useState<AiAnalysisData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!mapNode.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      style: EMPTY_STYLE,
      center: [124.5, 30.2],
      zoom: 4.5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    map.on("load", () => {
      if (!map.getSource("offline-graticule")) {
        map.addSource("offline-graticule", { type: "geojson", data: buildGraticule() });
        map.addLayer({
          id: "offline-graticule",
          type: "line",
          source: "offline-graticule",
          paint: { "line-color": "#91a9ae", "line-width": 0.55, "line-opacity": 0.35 },
        });
      }
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !analysis) return;
    const applyLayers = () => {
      for (const layerId of DATA_LAYER_IDS) if (map.getLayer(layerId)) map.removeLayer(layerId);
      for (const layerId of OBJECT_LAYER_IDS) if (map.getLayer(layerId)) map.removeLayer(layerId);
      for (const sourceId of DATA_SOURCE_IDS) if (map.getSource(sourceId)) map.removeSource(sourceId);
      for (const sourceId of OBJECT_SOURCE_IDS) if (map.getSource(sourceId)) map.removeSource(sourceId);

      const sstRaster = analysis.rasters.sst && analysis.rasters.sst.width > 0 && analysis.rasters.sst.height > 0
        ? analysis.rasters.sst
        : null;
      if (sstRaster) {
        map.addSource("source-sst-raster", {
          type: "image",
          url: sstRaster.url,
          coordinates: rasterCoordinates(sstRaster.bounds),
        });
        map.addLayer({
          id: "sst-raster",
          type: "raster",
          source: "source-sst-raster",
          paint: { "raster-opacity": 0.95, "raster-fade-duration": 0 },
        });
      }

      map.addSource("source-sst", { type: "geojson", data: analysis.layers.sst as never });
      map.addLayer({
        id: "sst-field",
        type: "fill",
        source: "source-sst",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "value"],
            22,
            "#225ea8",
            25,
            "#41b6c4",
            28,
            "#ffffbf",
            30,
            "#fdae61",
            33,
            "#d7191c",
          ],
          "fill-opacity": sstRaster ? 0.04 : 0.86,
          "fill-outline-color": sstRaster ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
        },
      });

      map.addSource("source-cold-side", { type: "geojson", data: analysis.layers.cold_side as never });
      map.addLayer({
        id: "cold-zone",
        type: "fill",
        source: "source-cold-side",
        paint: {
          "fill-color": "#164f93",
          "fill-opacity": 0.26,
          "fill-outline-color": "rgba(22,79,147,0.12)",
        },
      });

      map.addSource("source-warm-side", { type: "geojson", data: analysis.layers.warm_side as never });
      map.addLayer({
        id: "warm-zone",
        type: "fill",
        source: "source-warm-side",
        paint: {
          "fill-color": "#d85b3f",
          "fill-opacity": 0.23,
          "fill-outline-color": "rgba(216,91,63,0.12)",
        },
      });

      map.addSource("source-front-band", { type: "geojson", data: analysis.layers.front_band as never });
      map.addLayer({
        id: "front-band",
        type: "fill",
        source: "source-front-band",
        paint: {
          "fill-color": [
            "match",
            ["get", "value"],
            -10,
            "#221d1d",
            10,
            "#463327",
            30,
            "#6b4a24",
            "#2b2725",
          ],
          "fill-opacity": 0.58,
          "fill-outline-color": "rgba(255,236,176,0.45)",
        },
      });

      map.addSource("source-front-line", { type: "geojson", data: analysis.layers.front_line as never });
      map.addLayer({
        id: "front-line-glow",
        type: "line",
        source: "source-front-line",
        paint: { "line-color": "#ffcf5a", "line-width": 7, "line-opacity": 0.62 },
      });
      map.addLayer({
        id: "front-line",
        type: "line",
        source: "source-front-line",
        paint: { "line-color": "#121313", "line-width": 2.4, "line-opacity": 0.96 },
      });

      if (frontObjects?.layers.bboxes && frontObjects.object_count > 0) {
        map.addSource("source-front-object-bboxes", { type: "geojson", data: frontObjects.layers.bboxes as never });
        map.addLayer({
          id: "front-object-bboxes",
          type: "line",
          source: "source-front-object-bboxes",
          paint: { "line-color": "#14a46b", "line-width": 2.2, "line-opacity": 0.82, "line-dasharray": [2, 1.2] },
        });
        map.addSource("source-front-object-centroids", { type: "geojson", data: frontObjects.layers.centroids as never });
        map.addLayer({
          id: "front-object-centroids",
          type: "circle",
          source: "source-front-object-centroids",
          paint: {
            "circle-radius": 6,
            "circle-color": "#16c784",
            "circle-stroke-color": "#063f2b",
            "circle-stroke-width": 1.4,
            "circle-opacity": 0.9,
          },
        });
      }

      if (frontTracking?.layers.track_points && frontTracking.tracked_step_count > 0) {
        map.addSource("source-front-track-lines", { type: "geojson", data: frontTracking.layers.track_lines as never });
        map.addLayer({
          id: "front-track-lines",
          type: "line",
          source: "source-front-track-lines",
          paint: { "line-color": "#7a5cff", "line-width": 2.4, "line-opacity": 0.78, "line-dasharray": [1.4, 1.2] },
        });
        map.addSource("source-front-track-points", { type: "geojson", data: frontTracking.layers.track_points as never });
        map.addLayer({
          id: "front-track-points",
          type: "circle",
          source: "source-front-track-points",
          paint: {
            "circle-radius": 4.8,
            "circle-color": "#7a5cff",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.2,
            "circle-opacity": 0.9,
          },
        });
      }

      if (map.getLayer("offline-graticule")) map.moveLayer("offline-graticule");
      if (!visibleLayers.sst) {
        if (map.getLayer("sst-raster")) map.setLayoutProperty("sst-raster", "visibility", "none");
        map.setLayoutProperty("sst-field", "visibility", "none");
      }
      if (!visibleLayers.cold_side) map.setLayoutProperty("cold-zone", "visibility", "none");
      if (!visibleLayers.warm_side) map.setLayoutProperty("warm-zone", "visibility", "none");
      if (!visibleLayers.front_band) map.setLayoutProperty("front-band", "visibility", "none");
      if (!visibleLayers.front_line) {
        map.setLayoutProperty("front-line-glow", "visibility", "none");
        map.setLayoutProperty("front-line", "visibility", "none");
      }
      if (!visibleLayers.front_objects) {
        if (map.getLayer("front-object-bboxes")) map.setLayoutProperty("front-object-bboxes", "visibility", "none");
        if (map.getLayer("front-object-centroids")) map.setLayoutProperty("front-object-centroids", "visibility", "none");
      }
      if (!visibleLayers.tracking) {
        if (map.getLayer("front-track-lines")) map.setLayoutProperty("front-track-lines", "visibility", "none");
        if (map.getLayer("front-track-points")) map.setLayoutProperty("front-track-points", "visibility", "none");
      }
      const west = analysis.longitude - analysis.radius_deg;
      const east = analysis.longitude + analysis.radius_deg;
      const south = analysis.latitude - analysis.radius_deg;
      const north = analysis.latitude + analysis.radius_deg;
      const boundsGeoJson = { type: "Feature", geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }, properties: {} };
      if (map.getLayer("query-bounds-fill")) map.removeLayer("query-bounds-fill");
      if (map.getLayer("query-bounds-line")) map.removeLayer("query-bounds-line");
      if (map.getSource("query-bounds")) map.removeSource("query-bounds");
      map.addSource("query-bounds", { type: "geojson", data: boundsGeoJson as never });
      map.addLayer({ id: "query-bounds-fill", type: "fill", source: "query-bounds", paint: { "fill-color": "#0b7483", "fill-opacity": 0.05 } });
      map.addLayer({ id: "query-bounds-line", type: "line", source: "query-bounds", paint: { "line-color": "#0b7483", "line-width": 1.5, "line-dasharray": [2, 2] } });
      const queryPointGeoJson = { type: "Feature", geometry: { type: "Point", coordinates: [analysis.longitude, analysis.latitude] }, properties: {} };
      if (map.getLayer("query-point-halo")) map.removeLayer("query-point-halo");
      if (map.getLayer("query-point")) map.removeLayer("query-point");
      if (map.getSource("query-point")) map.removeSource("query-point");
      map.addSource("query-point", { type: "geojson", data: queryPointGeoJson as never });
      map.addLayer({
        id: "query-point-halo",
        type: "circle",
        source: "query-point",
        paint: { "circle-radius": 9, "circle-color": "#ffffff", "circle-opacity": 0.85 },
      });
      map.addLayer({
        id: "query-point",
        type: "circle",
        source: "query-point",
        paint: { "circle-radius": 5, "circle-color": "#0b7483", "circle-stroke-color": "#17363d", "circle-stroke-width": 1.5 },
      });
      for (const layerId of ["sst-field", "cold-zone", "warm-zone", "front-band", "front-line", "front-object-bboxes", "front-object-centroids", "front-track-lines", "front-track-points"]) {
        if (!map.getLayer(layerId)) continue;
        map.off("click", layerId, handleLayerClick);
        map.on("click", layerId, handleLayerClick);
      }
      map.fitBounds([[analysis.longitude - analysis.radius_deg, analysis.latitude - analysis.radius_deg], [analysis.longitude + analysis.radius_deg, analysis.latitude + analysis.radius_deg]], { padding: 70, maxZoom: 7, duration: 500 });
    };
    const handleLayerClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      const layerLabel = {
        "sst-field": "海表温度场",
        "cold-zone": "冷侧区域",
        "warm-zone": "暖侧区域",
        "front-band": "锋面带",
        "front-line": "锋面中心线",
        "front-object-bboxes": "锋面对象范围",
        "front-object-centroids": "锋面对象质心",
        "front-track-lines": "多日追踪路径",
        "front-track-points": "多日追踪节点",
      }[feature.layer.id] ?? "图层";
      const value = Number((feature.properties as { value?: number } | null)?.value);
      const properties = feature.properties as Record<string, unknown> | null;
      const frontId = properties?.front_id ? String(properties.front_id) : null;
      const dateText = properties?.date ? `<br />日期：${String(properties.date)}` : "";
      const objectText = frontId ? `<br />对象：${frontId}` : "";
      const valueText = feature.layer.id === "sst-field"
        ? `${value.toFixed(2)} °C`
        : feature.layer.id === "cold-zone"
        ? "冷侧"
        : feature.layer.id === "warm-zone"
        ? "暖侧"
        : frontId
        ? `锋面对象 ${frontId}`
        : Number.isFinite(value)
        ? `锋面编码 ${value}`
        : "--";
      new maplibregl.Popup({ closeButton: true, maxWidth: "220px" })
        .setLngLat(coordinates)
        .setHTML(`<strong>${layerLabel}</strong><br />${coordinates[0].toFixed(3)}°E, ${coordinates[1].toFixed(3)}°N${dateText}${objectText}<br />读数：${Number.isFinite(value) || frontId ? valueText : "--"}`)
        .addTo(map);
    };
    if (map.isStyleLoaded()) applyLayers();
    else map.once("load", applyLayers);
  }, [analysis, frontObjects, frontTracking, visibleLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (!analysis) return;
      const { lng, lat } = event.lngLat;
      if (Math.abs(lng - analysis.longitude) > analysis.radius_deg || Math.abs(lat - analysis.latitude) > analysis.radius_deg) {
        setAnalysisError("点位位于当前查询范围之外，请先调整分析范围或重新查询");
        return;
      }
      getPointQuery(selectedDate, lng, lat)
        .then((result) => {
          setPointQuery(result);
          new maplibregl.Popup({ closeButton: true, maxWidth: "240px" })
            .setLngLat([lng, lat])
            .setHTML(`<strong>点位查询</strong><br />${lng.toFixed(3)}°E, ${lat.toFixed(3)}°N<br />SST：${result.sst_celsius?.toFixed(2) ?? "--"} °C<br />类别：${result.front_class}<br />距锋面：${result.nearest_front_distance_km?.toFixed(2) ?? "--"} km`)
            .addTo(map);
        })
        .catch((error: unknown) => setAnalysisError(error instanceof Error ? error.message : "点位查询失败"));
    };
    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [analysis, selectedDate]);

  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then((result) => {
        setCatalog(result);
        setCatalogLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogLoading(false);
        setCatalogError(error instanceof Error ? error.message : "无法连接数据服务");
      });
    getHistoryIndex(undefined, undefined, undefined, controller.signal)
      .then((result) => {
        setHistoryIndex(result);
        setHistoryIndexError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHistoryIndex(null);
        setHistoryIndexError(error instanceof Error ? error.message : "无法读取历史索引");
      });
    getDataManifest(controller.signal)
      .then((result) => {
        setDataManifest(result);
        setDataManifestError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDataManifest(null);
        setDataManifestError(error instanceof Error ? error.message : "无法读取数据清单");
      });
    getDataIndex(controller.signal)
      .then((result) => {
        setDataIndex(result);
        setDataIndexError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDataIndex(null);
        setDataIndexError(error instanceof Error ? error.message : "无法读取 SQLite 数据索引");
      });
    getDataIndexDate(DEFAULT_SELECTED_DATE, controller.signal)
      .then((result) => {
        setDataIndexDate(result);
        setDataIndexDateError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDataIndexDate(null);
        setDataIndexDateError(error instanceof Error ? error.message : "无法查询当前日期索引");
      });
    getDataPreparationPlan({}, controller.signal)
      .then((result) => {
        setDataPlan(result);
        setDataPlanError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDataPlan(null);
        setDataPlanError(error instanceof Error ? error.message : "无法读取数据准备计划");
      });
    getAiCapabilities(controller.signal)
      .then((result) => {
        setAiCapabilities(result);
      })
      .catch(() => {
        setAiCapabilities(null);
      });
    getAiHealth(controller.signal)
      .then((result) => {
        setAiHealth(result);
      })
      .catch(() => {
        setAiHealth(null);
      });
    return () => controller.abort();
  }, []);

  const statusText = catalogError
    ? "数据服务未连接"
    : catalogLoading
      ? "正在读取本地数据"
    : catalog?.ready
      ? `${catalog.file_count} 个数据文件`
      : "等待样例数据";

  const executeDataQuery = (queryDate: string, queryLongitude: number, queryLatitude: number, queryRadius: number) => {
    if (!Number.isFinite(queryLongitude) || !Number.isFinite(queryLatitude) || !Number.isFinite(queryRadius) || Math.abs(queryLongitude) > 180 || Math.abs(queryLatitude) > 90 || queryRadius <= 0) {
      setAnalysis(null);
      setHistoryData(null);
      setFrontObjects(null);
      setFrontTracking(null);
      setAnalysisError("请输入有效的经纬度和分析范围");
      return;
    }
    setQuerying(true);
    setAnalysisError(null);
    setHistoryError(null);
    setFrontObjectError(null);
    setFrontTrackingError(null);
    setReportError(null);
    setReportPreview(null);
    setPointQuery(null);
    setHistoryData(null);
    setFrontObjects(null);
    setFrontTracking(null);
    const analysisTask = getAnalysis(queryDate, queryLongitude, queryLatitude, queryRadius)
      .then((result) => {
        setAnalysis(result);
      })
      .catch((error: unknown) => {
        setAnalysis(null);
        setAnalysisError(error instanceof Error ? error.message : "分析失败");
      });
    const historyTask = getHistory(queryDate, queryLongitude, queryLatitude, queryRadius)
      .then((result) => {
        setHistoryData(result);
      })
      .catch((error: unknown) => {
        setHistoryData(null);
        setHistoryError(error instanceof Error ? error.message : "历史统计失败");
      });
    const frontObjectTask = getFrontObjects(queryDate, queryLongitude, queryLatitude, queryRadius)
      .then((result) => {
        setFrontObjects(result);
      })
      .catch((error: unknown) => {
        setFrontObjects(null);
        setFrontObjectError(error instanceof Error ? error.message : "锋面对象识别失败");
      });
    const frontTrackingTask = getFrontTracking(queryDate, queryLongitude, queryLatitude, queryRadius, 3)
      .then((result) => {
        setFrontTracking(result);
      })
      .catch((error: unknown) => {
        setFrontTracking(null);
        setFrontTrackingError(error instanceof Error ? error.message : "锋面追踪失败");
      });
    const indexTask = getHistoryIndex(queryLongitude, queryLatitude, queryRadius)
      .then((result) => {
        setHistoryIndex(result);
        setHistoryIndexError(null);
      })
      .catch((error: unknown) => {
        setHistoryIndexError(error instanceof Error ? error.message : "历史索引更新失败");
      });
    const dataPlanTask = getDataPreparationPlan({ reference_date: queryDate, target_days: 14 })
      .then((result) => {
        setDataPlan(result);
        setDataPlanError(null);
      })
      .catch((error: unknown) => {
        setDataPlanError(error instanceof Error ? error.message : "数据准备计划更新失败");
      });
    const dataIndexTask = getDataIndex()
      .then((result) => {
        setDataIndex(result);
        setDataIndexError(null);
      })
      .catch((error: unknown) => {
        setDataIndexError(error instanceof Error ? error.message : "SQLite 数据索引更新失败");
      });
    const dataIndexDateTask = getDataIndexDate(queryDate)
      .then((result) => {
        setDataIndexDate(result);
        setDataIndexDateError(null);
      })
      .catch((error: unknown) => {
        setDataIndexDate(null);
        setDataIndexDateError(error instanceof Error ? error.message : "日期索引查询失败");
      });
    void Promise.allSettled([analysisTask, historyTask, frontObjectTask, frontTrackingTask, indexTask, dataPlanTask, dataIndexTask, dataIndexDateTask]).finally(() => setQuerying(false));
  };

  const runAnalysis = () => {
    executeDataQuery(selectedDate, Number(longitude), Number(latitude), Number(radius));
  };

  const runAi = () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError("请输入自然语言任务");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    runAiAnalysis(prompt, {
      default_date: selectedDate,
      default_longitude: Number(longitude),
      default_latitude: Number(latitude),
      default_radius_deg: Number(radius),
    })
      .then((result) => {
        setAiResult(result);
        const params = result.structured_task.parameters;
        if (params.date && params.longitude != null && params.latitude != null && params.radius_deg != null) {
          const nextRadius = normalizeRadiusValue(params.radius_deg);
          setSelectedDate(params.date);
          setLongitude(String(params.longitude));
          setLatitude(String(params.latitude));
          setRadius(nextRadius);
          executeDataQuery(params.date, params.longitude, params.latitude, params.radius_deg);
        }
      })
      .catch((error: unknown) => {
        setAiResult(null);
        setAiError(error instanceof Error ? error.message : "AI 分析失败");
      })
      .finally(() => setAiLoading(false));
  };

  const resetQuery = () => {
    setSelectedDate(catalog?.available_dates[0] ?? "2024-08-05");
    setLongitude("124.5");
    setLatitude("30.2");
    setRadius("1");
    setAnalysis(null);
    setAnalysisError(null);
    setHistoryError(null);
    setFrontObjectError(null);
    setFrontTrackingError(null);
    setReportError(null);
    setReportPreview(null);
    setHistoryData(null);
    setPointQuery(null);
    setFrontObjects(null);
    setFrontTracking(null);
    const map = mapRef.current;
    if (map) {
      for (const layerId of [...DATA_LAYER_IDS, ...OBJECT_LAYER_IDS, ...QUERY_LAYER_IDS]) if (map.getLayer(layerId)) map.removeLayer(layerId);
      for (const sourceId of [...DATA_SOURCE_IDS, ...OBJECT_SOURCE_IDS, ...QUERY_SOURCE_IDS]) if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  };

  const exportAnalysis = () => {
    if (!analysis && !historyData) return;
    const payload = {
      exported_at: new Date().toISOString(),
      query: {
        date: selectedDate,
        longitude: Number(longitude),
        latitude: Number(latitude),
        radius_deg: Number(radius),
      },
      analysis,
      history: historyData,
      history_index: historyIndex,
      point_query: pointQuery,
      front_objects: frontObjects,
      front_tracking: frontTracking,
      ai_result: aiResult,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocean-front-report-${selectedDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadHtmlReport = (result: ReportData) => {
    const url = URL.createObjectURL(new Blob([result.html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocean-front-report-${selectedDate}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchHtmlReport = (mode: "preview" | "download") => {
    if (!analysis && !historyData) return;
    setReportLoading(true);
    setReportError(null);
    getReport(selectedDate, Number(longitude), Number(latitude), Number(radius), 3)
      .then((result) => {
        setReportPreview(result);
        if (mode === "download") downloadHtmlReport(result);
      })
      .catch((error: unknown) => {
        setReportError(error instanceof Error ? error.message : "HTML 报告生成失败");
      })
      .finally(() => setReportLoading(false));
  };

  const exportHtmlReport = () => {
    if (reportPreview) {
      downloadHtmlReport(reportPreview);
      return;
    }
    fetchHtmlReport("download");
  };

  const selectedMonth = Number(selectedDate.slice(5, 7));
  const monthlyHistoryPoint = historyData?.monthly.find((item) => item.month === selectedMonth) ?? null;
  const sampledTimeline = sampleTimeline(historyData?.timeline ?? [], 48);
  const frontGrid = historyIndex?.spatial.front_grid ?? null;
  const sstGrid = historyIndex?.spatial.sst_grid ?? null;
  const queryBbox = historyIndex?.spatial.query_bbox ?? null;
  const samePeriodPreview = historyData?.same_period_records.slice(0, 6) ?? [];
  const activeSstRaster = analysis?.rasters.sst && analysis.rasters.sst.width > 0 && analysis.rasters.sst.height > 0
    ? analysis.rasters.sst
    : null;
  const nearestFrontObject = frontObjects?.objects[0] ?? null;
  const trackedPreview = frontTracking?.steps ?? [];
  const missingSstCount = dataManifest?.missing_sst_dates.length ?? 0;
  const missingFrontCount = dataManifest?.missing_front_dates.length ?? 0;
  const duplicateDataGroupCount = (dataPlan?.duplicate_front_groups.length ?? 0) + (dataPlan?.duplicate_sst_groups.length ?? 0);
  const dataIssueCount = missingSstCount + missingFrontCount;
  const dataIndexWarningCount = dataIndex?.integrity_warnings.length ?? 0;
  const indexedFront = dataIndex?.datasets.find((dataset) => dataset.dataset_type === "front_location") ?? null;
  const indexedSst = dataIndex?.datasets.find((dataset) => dataset.dataset_type === "sst") ?? null;
  const currentIndexFilePreview = dataIndexDate?.files
    .filter((file) => file.canonical)
    .slice(0, 3)
    .map((file) => file.relative_path)
    .join(" / ") ?? "";
  const dataHealthLabel = dataManifest
    ? dataIssueCount === 0
      ? duplicateDataGroupCount === 0
        ? "配对完整"
        : `重复 ${duplicateDataGroupCount} 组`
      : `存在 ${dataIssueCount} 个缺口`
    : "等待扫描";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>海洋锋面离线分析系统</h1>
            <p>局地锋面与海温任务工作台</p>
          </div>
        </div>
        <div className="system-status" data-state={catalog?.ready ? "ready" : "waiting"}>
          <Database size={16} />
          <span>{statusText}</span>
        </div>
      </header>

      <section className="taskbar" aria-label="查询条件">
        <div className="taskbar-title">
          <strong>任务参数</strong>
          <span>选择日期、经纬度和空间范围，生成离线锋面图像与历史统计。</span>
        </div>
        <label>
            <span><CalendarDays size={15} /> 日期</span>
            <input type="date" value={selectedDate} min={catalog?.available_dates[0]} max={catalog?.available_dates.at(-1)} onChange={(event) => setSelectedDate(event.target.value)} disabled={!catalog?.ready} />
        </label>
        <label>
          <span><MapPin size={15} /> 经度</span>
            <input type="number" value={longitude} step="0.1" onChange={(event) => setLongitude(event.target.value)} />
        </label>
        <label>
          <span><MapPin size={15} /> 纬度</span>
            <input type="number" value={latitude} step="0.1" onChange={(event) => setLatitude(event.target.value)} />
        </label>
        <label>
          <span>分析范围</span>
          <select value={radius} onChange={(event) => setRadius(event.target.value)}>
            {!PRESET_RADIUS_VALUES.includes(radius) && Number.isFinite(Number(radius)) && (
              <option value={radius}>{formatRadiusLabel(Number(radius))} / AI</option>
            )}
            {RADIUS_OPTIONS.map((item) => (
              <option value={item.value} key={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <div className="task-actions">
          <button className="icon-button" type="button" title="重置查询" aria-label="重置查询" onClick={resetQuery}>
            <RotateCcw size={17} />
          </button>
          <button className="primary-button" type="button" disabled={!catalog?.ready || querying} onClick={runAnalysis}>
            <Search size={17} /> 查询
          </button>
        </div>
      </section>

      <section className="workspace">
        <div className="map-panel">
          <div ref={mapNode} className="map-canvas" aria-label="海洋锋面地图" />
          {!analysis && <div className="map-empty-state">
            <Layers3 size={22} />
            <strong>{catalogLoading ? "正在读取本地数据" : analysis ? "已完成局地分析" : "等待查询"}</strong>
            <span>{analysisError ?? catalogError ?? catalog?.message ?? "正在检查本地数据目录"}</span>
          </div>}
          {querying && (
            <div className="map-busy">
              <span className="loading-pulse" />
              正在生成离线图像图层与统计结果
            </div>
          )}
          {analysis && (
            <div className="map-readout" aria-label="图像读数">
              <article>
                <ThermometerSun size={16} />
                <span>海温场</span>
                <strong>{formatTemperature(analysis.sst.mean)}</strong>
                <small>{activeSstRaster ? `${activeSstRaster.width} × ${activeSstRaster.height} raster` : "GeoJSON 面场"} · 温差 {formatTemperature(analysis.sst.range_celsius)}</small>
              </article>
              <article>
                <Waves size={16} />
                <span>锋面表达</span>
                <strong>{analysis.front.status}</strong>
                <small>{analysis.front.line_pixels} 个锋面线像元</small>
              </article>
              <article>
                <Layers3 size={16} />
                <span>对象识别</span>
                <strong>{frontObjects ? `${frontObjects.object_count} 个对象` : "--"}</strong>
                <small>{nearestFrontObject ? `最近 ${nearestFrontObject.nearest_to_query_km?.toFixed(2) ?? "--"} km` : "等待对象分析"}</small>
              </article>
              <article>
                <Activity size={16} />
                <span>局地梯度</span>
                <strong>{formatGradient(analysis.sst.gradient_c_per_km)}</strong>
                <small>最大 {formatGradient(analysis.sst.max_gradient_c_per_km)}</small>
              </article>
            </div>
          )}
          <div className="map-caption" aria-label="图像解读">
            <strong>图像解读</strong>
            <span>底色为 SST 温度场；蓝/橙色面为冷暖侧；深色带和金色辉光标记锋面位置；绿色框/点表示锋面对象，紫色虚线表示多日追踪。</span>
          </div>
          <div className="legend" aria-label="图像图层">
            <strong>图像图层</strong>
            {(["sst", "front_band", "front_line", "front_objects", "tracking", "cold_side", "warm_side"] as const).map((key) => (
              <label className="layer-toggle" key={key}>
                <input type="checkbox" checked={visibleLayers[key]} onChange={(event) => setVisibleLayers((current) => ({ ...current, [key]: event.target.checked }))} />
                <i className={`swatch ${key === "front_line" ? "front" : key === "front_band" ? "front-band" : key === "cold_side" ? "cold" : key === "warm_side" ? "warm" : key === "front_objects" ? "objects" : key === "tracking" ? "tracking" : "sst"}`} />
                {key === "sst" ? "SST 温度场" : key === "front_band" ? "锋面带" : key === "front_line" ? "锋面中心线" : key === "front_objects" ? "锋面对象" : key === "tracking" ? "多日追踪" : key === "cold_side" ? "冷侧区" : "暖侧区"}
              </label>
            ))}
            <div className="temperature-scale" aria-label="SST 色标">
              <i />
              <span>低温</span>
              <span>高温</span>
            </div>
          </div>
        </div>

        <aside className="side-panel">
          <nav className="function-map" aria-label="功能分区">
            <span>01 当前查询</span>
            <span>02 AI 分析</span>
            <span>03 历史统计</span>
            <span>04 对象追踪</span>
            <span>05 数据来源</span>
          </nav>
          <section>
            <div className="section-heading">
              <h2>当前查询</h2>
              <span>{querying ? "计算中" : analysis ? "第 1—4 周" : "未执行"}</span>
            </div>
            {analysisError && <div className="quality-note quality-error inline-alert"><span className="quality-dot" />{analysisError}</div>}
            <div className="current-kpis">
              <article>
                <span>中心 SST</span>
                <strong>{pointQuery?.sst_celsius != null ? formatTemperature(pointQuery.sst_celsius) : formatTemperature(analysis?.sst.center_celsius)}</strong>
              </article>
              <article>
                <span>锋面状态</span>
                <strong>{pointQuery?.front_class ?? analysis?.front.status ?? "--"}</strong>
              </article>
              <article>
                <span>历史同期</span>
                <strong>{formatPercent(historyData?.summary.same_period_probability)}</strong>
              </article>
            </div>
            <dl className="detail-list">
              <div><dt>经度</dt><dd>{Number(longitude).toFixed(3)}°E</dd></div>
              <div><dt>纬度</dt><dd>{Number(latitude).toFixed(3)}°N</dd></div>
              <div><dt>当前日期</dt><dd>{analysis?.date ?? selectedDate}</dd></div>
              <div><dt>范围</dt><dd>{formatRadiusLabel(Number(radius))}</dd></div>
              <div><dt>锋面编码</dt><dd>{pointQuery?.front_code ?? "--"}</dd></div>
              <div><dt>海表温度</dt><dd>{pointQuery?.sst_celsius != null ? `${pointQuery.sst_celsius.toFixed(2)} °C` : analysis?.sst.center_celsius != null ? `${analysis.sst.center_celsius.toFixed(2)} °C` : "--"}</dd></div>
              <div><dt>点位类别</dt><dd>{pointQuery?.front_class ?? "--"}</dd></div>
              <div><dt>距最近锋面</dt><dd>{pointQuery?.nearest_front_distance_km != null ? `${pointQuery.nearest_front_distance_km.toFixed(2)} km` : "--"}</dd></div>
              <div><dt>局地温差</dt><dd>{pointQuery?.temperature_range_celsius != null ? `${pointQuery.temperature_range_celsius.toFixed(2)} °C` : analysis?.sst.range_celsius != null ? `${analysis.sst.range_celsius.toFixed(2)} °C` : "--"}</dd></div>
              <div><dt>温度梯度</dt><dd>{pointQuery?.temperature_gradient_c_per_km != null ? `${pointQuery.temperature_gradient_c_per_km.toFixed(5)} °C/km` : analysis?.sst.gradient_c_per_km != null ? `${analysis.sst.gradient_c_per_km.toFixed(5)} °C/km` : "--"}</dd></div>
              <div><dt>锋面线像元</dt><dd>{analysis?.front.line_pixels ?? "--"}</dd></div>
              <div><dt>冷 / 暖侧像元</dt><dd>{analysis ? `${analysis.front.cold_side_pixels} / ${analysis.front.warm_side_pixels}` : "--"}</dd></div>
              <div><dt>锋面对象数</dt><dd>{frontObjects?.object_count ?? "--"}</dd></div>
              <div><dt>最近对象 ID</dt><dd>{frontObjects?.nearest_front_id ?? "--"}</dd></div>
              <div><dt>SST 有效覆盖</dt><dd>{analysis ? `${analysis.quality.sst_valid_percent.toFixed(1)}%` : "--"}</dd></div>
              <div><dt>锋面有效覆盖</dt><dd>{analysis ? `${analysis.quality.front_valid_percent.toFixed(1)}%` : "--"}</dd></div>
              <div><dt>GeoJSON 抽样</dt><dd>{analysis ? `SST ×${analysis.quality.geojson_sst_sample_step ?? 1} / front ×${analysis.quality.geojson_front_sample_step ?? 1}` : "--"}</dd></div>
            </dl>
            {reportError && <div className="quality-note quality-error"><span className="quality-dot" />{reportError}</div>}
            <div className="export-actions">
              <button className="export-button" type="button" disabled={!analysis && !historyData} onClick={exportAnalysis}><Download size={15} /> 导出 JSON</button>
              <button className="export-button" type="button" disabled={reportLoading || (!analysis && !historyData)} onClick={() => fetchHtmlReport("preview")}><Eye size={15} /> {reportLoading ? "生成中" : "预览 HTML"}</button>
              <button className="export-button" type="button" disabled={reportLoading || (!analysis && !historyData)} onClick={exportHtmlReport}><Download size={15} /> 导出 HTML</button>
            </div>
            {reportPreview && (
              <div className="report-preview-card">
                <div className="report-preview-head">
                  <div>
                    <strong>{reportPreview.title}</strong>
                    <span>{reportPreview.generated_at}</span>
                  </div>
                  <button className="icon-button compact" type="button" aria-label="关闭报告预览" onClick={() => setReportPreview(null)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="report-highlight-list">
                  {reportPreview.highlights.slice(0, 3).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <iframe title="HTML 汇报预览" srcDoc={reportPreview.html} sandbox="" />
              </div>
            )}
          </section>
          <section className="object-panel">
            <div className="section-heading">
              <h2>锋面对象与追踪</h2>
              <span>{frontObjects ? `第 5—8 周 · ${frontObjects.object_count} 个对象` : "等待查询"}</span>
            </div>
            {(frontObjectError || frontTrackingError) && (
              <div className="quality-note quality-error inline-alert">
                <span className="quality-dot" />{frontObjectError ?? frontTrackingError}
              </div>
            )}
            {frontObjects ? (
              <>
                <div className="object-kpis">
                  <article>
                    <span>对象数量</span>
                    <strong>{frontObjects.object_count}</strong>
                    <small>按连通锋面线像元聚类</small>
                  </article>
                  <article>
                    <span>最近对象</span>
                    <strong>{frontObjects.nearest_front_id ?? "--"}</strong>
                    <small>{nearestFrontObject ? `${nearestFrontObject.nearest_to_query_km?.toFixed(2) ?? "--"} km` : "无对象"}</small>
                  </article>
                  <article>
                    <span>三日追踪</span>
                    <strong>{frontTracking?.tracked_step_count ?? "--"}</strong>
                    <small>{frontTracking?.cumulative_displacement_km != null ? `累计 ${frontTracking.cumulative_displacement_km.toFixed(2)} km / 阈值 ${frontTracking.match_distance_km.toFixed(0)} km` : frontTracking?.status ?? "等待追踪"}</small>
                  </article>
                </div>
                {frontTracking && (
                  <div className="tracking-algorithm">
                    <strong>追踪算法：{frontTracking.algorithm}</strong>
                    {frontTracking.algorithm_notes.map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                )}
                <div className="object-list">
                  <div className="history-chart-title">
                    <strong>对象列表</strong>
                    <span>显示最近 4 个</span>
                  </div>
                  {frontObjects.objects.slice(0, 4).map((item) => (
                    <div className="object-row" key={item.front_id}>
                      <span>{item.front_id}</span>
                      <strong>{item.length_km.toFixed(2)} km</strong>
                      <small>
                        质心 {item.centroid_longitude.toFixed(3)}°E, {item.centroid_latitude.toFixed(3)}°N ·
                        {item.pixel_count} 像元 · 均温 {formatTemperature(item.mean_sst_celsius)}
                      </small>
                    </div>
                  ))}
                  {!frontObjects.objects.length && (
                    <div className="history-empty inline">
                      <span>当前窗口内没有可聚类的锋面线对象。</span>
                    </div>
                  )}
                </div>
                <div className="track-list">
                  <div className="history-chart-title">
                    <strong>最近锋面三日追踪</strong>
                    <span>{frontTracking?.status ?? "等待追踪"}</span>
                  </div>
                  {trackedPreview.map((item) => (
                    <div className="track-row" data-active={item.front_id ? "true" : "false"} key={item.date}>
                      <span>{item.date}</span>
                      <strong>{item.front_id ?? item.status}</strong>
                      <small>
                        {item.front_id
                          ? `长度 ${item.length_km?.toFixed(2) ?? "--"} km · 位移 ${item.distance_from_previous_km?.toFixed(2) ?? "--"} km · 匹配 ${formatPercent(item.match_score)} · 形态 ${formatPercent(item.shape_similarity)} · 重叠 ${formatPercent(item.bbox_overlap_ratio)} · 候选 ${item.candidates_considered}`
                          : item.status}
                      </small>
                      {item.front_id && <em>{item.status}</em>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="history-empty">
                <Layers3 size={22} />
                <strong>等待对象识别</strong>
                <span>执行查询后，这里会展示锋面对象 ID、质心、范围框、估算长度和连续多日最近对象。</span>
              </div>
            )}
          </section>
          <section className="ai-panel">
            <div className="section-heading">
              <h2>AI 分析智能体</h2>
              <span>{aiHealth ? `第 9—12 周 · ${aiHealth.provider} / ${aiHealth.local_model_available ? "可用" : "待接入"}` : "第 9—12 周"}</span>
            </div>
            {(aiHealth || aiCapabilities) && (
              <div className="ai-capability-note">
                <span>{aiHealth?.model ?? aiCapabilities?.model}</span>
                <small>{aiHealth?.local_model_status ?? aiCapabilities?.local_model_status}</small>
                {aiHealth && <small>检测时间：{aiHealth.checked_at}</small>}
              </div>
            )}
            {aiHealth && (
              <div className="ai-setup-note" data-state={aiHealth.provider === "rules" ? "rules" : aiHealth.local_model_available ? "ready" : "warn"}>
                <strong>{aiHealth.provider === "rules" ? "当前使用确定性离线解析器" : aiHealth.local_model_available ? "本地模型已接入" : "本地模型待接入"}</strong>
                <span>
                  {aiHealth.provider === "rules"
                    ? "适合稳定演示；如需展示真实小模型，可配置 Ollama / llama.cpp / OpenAI-compatible 后运行 check_local_llm.py。"
                    : aiHealth.local_model_available
                      ? "自然语言解析会优先请求本地模型，失败时仍回退到规则解析器。"
                      : "请确认模型服务已启动、endpoint 与 model 配置正确；规则解析器会继续兜底。"}
                </span>
              </div>
            )}
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="例如：分析 8月5日 东经124.5 北纬30.2 附近1度范围的锋面，并解释历史概率"
              rows={4}
            />
            <button className="primary-button ai-button" type="button" disabled={aiLoading || !catalog?.ready} onClick={runAi}>
              <Sparkles size={16} /> {aiLoading ? "组织分析中" : "执行自然语言任务"}
            </button>
            {aiError && <div className="quality-note quality-error"><span className="quality-dot" />{aiError}</div>}
            {aiResult ? (
              <div className="ai-result">
                <div className="ai-answer">
                  <Bot size={16} />
                  <p>{aiResult.answer}</p>
                </div>
                {(aiResult.warnings.length > 0 || aiResult.structured_task.assumptions.length > 0 || aiResult.structured_task.missing_parameters.length > 0) && (
                  <div className="ai-note-list">
                    <strong>解析说明</strong>
                    {aiResult.structured_task.assumptions.map((item) => (
                      <span key={`assumption-${item}`}>假设：{item}</span>
                    ))}
                    {aiResult.structured_task.missing_parameters.map((item) => (
                      <span key={`missing-${item}`}>缺失参数：{item}</span>
                    ))}
                    {aiResult.warnings.map((item) => (
                      <span key={`warning-${item}`}>提示：{item}</span>
                    ))}
                  </div>
                )}
                <div className="ai-json-card">
                  <strong>结构化任务 JSON</strong>
                  <pre>{JSON.stringify(aiResult.structured_task, null, 2)}</pre>
                </div>
                <div className="ai-conclusion-list">
                  <strong>结论与证据绑定</strong>
                  {aiResult.conclusions.map((item) => (
                    <div className="ai-conclusion-item" key={item.text}>
                      <span>{item.text}</span>
                      <small>证据 ID：{item.evidence_ids.join(", ")}</small>
                    </div>
                  ))}
                </div>
                <div className="ai-tool-list">
                  <strong>工具调用流程</strong>
                  {aiResult.tool_calls.map((tool) => (
                    <div className="ai-tool-item" key={`${tool.name}-${tool.endpoint}`}>
                      <span>{tool.name}</span>
                      <small>{tool.reason}</small>
                      <small>证据 ID：{tool.evidence_ids.join(", ")}</small>
                    </div>
                  ))}
                </div>
                <div className="ai-evidence-list">
                  <strong>证据</strong>
                  {aiResult.evidence.slice(0, 8).map((item) => (
                    <div className="ai-evidence-item" key={item.id}>
                      <span>{item.label}</span>
                      <b>{item.value}</b>
                      <small>{item.detail}</small>
                    </div>
                  ))}
                </div>
                {aiResult.recommendations.length > 0 && (
                  <div className="ai-recommendations">
                    <strong>下一步推荐</strong>
                    {aiResult.recommendations.map((item) => (
                      <span key={`${item.action}-${item.text}`}>{item.text}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="history-empty inline">
                <span>AI 层只解析任务和组织工具调用，统计数值仍由后端确定性接口产生。</span>
              </div>
            )}
          </section>
          <section className="history-panel">
            <div className="section-heading">
              <h2>历史统计</h2>
              <span>{historyData ? `第 5—8 周 · ${historyData.summary.available_years.length} 个年份` : "等待查询"}</span>
            </div>
            {historyIndex && (
              <div className="history-index-card">
                <div>
                  <strong>时间索引</strong>
                  <span>{historyIndex.front_file_count} front / {historyIndex.sst_file_count} SST</span>
                  <small>{formatRange(historyIndex.available_date_start, historyIndex.available_date_end)}</small>
                  <small>来源：{formatMetadataSource(historyIndex.metadata_source)}</small>
                </div>
                <div>
                  <strong>空间索引</strong>
                  <span>{frontGrid ? `${frontGrid.lon_count} × ${frontGrid.lat_count}` : "--"}</span>
                  <small>{frontGrid?.lon_resolution_deg != null ? `${frontGrid.lon_resolution_deg}° front 网格` : "等待 front 网格"}</small>
                </div>
                <div>
                  <strong>查询窗口</strong>
                  <span>{queryBbox ? queryBbox.map((value) => value.toFixed(2)).join(", ") : "尚未查询"}</span>
                  <small>{historyIndex.fingerprint.slice(0, 8)} / {sstGrid?.lon_resolution_deg != null ? `${sstGrid.lon_resolution_deg}° SST` : "SST 待确认"}</small>
                </div>
              </div>
            )}
            {historyIndexError && <div className="quality-note quality-error"><span className="quality-dot" />{historyIndexError}</div>}
            {historyError ? (
              <div className="history-empty">
                <BarChart3 size={22} />
                <strong>历史统计加载失败</strong>
                <span>{historyError}</span>
              </div>
            ) : historyData ? (
              <>
                <div className="history-metrics">
                  <article className="history-metric">
                    <span>数据范围</span>
                    <strong>{formatRange(historyData.summary.available_date_start, historyData.summary.available_date_end)}</strong>
                    <small>{formatCount(historyData.summary.available_years.length, "个年份")}</small>
                  </article>
                  <article className="history-metric">
                    <span>有效年份</span>
                    <strong>{historyData.summary.valid_years.length}</strong>
                    <small>{formatCount(historyData.summary.same_period_sample_count, "个同期样本")}</small>
                  </article>
                  <article className="history-metric">
                    <span>锋面年份</span>
                    <strong>{historyData.summary.front_years.length}</strong>
                    <small>{formatCount(historyData.summary.same_period_front_hit_count, "个命中")}</small>
                  </article>
                  <article className="history-metric">
                    <span>同期概率</span>
                    <strong>{formatPercent(historyData.summary.same_period_probability)}</strong>
                    <small>{formatCount(historyData.summary.same_period_sample_count, "条样本")}</small>
                  </article>
                  <article className="history-metric">
                    <span>月度概率</span>
                    <strong>{formatPercent(historyData.summary.monthly_probability)}</strong>
                    <small>{formatCount(historyData.summary.monthly_sample_count, "条样本")}</small>
                  </article>
                  <article className="history-metric">
                    <span>整体概率</span>
                    <strong>{formatPercent(historyData.summary.annual_probability)}</strong>
                    <small>{formatCount(historyData.summary.annual_sample_count, "条样本")}</small>
                  </article>
                  <article className="history-metric" data-state={historyData.summary.sample_reliability_level}>
                    <span>样本可信度</span>
                    <strong>{historyData.summary.sample_reliability_label}</strong>
                    <small>
                      {historyData.summary.historical_target_year_start}—{historyData.summary.historical_target_year_end}
                    </small>
                  </article>
                  <article className="history-metric">
                    <span>同期覆盖率</span>
                    <strong>{formatPercent(historyData.summary.same_period_coverage_ratio)}</strong>
                    <small>
                      {historyData.summary.same_period_sample_count}/{historyData.summary.same_period_expected_sample_count} 年
                    </small>
                  </article>
                  <article className="history-metric">
                    <span>月度覆盖率</span>
                    <strong>{formatPercent(historyData.summary.monthly_coverage_ratio)}</strong>
                    <small>
                      {historyData.summary.monthly_sample_count}/{historyData.summary.monthly_expected_sample_count} 天
                    </small>
                  </article>
                  <article className="history-metric" data-state={historyData.cache.hit ? "high" : "medium"}>
                    <span>查询引擎</span>
                    <strong>{historyData.cache.hit ? "缓存命中" : "现场计算"}</strong>
                    <small>
                      {formatDuration(historyData.cache.duration_ms)} · {formatMetadataSource(historyData.cache.metadata_source)}
                    </small>
                  </article>
                </div>
                <div className="history-coverage-note" data-state={historyData.summary.sample_reliability_level}>
                  <strong>样本覆盖说明</strong>
                  <span>{historyData.summary.sample_coverage_note}</span>
                </div>
                <div className="history-facts">
                  <span>锋面线像元均值 {historyData.summary.front_line_pixels_mean != null ? historyData.summary.front_line_pixels_mean.toFixed(2) : "--"}</span>
                  <span>范围 {historyData.summary.front_line_pixels_min != null && historyData.summary.front_line_pixels_max != null ? `${historyData.summary.front_line_pixels_min.toFixed(0)} - ${historyData.summary.front_line_pixels_max.toFixed(0)}` : "--"}</span>
                  <span>SST 均值 {historyData.summary.sst_mean_celsius != null ? `${historyData.summary.sst_mean_celsius.toFixed(2)} °C` : "--"}</span>
                  <span>SST 范围 {historyData.summary.sst_min_celsius != null && historyData.summary.sst_max_celsius != null ? `${historyData.summary.sst_min_celsius.toFixed(2)} - ${historyData.summary.sst_max_celsius.toFixed(2)} °C` : "--"}</span>
                  <span>多年梯度 {historyData.summary.sst_gradient_c_per_km_mean != null ? `${historyData.summary.sst_gradient_c_per_km_mean.toFixed(5)} °C/km` : "--"}</span>
                  <span>当月样本 {monthlyHistoryPoint ? `${monthlyHistoryPoint.sample_count} / 命中 ${monthlyHistoryPoint.front_hit_count}` : "--"}</span>
                </div>
                <div className="history-chart-stack">
                  <div className="history-chart-title">
                    <strong>多年锋面变化</strong>
                    <span>{sampledTimeline.length} 个采样点</span>
                  </div>
                  {sampledTimeline.length ? (
                    <div className="trend-chart history-front-chart" aria-label="多年锋面线像元变化">
                      {sampledTimeline.map((item) => {
                        const values = sampledTimeline.map((point) => point.front_line_pixels);
                        const max = Math.max(...values, 1);
                        const min = Math.min(...values);
                        const height = max === min ? 55 : 18 + ((item.front_line_pixels - min) / (max - min)) * 64;
                        return (
                          <div className="trend-column" key={item.date}>
                            <div
                              className="trend-bar"
                              style={{ height: `${height}%` }}
                              title={`${item.date}: ${item.front_line_pixels} 个锋面像元`}
                            />
                            <span>{item.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="history-empty inline">
                      <span>暂无历史时间点</span>
                    </div>
                  )}
                  <div className="history-chart-title">
                    <strong>SST 均值变化</strong>
                    <span>{monthlyHistoryPoint?.probability != null ? `${formatPercent(monthlyHistoryPoint.probability)} / 当月` : "按月查看"}</span>
                  </div>
                  {sampledTimeline.some((item) => item.sst_mean_celsius != null) ? (
                    <div className="trend-chart history-sst-chart" aria-label="多年 SST 均值变化">
                      {sampledTimeline.map((item) => {
                        const values = sampledTimeline
                          .map((point) => point.sst_mean_celsius)
                          .filter((value): value is number => value != null);
                        const max = Math.max(...values, 1);
                        const min = Math.min(...values);
                        const value = item.sst_mean_celsius ?? min;
                        const height = max === min ? 55 : 18 + ((value - min) / (max - min)) * 64;
                        return (
                          <div className="trend-column" key={`${item.date}-sst`}>
                            <div
                              className="trend-bar trend-bar-sst"
                              style={{ height: `${height}%` }}
                              title={`${item.date}: ${item.sst_mean_celsius?.toFixed(2) ?? "--"} °C`}
                            />
                            <span>{item.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="history-empty inline">
                      <span>暂无 SST 历史值</span>
                    </div>
                  )}
                </div>
                <div className="monthly-chart" aria-label="月度概率">
                  {historyData.monthly.map((item) => {
                    const probability = item.probability ?? 0;
                    const height = item.probability == null ? 10 : Math.max(8, probability * 100);
                    return (
                      <div className="monthly-column" key={item.month}>
                        <div className="monthly-bar-track">
                          <div className="monthly-bar" style={{ height: `${height}%` }} />
                        </div>
                        <span>{String(item.month).padStart(2, "0")}</span>
                        <small>{formatPercent(item.probability)}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="history-records">
                  <div className="history-chart-title">
                    <strong>概率计算样本</strong>
                    <span>同期 {historyData.same_period_records.length} / 月度 {historyData.monthly_records.length}</span>
                  </div>
                  {samePeriodPreview.length ? samePeriodPreview.map((item) => (
                    <div className="history-record" key={item.date}>
                      <span>{item.date}</span>
                      <strong>{item.front_present ? "命中锋面" : "未命中"}</strong>
                      <small>{item.front_line_pixels} 个锋面线像元 · {item.source_files[0] ?? "无源文件"}</small>
                    </div>
                  )) : (
                    <div className="history-empty inline">
                      <span>当前本地数据中没有同月同日样本。</span>
                    </div>
                  )}
                </div>
                <div className="history-notes">
                  {historyData.explanation.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
                <div className="history-cache">
                  <span>{historyData.cache.hit ? "缓存命中，跳过逐日重算" : "缓存已写入，可供下次复用"}</span>
                  <span>{historyData.cache.records_evaluated} 条实时计算 / {historyData.cache.timeline_record_count} 条时间线</span>
                  <span>{formatDuration(historyData.cache.duration_ms)} · {historyData.cache.key.slice(0, 8)}</span>
                </div>
                <div className="history-sources">
                  {historyData.source_files.map((file) => (
                    <span key={file}>{file}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="history-empty">
                <BarChart3 size={22} />
                <strong>等待历史查询</strong>
                <span>执行一次查询后，这里会显示多年的变化、月度概率和缓存状态。</span>
              </div>
            )}
            <div className={`quality-note ${historyError ? "quality-error" : ""}`}>
              <span className="quality-dot" />
              {historyError ?? (historyData ? `历史样本：${historyData.summary.annual_sample_count} 条` : "等待查询")}
            </div>
          </section>
          <section className="provenance-section">
            <div className="section-heading"><h2>数据状态</h2><span>{dataHealthLabel}</span></div>
            {dataManifest && (
              <>
                <div className="manifest-card">
                  <article>
                    <span>文件总数</span>
                    <strong>{dataManifest.total_file_count}</strong>
                    <small>{formatBytes(dataManifest.total_size_bytes)}</small>
                  </article>
                  <article>
                    <span>配对日期</span>
                    <strong>{dataManifest.paired_date_count}</strong>
                    <small>{formatDatePreview(dataManifest.paired_dates, 2)}</small>
                  </article>
                  <article>
                    <span>缺失检查</span>
                    <strong>{dataIssueCount}</strong>
                    <small>SST {missingSstCount} / front {missingFrontCount}</small>
                  </article>
                </div>
                <div className="data-readiness-card">
                  <strong>离线数据就绪度</strong>
                  <span>{dataIssueCount === 0 ? "当前 front 与 SST 日期完全配对，可以稳定执行单日、历史和追踪查询。" : "当前本地数据仍存在 front/SST 日期缺口，缺失日期会影响历史概率和连续追踪窗口。"}</span>
                  <small>manifest 生成时间：{dataManifest.generated_at}</small>
                </div>
                <div className="dataset-table" aria-label="本地数据资产表">
                  <div className="dataset-table-head">
                    <span>数据集</span>
                    <span>文件</span>
                    <span>日期</span>
                    <span>大小</span>
                  </div>
                  {dataManifest.datasets.map((dataset) => (
                    <div className="dataset-table-row" key={dataset.dataset_type}>
                      <span>{dataset.dataset_type}</span>
                      <strong>{dataset.file_count}</strong>
                      <strong>{dataset.date_count}</strong>
                      <strong>{formatBytes(dataset.size_bytes)}</strong>
                      <small>{dataset.available_date_start ?? "--"} 至 {dataset.available_date_end ?? "--"} · 变量 {dataset.variables.join(", ")}</small>
                      {dataset.message && <small className="dataset-message">{dataset.message}</small>}
                    </div>
                  ))}
                </div>
                <div className="missing-grid">
                  <article data-state={missingSstCount ? "warn" : "ok"}>
                    <span>有 front 但缺 SST</span>
                    <strong>{missingSstCount}</strong>
                    <small>{formatDatePreview(dataManifest.missing_sst_dates)}</small>
                  </article>
                  <article data-state={missingFrontCount ? "warn" : "ok"}>
                    <span>有 SST 但缺 front</span>
                    <strong>{missingFrontCount}</strong>
                    <small>{formatDatePreview(dataManifest.missing_front_dates)}</small>
                  </article>
                </div>
              </>
            )}
            {dataIndex && (
              <div className="sqlite-index-card">
                <div className="sqlite-index-head">
                  <strong>SQLite 元数据索引</strong>
                  <span>{dataIndex.ready ? `${dataIndex.schema_version} · ${formatBytes(dataIndex.sqlite_size_bytes)}` : "等待生成"}</span>
                </div>
                <div className="sqlite-index-grid">
                  <article>
                    <span>索引日期</span>
                    <strong>{dataIndex.indexed_date_count}</strong>
                    <small>配对 {dataIndex.paired_date_count}</small>
                  </article>
                  <article>
                    <span>front 覆盖</span>
                    <strong>{indexedFront?.date_count ?? 0}</strong>
                    <small>{indexedFront ? formatRange(indexedFront.available_date_start, indexedFront.available_date_end) : "--"}</small>
                  </article>
                  <article>
                    <span>SST 覆盖</span>
                    <strong>{indexedSst?.date_count ?? 0}</strong>
                    <small>{indexedSst ? formatRange(indexedSst.available_date_start, indexedSst.available_date_end) : "--"}</small>
                  </article>
                  <article data-state={dataIndexWarningCount ? "warn" : "ok"}>
                    <span>索引告警</span>
                    <strong>{dataIndexWarningCount}</strong>
                    <small>{dataIndex.integrity_warnings[0] ?? "可用于离线检索"}</small>
                  </article>
                </div>
                {dataIndexDate && (
                  <div className="date-index-hit" data-state={dataIndexDate.complete ? "ok" : "warn"}>
                    <strong>{dataIndexDate.observation_date} 文件命中</strong>
                    <span>
                      front {dataIndexDate.front_file_count} / SST {dataIndexDate.sst_file_count} / intensity {dataIndexDate.intensity_file_count}
                    </span>
                    <small>{currentIndexFilePreview || dataIndexDate.notes[0] || "暂无文件"}</small>
                  </div>
                )}
                <small className="sqlite-index-path">索引路径：{dataIndex.index_path}</small>
              </div>
            )}
            {dataIndexDateError && <div className="quality-note quality-error"><span className="quality-dot" />{dataIndexDateError}</div>}
            {dataPlan && (
              <div className="data-plan-card">
                <div className="data-plan-head">
                  <strong>下一步数据准备计划</strong>
                  <span>{dataPlan.paired_date_count} 个配对日期 · 目标 {formatRange(dataPlan.target_date_start, dataPlan.target_date_end)}</span>
                </div>
                <div className="data-target-grid">
                  <article>
                    <span>目标窗口</span>
                    <strong>{dataPlan.target_dates.length}</strong>
                    <small>{formatDatePreview(dataPlan.target_dates, 3)}</small>
                  </article>
                  <article data-state={dataPlan.target_missing_front_dates.length ? "warn" : "ok"}>
                    <span>待补 front</span>
                    <strong>{dataPlan.target_missing_front_dates.length}</strong>
                    <small>{formatDatePreview(dataPlan.target_missing_front_dates, 3)}</small>
                  </article>
                  <article data-state={dataPlan.target_missing_sst_dates.length ? "warn" : "ok"}>
                    <span>待补 SST</span>
                    <strong>{dataPlan.target_missing_sst_dates.length}</strong>
                    <small>{formatDatePreview(dataPlan.target_missing_sst_dates, 3)}</small>
                  </article>
                  <article data-state={dataPlan.historical_paired_date_count < Math.min(30, dataPlan.historical_target_date_count) ? "warn" : "ok"}>
                    <span>跨年同期</span>
                    <strong>{dataPlan.historical_paired_date_count}/{dataPlan.historical_target_date_count}</strong>
                    <small>缺 front {dataPlan.historical_missing_front_dates.length} / SST {dataPlan.historical_missing_sst_dates.length}</small>
                  </article>
                </div>
                <ol>
                  {dataPlan.recommended_steps.slice(0, 4).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {duplicateDataGroupCount > 0 && (
                  <div className="duplicate-group-list">
                    {[...dataPlan.duplicate_front_groups, ...dataPlan.duplicate_sst_groups].slice(0, 2).map((group) => (
                      <div className="duplicate-group" key={`${group.canonical_path}-${group.file_count}`}>
                        <span>{group.observation_dates.slice(0, 3).join(" / ")} · {group.file_count} 个文件</span>
                        <small>建议保留：{group.canonical_path ?? "--"}</small>
                      </div>
                    ))}
                  </div>
                )}
                <div className="command-list">
                  {dataPlan.download_commands.slice(0, 3).map((command) => (
                    <code key={command}>{command}</code>
                  ))}
                  {dataPlan.historical_download_commands.slice(0, 1).map((command) => (
                    <code key={`history-${command}`}>{command}</code>
                  ))}
                </div>
              </div>
            )}
            {dataIndexError && <div className="quality-note quality-error"><span className="quality-dot" />{dataIndexError}</div>}
            {dataPlanError && <div className="quality-note quality-error"><span className="quality-dot" />{dataPlanError}</div>}
            {dataManifestError && <div className="quality-note quality-error"><span className="quality-dot" />{dataManifestError}</div>}
            <div className="provenance-divider">数据来源</div>
            <p>锋面：Zenodo 20356239，V1.0</p>
            <p>SST：Copernicus C3S-GLO-SST-L4-REP-OBS-SST</p>
            <p>网格：{frontGrid?.lon_resolution_deg ?? 0.05}°，时间：每日</p>
            <p>历史索引缓存：{historyIndex?.cache_path ?? "等待生成"}</p>
            <p>数据清单：{dataManifest?.manifest_path ?? "可通过脚本生成"}</p>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;
