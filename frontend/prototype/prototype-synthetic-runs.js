/* Explicit small synthetic submissions. Closing observation never cancels server acceptance. */
(function(){
  const {source:publicSource,sameSource,json}=OceanPublicRead,panel=$('monthDraftPanel');
  const root=document.createElement('details');root.id='ownerRuns';root.dataset.state='locked';
  root.innerHTML='<summary>本人合成小例任务（持久软件验证）</summary><p id="ownerRunScope"></p><label>任务类型<select id="ownerRunPurpose"><option value="monthly_spatial_example">已知单元</option><option value="monthly_distance_reference">P0 合成距离参照</option></select></label><label>合成任务本人令牌<input id="ownerRunToken" type="password" autocomplete="off" spellcheck="false"></label><div class="monthly-actions"><button id="ownerRunPrepare">核对合成条件</button><button id="ownerRunSubmit" disabled>明确提交合成任务</button><button id="ownerRunRead" disabled>重读所选记录</button><button id="ownerRunNew">清除本页引用（不取消任务）</button><button id="ownerRunLock">锁定</button></div><p id="ownerRunStatus" role="status">尚未提交；输入当前服务的本人令牌后核对条件。</p><p id="ownerRunPrepared"></p><div id="ownerRunResult"></div>';
  panel.append(root);
  const id=/^[0-9a-f]{32}$/,hash=/^sha256:[0-9a-f]{64}$/;
  let draft=null,prepared=null,pending=null,selected=null,sessionSource=null,busy=false,generation=0,controller=null,reference=null,referenceError='';
  const legacyPurpose = 'monthly_spatial_example';
  const distancePurpose = 'monthly_distance_reference';
  const generalFailureMessage = '计算已终态失败；没有成功结果或部分结果可用。';
  const distanceFailureMessages = new Map([
    ['execution_evidence_changed','原尝试已中止，资格、登记输入或执行环境无法继续核验。没有发布结果。'],
    ['execution_timed_out','计算达到服务时限，原尝试已中止。没有发布结果。'],
  ]);
  const pendingByPurpose = new Map();
  const recoveryDelays = [600, 1200, 2400, 4800, 8000];
  let recovery = null;
  let preferredRun = null;
  let cancellation = null;
  let cancellationIntent = null;
  let observeCancellation = false;
  const cancelMessages = {
    checking:'服务正在核对资格。可在核对结束后申请取消。',
    cancelling:'已提出取消，正在等待服务确认终态。',
    finishing:'任务已进入结果提交阶段，无法撤回。正在核对最终状态。',
    completed:'服务确认任务已经完成，取消申请未改变原结果。',
    cancelled:'服务已确认取消原意图。',
    failed:'原任务已处于持久失败状态。',
  };
  let purpose = legacyPurpose;
  let referenceKey = 'ocean-owner-synthetic-run-ref/v1';

  function distanceMode() {
    return purpose === distancePurpose;
  }

  function sameOriginService(current) {
    if(current.kind!=='server')return false;
    try{
      const api=new URL(current.base,location.href);
      return api.origin===location.origin&&api.pathname==='/api'&&!api.search&&!api.hash;
    }catch{return false;}
  }

  function source() {
    const current=publicSource();
    if(!distanceMode()||current.kind!=='server')return current;
    return sameOriginService(current)?current:{kind:'offline',base:null};
  }

  function purposeSuffix() {
    return distanceMode() ? '?purpose=' + distancePurpose : '';
  }
  const actions=root.querySelector('.monthly-actions');
  const downloads=new Set();
  node(actions,'button','读取我的合成任务').id='ownerRunHistory';node(actions,'button','核对原意图').id='ownerRunFindIntent';
  const cancelButton=node(actions,'button','取消原提交');cancelButton.id='ownerRunCancel';
  const retryButton=node(actions,'button','核对原条件重试');retryButton.id='ownerRunRetry';
  const retryCurrentButton=node(actions,'button','核对当前条件的新请求');retryCurrentButton.id='ownerRunRetryCurrent';
  const cancelStatus=node(root,'p','');cancelStatus.id='ownerRunCancelStatus';cancelStatus.setAttribute('role','status');
  node(actions,'button','下载所读任务 Markdown').id='ownerRunExportMarkdown';node(actions,'button','下载所读任务 CSV').id='ownerRunExportCsv';
  const referenceStatus=node(root,'p','');referenceStatus.id='ownerRunReferenceStatus';
  const items=node(root,'div','');items.id='ownerRunItems';items.className='case-candidates';
  const taskHistoryOpen=node(actions,'button','任务历史筛选');taskHistoryOpen.id='ownerTaskHistoryOpen';
  taskHistoryOpen.setAttribute('aria-controls','ownerTaskHistory');
  taskHistoryOpen.setAttribute('aria-expanded','false');
  const taskHistory=node(root,'section','');taskHistory.id='ownerTaskHistory';taskHistory.hidden=true;
  taskHistory.innerHTML='<form id="ownerTaskHistoryForm" class="monthly-actions">'+
    '<label>类型<select name="purpose" id="ownerTaskHistoryPurpose"><option value="">全部</option><option value="monthly_spatial_example">已知单元</option><option value="monthly_distance_reference">距离参照</option></select></label>'+
    '<label>状态<select name="status" id="ownerTaskHistoryStatusFilter"><option value="">全部</option><option value="completed">已完成</option><option value="failed">失败</option><option value="interrupted">中断</option><option value="cancelled">已取消</option></select></label>'+
    '<label>起始日（UTC）<input type="date" name="start_date"></label><label>结束日（UTC）<input type="date" name="end_date"></label>'+
    '<button id="ownerTaskHistoryApply" type="submit">查找历史</button></form>'+
    '<div class="monthly-actions"><button id="ownerTaskHistoryPrevious">上一页</button>'+
    '<button id="ownerTaskHistoryNext">下一页</button><button id="ownerTaskHistoryClose">收起筛选</button></div>'+
    '<p id="ownerTaskHistoryStatus" role="status"></p><div id="ownerTaskHistoryItems" class="case-candidates"></div><div id="ownerTaskHistoryDetail"></div>';
  const taskHistoryForm=$('ownerTaskHistoryForm'),taskHistoryDetail=$('ownerTaskHistoryDetail');
  const taskHistoryStatuses=new Map([['completed','已完成'],['failed','失败'],['interrupted','中断'],['cancelled','已取消']]);
  let taskHistoryRequest=null,taskHistoryPage=null;

  const preparation=OceanOwnerPreparation({
    root,actions,
    request:(suffix,method,body,signal)=>ownerNet('/data/owner-preparation',suffix,method,body,json,signal),
    canRead:sameOriginOwnerAvailable,
    lock:()=>clearPrivate(),
  });

  function sameOriginOwnerAvailable(){
    return sameOriginService(source())&&navigator.onLine&&Boolean($('ownerRunToken').value);
  }

  function syncTaskHistory(){
    taskHistoryOpen.disabled=!sameOriginOwnerAvailable();
    const blocked=taskHistoryOpen.disabled||Boolean(taskHistoryRequest);
    $('ownerTaskHistoryApply').disabled=blocked;
    $('ownerTaskHistoryPrevious').disabled=blocked||!(taskHistoryPage?.filters.offset>0);
    $('ownerTaskHistoryNext').disabled=blocked||taskHistoryPage?.next_offset==null;
    for(const button of $('ownerTaskHistoryItems').querySelectorAll('button'))button.disabled=blocked;
  }

  function stopTaskHistoryRequest(){
    taskHistoryRequest?.abort();
    taskHistoryRequest=null;
  }

  function hideTaskHistory(clear=false){
    stopTaskHistoryRequest();
    taskHistory.hidden=true;
    taskHistoryOpen.setAttribute('aria-expanded','false');
    if(clear){
      taskHistoryPage=null;
      $('ownerTaskHistoryStatus').textContent='';
      $('ownerTaskHistoryItems').replaceChildren();
      taskHistoryDetail.replaceChildren();
      delete taskHistoryDetail.dataset.runId;
    }
    syncTaskHistory();
  }

  async function readTaskHistory(suffix,message,receive,isPage=false){
    if(!sameOriginOwnerAvailable()||taskHistory.hidden||!root.open||panel.hidden)return;
    stopTaskHistoryRequest();
    const observer=new AbortController(),from=source(),opener=document.activeElement;
    const close=$('ownerTaskHistoryClose');
    const deadline=setTimeout(()=>observer.abort(),6000);
    taskHistoryRequest=observer;
    const status=$('ownerTaskHistoryStatus');
    status.textContent=message;
    syncTaskHistory();
    if(taskHistory.contains(opener)&&opener.disabled)close.focus({preventScroll:true});
    try{
      const value=await net(suffix,'GET',null,json,observer.signal);
      if(taskHistoryRequest!==observer||!sameSource(from,source()))return;
      if(observer.signal.aborted)throw Error('cancelled');
      receive(value);
    }catch(error){
      if(taskHistoryRequest!==observer)return;
      if(['http_401','http_403','source_changed'].includes(error.message))clearPrivate();
      else{
        if(isPage)taskHistoryPage=null;
        status.textContent=error.message==='http_409'?'历史已有变化。请重新查找第一页。':
          error.message==='http_422'?'日期范围或筛选条件无效。':'历史状态暂不可核实。可重新查询。';
        if(isPage&&$('ownerTaskHistoryItems').childElementCount)status.textContent+=' 下方为上次核实的历史。';
      }
    }finally{
      clearTimeout(deadline);
      if(taskHistoryRequest===observer){
        taskHistoryRequest=null;syncTaskHistory();
        if(document.activeElement===close&&taskHistory.contains(opener)&&!opener.disabled)opener.focus({preventScroll:true});
      }
    }
  }

  function readTaskHistoryDetail(item){
    const itemPurpose=item.request.purpose;
    return readTaskHistory('/'+item.id+'?purpose='+itemPurpose,'正在读取冻结记录。',value=>{
      const run=checked(value,{id:item.id,intent:item.intent_id,history:true},itemPurpose);
      if(run.record_id!==item.record_id)throw Error('contract');
      taskHistoryDetail.replaceChildren();
      taskHistoryDetail.dataset.runId=run.id;
      renderRunEvidence(run,taskHistoryDetail,item.submitted_at,item.finished_at);
      $('ownerTaskHistoryStatus').textContent='已读取所选历史记录。'+
        (taskHistoryPage?'':' 当前列表仍为上次核实的历史。');
    });
  }

  function readTaskHistoryPage(filters){
    const query=new URLSearchParams();
    for(const [key,value] of Object.entries(filters))if(value!==null)query.set(key,value);
    return readTaskHistory('/history?'+query,'正在查询本人历史。',data=>{
      const rows=data?.runs,purposes=data?.available_purposes;
      const end=filters.offset+filters.limit;
      if(data?.schema_version!=='ocean-owner-task-history/v1'||!requestsMatch(filters,data.filters||{})||
          !hash.test(data.history_id)||(filters.history_id!==null&&filters.history_id!==data.history_id)||
          !Array.isArray(rows)||!Number.isInteger(data.total)||data.total<0||data.total>128||
          rows.length!==Math.min(filters.limit,Math.max(0,data.total-filters.offset))||
          data.next_offset!==(end<data.total?end:null)||
          !Array.isArray(purposes)||purposes.length>2||new Set(purposes).size!==purposes.length||
          purposes.some(value=>![legacyPurpose,distancePurpose].includes(value))||
          rows.some(item=>!id.test(item?.id)||!id.test(item.intent_id)||!hash.test(item.record_id)||
            !taskHistoryStatuses.has(item.status)||!purposes.includes(item.request?.purpose)||
            (item.submitted_at!==null&&!validTaskTime(item.submitted_at))||
            (item.finished_at!==null&&!validTaskTime(item.finished_at))||
            !validRequest(item.request,item.request.purpose)))throw Error('contract');
      for(const option of $('ownerTaskHistoryPurpose').options){
        option.disabled=Boolean(option.value)&&!purposes.includes(option.value);
      }
      taskHistoryPage=data;
      taskHistoryDetail.replaceChildren();
      delete taskHistoryDetail.dataset.runId;
      const entries=$('ownerTaskHistoryItems');entries.replaceChildren();
      for(const item of rows){
        const type=item.request.purpose===distancePurpose?'距离参照':'已知单元';
        const button=node(entries,'button',type+' · '+taskHistoryStatuses.get(item.status)+' · '+describe(item.request)+
          ' · '+(item.submitted_at?.slice(0,10)??'时间未知'));
        button.dataset.runId=item.id;
        button.onclick=()=>readTaskHistoryDetail(item);
      }
      $('ownerTaskHistoryStatus').textContent=rows.length?'第 '+(filters.offset+1)+' 至 '+(filters.offset+rows.length)+
        ' 条，共 '+data.total+' 条。':'当前条件下没有历史记录。';
    },true);
  }

  function historyFormFilters(){
    const data=new FormData(taskHistoryForm);
    return {purpose:data.get('purpose')||null,status:data.get('status')||null,
      start_date:data.get('start_date')||null,end_date:data.get('end_date')||null,limit:5,offset:0,history_id:null};
  }

  taskHistoryOpen.onclick=()=>{
    if(!taskHistory.hidden){hideTaskHistory();return;}
    taskHistory.hidden=false;
    taskHistoryOpen.setAttribute('aria-expanded','true');
    $('ownerTaskHistoryPurpose').focus({preventScroll:true});
    readTaskHistoryPage(historyFormFilters());
  };
  taskHistoryForm.onsubmit=event=>{event.preventDefault();readTaskHistoryPage(historyFormFilters());};
  $('ownerTaskHistoryPrevious').onclick=()=>{
    const filters=taskHistoryPage.filters;
    readTaskHistoryPage({...filters,offset:Math.max(0,filters.offset-filters.limit),history_id:taskHistoryPage.history_id});
  };
  $('ownerTaskHistoryNext').onclick=()=>readTaskHistoryPage({...taskHistoryPage.filters,offset:taskHistoryPage.next_offset,history_id:taskHistoryPage.history_id});
  $('ownerTaskHistoryClose').onclick=()=>{hideTaskHistory();taskHistoryOpen.focus({preventScroll:true});};
  taskHistory.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    event.preventDefault();
    event.stopPropagation();
    hideTaskHistory();taskHistoryOpen.focus({preventScroll:true});
  });

  function activePending(){return pending&&sameSource(pending.from,source())?pending:null;}
  function activeReference(){return reference&&source().kind==='server'&&reference.base===source().base?reference:null;}
  function cancellableIntent(){
    const ref=activeReference();
    return activePending()?.body.intent_id||(ref?.run_id===null?ref.intent_id:null);
  }
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
  function clearReference(){
    pending=null;prepared=null;reference=null;referenceError='';
    try{localStorage.removeItem(referenceKey);}catch{referenceError='unavailable';}
  }
  function set(state,message){root.dataset.state=state;$('ownerRunStatus').textContent=message;}
  function node(parent,tag,text){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;}
  function describe(p){return p.month+' · '+fmtCoord(p.longitude,p.latitude)+' · '+p.radius_km+' km';}
  function update(){
    const offline=source().kind!=='server'||(distanceMode()&&!navigator.onLine);
    const locked=offline||!$('ownerRunToken').value;
    $('ownerRunPurpose').disabled=publicSource().kind!=='server'||busy;
    $('ownerRunToken').disabled=offline||busy;
    const unresolved=activePending()||activeReference()?.run_id===null;
    $('ownerRunPrepare').disabled=locked||busy||!draft||!!unresolved;
    const mayResend=!distanceMode()&&activePending();
    $('ownerRunSubmit').disabled=locked||busy||!(mayResend||(prepared&&(!distanceMode()||!unresolved)));
    const attempt=prepared?.retry?.mode;
    $('ownerRunSubmit').textContent=mayResend?'核对/重发原提交意图（原条件）':
      attempt==='same_conditions'?'明确提交原条件重试':attempt==='current_conditions'?'明确提交当前条件的新请求':'明确提交合成任务';
    retryButton.hidden=retryCurrentButton.hidden=!distanceMode()||selected?.state!=='failed';
    retryButton.disabled=locked||busy||!!unresolved||retryButton.hidden;
    retryCurrentButton.disabled=retryButton.disabled||!draft;
    $('ownerRunRead').disabled=locked||busy||!selected;
    $('ownerRunNew').disabled=busy||(distanceMode()&&!!unresolved);
    $('ownerRunHistory').disabled=locked||busy;
    cancelButton.hidden=cancelStatus.hidden=!distanceMode();
    cancelButton.disabled=!distanceMode()||locked||!cancellableIntent()||Boolean(cancellation);
    $('ownerRunScope').textContent=distanceMode()
      ? '距离参照使用已登记合成小例。可以明确申请取消。关闭面板仅停止观察。'
      : '仅运行已登记合成小例，真实月研究仍待接入。小型同步受理，不提供队列、自动续跑或服务端取消；离开面板仅停止观察，已送达提交仍可能完成。';
    $('ownerRunFindIntent').disabled=locked||busy||!(activePending()||activeReference());
    for(const key of ['ownerRunExportMarkdown','ownerRunExportCsv']){
      $(key).hidden=distanceMode();
      $(key).disabled=distanceMode()||locked||busy||selected?.state!=='completed';
    }
    for(const button of items.querySelectorAll('button'))button.disabled=locked||(busy&&!['reading','downloading'].includes(root.dataset.state));
    referenceMessage();
    syncTaskHistory();
    preparation.sync();
  }
  function clearPrivate(clearToken=true){
    stopRecovery();
    preferredRun=null;
    clearCancellationStatus();
    hideTaskHistory(true);
    preparation.clear();
    generation++;controller?.abort();busy=false;prepared=null;selected=null;sessionSource=null;
    for(const url of downloads)URL.revokeObjectURL(url);downloads.clear();
    if(clearToken)$('ownerRunToken').value='';
    $('ownerRunPrepared').textContent='';$('ownerRunResult').replaceChildren();delete root.dataset.runId;
    items.replaceChildren();
    set('locked',pending?'观察已停止，令牌与私有显示已清除；原提交仍可能已受理，重新认证后核对原意图。':'已锁定；服务持久记录保留。');update();
  }
  function net(suffix,method='GET',body,read=json,signal=controller.signal){
    return ownerNet('/query/monthly-analysis/owner-runs',suffix,method,body,read,signal);
  }

  async function ownerNet(base,suffix,method,body,read,signal){
    const from=source(),token=$('ownerRunToken').value;
    if(from.kind!=='server')throw Error('offline');if(!token)throw Error('owner_required');
    if(sessionSource&&!sameSource(sessionSource,from))throw Error('source_changed');sessionSource=from;
    return read(from.base+base+suffix,signal,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }
  function stopCancellationObservation(){
    cancellation?.abort();
    cancellation=null;
  }

  function clearCancellationStatus(){
    stopCancellationObservation();
    cancellationIntent=null;
    observeCancellation=false;
    cancelStatus.textContent='';
  }

  function setCancellationStatus(intent,message){
    cancelStatus.textContent=message+' 意图 '+intent+'。';
  }

  function trackedCancellation(){
    return observeCancellation&&cancellableIntent()===cancellationIntent;
  }

  cancelButton.onclick=async()=>{
    const intent=cancellableIntent(),from=source();
    if(cancelButton.disabled||!intent)return;
    const observer=new AbortController();
    const timeout=setTimeout(()=>observer.abort(),6000);
    cancellation=observer;
    cancellationIntent=intent;
    observeCancellation=true;
    setCancellationStatus(intent,'正在向服务查询能否取消原提交。');
    update();
    try{
      const reply=await net('/intents/'+intent+'/cancel','POST',null,json,observer.signal);
      if(cancellation!==observer||!sameSource(from,source()))return;
      if(observer.signal.aborted)throw Error('cancelled');
      if(reply?.schema_version!=='ocean-owner-distance-cancel/v1'||reply.intent_id!==intent||
          !Object.hasOwn(cancelMessages,reply.state)||
          (['checking','cancelling','finishing'].includes(reply.state)?reply.run_id!==null:!id.test(reply.run_id)))throw Error('contract');
      setCancellationStatus(intent,cancelMessages[reply.state]);
      if(reply.state==='checking')observeCancellation=false;
      if(trackedCancellation()&&!busy)startRecovery();
    }catch(error){
      if(cancellation!==observer)return;
      if(['http_401','http_403','source_changed'].includes(error.message)){
        clearPrivate();
        cancelStatus.textContent='需要重新认证才能核对取消结果。';
      }else{
        setCancellationStatus(intent,'当前服务暂不可核实取消结果。可核对原意图。');
        if(trackedCancellation()&&!busy)startRecovery();
      }
    }finally{
      clearTimeout(timeout);
      if(cancellation===observer){cancellation=null;update();}
    }
  };

  function stopRecovery(){
    if(!recovery)return;
    clearTimeout(recovery.timer);
    recovery.controller?.abort();
    recovery=null;
  }

  function canRecover(from){
    return distanceMode() && root.open && !panel.hidden && !document.hidden &&
      navigator.onLine && !busy && from.kind==='server' && sameSource(from,source()) &&
      Boolean($('ownerRunToken').value);
  }

  function startRecovery(){
    stopRecovery();
    const from=source();
    if(!canRecover(from))return;
    const active=activePending(), ref=activeReference();
    const trackingCancellation=trackedCancellation();
    const preferred=!trackingCancellation&&preferredRun&&preferredRun===selected?.id?selected:null;
    const intent=preferred?.intent_id||active?.body.intent_id||ref?.intent_id;
    if(!intent||(root.dataset.state==='history'&&!trackingCancellation))return;
    const expected=preferred?{intent,id:preferred.id}:active?{intent,body:active.body,retry:active.retry,environmentId:active.environmentId}:{intent,id:ref.run_id};
    recovery={from,expected,index:0,timer:null,controller:null};
    scheduleRecovery(recovery);
  }

  function markCancellationUnknown(intent){
    if(cancellationIntent===intent){
      setCancellationStatus(intent,'取消终态暂不可核实。可手动核对原意图。');
    }
  }

  function scheduleRecovery(current){
    if(current.index>=recoveryDelays.length){
      markCancellationUnknown(current.expected.intent);
      stopRecovery();
      return;
    }
    current.timer=setTimeout(()=>readRecovery(current),recoveryDelays[current.index++]);
  }

  async function readRecovery(current){
    if(recovery!==current)return;
    if(!canRecover(current.from)){stopRecovery();return;}
    const active=new AbortController();
    current.controller=active;
    const timeout=setTimeout(()=>active.abort(),4000);
    try{
      const value=await net('/intents/'+current.expected.intent+purposeSuffix(),'GET',null,json,active.signal);
      if(recovery!==current)return;
      if(!canRecover(current.from)){stopRecovery();return;}
      if(active.signal.aborted)throw Error('cancelled');
      show(value,current.expected,true);
      stopRecovery();
    }catch(error){
      if(recovery!==current)return;
      if(['http_401','http_403','source_changed'].includes(error.message)){
        clearPrivate();
        $('ownerRunStatus').textContent='自动核对已停止，需要重新通过本人认证。';
      }else if(error.message==='contract'){
        set('uncertain','任务身份或内容暂不可核实，可手动核对原意图。');
        markCancellationUnknown(current.expected.intent);
        stopRecovery();
      }else{
        set('uncertain','原任务状态暂不可核实，可手动核对原意图。');
        scheduleRecovery(current);
      }
    }finally{clearTimeout(timeout);}
  }

  async function perform(work){
    if(busy)return;
    stopRecovery();
    controller?.abort();controller=new AbortController();const active=controller,n=++generation,timer=setTimeout(()=>active.abort(),distanceMode()?40000:10000),from=source(),opener=document.activeElement;
    let recoverAfterError=false;
    busy=true;update();if(root.contains(opener)&&opener.disabled)$('ownerRunLock').focus({preventScroll:true});
    try{await work(n,from);if(n!==generation)return;if(active.signal.aborted)throw Error('cancelled');if(!sameSource(from,source()))throw Error('source_changed');}
    catch(error){if(n!==generation)return;
      const operation=root.dataset.state;
      const authLost=['http_401','http_403','source_changed'].includes(error.message);
      const rejectedDistance=distanceMode()&&operation==='submitting'&&
        (['http_401','http_403','http_422'].includes(error.message)||
          error.cause?.get?.('X-Ocean-Submission-State')==='rejected');
      recoverAfterError=!rejectedDistance&&['submitting','looking-up'].includes(operation) &&
        !['http_401','http_403','http_409','http_422','source_changed','contract'].includes(error.message);
      if(rejectedDistance){
        if(cancellationIntent&&cancellableIntent()===cancellationIntent){
          const intent=cancellationIntent;
          clearCancellationStatus();
          setCancellationStatus(intent,'本次提交已被服务拒绝。');
        }
        clearReference();
        if(selected)saveReference({schema_version:referenceKey,base:from.base,intent_id:selected.intent_id,run_id:selected.id});
      }
      if(authLost)clearPrivate();
      if(active.signal.aborted&&root.dataset.state==='downloading'){set('error','文件读取10秒等待超时；所读冻结结果和草稿保留，可明确重试同一文件。');return;}
      if(error.message==='budget'){set('error','文件或响应超过1MiB读取预算，未下载；所读冻结结果和草稿保留。');return;}
      const expectedMissing = distanceMode() && root.dataset.state === 'checking' && error.message === 'http_409';
      const message=expectedMissing?'当前条件、来源或 P0 快照无法对应，未提交任务。':{http_401:'本人访问未通过；令牌和私有显示已清除。',http_403:'当前服务不允许本人合成任务；令牌和私有显示已清除。',http_503:'本人持久任务或合成输入不可用，请检查服务配置或稍后核对。',http_409:distanceMode()?'版本、意图或容量冲突；请核对原意图。':'版本、意图或容量冲突；请核对原意图或明确清除本页引用后重新准备。',http_422:'当前条件或版本没有登记合成支持，未显示受理成功。',http_404:'本次未查到记录或接口；原请求仍可能稍后提交，不能判断从未受理。可稍后核对或读取本人历史。',contract:'任务身份或内容无法核实，未显示成功。',source_changed:'服务来源已改变，请重新认证；旧服务意图只向原服务核对。',offline:'离线不能核对或提交本人任务。',owner_required:'请输入当前服务的本人令牌。'}[error.message]||'请求结果暂不可核实；保留上次核实的记录和原条件。';
      const pendingMessage=distanceMode()?' 原提交可能已受理；可核对原意图。':' 原提交可能已受理；可明确核对/重发同一意图，不会自动新建任务。';
      const unreachableRead=distanceMode()&&['reading','loading-history'].includes(operation)&&
        (active.signal.aborted||error instanceof TypeError||['http_502','http_503','http_504'].includes(error.message));
      if(authLost)$('ownerRunStatus').textContent=message;
      else if(rejectedDistance)set('error','服务已明确拒绝本次提交。可重新核对合成条件。');
      else set(activePending()||operation==='looking-up'||unreachableRead?'uncertain':'error',message+(activePending()?pendingMessage:''));
    }finally{clearTimeout(timer);if(n===generation){busy=false;update();if(recoverAfterError||trackedCancellation())startRecovery();if(!panel.hidden&&document.activeElement===$('ownerRunLock')&&root.contains(opener)&&!opener.disabled)opener.focus({preventScroll:true});}}
  }
  function validRequest(p,expectedPurpose=purpose) {
    if (p?.purpose !== expectedPurpose || !/^[12]\d{3}-(0[1-9]|1[0-2])$/.test(p.month) ||
        !Number.isFinite(p.longitude) || Math.abs(p.longitude)>180 ||
        !Number.isFinite(p.latitude) || Math.abs(p.latitude)>90 || ![10,20,30].includes(p.radius_km)) return false;
    if (expectedPurpose===distancePurpose) {
      return hash.test(p.input_version) && hash.test(p.support_snapshot_id) &&
        ['front_effort','front_effort_sst'].includes(p.layer_use) &&
        p.method_version === 'wgs84-distance-bands/v1' &&
        p.parameter_version === 'half-open-bands/v1';
    }
    return typeof p.input_version === 'string' && p.input_version.length>0 && p.input_version.length<=100 &&
      p.method_version === 'monthly-known-support/v1' && p.parameter_version === 'known-unit-membership/v1';
  }

  function validCancellationFlag(record,qualified){
    return !Object.hasOwn(record,'cancelled')||
      (qualified&&record.state==='failed'&&record.cancelled===true&&!Object.hasOwn(record,'failure_reason'));
  }

  function validRetryLink(record,qualified=distanceMode()){
    if(!Object.hasOwn(record,'retry'))return true;
    const link=record.retry;
    return qualified&&link&&hash.test(record.execution_environment_id)&&
      Object.keys(link).length===3&&id.test(link.parent_run_id)&&
      link.parent_run_id!==record.id&&hash.test(link.parent_record_id)&&
      ['same_conditions','current_conditions'].includes(link.mode);
  }

  function requestsMatch(left,right){
    return Object.keys(left).every(key=>left[key]===right[key]);
  }

  function retryLinksMatch(expected,actual){
    if(!expected)return !actual;
    return Boolean(actual&&requestsMatch(expected,actual));
  }

  function validDistanceEvidence(record) {
    const {request, qualification, result} = record;
    const validMeasure = value => value === null || (Number.isFinite(value) && value >= 0);
    if (request.input_version !== record.input_sha256 || qualification?.snapshot_id !== request.support_snapshot_id ||
        qualification.scope !== 'frozen_synthetic_validation') return false;
    if (Object.hasOwn(record,'failure_reason') &&
        (record.state !== 'failed' || !distanceFailureMessages.has(record.failure_reason))) return false;
    if (!validCancellationFlag(record,true)) return false;
    if (record.state === 'failed') return result === null && record.error?.code === 'calculation_failed';
    return result?.kind === distancePurpose && result.evidence_kind === 'synthetic' &&
      result.research_ready === false && result.qualification?.snapshot_id === qualification.snapshot_id &&
      result.qualification.scope === qualification.scope && hash.test(result.result_id) &&
      hash.test(result.versions?.direct_result_id) &&
      Object.keys(request).every(key => result.parameters?.[key] === request[key]) &&
      validMeasure(result.month?.common?.hours) && validMeasure(result.month?.common?.area_time_km2_days) &&
      validDistanceBands(result.distance_edges_km,result.month?.bands,validMeasure) &&
      Array.isArray(result.days) && result.days.length === daysInMonth(request.month) &&
      result.days.every((day, index) => day?.date === request.month+'-'+String(index+1).padStart(2,'0') &&
        validMeasure(day.common?.hours) && validMeasure(day.common?.effective_area_km2));
  }

  function validDistanceBands(edges, bands, validMeasure) {
    return Array.isArray(edges) && edges.length >= 1 && edges.length <= 6 &&
      edges.every((edge,index)=>Number.isFinite(edge)&&edge>(edges[index-1]??0)&&edge<=100) &&
      Array.isArray(bands) && bands.length === edges.length + 2 &&
      bands.every(band=>validMeasure(band?.hours)&&validMeasure(band?.area_time_km2_days));
  }

  function daysInMonth(month) {
    const [year, number] = month.split('-').map(Number);
    return new Date(Date.UTC(year, number, 0)).getUTCDate();
  }
  function validTaskTime(value){
    return typeof value==='string'&&Number.isFinite(Date.parse(value));
  }

  function checked(record,expected={},expectedPurpose=purpose){
    const qualified=expectedPurpose===distancePurpose;
    const schema = qualified ? 'ocean-owner-qualified-distance-run/v1' : 'ocean-owner-synthetic-run/v1';
    if(record?.schema_version!==schema||!id.test(record.id)||!id.test(record.intent_id)||!hash.test(record.record_id)||!hash.test(record.submission_id)||!hash.test(record.input_sha256)||!['completed','failed'].includes(record.state)||record.request?.purpose!==expectedPurpose||(expected.id&&record.id!==expected.id)||(expected.intent&&record.intent_id!==expected.intent))throw Error('contract');
    if(!validRequest(record.request,expectedPurpose)||
        (!expected.history&&(!validTaskTime(record.submitted_at)||!validTaskTime(record.finished_at))))throw Error('contract');
    if(Object.hasOwn(record,'execution_environment_id')&&
        (!qualified||!hash.test(record.execution_environment_id)))throw Error('contract');
    if(!validRetryLink(record,qualified))throw Error('contract');
    if(expected.body&&(record.input_sha256!==expected.body.input_sha256||
        !requestsMatch(expected.body.request,record.request)||!retryLinksMatch(expected.retry,record.retry)||
        (expected.retry&&expected.environmentId!==record.execution_environment_id)))throw Error('contract');
    if (qualified) {
      if (!validDistanceEvidence(record)) throw Error('contract');
      return record;
    }
    if(!validCancellationFlag(record,false))throw Error('contract');
    if(record.state==='completed'){
      const r=record.result;
      if(r?.evidence_kind!=='synthetic_example'||r.research_ready!==false||!r.source?.license.startsWith('CC0-1.0')||r.source.input_sha256!==record.input_sha256||!hash.test(r.result_id)||!Array.isArray(r.daily)||r.daily.length<28||r.daily.length>31||!Object.keys(record.request).every(k=>r.parameters[k]===record.request[k]))throw Error('contract');
    }else if(record.result!==null||record.error?.code!=='calculation_failed')throw Error('contract');
    return record;
  }
  function show(value,expected,background=false){
    const run=checked(value,expected),cancelled=run.cancelled===true;
    const fromCancellation=cancellationIntent===run.intent_id;
    const unresolved=(activePending()&&pending.body.intent_id!==run.intent_id)||
      (activeReference()?.run_id===null&&reference.intent_id!==run.intent_id);
    if(!unresolved){
      if(activePending()?.body.intent_id===run.intent_id)pending=null;
      saveReference({schema_version:referenceKey,base:sessionSource.base,intent_id:run.intent_id,run_id:run.id});
    }
    if(fromCancellation){
      clearCancellationStatus();
      setCancellationStatus(run.intent_id,cancelMessages[cancelled?'cancelled':run.state]);
    }
    if(background&&selected&&selected.id!==run.id&&(cancelled||fromCancellation)){
      preferredRun=selected.id;
      prepared=null;
      set(selected.cancelled?'cancelled':selected.state,'已核对原提交，并保留所选记录。');
      update();
      return;
    }
    const box=$('ownerRunResult');box.replaceChildren();selected=run;root.dataset.runId=run.id;
    renderRunEvidence(run,box);
    prepared=null;
    const message=cancelled?'已读取服务确认的取消记录。':run.state==='completed'
      ?'已读取可靠提交的合成任务结果；地图条件未改变。':'已读取持久失败记录；新尝试必须明确准备新的意图。';
    set(cancelled?'cancelled':run.state,message+(unresolved?' 原提交意图仍待核实，核对入口保留。':''));update();
  }
  function renderRunEvidence(run,box,submittedAt=run.submitted_at,finishedAt=run.finished_at){
    const qualified=run.request.purpose===distancePurpose;
    const layers=qualified?(run.request.layer_use==='front_effort_sst'?' · 锋面、活动与海温':' · 锋面与活动'):'';
    node(box,'p','原任务条件：'+describe(run.request)+layers);
    node(box,'p','任务 '+run.id+' / 意图 '+run.intent_id+' / '+run.record_id);
    if(run.retry)node(box,'p',(run.retry.mode==='same_conditions'?'原条件重试':'按当前条件的新请求')+
      ' · 原任务 '+run.retry.parent_run_id+' / '+run.retry.parent_record_id);
    if(run.execution_environment_id)node(box,'p','运行环境 '+run.execution_environment_id);
    const started=validTaskTime(submittedAt)?submittedAt:'未知';
    const finished=validTaskTime(finishedAt)?finishedAt:'未知';
    node(box,'p','服务处理 '+started+' 至 '+finished+'，终态已提交。'
      +(qualified?'合成距离参照':'合成软件验证')+'；真实研究资格未通过。');
    node(box,'p','这里只读冻结记录，当前原源可用及原样复算未知；没有自动公开或保存为案例。');
    if(run.state==='completed'){
      const r = run.result;
      if (qualified) showDistanceEvidence(box, r);
      else {
        const m = r.metrics;
        node(box,'p','结果 '+r.result_id);
        node(box,'p','H='+(m.total_hours??'未知')+' h；E='+(m.area_time_km2_days??'未知')+' km²·d；有效/日历日 '+m.supported_days+'/'+m.calendar_days+'。');
        showDaily(box, r.daily, r.caveats);
      }
    }else{
      node(box,'p',run.cancelled===true?'服务已确认取消原意图。没有发布结果。'
        :distanceFailureMessages.get(run.failure_reason)??generalFailureMessage);
    }
  }
  function showDistanceEvidence(box, result) {
    const common = result.month.common;
    const daily = result.days.map(({date,common}) => ({
      date,
      state: common.hours === null ? 'unknown_support' : common.state === 'partial' ? 'partial_support' : 'ready',
      hours: common.hours,
      effective_area_km2: common.effective_area_km2,
    }));
    node(box,'p','共同支持子集 H='+(common.hours??'未知')+' h，E='
      +(common.area_time_km2_days??'未知')+' km²·d，'
      +daily.filter(day=>day.hours!==null).length+'/'+daily.length+' 天有核验值。');
    node(box,'p','P0 '+result.qualification.snapshot_id+' / 结果 '+result.result_id);
    const bands = node(box,'details','');
    node(bands,'summary','月度距离分带');
    const list = node(bands,'ul','');
    const edges = result.distance_edges_km;
    result.month.bands.forEach((band,index)=>{
      const lower = edges[index-1]??0;
      const label = index>edges.length?'距离未知':
        index===edges.length?'≥ '+lower+' km':'['+lower+', '+edges[index]+') km';
      node(list,'li',label+' · '+(band.hours??'未知')+' h · '+(band.area_time_km2_days??'未知')+' km²·d');
    });
    showDaily(box,daily,['只统计已有共同支持，未知日保持未知。']);
  }

  function showDaily(box, daily, caveats) {
    const details=node(box,'details','');node(details,'summary','原逐日证据与局限');
    const wrap=node(details,'div','');wrap.className='monthly-chart-wrap';
    const chart=node(wrap,'div','');chart.className='monthly-chart';chart.setAttribute('role','img');
    const tables=node(details,'div','');tables.className='monthly-table-wrap';
    const table=node(tables,'table',''),head=table.createTHead().insertRow();
    for(const label of ['日期','状态','小时(h)','有效面积(km²)'])node(head,'th',label);
    table.createTBody();
    node(details,'p',OceanMonthEvidence.render(chart,table,daily));
    for(const line of caveats)node(details,'p',line);
  }

  function beginPreparation(message){
    prepared=null;
    $('ownerRunPrepared').textContent='';
    set('checking',message);
  }

  function acceptDistanceOptions(data,from,parent=null,mode=null){
    const environmentId=data?.execution_environment_id;
    if(data?.research_ready!==false||!validRequest(data.request)||!hash.test(environmentId)||
        data.input_sha256!==data.request.input_version)throw Error('contract');
    const retry=parent?{parent_run_id:parent.id,parent_record_id:parent.record_id,mode}:null;
    prepared={from,input_sha256:data.input_sha256,request:data.request,retry,environmentId};
    const conditions=describe(data.request);
    $('ownerRunPrepared').textContent=!parent?'将提交合成距离条件 '+conditions+' / '+data.request.support_snapshot_id:
      (mode==='same_conditions'?'按原条件重试 ':'按当前条件提交新请求 ')+conditions+
      '。原任务 '+parent.id+'，原条件 '+describe(parent.request)+'，原数据 '+parent.input_sha256+
      '。图层方案 '+parent.request.layer_use+' → '+data.request.layer_use+
      '，P0 '+parent.request.support_snapshot_id+' → '+data.request.support_snapshot_id+
      '，本次数据 '+data.input_sha256+'。运行环境 '+
      (parent.execution_environment_id??'未知')+' → '+environmentId+'。';
    set('prepared','合成距离条件已核对。明确提交后才开始计算，实际受理时重新验证来源。');
  }

  async function prepareCurrentDistance(n,from,values,parent=null){
    const data=await net('/distance-options?'+new URLSearchParams(values));
    if(n!==generation)return;
    if(data?.schema_version!=='ocean-owner-distance-options/v1'||!validRequest(data.request)||
        data.request.layer_use!=='front_effort'||
        !['month','longitude','latitude','radius_km'].every(key=>data.request[key]===values[key]))throw Error('contract');
    if(parent&&requestsMatch(parent.request,data.request)&&data.input_sha256===parent.input_sha256&&
        data.execution_environment_id===parent.execution_environment_id){
      set('error','当前条件和资料与原任务一致，可以核对原条件重试。');
      return;
    }
    acceptDistanceOptions(data,from,parent,parent?'current_conditions':null);
  }

  retryButton.onclick=()=>{
    if(retryButton.disabled)return;
    const parent=selected;
    return perform(async(n,from)=>{
      beginPreparation('正在核对原条件和原登记版本。');
      let data;
      try{data=await net('/'+parent.id+'/retry-options');}
      catch(error){
        if(!['http_404','http_409','http_503'].includes(error.message))throw error;
        if(n===generation)set('error','原条件、资料或运行环境暂无法核验，当前不能按原条件重试。可明确核对当前条件。');
        return;
      }
      if(n!==generation)return;
      if(data?.schema_version!=='ocean-owner-distance-retry-options/v1'||data.parent_run_id!==parent.id||
          data.parent_record_id!==parent.record_id||data.input_sha256!==parent.input_sha256||
          data.execution_environment_id!==parent.execution_environment_id||!validRequest(data.request)||!requestsMatch(parent.request,data.request))throw Error('contract');
      acceptDistanceOptions(data,from,parent,'same_conditions');
    });
  };

  retryCurrentButton.onclick=()=>{
    if(retryCurrentButton.disabled)return;
    const parent=selected,values=draft;
    return perform((n,from)=>{
      beginPreparation('正在核对当前草稿和当前登记版本。');
      return prepareCurrentDistance(n,from,values,parent);
    });
  };

  $('ownerRunPrepare').onclick=()=>perform(async(n,from)=>{
    beginPreparation('正在核对合成条件。');
    const values=draft;
    if(distanceMode())return prepareCurrentDistance(n,from,values);
    const data=await net('/options');if(n!==generation)return;
    const match=data.conditions?.find(c=>['month','longitude','latitude','radius_km'].every(k=>c[k]===values[k]));
    if(data.schema_version!=='ocean-owner-synthetic-options/v1'||data.evidence_kind!=='synthetic_example'||data.research_ready!==false||!hash.test(data.input_sha256)||!data.license?.startsWith('CC0-1.0'))throw Error('contract');
    if(!match)throw Error('http_422');
    prepared={from,input_sha256:data.input_sha256,request:{purpose:'monthly_spatial_example',longitude:match.longitude,latitude:match.latitude,radius_km:match.radius_km,month:match.month,input_version:data.input_version,method_version:data.method_version,parameter_version:data.parameter_version}};
    $('ownerRunPrepared').textContent='将提交合成条件：'+describe(prepared.request)+' / '+data.input_sha256+'。明确提交才计算。';set('prepared','合成条件已核对；存储和源身份会在实际受理时复核。');
  });
  $('ownerRunSubmit').onclick=()=>perform(async(n,from)=>{
    preferredRun=null;
    clearCancellationStatus();
    if(!activePending()){
      if(!prepared)throw Error('contract');
      const intent=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      pending={from:prepared.from,body:{intent_id:intent,input_sha256:prepared.input_sha256,request:prepared.request},retry:prepared.retry,environmentId:prepared.environmentId};
      saveReference({schema_version:referenceKey,base:pending.from.base,intent_id:intent,run_id:null});
    }
    if(!sameSource(pending.from,from))throw Error('source_changed');
    const {body,retry,environmentId}=pending,intent=body.intent_id;
    set('submitting','正在等待服务受理结果；关闭观察不取消已送达提交。');
    update();
    const suffix=retry?'/'+retry.parent_run_id+'/retry':'';
    const submission=retry?{...body,parent_record_id:retry.parent_record_id,mode:retry.mode,
      execution_environment_id:environmentId}:body;
    const result=await net(suffix,'POST',submission);
    if(n===generation)show(result,{intent,body,retry,environmentId},true);
  });
  function readRecord(identity){
    if(busy&&['reading','downloading'].includes(root.dataset.state)){generation++;controller?.abort();busy=false;}
    return perform(async n=>{set('reading','正在核对所选持久记录；不会重新计算。');update();const value=await net('/'+identity+purposeSuffix());if(n!==generation)return;show(value,{id:identity});preferredRun=identity;});
  }
  $('ownerRunRead').onclick=()=>readRecord(selected.id);
  function download(format){
    const frozen=selected;if(frozen?.state!=='completed')return;
    return perform(async(n,from)=>{
      set('downloading','正在重新核本人及所读冻结记录；尚未交给浏览器下载。');update();
      const expected={record_id:frozen.record_id,result_id:frozen.result.result_id},query=new URLSearchParams(expected);
      const bytes=await net('/'+frozen.id+'/exports/'+format+'?'+query,'GET',null,(url,signal,options)=>OceanPublicRead.bytes(url,signal,options,expected));
      if(n!==generation)return;if(controller.signal.aborted)throw Error('cancelled');if(!sameSource(from,source()))throw Error('source_changed');
      const extension=format==='csv'?'csv':'md',media=format==='csv'?'text/csv;charset=utf-8':'text/markdown;charset=utf-8';
      const url=URL.createObjectURL(new Blob([bytes],{type:media}));downloads.add(url);
      const link=document.createElement('a');link.href=url;link.download=`Ocean-run-${frozen.id}-${frozen.record_id.slice(7,19)}.${extension}`;document.body.append(link);link.click();link.remove();
      setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(url);},1000);
      set('downloaded','已核对所读任务身份与文件字节，交给浏览器下载；原草稿保留，未自动公开或保存为案例。');
    });
  }
  $('ownerRunExportMarkdown').onclick=()=>download('markdown');$('ownerRunExportCsv').onclick=()=>download('csv');
  $('ownerRunHistory').onclick=()=>perform(async n=>{
    set('loading-history','正在读取本人服务目录；原有显示保留为上次核实内容。');const data=await net(purposeSuffix());if(n!==generation)return;
    if(data?.schema_version!=='ocean-owner-synthetic-history/v1'||!Array.isArray(data.runs)||data.runs.length>64||new Set(data.runs.map(r=>r.id)).size!==data.runs.length||data.runs.some(r=>!id.test(r.id)||!id.test(r.intent_id)||!hash.test(r.record_id)||!['completed','failed'].includes(r.state)||!validCancellationFlag(r,distanceMode())||!validRetryLink(r)||!validRequest(r.request)||!Number.isFinite(Date.parse(r.finished_at))))throw Error('contract');
    items.replaceChildren();for(const run of data.runs){const button=node(items,'button',describe(run.request)+' · '+(distanceMode()&&run.cancelled===true?'已取消':run.state==='completed'?'已完成':'计算失败')+' · '+run.finished_at);button.dataset.runId=run.id;button.onclick=()=>readRecord(run.id);}
    if(!data.runs.length)node(items,'p','当前未查到已提交终态；在途请求仍可能稍后出现。');
    set('history','已读取全部 '+data.runs.length+' 条本人持久记录；选择后只读原条件和冻结结果。');
  });
  $('ownerRunFindIntent').onclick=()=>perform(async n=>{
    const active=activePending(),ref=activeReference(),intent=active?.body.intent_id||ref?.intent_id;if(!intent)throw Error('contract');
    preferredRun=null;
    set('looking-up','正在查询原意图是否已有终态记录；不会重新计算。');const value=await net('/intents/'+intent+purposeSuffix());if(n!==generation)return;
    show(value,{intent,...(active?{body:active.body,retry:active.retry,environmentId:active.environmentId}:ref?.run_id?{id:ref.run_id}:{})});
  });
  $('ownerRunNew').onclick=()=>{stopRecovery();clearCancellationStatus();preferredRun=null;clearReference();set('draft','已清除本地提交引用；服务任务没有取消或删除，可重新核对条件以明确创建新意图。');update();};
  $('ownerRunPurpose').onchange=()=>{
    const previousSource=sessionSource;
    pendingByPurpose.set(purpose,pending);
    purpose=$('ownerRunPurpose').value;
    pending=pendingByPurpose.get(purpose)||null;
    referenceKey=distanceMode()?'ocean-owner-qualified-distance-run-ref/v1':'ocean-owner-synthetic-run-ref/v1';
    reference=null;referenceError='';
    readReference();
    const nextSource=source();
    const retainToken=previousSource&&nextSource.kind==='server'&&sameSource(previousSource,nextSource);
    clearPrivate(!retainToken);
    if(retainToken)sessionSource=nextSource;
  };
  $('ownerRunLock').onclick=()=>clearPrivate();$('ownerRunToken').oninput=()=>{clearPrivate(false);sessionSource=source();};
  window.addEventListener('ocean-month-draft',e=>{if(root.dataset.state==='checking'){generation++;controller?.abort();busy=false;}draft=e.detail?.longitude===null?null:e.detail;prepared=null;$('ownerRunPrepared').textContent='';if(!busy&&!pending)set('draft','条件已改变；请重新核对。');update();});
  window.addEventListener('ocean-month-draft-closed',()=>clearPrivate());
  window.addEventListener('ocean-load-state',()=>{if(sessionSource&&!sameSource(sessionSource,source()))clearPrivate();update();});
  root.addEventListener('toggle',()=>{
    if(root.open){startRecovery();return;}
    stopRecovery();stopCancellationObservation();stopTaskHistoryRequest();preparation.stop();update();
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){startRecovery();return;}
    stopRecovery();stopCancellationObservation();stopTaskHistoryRequest();preparation.stop();update();
  });
  window.addEventListener('offline',()=>{
    stopRecovery();stopCancellationObservation();stopTaskHistoryRequest();
    preparation.stop('网络断开，准备预览暂不可核实。');
    if(!taskHistory.hidden)$('ownerTaskHistoryStatus').textContent='网络断开，历史状态暂不可核实。';
    const from=source();
    if(distanceMode()&&!panel.hidden&&root.open&&sessionSource&&sameSource(from,sessionSource)){
      generation++;
      controller?.abort();
      busy=false;
      prepared=null;
      $('ownerRunPrepared').textContent='';
      if(selected||activePending()||activeReference()){
        set('uncertain','网络断开，当前状态暂不可核实。保留上次核实的记录和原条件。');
      }
    }
    update();
  });
  window.addEventListener('online',()=>{update();startRecovery();});
  readReference();update();
})();
