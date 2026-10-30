/* Explicit small synthetic submissions. Closing observation never cancels server acceptance. */
(function(){
  const {source,sameSource,json}=OceanPublicRead,panel=$('monthDraftPanel');
  const root=document.createElement('details');root.id='ownerRuns';root.dataset.state='locked';
  root.innerHTML='<summary>本人合成小例任务（持久软件验证）</summary><p>仅运行已登记CC0合成小例，真实月研究仍待接入。小型同步受理，不提供队列、自动续跑或服务端取消；离开面板仅停止观察，已送达提交仍可能完成。</p><label>合成任务本人令牌<input id="ownerRunToken" type="password" autocomplete="off" spellcheck="false"></label><div class="monthly-actions"><button id="ownerRunPrepare">核对合成条件</button><button id="ownerRunSubmit" disabled>明确提交合成任务</button><button id="ownerRunRead" disabled>重读所选记录</button><button id="ownerRunNew">清除本页引用（不取消任务）</button><button id="ownerRunLock">锁定</button></div><p id="ownerRunStatus" role="status">尚未提交；输入当前服务的本人令牌后核对条件。</p><p id="ownerRunPrepared"></p><div id="ownerRunResult"></div>';
  panel.append(root);
  const id=/^[0-9a-f]{32}$/,hash=/^sha256:[0-9a-f]{64}$/;
  let draft=null,prepared=null,pending=null,selected=null,sessionSource=null,busy=false,generation=0,controller=null,reference=null,referenceError='';
  const referenceKey='ocean-owner-synthetic-run-ref/v1';
  const actions=root.querySelector('.monthly-actions');
  node(actions,'button','读取我的合成任务').id='ownerRunHistory';node(actions,'button','核对原意图').id='ownerRunFindIntent';
  const referenceStatus=node(root,'p','');referenceStatus.id='ownerRunReferenceStatus';
  const items=node(root,'div','');items.id='ownerRunItems';items.className='case-candidates';
  function activePending(){return pending&&sameSource(pending.from,source())?pending:null;}
  function activeReference(){return reference&&source().kind==='server'&&reference.base===source().base?reference:null;}
  function referenceMessage(){
    root.dataset.referenceState=referenceError||(!reference?'none':activeReference()?'available':'other-source');
    referenceStatus.textContent=referenceError==='invalid'?'本地引用损坏，未作为任务状态；可从本人服务目录找回。':referenceError==='unavailable'?'本地引用不可用；可从本人服务目录找回，未自动提交。':activeReference()?reference.run_id?'保留了服务来源和任务/意图ID；没有保存令牌、条件或科学结果。':'本地有未核实提交意图；请认证后核对原意图，未自动提交。':reference?'本地引用属于另一服务，当前不会向此服务发送它。':'没有本地任务引用；仍可认证后读取本人服务目录。';
  }
  function readReference(){
    try{
      const raw=localStorage.getItem(referenceKey);if(!raw)return;
      if(raw.length>4096)throw Error('invalid');const value=JSON.parse(raw);
      if(value?.schema_version!==referenceKey||typeof value.base!=='string'||value.base.length>2048||!id.test(value.intent_id)||(value.run_id!==null&&!id.test(value.run_id))||Object.keys(value).some(k=>!['schema_version','base','intent_id','run_id'].includes(k)))throw Error('invalid');
      reference=value;
    }catch(error){reference=null;referenceError=error.message==='invalid'||error instanceof SyntaxError?'invalid':'unavailable';}
  }
  function saveReference(value){
    reference=value;referenceError='';try{localStorage.setItem(referenceKey,JSON.stringify(value));}catch{referenceError='unavailable';}referenceMessage();
  }
  function set(state,message){root.dataset.state=state;$('ownerRunStatus').textContent=message;}
  function node(parent,tag,text){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;}
  function describe(p){return p.month+' · '+fmtCoord(p.longitude,p.latitude)+' · '+p.radius_km+' km';}
  function update(){
    const offline=source().kind!=='server',locked=offline||!$('ownerRunToken').value;
    $('ownerRunToken').disabled=offline||busy;
    const unresolved=activePending()||activeReference()?.run_id===null;
    $('ownerRunPrepare').disabled=locked||busy||!draft||!!unresolved;
    $('ownerRunSubmit').disabled=locked||busy||!(prepared||activePending());
    $('ownerRunSubmit').textContent=activePending()?'核对/重发原提交意图（原条件）':'明确提交合成任务';
    $('ownerRunRead').disabled=locked||busy||!selected;
    $('ownerRunNew').disabled=busy;
    $('ownerRunHistory').disabled=locked||busy;
    $('ownerRunFindIntent').disabled=locked||busy||!(activePending()||activeReference());
    for(const button of items.querySelectorAll('button'))button.disabled=locked||(busy&&root.dataset.state!=='reading');
    referenceMessage();
  }
  function clearPrivate(clearToken=true){
    generation++;controller?.abort();busy=false;prepared=null;selected=null;sessionSource=null;
    if(clearToken)$('ownerRunToken').value='';
    $('ownerRunPrepared').textContent='';$('ownerRunResult').replaceChildren();delete root.dataset.runId;
    items.replaceChildren();
    set('locked',pending?'观察已停止，令牌与私有显示已清除；原提交仍可能已受理，重新认证后核对原意图。':'已锁定；服务持久记录保留。');update();
  }
  async function net(suffix,method='GET',body){
    const from=source(),token=$('ownerRunToken').value;
    if(from.kind!=='server')throw Error('offline');if(!token)throw Error('owner_required');
    if(sessionSource&&!sameSource(sessionSource,from))throw Error('source_changed');sessionSource=from;
    return json(from.base+'/query/monthly-analysis/owner-runs'+suffix,controller.signal,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }
  async function perform(work){
    if(busy)return;
    controller?.abort();controller=new AbortController();const active=controller,n=++generation,timer=setTimeout(()=>active.abort(),10000),from=source(),opener=document.activeElement;
    busy=true;update();if(root.contains(opener)&&opener.disabled)$('ownerRunLock').focus({preventScroll:true});
    try{await work(n,from);if(n!==generation)return;if(active.signal.aborted)throw Error('cancelled');if(!sameSource(from,source()))throw Error('source_changed');}
    catch(error){if(n!==generation)return;
      if(['http_401','http_403','source_changed'].includes(error.message))clearPrivate();
      const message={http_401:'本人访问未通过；令牌和私有显示已清除。',http_403:'当前服务不允许本人合成任务；令牌和私有显示已清除。',http_503:'本人持久任务或合成输入不可用，请检查服务配置或稍后核对。',http_409:'版本、意图或容量冲突；请核对原意图或明确清除本页引用后重新准备。',http_422:'当前条件或版本没有登记合成支持，未显示受理成功。',http_404:'本次未查到记录或接口；原请求仍可能稍后提交，不能判断从未受理。可稍后核对或读取本人历史。',contract:'任务身份或内容无法核实，未显示成功。',source_changed:'服务来源已改变，请重新认证；旧服务意图只向原服务核对。',offline:'离线不能核对或提交本人任务。',owner_required:'请输入当前服务的本人令牌。'}[error.message]||'请求结果暂不可核实；保留上次核实的记录和原条件。';
      if(!['http_401','http_403','source_changed'].includes(error.message))set(activePending()||root.dataset.state==='looking-up'?'uncertain':'error',message+(activePending()?' 原提交可能已受理；可明确核对/重发同一意图，不会自动新建任务。':''));
      else $('ownerRunStatus').textContent=message;
    }finally{clearTimeout(timer);if(n===generation){busy=false;update();if(!panel.hidden&&document.activeElement===$('ownerRunLock')&&root.contains(opener)&&!opener.disabled)opener.focus({preventScroll:true});}}
  }
  function validRequest(p){return p?.purpose==='monthly_spatial_example'&&/^[12]\d{3}-(0[1-9]|1[0-2])$/.test(p.month)&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&[10,20,30].includes(p.radius_km)&&typeof p.input_version==='string'&&p.input_version.length>0&&p.input_version.length<=100&&p.method_version==='monthly-known-support/v1'&&p.parameter_version==='known-unit-membership/v1';}
  function checked(record,expected={}){
    if(record?.schema_version!=='ocean-owner-synthetic-run/v1'||!id.test(record.id)||!id.test(record.intent_id)||!hash.test(record.record_id)||!hash.test(record.submission_id)||!hash.test(record.input_sha256)||!['completed','failed'].includes(record.state)||record.request?.purpose!=='monthly_spatial_example'||(expected.id&&record.id!==expected.id)||(expected.intent&&record.intent_id!==expected.intent))throw Error('contract');
    if(!validRequest(record.request)||!Number.isFinite(Date.parse(record.submitted_at))||!Number.isFinite(Date.parse(record.finished_at)))throw Error('contract');
    if(expected.body&&(record.input_sha256!==expected.body.input_sha256||!Object.keys(expected.body.request).every(k=>record.request[k]===expected.body.request[k])))throw Error('contract');
    if(record.state==='completed'){
      const r=record.result;
      if(r?.evidence_kind!=='synthetic_example'||r.research_ready!==false||!r.source?.license.startsWith('CC0-1.0')||r.source.input_sha256!==record.input_sha256||!hash.test(r.result_id)||!Array.isArray(r.daily)||r.daily.length<28||r.daily.length>31||!Object.keys(record.request).every(k=>r.parameters[k]===record.request[k]))throw Error('contract');
    }else if(record.result!==null||record.error?.code!=='calculation_failed')throw Error('contract');
    return record;
  }
  function show(value,expected){
    const run=checked(value,expected),box=$('ownerRunResult');box.replaceChildren();selected=run;root.dataset.runId=run.id;
    node(box,'p','原任务条件：'+describe(run.request));node(box,'p','任务 '+run.id+' / 意图 '+run.intent_id+' / '+run.record_id);
    node(box,'p','服务处理 '+run.submitted_at+' 至 '+run.finished_at+'，终态已提交。合成软件验证；真实研究资格未通过。');
    node(box,'p','这里只读冻结记录，当前原源可用及原样复算未知；没有自动公开或保存为案例。');
    if(run.state==='completed'){
      const r=run.result,m=r.metrics;node(box,'p',`H=${m.total_hours??'未知'} h；E=${m.area_time_km2_days??'未知'} km²·d；有效/日历日 ${m.supported_days}/${m.calendar_days}。`);
      const details=node(box,'details','');node(details,'summary','原逐日证据与局限');
      const wrap=node(details,'div','');wrap.className='monthly-chart-wrap';const chart=node(wrap,'div','');chart.className='monthly-chart';chart.setAttribute('role','img');
      const tables=node(details,'div','');tables.className='monthly-table-wrap';const table=node(tables,'table',''),head=table.createTHead().insertRow();
      for(const label of ['日期','状态','小时(h)','有效面积(km²)'])node(head,'th',label);table.createTBody();
      node(details,'p',OceanMonthEvidence.render(chart,table,r.daily));for(const line of r.caveats)node(details,'p',line);
    }else node(box,'p','计算已终态失败；没有成功结果或部分结果可用。');
    const unresolved=(activePending()&&pending.body.intent_id!==run.intent_id)||(activeReference()?.run_id===null&&reference.intent_id!==run.intent_id);
    if(!unresolved){if(activePending()?.body.intent_id===run.intent_id)pending=null;saveReference({schema_version:referenceKey,base:sessionSource.base,intent_id:run.intent_id,run_id:run.id});}
    prepared=null;set(run.state,(run.state==='completed'?'已读取可靠提交的合成任务结果；地图条件未改变。':'已读取持久失败记录；新尝试必须明确准备新的意图。')+(unresolved?' 原提交意图仍待核实，核对入口保留。':''));update();
  }
  $('ownerRunPrepare').onclick=()=>perform(async(n,from)=>{
    set('checking','正在核对合成条件；尚未提交。');const values=draft,data=await net('/options');if(n!==generation)return;
    const match=data.conditions?.find(c=>['month','longitude','latitude','radius_km'].every(k=>c[k]===values[k]));
    if(data.schema_version!=='ocean-owner-synthetic-options/v1'||data.evidence_kind!=='synthetic_example'||data.research_ready!==false||!hash.test(data.input_sha256)||!data.license?.startsWith('CC0-1.0'))throw Error('contract');
    if(!match)throw Error('http_422');
    prepared={from,input_sha256:data.input_sha256,request:{purpose:'monthly_spatial_example',longitude:match.longitude,latitude:match.latitude,radius_km:match.radius_km,month:match.month,input_version:data.input_version,method_version:data.method_version,parameter_version:data.parameter_version}};
    $('ownerRunPrepared').textContent='将提交合成条件：'+describe(prepared.request)+' / '+data.input_sha256+'。明确提交才计算。';set('prepared','合成条件已核对；存储和源身份会在实际受理时复核。');
  });
  $('ownerRunSubmit').onclick=()=>perform(async(n,from)=>{
    if(!activePending()){if(!prepared)throw Error('contract');const intent=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');pending={from:prepared.from,body:{intent_id:intent,input_sha256:prepared.input_sha256,request:prepared.request}};saveReference({schema_version:referenceKey,base:pending.from.base,intent_id:intent,run_id:null});}
    if(!sameSource(pending.from,from))throw Error('source_changed');
    const body=pending.body,intent=body.intent_id;set('submitting','正在等待服务受理结果；关闭观察不取消已送达提交。');const result=await net('','POST',body);if(n!==generation)return;show(result,{intent,body});
  });
  function readRecord(identity){
    if(busy&&root.dataset.state==='reading'){generation++;controller?.abort();busy=false;}
    return perform(async n=>{set('reading','正在核对所选持久记录；不会重新计算。');update();const value=await net('/'+identity);if(n!==generation)return;show(value,{id:identity});});
  }
  $('ownerRunRead').onclick=()=>readRecord(selected.id);
  $('ownerRunHistory').onclick=()=>perform(async n=>{
    set('loading-history','正在读取本人服务目录；原有显示保留为上次核实内容。');const data=await net('');if(n!==generation)return;
    if(data?.schema_version!=='ocean-owner-synthetic-history/v1'||!Array.isArray(data.runs)||data.runs.length>64||new Set(data.runs.map(r=>r.id)).size!==data.runs.length||data.runs.some(r=>!id.test(r.id)||!id.test(r.intent_id)||!hash.test(r.record_id)||!['completed','failed'].includes(r.state)||!validRequest(r.request)||!Number.isFinite(Date.parse(r.finished_at))))throw Error('contract');
    items.replaceChildren();for(const run of data.runs){const button=node(items,'button',describe(run.request)+' · '+(run.state==='completed'?'已完成':'计算失败')+' · '+run.finished_at);button.dataset.runId=run.id;button.onclick=()=>readRecord(run.id);}
    if(!data.runs.length)node(items,'p','当前未查到已提交终态；在途请求仍可能稍后出现。');
    set('history','已读取全部 '+data.runs.length+' 条本人持久记录；选择后只读原条件和冻结结果。');
  });
  $('ownerRunFindIntent').onclick=()=>perform(async n=>{
    const active=activePending(),ref=activeReference(),intent=active?.body.intent_id||ref?.intent_id;if(!intent)throw Error('contract');
    set('looking-up','正在查询原意图是否已有终态记录；不会重新计算。');const value=await net('/intents/'+intent);if(n!==generation)return;
    show(value,{intent,...(active?{body:active.body}:ref?.run_id?{id:ref.run_id}:{})});
  });
  $('ownerRunNew').onclick=()=>{pending=null;prepared=null;reference=null;referenceError='';try{localStorage.removeItem(referenceKey);}catch{referenceError='unavailable';}set('draft','已清除本地提交引用；服务任务没有取消或删除，可重新核对条件以明确创建新意图。');update();};
  $('ownerRunLock').onclick=()=>clearPrivate();$('ownerRunToken').oninput=()=>{clearPrivate(false);sessionSource=source();};
  window.addEventListener('ocean-month-draft',e=>{if(root.dataset.state==='checking'){generation++;controller?.abort();busy=false;}draft=e.detail?.longitude===null?null:e.detail;prepared=null;$('ownerRunPrepared').textContent='';if(!busy&&!pending)set('draft','条件已改变；请重新核对。');update();});
  window.addEventListener('ocean-month-draft-closed',()=>clearPrivate());
  window.addEventListener('ocean-load-state',()=>{if(sessionSource&&!sameSource(sessionSource,source()))clearPrivate();update();});
  readReference();update();
})();
