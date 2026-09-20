# 03: 增加响应表数据契约检查

**What to build:** 扩展现有数据检查，让 response artifact 出错时能失败：非法日期、非法半径、缺字段、`NaN/Infinity`、missing 被当成 0、增强标记与数值不一致等都能被拦住。

**Blocked by:** None (02 is done).

**Status:** ready-for-agent

- [ ] response artifact 为 placeholder 时检查通过，但状态必须清楚表达未接入。
- [ ] response artifact 为 real/sample 时，日期、半径、字段、数值范围、状态组合必须通过校验。
- [ ] 缺测状态不能同时给出误导性的 0 fishing hours 结论。
- [ ] enhanced flag 与 pre/post/control/lift 的规则一致。
- [ ] 更新项目执行记录，写清“数据契约检查如何防止 AI/前端编造科学数值”。
