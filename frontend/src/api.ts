export type Catalog = {
  dataset: string;
  version: string;
  ready: boolean;
  file_count: number;
  available_dates: string[];
  message: string | null;
  files: { name: string; date: string | null; size_bytes: number }[];
};

export type GeoJsonFeature = {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, number | string>;
};

export type AnalysisRasterLayer = {
  kind: string;
  format: string;
  url: string;
  bounds: number[];
  width: number;
  height: number;
  render_mode: string;
};

export type Analysis = {
  date: string;
  longitude: number;
  latitude: number;
  radius_deg: number;
  sst: {
    count: number;
    min: number | null;
    max: number | null;
    mean: number | null;
    range_celsius: number | null;
    center_celsius: number | null;
    gradient_c_per_km: number | null;
    max_gradient_c_per_km: number | null;
  };
  front: { line_pixels: number; cold_side_pixels: number; warm_side_pixels: number; status: string };
  quality: {
    sst_valid_percent: number;
    front_valid_percent: number;
    front_line_density_per_1000_pixels: number;
    geojson_sst_sample_step?: number;
    geojson_front_sample_step?: number;
  };
  files: string[];
  layers: Record<string, { type: string; features: GeoJsonFeature[] }>;
  rasters: Record<string, AnalysisRasterLayer>;
};
export type Series = { points: { date: string; sst_mean: number | null; front_line_pixels: number }[] };
export type PointQuery = { date: string; longitude: number; latitude: number; sst_celsius: number | null; front_code: number | null; front_class: string; nearest_front_distance_km: number | null; temperature_range_celsius: number | null; temperature_gradient_c_per_km: number | null; source_files: string[] };
export type FrontObject = {
  front_id: string;
  pixel_count: number;
  centroid_longitude: number;
  centroid_latitude: number;
  bbox: number[];
  length_km: number;
  codes: number[];
  mean_sst_celsius: number | null;
  temperature_range_celsius: number | null;
  nearest_to_query_km: number | null;
};
export type FrontObjectData = {
  date: string;
  longitude: number;
  latitude: number;
  radius_deg: number;
  object_count: number;
  nearest_front_id: string | null;
  objects: FrontObject[];
  layers: Record<string, { type: string; features: GeoJsonFeature[] }>;
  source_files: string[];
};
export type FrontTrackStep = {
  date: string;
  front_id: string | null;
  centroid_longitude: number | null;
  centroid_latitude: number | null;
  bbox: number[];
  pixel_count: number;
  length_km: number | null;
  mean_sst_celsius: number | null;
  nearest_to_query_km: number | null;
  distance_from_previous_km: number | null;
  matched_by: string;
  match_score: number | null;
  shape_similarity: number | null;
  bbox_overlap_ratio: number | null;
  candidates_considered: number;
  status: string;
  source_files: string[];
};
export type FrontTrackingData = {
  date: string;
  longitude: number;
  latitude: number;
  radius_deg: number;
  days: number;
  match_distance_km: number;
  algorithm: string;
  algorithm_notes: string[];
  available_step_count: number;
  tracked_step_count: number;
  cumulative_displacement_km: number | null;
  status: string;
  steps: FrontTrackStep[];
  layers: Record<string, { type: string; features: GeoJsonFeature[] }>;
  source_files: string[];
};
export type ReportData = {
  title: string;
  generated_at: string;
  query: Record<string, number | string>;
  highlights: string[];
  markdown: string;
  html: string;
  source_files: string[];
};
export type DataPreparationGroup = {
  observation_dates: string[];
  file_count: number;
  size_bytes: number;
  paths: string[];
  canonical_path: string | null;
  note: string;
};
export type DataPreparationPlan = {
  generated_at: string;
  raw_data_dir: string;
  manifest_path: string;
  target_date_start: string | null;
  target_date_end: string | null;
  target_dates: string[];
  front_file_count: number;
  sst_file_count: number;
  paired_date_count: number;
  paired_dates: string[];
  missing_front_dates: string[];
  missing_sst_dates: string[];
  target_missing_front_dates: string[];
  target_missing_sst_dates: string[];
  historical_reference_date: string | null;
  historical_year_start: number | null;
  historical_year_end: number | null;
  historical_window_days: number;
  historical_target_date_count: number;
  historical_paired_date_count: number;
  historical_missing_front_dates: string[];
  historical_missing_sst_dates: string[];
  duplicate_front_groups: DataPreparationGroup[];
  duplicate_sst_groups: DataPreparationGroup[];
  recommended_steps: string[];
  download_commands: string[];
  historical_download_commands: string[];
  source_notes: string[];
};
export type DataIndexDatasetSummary = {
  dataset_type: string;
  file_count: number;
  date_count: number;
  size_bytes: number;
  available_date_start: string | null;
  available_date_end: string | null;
  available_years: number[];
  available_months: string[];
  duplicate_date_count: number;
  example_paths: string[];
};
export type DataIndex = {
  ready: boolean;
  generated_at: string;
  raw_data_dir: string;
  index_path: string;
  schema_version: string;
  sqlite_size_bytes: number;
  total_file_count: number;
  total_size_bytes: number;
  indexed_date_count: number;
  paired_date_count: number;
  missing_sst_dates: string[];
  missing_front_dates: string[];
  datasets: DataIndexDatasetSummary[];
  integrity_warnings: string[];
  query_examples: string[];
};
export type DataIndexDateFile = {
  dataset_type: string;
  relative_path: string;
  size_bytes: number;
  date_count: number;
  date_start: string | null;
  date_end: string | null;
  canonical: boolean;
};
export type DataIndexDate = {
  observation_date: string;
  complete: boolean;
  front_file_count: number;
  sst_file_count: number;
  intensity_file_count: number;
  files: DataIndexDateFile[];
  index_path: string;
  notes: string[];
};
export type AiTaskParameters = {
  date: string | null;
  longitude: number | null;
  latitude: number | null;
  radius_deg: number | null;
  month: number | null;
  days: number | null;
};
export type AiStructuredTask = {
  intent: string;
  tasks: string[];
  parameters: AiTaskParameters;
  assumptions: string[];
  missing_parameters: string[];
};
export type AiToolCallRecord = {
  name: string;
  endpoint: string;
  status: string;
  reason: string;
  parameters: Record<string, unknown>;
  evidence_ids: string[];
};
export type AiEvidence = {
  id: string;
  source: string;
  label: string;
  value: string;
  detail: string;
  source_files: string[];
};
export type AiConclusion = {
  text: string;
  evidence_ids: string[];
};
export type AiRecommendation = {
  text: string;
  action: string;
  parameters: AiTaskParameters;
};
export type AiAnalysisData = {
  provider: string;
  model: string;
  answer: string;
  structured_task: AiStructuredTask;
  tool_calls: AiToolCallRecord[];
  evidence: AiEvidence[];
  conclusions: AiConclusion[];
  recommendations: AiRecommendation[];
  warnings: string[];
};
export type AiCapabilities = {
  provider: string;
  model: string;
  local_llm_endpoint: string;
  offline: boolean;
  local_model_available: boolean;
  local_model_status: string;
  supported_tasks: string[];
  supported_tools: string[];
  guarantees: string[];
};
export type AiHealth = {
  provider: string;
  model: string;
  local_llm_endpoint: string;
  offline: boolean;
  local_model_available: boolean;
  local_model_status: string;
  checked_at: string;
};
export type HistorySummary = {
  available_date_start: string | null;
  available_date_end: string | null;
  available_years: number[];
  valid_years: number[];
  front_years: number[];
  historical_target_year_start: number;
  historical_target_year_end: number;
  same_period_expected_sample_count: number;
  same_period_sample_count: number;
  same_period_front_hit_count: number;
  same_period_probability: number | null;
  same_period_coverage_ratio: number | null;
  monthly_expected_sample_count: number;
  monthly_sample_count: number;
  monthly_front_hit_count: number;
  monthly_probability: number | null;
  monthly_coverage_ratio: number | null;
  annual_sample_count: number;
  annual_front_hit_count: number;
  annual_probability: number | null;
  sample_reliability_level: string;
  sample_reliability_label: string;
  sample_coverage_note: string;
  front_line_pixels_mean: number | null;
  front_line_pixels_min: number | null;
  front_line_pixels_max: number | null;
  sst_mean_celsius: number | null;
  sst_min_celsius: number | null;
  sst_max_celsius: number | null;
  sst_gradient_c_per_km_mean: number | null;
  sst_gradient_c_per_km_min: number | null;
  sst_gradient_c_per_km_max: number | null;
};
export type HistoryTimelinePoint = {
  date: string;
  year: number;
  month: number;
  front_line_pixels: number;
  cold_side_pixels: number;
  warm_side_pixels: number;
  front_present: boolean;
  sst_mean_celsius: number | null;
  sst_min_celsius: number | null;
  sst_max_celsius: number | null;
  sst_gradient_c_per_km: number | null;
  source_files: string[];
};
export type HistoryMonthlyPoint = {
  month: number;
  sample_count: number;
  front_hit_count: number;
  probability: number | null;
  sst_mean_celsius: number | null;
  sst_min_celsius: number | null;
  sst_max_celsius: number | null;
};
export type HistoryGridInfo = {
  dataset_type: string;
  variable: string;
  source_file: string | null;
  lon_min: number | null;
  lon_max: number | null;
  lat_min: number | null;
  lat_max: number | null;
  lon_count: number;
  lat_count: number;
  lon_resolution_deg: number | null;
  lat_resolution_deg: number | null;
  dimensions: string[];
};
export type HistoryIndexData = {
  dataset: string;
  version: string;
  ready: boolean;
  generated_at: string;
  fingerprint: string;
  metadata_source: string;
  front_file_count: number;
  sst_file_count: number;
  available_date_start: string | null;
  available_date_end: string | null;
  available_dates: string[];
  available_years: number[];
  available_months: string[];
  spatial: {
    query_bbox: number[] | null;
    front_grid: HistoryGridInfo | null;
    sst_grid: HistoryGridInfo | null;
  };
  cache_path: string;
  message: string | null;
};
export type HistoryData = {
  date: string;
  longitude: number;
  latitude: number;
  radius_deg: number;
  summary: HistorySummary;
  timeline: HistoryTimelinePoint[];
  monthly: HistoryMonthlyPoint[];
  explanation: string[];
  cache: {
    hit: boolean;
    key: string;
    index_fingerprint: string;
    path: string | null;
    generated_at: string;
    cache_layer: string;
    metadata_source: string;
    records_evaluated: number;
    timeline_record_count: number;
    duration_ms: number | null;
  };
  source_files: string[];
  same_period_records: HistoryTimelinePoint[];
  monthly_records: HistoryTimelinePoint[];
};
export type HistoryProbabilityData = Pick<
  HistoryData,
  "date" | "longitude" | "latitude" | "radius_deg" | "summary" | "same_period_records" | "monthly_records" | "explanation" | "cache"
>;
export type HistoryMonthlyData = Pick<
  HistoryData,
  "date" | "longitude" | "latitude" | "radius_deg" | "monthly" | "explanation" | "cache"
> & {
  selected_month: number;
  selected: HistoryMonthlyPoint | null;
};
export type HistoryLocalRecord = {
  date: string;
  year: number;
  month: number;
  matched_rule: string;
  front_present: boolean;
  front_line_pixels: number;
  cold_side_pixels: number;
  warm_side_pixels: number;
  sst_mean_celsius: number | null;
  source_files: string[];
};
export type HistoryLocalData = Pick<HistoryData, "date" | "longitude" | "latitude" | "radius_deg" | "explanation" | "cache"> & {
  same_period_records: HistoryLocalRecord[];
  monthly_records: HistoryLocalRecord[];
  source_files: string[];
};
export type DataManifestDataset = {
  dataset_type: string;
  root: string;
  file_count: number;
  date_count: number;
  size_bytes: number;
  available_date_start: string | null;
  available_date_end: string | null;
  available_dates: string[];
  available_years: number[];
  available_months: string[];
  variables: string[];
  message: string | null;
};
export type DataManifest = {
  generated_at: string;
  raw_data_dir: string;
  manifest_path: string;
  total_file_count: number;
  total_size_bytes: number;
  paired_date_count: number;
  paired_dates: string[];
  missing_sst_dates: string[];
  missing_front_dates: string[];
  datasets: DataManifestDataset[];
};

function historyParams(longitude: number, latitude: number, radius: number): URLSearchParams {
  return new URLSearchParams({ longitude: String(longitude), latitude: String(latitude), radius_deg: String(radius) });
}

export async function getCatalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch("/api/catalog", { signal });
  if (!response.ok) {
    throw new Error(`数据服务返回 ${response.status}`);
  }
  return response.json() as Promise<Catalog>;
}

export async function getDataManifest(signal?: AbortSignal): Promise<DataManifest> {
  const response = await fetch("/api/data/manifest", { signal });
  if (!response.ok) throw new Error(`数据清单接口返回 ${response.status}`);
  return response.json() as Promise<DataManifest>;
}

export async function getDataPreparationPlan(
  options: {
    reference_date?: string;
    target_days?: number;
    historical_year_start?: number;
    historical_year_end?: number;
    historical_window_days?: number;
  } = {},
  signal?: AbortSignal,
): Promise<DataPreparationPlan> {
  const params = new URLSearchParams();
  if (options.reference_date) params.set("reference_date", options.reference_date);
  if (options.target_days != null) params.set("target_days", String(options.target_days));
  if (options.historical_year_start != null) params.set("historical_year_start", String(options.historical_year_start));
  if (options.historical_year_end != null) params.set("historical_year_end", String(options.historical_year_end));
  if (options.historical_window_days != null) params.set("historical_window_days", String(options.historical_window_days));
  const query = params.toString() ? `?${params}` : "";
  const response = await fetch(`/api/data/plan${query}`, { signal });
  if (!response.ok) throw new Error(`数据准备计划接口返回 ${response.status}`);
  return response.json() as Promise<DataPreparationPlan>;
}

export async function getDataIndex(signal?: AbortSignal): Promise<DataIndex> {
  const response = await fetch("/api/data/index", { signal });
  if (!response.ok) throw new Error(`SQLite 数据索引接口返回 ${response.status}`);
  return response.json() as Promise<DataIndex>;
}

export async function getDataIndexDate(date: string, signal?: AbortSignal): Promise<DataIndexDate> {
  const response = await fetch(`/api/data/index/${date}`, { signal });
  if (!response.ok) throw new Error(`日期索引查询接口返回 ${response.status}`);
  return response.json() as Promise<DataIndexDate>;
}

export async function getAnalysis(date: string, longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<Analysis> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/analysis/${date}?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `分析服务返回 ${response.status}`);
  }
  return response.json() as Promise<Analysis>;
}

export async function getSeries(longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<Series> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/series?${params}`, { signal });
  if (!response.ok) throw new Error(`时间序列服务返回 ${response.status}`);
  return response.json() as Promise<Series>;
}

export async function getPointQuery(date: string, longitude: number, latitude: number, signal?: AbortSignal): Promise<PointQuery> {
  const params = new URLSearchParams({ longitude: String(longitude), latitude: String(latitude) });
  const response = await fetch(`/api/point/${date}?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `点位查询返回 ${response.status}`);
  }
  return response.json() as Promise<PointQuery>;
}

export async function getFrontObjects(date: string, longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<FrontObjectData> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/front-objects/${date}?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `锋面对象接口返回 ${response.status}`);
  }
  return response.json() as Promise<FrontObjectData>;
}

export async function getFrontTracking(
  date: string,
  longitude: number,
  latitude: number,
  radius: number,
  days = 3,
  matchDistanceKm = 80,
  signal?: AbortSignal,
): Promise<FrontTrackingData> {
  const params = historyParams(longitude, latitude, radius);
  params.set("days", String(days));
  params.set("match_distance_km", String(matchDistanceKm));
  const response = await fetch(`/api/front-tracking/${date}?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `锋面追踪接口返回 ${response.status}`);
  }
  return response.json() as Promise<FrontTrackingData>;
}

export async function getReport(date: string, longitude: number, latitude: number, radius: number, days = 3, signal?: AbortSignal): Promise<ReportData> {
  const params = historyParams(longitude, latitude, radius);
  params.set("days", String(days));
  const response = await fetch(`/api/report/${date}?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `报告接口返回 ${response.status}`);
  }
  return response.json() as Promise<ReportData>;
}

export async function getAiCapabilities(signal?: AbortSignal): Promise<AiCapabilities> {
  const response = await fetch("/api/ai/capabilities", { signal });
  if (!response.ok) throw new Error(`AI 能力接口返回 ${response.status}`);
  return response.json() as Promise<AiCapabilities>;
}

export async function getAiHealth(signal?: AbortSignal): Promise<AiHealth> {
  const response = await fetch("/api/ai/health", { signal });
  if (!response.ok) throw new Error(`AI 健康检查接口返回 ${response.status}`);
  return response.json() as Promise<AiHealth>;
}

export async function runAiAnalysis(
  message: string,
  defaults: {
    default_date?: string;
    default_longitude?: number;
    default_latitude?: number;
    default_radius_deg?: number;
  },
  signal?: AbortSignal,
): Promise<AiAnalysisData> {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, ...defaults }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `AI 分析接口返回 ${response.status}`);
  }
  return response.json() as Promise<AiAnalysisData>;
}

export async function getHistoryIndex(
  longitude?: number,
  latitude?: number,
  radius?: number,
  signal?: AbortSignal,
): Promise<HistoryIndexData> {
  const params = new URLSearchParams();
  if (longitude != null) params.set("longitude", String(longitude));
  if (latitude != null) params.set("latitude", String(latitude));
  if (radius != null) params.set("radius_deg", String(radius));
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : "";
  const response = await fetch(`/api/history/index${query}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `历史索引返回 ${response.status}`);
  }
  return response.json() as Promise<HistoryIndexData>;
}

export async function getHistory(date: string, longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<HistoryData> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/history/${date}?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail ?? `历史统计返回 ${response.status}`);
  }
  return response.json() as Promise<HistoryData>;
}

export async function getHistoryProbability(date: string, longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<HistoryProbabilityData> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/history/${date}/probability?${params}`, { signal });
  if (!response.ok) throw new Error(`历史概率返回 ${response.status}`);
  return response.json() as Promise<HistoryProbabilityData>;
}

export async function getHistoryMonthly(date: string, longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<HistoryMonthlyData> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/history/${date}/monthly?${params}`, { signal });
  if (!response.ok) throw new Error(`月度统计返回 ${response.status}`);
  return response.json() as Promise<HistoryMonthlyData>;
}

export async function getHistoryLocalRecords(date: string, longitude: number, latitude: number, radius: number, signal?: AbortSignal): Promise<HistoryLocalData> {
  const params = historyParams(longitude, latitude, radius);
  const response = await fetch(`/api/history/${date}/local-records?${params}`, { signal });
  if (!response.ok) throw new Error(`局地历史记录返回 ${response.status}`);
  return response.json() as Promise<HistoryLocalData>;
}
