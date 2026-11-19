# #67 东海八月公开活动与接收资料续查

2026-11-19 · 目标为东海 124°E、30°N 周围 10、20、30 公里，观测期为 2024 年 8 月。此次补查渔船监控记录、科研仓储、上游 AIS 接收公告和卫星雷达影像目录。正式整月仍要求同版产品的时间语义、逐日逐格有效支持和适用授权。[原版锋面与公开小样](ocean-august-public-front-alternatives-2026-11-19.md) · [Science 原论文、活动产品与公开小样](ocean-august-public-activity-alternatives-2026-11-19.md)

## 本轮核对

| 来源 | 取得的证据及适用范围 |
| --- | --- |
| 东海 HyFish | 浙江省渔业部门提供北斗 VMS，研究区域 120–130°E、25–35°N，包含目标中心。研究对 1,899 艘拖网渔船按日和 0.1°格网统计，原始观测为 2015 年 9 月至 2017 年 5 月。论文提供方法参考和历史参照，观测期排除 2024 年 8 月。[原论文 §2.1](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2024.1296146/full#h4) |
| 浙江东海 VMS 渔船研究 | 2024 年论文使用 18,487 艘渔船，实际观测从 2021-06-01 到 2022-05-31。论文数据说明未列同期匿名档案，2024 年属于发表年份。[原论文 §5.3.1 及数据可用性声明](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2024.1418366/full) |
| 和鲸渔船轨迹集 | 提供去标识轨迹，原研究 §2.1 记载 18,320 个轨迹 CSV、三类渔具，地域覆盖目标中心，观测截至 2020 年 11 月，无法提供目标月或完整海域的接收分母。[数据入口](https://www.heywhale.com/mw/dataset/623b00c9ae5cf10017b18cc6/content) · [使用该数据的原论文 §2.1](https://www.mdpi.com/2077-1312/14/13/1228) |
| 中国远洋渔业数据中心 | 第 I 级是 FAO 区域年产量，可公开取得。第 II、III 级需要申请，最细到 0.5°、最短到月，原始数据原则上不对外开放。远洋渔业统计的时间、格网和船队总体也与本研究不同。[中心公开管理规范第六条](https://hyxy.shou.edu.cn/sddwf/12843/list.htm) |
| GFW MarineTraffic 接收补充 | GFW 自 2024-01-03 引入 MarineTraffic 岸站数据。公开证据包括随机四日的消息新增比例、十日汇总和 0.1°格网新增船舶数图。这些统计描述新增量和局部改善，无法确定研究区在八月各日期、各格点的有效接收。2026-04 切换 Kpler 后覆盖又出现区域性变化，当前接收表现也无法回填 2024 年。[2024 岸站说明](https://globalfishingwatch.org/faqs/marine-traffic-new-ais-source/) · [2026 切换说明](https://globalfishingwatch.org/platform-update/data-vendor-transition/) |
| 东海燃油补贴研究复现档 | Zenodo 作者档案研究 2016 年政策，登记 CC BY 4.0。未在可读元数据找到原始观测起止日期、2024 年 8 月或逐日逐格接收说明。版本 2 的两条匿名 `Code.zip` 下载均返回 403，数据压缩包未下载。[作者公开档案](https://zenodo.org/records/17256558) · [DataCite 元数据](https://api.datacite.org/dois/10.5281/zenodo.17256558) |
| ScienceDB `satimgvessel` | DataCite 实读确认 V1、开放访问及 CC BY 4.0。元数据描述高分卫星影像船只检测的船位、类型、长度，未列影像观测期和地理范围，也未定义作业时长或接收覆盖。2026-07-29 是发布日，无法据此匹配观测日。[ScienceDB 记录](https://www.scidb.cn/detail?dataSetId=af20cf9ca599427bbf68c11e1dc604eb) · [DataCite 元数据](https://api.datacite.org/dois/10.57760/sciencedb.44434) |

## Sentinel-1 目录实测

查询时间取 2024 年 8 月 UTC。目标矩形为 123.65°E、29.70°N 至 124.35°E、30.30°N，包住三个既定半径。以来源记录的影像足迹和取得时间检索 Sentinel-1 GRD。STAC 两次查询采用相同的目标矩形，另用 120–128°E、27–34°N 作同月对照，每次响应上限请求为 4 条。Copernicus OData 用相同目标矩形并明确排除 9 月 1 日及以后。[Earth Search GRD 集合](https://earth-search.aws.element84.com/v1/collections/sentinel-1-grd) · [Copernicus STAC](https://documentation.dataspace.copernicus.eu/APIs/STAC.html) · [Copernicus Sentinel-1 产品说明](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-1)

| 目录 | 目标区返回 | 同月较大区域对照 |
| --- | ---: | ---: |
| Earth Search Sentinel-1 GRD STAC | 0 | 4 |
| Copernicus Data Space Sentinel-1 GRD STAC | 0 | 4 |
| Copernicus Data Space Sentinel-1 GRD OData | 0 | 未执行 |

实测仅取目录小样。对照中的 4 条是响应数量。结论限于本次查询所见的 GRD 产品足迹；即使取得可用的雷达快照，它提供的也是过境时刻的船舶观测，无法直接构造本研究的逐日捕鱼小时和 AIS 接收分母。查询回执和原始目录响应保存在本机 `data/processed/august-public-coverage-followup-20261119/`。

## 核验范围与执行顺序

- 具名 DOI 和候选关键词经匿名 DataCite 查询实际返回 HTTP 200。尝试下载的复现档仅为标称 21.1 kB 的 `Code.zip`，访问记录直链及 REST 文件入口各一次，均为 HTTP 403。此结果仅代表本次访问，无法据此判断档案的长期开放状态。[DataCite API](https://api.datacite.org/dois) · [小包公开记录](https://zenodo.org/records/17256558)
- 预注册中心位于农业农村部通知所述北纬 26°30′ 至 35°的纬度带。通知同时列出钓具和专项捕捞例外，以及 2024 年 8 月 1 日至 9 月 16 日的四类专项作业。若八月后续通过准入，应在解释活动水平及选择对照月时考虑休渔阶段与适用船队。政策时段也不足以把观测空缺填为零。[农业农村部通知](https://yyj.moa.gov.cn/tzgg/202409/t20240906_6461965.htm)
- 本次地域数据和接收资料未形成可提请确认的正式整月替代组合。继续保留 #67 → #68 → #71 → #98 的登记顺序和本机已验证的只读演示，优先推进无该数据依赖的工作。将来发现带版本、目标月逐日格网和授权的来源时，先以既定日期和三个半径验证观测空缺与可信零值的区分，再提交来源版本或试验窗口的变更供用户确认。[#67](https://github.com/NingRuo-code/Ocean/issues/67) · [当前执行规划](../plans/ocean-current-execution-order-2026-11-04.md)
