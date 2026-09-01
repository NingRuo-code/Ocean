# 前 1—12 周整体统筹与补充验收

本文件用于把指导书前十二周要求和当前代码实现对齐，方便阶段汇报、老师验收和后续继续开发。当前实现遵循“离线可运行、样例先行、工具计算、AI 解释不改数值”的原则。

## 总体目标对齐

| 阶段 | 指导书目标 | 当前实现状态 |
|---|---|---|
| 第 1—4 周 | 可操作的锋面可视化原型，用户能选择日期和位置，查看局地海温、锋面和冷暖侧 | 已完成可运行前后端、基础地图、图层控制、日期查询、点位查询、异常提示和演示闭环 |
| 第 5—8 周 | 当前锋面与历史信息连接，支持历史概率、月度统计、时间视图和缓存追溯 | 已完成历史时间索引、空间索引、局地历史提取、同期/月度概率、多年变化、raster 缓存、历史查询预热、对象追踪和测试集 |
| 第 9—12 周 | 用户通过自然语言提出任务，由本地模型自动组织已有分析能力 | 已完成自然语言输入、结构化任务、工具调用流程、AI 分析卡、本地知识库、证据解释和 AI 健康检查；默认使用规则解析器，并支持 Ollama/llama.cpp/OpenAI-compatible 本地模型适配 |

## 本次统筹补充的细节

| 补充项 | 原因 | 当前实现 |
|---|---|---|
| 10 km 空间范围 | 第 3 周明确要求支持 10 km、0.25°、0.5°、1° | 前端范围选择已加入 10 km，并在 AI 解析中支持“公里/千米/km”换算 |
| 查询点显示 | 第 3 周要求用户通过地图或经纬度定义任务，地图需要显示查询点 | 地图上新增查询点圆点和查询区域边界 |
| 经纬网格和比例尺 | 指导书要求经纬度坐标、地图缩放和平移，离线地图不能依赖在线底图 | 新增离线经纬网格和 MapLibre 比例尺控件 |
| 图像化图层 | 老师演示需要直观看出锋面结构，不能只像散点调试图 | SST、冷暖侧和锋面带改为网格 Polygon 面图层，锋面中心线叠加辉光 |
| 栅格图像接口 | 后续全量数据不适合长期依赖大量 GeoJSON | 新增 `/api/analysis/{date}/raster`，前端优先显示后端 PNG raster |
| raster 缓存 | 重复查询同一窗口时无需重复编码 PNG | raster 接口返回 `X-Raster-Cache`，本地缓存位于 `data/cache/rasters` |
| 离线数据清单 | 后续导入全量数据时需要先知道覆盖和缺失情况 | 新增 `/api/data/manifest` 与 `backend/scripts/build_data_manifest.py` |
| SQLite 元数据索引 | 后续几十年数据不能长期靠人工查文件，需要可复用的本地索引层 | 新增 `/api/data/index`、`/api/data/index/{date}`、`/api/data/index/rebuild` 与 `backend/scripts/build_data_index.py` |
| 数据准备计划 | 后续扩充样本时需要明确补哪些日期、哪些文件重复 | 新增 `/api/data/plan`、`backend/scripts/plan_data_preparation.py` 和去重 dry-run 脚本 |
| 跨年份样本准备 | 历史概率需要同月同日附近的多年样本支撑，手工列日期容易出错 | 新增 `backend/scripts/prepare_historical_samples.py`，默认 dry-run，支持显式执行 front/SST 批量下载 |
| 数据状态界面 | 老师验收时需要确认本地数据是否完整 | 前端“数据状态”区展示文件数、日期数、体积、缺失日期和 manifest 时间 |
| 当前日期文件命中 | 演示时需要解释某个查询日期具体使用了哪些本地文件 | 前端展示 SQLite 索引命中的 front/SST/front_intensity 文件数量和路径预览 |
| 样本覆盖可信度 | 历史概率不能只给数字，还要说明当前样本距离完整 1982—2024 有多远 | 历史 summary 返回同期/月度覆盖率和可信度标签，前端与报告同步展示 |
| 锋面对象识别 | 只展示像元/点线不利于说明“一个锋面事件” | 新增 `/api/front-objects/{date}`，输出对象 ID、质心、包围框、长度和最近距离 |
| 多日对象追踪 | 第 5—8 周需要连接当前与历史/多日变化 | 新增 `/api/front-tracking/{date}`，首日按查询点锚定，后续按质心距离、形态相似度和 bbox 重叠率综合匹配 |
| 历史缓存预热 | 演示和重复查询需要减少首屏等待，体现离线系统缓存能力 | 新增 `backend/scripts/precompute_history_cache.py`，并在历史响应中返回缓存命中、耗时、索引来源和计算记录数 |
| 汇报报告预览/导出 | 老师对接需要可读材料，不只看 JSON | 新增 `/api/report/{date}` 和前端 HTML 汇报预览、下载 |
| 静态报告导出 | 不打开前端时也需要生成可发送材料 | 新增 `backend/scripts/export_demo_report.py`，导出 HTML、Markdown 和摘要 JSON |
| 局地温差 | 第 1—4 周查询信息和 AI 示例都提到温度差 | `/api/analysis` 和 `/api/point` 返回 `range_celsius` / `temperature_range_celsius` |
| 温度梯度 | 指导书多处提到局部温度梯度和当前梯度对比 | 后端基于相邻网格温差估算 `gradient_c_per_km` 与 `max_gradient_c_per_km` |
| 多年梯度汇总 | 第 5—8 周要求平均、最小、最大等历史统计量 | 历史 summary 返回 `sst_gradient_c_per_km_mean/min/max` |
| 本地模型适配 | 第 9—12 周要求本地小语言模型部署环境 | 默认 rules 模式可离线演示；新增 `/api/ai/health`，支持 Ollama、llama.cpp 和 OpenAI-compatible，本地模型失败自动回落 |
| 结构化任务证据 | 第 9—12 周要求 AI 结论可解释、可追溯 | AI 返回 `structured-task-parameters` 证据，结论和工具调用均绑定 `evidence_ids` |
| 总体验收脚本 | 前十二周需要可复查的整体闭环 | 新增 `backend/scripts/phase1_12_smoke.py` |

## 当前可演示链路

1. 启动后端和前端。
2. 选择日期，例如 `2024-08-05`。
3. 输入经纬度，例如东经 `124.5`、北纬 `30.2`。
4. 选择范围：`10 km`、`±0.25°`、`±0.5°` 或 `±1°`。
5. 点击查询，查看海温、锋面线、冷暖侧、查询点、区域边界和状态卡。
6. 查看锋面对象与追踪：对象数量、最近对象 ID、质心、长度、三日追踪状态、匹配方式、匹配分数和地图对象框。
7. 查看历史统计：时间索引、空间索引、同期概率、月度概率、多年变化和计算样本。
8. 在 AI 面板输入自然语言任务，查看结构化 JSON、工具调用流程、证据、结论、evidence_ids 和模型健康状态。
9. 在数据状态区查看下一步数据准备计划、目标窗口、待补日期和重复文件建议。
10. 在 SQLite 元数据索引卡查看索引日期数、配对日期、完整性提示和当前日期命中文件。
11. 在历史统计区查看同期覆盖率、月度覆盖率和样本可信度，避免把演示样本误说成全量统计。
12. 导出分析报告 JSON，留存单日分析、对象追踪、历史统计、历史索引、点位查询和 AI 上下文。
13. 预览或导出 HTML 汇报报告，直接用于阶段沟通。

## 一键总体验收

```powershell
cd D:\VscodeProject\Ocean\backend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\phase1_12_smoke.py
```

完整工程检查：

```powershell
cd D:\VscodeProject\Ocean
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m ruff check backend\app backend\tests backend\scripts
$env:TEMP='D:\VscodeProject\Ocean\.tmp'; $env:TMP='D:\VscodeProject\Ocean\.tmp'
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest -p no:cacheprovider --basetemp='D:\VscodeProject\Ocean\.tmp\pytest-run' backend\tests\test_api.py
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' backend\scripts\build_data_index.py
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' backend\scripts\precompute_history_cache.py --date 2024-08-05 --days 3 --longitude 124.5 --latitude 30.2 --radius 1
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' backend\scripts\export_demo_report.py --date 2024-08-05 --longitude 124.5 --latitude 30.2 --radius 1 --days 3
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' backend\scripts\prepare_historical_samples.py --limit-dates 6
cd frontend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run build
```

## 仍需向老师说明的边界

- 本地样例目前已扩展到 104 个配对日期，覆盖 1982—2010 的部分同期窗口和 2024 年连续窗口；查询 `2024-08-05` 时同期覆盖为 30/43 年，样本可信度已达到“较高”，但仍不能代表完整 1982—2024。
- 当前没有独立锋面编号变量，系统生成的是基于连通像元的临时 `front_id`；如果老师要求真正跨日同一锋面的科学轨迹，需要补充更严格的事件分割、合并/断裂和匹配规则。
- 当前温度梯度是基于相邻 SST 网格的近似梯度，适合演示和局地对比；如果老师要求严格物理定义，需要确认公式和尺度。
- 默认 AI 是离线规则解析器，已经具备稳定演示能力；后端已支持 Ollama、llama.cpp 和 OpenAI-compatible 适配，但如果必须展示真实本地小模型，仍需要确认模型权重、运行框架和机器资源。
- 当前已实现连续日期综合匹配追踪，但第 13 周以后“预测与可预报性”仍只做接口预留，尚未实现模型预测。
- 当前已实现 SQLite 文件级元数据索引；如果后续目标是全球/多年大范围统计秒级响应，还需要继续做栅格预聚合、瓦片化或 Zarr/Parquet 化。
