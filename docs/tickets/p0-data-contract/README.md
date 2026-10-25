# P0 数据审计与分析条件合同任务与进度入口

日期：2026-10-24。来源：[规格 #35](https://github.com/NingRuo-code/Ocean/issues/35)，归属 [P0 #14](https://github.com/NingRuo-code/Ocean/issues/14)。用户已确认任务粒度与阻塞关系，9项已发布为 #36–#44，均标记 ready-for-agent。P01–P09 保留为原评审编号，实时实施进度以对应 GitHub Issue 为准。发布不代表实现、真实审计、研究关口、合并或部署已完成。

已重新读取 #35、#14 的完整正文及评论，当前均开放且暂无新增评论；远端 #35 与本地规格正文一致。以下只是实施拆分，不代表真实资料已完成审计或研究关口已通过。

| 编号 | 标题 | 真正前置 | 可独立验收的交付 |
| --- | --- | --- | --- |
| P01 / [#36](https://github.com/NingRuo-code/Ocean/issues/36) | [运行首份可追溯的数据审计快照](01-source-snapshot.md) | 无，可开始 | 维护者显式审计一个已登记来源或小样本，得到可读报告：资料角色、来源证据、版本身份、许可待核项和当前能证明的范围；后续切片复用同一入口与快照。 |
| P02 / [#37](https://github.com/NingRuo-code/Ocean/issues/37) | [逐日核实锋面与海温内容及有效支持](02-front-sst-validity.md) | [#36](https://github.com/NingRuo-code/Ocean/issues/36) | 研究者审计某段日期的锋面/SST，能看到真实时间、单位、网格与有效/缺测情况，区分文件存在、成功解析和有效观测。 |
| P03 / [#38](https://github.com/NingRuo-code/Ocean/issues/38) | [逐日核实AIS零值、粒度与小时守恒](03-ais-zero-resolution.md) | [#36](https://github.com/NingRuo-code/Ocean/issues/36) | 研究者查看活动审计结果时，能分清真实记录零、无记录、未知覆盖和处理缺省，知道展示资料能否支持所需分析粒度。 |
| P04 / [#39](https://github.com/NingRuo-code/Ocean/issues/39) | [对公里圆给出可复算的面积与分母](04-regional-geometry.md) | [#37](https://github.com/NingRuo-code/Ocean/issues/37)、[#38](https://github.com/NingRuo-code/Ocean/issues/38) | 给定分析点、公里范围和用途，研究者得到该区域实际有效/未知支持及同支持的小时分子、有效面积和不可计算原因，能用小例复算。 |
| P05 / [#40](https://github.com/NingRuo-code/Ocean/issues/40) | [核对本地、离线与服务器资料身份](05-environment-lineage.md) | [#36](https://github.com/NingRuo-code/Ocean/issues/36) | 维护者能比较不同环境的资料与展示产物，分清同版本、不同处理、已知冲突或尚未核实，并定位旧结果的真实来源。 |
| P06 / [#41](https://github.com/NingRuo-code/Ocean/issues/41) | [判断完整月与事件窗口的数据资格](06-monthly-support.md) | [#39](https://github.com/NingRuo-code/Ocean/issues/39) | 研究者提交地点、半径、月份和分析用途，得到全日历台账与支持等级，明确A月分析和B前后窗口分别能否开展。 |
| P07 / [#42](https://github.com/NingRuo-code/Ocean/issues/42) | [现有查询读取同一份轻量支持结论](07-query-support.md) | [#41](https://github.com/NingRuo-code/Ocean/issues/41) | 已有清单或确定性查询能读取审计快照中的条件资格，向调用方返回一致的状态、原因和证据，普通读取无需重扫原档。 |
| P08 / [#43](https://github.com/NingRuo-code/Ocean/issues/43) | [源数据变化后旧资格不被误用](08-version-replay.md) | [#42](https://github.com/NingRuo-code/Ocean/issues/42) | 维护者重跑审计或替换数据/方法后，查询得到相应版本的支持判定，旧快照仍能识别，过期缓存不沿用错误资格。 |
| P09 / [#44](https://github.com/NingRuo-code/Ocean/issues/44) | [交付东海2024年8月真实审计与研究关口证据](09-ecs-month-evidence.md) | [#40](https://github.com/NingRuo-code/Ocean/issues/40)、[#41](https://github.com/NingRuo-code/Ocean/issues/41) | 项目负责人拿到首选候选月的真实逐日审计、代表位置/半径支持判定及前后窗口缺口，知道哪些研究可以开始，哪些仍受数据前置阻塞。 |

P01 是能执行并产出真实审计摘要的最小切片，不是只写schema。P02/P03分别贯通读取、语义核对与报告，P05可与它们分别推进。P04消费前两者核实的有效支持与值语义；P06将该合同扩展到完整日历和研究用途；P07交付现有查询实际消费；P08交付资料变化后的重跑/失效行为；P09进行真实候选月核验与关口交接。每项包含自己的小例和回归，不留到最后才测试。

依赖顺序：P01 → P02/P03/P05；P02+P03 → P04 → P06 → P07 → P08；P05+P06 → P09。10条阻塞边；当前可开始P01。真实月份核验不必等待API消费和缓存回放。这里的“可分别推进”是任务依赖，不承诺同时写共享文件；有冲突按PR顺序整合。若证据足够提前核查真实日样本，应在P01–P03开展，避免等P09才发现无法访问。

不将父级 #14/#35 的关闭作为全部子任务的前置，不等待界面 #25–#34 或整个性能 #17 完成。P0定义数据语义与资格；#28负责前端异步正确性，#29负责活动摘要，正式统计/预测与论文性能实验沿用原工作包，避免重复实现。

数据访问是运行前置，不是可凭软件任务消除的依赖。来源不可访问或语义未知时，继续合法可做部分并登记具体未核项；合成合同通过不解除真实覆盖、许可和ADR粒度阻塞。P09必须如实交代逐日检查完成与否，不能以负结论掩盖未执行的检查，也不能要求所有资料必须合格才报告结果。

整体验收以显式审计产物与条件支持判定为主，真实月份和合成夹具分开记证；地图外观不作为P0主验收。审计能力完成、GD关口通过、PR、合并及部署分开记录。本轮未执行真实月审计、未修改应用、未更新或关闭父级Issue。

发布核验：9项正文与标签已逐项回读一致，10条原生阻塞关系与正文引用一致。原父级#35和工作包#14的正文、状态、标签已核对保持不变；未修改或关闭#13。当前可开始 [#36：运行首份可追溯的数据审计快照](https://github.com/NingRuo-code/Ocean/issues/36)。


发布证据：[任务与依赖核验记录](../../reports/ocean-p0-ticket-publication-2026-10-24.json)。
