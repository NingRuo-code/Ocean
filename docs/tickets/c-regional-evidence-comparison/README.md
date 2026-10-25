# C 区域证据比较任务与进度入口

日期：2026-10-24。来源：[规格 #85](https://github.com/NingRuo-code/Ocean/issues/85)，归属 [C #20](https://github.com/NingRuo-code/Ocean/issues/20)。用户已确认粒度与阻塞，9项已发布为#86–#94，均标记ready-for-agent；C01–C09保留为评审编号，实际进度以对应GitHub Issue为准。发布不代表实现、真实比较关口、合并或部署完成。

已通过GitHub CLI读取#85/#20完整正文及评论，及#71/#84/#70/#41/#21的相关约定；核对时均开放且暂无评论。#85与本地规格正文一致，发布前未发现重复C子任务。本轮发布已确认任务及原生阻塞、同步本地记录，未修改应用、运行真实区域比较或更改父级。

| 编号 | 标题与完整验收条件 | 真正前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| C01 / [#86](https://github.com/NingRuo-code/Ocean/issues/86) | [运行两区域已知快照的比较样例](01-two-region-sample.md) | 无，可开始 | 使用者显式提交两个不同固定区域及共同条件，读取合法已知快照并得到可读并列表、原条件和来源身份；作为后续比较规则与A/B实际消费共同扩展的最小完整流程。 |
| C02 / [#87](https://github.com/NingRuo-code/Ocean/issues/87) | [逐指标和区域对判断可比性并保留部分结果](02-comparability-partial-results.md) | [#86](https://github.com/NingRuo-code/Ocean/issues/86) | 使用者在每个区域/指标及区域对看到可比较、受限并列、不可比或未就绪的原因；第三个区域缺资料时，另外两个合格区域仍能比较，缺口不被删除或填成零。 |
| C03 / [#88](https://github.com/NingRuo-code/Ocean/issues/88) | [消费A交接结果形成同月区域证据板](03-monthly-evidence-board.md) | [#87](https://github.com/NingRuo-code/Ocean/issues/87)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 研究者读取不同区域已就绪的A月度结果，在同一年月/公里范围及兼容规则下并列活动、距离带/侧别、支持及已有区间，并能展开每项来源和限制；无需等待B事件比较。 |
| C04 / [#89](https://github.com/NingRuo-code/Ocean/issues/89) | [消费B交接结果形成分窗口区域事件证据板](04-event-evidence-board.md) | [#87](https://github.com/NingRuo-code/Ocean/issues/87)、[#84](https://github.com/NingRuo-code/Ocean/issues/84) | 研究者在同一搜索期和事件/窗口定义下并列各区域B响应、对照质量、实际事件样本与区间，清楚知道哪些后7或对照证据缺失，不把相对日一致当同日成对事件。 |
| C05 / [#90](https://github.com/NingRuo-code/Ocean/issues/90) | [显式限定月度支持并给出描述差值](05-monthly-support-derived-contrast.md) | [#88](https://github.com/NingRuo-code/Ocean/issues/88) | 研究者明确选择共同日期/分组政策后，复用A已有可加基础量取得带新身份的限定支持结果，计算口径一致的区域甲减乙；不具备合法基础量时返回重算前置。 |
| C06 / [#91](https://github.com/NingRuo-code/Ocean/issues/91) | [按已登记事件队列并列描述差异](06-event-cohort-derived-contrast.md) | [#89](https://github.com/NingRuo-code/Ocean/issues/89) | 研究者在已有B合同支持下明确限定事件队列或窗口政策，得到可追溯的衍生事件摘要与描述差值；没有事件对应、细量或合格对照时只保留受限并列及所需B前置。 |
| C07 / [#92](https://github.com/NingRuo-code/Ocean/issues/92) | [呈现同标尺比较图与同源证据包](07-comparison-reading-pack.md) | [#90](https://github.com/NingRuo-code/Ocean/issues/90)、[#91](https://github.com/NingRuo-code/Ocean/issues/91) | 使用者读取一个比较快照时，先看到候选并列表、同单位主图和简短差异/不足，再展开A/B分板、支持及来源；允许导出的聚合成果与显示一致且没有隐含排名。 |
| C08 / [#93](https://github.com/NingRuo-code/Ocean/issues/93) | [比较版本隔离与逐源权限一致的结果复用](08-comparison-reuse-access.md) | [#87](https://github.com/NingRuo-code/Ocean/issues/87)、[#70](https://github.com/NingRuo-code/Ocean/issues/70) | 使用者重复读取同一比较时复用正确快照，改候选/条件/源或规则后不会串用旧结果；访客只能读取每个来源都允许公开的就绪内容，读取不触发隐藏分析。 |
| C09 / [#94](https://github.com/NingRuo-code/Ocean/issues/94) | [复算真实多区域A/B比较并交接工作台](09-real-regional-replay-handoff.md) | [#92](https://github.com/NingRuo-code/Ocean/issues/92)、[#93](https://github.com/NingRuo-code/Ocean/issues/93) | 项目负责人拿到至少两个不同真实区域的同条件比较，A月度板与B事件板分别有合格可比实例，并能复核直接组合、复用、图表和证据；工作台得到稳定结果合同。 |

共9项、64条验收条件、13条直接阻塞边：本批内部10条，外部3条。13条GitHub原生阻塞已逐项设置并回读，与正文前置引用一致。外部为C03←A/#71、C04←B/#84、C08←A/#70；P0 #41/#43/#44、A真实参照和B窗口/对照等已由既有交接链承接，不重复登记传递边。事实准入仍逐区域核查，Issue关闭不能代替真实支持。

1. C01可以先开始，使用合法已知结果跑通请求、读取、并列、条件身份与证据，必要最小兼容随它完成；不是只写schema或等待全部研究后才测试。C02扩展逐指标/区域对兼容、部分失败和独立理由，不重复P0审计。
2. C03消费A/#71正式交接，C05沿A既有聚合做显式共同日期/支持衍生和描述差值。这条月度分支可独立验收，不等待B板；各原结果默认不裁切，支持不足就受限或返回A前置。
3. C04消费B/#84正式交接，C06扩展B既有队列/窗口合同的衍生与描述比较；不把相对日相同当同日配对，不重识别事件/匹配。C05和C06分别处理A/B估计对象，复用公共兼容/身份/差值规则，不复制科学引擎。
4. C07汇合两板的同源阅读/成果包，最终整合依赖两支，但C03/C05本身已有可读可验收交付，不因此推迟月度能力。C08在C02及A/#70结果复用可用后推进，适配通用C身份/权限，不因B尚未交接阻塞本身。
5. C09汇合阅读与版本/权限路径，分别复算真实A月度与B事件的多区域实例并交接W。C04经#84已传递包含#71，C03仍需#71是为保持月度分支独立；这些不是给同一票重复加祖先阻塞。

真实关口要求至少两个不同真实区域在统一条件下可复算，A/B板各有真实合格可比实例；A或B交接示例本身不自动提供所有候选资料。每区P0用途资格、实际源、0.01°分析目标/已批准替代、许可、有效支持、真实事件窗口/对照单独检查。缺源成果返回具体A/B任务前置，不在C隐式重分析，不删候选/合成第二域冒充实证。只有受限/不可比说明可完成软件路径，不能填真实可比实例通过。

本批仅做证据并列、明确合同内的支持衍生及描述差值，不拼现有区间生成新显著结论；跨区域联合检验另设研究协议。无评分、星级、成功概率或推荐排名，候选按提交顺序保留。共同支持指可比时间与政策，不把异地海域求地理交集；重叠/共享日或对照只提示依赖，不虚增独立样本。

验收沿用已确认显式区域比较请求、实际快照/资格读取与同身份产物，手算兼容/差值及真实复算分别记证。C07是最小独立阅读产物，W/#21承担浏览器集成；完整AI、预测、任务恢复/案例库/PDF及P1性能实验不反向成为C前置。父级#85/#20/#13和A/B工作包不修改或关闭，本轮已逐项发布ready-for-agent和原生阻塞。

9项均含独立可观察行为与本项验证，规格44条用户故事全部追溯。任务可分别开始不等于共享文件可同时改，按实际接缝与PR顺序整合。软件实现、真实比较关口、PR、合并和部署分别留证，本轮发布不代表任何实现完成。用户已确认任务粒度与实际依赖；审查清单和Issue映射见同目录draft-review.json，实际发布/回读见发布记录。

发布核验：9项正文、ready-for-agent标签及13条原生阻塞已逐项回读一致，实际外部祖先关系与本批依赖合并检查无循环；#85/#20/#13及A/B规格#60/#72的正文、评论、状态和标签保持不变。当前可开始：[#86：运行两区域已知快照的比较样例](https://github.com/NingRuo-code/Ocean/issues/86)。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-c-ticket-publication-2026-10-24.json)。
