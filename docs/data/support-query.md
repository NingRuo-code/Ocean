# 现有查询读取支持审计（#42）

维护者配置 `OCEAN_SUPPORT_SNAPSHOT_PATH` 指向原审计CLI生成的冻结 `ocean-support-qualification/v1` JSON；默认不配置。已有 `GET /api/query/monthly-analysis/capability` 增加 `audited_support`，不改变旧草稿的提交能力或文件级可用性。

原参数仍为month、longitude、latitude和10/20/30公里radius_km；新增可选purpose（默认A_month）、layer_use（默认front_effort）。B_event必须给同月YYYY-MM-DD格式event_date，按原审计的exclude_event_day/v1规则匹配。用途、月、必需层、事件日、中心与半径必须精确对应，不自动扩大范围。当前入口读取已有圆形资格；其他几何仍由原CLI显式审计。

每次只读取至多16MiB的已配置文件，校验内容身份；不导入审计引擎、不打开原档、不扫描、下载或触发计算。返回原请求/实际条件、逐日各层及共同支持、月和独立事件窗口的纳入/排除日数、原因、前置、输入/程序/方法/参数身份。失败状态包括not_prepared、not_audited、permission_denied和invalid_snapshot，不回退为先前成功资格。

输出采用字段白名单。维护者尚未单独批准公开的快照，其小时/面积/密度全部为null，数值可见性为withheld_public_boundary；不将未知写成零。任意备注、路径、细格不会输出。显式public_release_approved声明是部署者的公开边界责任，程序不会独立认证许可；真实审计器默认false。批准公开也不会变成研究批准。

可选 `OCEAN_SUPPORT_STATE_PATH` 读取维护者提供的至多4KiB状态文件（`{"schema":"ocean-support-state/v1","state":"scanning"}`，状态也可为expired或unknown）。扫描和过期只返回相应状态，不返回旧资格。无可靠当前身份的audited_snapshot表示读取了可校验的历史审计，freshness为unknown；#43补齐自动核对和显式重跑交接。research_ready始终false。旧顶层qualification/execution/versions合同保留，旧页面仍不能提交研究任务。线上权限及生产部署未由本地TestClient证明。
