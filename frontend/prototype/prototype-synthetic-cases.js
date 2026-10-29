/* Single configured owner; only CC0 synthetic report snapshots, never an offline save. */
(function(){
  const {source,sameSource,json}=OceanPublicRead;
  const pane=document.createElement("section");pane.id="caseArchive";pane.className="card";pane.dataset.state="locked";
  pane.innerHTML='<h3>我的合成案例</h3><p class="result-note">仅保存已核验的 CC0 合成报告。离开此区即清除本页访问令牌和未保存草稿；未完成真实研究或 TASK 保护联动。</p><label>本人访问令牌<input id="caseOwnerToken" type="password" autocomplete="off" spellcheck="false"></label><div class="monthly-actions"><button id="caseLoad">读取我的案例</button><button id="caseLock">锁定并清空草稿</button></div><p id="caseStatus" role="status"></p><details id="caseCreateFields"><summary>保存当前预览报告</summary><p id="caseCandidate" class="result-note"></p><label>标题<input id="caseCreateTitle" maxlength="120"></label><label>标签（以逗号分隔）<input id="caseCreateTags" maxlength="328"></label><label>人工笔记<textarea id="caseCreateNote" maxlength="4000" rows="3"></textarea></label><button id="caseSave" disabled>将这份报告存为新案例</button></details><div id="caseItems" class="case-candidates"></div><div id="caseOriginal"></div>';
  const shortcut=document.createElement("button");shortcut.id="caseArchiveOpen";shortcut.textContent="▣　我的合成案例";$("monthlyDraftOpen").after(shortcut);
  let candidate=null,selected=null,sessionSource=null,generation=0,controller=null,busy=false,intent=null;
  const id=/^[0-9a-f]{32}$/,hash=/^sha256:[0-9a-f]{64}$/;
  function node(parent,tag,value){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
  function describe(r){const p=r.parameters;return `${p.month} · ${fmtCoord(p.longitude,p.latitude)} · ${p.radius_km} km`;}
  function updateSave(){
    const from=source();
    $("caseOwnerToken").disabled=from.kind!=="server";
    $("caseSave").disabled=busy||!candidate||from.kind!=="server"||!sameSource(candidate.from,from)||!$("caseOwnerToken").value;
    $("caseLoad").disabled=busy||from.kind!=="server"||!$("caseOwnerToken").value;
  }
  function clearPrivate(clearToken=true){
    generation++;controller?.abort();busy=false;selected=null;intent=null;sessionSource=null;
    if(clearToken)$("caseOwnerToken").value="";
    $("caseItems").replaceChildren();$("caseOriginal").replaceChildren();
    $("caseCreateTitle").value=candidate?"合成月报告 "+candidate.report.result.parameters.month:"";
    $("caseCreateTags").value="";$("caseCreateNote").value="";
    delete pane.dataset.caseId;delete pane.dataset.version;pane.dataset.state="locked";updateSave();
  }
  function verify(value){
    const r=value?.report?.result;
    if(value?.schema_version!=="ocean-synthetic-case-version/v1"||!id.test(value.case_id)||!hash.test(value.version_id)||!Number.isInteger(value.version)||value.version<1||value.version>16||!hash.test(value.report?.report_id)||r?.evidence_kind!=="synthetic_example"||r.research_ready!==false||r.public_aggregate_allowed!==true||!r.source?.license.startsWith("CC0-1.0")||typeof value.metadata?.title!=="string"||typeof value.metadata.note!=="string"||!Array.isArray(value.metadata.tags))throw Error("contract");
    return value;
  }
  async function api(suffix,options={}){
    const from=source(),token=$("caseOwnerToken").value;
    if(from.kind!=="server")throw Error("offline");
    if(!token)throw Error("owner_required");
    if(sessionSource&&!sameSource(sessionSource,from))throw Error("source_changed");
    sessionSource=from;
    return json(from.base+"/query/monthly-analysis/cases"+suffix,controller.signal,{...options,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}});
  }
  async function perform(work,state){
    if(busy)return;
    controller?.abort();controller=new AbortController();const active=controller,n=++generation,timer=setTimeout(()=>active.abort(),10000),opener=document.activeElement;
    busy=true;updateSave();$("caseStatus").textContent="正在核对本人权限与案例记录…";
    try{await work(n);if(n!==generation)return;pane.dataset.state=state;}
    catch(error){if(n!==generation)return;
      if(["http_401","http_403","source_changed"].includes(error.message))clearPrivate();
      else pane.dataset.state="error";
      const messages={http_401:"本人访问未通过，令牌已清除。",http_403:"当前服务不允许案例操作。",http_503:"案例库或本人访问尚未启用，或存储暂不可用。",http_409:"保存意图或报告版本冲突，当前草稿未覆盖。",http_422:"标题、标签或笔记不符合保存限制，请修改后重试。",offline:"离线页面不能读取或保存本人案例。",owner_required:"请输入当前服务配置的本人令牌。",contract:"案例内容无法核实，未显示为成功。",source_changed:"服务来源已改变，请重新输入令牌。"};
      $("caseStatus").textContent=messages[error.message]||"请求未完成；可重试同一保存意图，或读取案例核对。";
    }finally{clearTimeout(timer);if(n===generation){busy=false;updateSave();if(document.activeElement===document.body&&pane.contains(opener)&&!opener.disabled&&!pane.hidden)opener.focus({preventScroll:true});}}
  }
  function show(value){
    selected=verify(value);const root=$("caseOriginal"),r=value.report.result,m=r.metrics;root.replaceChildren();
    pane.dataset.caseId=value.case_id;pane.dataset.version=String(value.version);
    node(root,"h4",value.metadata.title+" · 版本 "+value.version);
    node(root,"p","人工笔记（与确定性证据分开）："+value.metadata.note);
    node(root,"p","标签："+value.metadata.tags.join("、"));
    node(root,"p",describe(r));node(root,"p",`原快照 H=${m.total_hours??"未知"} h；E=${m.area_time_km2_days??"未知"} km²·d；有效日 ${m.supported_days}/${m.calendar_days}。`);
    node(root,"p",value.report.interpretation.boundary);
    node(root,"p","仅证明保存时核验的合成快照；当前源未重查，不代表仍可用或能够原样复算。 "+value.created_at);
    const details=node(root,"details","" );node(details,"summary","冻结逐日证据及身份");
    node(details,"p",value.case_id+" / "+value.version_id+" / "+value.report.report_id);
    const wrap=node(details,"div","");wrap.className="monthly-chart-wrap";const chart=node(wrap,"div","");chart.className="monthly-chart";chart.setAttribute("role","img");
    const tableWrap=node(details,"div","");tableWrap.className="monthly-table-wrap";const table=node(tableWrap,"table","");
    const head=table.createTHead().insertRow();for(const label of ["日期","状态","小时(h)","有效面积(km²)"])node(head,"th",label);table.createTBody();
    node(details,"p",OceanMonthEvidence.render(chart,table,r.daily));
    for(const line of [r.source.id+" / "+r.source.version+" / "+r.source.license,...r.caveats])node(details,"p",line);
  }
  function catalog(data){
    if(data?.schema_version!=="ocean-synthetic-case-catalog/v1"||!Array.isArray(data.cases)||data.cases.length>64)throw Error("contract");
    $("caseItems").replaceChildren();
    for(const item of data.cases){if(!id.test(item.case_id)||typeof item.metadata?.title!=="string")throw Error("contract");const button=node($("caseItems"),"button",item.metadata.title+" · v"+item.version);button.onclick=()=>perform(async n=>{const value=await api("/"+item.case_id);if(n!==generation)return;show(value);$("caseStatus").textContent="已重开持久保存的合成快照。";},"opened");}
    if(!data.cases.length)node($("caseItems"),"p","当前没有已保存案例。");
  }
  function open(){OceanHistoryViews.open("private-cases");}
  OceanHistoryViews.register("private-cases",{label:"我的案例",element:pane,onOpen(){
    $("caseStatus").textContent=source().kind==="server"?"请输入当前服务配置的本人令牌；保存仅限已核验的合成报告。":"离线页面不能读取或保存本人案例。";updateSave();
  }});
  shortcut.onclick=open;
  $("caseOwnerToken").addEventListener("input",()=>{clearPrivate(false);if($("caseOwnerToken").value)sessionSource=source();});
  $("caseLoad").onclick=()=>perform(async n=>{const data=await api("");if(n!==generation)return;catalog(data);$("caseStatus").textContent="已读取本人案例。";},"listed");
  $("caseLock").onclick=()=>{clearPrivate();$("caseStatus").textContent="已清除本页令牌与未保存草稿，持久案例保留。";};
  $("caseSave").onclick=()=>perform(async n=>{
    if(!candidate||!sameSource(candidate.from,source()))throw Error("source_changed");
    const r=candidate.report,fields={result_id:r.result.result_id,projection_id:r.result.projection_id,report_id:r.report_id,title:$("caseCreateTitle").value,tags:$("caseCreateTags").value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),note:$("caseCreateNote").value};
    const signature=JSON.stringify(fields);if(intent?.signature!==signature)intent={signature,id:crypto.randomUUID().replaceAll("-","")};
    const value=await api("",{method:"POST",body:JSON.stringify({...fields,intent_id:intent.id})});if(n!==generation)return;
    show(value);const data=await api("");if(n!==generation)return;catalog(data);$("caseStatus").textContent="案例已持久保存；科学内容仍为合成样例。";
  },"saved");
  window.addEventListener("ocean-month-report",e=>{
    candidate=e.detail?structuredClone(e.detail):null;
    $("caseCandidate").textContent=candidate?"当前报告："+describe(candidate.report.result):"请先打开一份允许公开的合成报告。";
    if(candidate){$("caseCreateTitle").value="合成月报告 "+candidate.report.result.parameters.month;const action=document.createElement("button");action.id="reportSaveCase";action.textContent="保存合成案例";action.onclick=()=>{open();$("caseCreateFields").open=true;};$("monthReport").querySelector(".monthly-actions").append(action);}
    intent=null;updateSave();
  });
  window.addEventListener("ocean-history-view",e=>{if(e.detail!=="private-cases")clearPrivate();});
  window.addEventListener("ocean-load-state",()=>{if((sessionSource&&!sameSource(sessionSource,source()))||(source().kind!=="server"&&$("caseOwnerToken").value)){clearPrivate();$("caseStatus").textContent="服务来源已改变，已清除本页令牌；离线不能读取或保存本人案例。";}updateSave();});
  window.addEventListener("ocean-workbench-task",clearPrivate);
  $("tabs").addEventListener("click",e=>{if(e.target.closest("[data-pane]")?.dataset.pane!=="clim")clearPrivate();});
  window.addEventListener("ocean-result-closed",clearPrivate);
  pane.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();clearPrivate();$("resultClose").click();$("workbenchToggle").focus();}});
  updateSave();
})();
