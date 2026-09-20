# Ocean P1 项目拷打与执行记录

> 维护目的：后续执行 P1 GFW/AIS 响应闭环时，每完成一张 ticket，都同步更新本文件。本文档服务于项目推进、答辩准备和后续简历复盘；它不是新的需求来源。若本文档与 `CONTEXT.md`、ADR 或 spec 冲突，以正式领域文档和 spec 为准。

## 0. 当前一句话版本

Ocean 是一个面向渔场作业辅助的海洋锋面分析原型。当前主线不是“做一个地图系统”，而是把海洋锋面抽象为时空事件，结合 SST、冷暖侧、历史锋面频率，以及后续 GFW/AIS apparent fishing effort，形成可解释的作业线索和人机协同分析证据链。

## 1. 项目概述

### 1.1 产品定位

用户给定出发地、作业范围和出海日后，系统回答：

1. 这片水域当前是否存在值得关注的锋面线索？
2. 往年/历史同期是否常出现类似锋面？
3. 后续接入 AIS/GFW 后，类似锋面附近是否出现过表观捕捞活动响应？
4. AI 分析如何把当前、历史、预测参考和限制条件组织成可追溯证据？

### 1.2 技术定位

技术层不强调“地图展示”，而强调：

- Spatiotemporal Front Event：把锋面作为时空事件，而不是静态图层。
- Front Response Table：把 AIS apparent fishing effort 与锋面事件进行窗口匹配。
- Human-AI Visual Analysis：AI 负责任务组织和证据解释，数值由确定性程序计算。
- Evidence Boundary：任何结论都必须写清数据来源、计算口径和不能推出什么。

### 1.3 第一阶段边界

- 使用 GFW-style AIS apparent fishing effort，即 fishing hours。
- 不使用渔获量、产量、收益、鱼群生物量作为真值。
- 不承诺 business-grade forecast。
- 不公开发布 raw 或可逆推出 raw 的 GFW 衍生数据。
- 当前 `data/front_response/events.js` 是 `synthetic_fixture`，只验证契约和 UI 路径，不是真实 AIS/GFW 数据。

## 2. 执行票据

| 编号 | Ticket | 状态 | 说明 |
|---|---|---|---|
| 01 | 锁定 P1 AIS/GFW 数据输入与公开边界 | 已完成 | 已新增数据治理文档并同步到 spec/schema/需求/agent 入口 |
| 02 | 让 Front Response Table 契约可执行 | 已完成 | 已用 synthetic fixture 打通 OFData、当前页卡片和 e2e |
| 03 | 增加响应表数据契约检查 | 已完成 | 已校验日期、半径、字段、状态组合、lift 与 enhanced 规则 |
| 04 | 实现本地 apparent fishing effort 样例转换到 Front Response Table | 已完成 | 已新增 fixture input 与转换脚本，生成 front-response 表 |
| 05 | 计算前后窗口与非锋面对照响应增强 | 已完成 | 已固化时间窗口、非锋面对照和缺测不可用规则 |
| 06 | 把真实/样例 AIS 响应接入当前页和 AI 证据链 | 已完成 | 当前页、AI 证据链和数据说明页已同步 |
| 07 | 补齐 P1 UI 与文案回归检查 | 已完成 | 已补齐 placeholder、上下文联动和误导措辞拦截 |
| 08 | 生成 P1 验证与汇报包 | 已完成 | 已沉淀 P1 验证包与阶段答辩口径 |

## 3. 执行日志

### 2026-09-20

- 已确认 `to-tickets` 拆票粒度：8 张 tracer-bullet tickets。
- 已确认阻塞关系：数据边界 → 表契约 → 数据检查 → 数据转换 → 响应计算 → UI/AI 证据 → 回归检查 → 验证汇报。
- 已确认不拆分“数据获取”和“许可/公开边界”，统一放在第 01 票中解决。
- 新增本文档，后续每执行一票都要追加：做了什么、为什么这么做、验证结果、答辩口径。
- 执行 01：新增 `docs/data-governance-gfw-ais.md`，锁定 P1 只使用 apparent fishing effort / fishing hours 作为渔业活动响应信号；明确 raw AIS/GFW、0.01 度中间表默认不提交，0.05 度展示聚合物和真实 Front Response Table 需 license/public-display 复核后再提交。
- 执行 01：同步更新 `docs/data-schema.md`、P1 spec、需求文档、路线图和 `docs/agents/domain.md`，确保后续任务进入仓库时能读取同一数据边界。
- 执行 01：补充 missing coverage 规则：AIS/GFW 覆盖不足或不可用时输出 unavailable / not_available，不能当作 `0 fishing hours` 或“无响应”。
- 执行 02：把 `data/front_response/events.js` 升级为 `front-response/v1` 契约，当前状态为 `synthetic_fixture`，包含 2024-08-05 F001 的 10/20/30 km 三半径样例，以及 2024-08-06 F001 的无明显增强样例。
- 执行 02：`OFData.frontResponse(date, range)` 现在统一返回标准化对象，覆盖 available、缺日期、缺范围等状态；当前页“历史 AIS 响应”卡片可以展示“夹具 · 响应增强”和“夹具 · 未见明确增强”。
- 执行 02：新增 data-check 和 e2e 断言，验证 fixture 明确标注 synthetic、不是真实 AIS/GFW 证据，且 `front_id_scope = local_day` 不暗示长期锋面轨迹。
- 执行 03：强化 `tools/data-check.mjs` 的 front-response 校验：placeholder 必须清楚表达未接入；sample/real 必须通过日期、半径、front_id、字段、状态组合与索引检查。
- 执行 03：新增数值逻辑检查：available 事件的 effort 必须为有限非负数，`lift_percent` 必须由 pre/post 基本推导得到，`enhanced_flag` 必须符合后 1-3 天高于前 7 天 20% 且高于非锋面对照区的规则。
- 执行 03：新增 missing-as-zero 防线：`missing_coverage`、`not_authorized`、`not_in_sample` 不能携带 fishing hours、lift 或 enhanced flag，避免 UI/AI 把缺测解释成 0 或“无响应”。
- 执行 04：新增 `data/front_response/fixture-effort-sample.json` 作为小型聚合输入夹具。它记录 source、time_window、spatial_window、processing 和 public_boundary，不提交 raw/fine-grained AIS/GFW 数据。
- 执行 04：新增 `tools/build-front-response.mjs`，把本地样例/fixture 转换为 `data/front_response/events.js`。脚本计算 `lift_percent` 和 `enhanced_flag`，生成 `events` 与 `by_date/by_range` 索引，并写入 `generated_by`。
- 执行 04：`node tools/build-front-response.mjs && node tools/data-check.mjs` 已形成可重复的最小转换闭环；后续真实授权样例可通过 `--input` 走同一转换路径。
- 执行 05：扩展 `tools/build-front-response.mjs`，每条响应记录都写入 `pre_window`、`post_window` 和 `exploratory_window`。窗口由事件日期确定：前 7 天为 `date-7 ~ date-1`，后 1-3 天为 `date+1 ~ date+3`，探索窗口为 `date-7 ~ date+7`。
- 执行 05：将非锋面对照区写成可校验契约：同日、同海区、至少离任一锋面 50 km，面积配比为 1，采样口径为 `same-day same-area non-front cells outside every 50 km front exclusion buffer`。
- 执行 05：新增 2024-08-07 F001 / 20 km 的 `missing_coverage` fixture 行。该行不携带 fishing hours、lift 或 `enhanced_flag`，页面只能显示“不可用”，不能输出“响应增强/未见明确增强”。
- 执行 05：强化 `tools/data-check.mjs` 与 `tools/e2e-check.mjs`，校验窗口日期边界、50 km 对照区、增强判定公式，以及 missing coverage 不被解释为 `0 fishing hours`。
- 执行 05 review：补齐每个 `front_event_id` 的 10/20/30 km 三档 buffer 覆盖检查。覆盖不足时也要用 `missing_coverage` 显式占位，不能让缺一档被默默跳过。
- 执行 05 review：补充 `method.control_validation`，说明当前 synthetic fixture 只声明聚合对照区采样口径；真实输入接入前必须先完成 50 km 锋面排除的地理校验。
- 执行 06：当前页“历史 AIS 响应”卡片现在在 collapsed state 显示响应状态、短 caveat、post1-3 fishing hours、lift 和 non-front control value；展开项显示 pre/post/exploratory window、front_event_id、source、metric/unit、增强判定和公开边界。
- 执行 06：AI 分析页把 AIS response 作为 evidence source 纳入证据链，展示确定性 response artifact 的状态和数值摘要；AI 仍只负责任务编排与证据组织，不生成 fishing hours 或科学数值。
- 执行 06：数据说明页补齐 AIS source、metric/unit、license/public-display boundary、control validation 和“不参与 Product Score”的规则说明。
- 执行 07：补齐 UI 回归检查。placeholder 状态会临时关闭 Front Response Table，验证历史 AIS 响应卡片只能显示“待接入/暂不参与”，不能输出 fishing hours、lift 或 control 数值。
- 执行 07：补齐全局上下文联动检查。切换日期和作业范围后，AIS 响应证据必须使用同一个 `state.date + state.range` 查询结果，并展示对应的 pre/post window 与数值明细。
- 执行 07：新增产品文案边界检查，显式拦截“产量预测”“收益预测”“guaranteed catch”“yield prediction”“保证有鱼”等误导性 UI 措辞，确保 AI 分析页和数据说明页只表达作业线索与证据边界。
- 执行 08：新增 `docs/reports/ocean-p1-validation-package.md`，汇总典型事件 `2024-08-05:F001` 的前后窗口、10/20/30 km 敏感性、非锋面对照、缺测空态、UI 查看路径和 P1 数据边界。
- 执行 08：验证包明确当前 `data/front_response/events.js` 是 `synthetic_fixture`，只用于验证契约和界面路径，不是真实 AIS/GFW 证据，也不代表渔获量、产量或收益。
- 执行 08：同步更新交接与 UX 文档中的验收数量，当前基线为 data-check 897 项、e2e-check 108 项、layout-check 25 项。

## 4. 项目真实性准备

### Q1：这个项目到底解决什么问题？

它解决的是渔场作业辅助中的“哪里值得关注、依据是什么、边界在哪里”的问题。系统不是直接告诉用户一定有鱼，而是基于海洋锋面、SST、冷暖侧、历史锋面频率，以及后续 AIS apparent fishing effort 响应，给出作业线索和证据说明。

### Q2：为什么不是产量预测？

因为第一阶段没有可靠渔获量、鱼群生物量或收益数据。GFW/AIS 能提供的是 apparent fishing effort，也就是由船舶活动估计出的表观捕捞小时数。它可以作为“渔业活动响应”的 proxy，但不能直接等同于产量或收益。

### Q2.1：为什么第一阶段不使用渔获量/产量作为真值？

因为 P1 目前没有可复现、可公开验证、能和锋面事件逐日逐空间匹配的渔获量或产量数据。若直接把 AIS/GFW 的 fishing hours 写成产量，会把“作业活动响应”误读成“捕获结果”。第一阶段的可答辩说法是：用 apparent fishing effort 研究锋面附近是否出现表观作业响应增强，产量/收益预测属于后续有真实业务数据后的扩展。

### Q3：为什么要做非锋面对照？

如果只看锋面附近 fishing hours 增加，无法判断这是锋面影响，还是同一天整个海区捕鱼活动都增加。非锋面对照区提供同日、同海区、远离锋面的背景对比，能避免把普通背景活动误读成锋面响应。P1 里要求对照区至少离任一锋面 50 km，并使用同面积采样，是为了让“锋面附近”和“非锋面背景”的差异可解释、可复现，而不是只用绝对 fishing hours 做判断。

### Q4：AI 在项目里到底做什么？

AI 不直接生成科学数值，也不替代确定性计算。它负责把用户意图拆成任务，把当前锋面、历史频率、规则预测参考、AIS 响应和限制条件组织成可追溯证据链，并用产品语言解释结果。

### Q5：当前最大风险是什么？

第一是数据许可和公开边界：GFW 公开数据存在非商业限制，raw 或细粒度衍生数据不能随意提交和公开。第二是概念误读：apparent fishing effort 很容易被误写成渔获量或产量预测，所以 UI、文档和测试都要守住词汇边界。

### Q6：哪些 AIS/GFW 产物可以进入仓库？

可以提交契约、脚本、placeholder、synthetic fixture 和经过复核的聚合摘要。默认不提交 raw AIS/GFW 下载文件、API 原始响应、0.01 度工作中间表或任何能逆推出源数据的细粒度产物。真实 0.05 度展示聚合物和 Front Response Table 只有在 license、署名、公开展示范围都确认后才提交。

### Q7：Front Response Table 的最小字段是什么？

一条响应记录至少包含 `response_id`、`front_event_id`、`date`、`front_id`、`front_id_scope`、`buffer_km`、`pre7_hours`、`post1_3_hours`、`non_front_control_hours`、`lift_percent`、`enhanced_flag` 和 `status`。其中 `front_id_scope = local_day` 是关键边界：`F001` 只表示某一天导出数据里的本地临时锋面对象，不表示跨天追踪出来的同一条长期锋面。

### Q8：为什么要先接 synthetic fixture？

它不是为了制造科学结论，而是为了先验证数据契约、`OFData` 适配器和当前页 UI 是否能吃下 response artifact。这样后续真实 GFW/AIS 样例到位时，只需要替换生成流程和数据文件，而不是边拿数据边改界面和字段口径。

### Q9：数据契约检查如何防止 AI/前端编造科学数值？

检查把“能不能展示”前置到数据层：日期必须在样本内，`front_id` 必须属于当天锋面对象，`buffer_km` 只能是 10/20/30，available 事件必须给出有限数值，不可用事件不能给 0 小时或增强标记。这样前端和 AI 只能解释通过校验的确定性结果；缺测、未授权、缺范围都只能显示 unavailable，不能被包装成“无响应”或“响应增强/不增强”。

### Q10：从 apparent fishing effort 到产品证据的链路是什么？

链路分四步：第一，输入是本地授权样例或小型聚合 fixture，只包含事件级/半径级 fishing hours 摘要，不提交 raw AIS/GFW 或 0.01° 细粒度表；第二，转换脚本按 `date + local front_id + buffer_km` 生成响应记录；第三，脚本计算前 7 天基线、后 1-3 天响应、非锋面对照区和 lift/enhanced 结论；第四，`OFData.frontResponse(date, range)` 把记录提供给当前页和 AI 证据链，UI 只解释确定性数据，不自行生成科学数值。

### Q11：为什么 missing coverage 不能写成“无明显增强”？

missing coverage 表示 AIS/GFW 数据覆盖不足、授权不可用或样本不在当前统计范围内。它只说明“这条响应证据不可用”，不能说明船没有作业，也不能说明锋面没有影响。因此数据层不输出 fishing hours、lift 或 `enhanced_flag`，UI/AI 只能显示 unavailable 和原因说明。

### Q12：AI 为什么只做证据组织，不直接算 fishing hours？

fishing hours、lift、control value 和 enhanced flag 都必须来自确定性数据处理脚本与可校验的 Front Response Table。AI 的职责是把用户问题拆成“当前锋面、历史同期、AIS 响应、规则预测、限制条件”等证据块，并解释每块证据的来源和边界。如果让 AI 直接生成数值，就会破坏可追溯性，也容易把 fixture、缺测或 proxy 数据误写成真实渔获结论。

### Q13：如何测试大模型/AI 证据链不幻觉？

P1 不直接测试大模型“会不会想象”，而是把 AI 能说的话限制在可验证证据链里：数值必须来自 Front Response Table，缺数据只能显示 unavailable，placeholder 不能输出 fishing hours、lift 或 control 值。回归检查会覆盖 AI 分析页和数据说明页，确认它们只引用确定性 artifact、数据来源、计算窗口和边界说明，并拦截“产量预测”“收益预测”“guaranteed catch”“yield prediction”“保证有鱼”等越界措辞。

### Q14：P1 完成后项目价值是什么？

P1 把 Ocean 从“锋面地图原型”推进到“渔场作业辅助证据链原型”：用户看到的不只是某一天有无锋面，还能看到历史 AIS response 的方法入口、前后窗口、非锋面对照、三半径敏感性和不可用状态。对外讲法是：产品层帮助用户形成作业线索，技术层验证时空锋面事件与 apparent fishing effort response 的匹配、比较和可解释展示。

### Q15：P1 的技术难点怎么讲？

难点不是把数字放到页面上，而是把跨来源数据变成可追溯事件证据：锋面对象是本地日尺度 front event，AIS/GFW 是另一套时空活动信号；系统需要定义事件身份、buffer、pre/post window、非锋面对照、enhanced rule 和 missing coverage 规则，并用测试防止 UI 或 AI 把 proxy 数据写成产量、收益或保证性结论。

## 5. 技术难点记录

### 难点 1：时空事件匹配

锋面数据是 0.05 度逐日网格和本地临时 front_id；AIS/GFW apparent fishing effort 是另一类时空数据。项目需要把两者通过日期、空间 buffer 和事件身份连接起来，而不是简单叠两张图。

### 难点 2：响应增强不能只看总量

仅展示 fishing hours 总数没有意义。必须比较前 7 天基线、后 1-3 天响应、同日非锋面对照区，才能解释“响应增强”是否成立。当前实现把窗口边界写入每条响应记录并由校验脚本复算，避免后续 UI 或 AI 只拿一个汇总数字却说不清楚它来自哪段时间。

### 难点 3：缺测不能当作 0

AIS 覆盖、接收条件、数据授权和下载范围都会造成缺测。缺测意味着 unknown，不代表没有捕鱼活动。数据契约和 UI 空态都要表达这一点。

### 难点 4：产品语言要克制

“渔场可能性”和“作业线索”是允许的；“产量预测”“收益预测”“保证有鱼”是不允许的。这个边界决定了系统能否站得住。

## 6. Todo

- [x] 执行 01：锁定 P1 AIS/GFW 数据输入与公开边界。
- [x] 执行 02：让 Front Response Table 契约可执行。
- [x] 执行 03：增加响应表数据契约检查。
- [x] 执行 04：实现本地 apparent fishing effort 样例转换到 Front Response Table。
- [x] 执行 05：计算前后窗口与非锋面对照响应增强。
- [x] 执行 06：把真实/样例 AIS 响应接入当前页和 AI 证据链。
- [x] 执行 07：补齐 P1 UI 与文案回归检查。
- [x] 执行 08：生成 P1 验证与汇报包。
- [ ] 每完成一张 ticket，更新本文件的执行日志、技术难点和 Q&A。
- [ ] `gh` 可用后，把本地 tickets 发布到 GitHub Issues，并应用 `ready-for-agent` 标签。
- [ ] P1 闭环完成后，再回头整理简历项目表达。
