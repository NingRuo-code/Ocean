# 预测 baseline 说明

本模块用于在暂不接入真实预测模型的前提下，给出一个可解释、可回测、可作为后续模型对照组的锋面出现概率 baseline。

## 输入与输出

接口：

```text
GET /api/prediction/{date}?longitude=124.5&latitude=30.2&radius_deg=1&horizon_days=7
```

输入含义：

- `date`：观测日期，也是预测起点；
- `longitude` / `latitude`：查询中心；
- `radius_deg`：局地统计窗口；
- `horizon_days`：预测未来几天，当前限制为 1—14 天。
- `probability_rule`：与历史统计一致的命中口径，可选 `line_presence`、`density_threshold`、`distance_threshold`；
- `min_line_density_per_1000`：密度阈值口径下的最小锋面线密度；
- `max_front_distance_km`：距离阈值口径下的最大最近锋面距离。

输出重点：

- `predictions[].probability`：未来某天查询窗口内出现锋面线像元的概率；
- `predictions[].predicted_status`：概率对应的可读状态；
- `predictions[].confidence_label`：该结果的样本可信度；
- `predictions[].drivers`：各驱动因子的数值、权重和说明；
- `observed_front_present`：如果目标日期已有本地观测，则返回回测参考。

## 本地回测评估

接口：

```text
GET /api/prediction/{date}/evaluation?longitude=124.5&latitude=30.2&radius_deg=1&horizon_days=7&max_anchor_dates=30
```

该接口会把本地已有观测日期作为起报日，只评估“未来目标日也已有观测”的样本，输出：

- `evaluated_count`：实际评估点数量；
- `candidate_anchor_count`：候选起报日数量；
- `accuracy`：按 `probability >= 0.5` 二值化后的命中率；
- `brier_score`：概率预测的均方误差，越低越好；
- `mean_absolute_error`：平均绝对误差；
- `points[]`：每个起报日、目标日、概率、观测、误差和可信度。

注意：当前是“本地样本内诊断”，用于验证链路和做阶段演示；等历史年份补齐后，才适合扩展为按年份留出的严格回测。

## 计算逻辑

当前 baseline 组合四类信号：

1. 历史同期概率：目标日期同月同日的多年样本命中率；
2. 当月历史概率：目标月份所有本地样本的命中率；
3. 近期锋面状态：预测起点前最近几天是否持续出现锋面；
4. 局地 SST 梯度修正：当前梯度高于历史均值时小幅上调，明显低于历史均值时小幅下调。

权重会根据样本量自动调整：同日样本越多，历史同期概率权重越高；同日样本不足时，月度概率和近期状态承担更多解释作用。

## 使用边界

- 它不是训练出来的机器学习模型；
- 它不代表论文级锋面可预报性结论；
- 它只反映当前本地样本覆盖下的统计倾向；
- 它的主要价值是：给界面、报告、AI 工具调用和后续模型评估提供一个稳定基线。

## 验收方式

后端单元测试已覆盖该接口。也可以运行：

```powershell
cd D:\VscodeProject\Ocean\backend
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\phase1_12_smoke.py
```

通过后会输出 `预测 baseline：7 天 / ...` 和 `预测回测：...`，说明接口、报告、评估和 AI 调度链路均可用。
