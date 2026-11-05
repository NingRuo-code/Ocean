# 按用途的完整月与事件窗口资格（#41）

复用原审计入口与[区域共同支持引擎](regional-support-audit.md)，不另建统计引擎、不计算锋面关系效果。

```powershell
node tools/audit-research-baseline.mjs --support-request conditions.json --regional-input cells.json --out support.json --report-out support.md
node tools/audit-research-baseline.mjs --support-request conditions.json --daily-snapshot daily.json --out support.json
node tools/audit-research-baseline.mjs --read-support-snapshot support.json
```

`regional-input` 与 `daily-snapshot` 互斥。输出不能覆盖输入或相互覆盖；JSON/Markdown各自原子写入。冻结读取只校验身份，不重新打开来源或重算。运行库依赖沿backend项目声明；入口是维护者显式本地批处理，不是访客提交“已核实”声明的接口。当前真实日快照缺已核实单元及部分时间/支持语义，仍明确不可计算。

## 条件与版本

```json
{"schema":"ocean-support-request/v1","purpose":"A_month","month":"2024-08","layer_use":"front_effort","method_version":"wgs84-laea-uniform/v1","quality_rule":"complete-common-support/v1","allocation":"overlap_uniform","geometries":[{"id":"ecs20","type":"circle","center":[124,30],"radius_km":20}]}
```

用途为A_month、B_event、description、map；必需层按layer_use的front_effort或front_effort_sst确定。source_ids、几何、allocation沿区域合同。拒绝额外字段、非法月/半径、方法/质量版本，不自动换月、移动中心或扩大范围。Gregorian完整月按真实天数列齐，含闰年；输入缺日仍保留，不能以目录日期数替代有效支持。

B_event还必须显式给event_date（属于所选month）及event_day_rule=`exclude_event_day/v1`。固定bbox/公里圆在全部日期保持同一几何，拒绝锋线缓冲作为固定事件区。范围扩展至事件所需相邻月份：pre7为[-7,-1]、post3为[1,3]、post7为[1,7]，事件日不在窗口。月表仍是月历审计，不能当事件资格；逐日periods和窗口dates明确归属。后3日不能代表后7日，A月支持不推出B窗口支持；event_data_gate_passed各自还需前7日与相应后窗口同时满足。

## 支持与质量

逐日保留各层资料状态、各层及共同支持的有效/未知/已知排除面积、同支持小时与分母；有效层即使另一必需层失败仍可单列支持。每月/窗口分别列纳入/排除日数及原因计数。已知land/missing不作海洋分母；稀疏无记录仍未知。均值沿固定支持身份规则；分母零/未知保留null。

冻结工程规则 `complete-common-support/v1`：必需层均为已核实完整日、共同有效面积时间为正、未知请求面积≤1平方米、allocation不伸出请求几何，才纳入。全部所需日期满足才为computational_support=supported；仅部分数值可用为limited；已知无有效支持为unsupported；支持/来源尚未核实为unverified。此规则是保守审计筛选，**不是默认批准科学覆盖阈值或半径精度**，其研究使用审批仍须单列证据。

support_level另叠加固定来源/处理版本、许可、具体几何的粒度资格及质量规则审批，不能仅由31日文件或可计算值变为支持。缺证据unverified，明确阻塞unsupported；有限支持只开放证据允许的local_description，map至多local_material_inspection，不承诺请求圆内覆盖或公开展示资格。许可阻塞不能借描述用途绕过。研究粒度不足不必阻止合法的本地描述，但不会放行研究。

## 证据声明边界

已审计单元输入可附qualification_evidence：schema为ocean-support-evidence/v1；source_versions为必需来源ID到sha256身份；processing_version为sha256身份；license含state及evidence_id；quality_rule另含精确id；geometry按请求几何id登记state、evidence_id和精确request_geometry。state只能verified/unverified/blocked，verified还须有sha256证据引用。所有身份和声明进入冻结结果；方法、实际引擎/读取器/判定器及输入字节身份另记录。

**这些是维护者提供的已核实声明，引用不会被本程序自动解引用或独立认证。** evidence_scope明确标为provided_verification_claims_not_independently_dereferenced。外部输入不能据此获取真实性、许可或科学签名。当前真实桥接不生成这些声明；没有证据绝不补为已核实。data_gate_passed仅表示非synthetic已审计输入在所供声明下满足P0条件；需要在#44等真实审计中核对证据，不能单独批准科学研究。synthetic即使所有声明齐全，也永不通过真实数据关口。formal_research_permitted、research_ready和public_release_approved均保持false，研究/公开批准另记。

自动验证从原CLI观察输出，覆盖完整月、缺日、内部缺口、可选SST、有限描述、只可读展示、非法条件、跨月窗口、闰月、不同分母、来源未知及冻结篡改；合成小例不证明真实八月支持。真实候选仍为东海2024-08，实际复跑与残余条件见[实施报告](../reports/ocean-support-qualification-implementation-2026-11-05.md)。
