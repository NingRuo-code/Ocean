# A 完整月空间关系分析任务与进度入口

日期：2026-10-24。来源：[规格 #60](https://github.com/NingRuo-code/Ocean/issues/60)，归属 [A #18](https://github.com/NingRuo-code/Ocean/issues/18)。用户已确认粒度和阻塞关系，11项已发布为#61–#71，均标记ready-for-agent；A01–A11保留为评审编号，实际进度以对应GitHub Issue为准。发布不代表实现、真实研究关口、合并或部署已完成。

已通过GitHub CLI重新读取#60/#18完整正文和评论，及#39/#41/#44/#43/#42/#21/#9/#57的相关约定；核对时均开放且暂无评论。已核对#60与本地规格正文一致，发布前未发现重复A实施子任务。本轮发布已确认任务及原生阻塞、同步本地记录；未修改应用或运行真实月研究。

| 编号 | 标题与完整验收条件 | 真正前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| A01 / [#61](https://github.com/NingRuo-code/Ocean/issues/61) | [显式运行并读取可手算的月分析样例](01-controlled-month-sample.md) | 无，可开始 | 研究者显式提交地点、公里半径、月份和版本，在受控样例上运行完整日历的小型分析，取得可阅读的逐日小时、面积时间及月度摘要；提交条件与运行/失败/完成状态可追溯。它是后续功能共同扩展的最小可运行闭环。 |
| A02 / [#62](https://github.com/NingRuo-code/Ocean/issues/62) | [按最近锋面距离计算同日配对与月度密度](02-distance-month-reference.md) | [#61](https://github.com/NingRuo-code/Ocean/issues/61)、[#39](https://github.com/NingRuo-code/Ocean/issues/39) | 研究者在同一受控月分析入口取得逐日匹配的距离带活动小时、有效面积时间与月度密度，并能查看每一天的贡献和未知部分。结果使用完整分析输入和P0几何合同，可作为后续对照和优化的直接参照。 |
| A03 / [#63](https://github.com/NingRuo-code/Ocean/issues/63) | [在可判定支持上比较冷暖侧与环境条件](03-side-environment.md) | [#62](https://github.com/NingRuo-code/Ocean/issues/62) | 研究者从同一月结果读取冷侧、暖侧和未知侧的活动及支持差异；SST或梯度具备实际支持时再查看对应子分析，缺少可选资料时仍能读取主距离分析。 |
| A04 / [#64](https://github.com/NingRuo-code/Ocean/issues/64) | [月分析按P0资格放行并解释真实缺口](04-p0-qualification-consumption.md) | [#61](https://github.com/NingRuo-code/Ocean/issues/61)、[#41](https://github.com/NingRuo-code/Ocean/issues/41) | 研究者提交实际月条件时，月分析读取同用途的P0快照，在执行前给出是否支持、能做哪些描述及缺少哪些前置；被拒绝的条件不启动重计算。合法小例仍可单独运行。 |
| A05 / [#65](https://github.com/NingRuo-code/Ocean/issues/65) | [给出同月可比距离参照和匹配失败说明](05-same-month-controls.md) | [#62](https://github.com/NingRuo-code/Ocean/issues/62) | 研究者读取近锋面与同月同日可比背景的密度差，能同时检查双方小时、面积时间、匹配日期和可比性；缺少合格参照时保留描述关系并解释原因。 |
| A06 / [#66](https://github.com/NingRuo-code/Ocean/issues/66) | [按相关日组估计效应区间并正确降级](06-correlated-uncertainty.md) | [#65](https://github.com/NingRuo-code/Ocean/issues/65) | 研究者在比较结果中看到保持同日组对应关系、考虑相邻日期相关性的效应区间及方法依据；有效独立支持不足时清楚看到不能可靠推断的原因。 |
| A07 / [#67](https://github.com/NingRuo-code/Ocean/issues/67) | [冻结主方案并运行可追溯敏感性比较](07-frozen-sensitivity.md) | [#63](https://github.com/NingRuo-code/Ocean/issues/63)、[#64](https://github.com/NingRuo-code/Ocean/issues/64)、[#66](https://github.com/NingRuo-code/Ocean/issues/66) | 研究者在真实候选月正式分析前登记主方案和有限变体，通过同一分析流程得到半径、边界、距离带、覆盖门槛及大值影响的比较矩阵；每一项都有支持状态和参数身份。 |
| A08 / [#68](https://github.com/NingRuo-code/Ocean/issues/68) | [运行首个合格真实整月并交付直接计算证据](08-real-month-reference.md) | [#67](https://github.com/NingRuo-code/Ocean/issues/67)、[#44](https://github.com/NingRuo-code/Ocean/issues/44) | 项目负责人拿到首选东海2024-08在已核实支持范围内的真实完整月直接结果、对照/区间或降级说明及敏感性表；能逐日核对数据身份、支持和排除，明确A的真实研究关口是否通过。 |
| A09 / [#69](https://github.com/NingRuo-code/Ocean/issues/69) | [将同一月结果呈现为主图、解释和证据包](09-charts-evidence-pack.md) | [#63](https://github.com/NingRuo-code/Ocean/issues/63)、[#66](https://github.com/NingRuo-code/Ocean/issues/66) | 使用者读取某个已有月结果时，先看到关键指标、一张距离关系主图和简短解释，再按需查看月度分布、侧别、同月对照与逐日证据；允许导出的聚合表和图片与显示数字一致。 |
| A10 / [#70](https://github.com/NingRuo-code/Ocean/issues/70) | [重复读取复用正确结果且版本变化不串用](10-result-reuse-versioning.md) | [#64](https://github.com/NingRuo-code/Ocean/issues/64)、[#43](https://github.com/NingRuo-code/Ocean/issues/43) | 研究者重复读取相同已完成月结果时复用身份一致的快照；更换资料、几何或方法后得到不同身份，旧结果仍保留原条件。读取不会重新启动整月计算，也不会把失效资格或半成品当新成果。 |
| A11 / [#71](https://github.com/NingRuo-code/Ocean/issues/71) | [复算真实月成果并交接可消费的A结果合同](11-real-replay-handoff.md) | [#68](https://github.com/NingRuo-code/Ocean/issues/68)、[#69](https://github.com/NingRuo-code/Ocean/issues/69)、[#70](https://github.com/NingRuo-code/Ocean/issues/70) | 项目负责人从明确条件重新读取并复算真实月成果，核对直接计算、复用结果、主图、摘要和许可允许的证据包；后续B/C、工作台和性能任务拿到已验证的输入、分母和消费合同。 |

共11项、70条验收条件、19条直接阻塞边：本批内部15条，外部4条。外部边分别为A02←#39、A04←#41、A08←#44、A10←#43；不再重复登记已经由这些任务传递保证的P0祖先边。19条GitHub原生阻塞已逐项设置并回读核对，正文前置引用与原生关系一致。

1. 可先开始A01，贯通请求、合法已知输入、全日历、小型计算和可读结果；最小兼容适配随它实施，不单独发宽泛重构任务。A01不是仅写schema，也不声称真实月已完成。
2. P0 #39交付后，A02消费已核实几何/分母进行距离带计算；A03和A05再分别做侧别与同月对照，A06补相关组区间。这些能力允许以合法小例开发验证，不等待#44真实整月审计全部完成。
3. A04直接消费#41的同用途快照，不等待#42 API消费；A10在#43版本/新鲜度合同完成后扩展月结果复用，避免再实现P0失效机制。A10不阻塞A08直接真实计算。
4. A07实际执行冻结方案及敏感性小例，正式候选月先冻结，再在A08执行真实主/变体。A09可先用样例结果验证图表，不等真实月份；A11汇合真实结果、同源阅读产物和复用路径做一次实际复算及交接。
5. #44关闭仅说明其任务交付，未必代表真实资料合格；A08执行还必须由实际许可、0.01°分析目标/已批准替代、同用途覆盖、几何和分母证据放行。实际访问、资格和推断条件是事实前置，不能通过合成测试、关闭Issue或把缺口写成负结论消除。

每项均贯通现有受控分析/读取入口到可观察结果或证据，并在本项做独立小例与回归。A09提供最小可读成果，不新建工作台；受控批处理与API采用同计算合同，不开测试专用业务接口。A03的缺可选SST/强度可正确降级，不使已支持的主分析失败。来源精度和参数数值依P0及小例冻结，不在拆票时凭空指定。

职责边界：P0审计数据与支持；本批A计算同日完整月关系；#9旧实验只复用适用结构，逐行推断须纠正，B事件/前后窗口仍归#19；#21消费已验收A结果并做工作台联动；#57/#58优化同语义聚合/联动，不能反向阻塞A。不把#18/#60/#14/#35关闭设为所有子任务前置；不修改其正文、标签或状态。只建原生阻塞边，不为子任务关系改父级。

完整A仍要求至少一个真实合格完整月可复算，图、表、摘要、聚合导出和证据一致；单月相关不等于因果、鱼量、收益或预测增益。软件能力、真实研究关口、PR、合并和部署分别记证。本轮任务发布不代表其中任何实现完成。

用户故事覆盖：42/42，每条均可追溯至至少一个任务；用户已确认任务粒度与阻塞，功能和验收边界沿用已发布规格；完整清单、原生关系及回读检查见发布记录。

发布核验：11项正文、ready-for-agent标签及19条原生阻塞已逐项回读一致；#60/#18/#13的正文、评论、状态和标签保持不变。当前可开始：[#61：显式运行并读取可手算的月分析样例](https://github.com/NingRuo-code/Ocean/issues/61)。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-a-ticket-publication-2026-10-24.json)。

## 实施进度 — 2026-10-26

A01/#61最小受控闭环实现及本地验收通过，随本批PR合并后结项；29项新API检查、完整后端52项与实际HTTP证据见[实施记录](../../reports/ocean-controlled-month-implementation-2026-10-26.md)。它不解除A02/#62的P0 #39几何前置，也不解除A04/#64的#41资格前置；真实月、统计关系与后续模块仍按原规格验收。
