/* Single configured owner; only CC0 synthetic report snapshots, never an offline save. */
(function(){
  const {source,sameSource,json}=OceanPublicRead;
  const pane=document.createElement("section");pane.id="caseArchive";pane.className="card";pane.dataset.state="locked";
  pane.innerHTML='<h3>我的合成案例</h3><p class="result-note">仅保存已核验的 CC0 合成报告。离开此区即清除本页访问令牌和未保存草稿。保存后保护该版本的报告及图表、地图依据。</p><label>本人访问令牌<input id="caseOwnerToken" type="password" autocomplete="off" spellcheck="false"></label><div class="monthly-actions"><button id="caseLoad">读取我的案例</button><button id="caseLock">锁定并清空草稿</button></div><p id="caseArchiveStatus" role="status"></p><details id="caseCreateFields"><summary>保存当前预览报告</summary><p id="caseCandidate" class="result-note"></p><label>标题<input id="caseCreateTitle" maxlength="120"></label><label>标签（每行一项，最多8项）<textarea id="caseCreateTags" maxlength="648" rows="2"></textarea></label><label>人工笔记<textarea id="caseCreateNote" maxlength="4000" rows="3"></textarea></label><button id="caseSave" disabled>将这份报告存为新案例</button></details><div id="caseItems" class="case-candidates"></div><div id="caseOriginal"></div>';
  const shortcut=document.createElement("button");shortcut.id="caseArchiveOpen";shortcut.textContent="▣　我的合成案例";$("monthlyDraftOpen").after(shortcut);
  const search=document.createElement("div");
  search.innerHTML='<label>按标题或标签检索<input id="caseCatalogQuery" maxlength="120"></label>'+
    '<label>案例类型<select id="caseCatalogKind"><option value="">全部</option><option value="monthly_spatial_example">合成月报告</option></select></label>'+
    '<label>保存日期起（UTC）<input id="caseCatalogStart" type="date"></label>'+
    '<label>保存日期止（UTC）<input id="caseCatalogEnd" type="date"></label>'+
    '<div class="monthly-actions"><button id="caseCatalogPrevious">上一页</button><button id="caseCatalogNext">下一页</button></div>';
  pane.insertBefore(search,pane.querySelector("#caseItems"));
  let candidate=null,selected=null,sessionSource=null,generation=0,controller=null,busy=false,intent=null,editIntent=null,casePage=null;
  const catalogFields=["caseCatalogQuery","caseCatalogKind","caseCatalogStart","caseCatalogEnd"];
  const chapterNames={summary:"汇总",daily:"逐日证据",limits:"条件与局限"};
  const defaultSections=Object.keys(chapterNames);
  const downloads=new Set();
  const id=/^[0-9a-f]{32}$/,hash=/^sha256:[0-9a-f]{64}$/;
  function node(parent,tag,value){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
  function describe(r){const p=r.parameters;return `${p.month} · ${fmtCoord(p.longitude,p.latitude)} · ${p.radius_km} km`;}
  function metadata(prefix){return{title:$(prefix+"Title").value.trim(),tags:[...new Set($(prefix+"Tags").value.split(/\r?\n/).map(t=>t.trim()).filter(Boolean))],note:$(prefix+"Note").value};}
  function updateSave(){
    const from=source();
    $("caseOwnerToken").disabled=from.kind!=="server";
    $("caseSave").disabled=busy||!candidate||from.kind!=="server"||!sameSource(candidate.from,from)||!$("caseOwnerToken").value;
    $("caseLoad").disabled=busy||from.kind!=="server"||!$("caseOwnerToken").value;
    const readDisabled=$("caseLoad").disabled;
    for(const field of catalogFields)$(field).disabled=readDisabled;
    $("caseCatalogPrevious").disabled=readDisabled||!casePage?.offset;
    $("caseCatalogNext").disabled=readDisabled||casePage?.next_offset==null;
    if($("caseEditSave")){
      const disabled=busy||from.kind!=="server"||!$("caseOwnerToken").value;
      const sections=editedSections();
      const sameSections=String(sections)===String(selected.sections??defaultSections);
      $("caseEditSave").disabled=disabled||!sections.length||
        (JSON.stringify(metadata("caseEdit"))===JSON.stringify(selected.metadata)&&sameSections&&!$("caseEditRebind")?.checked);
      for(const key of ["caseEditTitle","caseEditTags","caseEditNote","caseVersion","caseLatest"])$(key).disabled=disabled;
      for(const field of $("caseEditFields").querySelectorAll('input[type=checkbox]'))field.disabled=disabled;
      for(const key of ["caseExportMarkdown","caseExportCsv","caseExportBundle","caseExportChart","caseCheckBundle"])$(key).disabled=disabled;
      $("caseExportAggregate").disabled=disabled||!selected.protected_dependencies;
    }
  }
  function editedSections(){
    return [...$("caseEditFields").querySelectorAll('input[name=caseSection]:checked')].map(input=>input.value);
  }
  function clearPrivate(clearToken=true){
    generation++;controller?.abort();busy=false;selected=null;intent=null;editIntent=null;sessionSource=null;
    for(const url of downloads)URL.revokeObjectURL(url);downloads.clear();
    if(clearToken)$("caseOwnerToken").value="";
    $("caseItems").replaceChildren();$("caseOriginal").replaceChildren();
    $("caseCreateTitle").value=candidate?"合成月报告 "+candidate.report.result.parameters.month:"";
    $("caseCreateTags").value="";$("caseCreateNote").value="";
    for(const field of catalogFields)$(field).value="";
    casePage=null;
    delete pane.dataset.caseId;delete pane.dataset.version;delete pane.dataset.reportId;pane.dataset.state="locked";updateSave();
  }
  function verify(value,requireProtection=false){
    const r=value?.report?.result;
    if(value?.schema_version!=="ocean-synthetic-case-version/v1"||!id.test(value.case_id)||!hash.test(value.version_id)||!Number.isInteger(value.version)||value.version<1||value.version>16||!hash.test(value.report?.report_id)||r?.evidence_kind!=="synthetic_example"||r.research_ready!==false||r.public_aggregate_allowed!==true||r.source?.license.split(";")[0].trim()!=="CC0-1.0"||typeof value.metadata?.title!=="string"||typeof value.metadata.note!=="string"||!Array.isArray(value.metadata.tags))throw Error("contract");
    const sections=value.sections;
    if(sections!==undefined&&(!Array.isArray(sections)||!sections.length||
        String(sections)!==String(defaultSections.filter(section=>sections.includes(section)))))throw Error("contract");
    const dependencies=value.protected_dependencies;
    if((requireProtection||dependencies!==undefined)&&(!dependencies||Object.keys(dependencies).length!==5||
        dependencies.result!==r.result_id||dependencies.projection!==r.projection_id||
        dependencies.report!==value.report.report_id||!hash.test(dependencies.chart_basis)||!hash.test(dependencies.map_basis)))
      throw Error("contract");
    return value;
  }
  async function api(suffix,options={},reader=json){
    const from=source(),token=$("caseOwnerToken").value;
    if(from.kind!=="server")throw Error("offline");
    if(!token)throw Error("owner_required");
    if(sessionSource&&!sameSource(sessionSource,from))throw Error("source_changed");
    sessionSource=from;
    return reader(from.base+"/query/monthly-analysis/cases"+suffix,controller.signal,{...options,redirect:"error",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}});
  }
  async function perform(work,state){
    if(busy)return;
    controller?.abort();controller=new AbortController();const active=controller,n=++generation,timer=setTimeout(()=>active.abort(),10000),opener=document.activeElement;
    busy=true;updateSave();const parkedFocus=pane.contains(opener)&&opener.disabled;
    if(parkedFocus)$("caseLock").focus({preventScroll:true});
    $("caseArchiveStatus").textContent="正在核对本人权限与案例记录…";
    try{await work(n);if(n!==generation)return;if(active.signal.aborted)throw Error("cancelled");pane.dataset.state=state;}
    catch(error){if(n!==generation)return;
      if(["http_401","http_403","source_changed"].includes(error.message))clearPrivate();
      else pane.dataset.state="error";
      const messages={bundle_mismatch:"成果包与所读版本不一致，未确认；请检查文件或阅读版本。未保存草稿保留。",bundle_file:"文件为空或无法读取，未完成核对；未保存草稿保留。",bundle_budget:"文件超过1MiB，未完成核对；未保存草稿保留。",chart_render_failed:"图像未生成；请重试，未保存草稿保留。",http_401:"本人访问未通过，令牌已清除；未保存草稿已清除。",http_403:"当前服务不允许案例操作；令牌与未保存草稿已清除。",http_503:"案例库或保护存储暂不可用。本次保存或读取暂不可核实，未保存草稿保留。",http_409:"存在版本或意图冲突，或已达64案例/16版本上限；草稿未覆盖，可读取最新版核对。",catalog_changed:"目录已有变化。请重新读取第一页。",http_422:"标题、标签或笔记不符合保存限制，请修改后重试。",offline:"离线页面不能读取或保存本人案例。",owner_required:"请输入当前服务配置的本人令牌。",contract:"案例内容无法核实，未显示为成功。",source_changed:"服务来源已改变，请重新输入令牌。"};
      messages.cancelled="请求已取消或超时，未完成本次操作；可重试，未保存草稿保留。";
      if(error.message==="case_version_conflict"){
        $("caseArchiveStatus").textContent="草稿基于版本 "+error.baseVersion+"，当前已保存版本 "+error.currentVersion+"。草稿仍保留，可读取最新版核对。";
      }else $("caseArchiveStatus").textContent=messages[error.message]||(active.signal.aborted?messages.cancelled:"请求未完成；可重试同一保存意图，或读取案例核对。");
    }finally{clearTimeout(timer);if(n===generation){busy=false;updateSave();if((document.activeElement===document.body||(parkedFocus&&document.activeElement===$("caseLock")))&&!pane.hidden){const target=pane.contains(opener)&&!opener.disabled?opener:$("caseVersion");target?.focus({preventScroll:true});}}}
  }
  function show(value){
    selected=verify(value);const root=$("caseOriginal"),r=value.report.result,m=r.metrics;root.replaceChildren();
    pane.dataset.caseId=value.case_id;pane.dataset.version=String(value.version);pane.dataset.reportId=value.report.report_id;
    node(root,"h4",value.metadata.title+" · 版本 "+value.version);
    node(root,"p","本人笔记 · "+value.created_at+" · "+value.metadata.note);
    node(root,"p","标签："+value.metadata.tags.join("、"));
    const sections=value.sections??defaultSections;
    node(root,"p",describe(r));
    if(sections.includes("summary"))node(root,"p",`原快照 H=${m.total_hours??"未知"} h；E=${m.area_time_km2_days??"未知"} km²·d；有效日 ${m.supported_days}/${m.calendar_days}。`);
    node(root,"p",value.report.interpretation.boundary);
    if(sections.includes("limits"))node(root,"p",value.report.interpretation.relationship);
    node(root,"p",value.protected_dependencies?"报告、结果和图表、地图依据已持久保护。":"此旧版本的保护状态待核。");
    const publishedStates={
      missing:"原公开快照目录缺失。",projection_missing:"当前目录无法提供原公开快照。",
      projection_changed:"当前目录中的公开快照已有变化。",present_verified:"原公开快照仍可取得。",
    };
    const sourceStatus=publishedStates[value.current_published_snapshot]??"";
    node(root,"p",sourceStatus+"当前来源的新鲜度和原版复算条件待核。保存时间 "+value.created_at);
    const exports=node(root,"div","");exports.className="monthly-actions";
    for(const [format,label,key] of [["markdown","下载Markdown报告","caseExportMarkdown"],["csv","下载逐日CSV","caseExportCsv"],["aggregate-csv","下载聚合CSV","caseExportAggregate"],["bundle","下载带清单成果包","caseExportBundle"],["chart","下载逐日证据图PNG","caseExportChart"]]){
      const action=node(exports,"button",label);action.id=key;action.onclick=()=>download(format);
    }
    node(root,"p","报告、逐日表和成果包包含所读已保存版本的人工笔记；PNG仅含冻结科学证据。均不包含未保存草稿或当前地图，也不会自动公开。");
    const checking=node(root,"details","");checking.id="caseBundleCheckFields";node(checking,"summary","核对本地成果包");
    node(checking,"p","选择已下载的三成员ZIP（最多1MiB）。只在本地读取文件，不上传文件、文件名或路径；需联网重新核对本人及所读版本。重新压缩的包不视为完全一致，可重新选择同一文件重试。");
    const fileLabel=node(checking,"label","选择成果包并核对"),fileInput=node(fileLabel,"input","");fileInput.id="caseCheckBundle";fileInput.type="file";fileInput.accept=".zip,application/zip";
    fileInput.onchange=()=>{const file=fileInput.files?.[0];fileInput.value="";if(file&&selected===value)checkBundle(file,value);};
    const checkStatus=node(checking,"p","未核对文件。");checkStatus.id="caseBundleCheckStatus";
    fileInput.oncancel=()=>{if(!busy&&selected===value){pane.dataset.state="bundle-unchecked";checkStatus.textContent=$("caseArchiveStatus").textContent="已取消选择，未执行核对；未保存草稿保留。";}};
    const versions=node(root,"label","阅读版本（切换会替换未保存草稿）"),select=node(versions,"select","");select.id="caseVersion";
    const option=node(select,"option","版本 "+value.version);option.value=String(value.version);
    select.onchange=()=>readCase(value.case_id,Number(select.value));
    const latest=node(root,"button","读取最新版");latest.id="caseLatest";latest.onclick=()=>readCase(value.case_id);
    const editor=node(root,"details","");editor.id="caseEditFields";node(editor,"summary","编辑人工信息（形成新版本）");
    for(const [key,label,kind,max] of [["Title","标题","input",120],["Tags","标签（每行一项，最多8项）","textarea",648],["Note","人工笔记","textarea",4000]]){
      const holder=node(editor,"label",label),field=node(holder,kind,"");field.id="caseEdit"+key;field.maxLength=max;
      field.value=key==="Title"?value.metadata.title:key==="Tags"?value.metadata.tags.join("\n"):value.metadata.note;field.addEventListener("input",updateSave);
    }
    const chapters=node(editor,"fieldset","");
    node(chapters,"legend","所选章节");
    for(const [section,name] of Object.entries(chapterNames)){
      const label=node(chapters,"label","");label.className="case-selection";
      const checkbox=node(label,"input","");
      checkbox.type="checkbox";checkbox.name="caseSection";checkbox.value=section;checkbox.checked=sections.includes(section);
      checkbox.addEventListener("change",updateSave);label.append(name);
    }
    const replacement=candidate&&sameSource(candidate.from,source())&&candidate.report.report_id!==value.report.report_id
      ?candidate:null;
    if(replacement){
      const label=node(editor,"label","");label.className="case-selection";

      const input=node(label,"input","");input.type="checkbox";input.id="caseEditRebind";
      input.addEventListener("change",updateSave);
      label.append("关联已核实预览 "+describe(replacement.report.result));
    }
    const save=node(editor,"button","保存新版本");save.id="caseEditSave";save.onclick=()=>perform(async n=>{
      const base=selected;
      const rebind=$("caseEditRebind")?.checked===true;
      const next=rebind?replacement?.report:base.report;
      if(!next||(rebind&&!sameSource(replacement.from,source())))throw Error("source_changed");
      const binding={result_id:next.result.result_id,projection_id:next.result.projection_id,report_id:next.report_id};
      const fields={...metadata("caseEdit"),base_version:base.version,base_version_id:base.version_id,sections:editedSections()};
      if(next!==base.report)fields.report_binding=binding;
      const signature=JSON.stringify({case_id:base.case_id,...fields});
      if(editIntent?.signature!==signature)editIntent={signature,id:crypto.randomUUID().replaceAll("-","")};
      let result;
      try{result=await api("/"+base.case_id,{method:"PUT",body:JSON.stringify({...fields,intent_id:editIntent.id})});}
      catch(error){
        if(error.message==="http_409"){
          const versions=await api("/"+base.case_id+"/versions");
          const latest=versions?.versions?.[0];
          if(versions?.schema_version==="ocean-synthetic-case-versions/v1"&&versions.case_id===base.case_id&&
              Number.isInteger(latest?.version)&&latest.version>=1&&latest.version<=16&&hash.test(latest.version_id)&&
              (latest.version!==base.version||latest.version_id!==base.version_id)){
            const conflict=Error("case_version_conflict");
            conflict.baseVersion=base.version;
            conflict.currentVersion=latest.version;
            throw conflict;
          }
        }
        throw error;
      }
      if(n!==generation)return;
      const updated=verify(result,true);
      if(updated.case_id!==base.case_id||updated.version!==base.version+1||updated.report.report_id!==binding.report_id||
          updated.report.result.result_id!==binding.result_id||updated.report.result.projection_id!==binding.projection_id||
          String(updated.sections)!==String(fields.sections))
        throw Error("contract");
      show(updated);await loadVersions(n);if(n!==generation)return;const list=await queryCatalog();if(n!==generation)return;catalog(list);$("caseArchiveStatus").textContent="已保存并保护新版本。旧版本仍可读取。";
    },"updated");
    const identity=node(root,"details","");
    node(identity,"summary","案例与版本身份");
    for(const [label,key] of [["案例",value.case_id],["版本",value.version_id],["结果",r.result_id],["报告",value.report.report_id]])
      node(identity,"p",label+" "+key);
    const details=node(root,"details","");node(details,"summary","冻结逐日证据");
    details.hidden=!sections.includes("daily");
    const wrap=node(details,"div","");wrap.className="monthly-chart-wrap";const chart=node(wrap,"div","");chart.className="monthly-chart";chart.setAttribute("role","img");
    const tableWrap=node(details,"div","");tableWrap.className="monthly-table-wrap";const table=node(tableWrap,"table","");
    const head=table.createTHead().insertRow();for(const label of ["日期","状态","小时(h)","有效面积(km²)"])node(head,"th",label);table.createTBody();
    node(details,"p",OceanMonthEvidence.render(chart,table,r.daily));
    for(const line of [r.source.id+" / "+r.source.version+" / "+r.source.license,...r.caveats])node(details,"p",line);
    updateSave();
  }
  async function aggregateBytes(path,frozen){
    const receipt=await api(path,{method:"POST"});
    if(receipt?.schema_version!=="ocean-case-aggregate-csv-receipt/v1"||receipt.case_id!==frozen.case_id||
        receipt.version!==frozen.version||receipt.version_id!==frozen.version_id||receipt.report_id!==frozen.report.report_id||
        receipt.format_version!=="owner-case-aggregate-csv/v1"||receipt.protection!=="saved_case"||
        !hash.test(receipt.artifact_id)||!hash.test(receipt.sha256)||!Number.isSafeInteger(receipt.byte_length)||
        receipt.byte_length<1||receipt.byte_length>131072)throw Error("contract");
    const data=await api(path,{},OceanPublicRead.bytes);
    if(data.byteLength!==receipt.byte_length)throw Error("contract");
    const calculated=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
    const identity="sha256:"+Array.from(calculated,byte=>byte.toString(16).padStart(2,"0")).join("");
    if(identity!==receipt.sha256)throw Error("contract");
    return data;
  }
  function download(format){
    const frozen=selected,from=source();
    if(!frozen)return;
    return perform(async n=>{
      const query="?version_id="+encodeURIComponent(frozen.version_id)+"&report_id="+encodeURIComponent(frozen.report.report_id);
      const path="/"+frozen.case_id+"/versions/"+frozen.version+"/exports/"+format+query;
      const data=format==="aggregate-csv"?await aggregateBytes(path,frozen):await api(path,{},OceanPublicRead.bytes);
      if(n!==generation)return;
      if(!sameSource(from,source()))throw Error("source_changed");
      const [extension,media]={markdown:["md","text/markdown;charset=utf-8"],csv:["csv","text/csv;charset=utf-8"],"aggregate-csv":["aggregate-v1.csv","text/csv;charset=utf-8"],bundle:["zip","application/zip"],chart:["chart-v1.png","image/png"]}[format];
      const blob=format==="chart"?await OceanCaseChart.png(data,frozen,controller.signal):new Blob([data],{type:media});
      if(n!==generation)return;
      if(controller.signal.aborted)throw Error("cancelled");
      if(!sameSource(from,source()))throw Error("source_changed");
      const url=URL.createObjectURL(blob);downloads.add(url);
      const link=document.createElement("a");link.href=url;link.download=`Ocean-case-${frozen.case_id}-v${frozen.version}-${frozen.version_id.slice(7,19)}.${extension}`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(url);},1000);
      $("caseArchiveStatus").textContent="已将所读案例版本交给浏览器下载；未保存草稿保留。";
    },"downloaded");
  }
  async function checkBundle(file,frozen){
    const from=source();
    await perform(async n=>{
      $("caseBundleCheckStatus").textContent=$("caseArchiveStatus").textContent="正在本地读取并核对所读版本成果包…";
      if(file.size>1048576)throw Error("bundle_budget");
      if(!file.size)throw Error("bundle_file");
      const reader=new FileReader(),signal=controller.signal;
      const abort=()=>reader.abort();
      let local;
      try{
        local=new Uint8Array(await new Promise((resolve,reject)=>{
          reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("bundle_file"));reader.onabort=()=>reject(Error("cancelled"));
          signal.addEventListener("abort",abort,{once:true});reader.readAsArrayBuffer(file);
        }));
      }finally{signal.removeEventListener("abort",abort);reader.onload=reader.onerror=reader.onabort=null;}
      if(n!==generation||signal.aborted)return;
      const query="?version_id="+encodeURIComponent(frozen.version_id)+"&report_id="+encodeURIComponent(frozen.report.report_id);
      const expected=await api("/"+frozen.case_id+"/versions/"+frozen.version+"/exports/bundle"+query,{},OceanPublicRead.bytes);
      if(n!==generation||signal.aborted)return;
      if(!sameSource(from,source()))throw Error("source_changed");
      if(local.length!==expected.length||!local.every((byte,index)=>byte===expected[index]))throw Error("bundle_mismatch");
      $("caseArchiveStatus").textContent="已核对：本地成果包与所读保存版本完全一致（版本 "+frozen.version+"）。仅核对文件一致性，不证明来源签名、研究资格或备份可恢复；未保存草稿保留。";
    },"bundle-checked");
    if(selected===frozen)$("caseBundleCheckStatus").textContent=$("caseArchiveStatus").textContent;
  }
  const pageSize=8;
  function catalogScope(){
    return {q:$("caseCatalogQuery").value,kind:$("caseCatalogKind").value||null,
      start_date:$("caseCatalogStart").value||null,end_date:$("caseCatalogEnd").value||null};
  }
  async function queryCatalog(offset=0,catalogId=null){
    const scope=catalogScope(),query=new URLSearchParams({limit:pageSize,offset});
    if(catalogId)query.set("catalog_id",catalogId);
    for(const [key,value] of Object.entries(scope))if(value!==null)query.set(key,value);
    const data=await api("?"+query);
    if(data?.offset!==offset||!hash.test(data.catalog_id)||!data.scope||
        Object.keys(scope).some(key=>scope[key]!==data.scope[key])||(catalogId&&data.catalog_id!==catalogId))
      throw Error("contract");
    return data;
  }
  async function loadVersions(n){
    const identity=selected.case_id,version=selected.version,data=await api("/"+identity+"/versions");if(n!==generation)return;
    if(data?.schema_version!=="ocean-synthetic-case-versions/v1"||data.case_id!==identity||!Array.isArray(data.versions)||data.versions.length>16||new Set(data.versions.map(v=>v.version)).size!==data.versions.length||data.versions.some(v=>!Number.isInteger(v.version)||v.version<1||v.version>16||!hash.test(v.version_id)))throw Error("contract");
    $("caseVersion").replaceChildren();
    for(const item of data.versions){
      const unavailable=item.availability==="protection_unavailable";
      const option=node($("caseVersion"),"option","版本 "+item.version+" · "+item.created_at+(unavailable?" · 保护待核":""));
      option.value=String(item.version);
      option.disabled=unavailable;
    }
    $("caseVersion").value=String(version);
  }
  function readCase(identity,version){
    return perform(async n=>{
      const query=new URLSearchParams({include_source_status:true});
      if(version)query.set("version",version);
      const value=await api("/"+identity+"?"+query);
      if(n!==generation)return;
      if(value?.case_id!==identity||(version&&value.version!==version)||
          (value.current_published_snapshot!==undefined&&
            !["missing","unknown","projection_missing","projection_changed","present_verified"].includes(value.current_published_snapshot)))throw Error("contract");
      show(value);await loadVersions(n);if(n!==generation)return;
      $("caseArchiveStatus").textContent="已重开持久保存的合成快照；人工信息按所选版本显示。";
    },"opened");
  }
  function catalog(data){
    if(data?.schema_version!=="ocean-synthetic-case-catalog/v1")throw Error("contract");
    if(!Array.isArray(data.cases)||data.cases.length>pageSize||!Number.isInteger(data.total)||data.total<0||data.total>64||
        data.cases.length!==Math.min(pageSize,Math.max(0,data.total-data.offset))||
        data.next_offset!==(data.offset+pageSize<data.total?data.offset+pageSize:null))throw Error("contract");
    casePage=data;
    $("caseItems").replaceChildren();
    for(const item of data.cases){
      if(!id.test(item.case_id)||typeof item.metadata?.title!=="string"||!Number.isInteger(item.version))throw Error("contract");
      const unavailable=item.availability==="protection_unavailable";
      const fallback=item.readable_version;
      if(unavailable&&fallback!==null&&(!Number.isInteger(fallback)||fallback<1||fallback>=item.version))throw Error("contract");
      const suffix=unavailable?(fallback===null?" · 保护待核":" · 最新版保护待核，可读 v"+fallback):"";
      const button=node($("caseItems"),"button",item.metadata.title+" · v"+item.version+suffix);
      button.dataset.caseId=item.case_id;
      button.disabled=unavailable&&fallback===null;
      button.onclick=()=>readCase(item.case_id,unavailable?fallback:null);
    }
    if(!data.cases.length)node($("caseItems"),"p","当前没有已保存案例。");
  }
  function open(){OceanHistoryViews.open("private-cases");}
  OceanHistoryViews.register("private-cases",{label:"我的案例",element:pane,onOpen(){
    $("caseArchiveStatus").textContent=source().kind==="server"?"请输入当前服务配置的本人令牌；保存仅限已核验的合成报告。":"离线页面不能读取或保存本人案例。";updateSave();
  }});
  shortcut.onclick=open;
  $("caseOwnerToken").addEventListener("input",()=>{clearPrivate(false);if($("caseOwnerToken").value)sessionSource=source();});
  function loadCatalog(offset=0,identity=null){
    return perform(async n=>{
      let data;
      try{data=await queryCatalog(offset,identity);}
      catch(error){
        if(error.message==="http_409"){invalidateCatalog();throw Error("catalog_changed");}
        throw error;
      }
      if(n!==generation)return;
      catalog(data);
      $("caseArchiveStatus").textContent=data.cases.length?
        "匹配案例 "+data.total+" 个，当前 "+(offset+1)+" 至 "+(offset+data.cases.length)+"。":"当前条件没有匹配案例。";
    },"listed");
  }
  function invalidateCatalog(){
    casePage=null;
    $("caseItems").replaceChildren();
    updateSave();
  }
  for(const field of catalogFields)$(field).addEventListener("input",invalidateCatalog);
  $("caseLoad").onclick=()=>loadCatalog();
  $("caseCatalogPrevious").onclick=()=>{if(casePage?.offset)loadCatalog(Math.max(0,casePage.offset-pageSize),casePage.catalog_id);};
  $("caseCatalogNext").onclick=()=>{if(casePage?.next_offset!=null)loadCatalog(casePage.next_offset,casePage.catalog_id);};
  $("caseLock").onclick=()=>{clearPrivate();$("caseArchiveStatus").textContent="已清除本页令牌与未保存草稿，持久案例保留。";};
  $("caseSave").onclick=()=>perform(async n=>{
    if(!candidate||!sameSource(candidate.from,source()))throw Error("source_changed");
    const r=candidate.report,fields={result_id:r.result.result_id,projection_id:r.result.projection_id,report_id:r.report_id,...metadata("caseCreate")};
    const signature=JSON.stringify(fields);if(intent?.signature!==signature)intent={signature,id:crypto.randomUUID().replaceAll("-","")};
    const value=await api("",{method:"POST",body:JSON.stringify({...fields,intent_id:intent.id})});if(n!==generation)return;
    const saved=verify(value,true);
    if(saved.report.report_id!==fields.report_id||saved.report.result.result_id!==fields.result_id||
        saved.report.result.projection_id!==fields.projection_id)throw Error("contract");
    show(saved);await loadVersions(n);if(n!==generation)return;const data=await queryCatalog();if(n!==generation)return;catalog(data);$("caseArchiveStatus").textContent="案例已持久保存并保护。科学内容为合成样例。";
  },"saved");
  window.addEventListener("ocean-month-report",e=>{
    candidate=e.detail?structuredClone(e.detail):null;
    $("caseCandidate").textContent=candidate?"当前报告："+describe(candidate.report.result):"请先打开一份允许公开的合成报告。";
    if(candidate){$("caseCreateTitle").value="合成月报告 "+candidate.report.result.parameters.month;const action=document.createElement("button");action.id="reportSaveCase";action.textContent="保存合成案例";action.onclick=()=>{open();$("caseCreateFields").open=true;};$("monthReport").querySelector(".monthly-actions").append(action);}
    intent=null;updateSave();
  });
  window.addEventListener("ocean-history-view",e=>{if(e.detail!=="private-cases")clearPrivate();});
  window.addEventListener("ocean-load-state",()=>{if((sessionSource&&!sameSource(sessionSource,source()))||(source().kind!=="server"&&$("caseOwnerToken").value)){clearPrivate();$("caseArchiveStatus").textContent="服务来源已改变，已清除本页令牌；离线不能读取或保存本人案例。";}updateSave();});
  window.addEventListener("ocean-workbench-task",clearPrivate);
  $("tabs").addEventListener("click",e=>{if(e.target.closest("[data-pane]")?.dataset.pane!=="clim")clearPrivate();});
  window.addEventListener("ocean-result-closed",clearPrivate);
  pane.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();e.preventDefault();clearPrivate();$("resultClose").click();$("workbenchToggle").focus();}});
  updateSave();
})();
