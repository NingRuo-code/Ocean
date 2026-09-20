# P1 GFW/AIS 数据边界与公开规则

> 适用范围：Ocean P1 “历史 AIS 响应 / Front Response Table”闭环。
> 最近复核：2026-09-20。
> 参考来源：Global Fishing Watch API license/rate limits、GFW data caveats、GFW datasets/user guide。

## 1. P1 数据路线

P1 只把 AIS/GFW 数据作为“渔业活动响应”信号使用，不作为渔获量、产量、收益或鱼群生物量真值。

优先路线如下：

1. **公开 GFW apparent fishing effort**：用于本地、课堂、论文方法验证或非商业演示；必须保留 attribution、license 和 caveat。
2. **实验室/合作方 AIS 衍生表**：只接收已脱敏、已聚合或已授权的 apparent fishing effort / fishing hours 字段；原始船轨、MMSI、船名等敏感字段不进入本仓。
3. **本地小型夹具**：当真实样例暂不可用时，用 synthetic fixture 验证数据契约、UI 空态和证据链；fixture 不能被写成真实响应证据。

P1 默认时间窗仍为 `2024-07-01` 至 `2024-08-31`，默认空间范围仍为东海原型窗口。若数据授权或下载范围变化，必须先更新本文档，再执行数据转换。

## 2. Git 提交边界

| 数据 / 产物 | 例子 | 是否允许提交 | 规则 |
|---|---|---:|---|
| 原始 AIS / GFW 下载文件 | raw AIS、API 原始响应、下载 CSV、可含船舶轨迹或细粒度 effort 的源文件 | 否 | 只允许本地临时处理；不得进入 Git。 |
| 0.01 度工作中间表 | 日尺度 apparent fishing effort 网格、缓冲区计算前的细粒度表 | 否 | 可能接近源数据或可逆推出源数据；默认不公开。 |
| 0.05 度展示聚合物 | `data/fishing_effort/<date>.js` | 条件允许 | 仅在 license、attribution、公开展示范围确认后提交；否则只保留生成脚本和本地文件。 |
| Front Response Table | `data/front_response/events.js` | 条件允许 | 可以提交 placeholder、synthetic fixture；真实/样例聚合结果需确认不可逆推出细粒度源数据，并带 source/caveat/status 字段。 |
| 验证表与报告图 | 响应窗口图、多半径对照摘要、截图 | 条件允许 | 只展示聚合统计和方法结论；不能包含原始船轨或细粒度可逆数据。 |
| 数据契约与说明 | 本文档、spec、schema、tickets | 允许 | 必须保持“apparent fishing effort，不等于渔获量/产量/收益”的边界。 |

默认规则：**没有明确授权前，宁可只提交契约、脚本、fixture 和聚合摘要，不提交任何 raw 或细粒度 GFW/AIS 文件。**

## 3. UI 与数据说明必写内容

当 UI、数据说明、报告或截图展示 AIS/GFW 响应证据时，必须包含以下内容：

- **来源**：Global Fishing Watch 或合作方 AIS 衍生数据；如使用 GFW API/数据，按 GFW attribution 要求署名。
- **指标**：apparent fishing effort / fishing hours。
- **单位**：fishing hours，或明确的小时数聚合口径。
- **许可**：GFW API 和服务默认按 CC BY-NC 4.0 非商业使用；商业用途、内部商业产品或付费交付需要单独授权/许可复核。
- **caveat**：该指标来自 AIS 行为和算法估计，是“表观捕捞活动”，不是渔获量、产量、鱼群密度、收益或保证性作业结果。
- **覆盖限制**：AIS 覆盖、接收条件、船舶 AIS 开关、船型/渔具分类、算法误判和数据处理版本会影响时空趋势。
- **缺测规则**：missing coverage / unavailable 表示数据不可用或覆盖不足，不能解释为 zero fishing activity。

推荐 UI 短句：

> 历史 AIS 响应使用 GFW 风格 apparent fishing effort（fishing hours）作为表观捕捞活动信号；它不代表真实渔获量、产量或收益。AIS 覆盖不足时结果显示为不可用，不按 0 处理。

## 4. P1 计算边界

- 事件响应计算可以使用 10 / 20 / 30 km 锋面缓冲区，产品默认解释 20 km。
- 默认解释窗口为锋面事件后 1-3 天；研究图可展示前 7 天至后 7 天。
- 响应增强必须同时比较前 7 天基线和同日非锋面对照区。
- 缺少 coverage、授权范围、日期或空间匹配时，输出 `unavailable` / `not_available`，不能输出“无响应”或 `0 fishing hours` 结论。
- AI 只能组织任务和解释确定性计算结果，不能补全缺失 fishing hours，也不能生成新的科学数值。

## 5. 为什么 P1 不用渔获量 / 产量做真值

P1 目前没有可靠、可复现、可公开验证的渔获量、产量、鱼群生物量或收益数据。GFW/AIS 提供的是基于船舶行为估计的表观捕捞活动，它能回答“锋面附近是否出现作业响应增强”，不能回答“这里能产多少鱼”。

因此第一阶段的研究主线应表述为：

> 基于海洋锋面事件与 AIS apparent fishing effort 的时空匹配，分析锋面附近是否出现可解释的作业响应增强。

而不是：

> 基于锋面预测渔获量、产量或收益。

## 6. 后续变更门槛

以下情况必须先更新本文档和相关 spec，再进入实现：

- 准备提交真实 GFW/AIS 聚合数据到 Git。
- 准备把 GFW/API 数据用于商业、付费或内部商业支持场景。
- 准备展示船级、MMSI、轨迹级或可逆推出原始数据的结果。
- 准备把“渔场可能性”升级为产量、收益或业务级预测。
- 准备把 missing coverage 当作 0 参与评分或增强判定。

