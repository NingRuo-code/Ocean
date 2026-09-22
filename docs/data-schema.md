# 原型数据契约（v1）

> 适用对象：`prototype-fishing.html` 这个纯前端原型。
> 生成方式：**两个脚本 + 零手工编辑**，页面只通过 `prototype-data.js`（`window.OFData`）读数据。
> 相关文档：主项目契约见 `Ocean/docs/data-contract.md`（同一批数据、后端接口口径）。

---

## 1. 数据来源

| 数据 | 来源 | 许可 | 分辨率 / 覆盖 |
|---|---|---|---|
| 锋面位置（核心） | Zenodo **20356239** · 《A global daily mesoscale front dataset from satellite observations》 | **CC BY 4.0**（需署名） | 0.05° 逐日，全球 3600×7200，1982—2024 |
| 海表温度 | NOAA CoastWatch / GHRSST `noaacwBLENDEDCsstDaily`（Geo-Polar Blended 夜间融合 L4，免账号） | GHRSST **free and open** | 0.05° 逐日、度 C，2002—至今（本演示取 2024-07-01 ~ 08-31） |
| 底图（陆地 / 海岸线 / 等深线） | **Natural Earth 1:10m**（`ne_10m_land` / `ne_10m_coastline` / `ne_10m_bathymetry_K_200` / `J_1000`） | **公有领域**（无需署名，可商用） | 1:10m 矢量 |
| AIS/GFW 响应（P1 规划） | GFW 风格 apparent fishing effort / 合作方 AIS 衍生表 / 本地 synthetic fixture | GFW API/服务默认 **CC BY-NC 4.0 非商业**；合作方数据按授权文件；fixture 仅用于测试 | P1 计算优先保留 0.01° 工作粒度，展示可聚合到 0.05° |

没有接入、也**不会**用示例值冒充的：锋面强度、海况（风/浪/涌）、预报、渔场分布。这些在 `meta.status` 里统一标成 `not_available`。
海表温度**已接入真实数据**（NOAA GHRSST 0.05° 逐日，与锋面数据集不同源，见 §3.4），`meta.status.sst = "real"`。
AIS/GFW 响应入口已预留；真实数据接入前只允许 placeholder 或 synthetic fixture，不把 fixture 写成真实证据。数据公开与提交边界以 [`docs/data-governance-gfw-ais.md`](data-governance-gfw-ais.md) 为准。

> 锋面文件里的 `-128` 同时表示**陆地、湖泊、云与缺测**，数据集无法区分「没有锋面」和「没有观测」——页面一律说「没有观测数据」。
> AIS/GFW 的 missing coverage / unavailable 也只能表示“数据不可用或覆盖不足”，不能解释成 zero fishing activity。

---

## 2. 生成流程

```powershell
# ① 拉数据 + 单日图层（真实锋面 → 对象中心线 / 冷暖侧 RLE；真实海温 → 分档游程）
cd Ocean\backend
.\.venv\Scripts\python.exe scripts\fetch_zenodo_front_samples.py 2024-08-05 2024-08-06   # 锋面（Zenodo Range 抽取）
.\.venv\Scripts\python.exe scripts\fetch_sst_samples.py 2024-08-05 2024-08-06           # 海温（NOAA ERDDAP 子集，免账号）
.\.venv\Scripts\python.exe scripts\export_prototype_data.py                             # 扫 raw 全量导出（含海温）

# ③ 往年同期统计（显式给取样日期；不给就扫 raw 全量，会把整月也算进“同期”）
.\.venv\Scripts\python.exe scripts\export_prototype_data.py --mode clim --clim-dates 2015-08-05 2015-08-06 ...

# ④ 底图（Natural Earth 公有领域 → 裁剪 + 抽稀）
cd ..\..\ocean-front-prototype
node tools\build-basemap.mjs
```

- 首次需要环境：`python -m venv .venv` + `.\.venv\Scripts\python.exe -m pip install -e .`（依赖见 `Ocean/backend/pyproject.toml`）
- 缺少的历史日期按需补下载（支持 HTTP Range，单日约 1.3 MB）：
  `.\.venv\Scripts\python.exe scripts\fetch_zenodo_front_samples.py 2019-08-05 2019-08-06`
- 出参全部落在本仓 `data/`，可离线双击 `prototype-fishing.html` 直接跑（`<script>` 引入，不走 fetch，无 CORS 问题）

**参数**：`--bbox 120,27,128,34`（东海窗口）、`--anchor 124.5,30.2`（往年同期锚点＝顶栏定位点）、`--ranges 10,20,30`（找鱼范围）、`--clim-radii 10,20,30,50,100`（同期统计半径，含参照用大半径）、`--tolerance-km 6`（中心线抽稀）、`--min-length-km 20`（对象最短长度）、`--sst-raw-dir`（海温原始目录）、`--no-sst`（只出锋面）。

---

## 3. 文件结构

```
data/
├── meta.js                  window.OF_DATA_META    产品/许可/可用日期/缺什么
├── days.js                  window.OF_DATA_INDEX   清单：有哪些天（页面按它注入 <script>）
├── day/<日期>.js             window.OF_DATA_DAYS    单日真实锋面图层（每天一个文件）
├── sst/<日期>.js             window.OF_DATA_SST     单日真实海温（0.5 °C 分档游程）
├── clim/same-period.js      window.OF_DATA_CLIM    往年同期统计（唯一口径）
├── front_response/events.js window.OF_FRONT_RESPONSE 锋面事件与 AIS 表观捕捞响应表（预留入口）
├── base/basemap.js          window.OF_DATA_BASE    陆地/海岸线/等深线
└── README.md
```

> **加日期不用改 HTML**：`prototype-fishing.html` 只引入 `data/days.js`，
> 页面按清单用 `document.write` 同步注入 `data/day/*.js` 与 `data/sst/*.js`
> （file:// 下同样可用，不依赖 fetch）。数据变了只需要重跑导出脚本。

> **海温来自另一个产品**：`sst/` 是 NOAA CoastWatch ERDDAP 的
> `noaacwBLENDEDCsstDaily`（GHRSST Geo-Polar Blended 夜间融合，0.05° 逐日、度 C），
> 与锋面数据集用的 ESA CCI / C3S SST **不是同一产品**；两者网格还错开半格
> （NOAA 格点是 120.025/27.025… 这种 .025 结尾），页面上按各自的真实经纬度绘制。
> 温度按 0.5 °C 分箱落成 `[row, start, count, bin]` 游程（`bin = round(T / 0.5)`），
> 页面只做「档位 → 颜色」映射，不插值，也不参与把握评分。

### 3.1 `meta.js`

```js
{
  product: { id, name, name_zh, version, doi, url, license, citation, resolution_deg, variables, code_semantics },
  region: { name: "东海", bbox: [120, 27, 128, 34], anchor: [124.5, 30.2], ranges_km: [10, 20, 30] },
  grid: { lon0, lat0, dlon, dlat, nx, ny },
  availability: { days: [...], clim: { ready, years, dates, sample_note }, basemap: { ready, source } },
  status: { front_line: "real", cold_side: "real", warm_side: "real", front_objects: "real",
            sst: "real", intensity: "not_available", forecast: "not_available",
            sea_state: "not_available", fishing_grounds: "not_available",
            front_response: "not_available" | "synthetic_fixture" | "real" },
  generated_at, generator, known_issues: [...]
}
```

### 3.2 `day/<日期>.js`

| 字段 | 含义 |
|---|---|
| `date` / `source_file` | 日期以**文件名**为准（文件内时间坐标单位有误，不使用） |
| `grid` | 裁剪窗口：`lon0/lat0/dlon/dlat/nx/ny`，行号从南到北、列号从西到东 |
| `objects[]` | 锋面对象：`front_id`(F001…)、`pixel_count`、`codes`(数据里的 -10/10/30)、`length_km`、`bbox`、`centroid`、`line`(中心线经纬度)、`line_points_raw` |
| `front_line` | 所有锋面线段：前 `object_line_count` 条是对象中心线，其后是 `short_line_count` 条未编号短段 |
| `front_band_rle` | 锋面带像元，逐行游程 `[row, start, count, code]` |
| `cold_side_rle` / `warm_side_rle` | 冷侧(`-20`) / 暖侧(`20`) 像元，逐行游程 `[row, start, count]` |
| `nodata_rle` | 没有观测的像元（陆地/云/缺测，`-128`），逐行游程 |
| `quality` | `valid_cells` / `nodata_cells` / `nodata_percent` / `front_line_cells` / `front_line_density_per_1000_pixels` / `cold_side_cells` / `warm_side_cells` / `line_code_mix` / `short_object_count` / `object_min_length_km` / `line_tolerance_km` |
| `has_sst` / `has_intensity` | 恒为 `false`，提醒调用方这两个变量没有真实数据 |

**对象编号规则**：对锋面线像元（`-10/10/30`）做 8 邻域连通域 → 每个连通域取「直径路径」作为中心线 → 按公里做 Douglas-Peucker 抽稀（容差 6 km）→ 按长度降序编号（≥20 km 才编号）。`front_id` 是项目内临时编号，**不是**数据集自带的长期锋面轨迹编号。

### 3.3 `clim/same-period.js`

唯一口径（与需求 §5.2 一致）：

```text
front_present = 半径内锋面线像元数 > 0
probability  = 有锋面的天数 / 有效天数
```

- `rows[]`：逐个取样日期，`by_range["10"|"20"|"30"|"50"|"100"] = { line_cells, valid_cells, front_present, status }`
- `by_day["08-05"].years["2015"].by_range[...]`：某年某天的明细（缺样本的年份不出现，页面显示「缺测」）
- `by_year["2015"].by_range["100"] = { days, present_days, line_cells, probability }`
- `method` / `sample_note`：页面直接展示，写清算法与实际取样范围

> 为什么会看 100 km：锋面在海上分布很散，只盯 10–30 km 会经常出现 0%，看不出年份差别；页面把大半径当参照，用户选的找鱼范围仍按原样展示。

### 3.4 `sst/<日期>.js`

真实海温（NOAA GHRSST 0.05° 逐日，度 C），按 **0.5 °C 分箱**落成逐行游程，页面只做「档位 → 颜色」映射：

```js
{ date, source_file,
  product: { id: "noaacwBLENDEDCsstDaily", name_zh, license, url, note: "与锋面数据集不同源", ... },
  grid: { lon0, lat0, dlon: 0.05, dlat: 0.05, nx, ny },
  bin_c: 0.5,
  runs: [[row, startCol, count, bin], ...],   // bin = round(T / 0.5)
  stats: { vmin_c, vmax_c, mean_c, valid_cells, missing_cells } }
```

- 只存有效格点（陆地 / 冰 / 缺测不进 `runs`）；`sum(run.count) === stats.valid_cells` 由 `data-check` 断言
- 海温网格的起点是 `.025` 结尾（如 120.025 / 27.025），与锋面网格错开半格，绘制时各按自己的真实坐标
- `OFData.sstCell(iso, lon, lat)` 直接在这份游程里查那一格的真实档位温度（不插值）

### 3.5 `base/basemap.js`

`layers.{land|coastline|isobath200|isobath1000}.chains`（经纬度折线数组，已裁剪到 `bbox` 并抽稀，陆地多边形丢弃内环/湖面）。

### 3.6 `front_response/events.js`

P1 响应表用于“历史 AIS 响应”证据块和研究图，不是真实渔获量表。当前文件可以处于三种状态：

- `not_available`：只声明入口，不提供数值。
- `synthetic_fixture`：提交小型夹具，验证数据契约和 UI 路径；不是真实 AIS/GFW 证据。
- `real`：真实或授权样例数据接入后使用，提交前必须先满足 `docs/data-governance-gfw-ais.md`。

placeholder 最小形态：

```js
{
  schema_version: "front-response/v1",
  status: "not_available",
  metric: "apparent_fishing_effort",
  unit: "fishing_hours",
  events: []
}
```

synthetic fixture / real 响应表必须写清：

- `response_id`：单条响应记录 ID，至少区分日期、front_id 和 buffer。
- `front_event_id`：项目内锋面事件 ID，例如 `2024-08-05:F001`。
- `date`：锋面事件日期。
- `front_id`：当日数据中的本地临时锋面编号。
- `front_id_scope = "local_day"`：明确该 ID 不是长期锋面轨迹。
- `buffer_km`：`10` / `20` / `30`。
- `pre7_hours`、`post1_3_hours`、`non_front_control_hours`、`lift_percent`、`enhanced_flag`。
- `pre_window`：事件日前 7 天，`relative_days = [-7, -1]`，用于 `pre7_hours` 基线。
- `post_window`：事件日后 1-3 天，`relative_days = [1, 3]`，用于默认响应解释。
- `exploratory_window`：事件日前后 7 天，`relative_days = [-7, 7]`，用于研究视图和人工复核，不替代默认增强判定。
- `control`：同日非锋面对照区定义，P1 要求 `min_distance_km >= 50`，并写清 `area_ratio` 与 `sampling`。
- `method.control_validation`：说明非锋面对照区的验证边界；synthetic fixture 只声明聚合采样口径，真实输入必须在转换前完成 50 km 锋面排除的地理校验。
- `status`：`available` / `missing_coverage` / `not_authorized` / `not_in_sample`。
- `coverage_status`：`available` 事件必须为 `available`；不可用事件必须与 `status` 一致或省略。
- `source.kind`：`gfw_public` / `partner_ais_derivative` / `synthetic_fixture`
- `source.attribution`、`source.license`、`source.accessed_at`
- `time_window`、`spatial_window`、`public_boundary`、`generated_by`
- `metric = "apparent_fishing_effort"`，`unit = "fishing_hours"`
- `is_synthetic`：fixture 必须为 `true`

当前 synthetic fixture 的默认转换流程：

```powershell
node tools\build-front-response.mjs
```

默认输入是 `data/front_response/fixture-effort-sample.json`，这是小型聚合夹具，不是 raw AIS/GFW 或 0.01° 细粒度中间表。真实样例到位后可用同一脚本传入 `--input <本地授权样例>`，但提交真实生成物前必须先复核 `docs/data-governance-gfw-ais.md`。

真实或授权样例的本地输入格式、目录边界和提交 go / no-go 以 [`docs/gfw-ais-real-sample-intake.md`](gfw-ais-real-sample-intake.md) 为准。默认本地目录是 `local_data/gfw_ais/`，其中 raw、download、intermediate 和本地授权聚合输入都只用于本机处理，不直接进入 Git。

响应表校验规则：

- 响应日期必须落在已导出的锋面样本日期内。
- `front_id` 必须属于该日期的本地锋面对象。
- `front_event_id` 必须等于 `date:front_id`。
- `buffer_km` 只能是 `10` / `20` / `30`。
- 每个 `front_event_id` 必须覆盖 `10` / `20` / `30` 三档 buffer；覆盖不足也要用 `missing_coverage` 等不可用状态显式占位。
- `available` 事件的 effort 数值必须是有限非负数，`lift_percent` 必须与 `pre7_hours` / `post1_3_hours` 基本一致。
- `enhanced_flag` 必须满足当前 P1 规则：`post1_3_hours >= pre7_hours * 1.2` 且 `post1_3_hours > non_front_control_hours`。
- 时间窗口必须由事件日期可复现推出：前 7 天为 `date-7` 到 `date-1`，后 1-3 天为 `date+1` 到 `date+3`，探索窗口为 `date-7` 到 `date+7`。
- 非锋面对照区必须是同日、同海区、至少离任一锋面 50 km 的背景区域，并写清面积配比/采样口径；否则不能输出 `enhanced_flag`。
- 不可用事件不能携带 fishing hours、lift 或 enhanced flag；缺测值不能用 `0` 代替。
- 只有确认为 coverage available 且计算结果为 0 时，才允许出现 `0 fishing hours`。

---

## 4. 页面侧的读取方式

`prototype-data.js` 是唯一入口，页面不直接碰原始对象：

| API | 用途 |
|---|---|
| `OFData.availableDates()` / `firstDate()` / `lastDate()` | 决定日期控件范围 |
| `OFData.dateInfo(iso)` | 有数据没数据、没数据的原因（空态文案） |
| `OFData.objects(iso)` / `objectLineCount(iso)` / `frontLines(iso)` | 锋面对象与线段 |
| `OFData.bandRuns(iso, kind)` | 锋面带 / 冷侧 / 暖侧 RLE（`kind`：`front`/`cold`/`warm`） |
| `OFData.cellInfo(iso, lon, lat)` | 某一格到底是什么：缺测 / 锋面线（含编码）/ 冷侧 / 暖侧 |
| `OFData.quality(iso)` / `grid(iso)` | 观测覆盖、网格信息 |
| `OFData.clim` / `climReady()` | 往年同期统计 |
| `OFData.sst(iso)` / `sstStats(iso)` / `sstCell(iso, lon, lat)` | 真实海温：游程、统计值、某格真实档位温度（无则 `valueC = null`） |
| `OFData.frontResponse(iso, rangeKm)` / `frontResponseAvailable()` | 锋面事件与 AIS 表观捕捞响应；当前可读取 synthetic fixture，真实样例接入前必须继续标注不是真实 AIS/GFW 证据 |
| `OFData.attribution()` | 「依据」页的数据来源、许可、已知问题（含海温产品与「不同源」说明） |
| `OFData.sstAvailable()` 等 | 明确「还没有」的东西一律返回 false |

---

## 5. 已知问题（页面「依据」页同步展示）

1. 锋面文件本身不含 SST；海温另用 **NOAA GHRSST 融合产品**（0.05° 逐日，见 §3 说明），两者**不是同一产品**，同屏出现时属于两个来源的观测；温度按 0.5 °C 分档展示、不插值、不参与评分。
2. `-128` 无法区分陆地、湖泊、云与缺测。
3. AIS 响应入口已预留，但真实 GFW/AIS 表观捕捞活动样例尚未接入；后续使用的是 fishing hours，不是渔获量、产量或收益。GFW/API 数据默认按非商业、需署名和 caveat 的公开边界处理，详见 `docs/data-governance-gfw-ais.md`。
3. 锋面线编码 `-10/10/30` 的物理语义在数据集说明里仍有歧义，原型不解释其含义，只按「锋面线」统一呈现；指针浮层只回答「是否锋面区（是则冷暖侧）」，不解释也不展示原始编码。
4. 锋面文件时间坐标单位错误（`days since 0000-00-00`），日期以文件名为准。
5. 对象编号是本地连通域临时编号，不等同于长期锋面轨迹编号。
6. `frontal_intensity` 尚未下载（约 100 GB，43 个分年包），契约里已写对数还原公式。
7. 底图为 Natural Earth 1:10m（公里级精度，World Data Bank 2 来源在某些海岸约 7 km 误差）；国内正式发布需换成带审图号的合规底图。
8. 渔场/船位数据缺失；地图上的「值得去的水域」是示例占位，不参与把握评分。
9. 海温虽是真实数据，但来自 NOAA GHRSST 融合产品（与锋面数据集用的 ESA CCI/C3S 不同源，且融合产品云下是分析值）；页面按 0.5 °C 分档显示，温度不参与把握评分。

---

## 6. 校验

```bash
node tools/data-check.mjs     # 数据文件结构与自洽（每个数据天 14 项 + 海温/清单断言；VERBOSE=1 打全部）
node tools/e2e-check.mjs      # 页面端到端（108 项，含「没有编造数值」断言）
node tools/layout-check.mjs   # 布局（25 项，1680/1280 两档）
```

`data-check` 会校验：网格与窗口一致、对象编号唯一且有序、中心线在窗口内、RLE 结构合法并且**还原出的像元数等于 `quality` 里的统计**、`has_sst/has_intensity` 为 false、生成文件里没有 `NaN/Infinity`；海温另有：与 `meta` 声明一致、`bin_c=0.5`、游程还原数 = `valid_cells`、档位落在 0~40 °C、与数据源单点值对得上（2024-08-05 @124.525°E/30.025°N = 30.69 °C）；并校验 `days.js` 清单与目录一致。
