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

test("month task draft inherits applied conditions rather than an unapplied coordinate or viewport",async()=>{
 const b=await launchBrowser(edge),c=b.cdp;
 try{
  await c.send("Page.enable");await c.send("Page.navigate",{url:pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,"#headerFilter");await click(c,"#locInput");
  await c.evaluate("document.getElementById('locInput').select()");await c.send("Input.insertText",{text:"126,32"});
  await click(c,"#workbenchToggle");await click(c,"#monthlyDraftOpen");
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),"2024-08");
  assert.equal(await c.evaluate("document.getElementById('monthDraftLongitude').value"),"124.5");
  assert.equal(await c.evaluate("document.getElementById('monthDraftLatitude').value"),"30.2");
  assert.match(await c.evaluate("document.getElementById('monthDraftCoordinateNote').textContent"),/未应用/);
  assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"),true);
  assert.equal(await c.evaluate("document.getElementById('monthDraftPanel').hidden"),false);
  await edit(c,"#monthDraftMonth","2024-02");
  assert.equal(await c.evaluate("document.getElementById('timeDate').value"),"2024-08-05");
  await click(c,"#monthDraftCheck");
  assert.match(await c.evaluate("document.getElementById('monthDraftStatus').textContent"),/离线/);
  assert.equal(await c.evaluate("document.getElementById('monthDraftSubmit').disabled"),true);
  const point=await c.evaluate("document.getElementById('monthDraftLongitude').value");
  await click(c,"#monthDraftClose");
  await c.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:700,y:300,deltaX:0,deltaY:-120});
  await click(c,"#monthlyDraftOpen");
  assert.equal(await c.evaluate("document.getElementById('monthDraftLongitude').value"),point);
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),"2024-02");
  await click(c,"#monthDraftSync");
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),"2024-08");
 }finally{await b.close();}
});

async function edit(c,selector,value){
 await c.evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}


async function openDraft(c,base){
 await c.send("Page.enable");await c.send("Network.enable");
 await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
 await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
 await click(c,"#workbenchToggle");await click(c,"#monthlyDraftOpen");
}
async function february(c){await edit(c,"#monthDraftMonth","2024-02");}

test("actual draft check reads a matching public result only after deliberate selection and never submits",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,requests=[];
 c.onEvent(m=>{if(m.method==="Network.requestWillBeSent")requests.push(m.params.request);});
 try{
  await openDraft(c,base);await february(c);await click(c,"#monthDraftCheck");
  await waitFor(c,"document.getElementById('monthDraftPanel').dataset.state==='checked'");
  assert.match(await c.evaluate("document.getElementById('monthDraftStatus').textContent"),/已核对.*可查看.*不能提交/);
  assert.equal(await c.evaluate("document.getElementById('monthlyResult').dataset.resultId"),undefined);
  assert.equal(await c.evaluate("document.querySelectorAll('#monthDraftMatches button').length"),1);
  assert.ok((await c.evaluate("document.getElementById('monthDraftPanel').dataset.requestId")).startsWith("sha256:"));
  await click(c,"#monthDraftMatches button");
  await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
  assert.equal(await c.evaluate("document.getElementById('monthlyHours').textContent"),"40");
  const original=await c.evaluate("document.getElementById('monthlyResult').dataset.resultId");
  await click(c,"#monthlyDraftOpen");
  await click(c,"#monthDraftLongitude");await c.evaluate("document.getElementById('monthDraftLongitude').select()");
  await c.send("Input.insertText",{text:"125.5"});
  assert.equal(await c.evaluate("document.getElementById('monthlyResult').dataset.resultId"),original);
  assert.match(await c.evaluate("document.getElementById('monthlyContext').textContent"),/任务条件已改变.*原成果.*待更新/);
  await click(c,"#monthDraftCheck");await waitFor(c,"document.getElementById('monthDraftPanel').dataset.state==='checked'");
  assert.equal(await c.evaluate("document.getElementById('monthlyResult').dataset.resultId"),original);
  await click(c,"#monthDraftMatches button");
  await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'&&document.getElementById('monthlyHours').textContent==='0'");
  assert.notEqual(await c.evaluate("document.getElementById('monthlyResult').dataset.resultId"),original);
  assert.equal(await c.evaluate("document.getElementById('timeDate').value"),"2024-08-05");
  assert.equal(await c.evaluate("document.getElementById('locInput').value"),"124.50°E, 30.20°N");
  assert.equal(requests.some(r=>r.method==='POST'),false);
  assert.equal(requests.filter(r=>r.url.includes('/monthly-analysis/capability')).length,2);
 }finally{await b.close();}
}));

test("invalid fields stay local and changing applied day/radius needs an explicit draft sync",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,requests=[];
 c.onEvent(m=>{if(m.method==="Network.requestWillBeSent")requests.push(m.params.request);});
 try{
  await openDraft(c,base);await edit(c,"#monthDraftLongitude","181");
  assert.equal(await c.evaluate("document.getElementById('monthDraftLongitude').getAttribute('aria-invalid')"),"true");
  assert.equal(await c.evaluate("document.getElementById('monthDraftCheck').disabled"),true);
  assert.match(await c.evaluate("document.getElementById('monthDraftLongitudeError').textContent"),/180/);
  await edit(c,"#monthDraftLongitude","124.5");await edit(c,"#monthDraftMonth","");
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').getAttribute('aria-invalid')"),"true");
  assert.equal(requests.filter(r=>r.url.includes('/monthly-analysis/capability')).length,0);
  await february(c);await click(c,"#headerFilter");
  await c.evaluate("document.getElementById('timeDate').value='2024-07-05';document.getElementById('timeDate').dispatchEvent(new Event('change',{bubbles:true}))");
  await click(c,"#rangeSeg [data-range='30']");await click(c,"#monthlyDraftOpen");
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),"2024-02");
  assert.equal(await c.evaluate("document.getElementById('monthDraftRadius').value"),"20");
  assert.match(await c.evaluate("document.getElementById('monthDraftDirty').textContent"),/已应用筛选已改变.*保留/);
  await click(c,"#monthDraftSync");
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),"2024-07");
  assert.equal(await c.evaluate("document.getElementById('monthDraftRadius').value"),"30");
  assert.equal(requests.some(r=>r.method==='POST'),false);
 }finally{await b.close();}
}));

test("capability permission, unavailable registry and wrong echoed conditions never become offline success",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,pending=[];let status=403,body={detail:"controlled fault"};
 const params=new URLSearchParams({month:'2024-02',longitude:'124.5',latitude:'30.2',radius_km:'20'});
 const original=await(await fetch(base+'/api/query/monthly-analysis/capability?'+params)).json();
 c.onEvent(m=>{if(m.method==='Fetch.requestPaused')pending.push(c.send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')}));});
 try{
  await openDraft(c,base);await february(c);
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*/monthly-analysis/capability?*',requestStage:'Request'}]});
  for(const code of [403,503,200]){
   status=code;if(code===200){body=structuredClone(original);body.request.month='2024-03';}
   await click(c,'#monthDraftCheck');await waitFor(c,"document.getElementById('monthDraftPanel').dataset.state==='error'");
   assert.equal(await c.evaluate("document.getElementById('monthDraftPanel').dataset.errorCode"),code===200?'contract':'http_'+code);
   assert.equal(await c.evaluate("document.querySelectorAll('#monthDraftMatches button').length"),0);
   assert.equal(await c.evaluate("document.getElementById('monthDraftSubmit').disabled"),true);
  }
  assert.ok(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=sst]').length>0"));
  await Promise.allSettled(pending);await c.send('Fetch.disable');
 }finally{await b.close();}
}));

test("a delayed old draft check cannot replace a newly checked month",()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,pending=[];let held=null;
 c.onEvent(m=>{if(m.method==='Fetch.requestPaused'){
  if(m.params.request.url.includes('month=2024-03')&&!held)held=m.params.requestId;
  else pending.push(c.send('Fetch.continueRequest',{requestId:m.params.requestId}));
 }});
 try{
  await openDraft(c,base);await c.send('Fetch.enable',{patterns:[{urlPattern:'*/monthly-analysis/capability?*',requestStage:'Request'}]});
  await edit(c,'#monthDraftMonth','2024-03');await click(c,'#monthDraftCheck');
  for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
  await february(c);await click(c,'#monthDraftCheck');await waitFor(c,"document.getElementById('monthDraftPanel').dataset.state==='checked'");
  const identity=await c.evaluate("document.getElementById('monthDraftPanel').dataset.requestId");
  await c.send('Fetch.continueRequest',{requestId:held}).catch(()=>{});await delay(100);
  assert.equal(await c.evaluate("document.getElementById('monthDraftPanel').dataset.requestId"),identity);
  assert.equal(await c.evaluate("document.getElementById('monthDraftMonth').value"),'2024-02');
  assert.equal(await c.evaluate("document.querySelectorAll('#monthDraftMatches button').length"),1);
  await Promise.allSettled(pending);await c.send('Fetch.disable');
 }finally{await b.close();}
}));

test("small-screen draft remains separate from both workbench modules and Escape restores its opener",async()=>{
 const b=await launchBrowser(edge),c=b.cdp;
 try{
  await c.send('Page.enable');await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await c.send('Page.navigate',{url:pathToFileURL(resolve('frontend/prototype/prototype-fishing.html')).href});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,'#workbenchToggle');await click(c,'#monthlyDraftOpen');
  assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  assert.equal(await c.evaluate("document.querySelectorAll('#taskWorkbench > section').length"),2);
  assert.equal(await c.evaluate("document.getElementById('taskWorkbench').contains(document.getElementById('monthDraftPanel'))"),false);
  const original=await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
  await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:300,y:200,deltaX:0,deltaY:-120});
  await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(original)}`);
  await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await c.evaluate("document.getElementById('monthDraftPanel').hidden"),true);
  assert.equal(await c.evaluate("document.activeElement.id"),'monthlyDraftOpen');
 }finally{await b.close();}
});
