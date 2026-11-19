# #67 八月公开锋面候选与小样

2026-11-19。筛查范围为 2024 年 8 月、东海 124°E / 30°N 和已登记的 10、20、30 公里半径。候选样本只用于来源与覆盖核验。本轮未计算捕捞效应、未变更正式输入或登记，未联系提供方。

## 原锋面链接的内容

[Zenodo 20356239](https://zenodo.org/records/20356239) v1.0 发布了 1982–2024 年日级锋面位置和按年打包的锋面强度，其中含 `front_location.zip` 和 `front_intensity_2024.zip`。页面解释了锋线值、有符号冷暖锋区及强度逆变换。DataCite 登记的许可是 CC BY 4.0。文件清单未列与这个版本逐日 NetCDF 绑定的时间写出说明或网格边界代码。[DataCite 许可记录](https://api.datacite.org/dois/10.5281/zenodo.20356239) · [已有八份原档时间和网格核查](ocean-front-product-encoding-2026-11-04.md)

记录关联的 2026 年 Nature Communications 论文用 2012–2023 年的 GFW 数据，并指向截至 2023 年的旧版锋面及此前已复核的 MATLAB 程序。其商业捕捞记录需要申请。论文和附件没有提供本轮 2024 年原档时间、格网写出或渔业活动覆盖的版本专属依据。[研究论文数据及代码可用性](https://www.nature.com/articles/s41467-026-71250-0)

## 已取得的候选小样

两个候选均从 NOAA 的公开 ERDDAP 取得 NetCDF 数据，实际回读时间为 2024-08-05、06、07 各日 12:00 UTC。平方格边缘按东、北轴中心值各偏移半个网格间距，使用以固定点为中心的 WGS84 等积投影求格子与圆域的交叠。表中覆盖仅指候选锋面或海温层自身。

| 候选和实读身份 | 实测小样 | 局限及规划影响 |
| --- | --- | --- |
| NOAA STAR ACSPO L3S-LEO Daily RAN `L3S_LEO_DY-STAR-v2.81` | 0.02°，40×40 个中心坐标，纬度递减。三天各 1,600 格都满足 `quality_level=5`、`sst_count>0`、锋面码为 0 或 1。三个圆域都没有无效的相交格，分别相交 96、332、724 格。三天窗口内锋面标记分别为 156、180、111 格。 | 这个产品直接提供热锋位置、梯度和有效观测标记。`0` 是有效观测中的无锋面，填充值 `-128` 是缺测。ACSPO 的二值锋线没有原产品的有符号冷暖锋区。若用于正式输入，需要登记锋面算法、尺度、逐日有效支持和侧别适用性，再用同一请求重跑 #44/#64 后才进入 #67。适合先保留作锋线候选。[官方产品及 DOI](https://coastwatch.noaa.gov/cwn/products/acspo-global-002o-gridded-super-collated-sst-and-thermal-fronts-low-earth-orbiting.html) · [读取入口和字段说明](https://cwcgom.aoml.noaa.gov/erddap/griddap/noaacwLEOACSPOSSTL3SCDaily.html) |
| NOAA Geo-Polar Blended SST `Geo_Polar_DABlended-OSPO-L4-GLOB-v2.0` | 0.05°，18×18 个中心坐标。三天各 324 格均为水域 `mask=1`，分析海温和分析误差均有值。三个圆域均通过候选海温覆盖核对。 | 该小样可作为海温环境层或后续派生锋面的输入。它提供海陆冰掩码及分析误差，正式派生锋面还需另外登记并验证识别方法和有效域。[实际数据入口](https://polarwatch.noaa.gov/erddap/griddap/noaacwBLENDEDsstDLDaily.html) |

两个文件均以 GHRSST 自由开放协议声明数据使用，按 NOAA 产品说明保留来源署名和适用 DOI。ACSPO 的 12:00 UTC 坐标是日产品的参考时刻。三天样本中 `sst_dtime` 相对该时刻的差值为 15,905–23,075 秒，保留名义时刻和参与来源时刻的区别。[NOAA ACSPO 产品说明](https://coastwatch.noaa.gov/cwn/products/acspo-global-002o-gridded-super-collated-sst-and-thermal-fronts-low-earth-orbiting.html) · [ACSPO ERDDAP 属性](https://cwcgom.aoml.noaa.gov/erddap/griddap/noaacwLEOACSPOSSTL3SCDaily.html)

初次切片取 3 个日期。ACSPO 中心经度 123.61–124.39、纬度 29.61–30.39，文件 73,020 字节，SHA-256 为 `cb07f7f64d77a482716a919750b6ad96499bb0b20cd18b13811ea91c2de46e30`。Geo-Polar 中心经度 123.575–124.425、纬度 29.575–30.425，文件 17,420 字节，SHA-256 为 `26d81883623e98512dceab4e4045bf16d9c41f208fbbf16798ba60a898d9a534`。使用 NetCDF 时间、纬度、经度三轴验证真实返回条件，覆盖核查仅使用原始量及掩码。源码仓库只记录身份和聚合结果。

### 同一 ACSPO 小窗口的月历扩大检查

单独读取时间坐标得到 31/31 个名义日，全部为 12:00 UTC。整段像元请求返回 HTTP 502，改按四天分段，实读 05–07 日及 16–31 日共 19 天。01–04、08–15 日的像元请求超时，仍待核实。在 19 个实读日上，10/20/30 公里圆域的完整覆盖日分别为 19/17/16 天。20 公里最低为 94.99%，30 公里最低为 94.00%，均出现在 22 日。30 公里核到 21、22、27 日存在候选无效格。这个结果表明即使目录涵盖全月，较大圆域仍会有可测的观测缺口。

## 与研究准入的关系

共同支持仍需要同日、同研究域的表观捕捞活动，以及对活动源有效接收和真实零值的独立依据。ACSPO 可继续作为锋线与缺测对照。待有成对候选满足时间、共同覆盖和用途许可要求时，先把算法、侧别、尺度及受影响票据交给用户确认，再决定是否用于首个正式整月。[活动侧候选及原 Science 链接复核](ocean-august-public-activity-alternatives-2026-11-19.md)
