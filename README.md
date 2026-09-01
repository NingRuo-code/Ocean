# Ocean Front Offline Analysis

面向海洋锋面时空任务的离线智能分析系统。当前已完成前四周基础闭环、第 5—8 周历史统计分析，并推进到第 9—12 周离线 AI 分析智能体：可在本地离线数据上完成局地查询、历史概率、月度统计、时间视图、缓存追溯和自然语言任务组织。

## 当前范围

- 浏览器中的离线分析界面；
- FastAPI 本地数据服务；
- NetCDF 样例数据检查与局部读取；
- SST 面场、锋面带、锋面中心线、冷侧区、暖侧区图像图层；
- 后端 PNG raster 温度场、离线数据 manifest 和 front/SST 配对检查；
- SQLite 本地元数据索引：按文件、日期、数据集类型记录本地资产，支持按日期快速定位源文件；
- 下一步数据准备计划：目标日期窗口、缺失日期、重复文件和参考下载命令；
- 跨年份同期样本准备脚本：默认 dry-run，支持按年批量规划 Zenodo front 与 Copernicus SST 下载；
- raster 本地 PNG 缓存，降低重复查询渲染成本；
- 锋面对象识别：临时 front_id、质心、包围框、长度和最近距离；
- 连续日期锋面对象追踪：首日按查询点锚定，后续综合质心距离、形态相似度和 bbox 重叠率匹配；
- HTML/Markdown 汇报报告：汇总单日分析、对象追踪、历史统计和源文件，前端支持预览与下载；
- 10 km、0.25°、0.5°、1° 空间范围切换；
- 查询点、查询区域、经纬网格、比例尺和局地温差/温度梯度；
- 历史时间索引、空间索引、历史统计接口、月度概率和缓存面板；
- 同期概率计算过程、参与样本记录和源文件追溯；
- 自然语言任务输入、结构化任务 JSON、工具调用流程、AI 分析卡、本地知识库和 AI 健康检查；
- 为后续更严格的锋面轨迹匹配、预测和可预报性研究预留接口。

当前不重新实现论文锋面识别算法，不把全量 1982—2024 数据提交到仓库；已实现的对象追踪是“首日查询点锚定、后续综合质心/形态/bbox 打分”的工程演示版，不等同于论文级长期轨迹算法。默认 AI 使用离线规则解析器；后端已支持 Ollama、llama.cpp 和 OpenAI-compatible 本地模型适配，但仍需本机实际启动模型服务。若本地只放少量样例文件，历史概率只代表这些本地样本。

## 目录

```text
backend/          Python 数据服务
frontend/         React + TypeScript 界面
docs/             范围、架构和数据契约
data/raw/         本地原始样例数据（不提交 Git）
data/processed/   预处理数据（不提交 Git）
data/cache/       查询缓存（不提交 Git）
paper/            参考论文
```

## 开发状态

项目骨架已建立，前十二周核心链路已有可运行版本，并继续补齐了数据状态面板、SQLite 元数据索引、数据准备计划、跨年份样本准备脚本、历史缓存预热脚本、raster 缓存、综合匹配对象追踪、HTML 汇报预览/导出和本地模型健康检查。下一步是继续补齐更多历史样本、实际启动并验证本地小模型，并按老师反馈调整概率定义和追踪口径。

当前本地演示数据已扩展为 104 个 front/SST 配对日期：包括 `2024-08-05` 至 `2024-08-19` 的连续样本，以及 `1982—2010` 每年 `08-05` 至 `08-07` 的跨年份同期样本；其中 `1982`、`1983` 额外具备 `08-08` 样本。完整历史概率展示仍需要继续补充 1982—2024 同月同日窗口数据，下一批缺口从 `2011-08-05` 开始。

当前历史同期概率会同时给出样本覆盖可信度：例如查询 `2024-08-05` 时，同期覆盖为 `30/43` 年，属于“较高”，可用于说明流程和阶段成果，但不应宣称为完整 1982—2024 统计结论。

## 本地运行

安装前端依赖：

```powershell
cd frontend
pnpm install
pnpm run dev
```

安装并启动后端：

```powershell
cd backend
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

浏览器访问 `http://127.0.0.1:5173/`。开发服务器会把 `/api` 请求转发到本地后端。

如需接入真实本地小模型，可复制 [.env.example](D:/VscodeProject/Ocean/.env.example) 为 `.env`，按 Ollama、llama.cpp 或 OpenAI-compatible 服务修改 `OCEAN_AI_PROVIDER` 和 `OCEAN_LOCAL_LLM_ENDPOINT`。

## 阶段验收 smoke

前 1—12 周总体验收：

```powershell
cd backend
python scripts/phase1_12_smoke.py
```

第 5—8 周历史统计：

```powershell
cd backend
python scripts/phase2_smoke.py
```

第 9—12 周离线 AI 智能体：

```powershell
cd backend
python scripts/phase3_smoke.py
```

生成离线数据清单：

```powershell
cd backend
python scripts/build_data_manifest.py
```

生成 SQLite 元数据索引：

```powershell
cd backend
python scripts/build_data_index.py
```

预热历史查询缓存，适合演示前执行：

```powershell
cd backend
python scripts/precompute_history_cache.py --date 2024-08-05 --days 3 --longitude 124.5 --latitude 30.2 --radius 1
```

导出静态演示报告，适合提前发给老师：

```powershell
cd backend
python scripts/export_demo_report.py --date 2024-08-05 --longitude 124.5 --latitude 30.2 --radius 1 --days 3
```

规划跨年份同期历史样本，默认只 dry-run：

```powershell
cd backend
python scripts/prepare_historical_samples.py --reference-date 2024-08-05 --year-start 1982 --year-end 2024 --window-days 3
```

如果只想试跑少量日期，可加 `--limit-dates 6`；确认账号、网络和磁盘空间后，再显式加入 `--execute-front` 或 `--execute-sst`。

## 检查真实样例

将一个真实逐日 NetCDF 文件放入 `data/raw`，然后执行：

```powershell
cd backend
python scripts/inspect_netcdf.py ..\data\raw\示例文件.nc
```

检查输出中的维度、坐标、变量、数据类型和取值范围，再据此完善读取逻辑。不要把全量原始数据提交到 Git。

参见：

- [第一阶段实施范围](docs/phase-1-scope.md)
- [技术架构](docs/architecture.md)
- [数据契约](docs/data-contract.md)
- [前 1—12 周整体统筹与补充验收](docs/week-1-12-integrated-acceptance.md)
- [图形化界面优化说明](docs/ui-visual-optimization.md)
- [第 1 周输入文件需求](docs/week-1-input-checklist.md)
- [2024-08-05 锋面样例检查记录](docs/data-inspection-2024-08-05.md)
- [第 5—8 周历史统计验收说明](docs/week-5-8-acceptance.md)
- [第 9—12 周离线 AI 智能体验收说明](docs/week-9-12-acceptance.md)
- [离线 AI 分析智能体说明](docs/offline-ai-agent.md)
