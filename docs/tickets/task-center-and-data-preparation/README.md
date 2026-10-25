# TASK 公共任务中心任务与进度入口

日期：2026-10-24。来源：[规格 #109](https://github.com/NingRuo-code/Ocean/issues/109)，关联W #95/#21、执行总纲#13。用户已确认粒度与直接阻塞，15项已发布为#110–#124，均标记ready-for-agent；T01–T15保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表实现、真实恢复/准备、生产准入、合并或部署完成。

已通过GitHub CLI读取#109完整正文和评论，并核对W/#99–#102、P0及P1相关前置；#109与本地规格正文一致，所读项均开放且暂无评论，发布前未发现重复TASK执行票；本轮仅发布并核验任务及原生阻塞，没有实施应用、执行真实恢复/准备/清理或修改既有任务。既有W是已发布职责，不等于实际实现；本批增量复用，不让W最小任务反向等待TASK。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| T01 / [#110](https://github.com/NingRuo-code/Ocean/issues/110) | [在工作台查找原身份的任务历史](01-shared-task-history.md) | [#100](https://github.com/NingRuo-code/Ocean/issues/100) | 本人从工作台呼出可分页筛选的任务历史，查看原条件、状态、尝试和已有结果；关闭详情可继续地图，读取不重跑。 |
| T02 / [#111](https://github.com/NingRuo-code/Ocean/issues/111) | [选择登记归档并核对可执行准备范围](02-registered-preparation-plan.md) | [#99](https://github.com/NingRuo-code/Ocean/issues/99) | 本人在工作台选择系统登记的日期、地域、资料层和用途，得到可读准备计划、复用范围和缺少的前置；预览不取数。 |
| T03 / [#112](https://github.com/NingRuo-code/Ocean/issues/112) | [一键准备一个真实小范围资料单元](03-real-small-preparation.md) | [#111](https://github.com/NingRuo-code/Ocean/issues/111) | 本人明确提交已登记的真实小范围资料，经实际提取或加工、校验及版本登记，在浏览器看到具体就绪范围；准备完成不自动分析。 |
| T04 / [#113](https://github.com/NingRuo-code/Ocean/issues/113) | [后台任务按资源排队并显示真实步骤进度](04-bounded-queue-and-progress.md) | [#112](https://github.com/NingRuo-code/Ocean/issues/112)、[#47](https://github.com/NingRuo-code/Ocean/issues/47) | 本人连续提交小范围任务时，系统按有据限额执行，其余显示等待原因；可见真实阶段和已完成单元，地图轻量操作保持可用。 |
| T05 / [#114](https://github.com/NingRuo-code/Ocean/issues/114) | [重启后从可靠检查点继续原任务](05-checkpoint-safe-resume.md) | [#113](https://github.com/NingRuo-code/Ocean/issues/113)、[#100](https://github.com/NingRuo-code/Ocean/issues/100) | 真实业务执行进程重启后，已受理任务核对检查点并自动继续安全的未完成步骤；本人看到恢复起点与原条件，已完成步骤不重复。 |
| T06 / [#115](https://github.com/NingRuo-code/Ocean/issues/115) | [恢复时识别已提交结果并拒绝旧进程写入](06-commit-reconciliation-and-stale-worker.md) | [#114](https://github.com/NingRuo-code/Ocean/issues/114) | 进程在发布结果与回写完成状态之间出故障时，恢复后仍识别已有成果；旧执行者迟到提交不会覆盖权威结果或重复发布。 |
| T07 / [#116](https://github.com/NingRuo-code/Ocean/issues/116) | [不安全恢复明确中断并按原记录重试](07-unsafe-recovery-and-explicit-retry.md) | [#114](https://github.com/NingRuo-code/Ocean/issues/114)、[#102](https://github.com/NingRuo-code/Ocean/issues/102) | 源、方法、授权或检查点不再满足恢复条件时，任务明确中断；本人可看到原因并按既有合同重试或提交新版本，不发生静默换源。 |
| T08 / [#117](https://github.com/NingRuo-code/Ocean/issues/117) | [取消意图跨重启保留且不与恢复竞争](08-cancel-resume-races.md) | [#114](https://github.com/NingRuo-code/Ocean/issues/114)、[#101](https://github.com/NingRuo-code/Ocean/issues/101) | 本人已提交取消的任务在重启后不会重新运行；取消与发布竞争按真实终态解释，保留已有效发布的成果。 |
| T09 / [#118](https://github.com/NingRuo-code/Ocean/issues/118) | [多日多层准备保留缺口并正确发布就绪范围](09-partial-preparation-and-qualification.md) | [#113](https://github.com/NingRuo-code/Ocean/issues/113) | 本人准备一段日期和多个资料层时，逐项看到已验证、缺测、失败和未准备；只发布真实就绪子集，并说明是否满足分析用途。 |
| T10 / [#119](https://github.com/NingRuo-code/Ocean/issues/119) | [保留轻量证据并说明大产物与复算状态](10-lightweight-evidence-and-artifact-status.md) | [#110](https://github.com/NingRuo-code/Ocean/issues/110)、[#112](https://github.com/NingRuo-code/Ocean/issues/112) | 本人从历史任务仍可理解原条件、版本、结果或失败原因，并清楚看到大文件、源资料及原样复算是否可用。 |
| T11 / [#120](https://github.com/NingRuo-code/Ocean/issues/120) | [保护已保存成果及活动共享引用](11-persistent-protection-and-use-references.md) | [#119](https://github.com/NingRuo-code/Ocean/issues/119) | 本人可保护指定成果，任务运行及共享引用也会自动保护所需产物；保护记录持久，未知引用时保持不删除。 |
| T12 / [#121](https://github.com/NingRuo-code/Ocean/issues/121) | [并发准备复用同版本产物且不互相破坏](12-shared-preparation-reuse.md) | [#118](https://github.com/NingRuo-code/Ocean/issues/118)、[#115](https://github.com/NingRuo-code/Ocean/issues/115)、[#120](https://github.com/NingRuo-code/Ocean/issues/120) | 多个准备任务请求相同资料时，可复用已校验的同版本单元；取消一个或旧进程迟到，不会覆盖、删掉其他任务的有效输入。 |
| T13 / [#122](https://github.com/NingRuo-code/Ocean/issues/122) | [按保护规则清理普通大产物并保留复算说明](13-protected-artifact-cleanup.md) | [#120](https://github.com/NingRuo-code/Ocean/issues/120) | 本人看到普通大产物的清理候选、理由及预计释放量；策略执行只删除允许内容，历史轻量证据和保护成果仍可读，并说明复算限制。 |
| T14 / [#123](https://github.com/NingRuo-code/Ocean/issues/123) | [据混合负载实测冻结任务与保存限额](14-measured-resource-and-retention-limits.md) | [#121](https://github.com/NingRuo-code/Ocean/issues/121)、[#122](https://github.com/NingRuo-code/Ocean/issues/122)、[#53](https://github.com/NingRuo-code/Ocean/issues/53) | 负责人得到任务并发、准备范围、磁盘/暂存及保留规则的实测限制和未验证范围，能让配置生效而不盲目扩容或损坏地图可用性。 |
| T15 / [#124](https://github.com/NingRuo-code/Ocean/issues/124) | [回放真实恢复准备与保护保存并交接](15-real-task-lifecycle-handoff.md) | [#116](https://github.com/NingRuo-code/Ocean/issues/116)、[#117](https://github.com/NingRuo-code/Ocean/issues/117)、[#121](https://github.com/NingRuo-code/Ocean/issues/121)、[#122](https://github.com/NingRuo-code/Ocean/issues/122) | 负责人获得可重新操作的任务历史、真实续跑/中断、真实归档就绪与保护清理证据，知道功能和生产容量分别完成到哪里，后续REPORT/AI可复用合同。 |

共15项、95条验收条件、27条直接阻塞（内部20条，外部7条），覆盖规格全部50条用户故事。本批及既有78项已发布本地任务记录合并检查无循环，并检查未重复列入直接阻塞的祖先；实际远端外部祖先与本批依赖已合并检查无循环，27条原生阻塞已逐项设置并回读，与正文直接前置一致。

推进分工与边界：

1. T01等待#100，扩展任务历史/分页与原条件读取；T02只等待#99，可先交付登记归档的真实准备计划。两支独立，准备不必等完整历史界面；P0来源/版本/支持合同已由#99→#70及其祖先承接，不重复将#36/#41/#43列直接阻塞。
2. T03在小范围真实资料完成第一条准备流程，先有实际提取/加工、校验、发布和可读状态，不拆成孤立schema/API/UI。T04再结合#47盘点扩展有界排队/进度；框架和小样本不等整套P1。
3. T05在T04及#100中断查询基础上实现至少一类真实安全续跑，基本所有权与拒绝不安全恢复随它交付。T06处理提交后回写前与旧进程迟到提交；T07消费#102扩展不安全恢复及明确重试；T08消费#101扩展取消跨重启竞争。这三项相互无硬阻塞，各自有真实故障验证，不把正确性全部留到最终票。
4. T09从T04独立扩展多日多层、部分发布和P0用途状态，不等待全部恢复边界。T10汇合历史T01和真实准备T03做轻量证据/产物状态；T11先建立持久活动/共享/主动保存保护合同，不等待完整REPORT或大规模归档。
5. T12汇合多单元T09、提交竞争T06及保护T11，完成并发同版本准备复用。T13从T11即可验证普通大产物保护清理，不强等T12或P1容量；它不删除P1缓存/源资料，也不重新实现#50缓存淘汰。
6. T14才消费#53实际容量/混合负载及T12/T13真实增量，冻结生产并发、暂存/保留字节和拒绝规则。#53已包含#47/#50，故不重复加这些祖先边。缺现服证据只交受控测量/缺项，不能伪称生产准入。
7. T15汇合T07/T08/T12/T13，回放核心功能与实际故障并交接REPORT/AI合同，不等待T14生产参数结论；T14和T15可分别验收，整个TASK规格仍需实际要求全部满足才能建议完整通过。每项自身测试不拖到最后。

当前本批无零前置任务：最早T02等待#99，T01等待#100。全项目应先按既有GitHub实际阻塞推进W、P0和P1，而非假设已规划能力可直接调用。没有给完整W/#108、REPORT、AI或全部A/B/C研究增加统一TASK前置；不会回改任何父级或既有任务制造循环。

真实进程终止/重启、归档准备与实际清理只在隔离合法材料验证；普通历史读取、筛选与准备完成均不隐式研究/AI。功能、真实资料/研究资格、生产容量、PR/用户合并/部署分账；单层准备不证明整月/事件联合支持，保存快照不保证源永久可复算。

用户已确认15项任务粒度与直接阻塞，本轮已按依赖顺序发布ready-for-agent并设置原生阻塞；#109/#95/#21/#13、W/#99–#102及P0/P1规格#35/#45的正文、评论、状态和标签均保持不变。

发布核验：15项正文、ready-for-agent标签及27条原生阻塞已逐项回读一致，父级/源规格及W最小任务均未修改。当前可开始：本批暂无无阻塞项；最早T02等待#99，T01等待#100，实际领取以GitHub实时状态为准。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-task-ticket-publication-2026-10-24.json)。
