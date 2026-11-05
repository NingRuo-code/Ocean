import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {launchBrowser,waitFor} from '../lib/browser-driver.mjs';
import {withService} from '../lib/monthly-test-service.mjs';
import {owner,headers,click,type,downloaded} from '../lib/case-test-browser.mjs';

const edge=process.env.EDGE??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
async function submit(base,intent='b'.repeat(32)){
  const options=await(await fetch(base+'/api/query/monthly-analysis/owner-runs/options',{headers})).json(),c=options.conditions[0];
  const response=await fetch(base+'/api/query/monthly-analysis/owner-runs',{method:'POST',headers,body:JSON.stringify({intent_id:intent,input_sha256:options.input_sha256,request:{purpose:'monthly_spatial_example',longitude:c.longitude,latitude:c.latitude,radius_km:c.radius_km,month:c.month,input_version:options.input_version,method_version:options.method_version,parameter_version:options.parameter_version}})});
  assert.equal(response.status,200);return response.json();
}
async function open(c,base,run){
  await c.send('Page.enable');await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,'#workbenchToggle');await click(c,'#monthlyDraftOpen');await click(c,'#ownerRuns summary');await type(c,'ownerRunToken',owner);
  await click(c,'#ownerRunHistory');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='history'");
  await click(c,`#ownerRunItems [data-run-id="${run.id}"]`);await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
}
function url(base,run,format){return base+'/api/query/monthly-analysis/owner-runs/'+run.id+'/exports/'+format+'?record_id='+encodeURIComponent(run.record_id)+'&result_id='+encodeURIComponent(run.result.result_id);}

test('owner downloads the read durable synthetic task as exact Markdown and CSV without using changed drafts or publishing',()=>withService(async base=>{
  const run=await submit(base),browser=await launchBrowser(edge),c=browser.cdp,dir=await mkdtemp(join(tmpdir(),'ocean-run-files-')),requests=[];
  try{
    await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await c.send('Network.enable');
    c.onEvent(m=>{if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/monthly-analysis/'))requests.push(m.params.request);});
    await open(c,base,run);
    const map=await c.evaluate('({date:state.date,lon:state.lon,lat:state.lat,range:state.range})');
    await c.evaluate("document.getElementById('monthDraftMonth').value='2025-01';document.getElementById('monthDraftMonth').dispatchEvent(new Event('input',{bubbles:true}))");
    for(const [format,button,ext] of [['markdown','#ownerRunExportMarkdown','.md'],['csv','#ownerRunExportCsv','.csv']]){
      assert.ok(await c.evaluate(`!!document.querySelector('${button}')`),'Read owner task exposes deliberate file download');
      await click(c,button);const file=await downloaded(dir,ext),bytes=await readFile(file),response=await fetch(url(base,run,format),{headers});
      assert.equal(response.status,200);assert.deepEqual(bytes,Buffer.from(await response.arrayBuffer()));
      assert.equal(response.headers.get('x-content-sha256'),'sha256:'+createHash('sha256').update(bytes).digest('hex'));
      const text=format==='markdown'?bytes.toString('utf8').replace(/\\(.)/g,'$1'):bytes.toString('utf8');for(const value of [run.id,run.intent_id,run.record_id,run.result.result_id,'2024-02','owner_local_download'])assert.ok(text.includes(value),value);
      assert.doesNotMatch(text,/2025-01|Bearer|synthetic-case-owner-test/);assert.match(text,/真实研究资格未通过/);
      if(format==='csv'){assert.ok(bytes.subarray(0,3).equals(Buffer.from([239,187,191])));assert.match(text,/"2024-02-02","partial_support",0(?:\.0)?,2(?:\.0)?,2(?:\.0)?,1/);assert.match(text,/"2024-02-03","no_records","","","",0/);}
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='downloaded'&&!document.getElementById('ownerRunExportCsv').disabled");
    }
    assert.equal(requests.filter(r=>r.method!=='GET').length,0);
    assert.equal(requests.filter(r=>r.url.includes('/exports/')).length,2);
    assert.deepEqual(await c.evaluate('({date:state.date,lon:state.lon,lat:state.lat,range:state.range})'),map);
    assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),'2025-01');
    assert.equal((await(await fetch(base+'/api/query/monthly-analysis/owner-runs',{headers})).json()).runs.length,1);
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

for(const status of [401,403,409,503])test(`owner file HTTP ${status} has no download and respects the private-display boundary`,()=>withService(async base=>{
  const run=await submit(base),browser=await launchBrowser(edge),c=browser.cdp,dir=await mkdtemp(join(tmpdir(),'ocean-run-denied-')),pending=[];
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')pending.push(c.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')}));});
  try{
    await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await open(c,base,run);
    await c.evaluate("document.getElementById('monthDraftMonth').value='2025-01';document.getElementById('monthDraftMonth').dispatchEvent(new Event('input',{bubbles:true}))");
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/exports/csv?*',requestStage:'Request'}]});await click(c,'#ownerRunExportCsv');
    await waitFor(c,`document.getElementById('ownerRuns').dataset.state==='${status===401||status===403?'locked':'error'}'`);await Promise.all(pending);assert.deepEqual(await readdir(dir),[]);
    if(status===401||status===403){assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value"),'');assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),'');}
    else{
      assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/40.*7/s);
      assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),'2025-01');
      await c.send('Fetch.disable');await click(c,'#ownerRunExportCsv');assert.ok(await downloaded(dir,'.csv'));
    }
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

for(const fault of ['wrong_identity','missing_digest','corrupt_bytes','oversize'])test(`a 200 ${fault} file is rejected before browser download`,()=>withService(async base=>{
  const run=await submit(base),browser=await launchBrowser(edge),c=browser.cdp,dir=await mkdtemp(join(tmpdir(),'ocean-run-integrity-')),pending=[];
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')pending.push((async()=>{
    const body=await c.send('Fetch.getResponseBody',{requestId:m.params.requestId});let bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');
    let hs=m.params.responseHeaders.filter(h=>h.name.toLowerCase()!=='content-length');
    if(fault==='wrong_identity')hs=hs.map(h=>h.name.toLowerCase()==='x-ocean-record-id'?{...h,value:'sha256:'+'0'.repeat(64)}:h);
    if(fault==='missing_digest')hs=hs.filter(h=>h.name.toLowerCase()!=='x-content-sha256');
    if(fault==='corrupt_bytes')bytes=Buffer.from('HTML or changed file, not the expected bytes');
    if(fault==='oversize'){bytes=Buffer.alloc(1_048_577,120);hs=hs.map(h=>h.name.toLowerCase()==='x-content-sha256'?{...h,value:'sha256:'+createHash('sha256').update(bytes).digest('hex')}:h);}
    await c.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:hs,body:bytes.toString('base64')});
  })());});
  try{
    await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await open(c,base,run);
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/exports/csv?*',requestStage:'Response'}]});await click(c,'#ownerRunExportCsv');
    await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'&&!document.getElementById('ownerRunExportCsv').disabled");await Promise.all(pending);
    assert.deepEqual(await readdir(dir),[]);assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/40.*7/s);
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

for(const leave of ['lock','escape','offline','selection'])test(`leaving by ${leave} discards a late owner file without changing service tasks`,()=>withService(async base=>{
  const run=await submit(base),other=leave==='selection'?await submit(base,'c'.repeat(32)):null,browser=await launchBrowser(edge),c=browser.cdp,dir=await mkdtemp(join(tmpdir(),'ocean-run-late-'));let held;
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')held=m.params.requestId;});
  try{
    await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await open(c,base,run);
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/exports/markdown?*',requestStage:'Response'}]});await click(c,'#ownerRunExportMarkdown');
    for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,25));assert.ok(held);
    if(leave==='lock')await click(c,'#ownerRunLock');
    if(leave==='escape'){await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
    if(leave==='offline')await click(c,'#serverModeToggle');
    if(leave==='selection'){await click(c,`#ownerRunItems [data-run-id="${other.id}"]`);await waitFor(c,`document.getElementById('ownerRuns').dataset.runId==='${other.id}'`);}
    await c.send('Fetch.continueResponse',{requestId:held}).catch(()=>{});await c.send('Fetch.disable');await new Promise(r=>setTimeout(r,100));
    assert.deepEqual(await readdir(dir),[]);
    if(leave!=='selection'){assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value"),'');assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),'');}
    assert.equal((await(await fetch(base+'/api/query/monthly-analysis/owner-runs',{headers})).json()).runs.length,other?2:1);
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

test('a real ten-second download timeout keeps the old evidence and permits an explicit same-record retry',()=>withService(async base=>{
  const run=await submit(base),browser=await launchBrowser(edge),c=browser.cdp,dir=await mkdtemp(join(tmpdir(),'ocean-run-timeout-'));let held;
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')held=m.params.requestId;});
  try{
    await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await open(c,base,run);
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/exports/csv?*',requestStage:'Request'}]});await click(c,'#ownerRunExportCsv');
    await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'",15000);
    assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/10秒.*超时/);
    assert.deepEqual(await readdir(dir),[]);assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/40.*7/s);
    if(held)await c.send('Fetch.failRequest',{requestId:held,errorReason:'TimedOut'}).catch(()=>{});await c.send('Fetch.disable');
    await click(c,'#ownerRunExportCsv');assert.ok(await downloaded(dir,'.csv'));
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

for(const width of [1440,390])test(`owner frozen file controls and adjacent status are readable at ${width}px`,()=>withService(async base=>{
  const run=await submit(base),browser=await launchBrowser(edge),c=browser.cdp,dir=await mkdtemp(join(tmpdir(),'ocean-run-layout-'));
  try{
    await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await c.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await open(c,base,run);
    await click(c,'#ownerRunExportCsv');await downloaded(dir,'.csv');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='downloaded'");
    await c.evaluate("document.getElementById('ownerRunExportCsv').scrollIntoView({block:'center'})");
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth+2&&[...document.querySelectorAll('#ownerRuns button,#ownerRuns p')].filter(e=>e.clientWidth).every(e=>e.scrollWidth<=e.clientWidth+2)"),true);
    const rect=await c.evaluate("(()=>{const r=document.getElementById('ownerRunExportCsv').getBoundingClientRect();return {width:r.width,height:r.height}})()");assert.ok(rect.height>=40&&rect.width>=44);
    await mkdir('docs/reports/screenshots',{recursive:true});await writeFile(`docs/reports/screenshots/ocean-synthetic-run-export-${width}.png`,Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }finally{await browser.close();await rm(dir,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));
