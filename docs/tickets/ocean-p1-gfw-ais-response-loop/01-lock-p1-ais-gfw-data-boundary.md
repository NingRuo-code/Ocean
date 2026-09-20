# 01: 锁定 P1 AIS/GFW 数据输入与公开边界

**What to build:** 明确 P1 使用哪一种 apparent fishing effort 输入、原始数据是否可落盘、哪些衍生产物可提交、UI/文档必须写哪些许可与 caveat。完成后，后续实现不会误把 raw AIS/GFW 数据推入仓库，也不会写成渔获量。

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] 明确 P1 数据来源：GFW 公开 apparent fishing effort、实验室/合作方 AIS 衍生表，或本地小型夹具。
- [ ] 明确原始数据、0.01 度中间表、0.05 度展示聚合物、事件响应表各自是否允许提交到 Git。
- [ ] 明确 UI 和数据说明必须出现的 attribution、license、apparent fishing effort caveat。
- [ ] 明确 missing coverage 不能当作 zero fishing activity。
- [ ] 更新项目执行记录，写清“为什么第一阶段不使用渔获量/产量作为真值”。
