# 04: 实现本地 apparent fishing effort 样例转换到 Front Response Table

**What to build:** 给本地/手工取得的 2024-07-01 至 2024-08-31 apparent fishing effort 样例提供转换路径，产出 front-response 表。没有真实样例时使用小型夹具验证流程；有真实样例时同一流程可生成真实 P1 表。

**Blocked by:** None (01, 02, and 03 are done).

**Status:** done

- [x] 输入可以来自本地样例文件或小型夹具，不要求把 raw/fine-grained 数据提交到 Git。
- [x] 输出符合 Front Response Table 契约，并能被 `OFData` 读取。
- [x] 输出保留 10/20/30 km 三个半径的响应记录，产品默认仍使用当前 operation range。
- [x] 转换流程记录数据来源、时间窗、空间窗口、处理口径和公开边界。
- [x] 更新项目执行记录，补充“从 apparent fishing effort 到产品证据”的链路说明。

**Implementation note:** `tools/build-front-response.mjs` converts `data/front_response/fixture-effort-sample.json` or a caller-provided `--input` file into `data/front_response/events.js`. The committed fixture is aggregated and synthetic; it is not raw/fine-grained AIS/GFW data.
