# Ocean 聚合交互方向论文候选核验

核验日期：2026-10-16。范围：imMens、Nanocubes、Hashedcubes、Falcon，以及一个补充候选 Mosaic。只使用作者论文、作者项目/源码与正式发表信息；没有运行这些上游系统，不把源码可访问等同于已验证可部署，也不将论文基准迁移成 Ocean 的性能承诺。CCF 等级本次未核验，不据此排序。

## 结论

**是否换主论文取决于下一步交付，而不是发表年份。**

- 如果近期交付是改进已有 SST / 锋面单日地图的按视野请求、分辨率选择与传输，继续保留 imMens 作为方法依据很合理。其分桶和多尺度数据瓦片能解释这一设计；应保持“借鉴并适配”的表述。
- 如果下一步明确交付“地图范围 + 日期区间 + GFW 表观捕捞努力量图 + 统计卡”的联动探索，**Mosaic 是本轮更值得优先试验的主论文候选**。理由是已有查询协调架构、数据库内预聚合索引，以及原论文明确实现的 sum/avg 支持，较直接对应 Ocean 所需统计量。它不要求照搬 vgplot 的地图外观。
- Nanocubes 更适合真正要研究或复现时空聚合索引的路线；Hashedcubes 适合强调低内存索引构建与查询实验的路线；Falcon 适合强调拖动刷选、活动视图切换和交互分辨率权衡的路线。它们并不天然比 imMens 更贴合所有 Ocean 场景。
- 任一候选都不直接解决锋面事件识别、事件匹配、AIS 响应基线、科学解释或渔获验证。它们是交互查询和系统性能论文。

以上是结合 Ocean 目标的工程判断，不是论文作者的结论。项目语义依据：[CONTEXT.md](../../CONTEXT.md)；AIS 是表观捕捞努力量，不是渔获产量；缺测不等于零。

## 题录与公开材料

| 论文 | 已核实发表信息 | 原文 / 作者页 | 作者公开实现 | 本次访问结果 |
|---|---|---|---|---|
| imMens: Real-time Visual Querying of Big Data | Zhicheng Liu, Biye Jiang, Jeffrey Heer；Computer Graphics Forum 32(3)，EuroVis 2013；DOI 10.1111/cgf.12129 | [作者组论文页](https://idl.uw.edu/papers/immens)、[PDF](https://idl.cs.washington.edu/files/2013-imMens-EuroVis.pdf) | [uwdata/imMens](https://github.com/uwdata/imMens) | 论文与仓库可读 |
| Nanocubes for Real-Time Exploration of Spatiotemporal Datasets | Lauro Lins, James T. Klosowski, Carlos Scheidegger；IEEE TVCG 19(12)，2013，2456–2465；VIS 2013 | [作者页](https://cscheid.net/2013/10/01/nanocubes.html)、[作者 PDF](https://cscheid.net/static/papers/nanocubes.pdf)、[项目页](https://laurolins.github.io/nanocube/) | [laurolins/nanocube](https://github.com/laurolins/nanocube) | 论文与仓库可读；项目页旧 PDF 链接抓取失败，作者镜像可读 |
| Hashedcubes: Simple, Low Memory, Real-Time Visual Exploration of Big Data | Cícero A. L. Pahins, Sean A. Stephens, Carlos Scheidegger, João L. D. Comba；InfoVis 2016；期刊卷期 TVCG 23(1)，2017，671–680；DOI 10.1109/TVCG.2016.2598624 | [作者页](https://cscheid.net/2016/09/12/hashedcubes-simple-low-memory-real-time-visual-exploration-of-big-data.html)、[作者 PDF](https://cscheid.net/static/papers/infovis_hashed_cubes_2016.pdf)、[正式题录](https://pubmed.ncbi.nlm.nih.gov/27875182/) | [cicerolp/hashedcubes](https://github.com/cicerolp/hashedcubes) | 论文与仓库可读 |
| Falcon: Balancing Interactive Latency and Resolution Sensitivity for Scalable Linked Visualizations | Dominik Moritz, Bill Howe, Jeffrey Heer；ACM CHI 2019；DOI 10.1145/3290605.3300924 | [作者组论文页](https://idl.uw.edu/papers/falcon)、[PDF](https://idl.cs.washington.edu/files/2019-Falcon-CHI.pdf) | [vega/falcon](https://github.com/vega/falcon)；[后续库 cmudig/falcon-vis](https://github.com/cmudig/falcon-vis) | 论文与仓库可读；后续库不能直接当作 2019 论文版本 |
| Mosaic: An Architecture for Scalable & Interoperable Data Views | Jeffrey Heer, Dominik Moritz；VIS 2023 报告，正式引用 IEEE TVCG 30(1)，2024，436–446；DOI 10.1109/TVCG.2023.3327189 | [作者组论文页](https://idl.uw.edu/papers/mosaic)、[PDF](https://idl.cs.washington.edu/files/2024-Mosaic-TVCG.pdf)、[CMU VIS 2023 页](https://dig.cmu.edu/publications/2023-mosaic.html) | [uwdata/mosaic](https://github.com/uwdata/mosaic)、[官方文档](https://idl.uw.edu/mosaic/) | 论文、文档与仓库可读 |

年份混用说明：Hashedcubes 的会议展示年份与期刊卷期年份不同；Mosaic 也如此。PPT 建议写“VIS 2023 / TVCG 2024”，不要误认成两篇论文。

## 方法、数据模型和与 Ocean 的关系

### imMens

原论文 §5–6 的核心是对记录进行分桶，将完整数据立方体拆为支持视图间交互的 3/4 维子立方体，再切为多变量数据瓦片，按需传给浏览器，使用 WebGL 做 roll-up 查询与渲染。原文明确指出更高维复合刷选会导致瓦片维度和体量增加。[原文](https://idl.cs.washington.edu/files/2013-imMens-EuroVis.pdf)

**适配判断：**规则 SST 网格转为“日期、格点、温度、有效权重”记录后可以生成汇总，但这已经是领域适配；普通视口裁剪、步长抽样、缓存和服务器聚合不能单独称为完整 imMens 复现。保留该论文作为“视觉分辨率驱动数据规模、分桶优于漏采样”的依据很合适。已有 WebGL 并不是引用思想的前提，但如果自称复现原系统就必须说明 GPU 聚合是否真正实现。[作者仓库](https://github.com/uwdata/imMens)

### Nanocubes

原论文以具有空间位置、时间与类别属性的事件记录为中心，通过层次化时空表示与共享结构压缩数据立方体，支持区域/时间范围聚合和多视图刷选。论文的演示重点是事件计数及其分布，不是 NetCDF SST 科学栅格处理。[原文](https://cscheid.net/static/papers/nanocubes.pdf)

作者当前 master 是 v4 起的 C 实现，区别于较早的 C++ 模板版本；API 文档有地图网格 drill-down、矩形瓦片范围约束与时间查询。**不能把其他同名 Python Nanocube 项目当作该论文源码。**[作者 README](https://github.com/laurolins/nanocube)、[v4 API](https://github.com/laurolins/nanocube/blob/master/api/README.md)

**适配判断：**GFW 日网格可视为带 fishing_hours 权重的事件/格点记录，但本轮未完成 v4 所有加权度量配置的源码验证，不应承诺开箱即用。SST 至少需要同时保存分子与有效权重；锋线几何仍需独立对象层。若近期目标只是现有规则栅格视口 API，增加专用索引服务的成本未必值得；若目标是多维长期频次/活动分布，则更对口。

### Hashedcubes

其核心不是将更多统计结果全部物化，而是逐级稳定排序、连续数组分区与 pivot 区间表示，查询时利用层次范围跳过无关分区。原论文支持空间、类别与时间维度联动；计数可从区间长度得到，维度顺序影响查询代价，动态/流数据被列为未来工作。[原文 §3、§7–8](https://cscheid.net/static/papers/infovis_hashed_cubes_2016.pdf)

作者实现为 C/C++ 路线，README 给出 Boost/CMake 构建与 Web 界面。[作者仓库](https://github.com/cicerolp/hashedcubes)

**适配判断：**适合用 GFW 点/网格记录或锋面发生记录做“朴素扫描 vs 索引”的内存、构建时间和查询延迟实验；均值或小时 sum 不能由 pivot 长度直接获得，可设计按最终记录顺序排列的权重前缀和，但这是 Ocean 扩展，不是论文已证明的现成功能。密集 SST 原始数组本来就有空间索引，把它转为大量通用记录未必更省。

### Falcon

Falcon 以当前活动视图为中心，建立活动视图与其他视图之间的数据瓦片，利用累积计数/积分表对区间和二维矩形刷选取差；切换活动视图时重新索引，并先用较低交互分辨率再细化。其目的更偏“地图/直方图间持续拖刷选”，而非单次 API 查询。[原文 §4](https://idl.cs.washington.edu/files/2019-Falcon-CHI.pdf)

**重要边界：原论文讨论明确表示 prototype only implements count。**作者说明 mean 可由 sum、count 组合，variance 可由 sum、count、sum of squares 组合；这些不能被转述为原型已经实现 SST 均值。[原文 §6](https://idl.cs.washington.edu/files/2019-Falcon-CHI.pdf)

**适配判断：**如果 Ocean 确实新增日期刷选与地图/统计图联动，Falcon 是很清楚的算法主线；如果只有单张地图变更日期，它的活动视图机制未被充分使用。GFW 小时与 SST 加权均值都需扩展度量。后续 falcon-vis 有自定义可视化 API，但应明确其与论文原型的区别。[原型仓库](https://github.com/vega/falcon)、[后续库](https://github.com/cmudig/falcon-vis)

### Mosaic：唯一追加候选

Mosaic 将视图的数据需求表达为声明式查询，通过 Coordinator 管理共享选择、请求与优化；原论文 §6.2 明确支持 count、sum、avg、min、max 的自动聚合索引，使用数据库内的稀疏表，索引留在数据库复用。**一般自定义 SQL/聚合的可表达性，不等于自动索引器支持任意自定义聚合函数。**[原文](https://idl.cs.washington.edu/files/2024-Mosaic-TVCG.pdf)

它对 Ocean 的优势来自已有统计与互操作能力：官方示例把出租车拾取/落点地图与小时直方图通过同一 crossfilter 联动，坐标变换在数据库完成；这是“空间 + 时间”的具体证据，但示例时间是一天内小时，不是 Ocean 日期范围成品。[官方 NYC Taxi 示例及代码](https://idl.uw.edu/mosaic/examples/nyc-taxi-rides.html)

官方 Core 接口允许自定义客户端提供 query、queryResult 等方法，Selection 可合并多个谓词；现有 React、SVG 或其他地图渲染可以作为客户端接入，不必整页换成 vgplot。地图投影、缩放、日期过滤与产品状态仍需对接。[Core 文档](https://idl.uw.edu/mosaic/core/)、[React 接入示例](https://idl.uw.edu/mosaic/web-clients/)

官方文档中的 raster/heatmap 首先是密度可视化概念，不能看到名字就认定它原生读取 SST 科学栅格或自动保留细锋线。[vgplot 文档](https://idl.uw.edu/mosaic/vgplot/?lang=js)

## Mosaic 相对 imMens：何时值得更换主论文

| 实际计划/测量结果 | 建议 | 原因 |
|---|---|---|
| 单日 SST/锋面地图，主要问题是 SVG 复杂度、数据传输、视口响应 | 保留 imMens 作方法参考；先测量 | 查询协调框架无法直接消除浏览器绘制成本 |
| 日期范围 + 地图 + GFW 时间序列/统计卡的过滤聚合确实慢 | Mosaic 作为优先原型候选 | sum/avg、共享选择、数据库内聚合索引可形成完整可验证链 |
| 固定维度、离线数据、希望深入复现一个索引算法 | Nanocubes 或 Hashedcubes 进入实验对照 | 研究对象明确，实验可以覆盖内存、构建、查询代价 |
| 要重点研究刷选延迟、活动视图切换、交互分辨率 | Falcon 可作主论文 | 研究问题与其机制直接一致 |
| 即将汇报，尚无原型或对照实验 | 不因候选更好而把 PPT 改成已采用 | 可将 Mosaic 加为下一阶段选型，不改变已完成工作的事实 |

### 建议的最小 Mosaic 试验范围（工程建议，尚未实现）

1. **先只选 GFW 已有合法可用数据切片。**整理为 `date, lon, lat, fishing_hours, coverage/status` 的列式分析表；保持现有 FastAPI 和地图 UI，通过受控适配层接入 DuckDB 与 Mosaic 查询协议。原始数据不转成公开演示文件。
2. **只做一张聚合图 + 一条按日时间序列 + 一个总小时数卡片。**以地图矩形/视野与日期区间为共享选择，验证双向过滤是否真正需要；不先做全历史 SST 表展开或全部页面迁移。
3. **对照同一统计语义。**现有 API、朴素 DuckDB GROUP BY、Mosaic 开启/关闭索引；分别测冷启动、建索引、首次查询、连续日期拖动、视野切换、内存/磁盘与浏览器绘制。
4. **只有查询层收益确定后扩展 SST。**预先派生数值分子和有效权重，分别 SUM 后在结果层求比值；确认该查询形式可被当前索引器优化。普通 AVG 不自动等于面积/有效覆盖加权均值。

DuckDB 的额外成本包括依赖和服务运行、文件布局/ETL、索引表生命周期、更新后失效策略、并发与受控查询接口、结果格式适配。Mosaic 当前仓库提供 Python DuckDB server、REST / WASM 连接方式；这不意味着现有 FastAPI raster endpoints 自动兼容。[作者仓库及服务器说明](https://github.com/uwdata/mosaic)

因此，Mosaic 的“工程路径较直接”是相对于从旧 GPU/专用索引原型全面移植而言；如果当前数据和查询很小，额外层也可能得不偿失，必须让测量决定。

## 无论选哪篇，都要保持的海洋统计语义

以下是 Ocean 应自行定义和验证的统计规则，不是候选论文替项目提供的科学保证。

- **SST：**`mean = Σ(w_i × SST_i × valid_i) / Σ(w_i × valid_i)`；`coverage = Σ(w_i × valid_i) / Σ(w_i × eligible_i)`。`w` 可以是等权、面积或其他预先声明权重；空间区域均值与跨日均值的分母必须明确。分母为零返回 unavailable / null。不同层级合并时保留分子和分母，避免“均值的均值”改变权重。
- **锋面频次：**先定义每天某格点是否存在锋面，再计算 `front_days / valid_observation_days`。不能用锋线顶点数或线段数当发生频次；低分辨率显示需另保留 occupancy/max-presence 或几何对象层，防止窄结构被平均掉。保留结构与频次是不同任务。
- **AIS：**对 fishing_hours 求和，不是对记录计数；原始 AIS 点数也不等于作业小时。无覆盖保留缺失状态。按前后窗口比较时，日期数、coverage 和有效日不同需要明确归一化，防止把更长窗口的总量直接与短窗口比较。
- **锋面缓冲响应：**地图显示网格可以粗聚合；前缘缓冲分析仍应使用规定的较细来源或预计算 Front Response Table，不能用屏幕分桶替代分析真值。

## 报告表述与复现边界

适当表述：

> 基于 imMens 的分桶与多尺度数据瓦片思想，结合 Ocean 数据语义设计聚合方案；后续比较 Mosaic 的查询协调与数据库内预聚合索引，验证日期—空间联动的收益。

只有实现并验证查询协调、共享选择、索引/缓存机制与对照实验后，才适合写“复现/适配 Mosaic 核心机制”；只使用 DuckDB SQL 不能支撑这一表述。性能实验同时报告正确性和 coverage，论文中的大数据量、帧率和查询延迟均不能当作 Ocean 已实现指标。

本笔记不认定当前仓库已复现任何候选，也不对原 PPT 是否存在夸大作独立判断；该部分应结合逐页内容和代码事实分析。
