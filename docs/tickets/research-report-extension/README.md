# REPORT扩展任务及进度入口

日期：2026-10-25。来源：[规格 #252](https://github.com/NingRuo-code/Ocean/issues/252)，关联#13/#21及REPORT #125。状态：用户已确认粒度与真实直接前置，27项已发布为#253–#279，均标记ready-for-agent；RX01–RX27保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表功能实现、真实成果消费、合并或部署完成。本轮未计算研究、渲染报告、调用模型或操作生产。

已通过GitHub CLI读取#252完整正文/评论，与本地规格一致，并核对原REPORT、G3/PRED/AI/TASK和OPS来源。已发布合同不当作已实现，真实进度以对应Issue、代码和实际证据为准。

## 27项任务与实际编号

1. **RX01 / [#253](https://github.com/NingRuo-code/Ocean/issues/253)：[从既有G3结果预览分层复核报告](01-g3-a-preview.md)**
   - 直接前置：[#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#149](https://github.com/NingRuo-code/Ocean/issues/149)。
   - 交付：本人从选定G3 A复核结果打开同源报告预览，看到分层效应、实际支持、独立性和未完成维度，地图仍可操作。

2. **RX02 / [#254](https://github.com/NingRuo-code/Ocean/issues/254)：[保存G3案例并按原版本重开](02-g3-case-version.md)**
   - 直接前置：[#253](https://github.com/NingRuo-code/Ocean/issues/253)、[#128](https://github.com/NingRuo-code/Ocean/issues/128)。
   - 交付：本人保存G3复核案例，能在原案例列表检索、重开和修改笔记版本，科学内容与原引用保持不变。

3. **RX03 / [#255](https://github.com/NingRuo-code/Ocean/issues/255)：[下载G3同源PDF图片表格成果包](03-g3-format-package.md)**
   - 直接前置：[#254](https://github.com/NingRuo-code/Ocean/issues/254)、[#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)。
   - 交付：本人从固定G3案例实际下载PDF、PNG、聚合CSV和单类成果包，各文件与预览同源且失败状态清楚。

4. **RX04 / [#256](https://github.com/NingRuo-code/Ocean/issues/256)：[交付真实G3 A跨年季节报告](04-real-g3-a.md)**
   - 直接前置：[#255](https://github.com/NingRuo-code/Ocean/issues/255)、[#150](https://github.com/NingRuo-code/Ocean/issues/150)。
   - 交付：本人把真实G3 A跨年与季节复核保存并导出，原真实支持、冻结和未完成海域维度可核对。

5. **RX05 / [#257](https://github.com/NingRuo-code/Ocean/issues/257)：[保存并导出真实G3 B分窗口复核](05-real-g3-b.md)**
   - 直接前置：[#255](https://github.com/NingRuo-code/Ocean/issues/255)、[#153](https://github.com/NingRuo-code/Ocean/issues/153)。
   - 交付：本人导出真实G3 B复核报告，固定区域事件、原前后窗口、对照与相关组不会被A模板误写。

6. **RX06 / [#258](https://github.com/NingRuo-code/Ocean/issues/258)：[按真实外海域支持导出G3 B复核](06-foreign-sea-g3.md)**
   - 直接前置：[#255](https://github.com/NingRuo-code/Ocean/issues/255)、[#155](https://github.com/NingRuo-code/Ocean/issues/155)。
   - 交付：取得真实外海域B事件复核后，本人可保存和下载对应报告；未合格海域保留未验证状态。

7. **RX07 / [#259](https://github.com/NingRuo-code/Ocean/issues/259)：[在G3报告中附原条件模型证据](07-conditional-model.md)**
   - 直接前置：[#255](https://github.com/NingRuo-code/Ocean/issues/255)、[#157](https://github.com/NingRuo-code/Ocean/issues/157)。
   - 交付：条件解释模型真实可用时，本人选择附录原模型卡、诊断和条件关系，不把它当预测或因果。

8. **RX08 / [#260](https://github.com/NingRuo-code/Ocean/issues/260)：[预览固定检索快照与选中案例范围](08-similar-preview.md)**
   - 直接前置：[#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#166](https://github.com/NingRuo-code/Ocean/issues/166)、[#167](https://github.com/NingRuo-code/Ocean/issues/167)、[#172](https://github.com/NingRuo-code/Ocean/issues/172)。
   - 交付：本人从已有检索结果预览当时选中的历史情形与原响应，能区分候选全集、分页子集和环境证据。

9. **RX09 / [#261](https://github.com/NingRuo-code/Ocean/issues/261)：[保存检索案例并导出同源成果包](09-similar-case-package.md)**
   - 直接前置：[#260](https://github.com/NingRuo-code/Ocean/issues/260)、[#128](https://github.com/NingRuo-code/Ocean/issues/128)、[#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)。
   - 交付：本人保存选定检索子集，重开仍是原候选与顺序，并实际下载PDF、图片、聚合表和范围清单。

10. **RX10 / [#262](https://github.com/NingRuo-code/Ocean/issues/262)：[按原库版本导出有界完整候选或明确子集](10-frozen-pagination.md)**
   - 直接前置：[#261](https://github.com/NingRuo-code/Ocean/issues/261)。
   - 交付：本人明确选择全候选或子集时，生成任务固定原快照遍历，旧游标失效或超限不会伪报完整。

11. **RX11 / [#263](https://github.com/NingRuo-code/Ocean/issues/263)：[交付真实历史检索与B响应报告](11-real-similar-response.md)**
   - 直接前置：[#261](https://github.com/NingRuo-code/Ocean/issues/261)、[#173](https://github.com/NingRuo-code/Ocean/issues/173)。
   - 交付：本人把真实历史检索及不同案例的原B响应保存并导出，环境可用和响应可用分别留证。

12. **RX12 / [#264](https://github.com/NingRuo-code/Ocean/issues/264)：[保存按段核对的短窗案例](12-short-window-case.md)**
   - 直接前置：[#128](https://github.com/NingRuo-code/Ocean/issues/128)、[#171](https://github.com/NingRuo-code/Ocean/issues/171)。
   - 交付：本人将已有短窗核对保存为案例，重开可看逐日段、歧义和备选，缺日与重锚不会被连成连续轨迹。

13. **RX13 / [#265](https://github.com/NingRuo-code/Ocean/issues/265)：[导出保留断档歧义的短窗成果包](13-short-window-package.md)**
   - 直接前置：[#264](https://github.com/NingRuo-code/Ocean/issues/264)、[#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)。
   - 交付：本人下载短窗PDF、逐日图示PNG和允许聚合CSV，独立文件仍能分辨缺日、段与不确定关联。

14. **RX14 / [#266](https://github.com/NingRuo-code/Ocean/issues/266)：[交付真实短窗逐日核对报告](14-real-short-window.md)**
   - 直接前置：[#265](https://github.com/NingRuo-code/Ocean/issues/265)、[#174](https://github.com/NingRuo-code/Ocean/issues/174)。
   - 交付：本人导出已实际逐日核查的真实短窗成果，报告准确保留可能关联及不能确认身份的边界。

15. **RX15 / [#267](https://github.com/NingRuo-code/Ocean/issues/267)：[预览原预测回测及逐提前量评价](15-prediction-preview.md)**
   - 直接前置：[#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#192](https://github.com/NingRuo-code/Ocean/issues/192)。
   - 交付：本人从原预测成果预览历史签发、目标日和逐提前量公平评价，回测不会被写成今天的预报。

16. **RX16 / [#268](https://github.com/NingRuo-code/Ocean/issues/268)：[保存预测案例并导出公平回测成果包](16-prediction-case-package.md)**
   - 直接前置：[#267](https://github.com/NingRuo-code/Ocean/issues/267)、[#128](https://github.com/NingRuo-code/Ocean/issues/128)、[#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)。
   - 交付：本人保存原预测实验版本并实际下载PDF、PNG、允许聚合CSV和模型卡清单，文件与预览同源。

17. **RX17 / [#269](https://github.com/NingRuo-code/Ocean/issues/269)：[交付真实局部1至3日独立回测报告](17-real-local-prediction.md)**
   - 直接前置：[#268](https://github.com/NingRuo-code/Ocean/issues/268)、[#193](https://github.com/NingRuo-code/Ocean/issues/193)。
   - 交付：本人导出真实局部逐1/2/3日及有无锋面对照成果，无稳定增益和未验证空间范围准确保留。

18. **RX18 / [#270](https://github.com/NingRuo-code/Ocean/issues/270)：[导出有原生空间支持的局部分布报告](18-native-spatial-report.md)**
   - 直接前置：[#268](https://github.com/NingRuo-code/Ocean/issues/268)、[#195](https://github.com/NingRuo-code/Ocean/issues/195)。
   - 交付：真实原生空间分布已验证后，本人可导出对应地图和误差，局部常数不会被涂成细网格预测。

19. **RX19 / [#271](https://github.com/NingRuo-code/Ocean/issues/271)：[导出预测跨年与季节独立复核报告](19-cross-period-prediction.md)**
   - 直接前置：[#268](https://github.com/NingRuo-code/Ocean/issues/268)、[#196](https://github.com/NingRuo-code/Ocean/issues/196)。
   - 交付：真实跨期预测复核可用时，本人导出各年份/季节的评价与局限，不从局部单期推断稳定泛化。

20. **RX20 / [#272](https://github.com/NingRuo-code/Ocean/issues/272)：[按已验证东海范围导出分布成果](20-east-china-prediction.md)**
   - 直接前置：[#270](https://github.com/NingRuo-code/Ocean/issues/270)、[#197](https://github.com/NingRuo-code/Ocean/issues/197)。
   - 交付：真实东海扩展具备支持和预算后，本人可保存并导出该范围概览/局部图，覆盖空洞和未验证项可见。

21. **RX21 / [#273](https://github.com/NingRuo-code/Ocean/issues/273)：[组合新研究章节并保留各自证据身份](21-mixed-research-package.md)**
   - 直接前置：[#255](https://github.com/NingRuo-code/Ocean/issues/255)、[#261](https://github.com/NingRuo-code/Ocean/issues/261)、[#265](https://github.com/NingRuo-code/Ocean/issues/265)、[#268](https://github.com/NingRuo-code/Ocean/issues/268)、[#137](https://github.com/NingRuo-code/Ocean/issues/137)。
   - 交付：本人明确选择已有G3、案例/短窗和预测章节合成一包，各章仍保留原时间、单位、结果和未完成范围。

22. **RX22 / [#274](https://github.com/NingRuo-code/Ocean/issues/274)：[按当前用途导出新类型并阻止封存旁路](22-purpose-and-contact.md)**
   - 直接前置：[#273](https://github.com/NingRuo-code/Ocean/issues/273)、[#138](https://github.com/NingRuo-code/Ocean/issues/138)。
   - 交付：本人选择内部或允许分享用途时得到合法的新类型投影，旧缓存/文件、混合章节和接触状态不能绕过政策。

23. **RX23 / [#275](https://github.com/NingRuo-code/Ocean/issues/275)：[按实测限额生成长候选与混合报告](23-bounded-large-report.md)**
   - 直接前置：[#262](https://github.com/NingRuo-code/Ocean/issues/262)、[#273](https://github.com/NingRuo-code/Ocean/issues/273)。
   - 交付：本人生成大候选/多类型报告时可看到可执行范围和真实任务状态，超限会明确拒绝，地图轻读仍可用。

24. **RX24 / [#276](https://github.com/NingRuo-code/Ocean/issues/276)：[保护新报告实际依赖并对账清理竞争](24-protected-dependency-closure.md)**
   - 直接前置：[#274](https://github.com/NingRuo-code/Ocean/issues/274)、[#275](https://github.com/NingRuo-code/Ocean/issues/275)、[#139](https://github.com/NingRuo-code/Ocean/issues/139)。
   - 交付：新类型案例、最终文件与共享证据在真实普通清理并发下仍受保护，源/模型缺失时可读和复算能力准确。

25. **RX25 / [#277](https://github.com/NingRuo-code/Ocean/issues/277)：[按原注释合同导出新类型AI说明](25-existing-ai-annotation.md)**
   - 直接前置：[#276](https://github.com/NingRuo-code/Ocean/issues/276)、[#222](https://github.com/NingRuo-code/Ocean/issues/222)、[#223](https://github.com/NingRuo-code/Ocean/issues/223)。
   - 交付：对应报告和原AI注释可用时，本人可明确附原解释版本下载，科学正文和未选私人会话保持隔离。

26. **RX26 / [#278](https://github.com/NingRuo-code/Ocean/issues/278)：[查看新报告能力账与原文件及交付缺口](26-capability-and-handoff.md)**
   - 直接前置：[#256](https://github.com/NingRuo-code/Ocean/issues/256)、[#257](https://github.com/NingRuo-code/Ocean/issues/257)、[#263](https://github.com/NingRuo-code/Ocean/issues/263)、[#266](https://github.com/NingRuo-code/Ocean/issues/266)、[#269](https://github.com/NingRuo-code/Ocean/issues/269)、[#276](https://github.com/NingRuo-code/Ocean/issues/276)。
   - 交付：本人从原报告入口查看各类型支持、原案例/文件及保存恢复缺口，负责人获得可追踪且不夸大研究范围的交付。

27. **RX27 / [#279](https://github.com/NingRuo-code/Ocean/issues/279)：[独立导出真实外海域A复核报告](27-foreign-sea-a.md)**
   - 直接前置：[#255](https://github.com/NingRuo-code/Ocean/issues/255)、[#154](https://github.com/NingRuo-code/Ocean/issues/154)。
   - 交付：真实外海域A结果可用时，本人可独立保存和导出，不等待外海域B事件或完整窗口资料。

## 覆盖与依赖

共27项、162条验收条件、70条直接边（本批33、外部37），覆盖60/60用户故事和64/64实施检查。与214项既有执行任务发布记录合并核验无环，已去除可由其他前置传递的冗余直接边；已通过GitHub CLI核对137个外部前置/祖先节点，与本批依赖合并无环、直接边无冗余；正式发布已重新核对最新祖先及状态，70条原生阻塞已逐项设置并回读一致。

G3预览RX01→保存RX02→格式RX03，真实A/B在RX04/RX05各自消费；外海域B的RX06与A的RX27、条件模型RX07为独立条件分支，不阻塞东海核心，也不以#158全部结项为统一前置。

检索RX08→案例格式RX09，完整候选遍历RX10和真实历史/B响应RX11各自追加；短窗RX12→格式RX13→真实逐日RX14独立起步。它们复用原报告和科学合同，不等待G3复核或预测报告先实现，不重新计算检索排序/匹配/统计。

预测RX15→保存格式RX16→真实局部RX17；空间/跨期/东海RX18–RX20分别条件性消费原证据，不等#198全推广才交局部，也不由一个圆域标量宣称整域完成。归档条件、当时可知输入和规则参考一直分开。

RX21复用#137组合平台，RX22复用#138投影/权限/接触，RX23补实际新体量和长候选预算，RX24接#139真实清理验证新增依赖。各首批票已自带基本授权、封存阻止、保护和有界生成，不能等这些后段票才补安全；后段交付是新类型的完整集成与实测。

RX25只在已有冻结AI注释合同可用时适配新类型，不调用新模型或等待整个#225；它是可选分支，不阻塞RX26核心确定性报告交付。RX26提供实际报告能力/文件/依赖缺口入口及交接，不把本扩展或文件生成当完整L2/科学/生产完成。

复用#128/#130/#133等底座，真实消费分别沿#150/#153/#173/#174/#193；不把#140、#158、#175、#198、#225或OPS收官全部挂成每票前置。OPS接新报告依赖与恢复读取要求，实际备份/空白恢复和生产按原范围后续安排，不修改旧任务制造反向等待。

每项均为实际用户操作→原服务→可观察案例/图表/文件的完整窄切片。未发现必须先做的广泛机械重构，必要类型/内容适配随首个消费切片完成；所有软件、真实成果、合成反例、保护/清理和生产状态分账。

完整拆分、用户确认、检查覆盖和依赖：[评审记录](draft-review.json)。用户已批准27项粒度及真实直接前置，本轮按拓扑顺序发布ready-for-agent执行Issue与GitHub原生阻塞；后续按实际前置推进，未修改或关闭#252及既有父级。

核查状态：27项正文、ready-for-agent标签和70条原生阻塞已逐项回读一致；#252/#125/#13/#21及受检来源正文、评论、状态和标签保持不变。当前可领取状态：本批暂无无阻塞任务。分支起点：[RX01 / #253](https://github.com/NingRuo-code/Ocean/issues/253)等待[#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#149](https://github.com/NingRuo-code/Ocean/issues/149)；[RX08 / #260](https://github.com/NingRuo-code/Ocean/issues/260)等待[#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#166](https://github.com/NingRuo-code/Ocean/issues/166)、[#167](https://github.com/NingRuo-code/Ocean/issues/167)、[#172](https://github.com/NingRuo-code/Ocean/issues/172)；[RX12 / #264](https://github.com/NingRuo-code/Ocean/issues/264)等待[#128](https://github.com/NingRuo-code/Ocean/issues/128)、[#171](https://github.com/NingRuo-code/Ocean/issues/171)；[RX15 / #267](https://github.com/NingRuo-code/Ocean/issues/267)等待[#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#192](https://github.com/NingRuo-code/Ocean/issues/192)。实际进度以GitHub实时状态为准，本轮仅发布任务，尚未开始实施。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-research-report-ticket-publication-2026-10-25.json)。
