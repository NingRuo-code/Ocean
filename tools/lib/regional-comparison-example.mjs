import { runControlledExample } from "./fixed-region-example.mjs";

const text = value => String(value ?? "未知").replace(/[\\|`*_<>\[\]#]/g, "\\$&").replace(/[\r\n]/g, " ");
function report(result) {
  const p = result.parameters;
  const lines = ["# 区域证据并列 / 自建合成快照", "",
    "仅消费已存在、明确允许公开聚合的样例；不是真实渔业研究、排名或推荐。", "",
    `比较身份：${result.result_id}`, `用途：${p.analysis_kind}；半径 ${p.radius_km} km；政策：${p.support_policy}。`,
    p.month ? `月份：${p.month}。` : `锚日搜索期：${p.search_start} — ${p.search_end}。`, "",
    "每项保留原支持，统一月份/半径不代表有效日期、面积或事件样本已对齐；不自动相减。", ""];
  if (p.month) {
    lines.push("| 候选 | 固定点 | 小时 H (fishing_hours) | 面积时间 E (km2*d) | 支持日/日历日 | H/E (fishing_hours/(km2*d)) | 状态 |",
      "|---|---|---:|---:|---:|---:|---|");
    for (const row of result.rows) {
      const c = row.candidate, m = row.metrics;
      lines.push(`| ${text(c.name)} (${c.id}) | ${c.longitude}, ${c.latitude} | ${m?.total_hours ?? "未知"} | ${m?.area_time_km2_days ?? "未知"} | ${m ? m.supported_days + "/" + m.calendar_days : "未知"} | ${m?.density_hours_per_km2_day ?? "未知"} | ${text(row.source_status || row.reason)} |`);
    }
  } else {
    lines.push("| 候选 | 锚日 | 窗口/实际日期 | H (fishing_hours) | E (km2*d) | 支持日/窗口日 | H/E (fishing_hours/(km2*d)) | 状态 |",
      "|---|---|---|---:|---:|---:|---:|---|");
    for (const row of result.rows) {
      for (const [name, w] of Object.entries(row.windows || {})) {
        lines.push(`| ${text(row.candidate.name)} (${row.candidate.id}) | ${text(row.event?.anchor_date)} | ${name}: ${w.start_date} — ${w.end_date} | ${w.total_hours ?? "未知"} | ${w.area_time_km2_days ?? "未知"} | ${w.supported_days}/${w.calendar_days} | ${w.density_hours_per_km2_day ?? "未知"} | ${w.status} |`);
      }
      if (!Object.keys(row.windows || {}).length) lines.push(`| ${text(row.candidate.name)} | 未知 | 无单一事件窗口 | 未知 | 未知 | 未知 | 未知 | ${text(row.source_status || row.reason)} |`);
    }
  }
  lines.push("", "## 原条件与逐源证据", "");
  for (const row of result.rows) {
    const c = row.candidate;
    lines.push(`- ${text(c.name)} (${c.id})：${row.status} / ${row.reason}。`,
      `  位置 ${c.longitude}, ${c.latitude}；共同半径 ${p.radius_km} km；请求源结果 ${c.result_id}。`);
    if (row.source) {
      lines.push(`  来源 ${text(row.source.id)} / ${text(row.source.version)}；${row.source.input_sha256}；${text(row.source.license)}。`,
        `  实际方法 ${text(row.original_parameters.method_version)} / ${text(row.original_parameters.parameter_version)}；${text(row.support_scope)}。`);
      for (const note of row.source_caveats) lines.push(`  原成果限制：${text(note)}`);
    } else lines.push(`  所需前置：${text(row.required)}；未读取受限值或替换结果。`);
  }
  lines.push("", "0为源结果明确有效零；未知与缺少结果不填0。读取不会触发A/B分析、下载、归档或模型。", "",
    "完整逐指标/区域对兼容、共同支持差值、正式A/B交接、图表及真实比较在后续C任务验收。", "");
  return lines.join("\n");
}

export function runRegionalComparison(args, root) {
  return runControlledExample(args, root, {
    requestFlag: "--regional-comparison-request", readFlag: "--read-regional-comparison-result",
    purpose: "regional_comparison_example", outputName: "regional-comparison-example",
    inputName: "regional-known-snapshots.json", module: "app.regional_comparison",
    errorCode: "controlled_comparison_failed", report,
  });
}
