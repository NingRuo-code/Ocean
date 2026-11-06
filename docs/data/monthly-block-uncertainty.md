# 月分析相关日组区间

沿用[同日距离参照](monthly-distance-background.md)的登记合成包、原月提交及冻结结果。可在已登记 `distance_comparison` 的包内再给出 `distance_uncertainty`，版本 `calendar-block-percentile/v1`。须明确给出 `block_days`、`confidence_level`、`iterations`、`seed`、`minimum_groups`、`assumption`、`rationale`。这里没有默认研究块长、样本门槛或显著性要求；真实方案仍须由 #67 依据来源与相关性审查冻结。

以月首为固定起点按实际日历切连续、不重叠的日期组。缺少成对日期不填补，空块不入抽样且不把前后日期拼接。只对已有正分母、同日配对的距离结果估计绝对密度差。同日目标、参照及原距离带始终关联于相同日期；每次抽取整块后，将目标和参照各自的小时和面积时间分别加总，再重算两组密度和差。组内有效日期不等时不把块内密度或日密度简单平均。

用 [NumPy PCG64](https://numpy.org/doc/stable/reference/random/bit_generators/pcg64.html) 按登记种子有放回抽取非空块，用 [NumPy 线性分位数](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html) 取双侧端点。该策略以“组间依赖可忽略”为登记假设，保留组内相关，并不验证跨组独立性；不要与自动选择块长或移动/循环块的算法混称。只在登记条件支持、达到该方案的组数门槛、所有抽样可计算且区间非退化时给端点。否则保留已有描述效应，返回 `not_reliably_estimable`、具体原因和空端点。不执行逐日置换或符号翻转。

结果随原冻结身份包含日历块、各组日期、纳入贡献数、两组分子分母、抽样数量、实际 NumPy 版本和策略版本。日/格数与有效日历组分别记录。当前是受控合成方法参照，不能把这里的假设当成真实东海候选月的统计证据。
