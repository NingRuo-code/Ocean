# G3 相似案例与辅助匹配任务与进度入口

2026-10-26实施接续：S01/#160完成自建合成探索目录→工作台少量候选→只读原A证据软件验收，见[交付与当前不足](../../reports/ocean-known-case-search-implementation-2026-10-26.md)。这是16项中首个软件切片，真实目录、季节/环境、B响应、定位/短窗与正式隔离尚未完成，合并/关闭以GitHub为准。下文“发布时状态”保留历史，不代表当前前置状态。

日期：2026-10-24。来源：[规格 #159](https://github.com/NingRuo-code/Ocean/issues/159)，归属总体规划G3/T及#13。用户已确认粒度与直接阻塞，16项已发布为#160–#175，均标记ready-for-agent；S01–S16保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表功能实现、真实检索、匹配质量核查、合并或部署完成。

已通过GitHub CLI读取#159完整正文和评论及相关实际前置，远端正文与本地规格一致，所读源任务无评论；发布前候选列表未发现重复的相似检索/辅助匹配任务；本轮只发布并核对正文、标签和原生阻塞，没有运行研究检索或真实匹配。已发布合同不代表实现/真实资料已就绪。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| S01 / [#160](https://github.com/NingRuo-code/Ocean/issues/160) | [从工作台检索并展开合法已知历史案例](01-known-case-search.md) | [#97](https://github.com/NingRuo-code/Ocean/issues/97) | 使用者在现有工作台沿已应用条件发起检索，经实际只读服务读取少量合法已知候选并展开证据，地图继续可操作。 |
| S02 / [#161](https://github.com/NingRuo-code/Ocean/issues/161) | [按真实支持和许可构建可检索候选目录](02-qualified-candidate-catalog.md) | [#160](https://github.com/NingRuo-code/Ocean/issues/160)、[#99](https://github.com/NingRuo-code/Ocean/issues/99) | 本人明确构建一个有界目录，使用者搜索时读到实际支持、来源和就绪状态，未准备或无响应资料不会被伪装成有效案例。 |
| S03 / [#162](https://github.com/NingRuo-code/Ocean/issues/162) | [按同海域季节精确筛选并稳定分页](03-seasonal-exact-search.md) | [#161](https://github.com/NingRuo-code/Ocean/issues/161) | 使用者得到同海域、相近季节的完整有界候选集合，跨年闰日和分页有明确规则，无结果只表示当前库中未找到。 |
| S04 / [#163](https://github.com/NingRuo-code/Ocean/issues/163) | [按有据环境特征解释相似与差异](04-environment-feature-reasons.md) | [#162](https://github.com/NingRuo-code/Ocean/issues/162) | 使用者选择已支持的环境特征，看到原值、差异和缺项构成的可解释检索顺序，后续响应好坏不会改变结果选择。 |
| S05 / [#164](https://github.com/NingRuo-code/Ocean/issues/164) | [使用事前活动特征并标明历史可知边界](05-preperiod-cutoff-features.md) | [#163](https://github.com/NingRuo-code/Ocean/issues/163)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 使用者按有真实支持的事前活动检索，能核对时间窗和H/E，并知道哪些历史响应只能作为后见的回顾性信息。 |
| S06 / [#165](https://github.com/NingRuo-code/Ocean/issues/165) | [展开原B响应并识别重复事件变体](06-real-event-evidence-reading.md) | [#162](https://github.com/NingRuo-code/Ocean/issues/162)、[#84](https://github.com/NingRuo-code/Ocean/issues/84) | 使用者展开历史候选，读取原B真实窗口、对照和响应证据，多个半径或保存版本不会被当作多个独立事件。 |
| S07 / [#166](https://github.com/NingRuo-code/Ocean/issues/166) | [并列A背景与B响应并说明不可比项](07-compatible-context-reading.md) | [#165](https://github.com/NingRuo-code/Ocean/issues/165)、[#87](https://github.com/NingRuo-code/Ocean/issues/87) | 使用者查看多个案例时，A月度背景和B事件响应分别呈现，单位、窗口或版本不兼容时看到原因，而非伪造差值。 |
| S08 / [#167](https://github.com/NingRuo-code/Ocean/issues/167) | [隔离验证保留资料并登记实际检索接触](08-protected-data-contact.md) | [#162](https://github.com/NingRuo-code/Ocean/issues/162)、[#145](https://github.com/NingRuo-code/Ocean/issues/145) | 正式检索使用已有G3分区/接触合同排除保留资料，搜索、详情和图示揭示目标时留下记录，不能靠换ID绕过保护。 |
| S09 / [#168](https://github.com/NingRuo-code/Ocean/issues/168) | [明确定位历史候选并保持原地图操作](09-explicit-case-map-location.md) | [#162](https://github.com/NingRuo-code/Ocean/issues/162)、[#107](https://github.com/NingRuo-code/Ocean/issues/107) | 使用者明确点击定位后才切换到案例真实日期和区域，阅读、检索或改草稿不会突然改变地图。 |
| S10 / [#169](https://github.com/NingRuo-code/Ocean/issues/169) | [短窗匹配遇到缺日或重置时明确分段](10-tracking-gap-segments.md) | [#99](https://github.com/NingRuo-code/Ocean/issues/99) | 本人明确运行已有短窗口匹配，在可读时间序列中看到缺观测、无对象及重新锚定形成的新段，不出现虚假的连续迁移。 |
| S11 / [#170](https://github.com/NingRuo-code/Ocean/issues/170) | [展示短窗匹配备选、代理依据与歧义](11-tracking-ambiguity-evidence.md) | [#169](https://github.com/NingRuo-code/Ocean/issues/169) | 使用者核对跨日候选时能看见距离、尺度代理和备选差异，难以确认的关系标为歧义，编号不被当长期身份。 |
| S12 / [#171](https://github.com/NingRuo-code/Ocean/issues/171) | [在案例地图中按段核对短窗候选关系](12-case-tracking-map-integration.md) | [#170](https://github.com/NingRuo-code/Ocean/issues/170)、[#168](https://github.com/NingRuo-code/Ocean/issues/168)、[#167](https://github.com/NingRuo-code/Ocean/issues/167) | 使用者从已有历史候选按需呼出辅助核对，在真实日期地图中看分段关系和歧义，关闭详情后继续原研究。 |
| S13 / [#172](https://github.com/NingRuo-code/Ocean/issues/172) | [库更新后复用正确检索并保留合法旧证据](13-versioned-query-artifacts.md) | [#162](https://github.com/NingRuo-code/Ocean/issues/162)、[#120](https://github.com/NingRuo-code/Ocean/issues/120) | 重复检索读取正确版本，候选库更新或中断不会串页；旧结果能说明资料是否仍可读、可复算及受到哪些保护。 |
| S14 / [#173](https://github.com/NingRuo-code/Ocean/issues/173) | [回放真实历史检索与不同案例响应证据](14-real-historical-retrieval.md) | [#164](https://github.com/NingRuo-code/Ocean/issues/164)、[#166](https://github.com/NingRuo-code/Ocean/issues/166)、[#167](https://github.com/NingRuo-code/Ocean/issues/167)、[#168](https://github.com/NingRuo-code/Ocean/issues/168)、[#172](https://github.com/NingRuo-code/Ocean/issues/172) | 负责人从真实浏览器检索合法历史候选、逐项阅读不同真实案例及B响应，核对选择依据、可知性、地图和证据一致。 |
| S15 / [#174](https://github.com/NingRuo-code/Ocean/issues/174) | [运行真实短窗并逐日核查匹配质量](15-real-short-window-review.md) | [#171](https://github.com/NingRuo-code/Ocean/issues/171) | 负责人对真实可访问的短窗观测逐日核对候选、分段和歧义，知道哪些关系有依据、哪些不能确定身份。 |
| S16 / [#175](https://github.com/NingRuo-code/Ocean/issues/175) | [交接真实检索与辅助匹配成果合同](16-retrieval-matching-handoff.md) | [#173](https://github.com/NingRuo-code/Ocean/issues/173)、[#174](https://github.com/NingRuo-code/Ocean/issues/174) | 负责人获得可复放的检索/短窗成果和分维进度，报告、AI与预测明确知道能读取什么，以及哪些结论尚不支持。 |

共16项、95条验收条件、30条直接边，本批21条、外部9条。覆盖50/50用户故事与59/59实施检查，与125项既有已发布任务的本地记录合并检查无环、无冗余直接边；远端原生祖先及实际状态已回读，30条原生阻塞已逐项设置并核对。

两条起步分支：S01在#97共享条件/阅读框架后开始；S10在#99本人真实受控执行后修正已有短窗断档。#99已经传递#97及P0#39/#43，不重复登记祖先边。本批不要求所有任务无阻塞，不以已有代码入口替代尚未交付的共享合同。

S02沿#99受控构建有界探索目录，普通搜索不加工原档；S03先交普通精确海域/季节检索，S04再加有据环境理由，S05消费#71合法逐日H/E接事前活动/历史截点。S06直接消费#84真实B阅读合同，不等待S05所有活动特征或B工作台完成；S07复用#87兼容规则，不等完整C/#94。

前期S01–S07仅对明确合法探索允许库开放，并实际核权限/只读边界。S08接入#145及其#144接触/分区合同后才检索正式受保护研究库；不能先开放任意资料再等最后补隔离。保留组未知、登记失败或服务不可用时不放行新目标，仅可回到经过核实的探索库。G3#158全部实证关闭不是本批前置。

S09独立复用#107完成普通候选明确定位，不把短窗匹配作为历史检索的前置。S10/S11交付短窗实际服务/最小浏览器阅读，S12再汇合S09地图及S08访问隔离；短窗真实核查S15不等待S14的真实B响应资料。S14真实历史检索也不等待S15；最后S16汇合交接两类成果。

S13复用#120及其#119轻量记录、活动共享引用/保护，补G3索引更新、分页身份和旧结果状态，不另建保存/清理平台。基本版本/权限从S01–S03就有，S13不承担补救此前串用或暴露私人资料。REPORT#128只做个人案例标题/版本检索，本批环境相似目录不复制其数据库。

每项是浏览器→实际服务/受控计算→可阅读候选/证据/图示的完整窄切片，自带独立期望和异常验证。最小适配随首个消费切片实施，不单开纯schema/样式/测试或宽泛重构任务。短窗仅必要辅助关联，F编号、启发式分数不代表长期身份或概率，不改变B固定区域事件。

S14必须真实查询并逐项阅读不同真实候选及可核B响应，S15必须真实连续观测短窗执行并独立逐日核查；合成边界分别补充，不能用复制案例、空文件或初始化断言代替。资料不足时对应真实关口保持未完成，允许无增强、反向、不确定或找不到案例，不预设好结果。

系统内新增类型完整报告、AI、预测和独立实证另验，不自动取源/准备归档/放宽范围或部署；不修改/关闭#159/#13及P0/A/B/C、W/TASK/REPORT/G3父级或任务。软件、真实资料/响应、匹配质量、PR、合并和部署分账。

已额外通过GitHub CLI回读本批所有外部前置及其55项原生祖先节点，合并本批依赖验证无环、直接边无冗余；#159正文、评论、状态与标签在拆分前后保持不变。正式发布已再次回读祖先和直接边；16项新任务与30条原生阻塞已创建，受检父级及既有来源任务保持不变。

完整拆分、用户确认及覆盖检查：[评审记录](draft-review.json)。用户已批准16项粒度和直接阻塞，本轮按依赖顺序发布ready-for-agent并设置原生阻塞；后续按真实前置领取，不修改或关闭父级。

发布核验：16项正文、ready-for-agent标签及30条原生阻塞均逐项回读一致，#159/#13及受检来源规格/任务的正文、评论、状态和标签保持不变。当前可领取状态：本批暂无无阻塞项；两条起步分支为[S01 / #160](https://github.com/NingRuo-code/Ocean/issues/160)等待#97；[S10 / #169](https://github.com/NingRuo-code/Ocean/issues/169)等待#99。实际进度以GitHub实时状态为准。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-g3-similar-ticket-publication-2026-10-24.json)。
