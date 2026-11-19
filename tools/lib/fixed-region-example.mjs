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
function readFrozen(folder, profile) {
  if (!lstatSync(folder).isDirectory() || lstatSync(folder).isSymbolicLink()) throw Error("invalid_directory");
  const manifest=JSON.parse(boundedText(join(folder,"manifest.json")));
  if (manifest.schema_version !== "front-response-experiment-manifest/v2" || manifest.purpose !== profile.purpose || manifest.evidence_kind !== "synthetic_example" || manifest.research_ready !== false) throw Error("wrong_manifest");
  if (manifest.state === "failed") return {state:"failed",error:manifest.error,run_id:manifest.run_id};
  if (manifest.state !== "completed" || Object.keys(manifest.artifacts || {}).sort().join("|") !== "report.md|summary.json") throw Error("incomplete_manifest");
  for (const name of ["summary.json","report.md"]) {
    if (hash(boundedText(join(folder,name))) !== manifest.artifacts[name]) throw Error("artifact_mismatch");
  }
  const summary=JSON.parse(boundedText(join(folder,"summary.json")));
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
    let summary, markdown;
    if (result) {
      try {
        summary=JSON.stringify(result,null,2)+"\n";markdown=profile.report(result);
        if ([summary,markdown].some(value=>Buffer.byteLength(value,"utf8")>ARTIFACT_BYTES)) throw Error("output_budget");
      } catch { state="failed";result=null;error={code:profile.errorCode}; }
    }
    const manifest={schema_version:"front-response-experiment-manifest/v2",purpose:profile.purpose,
      run_id:randomUUID(),state,created_at:new Date().toISOString(),evidence_kind:"synthetic_example",research_ready:false,
      transport_identity:{request_sha256:requestHash,input_sha256:inputHash},error,artifacts:{}};
    if (result) {
      manifest.result_id=result.result_id;manifest.parameters=result.parameters;manifest.inputs=[result.source];
      manifest.artifacts={"summary.json":hash(summary),"report.md":hash(markdown)};
    }
    if (Buffer.byteLength(JSON.stringify(manifest,null,2)+"\n","utf8")>ARTIFACT_BYTES) {
      state="failed";result=null;error={code:profile.errorCode};
      Object.assign(manifest,{state,error,artifacts:{}});
      delete manifest.result_id;delete manifest.parameters;delete manifest.inputs;
    }
    if (result) {
      writeFileSync(join(stage,"summary.json"),summary);writeFileSync(join(stage,"report.md"),markdown);
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
      ]);
      const script = scripts.get(JSON.parse(request).method_version);
      return script ? ["-B","-X",`pycache_prefix=${join(stage,"pycache")}`,join(root,"tools",script)] : undefined;
    },
    errorCode: "controlled_event_failed", report,
  });
}
