# Ocean GFW 响应分析 Issue 拆分清单

## Milestone 1：样例数据闭环

### Issue 1：获取 2024-07-01 至 2024-08-31 GFW 样例数据

目标：拿到东海窗口内每日 0.01 度 apparent fishing effort 样例。

验收：

- 覆盖当前原型日期窗口。
- 记录数据来源、许可、字段和处理过程。
- 明确不提交或公开发布未经处理的底层数据文件。

### Issue 2：定义 GFW 原始数据到本地中间格式

目标：把 GFW 样例整理为可重复处理的本地中间表。

验收：

- 字段至少包含日期、经纬网格、fishing hours。
- 第一版不区分船旗国和渔具类型。
- 保留原始 0.01 度粒度用于分析计算。

### Issue 3：生成 0.05 度 Fishing Effort Grid Artifact

目标：把 0.01 度 fishing hours 聚合到锋面数据网格，供地图显示。

验收：

- 每日生成一个前端可读文件。
- 网格范围与现有东海窗口一致。
- 数据说明中标注为 apparent fishing effort。

### Issue 4：生成 Front Response Table

目标：预计算锋面事件缓冲区响应表。

验收：

- 支持 10/20/30 km 三个缓冲半径。
- 计算 `pre7_hours`、`post1_3_hours`、`lift_percent`、`non_front_control_hours`、`enhanced_flag`。
- 同时记录 `front_event_id`、`date`、`front_id`、`similar_event_group`、`season_window`。

### Issue 5：实现非锋面对照区域采样

目标：为每个锋面事件生成同日同海区的非锋面对照区域。

验收：

- 对照区域离锋面至少 50 km。
- 对照区域面积与锋面缓冲区可比。
- 响应增强判定同时使用前 7 天基线和非锋面对照。

## Milestone 2：产品界面接入

### Issue 6：当前页新增“历史 AIS 响应”证据块

目标：在产品主任务中解释类似锋面情形是否曾出现表观捕捞活动响应。

验收：

- 显示“响应增强/无明显增强”。
- 可展开查看 fishing hours、提升率和对照区数值。
- 不出现“产量预测”或“收益预测”措辞。

### Issue 7：历史页新增“相似锋面事件响应”模块

目标：展示同海区、前后 15 天季节窗口内的相似锋面事件及响应结果。

验收：

- 支持按相似事件查看响应窗口。
- 显示前 7 天至后 7 天 fishing hours 曲线。
- 标注 GFW 数据的 apparent fishing effort 边界。

### Issue 8：数据说明页补充 GFW 来源与限制

目标：把 GFW 数据来源、授权边界和 apparent fishing effort caveat 写清楚。

验收：

- 说明数据是表观捕捞活动，不等于渔获量。
- 说明 AIS 覆盖和接收条件可能影响时空趋势。
- 说明本阶段仅用于本地/课堂演示与聚合图展示。

## Milestone 3：研究图与评价

### Issue 9：生成锋面事件响应窗口图

目标：对典型锋面事件展示前后窗口 fishing hours 变化。

验收：

- 图中区分前 7 天、后 1-3 天和后 7 天。
- 展示锋面缓冲区与非锋面对照区。

### Issue 10：生成多半径敏感性统计图

目标：比较 10/20/30 km 半径下响应结果的一致性。

验收：

- 展示不同半径下的提升率和增强标记。
- 标出默认产品半径 20 km。

### Issue 11：生成对照组统计图

目标：比较锋面缓冲区与非锋面对照区的 apparent fishing effort 差异。

验收：

- 支持样例窗口统计。
- 支持后续扩展到 2015-2024 每年 8 月。

## Milestone 4：需求文档同步

### Issue 12：更新需求规格 v0.11

目标：把 GFW apparent fishing effort 路线写入需求文档，但保持“计划接入/样例闭环”状态。

验收：

- 不把 AIS 写成已经接入。
- 明确第一阶段只做样例闭环。
- 明确界面不使用产量预测措辞。

### Issue 13：实现后更新数据契约与交接文档

目标：等数据文件真正落地后，再更新 `docs/data-schema.md` 和 `docs/handover.md`。

验收：

- 记录新增数据文件结构。
- 更新验收命令和演示脚本。
- 保留 GFW 数据公开边界说明。

## Milestone 5：实验课反馈补充任务

### Issue 14：建立每日数据更新与自动抓取机制

目标：把“数据每天更新，可以自动抓取”的需求拆成可控的数据更新流程，而不是让前端直接依赖远端文件。

验收：

- 建立数据源登记表，记录锋面、SST、GFW/AIS 或合作方样例的来源、许可、更新时间、覆盖范围和失败处理方式。
- 支持按日期增量检查和下载，重复运行不会覆盖已校验产物。
- 输出数据新鲜度状态，例如 `latest_available_date`、`last_checked_at`、`missing_dates` 和 `source_status`。
- raw/API 原始响应、0.01 度工作表和授权聚合输入仍只进入本地或服务器受控目录，不进入 Git。
- 前端只能读取经过校验和发布的静态 artifact 或 API 响应，不能直接读取 raw 数据目录。

### Issue 15：实现左侧可呼出的完整图层控制栏

目标：把地图图层管理从当前紧凑图例扩展为左侧隐藏式图层面板，平时收起，需要时呼出。

验收：

- 面板至少管理海温、锋面带、锋面线、冷暖侧、缺测、渔场示例、后续 fishing effort、后续强度/梯度图层。
- 面板默认收起，不遮挡主地图和右侧分析面板。
- 每个图层显示数据状态：`real`、`synthetic_fixture`、`not_available`、`pending_authorization`。
- 不可用图层不能伪造数值；应显示缺口原因和后续接入条件。
- `e2e-check` 和 `layout-check` 增加图层面板开关、窄屏不裁切和图层状态文案检查。

### Issue 16：改造为模块内 AI 分析入口

目标：满足“当前、历史、预测各自带 AI 分析，但暂时不做对话形式”的需求。

验收：

- 当前页、历史页、预测页分别提供一个非对话式 AI 解释区域。
- 每个 AI 区域只组织该模块已有的确定性证据，不生成 fishing hours、概率、强度或预测数值。
- 当前页 AI 解释当前锋面、SST、作业范围和历史 AIS 响应。
- 历史页 AI 解释历史同期频率、相似锋面事件和历史 AIS 响应。
- 预测页 AI 解释规则预测参考、真实预报缺口和不确定性边界。
- 保留统一 AI 分析页作为全局复核视图，但不得替代模块内解释入口。

### Issue 17：验证锋面强度或梯度图层可用性

目标：回应“锋面持续时间短，不一定和鱼形成关联，还是要把锋面强度设计出来”的需求，先验证数据可得性，再决定实现路线。

验收：

- 调查现有锋面数据集是否具备可接入的 front intensity 字段或分年强度包。
- 若强度数据可得，定义 `front_intensity` artifact 的字段、单位、色标、缺测规则和生成流程。
- 若强度数据暂不可得，定义 SST 梯度的替代图层口径，并明确它只是梯度参考，不等同于官方锋面强度。
- 数据说明页必须写清强度/梯度来源、单位、可用日期和局限。
- 强度或梯度图层不直接参与 Product Score，除非后续回测证明其解释价值。

## Milestone 6：服务器接入与数据管线

### Issue 18：定义服务器接入边界与数据源登记表

目标：在接入服务器前先明确服务器角色、数据权限、目录边界和 artifact 发布方式。

验收：

- 新增服务器数据源登记表，至少包含 source id、source type、license、credential mode、update cadence、retention policy 和 public display boundary。
- 明确服务器不公开 raw AIS/GFW、MMSI、船名、轨迹或可逆推出源数据的中间表。
- 明确前端读取的是发布后的 artifact manifest 或受控 API，不直接访问服务器 raw 目录。
- 与 `docs/gfw-ais-real-sample-intake.md` 的本地目录和 go/no-go 保持一致。
- source registry 示例纳入 `tools/data-check.mjs`，字段、凭据模式和 GFW/AIS apparent fishing effort 边界可自动校验。

### Issue 19：实现服务器端数据拉取任务

目标：让服务器负责定时或手动拉取锋面、SST、GFW/AIS 授权样例等数据，并记录运行状态。

验收：

- 支持手动触发指定日期范围的数据拉取。
- 支持定时检查最新日期，但默认不自动发布未校验数据。
- 每次运行生成 job record，记录 started_at、finished_at、source、date_range、status、error 和 output artifact。
- 网络失败、授权失败、数据缺失时输出明确状态，不生成伪数据。
- 第一版提供 `tools/server-pull-job.mjs` dry-run/manual 入口与 pull job record 示例；真实下载 connector 未实现前，execute 模式必须显式 skipped，不能伪造 raw 或 public artifact。

### Issue 20：实现服务器端处理工作区与 artifact 发布

目标：把服务器上的 raw、intermediate、authorized aggregate 和 public artifact 分层管理。

验收：

- 服务器目录至少分为 `raw/`、`intermediate/`、`authorized_aggregate/`、`public_artifacts/` 和 `logs/`。
- 只有 `public_artifacts/` 中通过校验的产物可以被前端读取或导出到仓库。
- Front Response Table 必须继续通过确定性脚本生成，不能由 AI 生成。
- 发布前运行数据契约检查；失败产物不能覆盖上一个可用版本。
- 第一版提供 `tools/server-process-artifact.mjs` dry-run/process/publish 入口；`front_response` 必须复用 `tools/build-front-response.mjs`，显式 publish 前先写 staging、校验输出并运行 `data-check`。

### Issue 21：设计前端读取服务器 artifact 的接口

目标：在保留离线静态原型能力的同时，允许前端读取服务器发布的最新 artifact。

验收：

- 提供 artifact manifest，列出可用日期、图层状态、版本、生成时间、source 和 caveat。
- 前端启动时优先读取本地静态 artifact；若配置了服务器地址，再读取服务器 manifest。
- 服务器不可用时前端降级到本地静态数据，并提示数据新鲜度。
- 不把服务器读取失败解释为数据为 0 或无响应。
- manifest 示例纳入 `tools/data-check.mjs`，确保公开 artifact 不指向 raw/intermediate/轨迹类路径。

当前落地（2026-09-23）：

- 已在前端增加可选 `?serverManifest=URL` / `?manifest=URL` manifest 状态读取入口。
- 已在 `OFData` 暴露 `serverManifestState()`、`serverManifest()` 和 `serverLayerStatus(layer)`。
- 已在页脚和数据说明页展示服务器 manifest 新鲜度、回退状态和不可用边界。
- 已纳入 `data-check` 与 `e2e-check`，覆盖离线默认、服务器不可用回退和服务器 manifest 可用状态。

### Issue 22：建立服务器凭据与权限管理

目标：避免 GFW/API token、合作方数据凭据或内部服务器地址进入仓库。

验收：

- 凭据只保存在服务器环境变量或本地 `.env`，不得提交到 Git。
- 数据拉取任务按 source id 读取凭据，不在日志中打印 token。
- 不同数据源区分 public、restricted、partner 三类访问级别。
- 任何 restricted 或 partner 数据在公开展示前必须经过 go/no-go 审核。

当前落地（2026-09-23）：

- 已在 source registry 中增加 `access_level`、`credential_env_var`、`authorization_scope` 和 `publish_requires_go_no_go`。
- 已提供 `.env.example` 作为本地/服务器凭据变量名模板，真实 `.env` 继续由 `.gitignore` 排除。
- 已让 pull job 按 `source_id` 找到对应 `credential_env_var`，job record 只记录是否配置，不记录 token 值。
- 已新增 restricted pull job record 示例，验证 restricted 数据未配置凭据时不会下载；即使后续可下载，公开发布前仍必须 go/no-go。

### Issue 23：增加服务器运行观测与人工复核入口

目标：让开发者能判断服务器数据是否新鲜、失败在哪里、是否可以发布。

验收：

- 提供最近任务列表、失败原因、缺失日期和 artifact 版本摘要。
- 支持人工标记某批 authorized aggregate 为可发布或不可发布。
- 支持回滚到上一版 public artifact。
- 文档记录服务器接入、运行、复核和回滚步骤。
