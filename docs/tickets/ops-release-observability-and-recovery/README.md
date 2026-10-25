# OPS 发布、监测与备份恢复任务及进度入口

日期：2026-10-24。来源：[规格 #226](https://github.com/NingRuo-code/Ocean/issues/226)，关联#13及既有服务器交付#10/#11/#12。状态：用户已确认粒度与真实直接前置，25项已发布为#227–#251，均标记ready-for-agent；O01–O25保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表功能实现、合并、部署或真实验收完成。本轮未访问私有生产、部署、备份恢复、清理或调用模型。

发布前通过GitHub CLI读取#226完整正文和评论及相关源任务，正文与本地规格一致；当时未见已有OPS执行票，所读项开放且暂无评论。既有脚本/本地done与远端进度分别保留，不因发布了规划就认定服务或真实资料已完成。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| O01 / [#227](https://github.com/NingRuo-code/Ocean/issues/227) | [从固定发布包启动隔离地图与已知查询](01-isolated-release-query.md) | 无，可开始 | 维护者从可核对的固定版本发布包，在独立环境启动原前端和API，用浏览器读取合法已知地图/查询并核实际运行身份。 |
| O02 / [#228](https://github.com/NingRuo-code/Ocean/issues/228) | [按实际目标清单核对候选发布准入](02-target-admission-preflight.md) | [#227](https://github.com/NingRuo-code/Ocean/issues/227)、[#47](https://github.com/NingRuo-code/Ocean/issues/47) | 维护者对登记目标运行发布预检，得到兼容、权限、存储及资源条件的具体通过或拒绝原因，未知现服条件不会被当作准入通过。 |
| O03 / [#229](https://github.com/NingRuo-code/Ocean/issues/229) | [经实际入口隔离公开读取与本人私有操作](03-private-ingress-and-cache.md) | [#227](https://github.com/NingRuo-code/Ocean/issues/227)、[#99](https://github.com/NingRuo-code/Ocean/issues/99) | 访客可读允许的公开地图，本人通过受控通道访问原任务；实际代理、缓存和文件路由不能泄漏私有内容或放行旧维护接口。 |
| O04 / [#230](https://github.com/NingRuo-code/Ocean/issues/230) | [切换兼容发布并处理旧页面与资产缓存](04-compatible-release-activation.md) | [#228](https://github.com/NingRuo-code/Ocean/issues/228)、[#229](https://github.com/NingRuo-code/Ocean/issues/229) | 维护者在隔离环境激活一套完整兼容发布，使用者读取实际新版本；旧标签页或旧缓存不悄悄按新合同重放请求。 |
| O05 / [#231](https://github.com/NingRuo-code/Ocean/issues/231) | [发布时保留任务并拒绝旧执行者提交](05-task-aware-upgrade.md) | [#230](https://github.com/NingRuo-code/Ocean/issues/230)、[#115](https://github.com/NingRuo-code/Ocean/issues/115)、[#117](https://github.com/NingRuo-code/Ocean/issues/117) | 维护者切换服务时可限制新重任务并处理在途工作；本人看到原任务安全继续或准确中断，旧执行者不能改写结果。 |
| O06 / [#232](https://github.com/NingRuo-code/Ocean/issues/232) | [失败后回退兼容发布且保留新旧成果](06-compatible-release-rollback.md) | [#231](https://github.com/NingRuo-code/Ocean/issues/231)、[#116](https://github.com/NingRuo-code/Ocean/issues/116) | 维护者可实际回退兼容代码/配置，遇不可逆状态变更会拒绝错误降版；本人仍能读取原任务、结果和报告。 |
| O07 / [#233](https://github.com/NingRuo-code/Ocean/issues/233) | [按层查看服务和资料真实就绪状态](07-lightweight-operational-status.md) | [#227](https://github.com/NingRuo-code/Ocean/issues/227) | 维护者通过既有受控状态入口区分存活、业务就绪、资料日期和未知；使用者只看到必要短提示，监测不触发采集或模型。 |
| O08 / [#234](https://github.com/NingRuo-code/Ocean/issues/234) | [对真实故障生成有界且可恢复的告警](08-actionable-deduplicated-alerts.md) | [#233](https://github.com/NingRuo-code/Ocean/issues/233)、[#229](https://github.com/NingRuo-code/Ocean/issues/229)、[#113](https://github.com/NingRuo-code/Ocean/issues/113) | 维护者看到服务失败、任务停滞或资源异常的具体原因和最近成功时间，确认及恢复状态清楚，不被重复告警淹没。 |
| O09 / [#235](https://github.com/NingRuo-code/Ocean/issues/235) | [更新合法资料后保持旧资格与结果版本](09-versioned-data-maintenance.md) | [#229](https://github.com/NingRuo-code/Ocean/issues/229)、[#118](https://github.com/NingRuo-code/Ocean/issues/118)、[#50](https://github.com/NingRuo-code/Ocean/issues/50) | 本人明确准备或执行登记维护范围后，看到真实就绪子集与新版本；旧任务、结果和缓存不会被悄悄换源。 |
| O10 / [#236](https://github.com/NingRuo-code/Ocean/issues/236) | [按权威引用预览可恢复范围与缺口](10-recoverable-scope-plan.md) | [#229](https://github.com/NingRuo-code/Ocean/issues/229)、[#120](https://github.com/NingRuo-code/Ocean/issues/120) | 本人选择备份范围时能看到真实权威状态、受保护依赖、重建项和缺口，不会误以为只备份PDF或一个目录即可恢复全部系统。 |
| O11 / [#237](https://github.com/NingRuo-code/Ocean/issues/237) | [实际生成一致备份并保留上一可用副本](11-consistent-backup-commit.md) | [#236](https://github.com/NingRuo-code/Ocean/issues/236) | 本人明确备份已登记小范围状态与合法文件，获得可校验的完成副本；中断或空间不足不会覆盖上一份有效恢复点。 |
| O12 / [#238](https://github.com/NingRuo-code/Ocean/issues/238) | [在空白隔离环境恢复原任务和合法文件](12-blank-environment-restore.md) | [#237](https://github.com/NingRuo-code/Ocean/issues/237) | 维护者实际从备份恢复固定发布与基础状态，浏览器能重开原任务、证据和文件；恢复环境默认不自动执行或对外发送。 |
| O13 / [#239](https://github.com/NingRuo-code/Ocean/issues/239) | [取回独立副本并恢复真实A案例成果](13-independent-copy-real-case.md) | [#238](https://github.com/NingRuo-code/Ocean/issues/238)、[#134](https://github.com/NingRuo-code/Ocean/issues/134) | 本人从与服务主机故障隔离的合法副本，实际恢复一份真实A案例及PDF/图片/表格，知道允许损失与恢复时间是否满足已定目标。 |
| O14 / [#240](https://github.com/NingRuo-code/Ocean/issues/240) | [清理备份候选时保护最后可用恢复链](14-backup-chain-retention.md) | [#237](https://github.com/NingRuo-code/Ocean/issues/237)、[#122](https://github.com/NingRuo-code/Ocean/issues/122) | 本人可预览和执行备份专属保留策略，普通清理不会删除最后可用恢复链或主动保护成果的唯一依赖。 |
| O15 / [#241](https://github.com/NingRuo-code/Ocean/issues/241) | [恢复后核撤权、科研接触和模型费用未知](15-restore-policy-reconciliation.md) | [#238](https://github.com/NingRuo-code/Ocean/issues/238)、[#181](https://github.com/NingRuo-code/Ocean/issues/181)、[#208](https://github.com/NingRuo-code/Ocean/issues/208) | 本人恢复旧状态后，已撤销授权不会复活、已接触目标不会变未见，模型请求不明会保守停用并给出对账原因。 |
| O16 / [#242](https://github.com/NingRuo-code/Ocean/issues/242) | [恢复后对账任务并隔离旧运行代际](16-restore-generation-and-tasks.md) | [#232](https://github.com/NingRuo-code/Ocean/issues/232)、[#238](https://github.com/NingRuo-code/Ocean/issues/238) | 维护者恢复完整状态后，旧进程迟到写入被拒，已完成或取消任务不重复执行；安全续跑与准确中断均能实际观察。 |
| O17 / [#243](https://github.com/NingRuo-code/Ocean/issues/243) | [备份恢复与真实报告及AI保护清理保持一致](17-protected-reports-and-ai-restore.md) | [#239](https://github.com/NingRuo-code/Ocean/issues/239)、[#240](https://github.com/NingRuo-code/Ocean/issues/240)、[#139](https://github.com/NingRuo-code/Ocean/issues/139)、[#223](https://github.com/NingRuo-code/Ocean/issues/223) | 本人保存的真实报告和AI注释在备份、恢复及清理并行时仍能按原版本重开，不出现只有成功记录却缺文件的成果。 |
| O18 / [#244](https://github.com/NingRuo-code/Ocean/issues/244) | [将真实A/B/C纳入候选发布与恢复范围](18-abc-release-and-restore-profile.md) | [#230](https://github.com/NingRuo-code/Ocean/issues/230)、[#238](https://github.com/NingRuo-code/Ocean/issues/238)、[#108](https://github.com/NingRuo-code/Ocean/issues/108)、[#140](https://github.com/NingRuo-code/Ocean/issues/140) | 维护者发布候选中，使用者能回放真实A/B/C任务与报告；备份恢复后仍是原条件、真实窗口及完整比较候选。 |
| O19 / [#245](https://github.com/NingRuo-code/Ocean/issues/245) | [整合真实G3复核与案例并保留接触边界](19-g3-release-and-restore-profile.md) | [#230](https://github.com/NingRuo-code/Ocean/issues/230)、[#238](https://github.com/NingRuo-code/Ocean/issues/238)、[#158](https://github.com/NingRuo-code/Ocean/issues/158)、[#175](https://github.com/NingRuo-code/Ocean/issues/175) | 候选发布中能读取或明确运行已登记G3复核/案例工具，恢复后原结果、检索范围、短窗断档与接触状态仍可核对。 |
| O20 / [#246](https://github.com/NingRuo-code/Ocean/issues/246) | [将真实局部预测纳入发布及恢复验证](20-prediction-release-and-restore-profile.md) | [#230](https://github.com/NingRuo-code/Ocean/issues/230)、[#238](https://github.com/NingRuo-code/Ocean/issues/238)、[#193](https://github.com/NingRuo-code/Ocean/issues/193) | 候选发布中可按原身份读取真实局部回测，备份恢复后模型、签发与评价引用不串用，尚未验证的空间扩展明确保留。 |
| O21 / [#247](https://github.com/NingRuo-code/Ocean/issues/247) | [整合真实AI模式并验证恢复后不重复发送](21-ai-release-and-restore-profile.md) | [#230](https://github.com/NingRuo-code/Ocean/issues/230)、[#241](https://github.com/NingRuo-code/Ocean/issues/241)、[#225](https://github.com/NingRuo-code/Ocean/issues/225) | 候选发布中本人能使用已验AI工具并重开会话；恢复后保留原解释/证据/预算状态，不自动续发模型或泄漏旧权限内容。 |
| O22 / [#248](https://github.com/NingRuo-code/Ocean/issues/248) | [按实际混合负载冻结OPS资源与备份限额](22-ops-resource-admission.md) | [#234](https://github.com/NingRuo-code/Ocean/issues/234)、[#235](https://github.com/NingRuo-code/Ocean/issues/235)、[#239](https://github.com/NingRuo-code/Ocean/issues/239)、[#240](https://github.com/NingRuo-code/Ocean/issues/240)、[#242](https://github.com/NingRuo-code/Ocean/issues/242)、[#123](https://github.com/NingRuo-code/Ocean/issues/123) | 负责人得到可生效的发布、维护、备份/恢复预算及未验证范围，能判断当前目标可接纳什么规模而非盲目购买服务器。 |
| O23 / [#249](https://github.com/NingRuo-code/Ocean/issues/249) | [按单独安排发布并验证真实A生产范围](23-first-production-release.md) | [#248](https://github.com/NingRuo-code/Ocean/issues/248)、[#103](https://github.com/NingRuo-code/Ocean/issues/103) | 在既有审核和另行部署安排下，真实服务器运行固定A发布范围，浏览器与入口能验证原结果/成果和权限，未安排时保留未部署状态。 |
| O24 / [#250](https://github.com/NingRuo-code/Ocean/issues/250) | [查看完整候选能力账并验证扩展恢复范围](24-full-candidate-delivery-ledger.md) | [#243](https://github.com/NingRuo-code/Ocean/issues/243)、[#244](https://github.com/NingRuo-code/Ocean/issues/244)、[#245](https://github.com/NingRuo-code/Ocean/issues/245)、[#246](https://github.com/NingRuo-code/Ocean/issues/246)、[#247](https://github.com/NingRuo-code/Ocean/issues/247)、[#248](https://github.com/NingRuo-code/Ocean/issues/248) | 维护者能按候选发布/工具/模式打开原成果、备份与恢复证据，明确实际可交付范围及未完成研究；扩展负载与恢复政策有新版依据。 |
| O25 / [#251](https://github.com/NingRuo-code/Ocean/issues/251) | [按实际声明范围完成生产OPS交付与跟进](25-full-production-ops-handoff.md) | [#249](https://github.com/NingRuo-code/Ocean/issues/249)、[#250](https://github.com/NingRuo-code/Ocean/issues/250) | 在另行安排的发布后，使用者能打开真实生产工具与原成果，负责人获得发布、监测、备份恢复和仍欠范围的统一交付记录。 |

共25项、150条验收条件、65条直接边（本批42、外部23）。覆盖64/64用户故事和72/72实施检查，与189项既有任务的本地发布记录合并核验无环、直接边无冗余；已通过GitHub CLI回读169项外部前置/祖先节点，与本批依赖合并核验无环、直接边无冗余；正式发布已再次回读最新祖先和状态，65条原生阻塞已逐项设置并核对。

O01无前置，可先从现有代码/脚本和合法已知只读小例完成固定发布包→独立代码/环境→真实浏览器/API，不等待新业务平台；默认回环隔离、外发和未保护写入禁用。O02只消费#47实际盘点作为预检输入，未知不当生产准入。O03消费#99实际本人权限，不另建账户；O04才汇合兼容版本切换。旧#10/#11/#12只复用材料/证据，不重复拆旧同步或把它们全关闭设为起步要求。

O05沿#115/#117做发布与在途任务交接，O06沿#116做兼容回退，不重新实现TASK。回退不覆盖旧数据库以删除新成果，早期仅已核兼容状态；整份持久状态恢复与代际/任务对账在O12/O16，不能把git切代码当灾难恢复。

O07从O01独立交付轻量状态，O08接#113真实阶段及O03权限做有界告警，O09接#118/P0与#50维护版本/缓存；不因监测自动准备归档或模型。O11后续备份输出可被已有通用状态/告警适配消费，各项未接入信号显示未知而不是绿灯。

O10消费#120（已包含#119）预览实际权威范围，O11备份、O12空白恢复先在合法已知任务/保护样例闭环。O13才消费#134真实A报告与实际独立副本取回，不把同机目录当独立故障保护；位置、许可、密钥/取回、真实成果或目标参数不具备时，保留真实关口未完成，不能用模板完成替代。

O14沿#122管理备份专属链/保留，O17再将#139实际报告和#223保存注释的保护清理接入，不重建清理器。O15消费#181（已传递G3#144/#145）与#208实际费用记录做恢复后当前政策/接触/费用对账；不等待整个AI#225才实现该保障。O12初期已默认未知受限，O15不是先不保护后补安全。

O18真实A/B/C、O19 G3复核/案例、O20预测局部和O21完整AI各自接原服务/结果及必要备份恢复适配。O20只等#193真实局部核心，不把#198全东海/空间关口统一阻塞OPS；未验扩展仍归原科研任务，不在OPS账中冒称完成。O18不等G3/预测/AI，O19不等预测，候选集成不因O23生产尚未安排而停。

O22消费#123及传递的P1容量，测首批A/维护/备份恢复增量并冻结可生效限制；后续扩展必须补差更新，不能套用首批准入。O23只等O22和#103真实A，可单独准备可审查发布方案并在实际另行安排下验证现服；未安排时保持未部署，发布规格/任务从未等于授权生产切换。

O24汇合保护、各扩展和容量，提供可操作候选能力/恢复账，补实际声明范围的资源与独立恢复核查。O25才汇合O23现服路径与O24完整候选，在后续安排中验实际生产范围。PRED仅局部就写局部，新类型完整报告/近期预报和采购等未完成范围继续可见；OPS交付不自动关闭全科研。

每项是实际操作→原服务/浏览器→可观察结果/文件的完整窄切片，自带独立期望和异常检查，非schema/API/测试/文档横层票。未发现必须先做的广泛机械重构，必要本地适配随首个消费切片做。所有破坏/清理/容量演练仅隔离合法材料，生产另安排；真实、合成、语言模型和生产证据分账。

完整拆分、用户确认与覆盖/依赖检查：[评审记录](draft-review.json)。用户已批准25项粒度和真实直接前置，本轮按依赖顺序创建ready-for-agent执行票与GitHub原生阻塞；后续按实际前置推进，未修改或关闭#226/#13及已有任务。

核查状态：25项正文、ready-for-agent标签及65条原生阻塞已逐项回读一致；#226/#13及受检来源规格/任务正文、评论、状态和标签保持不变。当前可领取状态：[#227：从固定发布包启动隔离地图与已知查询](https://github.com/NingRuo-code/Ocean/issues/227)。实际进度以GitHub实时状态为准。本轮仅发布规划，尚未开始实施。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-ops-ticket-publication-2026-10-24.json)。
