# Ocean GFW 响应分析 Issue 拆分清单

## Milestone 1：样例数据闭环

### Issue 1：获取 2024-07-01 至 2024-08-31 GFW 样例数据

目标：拿到东海窗口内每日 0.01 度 apparent fishing effort 样例。

验收：

- 覆盖当前原型日期窗口。
- 记录数据来源、许可、字段和处理过程。
- 明确不提交或公开发布未经处理的底层数据文件。

### Issue 2：定义 GFW 原始数据到本地中间格式

目标：把 GFW 样例整理为可重复处理的本地中间表。

验收：

- 字段至少包含日期、经纬网格、fishing hours。
- 第一版不区分船旗国和渔具类型。
- 保留原始 0.01 度粒度用于分析计算。

### Issue 3：生成 0.05 度 Fishing Effort Grid Artifact

目标：把 0.01 度 fishing hours 聚合到锋面数据网格，供地图显示。

验收：

- 每日生成一个前端可读文件。
- 网格范围与现有东海窗口一致。
- 数据说明中标注为 apparent fishing effort。

### Issue 4：生成 Front Response Table

目标：预计算锋面事件缓冲区响应表。

验收：

- 支持 10/20/30 km 三个缓冲半径。
- 计算 `pre7_hours`、`post1_3_hours`、`lift_percent`、`non_front_control_hours`、`enhanced_flag`。
- 同时记录 `front_event_id`、`date`、`front_id`、`similar_event_group`、`season_window`。

### Issue 5：实现非锋面对照区域采样

目标：为每个锋面事件生成同日同海区的非锋面对照区域。

验收：

- 对照区域离锋面至少 50 km。
- 对照区域面积与锋面缓冲区可比。
- 响应增强判定同时使用前 7 天基线和非锋面对照。

## Milestone 2：产品界面接入

### Issue 6：当前页新增“历史 AIS 响应”证据块

目标：在产品主任务中解释类似锋面情形是否曾出现表观捕捞活动响应。

验收：

- 显示“响应增强/无明显增强”。
- 可展开查看 fishing hours、提升率和对照区数值。
- 不出现“产量预测”或“收益预测”措辞。

### Issue 7：历史页新增“相似锋面事件响应”模块

目标：展示同海区、前后 15 天季节窗口内的相似锋面事件及响应结果。

验收：

- 支持按相似事件查看响应窗口。
- 显示前 7 天至后 7 天 fishing hours 曲线。
- 标注 GFW 数据的 apparent fishing effort 边界。

### Issue 8：数据说明页补充 GFW 来源与限制

目标：把 GFW 数据来源、授权边界和 apparent fishing effort caveat 写清楚。

验收：

- 说明数据是表观捕捞活动，不等于渔获量。
- 说明 AIS 覆盖和接收条件可能影响时空趋势。
- 说明本阶段仅用于本地/课堂演示与聚合图展示。

## Milestone 3：研究图与评价

### Issue 9：生成锋面事件响应窗口图

目标：对典型锋面事件展示前后窗口 fishing hours 变化。

验收：

- 图中区分前 7 天、后 1-3 天和后 7 天。
- 展示锋面缓冲区与非锋面对照区。

### Issue 10：生成多半径敏感性统计图

目标：比较 10/20/30 km 半径下响应结果的一致性。

验收：

- 展示不同半径下的提升率和增强标记。
- 标出默认产品半径 20 km。

### Issue 11：生成对照组统计图

目标：比较锋面缓冲区与非锋面对照区的 apparent fishing effort 差异。

验收：

- 支持样例窗口统计。
- 支持后续扩展到 2015-2024 每年 8 月。

## Milestone 4：需求文档同步

### Issue 12：更新需求规格 v0.11

目标：把 GFW apparent fishing effort 路线写入需求文档，但保持“计划接入/样例闭环”状态。

验收：

- 不把 AIS 写成已经接入。
- 明确第一阶段只做样例闭环。
- 明确界面不使用产量预测措辞。

### Issue 13：实现后更新数据契约与交接文档

目标：等数据文件真正落地后，再更新 `docs/data-schema.md` 和 `docs/handover.md`。

验收：

- 记录新增数据文件结构。
- 更新验收命令和演示脚本。
- 保留 GFW 数据公开边界说明。
