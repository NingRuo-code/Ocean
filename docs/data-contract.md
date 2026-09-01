# 第一阶段数据契约

## 数据来源

- 数据集：A global daily mesoscale front dataset from satellite observations
- Zenodo：https://zenodo.org/records/20356239
- DOI：10.5281/zenodo.20356239
- 版本：V1.0
- 许可：CC BY 4.0
- 时间范围：1982—2024
- 格式：逐日 NetCDF

## 已知变量

### `front`

已使用 `front_location20240805.nc` 验证：`front` 为逐日三维变量，维度顺序是 `(lat, lon, time)`，形状为 `(3600, 7200, 1)`，数据类型为 `int8`，空间分辨率为 0.05°。

| 条件 | 解释 |
|---|---|
| `front == -10 or 10 or 30` | 锋面线 |
| `front != 0 and front != -128` | 锋区 |
| `front > 0 and front != -128` | 暖侧 |
| `front < 0 and front != -128` | 冷侧 |
| `front == -128` | 陆地或缺失值 |

实际样例出现的全部取值为 `-128、-20、-10、0、10、20、30`。其中 `-20` 和 `20` 分别对应冷侧和暖侧锋区；`-10、10、30` 是锋面线编码。

坐标实测结果：

- `lon`：7200 个 `float32` 值，从 `-179.975` 递增到 `179.975`；
- `lat`：3600 个 `float32` 值，从 `-89.975` 递增到 `89.975`；
- 投影：WGS84；
- `time`：长度为 1，时区为 UTC；
- 文件内部采用 gzip level 5，`front` chunk 为 `(1800, 3600, 1)`。

注意：锋面线值同时满足正负侧条件。实现图层时应先提取锋面线，再计算冷暖侧掩码，避免图层语义混淆。

### `frontal_intensity`

锋面强度在存储前经过对数变换。原始值恢复规则为：

```text
stored == -128  →  NaN
original = 10 ** ((stored + 100) / 100) - 1
```

第一阶段可不接入该变量，但接口命名应避免与 `front` 混用。

## 已确认与未纳入范围

- SST 不在 Zenodo 锋面位置文件中，使用 Copernicus Marine 产品 `C3S-GLO-SST-L4-REP-OBS-SST`，变量为 `analysed_sst`。
- SST 产品 DOI 为 `10.48670/moi-00169`，下载需要 Copernicus Marine 账户；项目运行阶段只读取本地文件。
- SST 与锋面数据均为 0.05° 规则全球网格，局部样例已经完成坐标方向核对。
- 锋面文件的 `days since 0000-00-00` 不用于日期推断，日期以文件名为准。
- 当前样例没有发现独立锋面编号变量；当前第一版通过锋面线连通像元生成临时 `front_id`，用于演示对象级分析和连续日期质心匹配追踪。该 `front_id` 是项目内计算编号，不等同于论文数据集自带的长期锋面轨迹编号。

## 已验证文件获取方式

`front_location.zip` 支持 HTTP Range。压缩包内包含 15,706 个逐日文件，命名规则为：

```text
front_location/front_locationYYYYMMDD.nc
```

无需下载完整压缩包，可运行：

```powershell
cd backend
python scripts/fetch_zenodo_front_samples.py 2024-08-05 2024-08-06 2024-08-07
```

脚本会把对应文件保存到 `data/raw/front/2024/`。

## 后端标准响应

```json
{
  "dataset": "global-daily-mesoscale-front-v1",
  "date": "2024-08-05",
  "bbox": [120.0, 28.0, 126.0, 34.0],
  "resolution_degrees": 0.05,
  "layers": {
    "sst": "GeoJSON Polygon FeatureCollection",
    "front_band": "GeoJSON Polygon FeatureCollection",
    "front_line": "GeoJSON LineString FeatureCollection",
    "warm_side": "GeoJSON Polygon FeatureCollection",
    "cold_side": "GeoJSON Polygon FeatureCollection"
  },
  "rasters": {
    "sst": {
      "format": "image/png",
      "url": "/api/analysis/2024-08-05/raster?...&kind=sst",
      "bounds": [123.5, 29.2, 125.5, 31.2],
      "width": 41,
      "height": 41,
      "render_mode": "sst-temperature-colormap"
    }
  },
  "provenance": {
    "source_file": "example.nc",
    "dataset_version": "V1.0"
  }
}
```

当前 `/api/analysis/{date}` 直接返回可供 MapLibre 使用的 GeoJSON 图层和 raster 元信息。其中 `rasters.sst` 指向后端生成的 PNG 温度场图像，适合作为地图底图；`sst`、`front_band`、`warm_side`、`cold_side` 仍保留 GeoJSON Polygon 表达，用于点击交互、兜底显示和矢量叠加；`front_line` 保留 LineString，用于在锋面带上叠加中心线。查询窗口较大时，GeoJSON 面图层会根据 `quality.geojson_sst_sample_step` 和 `quality.geojson_front_sample_step` 自动抽样，前端优先使用 PNG raster 避免响应体过大。

单日分析响应同时包含对象图层：

- `layers.front_object_centroids`：锋面对象质心点；
- `layers.front_object_bboxes`：锋面对象包围框。

### `GET /api/analysis/{date}/raster`

返回 `image/png`，参数与单日分析接口一致：

- `longitude` / `latitude`：查询中心；
- `radius_deg`：查询半径；
- `kind`：`sst`、`front` 或 `combined`。

响应头中包含：

- `X-Raster-Bounds`：图像对应的 `[west,south,east,north]`；
- `X-Raster-Cache`：`hit` 或 `miss`，表示是否命中本地 PNG 缓存；
- `X-Raster-Kind`：当前图像类型。

当查询区域没有有效 SST 或 front 栅格时，`/api/analysis/{date}` 不会返回对应 `rasters.*` 元信息；PNG 编码器也提供 1×1 透明图兜底，避免浏览器因为 0 宽/高图像解码失败。

### `GET /api/data/manifest`

返回离线数据清单和覆盖配对状态：

- `total_file_count` / `total_size_bytes`：本地数据总量；
- `paired_dates` / `paired_date_count`：front 与 SST 同时存在的日期；
- `missing_sst_dates`：有 front 但缺 SST 的日期；
- `missing_front_dates`：有 SST 但缺 front 的日期；
- `datasets`：front、SST、front_intensity 等数据集的文件数、日期数、年月覆盖、变量列表。

### `GET /api/data/index`

返回本地 SQLite 元数据索引状态。该索引用于把后续全量数据接入从“每次扫目录”推进到“查询本地元数据表”：

- `index_path`：SQLite 索引文件位置，默认 `data/processed/data_index.sqlite`；
- `schema_version`：索引结构版本，当前为 `data-index-v1`；
- `total_file_count` / `total_size_bytes`：纳入索引的文件总数和总体积；
- `indexed_date_count`：front/SST 日期并集数量；
- `paired_date_count`：front 与 SST 同时存在的日期数量；
- `missing_sst_dates`：有 front 但缺 SST 的日期；
- `missing_front_dates`：有 SST 但缺 front 的日期；
- `datasets`：每类数据集的文件数、日期数、年月覆盖、重复日期数量和样例路径；
- `integrity_warnings`：索引层发现的缺失、重复或 schema 不一致提示；
- `query_examples`：用于核对索引内容的 SQL 示例。

索引生成命令：

```powershell
cd backend
python scripts/build_data_index.py
```

### `GET /api/data/index/{date}`

按日期查询 SQLite 索引，返回该日命中的本地文件：

- `complete`：该日是否同时具备 front 与 SST；
- `front_file_count` / `sst_file_count` / `intensity_file_count`：各类文件命中数量；
- `files[]`：文件类型、相对路径、文件大小、日期覆盖范围、覆盖天数和 `canonical` 标记；
- `notes`：缺失或可分析状态说明。

当同一天被多个 SST 文件覆盖时，`canonical=true` 表示当前索引建议优先使用的文件。该接口适合在前端展示“当前查询日期到底用了哪些文件”，也适合后续作为分析任务调度层的入口。

### `GET /api/data/plan`

返回下一步离线数据准备计划，供前端“数据状态”区和命令行脚本使用：

- `target_date_start` / `target_date_end` / `target_dates`：默认建议扩展的 14 天连续样本窗口；
- `target_missing_front_dates`：目标窗口内还缺少 front_location 的日期；
- `target_missing_sst_dates`：目标窗口内还缺少 SST 的日期；
- `historical_reference_date` / `historical_year_start` / `historical_year_end` / `historical_window_days`：跨年份同期样本目标；
- `historical_paired_date_count` / `historical_target_date_count`：跨年份同期样本的已配对进度；
- `historical_missing_front_dates` / `historical_missing_sst_dates`：跨年份同期缺失日期；
- `duplicate_front_groups` / `duplicate_sst_groups`：重复数据文件分组、建议保留路径和备份说明；
- `recommended_steps`：按当前数据状态生成的下一步处理建议；
- `download_commands`：可复制执行的数据补齐、manifest 重建和 smoke 验收命令；
- `historical_download_commands`：跨年份同期样本补齐参考命令；
- `source_notes`：Zenodo front_location、front_intensity 和 Copernicus SST 的数据来源说明。

该接口不直接下载或移动文件，只生成计划；真正的数据下载和去重由脚本或用户确认后的命令执行。

### `GET /api/front-objects/{date}`

把查询窗口内的锋面线像元按 8 邻域连通性聚类为锋面对象，返回：

- `object_count`：当前窗口内锋面对象数量；
- `nearest_front_id`：离查询点最近的对象 ID；
- `objects[].front_id`：由日期和对象序号生成的临时 ID，例如 `20240805-F001`；
- `objects[].centroid_longitude` / `centroid_latitude`：对象质心；
- `objects[].bbox`：对象包围框 `[west,south,east,north]`；
- `objects[].length_km`：基于像元数量和网格间距的近似长度；
- `objects[].nearest_to_query_km`：对象内最近锋面像元到查询点的近似距离；
- `layers.centroids` / `layers.bboxes`：前端可直接加载的 GeoJSON 图层。

### `GET /api/front-tracking/{date}`

在从查询日期开始的连续日期窗口内，对每天离查询点最近的锋面对象进行简易追踪，返回：

- `days`：追踪窗口天数，默认 3，最大 31；
- `available_step_count`：窗口内实际存在 front 文件的日期数量；
- `tracked_step_count`：检测到最近锋面对象的日期数量；
- `cumulative_displacement_km`：连续检测到对象时的累计质心位移；
- `algorithm` / `algorithm_notes`：当前追踪算法标识和面向汇报的算法说明；
- `steps[]`：每日对象 ID、质心、长度、距查询点距离、相对前一匹配日位移、匹配分数和状态；
- `steps[].match_score`：综合质心距离、形态相似度和 bbox 重叠率后的匹配分数，越接近 1 表示连续性越强；
- `steps[].shape_similarity`：对象长度与像元数的相似度；
- `steps[].bbox_overlap_ratio`：相邻日期对象 bbox 的重叠比例；
- `layers.track_points` / `layers.track_lines`：前端可视化追踪点和追踪线。

当前追踪规则是第一版工程规则：首日按查询点最近对象锚定，后续综合质心距离、对象长度/像元数相似度与 bbox 重叠率打分；如果最佳对象超过 `match_distance_km`，则重新按查询点最近对象锚定。响应中的 `matched_by` 标记匹配原因，`candidates_considered` 标记候选对象数量。该结果不代表完整的跨日同一锋面物理轨迹。如果后续要做论文级追踪，需要确认匹配半径、速度约束和断裂/合并处理规则。

### `GET /api/report/{date}`

生成可用于汇报的确定性报告。参数与单日分析一致，另支持 `days` 指定追踪窗口天数。响应包括：

- `title` / `generated_at`：报告标题与生成时间；
- `query`：查询日期、位置、范围和追踪天数；
- `highlights`：可直接口头汇报的关键结论；
- `markdown`：Markdown 版报告内容；
- `html`：HTML 版报告内容，前端可直接下载；
- `source_files`：报告涉及的本地源文件。

报告内容由后端调用单日分析、对象识别、连续追踪和历史统计工具生成，科学数值不由前端或 AI 文本自行编造。

## 历史统计接口契约

第 5—8 周历史统计围绕“索引、局地提取、概率、月度统计、缓存追溯”展开。当前接口均只读取本地 `data/raw` 文件，不依赖联网服务。

### `GET /api/history/index`

返回本地历史档案索引：

- `front_file_count` / `sst_file_count`：本地已发现的 front 与 SST 文件数量；
- `available_date_start` / `available_date_end`：本地 front 日期范围；
- `available_dates` / `available_years` / `available_months`：可用日期、年份和月份；
- `spatial.front_grid` / `spatial.sst_grid`：经纬度范围、网格数量、分辨率和变量维度；
- `spatial.query_bbox`：传入经纬度和半径时生成的查询窗口；
- `fingerprint`：由文件路径、大小和修改时间生成的索引指纹；
- `cache_path`：历史索引缓存位置。

### `GET /api/history/{date}`

返回前端综合历史统计：

- `summary.available_years`：参与历史统计的年份；
- `summary.valid_years`：查询窗口内存在有效 front 像元的年份；
- `summary.front_years`：查询窗口内出现锋面线像元的年份；
- `summary.same_period_probability`：同月同日历史样本中的锋面发生概率；
- `summary.same_period_expected_sample_count`：完整 1982—2024 目标下，同月同日应覆盖的年份数；
- `summary.same_period_coverage_ratio`：当前同月同日样本数 / 完整目标年份数；
- `summary.monthly_probability`：查询月份全部历史样本中的锋面发生概率；
- `summary.monthly_expected_sample_count`：完整 1982—2024 目标下，该月份应覆盖的总天数；
- `summary.monthly_coverage_ratio`：当前同月样本数 / 完整目标月份天数；
- `summary.sample_reliability_level` / `summary.sample_reliability_label`：样本覆盖可信度等级，例如“演示级”“中等”“较高”；
- `summary.sample_coverage_note`：面向汇报的样本覆盖说明；
- `summary.front_line_pixels_mean/min/max`：多年局地锋面线像元统计；
- `summary.sst_mean_celsius` / `summary.sst_min_celsius` / `summary.sst_max_celsius`：多年局地 SST 统计；
- `summary.sst_gradient_c_per_km_mean/min/max`：多年局地 SST 温度梯度统计；
- `timeline`：所有历史日期的局地统计序列；
- `monthly`：1—12 月月度统计；
- `same_period_records` / `monthly_records`：参与概率计算的样本记录；
- `cache`：查询缓存命中、缓存键、索引指纹、生成时间、索引来源、实时计算记录数、时间线记录数和本次构造耗时；
- `source_files`：本次重点计算涉及的源文件。

### `GET /api/history/{date}/probability`

概率解释专用接口，重点返回：

- `same_period_records`：同月同日样本；
- `monthly_records`：同月样本；
- `explanation`：概率公式、命中规则和缓存说明。

### `GET /api/history/{date}/monthly`

月度统计专用接口，重点返回：

- `selected_month`：查询日期所在月份；
- `selected`：该月份样本数、命中数、概率和 SST 统计；
- `monthly`：12 个月完整列表。

### `GET /api/history/{date}/local-records`

局地历史数据提取接口，重点返回：

- `same_period_records`：用于历史同期概率的局地样本；
- `monthly_records`：用于月度概率的局地样本；
- `matched_rule`：记录被纳入计算的规则，如 `same-month-day` 或 `same-month`；
- `source_files`：参与局地裁剪的本地 NetCDF 文件路径。

### 概率定义

当前第一版规则如下：

```text
front_present = 查询窗口内锋面线像元数量 > 0
probability = front_present 样本数 / 有效样本数
```

如果老师要求按锋面强度、锋面面积占比、距查询点最近锋面距离或其他海洋学定义计算概率，需要在此处更新契约并同步修改后端规则。

样本覆盖可信度不是数学置信区间，而是当前本地样本相对完整 1982—2024 目标数据的覆盖程度。当前默认等级：

- 同期样本数 0：无同期样本；
- 1—4：样本偏少；
- 5—14：演示级；
- 15—29：中等；
- 30 及以上：较高。

## 局地温差与温度梯度

单日分析接口和点位查询接口已经返回局地温度结构字段：

- `/api/analysis/{date}` 的 `sst.range_celsius`：查询窗口内 SST 最大值与最小值之差；
- `/api/analysis/{date}` 的 `sst.gradient_c_per_km`：查询窗口内相邻 SST 网格温差按经纬度距离换算后的平均梯度；
- `/api/analysis/{date}` 的 `sst.max_gradient_c_per_km`：查询窗口内相邻网格最大温度梯度；
- `/api/point/{date}` 的 `temperature_range_celsius` / `temperature_gradient_c_per_km`：点位附近小窗口的温差和梯度。

当前梯度为规则网格上的近似值：

```text
东西向距离 ≈ 经度差 × 111.195 × cos(latitude) km
南北向距离 ≈ 纬度差 × 111.195 km
温度梯度 ≈ 相邻网格 SST 差值 / 网格距离
```

该定义适合第一版演示和局地对比。若老师要求采用更严格的海洋学梯度定义，需要进一步确认公式、平滑尺度和单位。

## 离线 AI 智能体接口契约

第 9—12 周 AI 层围绕“自然语言任务输入、结构化任务生成、工具调用流程、证据解释、本地知识库”展开。AI 层不直接计算科学数值，只调度已经实现的确定性接口。

### `GET /api/ai/capabilities`

返回 AI 运行环境和能力边界：

- `provider`：当前 AI 提供方，默认 `rules`；
- `model`：当前模型或规则解析器名称；
- `local_llm_endpoint`：预留本地小模型服务地址；
- `local_model_available` / `local_model_status`：本地模型或规则解析器是否可用；
- `supported_tasks`：支持的任务；
- `supported_tools`：AI 可调度的工具；
- `guarantees`：AI 不改数值、结论绑定证据等约束。

当前 `OCEAN_AI_PROVIDER` 支持：

- `rules`：默认确定性规则解析器，不需要模型服务；
- `ollama`：兼容 Ollama `/api/generate`；
- `llamacpp` 或 `llama.cpp`：兼容 llama.cpp server `/completion`；
- `openai-compatible`：兼容本地 OpenAI-style `/v1/chat/completions`。

### `GET /api/ai/health`

返回 AI 层健康检查结果：

- `provider` / `model` / `local_llm_endpoint`：当前模型适配配置；
- `local_model_available`：本地模型服务是否可连接；
- `local_model_status`：连接成功、失败或 provider 不支持的明确原因；
- `checked_at`：检测时间。

`rules` 模式下该接口直接返回可用；非 `rules` 模式会按 provider 对应协议发送最小 ping 请求。

### `GET /api/ai/knowledge`

返回本地锋面知识库条目：

- `id`：知识条目 ID；
- `title`：知识条目标题；
- `content`：本地知识内容；
- `source_files`：知识库文件路径。

### `POST /api/ai/analyze`

请求体：

```json
{
  "message": "分析 2024-08-05 东经124.5 北纬30.2 1度范围的锋面，并解释历史概率",
  "default_date": "2024-08-05",
  "default_longitude": 124.5,
  "default_latitude": 30.2,
  "default_radius_deg": 1
}
```

响应体核心字段：

- `structured_task`：结构化任务 JSON；
- `tool_calls`：AI 选择的工具、原因、参数和关联证据；
- `evidence`：工具结果或知识库证据；
- `conclusions`：带 `evidence_ids` 的分析结论；
- `recommendations`：下一步任务推荐；
- `warnings`：缺失参数或数据不足提示。

当前固定证据 ID 包括：

- `structured-task-parameters`：自然语言解析后的日期、经纬度、空间范围、月份、连续天数、假设和缺失参数；
- `current-front-summary`：当前窗口内锋面线、冷侧和暖侧像元统计；
- `current-temperature-structure`：当前窗口内 SST 温差、平均温度梯度和局地均值；
- `current-point-state`：查询点冷暖侧/锋面类别、中心 SST 和距最近锋面距离；
- `front-object-summary`：当前窗口内锋面对象数量、最近对象、质心、长度和距查询点距离；
- `front-tracking-summary`：连续日期窗口内最近锋面对象追踪状态、每日对象 ID 和位移；
- `history-same-period-probability`：历史同期概率；
- `history-monthly-probability`：月度概率；
- `history-multi-day-change`：连续多日变化；
- `knowledge-*`：本地知识库证据。

### 当前支持的任务名

- `show_current_front`：查询某日某位置锋面；
- `calculate_historical_probability`：查询历史发生概率；
- `query_monthly_activity`：查询某月份锋面活动；
- `change_spatial_range`：修改空间范围；
- `show_multi_day_change`：查看连续多日变化；
- `explain_statistics`：解释统计结果。

### AI 数值边界

```text
自然语言模型/规则解析器 → 只能生成任务和解释
后端分析工具 → 负责生成概率、温度、距离、像元数量等数值
AI 结论 → 必须引用 evidence_ids
```
