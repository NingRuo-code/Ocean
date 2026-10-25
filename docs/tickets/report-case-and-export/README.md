# REPORT 案例与成果导出任务与进度入口

日期：2026-10-24。来源：[规格 #125](https://github.com/NingRuo-code/Ocean/issues/125)，关联总体规划REPORT模块及#13/#20/#21。用户已确认粒度与直接阻塞，15项已发布为#126–#140，均标记ready-for-agent；R01–R15保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表实现、真实成果导出、保护联动、合并或部署完成。

已通过GitHub CLI读取#125完整正文和评论，及相关A/B/C、W、TASK前置；#125与本地规格正文一致，所读项均开放且暂无评论，发布前未发现重复REPORT子任务；本轮仅发布并核验正文/标签/原生阻塞，没有实施应用、生成真实成果或执行清理。已有基础是已发布职责，不代表实际实现；本批仅增量消费，不回改科学交接或TASK保护的职责/前置。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| R01 / [#126](https://github.com/NingRuo-code/Ocean/issues/126) | [从已有月结果预览同源研究报告](01-known-month-report-preview.md) | [#30](https://github.com/NingRuo-code/Ocean/issues/30)、[#69](https://github.com/NingRuo-code/Ocean/issues/69) | 本人选中一个已有合法A结果，在既有工作台/详情中预览完整研究报告，原条件、主图、聚合表和来源一致，预览不重新分析。 |
| R02 / [#127](https://github.com/NingRuo-code/Ocean/issues/127) | [保存并保护案例后按原版本重新打开](02-protected-case-save-reopen.md) | [#126](https://github.com/NingRuo-code/Ocean/issues/126)、[#120](https://github.com/NingRuo-code/Ocean/issues/120) | 本人将选定结果保存为受保护的案例，刷新或重开后仍读到原条件与证据；保存失败不会出现假成功或重复案例。 |
| R03 / [#128](https://github.com/NingRuo-code/Ocean/issues/128) | [检索案例并以新版本修改笔记和关联结果](03-case-version-notes-search.md) | [#127](https://github.com/NingRuo-code/Ocean/issues/127) | 本人按标题、标签、类型和时间查找案例，修改笔记或关联新结果时生成明确新版本，旧版本仍可读取且并发修改不会静默覆盖。 |
| R04 / [#129](https://github.com/NingRuo-code/Ocean/issues/129) | [从冻结上下文导出地图和图表PNG](04-frozen-map-png.md) | [#127](https://github.com/NingRuo-code/Ocean/issues/127) | 本人从已保存版本下载地图/图表PNG，图中位置、日期、圆域、单位、色标和来源对应该结果，不混入正在变化的首页。 |
| R05 / [#130](https://github.com/NingRuo-code/Ocean/issues/130) | [下载带单位和缺失状态的聚合CSV](05-aggregate-csv.md) | [#127](https://github.com/NingRuo-code/Ocean/issues/127) | 本人下载与报告同源的聚合汇总CSV，能在表格工具中核对单位、数值和缺失状态，并定位原结果版本。 |
| R06 / [#131](https://github.com/NingRuo-code/Ocean/issues/131) | [生成可下载的同源中文PDF报告](06-actual-pdf.md) | [#129](https://github.com/NingRuo-code/Ocean/issues/129) | 本人从已保存版本预览并下载真实PDF，包含同源地图/图表、关键表、来源和局限，生成失败有清楚状态。 |
| R07 / [#132](https://github.com/NingRuo-code/Ocean/issues/132) | [长表和多页报告保持清晰可读](07-long-report-layout.md) | [#131](https://github.com/NingRuo-code/Ocean/issues/131) | 本人导出长标题、长表和多页研究报告时，中文、表头、图例、图注及必要限制仍完整可读，不被裁切或错配。 |
| R08 / [#133](https://github.com/NingRuo-code/Ocean/issues/133) | [导出任务可查询取消重试且版本不串用](08-export-task-control.md) | [#131](https://github.com/NingRuo-code/Ocean/issues/131)、[#101](https://github.com/NingRuo-code/Ocean/issues/101)、[#102](https://github.com/NingRuo-code/Ocean/issues/102) | 本人提交耗时PDF或成果包生成后可继续地图操作，查看真实状态、取消或明确重试；旧任务和失败不会覆盖新版本文件。 |
| R09 / [#134](https://github.com/NingRuo-code/Ocean/issues/134) | [交付真实A案例及PDF图片表格成果包](09-real-month-case-package.md) | [#128](https://github.com/NingRuo-code/Ocean/issues/128)、[#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#132](https://github.com/NingRuo-code/Ocean/issues/132)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 本人从真实合格整月A结果保存案例、重开版本并下载PDF、PNG、CSV及带清单成果包，所有内容与原证据可核对；无需等待B/C。 |
| R10 / [#135](https://github.com/NingRuo-code/Ocean/issues/135) | [接入真实B事件案例和分窗口报告](10-event-case-report.md) | [#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#132](https://github.com/NingRuo-code/Ocean/issues/132)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)、[#84](https://github.com/NingRuo-code/Ocean/issues/84) | 本人保存真实B结果，并在预览、PDF、PNG、CSV及单类成果包中读到一致的事件窗口、对照和证据，不依赖A报告实证票先完成。 |
| R11 / [#136](https://github.com/NingRuo-code/Ocean/issues/136) | [接入真实C比较案例并保留全部候选与理由](11-regional-comparison-case-report.md) | [#130](https://github.com/NingRuo-code/Ocean/issues/130)、[#132](https://github.com/NingRuo-code/Ocean/issues/132)、[#133](https://github.com/NingRuo-code/Ocean/issues/133)、[#94](https://github.com/NingRuo-code/Ocean/issues/94) | 本人保存真实C比较结果，在预览和各格式中查看A/B分板、候选顺序、兼容理由、描述差值和缺口；组合私人来源不会泄露。 |
| R12 / [#137](https://github.com/NingRuo-code/Ocean/issues/137) | [选择A/B/C章节形成可追溯组合成果包](12-selected-chapters-combined-package.md) | [#134](https://github.com/NingRuo-code/Ocean/issues/134)、[#135](https://github.com/NingRuo-code/Ocean/issues/135)、[#136](https://github.com/NingRuo-code/Ocean/issues/136) | 本人按目的选择已有A/B/C章节与详细程度，预览并下载带完整文件/版本清单的组合包；条件不同的结果分别成章，不混成新统计结论。 |
| R13 / [#138](https://github.com/NingRuo-code/Ocean/issues/138) | [按导出用途投影字段并核对文件元信息](13-audience-specific-export.md) | [#134](https://github.com/NingRuo-code/Ocean/issues/134)、[#136](https://github.com/NingRuo-code/Ocean/issues/136) | 本人明确选择内部受控或允许对外分享用途时，得到对应合法内容的导出；许可不支持就拒绝或说明合法部分，私人案例不会自动公开。 |
| R14 / [#139](https://github.com/NingRuo-code/Ocean/issues/139) | [案例及报告保存与真实清理保持一致](14-real-protection-cleanup-integration.md) | [#133](https://github.com/NingRuo-code/Ocean/issues/133)、[#122](https://github.com/NingRuo-code/Ocean/issues/122) | 实际普通产物清理与保存/导出同时发生时，案例、最终报告和共享依赖保持可读；失败或资料不足有准确状态，不出现缺文件的保存成功。 |
| R15 / [#140](https://github.com/NingRuo-code/Ocean/issues/140) | [回放真实成果导出并交接后续研究与AI](15-real-report-delivery-handoff.md) | [#137](https://github.com/NingRuo-code/Ocean/issues/137)、[#138](https://github.com/NingRuo-code/Ocean/issues/138)、[#139](https://github.com/NingRuo-code/Ocean/issues/139) | 负责人获得可重开的真实案例、同源PDF/图片/表格成果包和真实保护联动证据，明确研究消费、视觉质量、权限及上线状态，后续模块可复用成果合同。 |

共15项、93条验收条件、35条直接阻塞（内部26条、外部9条），覆盖规格全部50条用户故事。本批与已有93项已发布本地任务记录合并检查无循环，且未重复列入直接前置已经包含的祖先；实际远端外部祖先与本批依赖已合并检查无循环，35条原生阻塞已逐项设置并回读，与各正文直接前置一致。

推进分工及真实边界：

1. R01等#30详情/历史框架与#69已有A阅读包，先用合法已知结果完成真实服务预览，不需要A/#71真实月最终交接。旧报告会重算旧窗口，故只能复用排版模式，不把旧接口改标签当同源研究报告；必要适配随本切片完成，无独立横向重构票。
2. R02再消费#120及其#119祖先，实现正式保存、持久保护和重开，R03扩展版本/检索/笔记。权限/保护从这些入口和每个导出开始具备，不拖到最后；未具备真实保护时不能称保存成功。
3. R04冻结地图/图表并交付PNG，R05独立交付聚合CSV，两支都从R02开始。R06消费R04图片生成真实PDF，R07扩展复杂分页/长表；R08另消费#101/#102扩展实际导出取消重试和身份隔离。它们各有自身实际文件/操作验收，不是把API/UI/测试拆成横向层。
4. R09汇合案例版本、CSV、复杂PDF和任务操作，再消费#71真实A交接，交付A系统内保存/预览/各格式及最小单类成果包；A-only成果包不等待R12或B/C。R10/R11直接消费通用格式/操作和#84/#94交接，不依赖R09的A报告实证，也不让C报告等待B报告界面。
5. R12才扩展多结果选章/顺序/详细程度及组合包，保留被选结论来源/支持/局限，不生成新统计。R13在基本权限既有的前提下，增加明确内部/对外用途投影、许可变化/缓存隔离和跨文件元信息核对，绝非先无授权导出再补安全。
6. R14从R08及#122即可验证真实REPORT保存/导出与清理竞争，不等待全部A/B/C真实报告。它在R02基本一致性基础上补真实清理集成、共享引用/失败与容量拒绝；不会回改#120/#122令其反向等待REPORT。
7. R15汇合组合、用途投影及真实清理联动，回放真实A/B/C与文件质量/权限，交接G3/预测/AI后续合同；每项自身测试不留到最终票，真实研究、合法样例、合成排版故障、功能/PR/部署分别留证。

外部直接前置只有#30/#69、#120、#101/#102、#71/#84/#94和#122。#119由#120包含；#81/#92及P0来源/资格/许可沿#84/#94等交接链消费，不重复加祖先。完整W/#108、TASK/#124、全部P1、AI/预测不是统一阻塞。当前本批无零前置项，最早R01等#30和#69；全项目按既有GitHub真实状态推进，不假设计划已实现。

分享以下载符合用途的成果包为主，不自动公开、上传或发送。PDF/PNG/CSV实际生成与独立数值/视觉核对分别记录；保护清理/故障只在隔离合法材料验证，不碰生产/真实私有源。源不可得、旧文件仍可读与原样复算分开，不保证永久保留全部输入。

用户已确认15项任务粒度与直接阻塞，本轮已按依赖顺序发布ready-for-agent并设置原生阻塞；#125/#13/#20/#21及受检A/B/C、W、TASK规格/交接/保护任务的正文、评论、状态和标签保持不变。

发布核验：15项正文、ready-for-agent标签及35条原生阻塞已逐项回读一致，父级/源规格/交接及TASK保护均未修改。当前可开始：本批暂无无阻塞项；最早R01的未完成直接前置为#30、#69，实际领取以GitHub实时状态为准。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-report-ticket-publication-2026-10-24.json)。
