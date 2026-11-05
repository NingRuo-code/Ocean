# 无令牌的GFW官方试验数据路线（2026-11-05）

## 结论

找到可替代当前API访问前置的公开官方原包：Global Fishing Watch自己发布的Zenodo记录14982712，版本3.0.0，发布于2025-03-11，覆盖2012–2024。记录直接提供2024年逐日0.01°按flag/geartype汇总的fleet ZIP、README、schema和known issues；无需GFW账号或API令牌。该记录是2018年Science产品的新版本，不能称为论文最初发布的冻结数据。[官方Zenodo记录](https://zenodo.org/records/14982712)、[官方记录API](https://zenodo.org/api/records/14982712)

本次保持原试验日期2024-08-05至07，不需要改到2012–2016。整年包约3.35GB，但服务支持HTTP Range；已读取目录并解析ZIP64成员偏移，三日压缩内容合计31,776,798字节，可在50MiB下载预算内单独获取。只读公开资源，没有注册、登录、接受账户条款或绕过访问控制。[官方2024年原包](https://zenodo.org/records/14982712/files/fleet-daily-csvs-100-v3-2024.zip?download=1)

## 来源与字段合同

`fleet-daily-100-v3`将渔船AIS活动按日、0.01°格点、flag及geartype分组；另一个monthly产品为0.1°，不可替代日级研究输入。坐标为WGS84格网**左下角**，不能沿用API“中心点”的解释。不同flag/geartype同格同日多行是正常分组，需显式汇总；同组重复仍须单独审计。[官方fleet README](https://zenodo.org/api/records/14982712/files/README-fleet-v3.txt/content)

| 字段 | 官方含义与处理要求 |
| --- | --- |
| date | YYYY-MM-DD日期；README确认按日聚合，但本次未找到UTC日界明文 |
| cell_ll_lat / cell_ll_lon | 格网左下角纬度/经度，不是中心 |
| flag / geartype | 船旗与渔具类别；保留未知类别，不凭名称补分类 |
| hours | AIS存在时长，不能误读成捕捞时长 |
| fishing_hours | 模型判断为捕捞时的表观捕捞小时；本项目的目标指标 |
| mmsi_present | 该组在本格广播AIS的MMSI数；跨组/跨格求和不等于独立船数 |

上述字段见[官方fleet-daily schema](https://zenodo.org/api/records/14982712/files/fleet-daily-v3.schema.json/content)。schema将字段标为NULLABLE，空值不应通过默认0成为有效观测。README和schema没有将“未出现格”定义成零，也未提供逐格AIS有效接收支持域；因此真实记录零、没有记录及覆盖未知必须分开，完整全球日文件也不等于海域覆盖完整。

## 许可与适用限制

README和记录元数据明确CC BY-NC 4.0，限定非商业使用。本地研究可保留原档和元数据，公开展示/提交细网格仍按仓库治理另行核验，不把公开下载等同于允许将原始细网格提交Git。[官方fleet README](https://zenodo.org/api/records/14982712/files/README-fleet-v3.txt/content)、[仓库治理](../data-governance-gfw-ais.md)

2024数据是provisional：分类使用前后时段信息，未来版本可能改变。Known issues还明确说明2022年开始引入Dynamic AIS后，东海/南海接收改善明显；跨2021与2022/2023的小时增长可能源于接收变化。该产品可用于实际日级样本，但跨年对照和预测可知输入必须另作版本/可知性检查，不自动视作历史当时已可得数据。[官方known issues](https://zenodo.org/api/records/14982712/files/README-known-issues-v3.txt/content)

## 本地取得与校验

元数据和下载证据保存在Git忽略目录`data/processed/gfw-public-route-20261105/`：

- `record.json`：官方记录JSON，包含版本、许可、源文件大小及MD5。
- `README-fleet-v3.txt`：7,975字节，MD5 `be86244c910248e1aebf052789498a1e`，已与记录校验。
- `README-known-issues-v3.txt`：11,113字节，MD5 `cfc37e00ead71adb68849a168f225867`，已与记录校验。
- `fleet-daily-v3.schema.json`：1,497字节，MD5 `4e4c019416ec5a1e422e8804fe4d1169`，已与记录校验。
- `zip-members.json`：ZIP目录与实际ZIP64偏移；`http-evidence.json`保存Range请求、HTTP 206/Content-Range、响应字节数、取得时间与SHA256。

三日CSV的目标路径为`data/raw/fishing-source/v3-zenodo-14982712/`。每份成员在原始大小与CRC32核对后才写入最终路径，另存SHA256和来源。完整年包记录MD5为`6fae93f0126bf90f21d6f3a799d58001`，只取部分成员不能声称验证过整包MD5。实际完成清单以`sample-manifest.json`为准；不把未完成分片视为可用原档。

三份原始CSV已全部取得并校验，解压后合计177,381,513字节，压缩内容31,776,798字节；含元数据、目录和请求头读取仍低于50MiB预算。没有下载整年原包。下载过程遇到一次TLS EOF后重试成功；最初将ZIP64的32位哨兵误作实际偏移，服务器416拒绝，随后改读ZIP64扩展的64位偏移，未将错误响应当作原档。

| 内容日期 | 原CSV字节 | SHA256 |
| --- | --- | --- |
| 2024-08-05 | 58,283,851 | `862505ca565ee8829e4fe58bbb068417ca41db61c74b78fbb8a82f2dff79d783` |
| 2024-08-06 | 60,068,877 | `055f1d7d88720be6cb4d9f9bdb683588b2ee88d54785ab95417fefccbe180c96` |
| 2024-08-07 | 59,028,785 | `4a4093ae9907176536def1a555235a228fffd19e421e40cc058fd775f3899970` |

独立参照读取原CSV，使用Decimal按文本小时求和，不导入应用程序代码。在`120≤cell_ll_lon<128`、`27≤cell_ll_lat<34`内，按完整原始格网单元取值，没有铺零或推定覆盖：

| 日期 | 全球原行数 | 区域组行数 | 报告格数 | 表观捕捞小时 |
| --- | --- | --- | --- | --- |
| 08-05 | 1,095,213 | 104,832 | 74,483 | 78,720.1626 |
| 08-06 | 1,130,171 | 109,266 | 76,965 | 77,437.5473 |
| 08-07 | 1,109,772 | 113,686 | 80,627 | 89,772.4624 |

三份文件的内容日期各自唯一且匹配文件名；所选区域同日/格/flag/geartype重复组0、非有限或负小时0。组行数大于格数是正常多组汇总，不能按重复格丢行或取最大值。逐日显式零组与零/正格计数留在本地`sample-independent-inspection.json`，仅作来源核对，不构成有效支持面积或渔业关系结果。原始全球细网格只保留在本地忽略目录，报告未包含可重建细网格的明细。

日界补查：对GFW官方网页与官方GitHub可索引内容作有界检索，未找到能直接绑定v3 fleet日CSV的UTC日界声明或生成SQL。未将BigQuery默认时区、新版API或2026模型文档的时间说明当作v3实证；继续保留日界未知。

## 路线比较与接续

2018年Science研究本身使用2012–2016数据，官方介绍给出了当年的数据和GitHub链接；它不能直接证明2024试验资料。后来的官方门户说明下载需登录，API亦需Bearer令牌；这是**某条访问路线**的前置，不能推导所有官方公开分发路线均需令牌。[2018官方研究页](https://globalfishingwatch.org/research/global-footprint-of-fisheries/)、[门户说明](https://globalfishingwatch.org/data/new-data-download-portal/)

因此应将#38的当前事实前置从“只能等待本人令牌”改为“按已发现的官方固定Zenodo原包完成小样本接入和语义审计”。仍需核日界、左下角格网、实际小时、正常多组汇总/重复、零与未知及支持域；不因原包公开或日期文件存在而关闭#38、放行#39或宣称完整月合格。锋面时间依据仍是独立缺项。
