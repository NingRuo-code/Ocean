# imMens 较新引用与后续成果

检索日期：2026-10-21。范围：以 2023–2026 年论文为主，检查公开论文原文、作者官网和官方项目文档。不是完整引文数据库导出；Mosaic Selections 作者官网现列为 2026 年 TVCG / VIS，预印本首发为 2025 年。未报告未经数据库核验的总引用量。

## 原论文

Zhicheng Liu, Biye Jiang, Jeffrey Heer. **imMens: Real-time Visual Querying of Big Data**. Computer Graphics Forum / EuroVis, 2013, 32(3pt4):421–430. DOI: 10.1111/cgf.12129。

核心：分箱聚合、多维数据瓦片、浏览器 WebGL 查询与绘制，支持大规模数据的刷选联动。[作者项目页](https://www.zcliu.cs.umd.edu/immens/)

## 已核验的直接引用与成果

### Mosaic Selections，2026（预印本 2025）：最直接的方法延伸

Jeffrey Heer, Dominik Moritz, Ron Pechuk. **Mosaic Selections: Managing and Optimizing User Selections for Scalable Data Visualization Systems**. arXiv:2507.19690，2025-07-25 提交。作者官网现列 IEEE TVCG (Proc. VIS), 2026；区分正式题录年份与预印本年份。[作者题录](https://idl.uw.edu/papers/mosaic-selections)

- 原文 §3.1、§6 和参考文献 [35] 明确引用 imMens，并说明是对 imMens/Falcon 的推广与改进。
- 用稀疏数据库物化表替代稠密多维数组；分析视图查询与选择谓词，自动生成预聚合优化；支持更多聚合函数。
- 原文基准中，预聚合后的更新低于 100 ms，通常为 1–10 ms；部分大规模回归案例相对未优化查询改善 3–4 个数量级。只适用于论文测试条件，不等于所有场景或直接相对 imMens 的加速比。
- 局限：当前预聚合优化假设静态数据；动态更新采用删除并重建物化视图。

[摘要与版本](https://arxiv.org/abs/2507.19690) · [全文，含引用与实验](https://arxiv.org/html/2507.19690v1)

### DIVAN，ADMS 2025：聚合构建与存内计算

Junyoung Kim, Madhulika Balakumar, Kenneth Ross. **A Data Aggregation Visualization System supported by Processing-in-Memory**. VLDB ADMS Workshop, 2025。

- 原文 Related Work 和参考文献 [20] 引用 imMens。
- 提出 DIVAN，以按频率归一化的分箱分配可视化空间，并使用 CPU 或 Processing-in-Memory 计算多维聚合、排序推荐图像。
- 论文给出一亿行、32 列数据，计算 4,960 个 128×128×128 聚合约一分钟的结果。高维部分实验中 PIM 快于所选现代 CPU；低维实验反而较慢，收益依赖数据和硬件。
- 解决聚合准备与批量视图生成问题，不能把约一分钟的预计算描述为毫秒级实时刷选。

[官方论文全文](https://www.vldb.org/2025/Workshops/VLDB-Workshops-2025/ADMS/ADMS25-04.pdf)

### Analyzing the Shifts in Users Data Focus，IUI 2025：用户行为建模

Sanad Saha, Nischal Aryal, Leilani Battle, Arash Termehchy. **Analyzing the Shifts in Users Data Focus in Exploratory Visual Analysis**. IUI 2025. DOI: 10.1145/3708359.3712154。

- 原文直接使用 imMens 界面与交互日志，包括航班数据的多视图刷选、平移、缩放和选择。
- 将探索过程建模为 MDP，对比在线学习方法，报告强化学习方法更适合刻画所测用户的数据关注点变化。
- 属于 imMens 作为研究平台的后续应用，不是渲染或聚合查询引擎升级。

[作者公开全文](https://nischal5123.github.io/files/IUI25-Data-Focus.pdf)

### Mosaic，VIS 2023：通用可扩展架构

Jeffrey Heer, Dominik Moritz. **Mosaic: An Architecture for Scalable & Interoperable Data Views**. VIS 2023。

- 原文 §2.1 与参考文献 [25] 明确引用 imMens；讨论其分箱、数据瓦片及稠密索引局限。
- 提出 Client–Coordinator–Data Source 架构，将声明式视图查询交给数据库，自动协调选择与预聚合；示例包含 18 亿颗恒星的 Gaia 数据。
- 稀疏索引、聚合函数扩展、数据库缓存与可组合组件，使其比手工组织固定瓦片更通用。

[作者发表页](https://dig.cmu.edu/publications/2023-mosaic.html) · [原文](https://www.domoritz.de/papers/2023-Mosaic-VIS.pdf) · [项目文档](https://idl.uw.edu/mosaic/why-mosaic/)

## 补充候选

- **Optimizing Dataflow Systems for Scalable Interactive Visualization / VegaPlus，2024，PACMMOD / SIGMOD**：自动选择 Vega、数据库或混合执行计划，并考虑交互导致的计划变化，实验覆盖七种仪表板。与 imMens 的共同问题是交互查询效率；原文已核验直接引用 imMens，属于相邻优化路线。[原始预印本](https://arxiv.org/abs/2401.02952) · [正式论文全文](https://par.nsf.gov/servlets/purl/10522155)
- **Mosaic: An Architecture for Linking Databases and Scalable Interactive Visualizations**：作者提供 2025 文件版本，参考文献直接包含 imMens；该公开 PDF 仍有会议和年份模板占位；已由[作者官网](https://idl.uw.edu/papers/mosaic-sigmod-demo)核验为 SIGMOD Companion 2025，DOI 10.1145/3722212.3725117，获得 Best Demo Honorable Mention。它主要展示数据库和交互可视化联接，不应与 2023 Mosaic、2025 Mosaic Selections 作为完全独立技术突破重复计数。[作者 PDF](https://homes.cs.washington.edu/~jheer/files/2025.01-Mosaic-Demo.pdf)

## 阅读建议（本次检索的判断）

优先级：Mosaic Selections 2026（预印本 2025）→ Mosaic 2023 → VegaPlus 2024；关注新硬件与聚合准备成本时补读 DIVAN；关注智能探索推荐时补读 IUI 2025。

技术演进可概括为：imMens 的预聚合数据瓦片与 GPU roll-up，发展到更自动化的查询优化、稀疏物化视图和通用选择模型。这个表述是对上述论文的综合判断，不意味着所有论文都是同一项目版本。
