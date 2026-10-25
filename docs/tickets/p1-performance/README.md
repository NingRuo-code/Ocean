# P1 性能实施任务与进度入口

日期：2026-10-24。来源：[规格 #45](https://github.com/NingRuo-code/Ocean/issues/45)，归属 [P1 #17](https://github.com/NingRuo-code/Ocean/issues/17)。用户已确认粒度和依赖，14项已发布为#46–#59，均标记 ready-for-agent；包含8项近期工作、6项条件性实验。F01–F14保留为原评审编号，实际进度以对应Issue为准。任务发布不代表优化、基准、实验、容量或部署已完成。

已读取 #45/#17 完整正文及评论，均开放且暂无新增评论；#45 与本地规格正文一致。关联 #28/#37/#38/#18 的正文和评论已核对。本轮仅发布已确认任务及阻塞关系、同步本地记录；未修改应用、运行性能基准、核实现服资源或修改父级。

| 编号 | 类别 | 标题 | 真正前置 | 实验或实施边界 |
| --- | --- | --- | --- | --- |
| F01 / [#46](https://github.com/NingRuo-code/Ocean/issues/46) | 近期 | [复跑真实地图操作并输出端到端基线](01-browser-baseline.md) | 无，可开始 | 按已有规格交付；优化与容量结论以实际证据为准 |
| F02 / [#47](https://github.com/NingRuo-code/Ocean/issues/47) | 近期 | [盘点实际服务链与分层资源工作集](02-runtime-inventory.md) | 无，可开始 | 按已有规格交付；优化与容量结论以实际证据为准 |
| F03 / [#48](https://github.com/NingRuo-code/Ocean/issues/48) | 近期 | [先概览后明细且当前操作优先](03-progressive-scheduling.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#28](https://github.com/NingRuo-code/Ocean/issues/28) | 按已有规格交付；优化与容量结论以实际证据为准 |
| F04 / [#49](https://github.com/NingRuo-code/Ocean/issues/49) | 近期 | [长播放缓存有界并有限预取邻日概览](04-browser-cache-prefetch.md) | [#48](https://github.com/NingRuo-code/Ocean/issues/48) | 按已有规格交付；优化与容量结论以实际证据为准 |
| F05 / [#50](https://github.com/NingRuo-code/Ocean/issues/50) | 近期 | [重复窗口读取的服务缓存与清理有界](05-server-cache-budget.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#47](https://github.com/NingRuo-code/Ocean/issues/47) | 按已有规格交付；优化与容量结论以实际证据为准 |
| F06 / [#51](https://github.com/NingRuo-code/Ocean/issues/51) | 近期 | [减少地图重绘与隐藏面板的重复工作](06-incremental-drawing.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46) | 按已有规格交付；优化与容量结论以实际证据为准 |
| F07 / [#52](https://github.com/NingRuo-code/Ocean/issues/52) | 近期 | [活动远景聚合守恒、近景显示完整有效格](07-complete-effort-lod.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#38](https://github.com/NingRuo-code/Ocean/issues/38) | 按已有规格交付；优化与容量结论以实际证据为准 |
| F08 / [#53](https://github.com/NingRuo-code/Ocean/issues/53) | 近期 | [首轮同负载复测与服务器容量决策](08-capacity-decision.md) | [#49](https://github.com/NingRuo-code/Ocean/issues/49)、[#50](https://github.com/NingRuo-code/Ocean/issues/50)、[#51](https://github.com/NingRuo-code/Ocean/issues/51)、[#52](https://github.com/NingRuo-code/Ocean/issues/52) | 按已有规格交付；优化与容量结论以实际证据为准 |
| F09 / [#54](https://github.com/NingRuo-code/Ocean/issues/54) | 条件性 | [PNG图像层进入判断与最小端到端对照](09-png-experiment.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#37](https://github.com/NingRuo-code/Ocean/issues/37) | 真实栅格解析/绘制是重要成本，存在已核实合法的小切片与同色标参照。 |
| F10 / [#55](https://github.com/NingRuo-code/Ocean/issues/55) | 条件性 | [COG窗口读取进入判断与小切片对照](10-cog-experiment.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#37](https://github.com/NingRuo-code/Ocean/issues/37) | 窗口IO/传输瓶颈成立，并能验证实际Range及概览/明细服务路径。 |
| F11 / [#56](https://github.com/NingRuo-code/Ocean/issues/56) | 条件性 | [多年Zarr读取进入判断与两种分块对照](11-zarr-experiment.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#37](https://github.com/NingRuo-code/Ocean/issues/37) | 实际多年时空读取有瓶颈，存在合法可核实的相应样本和明确查询负载。 |
| F12 / [#57](https://github.com/NingRuo-code/Ocean/issues/57) | 条件性 | [冻结月度聚合普通参照与成本基线](12-ordinary-aggregation.md) | [#46](https://github.com/NingRuo-code/Ocean/issues/46)、[#18](https://github.com/NingRuo-code/Ocean/issues/18) | A已交付可复算的完整月计算与稳定输入/分母，存在目标联动查询。 |
| F13 / [#58](https://github.com/NingRuo-code/Ocean/issues/58) | 条件性 | [Mosaic Selections进入判断与开关对照](13-mosaic-experiment.md) | [#57](https://github.com/NingRuo-code/Ocean/issues/57) | 真实共享筛选聚合构成瓶颈，普通参照稳定，构建/更新预算可度量。 |
| F14 / [#59](https://github.com/NingRuo-code/Ocean/issues/59) | 条件性 | [剩余绘制瓶颈的单一替代方案对照](14-renderer-experiment.md) | [#51](https://github.com/NingRuo-code/Ocean/issues/51) | 完成局部重绘改进后，浏览器仍有显著绘制或主线程计算瓶颈。 |

近期八项构成V0–V2与首轮V4交付；F01和F02可以先开始。F03等待#28，F07等待#38；F04消费F03的调度，F05消费F01/F02的负载和预算，F06可在F01后先行。F08等首轮各分支结果后给同负载容量结论，不等待条件实验全部完成；资源模型和资料清单可在F02提前形成。

条件性六项包含格式/替代渲染实验，以及普通聚合参照和Mosaic路线。PNG/COG/Zarr可分别判断，彼此不串行依赖；真实SST语义依赖#37。F12等待A/#18已验收的月度输入与直接参照，F13再用F12作公平基线，均不阻塞近期地图。F14仅在局部更新后仍有对应成本时进行。

阻塞边共22条，其中本批内部16条、既有外部任务6条。外部目标为#28、#38、#37（三个栅格/格式实验各一条）与#18。父级#17/#45/#14不作为所有任务的统一阻塞。任务可开始代表前置具备，不承诺在共享文件上并行修改；按实际冲突安排合并顺序。

条件性不等于必须采用：前置Issue解除后先核查真实瓶颈、合法可比样本、语义和预算；成立才运行限定实验，不成立交付有据的延后/不采用。尚未核实的条件不得假判成立；决定不进入不能记成技术已实现。发布时使用ready-for-agent描述完整的决策/验证任务，并保留原生阻塞，不能把被阻塞实验当当前可领取。缺少数据/权限属于事实前置，保留未核项，不以合成测试冒充实测。

分工：#28实现异步身份/失败正确性，F03测并优化调度；P0登记来源、零值、粒度及支持，F07和候选消费其证据；#33/#34承担科学配色，F07承担全量/聚合；A/#18计算科学结果，F12/F13只优化同语义读取/联动。完整任务中心和一键准备没有取消，P1提供预算，不在本批重复实现。imMens分桶思路随F07验证，不把普通缓存称完整GPU立方体复现。

每项包含自己的数值/几何/行为与性能检查，使用已确认浏览器端到端主入口；功能、合成、测试环境、生产低频探针分别记证。先过正确性再比较收益，B0旧截断与B1完整支持不直接算加速倍率。3/1/2秒目标的环境/统计口径在V0冻结，未测不填达标；不采购、不全档转换、不清空生产缓存、不生产压测。

发布核验：14项正文与 ready-for-agent 标签逐项回读一致，22条原生阻塞关系已回读核对（本批内部16条、外部6条）。#45和#17的正文、状态与标签保持不变，本轮未修改或关闭其他父级任务。当前无未完成任务前置的入口为：[#46：复跑真实地图操作并输出端到端基线](https://github.com/NingRuo-code/Ocean/issues/46)、[#47：盘点实际服务链与分层资源工作集](https://github.com/NingRuo-code/Ocean/issues/47)。条件实验仍需判断正文中的进入条件。


发布证据：[任务与原生阻塞核验记录](../../reports/ocean-p1-ticket-publication-2026-10-24.json)。
