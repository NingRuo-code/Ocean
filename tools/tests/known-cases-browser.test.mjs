import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { launchBrowser, waitFor } from "../lib/browser-driver.mjs";

import {withService} from "../lib/monthly-test-service.mjs";

const edge=process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function click(c, selector) {
  const p=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...p});
  await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...p});
}


test("actual workbench case search reads original A evidence without changing map or submitting tasks",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,requests=[];
 c.onEvent(m=>{if(m.method==='Network.requestWillBeSent')requests.push(m.params.request);});
 try{
  await c.send('Page.enable');await c.send('Network.enable');await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  const before=await c.evaluate("({date:state.date,lon:state.lon,lat:state.lat,range:state.range})");
  await click(c,'#workbenchToggle');await click(c,'#knownCaseOpen');
  await waitFor(c,"document.getElementById('knownCasesPane')?.dataset.state==='ready'");
  assert.equal(await c.evaluate("document.querySelectorAll('#caseCandidates button').length"),3);
  assert.match(await c.evaluate("document.getElementById('caseConditions').textContent"),/2024-08-05.*20/);
  assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
  await click(c,"#caseCandidates [data-case-id='case-2024-06']");
  await waitFor(c,"!document.getElementById('evidencePanel').hidden && document.getElementById('caseHours')?.textContent==='10'");
  assert.equal(await c.evaluate("document.getElementById('caseAreaTime').textContent"),'2');
  assert.equal(await c.evaluate("document.getElementById('caseDensity').textContent"),'5');
  assert.equal(await c.evaluate("document.querySelectorAll('#caseDayTable tbody tr').length"),30);
  assert.match(await c.evaluate("document.getElementById('caseDetailType').textContent"),/A月背景.*不是B事件/);
  const reads=requests.filter(r=>r.url.includes('/query/known-cases')).length;
  await click(c,'#evidenceClose');await click(c,'#caseReopen');
  assert.equal(requests.filter(r=>r.url.includes('/query/known-cases')).length,reads);
  assert.deepEqual(await c.evaluate("({date:state.date,lon:state.lon,lat:state.lat,range:state.range})"),before);
  assert.equal(requests.some(r=>r.method==='POST'),false);
 }finally{await b.close();}
}));


async function openCases(c,base){
 await c.send('Page.enable');await c.send('Network.enable');await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
 await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
 await click(c,'#workbenchToggle');await click(c,'#knownCaseOpen');
 await waitFor(c,"document.getElementById('knownCasesPane').dataset.state==='ready'");
}

test("case pages stay on the original query while applied and monthly draft edits mark it stale",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,requests=[];
 c.onEvent(m=>{if(m.method==='Network.requestWillBeSent')requests.push(m.params.request);});
 try{
  await openCases(c,base);const identity=await c.evaluate("document.getElementById('knownCasesPane').dataset.searchId");
  await click(c,'#caseMore');await waitFor(c,"document.querySelectorAll('#caseCandidates button').length===4");
  assert.equal(await c.evaluate("document.getElementById('knownCasesPane').dataset.searchId"),identity);
  await click(c,"#caseCandidates [data-case-id='case-2023-08']");await waitFor(c,"document.getElementById('caseHours')?.textContent==='0'");
  const reads=requests.filter(r=>r.url.includes('/query/known-cases')).length;
  await click(c,'#evidenceClose');await click(c,'#monthlyDraftOpen');
  await c.evaluate("const n=document.getElementById('monthDraftMonth');n.value='2024-02';n.dispatchEvent(new Event('input',{bubbles:true}))");
  assert.match(await c.evaluate("document.getElementById('caseStale').textContent"),/草稿已改变.*原检索/);
  assert.equal(requests.filter(r=>r.url.includes('/query/known-cases')).length,reads);
  await click(c,'#knownCaseOpen');assert.equal(await c.evaluate("document.getElementById('monthDraftPanel').hidden"),true);
  await click(c,'#headerFilter');await c.evaluate("document.getElementById('timeDate').value='2024-07-05';document.getElementById('timeDate').dispatchEvent(new Event('change',{bubbles:true}))");
  await click(c,'#filterClose');assert.match(await c.evaluate("document.getElementById('caseStale').textContent"),/条件已改变.*原检索/);
  assert.equal(await c.evaluate("document.getElementById('knownCasesPane').dataset.searchId"),identity);
  await click(c,'#caseSearch');await waitFor(c,`document.getElementById('knownCasesPane').dataset.state==='ready'&&document.getElementById('knownCasesPane').dataset.searchId!==${JSON.stringify(identity)}`);
  assert.match(await c.evaluate("document.getElementById('caseConditions').textContent"),/2024-07-05/);
  assert.equal(requests.some(r=>r.method==='POST'),false);
 }finally{await b.close();}
}));

test("offline case opening is honest and a denied service clears previously read evidence",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,pending=[];
 try{
  await c.send('Page.enable');await c.send('Page.navigate',{url:pathToFileURL(resolve('frontend/prototype/prototype-fishing.html')).href});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,'#workbenchToggle');await click(c,'#knownCaseOpen');
  await waitFor(c,"document.getElementById('knownCasesPane').dataset.errorCode==='offline'");
  assert.equal(await c.evaluate("document.querySelectorAll('#caseCandidates button').length"),0);
  await openCases(c,base);await click(c,"#caseCandidates [data-case-id='case-2024-06']");
  await waitFor(c,"document.getElementById('caseHours')?.textContent==='10'");
  c.onEvent(m=>{if(m.method==='Fetch.requestPaused')pending.push(c.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:403,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('{}').toString('base64')}));});
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*/query/known-cases?*',requestStage:'Request'}]});
  await click(c,'#caseSearch');await waitFor(c,"document.getElementById('knownCasesPane').dataset.errorCode==='http_403'");
  assert.equal(await c.evaluate("document.querySelectorAll('#caseCandidates button').length"),0);
  assert.equal(await c.evaluate("document.getElementById('caseEvidence').textContent"),'');
  assert.equal(await c.evaluate("document.getElementById('caseReopen').disabled"),true);
  assert.ok(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=sst]').length>0"));
  await Promise.allSettled(pending);await c.send('Fetch.disable');
 }finally{await b.close();}
}));

test("a late search cannot overwrite a new applied reference date",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,pending=[];let held=null;
 c.onEvent(m=>{if(m.method==='Fetch.requestPaused'){if(m.params.request.url.includes('reference_date=2024-08-05')&&!held)held=m.params.requestId;else pending.push(c.send('Fetch.continueRequest',{requestId:m.params.requestId}));}});
 try{
  await c.send('Page.enable');await c.send('Fetch.enable',{patterns:[{urlPattern:'*/query/known-cases?*',requestStage:'Request'}]});
  await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,'#workbenchToggle');await click(c,'#knownCaseOpen');for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
  await click(c,'#headerFilter');await c.evaluate("document.getElementById('timeDate').value='2024-07-05';document.getElementById('timeDate').dispatchEvent(new Event('change',{bubbles:true}))");await click(c,'#filterClose');
  await click(c,'#caseSearch');await waitFor(c,"document.getElementById('knownCasesPane').dataset.state==='ready'");
  const identity=await c.evaluate("document.getElementById('knownCasesPane').dataset.searchId");
  await c.send('Fetch.continueRequest',{requestId:held}).catch(()=>{});await delay(100);
  assert.equal(await c.evaluate("document.getElementById('knownCasesPane').dataset.searchId"),identity);
  assert.match(await c.evaluate("document.getElementById('caseConditions').textContent"),/2024-07-05/);
  await Promise.allSettled(pending);await c.send('Fetch.disable');
 }finally{await b.close();}
}));

test("a late case detail cannot replace a newer explicitly chosen original result",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,pending=[];let held=null;
 c.onEvent(m=>{if(m.method==='Fetch.requestPaused'){if(m.params.request.url.includes('/case-2024-06?')&&!held)held=m.params.requestId;else pending.push(c.send('Fetch.continueRequest',{requestId:m.params.requestId}));}});
 try{
  await openCases(c,base);await c.send('Fetch.enable',{patterns:[{urlPattern:'*/query/known-cases/*',requestStage:'Request'}]});
  await click(c,"#caseCandidates [data-case-id='case-2024-06']");for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
  await click(c,"#caseCandidates [data-case-id='case-2024-02']");await waitFor(c,"document.getElementById('caseHours')?.textContent==='20'");
  await c.send('Fetch.continueRequest',{requestId:held}).catch(()=>{});await delay(100);
  assert.equal(await c.evaluate("document.getElementById('caseHours').textContent"),'20');
  assert.equal(await c.evaluate("document.getElementById('caseEvidence').dataset.caseId"),'case-2024-02');
  await Promise.allSettled(pending);await c.send('Fetch.disable');
 }finally{await b.close();}
}));

test("small-screen original evidence remains non-modal, map zoom works and Escape returns to the case",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp;
 try{
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await openCases(c,base);await click(c,"#caseCandidates [data-case-id='case-2024-06']");
  await waitFor(c,"document.getElementById('caseHours')?.textContent==='10'&&!document.getElementById('evidencePanel').hidden");
  assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  assert.equal(await c.evaluate("document.getElementById('taskWorkbench').open"),false);
  assert.equal(await c.evaluate("document.querySelectorAll('#tabs [data-pane]').length"),3);
  const box=await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
  await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:25,y:350,deltaX:0,deltaY:-120});
  await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(box)}`);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
  assert.equal(await c.evaluate("document.activeElement.dataset.caseId"),'case-2024-06');
 }finally{await b.close();}
}));
