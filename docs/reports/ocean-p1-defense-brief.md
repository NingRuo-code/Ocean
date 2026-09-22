# Ocean P1 答辩简报

> 用途：8-10 分钟阶段汇报、老师/评审问答、后续简历复盘。
> 依据：`docs/reports/ocean-p1-validation-package.md`、`docs/project-grilling/ocean-p1-execution-notes.md`、`docs/data-governance-gfw-ais.md`。

## 1. 汇报主线

P1 的主线不是“做了一张海洋地图”，而是把海洋锋面作为时空事件，围绕渔场作业辅助建立一条可追溯证据链：

```text
出发地 / 作业范围 / 出海日
  -> 当前锋面与 SST 态势
  -> 历史同期锋面频率
  -> Front Response Table
  -> AIS apparent fishing effort 响应解释
  -> AI 证据组织与边界说明
```

最关键的防线：P1 只分析 apparent fishing effort response，不承诺渔获量、产量、收益或保证性作业结果。

## 2. 8-10 分钟讲稿

### 第 1 分钟：问题与定位

> 这个项目面向渔场作业辅助。用户关心的不是单纯看一张锋面图，而是“我从这个点出发，在这个范围和日期里，哪里值得关注，依据是什么，边界在哪里”。所以我把系统分成当前态势、历史参照、规则预测参考和 AI 证据组织四部分。

### 第 2-3 分钟：当前原型能力

> 当前页面已经接入真实锋面、冷暖侧和 SST 样例。用户可以设置出发地、作业范围和出海日，地图会展示锋面区、冷暖侧、水温、无观测区域和作业范围。右侧当前页会给出范围内锋面区数量、最近锋面、定位点水温、作业线索和评分依据。

演示动作：

1. 打开 `prototype-fishing.html`。
2. 保持默认出发地 `124.50°E, 30.20°N`、20 km、2024-08-05。
3. 展示地图图层、当前页作业线索和任意点查询。

### 第 4-5 分钟：P1 新增的 AIS 响应闭环

> P1 新增的是“历史 AIS 响应”证据链。它不是把 AIS 写成渔获结果，而是使用 GFW 风格 apparent fishing effort，即 fishing hours，作为表观捕捞活动响应信号。系统把锋面事件、日期、本地 front_id 和 10/20/30 km buffer 组织成 Front Response Table。

典型事件讲法：

> 例如 `2024-08-05:F001`，20 km 半径下，前 7 天基线是 42.5 fishing hours，后 1-3 天是 57.8 fishing hours，非锋面对照是 36.4 fishing hours，lift 是 +36%。因为它同时高于前 7 天基线的 120%，并高于同日非锋面对照，所以 synthetic fixture 标为“响应增强”。

必须补一句：

> 这里当前是 synthetic fixture，只验证数据契约和 UI 路径，不是真实 AIS/GFW 证据。

### 第 6 分钟：为什么要有非锋面对照

> 如果只看锋面附近 fishing hours 增加，可能只是同一天整个海区作业活动都上升。非锋面对照区提供同日、同海区、远离锋面至少 50 km 的背景参照，避免把背景活动误读成锋面响应。

### 第 7 分钟：AI 边界

> AI 分析页只做证据组织和任务编排：它引用当前证据、历史参照、规则预测参考、AIS 响应和限制项。所有 fishing hours、lift、enhanced flag 都来自确定性数据表和脚本，AI 不生成新科学数值。

### 第 8 分钟：验证与工程质量

> 我把这条证据链写成可测试契约：`data-check` 校验响应表字段、时间窗口、三半径覆盖、missing coverage 不当 0；`e2e-check` 校验当前页、AI 页和数据说明页；`layout-check` 校验 AIS 卡片在桌面布局下可读。

当前基线：

- `data-check`：0 失败 / 897 项
- `e2e-check`：0 失败 / 108 项
- `layout-check`：0 失败 / 25 项

### 第 9-10 分钟：阶段价值与下一步

> P1 的价值是把项目从锋面展示推进到作业辅助证据链：产品层能展示作业线索和历史 AIS 响应，技术层验证了锋面事件与 apparent fishing effort 的时空匹配，AI 层明确了“证据组织而非科学数值生成”的边界。

下一步：

1. 接入真实授权 AIS/GFW 聚合样例。
2. 扩展相似锋面事件检索。
3. 做前后 7 天曲线图、三半径敏感性图、非锋面对照统计图。
4. 真实渔获或收益数据到位前，不升级为产量/收益预测。

## 3. 推荐幻灯片结构

| 页码 | 标题 | 关键内容 |
|---:|---|---|
| 1 | 项目定位 | 渔场作业辅助，不是普通地图系统 |
| 2 | 用户工作流 | 出发地、作业范围、出海日 -> 作业线索 |
| 3 | 数据与图层 | 锋面、SST、冷暖侧、历史同期、AIS response 入口 |
| 4 | P1 方法闭环 | Front Event -> Response Table -> UI Evidence -> AI Evidence |
| 5 | 典型事件 | `2024-08-05:F001` 前后窗口与 20 km 响应 |
| 6 | 三半径敏感性 | 10 / 20 / 30 km 对比，默认解释 20 km |
| 7 | 非锋面对照 | 为什么不能只看 fishing hours 总量 |
| 8 | AI 证据链 | AI 组织证据，确定性脚本计算数值 |
| 9 | 验证结果 | 897 / 108 / 25 项检查通过 |
| 10 | 后续计划 | 真实样例、相似事件、研究图、评分升级 |

## 4. 演示顺序

1. 当前页默认视图：展示作业线索和历史 AIS 响应卡片。
2. 展开历史 AIS 响应：展示 pre/post window、control、source、metric、boundary。
3. 切换 10 / 20 / 30 km：说明同一事件不同半径的敏感性。
4. 切换到 2024-08-07：展示 missing coverage 不输出假数值。
5. 打开 AI 分析页：展示 AIS response 如何进入证据链。
6. 打开数据说明页：展示 apparent fishing effort caveat 和“不参与 Product Score”。

## 5. 高频追问回答

### Q1：为什么不用渔获量或产量做真值？

因为 P1 没有可复现、可公开验证、能与锋面事件逐日逐空间匹配的渔获量数据。AIS/GFW 能提供的是基于船舶行为估计的 apparent fishing effort，它可以作为作业活动响应 proxy，但不能等同于渔获量或收益。

### Q2：为什么要做 10 / 20 / 30 km 三半径？

产品默认需要一个可理解的作业范围，所以使用 20 km；研究上必须看半径敏感性，避免结论只在单一 buffer 下成立。当前 fixture 中 20 km 和 30 km 增强，10 km 不增强，正好说明半径选择会影响解释。

### Q3：为什么要做非锋面对照？

因为同一天整个海区作业活动可能一起升高。非锋面对照提供背景参照，帮助判断“锋面附近活动增强”是否高于非锋面背景，而不是只看绝对 fishing hours。

### Q4：AI 在这里到底有什么价值？

AI 的价值不是编数字，而是把用户问题拆成可解释证据块：当前锋面、历史同期、AIS response、规则预测参考和限制项。它让专业分析输出更容易读，但数值仍由确定性程序计算。

### Q5：当前 synthetic fixture 会不会被认为是假数据？

它不是用来证明科学结论的，而是用来验证数据契约、状态处理、UI 路径和回归检查。报告和页面都明确标注 `synthetic_fixture`，不把它写成真实 AIS/GFW 证据。

### Q6：如果真实 AIS/GFW 覆盖不足怎么办？

输出 `missing_coverage` / `unavailable`，不携带 fishing hours、lift 或 enhanced flag。缺测只表示证据不可用，不能解释成 0，也不能解释成“无明显增强”。

### Q7：这个项目和普通可视化系统有什么区别？

普通可视化系统重点是把图层展示出来。这个项目的重点是把锋面抽象为时空事件，并把它与 AIS apparent fishing effort 进行窗口匹配、对照比较和人机协同证据组织。

## 6. 答辩时不能说的话

- 不能说“预测产量”。
- 不能说“预测收益”。
- 不能说“保证有鱼”。
- 不能说 synthetic fixture 是真实 AIS/GFW 响应。
- 不能说 AI 计算了 fishing hours。
- 不能把 missing coverage 说成 0 fishing hours。

推荐替代表达：

| 不要说 | 改成 |
|---|---|
| 产量预测 | 作业线索 / 渔场可能性 |
| 收益预测 | 作业辅助参考 |
| 鱼群真实分布 | apparent fishing effort response |
| AI 算出了结果 | AI 组织确定性证据 |
| 没数据说明没有响应 | 数据不可用，不能推出响应结论 |

## 7. 现场检查清单

汇报前确认：

- `git status --short --branch` 干净。
- `node tools/data-check.mjs` 通过。
- `node tools/e2e-check.mjs` 通过，并生成最新截图。
- `node tools/layout-check.mjs` 通过。
- 页面默认日期、范围和出发地可正常展示。
- 浏览器中可以打开当前页、AI 分析页和数据说明页。

## 8. 后续任务建议

短期：

1. 把 `docs/reports/ocean-p1-validation-package.md` 转成 PPT 或汇报讲稿。
2. 选 3 张截图：当前页、AIS 响应展开、数据说明页。
3. 准备真实授权样例接入清单：数据来源、许可、字段、粒度、公开边界。

中期：

1. 实现真实样例转换路径。
2. 做多事件响应统计和研究图。
3. 把相似锋面事件检索接入历史页。

长期：

1. 接入真实海况/预报。
2. 扩展到 2015-2024 历史样本。
3. 在真实验证后再讨论 Product Score 是否纳入 AIS response。
