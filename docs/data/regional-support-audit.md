# 区域共同支持审计（#39）

复用 `node tools/audit-research-baseline.mjs`，显式消费已核实的逐日区域单元；它是支持与算术审计，不产出正式A/B/C关系结论。安装 `backend/pyproject.toml` 中的依赖后运行，无网络服务或GFW令牌要求。

```powershell
node tools/audit-research-baseline.mjs --regional-request request.json --regional-input cells.json --out regional.json --report-out regional.md
node tools/audit-research-baseline.mjs --regional-request request.json --daily-snapshot daily.json --out regional.json
node tools/audit-research-baseline.mjs --read-regional-snapshot regional.json
```

两种输入互斥。`--daily-snapshot` 校验既有来源审计身份，沿原来源ID/角色/日期传播缺失和未核实，不重新打开原档、推断覆盖或生成格边。当前日级快照仅有聚合诊断及私有支持引用，尚未提供已核实单元，故此桥接始终返回 `verified_cells_unprepared` 等原因，而不会凭总小时生成圈内统计。真实源还需要时间、格边、支持语义核实及已核实单元准备。`--regional-input` 用于有界的明确单元输入，`audited_cells` 仅表示提供者声明经过审计；不是本程序独立核验许可、来源真实性或科学资格的证明。所有输出恒保留 `research_ready=false`、`public_release_approved=false`。

请求示例（无默认移动中心/扩大范围）：

```json
{"schema":"ocean-regional-request/v1","purpose":"front_effort","start":"2024-08-05","end":"2024-08-05","method_version":"wgs84-laea-uniform/v1","allocation":"overlap_uniform","geometries":[{"id":"ecs20","type":"circle","center":[124,30],"radius_km":20}]}
```

用途 `front_effort` 必需front/activity；`front_effort_sst` 另需sst。默认ID为front-original/effort-original/sst-original；可用 `source_ids` 显式绑定，ID不符返回未知。输出保留原条件、方法及运行库版本、输入/读取器/计算器SHA256与快照身份。冻结读取只验身份，不重新计算，原输入移除后仍可读；身份是完整性校验，不是签名。JSON/Markdown单文件原子替换；计算失败不写输出，不承诺两个输出跨文件事务。

单元输入为 `ocean-regional-cells/v1`：`evidence_kind` 为synthetic或audited_cells，`days` 数组每项含date/layers。每层含id、kind、role=analysis_source、unit、time_verified/bounds_verified/support_verified三项布尔声明、duration_days、cells；front/activity/sst单位分别classification_code/fishing_hours/degree_C。三项必须真，时长须同一天一致且在(0,1]。每格 `bounds=[west,south,east,north]` 是WGS84明确格边，`support` 为valid/land/missing/unknown，活动有效格必须有有限非负hours，front侧别cold/warm/unknown。未列区域未知，不能当海洋零值；同层重叠超过1平方米拒绝，非同层求共同支持。

几何分别支持bbox、10/20/30km测地圆、同半径锋线缓冲。圆以WGS84测地正算、0.5°方位采样；各格恒纬边0.002°加密，投影到请求中心的WGS84局部Lambert等积平面求面积/相交。纬度限±80°、不跨日期变更线、矩形跨度≤12°，所有单元须在投影中心经纬各±6°内；锋线跨度≤2°。锋线缓冲是局部投影距离近似，重叠先并集；不宣称长线全球测地精确。超范围明确拒绝。绝对面积容差1e-6km²，格心边界距离容差0.001m，格心法包含边界。

默认建议 `overlap_uniform`，仅假设每个已核实格内小时均匀分布，不能据此知道船在格内位置。显式 `cell_center` 会纳入中心在请求内的完整活动格，再与其他层相交，可能伸出原请求，输出伸出面积。每个日期同时列两法小时作为边界敏感性；请求的allocation和方法进入身份，不偷偷更换。嵌套半径逐个报告，不相加。

分子分母来自同一共同支持；已知land/missing排除，未知面积另列，不算完整有效海洋分母。正有效面积上的0小时保留0，零分母的小时/密度保留null。总小时、支持日均、请求日均、Σ面积×天及小时/面积时间分别输出；缺日时完整期总量/分母为null，仅另列明确的已支持子集。`baseline_hours` 仅是调用者提供的同期间总小时算术比较；零基线保留绝对差、相对差null，不加伪计数。未知侧别小时单列。

自动检查经原CLI运行：`python -m pytest tools/tests/test_regional_support_cli.py`。参考值独立于实现：WGS84椭球恒纬格闭式面积积分给出0.01°格在0°/30°/60°纬度面积1.2309072018475635/1.0695211732694125/0.6215872434455071km²；面积相对容差2e-6。半格40h应20h；10/20/30km圆与πr²的小范围近似比较容差2e-4；含海岸、未知、可选层、重复缓冲、零分母、零基线与快照篡改检查。这些是数值/合同检查，不能证明真实数据精度、覆盖或研究资格。
