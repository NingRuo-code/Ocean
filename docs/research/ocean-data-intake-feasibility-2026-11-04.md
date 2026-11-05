# 真实试验数据获取与接入核对（2026-11-04）

## 结论与下一步

公开锋面与海温可以自动获取小样本；GFW 可按日期和区域请求，但需要用户账号的访问令牌。当前优先工作是打通同一区域、同一日期的真实数据接入和来源审计，再扩大到研究需要的完整时间窗。三日样本仅验证接入，不足以做完整月或事件前后七日实证，也不能据此认定锋面有预测价值。

本轮最终完成：2024-08-05 至 07 三个锋面原文件和三个海温原文件，共 4,290,944 字节；锋面三个成员均通过 CRC32 校验，六个文件均已读取并记录 SHA256。GFW 仍为未下载。下载完成后的来源快照为本地 `source-audit-after-download.json/md`，来源可读性改善不等于研究资格通过。

用户本轮已授权调查并自动获取本地试验数据。本次未部署服务器、发布真实数据、关闭研究 Issue 或修改产品计算规则。原档和处理证据保留于 Git 忽略目录；本报告只保存来源、汇总和可复查入口。

## 数据来源核实

### 锋面

[Zenodo 记录 20356239](https://zenodo.org/records/20356239) 是 *A global daily mesoscale front dataset from satellite observations*，记录说明覆盖 1982–2024 年、15,706 个逐日 NetCDF。位置档 `front_location.zip` 为 19,660,835,217 字节，记录提供 MD5 `f968dcbe12674e02676a84ffc316b5a3`；许可标为 CC BY 4.0。原记录 JSON 已本地留存。

本轮验证远程 ZIP 支持 HTTP Range，读取目录后仅获取 2024-08-05、06、07 三个成员，无需下载整个约 19.7 GB 压缩包。按成员原始大小、CRC32 和 HDF5 文件头校验，再记录 SHA256。只下载成员，因此**未验证整包 MD5**。断点片段不计作可用原档；完成清单见本地 `data/processed/intake-20261104/front-download-manifest.json`。

官方说明定义：`-10/10/30` 是锋线；非 `0/-128` 是锋区；正值为暖侧，负值且非 `-128` 为冷侧；`-128` 合并陆地或缺失，不能进一步分离。原文件对应变量为 `front`，全球网格 3600 × 7200。[来源：Zenodo 数据说明](https://zenodo.org/records/20356239)

读取已完成的 2024-08-05 原文件发现三个需要显式适配的问题：

- `time.units = "days since 0000-00-00"`，不满足通常 CF 日期解码；739469 不能仅凭看起来像某种日期序号就采用未经验证的换算。当前日期依赖成员文件名，时间坐标仍待来源算法或作者代码核实。
- `front.missing_value` 是字符串 `"-128"`，而变量是 int8；适配器必须检查声明并转换类型，不能把缺失误计为有效冷侧。
- 锋线、冷暖侧定义写在自定义说明属性中，没有现有审计器要求的标准 `flag_values/flag_meanings`；必须用本次固定来源版本的映射，并记录映射依据。

试验窗口为东经 120–128°、北纬 27–34°。三日原文件在窗口内均为 140 × 160 点，其中各有 19,102 点非 `-128`，3,298 点为陆地或缺失；锋线点数依次为 411、374、377，锋区点数依次为 5,019、4,390、5,079。这只是分类和读取检查，尚未进行面积、距离、几何或响应计算。逐文件结果见本地 `front-inspection.json`。

### 海温

使用现有下载入口，取得 NOAA `noaacwBLENDEDCsstDaily` 的 2024-08-05 至 07 三日 `analysed_sst` 与 `mask`。这属于补充海温产品；锋面数据本身由 ESA CCI/C3S SST 生成，不能把 NOAA 产品写成锋面提取原始输入。[NOAA 官方元数据](https://coastwatch.noaa.gov/erddap/info/noaacwBLENDEDCsstDaily/index.html)、[锋面来源说明](https://zenodo.org/records/20356239)

三个原文件各 122,696 字节，共 368,088 字节，保存于 `data/raw/sst/2024/`。单位 `degree_C`，掩码 1 表示水体，2 表示陆地，4 表示冰；本次文件实际出现 1、2。全部文件使用 xarray 成功读取，时间均解码为对应日 12:00 UTC，并记录 SHA256。核对证据在 `sst-inspection.json`，来源元数据在 `noaa-sst-info.json`。

ERDDAP 就近取点返回 141 × 161 点，最外坐标约 128.025°E、34.025°N，略超请求界限；按坐标重新限制 120–128°E、27–34°N 后为 140 × 160 点，各日水体有效值 19,193 点。不能直接把返回文件范围当成严格裁剪范围，也不能根据相同网格尺寸假定与锋面逐点完全对齐。

已用现有来源和逐日审计入口运行。实际坐标名是 `longitude/latitude`，本地审计配置已显式填写；文件的 `calendar="Gregorian"` 与审计器仅接受小写的规则不符，故现有审计报告仍标为 `unverified`，独立 xarray 检查可正常解码。最终三日海温审计为 `daily-audit-final.json/md`，先前 `daily-audit` 和 `daily-audit-verified` 是配置尚未补齐时的失败记录，不作为验收依据。该审计使用锋面首个成员落盘前的来源快照，锋面显示 `missing` 是该快照的历史状态，不代表后续下载结果。

### GFW 表观捕捞活动

用户给出的 [Science 论文 DOI](https://www.science.org/doi/10.1126/science.aao5646) 对应 2018 年研究。其网页本轮返回 403，未获得论文完整数据附件；不能把论文引用直接当成 2024 年试验数据的固定版本。GFW 官方页面说明，下载门户提供定期静态快照，地图与 API 持续更新；应选择覆盖目标日期的产品并固定版本。[官方 fishing-effort 来源页](https://globalfishingwatch.org/dataset-and-code-fishing-effort/)

GFW API 请求需要本人账号 Bearer token；本轮环境未配置 `GFW_TOKEN`，未发出带认证的数据请求，也未获得 GFW 原始文件。下载门户同样需要注册并接受相应条款。[认证说明](https://globalfishingwatch.org/our-apis/documentation/docs/authentication)、[官方数据入口](https://globalfishingwatch.org/datasets-and-code/)

已生成三份**未发送**请求草稿 `gfw-request-draft.json`：2024-08-05 至 07 逐日，初选 123.5–125.5°E、29.5–31.5°N，`DAILY`、按 `GEARTYPE` 分组并保留空间格点，拟用 0.01° 分辨率。这个小窗口用于验证契约，尚未确认具有足够活动或完整覆盖。正式执行前需查询并保存产品版本、目标日期可用性和返回字段；`latest` 本身不是可复现版本号。官网文档分辨率枚举出现 `HIGHT` 与现有脚本 `HIGH` 不一致，需在真实 API 接入时确认，不能把草稿视作已通过请求。[4Wings report 官方说明](https://globalfishingwatch.org/our-apis/documentation/docs/v3/4wings/report)

现有 `tools/pipeline/fetch_gfw_effort.py` 不宜直接用作科研归档入口：它将返回 ZIP 直接转换为记录，未保存完整下载包及其中说明；许可标记仍写 CC BY-SA 4.0，而现行官方页面/API 说明为 CC BY-NC 4.0。后续应先保存原包、全部说明、查询参数、产品版本和哈希，再做有明确字段契约的转换。[官方许可](https://globalfishingwatch.org/our-apis/documentation/docs/license-rate-limits)

`hours` 是 AIS 行为估计的表观捕捞小时，不是渔获量；AIS 接收、船舶覆盖和版本变化影响可比性。API 返回坐标按官方说明是格点中心。无记录、未知覆盖与显式零须区分；不能仅凭空返回生成零活动格点。[GFW 产品与局限](https://globalfishingwatch.org/dataset-and-code-fishing-effort/)、[字段说明](https://globalfishingwatch.org/our-apis/documentation/docs/v3/4wings/report)

## 工作顺序与完成标准

1. 用户在 [GFW 令牌页面](https://globalfishingwatch.org/our-apis/tokens) 取得本人令牌，保存在本机环境变量 `GFW_TOKEN` 或受保护的本地令牌文件。令牌不发送到聊天、不写入 Git。也可以从官方门户自行下载同日逐日活动原包供本地接入。
2. 完成小样本原档归档和元数据适配。先解决锋面时间/分类/缺失值与 SST 日历字段，保留原文件；同时取得 GFW 原包及固定版本。完成标准：三类数据同日可读、日期来源明确、单位/坐标/许可/掩码可追溯，审计无未解释的错误。
3. 对同一窗口做一次确定性的时空匹配和守恒检查。完成标准：能够解释哪些格点被排除、为什么被排除，活动小时转换前后守恒，缺失不变零。此时才考虑扩大下载。
4. 按研究规格补齐完整月及事件前后窗口、覆盖与对照；随后计算研究结果。首轮跳过锋强度大型档、长期全量数据和额外外围功能，先消除真实输入的不确定性。

目前最大问题从“没有任何真实原档”收窄为“GFW 访问条件与真实产品编码尚未接通”。本次已有下载和读取证据，但尚未形成三源联合试验。原 #37/#38 等研究关口保持待验收；本报告不是 Issue 完成证明。

## 本地复查入口

- 原档：`data/raw/front/2024/`、`data/raw/sst/2024/`。
- 本轮证据目录：`data/processed/intake-20261104/`（Git 忽略）。
- 锋面可恢复下载辅助：`tmp/fetch-front-three-days-20261104.py`，依赖证据目录中的已核对 ZIP 成员目录；它是本次调查辅助，不是可部署的通用下载组件。
- 锋面独立读取检查：`tmp/inspect-front-intake-20261104.py`，显式按已核实的官方分类解释。
- 本地搜索核查了仓库数据路径和部分常见下载位置，未找到可复用的既有锋面原档；没有全盘扫描，不能据此断言其他目录不存在。

联网最初多次超时/重置，之后断点续传恢复。下载完成状态以成员清单及实际文件为准；保留历史失败记录便于续传和核对。本报告中的来源结论依据上述官方页面及本地实际读取，未根据搜索摘要替代原始字段检查。
