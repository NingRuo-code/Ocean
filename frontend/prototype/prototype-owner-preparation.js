/* Owner archive-plan preview using the same authenticated workbench session. */
(function(){
  const identity=/^sha256:[0-9a-f]{64}$/,taskId=/^[0-9a-f]{32}$/,key=/^[a-z0-9][a-z0-9_.-]{0,63}$/;
  const layerNames={front:'锋面',front_intensity:'锋面强度',sst:'海温',effort:'活动'};
  const purposeNames={map:'地图',A_month:'A 月分析',B_event:'B 事件',description:'资料说明'};
  const targetNames={day_artifact:'单日展示产物',support_input:'支持审计输入'};
  const reasonNames={
    credential_unavailable:'缺少凭据',credential_unknown:'凭据要求未知',source_version_unknown:'源版本未知',
    archive_access_unknown:'归档访问未知',connector_unsupported:'连接器不可用',coverage_unknown:'观测覆盖未知',
    authorization_blocked:'登记授权受限',authorization_unverified:'使用授权未核验',
    archive_manifest_unverified:'归档核验清单未知',adapter_unverified:'连接器或本地处理版本未核验',
    archive_unit_evidence_unknown:'所选原始单元尚无核验记录',scope_adapter_unsupported:'当前资料层、用途或处理目标暂无适配',
  };
  const evidenceFields={credential_check:'凭据验证',archive_access:'归档访问',connector:'连接器',processing:'本地处理',
    license:'使用许可',cost:'费用条件'};
  const evidenceStates={unknown:'未知',unavailable:'不可用',unsupported:'未支持',blocked:'受限'};
  const unitNames={reusable:'同版本复用',to_prepare:'待准备',blocked:'受限'};
  const taskNames={accepted:'已受理',processing:'处理中',validating:'校验中',registering:'登记中',ready:'已就绪',failed:'准备失败'};
  const taskErrors={processing_failed:'处理或校验失败',evidence_changed:'登记证据已变化',
    worker_interrupted:'处理进程中断'};
  const canDescribe=(labels,value)=>typeof value==='string'&&Object.hasOwn(labels,value);

  function node(parent,tag,text){
    const element=document.createElement(tag);
    element.textContent=text;
    parent.append(element);
    return element;
  }

  function reasonMessage(reason){
    if(typeof reason!=='string')throw Error('contract');
    if(Object.hasOwn(reasonNames,reason))return reasonNames[reason];
    for(const [field,title] of Object.entries(evidenceFields)){
      if(reason.startsWith(field+'_')){
        const state=reason.slice(field.length+1);
        if(Object.hasOwn(evidenceStates,state))return title+evidenceStates[state];
      }
    }
    throw Error('contract');
  }

  function fillSelect(input,values,labels={}){
    input.replaceChildren(new Option('请选择',''));
    for(const value of values)input.add(new Option(labels[value]||value,value));
  }

  function validSources(data){
    return data?.schema_version==='ocean-owner-preparation-registry/v1'&&identity.test(data.registry_id)&&
      (data.preparation_evidence_id===null||identity.test(data.preparation_evidence_id))&&
      Array.isArray(data.sources)&&data.sources.length<=32&&
      new Set(data.sources.map(item=>item.source_id)).size===data.sources.length&&data.sources.every(item=>
        key.test(item.source_id)&&typeof item.name==='string'&&item.name.length<=160&&
        ['start','end'].every(field=>item.date_coverage?.[field]===null||/^\d{4}-\d{2}-\d{2}$/.test(item.date_coverage?.[field]))&&
        Array.isArray(item.regions)&&item.regions.length<=16&&item.regions.every(region=>key.test(region))&&
        Array.isArray(item.layers)&&item.layers.length<=4&&item.layers.every(layer=>canDescribe(layerNames,layer))&&
        Array.isArray(item.purposes)&&item.purposes.length<=4&&item.purposes.every(purpose=>canDescribe(purposeNames,purpose))&&
        Array.isArray(item.targets)&&item.targets.length<=2&&item.targets.every(target=>canDescribe(targetNames,target))&&
        Array.isArray(item.reasons)&&item.reasons.length<=16&&item.reasons.every(reason=>Boolean(reasonMessage(reason))));
  }

  window.OceanOwnerPreparation=function mount({root,actions,request,canRead,lock}){
    const open=node(actions,'button','归档准备预览');open.id='ownerPreparationOpen';
    open.setAttribute('aria-controls','ownerPreparation');
    open.setAttribute('aria-expanded','false');
    const panel=node(root,'section','');panel.id='ownerPreparation';panel.hidden=true;
    panel.innerHTML='<form id="ownerPreparationForm"><div class="month-draft-fields">'+
      '<label>归档产品<select id="ownerPreparationSource" name="source_id" required></select></label>'+
      '<label>登记区域<select name="region_id" required></select></label>'+
      '<label>观测起始日（UTC）<input name="start_date" type="date" required></label>'+
      '<label>观测结束日（UTC）<input name="end_date" type="date" required></label>'+
      '<label>用途<select name="purpose" required></select></label>'+
      '<label>处理目标<select name="target" required></select></label></div>'+
      '<fieldset id="ownerPreparationLayers"><legend>资料层</legend></fieldset>'+
      '<div class="monthly-actions"><button id="ownerPreparationPreview" type="submit">预览准备范围</button>'+
      '<button id="ownerPreparationRefresh" type="button">刷新登记</button>'+
      '<button id="ownerPreparationClose" type="button">收起预览</button></div></form>'+
      '<p id="ownerPreparationStatus" role="status"></p><div id="ownerPreparationResult"></div>'+
      '<div id="ownerPreparationTask" hidden><button id="ownerPreparationReadTask" type="button">读取准备任务</button>'+
      '<button id="ownerPreparationReplayTask" type="button" hidden>重试同一提交</button>'+
      '<p id="ownerPreparationTaskStatus" role="status"></p><div id="ownerPreparationTaskDetails"></div></div>';
    const find=id=>panel.querySelector('#'+id);
    const form=find('ownerPreparationForm'),fields=form.elements,status=find('ownerPreparationStatus');
    const result=find('ownerPreparationResult'),source=find('ownerPreparationSource');
    const submit=find('ownerPreparationPreview'),refresh=find('ownerPreparationRefresh'),close=find('ownerPreparationClose');
    const taskPanel=find('ownerPreparationTask'),taskRead=find('ownerPreparationReadTask');
    const taskMessage=find('ownerPreparationTaskStatus'),taskDetails=find('ownerPreparationTaskDetails');
    const replay=find('ownerPreparationReplayTask');
    let registry=null,observer=null,task=null,taskTimer=null,execute=null;

    function sync(){
      open.disabled=!canRead();
      refresh.disabled=open.disabled||Boolean(observer);
      submit.disabled=refresh.disabled||!registry||!source.value;
      taskRead.disabled=refresh.disabled||!task;
      replay.disabled=taskRead.disabled;
      if(execute)execute.disabled=refresh.disabled||Boolean(task&&(!task.finished||task.plan===execute.dataset.planId));
    }

    function stop(message){
      observer?.abort();
      observer=null;
      if(message&&!panel.hidden)status.textContent=message;
      sync();
    }

    function clearResult(){
      result.replaceChildren();
      execute=null;
      delete result.dataset.planId;
    }

    function hide(clear=false){
      stop();
      clearTimeout(taskTimer);
      panel.hidden=true;
      open.setAttribute('aria-expanded','false');
      if(clear){
        registry=null;
        form.reset();
        fillSelect(source,[]);
        chooseSource();
        taskDetails.replaceChildren();
        delete taskDetails.dataset.state;
        if(task)task.submission=null;
        replay.hidden=true;
        taskMessage.textContent='';
        status.textContent='';
      }
      sync();
    }

    async function read(suffix,method,body,message,receive,messageTarget=status,onError=()=>{}){
      if(!canRead()||panel.hidden)return;
      stop();
      const active=new AbortController();
      const opener=document.activeElement;
      observer=active;
      const timeout=setTimeout(()=>active.abort(),6000);
      messageTarget.textContent=message;
      sync();
      if(panel.contains(opener)&&opener.disabled)close.focus({preventScroll:true});
      try{
        const value=await request(suffix,method,body,active.signal);
        if(observer!==active||!canRead())return;
        if(active.signal.aborted)throw Error('cancelled');
        receive(value);
      }catch(error){
        if(observer!==active)return;
        if(['http_401','http_403','source_changed'].includes(error.message))lock();
        else {
          onError(error);
          messageTarget.textContent=error.message==='http_409'?'准备计划已变化，请重新预览。':
          error.message==='http_429'?'已有准备任务在运行。':
          error.message==='http_404'?'暂未查到该准备任务。':
          error.message==='http_422'?'所选日期、区域或用途超出登记范围。':
          error.message==='registry'?'登记清单已变化，请刷新登记后重新核对。':'当前状态暂不可核实。';
        }
      }finally{
        clearTimeout(timeout);
        if(observer===active){
          observer=null;
          sync();
          if(document.activeElement===close&&panel.contains(opener)&&!opener.disabled)opener.focus({preventScroll:true});
        }
      }
    }

    function chooseSource(){
      const entry=registry?.sources.find(item=>item.source_id===source.value);
      fillSelect(fields.region_id,entry?.regions||[]);
      fillSelect(fields.purpose,entry?.purposes||[],purposeNames);
      fillSelect(fields.target,entry?.targets||[],targetNames);
      for(const field of [fields.start_date,fields.end_date]){
        field.min=entry?.date_coverage.start||'';
        field.max=entry?.date_coverage.end||'';
      }
      const layers=find('ownerPreparationLayers');
      layers.querySelectorAll('label').forEach(label=>label.remove());
      for(const value of entry?.layers||[]){
        const label=node(layers,'label','');
        const input=node(label,'input','');
        input.name='layers';input.type='checkbox';input.value=value;
        label.append(' '+layerNames[value]+' ');
      }
      clearResult();
      status.textContent=entry?(entry.reasons.length?'登记仍需核对 '+entry.reasons.map(reasonMessage).join('、')+'。':
        '请选择具体日期、区域、资料层和用途。'):'请选择登记归档产品。';
      sync();
    }

    function loadRegistry(){
      registry=null;fillSelect(source,[]);chooseSource();
      read('/registry','GET',null,'正在读取登记归档。',data=>{
        if(!validSources(data))throw Error('contract');
        registry=data;
        fillSelect(source,data.sources.map(item=>item.source_id),Object.fromEntries(data.sources.map(item=>[item.source_id,item.name])));
        chooseSource();
        source.focus({preventScroll:true});
        if(task)scheduleTaskRead();
      });
    }

    function showPlan(data,expected){
      if(data?.schema_version!=='ocean-owner-preparation-plan/v1'||!identity.test(data.plan_id)||
          data.execution_started!==false||typeof data.can_prepare!=='boolean'||typeof data.can_execute!=='boolean'||
          !Array.isArray(data.reasons)||data.reasons.length>16||
          !Array.isArray(data.units)||data.units.length>124||
          (data.source_version!==null&&!identity.test(data.source_version))||
          (data.estimated_preparation_bytes!==null&&(!Number.isSafeInteger(data.estimated_preparation_bytes)||data.estimated_preparation_bytes<0)))throw Error('contract');
      if(data.registry_id!==registry.registry_id||data.preparation_evidence_id!==registry.preparation_evidence_id)throw Error('registry');
      const bbox=data.bbox;
      if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||
          Math.abs(bbox[0])>180||Math.abs(bbox[2])>180||Math.abs(bbox[1])>90||Math.abs(bbox[3])>90||
          bbox[0]>=bbox[2]||bbox[1]>=bbox[3])throw Error('contract');
      const request=data.request;
      if(!request||Object.keys(expected).some(name=>name==='layers'
          ?String(request.layers)!==String(expected.layers):request[name]!==expected[name]))throw Error('contract');
      const start=Date.parse(expected.start_date),day=86400000;
      const expectedCount=((Date.parse(expected.end_date)-start)/day+1)*expected.layers.length;
      if(data.units.length!==expectedCount||data.units.some((unit,index)=>
          unit.date!==new Date(start+Math.floor(index/expected.layers.length)*day).toISOString().slice(0,10)||
          unit.layer!==expected.layers[index%expected.layers.length]||!canDescribe(unitNames,unit.state)||
          (unit.state==='reusable'?!identity.test(unit.artifact_id):unit.artifact_id!==null)))throw Error('contract');
      const reasons=data.reasons.map(reasonMessage);
      const eligible=reasons.length===0;
      if((eligible&&data.source_version===null)||
          data.units.some(unit=>eligible?unit.state==='blocked':unit.state==='to_prepare')||
          data.can_prepare!==(eligible&&data.units.some(unit=>unit.state==='to_prepare'))||
          (data.can_execute&&(!data.can_prepare||data.units.length!==1)))throw Error('contract');

      clearResult();
      result.dataset.planId=data.plan_id;
      node(result,'p','准备计划 '+data.plan_id);
      node(result,'p','源版本 '+(data.source_version??'未知'));
      node(result,'p',expected.start_date+' 至 '+expected.end_date+' · '+expected.region_id+
        ' · '+purposeNames[expected.purpose]+' · '+targetNames[expected.target]);
      node(result,'p','登记区域（西、南、东、北） '+bbox.join('、'));
      node(result,'p','预计准备字节 '+(data.estimated_preparation_bytes?.toLocaleString()??'未知'));
      for(const reason of reasons)node(result,'p',reason);
      const rows=node(result,'ul','');
      for(const unit of data.units){
        node(rows,'li',unit.date+' · '+layerNames[unit.layer]+' · '+unitNames[unit.state]+
          (unit.artifact_id?' · '+unit.artifact_id:''));
      }
      if(data.can_execute){
        execute=node(result,'button','准备这一日锋面');
        execute.type='button';execute.id='ownerPreparationExecute';execute.dataset.planId=data.plan_id;
        execute.onclick=()=>startPreparation(data.plan_id,expected);
        sync();
      }
      status.textContent=reasons.length?'预览已生成，存在准备前置缺项。':
        data.can_prepare?'准备前置已核对，待准备范围见下方。':'本范围可使用同版本已登记产物。';
    }

    function showTask(value){
      if(!task||value?.schema_version!=='ocean-owner-preparation-task/v1'||!taskId.test(value.id)||
          value.intent_id!==task.intent||value.plan_id!==task.plan||
          (task.id&&value.id!==task.id)||!canDescribe(taskNames,value.state)||
          !Array.isArray(value.state_history)||value.state_history.length>5||
          value.state_history.at(-1)!==value.state||!value.state_history.every(stage=>canDescribe(taskNames,stage)))throw Error('contract');
      const artifact=value.artifact;
      if(value.state==='ready'){
        if(!artifact||!identity.test(artifact.artifact_id)||artifact.scope!=='private_map_display'||
            artifact.research_ready!==false||artifact.layer!=='front'||artifact.date!==value.request?.start_date||
            !['verified_time_coordinate','archive_member_name'].includes(artifact.date_basis)||
            !['valid','missing','front'].every(field=>Number.isSafeInteger(artifact.support?.[field])&&artifact.support[field]>=0))
          throw Error('contract');
      }else if(artifact!==null)throw Error('contract');
      if(value.state==='failed'?!canDescribe(taskErrors,value.error):value.error!==null)throw Error('contract');
      task.id=value.id;
      task.submission=null;
      replay.hidden=true;
      task.finished=['ready','failed'].includes(value.state);
      taskMessage.textContent=taskNames[value.state]+(value.error?' · '+taskErrors[value.error]:'');
      taskDetails.replaceChildren();
      taskDetails.dataset.state=value.state;
      node(taskDetails,'p',value.state_history.map(stage=>taskNames[stage]).join(' → '));
      if(artifact){
        node(taskDetails,'p',artifact.date+' · 锋面 · 地图展示 · 本人可见');
        node(taskDetails,'p','有效 '+artifact.support.valid+' 格，缺测 '+artifact.support.missing+' 格，锋线 '+artifact.support.front+' 格。');
        node(taskDetails,'p',artifact.date_basis==='archive_member_name'?'日期依据为原归档成员名，观测时刻仍待核。':'已核对时间坐标。');
        node(taskDetails,'p','研究用途资格待独立核验。');
      }
      if(!task.finished)scheduleTaskRead();
    }

    function scheduleTaskRead(){
      clearTimeout(taskTimer);
      taskTimer=setTimeout(()=>{
        if(!task||panel.hidden||!canRead())return;
        if(observer){scheduleTaskRead();return;}
        readTask();
      },450);
    }

    function readTask(){
      clearTimeout(taskTimer);
      if(!task||panel.hidden||!canRead())return;
      read('/intents/'+task.intent,'GET',null,'正在读取准备任务。',showTask,taskMessage);
    }

    function startPreparation(plan,selection){
      if(!execute||execute.disabled)return;
      const intent=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
      task={intent,plan,id:null,finished:false,submission:{intent_id:intent,plan_id:plan,request:selection}};
      taskPanel.hidden=false;
      taskDetails.replaceChildren();
      delete taskDetails.dataset.state;
      submitTask();
    }

    function submitTask(){
      if(!task?.submission)return;
      replay.hidden=true;
      read('/tasks','POST',task.submission,'正在提交锋面资料准备。',showTask,taskMessage,error=>{
        if(['http_409','http_422','http_429'].includes(error.message)){
          task=null;
          clearResult();
        }else if(task)replay.hidden=false;
      });
    }

    replay.onclick=submitTask;
    taskRead.onclick=readTask;
    open.onclick=()=>{
      if(!panel.hidden){hide();return;}
      panel.hidden=false;
      open.setAttribute('aria-expanded','true');
      refresh.focus({preventScroll:true});
      loadRegistry();
    };
    refresh.onclick=loadRegistry;
    close.onclick=()=>{hide();open.focus({preventScroll:true});};
    panel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.click();}
    });
    form.addEventListener('change',event=>{
      stop();clearResult();
      if(event.target===source)chooseSource();
      else status.textContent='已修改选择。可重新预览准备范围。';
    });
    form.onsubmit=event=>{
      event.preventDefault();
      if(submit.disabled)return;
      const data=new FormData(form);
      const selection={
        source_id:data.get('source_id'),region_id:data.get('region_id'),start_date:data.get('start_date'),
        end_date:data.get('end_date'),layers:data.getAll('layers').sort(),purpose:data.get('purpose'),target:data.get('target'),
      };
      if(!selection.layers.length){status.textContent='请选择至少一类资料层。';return;}
      clearResult();
      read('/plan','POST',selection,'正在核对准备范围。',value=>showPlan(value,selection));
    };
    sync();
    return {sync,stop,clear:()=>hide(true)};
  };
})();
