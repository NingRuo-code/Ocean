# 07: 补齐 P1 UI 与文案回归检查

**What to build:** 增加端到端/布局检查，验证历史 AIS 响应卡片、AI 证据链、数据说明、日期/范围联动、缺数据空态，以及禁止“产量预测/收益预测/guaranteed catch/yield prediction”等误导措辞。

**Blocked by:** None (06 is done).

**Status:** ready-for-agent

- [ ] placeholder 状态下，历史 AIS 响应卡片显示待接入且不输出假数值。
- [ ] sample/real 状态下，历史 AIS 响应卡片显示响应状态、数值明细和 caveat。
- [ ] 日期与作业范围变化时，AIS 响应证据跟随同一个全局上下文。
- [ ] AI 分析页和数据说明页不出现 unsupported claims。
- [ ] 检查中显式拦截“产量预测”“收益预测”“guaranteed catch”“yield prediction”等产品 UI 误导措辞。
- [ ] 更新项目执行记录，补充“如何测试大模型/AI 证据链不幻觉”的问答。
