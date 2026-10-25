# PRED 活动预测任务与进度入口

日期：2026-10-24。来源：[规格 #176](https://github.com/NingRuo-code/Ocean/issues/176)，归属L2/G4a、PRED-01–06和#13。用户已确认粒度与直接阻塞，22项已发布为#177–#198，均标记ready-for-agent；P01–P22保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表功能实现、模型训练、回测、真实资料或实证已通过。

已通过GitHub CLI读取#176完整正文/评论及相关前置，规格正文与本地一致，所读源任务暂无评论；未发现重复PRED执行票，旧#30预测阅读不等于本批研究模型。已发布合同不代表实现、真实数据或实证已通过。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| P01 / [#177](https://github.com/NingRuo-code/Ocean/issues/177) | [从工作台运行可手算活动预测基线](01-known-baseline-request.md) | [#99](https://github.com/NingRuo-code/Ocean/issues/99) | 本人明确提交一个合法小范围已知样例，经实际任务服务运行持续性基线，读取未来第1/2/3日的同源结果；地图仍可操作。 |
| P02 / [#178](https://github.com/NingRuo-code/Ocean/issues/178) | [核实预测用途资料与独立样本可行性](02-prediction-purpose-feasibility.md) | [#177](https://github.com/NingRuo-code/Ocean/issues/177)、[#143](https://github.com/NingRuo-code/Ocean/issues/143) | 研究者看到真实候选资料能支持哪些预测任务、哪些仅能做归档实验，以及训练/验证/未见测试还缺什么。 |
| P03 / [#179](https://github.com/NingRuo-code/Ocean/issues/179) | [生成不受未来锋面筛选的逐日活动标签](03-activity-labels-fixed-support.md) | [#178](https://github.com/NingRuo-code/Ocean/issues/178)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 研究者对固定区域或已登记原生单元生成未来1/2/3日活动标签，能追到真实小时与有效面积，改变未来锋面不会改变目标。 |
| P04 / [#180](https://github.com/NingRuo-code/Ocean/issues/180) | [按签发时刻构建可知输入与时效记录](04-asof-inputs-vintages.md) | [#179](https://github.com/NingRuo-code/Ocean/issues/179) | 研究者提交历史签发时点，得到当时版本可用的活动/环境/锋面历史特征，并明确区分可核回测和归档假设。 |
| P05 / [#181](https://github.com/NingRuo-code/Ocean/issues/181) | [登记预测分区并阻止窗口和目标泄漏](05-prediction-splits-freeze.md) | [#180](https://github.com/NingRuo-code/Ocean/issues/180)、[#145](https://github.com/NingRuo-code/Ocean/issues/145) | 研究者保存预测用途的训练/时间验证/测试分区，实际执行会检查标签发布、窗口重叠和已接触目标，不能靠改名重新独立。 |
| P06 / [#182](https://github.com/NingRuo-code/Ocean/issues/182) | [运行持续性与近期日历均值基线](06-persistence-recent-baselines.md) | [#181](https://github.com/NingRuo-code/Ocean/issues/181) | 研究者在冻结初始切分下运行B0/B1，读取逐提前量预测、误差和不可用原因，结果可独立手算。 |
| P07 / [#183](https://github.com/NingRuo-code/Ocean/issues/183) | [按真实支持加入季节常态与相对变化](07-seasonal-baseline-relative-change.md) | [#182](https://github.com/NingRuo-code/Ocean/issues/182) | 研究者在资料足够时读取B2季节常态及相对变化，常态为零/未知或历史不足会保留明确不可用状态。 |
| P08 / [#184](https://github.com/NingRuo-code/Ocean/issues/184) | [交付真实训练验证时段的基线参照](08-real-baseline-reference.md) | [#183](https://github.com/NingRuo-code/Ocean/issues/183) | 负责人拿到真实合法训练/时间验证资料上的B0/B1及合格B2参照、误差和缺口，不提前消耗最终测试。 |
| P09 / [#185](https://github.com/NingRuo-code/Ocean/issues/185) | [受控比较可解释的无锋面与有锋面模型](09-interpretable-paired-models.md) | [#182](https://github.com/NingRuo-code/Ocean/issues/182) | 研究者在训练/时间验证资料上拟合一对可解释模型，读取配置、诊断及公平对照结果，不接触最终测试。 |
| P10 / [#186](https://github.com/NingRuo-code/Ocean/issues/186) | [以同等预算比较一类成熟树模型](10-bounded-tree-models.md) | [#185](https://github.com/NingRuo-code/Ocean/issues/185) | 研究者复用已有实验管线比较一类树模型的无锋面/有锋面对照，早停和调参保持时间验证合规。 |
| P11 / [#187](https://github.com/NingRuo-code/Ocean/issues/187) | [读取同样本配对误差与预测覆盖](11-paired-errors-coverage.md) | [#185](https://github.com/NingRuo-code/Ocean/issues/185) | 研究者同时看到各模型1/2/3日绝对误差、配对增量和未输出覆盖，不能靠少预测难样本冒充进步。 |
| P12 / [#188](https://github.com/NingRuo-code/Ocean/issues/188) | [按相关组估计增量区间并正确降级](12-dependent-increment-uncertainty.md) | [#187](https://github.com/NingRuo-code/Ocean/issues/187) | 研究者在配对误差旁看到保持时间/空间相关结构的增量区间及失败分析，独立组不足时得到诚实降级。 |
| P13 / [#189](https://github.com/NingRuo-code/Ocean/issues/189) | [保存并保护实验模型和预测评价版本](13-experiment-model-artifacts.md) | [#182](https://github.com/NingRuo-code/Ocean/issues/182)、[#120](https://github.com/NingRuo-code/Ocean/issues/120) | 研究者重开旧实验仍读到原协议、模型、预测及评价；版本变化不会串用，模型产物保护和复算限制真实。 |
| P14 / [#190](https://github.com/NingRuo-code/Ocean/issues/190) | [完成真实时间验证选择并封存最终模型](14-real-selection-final-freeze.md) | [#184](https://github.com/NingRuo-code/Ocean/issues/184)、[#186](https://github.com/NingRuo-code/Ocean/issues/186)、[#188](https://github.com/NingRuo-code/Ocean/issues/188)、[#189](https://github.com/NingRuo-code/Ocean/issues/189) | 负责人用真实训练/时间验证资料公平选择基线与候选，保存配置和拟合产物，再冻结最终测试方案；不会先看答案再选模型。 |
| P15 / [#191](https://github.com/NingRuo-code/Ocean/issues/191) | [完成真实1–3日锋面增量独立回测](15-real-independent-front-increment.md) | [#190](https://github.com/NingRuo-code/Ocean/issues/190) | 负责人在真正未用于选择的目标上得到逐提前量基线与有/无锋面的配对误差、覆盖和增量结论，可直接复算。 |
| P16 / [#192](https://github.com/NingRuo-code/Ocean/issues/192) | [按原条件阅读预测并区分观测图层](16-prediction-reading-map-context.md) | [#187](https://github.com/NingRuo-code/Ocean/issues/187)、[#107](https://github.com/NingRuo-code/Ocean/issues/107) | 使用者在右侧读短预测摘要、底部看误差证据，明确点击才定位原区域；规则、归档回测、可核历史回测与观测各有标识。 |
| P17 / [#193](https://github.com/NingRuo-code/Ocean/issues/193) | [贯通真实局部回测阅读并交接核心成果](17-real-local-core-replay.md) | [#191](https://github.com/NingRuo-code/Ocean/issues/191)、[#192](https://github.com/NingRuo-code/Ocean/issues/192) | 负责人从真实浏览器提交/重开局部独立实验，得到可复算的结果、误差与模型卡，明确首批核心完成范围及待扩展关口。 |
| P18 / [#194](https://github.com/NingRuo-code/Ocean/issues/194) | [按原生预测单元生成局部分布样例](18-native-unit-local-distribution.md) | [#192](https://github.com/NingRuo-code/Ocean/issues/192)、[#186](https://github.com/NingRuo-code/Ocean/issues/186) | 使用者按已登记原生空间单元查看局部预测样例和圆域聚合，系统不会把一个区域常数涂满网格冒充分布。 |
| P19 / [#195](https://github.com/NingRuo-code/Ocean/issues/195) | [独立验证原生局部分布与空间留出](19-real-spatial-heldout-distribution.md) | [#194](https://github.com/NingRuo-code/Ocean/issues/194)、[#188](https://github.com/NingRuo-code/Ocean/issues/188)、[#189](https://github.com/NingRuo-code/Ocean/issues/189) | 负责人在真正留出的空间支持上验证原生单元预测，取得局部分布的真实误差、覆盖和适用范围，不将时间验证冒充空间泛化。 |
| P20 / [#196](https://github.com/NingRuo-code/Ocean/issues/196) | [按冻结范围复核预测跨年份与季节表现](20-real-temporal-generalization.md) | [#191](https://github.com/NingRuo-code/Ocean/issues/191) | 负责人分别得到预测在不同年份和季节的真实误差与失效条件，已揭示的结果不会被反复当成新未见测试。 |
| P21 / [#197](https://github.com/NingRuo-code/Ocean/issues/197) | [在已验证支持与实测预算内扩展东海分布](21-east-china-sea-distribution.md) | [#195](https://github.com/NingRuo-code/Ocean/issues/195)、[#47](https://github.com/NingRuo-code/Ocean/issues/47) | 使用者浏览已验证支持内的东海预测概览并缩小到局部，未支持海域保留空洞，处理规模有实际资源证据。 |
| P22 / [#198](https://github.com/NingRuo-code/Ocean/issues/198) | [汇合预测实证与空间扩展并交接完整范围](22-full-prediction-handoff.md) | [#193](https://github.com/NingRuo-code/Ocean/issues/193)、[#196](https://github.com/NingRuo-code/Ocean/issues/196)、[#197](https://github.com/NingRuo-code/Ocean/issues/197) | 负责人获得从局部核心到已验证跨期/空间及东海范围的完整成果账，明确报告和AI可消费的结果以及仍未满足的研究条件。 |

共22项、125条验收条件、37条直接边（本批30、外部7）。覆盖60/60用户故事和81/81实施检查；与141项既有任务的本地发布记录合并核验无环、无冗余直接边，已回读实际原生祖先和状态，37条原生阻塞已逐项设置并核对。

起点P01只直接等待#99本人真实受理及其条件/权限/资格祖先，能先用合法已知探索小例跑通浏览器→服务→持续性预测/评分。P02复用#143真实候选，P03消费#71逐日合法基础但必须排除未来front/SST掩码条件化；不能以#71真实月通过当预测标签自动合格。P04处理版本可得/标签发布，P05复用#145/#144后增加预测窗口、分区/接触和分阶段冻结，不重建台账。

P06/P07软件基线可先用合法小例/探索资料，B2季节常态不适用时正确禁用；P08才验真实训练/时间验证基线，不提前消耗最终测试。P09/P10模型软件与P11/P12误差/区间可用探索/已知资料分别开发；真实支持仍是运行条件，P14统一完成真实选择与完整冻结，P15才揭示最终目标做独立配对。不能将软件任务关闭当真实数据门槛解除。

P13从P06分支复用#120/#119保护模型、记录和活动引用，P16复用#107定位接入P11阅读；它们不等待全部实证。P17汇合P15/P16交付真实局部标量核心，不等P18–P21空间/跨期/东海全部完成，也不因此称完整PRED完成。

P18在同一模型/阅读基础做原生单元分布软件，P19对本配置重新核真实资料/选择/完整冻结后验空间留出；不把区域标量模型复制到网格或拿其时间误差当空间泛化。P20跨年/季节只评价首次揭示前已登记的范围，后续新配置也须独立协议/资料，不能在看完P15后挑有利年份。

P21在P19和#47实际资源盘点后扩展东海，必须实测新增预测负载/工作集及准入预算；#47可交缺项报告，关闭本身不代表容量通过。#53/#123既有证据按实际采用情况复用，不将整套P1或TASK平台结项设为全局前置。资料/空间支持/容量不足时整域任务保持未完成，不自动采购/扩容。

P22是完整声明范围的收官，等待P17核心、P20跨期和P21东海；P19已由P21传递，不重复加边。只有局部合格可以先交P17，相应空间/跨期/整域关口仍保留；不得因希望收官而将未完成实证改成通过。真实无增益/反向或估计不精确可正常形成研究结论。

真正外部边为P01←#99、P02←#143、P03←#71、P05←#145、P13←#120、P16←#107、P21←#47。#41/#43/#66等已由合同交接传递，不重复加祖先。G3#150/#153/#158/#175全部实证、解释模型#156/#157、B/C、完整REPORT/AI或深入追踪不构成本批统一前置；它们实际揭示资料的历史仍须登记。

每项都是明确请求/读取到可观察预测或证据的完整窄切片，自带独立已知期望与异常检查。未发现须先做的广泛机械重构，局部适配随首个消费切片完成，不单开schema/样式/测试/文档横向票。最终测试仅在完整冻结/权限放行后揭示，不在前期界面/开发任务借用保留目标。

全部沿同一PRED计算/服务合同，软件、真实资料/基线、选择、独立增量、空间/跨期和东海分维记证，真值不换成渔获/收益/成功率；规则参考与归档/可核当时输入回测分开。完整报告导出、AI、G6a当前滚动预报、实际作业效果及生产部署另验，不修改或关闭#176/#13及既有父级/任务。

已额外通过GitHub CLI回读所有外部前置及其42项原生祖先节点，与本批依赖合并检查无环、直接边无冗余；#176正文、评论、状态和标签在拆分前后保持不变。正式发布已再次回读祖先和直接边；22项新任务与37条原生阻塞已创建，受检父级及既有来源任务保持不变。

完整拆分、用户确认与覆盖检查：[评审记录](draft-review.json)。用户已批准22项粒度和直接前置，本轮按依赖顺序创建ready-for-agent执行票与原生阻塞；后续按实际前置领取，不修改或关闭父级。

发布核验：22项正文、ready-for-agent标签及37条原生阻塞均逐项回读一致，#176/#13及受检来源规格/任务的正文、评论、状态和标签保持不变。当前可领取状态：本批暂无无阻塞项；起点[P01 / #177](https://github.com/NingRuo-code/Ocean/issues/177)等待#99。实际进度以GitHub实时状态为准。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-prediction-ticket-publication-2026-10-24.json)。
