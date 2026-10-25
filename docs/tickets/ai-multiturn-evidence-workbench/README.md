# AI 多轮任务与证据解释任务及进度入口

日期：2026-10-24。来源：[规格 #199](https://github.com/NingRuo-code/Ocean/issues/199)，关联[W #21](https://github.com/NingRuo-code/Ocean/issues/21)及#13。用户已确认粒度与真实直接前置，26项已发布为#200–#225，均标记ready-for-agent；AI01–AI26保留为评审编号，实时进度以对应GitHub Issue为准。发布不代表功能实现、模型接通、科研验证、合并或部署完成。

通过GitHub CLI读取#199完整正文/评论及相关来源任务，规格正文与本地一致；未见已有完整AI执行票，所读任务仍开放且暂无评论。已发布职责不是实际工具、资料、模型或服务已可用的证明。

| 评审编号 | 完整任务与验收 | 直接前置 | 可独立验证的交付 |
| --- | --- | --- | --- |
| AI01 / [#200](https://github.com/NingRuo-code/Ocean/issues/200) | [从工作台用明确指令运行已知A小例](01-known-month-intent.md) | [#99](https://github.com/NingRuo-code/Ocean/issues/99) | 本人在左侧AI输入明确的完整月分析指令，复用实际任务服务计算合法已知A小例，看到原条件、真实状态和可手核事实；无需模型或重复确认。 |
| AI02 / [#201](https://github.com/NingRuo-code/Ocean/issues/201) | [问清当前锋面和历史频次的真实含义](02-current-history-questions.md) | [#200](https://github.com/NingRuo-code/Ocean/issues/200) | 使用者询问所选日与位置的锋面、SST或历史频次，得到既有查询的真实事实、样本范围和限制，读取不会变成联合研究或规则预测。 |
| AI03 / [#202](https://github.com/NingRuo-code/Ocean/issues/202) | [多轮改条件并澄清后继续原明确意图](03-multiturn-conditions.md) | [#200](https://github.com/NingRuo-code/Ocean/issues/200) | 使用者说“换成八月”“扩大范围”只修改草稿；明确说再分析才提交，缺条件可一次补齐后继续原意图，每轮有可核的继承与差异。 |
| AI04 / [#203](https://github.com/NingRuo-code/Ocean/issues/203) | [发布能核对具体指标与限定的证据回答](04-verified-evidence-answer.md) | [#201](https://github.com/NingRuo-code/Ocean/issues/201)、[#202](https://github.com/NingRuo-code/Ocean/issues/202) | 使用者追问指标、比较方向或局限时，得到绑定具体结果字段的简短解释；引用存在但不支持结论的回答会被拒绝或降级。 |
| AI05 / [#204](https://github.com/NingRuo-code/Ocean/issues/204) | [刷新后重开原轮次和证据且不再次调用](05-durable-conversation.md) | [#203](https://github.com/NingRuo-code/Ocean/issues/203) | 本人离开、刷新后能按原会话版本读取轮次、任务和已发布回答；重开不会重跑研究或模型，旧证据不可用会明确说明。 |
| AI06 / [#205](https://github.com/NingRuo-code/Ocean/issues/205) | [分清停止回答与取消重试真实任务](06-generation-and-task-control.md) | [#202](https://github.com/NingRuo-code/Ocean/issues/202)、[#101](https://github.com/NingRuo-code/Ocean/issues/101)、[#102](https://github.com/NingRuo-code/Ocean/issues/102) | 本人可停止本轮解释，或明确取消/重试选定公共任务；界面准确显示实际停止的对象和服务端终态。 |
| AI07 / [#206](https://github.com/NingRuo-code/Ocean/issues/206) | [在AI阅读前落实保留集隔离与接触登记](07-research-contact-guard.md) | [#203](https://github.com/NingRuo-code/Ocean/issues/203)、[#145](https://github.com/NingRuo-code/Ocean/issues/145) | 本人询问研究结果时，封存资料不会经工具、提示、旧回答或缓存泄漏；合法揭示沿同一资料接触台账留痕。 |
| AI08 / [#207](https://github.com/NingRuo-code/Ocean/issues/207) | [按发送用途投影证据并拒绝非法外发](08-provider-data-projection.md) | [#204](https://github.com/NingRuo-code/Ocean/issues/204) | 本人选择在线解释时能看到将发送的数据类别；实际发送前按用途核权限与字段，许可未知或未配置则保留本地/手动。 |
| AI09 / [#208](https://github.com/NingRuo-code/Ocean/issues/208) | [配置并实际运行有费用上限的在线单轮分析](09-bounded-online-model.md) | [#207](https://github.com/NingRuo-code/Ocean/issues/207) | 本人在已落实许可和预算的模型方案内实际提出单工具分析或证据问题，得到核证回答和可对账用量；失败可回到原手动功能。 |
| AI10 / [#209](https://github.com/NingRuo-code/Ocean/issues/209) | [按有限计划执行明确的多步骤分析请求](10-finite-task-plan.md) | [#203](https://github.com/NingRuo-code/Ocean/issues/203)、[#205](https://github.com/NingRuo-code/Ocean/issues/205) | 本人明确要求多个受支持步骤时，可读到每步条件、状态及结果；部分失败保留成功项，系统不会临时扩展研究或无限循环。 |
| AI11 / [#210](https://github.com/NingRuo-code/Ocean/issues/210) | [交付真实整月A的在线多轮核心流程](11-real-month-ai-core.md) | [#208](https://github.com/NingRuo-code/Ocean/issues/208)、[#205](https://github.com/NingRuo-code/Ocean/issues/205)、[#103](https://github.com/NingRuo-code/Ocean/issues/103)、[#107](https://github.com/NingRuo-code/Ocean/issues/107) | 本人用在线多轮完成真实整月A分析与追问，修改范围后明确再分析，按原结果定位并可离开重开；形成可先交付的AI核心。 |
| AI12 / [#211](https://github.com/NingRuo-code/Ocean/issues/211) | [用多轮请求分析B事件并解释真实窗口](12-event-response-ai.md) | [#203](https://github.com/NingRuo-code/Ocean/issues/203)、[#104](https://github.com/NingRuo-code/Ocean/issues/104) | 本人明确请求固定海域B事件分析，获得真实各窗口、对照与不确定性解释；旧结果追问不会重新识别事件。 |
| AI13 / [#212](https://github.com/NingRuo-code/Ocean/issues/212) | [先用自然语言比较已有A月度区域证据](13-monthly-comparison-ai.md) | [#203](https://github.com/NingRuo-code/Ocean/issues/203)、[#105](https://github.com/NingRuo-code/Ocean/issues/105) | 本人选定两个以上区域后读取或明确提交月度比较，逐项看到兼容理由和已有差值；缺区域成果不会触发隐式A重算。 |
| AI14 / [#213](https://github.com/NingRuo-code/Ocean/issues/213) | [解释C事件分板及真实两域比较](14-full-comparison-ai.md) | [#212](https://github.com/NingRuo-code/Ocean/issues/212)、[#106](https://github.com/NingRuo-code/Ocean/issues/106) | 本人在C月度和事件板之间明确选择，阅读真实两域证据及已有合法支持政策，AI保留全部候选和不可比说明。 |
| AI15 / [#214](https://github.com/NingRuo-code/Ocean/issues/214) | [检索相似历史并解释原响应而不制造成功率](15-similar-case-ai.md) | [#206](https://github.com/NingRuo-code/Ocean/issues/206)、[#173](https://github.com/NingRuo-code/Ocean/issues/173) | 本人用自然语言寻找可检索历史情形，展开原B响应与A背景，了解相似依据、候选库范围和响应局限。 |
| AI16 / [#215](https://github.com/NingRuo-code/Ocean/issues/215) | [按真实分段解释短窗匹配与歧义](16-short-window-ai.md) | [#206](https://github.com/NingRuo-code/Ocean/issues/206)、[#174](https://github.com/NingRuo-code/Ocean/issues/174) | 本人明确核对短窗候选时，AI解释真实逐日依据、断档和重新锚定；不会把启发式分数说成身份概率或完整生命周期。 |
| AI17 / [#216](https://github.com/NingRuo-code/Ocean/issues/216) | [按冻结协议解释并运行G3月度复核](17-independent-month-ai.md) | [#206](https://github.com/NingRuo-code/Ocean/issues/206)、[#150](https://github.com/NingRuo-code/Ocean/issues/150) | 本人读取或明确运行已登记的G3月度协议，理解真实跨年季节结果、支持和独立性，不由对话选择有利海域或方法。 |
| AI18 / [#217](https://github.com/NingRuo-code/Ocean/issues/217) | [按冻结协议解释并运行G3事件复核](18-independent-event-ai.md) | [#206](https://github.com/NingRuo-code/Ocean/issues/206)、[#153](https://github.com/NingRuo-code/Ocean/issues/153) | 本人围绕已登记B跨期复核追问真实事件、窗口、对照和相关组；明确执行仍遵守原冻结与揭示规则。 |
| AI19 / [#218](https://github.com/NingRuo-code/Ocean/issues/218) | [解释并显式运行已登记预测实验](19-prediction-ai.md) | [#206](https://github.com/NingRuo-code/Ocean/issues/206)、[#193](https://github.com/NingRuo-code/Ocean/issues/193) | 本人围绕已有或已登记预测实验询问1/2/3日误差与锋面增量，明确请求才运行；规则、归档条件与可核历史回测有清楚边界。 |
| AI20 / [#219](https://github.com/NingRuo-code/Ocean/issues/219) | [从缺资料说明明确提交归档准备](20-preparation-ai.md) | [#205](https://github.com/NingRuo-code/Ocean/issues/205)、[#118](https://github.com/NingRuo-code/Ocean/issues/118) | 本人询问缺资料时只看准备计划；明确要求准备才通过公共任务执行，逐项看到就绪/失败，完成后仍由本人发起分析。 |
| AI21 / [#220](https://github.com/NingRuo-code/Ocean/issues/220) | [保存选定结果和独立AI注释版本](21-saved-explanation-version.md) | [#204](https://github.com/NingRuo-code/Ocean/issues/204)、[#128](https://github.com/NingRuo-code/Ocean/issues/128) | 本人通过AI或原入口检索案例、保存明确结果及选定解释注释，重开仍是原证据版本；AI文字与科学正文分开。 |
| AI22 / [#221](https://github.com/NingRuo-code/Ocean/issues/221) | [导出带明确AI注释的同源内部报告](22-internal-annotated-report.md) | [#220](https://github.com/NingRuo-code/Ocean/issues/220)、[#133](https://github.com/NingRuo-code/Ocean/issues/133) | 本人明确导出已保存的合法A报告时，可选择包含原AI注释并下载实际PDF；文件保留科学正文、注释来源与版本。 |
| AI23 / [#222](https://github.com/NingRuo-code/Ocean/issues/222) | [按原报告用途安全导出AI注释](23-purpose-aware-annotated-export.md) | [#221](https://github.com/NingRuo-code/Ocean/issues/221)、[#138](https://github.com/NingRuo-code/Ocean/issues/138) | 本人选择内部或允许分享用途时，AI注释随REPORT同一字段政策生成；私人会话不会从文件、缓存或元信息混出。 |
| AI24 / [#223](https://github.com/NingRuo-code/Ocean/issues/223) | [按预算清理会话且保护主动保存解释](24-conversation-retention.md) | [#220](https://github.com/NingRuo-code/Ocean/issues/220)、[#122](https://github.com/NingRuo-code/Ocean/issues/122) | 本人可查看会话保存上限、清空或清理状态；普通临时内容可回收，受保护解释、科学记录与接触历史不会被误删。 |
| AI25 / [#224](https://github.com/NingRuo-code/Ocean/issues/224) | [用冻结用例验证在线多步骤与降级](25-online-plan-evaluation.md) | [#209](https://github.com/NingRuo-code/Ocean/issues/209)、[#210](https://github.com/NingRuo-code/Ocean/issues/210) | 本人明确的在线复合请求按已登记有限计划完成，看到每步结果、真实预算和降级；固定模型版本在未用于调整的用例上有可审查表现。 |
| AI26 / [#225](https://github.com/NingRuo-code/Ocean/issues/225) | [汇合各工具真实AI能力并交接完整范围](26-ai-capability-ledger.md) | [#211](https://github.com/NingRuo-code/Ocean/issues/211)、[#213](https://github.com/NingRuo-code/Ocean/issues/213)、[#214](https://github.com/NingRuo-code/Ocean/issues/214)、[#215](https://github.com/NingRuo-code/Ocean/issues/215)、[#216](https://github.com/NingRuo-code/Ocean/issues/216)、[#217](https://github.com/NingRuo-code/Ocean/issues/217)、[#218](https://github.com/NingRuo-code/Ocean/issues/218)、[#219](https://github.com/NingRuo-code/Ocean/issues/219)、[#222](https://github.com/NingRuo-code/Ocean/issues/222)、[#223](https://github.com/NingRuo-code/Ocean/issues/223)、[#224](https://github.com/NingRuo-code/Ocean/issues/224) | 本人从工作台查看按工具、模式和版本登记的AI能力与原成果，能打开真实多轮记录、证据及未完成原因，负责人可据此判断完整交付范围。 |

共26项、156条验收条件、58条直接边（本批39、外部19）。覆盖64/64用户故事和64/64实施检查，与163项既有任务的本地发布记录合并验证无环、直接前置不重复祖先；已通过GitHub CLI回读123项外部前置/祖先节点，与本批依赖合并核验无环、直接前置无冗余；正式发布已再次回读最新祖先和状态，58条原生阻塞已逐项设置并核对。

AI01只等#99，先用合法已知探索A小例贯通明确意图→真实服务→任务/结果→事实，不等真实整月或模型。初始已有必要权限、幂等、有限资源、探索允许集与安全输出，不先开放不受控AI再补安全。AI02当前/历史和AI03多轮条件并行，AI04汇合核事实/单位/限定，AI05持久重开与AI06真实任务操作可分别推进。

AI07消费#145权威接触/相关分区，限制研究集进入读取、提示、历史和缓存；不再建台账，也不等完整G3。AI08先用合法探索集和受控供应方替身核发送用途/字段与拒绝，不宣称真实在线。AI09在模型/许可/费用配置落实后实际验在线单工具，AI10规则有限计划与其并行；AI11消费#103/#107，先交真实A在线多轮核心。AI25汇合真实在线与有限计划，核冻结最终语言用例与预算，二者均不等待所有研究扩展。

AI12的B、AI13月度C、AI15相似案例、AI16短窗、AI17 G3-A、AI18 G3-B、AI19 PRED分别等对应实际交接；AI14才扩展完整C事件板。G3 A/B、相似历史与短窗不互相增加不必要阻塞；没有把#158/#175/#198整体收官或#156/#157条件模型设成统一前置。AI13合法已知比较可先验，AI14补真实两域两板。

AI17/18消费#150/#153各自真实成果与冻结/受控计算；AI19用#193局部独立回测，不等待全部东海空间扩展。不因接口/模型成功而说科研成立，不要求正相关/增益。若只具备离线受控入口，相应切片适配同一计算到实际服务并验证，不能只给脚本链接称可提交。

AI20消费#118已有真实多单元准备，AI21消费#128案例版本/保护，AI22消费#133先支持实际内部A注释PDF，AI23才消费#138扩展既有用途投影及原已支持类型，不让A内部注释导出等待全部C报告。AI24消费#122清理合同，按实际会话体量冻结预算/保护，不把整个TASK生产容量#123设成起步前置；基础上限和许可从首次使用即具备。

所有工具模式都沿AI04核证、原权限/数据合同；在线模式还必须AI08/09合格，研究资料必须AI07与原#167/#181等隔离合格。规则/只读适配票不必等在线模型选择才开发，不得因此提前开放在线或正式保留集。新研究类型完整REPORT、近期滚动预报、真实作业效果和生产部署另验。

AI26提供真实可读的工具/模式/版本能力账与原成果入口，汇合各切片真实证据及未完成原因；每项自己的独立/异常检查随票交付，不拖到最终。AI11可先交核心，AI26才判断声明完整范围。全部成果使用表观捕捞活动口径，准备完成不自动分析，模型不可代算科学值或自主科研。

完整拆分、用户确认与覆盖/依赖检查：[评审记录](draft-review.json)。用户已批准26项粒度和真实阻塞，本轮按依赖顺序创建ready-for-agent执行Issue及GitHub原生阻塞；后续按实际前置领取，不修改或关闭#199/#21/#13及既有任务。

核查状态：26项正文、ready-for-agent标签及58条原生阻塞已逐项回读一致；#199/#21/#13及受检来源规格/任务正文、评论、状态和标签保持不变。当前可领取状态：本批暂无无阻塞项；起点[AI01 / #200](https://github.com/NingRuo-code/Ocean/issues/200)等待#99。实际进度以GitHub实时状态为准。本轮未调用模型或运行科研。

发布证据：[任务与原生阻塞核验记录](../../reports/ocean-ai-ticket-publication-2026-10-24.json)。
