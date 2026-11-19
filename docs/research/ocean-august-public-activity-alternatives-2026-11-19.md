# 2024 年 8 月东海活动与 AIS 接收支持的公开候选

本轮按 [#67](https://github.com/NingRuo-code/Ocean/issues/67) 核查已登记的 124°E、30°N 及 10、20、30 公里三个圆。公开替代源筛查与正式准入分开。没有联系提供方、使用账户或下载船级资料。三天 ArcGIS 小样可读，本轮未找到达到正式整月要求的活动和接收支持组合。

## 用户给出的 Science 论文与后续数据

Science DOI 正文与附录入口本次返回 HTTP 403。可访问的同一出版正文和 GFW 的作者项目页都写明原研究期为 2012–2016。原文的数据可用性声明指向逐日 0.01° 船旗／渔具汇总。作者代码库的原版逐日表说明把 AIS 位置前后两个时间间隔各取一半分配给该位置，日期字段声明 YYYY-MM-DD，格网使用南边和西边。 [原论文与数据声明](https://tunaresearch.org/reprints/Science_Kroodsma_et_al_2018.pdf) · [作者项目页](https://globalfishingwatch.org/research/global-footprint-of-fisheries/) · [原版发布说明](https://github.com/GlobalFishingWatch/paper-global-footprint-of-fisheries/blob/master/data_documentation/fishing_effort.md)

作为同一原研究的另一入口，Google Earth Engine 的 `GFW/GFF/V1/fishing_hours` 和 `GFW/GFF/V1/vessel_hours` 都为日级，目录标记从 2012-01-01T00:00:00Z 到 2017-01-01T00:00:00Z，像元尺寸约 1,113.2 米，使用目录明示的 CC BY-SA 4.0。GFW 说明这里的栅格值为小时/平方公里。两个合集均早于 2024 年，目录时间标记也没有解释 2024 年固定版的跨午夜分配。 [GFW Earth Engine 说明](https://globalfishingwatch.org/data/public-data-google-earth-engine/) · [捕捞栅格目录](https://developers.google.com/earth-engine/datasets/catalog/GFW_GFF_V1_fishing_hours) · [在场栅格目录](https://developers.google.com/earth-engine/datasets/catalog/GFW_GFF_V1_vessel_hours)

2025 年发布的固定 v3.0.0 扩至 2024 年，按 0.01° 左下角和船旗／渔具输出，每条 AIS 位置带入距前一条位置的整个间隔，许可为 CC BY-NC 4.0。原研究相邻时长分配与这一版本不同。固定版的日期字段仍缺版本专属 UTC 归日依据和目标月逐日逐格接收支持。原论文链接及其作者库因而含有方法与历史数据入口，可追到 2024 年归档，未为现有八月试验提供这两项证据。 [固定版发布记录与许可](https://zenodo.org/records/14982712) · [之前的固定版证据](ocean-gfw-fixed-v3-public-evidence-2026-11-19.md)

## ArcGIS 官方日栅格实样

GFW 的 ArcGIS 发布说明列出从 2012 年起的日活动图层，并说明数据来自与 4Wings API 相同的底层入口。本次直接查询 GFW 自有组织下公开的日度活动和船舶在场 ImageServer，其根元数据的实际时间范围为 2020-01-01 至 2025-12-31。两服务均是 EPSG:4326、0.01°、256×256、单波段 F32 的 LERC2D 日栅格，数据项均明示 CC BY-NC 4.0 和署名条件。活动项摘要标注估计小时/平方公里/日，服务维度的变量单位字段未标注。局部样本按栅格编码作诊断，未按固定 v3 的逐格小时核算。 [GFW 发布说明](https://globalfishingwatch.org/platform-update/explore-global-fishing-watch-data-via-esris-arcgis-online/) · [活动项及许可](https://globalfishingw.maps.arcgis.com/sharing/rest/content/items/cd020356b8f64181a7980a87e2f57738?f=json) · [在场项及许可](https://globalfishingw.maps.arcgis.com/sharing/rest/content/items/7d8249a1f54b4524ab6b716b5cceb427?f=json) · [活动服务元数据](https://tiledimageservices7.arcgis.com/rUSNqhFNeFnLs98e/arcgis/rest/services/fishing_effort_hours_daily_v02/ImageServer?f=json)

两图层公开 `slices` 目录都枚举了 2024-08 的 31 个唯一日期，每个 `StdTime` 值对应当日 00:00 UTC。活动和在场分别使用各自的切片编号，请求研究中心及 30 公里圆所属最高分辨率瓦片 `7/23/118`，两图层各取 8 月 5、6、7 日一幅。六份公开瓦片均返回 HTTP 200，合计 222,868 字节，单份低于 40 KB。用 Esri LERC 4.3.0 读取每幅的值和像元掩码。复核窗口为 `123.65 ≤ lon < 124.35`、`29.70 ≤ lat < 30.30`，按格点中心筛得 4,200 格，覆盖三个研究圆的外包窗口。矩形只用于测试源的缺测语义。 [活动时间目录](https://tiledimageservices7.arcgis.com/rUSNqhFNeFnLs98e/arcgis/rest/services/fishing_effort_hours_daily_v02/ImageServer/slices?f=json) · [在场时间目录](https://tiledimageservices7.arcgis.com/rUSNqhFNeFnLs98e/arcgis/rest/services/vessel_presence_hours_daily_v02/ImageServer/slices?f=json) · [Esri 瓦片和掩码说明](https://developers.arcgis.com/rest/services-reference/enterprise/image-tile/) · [解码器](https://github.com/Esri/lerc/blob/master/OtherLanguages/js/README.md)

| 切片日期标签（UTC） | 活动 / 在场切片编号 | 活动层正值格 | 活动层显式零格 | 活动层 NoData |
| --- | --- | ---: | ---: | ---: |
| 08-05 | 1579 / 1674 | 310 | 0 | 3890 |
| 08-06 | 1580 / 1675 | 289 | 0 | 3911 |
| 08-07 | 1581 / 1676 | 381 | 0 | 3819 |

三天各自的在场与活动瓦片在本次读取中整幅字节相同，已直接比对原始响应并核对 SHA-256。此发现限于六份小样，原因未定位。这组在场响应无法独立佐证接收覆盖。掩码只说明产品是否返回像元，未发现可把 NoData 分成有效零、接收不足和没有记录的规则。已验证的是公开历史切片标签及小范围取数。来源模型版本和跨午夜分配仍无证据，31 个时间切片也没有提供 31 天有效 AIS 支持。

## 其他候选及其适用范围

| 候选 | 已核实 | 对计划的影响 |
| --- | --- | --- |
| GFW 新版 4Wings API | 官方手册说明可请求逐日、最高 0.01°、按研究区域汇总。该手册的 UTC 逐小时示例说明 API 的档位表现，未直接确认固定 v3 的归日。2026-10-21 起 `latest` 指向 v5 的新模型，官方提供显式版本，查询需要账户令牌。平台许可为 CC BY-NC 4.0。 [GFW 请求手册](https://globalfishingwatch.org/our-apis/assets/2024.NSIN_%26_NGA.Global_Fishing_Forecast_Grand_Challenge.GFW_Recommendations.pdf) · [v5 变更公告](https://globalfishingwatch.org/platform-update/version-5-data-pipeline-release/) · [平台许可](https://globalfishingwatch.org/dataset-and-code-fishing-activity/) | 如果今后采用，应登记新版本和实际 UTC 日界，核实逐日接收，并重算 A 月。公开说明未给出与目标月目标格共用的有效面积分母。 |
| AIS 接收与断线 | Welch 等的研究基于 2017–2019 的消息，研究中的接收估计用于判定断线。GFW/UCSB 合作手册还指向 `reception_quality_quarterdegree_vYYYYMMDD` 研究表，本轮未取得公开的 2024 数据或许可。GFW 的 2026 IUU 文档确有 2017–2025 断线事件来源，成品使用 v4 并按船和年统计，疑似主动断线涉及接收门槛和距岸限制。 [Welch 等的方法](https://pmc.ncbi.nlm.nih.gov/articles/PMC9629714/) · [合作手册](https://emlab-ucsb.github.io/gfw-SOP/1-3-data-caution.html) · [IUU 产品说明](https://github.com/GlobalFishingWatch/iuu-insights-dataset#suspected-ais-disabling) | 断线事件存在证明曾获得足够线索来判定特定事件，不能反推出没有事件的每个格每天都可有效观测。 |
| SAR 与 VIIRS | GFW 公布从 2017 年起的 SAR 目标检测及单次扫描覆盖，也提供夜间 VIIRS 船灯检测说明。SAR 的覆盖记录描述扫描范围，VIIRS 可见性取决于夜间灯光、云等条件。 [SAR 检测及扫描覆盖](https://globalfishingwatch.org/platform-update/2024-may-data-download-portal-new-dataset-released-featuring-vessel-detections-from-sentinel-1-sar/) · [VIIRS 产品说明](https://globalfishingwatch.org/faqs/how-do-i-view-different-types-of-data-ais-vms-viirs/) | 可用于另行设计的观测对照。扫描或船灯事件的计数无法转换为现有分析定义的逐日表观捕捞小时与 AIS 有效面积。 |
| GFW 原始 AIS | 提供方说明自己使用的原始 AIS 属商业资料，只提供标注训练小样作为另一用途。 [GFW 原始资料 FAQ](https://globalfishingwatch.org/faqs/can-i-download-raw-ais-data/) | 缺少适用于目标月、目标海域和研究用途的供给，也缺少将接收不足与无活动分开的依据。 |

本次获得一条可公开复跑的局部活动栅格路线。若未来获得与候选版本相匹配的生成日界、像元值定义、独立有效接收及用途许可证据，先补登记和逐日共同支持审计，再决定是否送请确认换源。当前保持 [#67](https://github.com/NingRuo-code/Ocean/issues/67) → #68 → #71 → #98 的顺序，沿用既有正式整月条件。本地原始样本、目录响应、解码脚本和摘要留在 Git 忽略目录 `data/processed/august-public-alternatives-20261119/activity/`。
