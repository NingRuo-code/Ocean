# 锋面产品编码核查（2026-11-04，11 月 5 日收尾）

## 结论

可确认当前 Zenodo 产品的锋线、锋区、冷暖侧及缺失值分类规则，也可确认本地三份原文件的实际坐标。**仍未找到作者对 NetCDF 时间原点的明确说明或生成时间变量的代码，不能把 `739469` 自动认定为已核实的 MATLAB 日期序号。** 当前接入应继续保留 `time_verified=false`，文件名日期只能作为另行标注的候选日期，不能代替时间坐标验收。[当前产品说明](https://zenodo.org/records/20356239)、[作者代码记录](https://zenodo.org/records/14373833)

本次仅核查公开作者资料及已下载的小样本；没有联系作者，没有下载全量锋面档，没有修改原始数据或产品实现。

## 已核查的作者资料

1. 当前记录 `20356239` 的本地官方 API 快照 `data/processed/intake-20261104/zenodo-record.json`：说明覆盖 1982–2024 年，包含 15,706 个逐日位置文件；文件列表没有独立时间读取说明或当前 NetCDF 写出脚本。[记录 API](https://zenodo.org/api/records/20356239)
2. 原文件属性指向的记录 `14373833`：这是旧版数据记录，不是专门的时间编码规范。记录说明旧档包含 42 个 MATLAB v7.3 年文件，并提供 `code.zip`；旧档使用 MATLAB 并不能证明新版 NetCDF 的时间原点。[旧版记录 API](https://zenodo.org/api/records/14373833)
3. 该记录的 `code.zip`：33,039 字节，MD5 与官方 `a15b3e4090767fc2630e9b179b4d27b0` 一致。包内是 `global_front_CCAIM.m` 和四个 `.mexa64` 扩展，没有 README 或 NetCDF 导出脚本。可读 `.m` 文件不含 `datenum`、时间坐标生成或 NetCDF 写出逻辑；未逆向编译扩展。[作者代码原包](https://zenodo.org/api/records/14373833/files/code.zip/content)
4. ESSD 2025 正文的数据与代码可用性部分：说明逐日 NetCDF、变量名、7200 × 3600 网格与分类用途，举出 `20230105.nc` 日期样例，但没有给出 `days since 0000-00-00` 的解释。[论文正文](https://essd.copernicus.org/articles/17/2831/2025/)

论文补充 PDF 已下载并保存 HTTP 证据。11月5日继续读取其三页提取文本：封面和S1/S2两幅统计图的说明未提供日期编码、时间原点或NetCDF写出约定；全文检索 time/datenum/calendar/NetCDF/coordinate 无命中。本结论限于可提取文本，不声称分析过图中每个像素。[补充材料](https://essd.copernicus.org/articles/17/2831/2025/essd-17-2831-2025-supplement.pdf)

## 可以采用的分类规则

当前记录的推荐用法与本地文件说明支持以下规则。必须先排除 `-128`，否则会把陆地或缺失误判为冷侧；该产品不能区分这两类缺失原因。[当前产品说明](https://zenodo.org/records/20356239)

| 含义 | 判定 |
| --- | --- |
| 陆地或其他缺失 | `front == -128` |
| 非锋区 | `front == 0` |
| 锋线 | `front in {-10, 10, 30}` |
| 锋区 | `front != 0 and front != -128` |
| 暖侧（按产品推荐定义） | `front > 0` |
| 冷侧 | `front < 0 and front != -128` |

作者源码将暖侧赋值 `20`、冷侧赋值 `-20`，随后加上 `front * 10`，最后将缺失赋值 `-128`。因此按这段代码推导，锋线上 `-10/10/30` 分别来自 `-20/0/20` 加 `10`。这与网页及论文中逐一解释三个锋线值的顺序存在不一致；当前网页也提醒该句容易混淆，并要求一般用户采用上述集合及正负值规则。**不要进一步为 `10` 与 `30` 增加未经核实的物理子类别。** 源码是旧版算法证据，不足以证明当前每份 NetCDF 的写出过程。[作者代码](https://zenodo.org/api/records/14373833/files/code.zip/content)、[当前说明](https://zenodo.org/records/20356239)

本地三份文件的 `front` 为 int8，`missing_value` 却是字符串 `"-128"`，且没有标准 `flag_values/flag_meanings`。实现可使用绑定到本产品记录的显式分类适配；应保留原始属性并检查未知编码，不能将该映射应用到所有名为 `front` 的文件。[原包来源](https://zenodo.org/records/20356239)

## 时间与网格：实际观察和证据边界

使用 `xarray.open_dataset(..., decode_cf=False)` 直接读取本地原档，未转换日期、修改属性或重写文件：

| 原文件 | `time` 原值 | `time.units` |
| --- | --- | --- |
| `front_location20240805.nc` | `739469.0` | `days since 0000-00-00` |
| `front_location20240806.nc` | `739470.0` | 同上 |
| `front_location20240807.nc` | `739471.0` | 同上 |

三份文件时间属性都只有 `standard names="reference time"`、上述单位及 `time_zone="UTC"`，没有日历字段或额外时间定义。零月零日不能作为普通日期直接解码；三个数值连续和文件名连续，最多证明样本内部顺序一致，不能确定时间起点。即使某种换算恰好匹配这三个文件名，也仍属于候选解释。[原包来源](https://zenodo.org/records/20356239)、[CF 时间坐标约定](https://cfconventions.org/cf-conventions/cf-conventions.html#time-coordinate)

三份原档的维度均为 `front(lat, lon, time)`，大小为 `3600 × 7200 × 1`。坐标属性声明 WGS84 经纬度；纬度端点约 `-89.9749985`、`89.9750061`，经度端点约 `-179.9750061`、`179.9750061`。浮点精度下的约 0.05° 间隔与论文分辨率一致。原档仅有 `front/lon/lat/time` 四个变量，无格网边界变量或显式中心点语义。[产品及原包](https://zenodo.org/records/20356239)、[论文](https://essd.copernicus.org/articles/17/2831/2025/)

上述半格偏移与中心坐标的假设一致，但本轮未找到作者明确给出的格网边界定义。可以按原始坐标取样、裁剪并记录间距；若后续要计算格网面积或进行守恒重映射，应单独记录采用何种边界构造、假设及验证，不能把推导边界写成原文件已有的属性。

## 归档证据与后续条件

新增调查证据在 Git 忽略目录 `data/processed/intake-20261104/`，每次公开网络下载保存相应 `*-http.json`，包括来源 URL、响应头、时间与 SHA256：

| 证据 | SHA256 |
| --- | --- |
| `algorithm-record.json` | `5ed962482fb6eac4748134199bba74638effeb060cd03d2f67abb5232efadca1` |
| `author-code.zip` | `efb2d307541966f74382dd81ccee8998ecf52c9e740286181fd7023efc19a0eb` |
| `essd-article.html` | `a963ed95cfefe438d26b0faaf40b01111e40253a7cd38e69b3b7722112e8c594` |

本地三日原档的下载来源、成员 CRC32 与 SHA256 见同目录 `front-download-manifest.json`；逐日检查见 `front-inspection.json`。这里只验证已取得的成员，不声称验证过整个约 19.7 GB ZIP 的 MD5。[前次接入调查](ocean-data-intake-feasibility-2026-11-04.md)

时间关口解除所需的新证据应是：作者发布的新版时间字段说明、实际 NetCDF 生成代码或作者明确确认的换算约定，并与样本验证一致。当前已充分支持分类适配，尚不足以让日期审计通过；继续扩大下载或增加推测换算不会补齐该证据缺口。
