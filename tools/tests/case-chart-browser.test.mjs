import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,readdir,rm,mkdir,copyFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
import {launchBrowser,waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";
import {owner,headers,click,type,savedCase,openCase,exportUrl,downloaded} from "../lib/case-test-browser.mjs";

const edge=process.env.EDGE??"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const fixture=spawnSync("python",["-c",`import json
from pathlib import Path
from app.analysis_support import content_id
p=json.loads(Path('app/examples/regional-known-snapshots.json').read_text(encoding='utf-8'));e=p['snapshots'][0];r=e['result']
r['status']='unavailable'
r['metrics'].update(total_hours=None,supported_days=0,area_time_km2_days=None,mean_hours_per_supported_day=None,density_hours_per_km2_day=None)
for d in r['daily']:d.update(state='unprepared',hours=None,effective_area_km2=None,area_time_km2_days=None,excluded_units=0)
r['coverage'].update(status='unavailable',excluded_day_states={'unprepared':29},excluded_units=0)
r['parameters']['input_version']=r['source']['version']='synthetic-all-unknown/v1'
r['source'].update(id='authored-all-unknown-month',input_sha256=content_id(r['daily']),support_evidence='Self-authored all-unknown software figure test; no observations')
r['result_id']=content_id({'authored_fixture':'all-unknown/v1','parameters':r['parameters'],'daily':r['daily']})
e['snapshot_sha256']=content_id(r);p['snapshots']=[e]
print(json.dumps(p,ensure_ascii=True))`],{cwd:"backend",encoding:"utf8",windowsHide:true});
assert.equal(fixture.status,0,fixture.stderr);

test("an owner downloads a real PNG of the selected frozen days without map or unsaved notes",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-chart-png-"));
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","未保存草稿不能进入图像");
    const update=await fetch(base+"/api/query/monthly-analysis/cases/"+first.case_id,{method:"PUT",headers,body:JSON.stringify({...first.metadata,note:"外部新版本",base_version:1,base_version_id:first.version_id,intent_id:"a".repeat(32)})});assert.equal(update.status,200);
    const before=await c.evaluate("({date:state.date,longitude:state.lon,latitude:state.lat,radius:state.range})");
    await click(c,"#caseExportChart");const file=await downloaded(directory,".png"),bytes=await readFile(file);
    assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert.ok(file.includes(first.version_id.slice(7,19))&&file.endsWith("chart-v1.png"));
    const inspected=spawnSync("python",["-c","from PIL import Image;import sys,json;im=Image.open(sys.argv[1]).convert('RGB');p=list(im.crop((120,250,1480,680)).getdata());print(json.dumps({'width':im.width,'height':im.height,'blue':sum(x==(38,117,168) for x in p),'green':sum(x==(27,94,32) for x in p),'gray':sum(x==(122,135,145) for x in p)}))",file],{encoding:"utf8",windowsHide:true});
    assert.equal(inspected.status,0,inspected.stderr);const pixels=JSON.parse(inspected.stdout);
    assert.equal(pixels.width,1600);assert.ok(pixels.height>=1100&&pixels.height<=10000);
    assert.ok(pixels.blue>1000&&pixels.green>10&&pixels.gray>100,"Real figure preserves positive, known-zero and unknown visual marks");
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"未保存草稿不能进入图像");
    assert.deepEqual(await c.evaluate("({date:state.date,longitude:state.lon,latitude:state.lat,radius:state.range})"),before);
    const svg=await(await fetch(exportUrl(base,first,"chart"),{headers})).text();assert.match(svg,/40 h.*7 km²·d.*2\/29/);assert.doesNotMatch(svg,/未保存草稿不能进入图像|第一版人工笔记/);
    await mkdir("docs/reports/screenshots",{recursive:true});await copyFile(file,"docs/reports/screenshots/ocean-case-daily-evidence.png");
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("an all-unknown month still downloads a readable PNG without positive or zero marks",()=>withService(async base=>{
  await savedCase(base);const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-chart-unknown-"));
  try{
    await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);await click(c,"#caseExportChart");
    const file=await downloaded(directory,".png");
    const read=spawnSync("python",["-c","from PIL import Image;import sys,json;im=Image.open(sys.argv[1]).convert('RGB');p=list(im.crop((120,250,1480,680)).getdata());print(json.dumps([sum(x==(38,117,168) for x in p),sum(x==(27,94,32) for x in p),sum(x==(122,135,145) for x in p)]))",file],{encoding:"utf8",windowsHide:true});
    assert.equal(read.status,0,read.stderr);const [blue,green,gray]=JSON.parse(read.stdout);assert.equal(blue,0);assert.equal(green,0);assert.ok(gray>100);
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
    await copyFile(file,"docs/reports/screenshots/ocean-case-daily-evidence-unknown.png");
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true,publishedFixtureText:fixture.stdout}));

for(const failure of ["wrong-version","external-resource","render-blocked"]){
  test(`a figure with ${failure} fails without a PNG and preserves an ordinary-failure draft`,()=>withService(async base=>{
    const first=await savedCase(base),svg=await(await fetch(exportUrl(base,first,"chart"),{headers})).text();
    const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-chart-failure-")),pending=[],requests=[];
    c.onEvent(m=>{if(m.method==="Network.requestWillBeSent")requests.push(m.params.request.url);if(m.method==="Fetch.requestPaused"){
      const value=failure==="wrong-version"?svg.replace(first.version_id,"sha256:"+"0".repeat(64)):svg.replace("</svg>",'<image href="'+base+'/forbidden-private-image"/></svg>');
      pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:"image/svg+xml"}],body:Buffer.from(value).toString("base64")}));
    }});
    try{
      await c.send("Network.enable");await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
      await click(c,"#caseEditFields summary");await type(c,"caseEditNote","图像失败保留草稿");
      if(failure==="render-blocked")await c.evaluate("(()=>{const m=document.createElement('meta');m.httpEquiv='Content-Security-Policy';m.content=\"img-src 'none'\";document.head.append(m)})()");
      else await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/chart?*",requestStage:"Request"}]});
      await click(c,"#caseExportChart");await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'&&!document.getElementById('caseExportChart').disabled");
      assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"图像失败保留草稿");assert.deepEqual(await readdir(directory),[]);
      assert.equal(requests.some(url=>url.includes("forbidden-private-image")),false);
      if(failure!=="render-blocked"){await c.send("Fetch.disable");await Promise.allSettled(pending);await click(c,"#caseExportChart");assert.ok(await downloaded(directory,".png"));}
    }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
  },{caseOwnerToken:owner,enableCaseStore:true}));
}

for(const leave of ["view","escape"]){
test(`leaving a pending PNG through ${leave} cancels it and clears owner evidence`,()=>withService(async base=>{
  await savedCase(base);const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-chart-late-"));let held;
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")held=m.params.requestId;});
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/chart?*",requestStage:"Request"}]});await click(c,"#caseExportChart");for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
    if(leave==="view")await click(c,"#observationView");
    else {await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape"});}
    await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});await delay(150);await c.send("Fetch.disable");
    assert.deepEqual(await readdir(directory),[]);assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));
}
