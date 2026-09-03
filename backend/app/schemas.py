from __future__ import annotations

from datetime import date as DateType

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    offline: bool


class CatalogFile(BaseModel):
    name: str
    date: DateType | None
    size_bytes: int


class CatalogResponse(BaseModel):
    dataset: str
    version: str
    ready: bool
    file_count: int
    available_dates: list[DateType]
    files: list[CatalogFile]
    message: str | None = None


class AnalysisRasterLayer(BaseModel):
    kind: str
    format: str
    url: str
    bounds: list[float]
    width: int
    height: int
    render_mode: str


class AnalysisResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    sst: dict[str, float | int | None]
    front: dict[str, int | str]
    intensity: dict[str, float | int | str | None] = Field(default_factory=dict)
    quality: dict[str, float | int]
    files: list[str]
    layers: dict[str, object]
    rasters: dict[str, AnalysisRasterLayer] = Field(default_factory=dict)


class SeriesPoint(BaseModel):
    date: DateType
    sst_mean: float | None
    front_line_pixels: int


class SeriesResponse(BaseModel):
    longitude: float
    latitude: float
    radius_deg: float
    points: list[SeriesPoint]


class PointQueryResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    sst_celsius: float | None
    front_code: int | None
    front_class: str
    nearest_front_distance_km: float | None
    temperature_range_celsius: float | int | None = None
    temperature_gradient_c_per_km: float | int | None = None
    source_files: list[str]


class DataManifestDataset(BaseModel):
    dataset_type: str
    root: str
    file_count: int
    date_count: int
    size_bytes: int
    available_date_start: DateType | None
    available_date_end: DateType | None
    available_dates: list[DateType]
    available_years: list[int]
    available_months: list[str]
    variables: list[str]
    message: str | None = None


class DataManifestResponse(BaseModel):
    generated_at: str
    raw_data_dir: str
    manifest_path: str
    total_file_count: int
    total_size_bytes: int
    paired_date_count: int
    paired_dates: list[DateType]
    missing_sst_dates: list[DateType]
    missing_front_dates: list[DateType]
    datasets: list[DataManifestDataset]


class DataIndexDatasetSummary(BaseModel):
    dataset_type: str
    file_count: int
    date_count: int
    size_bytes: int
    available_date_start: DateType | None
    available_date_end: DateType | None
    available_years: list[int]
    available_months: list[str]
    duplicate_date_count: int
    example_paths: list[str]


class DataIndexResponse(BaseModel):
    ready: bool
    generated_at: str
    raw_data_dir: str
    index_path: str
    schema_version: str
    sqlite_size_bytes: int
    total_file_count: int
    total_size_bytes: int
    indexed_date_count: int
    paired_date_count: int
    missing_sst_dates: list[DateType]
    missing_front_dates: list[DateType]
    datasets: list[DataIndexDatasetSummary]
    integrity_warnings: list[str]
    query_examples: list[str]


class DataIndexDateFile(BaseModel):
    dataset_type: str
    relative_path: str
    size_bytes: int
    date_count: int
    date_start: DateType | None
    date_end: DateType | None
    canonical: bool


class DataIndexDateResponse(BaseModel):
    observation_date: DateType
    complete: bool
    front_file_count: int
    sst_file_count: int
    intensity_file_count: int
    files: list[DataIndexDateFile]
    index_path: str
    notes: list[str]


class DataPreparationGroup(BaseModel):
    observation_dates: list[DateType]
    file_count: int
    size_bytes: int
    paths: list[str]
    canonical_path: str | None = None
    note: str


class HistoricalCoverageBatch(BaseModel):
    label: str
    date_start: DateType | None
    date_end: DateType | None
    date_count: int
    missing_front_count: int
    missing_sst_count: int
    missing_intensity_count: int
    priority: str
    command_preview: str


class DataPreparationPriority(BaseModel):
    name: str
    level: str
    status: str
    reason: str
    command_preview: str | None = None


class DataPreparationPlanResponse(BaseModel):
    generated_at: str
    raw_data_dir: str
    manifest_path: str
    target_date_start: DateType | None
    target_date_end: DateType | None
    target_dates: list[DateType]
    front_file_count: int
    sst_file_count: int
    front_intensity_file_count: int = 0
    paired_date_count: int
    paired_dates: list[DateType]
    missing_front_dates: list[DateType]
    missing_sst_dates: list[DateType]
    target_missing_front_dates: list[DateType]
    target_missing_sst_dates: list[DateType]
    historical_reference_date: DateType | None
    historical_year_start: int | None
    historical_year_end: int | None
    historical_window_days: int
    historical_target_date_count: int
    historical_paired_date_count: int
    historical_coverage_ratio: float | None = None
    historical_covered_years: list[int] = []
    historical_missing_years: list[int] = []
    historical_missing_front_dates: list[DateType]
    historical_missing_sst_dates: list[DateType]
    historical_missing_intensity_dates: list[DateType] = []
    next_historical_batches: list[HistoricalCoverageBatch] = Field(default_factory=list)
    readiness_score: float
    readiness_level: str
    next_action: str
    required_front_sst_file_count: int
    optional_intensity_file_count: int
    priority_actions: list[DataPreparationPriority] = Field(default_factory=list)
    acceptance_commands: list[str] = Field(default_factory=list)
    duplicate_front_groups: list[DataPreparationGroup]
    duplicate_sst_groups: list[DataPreparationGroup]
    recommended_steps: list[str]
    download_commands: list[str]
    historical_download_commands: list[str]
    source_notes: list[str]


class FrontObject(BaseModel):
    front_id: str
    pixel_count: int
    centroid_longitude: float
    centroid_latitude: float
    bbox: list[float]
    length_km: float
    codes: list[int]
    mean_sst_celsius: float | None = None
    temperature_range_celsius: float | None = None
    mean_intensity: float | None = None
    max_intensity: float | None = None
    intensity_pixel_count: int = 0
    nearest_to_query_km: float | None = None


class FrontObjectResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    object_count: int
    nearest_front_id: str | None
    objects: list[FrontObject]
    layers: dict[str, object]
    source_files: list[str]


class FrontTrackStep(BaseModel):
    date: DateType
    front_id: str | None
    centroid_longitude: float | None
    centroid_latitude: float | None
    bbox: list[float]
    pixel_count: int
    length_km: float | None
    mean_sst_celsius: float | None
    nearest_to_query_km: float | None
    distance_from_previous_km: float | None
    speed_km_per_day: float | None = None
    bearing_deg: float | None = None
    matched_by: str
    match_score: float | None = None
    continuity_score: float | None = None
    confidence_label: str = "unknown"
    shape_similarity: float | None = None
    bbox_overlap_ratio: float | None = None
    candidates_considered: int
    status: str
    source_files: list[str]


class FrontTrackingResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    days: int
    match_distance_km: float
    algorithm: str = "centroid-shape-overlap"
    algorithm_version: str = "v1"
    algorithm_notes: list[str] = []
    available_step_count: int
    tracked_step_count: int
    cumulative_displacement_km: float | None
    mean_daily_displacement_km: float | None = None
    max_daily_displacement_km: float | None = None
    gap_count: int = 0
    reset_count: int = 0
    mean_match_score: float | None = None
    confidence_score: float | None = None
    confidence_label: str = "unknown"
    status: str
    steps: list[FrontTrackStep]
    layers: dict[str, object]
    source_files: list[str]


class ReportResponse(BaseModel):
    title: str
    generated_at: str
    query: dict[str, float | int | str]
    highlights: list[str]
    markdown: str
    html: str
    source_files: list[str]


class PredictionDriver(BaseModel):
    name: str
    value: str
    weight: float
    note: str


class FrontPredictionPoint(BaseModel):
    target_date: DateType
    horizon_day: int
    probability: float | None
    predicted_status: str
    confidence_label: str
    same_period_sample_count: int
    same_period_probability: float | None
    monthly_probability: float | None
    recent_signal: float | None
    gradient_adjustment: float
    observed_front_present: bool | None = None
    observed_front_line_pixels: int | None = None
    drivers: list[PredictionDriver] = Field(default_factory=list)
    explanation: str


class FrontPredictionResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    horizon_days: int
    algorithm: str = "historical-climatology-recent-baseline"
    algorithm_version: str = "v1"
    generated_at: str
    training_sample_count: int
    sample_reliability_label: str
    forecast_count: int
    predictions: list[FrontPredictionPoint]
    explanation: list[str]
    source_files: list[str]


class FrontPredictionEvaluationPoint(BaseModel):
    anchor_date: DateType
    target_date: DateType
    horizon_day: int
    probability: float
    predicted_present: bool
    observed_front_present: bool
    observed_front_line_pixels: int
    error: float
    squared_error: float
    confidence_label: str


class FrontPredictionEvaluationResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    horizon_days: int
    generated_at: str
    algorithm: str = "historical-climatology-recent-baseline"
    evaluation_mode: str = "in-sample-local-backtest"
    evaluated_count: int
    candidate_anchor_count: int
    accuracy: float | None
    brier_score: float | None
    mean_absolute_error: float | None
    positive_count: int
    negative_count: int
    notes: list[str]
    points: list[FrontPredictionEvaluationPoint]
    source_files: list[str]


class AiTaskParameters(BaseModel):
    date: DateType | None = None
    longitude: float | None = None
    latitude: float | None = None
    radius_deg: float | None = None
    month: int | None = None
    days: int | None = None


class AiStructuredTask(BaseModel):
    intent: str
    tasks: list[str]
    parameters: AiTaskParameters
    assumptions: list[str]
    missing_parameters: list[str]


class AiToolCallRecord(BaseModel):
    name: str
    endpoint: str
    status: str
    reason: str
    parameters: dict[str, object]
    evidence_ids: list[str]


class AiEvidence(BaseModel):
    id: str
    source: str
    label: str
    value: str
    detail: str
    source_files: list[str] = []


class AiConclusion(BaseModel):
    text: str
    evidence_ids: list[str]


class AiRecommendation(BaseModel):
    text: str
    action: str
    parameters: AiTaskParameters


class AiAnalysisRequest(BaseModel):
    message: str
    default_date: DateType | None = None
    default_longitude: float | None = None
    default_latitude: float | None = None
    default_radius_deg: float | None = None


class AiAnalysisResponse(BaseModel):
    provider: str
    model: str
    answer: str
    structured_task: AiStructuredTask
    tool_calls: list[AiToolCallRecord]
    evidence: list[AiEvidence]
    conclusions: list[AiConclusion]
    recommendations: list[AiRecommendation]
    warnings: list[str]


class AiCapabilitiesResponse(BaseModel):
    provider: str
    model: str
    local_llm_endpoint: str
    offline: bool
    local_model_available: bool
    local_model_status: str
    supported_tasks: list[str]
    supported_tools: list[str]
    guarantees: list[str]


class AiHealthResponse(BaseModel):
    provider: str
    model: str
    local_llm_endpoint: str
    offline: bool
    local_model_available: bool
    local_model_status: str
    checked_at: str


class AiKnowledgeEntry(BaseModel):
    id: str
    title: str
    content: str


class AiKnowledgeResponse(BaseModel):
    entries: list[AiKnowledgeEntry]
    source_files: list[str]


class HistoryTimelinePoint(BaseModel):
    date: DateType
    year: int
    month: int
    front_line_pixels: int
    cold_side_pixels: int
    warm_side_pixels: int
    front_line_density_per_1000_pixels: float = 0.0
    nearest_front_distance_km: float | None = None
    front_present: bool
    sst_mean_celsius: float | None
    sst_min_celsius: float | None
    sst_max_celsius: float | None
    sst_gradient_c_per_km: float | None = None
    source_files: list[str]


class HistoryMonthlyPoint(BaseModel):
    month: int
    sample_count: int
    front_hit_count: int
    probability: float | None
    sst_mean_celsius: float | None
    sst_min_celsius: float | None
    sst_max_celsius: float | None


class ProbabilityRuleOption(BaseModel):
    id: str
    label: str
    description: str
    default_threshold: float | None = None
    threshold_unit: str | None = None


class ProbabilityRuleOptionsResponse(BaseModel):
    default_rule: str
    options: list[ProbabilityRuleOption]


class HistorySummary(BaseModel):
    available_date_start: DateType | None
    available_date_end: DateType | None
    available_years: list[int]
    valid_years: list[int]
    front_years: list[int]
    historical_target_year_start: int = 1982
    historical_target_year_end: int = 2024
    same_period_expected_sample_count: int = 0
    same_period_sample_count: int
    same_period_front_hit_count: int
    same_period_probability: float | None
    probability_rule: str = "line_presence"
    probability_rule_label: str = "窗口内存在锋面线像元"
    probability_threshold: float | None = None
    probability_rule_note: str = ""
    same_period_coverage_ratio: float | None = None
    same_period_covered_years: list[int] = []
    same_period_missing_years: list[int] = []
    next_missing_same_period_dates: list[DateType] = []
    monthly_expected_sample_count: int = 0
    monthly_sample_count: int
    monthly_front_hit_count: int
    monthly_probability: float | None
    monthly_coverage_ratio: float | None = None
    annual_sample_count: int
    annual_front_hit_count: int
    annual_probability: float | None
    sample_reliability_level: str = "unknown"
    sample_reliability_label: str = "等待样本"
    sample_coverage_note: str = ""
    front_line_pixels_mean: float | None
    front_line_pixels_min: float | None
    front_line_pixels_max: float | None
    sst_mean_celsius: float | None
    sst_min_celsius: float | None
    sst_max_celsius: float | None
    sst_gradient_c_per_km_mean: float | None = None
    sst_gradient_c_per_km_min: float | None = None
    sst_gradient_c_per_km_max: float | None = None


class HistoryCacheInfo(BaseModel):
    hit: bool
    key: str
    index_fingerprint: str
    path: str | None
    generated_at: str
    cache_layer: str = "json-query-cache"
    metadata_source: str = "unknown"
    records_evaluated: int = 0
    timeline_record_count: int = 0
    duration_ms: float | None = None


class HistoryGridInfo(BaseModel):
    dataset_type: str
    variable: str
    source_file: str | None
    lon_min: float | None
    lon_max: float | None
    lat_min: float | None
    lat_max: float | None
    lon_count: int
    lat_count: int
    lon_resolution_deg: float | None
    lat_resolution_deg: float | None
    dimensions: list[str]


class HistorySpatialIndex(BaseModel):
    query_bbox: list[float] | None
    front_grid: HistoryGridInfo | None
    sst_grid: HistoryGridInfo | None


class HistoryIndexResponse(BaseModel):
    dataset: str
    version: str
    ready: bool
    generated_at: str
    fingerprint: str
    metadata_source: str = "directory-scan"
    front_file_count: int
    sst_file_count: int
    available_date_start: DateType | None
    available_date_end: DateType | None
    available_dates: list[DateType]
    available_years: list[int]
    available_months: list[str]
    spatial: HistorySpatialIndex
    cache_path: str
    message: str | None = None


class HistoryProbabilityResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    summary: HistorySummary
    same_period_records: list[HistoryTimelinePoint]
    monthly_records: list[HistoryTimelinePoint]
    explanation: list[str]
    cache: HistoryCacheInfo


class HistoryMonthlyResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    selected_month: int
    selected: HistoryMonthlyPoint | None
    monthly: list[HistoryMonthlyPoint]
    explanation: list[str]
    cache: HistoryCacheInfo


class HistoryLocalRecord(BaseModel):
    date: DateType
    year: int
    month: int
    matched_rule: str
    front_present: bool
    front_line_pixels: int
    cold_side_pixels: int
    warm_side_pixels: int
    sst_mean_celsius: float | None
    source_files: list[str]


class HistoryLocalResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    same_period_records: list[HistoryLocalRecord]
    monthly_records: list[HistoryLocalRecord]
    source_files: list[str]
    explanation: list[str]
    cache: HistoryCacheInfo


class HistoryResponse(BaseModel):
    date: DateType
    longitude: float
    latitude: float
    radius_deg: float
    summary: HistorySummary
    timeline: list[HistoryTimelinePoint]
    monthly: list[HistoryMonthlyPoint]
    explanation: list[str]
    cache: HistoryCacheInfo
    source_files: list[str]
    same_period_records: list[HistoryTimelinePoint] = []
    monthly_records: list[HistoryTimelinePoint] = []
