# U1/U2 首批实施任务与进度入口

日期：2026-10-24。来源：[规格 #24](https://github.com/NingRuo-code/Ocean/issues/24)。用户已确认本轮任务粒度和依赖；10 项已发布为 #25–#34，均标记 ready-for-agent。T01–T10 保留作原评审编号，实时实施进度以对应 GitHub Issue 为准。任务发布不代表实现、检查、合并或部署已完成。

每项都交付一条能演示的完整用户流程并包含自己的数据/交互/布局验证。无独立“先做全部样式”或“最后才写测试”任务；所需局部整理在使用它的首个切片内完成，保持可回归。T04 先在原地图贯通取数、状态和浏览器验证，可与 T01 分别开始；共享代码有冲突时顺序落地，不将文件冲突误作产品依赖。

| 编号 | 标题 | 真正前置 | 独立交付 |
| --- | --- | --- | --- |
| T01 / [#25](https://github.com/NingRuo-code/Ocean/issues/25) | [附近锋面快捷入口与双侧结果联动](01-front-workbench.md) | 无，可开始 | 从左侧附近锋面入口进入同条件的简明事实结果，左右面板可独立收起，地图始终可探索；同时落实工作台两模块及整体视觉分工。 |
| T02 / [#26](https://github.com/NingRuo-code/Ocean/issues/26) | [统一筛选完成日期、坐标和公里范围选择](02-unified-filter.md) | T01 / [#25](https://github.com/NingRuo-code/Ocean/issues/25) | 用户从左侧一次呼出筛选，修改日期、坐标或半径，地图和已有轻量结果使用同一套已应用条件。 |
| T03 / [#27](https://github.com/NingRuo-code/Ocean/issues/27) | [左侧图层浮层与快捷任务搭配](03-layer-controls.md) | T01 / [#25](https://github.com/NingRuo-code/Ocean/issues/25) | 用户从左侧管理实际图层，切换任务可得到清楚的默认搭配，同时手动选择在普通刷新后保留。 |
| T04 / [#28](https://github.com/NingRuo-code/Ocean/issues/28) | [切日与快速拖缩不串结果，失败可恢复](04-honest-loading.md) | 无，可开始 | 在现有地图中快速切换日期、位置与视野，仍只看到当前身份的资料；能区分缺资料、有效零与网络故障，并进行有限重试。 |
| T05 / [#29](https://github.com/NingRuo-code/Ocean/issues/29) | [捕捞活动入口给出同范围真实概况](05-effort-summary.md) | T01、T04 | 用户点击捕捞活动后，地图与当前结果展示所选日期、分析圈内有依据的 AIS 表观捕捞活动小时数、资料限制及邻近锋面事实。 |
| T06 / [#30](https://github.com/NingRuo-code/Ocean/issues/30) | [历史、预测与底部证据按需阅读](06-history-forecast-details.md) | T01 / [#25](https://github.com/NingRuo-code/Ocean/issues/25) | 用户从右侧阅读有来源的历史或实验预测，并按需展开详细证据；不把稀疏样例当完整月，也不把规则预测当未来观测。 |
| T07 / [#31](https://github.com/NingRuo-code/Ocean/issues/31) | [重新打开恢复已应用条件与图层](07-applied-preferences.md) | T02、T03 | 用户关闭并重开系统后继续使用上次已应用的日期、分析点、公里范围及图层，未确认编辑和重任务不会随之执行。 |
| T08 / [#32](https://github.com/NingRuo-code/Ocean/issues/32) | [逐日播放遇到缺日暂停并可继续](08-playback-gaps.md) | T02、T04 | 用户播放逐日地图时，不会无提示地越过整日缺测或未准备资料；暂停后能理解原因并主动继续下一有效日。 |
| T09 / [#33](https://github.com/NingRuo-code/Ocean/issues/33) | [海温同源色带、局部增强与锋面可读性](09-sst-legend.md) | T03 / [#27](https://github.com/NingRuo-code/Ocean/issues/27) | 用户在原地图中用 thermal 色带读温度，必要时主动增强局部，并从常驻图例读懂范围；锋面标签与叠加不会淹没活动关系。 |
| T10 / [#34](https://github.com/NingRuo-code/Ocean/issues/34) | [浅紫活动图与真实小时数一致呈现](10-effort-colors.md) | T03、T05 | 用户在活动任务中通过跨日统一的浅紫对数标尺阅读地图，并能查询真实小时数、核对当前概况及图例，清楚知道展示的完整性限制。 |

依赖是产品完成前置，不是所有任务机械串行。T01、T04 可以先开始；T01 后 T02/T03/T06 解锁；T01+T04 后 T05 解锁；T02+T03 后 T07 解锁；T02+T04 后 T08 解锁；T03 后 T09 解锁；T03+T05 后 T10 解锁。

不以未完成的整个 #14/#15/#16/#17 阻塞所有首批切片。相应数据支持不足必须如实表达，不用样例伪造完成；全年色域冻结、研究半径审计、完整活动近景/远景聚合与守恒、性能论文/容量实验继续在既有 P0/U2/P1 工作包落实，不计入首批完成。完整月 A/B/C、正式预测、在线 AI、完整任务中心也不因本批结项而完成。

每项需要用户可见行为、同源数字和地图回归证据，整体 GU 验收在首批切片完成后贯通已确认情景。无需为总验收再建一项只测不交付的横向票据。完成、PR、合并、部署分别记录；用户审核合并。

发布记录：已按依赖顺序创建 10 个 Issue，逐项核对正文和 ready-for-agent 标签；12 条原生阻塞关系与正文引用一致并已回读验证。父级仅由子任务正文引用，本轮未修改或关闭 #24/#13/#15/#16，另已核对 #24 正文、状态及标签保持不变。当前可开始的是 [#25](https://github.com/NingRuo-code/Ocean/issues/25) 和 [#28](https://github.com/NingRuo-code/Ocean/issues/28)。后续任务按真实阻塞解锁。


发布核验记录：[任务与依赖核验](../../reports/ocean-ui-ticket-publication-2026-10-24.json)。

## 实施进度 — 2026-10-25

- #25/#26/#27/#28/#29/#30/#31/#32/#33：9项已合并；最近[PR #284](https://github.com/NingRuo-code/Ocean/pull/284)合并提交为`204a919a6e98f5df5b370d8559a7b1544a16d910`。
- #33：海温色标软件实现、本地验收及独立复核完成，已随PR #284合并。
- #34：显示与查询软件合同部分完成；真实限定活动域待P0审计，保持开放。

本批[科学色标实施记录](../../reports/ocean-ui-scientific-colors-implementation-2026-10-25.md)列明范围、证据、来源与不足。首批软件进展不等于父工作包完成，也不提升整月统计、独立预测、AI或生产部署资格。

合并后继续执行的8月真实展示资料核验及下一数据前置见[UI至P0接续记录](../../reports/ocean-ui-to-p0-readiness-2026-10-25.md)：31天锋面/SST展示均可解析，原档与逐日活动输入在登记位置仍缺失，未提升研究资格。
