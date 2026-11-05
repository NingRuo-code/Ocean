# GFW v3日界与有效支持续查（2026-11-05）

## 结论

本次有界续查没有找到可以直接绑定 **Zenodo14982712 / 3.0.0 fleet逐日CSV** 的UTC日界声明或日期生成SQL。官方README与schema能够证明按日聚合、YYYY-MM-DD日期、WGS84左下角0.01°格网和小时指标，但不能据此证明日期就是严格UTC零点至零点窗口。该缺口应保留为来源语义未知，不能把BigQuery默认时区或新版API约定替代为已核实事实。[固定记录](https://zenodo.org/records/14982712)、[fleet README](https://zenodo.org/api/records/14982712/files/README-fleet-v3.txt/content)、[schema](https://zenodo.org/api/records/14982712/files/fleet-daily-v3.schema.json/content)

同样没有找到该固定产品的逐格有效接收支持域，或将未出现格明确定义为零的声明。可以审计已报告组、显式零及转换守恒；完整日文件不能自动成为“整片海域持续有效观测”的证明。[v3已知问题](https://zenodo.org/api/records/14982712/files/README-known-issues-v3.txt/content)

## 核查过的官方生成与导出线索

1. GFW官方Science研究代码仓（旧入口`global-footprint-of-fisheries`，现名`paper-global-footprint-of-fisheries`）的`data_production/export_table.sh`先导出已有BigQuery表，再按CSV第一列日期拆文件。它没有生成该日期列，也没有指定时区；`config.sh`中的生产注释指向旧`global_footprint_of_fisheries`数据集，不是`fishing_effort_v3`。因此该脚本不能核实2025年v3发布档的日界。[导出脚本](https://github.com/GlobalFishingWatch/paper-global-footprint-of-fisheries/blob/master/data_production/export_table.sh)、[配置](https://github.com/GlobalFishingWatch/paper-global-footprint-of-fisheries/blob/master/data_production/config.sh)
2. 同仓的旧fleet说明只涉及2012–2016，并描述另一种位置时长分配方法；不能将它直接套到2012–2024的v3固定档。旧说明同样仅将日期定义为YYYY-MM-DD，没有UTC日界定义。[旧产品说明](https://github.com/GlobalFishingWatch/paper-global-footprint-of-fisheries/blob/master/data_documentation/fishing_effort.md)
3. 官方`gfw-public-data`索引仓当前master树只有LICENSE，没有找到v3生成查询。此观察仅限本次读到的当前树，不声称已穷尽其他分支、历史或私有生产仓。[官方索引仓](https://github.com/GlobalFishingWatch/gfw-public-data)
4. 在官方组织和网页中检索`fishing_effort_v3`、`fleet-daily-100-v3`、`fleet-daily-csvs`与UTC/date关键词；结果主要为新版API、R客户端或旧研究代码。未把这些不同版本来源的日期处理当作v3固定CSV的生产证据。当前官方介绍也区分持续更新的地图/API与定期静态下载快照。[官方路线说明](https://globalfishingwatch.org/dataset-and-code-fishing-activity/)

只读仓树及旧导出文件的副本保存在本地忽略目录`data/processed/gfw-public-route-20261105/`：`official-old-repo-tree.json`、`gfw-public-data-tree.json`、`old-gfw-data_production_export_table.sh`、`old-gfw-data_production_config.sh`及`old-gfw-data_documentation_fishing_effort.md`。匿名GitHub API遇限流后使用已有认证只读公开仓，未输出或保存凭据；没有执行这些脚本、查询付费BigQuery、下载新原档或联系作者。

## 一个需要保留的时间解释限制

官方FAQ说明，**单个MMSI**的日小时也可能超过24：当天第一个AIS位置可能被分配从上一日延续的时长，因此单船日总量可能达到48小时。这不同于“只有多船累计才会超过24小时”的解释；不能因超过24就判异常，也不能把日文件小时机械解释为严格截断在该日24小时内的持续时间。[官方FAQ](https://globalfishingwatch.org/faqs/why-do-some-mmsis-downloadable-fishing-effort-data-add-up-to-more-than-24-hours/)

该FAQ没有显式给出14982712版本号，因此它是GFW下载指标的解释线索，不能单独补齐固定v3的UTC日界。v3 README本身确认时长与前一个AIS位置的时间差有关，与此提醒方向一致；后续若研究严格日滞后或事件前后窗口，需要说明使用的是来源分配到报告日期的小时，而非自行还原的轨迹时间积分。[v3 README](https://zenodo.org/api/records/14982712/files/README-fleet-v3.txt/content)

## 有效支持与零值

v3已知问题明确指出AIS接收并非空间一致、2022年后动态AIS在东海/南海改善明显，且2024分类为provisional。这些问题可能改变报告活动分布，但说明文件没有给出可直接生成每格/每日有效观测面积的掩码。新版官方说明也强调设备采用、接收范围和消息冲突影响捕捞活动检出；这支持保留覆盖未知，而不能提供缺格补零的依据。[固定v3已知问题](https://zenodo.org/api/records/14982712/files/README-known-issues-v3.txt/content)、[官方一般局限](https://globalfishingwatch.org/dataset-and-code-fishing-activity/)

本次未新增可将`time_verified`或完整有效支持改为已核实的直接证据。可靠的解除条件包括：官方绑定该发布档的生成查询/代码、明确的数据字典补充或作者确认。已报告记录的日期、指标、零值和守恒检查仍可独立完成；来源审计完成与研究用途资格是否通过应分别记录，不能通过重复检索将“未知”改写成事实。
