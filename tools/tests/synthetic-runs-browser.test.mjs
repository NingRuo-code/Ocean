import test from "node:test";
import assert from "node:assert/strict";
import {launchBrowser,waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";
import {owner,headers,click,type} from "../lib/case-test-browser.mjs";

const edge=process.env.EDGE??"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function open(c,base){
  await c.send("Page.enable");await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,"#workbenchToggle");await click(c,"#monthlyDraftOpen");
  await c.evaluate("(()=>{for(const [id,value] of Object.entries({monthDraftMonth:'2024-02',monthDraftLongitude:'124.5',monthDraftLatitude:'30.2',monthDraftRadius:'20'})){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}})()");
  assert.ok(await c.evaluate("!!document.getElementById('ownerRuns')"),"Existing monthly draft exposes owner synthetic task flow");
  await click(c,"#ownerRuns summary");await type(c,"ownerRunToken",owner);
}

test("owner explicitly submits the existing synthetic calculation and reads durable same-support evidence without changing the map",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp,requests=[];
  c.onEvent(m=>{if(m.method==="Network.requestWillBeSent"&&m.params.request.url.includes("/owner-runs"))requests.push(m.params.request);});
  try{
    await c.send("Network.enable");await open(c,base);
    const map=await c.evaluate("({date:state.date,lon:state.lon,lat:state.lat,range:state.range})");
    await click(c,"#ownerRunPrepare");await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
    assert.equal(requests.filter(r=>r.method==="POST").length,0);
    await click(c,"#ownerRunSubmit");await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
    const id=await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),run=await(await fetch(base+"/api/query/monthly-analysis/owner-runs/"+id,{headers})).json();
    assert.equal(run.result.metrics.total_hours,40);assert.equal(run.result.metrics.area_time_km2_days,7);assert.equal(run.result.metrics.supported_days,2);assert.equal(run.result.daily.length,29);
    assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/40.*7.*2\/29/s);
    assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/合成.*真实研究/s);
    assert.equal(requests.filter(r=>r.method==="POST").length,1);
    await click(c,"#ownerRunRead");await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'&&!document.getElementById('ownerRunRead').disabled");
    assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),id);assert.equal(requests.filter(r=>r.method==="POST").length,1);
    assert.deepEqual(await c.evaluate("({date:state.date,lon:state.lon,lat:state.lat,range:state.range})"),map);
    assert.equal(await c.evaluate("document.getElementById('monthDraftSubmit').disabled"),true);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

test("a lost accepted response explicitly replays the same frozen intent despite changed draft conditions",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp,posts=[],pending=[];let accepted;
  c.onEvent(m=>{
    if(m.method==='Network.requestWillBeSent'&&m.params.request.url.endsWith('/owner-runs')&&m.params.request.method==='POST')posts.push(m.params.request.postData);
    if(m.method==='Fetch.requestPaused'&&m.params.responseStatusCode)pending.push((async()=>{const raw=await c.send('Fetch.getResponseBody',{requestId:m.params.requestId});accepted=JSON.parse(raw.base64Encoded?Buffer.from(raw.body,'base64').toString():raw.body);await c.send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Failed'});})());
  });
  try{
    await c.send('Network.enable');await open(c,base);await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/owner-runs',requestStage:'Response'}]});await click(c,'#ownerRunSubmit');
    await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='uncertain'&&!document.getElementById('ownerRunSubmit').disabled");await Promise.all(pending);assert.ok(accepted?.id);
    await c.evaluate("document.getElementById('monthDraftMonth').value='2024-03';document.getElementById('monthDraftMonth').dispatchEvent(new Event('input',{bubbles:true}))");
    await c.send('Fetch.disable');await click(c,'#ownerRunSubmit');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
    assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),accepted.id);assert.equal(posts.length,2);assert.equal(posts[0],posts[1]);
    assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/2024-02/);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

test("closing observation of an accepted submission clears the token while its durable result survives",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;let held,accepted;
  const pending=[];c.onEvent(m=>{if(m.method==='Fetch.requestPaused'&&m.params.responseStatusCode){held=m.params.requestId;pending.push((async()=>{const raw=await c.send('Fetch.getResponseBody',{requestId:held});accepted=JSON.parse(raw.base64Encoded?Buffer.from(raw.body,'base64').toString():raw.body);})());}});
  try{
    await open(c,base);await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/owner-runs',requestStage:'Response'}]});await click(c,'#ownerRunSubmit');
    await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='submitting'");
    for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,25));assert.ok(held);await Promise.all(pending);
    await click(c,'#monthDraftClose');assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value"),'');
    await c.send('Fetch.continueResponse',{requestId:held}).catch(()=>{});await c.send('Fetch.disable');
    assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),'');
    const response=await fetch(base+'/api/query/monthly-analysis/owner-runs/'+accepted.id,{headers});assert.equal(response.status,200);assert.deepEqual(await response.json(),accepted);
    await click(c,'#monthlyDraftOpen');await type(c,'ownerRunToken',owner);await click(c,'#ownerRunSubmit');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
    assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),accepted.id);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

test("unconfigured persistence never falls back to process memory or browser storage",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;
  try{
    await open(c,base);await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'");
    assert.equal(await c.evaluate("document.getElementById('ownerRunSubmit').disabled"),true);
    assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/持久任务或合成输入不可用/);
    assert.equal(await c.evaluate("JSON.stringify({...localStorage}).includes('self-authored-export-owner')"),false);
  }finally{await browser.close();}
},{caseOwnerToken:owner}));

test("denied submission clears owner evidence and a missing registered circle never submits",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp,pending=[];
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')pending.push(c.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:401,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')}));});
  try{
    await open(c,base);await c.evaluate("document.getElementById('monthDraftRadius').value='10';document.getElementById('monthDraftRadius').dispatchEvent(new Event('input',{bubbles:true}))");
    await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'");assert.equal(await c.evaluate("document.getElementById('ownerRunSubmit').disabled"),true);
    await c.evaluate("document.getElementById('monthDraftRadius').value='20';document.getElementById('monthDraftRadius').dispatchEvent(new Event('input',{bubbles:true}))");
    await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/owner-runs',requestStage:'Request'}]});await click(c,'#ownerRunSubmit');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='locked'");await Promise.all(pending);
    assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value"),'');assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),'');
    assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/令牌和私有显示已清除/);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

test("a changed echoed request cannot be shown as the submitted task even if its intent matches",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp,pending=[];
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused'&&m.params.responseStatusCode){pending.push((async()=>{
    const raw=await c.send('Fetch.getResponseBody',{requestId:m.params.requestId}),run=JSON.parse(raw.base64Encoded?Buffer.from(raw.body,'base64').toString():raw.body);
    run.request.month='2024-03';run.result.parameters.month='2024-03';
    await c.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(run)).toString('base64')});
  })());}});
  try{
    await open(c,base);await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
    await c.send('Fetch.enable',{patterns:[{urlPattern:'*/owner-runs',requestStage:'Response'}]});await click(c,'#ownerRunSubmit');
    await waitFor(c,"['uncertain','completed'].includes(document.getElementById('ownerRuns').dataset.state)");await Promise.all(pending);
    assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.state"),'uncertain');
    assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),'');
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));

test("editing conditions discards a pending preparation without discarding a sent submission intent",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;let held;
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')held=m.params.requestId;});
  try{
    await open(c,base);await c.send('Fetch.enable',{patterns:[{urlPattern:'*/owner-runs/options',requestStage:'Request'}]});await click(c,'#ownerRunPrepare');
    for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,25));assert.ok(held);
    await c.evaluate("document.getElementById('monthDraftMonth').value='2024-03';document.getElementById('monthDraftMonth').dispatchEvent(new Event('input',{bubbles:true}))");
    await c.send('Fetch.continueRequest',{requestId:held}).catch(()=>{});await c.send('Fetch.disable');
    await waitFor(c,"!document.getElementById('ownerRunPrepare').disabled");
    assert.equal(await c.evaluate("document.getElementById('ownerRunSubmit').disabled"),true);
    assert.equal(await c.evaluate("document.getElementById('ownerRunPrepared').textContent"),'');
    await click(c,'#ownerRunPrepare');await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
    assert.match(await c.evaluate("document.getElementById('ownerRunPrepared').textContent"),/2024-03/);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableSyntheticRuns:true}));
