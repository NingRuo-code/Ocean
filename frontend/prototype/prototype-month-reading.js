/* Public frozen monthly results only. No execution, task state or scientific estimation. */
(function () {
  const pane = $("pane-clim"), history = document.createElement("div");
  while (pane.firstChild) history.append(pane.firstChild);
  const tabs = document.createElement("div"); tabs.className = "seg month-reading-tabs";
  tabs.setAttribute("aria-label", "历史内容");
  tabs.innerHTML = '<button id="observationView">归档观测</button><button id="monthlyView">月度空间关系</button>';
  const section = document.createElement("section"); section.id = "monthlyResult"; section.className = "card"; section.hidden = true;
  section.dataset.state = "empty";
  section.innerHTML = '<h3>月度空间关系 <span class="tag">合成样例</span></h3><label class="monthly-select">已有月结果<select id="monthlySavedResult" aria-label="已有月结果" disabled></select></label><p id="monthlyStatus" role="status">只读取已保存的公开成果。</p><p id="monthlyConditions" class="result-brief"></p><p id="monthlyContext" class="result-stale"></p><div id="monthlyMetrics" class="metric" hidden><div class="m"><div class="k">活动小时</div><div class="v" id="monthlyHours"></div><small>h</small></div><div class="m"><div class="k">面积时间密度</div><div class="v" id="monthlyDensity"></div><small>h/(km²·d)</small></div><div class="m"><div class="k">有效 / 日历日</div><div class="v" id="monthlyDays"></div><small>日</small></div></div><p id="monthlyBrief" class="result-brief"></p><div class="monthly-actions"><button id="monthlyDetails" aria-controls="evidencePanel" aria-expanded="false" disabled>详细证据</button><button id="monthlyRefresh">重新读取目录</button></div>';
  pane.append(tabs, history, section);
  const evidence = document.createElement("div"); evidence.id = "monthlyEvidence";
  const evidenceTemplate = '<div class="monthly-source-actions"><details><summary>来源、版本与许可</summary><p id="monthlySource" class="result-identity"></p></details><a id="monthlyDownload" download>聚合 CSV</a></div><p id="monthlyIntervals"></p><p id="monthlyChartScale" class="result-note"></p><div class="monthly-chart-wrap"><div id="monthlyChart" class="monthly-chart" role="img" aria-label="逐日活动小时"></div></div><p class="result-note">柱高为活动小时，0 为有效零；未知日留空。仅为合成已知支持，未完成真实研究。</p><div class="monthly-table-wrap"><table id="monthlyTable"><thead><tr><th>日期</th><th>状态</th><th>小时 (h)</th><th>有效面积 (km²)</th></tr></thead><tbody></tbody></table></div><p id="monthlyLimitations" class="result-note"></p>';
  evidence.innerHTML = evidenceTemplate;
  let catalog = [], catalogOrigin = null, record = null, generation = 0, controller = null, blobUrl = null;
  const path = "/query/monthly-analysis/published";
  const idPattern = /^sha256:[0-9a-f]{64}$/;
  const units = {total_hours:"fishing_hours",area_time_km2_days:"km2*d",mean_hours_per_supported_day:"fishing_hours/d",density_hours_per_km2_day:"fishing_hours/(km2*d)"};
  const states = {ready:"有效",partial_support:"部分单元有效",unprepared:"未准备",missing:"缺测",read_failed:"读取失败",no_records:"无记录／覆盖未知",unknown_support:"支持未知"};
  const {source:origin,sameSource:sameOrigin,json} = OceanPublicRead;
  let draftContext = null;
  function stale() {
    if (!record) return "";
    const p = record.result.parameters;
    if(draftContext && ["month","longitude","latitude","radius_km"].some(key=>p[key]!==draftContext[key]))
      return "任务条件已改变，以下保留原成果，待更新。";
    return p.month !== state.date.slice(0,7) || p.longitude !== state.lon || p.latitude !== state.lat || p.radius_km !== state.range
      ? "以下保留成果原条件，与当前地图筛选不同。" : "";
  }
  function sync() { $("monthlyContext").textContent = stale(); }
  const extraViews = new Map();
  function view(monthly, other = null) {
    history.hidden = monthly || !!other; section.hidden = !monthly;
    $("observationView").classList.toggle("active", !monthly && !other); $("monthlyView").classList.toggle("active", monthly);
    $("observationView").setAttribute("aria-pressed",String(!monthly && !other));$("monthlyView").setAttribute("aria-pressed",String(monthly));
    for(const [key,item] of extraViews){item.element.hidden=key!==other;item.button.classList.toggle("active",key===other);item.button.setAttribute("aria-pressed",String(key===other));}
    window.dispatchEvent(new CustomEvent("ocean-history-view",{detail:monthly?"monthly":other||"observation"}));
  }
  function openExtra(name) {
    const item=extraViews.get(name);if(!item)return;
    OceanWorkbench.showResult("clim");OceanEvidence.close(false);view(false,name);item.onOpen();
  }
  window.OceanHistoryViews = Object.freeze({open:openExtra,register(name,{label,element,onOpen}){
    if(extraViews.has(name))throw Error("Duplicate history view");
    const button=document.createElement("button");button.textContent=label;button.setAttribute("aria-pressed","false");
    button.onclick=()=>openExtra(name);element.hidden=true;tabs.append(button);pane.append(element);
    extraViews.set(name,{button,element,onOpen});
  }});
  function verify(item) {
    const p = item?.parameters;
    if (!item || !idPattern.test(item.result_id) || !idPattern.test(item.projection_id) || item.public_aggregate_allowed !== true || item.evidence_kind !== "synthetic_example" || item.research_ready !== false || !p || p.purpose !== "monthly_spatial_example" || p.method_version !== "monthly-known-support/v1" || p.parameter_version !== "known-unit-membership/v1" || !/^[12]\d{3}-(0[1-9]|1[0-2])$/.test(p.month) || ![10,20,30].includes(p.radius_km) || !Number.isFinite(p.longitude) || Math.abs(p.longitude)>180 || !Number.isFinite(p.latitude) || Math.abs(p.latitude)>90 || typeof item.source?.license !== "string" || !item.source.license.startsWith("CC0-1.0")) throw Error("contract");
    return item;
  }
  function sameFields(a,b,keys) { return a && b && keys.every(key=>a[key]===b[key]); }
  function verifyResult(value, item) {
    verify(value);
    if (value.schema_version !== "ocean-published-month/v1" || value.kind !== "monthly_spatial_example" || value.result_id !== item.result_id || value.projection_id !== item.projection_id || !sameFields(value.parameters,item.parameters,["purpose","longitude","latitude","radius_km","month","input_version","method_version","parameter_version"]) || !sameFields(value.source,item.source,["id","version","input_sha256","license","support_evidence"]) || value.intervals !== null || !["available","partial","unavailable"].includes(value.status)) throw Error("contract");
    const m = value.metrics, n = new Date(Number(value.parameters.month.slice(0,4)), Number(value.parameters.month.slice(5)), 0).getDate();
    if (!m || m.calendar_days !== n || !Number.isInteger(m.supported_days) || m.supported_days<0 || m.supported_days>n || !Array.isArray(value.daily) || value.daily.length !== n || !Array.isArray(value.caveats) || value.caveats.length<1 || value.caveats.length>16 || value.caveats.some(note=>typeof note !== "string" || note.length>500)) throw Error("contract");
    for (const [key,unit] of Object.entries(units)) if (value.units?.[key] !== unit || (m[key] !== null && (!Number.isFinite(m[key]) || m[key]<0))) throw Error("contract");
    value.daily.forEach((d,index)=>{
      if (d.date !== value.parameters.month+"-"+String(index+1).padStart(2,"0") || !Object.hasOwn(states,d.state) || [d.hours,d.effective_area_km2,d.area_time_km2_days].some(v=>v !== null && (!Number.isFinite(v) || v<0))) throw Error("contract");
      if (["ready","partial_support"].includes(d.state) ? d.hours === null || !(d.effective_area_km2>0) : d.hours !== null) throw Error("contract");
    });
    return value;
  }
  function begin() { controller?.abort();controller=new AbortController();return ++generation; }
  function cancelRead() {
    if(section.dataset.state!=="reading")return;
    generation++;controller?.abort();section.dataset.state=record?"ready":"empty";
    $("monthlyStatus").textContent="读取已停止。"+(record?"以下保留上次读取的原成果。":"可明确重新读取目录。");
    if(record)$("monthlySavedResult").value=record.result.result_id;
  }
  function freeze(value) { if(value && typeof value === "object") { Object.values(value).forEach(freeze);Object.freeze(value); } return value; }
  function describe(p) { return p.month+" · "+fmtCoord(p.longitude,p.latitude)+" · "+p.radius_km+" km"; }
  function clear() {
    if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}
    record=null;delete section.dataset.resultId;delete section.dataset.projectionId;$("monthlyMetrics").hidden=true;$("monthlyDetails").disabled=true;
    $("monthlyHours").textContent="";$("monthlyDensity").textContent="";$("monthlyDays").textContent="";$("monthlyConditions").textContent="";$("monthlyBrief").textContent="";$("monthlyContext").textContent="";
    OceanEvidence.close(false);evidence.replaceChildren();
  }
  function fail(error) {
    section.dataset.state="error";
    if (["http_401","http_403","contract"].includes(error.message)) clear();
    const messages={http_401:"此成果暂不能公开读取，请选择允许公开的结果。",http_403:"此成果暂不能公开读取，请选择允许公开的结果。",http_404:"未找到已保存成果，请重新读取目录。",contract:"成果版本、单位或公开许可无法核实，请重新读取目录。",budget:"成果超出读取范围，需核对已保存文件。"};
    section.dataset.errorCode=/^http_\d+$/.test(error.message)||["contract","budget"].includes(error.message)?error.message:"read_failed";
    $("monthlyStatus").textContent = (messages[error.message] || "成果服务暂不可读，请稍后重试。") + (record ? " 以下保留上次读取的原成果。" : "");
  }
  async function selectResult(item) {
    const token=begin(), from=origin(), activeController=controller, timer=setTimeout(()=>activeController.abort(),10000);
    section.dataset.state="reading";$("monthlyStatus").textContent="正在读取已有成果…";OceanEvidence.close(false);
    if(!catalogOrigin || !sameOrigin(from,catalogOrigin)){clearTimeout(timer);section.dataset.state="error";$("monthlyStatus").textContent="阅读来源已改变，请重新读取目录。";return;}
    try {
      let result = from.kind === "server" ? await json(from.base+path+"/"+encodeURIComponent(item.result_id),controller.signal)
        : structuredClone(window.OceanPublishedMonths.results.find(r=>r.result_id===item.result_id));
      verifyResult(result,item);
      if(token!==generation)return;
      if(!sameOrigin(from,origin())){section.dataset.state="error";$("monthlyStatus").textContent="阅读来源已改变，请重新读取目录。";return;}
      record={result:freeze(result),from};render();
    } catch(error) {if(token===generation)fail(error);} finally {clearTimeout(timer);}
  }
  async function load(preferredId = null) {
    const token=begin(), from=origin(), activeController=controller, timer=setTimeout(()=>activeController.abort(),10000);
    section.dataset.state="reading";$("monthlyStatus").textContent="正在读取已有成果目录…";
    try {
      let data;
      if(from.kind === "server")data=await json(from.base+path,controller.signal);
      else { const local=window.OceanPublishedMonths;if(local?.schema_version!=="ocean-offline-published-months/v1" || local.public_aggregate_allowed!==true)throw Error("contract");data={schema_version:"ocean-published-month-catalog/v1",results:structuredClone(local.results)}; }
      if(data.schema_version!=="ocean-published-month-catalog/v1" || !Array.isArray(data.results) || data.results.length>16)throw Error("contract");
      const items=data.results.map(verify);
      if(new Set(items.map(i=>i.result_id)).size!==items.length)throw Error("contract");
      if(token!==generation)return;
      if(!sameOrigin(from,origin())){section.dataset.state="error";$("monthlyStatus").textContent="阅读来源已改变，请重新读取目录。";return;}
      catalog=items;catalogOrigin=from;$("monthlySavedResult").replaceChildren();
      for(const item of catalog) {const option=document.createElement("option");option.value=item.result_id;option.textContent=describe(item.parameters);$("monthlySavedResult").append(option);}
      $("monthlySavedResult").disabled=!catalog.length;
      if(!catalog.length) {clear();section.dataset.state="empty";$("monthlyStatus").textContent="没有允许公开的已就绪月结果，需先完成对应 A 成果交接。";return;}
      const selected = preferredId ? catalog.find(item=>item.result_id===preferredId) : catalog[0];
      if(!selected)throw Error("http_404");
      $("monthlySavedResult").value=selected.result_id;
      clearTimeout(timer);await selectResult(selected);
    } catch(error) {if(token===generation)fail(error);} finally {clearTimeout(timer);}
  }
  function csv(value) {
    const quote=v=>{if(typeof v === "number")return String(v);let s=String(v??"");if(/^[=+@\-\s]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const rows=[["result_id",value.result_id],["projection_id",value.projection_id],["month",value.parameters.month],["longitude",value.parameters.longitude],["latitude",value.parameters.latitude],["radius_km",value.parameters.radius_km],["source",value.source.id],["license",value.source.license],["total_hours",value.metrics.total_hours],["area_time_km2_days",value.metrics.area_time_km2_days],["density_hours_per_km2_day",value.metrics.density_hours_per_km2_day],["mean_hours_per_supported_day",value.metrics.mean_hours_per_supported_day],["supported_days",value.metrics.supported_days],["calendar_days",value.metrics.calendar_days],[],["date","state","fishing_hours","effective_area_km2"]];
    for(const d of value.daily)rows.push([d.date,d.state,d.hours,d.effective_area_km2]);
    return "\uFEFF"+rows.map(row=>row.map(quote).join(",")).join("\r\n");
  }
  function render() {
    // A user can reopen old evidence while a new read is pending. Publish atomically.
    OceanEvidence.close(false);
    const r=record.result, m=r.metrics;
    section.dataset.state="ready";delete section.dataset.errorCode;section.dataset.resultId=r.result_id;section.dataset.projectionId=r.projection_id;$("monthlyMetrics").hidden=false;$("monthlyDetails").disabled=false;
    $("monthlyStatus").textContent=(record.from.kind === "server" ? "服务公开成果" : "离线公开成果")+" · 仅为合成样例，真实研究结果未接入。";
    $("monthlyConditions").textContent=describe(r.parameters);
    $("monthlyHours").textContent=m.total_hours ?? "未知";$("monthlyDensity").textContent=m.density_hours_per_km2_day===null?"未知":m.density_hours_per_km2_day.toFixed(2);$("monthlyDays").textContent=m.supported_days+" / "+m.calendar_days;
    $("monthlyBrief").textContent=m.supported_days ? "仅对应已知子支持，未知日未补零；距离/冷暖侧关系尚未接入。" : "没有可核对的共同支持，活动小时与密度均未知。";
    // Recreate only this registered view after an invalid/forbidden payload cleared it.
    evidence.innerHTML=evidenceTemplate;
    $("monthlySource").textContent=r.result_id+" / "+r.projection_id+"；来源 "+r.source.id+" / "+r.source.version+"；许可 "+r.source.license;
    $("monthlyIntervals").textContent="统计区间：此样例未估计。面积时间 E="+(m.area_time_km2_days??"未知")+" km²·d；日值表保留缺测状态。";
    const known=r.daily.filter(d=>d.hours!==null),max=Math.max(0,...known.map(d=>d.hours));
    $("monthlyChartScale").textContent=known.length ? (max ? "纵轴：0–"+max+" h；横轴为日历日。" : "有效日均为0 h，未知日不绘柱。") : "没有可绘制的已知日值。";
    $("monthlyChart").setAttribute("aria-label",$("monthlyChartScale").textContent);
    if(!known.length){$("monthlyChart").dataset.state="empty";}
    else for(const d of r.daily) {const item=document.createElement("div");item.className="monthly-day";item.dataset.state=d.hours===null?"unknown":d.hours===0?"zero":"known";item.title=d.date+" "+states[d.state]+" "+(d.hours??"未知")+" h";const bar=document.createElement("i");if(d.hours!==null)bar.style.height=(max?d.hours/max*80:0)+"px";else bar.textContent="—";const label=document.createElement("small");label.textContent=d.date.slice(-2);item.append(bar,label);$("monthlyChart").append(item);}
    for(const d of r.daily) {const tr=document.createElement("tr");tr.dataset.date=d.date;for(const [field,v] of [["date",d.date],["state",states[d.state]],["hours",d.hours??"未知"],["area",d.effective_area_km2??"未知"]]){const td=document.createElement("td");td.dataset.field=field;td.textContent=v;tr.append(td);}$("monthlyTable").tBodies[0].append(tr);}
    $("monthlyLimitations").textContent="原成果限制（保留来源原文）："+r.caveats.join(" ");
    if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(new Blob([csv(r)],{type:"text/csv;charset=utf-8"}));
    $("monthlyDownload").href=blobUrl;$("monthlyDownload").download="Ocean-month-"+r.parameters.month+"-"+r.result_id.slice(7,19)+".csv";
    sync();OceanEvidence.sync();
  }
  OceanEvidence.register("monthly",{content:evidence,button:$("monthlyDetails"),view:()=>record ? {title:"月度空间关系证据",identity:describe(record.result.parameters)+" / "+record.result.result_id.slice(0,22)+"… / "+record.result.projection_id.slice(0,22)+"…",stale:stale()} : null});
  $("monthlySavedResult").onchange=()=>{const item=catalog.find(i=>i.result_id===$("monthlySavedResult").value);if(item)selectResult(item);};
  $("monthlyRefresh").onclick=()=>load();
  $("monthlyOpen").onclick=()=>{OceanWorkbench.showResult("clim");view(true);OceanEvidence.close(false);if(!record)load();};
  $("monthlyView").onclick=()=>{view(true);OceanEvidence.close(false);if(!record)load();};
  $("observationView").onclick=()=>{view(false);OceanEvidence.close(false);};
  window.addEventListener("ocean-workbench-task",e=>{if(e.detail.pane==="clim")view(false);});
  window.addEventListener("ocean-applied-context",sync);
  window.addEventListener("ocean-load-state",sync);
  window.addEventListener("ocean-month-draft",e=>{draftContext=e.detail;sync();OceanEvidence.sync();});
  window.addEventListener("ocean-history-view",e=>{if(e.detail!=="monthly")cancelRead();});
  $("tabs").addEventListener("click",e=>{if(e.target.closest("[data-pane]")?.dataset.pane!=="clim")cancelRead();});
  window.OceanMonthlyReader = Object.freeze({openSavedResult(id){
    if(!idPattern.test(id))return;
    OceanWorkbench.showResult("clim");view(true);OceanEvidence.close(false);load(id);
  }});
  view(false);
})();
