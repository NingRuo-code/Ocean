/* A pending request is separate from applied map conditions and frozen results. */
(function () {
  const panel = document.createElement("section");
  panel.id = "monthDraftPanel";panel.className = "filter-panel month-draft-panel";panel.hidden = true;
  panel.setAttribute("aria-label", "月任务条件");
  panel.innerHTML = `<div class="panel-head"><div><small>// MONTH REQUEST</small><h2>月任务条件</h2></div><button id="monthDraftClose" aria-label="收起月任务条件">×</button></div>
    <p id="monthDraftApplied"></p><p id="monthDraftCoordinateNote"></p>
    <div class="month-draft-fields">
      <label>完整年月<input id="monthDraftMonth" type="month" required aria-describedby="monthDraftMonthError"><small id="monthDraftMonthError" class="field-error"></small></label>
      <label>公里范围<select id="monthDraftRadius" aria-describedby="monthDraftRadiusError"><option value="10">10 km</option><option value="20">20 km</option><option value="30">30 km</option></select><small id="monthDraftRadiusError" class="field-error"></small></label>
      <label>固定点经度<input id="monthDraftLongitude" type="number" min="-180" max="180" step="any" required aria-describedby="monthDraftLongitudeError"><small id="monthDraftLongitudeError" class="field-error"></small></label>
      <label>固定点纬度<input id="monthDraftLatitude" type="number" min="-90" max="90" step="any" required aria-describedby="monthDraftLatitudeError"><small id="monthDraftLatitudeError" class="field-error"></small></label>
    </div>
    <p id="monthDraftDirty" role="status"></p>
    <div class="month-draft-actions"><button id="monthDraftSync">使用已应用筛选</button><button id="monthDraftCheck">检查可用性</button></div>
    <p id="monthDraftStatus" role="status">尚未提交；请先检查可用性。</p><div id="monthDraftMatches"></div>
    <details><summary>主方案与缺项</summary><p>仅主方案；实际输入、方法、参数及资格版本待正式交接，尚不开放变体。</p><p id="monthDraftQualification">真实整月资格待接入，不能据日资料或合成样例认定合格。</p><p id="monthDraftCheckIdentity"></p></details>
    <button id="monthDraftSubmit" disabled>提交分析（待接入）</button>`;
  document.querySelector(".main").append(panel);
  const fields = {month:$("monthDraftMonth"),longitude:$("monthDraftLongitude"),latitude:$("monthDraftLatitude"),radius_km:$("monthDraftRadius")};
  const {source,sameSource,json} = OceanPublicRead;
  const idPattern = /^sha256:[0-9a-f]{64}$/;
  const keys = Object.keys(fields);
  let initialized = false, generation = 0, controller = null, checkedSource = null, appliedAtInit = null;
  const applied = () => ({month:state.date.slice(0,7),longitude:state.lon,latitude:state.lat,radius_km:state.range,scheme:"monthly-main"});
  const same = (a,b) => !!a && !!b && [...keys,"scheme"].every(key=>a[key]===b[key]);
  function validate() {
    const values = {scheme:"monthly-main"};let valid = true;
    for(const [key,input] of Object.entries(fields)) {
      const raw=input.value.trim(),value=key==="month"?raw:Number(raw);
      const good=key==="month" ? /^[12]\d{3}-(0[1-9]|1[0-2])$/.test(raw) : !!raw && Number.isFinite(value) && (key==="radius_km" ? [10,20,30].includes(value) : Math.abs(value)<=(key==="longitude"?180:90));
      input.setAttribute("aria-invalid",String(!good));
      $(input.id+"Error").textContent=good?"":{month:"请选择1000–2999年的完整年月。",longitude:"经度需为−180至180。",latitude:"纬度需为−90至90。",radius_km:"仅支持10、20或30 km。"}[key];
      values[key]=value;valid=valid&&good;
    }
    $("monthDraftCheck").disabled=!valid;
    return valid?values:null;
  }
  function describe(p) { return p.month+" · "+fmtCoord(p.longitude,p.latitude)+" · "+p.radius_km+" km"; }
  function syncApplied() {
    if(!initialized)return;
    const current=applied(),draft=validate(),raw=$("locInput").value.trim(),pair=parseCoord(raw);
    $("monthDraftApplied").textContent="已应用筛选："+describe(current)+"（所属完整年月）";
    $("monthDraftCoordinateNote").textContent=raw!==fmtCoord(state.lon,state.lat) && (!pair || pair[0]!==state.lon || pair[1]!==state.lat) ? "坐标输入尚未应用；草稿不会采用这段输入。" : "视窗中心与查点不替换分析固定点。";
    $("monthDraftDirty").textContent=!same(current,appliedAtInit) ? "已应用筛选已改变；草稿仍保留原条件，可主动同步。" : !same(current,draft) ? "任务草稿与已应用筛选不同；地图保持原条件。" : "";
  }
  function announce() {
    const draft=validate();syncApplied();
    window.dispatchEvent(new CustomEvent("ocean-month-draft",{detail:draft || {month:fields.month.value,longitude:null,latitude:null,radius_km:null}}));
    return draft;
  }
  function invalidate() {
    generation++;controller?.abort();checkedSource=null;
    panel.dataset.state="draft";delete panel.dataset.errorCode;delete panel.dataset.requestId;delete panel.dataset.capabilityId;
    $("monthDraftMatches").replaceChildren();$("monthDraftCheckIdentity").textContent="";
    $("monthDraftStatus").textContent=announce()?"条件尚未核对；尚未提交。":"缺少有效条件，请修正标注项。";
  }
  function initialize() {
    const current=applied();
    for(const key of keys)fields[key].value=current[key];
    initialized=true;appliedAtInit=current;invalidate();
  }
  function close(restore=true) {
    const focus=restore&&panel.contains(document.activeElement);panel.hidden=true;
    $("monthlyDraftOpen").setAttribute("aria-expanded","false");
    if(focus)$("monthlyDraftOpen").focus({preventScroll:true});
  }
  function open() {
    if(!panel.hidden){close();return;}
    window.dispatchEvent(new Event("ocean-control-open"));OceanWorkbench.closeFloatingControls();
    if(!initialized)initialize();else syncApplied();
    panel.hidden=false;$("monthlyDraftOpen").setAttribute("aria-expanded","true");fields.month.focus({preventScroll:true});
  }
  function references(results,request) {
    if(!Array.isArray(results)||results.length>16||new Set(results.map(item=>item?.result_id)).size!==results.length)throw Error("contract");
    return results.map(item=>{
      if(!idPattern.test(item.result_id)||!idPattern.test(item.projection_id)||item.public_aggregate_allowed!==true||item.evidence_kind!=="synthetic_example"||item.research_ready!==false||!item.parameters||!keys.every(key=>item.parameters[key]===request[key])||item.parameters.method_version!=="monthly-known-support/v1"||item.parameters.parameter_version!=="known-unit-membership/v1"||typeof item.source?.license!=="string"||!item.source.license.startsWith("CC0-1.0"))throw Error("contract");
      return item;
    });
  }
  async function check() {
    const request=announce();if(!request)return;
    generation++;controller?.abort();controller=new AbortController();
    const active=controller,token=generation,from=source(),timer=setTimeout(()=>active.abort(),10000);
    checkedSource=from;panel.dataset.state="checking";delete panel.dataset.errorCode;$("monthDraftMatches").replaceChildren();
    delete panel.dataset.requestId;delete panel.dataset.capabilityId;$("monthDraftCheckIdentity").textContent="";
    $("monthDraftStatus").textContent="正在核对登记成果；不会提交分析…";
    try {
      let matches,identity;
      if(from.kind==="offline") {
        const local=window.OceanPublishedMonths;
        if(local?.schema_version!=="ocean-offline-published-months/v1"||local.public_aggregate_allowed!==true||!Array.isArray(local.results)||local.results.length>16)throw Error("contract");
        matches=references(local.results.filter(item=>item.parameters&&keys.every(key=>item.parameters[key]===request[key])),request);
        identity="离线文件核对 · "+new Date().toISOString()+"；未核在线资格。";
      }else{
        const data=await json(from.base+"/query/monthly-analysis/capability?"+new URLSearchParams(request),active.signal);
        if(data.schema_version!=="ocean-month-capability/v1"||!same(data.request,request)||!idPattern.test(data.request_id)||!idPattern.test(data.capability_id)||!Number.isFinite(Date.parse(data.checked_at))||data.qualification?.status!=="not_handed_off"||data.execution?.status!=="not_implemented"||data.execution.can_submit!==false||data.execution.permission!=="not_checked"||!["input","method","parameter","qualification"].every(key=>data.versions?.[key]===null))throw Error("contract");
        matches=references(data.saved_results,request);identity="核实："+data.checked_at+" / "+data.request_id+" / "+data.capability_id;
        if(token===generation){panel.dataset.requestId=data.request_id;panel.dataset.capabilityId=data.capability_id;}
      }
      if(token!==generation)return;
      if(!sameSource(from,source()))throw Error("source_changed");
      panel.dataset.state="checked";$("monthDraftCheckIdentity").textContent=identity;
      $("monthDraftStatus").textContent=(from.kind==="offline"?"离线：":"已核对：")+(matches.length?"有可查看的合成成果。":"没有匹配的公开成果。")+" 在线任务能力待接入，当前不能提交。";
      for(const item of matches){const button=document.createElement("button");button.textContent="查看匹配成果 · 合成样例";button.onclick=()=>{close(false);OceanMonthlyReader.openSavedResult(item.result_id);};$("monthDraftMatches").append(button);}
    }catch(error){
      if(token!==generation)return;
      panel.dataset.state="error";delete panel.dataset.requestId;delete panel.dataset.capabilityId;
      const messages={http_401:"无权读取此次能力信息。",http_403:"无权读取此次能力信息。",http_404:"服务尚未提供月任务能力检查。",http_503:"登记成果暂不可读；资格未核实。",contract:"能力身份或版本无法核实。",source_changed:"读取来源已改变，请重新检查。"};
      $("monthDraftStatus").textContent=(messages[error.message]||"服务检查失败，请重试。")+" 尚未提交；原结果和其他图层保留。";
      panel.dataset.errorCode=/^http_\d+$/.test(error.message)||["contract","source_changed"].includes(error.message)?error.message:"read_failed";
    }finally{clearTimeout(timer);}
  }
  for(const input of Object.values(fields))input.addEventListener("input",invalidate);
  $("monthDraftSync").onclick=initialize;$("monthDraftCheck").onclick=check;
  $("monthlyDraftOpen").onclick=open;$("monthDraftClose").onclick=()=>close();
  panel.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}});
  window.addEventListener("ocean-control-open",()=>close(false));
  window.addEventListener("ocean-map-activate",()=>close(false));
  window.addEventListener("ocean-evidence-open",()=>close(false));
  window.addEventListener("ocean-applied-context",syncApplied);
  window.addEventListener("ocean-load-state",()=>{if(checkedSource&&!sameSource(checkedSource,source())){invalidate();$("monthDraftStatus").textContent="读取来源已改变，请重新检查。";}});
})();
