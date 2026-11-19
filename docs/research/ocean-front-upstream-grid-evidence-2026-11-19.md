# #67 锋面上游格网与时间：公开证据复核

2026-11-19，仅复核公开材料及已登记样本。目标固定为 Zenodo `20356239` 的 2024-08 逐日锋面位置产品，未发询证、未修改登记或下载整月原档。

| 问题 | 公开材料直接支持什么 | 对当前锋面原档的适用范围 |
| --- | --- | --- |
| 坐标及格网 | [当前锋面发布记录](https://zenodo.org/records/20356239)明示 7200 经向 × 3600 纬向及 ESA CCI/C3S SST 来源；[ESA SST CCI L4 用户手册表 14–15](https://climate.esa.int/media/documents/SST_CCI_D4.2_PUG_v1.1.pdf)明确区分 0.05° 格点中心和像元边界；[Copernicus Marine 产品手册 §2、附录 §6a](https://documentation.marine.copernicus.eu/PUM/CMEMS-SST-PUM-010-024.pdf)给出 2022–2024 C3S ICDR、全球 0.05° 规则网格和 WGS84 坐标。 | 与八份本地锋面坐标的半格偏移相符，进一步支持中心坐标解释。上游文档未说明锋面导出是否逐点保留同一组边界；当前 NetCDF 没有独立边界变量。边界构造仍是候选，不升级正式面积证据。 |
| 日期标签、代表时刻 | [C3S 算法说明 §5.1](https://dast.copernicus-climate.eu/documents/satellite-ist-sst-global/WP2-FDDP-SSTv1.0-ATBD-v1.1_Final-2.pdf)将上游 L4 日产品的文件名时刻定义为窗口中心 12:00 UTC；[Copernicus Marine 手册 §2e/g 与 §6a](https://documentation.marine.copernicus.eu/PUM/CMEMS-SST-PUM-010-024.pdf)给出同一上游产品的参考时刻以及附录示例时间属性。 | 上游示例 `time` 使用从 1981-01-01 起算的秒，与当前锋面文件的 `days since 0000-00-00` 不同。不能把上游正午直接当成逐日锋面的发布时间字段、日界或写出公式。既有 MATLAB 日期序号仍是候选。 |

2025 年 [ESSD 论文 §2.1、§6](https://essd.copernicus.org/articles/17/2831/2025/) 针对的是截至 2023 的原版。它支持算法使用逐日 0.05° 海温输入及相应网格尺寸，不能替代当前记录中 2024 年文件的写出说明。[此前对固定锋面成员的核对](ocean-front-product-encoding-2026-11-04.md)与新的上游证据并列保留。

结论：新增的是可引用的上游坐标和时刻定义，以及上游与锋面时间编码不相同这一项边界。仍缺绑定 `front_location*.nc` 的导出代码或数据字典，足以确认 `time=739469` 的确切转换、时间代表含义与从经纬度生成像元边界的规则。保持 `time_verified=false`，不向正式 #67/#68 写入证据通过状态。
