# 离线 AI 分析智能体说明

## 设计原则

AI 层只做三件事：

1. 把自然语言解析为结构化任务；
2. 选择并调用已有确定性分析工具；
3. 根据工具返回结果生成带证据的解释。

AI 层不直接生成概率、温度、距离、像元数量等科学数值。所有数值必须来自后端工具。

## 默认运行模式

默认配置：

```text
OCEAN_AI_PROVIDER=rules
```

该模式使用本地确定性规则解析器，不需要网络、不需要模型权重，适合第 9—12 周演示和自动化测试。

## 预留本地小模型配置

如果后续接入 Ollama 或其他本地模型，可以在 `.env` 中配置。Ollama 示例：

```text
OCEAN_AI_PROVIDER=ollama
OCEAN_LOCAL_LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
OCEAN_LOCAL_LLM_MODEL=qwen2.5:1.5b-instruct
OCEAN_AI_TIMEOUT_SECONDS=3
```

llama.cpp server 示例：

```text
OCEAN_AI_PROVIDER=llamacpp
OCEAN_LOCAL_LLM_ENDPOINT=http://127.0.0.1:8080/completion
OCEAN_LOCAL_LLM_MODEL=local-gguf
OCEAN_AI_TIMEOUT_SECONDS=5
```

OpenAI-compatible 本地服务示例：

```text
OCEAN_AI_PROVIDER=openai-compatible
OCEAN_LOCAL_LLM_ENDPOINT=http://127.0.0.1:8001/v1/chat/completions
OCEAN_LOCAL_LLM_MODEL=qwen2.5-1.5b-instruct
OCEAN_AI_TIMEOUT_SECONDS=5
```

当前支持的 provider 为 `rules`、`ollama`、`llamacpp` / `llama.cpp`、`openai-compatible`。当 `OCEAN_AI_PROVIDER` 不是 `rules` 时，后端会先向 `OCEAN_LOCAL_LLM_ENDPOINT` 发送任务解析提示，期望模型返回一个 JSON object；如果模型不可用、超时、返回无法解析的 JSON，系统会自动回退到本地规则解析器，并在 `assumptions` 中标记回退原因。

可通过接口检查模型配置是否可用：

```text
GET /api/ai/health
```

也可以在命令行直接诊断：

```powershell
cd backend
python scripts/check_local_llm.py
python scripts/check_local_llm.py --provider ollama --endpoint http://127.0.0.1:11434/api/generate --model qwen2.5:1.5b-instruct
python scripts/check_local_llm.py --run-parser
```

当前如果本机没有安装或启动 Ollama，诊断脚本会显示命令未发现或模型服务不可用；这不影响默认 `rules` 模式演示。

建议本地模型只输出任务 JSON，不直接输出最终科学结论。推荐的本地模型职责：

- 识别用户意图；
- 提取日期、经纬度、空间范围、月份和连续天数；
- 输出工具列表；
- 标记缺失参数。

后端仍应校验结构化 JSON，并由确定性工具计算结果。

推荐模型 JSON 字段如下：

```json
{
  "intent": "current_front_and_history",
  "tasks": [
    "show_current_front",
      "calculate_historical_probability",
      "query_monthly_activity",
      "show_multi_day_change",
      "predict_front_occurrence",
      "explain_statistics"
  ],
  "parameters": {
    "date": "2024-08-05",
    "longitude": 124.5,
    "latitude": 30.2,
    "radius_deg": 1,
    "month": 8,
    "days": 3
  },
  "assumptions": [],
  "missing_parameters": []
}
```

## 工具边界

当前 AI 可调用的工具：

- `analysis.current_front`：当前日期、位置和范围的锋面/海温查询；
- `front.objects`：把锋面线像元聚类为对象，返回对象 ID、质心、范围、长度和最近距离；
- `front.tracking`：连续日期窗口内追踪离查询点最近的锋面对象，并返回综合匹配分数、速度、方位角和可信度；
- `prediction.baseline`：用历史同期、月度概率、近期状态和 SST 梯度生成未来 1—14 日锋面出现概率 baseline；
- `history.probability`：历史同期概率和月度概率；
- `history.monthly`：月度锋面活动；
- `history.timeline`：连续多日变化；
- `knowledge.lookup`：本地锋面知识库查询。

当前锋面工具证据中还包含局地温度结构：查询窗口内 SST 温差、平均温度梯度和中心 SST。对象工具证据用于回答“这个锋面在图上对应哪个对象、中心在哪里、离查询点多远”，追踪工具证据用于回答“连续多日是否保持附近锋面活动”，预测工具证据用于回答“未来几日锋面出现概率的透明 baseline”。这些数值仍属于数据服务计算结果，不由 AI 自行估计。

历史概率工具证据还包含 `history-sample-coverage`，用于说明当前概率属于“样本偏少”“演示级”“中等”或“较高”。这能防止 AI 把少量本地样本计算出的概率表述成完整历史结论。

## 证据格式

每条 AI 结论都应关联 `evidence_ids`。证据来源包括：

- 后端工具响应；
- 本地 NetCDF 源文件路径；
- 本地 Markdown 知识库条目；
- 缓存指纹和查询参数。

如果某条结论没有证据，默认不应展示为确定结论，只能作为提示或下一步建议。

## 示例自然语言

```text
分析 2024-08-05 东经124.5 北纬30.2 1度范围的锋面，并解释历史概率、连续3日变化和未来趋势
```

系统会生成结构化任务，调用当前锋面、锋面对象、历史概率、时间线、对象追踪和预测 baseline 工具，然后返回结论和证据。
