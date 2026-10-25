# 05: 计算前后窗口与非锋面对照响应增强

**What to build:** 对每个锋面事件计算 10/20/30 km buffer 的 `pre7_hours`、`post1_3_hours`、`lift_percent`、`non_front_control_hours`、`enhanced_flag`，并正确处理缺测。完成后能用样例事件展示“响应增强/无明显增强”。

**Blocked by:** None (04 is done).

**Status:** done

- [x] 前 7 天、后 1-3 天、前后 7 天探索窗口的边界清楚且可复现。
- [x] 同日非锋面对照区离锋面至少 50 km，且面积/采样口径可解释。
- [x] response enhancement 使用 ADR 中的基线规则：后 1-3 天高于前 7 天均值至少 20%，且高于非锋面对照区。
- [x] 缺少 AIS/GFW coverage 时输出 unavailable，不输出响应增强/无明显增强结论。
- [x] 更新项目执行记录，补充“为什么要有非锋面对照区”的答辩口径。
