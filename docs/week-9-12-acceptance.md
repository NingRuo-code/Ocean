# 第 9—12 周离线 AI 分析智能体验收说明

本阶段目标是让用户通过自然语言提出任务，由本地 AI 层自动组织已有分析能力。当前实现采用“本地模型适配层 + 确定性规则解析兜底”的方案：默认无需联网和模型权重即可离线演示；后续若接入 Ollama、llama.cpp 或其他本地小模型，仍复用同一套结构化任务和工具调用契约。

## 指导书要求与实现状态

| 原要求 | 当前实现 | 验收位置 |
|---|---|---|
| 部署本地小语言模型 | 已预留 `OCEAN_AI_PROVIDER`、`OCEAN_LOCAL_LLM_ENDPOINT`、`OCEAN_LOCAL_LLM_MODEL` 配置，并返回本地模型可用状态；默认 `rules` 模式作为离线可运行兜底 | `GET /api/ai/capabilities` |
| 本地模型健康检查 | 独立检测 provider、endpoint、模型名和服务可用状态，便于演示前确认环境 | `GET /api/ai/health` |
| 本地模型输出校验与回退 | 非 `rules` 模式会尝试调用本地模型生成任务 JSON；模型不可用、超时或 JSON 不合规时自动回退到规则解析器 | `backend/app/ai_agent.py`、`docs/offline-ai-agent.md` |
| 定义任务 JSON 格式 | 定义 `AiStructuredTask` 与 `AiTaskParameters`，包含任务列表、日期、经纬度、范围、月份、连续天数、假设和缺失参数 | `POST /api/ai/analyze` |
| 实现自然语言参数提取 | 支持中文/ISO 日期、东经/北纬、公里/度范围、月份、连续多日等表达 | `backend/app/ai_agent.py` |
| 建立分析工具调用接口 | AI 层可选择 current front、front objects、front tracking、prediction baseline、history probability、monthly、timeline、knowledge lookup 等工具 | `tool_calls` 字段 |
| 构建本地锋面知识库 | 本地 Markdown 知识库覆盖锋面编码、概率口径、AI 边界、离线原则、下一步推荐规则 | `backend/app/knowledge/ocean_front_rules.md` |
| 实现基于证据的结果解释 | 每条结论携带 `evidence_ids`，证据来自工具响应或本地知识库 | `conclusions` / `evidence` 字段 |
| 解释局地温度结构 | 当前锋面工具证据包含 SST 温差、温度梯度和中心温度，避免 AI 自行猜测锋面强弱 | `current-temperature-structure` evidence |
| 实现下一步任务推荐 | 根据样本不足、是否查看多日变化、空间范围大小生成推荐 | `recommendations` 字段 |

## AI 首先支持的任务

| 指导书任务 | 当前状态 |
|---|---|
| 查询某日某位置锋面 | 已支持，返回锋面线像元、冷暖侧、中心 SST、距最近锋面 |
| 识别锋面对象 | 已支持，返回对象数量、最近对象 ID、质心、长度和距查询点距离 |
| 连续对象追踪 | 已支持，首日按查询点锚定，后续按质心距离、形态相似度和 bbox 重叠率综合匹配并返回位移与匹配分数 |
| 查询历史发生概率 | 已支持，调用第 5—8 周历史概率接口 |
| 查询某月份锋面活动 | 已支持，调用月度统计接口 |
| 修改空间范围 | 已支持，结构化参数会更新范围并重新裁剪 |
| 查看连续多日变化 | 已支持，从历史时间线提取连续日期 |
| 查看未来趋势/预测 | 已支持，调度透明预测 baseline；本轮不接入真实模型预测 |
| 解释统计结果 | 已支持，解释文本绑定证据 ID |

## 当前接口清单

- `GET /api/ai/capabilities`：返回 AI 模式、本地模型配置、支持任务、工具和安全边界。
- `GET /api/ai/health`：返回本地模型适配协议、连接状态和检测时间。
- `GET /api/ai/knowledge`：返回本地锋面知识库条目。
- `POST /api/ai/analyze`：输入自然语言任务，输出结构化任务、工具调用流程、锋面对象/追踪证据、预测 baseline 证据、历史证据、结论和下一步推荐。

## 示例请求

```json
{
  "message": "分析 2024-08-05 东经124.5 北纬30.2 1度范围的锋面，并解释历史概率、连续3日变化和未来趋势",
  "default_date": "2024-08-05",
  "default_longitude": 124.5,
  "default_latitude": 30.2,
  "default_radius_deg": 1
}
```

10 km 范围换算示例：

```json
{
  "message": "分析 2024-08-05 东经124.5 北纬30.2 附近10公里锋面，并解释历史概率",
  "default_date": "2024-08-05",
  "default_longitude": 124.5,
  "default_latitude": 30.2,
  "default_radius_deg": 1
}
```

解析结果中的 `radius_deg` 应约为 `0.089932`，并在 `assumptions` 中说明公里到纬度度数的近似换算。

## 本地验收命令

```powershell
cd D:\VscodeProject\Ocean\backend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\phase3_smoke.py
```

完整检查：

```powershell
cd D:\VscodeProject\Ocean
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m ruff check backend\app backend\tests backend\scripts
$env:TEMP='D:\VscodeProject\Ocean\.tmp'; $env:TMP='D:\VscodeProject\Ocean\.tmp'
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest -p no:cacheprovider --basetemp='D:\VscodeProject\Ocean\.tmp\pytest-run' backend\tests\test_api.py
cd frontend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' run build
```

## 当前限制

- 当前默认 AI 是确定性规则解析器，不是已加载权重的小语言模型；这让系统能稳定离线演示，但自然语言泛化能力有限。
- 如果老师明确要求“必须实际运行本地 LLM”，下一步需要提供或确认模型运行方式，例如 Ollama 模型名、llama.cpp GGUF 文件路径或校内服务器本地推理地址；后端已支持 Ollama、llama.cpp 和 OpenAI-compatible 三类接口格式。本轮按开发计划暂时跳过真实模型接入。
- AI 结论只基于本地样例数据；历史概率仍受样本覆盖范围影响。
- “未来趋势/预测”由透明 baseline 生成，便于解释和回测，不代表训练完成的机器学习模型。
- AI 对象追踪证据来自后端第一版综合匹配规则，不代表完整物理轨迹推断。
- 当前 AI 面板以任务解析和证据解释为主，不做多轮记忆、复杂追问和自然语言驱动的一键报告生成；正式 HTML 报告由 `/api/report/{date}` 和前端导出按钮提供。
