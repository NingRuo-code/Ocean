# W 分析工作台任务与进度入口

日期：2026-10-24。来源：[规格 #95](https://github.com/NingRuo-code/Ocean/issues/95)，归属 [W #21](https://github.com/NingRuo-code/Ocean/issues/21)。用户已确认粒度与直接阻塞，13项已发布为#96–#108，均标记ready-for-agent；W01–W13保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表实现、真实验收、合并或部署完成。

已通过GitHub CLI读取#95/#21完整正文和评论，并核对相关界面及A/B/C交接任务；远端#95与本地规格正文一致，发布前未发现重复W子任务，核对所读任务均开放且暂无评论；本轮仅发布并核验任务/原生阻塞，没有实施应用、执行真实研究或修改父级。最小服务能力由W补齐或复用；不虚构尚未拆分的TASK/AUTH前置，不重复已有计算/资格/缓存任务。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| W01 / [#96](https://github.com/NingRuo-code/Ocean/issues/96) | [从工作台打开已有月结果并展开同源证据](01-known-result-reading.md) | [#30](https://github.com/NingRuo-code/Ocean/issues/30) | 使用者从既有左侧工作台打开一份合法已就绪月结果，在右侧看到简短事实并按需展开底部同源证据；查看全程不启动新分析，地图仍可操作。 |
| W02 / [#97](https://github.com/NingRuo-code/Ocean/issues/97) | [引导月任务条件并隔离未提交编辑与旧结果](02-guided-conditions-and-capability.md) | [#96](https://github.com/NingRuo-code/Ocean/issues/96)、[#26](https://github.com/NingRuo-code/Ocean/issues/26)、[#28](https://github.com/NingRuo-code/Ocean/issues/28) | 使用者从已应用筛选创建月任务草稿，清楚看到年月、地点、公里范围、可用性和缺项；改条件后旧结果仍保留原身份并提示待更新，尚未提交不启动计算。 |
| W03 / [#98](https://github.com/NingRuo-code/Ocean/issues/98) | [接入真实A成果及P0资格说明](03-real-month-result-consumption.md) | [#97](https://github.com/NingRuo-code/Ocean/issues/97)、[#71](https://github.com/NingRuo-code/Ocean/issues/71) | 使用者在工作台查看实际交接的合格整月A成果、支持范围与局限，从简短结论展开距离/侧别及逐日证据；真实缺口可读，不要求先完成在线重算。 |
| W04 / [#99](https://github.com/NingRuo-code/Ocean/issues/99) | [本人显式提交A任务并取得持久受理记录](04-owner-accepted-month-task.md) | [#97](https://github.com/NingRuo-code/Ocean/issues/97)、[#70](https://github.com/NingRuo-code/Ocean/issues/70) | 本人从浏览器明确提交一个小型合格A任务，服务端真实受理、执行并返回可查询的任务和结果；访客被拒绝，重复发送同一提交意图不会增加任务。 |
| W05 / [#100](https://github.com/NingRuo-code/Ocean/issues/100) | [关闭刷新或断网后继续查询原任务](05-task-reconnect-and-reopen.md) | [#99](https://github.com/NingRuo-code/Ocean/issues/99)、[#31](https://github.com/NingRuo-code/Ocean/issues/31) | 本人关闭面板、刷新或断网后能重新找到已受理任务及原条件，恢复原任务查询而不重跑；状态无法核实时明确提示，不长期假装正在执行。 |
| W06 / [#101](https://github.com/NingRuo-code/Ocean/issues/101) | [取消真实运行任务且不混入迟到成果](06-real-task-cancellation.md) | [#100](https://github.com/NingRuo-code/Ocean/issues/100) | 本人取消已受理或运行中的A任务时得到服务端权威结果，能区分正在取消、已取消和已完成无法取消；旧任务消息不覆盖当前结果。 |
| W07 / [#102](https://github.com/NingRuo-code/Ocean/issues/102) | [失败后明确重试并区分原条件与新请求](07-explicit-retry-and-version-change.md) | [#100](https://github.com/NingRuo-code/Ocean/issues/100) | 本人看到真实失败原因后可明确重试，系统保留原任务并关联新尝试；资料版本变化时说明不能原样复跑，转为清楚的新请求，而非隐式换源。 |
| W08 / [#103](https://github.com/NingRuo-code/Ocean/issues/103) | [贯通真实整月A提交到可复核结果](08-real-month-submission-loop.md) | [#98](https://github.com/NingRuo-code/Ocean/issues/98)、[#101](https://github.com/NingRuo-code/Ocean/issues/101)、[#102](https://github.com/NingRuo-code/Ocean/issues/102) | 本人在浏览器选择合格真实整月条件并显式提交，经实际计算、状态与结果阅读获得可复核A证据；已有成果读取、明确重算和失败恢复行为可区分。 |
| W09 / [#104](https://github.com/NingRuo-code/Ocean/issues/104) | [接入真实B事件任务与分窗口证据](09-event-response-workbench.md) | [#101](https://github.com/NingRuo-code/Ocean/issues/101)、[#102](https://github.com/NingRuo-code/Ocean/issues/102)、[#84](https://github.com/NingRuo-code/Ocean/issues/84) | 本人填写固定区域、事件搜索期和已登记窗口后显式执行B任务，查看真实前后窗口、对照和响应证据；缺窗口与无事件有清楚区别，复用已有任务操作。 |
| W10 / [#105](https://github.com/NingRuo-code/Ocean/issues/105) | [先开放C月度区域比较与逐源结果读取](10-monthly-region-comparison-workbench.md) | [#101](https://github.com/NingRuo-code/Ocean/issues/101)、[#102](https://github.com/NingRuo-code/Ocean/issues/102)、[#88](https://github.com/NingRuo-code/Ocean/issues/88)、[#93](https://github.com/NingRuo-code/Ocean/issues/93) | 使用者明确选择两个以上不同固定区域和共同月条件，读取或提交已有A快照的C月度比较，看到候选并列、可比理由和缺失前置；不必等B工作台入口。 |
| W11 / [#106](https://github.com/NingRuo-code/Ocean/issues/106) | [完成C事件分板与完整比较证据联动](11-full-comparison-workbench.md) | [#105](https://github.com/NingRuo-code/Ocean/issues/105)、[#94](https://github.com/NingRuo-code/Ocean/issues/94) | 使用者在C中明确选择月度或事件证据板，按已有合同比较真实候选区域，并可显式选择已支持的共同支持政策；两板均可读、可复核且不隐式重分析。 |
| W12 / [#107](https://github.com/NingRuo-code/Ocean/issues/107) | [按原条件定位结果且保持地图与精简阅读](12-result-map-context-navigation.md) | [#98](https://github.com/NingRuo-code/Ocean/issues/98) | 使用者打开旧结果不会被改动当前筛选，明确点击定位后才在原地图框架中查看对应位置、圆域和合法日期；关闭详情仍能继续地图操作。 |
| W13 / [#108](https://github.com/NingRuo-code/Ocean/issues/108) | [回放真实A/B/C工作台并交接后续公共模块](13-real-workbench-replay-handoff.md) | [#103](https://github.com/NingRuo-code/Ocean/issues/103)、[#104](https://github.com/NingRuo-code/Ocean/issues/104)、[#106](https://github.com/NingRuo-code/Ocean/issues/106)、[#107](https://github.com/NingRuo-code/Ocean/issues/107) | 项目负责人得到可重新操作的真实A/B/C工作台流程和明确完成台账，知道哪些资料、任务操作、权限及证据已验证，后续TASK/REPORT/AI可复用已有合同。 |

共13项、86条验收条件，29条直接阻塞边（内部19条、外部10条）。本批及已发布本地依赖记录合并检查无循环；实际外部祖先与本批依赖也已合并检查无循环。29条GitHub原生阻塞已逐项设置并回读，与各正文直接前置一致。覆盖规格48条用户故事；每项包含可操作/可观察的完整流程及自身检查，完整验收见各文件与draft-review.json。

推进顺序与真实边界：

1. W01先接通可阅读已知成果，直接等待#30底部/历史框架（已传递包含#25工作台）；W02再消费#26筛选与#28请求隔离，不重复两项界面任务。W03消费A/#71真实成果，独立完成真实只读里程碑，不必先有重算能力。
2. W04沿A/#70及其#61/#64/P0祖先，接通一个真实受控A小例的本人提交、服务端权限、幂等和持久任务记录。它与W03是并行分支，不等全部A真实月研究才验证最小执行，也不把可运行小例当真实研究达标。
3. W05复用#31已应用条件恢复，补任务重开、断网、受理未核实和实际中断状态。W06真实取消、W07明确重试相互无前置，可分别交付；W08再汇合真实A资料与完整操作路径。必要状态/权限/持久化不能只做前端模拟，完整公共队列、自动续跑和归档准备并未因此实现。
4. W09直接等B/#84科学交接及W06/W07公共操作，不依赖W08已完成；A真实资料已经由B的既有链传递，不重复添加#71祖先边。W10在C/#88月度与#93逐源复用合同后先开放月度比较，不要求整个C/#94或B工作台先完成。
5. W11再等C/#94正式交接，接通事件板、已登记支持衍生和两板真实比较；不把缺失的A/B结果隐式重分析。W10的合法已知比较不代替W11真实至少两域关口，第三域缺失仍保留状态。
6. W12从W03已有真实A结果独立完成明确地图定位与原条件阅读的差别；B/C用共同合同适配，在各自入口和最终回放验收，不让地图导航等待所有研究完成。W01已有最小布局可用，W12也不重做#24美术。
7. W13只汇合本批真实流程、跨任务/权限/故障回放和可复用交接；不是将各项测试拖到最后。A/B/C真实结果、合成故障、只读里程碑、最小任务设施、PR/合并/部署分开留证，缺取消或缺真实资料不能勾完整W通过。

当前W批次没有零前置票：最早W01等待#30（其前置#25），不把既有未完成UI能力假设为已完成。实际全项目可先推进已发布#25/#28/#61等无阻塞任务，具体领取以GitHub实时状态为准。任务可以独立验证不等于共享文件可同时改，实施按主题PR和真实接缝安排。

完整TASK/Q49安全自动续跑、Q40归档一键准备、Q50保留/案例保护、完整REPORT/AI及OPS仍需后续规格与任务；本批最小本人权限、持久记录和真实取消/重试有明确责任，不以等待未知公共票悬空。已有公共设施则复用并核验，后续若正式发布公共票再根据实际责任调整，避免重复建设和循环。

用户已确认13项任务的粒度与直接前置，本轮已按确认逐项发布ready-for-agent并设置原生阻塞；父级#95/#21/#13及源规格#24/#60/#72/#85保持不变。

发布核验：13项正文、ready-for-agent标签及29条原生阻塞已逐项回读一致，源规格/父级的正文、评论、状态与标签保持不变。当前可开始：本批暂无无阻塞项；最早W01等待#30，实际领取以GitHub实时状态为准。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-w-ticket-publication-2026-10-24.json)。
