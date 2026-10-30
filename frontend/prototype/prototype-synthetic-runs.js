/* Explicit small synthetic submissions. Closing observation never cancels server acceptance. */
(function(){
  const {source,sameSource,json}=OceanPublicRead,panel=$('monthDraftPanel');
  const root=document.createElement('details');root.id='ownerRuns';root.dataset.state='locked';
  root.innerHTML='<summary>本人合成小例任务（持久软件验证）</summary><p>仅运行已登记CC0合成小例，真实月研究仍待接入。小型同步受理，不提供队列、自动续跑或服务端取消；离开面板仅停止观察，已送达提交仍可能完成。</p><label>合成任务本人令牌<input id="ownerRunToken" type="password" autocomplete="off" spellcheck="false"></label><div class="monthly-actions"><button id="ownerRunPrepare">核对合成条件</button><button id="ownerRunSubmit" disabled>明确提交合成任务</button><button id="ownerRunRead" disabled>重读所选记录</button><button id="ownerRunNew">清除本页引用（不取消任务）</button><button id="ownerRunLock">锁定</button></div><p id="ownerRunStatus" role="status">尚未提交；输入当前服务的本人令牌后核对条件。</p><p id="ownerRunPrepared"></p><div id="ownerRunResult"></div>';
  panel.append(root);
  const id=/^[0-9a-f]{32}$/,hash=/^sha256:[0-9a-f]{64}$/;
  let draft=null,prepared=null,pending=null,selected=null,sessionSource=null,busy=false,generation=0,controller=null;
  function set(state,message){root.dataset.state=state;$('ownerRunStatus').textContent=message;}
  function node(parent,tag,text){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;}
  function describe(p){return p.month+' · '+fmtCoord(p.longitude,p.latitude)+' · '+p.radius_km+' km';}
  function update(){
    const offline=source().kind!=='server',locked=offline||!$('ownerRunToken').value;
    $('ownerRunToken').disabled=offline||busy;
    $('ownerRunPrepare').disabled=locked||busy||!draft||!!pending;
    $('ownerRunSubmit').disabled=locked||busy||!(prepared||pending);
    $('ownerRunSubmit').textContent=pending?'核对/重发原提交意图（原条件）':'明确提交合成任务';
    $('ownerRunRead').disabled=locked||busy||!selected;
    $('ownerRunNew').disabled=busy;
  }
  function clearPrivate(clearToken=true){
    generation++;controller?.abort();busy=false;prepared=null;selected=null;sessionSource=null;
    if(clearToken)$('ownerRunToken').value='';
    $('ownerRunPrepared').textContent='';$('ownerRunResult').replaceChildren();delete root.dataset.runId;
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
      const message={http_401:'本人访问未通过；令牌和私有显示已清除。',http_403:'当前服务不允许本人合成任务；令牌和私有显示已清除。',http_503:'本人持久任务或合成输入不可用，请检查服务配置或稍后核对。',http_409:'版本、意图或容量冲突；请核对原意图或明确清除本页引用后重新准备。',http_422:'当前条件或版本没有登记合成支持，未显示受理成功。',contract:'任务身份或内容无法核实，未显示成功。',source_changed:'服务来源已改变，请重新认证。',offline:'离线不能核对或提交本人任务。',owner_required:'请输入当前服务的本人令牌。'}[error.message]||'请求结果暂不可核实。';
      if(!['http_401','http_403','source_changed'].includes(error.message))set(pending?'uncertain':'error',message+(pending?' 原提交可能已受理；可明确核对/重发同一意图，不会自动新建任务。':''));
      else $('ownerRunStatus').textContent=message;
    }finally{clearTimeout(timer);if(n===generation){busy=false;update();if(!panel.hidden&&document.activeElement===$('ownerRunLock')&&root.contains(opener)&&!opener.disabled)opener.focus({preventScroll:true});}}
  }
  function checked(record,expected={}){
    if(record?.schema_version!=='ocean-owner-synthetic-run/v1'||!id.test(record.id)||!id.test(record.intent_id)||!hash.test(record.record_id)||!hash.test(record.submission_id)||!hash.test(record.input_sha256)||!['completed','failed'].includes(record.state)||record.request?.purpose!=='monthly_spatial_example'||(expected.id&&record.id!==expected.id)||(expected.intent&&record.intent_id!==expected.intent))throw Error('contract');
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
    node(box,'p','受理 '+run.submitted_at+'；结束 '+run.finished_at+'。合成软件验证；真实研究资格未通过。');
    node(box,'p','这里只读冻结记录，当前原源可用及原样复算未知；没有自动公开或保存为案例。');
    if(run.state==='completed'){
      const r=run.result,m=r.metrics;node(box,'p',`H=${m.total_hours??'未知'} h；E=${m.area_time_km2_days??'未知'} km²·d；有效/日历日 ${m.supported_days}/${m.calendar_days}。`);
      const details=node(box,'details','');node(details,'summary','原逐日证据与局限');
      const wrap=node(details,'div','');wrap.className='monthly-chart-wrap';const chart=node(wrap,'div','');chart.className='monthly-chart';chart.setAttribute('role','img');
      const tables=node(details,'div','');tables.className='monthly-table-wrap';const table=node(tables,'table',''),head=table.createTHead().insertRow();
      for(const label of ['日期','状态','小时(h)','有效面积(km²)'])node(head,'th',label);table.createTBody();
      node(details,'p',OceanMonthEvidence.render(chart,table,r.daily));for(const line of r.caveats)node(details,'p',line);
    }else node(box,'p','计算已终态失败；没有成功结果或部分结果可用。');
    pending=null;prepared=null;set(run.state,run.state==='completed'?'已读取可靠提交的合成任务结果；地图条件未改变。':'已读取持久失败记录；新尝试必须明确准备新的意图。');update();
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
    if(!pending){if(!prepared)throw Error('contract');const intent=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');pending={from:prepared.from,body:{intent_id:intent,input_sha256:prepared.input_sha256,request:prepared.request}};}
    if(!sameSource(pending.from,from))throw Error('source_changed');
    const body=pending.body,intent=body.intent_id;set('submitting','正在等待服务受理结果；关闭观察不取消已送达提交。');const result=await net('','POST',body);if(n!==generation)return;show(result,{intent,body});
  });
  $('ownerRunRead').onclick=()=>perform(async n=>{const identity=selected.id;const value=await net('/'+identity);if(n!==generation)return;show(value,{id:identity});});
  $('ownerRunNew').onclick=()=>{pending=null;prepared=null;set('draft','已清除本页提交引用；服务任务没有取消或删除，可重新核对条件以明确创建新意图。');update();};
  $('ownerRunLock').onclick=()=>clearPrivate();$('ownerRunToken').oninput=()=>{clearPrivate(false);sessionSource=source();};
  window.addEventListener('ocean-month-draft',e=>{if(root.dataset.state==='checking'){generation++;controller?.abort();busy=false;}draft=e.detail?.longitude===null?null:e.detail;prepared=null;$('ownerRunPrepared').textContent='';if(!busy&&!pending)set('draft','条件已改变；请重新核对。');update();});
  window.addEventListener('ocean-month-draft-closed',()=>clearPrivate());
  window.addEventListener('ocean-load-state',()=>{if(sessionSource&&!sameSource(sessionSource,source()))clearPrivate();update();});
  update();
})();
