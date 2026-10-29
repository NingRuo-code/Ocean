# E02：下载所读版本的带校验清单成果包

执行票[#316](https://github.com/NingRuo-code/Ocean/issues/316)，归属[补充规格#314](../../specs/ocean-synthetic-case-export-software-spec-2026-10-29.md)，前置#315；原真实#134/#138/#139不结项或改边。

同一本人版本导出ZIP，固定report.md、daily.csv及manifest.json。两个内容与独立下载一致，清单核身份、SHA256/字节数和未交付项；只读、不含数据库、原档或其他版本内容。实际浏览器落盘与独立ZIP/散列核对，覆盖重试一致、权限拒绝、晚响应及退出。

状态：在前置#315关闭/原生开放阻塞清零后实施，软件完整验收通过。导出API6项及原案例/月/报告兼容52项、实际下载浏览器9项通过；完整后端284、Python工具63、Node178、data922、地图129及四档布局通过，Standards/Spec最终未解决项各0。[PR #317](https://github.com/NingRuo-code/Ocean/pull/317)，[交付记录](../../reports/ocean-synthetic-case-export-implementation-2026-10-29.md)。真实TASK保护/研究/生产另验。
