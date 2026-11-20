import {runControlledExample} from "./fixed-region-example.mjs";

const text=value=>String(value??"未知").replace(/[\\|`*_<>\[\]#]/g,"\\$&").replace(/[\r\n]/g," ");
function report(result) {
 const p=result.parameters;
 const lines=["# G3 分层复核 / 自建合成小例","",
  "仅为软件通路：非真实研究、非确认性，独立性未评估。无显著性、稳定性或渔获保证。","",
  `结果身份：${result.result_id}`,`类型：${p.analysis_kind}；区域 ${text(p.region.name)} (${p.region.id})，固定点 ${p.region.longitude}, ${p.region.latitude}；${p.radius_km} km。`,
  `协议引用 ${p.protocol_ref}；分区引用 ${p.partition_ref}；季节归属 ${p.season_year_rule}，12月不自动移到下一年。`,
  `季节月份：${text(JSON.stringify(p.seasons))}。原方法/源版本随逐源证据保留；已登记源/支持引用 ${p.source_ref}。`,"",
  "## 候选全集","","| 候选 | 月份 | 季节 | H (fishing_hours) | E (km2*d) | 有效/日历日 | 状态及原因 |","|---|---|---|---:|---:|---|---|"];
 for(const row of result.rows){const c=row.candidate,m=row.metrics;lines.push(`| ${c.id} | ${c.month} | ${c.season} | ${m?.total_hours??"未知"} | ${m?.area_time_km2_days??"未知"} | ${m?m.supported_days+"/"+m.calendar_days:"未知"} | ${row.status} / ${row.reason} |`);}
 lines.push("","## 年份 × 季节：同支持描述密度","","| 年份 | 季节 | H | E | H/E (fishing_hours/(km2*d)) | 有效日/载入日历/计划日历 | 状态 |","|---|---|---:|---:|---:|---|---|");
 for(const s of result.strata){const m=s.metrics;lines.push(`| ${s.year} | ${s.season} | ${m.total_hours??"未知"} | ${m.area_time_km2_days??"未知"} | ${m.density_hours_per_km2_day??"未知"} | ${m.supported_days}/${m.calendar_days}/${s.planned_calendar_days} | ${s.status} |`);}
 lines.push("","仅把不重叠月份的已知小时与同支持面积时间相加后相除；不是月密度均值、效应均值或实际研究通过。未知不补零；有效日数不是独立样本数。","","## 原结果与逐日证据","未纳入候选保留原因；未授权源不显示数值和来源详情。","");
 for(const row of result.rows){
  lines.push(`### ${row.candidate.id}`,`请求源ID ${row.candidate.result_id}；导入内容 ${row.candidate.snapshot_sha256}。`);
  if(!row.source){lines.push(`未纳入：${row.reason}。`,"");continue;}
  lines.push(`原结果 ${row.source_result_id}；公开投影 ${row.source_projection_id}。`,
   `来源 ${text(row.source.id)} / ${text(row.source.version)} / ${row.source.input_sha256}；许可 ${text(row.source.license)}。`,
   `原条件/方法 ${text(JSON.stringify(row.original_parameters))}。`,
   `逐日H/E：${text(JSON.stringify(row.daily))}。`,...row.source_caveats.map(note=>"- "+text(note)),"");
 }
 lines.push("## 限制",...result.caveats.map(note=>"- "+text(note)),"");
 return lines.join("\n");
}

function coverageReport(result) {
 const lines=["# G3 候选联合覆盖核查", "", `冻结结果 ${result.result_id}。`,
  "A 整月与 B 事件窗口分别核对。年份按各月的日历年归属。B 识别上下文未核；报告只显示覆盖元信息及许可依据。", "",
  "| 候选 | 年月 | 季节 | 海域/半径 | A 全月 | B 窗口 |", "|---|---|---|---|---|---|"];
 for (const {candidate, monthly, event} of result.rows) {
  const a = monthly.calendar;
  const b = event.windows;
  lines.push(`| ${candidate.id} | ${candidate.month} | ${candidate.season} | ${candidate.region_id} / ${candidate.radius_km} km | ${a ? a.included_days+"/"+a.expected_days : monthly.reason} | ${b ? Object.entries(b).map(([name, p]) => name+" "+p.included_days+"/"+p.expected_days).join("，") : event.reason} |`);
 }
 lines.push("", "## 年份 × 季节 × 海域", "", "| 年份 | 季节 | 海域 | 候选 | 状态 |", "|---|---|---|---|---|");
 for (const {year, season, region_id, candidate_ids, status} of result.strata) {
  lines.push(`| ${year} | ${season} | ${region_id} | ${candidate_ids.join("、") || "—"} | ${status} |`);
 }
 lines.push("", "## 逐候选依据", "");
 for (const {candidate, monthly, event} of result.rows) {
  lines.push(`- ${candidate.id}。A ${monthly.snapshot_id ?? monthly.reason}，B ${event.snapshot_id ?? event.reason}。`);
  for (const [purpose, audit] of [["A", monthly], ["B", event]]) {
   if (!audit.evidence) continue;
   const periods = audit.windows ?? {month: audit.calendar};
   lines.push(`  - ${purpose} 证据类型 ${audit.evidence_kind}，必需层 ${audit.required_layers.join("、")}，许可 ${audit.evidence.license?.state ?? "未核"}，粒度 ${audit.evidence.granularity?.state ?? "未核"}。`);
   for (const [name, period] of Object.entries(periods)) {
    lines.push(`  - ${name} ${period.computational_support}，缺项 ${period.missing_prerequisites.join("、") || "无已记录缺项"}，排除 ${text(JSON.stringify(period.exclusion_reason_counts))}。`);
   }
   const gaps = audit.window_days?.filter(day => !day.included) ?? [];
   if (gaps.length) lines.push(`  - B 未纳入日期：${gaps.map(day => day.date + "（" + day.state + "；" + day.exclusion_reasons.join("、") + "）").join("，")}。`);
  }
 }
 lines.push("", "## 使用限制", "", ...result.caveats.map(note=>"- "+note), "");
 return lines.join("\n");
}

const coverageRequest = "--g3-candidate-support-request";
const coverageRead = "--read-g3-candidate-support-result";

export function runStratifiedValidation(args,root) {
 if (args.includes(coverageRequest) || args.includes(coverageRead)) {
  return runControlledExample(args,root,{
   requestFlag:coverageRequest,readFlag:coverageRead,purpose:"g3_candidate_support",
   evidenceKind:"coverage_metadata",outputName:"g3-candidate-support",
   module:"app.stratified_validation",errorCode:"controlled_validation_failed",report:coverageReport,
  });
 }
 return runControlledExample(args,root,{
  requestFlag:"--g3-validation-request",readFlag:"--read-g3-validation-result",
  purpose:"stratified_validation_example",outputName:"g3-known-validation",
  inputName:"g3-known-snapshots.json",module:"app.stratified_validation",
  errorCode:"controlled_validation_failed",report,
 });
}
