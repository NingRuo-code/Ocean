# 前十二周技术架构

## 技术选择

| 层级 | 技术 | 选择原因 |
|---|---|---|
| 前端 | React + TypeScript + Vite | 组件化、类型约束、适合快速迭代 |
| 地图 | MapLibre GL JS | 支持本地样式和图层，避免绑定在线地图服务 |
| 图表 | React + CSS 轻量图表 | 当前阶段减少依赖，先完成历史趋势和月度概率展示 |
| 后端 | FastAPI | 接口清晰，便于与 Python 科学计算生态集成 |
| 数据读取 | xarray + h5netcdf/netCDF4 | 适合 NetCDF 的坐标化读取和局部裁剪 |
| 数值处理 | NumPy | 栅格掩码、统计和数据转换 |
| 缓存与索引 | 本地 JSON/PNG 缓存 + SQLite 元数据索引 | 查询结果可复用，数据资产可按日期/类型检索，便于后续扩展到全量历史数据 |
| AI 层 | 本地规则解析器 + 本地小模型适配配置 | 第 9—12 周先完成离线任务组织和证据解释；本轮暂不接入真实模型，后续可替换为 Ollama、llama.cpp 或 OpenAI-compatible 本地服务 |
| 预测 baseline | 历史同期 + 月度 climatology + 近期状态 + SST 梯度规则 | 先形成可解释、可回测、可作为后续模型对照组的预测接口 |

## 模块关系

```text
React UI
  ├─ 日期与位置任务栏
  ├─ MapLibre 地图工作区
  ├─ 图层控制与图例
  ├─ 当前状态 / 点位查询面板
  ├─ 锋面对象与多日追踪面板
  ├─ 预测 baseline 面板
  ├─ AI 分析智能体面板
  └─ 历史统计 / 概率解释 / 缓存追溯 / 数据准备面板
          │ HTTP / JSON / PNG
          ▼
FastAPI
  ├─ /api/health
  ├─ /api/catalog
  ├─ /api/data/manifest
  ├─ /api/data/index
  ├─ /api/data/index/{date}
  ├─ /api/data/index/rebuild
  ├─ /api/data/plan
  ├─ /api/analysis/{date}
  ├─ /api/analysis/{date}/raster
  ├─ /api/front-objects/{date}
  ├─ /api/front-tracking/{date}
  ├─ /api/prediction/{date}
  ├─ /api/report/{date}
  ├─ /api/series
  ├─ /api/point/{date}
  ├─ /api/history/index
  ├─ /api/history/{date}
  ├─ /api/history/{date}/probability
  ├─ /api/history/{date}/monthly
  ├─ /api/history/{date}/local-records
  ├─ /api/ai/capabilities
  ├─ /api/ai/health
  ├─ /api/ai/knowledge
  └─ /api/ai/analyze
          │
          ▼
Data service
  ├─ NetCDF 元数据检查
  ├─ bbox 局部裁剪
  ├─ front 掩码解释
  ├─ 局地 SST 温差和温度梯度估算
  ├─ 离线数据清单、SQLite 元数据索引、front/SST/front_intensity 覆盖配对检查和下一步数据准备计划
  ├─ 可选 front_intensity 强度读取、强度摘要和强度图层生成
  ├─ 锋面线连通对象识别、对象质心、包围框、长度和对象强度统计
  ├─ 连续多日最近锋面对象追踪、综合匹配分数、速度、方位角、缺测次数和可信度估算
  ├─ 历史时间索引、空间索引和按日期文件定位
  ├─ 同期概率和月度概率计算
  ├─ 未来 1—14 日锋面出现概率 baseline
  ├─ PNG raster、图层 GeoJSON、统计和点位查询
  ├─ raster 本地 PNG 缓存
  ├─ 查询缓存与源文件追溯
  ├─ HTML/Markdown 汇报生成
  ├─ 自然语言任务解析和本地模型健康检查
  ├─ AI 工具选择和调用记录
  ├─ 本地锋面知识库
  └─ 证据绑定解释与下一步推荐
          │
          ▼
Local files: raw / processed / cache
Local knowledge: backend/app/knowledge
```

## 关键约束

1. 完全离线运行，生产界面不得依赖在线底图、字体或 CDN。
2. 科学数值由数据服务计算，前端仅展示结果。
3. 所有数据响应携带日期、空间范围、变量和数据版本。
4. 当前开发只处理样例区域和少量日期，不复制约 109 GiB 全量数据。
5. 后续 AI 只能通过已定义接口调用确定性工具，不能直接修改结果。

## 核心数据链路

前四周单日链路：

```text
NetCDF 文件
  → 检查变量/维度/坐标
  → 读取指定 bbox
  → 解释 front 值，并在存在 front_intensity 文件时读取同日强度
  → 估算局地 SST 温差 / 温度梯度
  → 生成前端可加载 PNG raster、front_intensity 面图层和 GeoJSON 叠加图层
  → 大范围查询时对 GeoJSON 面图层自动抽样，前端优先使用 PNG raster
  → raster 图像写入本地缓存，同参数复查直接命中
  → 提取锋面对象、对象质心、包围框、长度、强度和最近距离
  → 在地图中核对查询点、范围、位置、冷暖侧和对象形态
```

第 5—8 周历史链路：

```text
本地 front/SST 归档
  → 生成 SQLite 元数据索引，记录文件、日期、体积、重复和配对情况
  → 历史索引优先从 SQLite 读取 front/SST 文件记录；无 SQLite 时退回目录扫描
  → 生成历史时间索引和空间索引，并标记 1982—2024 同期缺失年份
  → 按查询位置裁剪每个历史日期
  → 判断每个样本是否命中锋面
  → 计算同期概率、月度概率和多年统计量
  → 对连续日期窗口按“首日查询点锚定、后续综合质心/形态/bbox 打分”的规则匹配对象并估算位移、速度、方位角和可信度
  → 对未来 1—14 日生成历史/近期/梯度驱动的透明预测 baseline
  → 写入缓存并返回参与计算的源文件
```

数据准备链路：

```text
本地 raw 数据目录
  → /api/data/manifest 扫描当前覆盖
  → /api/data/index 生成或读取 SQLite 元数据索引，schema 当前为 data-index-v2
  → /api/data/index/{date} 定位某天可用文件
  → /api/data/plan 计算目标窗口、跨年份同期缺失日期、缺失年份和强度缺口
  → prepare_historical_samples.py 输出或执行批量下载计划
  → build_data_index.py 重建索引并复核 front/SST 配对
  → 后续历史统计复用 SQLite 元数据，降低全量数据目录扫描成本
```

报告链路：

```text
单日分析 + 锋面对象 + 连续追踪 + 历史统计 + 预测 baseline
  → 生成汇报摘要、关键指标和源文件列表
  → 输出 Markdown 与 HTML
  → 前端预览或下载为可直接提交/演示的 HTML 报告
```

第 9—12 周 AI 链路：

```text
自然语言输入
  → 参数抽取：日期 / 经纬度 / 空间范围 / 月份 / 连续天数
  → 结构化任务 JSON
  → 选择确定性分析工具
  → 调用当前锋面、锋面对象、对象追踪、历史概率、月度统计、时间线和预测 baseline 接口
  → 从工具结果和本地知识库生成证据
  → 输出 AI 分析卡、结论证据 ID 和下一步推荐
```
