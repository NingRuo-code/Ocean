# 第 5—8 周历史统计分析验收说明

本阶段目标是把当前局地锋面查询与 1982 年以来的历史资料连接起来。当前实现已按“本地离线、样例先行、接口可扩展”的原则完成第 5—8 周的第一版闭环；在未下载全量 1982—2024 数据前，统计范围等于本地 `data/raw` 中已有的历史样本范围。

## 指导书要求与实现状态

| 原要求 | 当前实现 | 验收位置 |
|---|---|---|
| 建立历史数据时间索引 | 扫描 `data/raw/front` 与 `data/raw/sst`，生成日期、年份、月份、文件数量和缓存指纹；同时建立 SQLite 元数据索引用于全量文件定位，历史索引会优先复用 SQLite 记录 | `GET /api/history/index`、`GET /api/data/index` |
| 建立空间索引 | 读取 front/SST NetCDF 经纬度范围、网格数量、分辨率、变量维度；查询时返回 bbox | `GET /api/history/index?longitude=...&latitude=...&radius_deg=...` |
| 支持局地历史数据提取 | 对每个历史 front 文件按经纬度和半径裁剪，保留同月同日与同月样本记录 | `GET /api/history/{date}/local-records` |
| 计算历史同期发生概率 | 同月同日样本中，查询窗口内存在锋面线像元即判定命中；概率 = 命中数 / 样本数 | `GET /api/history/{date}/probability` |
| 支持单日和月度统计 | 单日统计由 `/api/analysis/{date}` 提供；月度统计按 1—12 月分组 | `GET /api/analysis/{date}`、`GET /api/history/{date}/monthly` |
| 显示多年变化 | 前端“历史统计”面板显示锋面线像元和 SST 均值的时间变化 | React 页面侧栏 |
| 支持连续对象追踪 | 首日按查询点最近对象锚定，后续综合质心距离、对象形态和 bbox 重叠率打分，返回匹配方式、匹配分数、候选数量、状态和位移 | `GET /api/front-tracking/{date}`、前端“锋面对象与追踪” |
| 显示概率计算过程 | 返回并展示参与计算的历史记录、命中状态、像元数量、源文件路径 | `/api/history/{date}` 和前端“概率计算样本” |
| 显示样本覆盖可信度 | 返回并展示同期覆盖率、月度覆盖率和可信度标签，明确区分演示样本与完整 1982—2024 统计 | `/api/history/{date}`、前端“样本覆盖说明” |
| 增加缓存机制 | 建立历史索引缓存与查询结果缓存；同参重复查询会命中缓存，并返回索引来源、实时计算记录数、时间线条数和耗时 | `data/cache/history`、响应中的 `cache` 字段、`backend/scripts/precompute_history_cache.py` |
| 增加 raster 图像缓存 | 同一日期、区域和图层重复请求时直接复用 PNG 缓存，减少前端刷新开销 | `GET /api/analysis/{date}/raster/{kind}`、`X-Raster-Cache` |
| 生成数据准备计划 | 根据现有 front/SST 覆盖、缺失和重复情况，给出下一步补样本建议 | `GET /api/data/plan`、`backend/scripts/plan_data_preparation.py` |
| 跨年份同期样本准备 | 自动展开 1982—2024 同月同日附近窗口，生成 Zenodo front 与 Copernicus SST 批处理计划，支持小规模试跑和显式执行 | `backend/scripts/prepare_historical_samples.py` |
| 演示结果留存 | 可导出当前查询的单日分析、历史统计、历史索引和点位查询结果，并可生成 HTML/Markdown 汇报报告 | 前端“导出 JSON / 导出 HTML 汇报”、`backend/scripts/export_demo_report.py` |
| 温度结构统计 | 单日和历史统计均补充 SST 温差与温度梯度，支持与历史均值对照 | `sst.range_celsius`、`sst.gradient_c_per_km`、`summary.sst_gradient_c_per_km_mean` |

## 当前接口清单

- `GET /api/history/index`：历史时间索引、空间索引、缓存路径和数据覆盖范围。
- `GET /api/history/{date}`：综合历史统计，供前端主面板使用。
- `GET /api/history/{date}/probability`：历史同期概率和月度概率解释接口。
- `GET /api/history/{date}/monthly`：1—12 月月度概率、样本数、SST 统计。
- `GET /api/history/{date}/local-records`：局地历史样本提取与源文件追溯。
- `GET /api/front-objects/{date}`：当前窗口锋面对象识别，返回对象 ID、质心、包围框和长度。
- `GET /api/front-tracking/{date}`：连续日期锋面对象追踪，返回每日状态、匹配方式、匹配分数、候选对象数量和位移。
- `GET /api/report/{date}`：生成 Markdown/HTML 汇报报告，汇总单日分析、历史统计、锋面对象和连续追踪结果。
- `GET /api/data/plan`：生成目标样本窗口、缺失日期、重复文件组和参考命令。
- `GET /api/data/index`：读取或首次生成 SQLite 元数据索引，返回文件、日期、配对、缺失和重复状态。
- `GET /api/data/index/{date}`：按日期定位 front/SST/front_intensity 源文件，判断该日是否完整可分析。

## 本地样例验收命令

```powershell
cd D:\VscodeProject\Ocean
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m ruff check backend\app backend\tests backend\scripts
$env:TEMP='D:\VscodeProject\Ocean\.tmp'; $env:TMP='D:\VscodeProject\Ocean\.tmp'
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest -p no:cacheprovider --basetemp='D:\VscodeProject\Ocean\.tmp\pytest-run' backend\tests\test_api.py
cd frontend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run build
```

也可以使用后端 smoke 脚本快速检查历史接口：

```powershell
cd D:\VscodeProject\Ocean\backend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\phase2_smoke.py --date 2024-08-05 --longitude 124.5 --latitude 30.2 --radius 1
```

数据索引和跨年份样本规划可单独检查：

```powershell
cd D:\VscodeProject\Ocean\backend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\build_data_index.py
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\precompute_history_cache.py --date 2024-08-05 --days 3 --longitude 124.5 --latitude 30.2 --radius 1
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\export_demo_report.py --date 2024-08-05 --longitude 124.5 --latitude 30.2 --radius 1 --days 3
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\prepare_historical_samples.py --limit-dates 6
```

## 目前限制

- 统计结果只代表本地已下载样本，不等同于完整 1982—2024 历史概率；界面已显示样本覆盖可信度。
- 当前本地样例已包含 1982—2010 的同期样本和 2024 连续样本，因此“多年变化”面板已具备较完整的演示能力；查询 `2024-08-05` 时同期覆盖为 30/43 年，但历史长度仍未覆盖完整 43 年。
- 当前对象追踪已加入综合质心/形态/bbox 打分，但仍是第一版工程规则，尚未实现严格的跨日同一锋面轨迹匹配、断裂/合并处理和速度约束。
- 概率命中规则暂定为“查询窗口内锋面线像元数 > 0”；如果老师要求按锋面强度、锋面面积或距离阈值定义概率，需要再调整规则。
- 当前已补 SQLite 元数据索引，历史索引可优先从 SQLite 读取文件记录，适合全量文件级检索；如果后续需要大范围栅格快速统计，仍建议继续评估 Zarr/Parquet 或预切片瓦片方案。
- Zenodo `front_location.zip` 是 18 GiB 级大压缩包，远程 Range 抽取可能受网络和服务器响应影响；当前已提供脚本和数据计划，必要时可手工下载后放入目录。
