import test from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname, basename, join } from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { launchBrowser, waitFor } from "../lib/browser-driver.mjs";

const edge=process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function withService(work) {
  const root=await mkdtemp(join(tmpdir(),"ocean-month-service-"));
  await mkdir(join(root,"raw"));await mkdir(join(root,"cache"));
  const code=`import json,socket,os,uvicorn
from fastapi.staticfiles import StaticFiles
from app.main import app
app.mount('/',StaticFiles(directory=os.environ['OCEAN_TEST_FRONTEND']))
s=socket.socket();s.bind(('127.0.0.1',0));s.listen(128)
print(json.dumps({'port':s.getsockname()[1]}),flush=True)
uvicorn.Server(uvicorn.Config(app,log_level='error')).run(sockets=[s])`;
  const child=spawn(process.env.OCEAN_EXPERIMENT_PYTHON || "python",["-c",code],{cwd:resolve("backend"),windowsHide:true,
    env:{...process.env,OCEAN_TEST_FRONTEND:resolve("frontend/prototype"),OCEAN_AI_PROVIDER:"rules",OCEAN_MONTHLY_EXECUTION_TOKEN:"",OCEAN_RAW_DATA_DIR:join(root,"raw"),OCEAN_CACHE_DIR:join(root,"cache")},stdio:["ignore","pipe","pipe"]});
  let output="",errors="",port;
  child.stdout.on("data",b=>{output+=b.toString();try{port=JSON.parse(output.split("\n")[0]).port;}catch{}});
  child.stderr.on("data",b=>{errors+=b.toString().slice(0,1000);});
  try {
    for(let n=0;n<150&&!port;n++){if(child.exitCode!==null)throw Error("Actual API did not start: "+errors);await delay(50);}
    assert.ok(port,"Actual API listening port");const base=`http://127.0.0.1:${port}`;
    for(let n=0;n<100;n++){try{if((await fetch(base+"/api/health")).ok)break;}catch{}await delay(50);}
    await work(base);
  }finally{child.kill();await Promise.race([new Promise(r=>child.once("exit",r)),delay(2000)]);
    if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-month-service-"))await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
}
async function click(c, selector) {
  const p=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...p});
  await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...p});
}

test("workbench reads an existing month without applying its old conditions or opening evidence automatically",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate",{url:pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy') === 'false'");
    const date=await c.evaluate("document.getElementById('timeDate').value");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult')?.dataset.state === 'ready'");
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"),date);
    assert.match(await c.evaluate("document.getElementById('monthlyConditions').textContent"),/2024-02.*20/);
    assert.equal(await c.evaluate("document.getElementById('monthlyHours').textContent"),"40");
    assert.equal(await c.evaluate("document.getElementById('monthlyDays').textContent"),"2 / 29");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
    await click(c,"#monthlyDetails");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),false);
    assert.match(await c.evaluate("document.getElementById('evidenceIdentity').textContent"),/sha256:/);
    assert.equal(await c.evaluate("document.querySelectorAll('#monthlyTable tbody tr').length"),29);
    assert.equal(await c.evaluate("document.querySelector('#monthlyTable tr[data-date=\"2024-02-02\"] [data-field=hours]').textContent"),"0");
    assert.equal(await c.evaluate("document.querySelector('#monthlyTable tr[data-date=\"2024-02-03\"] [data-field=hours]').textContent"),"未知");
    assert.match(await c.evaluate("document.getElementById('monthlyIntervals').textContent"),/未估计/);
    const identity=await c.evaluate("document.getElementById('monthlyResult').dataset.resultId");
    const conditions=await c.evaluate("document.getElementById('monthlyConditions').textContent");
    const oldPoint=await c.evaluate("document.getElementById('locInput').value");
    await click(c,"#headerFilter");await click(c,"#pickOriginBtn");
    await c.send("Input.dispatchMouseEvent",{type:"mousePressed",x:700,y:300,button:"left",clickCount:1});
    await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:700,y:300,button:"left",clickCount:1});
    await waitFor(c,`document.getElementById('locInput').value!==${JSON.stringify(oldPoint)}`);
    assert.equal(await c.evaluate("document.getElementById('monthlyResult').dataset.resultId"),identity);
    assert.equal(await c.evaluate("document.getElementById('monthlyConditions').textContent"),conditions);
  } finally {await b.close();}
});

test("actual API supplies one snapshot for summary, table, chart and CSV with no execution requests",()=>withService(async base=>{
  const b=await launchBrowser(edge),c=b.cdp,requests=[];
  c.onEvent(message=>{if(message.method==="Network.requestWillBeSent")requests.push(message.params.request);});
  try{
    await c.send("Network.enable");await c.send("Page.enable");
    await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy') === 'false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state === 'ready'");
    assert.match(await c.evaluate("document.getElementById('monthlyStatus').textContent"),/服务公开成果/);
    assert.equal(await c.evaluate("document.getElementById('monthlyHours').textContent"),"40");
    await click(c,"#monthlyDetails");
    const csv=await c.evaluate("fetch(document.getElementById('monthlyDownload').href).then(r=>r.text())");
    assert.match(csv,/d90e75c6573eeccea442e0bded57b5faffb7401bb1ca9b4bef05b2f197b736ea/);
    assert.match(csv,/"2024-02-02","partial_support",0,2/);
    assert.match(csv,/"2024-02-03","no_records","",""/);
    const number=requests.filter(r=>r.url.includes("/query/monthly-analysis/published")).length;
    await click(c,"#evidenceClose");await click(c,"#monthlyDetails");
    assert.equal(requests.filter(r=>r.url.includes("/query/monthly-analysis/published")).length,number);
    assert.equal(requests.some(r=>r.method==="POST"),false);
    assert.equal(await c.evaluate("document.querySelectorAll('#monthlyChart [data-state=unknown]').length"),27);
    await c.evaluate("document.getElementById('monthlySavedResult').focus()");
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowDown",code:"ArrowDown"});
    await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowDown",code:"ArrowDown"});
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab"});
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready' && document.getElementById('monthlyHours').textContent==='0'");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
  }finally{await b.close();}
}));

test("small-screen evidence, keyboard focus and map zoom remain usable with the monthly reader",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await c.send("Page.enable");
    await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await c.send("Page.navigate",{url:pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy') === 'false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
    await click(c,"#monthlyDetails");
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
    assert.equal(await c.evaluate("document.getElementById('taskWorkbench').open"),false);
    const before=await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:25,y:350,deltaX:0,deltaY:-220});
    await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(before)}`);
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"),before);
    const zoomed=await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.send("Emulation.setTouchEmulationEnabled",{enabled:true});
    await c.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:25,y:350}]});
    await c.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:45,y:370}]});
    await c.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"),zoomed);
    await c.evaluate("document.getElementById('evidenceClose').focus()");
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
    assert.equal(await c.evaluate("document.activeElement.id"),"monthlyDetails");
    assert.equal(await c.evaluate("document.querySelectorAll('#tabs button').length"),3);
  }finally{await b.close();}
});

test("a denied service read clears old values and never silently switches to its offline copy",()=>withService(async base=>{
  const b=await launchBrowser(edge),c=b.cdp,pending=[];
  try{
    await c.send("Page.enable");await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
    c.onEvent(m=>{if(m.method==="Fetch.requestPaused")pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:403,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from('{"detail":"restricted"}').toString("base64")}));});
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/query/monthly-analysis/published/*",requestStage:"Request"}]});
    await click(c,"#monthlyRefresh");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='error'");
    assert.match(await c.evaluate("document.getElementById('monthlyStatus').textContent"),/暂不能公开读取/);
    assert.equal(await c.evaluate("document.getElementById('monthlyResult').dataset.errorCode"),"http_403");
    assert.equal(await c.evaluate("document.getElementById('monthlyMetrics').hidden"),true);
    assert.equal(await c.evaluate("document.getElementById('monthlyDetails').disabled"),true);
    assert.equal(await c.evaluate("document.getElementById('monthlyEvidence').textContent"),"");
    await Promise.allSettled(pending);await c.send("Fetch.disable");
  }finally{await b.close();}
}));

test("unverifiable identity, unit or publication flags never become a displayed result",()=>withService(async base=>{
  const b=await launchBrowser(edge),c=b.cdp,pending=[];
  const catalog=await (await fetch(base+"/api/query/monthly-analysis/published")).json();
  const original=await (await fetch(base+"/api/query/monthly-analysis/published/"+catalog.results[0].result_id)).json();
  let body=structuredClone(original);body.units.total_hours="vessel_count";
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")}));});
  try{
    await c.send("Page.enable");await c.send("Fetch.enable",{patterns:[{urlPattern:"*/query/monthly-analysis/published/*",requestStage:"Request"}]});
    await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    for(const variant of ["unit","identity","permission"]){
      if(variant!=="unit"){
        body=structuredClone(original);
        if(variant==="identity")body.result_id="sha256:"+"f".repeat(64);
        else body.public_aggregate_allowed=false;
        await click(c,"#monthlyRefresh");
      }
      await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='error'");
      assert.equal(await c.evaluate("document.getElementById('monthlyResult').dataset.errorCode"),"contract");
      assert.equal(await c.evaluate("document.getElementById('monthlyMetrics').hidden"),true);
      assert.equal(await c.evaluate("document.getElementById('monthlyDetails').disabled"),true);
    }
    await Promise.allSettled(pending);await c.send("Fetch.disable");
  }finally{await b.close();}
}));

test("a late first read cannot replace the subsequently selected zero-result snapshot",()=>withService(async base=>{
  const b=await launchBrowser(edge),c=b.cdp,pending=[];let held=null;
  try{
    const catalog=await (await fetch(base+"/api/query/monthly-analysis/published")).json();
    const first=catalog.results[0].result_id;
    c.onEvent(m=>{if(m.method==="Fetch.requestPaused"){
      if(decodeURIComponent(m.params.request.url).endsWith(first)&&!held)held=m.params.requestId;
      else pending.push(c.send("Fetch.continueRequest",{requestId:m.params.requestId}));
    }});
    await c.send("Page.enable");await c.send("Fetch.enable",{patterns:[{urlPattern:"*/query/monthly-analysis/published/*",requestStage:"Request"}]});
    await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
    await c.evaluate("document.getElementById('monthlySavedResult').focus()");
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowDown",code:"ArrowDown"});
    await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowDown",code:"ArrowDown"});
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab"});
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready' && document.getElementById('monthlyHours').textContent==='0'");
    await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});await delay(100);
    assert.equal(await c.evaluate("document.getElementById('monthlyHours').textContent"),"0");
    await Promise.allSettled(pending);await c.send("Fetch.disable");
  }finally{await b.close();}
}));
