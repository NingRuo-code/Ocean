# 现有查询读取支持审计（#42）

维护者配置 `OCEAN_SUPPORT_SNAPSHOT_PATH` 指向原审计CLI生成的冻结 `ocean-support-qualification/v1` JSON；默认不配置。已有 `GET /api/query/monthly-analysis/capability` 增加 `audited_support`，不改变旧草稿的提交能力或文件级可用性。

原参数仍为month、longitude、latitude和10/20/30公里radius_km；新增可选purpose（默认A_month）、layer_use（默认front_effort）。B_event必须给同月YYYY-MM-DD格式event_date，按原审计的exclude_event_day/v1规则匹配。用途、月、必需层、事件日、中心与半径必须精确对应，不自动扩大范围。当前入口读取已有圆形资格；其他几何仍由原CLI显式审计。

每次只读取至多16MiB的已配置文件，校验内容身份；不导入审计引擎、不打开原档、不扫描、下载或触发计算。返回原请求/实际条件、逐日各层及共同支持、月和独立事件窗口的纳入/排除日数、原因、前置、输入/程序/方法/参数身份。失败状态包括not_prepared、not_audited、permission_denied和invalid_snapshot，不回退为先前成功资格。

输出采用字段白名单。公开入口只允许明确批准的自有合成快照展示数值；真实数据的小时/面积/密度保持null，直到另有符合治理要求的真实数据公开流程。可用子集的统计与全期值分开，局部描述/资料检查保持本地用途。任意备注、路径、细格不会输出；证据仅投影适用的引用摘要与状态，原始证据不公开。B事件月表仅表示月历检查，分别读取事件各窗口和冻结的两种配对关口。审计范围与声明不构成许可或研究批准。

可选 `OCEAN_SUPPORT_STATE_PATH` 指向[显式刷新](support-refresh.md)生成的至多4KiB私有状态文件。扫描、失败、过期或输入不可访问只返回相应状态，不返回旧资格。`registered_receipt_match`表示冻结产物与发布回执匹配；普通查询未重新核对内容，来源新鲜度仍unknown，资格只属于所读快照。单独配置快照仍可阅读历史。research_ready始终false。旧顶层qualification/execution/versions合同保留，旧页面仍不能提交研究任务。线上权限及生产部署未由本地TestClient证明。
