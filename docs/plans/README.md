# Ocean 项目规划入口

最近整理：2026-10-25。

首批代码、实测和未完成边界见[首批实施记录](../reports/ocean-first-implementation-batch-2026-10-25.md)。本地更新不等于已合并或生产部署。

从[项目总体规划与推进总表](ocean-master-plan-2026-10-24.md)开始阅读：它统一目标、现状、任务依赖、近期批次、阶段关口与文档分工。

| 想了解什么 | 阅读文档 |
| --- | --- |
| 整个项目要做什么、接下来先做什么 | [总体规划](ocean-master-plan-2026-10-24.md) |
| 已确认决定、完整研究版与后续实际应用的边界 | [全项目路线](ocean-global-roadmap-draft-2026-10-22.md) |
| 当前 #13–#21 任务和验收 | [阶段执行计划](ocean-execution-plan-2026-10-22.md) |
| 界面布局和交互 | [Q47正式规格](../specs/ocean-frontend-redesign-draft-2026-10-23.md) |
| 近期界面批次的实施范围与验收 | [U1/U2首批实施规格](../specs/ocean-ui-first-batch-implementation-spec-2026-10-24.md)（已发布[规格 #24](https://github.com/NingRuo-code/Ocean/issues/24)） |
| 首批界面任务、实际编号和阻塞关系 | [10项实施任务](../tickets/ui-first-batch/README.md)（#25–#34，已发布） |
| P0覆盖、粒度、零值、版本与支持判定 | [P0实施规格](../specs/ocean-p0-data-contract-implementation-spec-2026-10-24.md)（已发布[规格 #35](https://github.com/NingRuo-code/Ocean/issues/35)，关联#14） |
| P0执行任务、验收与依赖 | [9项P0实施任务](../tickets/p0-data-contract/README.md)（#36–#44，已发布） |
| 可视化加载、论文优化、容量评估 | [性能专项](ocean-visualization-performance-plan-2026-10-23.md) |
| P1基线、加速对照与容量实施范围 | [P1实施规格](../specs/ocean-p1-performance-implementation-spec-2026-10-24.md)（已发布[规格 #45](https://github.com/NingRuo-code/Ocean/issues/45)，关联#17） |
| P1近期任务与条件性实验 | [14项P1实施任务](../tickets/p1-performance/README.md)（#46–#59，已发布） |
| 哪些方法复用、哪些需要定制 | [方法选型安排](ocean-methods-selection-and-validation-2026-10-24.md) |
| 完整月关系、事件、对照与统计推断 | [统计协议](../specs/ocean-statistical-analysis-protocol-2026-10-24.md) |
| A完整月空间关系的执行范围与验收 | [A实施规格](../specs/ocean-a-monthly-spatial-analysis-spec-2026-10-24.md)（已发布[规格 #60](https://github.com/NingRuo-code/Ocean/issues/60)，关联#18） |
| A实施任务、P0前置与复算交接 | [11项A实施任务](../tickets/a-monthly-spatial-analysis/README.md)（#61–#71，已发布） |
| B固定海域事件、前后窗口与对照 | [B实施规格](../specs/ocean-b-fixed-region-event-response-spec-2026-10-24.md)（已发布[规格 #72](https://github.com/NingRuo-code/Ocean/issues/72)，关联#19，复用#9） |
| B实施任务、A/P0前置及真实窗口交接 | [12项B实施任务](../tickets/b-fixed-region-event-response/README.md)（#73–#84，已发布） |
| C区域同条件证据比较与不可比说明 | [C实施规格](../specs/ocean-c-regional-evidence-comparison-spec-2026-10-24.md)（已发布[规格 #85](https://github.com/NingRuo-code/Ocean/issues/85)，关联#20） |
| C实施任务、A/B交接及真实区域复算 | [9项C实施任务](../tickets/c-regional-evidence-comparison/README.md)（#86–#94，已发布） |
| W工作台引导提交、真实状态与A/B/C结果联动 | [W实施规格](../specs/ocean-w-analysis-workbench-spec-2026-10-24.md)（已发布[规格 #95](https://github.com/NingRuo-code/Ocean/issues/95)，关联#21） |
| W执行任务、最小权限、持久记录及实际前置 | [13项W实施任务](../tickets/w-analysis-workbench/README.md)（#96–#108，已发布） |
| TASK后台恢复、一键归档准备与分层保存 | [TASK实施规格](../specs/ocean-task-center-and-data-preparation-spec-2026-10-24.md)（已发布[规格 #109](https://github.com/NingRuo-code/Ocean/issues/109)，复用W最小任务合同） |
| TASK执行任务、安全恢复、准备与保护清理前置 | [15项TASK实施任务](../tickets/task-center-and-data-preparation/README.md)（#110–#124，已发布） |
| REPORT案例版本、统一报告与PDF/图表/汇总表 | [REPORT实施规格](../specs/ocean-report-case-and-export-spec-2026-10-24.md)（已发布[规格 #125](https://github.com/NingRuo-code/Ocean/issues/125)，复用A/B/C证据及TASK保护） |
| REPORT执行任务、案例版本与同源导出前置 | [15项REPORT实施任务](../tickets/report-case-and-export/README.md)（#126–#140，已发布） |
| G3复核、相似案例与预测回测的新类型成果导出 | [REPORT扩展实施规格](../specs/ocean-research-report-extension-spec-2026-10-25.md)（已发布[规格 #252](https://github.com/NingRuo-code/Ocean/issues/252)） |
| REPORT扩展分批执行、真实消费与直接前置 | [27项REPORT扩展实施任务](../tickets/research-report-extension/README.md)（#253–#279，已发布） |
| G3跨年份、季节与海域独立复核 | [G3独立复核实施规格](../specs/ocean-g3-independent-validation-spec-2026-10-24.md)（已发布[规格 #141](https://github.com/NingRuo-code/Ocean/issues/141)；相似案例另立规格） |
| G3独立复核任务、实证关口与条件性分支 | [17项G3实施任务](../tickets/g3-independent-validation/README.md)（#142–#158，已发布） |
| G3相似案例检索、响应阅读与辅助匹配 | [相似案例与辅助匹配实施规格](../specs/ocean-g3-similar-case-and-auxiliary-matching-spec-2026-10-24.md)（已发布[规格 #159](https://github.com/NingRuo-code/Ocean/issues/159)） |
| G3相似检索与短窗匹配任务、隔离及真实前置 | [16项相似案例与辅助匹配实施任务](../tickets/g3-similar-case-and-auxiliary-matching/README.md)（#160–#175，已发布） |
| 活动预测的标签、模型与独立实验 | [预测协议](../specs/ocean-prediction-experiment-protocol-2026-10-24.md) |
| PRED活动基线、可知输入与锋面增量独立回测 | [预测实施规格](../specs/ocean-prediction-baselines-and-independent-backtest-spec-2026-10-24.md)（已发布[规格 #176](https://github.com/NingRuo-code/Ocean/issues/176)） |
| PRED执行任务、基线与模型选择及真实空间关口 | [22项预测实施任务](../tickets/prediction-baselines-and-independent-backtest/README.md)（#177–#198，已发布） |
| G4b多轮AI、同条件工具与证据解释及在线模型边界 | [AI实施规格](../specs/ocean-ai-multiturn-evidence-workbench-spec-2026-10-24.md)（已发布[规格 #199](https://github.com/NingRuo-code/Ocean/issues/199)） |
| AI分批接入、真实前置与模型/成果验收 | [26项AI实施任务](../tickets/ai-multiturn-evidence-workbench/README.md)（#200–#225，已发布） |
| OPS发布回退、运行监测与备份恢复 | [OPS实施规格](../specs/ocean-ops-release-observability-and-recovery-spec-2026-10-24.md)（已发布[规格 #226](https://github.com/NingRuo-code/Ocean/issues/226)） |
| OPS执行顺序、独立恢复和生产验收前置 | [25项OPS实施任务](../tickets/ops-release-observability-and-recovery/README.md)（#227–#251，已发布） |
| 10.21建议书是否遗漏 | [要求追溯](ocean-ui-loading-recording-review-2026-10-23.md) |

规划完成、代码实现、验证、PR、合并和部署分别记录。本文及本地台账不替代 GitHub 实时进度，也不代表论文算法、统计研究或预测模型已完成。

2026-10-21旧计划、合并表和历次草案保留作来源/决策历史；其排期、界面分工和未确认方法如与当前规格冲突，不再作为开发验收标准。
