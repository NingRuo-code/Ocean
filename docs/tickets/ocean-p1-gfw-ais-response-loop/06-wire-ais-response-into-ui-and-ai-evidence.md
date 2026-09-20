# 06: 把真实/样例 AIS 响应接入当前页和 AI 证据链

**What to build:** 当前页“历史 AIS 响应”卡片在有数据时显示定性结论和可展开数值；AI 分析页把 AIS 响应作为证据来源；数据说明页展示来源、metric、unit、限制。不改变现有日期/范围控件，不把 AIS 响应写进最终评分。

**Blocked by:** None (05 is done).

**Status:** ready-for-agent

- [ ] 当前页卡片 collapsed state 显示响应状态和短 caveat。
- [ ] 当前页展开明细显示 fishing hours、lift、control value、response window method。
- [ ] AI 分析页把 AIS response 作为 evidence source，不生成新科学数值。
- [ ] 数据说明页补齐 source、metric、unit、license/public-display boundary 和 caveat。
- [ ] 全站不新增第二套日期/范围控件，不改变现有 Product Score。
- [ ] 更新项目执行记录，补充“AI 为什么只做证据组织”的问答。
