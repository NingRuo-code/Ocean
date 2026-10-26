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

export function runStratifiedValidation(args,root) {
 return runControlledExample(args,root,{
  requestFlag:"--g3-validation-request",readFlag:"--read-g3-validation-result",
  purpose:"stratified_validation_example",outputName:"g3-known-validation",
  inputName:"g3-known-snapshots.json",module:"app.stratified_validation",
  errorCode:"controlled_validation_failed",report,
 });
}
