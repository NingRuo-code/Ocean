# B 固定海域事件响应任务与进度入口

日期：2026-10-24。来源：[规格 #72](https://github.com/NingRuo-code/Ocean/issues/72)，归属 [B #19](https://github.com/NingRuo-code/Ocean/issues/19)，复用 [实验 #9](https://github.com/NingRuo-code/Ocean/issues/9)。用户已确认粒度与阻塞，12项已发布为#73–#84，均标记ready-for-agent；B01–B12保留为评审编号，实际进度以对应GitHub Issue为准。发布不代表代码、真实响应关口、合并或部署已完成。

已通过GitHub CLI读取#72/#19/#9完整正文和评论，以及#41/#44/#62/#65/#66/#70/#71/#21；核对时均开放且暂无评论。#72与本地规格正文一致，发布前未发现重复B执行子任务。本轮发布已确认任务及原生阻塞、同步本地记录，未修改应用、运行真实事件或更改父级。

| 编号 | 标题与完整验收条件 | 真正前置 | 可独立验收的交付 |
| --- | --- | --- | --- |
| B01 / [#73](https://github.com/NingRuo-code/Ocean/issues/73) | [运行固定海域事件响应的可手算样例](01-controlled-event-sample.md) | 无，可开始 | 研究者显式运行一个合法小型固定区域样例，得到单个已知观测事件、前7日/事件日/后1–3日/后1–7日的小时与面积时间以及可读响应摘要；条件、来源身份和样例性质明确。后续任务扩展同一条执行链。 |
| B02 / [#74](https://github.com/NingRuo-code/Ocean/issues/74) | [从逐日锋面识别固定区域事件并保留断档边界](02-event-detection-continuity.md) | [#73](https://github.com/NingRuo-code/Ocean/issues/73)、[#62](https://github.com/NingRuo-code/Ocean/issues/62) | 研究者从同一B入口取得逐日锋面—固定区域状态与可审计事件清单，能解释进入、持续、退出、再次触发、多锋面、缺日和搜索期截断为何产生或不产生一个事件。 |
| B03 / [#75](https://github.com/NingRuo-code/Ocean/issues/75) | [逐事件核实跨月前后窗口与研究准入](03-window-qualification.md) | [#74](https://github.com/NingRuo-code/Ocean/issues/74)、[#41](https://github.com/NingRuo-code/Ocean/issues/41) | 研究者查看每个候选事件的前7日、0日、后1–3日和后1–7日真实日期台账，知道哪些窗口具备资格、还缺哪些邻月资料；准入失败的计算不会被默默补齐或启动。 |
| B04 / [#76](https://github.com/NingRuo-code/Ocean/issues/76) | [在前后可比支持上计算归一化活动变化](04-comparable-window-effects.md) | [#75](https://github.com/NingRuo-code/Ocean/issues/75) | 研究者在同一固定区域结果中读取前期、短期和后7日的总小时、有效面积时间、密度及前后差，能够判断变化是否受到不同天数和覆盖位置的影响。 |
| B05 / [#77](https://github.com/NingRuo-code/Ocean/issues/77) | [匹配固定同日对照并解释无法匹配的事件](05-fixed-comparable-controls.md) | [#76](https://github.com/NingRuo-code/Ocean/issues/76)、[#65](https://github.com/NingRuo-code/Ocean/issues/65) | 研究者获得事件区前后变化及同日可比非锋面对照差，能查看候选域、固定对照、前后权重、可比性与失败事件；无法匹配时保留描述结果和原因。 |
| B06 / [#78](https://github.com/NingRuo-code/Ocean/issues/78) | [按相关事件组估计效应区间并正确降级](06-dependent-event-inference.md) | [#77](https://github.com/NingRuo-code/Ocean/issues/77)、[#66](https://github.com/NingRuo-code/Ocean/issues/66) | 研究者看到按事件依赖结构计算的效应、可用独立组和合格区间，清楚区分事件数、多半径行数与独立支持；资料不足时保留描述而不是伪精确推断。 |
| B07 / [#79](https://github.com/NingRuo-code/Ocean/issues/79) | [提供逐日时滞与一致事件队列的比较](07-lag-and-common-cohort.md) | [#77](https://github.com/NingRuo-code/Ocean/issues/77) | 研究者能逐日查看−7至+7日的活动/对照变化，比较后1–3日与后1–7日时知道是否使用同一批事件及同类支持，避免把队列变化误读成时滞规律。 |
| B08 / [#80](https://github.com/NingRuo-code/Ocean/issues/80) | [冻结事件主方案并运行有界敏感性比较](08-frozen-event-sensitivity.md) | [#78](https://github.com/NingRuo-code/Ocean/issues/78)、[#79](https://github.com/NingRuo-code/Ocean/issues/79) | 研究者在正式目标期效果计算前登记主事件、窗口、对照、共同支持和推断规则，再通过同一B流程运行有限变体，得到事件成员、锚日、支持和效应共同变化的比较矩阵。 |
| B09 / [#81](https://github.com/NingRuo-code/Ocean/issues/81) | [将事件结果呈现为主图、解释和同源证据包](09-event-result-reading-pack.md) | [#78](https://github.com/NingRuo-code/Ocean/issues/78)、[#79](https://github.com/NingRuo-code/Ocean/issues/79) | 使用者先读一张时滞主图、关键前后/对照变化和简短解释，再按需查看事件时间线、窗口支持、相关组和匹配失败；允许导出的聚合图表与结果数字一致。 |
| B10 / [#82](https://github.com/NingRuo-code/Ocean/issues/82) | [复用正确事件结果并隔离规则和输入变化](10-event-result-reuse.md) | [#75](https://github.com/NingRuo-code/Ocean/issues/75)、[#70](https://github.com/NingRuo-code/Ocean/issues/70) | 研究者重复读取同条件事件结果时复用已完成快照；源、事件、窗口、对照或方法改变后不会命中旧成果，旧结果保留原条件，普通读取不启动重任务。 |
| B11 / [#83](https://github.com/NingRuo-code/Ocean/issues/83) | [运行真实固定区域事件和完整前后窗口案例](11-real-fixed-region-events.md) | [#80](https://github.com/NingRuo-code/Ocean/issues/80)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 项目负责人取得已冻结方案下的真实候选事件、跨月窗口支持、前后变化、可比对照及敏感性，知道固定区响应关口哪些已通过、哪些仍缺资料。 |
| B12 / [#84](https://github.com/NingRuo-code/Ocean/issues/84) | [复算真实事件成果并交接C与工作台合同](12-real-replay-handoff.md) | [#81](https://github.com/NingRuo-code/Ocean/issues/81)、[#82](https://github.com/NingRuo-code/Ocean/issues/82)、[#83](https://github.com/NingRuo-code/Ocean/issues/83) | 项目负责人复算真实B案例，核对直接执行、结果复用、主图和证据包完全对应；C和工作台获得已验证事件、窗口、对照及不确定性合同。 |

共12项、82条验收条件、21条直接阻塞边：本批内部15条，外部6条。21条GitHub原生阻塞已逐项设置并回读核对，与正文前置引用一致。外部为B02←A/#62、B03←P0/#41、B05←A/#65、B06←A/#66、B10←A/#70、B11←A/#71。传递已包含的P0 #39/#43/#44、A真实参照#68等不再重复加边；B用途真实资格仍逐事件核实，不能靠祖先Issue关闭替代证据。

1. B01可先做：复用#9已有受控实验与产物结构贯通合法已知小例，必要最小兼容随它完成。#9仍开放，但复用现有代码不需要等待旧工作包整项关闭；本批不为此重建工程或替代旧接口。
2. B02等A/#62的日级空间适配与几何，不等整个A真实验收；B03再接P0/#41的事件用途与跨月资格，B04延伸可比支持下的前后效应。P0已有审计/几何/窗口判定不在B重复实现。
3. B05等A/#65可比性基础，B06等A/#66重采样/退化基础，分别扩展到固定对照及相关事件，不直接搬A同月样本或日级分组。B07可在B05后独立做日级时滞与共同队列，无需等B06区间。
4. B08在B06/B07后冻结并用小例运行有限敏感性，正式目标期效果须先冻结；B09同样可在B06/B07后做同源阅读产物，不等真实实例。参数根据真实源精度及合法探索小例定，不在拆票时拍定阈值。
5. B10消费A/#70结果复用与P0新鲜度合同，独立于统计/图表分支；它不阻塞B11直接真实执行。B11等B08与A/#71实际交接；#71已含#68和P0 #44，故不另设冗余阻塞。
6. B12汇合真实实例、同源图表和复用路径，做一次真实复算及C/W交接。C/#20、W/#21、完整任务中心、AI及性能论文系统不反向阻塞B；它们按自身规格继续消费。

真实门槛：#71完成只证明A交接，不能证明B锚日的邻月/后7、对照或识别上下文齐备。P0 #41/#44真实证据、实际可访问资料、许可与0.01°目标/已批准替代、固定区分母、同支持窗口和可比对照逐项核查。软件样例、充分观测无事件或诚实缺口均可交付，但不勾选缺失的真实响应关口；至少一组真实合格前后窗口及同日对照可复算才可建议该实证范围通过，无须显著增强。首选2024-08锚日搜索期及实际跨月读取保持可追溯。

每项走已确认的显式确定性/受控计算验收入口并有独立小例；B09提供可独立读的最小成果，不在本批重建工作台或完整PDF。B02记录固定区对既有锋面缓冲ADR的几何澄清，B04控制前后支持与时长，B06处理事件依赖，B07防止时滞队列变化误读。原始总量比较、旧增强阈值与逐行推断均不搬成新B结论。

此图的“可分别推进”仅指依赖已满足，不承诺共享文件可同时改；按实际代码接缝与PR顺序整合。不以父级#72/#19/#9/#13或整个#18/#14关闭作为每票统一门槛，不修改其正文/状态/标签，不为子任务关系改父级；本轮已逐项发布ready-for-agent并设置原生阻塞。

规格46条用户故事全部有追溯。软件实现、真实研究关口、PR、合并和部署分别记证，本轮发布不代表任何计算已完成。用户已确认任务粒度与实际依赖；审查清单及Issue映射见同目录draft-review.json，实际发布/回读见发布记录。

发布核验：12项正文、ready-for-agent标签及21条原生阻塞已逐项回读一致，实际外部祖先关系与本批依赖合并检查无循环；#72/#19/#9/#13的正文、评论、状态与标签保持不变。当前可开始：[#73：运行固定海域事件响应的可手算样例](https://github.com/NingRuo-code/Ocean/issues/73)。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-b-ticket-publication-2026-10-24.json)。

## 实施进度 — 2026-10-26

B01/#73受控样例实现与软件验收通过，随本批PR合并后结项；计算、独立小例、冻结CLI及后续前置见[实施记录](../../reports/ocean-fixed-region-event-implementation-2026-10-26.md)。不将合成事件当真实B验收，不解除B02/#74对A/#62或B03/#75对P0/#41的前置。
