# 八月真实来源核实草稿

两封询证草稿尚未发出。它们针对固定版本 #67/#68 的数据前置。回信或公开链接到手后，先保存原文与来源身份，再逐项核对本地样本与格网。若只确认部分字段，其余字段仍按未知记录。[八月预检](../reports/ocean-august-source-readiness-2026-11-06.md)

## 锋面数据作者

收件人 `qwxing@shou.edu.cn`。[Zenodo 作者联系方式](https://zenodo.org/records/20356239)

**主题**　请教 Zenodo 20356239 逐日锋面文件的时间坐标和格网定义

邢老师您好！我们在核对东海 2024 年 8 月的逐日锋面资料，希望用您发布的固定版本与同日海上活动数据匹配。我们读取的是 Zenodo 20356239 的 `front_location.zip`。其中 `front_location20240805.nc` 的 `time` 为 `739469`，单位写作 `days since 0000-00-00`，时间属性另标 `UTC`。

想请您确认两点。

1. 该归档的 `time` 应使用什么公式和日历转换？上述样例应对应哪个 UTC 日期和时刻？如果有写出该变量的代码或说明，烦请指引。
2. 文件的 `lon`、`lat` 是否代表 0.05° 像元中心？如果用这些坐标计算像元面积，应采用什么边界规则？

如有可引用的文档或链接，也请告知。感谢您开放数据和提供帮助！

## Global Fishing Watch 研究与数据团队

收件人 `research@globalfishingwatch.org`。[固定归档说明](https://zenodo.org/records/14982712) · [官方联系渠道](https://globalfishingwatch.org/contact-us/)

**Subject**　Day assignment and observation coverage for the static 0.01° fishing effort dataset v3.0.0

Hello Global Fishing Watch Research and Data team,

We are evaluating the static `fleet-daily-100-v3` dataset from Zenodo record 14982712 for a noncommercial study of ocean fronts and apparent fishing effort in the East China Sea in August 2024. We would appreciate clarification on two details for this release.

1. Does `date` represent a UTC day? If the interval between two consecutive AIS positions crosses midnight, is its duration split across the two days or assigned to one date based on a position timestamp? A reference to the aggregation rule or an example would help.
2. Is there a documented coverage or data quality layer for the August 2024 daily 0.01° grid? In particular, can users distinguish an omitted grid cell with adequate AIS reception from a cell with unknown reception, and what does an explicit `fishing_hours = 0` row indicate when vessel presence is recorded? If the release does not support that distinction, confirmation would help us define the scope of our analysis.

A citable source or documentation link would be especially helpful. Thank you for your time.
