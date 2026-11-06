# 月分析执行资格

仍使用 `POST /api/query/monthly-analysis`。本人提交时指定点、公里半径、月份、输入/方法/参数版本、`layer_use` 和 `support_snapshot_id`。入口直接读取同一 P0 资格快照，可沿用受控刷新回执；无需调用查询 API，也不启动审计。旧的独立合成参照仍可按原合同运行。

- `layer_use: front_effort` 要求活动与锋面；`front_effort_sst` 另要求 SST。不得换点、换月、扩圆或把环境用途降成主分析。距离参照的 P0 绑定目前要求其单圆条件和完整 P0 请求一致。
- 月历每一天必须纳入共同支持。拒绝返回 HTTP 409：`detail.reason`、`can_execute: false` 以及 P0 投影 `support`。投影保留材料状态、缺项、可做的有限描述、实际条件和版本；真实 H/E 仍遵守原可见性规则。拒绝不建立运行记录、不读取详细计算包。
- 本人以 `purpose: monthly_distance_reference` 提交合法完整合成例时，读取有界注册包，核对同一 P0 空间数据、条件、程序与几何运行库版本后才计算。P0 空间数据的独立 JSON 应与包内 `regional_cells` 的紧凑 UTF-8 表示逐字节一致。实际字节或运行库不匹配时保存失败状态，不发布成果；成功结果保留参与身份计算的 `qualification`，研究资格仍为假。
- `purpose: monthly_spatial_research` 的距离直接参照要求 P0 数据关口通过，以及独立复核后由维护者显式设置 `OCEAN_MONTHLY_RESEARCH_INPUT_PATH` 和 `OCEAN_MONTHLY_RESEARCH_APPROVAL`。批准为单一 JSON 对象，必须给出批准证据的 `approval_id`、`support_snapshot_id`、`input_version`、`distance_engine_sha256`、`method_version`、`parameter_version`。默认没有批准。快照、登记包和执行程序必须与批准逐项匹配；冻结 P0 声明及匹配回执本身不能证明当前原档或独立研究许可。计算只针对这份冻结输入；来源更新后需重新审计和登记，不把历史批准解释成实时原档验证。
- 正式入口的 `analysis_scope: side` 目前明确拒绝并返回缺侧别证据，由 #63 承接。距离批准不包含侧别输出。批准后的距离直接参照仍只限本人读写，`research_ready: false`，不表示主方案冻结或真实整月已复算；分别由 #67/#68 验收。

只读查询、结果读取和公开投影遵循原边界。执行不下载、不准备数据、不注册生产发布。
