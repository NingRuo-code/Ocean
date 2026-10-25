# Ocean P1 验证与汇报包

> 适用范围：P1 GFW/AIS apparent fishing effort 样例闭环。
> 生成日期：2026-09-20。
> 数据状态：`synthetic_fixture`，只验证数据契约、计算口径、UI 路径和证据链，不是真实 AIS/GFW 证据。

## 1. 一句话结论

P1 已形成“锋面事件 → 前后窗口 → 非锋面对照 → 三半径敏感性 → 当前页历史 AIS 响应 → AI 证据链”的最小闭环。当前结果只能说明系统能够用 apparent fishing effort 表达“锋面附近是否出现表观作业响应增强”的分析路径；它不代表渔获量、产量、收益、鱼群生物量或保证性作业结果。

## 2. 复现入口

| 项 | 路径 / 命令 | 说明 |
|---|---|---|
| 响应表 | `data/front_response/events.js` | `front-response/v1`，当前为 synthetic fixture |
| 输入夹具 | `data/front_response/fixture-effort-sample.json` | 小型聚合输入，不含 raw AIS/GFW 或 0.01 度细粒度表 |
| 转换脚本 | `node tools/build-front-response.mjs` | 从聚合输入生成 Front Response Table |
| 数据校验 | `node tools/data-check.mjs` | 校验响应表字段、窗口、三半径覆盖、缺测不可当 0 |
| 页面回归 | `node tools/e2e-check.mjs` | 校验当前页、AI 证据链、数据说明和误导措辞拦截 |
| 布局回归 | `node tools/layout-check.mjs` | 校验 1680 / 1280 两档布局与 AIS 响应卡片可读性 |

`tools/e2e-check.mjs` 会在系统临时目录写出页面截图：`shot-1-now.png`、`shot-2-now-detail.png`、`shot-5-basis.png` 等，可用于本地汇报截图。仓库内默认只提交报告和聚合 fixture，不提交浏览器临时截图。

## 3. 典型事件响应窗口

典型事件：`front_event_id = 2024-08-05:F001`。

| 字段 | 值 |
|---|---|
| 事件日期 | 2024-08-05 |
| `front_id_scope` | `local_day`，`F001` 只表示当天本地锋面对象，不是长期锋面轨迹 |
| 前 7 天基线 | 2024-07-29 ~ 2024-08-04 |
| 后 1-3 天默认解释窗口 | 2024-08-06 ~ 2024-08-08 |
| 前后 7 天人工复核窗口 | 2024-07-29 ~ 2024-08-12 |
| 默认产品半径 | 20 km |

默认 20 km 响应摘要：

| 指标 | 数值 |
|---|---:|
| pre7 apparent fishing effort | 42.5 fishing hours |
| post1-3 apparent fishing effort | 57.8 fishing hours |
| non-front control | 36.4 fishing hours |
| lift | +36% |
| enhanced flag | true |

解释口径：post1-3 fishing hours 同时高于前 7 天基线的 120% 和同日非锋面对照，因此 synthetic fixture 标记为“响应增强”。该结论只验证方法链路，不声称现实中 2024-08-05 的该锋面真实触发了捕捞活动。

## 4. 三半径敏感性

事件：`2024-08-05:F001`。

| buffer | pre7 | post1-3 | non-front control | lift | 状态 |
|---:|---:|---:|---:|---:|---|
| 10 km | 31.2 h | 34.0 h | 28.7 h | +9% | 无明显增强 |
| 20 km | 42.5 h | 57.8 h | 36.4 h | +36% | 响应增强 |
| 30 km | 61.0 h | 78.7 h | 52.3 h | +29% | 响应增强 |

产品默认解释 20 km，因为它和用户的默认作业范围一致；研究汇报展示 10 / 20 / 30 km 三档，用来说明结论对空间窗口是否敏感。这个 fixture 中 20 km 与 30 km 都增强，10 km 不增强，说明响应判定会受到 buffer 选择影响，不能只拿单一半径做唯一结论。

对照事件：`2024-08-06:F001`。

| buffer | pre7 | post1-3 | non-front control | lift | 状态 |
|---:|---:|---:|---:|---:|---|
| 10 km | 29.0 h | 30.4 h | 27.5 h | +5% | 无明显增强 |
| 20 km | 39.6 h | 41.1 h | 40.8 h | +4% | 无明显增强 |
| 30 km | 58.0 h | 60.2 h | 55.4 h | +4% | 无明显增强 |

该对照事件用于验证 UI 能展示“无明显增强”，也说明系统不是只会输出正例。

## 5. 非锋面对照摘要

P1 的增强判定不只看锋面附近 fishing hours 是否增加，而是同时比较：

1. 同一锋面 buffer 的前 7 天基线。
2. 同日、同海区、远离任一锋面至少 50 km 的非锋面对照区。
3. 与 buffer 面积可比的对照采样口径。

当前 fixture 的对照定义：

| 字段 | 值 |
|---|---|
| `control_min_distance_km` | 50 |
| `control_area_ratio` | 1 |
| `control_sampling` | same-day same-area non-front cells outside every 50 km front exclusion buffer |
| `control_validation` | synthetic fixture 只声明聚合采样口径；真实输入转换前必须完成 50 km 锋面排除的地理校验 |

为什么要有对照：如果同一天整个海区 fishing hours 都升高，只看锋面附近增加会把背景活动误读成锋面响应。非锋面对照使“锋面附近”和“非锋面背景”可比较，也让 AI 证据链能解释增强判定的边界。

## 6. 缺测与空态

事件：`2024-08-07:F001` 在 10 / 20 / 30 km 三档都标记为 `missing_coverage`。

该事件不携带 `pre7_hours`、`post1_3_hours`、`non_front_control_hours`、`lift_percent` 或 `enhanced_flag`。页面只能展示“不可用”，不能输出“响应增强 / 无明显增强”，也不能把缺测解释成 `0 fishing hours`。

## 7. UI 页面说明

当前页用户路径：

1. 用户在顶栏设置出发地、作业范围和出海日。
2. 当前页展示锋面线索、把握度和作业线索。
3. “历史 AIS 响应”卡片读取同一个 `date + range` 上下文。
4. 卡片折叠态展示响应状态、post1-3 fishing hours、lift、non-front control 和 caveat。
5. 展开“响应明细与口径”后展示 source、metric、unit、front_event_id、pre/post/exploratory window、对照区定义、增强规则和公开边界。

AI 分析页用户路径：

1. AI 分析页把当前证据、预测参考、AIS 响应和限制条件组织为证据链。
2. AI 只解释确定性 artifact，不生成 fishing hours、lift 或科学数值。
3. 缺测、placeholder 或未授权状态只能进入边界说明，不能被改写为“无响应”。

数据说明页用户路径：

1. 数据来源说明列出 AIS response 的 source、metric、unit、license/public-display boundary。
2. 评分规则说明当前 AIS response 不参与 Product Score。
3. 使用限制说明 apparent fishing effort 不等于渔获量、产量或收益。

## 8. 边界声明

- apparent fishing effort 是由船舶活动估计出的表观捕捞活动，单位是 fishing hours。
- P1 不使用渔获量、产量、收益、鱼群生物量作为真值。
- 当前 `synthetic_fixture` 不是真实 AIS/GFW 证据，不应用于科学结论或业务决策。
- raw AIS/GFW、API 原始响应、0.01 度工作中间表和可逆推出源数据的细粒度产物不得提交到仓库。
- 真实聚合结果提交前必须复核 license、attribution、公开展示范围和不可逆性。
- AI 只能组织任务和解释证据，不能补全缺失数据或生成新的 scientific values。

## 9. 当前验证结果

最近一次本地验证：

| 命令 | 结果 |
|---|---|
| `node tools/data-check.mjs` | 0 失败 / 897 项 |
| `node tools/e2e-check.mjs` | 0 失败 / 108 项 |
| `node tools/layout-check.mjs` | 0 失败 / 25 项 |

回归重点：

- placeholder 状态不输出假数值。
- available 状态展示响应状态、数值明细和 caveat。
- 日期和作业范围变化后，历史 AIS 响应跟随同一个全局上下文。
- AI 分析页和数据说明页不出现 production / revenue / catch / guaranteed-yield 类越界承诺。
- 历史 AIS 响应卡片在 1680 / 1280 两档入口可见，文案不横向裁切。

## 10. 阶段价值与后续扩展

阶段价值：

- 产品上，P1 把“当前锋面线索”扩展成“当前态势 + 历史 AIS 响应 + 证据边界”的作业辅助闭环。
- 技术上，P1 把锋面作为 spatiotemporal front event，并用 Front Response Table 承载事件身份、时间窗口、空间 buffer、对照组和增强判定。
- AI 应用上，P1 明确了人机协同边界：AI 负责组织证据和解释限制，确定性脚本负责计算数值。

后续扩展：

- 接入真实授权样例后，用同一转换脚本生成 real / authorized sample Front Response Table。
- 增加相似锋面事件检索：同海区、同季节窗口、相似形态与方向。
- 在真实样本充足后生成前后 7 天曲线图、三半径统计图和对照组统计图。
- 若未来引入真实渔获或业务收益数据，必须另建验证目标，不能把 apparent fishing effort 直接替代为产量或收益。
