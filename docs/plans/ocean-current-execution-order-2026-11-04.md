# Ocean 当前实现顺序与精简决定

生效日期：2026-11-04。用户已明确要求处理可精简 ticket，并将实现顺序写入项目记忆。本页为后续领取任务的当前入口；历史规划保留作决策依据，当前范围与顺序以本页及 GitHub 实时状态为准。

## 2026-11-19 演示优先，正式服务器验收暂缓

继续使用已配置的校园开发资源，不等待账号余量数字才开展小范围工作；账号实际已用和可用容量仍未核验。保留 #227 固定版本回环演示和工作站共享屏幕的路径。受控网页入口尚未知，独立备份途径暂缓，因此暂停需要这些证据的正式 #228 准入、#11 独立设备验收及相关恢复。#47 的盘点证据保留，未核条件不标完成。演示不依赖重新开放端口。

不受这些条件限制的任务继续按原依赖执行。研究先复核 #67 来源和覆盖，再进入 #68 → #71 → #98；未取得来源定义或共同支持不计算正式真实整月。提供方询证继续按既定决定暂缓。

## 2026-11-18 服务器优先执行

用户调整近期顺序，先在现有校内 SothisAI 上完成当前具备条件的服务器配置和实测，再转回真实 A 月。近期从 #13 沿 #47 → #228 → #11 领取工作，复用 #227 的隔离只读发布和已经验证的候选包。下一批暂排在真实 A 月前，具体完成条件见[运行手册](../../deploy/RUNBOOK.md#sothisai-configuration-and-review--2026-11-18)。

1. [#47](https://github.com/NingRuo-code/Ocean/issues/47) 实测 SothisAI 的 CPU 和内存限额、持久存储及账号余量、运行时、原档/派生/缓存/结果/暂存/备份各层和访问链路。已有 CPU、共享盘和容器内 HTTP 证据。平台登录和项目网页入口分别核对。
2. [#228](https://github.com/NingRuo-code/Ocean/issues/228) 核固定提交和包身份、环境与只读权限、候选与回退版本并存空间，以及实际代理和备份恢复点。已有容器内安装、恢复和回退证据。服务入口、账号配额余量及独立备份仍需实际核验。校内小范围准入依据当前配置，正式服务准入依据目标和实际工作集。
3. [#11](https://github.com/NingRuo-code/Ocean/issues/11) 在获准的校园网或 aTrust 项目入口进行外部冒烟，再由助教或老师从自己的设备完成预约实操。当天入口不可用时按已定方案共享屏幕讲解，补约独立实操。SothisAI V2.8 普通用户手册说明 WebShell、Jupyter 快捷入口与服务端口信息，普通账号自定义项目入口仍需校方给出支持方式。
4. 完成当前服务器批次后，按下文恢复 #67 → #68 和后续研究。#229/#230/#232 的权限和状态切换、#248 的混合负载、#249 的真实 A 生产发布及 #251 的完整生产交付保留各自的功能、资源和许可前置。依赖真实成果的生产验收在真实成果具备后执行。

## 2026-11-18 完整实现与服务器安排

用户确认继续完成[完整研究版](ocean-master-plan-2026-10-24.md)。服务器批次后，研究沿[执行总纲 #13](https://github.com/NingRuo-code/Ocean/issues/13)完成真实 A 月，再推进真实 B 事件、C 区域比较及其余已批准能力。来源证据等待期间，可沿现有票据推进对最终交付必要、且前置已具备的工作。

| 交付 | 沿用的票据 | 下一步与完成条件 |
| --- | --- | --- |
| 首个真实 A 月 | [#37](https://github.com/NingRuo-code/Ocean/issues/37)、[#38](https://github.com/NingRuo-code/Ocean/issues/38) 的来源审计，复跑 [#44](https://github.com/NingRuo-code/Ocean/issues/44)、[#64](https://github.com/NingRuo-code/Ocean/issues/64)，再按 [#67](https://github.com/NingRuo-code/Ocean/issues/67) → [#68](https://github.com/NingRuo-code/Ocean/issues/68) | 首先取得 2024-08 锋面时间写出与格网依据、固定 GFW v3 的 UTC 日界和逐日逐格有效支持，核对原档、粒度和许可后重审同一请求。11 月 19 日复核锋面 8/31、GFW 4/31，三个半径均为 0/31 天。准入通过后先冻结方案，再计算真实整月。公开固定版取数无需另等令牌。[补档与复跑入口](../reports/ocean-august-source-readiness-2026-11-06.md) |
| 真实 A 结果展示与证据交接 | [#69](https://github.com/NingRuo-code/Ocean/issues/69)、[#70](https://github.com/NingRuo-code/Ocean/issues/70) 与 #68 汇合到 [#71](https://github.com/NingRuo-code/Ocean/issues/71) → [#98](https://github.com/NingRuo-code/Ocean/issues/98) | 主图、说明、逐日证据、允许导出的基础图表和复算使用同一结果身份，再接入工作台只读展示。保存、保护及正式 PDF、PNG、CSV 成果包沿 [REPORT #125](https://github.com/NingRuo-code/Ocean/issues/125) 的 [#126–#140](../tickets/report-case-and-export/README.md)，其中 [#134](https://github.com/NingRuo-code/Ocean/issues/134) 承接真实 A 案例包。 |
| 真实 B/C 与后续能力 | [B #72](https://github.com/NingRuo-code/Ocean/issues/72) 的 #74–#84，[C #85](https://github.com/NingRuo-code/Ocean/issues/85) 的 [#86–#94](../tickets/c-regional-evidence-comparison/README.md)，以及本页后续与条件性能力 | B 实际运行固定区完整前后窗，#83 消费 #71，#84 交接真实事件成果。C 等可比真实成果。独立复核、预测、AI、任务、报告和运维按各自已有前置进入。 |
| 校内研究复跑与预约验收 | 取数和复跑沿 #67/#68，小范围只读发布复用 [#227](https://github.com/NingRuo-code/Ocean/issues/227) 与 [PR #351](https://github.com/NingRuo-code/Ocean/pull/351) 的 Linux 隔离验证 | SothisAI 已完成三日复跑和容器内只读启动、回退、恢复。预约前确认获准的校园网或 aTrust 项目网页入口。约定时段由助教或老师从自己的电脑打开页面，切换日期或图层，打开一个已知合成案例，找到证据与缺失提示。当天无法访问时先共享屏幕讲解，再补独立实操。项目网页入口和实操待验。 |
| 实际服务器与正式发布 | [#47](https://github.com/NingRuo-code/Ocean/issues/47) → [#228](https://github.com/NingRuo-code/Ocean/issues/228)，再按 [#11](https://github.com/NingRuo-code/Ocean/issues/11) 同步及冒烟。生产沿 [OPS #226](https://github.com/NingRuo-code/Ocean/issues/226) 的 [#227–#251](../tickets/ops-release-observability-and-recovery/README.md) | 先确认实际目标、访问和代理、分层工作集、权限、容量及备份恢复点。#11 保留同步与真实入口验证。完整入口权限、版本切换与回退、备份恢复和混合负载继续按 OPS 原票，首批真实 A 生产归 [#249](https://github.com/NingRuo-code/Ocean/issues/249)，完整生产能力交付归 [#251](https://github.com/NingRuo-code/Ocean/issues/251)。正式目标与上线仍待确认。 |

本地研究按来源、许可和分析条件准入。校内预约实操记录在 #11，正式发布另记录目标和线上证据。入口与版本继续沿 [#229](https://github.com/NingRuo-code/Ocean/issues/229)、[#230](https://github.com/NingRuo-code/Ocean/issues/230) 和 [#232](https://github.com/NingRuo-code/Ocean/issues/232)，备份与隔离恢复沿 [#236–#242](../tickets/ops-release-observability-and-recovery/README.md)。容量估算使用 #47 的代表性分层工作集、[#46](https://github.com/NingRuo-code/Ocean/issues/46) 的交互基线和 [#248](https://github.com/NingRuo-code/Ocean/issues/248) 的混合负载实测。三日研究任务和容器内只读回退只记录已测范围。部署操作见[运行手册](../../deploy/RUNBOOK.md)。

## 近期执行证据与历史状态

**2026-11-06 状态：** #330 经 PR #331 合并关闭；#37/#38 经 PR #332 按来源审计交付关闭，未知源语义留在研究资格。#39 → #41 → #44 → #42 → #43 由 PR #333–#337 关闭；#62 → #64 → #63 → #65 → #66 由 PR #338–#342 关闭。#67 的[登记合成冻结与敏感性验证](../reports/ocean-month-sensitivity-software-2026-11-06.md)已完成；正式 #67 与 #68 开放。下方 11 月 4–5 日的就绪标签和等待令牌等为历史快照。[来源审计验收与边界](../reports/ocean-source-audit-completion-2026-11-05.md)。

11月5日公开真源更新：GFW官方Zenodo14982712 / 3.0.0三日0.01°fleet已下载并按原CLI核对，与独立Decimal小时总量一致；无需API令牌。首两票的剩余前置改为锋面时间写出依据及GFW日界/有效支持，不再仅等待访问凭据。#37/#38真实资格仍未结项，原顺序和依赖不变。[实施与下一步](../reports/ocean-gfw-public-intake-implementation-2026-11-05.md)。

11月5日实施进展：#37真实分类/缺失值与SST日历适配已实现并复跑三日，尚缺作者时间起点依据；#38已修正许可并加入完整响应留存，用户确认暂无GFW令牌。两票真实验收保持开放并标needs-info，#37移除就绪标签。顺序不变，接续需先补时间依据与GFW访问/固定版本；#39等下游不越过前置。[实施证据](../reports/ocean-real-source-adapter-implementation-2026-11-05.md)。下方数量/就绪标签为11月4日票据精简快照。

11 月 4 日精简回执：当时 GitHub 共 295 项 Issue（241 开放、54 关闭），原执行集合为 29 项历史完成、8 项归并、215 项开放。M1/M2/后续候选池分别为 18/11/186 项，当时仅 #37 有就绪标签。

## 研究目标与领取规则

研究主线先交付一个可从固定版本原档复算的真实 A 完整月结果，包括支持/排除说明、同日距离关系、有效面积时间、可比对照、不确定性或降级理由，并在已有工作台读取。首选东海2024年8月，是否合格由真实审计决定。

研究的内部顺序是 **真实源证据 → 首选月准入复核 → 正式 #67 → 真实 #68**。先取得锋面时间起点与 GFW 日期分配、有效支持和零/未知的依据，再用固定版本补齐月历、核对格网粒度与用途许可，重新运行 #44/#64 的具体点位和半径。2024-08 中心 10/20/30 km 都是 0/31 天通过共同支持。GFW 已有固定版本官方原包，不需等待令牌；准入通过后才冻结正式主方案与变体，再计算真实效果。已有合成例用于校验软件，不作为真实月输入。

[八月原档预检](../reports/ocean-august-source-readiness-2026-11-06.md)已核对固定锋面与 GFW 归档各有 31 日、可选海温有 31 个官方 UTC 坐标，并为显式逐文件审计解除容量限制。11 月 19 日重算缺失成员压缩流量约 304.5 MB，不含 HTTP 开销和海温。先按预检所列字段取得可归档的提供方依据，再执行批量获取和真实资格复核；不借用其他年代的接收质量估计或新版地图/API 说明替代固定版本的依据。

11 月 19 日 #67 公开复核已补上[上游海温格网与时刻](../research/ocean-front-upstream-grid-evidence-2026-11-19.md)、[固定 v3 的数据仓库与日期类型](../research/ocean-gfw-fixed-v3-public-evidence-2026-11-19.md)和[原档中缺行、零及正值的对照](../research/ocean-gfw-v3-local-cell-evidence-2026-11-19.md)。三项支持样本解释，未改变真实数据门槛。后续优先找绑定当前锋面写出、固定活动 UTC 日界和 2024-08 有效支持的公开依据；此前不对外询证的决定继续有效。

用户已确认允许并行筛查公开替代源并做小样。候选须先核对 2024-08 日历、登记研究域的共同覆盖、单位及研究与展示许可，再向用户提交候选和对算法、侧别、尺度及票据的影响，确认后定正式输入。已实读 [NOAA 锋面与海温](../research/ocean-august-public-front-alternatives-2026-11-19.md)和 [GFW ArcGIS 活动](../research/ocean-august-public-activity-alternatives-2026-11-19.md)小样。现有候选尚不能合成满足条件的整月输入，继续沿 #67 → #68 → #71 → #98 推进完整项目。

每次领取前读取 Issue 正文、评论及原生依赖，核对实际输入。里程碑表示范围，`ready-for-agent` 才表示当前可领取；标签也不能替代事实核对。一次优先完成一个可验收切片，最多同时推进两个不冲突的切片。真实数据、科学验收、软件完成与生产部署分别记录。

## M1：首个真实 A 月结果

[GitHub M1](https://github.com/NingRuo-code/Ocean/milestone/1)共18张原票。以下是满足依赖的保守串行顺序；有独立条件时可按后面的分支顺序提前推进。

| 顺序 | Ticket | 主要完成条件 |
| --- | --- | --- |
| 1 | [#37](https://github.com/NingRuo-code/Ocean/issues/37) | 实际锋面/SST日期、单位、坐标、分类、填充值与有效支持有依据；非标准时间未核实则保留未知 |
| 2 | [#38](https://github.com/NingRuo-code/Ocean/issues/38) | GFW原包/版本/许可、日界、粒度、覆盖、零与未知以及小时守恒可追溯 |
| 3 | [#39](https://github.com/NingRuo-code/Ocean/issues/39) | 公里几何、共同支持、分子分母与边界小例可复算 |
| 4 | [#41](https://github.com/NingRuo-code/Ocean/issues/41) | 完整日历和不同分析用途的数据资格可判定 |
| 5 | [#44](https://github.com/NingRuo-code/Ocean/issues/44) | 真实候选月与事件窗口缺口的逐日审计完成，不以文件存在判合格 |
| 6 | [#42](https://github.com/NingRuo-code/Ocean/issues/42) | 查询实际消费同一支持判定 |
| 7 | [#43](https://github.com/NingRuo-code/Ocean/issues/43) | 来源/方法变化不会沿用旧资格，旧快照仍可识别 |
| 8 | [#62](https://github.com/NingRuo-code/Ocean/issues/62) | 用真实适配的日级输入计算距离配对及月度密度 |
| 9 | [#64](https://github.com/NingRuo-code/Ocean/issues/64) | A计算实际按P0用途资格放行或解释拒绝 |
| 10 | [#63](https://github.com/NingRuo-code/Ocean/issues/63) | 有支持的冷暖侧及环境子分析，未知侧不强行分类 |
| 11 | [#65](https://github.com/NingRuo-code/Ocean/issues/65) | 同月同日可比背景、支持差异与匹配失败可检查 |
| 12 | [#66](https://github.com/NingRuo-code/Ocean/issues/66) | 区间考虑相关日组，独立支持不足时正确降级 |
| 13 | [#67](https://github.com/NingRuo-code/Ocean/issues/67) | 正式目标期效果计算前固定主方案及有界敏感性；已看过效果则如实标探索性 |
| 14 | [#68](https://github.com/NingRuo-code/Ocean/issues/68) | 在真实完整月执行主方案与变体，交付可核对结果 |
| 15 | [#69](https://github.com/NingRuo-code/Ocean/issues/69) | 主图、聚合表、解释与逐日证据来自同一结果 |
| 16 | [#70](https://github.com/NingRuo-code/Ocean/issues/70) | 正确版本复用，读取不重算，变化后不串用 |
| 17 | [#71](https://github.com/NingRuo-code/Ocean/issues/71) | 真实结果、主图、直接计算与复用路径完成复算交接 |
| 18 | [#98](https://github.com/NingRuo-code/Ocean/issues/98) | 现有工作台可只读展示真实A结果、资格和局限 |

可分别推进的分支：

- #39后，#41与#62可分别开展；#41后，#44、#42→#43、#64可分别开展。
- #62后，#63与#65→#66可分别开展；#63/#64/#66汇合到#67。
- #67/#44→#68，#63/#66→#69，#64/#43→#70；三条分支汇合到#71→#98。#68不必等待缓存复用#70。
- 已关闭的原前置仍作为已交付合同复用；此处省略其编号不代表删除依赖。

三日下载只验证接入，不能作为整月或前后七日研究完成证据。SST/强度按原用途合同处理，可选层不足只影响相应子分析。零/未知、许可、有效面积、对照和复算要求继续保留。

## M2：真实 B 固定区域事件

[GitHub M2](https://github.com/NingRuo-code/Ocean/milestone/2)包含#74–#84。整体排在首个真实A交付之后；A日级量等依赖先具备时可提前做独立切片：

1. #74（需要#62）→#75（另需#41）→#76→#77（另需#65）。
2. #78（另需#66）与#79分别推进，汇合#80；#80和#71具备后做#83真实事件案例。
3. #81等待#78/#79；#82等待#75/#70；#81/#82/#83汇合#84真实复算交接。

原#9的前后窗口、真实后7日、对照、指标、相关组区间/适用检验及复算要求迁入#72/#83/#84；当前B采用固定研究区域。旧移动锋线缓冲是历史基线，不能混称为固定区事件结果。窗口或对照不足时保持不可推断，不要求结果必须增强或显著。

实施#74前同步澄清`CONTEXT.md`及既有ADR与新版B的几何/判定术语，保留变更依据；旧20%增强阈值和固定50 km对照描述不自动成为新B的计算规则。具体规则仍按源精度、合法探索和冻结协议确定。

## 后续与条件性能力

[候选池](https://github.com/NingRuo-code/Ocean/milestone/3)承接其余原开放执行票，不以填满该池作为M1完成条件。

| 类别 | 启动条件与顺序 |
| --- | --- |
| [G3 独立复核 #141–#158](../tickets/g3-independent-validation/README.md) | A/B 主方案固定且有独立合法样本，先跨期，再按证据扩展海域。所有实际结果均可报告。 |
| [C 比较 #85–#94](../tickets/c-regional-evidence-comparison/README.md)、[G3 相似案例 #159–#175](../tickets/g3-similar-case-and-auxiliary-matching/README.md) | 有真实可比成果或足够案例，并明确比较或检索问题。 |
| [预测 #176–#198](../tickets/prediction-baselines-and-independent-backtest/README.md) | 具备可知输入、活动标签、时间切分和独立评估资料，先建立简单基线，再检验锋面增量。 |
| [AI #199–#225](../tickets/ai-multiturn-evidence-workbench/README.md) | 确定性计算已能提供真实证据，且确有自然语言调用需求。 |
| [工作台 #95–#108](../tickets/w-analysis-workbench/README.md)、[TASK #109–#124](../tickets/task-center-and-data-preparation/README.md) | 按已验证成果接入功能。在线重算按实测时长、失败恢复或并发需求推进，启用清理时同时具备保护合同。 |
| [REPORT #125–#140](../tickets/report-case-and-export/README.md) 及[报告扩展 #252–#279](../tickets/research-report-extension/README.md) | 真实成果稳定且有具体使用需求时复用现有预览和导出，按原票推进多类型、PDF、长表与导出取消。 |
| 性能 | #46先取代表性真实基线。#54–#59完整条件和验收集中#45，只在瓶颈成立后重开所选原票；不逐个套技术 |
| 服务器/OPS | 近期优先在 SothisAI 推进 #47 → #228 → #11。完整生产 OPS 按实际访问、工作集、备份与真实成果进入。 |
| #330 既有收尾 | 已随 PR #331 合并关闭。 |

## 已批准的归并与进度口径

- #9归并到#72/#83/#84；#12旧阶段复核责任归并到#226/#13，并由实际数据、资源和发布票承担。
- #54–#59六个条件性实验归入#45，保留原文、进入条件和完整验收。唯一内部阻塞#57→#58保留为历史关系，重启Mosaic候选仍要先取得普通聚合参照。
- 上述8票以`not_planned`关闭，不计作功能完成。原252项固定账仍单列29项历史完成、本轮8项归并及剩余开放项；当前数量以执行记录和GitHub为准。
- 所有未就绪票移除`ready-for-agent`；当前仅#37保留。#38/#47/#11用`needs-info`说明外部前置。后续按真实前置重新授予就绪标签，不自动全部恢复。
- 原始数据、语义审计、几何和统计验收不因归并取消；原生依赖保留。本轮不启用删除/清理资料、不改产品计算、不部署生产。

本轮实际远端回读与数量见[执行记录](../reports/ocean-ticket-pruning-execution-2026-11-04.json)；此前[精简分析](ocean-roadmap-pruning-review-2026-11-04.md)保留为决策依据。后续接续首先从本页和[项目交接记忆](../agents/project-handoff.md)读取当前方向。
