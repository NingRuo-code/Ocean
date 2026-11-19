# 东海 2024-08：真实来源预检与审计容量

对应 #36 来源登记、#44 实际资格审计与正式 #67/#68 的前置。本轮只核对原档日历、补齐整月审计容量，未计算目标效果、确认科学阈值或改变数据准入规则。

| 真实来源 | 八月官方目录或坐标 | 本地原档 | 全月原文件大小 | 剩余成员压缩大小 |
| --- | ---: | ---: | ---: | ---: |
| [锋面位置 20356239](https://zenodo.org/records/20356239) | 31/31 | 3/31 | 40,315,555 字节 | 35,791,332 字节 |
| [GFW 14982712 v3.0.0](https://zenodo.org/records/14982712) | 31/31 | 3/31 | 1,804,098,894 字节 | 286,028,270 字节 |
| [NOAA 可选补充海温](https://coastwatch.noaa.gov/erddap/info/noaacwBLENDEDCsstDaily/index.html) | 31/31，均为当天 12:00 UTC | 3/31 | 未估计整月切片 | 未下载海温格点 |

锋面 ZIP64 中心目录通过 15 个范围响应核对，总 1,874,793 字节，SHA-256 `889b093839ebdee3a12294af2e95ab7bf374c31e6b12a8ba21688646d92eb89d`。GFW 中心目录为已归档的 32,304 字节，SHA-256 `ebfafdc79183ddbf29dfffbd92d9db4084625cc3a9981e8fe0383618348843c6`。独立按原目录条目检查两套完整日期集合，逐日无重复。NOAA 只请求 `time` 坐标；响应 SHA-256 `1a4e2938a709425c43faf87bab71c64dc69df95142597278a510b7f95755d537`。本地原档仍为 08-05 至 07；其余日期的目录条目不算已下载或已核实观测。未校验两个完整 ZIP 的 MD5。

两个固定包的剩余成员合计 321,819,602 字节，另有 HTTP 开销和可选 SST 流量。全月已知未压缩输入超过原 256 MiB 读取限额，且每个 GFW 原文件均低于逐日适配器的单文件限额。沿用同一[来源审计](../data/source-audit.md)入口：显式 `--source-byte-budget-mib 2048` 时，只从逐个列出的登记文件读取并计算哈希；默认限额不变，拒绝将扩展预算用于目录递归。逐日审计继续消费相同的公开快照与私有定位。

用逐个列出的三源八月登记表执行真实本地来源扫描、逐日审计和冻结回读。日审计身份 `sha256:eafac3d29b058b56a2f0b9dff7cf39f60d92ae2daabecb04aef6842b3f1b3f10`：锋面和 GFW 各 3 天未核实、28 天缺档；海温 3 天已解析、28 天缺档；源解析错误为零，研究资格仍未核实。没有改写或补齐原档，也没有运行真实效果。

早期预检和回读产物保存在 Git 忽略的 `data/processed/intake-20261104/`。当前可直接使用下文的仓内登记。每台机器都须用自己的原档重建来源快照及私有定位，取得实际输入哈希。

## 本地归档成员核对

[固定成员表](../data/august-2024-archive-members.json)记录两份公开 ZIP 的记录号、全包大小、中心目录位置和 SHA-256，以及八月各成员的 ZIP 文件头偏移、压缩大小、原始大小和 CRC32。两套条目共 62 项，已用原中心目录独立回读。工具按固定成员名读取本地原档，大小和 CRC32 一致才输出原档 SHA-256。

```powershell
python tools/verify_august_archive_members.py
python tools/verify_august_archive_members.py --require-complete
```

默认读取仓库的 `data/raw`，可通过 `--raw-root` 指定另一份本地目录。第一条命令允许盘点缺档，并列出缺失成员的压缩字节数。发现内容不一致或原档不可读取时，两种模式均返回退出码 2。整月归档齐备后用第二条命令，任何日期缺档也返回 2。JSON 输出包含成员状态和成员表的规范化内容哈希，无本机绝对路径。工具只读原档，不请求网络。

11 月 15 日复跑时，锋面和 GFW 各 3 份匹配、28 份缺失，合计仍需 321,819,602 字节的成员压缩数据。两份归档全部匹配后，继续执行既有来源和逐日审计。日期、有效覆盖、零与未知、网格和许可仍按下方证据判定。

### 11 月 19 日复核

按固定成员表重验：锋面匹配 8 份、缺 23 份；GFW 匹配 4 份、缺 27 份；两源均无不匹配成员。缺失成员的压缩体积合计 304,470,118 字节，不含 HTTP 开销或海温。来源扫描、逐日审计、中央三个半径的共同支持审计与冻结回读均已复跑。10/20/30 公里各为 0/31 天；捕捞小时和有效面积未知。

在 8 月 1、2、5–10 日的八份锋面 NetCDF 上，关闭时间解码后分别复核内部值 `739465`、`739466`、`739469`–`739474`，均与文件名日期的 `date.toordinal() + 366` 相符。坐标数组逐字节相同；7200 个经度与 3600 个纬度与 0.05° 等距候选中心分别最大相差约 0.0000123°、0.0000077°。这只验证样本的内部日期一致性和坐标排列。它不定义同一天对应的 UTC 时段、当前版日文件的写出规则或官方格网边界，也不提供 GFW v3 逐日逐格有效覆盖。[锋面作者证据](../research/ocean-front-product-encoding-2026-11-04.md) · [GFW 固定版证据](../research/ocean-public-gfw-access-2026-11-05.md)

## 按日取得固定 ZIP 原档

取数命令接收来源和八月日号。以下示例只查本地文件与缺失成员的压缩大小。

```powershell
python tools/fetch_august_archive_members.py front 5 6 7
python tools/fetch_august_archive_members.py gfw 5 6 7
```

取得下节所列的来源依据后，将要补齐的日号逐个传入，并加 `--fetch`。命令以固定 ZIP 大小核对 HTTP 206 和 `Content-Range`，再核对成员头、解包大小与 CRC32。通过后写入原档目录并输出 SHA-256。重跑会复查并复用已经匹配的文件。遇到损坏的本地文件或下载失败时返回 2，修复该日期后可重跑同一命令。

`--raw-root` 可指定另一个已有目录。文件在目标目录内先写完，再通过同目录硬链接发布，目标文件系统需支持硬链接（如 NTFS 或常用 Linux 文件系统）。两个来源补齐后，运行上面的 `--require-complete`，再启动来源与逐日审计。

11 月 15 日分别将两套 8 月 5 日原档重新取到独立目录，SHA-256 均与现有原档一致。再次执行显示两份均已匹配。主原档目录仍各有三天。

## 从原档复跑到准入判定

在仓库根目录运行以下命令。三个输入分别是[八月来源登记](../data/august-2024-source-registry.json)、[逐日登记](../data/august-2024-daily-registry.json)和[既有中心点准入请求](../data/august-2024-central-support-request.json)。来源逐个登记了固定产品的八月日期，路径相对于仓库根。逐日登记保留原适配器和区域范围。准入沿用中心 `124°E, 30°N`、10/20/30 公里和 `front_effort` 用途，海温作为逐日附加证据。

```powershell
$augustAuditDir = "data/processed/august-audit-replay"
node tools/audit-research-baseline.mjs --source-registry docs/data/august-2024-source-registry.json --source-byte-budget-mib 2048 --out "$augustAuditDir/source.json" --private-out "$augustAuditDir/source-locators.private.json"
node tools/audit-research-baseline.mjs --daily-registry docs/data/august-2024-daily-registry.json --source-snapshot "$augustAuditDir/source.json" --private-locators "$augustAuditDir/source-locators.private.json" --start 2024-08-01 --end 2024-08-31 --out "$augustAuditDir/daily.json" --report-out "$augustAuditDir/daily.md"
node tools/audit-research-baseline.mjs --support-request docs/data/august-2024-central-support-request.json --daily-snapshot "$augustAuditDir/daily.json" --out "$augustAuditDir/support.json" --report-out "$augustAuditDir/support.md"
node tools/audit-research-baseline.mjs --read-support-snapshot "$augustAuditDir/support.json"
```

每条命令成功后再执行下一条。命令使用项目 Python 和既有几何、NetCDF 依赖，可用 `OCEAN_AUDIT_PYTHON` 指定解释器。每轮使用独立输出目录，私有定位仅留在 Git 忽略的本地加工目录。此流程也能盘点不完整输入，缺失日期保留在日历上。逐日登记固定用 LF 换行，避免 Windows 检出改变登记字节哈希。

11 月 15 日以这三份登记复跑。三套来源的逐日状态和输入文件哈希与早期预检一致。逐日登记采用固定换行后，快照身份重新生成。10/20/30 公里共同支持均为 0/31 日，捕捞小时和有效面积时间均未知。本地月分析提交入口对三个半径均返回 HTTP 409 `incomplete_required_support`。

`--daily-snapshot` 复跑的是准入预检，区域单元仍标记为待准备。即使文件齐备，正式准入还需根据提供方依据准备并核实区域网格单元，再按[用途资格合同](../data/support-qualification-audit.md)通过 `--regional-input` 和相应证据复核。

## 仍需提供方确认

- **锋面日期与格网。** 就 [Zenodo 20356239](https://zenodo.org/records/20356239) 的 `front_location20240805.nc`，确认 `time=739469`、`days since 0000-00-00` 的确切转换公式、日历和 UTC 日标签；最好提供写出 `time` 的代码或其他两个原档的预期值。同时确认经纬度为像元中心还是角点，或提供边界构造规则。作者[公开分析脚本](https://zenodo.org/records/17218778)对另一份合并文件提供 MATLAB 时间线索，不能代替这一版本的写出约定。
- **GFW 日分配。** 就 [固定 v3.0.0 的 `fleet-daily-100-v3`](https://zenodo.org/records/14982712)，确认 `date` 是否为 UTC 日，以及跨午夜时长是否按后一位置的日期归入该日。单 MMSI 下载说明有次日首条 AIS 位置接收前一日时长的例子，仍需固定 fleet 导出自身的依据。[11 月 15 日续查](../research/ocean-public-gfw-access-2026-11-05.md#11-月-15-日续查)
- **GFW 有效支持。** 确认 2024-08 是否存在适用的逐日逐格覆盖、质量或故障标记，以及缺行、显式零、仅有船舶存在时长各自的含义与可用范围。11 月 8 日复查官方定义，AIS 断线判定所用接收估计基于 2017–2019 年。Insights API 的 Coverage 衡量单船在航程期间有 AIS 报告的小时比例，空间单位也与逐日逐格覆盖不同。两条路线均未提供本月所需的有效支持证据。[GFW 数据限制说明](https://api-doc.globalfishingwatch.org/our-apis/documentation/docs/v3/general-api-doc/data-caveats)

确认后按归档目录取剩余日期、逐成员核大小/CRC 并记 SHA-256，完成同一月份的私有来源与逐日审计，再核对实际点位/半径、格网精度和许可。若发布方确认无法提供有效支持，继续保持 #67/#68 开放；任何只针对已有 AIS 报告格的分析都需要先评审不同的研究问题、分母和局限，不能直接代替既定整月结果。

## 2026-11-19 公开证据与复跑

已归档[锋面上游时间与格网](../research/ocean-front-upstream-grid-evidence-2026-11-19.md)、[GFW 固定版日界和覆盖](../research/ocean-gfw-fixed-v3-public-evidence-2026-11-19.md)、[四天原档缺行与显式零核对](../research/ocean-gfw-v3-local-cell-evidence-2026-11-19.md)。缺少当前锋面导出规则、固定活动日界及逐日逐格有效覆盖，本轮工作限于公开资料与现有样本。

归档成员核验仍为锋面 8 天匹配、23 天缺档，活动 4 天匹配、27 天缺档，两层均无不匹配成员。三个半径的资格回放各为 0/31 天，已匹配文件所在日的两个必需层仍有待核实。新资格快照为 `sha256:0edc6564c186045e7ea32ccdf97580c5e6c2cf8177d4fded5326df0174391c4c`，回读与新快照一致。相对上一轮 `sha256:bbf0e4095761a1c767f9eec01ef5429bfd872b84d796cbcbab3358e31cd25b68`，Windows 工作树中的审计器源码以 CRLF 换行，原始字节哈希和快照标识随之变化。将审计器字节换行转换为 LF 可复得上一轮审计器哈希。其余 JSON 字段逐项一致。

## 11 月 8 日验收

实际来源与逐日快照在修正后的入口复跑，内容身份一致。66 项 Node 工具测试（含 10 项来源审计 CLI）、143 项 Python 工具测试和 922 项数据一致性检查通过。双轴复审最终均为零项待修复。更广的 Node 运行有一项隔离发布测试在导入应用时失败。发布应用、脚本、输入和该测试与主分支逐文件一致。
