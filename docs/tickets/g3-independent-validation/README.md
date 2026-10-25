# G3 独立复核任务与进度入口

日期：2026-10-24。来源：[规格 #141](https://github.com/NingRuo-code/Ocean/issues/141)，关联总纲#13及STAT-07/METHOD-01/05/07。用户已确认粒度与直接阻塞，17项已发布为#142–#158，均标记ready-for-agent；V01–V17保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表实现、真实独立复核、合并或部署完成。

已通过GitHub CLI读取#141完整正文和评论、相关P0/A/B/C及W/TASK/REPORT来源，规格正文与本地一致，所读项暂无评论；发布前未发现重复G3执行任务；本轮只创建并核验任务及阻塞，没有执行研究计算。已有任务是复用合同，不是实现完成证明。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| V01 / [#142](https://github.com/NingRuo-code/Ocean/issues/142) | [显式运行并读取可手算的分层复核样例](01-known-validation-request.md) | 无，可开始 | 研究者提交一个小型复核请求，得到按年份和季节分层、可手算核对的A聚合结果与证据；先贯通受控入口和阅读输出。 |
| V02 / [#143](https://github.com/NingRuo-code/Ocean/issues/143) | [列出真实跨年季节候选及联合资料缺口](02-candidate-joint-support.md) | [#142](https://github.com/NingRuo-code/Ocean/issues/142)、[#41](https://github.com/NingRuo-code/Ocean/issues/41) | 研究者给出候选年月和海域，读到实际P0共同覆盖、许可和可支持分析类型，知道哪些能研究、哪些缺资料。 |
| V03 / [#144](https://github.com/NingRuo-code/Ocean/issues/144) | [登记资料接触并冻结可审查复核方案](03-exposure-protocol-registration.md) | [#143](https://github.com/NingRuo-code/Ocean/issues/143) | 研究者登记已看过哪些资料、选择探索与复核分区并保存冻结版本；目标揭示后改方案会留下版本和独立性变化。 |
| V04 / [#145](https://github.com/NingRuo-code/Ocean/issues/145) | [阻止重叠样本和相关事件跨入独立复核](04-partition-dependency-guard.md) | [#144](https://github.com/NingRuo-code/Ocean/issues/144) | 提交分区后系统指出跨月窗口、共享对照或重叠空间带来的关联，不能独立时阻止确认性执行或明确降级。 |
| V05 / [#146](https://github.com/NingRuo-code/Ocean/issues/146) | [用原A引擎逐层执行冻结月度复核](05-monthly-frozen-replay.md) | [#145](https://github.com/NingRuo-code/Ocean/issues/145)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 研究者提交合格月度复核请求，按冻结方法取得各年月真实A结果和完整候选台账，不会重新发明月度计算。 |
| V06 / [#147](https://github.com/NingRuo-code/Ocean/issues/147) | [复用正确G3结果并保留旧版本和失败状态](06-validation-result-identity.md) | [#146](https://github.com/NingRuo-code/Ocean/issues/146) | 相同复核请求读取正确的完成结果，条件或版本改变不会命中旧批次；旧成果可读且失败不覆盖成功。 |
| V07 / [#148](https://github.com/NingRuo-code/Ocean/issues/148) | [给出A分层效应及有依据的跨层汇总](07-monthly-stratified-inference.md) | [#146](https://github.com/NingRuo-code/Ocean/issues/146) | 研究者读到逐年月的月度效应和不确定性，合法时得到预定加权汇总或差值，资料不足时明确只作描述。 |
| V08 / [#149](https://github.com/NingRuo-code/Ocean/issues/149) | [读取A跨期敏感性图表和失效证据](08-monthly-sensitivity-reading.md) | [#148](https://github.com/NingRuo-code/Ocean/issues/148) | 研究者对冻结月度复核查看有界敏感性、分层效应图及失败清单，图表和聚合证据来自同一批次。 |
| V09 / [#150](https://github.com/NingRuo-code/Ocean/issues/150) | [完成东海A真实跨年与季节独立复核](09-real-ecs-monthly-validation.md) | [#149](https://github.com/NingRuo-code/Ocean/issues/149)、[#147](https://github.com/NingRuo-code/Ocean/issues/147) | 负责人得到东海A真实独立复核记录，分别知道跨年和季节验证完成了多少、关系在哪些条件成立或不确定。 |
| V10 / [#151](https://github.com/NingRuo-code/Ocean/issues/151) | [用原B引擎逐层执行固定区域事件复核](10-event-frozen-replay.md) | [#145](https://github.com/NingRuo-code/Ocean/issues/145)、[#84](https://github.com/NingRuo-code/Ocean/issues/84) | 研究者提交事件复核请求，按原B规则取得各层实际事件、窗口、对照及相关组，不等待A跨年实证完成。 |
| V11 / [#152](https://github.com/NingRuo-code/Ocean/issues/152) | [给出B跨期效应与敏感性同源证据](11-event-inference-sensitivity-reading.md) | [#151](https://github.com/NingRuo-code/Ocean/issues/151)、[#149](https://github.com/NingRuo-code/Ocean/issues/149) | 研究者读取B各窗口的分层效应、有效独立事件组及敏感性，合法时比较层间差异，图表与事件证据一致。 |
| V12 / [#153](https://github.com/NingRuo-code/Ocean/issues/153) | [完成东海B真实跨期独立复核](12-real-ecs-event-validation.md) | [#152](https://github.com/NingRuo-code/Ocean/issues/152)、[#147](https://github.com/NingRuo-code/Ocean/issues/147) | 负责人得到东海真实独立事件的跨期复核记录，分别知道不同年份、季节和响应窗口的支持及结论。 |
| V13（条件性） / [#154](https://github.com/NingRuo-code/Ocean/issues/154) | [在合格外海域独立复核A关系](13-external-sea-monthly-validation.md) | [#150](https://github.com/NingRuo-code/Ocean/issues/150) | 东海A复核后，在独立通过资格的其他海域执行相同协议，明确可推广范围及不一致情形。 |
| V14（条件性） / [#155](https://github.com/NingRuo-code/Ocean/issues/155) | [在合格外海域独立复核B响应](14-external-sea-event-validation.md) | [#153](https://github.com/NingRuo-code/Ocean/issues/153) | 东海B复核后，对具备真实完整窗口和独立事件的外海域重复原B研究，明确响应能否推广。 |
| V15（条件性） / [#156](https://github.com/NingRuo-code/Ocean/issues/156) | [诊断资料并冻结必要的条件解释模型](15-conditional-model-selection.md) | [#146](https://github.com/NingRuo-code/Ocean/issues/146) | 资料支持时，研究者在探索与选择数据上拟合简单基线和一个必要候选，看到诊断、成本和采用依据并冻结模型方案。 |
| V16（条件性） / [#157](https://github.com/NingRuo-code/Ocean/issues/157) | [独立评价冻结条件模型并报告解释边界](16-conditional-model-independent-assessment.md) | [#156](https://github.com/NingRuo-code/Ocean/issues/156)、[#148](https://github.com/NingRuo-code/Ocean/issues/148) | 研究者在真正未用于模型选择的资料上评价冻结解释模型，得到条件关系、诊断和适用范围，不能重新调参后宣称通过。 |
| V17 / [#158](https://github.com/NingRuo-code/Ocean/issues/158) | [复算东海A/B复核成果并交接适用范围](17-core-validation-handoff.md) | [#150](https://github.com/NingRuo-code/Ocean/issues/150)、[#153](https://github.com/NingRuo-code/Ocean/issues/153) | 负责人获得可复算的东海A/B独立复核成果及分维进度账，后续工作台、报告、案例检索与预测明确知道可消费什么。 |

共17项、104条验收条件、24条直接边，其中本批21条、外部3条。覆盖规格48/48用户故事和57/57实施检查；与108项既有任务的本地发布记录合并核验无环、无冗余直接边，实际原生祖先已回读核对，24条原生阻塞已逐项设置并验证。

可立即开始V01。V02只直接等待V01及P0#41；V05消费A#71，V10消费B#84。#67/#43与#80/#82等已经由交接任务传递，不重复加边。#94区域比较、完整W/TASK/REPORT、AI和预测不是整个G3的前置。

V03/V04交付的是实际冻结/接触与分区检查行为，可用独立小例验证；真实执行仍必须取得来源匹配的完整协议/资料资格。V05及后续能力开发只用探索/已知资料，V07/V08确定的方法由同一V03流程完整冻结后才可揭示V09目标。V10/V11与V12同理。软件任务关闭不代表最终真实协议已经冻结或资料自动合格。

A主链为V01→V02→V03→V04→V05→V07→V08→V09，V06从V05分支后汇入V09。B执行在V04及#84后可开始；V11复用V08已交付的通用G3汇总/阅读结构，V12汇入V06身份合同，不等待V09真实A跨期研究完成。相关性和冻结检查不是另一套A/B数值引擎。

V13/V14为条件性外海域A/B，分别在本路径东海真实复核后启用，彼此不设阻塞。V15在探索/选择数据上诊断与选模，V16独立评价；它们不等待V09/V12揭示目标后再选模，也不能默认重用其资料当未见测试。实际资料接触历史必须核验，有污染就另选未见资料或降级。

V17交接东海A/B核心真实成果与分维台账，不等待条件性外海域/模型全部完成；不能据此标整个G3所有实证维度完成。V13–V16按各自支持和真实验证另行验收。资料不足时可交软件/可行性成果，真实实证任务保持未完成，不以缺口报告冒充已复核。

每项都是请求/执行或读取到可观察成果的完整切片，自带独立验证。没有发现必须先做的广泛机械重构；最小兼容适配随V01/V05/V10的行为交付，不另开纯schema/测试/文档层票。

本批不实现系统内G3浏览器/PDF适配、相似案例检索、预测独立回测或完整AI。权限、任务、保护和报告按实际消费接缝复用已有合同；真实源授权、支持与可用性是运行事实，不能靠Issue关闭解除。父级#141/#13及既有P0/A/B/C规格/任务不修改、不关闭，PR、合并和部署分别记证。

已额外通过GitHub CLI回读#41/#71/#84及其全部32项原生前置节点，合并本批依赖验证无环、直接边无冗余；#141正文、评论、状态和标签在拆分前后保持不变。17项任务和24条原生阻塞已正式创建并回读一致，受检父级和来源任务保持不变。

完整拆分、用户确认与覆盖检查：[评审记录](draft-review.json)。用户已批准17项粒度和直接阻塞，本轮按依赖顺序发布；后续按真实前置领取，不修改或关闭父级。

发布核验：17项正文、ready-for-agent标签及24条原生阻塞均已逐项回读，#141/#13及受检来源规格/任务的正文、评论、状态和标签保持不变。当前可开始：[#142：显式运行并读取可手算的分层复核样例](https://github.com/NingRuo-code/Ocean/issues/142)。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-g3-validation-ticket-publication-2026-10-24.json)。
