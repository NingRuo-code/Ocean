/* S01 only: explicit public exploration lookup and original A reading. */
(function () {
  const pane=document.createElement("section");pane.id="knownCasesPane";pane.className="card";pane.dataset.state="idle";
  pane.innerHTML='<h3>相似历史案例 <span class="tag">合成探索</span></h3><p id="caseConditions" class="result-brief"></p><p id="caseStale" class="result-stale" role="status"></p><button id="caseSearch">按已应用条件检索</button><p id="caseStatus" role="status">仅查明确允许的已知库。</p><p class="result-note">当前按同点、公里范围和月份检索；季节与环境相似性待接入。顺序不代表渔场优劣。</p><div id="caseCandidates" class="case-candidates"></div><button id="caseMore" hidden>查看原条件的更多案例</button><button id="caseReopen" disabled hidden aria-controls="evidencePanel" aria-expanded="false">重开已读案例证据</button><details class="case-scope"><summary>库范围与当前缺项</summary><p id="caseScope"></p><p>A月背景、B事件、环境候选和私人案例分开；当前只读合成A月背景。真实目录、响应与特征尚未接入，定位/短窗匹配待后续。没有资料不表示0响应；不能据此做独立验证。</p></details>';
  const evidence=document.createElement("section");evidence.id="caseEvidence";
  const {source,sameSource,json}=OceanPublicRead;
  const id=/^sha256:[0-9a-f]{64}$/,keys=["reference_date","longitude","latitude","radius_km","library_id","case_type"];
  const path="/query/known-cases",library="authored-exploration/v1";
  const states={ready:"有效",partial_support:"部分支持",missing:"缺测",unprepared:"未准备",no_records:"无记录／覆盖未知",unknown_support:"支持未知",read_failed:"读取失败"};
  let record=null,detail=null,generation=0,controller=null,taskDraft=null;
  function current(){return {reference_date:state.date,longitude:state.lon,latitude:state.lat,radius_km:state.range,library_id:library,case_type:"monthly_background"};}
  const same=(a,b)=>a&&b&&keys.every(key=>a[key]===b[key]);
  function freeze(value){if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  function describe(q){return q.reference_date+" · "+fmtCoord(q.longitude,q.latitude)+" · "+q.radius_km+" km";}
  function stale(){
    if(!record)return "";
    if(!sameSource(record.from,source()))return "读取来源已改变，以下保留原检索，请重新检索。";
    if(!same(record.request,current()))return "条件已改变，以下仍属原检索，待更新。";
    if(taskDraft&&(["longitude","latitude","radius_km"].some(key=>taskDraft[key]!==record.request[key])||taskDraft.month!==record.request.reference_date.slice(0,7)))return "月任务草稿已改变，案例仍属原检索；本入口采用已应用日和固定点。";
    return "";
  }
  function sync(){ $("caseStale").textContent=stale();OceanEvidence.sync(); }
  function clearDetail(){detail=null;$("caseReopen").hidden=true;$("caseReopen").disabled=true;evidence.replaceChildren();delete evidence.dataset.caseId;OceanEvidence.close(false);}
  function clear(){clearDetail();record=null;$("caseCandidates").replaceChildren();$("caseConditions").textContent="";$("caseScope").textContent="";$("caseMore").hidden=true;delete pane.dataset.searchId;sync();}
  function fail(error){
    pane.dataset.state="error";
    if(["http_401","http_403","http_404","contract"].includes(error.message))clear();
    if(error.message==="http_409"){clearDetail();if(record)record.invalid=true;pane.querySelectorAll('#caseCandidates button,#caseMore').forEach(n=>n.disabled=true);}
    const messages={offline:"离线：案例检索需要只读服务，已有月成果仍可读取。",http_401:"无权读取当前案例库。",http_403:"无权读取当前案例库。",http_404:"案例或检索服务不可读，请重新检索。",http_409:"库版本已改变，请明确重新检索。",http_503:"探索库暂不可读，请稍后重试。",contract:"案例条件、身份或单位无法核实。",source_changed:"读取来源已改变，请重新检索。"};
    $("caseStatus").textContent=(messages[error.message]||"读取失败，请重试。")+(record?" 以下保留原条件的旧检索。":"");
    pane.dataset.errorCode=/^http_\d+$/.test(error.message)||["offline","contract","source_changed"].includes(error.message)?error.message:"read_failed";
  }
  function visible(){return !pane.hidden&&state.tab==="clim"&&!$("resultPanel").hidden;}
  function stopped(){pane.dataset.state=record?"ready":"idle";$("caseStatus").textContent=record?"读取已停止；以下保留原条件的旧检索。":"读取已停止，可明确重新检索。";}
  function cancel(){generation++;controller?.abort();if(pane.dataset.state==="loading")stopped();}
  function publishable(active){
    if(active.token!==generation)return false;
    if(!sameSource(active.from,source()))throw Error("source_changed");
    if(!visible()){stopped();return false;}
    return true;
  }
  async function perform(work){
    controller?.abort();controller=new AbortController();const active={token:++generation,from:source(),signal:controller.signal},own=controller,timer=setTimeout(()=>own.abort(),10000);
    pane.dataset.state="loading";delete pane.dataset.errorCode;$("caseStatus").textContent="正在只读检索允许库…";
    try{if(active.from.kind!=="server")throw Error("offline");await work(active);}
    catch(error){if(active.token===generation)fail(error);}finally{clearTimeout(timer);}
  }
  function verifyMeta(m,q){
    const p=m?.month,n=/^[12]\d{3}-(0[1-9]|1[0-2])$/.test(p)?new Date(Number(p.slice(0,4)),Number(p.slice(5)),0).getDate():0;
    if(!m||!/^case-[A-Za-z0-9_-]{1,58}$/.test(m.case_id)||m.case_type!=="monthly_background"||!n||m.period_start!==p+"-01"||m.period_end!==p+"-"+String(n).padStart(2,"0")||m.period_end>=q.reference_date||!["source_result_id","source_projection_id","snapshot_sha256"].every(key=>id.test(m[key]))||m.evidence_kind!=="synthetic_example"||m.research_ready!==false||m.public_aggregate_allowed!==true||m.response_status!=="not_event_response"||!["longitude","latitude","radius_km"].every(key=>m[key]===q[key])||![m.similarities,m.differences].every(a=>Array.isArray(a)&&a.length<=6&&a.every(s=>typeof s==="string"&&s.length<=500)))throw Error("contract");
    return m;
  }
  function verifyPage(data,q,offset,old){
    if(data?.schema_version!=="ocean-known-case-search/v1"||data.library_id!==library||!id.test(data.library_version)||!id.test(data.search_id)||!id.test(data.page_id)||!same(data.request,q)||data.evidence_kind!=="synthetic_example"||data.research_ready!==false||data.exploration_only!==true||data.method_version!=="exact-known-circle-month-order/v1"||!["available","empty","unsupported_condition","partial"].includes(data.status)||!Number.isInteger(data.total)||data.total<0||data.total>16||data.offset!==offset||data.limit!==3||!Array.isArray(data.candidates)||data.candidates.length>3||data.candidates.length!==Math.min(3,Math.max(0,data.total-offset))||data.next_offset!==(offset+data.candidates.length<data.total?offset+data.candidates.length:null)||old&&(data.library_version!==old.data.library_version||data.search_id!==old.data.search_id||data.total!==old.data.total))throw Error("contract");
    data.candidates.forEach(m=>verifyMeta(m,q));
    const ids=[...(old?.items||[]),...data.candidates].map(m=>m.case_id);if(new Set(ids).size!==ids.length)throw Error("contract");
    return data;
  }
  function render(){
    OceanEvidence.close(false);pane.dataset.state="ready";delete pane.dataset.errorCode;pane.dataset.searchId=record.data.search_id;
    $("caseConditions").textContent=describe(record.request)+" · 合成A月背景";$("caseCandidates").replaceChildren();
    for(const m of record.items){const button=document.createElement("button");button.dataset.caseId=m.case_id;
      const title=document.createElement("strong");title.textContent="A月背景 · "+m.month;
      const note=document.createElement("small");note.textContent=m.similarities.join("、")+"；"+m.differences.join("。")+"。";
      button.append(title,note);button.onclick=()=>readCase(m,button);$("caseCandidates").append(button);}
    $("caseMore").hidden=record.data.next_offset===null;$("caseMore").disabled=false;
    $("caseStatus").textContent=record.data.status==="unsupported_condition"?"当前已知库不支持这个固定点/范围。":record.data.status==="partial"?"部分公开条目不可核对；已显示可读候选。":"已显示 "+record.items.length+" / "+record.data.total+" 个允许案例；只代表当前已知库。";
    const s=record.data.scope;$("caseScope").textContent="库 "+library+"；允许月范围 "+(s?.first_month||"未知")+" 至 "+(s?.last_month||"未知")+"。只取完整月结束早于参考日的背景。库身份 "+record.data.library_version;
    sync();
  }
  function search(more=false){
    const old=more?record:null;if(more&&(!old||old.invalid||old.data.next_offset===null))return;
    const q=more?old.request:current(),offset=more?old.data.next_offset:0;
    return perform(async active=>{
      if(old&&!sameSource(old.from,active.from))throw Error("source_changed");
      const params={...q,offset,limit:3};if(old)params.library_version=old.data.library_version;
      const data=verifyPage(await json(active.from.base+path+"?"+new URLSearchParams(params),active.signal),q,offset,old);
      if(!publishable(active))return;
      if(!old)clearDetail();
      record={request:freeze(structuredClone(q)),data:freeze(data),items:freeze([...(old?.items||[]),...data.candidates]),from:active.from,invalid:false};render();
    });
  }
  function verifyDetail(data,m,r){
    const o=data?.original,p=o?.parameters,metrics=o?.metrics;
    if(data?.schema_version!=="ocean-known-case-detail/v1"||data.library_id!==library||data.library_version!==r.data.library_version||data.search_id!==r.data.search_id||!id.test(data.detail_id)||!same(data.request,r.request)||data.read_only!==true||data.evidence_kind!=="synthetic_example"||data.research_ready!==false||data.case?.case_id!==m.case_id||data.case?.source_projection_id!==m.source_projection_id)throw Error("contract");
    verifyMeta(data.case,r.request);
    if(o?.schema_version!=="ocean-published-month/v1"||o.kind!=="monthly_spatial_example"||o.result_id!==m.source_result_id||o.projection_id!==m.source_projection_id||o.evidence_kind!=="synthetic_example"||o.research_ready!==false||o.public_aggregate_allowed!==true||!p||p.month!==m.month||!["longitude","latitude","radius_km"].every(key=>p[key]===m[key])||p.method_version!=="monthly-known-support/v1"||p.parameter_version!=="known-unit-membership/v1"||!o.source?.license?.startsWith("CC0-1.0")||o.intervals!==null||!metrics||!Array.isArray(o.daily)||o.daily.length!==Number(m.period_end.slice(-2))||metrics.calendar_days!==o.daily.length||!Number.isInteger(metrics.supported_days)||metrics.supported_days<0||metrics.supported_days>metrics.calendar_days||!Array.isArray(o.caveats)||o.caveats.some(s=>typeof s!=="string"||s.length>500))throw Error("contract");
    const units={total_hours:"fishing_hours",area_time_km2_days:"km2*d",mean_hours_per_supported_day:"fishing_hours/d",density_hours_per_km2_day:"fishing_hours/(km2*d)"};
    for(const [key,unit] of Object.entries(units))if(o.units?.[key]!==unit||metrics[key]!==null&&(!Number.isFinite(metrics[key])||metrics[key]<0))throw Error("contract");
    o.daily.forEach((day,n)=>{if(day.date!==m.month+"-"+String(n+1).padStart(2,"0")||!Object.hasOwn(states,day.state)||[day.hours,day.area_time_km2_days].some(v=>v!==null&&(!Number.isFinite(v)||v<0)))throw Error("contract");});
    return data;
  }
  function renderDetail(){
    const o=detail.data.original,m=o.metrics;OceanEvidence.close(false);
    evidence.innerHTML='<h3 id="caseDetailType">原A月背景（合成），不是B事件或响应</h3><p id="caseOriginalConditions"></p><div class="case-original-metrics"><span>H <b id="caseHours"></b> h</span><span>E <b id="caseAreaTime"></b> km²·d</span><span>H/E <b id="caseDensity"></b> h/(km²·d)</span></div><p id="caseSupported"></p><details><summary>原身份、方法与来源</summary><p id="caseSource" class="result-identity"></p></details><p>原结果未估计统计区间；缺资料不补零，A月背景不代表事件响应。</p><div class="monthly-table-wrap"><table id="caseDayTable"><thead><tr><th>日期</th><th>状态</th><th>小时 H</th><th>面积时间 E</th></tr></thead><tbody></tbody></table></div><p id="caseCaveats" class="result-note"></p><p>地图定位与短窗关联尚未接入；返回候选可继续浏览地图。</p>';
    evidence.dataset.caseId=detail.data.case.case_id;$("caseOriginalConditions").textContent=o.parameters.month+" · "+fmtCoord(o.parameters.longitude,o.parameters.latitude)+" · "+o.parameters.radius_km+" km";
    $("caseHours").textContent=m.total_hours??"未知";$("caseAreaTime").textContent=m.area_time_km2_days??"未知";$("caseDensity").textContent=m.density_hours_per_km2_day??"未知";$("caseSupported").textContent="有效 / 日历日："+m.supported_days+" / "+m.calendar_days;
    $("caseSource").textContent=o.result_id+" / "+o.projection_id+"；方法 "+o.parameters.method_version+" / "+o.parameters.parameter_version+"；来源 "+o.source.id+" / "+o.source.version+"；"+o.source.license;
    for(const day of o.daily){const tr=document.createElement("tr");for(const value of [day.date,states[day.state],day.hours??"未知",day.area_time_km2_days??"未知"]){const td=document.createElement("td");td.textContent=value;tr.append(td);}$("caseDayTable").tBodies[0].append(tr);}
    $("caseCaveats").textContent=o.caveats.join(" ");$("caseReopen").hidden=false;$("caseReopen").disabled=false;
  }
  function readCase(m,button){
    const r=record;if(!r||r.invalid)return;
    return perform(async active=>{
      if(!sameSource(r.from,active.from))throw Error("source_changed");
      const params={...r.request,library_version:r.data.library_version};
      const data=verifyDetail(await json(active.from.base+path+"/"+encodeURIComponent(m.case_id)+"?"+new URLSearchParams(params),active.signal),m,r);
      if(!publishable(active)||record!==r)return;
      detail={data:freeze(data),request:r.request};renderDetail();pane.dataset.state="ready";$("caseStatus").textContent="已读取原A证据，条件保持原检索。";OceanEvidence.open("known-case",button);
    });
  }
  OceanHistoryViews.register("cases",{label:"案例",element:pane,onOpen(){window.dispatchEvent(new Event("ocean-control-open"));OceanWorkbench.closeFloatingControls();if(!record)search();else sync();}});
  OceanEvidence.register("known-case",{content:evidence,button:$("caseReopen"),view:()=>detail?{title:"历史案例原证据",identity:describe(detail.request)+" / "+detail.data.case.case_id+" / "+detail.data.original.result_id.slice(0,22)+"…",stale:stale()}:null});
  $("knownCaseOpen").onclick=()=>OceanHistoryViews.open("cases");$("caseSearch").onclick=()=>search();$("caseMore").onclick=()=>search(true);
  window.addEventListener("ocean-applied-context",sync);window.addEventListener("ocean-load-state",sync);
  window.addEventListener("ocean-month-draft",e=>{taskDraft=e.detail;sync();});
  window.addEventListener("ocean-history-view",e=>{if(e.detail!=="cases")cancel();});
  $("tabs").addEventListener("click",e=>{if(e.target.closest("[data-pane]")?.dataset.pane!=="clim")cancel();});
})();
