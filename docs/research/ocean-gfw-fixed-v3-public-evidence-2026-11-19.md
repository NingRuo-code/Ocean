# #67：固定 GFW v3 八月日界与覆盖的公开证据复核

对象为 [Zenodo 14982712 v3.0.0](https://zenodo.org/records/14982712) 的 2024 年 `fleet-daily-100-v3`（0.01°、按船旗和渔具分组）。本轮仅核公开一手资料，不联系提供方、不登录仓库、不执行付费查询。前次取数和本地样本证据见[固定版接入记录](ocean-public-gfw-access-2026-11-05.md)。

| 核查项 | 可以确认 | 还不能确认 |
| --- | --- | --- |
| 日期字段与分发 | [同版本 fleet README](https://zenodo.org/records/14982712/preview/README-fleet-v3.txt?include_deleted=0) 明确列出公开 BigQuery 表 `global-fishing-watch.fishing_effort_v3.fleet-daily-100-v3` 为 CSV 之外的访问途径；[同版本 schema](https://zenodo.org/records/14982712/preview/fleet-daily-v3.schema.json?include_deleted=0) 的 `date` 是可空的 `DATE`，不含原始时间戳。README 明确位置间的时长计给后一位置。 | 未找到该表或归档的生成查询，以及将后一位置或跨午夜时长归入 `date` 的版本专属说明。[BigQuery 的 `DATE` 类型](https://cloud.google.com/bigquery/docs/reference/standard-sql/data-types#date_type) 独立于时区；只有实际采用未指定时区的 [`DATE(timestamp)`](https://cloud.google.com/bigquery/docs/reference/standard-sql/date_functions#date) 才使用默认 UTC。公开成品表身份不能代替转换链。 |
| 接收与有效覆盖 | [GFW 当前数据说明](https://globalfishingwatch.org/dataset-and-code-fishing-activity/) 的接收图给出单个设备平均每日预期收到的卫星 AIS 位置数，并说明接收随区域、时间和接收源变化。[断线产品说明](https://api-doc.globalfishingwatch.org/our-apis/documentation/docs/v3/general-api-doc/data-caveats) 给出的接收估计基于 2017–2019 年。 | 接收图没有给出与固定 v3 八月逐日 0.01° 网格对应的可下载质量掩码；[公开可用性表](https://globalfishingwatch.org/global-fishing-watch-data-availability/) 未列出匹配产品。固定版发布于 2025 年，不能由图上的 2026 版权标记推断图的观测年份。固定 fleet schema 里的 `mmsi_present` 和 `hours` 是已观测活动相关字段，不是无船时也可独立测量的覆盖分母，缺行照旧记未知。 |
| 新版 API/地图是否可替代 | [GFW 固定 v3 与地图/API 的对照](https://globalfishingwatch.org/faqs/2025-march-static-apparent-fishing-activity-v3-difference-with-map/) 已说明固定版使用更严格的航行误报和渔船筛选，与地图/API 在点抽稀及格网角点/中心也不同。[GFW v5 发布说明](https://globalfishingwatch.org/platform-update/version-5-data-pipeline-release/) 明确 `latest` 自 2026-10-21 指向 v5，且该版改变了识别模型及渔船分类。 | 新版 API 或地图用同一时段取数也不能证明冻结 v3 的 UTC 日界或 2024-08 有效覆盖，不能用来补零或替换既有分析输入。 |

还核对了新版船舶在场产品。GFW 定义的 `public-global-presence:latest` 按船每小时取一个已收到的位置，报告在场时长。它仍依赖被收到的 AIS 消息，无法独立量化未收到消息的格子。固定版已知问题记录了 2022 年东海接收变化，GFW 的 2026 年平台公告也记录了更换数据供应商后接收范围按地区变化。两段变化都没有提供固定 v3 八月的逐日格网质量。[船舶在场产品说明](https://globalfishingwatch.org/platform-update/global-ais-vessel-presence-dataset/) · [固定版已知问题](https://zenodo.org/records/14982712/preview/README-known-issues-v3.txt?include_deleted=0) · [供应商切换说明](https://globalfishingwatch.org/platform-update/data-vendor-transition/)

两项准入声明继续为未核实。若以后出现与固定导出绑定的时区转换、跨午夜分配说明或 2024-08 逐日逐格接收/质量资料，先核对其版本、网格和适用范围，再沿 [#67](https://github.com/NingRuo-code/Ocean/issues/67) 重跑准入。再次读取固定成品表只能交叉核对下游数据，不构成上游日期生成证据。
