import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

const hash = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const ARTIFACT_BYTES = 1_048_576;
function options(args, profile) {
  const allowed = new Set([profile.requestFlag, profile.readFlag, "--input", "--output"]);
  const result = {};
  for (let i=0;i<args.length;i+=2) {
    if (!allowed.has(args[i]) || !args[i+1] || args[i+1].startsWith("--") || result[args[i]]) throw Error("invalid_options");
    result[args[i]] = resolve(args[i+1]);
  }
  if (!!result[profile.requestFlag] === !!result[profile.readFlag]) throw Error("invalid_mode");
  if (result[profile.readFlag] && Object.keys(result).length !== 1) throw Error("read_is_not_execution");
  return result;
}
function boundedText(path, bytes=ARTIFACT_BYTES) {
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw Error("invalid_artifact");
  const fd=openSync(path,"r");
  try {
    const buffer=Buffer.alloc(bytes+1);let n=0,count;
    while(n<buffer.length && (count=readSync(fd,buffer,n,buffer.length-n,null))>0)n+=count;
    if (n>bytes) throw Error("input_budget");
    const bytesRead=buffer.subarray(0,n),text=bytesRead.toString("utf8");
    if(!Buffer.from(text,"utf8").equals(bytesRead))throw Error("invalid_utf8");
    return text;
  } finally { closeSync(fd); }
}
function report(result) {
  if (result.schema_version === "fixed-region-event-reading-pack/v1") {
    const {heading,summary}=readingContext(result);
    const lines=[heading,"",summary,"", "![锚日前后活动密度差](lag.svg)","",
      `短窗 ${result.cohorts.post3.event_count} 个事件，后 7 日 ${result.cohorts.post7.event_count} 个事件，共同队列 ${result.cohorts.common.event_count} 个事件。`,
      "逐日 H/E 和同日对照值见 [逐日表](daily.csv)；完整窗口和同日变化差见 [窗口表](windows.csv)。锚日用于诊断。", "",
      "## 事件、对照与窗口", ""];
    for(const event of result.events) {
      const meanings={no_fixed_control:"缺少合格对照",no_complete_post7:"后 7 日证据不足",equal_change:"目标与对照变化相同",
        negative_change_difference:"目标相对对照下降",positive_change_difference:"目标相对对照上升"};
      lines.push(`- ${event.anchor_date}，相关组 ${event.group_id}，${meanings[event.interpretation]}。对照 ${event.selected_control?.id ?? "未知"}。`);
      for(const candidate of event.candidates) if(candidate.reason) lines.push(`  - ${candidate.id} · ${candidate.reason}`);
      for(const [window,comparison] of Object.entries(event.windows)) {
        const target=event.target_changes[window];
        lines.push(`  - ${window} 目标原前后差 ${target.absolute_density_change ?? "未知"}；同日变化差 ${comparison?.change_difference ?? "未知"} h/(km²·d)。`);
      }
    }
    const inference=result.inference;
    const limitations={insufficient_registered_groups:"组数不足",between_group_assumptions_unverified:"跨组假设待核",no_paired_support:"缺少成对支持",
      event_provenance_unverified:"冻结来源待核",degenerate_block_distribution:"重采样分布退化"};
    lines.push("", "## 区间与来源", "", inference.lower===null
      ? `区间无法可靠估计。${limitations[inference.reason] ?? inference.reason ?? "支持不足"}。可得描述估计 ${inference.estimate ?? "未知"} h/(km²·d)。`
      : `${inference.window} 的登记区间 [${inference.lower}, ${inference.upper}] h/(km²·d)。`,
      `冻结身份 ${result.result_id}。B05 ${result.source_results.control}，B06 ${result.source_results.inference}，B07 ${result.source_results.lag}。`,
      "聚合用于本地读取。逐日图保留支持断点和队列变化。真实研究资格待验收。", "");
    return lines.join("\n");
  }
  if (result.schema_version === "fixed-region-event-lag/v1") {
    const {cohorts,profiles}=result;
    const lines=["# 锚日前后逐日变化与共同队列 · 合成样例", "", `来源 ${result.control_result_id}。`,
      `短期 ${cohorts.post3.event_count} 个事件，后七日 ${cohorts.post7.event_count} 个事件，具有完整同日证据的共同队列 ${cohorts.common.event_count} 个事件。`,
      `共同队列的等权变化差。后 1–3 日 ${cohorts.common.equal_event_window_effects.post3 ?? "未知"}，后 1–7 日 ${cohorts.common.equal_event_window_effects.post7 ?? "未知"} h/(km²·d)。`,
      "逐日图按当日可用成员分别合并 H/E。锚日为诊断记录，断点保留未知。", "", "![逐日活动密度差](lag.svg)", ""];
    for(const [key,title] of [["common","共同队列"],["available","逐日可用案例"]]) {
      lines.push(`## ${title}`, "", "| 相对日 | 事件数 | 相关组 | 目标 H | 目标 E | 对照 H | 对照 E | 密度差 | 状态 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
      for(const day of profiles[key]) lines.push(`| ${day.offset} | ${day.event_count} | ${day.group_ids.join(", ") || "—"} | ${day.target.hours ?? "未知"} | ${day.target.area_time ?? "未知"} | ${day.control.hours ?? "未知"} | ${day.control.area_time ?? "未知"} | ${day.density_difference ?? "未知"} | ${day.status} |`);
      lines.push("");
    }
    lines.push("H 为表观捕捞活动小时，E 为 km²·d，密度差单位 h/(km²·d)。状态以观测锚日计算，保留实际持续暴露和再次触发证据。", "");
    return lines.join("\n");
  }
  if (result.schema_version === "fixed-region-event-group-uncertainty/v1") {
    const {counts, inference, policy} = result;
    const lines = ["# 固定海域相关事件组区间 · 合成样例", "",
      `窗口 ${policy.window}，估计量 ${policy.estimand}。锋面候选 ${counts.front_candidate_events ?? "未知"}，送入比较 ${counts.candidate_events}，合格 ${counts.eligible_events}，半径展开 ${counts.event_radius_rows} 行，有效日期 ${counts.eligible_dates}，可用组 ${counts.usable_groups}。`,
      `描述估计 ${inference.estimate ?? "未知"} h/(km²·d)。`,
      inference.lower === null ? `区间无法可靠估计。${inference.reason}` : `登记假设下 ${policy.confidence_level*100}% 区间 [${inference.lower}, ${inference.upper}] h/(km²·d)。`,
      `当次种子 ${policy.seed}，有效抽样 ${inference.valid_iterations}/${inference.requested_iterations}。`, "",
      "## 分组成员", ""];
    for (const group of result.groups) lines.push(`- 组 ${group.id} · ${group.members.join(", ")}`);
    lines.push("", "## 已有单事件变化差", "");
    for (const item of result.individual_effects) lines.push(`- ${item.event} · ${item.estimate} h/(km²·d)`);
    lines.push("", "分组登记保留相关证据，跨组独立性仍取决于登记假设。真实研究资格待验收。", "");
    return lines.join("\n");
  }
  if (result.schema_version === "fixed-region-comparable-controls/v1") {
    const lines = ["# 固定海域同日对照 · 合成样例", "", `事件效应结果 ${result.target_result_id}。`,
      "候选依据登记空间域、非锋面日期、资料资格及环境范围核对，采用回顾性条件比较。", ""];
    for (const event of result.events) {
      lines.push(`## 锚日 ${event.anchor_date}`, "");
      if (event.matching.selected) lines.push(`固定对照 ${event.matching.selected.id}，权重 ${event.matching.selected.weight}。`);
      else lines.push("当前没有合格固定对照，保留事件区原变化。");
      for (const item of event.matching.candidates) lines.push(`- ${item.id} · ${item.reason ?? "满足登记条件"}`);
      for (const [name, value] of Object.entries(event.contrasts)) {
        if(value) lines.push(`- ${name} 前期同日差 ${value.pre7.same_day_density_difference}，后期同日差 ${value.post.same_day_density_difference}，变化差 ${value.change_difference} h/(km²·d)。`);
      }
      lines.push("");
    }
    lines.push("结果保留渔具等未测因素的限制，真实研究资格待验收。", "");
    return lines.join("\n");
  }
  if (result.schema_version === "fixed-region-window-effects/v1") {
    const lines = ["# 固定海域事件活动变化 · 合成样例", "", `窗口资格结果 ${result.window_result_id}。`,
      "变化为相同有效支持上的表观捕捞活动密度差。单位 h/(km²·d)，锚日单列。", "",
      "| 锚日 | 窗口 | 活动小时 H | 面积时间 E (km²·d) | 有效日 | H/E | 密度差 | 相对变化 (%) | 比较状态 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
    for (const event of result.events) {
      for (const [name, window] of Object.entries(event.windows)) {
        const change=event.changes[name];
        lines.push(`| ${event.anchor_date} | ${name} | ${window.total_hours ?? "未知"} | ${window.area_time_km2_days ?? "未知"} | ${window.supported_days}/${window.requested_days} | ${window.density_hours_per_km2_day ?? "未知"} | ${change?.absolute_density_change ?? "—"} | ${change?.relative_change_percent ?? "—"} | ${change?.relative_reason ?? change?.status ?? window.p0_status} |`);
      }
    }
    lines.push("", "## 汇总", "");
    for (const [name, pooled] of Object.entries(result.pooled)) {
      lines.push(`- ${name} 共 ${pooled.event_count} 个事件。事件等权差 ${pooled.equal_event_difference ?? "未知"}；按面积时间合并的差 ${pooled.pooled_density_difference ?? "未知"}；合并状态 ${pooled.pooled_status}。`);
    }
    lines.push("", "混合覆盖范围或缺少前后支持时保留描述值。真实研究、对照效应和不确定性待验收。", "");
    return lines.join("\n");
  }
  if (result.schema_version === "fixed-region-window-qualification/v1") {
    const lines = ["# 固定海域事件窗口资格 · 合成样例", "", `锋面结果 ${result.front_result_id}。`,
      "事件日单列。真实研究资格待验证。", ""];
    for (const event of result.events) {
      lines.push(`## 观测锚日 ${event.anchor_date}`, "",
        "| 用途 | 窗口 | 日期 | 支持状态 | 排除日期 |", "| --- | --- | --- | --- | --- |");
      for (const [use, evidence] of Object.entries(event.support)) {
        for (const [name, window] of Object.entries(evidence.windows)) {
          lines.push(`| ${use} | ${name} | ${window.dates[0]} – ${window.dates.at(-1)} | ${window.status} | ${window.excluded_dates?.join(", ") ?? "未知"} |`);
        }
      }
      lines.push("");
    }
    if (!result.events.length) lines.push("当前结果中没有可取得窗口的已确认锚日。", "");
    return lines.join("\n");
  }
  if (result.schema_version === "fixed-region-front-observation/v1") {
    const {policy, observations, events} = result.selection;
    return ["# 固定海域锋面观测 · 合成样例", "", `状态 ${result.status}；结果 ${result.result_id}`,
      `锚日搜索 ${result.parameters.search_start} – ${result.parameters.search_end}；观测读取 ${result.read_range.start} – ${result.read_range.end}。`,
      `圆心 ${result.geometry.longitude}°, ${result.geometry.latitude}°，半径 ${result.geometry.radius_km} km。进入距离 ${policy.enter_distance_km} km，退出距离 ${policy.exit_distance_km} km，持续 ${policy.persistence_days} 日，重触发间隔 ${policy.clear_days} 个明确远离日。`,
      "", "| 首次观测 | 锚日 | 退出确认 | 断档 | 状态 |", "| --- | --- | --- | --- | --- |",
      ...events.map(e => `| ${e.first_near_date} | ${e.anchor_date ?? "未知"} | ${e.exit_observed_date ?? "未知"} | ${e.unknown_dates.join(", ") || "无"} | ${e.reason ?? (e.right_truncated ? "右截断" : "已登记")} |`),
      "", "| 观测日 | 状态 | 依据 |", "| --- | --- | --- |",
      ...observations.map(d => `| ${d.date} | ${d.phase} | ${d.reasons.join(", ")} |`),
      "", "锚日表示首次合格日观测。活动窗口资格、活动变化及真实 B 结果待后续票验证。", ""].join("\n");
  }
  const lines=["# Fixed-region event response / 合成样例", "", "仅为自建合成样例；不是真实研究、因果关系或渔获证据。", "",
    `状态：${result.status}；观测锚日：${result.event?.anchor_date || "无可确认单一事件"}`, "",
    "| 窗口 | 起止日期 | 已知小时 H | 已知面积时间 E (km²·d) | 有效日 / 窗口日 | H/E | 状态 |",
    "|---|---|---:|---:|---:|---:|---|"];
  for (const [name,w] of Object.entries(result.windows)) lines.push(`| ${name} | ${w.start_date} — ${w.end_date} | ${w.total_hours ?? "未知"} | ${w.area_time_km2_days ?? "未知"} | ${w.supported_days}/${w.calendar_days} | ${w.density_hours_per_km2_day ?? "未知"} | ${w.status} |`);
  lines.push("", "## 归一化描述变化", "");
  for (const [name,c] of Object.entries(result.changes)) lines.push(`- ${name}：密度绝对差 ${c.absolute_density_change ?? "未知"} h/(km²·d)，相对变化 ${c.relative_density_change_percent ?? "未知"}%；${c.reason || "完整固定支持"}。`);
  lines.push("", "不直接比较7天与3天原始总量；0日单列，缺日不补零；前后使用同一已知单元支持。", "",
    "实际GIS、完整事件识别、P0资格、同日对照及不确定性须在后续任务验收。", "");
  return lines.join("\n");
}

function readingContext(result) {
  const heading="# 固定海域事件成果包 · 合成样例";
  const p=result.parameters;
  const conditions=`${p.search_start} – ${p.search_end}，圆心 ${p.longitude}°, ${p.latitude}°，半径 ${p.radius_km} km。`;
  if(result.events.length) return {heading,summary:conditions};
  const empty=result.front_observation_status==="no_observed_entry" ? "在可核对日期中未见合格事件。" : "观测证据不足，当前没有已确认的事件。";
  return {heading,summary:conditions+empty};
}

function csv(rows) {
  function cell(value) {
    if(value===null || value===undefined) return "";
    if(typeof value==="number" || typeof value==="boolean") return String(value);
    const text=/^[=+@\-\s]/.test(value) ? "'"+value : String(value);
    return /[",\r\n]/.test(text) ? '"'+text.replaceAll('"','""')+'"' : text;
  }
  return rows.map(row=>row.map(cell).join(",")).join("\n")+"\n";
}

function dailyCsv(result) {
  return csv([["anchor_date","date","relative_day","target_hours","target_area_time_km2_days","control_hours",
    "control_area_time_km2_days","target_front_state","control_front_state","matched_day","group_id","result_id"],
    ...result.events.flatMap(event=>event.daily.map(day=>[event.anchor_date,day.date,day.offset,day.target.hours,
      day.target.area_time,day.control.hours,day.control.area_time,day.target.front_exposure,day.control.front_exposure,
      day.pair_available,event.group_id,result.result_id]))]);
}

function windowsCsv(result) {
  return csv([["anchor_date","window","phase","target_hours","target_area_time_km2_days","control_hours",
    "control_area_time_km2_days","same_day_density_difference","target_before_after_difference","difference_of_changes","state","result_id"],
    ...result.events.flatMap(event=>Object.entries(event.windows).flatMap(([name,value])=>["pre7","post"].map(phase=>{
      const row=value?.[phase];
      return [event.anchor_date,name,phase,row?.target_hours,row?.target_area_time,row?.control_hours,row?.control_area_time,
        row?.same_day_density_difference,event.target_changes[name].absolute_density_change,value?.change_difference,event.interpretation,result.result_id];
    }))) ]);
}

function lagChart(result) {
  const {available,common}=result.profiles;
  const values=[...available,...common].flatMap(d=>d.density_difference===null?[]:[Math.abs(d.density_difference)]);
  const peak=Math.max(...values,0);
  const x=offset=>100+(offset+7)*46, y=value=>180-110*(value/(peak||1));
  const axes=[
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 370" role="img" aria-labelledby="title desc">',
    '<title id="title">锚日前后目标与固定对照密度差</title><desc id="desc">共同队列和逐日可用案例。没有支持的相对日保留空白。</desc>',
    '<rect width="840" height="370" fill="#fff"/>',
    '<g font-family="system-ui, sans-serif" font-size="13" fill="#173243">',
    '<text x="28" y="27" font-size="19">锚日前后活动密度差</text>',
    '<text x="28" y="49">目标 − 固定对照 [h/(km²·d)]</text>',
    '<path d="M95,180 H795 M100,70 V294" fill="none" stroke="#b5c4ca"/>',
  ];
  for(const value of [-peak,0,peak].filter((v,i,a)=>a.indexOf(v)===i)) {
    axes.push(`<text x="87" y="${y(value)+4}" text-anchor="end">${value.toPrecision(3)}</text>`);
  }
  for(const {offset} of common) {
    axes.push(`<text x="${x(offset)}" y="317" text-anchor="middle">${offset===0?"0 日":offset}</text>`);
  }
  if(!values.length) axes.push('<text x="420" y="140" text-anchor="middle">没有可配对的相对日证据</text>');
  const marks=[];
  for(const [name,rows,color,shift] of [["available",available,"#5c6983",-5],["common",common,"#187e77",5]]) {
    marks.push(`<g data-series="${name}" fill="${color}">`);
    for(const row of rows) {
      if(row.density_difference===null) continue;
      marks.push(`<circle cx="${x(row.offset)+shift}" cy="${y(row.density_difference)}" r="4" data-offset="${row.offset}"><title>${row.event_count} 个事件，${row.density_difference.toPrecision(5)}</title></circle>`);
    }
    marks.push("</g>");
  }
  return [...axes,...marks,
    '<circle cx="100" cy="345" r="4" fill="#5c6983"/><text x="111" y="350">逐日可用案例</text>',
    '<circle cx="252" cy="345" r="4" fill="#187e77"/><text x="263" y="350">共同队列</text>',
    '<text x="790" y="350" text-anchor="end">相对观测锚日</text></g></svg>', ""].join("\n");
}

function readFrozen(folder, profile) {
  if (!lstatSync(folder).isDirectory() || lstatSync(folder).isSymbolicLink()) throw Error("invalid_directory");
  const manifest=JSON.parse(boundedText(join(folder,"manifest.json")));
  if (manifest.schema_version !== "front-response-experiment-manifest/v2" || manifest.purpose !== profile.purpose || manifest.evidence_kind !== "synthetic_example" || manifest.research_ready !== false) throw Error("wrong_manifest");
  if (manifest.state === "failed") return {state:"failed",error:manifest.error,run_id:manifest.run_id};
  if (manifest.state !== "completed" || !manifest.artifacts) throw Error("incomplete_manifest");
  const text=boundedText(join(folder,"summary.json"));
  if(hash(text)!==manifest.artifacts["summary.json"]) throw Error("artifact_mismatch");
  const summary=JSON.parse(text);
  const extra=profile.extraArtifacts?.get(summary.schema_version) ?? {};
  const names=["report.md","summary.json",...Object.keys(extra)].sort();
  if(Object.keys(manifest.artifacts).sort().join("|")!==names.join("|")) throw Error("incomplete_manifest");
  for (const name of names.filter(name=>name!=="summary.json")) {
    if (hash(boundedText(join(folder,name))) !== manifest.artifacts[name]) throw Error("artifact_mismatch");
  }
  if (summary.kind !== profile.purpose || summary.evidence_kind !== "synthetic_example" || summary.research_ready !== false || summary.result_id !== manifest.result_id) throw Error("result_mismatch");
  if (!isDeepStrictEqual(summary.parameters,manifest.parameters) || manifest.inputs?.length !== 1 || !isDeepStrictEqual(summary.source,manifest.inputs[0])) throw Error("identity_mismatch");
  return summary;
}

export function runControlledExample(args, root, profile) {
  let stage,stageParent,stagePrefix;
  try {
    const opts=options(args, profile);
    if (opts[profile.readFlag]) {
      console.log(JSON.stringify(readFrozen(opts[profile.readFlag], profile))); return 0;
    }
    const output=opts["--output"] || join(root,"outputs/experiments",profile.outputName);
    if (existsSync(output)) throw Error("output_already_exists");
    const parent=dirname(output),prefix=basename(output)+".staging-";
    stageParent=resolve(parent);stagePrefix=prefix;
    mkdirSync(parent,{recursive:true});stage=join(stageParent,prefix+randomUUID());mkdirSync(stage);
    let state="failed",result,error={code:profile.errorCode},requestHash=null,inputHash=null;
    try {
      const source=opts["--input"] || join(root,"backend/app/examples",profile.inputName);
      const requestJson=boundedText(opts[profile.requestFlag],16_384);requestHash=hash(requestJson);
      const inputJson=boundedText(source);inputHash=hash(inputJson);
      const pythonArgs=profile.pythonArgs?.(requestJson,root,stage) ?? ["-m",profile.module];
      const computed=spawnSync(process.env.OCEAN_EXPERIMENT_PYTHON || "python",pythonArgs,{
        cwd:join(root,"backend"),encoding:"utf8",windowsHide:true,timeout:20_000,maxBuffer:4_194_304,
        input:JSON.stringify({request_json:requestJson,input_json:inputJson})});
      const value=JSON.parse(computed.stdout || "{}");
      if (computed.status === 0 && value.state === "completed" && value.result?.kind === profile.purpose) {
        state="completed";result=value.result;error=null;
      }
    } catch { /* Failed inputs never expose private locations or partial output. */ }
    let artifacts;
    if (result) {
      try {
        artifacts={"summary.json":JSON.stringify(result,null,2)+"\n","report.md":profile.report(result)};
        for(const [name,render] of Object.entries(profile.extraArtifacts?.get(result.schema_version) ?? {})) artifacts[name]=render(result);
        if (Object.values(artifacts).some(value=>Buffer.byteLength(value,"utf8")>ARTIFACT_BYTES)) throw Error("output_budget");
      } catch { state="failed";result=null;error={code:profile.errorCode}; }
    }
    const manifest={schema_version:"front-response-experiment-manifest/v2",purpose:profile.purpose,
      run_id:randomUUID(),state,created_at:new Date().toISOString(),evidence_kind:"synthetic_example",research_ready:false,
      transport_identity:{request_sha256:requestHash,input_sha256:inputHash},error,artifacts:{}};
    if (result) {
      manifest.result_id=result.result_id;manifest.parameters=result.parameters;manifest.inputs=[result.source];
      manifest.artifacts=Object.fromEntries(Object.entries(artifacts).map(([name, content])=>[name,hash(content)]));
    }
    if (Buffer.byteLength(JSON.stringify(manifest,null,2)+"\n","utf8")>ARTIFACT_BYTES) {
      state="failed";result=null;error={code:profile.errorCode};
      Object.assign(manifest,{state,error,artifacts:{}});
      delete manifest.result_id;delete manifest.parameters;delete manifest.inputs;
    }
    if (result) {
      for(const [name,content] of Object.entries(artifacts)) writeFileSync(join(stage,name),content);
    }
    writeFileSync(join(stage,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
    renameSync(stage,output);stage=null;
    console.log(JSON.stringify({state,run_id:manifest.run_id,result_id:manifest.result_id,error}));
    return state === "completed" ? 0 : 2;
  } catch { console.error("Controlled example rejected; no completed result was published.");return 2; }
  finally {
    if (stage && existsSync(stage) && dirname(stage)===stageParent && basename(stage).startsWith(stagePrefix) && !lstatSync(stage).isSymbolicLink()) rmSync(stage,{recursive:true,force:true});
  }
}

export function runFixedRegionExample(args, root) {
  return runControlledExample(args, root, {
    requestFlag: "--fixed-region-request", readFlag: "--read-fixed-region-result",
    purpose: "fixed_region_event_example", outputName: "fixed-region-example",
    inputName: "fixed-region-event.json", module: "app.fixed_region_example",
    pythonArgs: (request, root, stage) => {
      const scripts = new Map([
        ["observed-fixed-exposure/v1","fixed_region_front_observations.py"],
        ["fixed-event-window-qualification/v1","fixed_region_window_qualification.py"],
        ["fixed-event-window-effects/v1","fixed_region_window_effects.py"],
        ["fixed-event-comparable-controls/v1","fixed_region_comparable_controls.py"],
        ["fixed-event-group-uncertainty/v1","fixed_region_event_inference.py"],
        ["fixed-event-lag-cohort/v1","fixed_region_event_lag.py"],
        ["fixed-event-reading-pack/v1","fixed_region_event_evidence.py"],
      ]);
      const script = scripts.get(JSON.parse(request).method_version);
      return script ? ["-B","-X",`pycache_prefix=${join(stage,"pycache")}`,join(root,"tools",script)] : undefined;
    },
    errorCode: "controlled_event_failed", report,
    extraArtifacts:new Map([
      ["fixed-region-event-lag/v1",{"lag.svg":lagChart}],
      ["fixed-region-event-reading-pack/v1",{"lag.svg":result=>result.lag_svg,"daily.csv":dailyCsv,"windows.csv":windowsCsv}],
    ]),
  });
}
