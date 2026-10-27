/* Explicit lightweight read in the existing explanation pane. No execution or polling. */
(function () {
  const panel=document.getElementById('operationalStatus'), button=document.getElementById('statusRefresh');
  const summary=document.getElementById('statusSummary'), stamp=document.getElementById('statusStamp');
  const rows=document.getElementById('statusLayers'), read=window.OceanPublicRead;
  const records=document.getElementById('statusRecords');
  let controller=null, generation=0, staleTimer=null, cooldown=null, saved=null;
  const names={process:'服务进程',map_index:'地图清单',published_read:'公开样例读取',analysis_execution:'分析执行',
    fishing_effort:'活动数据',p0_qualification:'研究资格',models:'模型',proxy:'代理链路',tasks:'持久任务',backups:'备份'};
  const states={responding:'可回答',registered:'已登记',empty_registry:'空清单',readable_example:'合成样例可读',
    not_connected:'未连接',not_probed:'未验证',disabled_by_profile:'本发布禁用',rules_only:'仅规则模式',read_failed:'读取失败'};
  function valid(value){
    if(value?.schema!=='ocean-operational-status/v1'||value.policy_version!=='ocean-light-status/1'||
       !Number.isFinite(Date.parse(value.sampled_at))||!Number.isFinite(value.sample_age_seconds)||
       value.sample_age_seconds<0||value.max_age_seconds!==90||value.min_interval_seconds!==30)throw Error('invalid_status');
    for(const key of Object.keys(names)){
      const layer=value.layers?.[key];
      if(!states[layer?.state]||(layer.last_success_at!==null&&!Number.isFinite(Date.parse(layer.last_success_at))))throw Error('invalid_layer');
    }
    if(value.release&&(!/^sha256:[a-f0-9]{64}$/.test(value.release.release_id)||
       !/^[a-f0-9]{40}$/.test(value.release.source_commit)||value.release.profile!=='isolated-read-only/v1'))throw Error('invalid_release');
    return value;
  }
  function textRow(label,text,target=rows){
    const p=document.createElement('p'),b=document.createElement('b'),span=document.createElement('span');
    b.textContent=label;span.textContent=text;p.append(b,span);target.append(p);
  }
  function invalidate(message,state){
    generation++;controller?.abort();clearTimeout(staleTimer);clearTimeout(cooldown);
    controller=null;button.disabled=false;panel.setAttribute('aria-busy','false');panel.dataset.state=state;
    summary.textContent=message;rows.replaceChildren();records.replaceChildren();
    stamp.textContent=saved?'上次采样 '+saved.sampled_at+'；当前状态未确认。':'';
  }
  function render(value,source){
    rows.replaceChildren();records.replaceChildren();saved=value;
    const clockAge=(Date.now()-Date.parse(value.sampled_at))/1000;
    const age=Math.max(value.sample_age_seconds,clockAge);
    const stale=age>value.max_age_seconds||clockAge< -5;
    panel.dataset.state=stale?'stale':'ready';
    summary.textContent=stale?'采样已陈旧或时间无法核对，请重新读取。':
      '入口可达 · '+(value.layers.fishing_effort.state==='registered'?'活动清单已登记，资格未核':
        value.layers.fishing_effort.state==='not_connected'?'活动数据未连接':'活动数据状态待核');
    stamp.textContent='采样 '+new Date(value.sampled_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）'+
      (value.release?' · 发布 '+value.release.source_commit.slice(0,8):' · 发布版本未知');
    for(const [key,name] of Object.entries(names)){
      const layer=value.layers[key];let text=states[layer.state];
      if(key==='map_index'&&layer.front&&layer.sst){
        for(const [label,item] of [['锋面',layer.front],['海温',layer.sst]]){
          if(!Number.isInteger(item.registered_days)||item.registered_days<0||item.registered_days>3660||
             [item.start,item.end].some(d=>d!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(d)))throw Error('invalid_registry');
          text+='；'+label+' '+item.registered_days+'天 '+(item.start??'未知')+' 至 '+(item.end??'未知');
        }
        text+='；历史归档，清单导出 '+(layer.generated_at??'未知')+'，更新频率未知，图层文件完整性未验证';
      }
      if(key==='fishing_effort'&&layer.state==='registered')text+='；仅清单，文件与研究资格未核';
      textRow(name,text);
      if(layer.last_success_at)textRow(name+'最近成功',layer.last_success_at,records);
    }
    textRow('访问路径','当前浏览器入口已收到响应；回环与代理需分别核实');
    textRow('边界','清单登记与合成样例不代表真实活动数据或研究就绪；未触发分析。');
    textRow('采样政策',value.policy_version+' · 最短30秒，90秒后陈旧',records);
    textRow('发布身份',value.release?value.release.release_id+' / '+value.release.source_commit:'未登记，不能推断生产版本',records);
    if(!stale)staleTimer=setTimeout(()=>{
      if(!read.sameSource(source,read.source()))return invalidate('读取来源已改变，请重新读取。','unknown');
      panel.dataset.state='stale';summary.textContent='采样已陈旧，请重新读取。';
    },Math.max(1,(value.max_age_seconds-age)*1000));
  }
  button.addEventListener('click',async()=>{
    const source=read.source();invalidate('正在读取…','loading');
    if(source.kind==='offline')return invalidate('离线地图可用；服务状态未连接。','offline');
    const current=generation,active=new AbortController();controller=active;button.disabled=true;panel.setAttribute('aria-busy','true');
    const timer=setTimeout(()=>active.abort(),3000);
    try{
      const value=valid(await read.json(source.base+'/status',active.signal));
      if(current!==generation)return;
      if(!read.sameSource(source,read.source()))return invalidate('读取来源已改变，请重新读取。','unknown');
      render(value,source);button.textContent='刷新状态';
      cooldown=setTimeout(()=>{button.disabled=false;},30000);
    }catch{
      if(current===generation)invalidate('暂时无法读取服务状态，地图仍可操作。','error');
    }finally{
      clearTimeout(timer);
      if(current===generation){controller=null;panel.setAttribute('aria-busy','false');}
    }
  });
  document.getElementById('serverModeToggle').addEventListener('click',()=>{
    invalidate('读取模式已改变，请重新读取状态。','unknown');
  });
})();
