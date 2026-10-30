import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {setTimeout as delay} from "node:timers/promises";
import {launchBrowser,waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";
import {owner,headers,click,type,savedCase,openCase,exportUrl,downloaded} from "../lib/case-test-browser.mjs";

const edge=process.env.EDGE??"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function ready(c){await waitFor(c,"!document.getElementById('caseCheckBundle').disabled");}
async function choose(c,path){
  const {root}=await c.send("DOM.getDocument"),{nodeId}=await c.send("DOM.querySelector",{nodeId:root.nodeId,selector:"#caseCheckBundle"});
  assert.ok(nodeId,"Selected version offers local bundle checking");
  await c.evaluate("document.getElementById('caseCheckBundle').focus()");
  await c.send("DOM.setFileInputFiles",{nodeId,files:path?[path]:[]});
}

test("an owner checks an actual downloaded old-version bundle locally without uploading it or saving a draft",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-check-"));
  const requests=[];c.onEvent(m=>{if(m.method==="Network.requestWillBeSent")requests.push(m.params.request);});
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await click(c,"#caseExportBundle");const file=await downloaded(directory,".zip");assert.ok((await readFile(file)).length>100);
    await waitFor(c,"!document.getElementById('caseExportBundle').disabled");
    const update=await fetch(base+"/api/query/monthly-analysis/cases/"+first.case_id,{method:"PUT",headers,body:JSON.stringify({...first.metadata,note:"新版本不改变旧包",base_version:1,base_version_id:first.version_id,intent_id:"7".repeat(32)})});assert.equal(update.status,200);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","核对时保留未保存草稿");
    const before=await c.evaluate("({date:state.date,longitude:state.lon,latitude:state.lat,radius:state.range})");
    await c.send("Network.enable");await choose(c,file);
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='bundle-checked'");
    assert.match(await c.evaluate("document.getElementById('caseArchiveStatus').textContent"),/完全一致.*版本 1/);
    assert.equal(await c.evaluate("document.getElementById('caseCheckBundle').value"),"");
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"核对时保留未保存草稿");
    assert.deepEqual(await c.evaluate("({date:state.date,longitude:state.lon,latitude:state.lat,radius:state.range})"),before);
    assert.equal(requests.length,1);assert.equal(requests[0].url,exportUrl(base,first,"bundle"));assert.equal(requests[0].method,"GET");assert.equal(requests[0].hasPostData,undefined);
    const versions=await(await fetch(base+"/api/query/monthly-analysis/cases/"+first.case_id+"/versions",{headers})).json();assert.equal(versions.versions.length,2);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

for(const status of [401,403,503]){
test(`a ${status} response cannot verify a local file and follows the existing draft boundary`,()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-denied-")),pending=[];
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:status,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from("{}").toString("base64")}));});
  try{
    const path=join(directory,"local.zip");await writeFile(path,Buffer.from(await(await fetch(exportUrl(base,first,"bundle"),{headers})).arrayBuffer()));
    await openCase(c,base);await click(c,"#caseEditFields summary");await type(c,"caseEditNote","失败边界草稿");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/bundle?*",requestStage:"Request"}]});await choose(c,path);
    await waitFor(c,status===503?"document.getElementById('caseArchive').dataset.state==='error'&&!document.getElementById('caseCheckBundle').disabled":"document.getElementById('caseArchive').dataset.state==='locked'");
    await Promise.all(pending);assert.notEqual(await c.evaluate("document.getElementById('caseArchive').dataset.state"),"bundle-checked");
    if(status===503){
      assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"失败边界草稿");assert.equal(await c.evaluate("document.getElementById('caseCheckBundle').value"),"");
      await c.send("Fetch.disable");await choose(c,path);await waitFor(c,"document.getElementById('caseArchive').dataset.state==='bundle-checked'");
      assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"失败边界草稿");
    }else{
      assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
      assert.match(await c.evaluate("document.getElementById('caseArchiveStatus').textContent"),/草稿已清除/);
    }
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));
}

for(const leave of ["view","escape","lock","offline"]){
test(`leaving a pending local bundle check through ${leave} clears evidence without late success`,()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-late-"));let held;
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")held=m.params.requestId;});
  try{
    const path=join(directory,"local.zip");await writeFile(path,Buffer.from(await(await fetch(exportUrl(base,first,"bundle"),{headers})).arrayBuffer()));
    await openCase(c,base);await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/bundle?*",requestStage:"Request"}]});await choose(c,path);
    for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
    if(leave==="view")await click(c,"#observationView");
    if(leave==="escape"){await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape"});}
    if(leave==="lock")await click(c,"#caseLock");
    if(leave==="offline")await click(c,"#serverModeToggle");
    await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});await delay(150);await c.send("Fetch.disable");
    assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
    assert.notEqual(await c.evaluate("document.getElementById('caseArchive').dataset.state"),"bundle-checked");
    assert.doesNotMatch(await c.evaluate("document.getElementById('caseArchiveStatus').textContent"),/完全一致/);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));
}

test("a held service check times out visibly and a late response never replaces that state",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-timeout-"));let held;
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")held=m.params.requestId;});
  try{
    const path=join(directory,"local.zip");await writeFile(path,Buffer.from(await(await fetch(exportUrl(base,first,"bundle"),{headers})).arrayBuffer()));
    await openCase(c,base);await click(c,"#caseEditFields summary");await type(c,"caseEditNote","超时保留草稿");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/bundle?*",requestStage:"Request"}]});await choose(c,path);
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'&&!document.getElementById('caseCheckBundle').disabled",15000);assert.ok(held);
    assert.match(await c.evaluate("document.getElementById('caseArchiveStatus').textContent"),/取消或超时/);
    await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});await delay(150);
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"超时保留草稿");
    assert.equal(await c.evaluate("document.getElementById('caseArchive').dataset.state"),"error");
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("same-length corruption, another saved version and an empty or oversized file never pass as this version",()=>withService(async base=>{
  const first=await savedCase(base),bytes=Buffer.from(await(await fetch(exportUrl(base,first,"bundle"),{headers})).arrayBuffer());
  const update=await fetch(base+"/api/query/monthly-analysis/cases/"+first.case_id,{method:"PUT",headers,body:JSON.stringify({...first.metadata,note:"其他版本的包",base_version:1,base_version_id:first.version_id,intent_id:"6".repeat(32)})});const second=await update.json();assert.equal(update.status,200);
  const newer=Buffer.from(await(await fetch(exportUrl(base,second,"bundle"),{headers})).arrayBuffer());
  const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-mismatch-")),requests=[];
  c.onEvent(m=>{if(m.method==="Network.requestWillBeSent")requests.push(m.params.request);});
  try{
    await openCase(c,base);await c.evaluate("document.getElementById('caseVersion').value='1';document.getElementById('caseVersion').dispatchEvent(new Event('change'))");
    await waitFor(c,"document.getElementById('caseArchive').dataset.version==='1'&&!document.getElementById('caseVersion').disabled");
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","不一致也保留草稿");await c.send("Network.enable");
    const changed=Buffer.from(bytes);changed[100]^=1;
    for(const [name,data,message,gets] of [["changed.zip",changed,/不一致/,1],["newer.zip",newer,/不一致/,1],["fake.zip",Buffer.alloc(bytes.length,65),/不一致/,1],["empty.zip",Buffer.alloc(0),/为空或无法读取/,0],["oversize.zip",Buffer.alloc(1048577),/超过1MiB/,0]]){
      const path=join(directory,name);await writeFile(path,data);const start=requests.length;
      await choose(c,path);await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'&&!document.getElementById('caseCheckBundle').disabled");
      assert.match(await c.evaluate("document.getElementById('caseArchiveStatus').textContent"),message);assert.equal(requests.length-start,gets);
      assert.equal(await c.evaluate("document.getElementById('caseCheckBundle').value"),"");assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"不一致也保留草稿");
    }
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("cancelling a new file choice clears a previous pass and sends no new request",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-cancel-")),requests=[];
  c.onEvent(m=>{if(m.method==="Network.requestWillBeSent")requests.push(m.params.request);});
  try{
    const path=join(directory,"local.zip");await writeFile(path,Buffer.from(await(await fetch(exportUrl(base,first,"bundle"),{headers})).arrayBuffer()));
    await openCase(c,base);await choose(c,path);await waitFor(c,"document.getElementById('caseArchive').dataset.state==='bundle-checked'");await ready(c);
    await c.send("Network.enable");await c.evaluate("document.getElementById('caseCheckBundle').dispatchEvent(new Event('cancel'))");
    assert.match(await c.evaluate("document.getElementById('caseArchiveStatus').textContent"),/取消选择.*未执行核对/);
    assert.notEqual(await c.evaluate("document.getElementById('caseArchive').dataset.state"),"bundle-checked");assert.equal(requests.length,0);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

for(const width of [1440,390]){
test(`local bundle check controls and adjacent result remain readable at ${width}px`,()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-bundle-visual-"));
  try{
    const path=join(directory,"selected.zip");await writeFile(path,Buffer.from(await(await fetch(exportUrl(base,first,"bundle"),{headers})).arrayBuffer()));
    await c.send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width===390});await openCase(c,base);
    await click(c,"#caseBundleCheckFields summary");await choose(c,path);await waitFor(c,"document.getElementById('caseArchive').dataset.state==='bundle-checked'");
    await waitFor(c,"document.getElementById('caseBundleCheckStatus').textContent.includes('完全一致')");
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
    await c.evaluate("document.getElementById('caseBundleCheckFields').scrollIntoView({block:'center'})");
    await mkdir("docs/reports/screenshots",{recursive:true});await writeFile(`docs/reports/screenshots/ocean-case-bundle-check-${width}.png`,Buffer.from((await c.send("Page.captureScreenshot",{format:"png"})).data,"base64"));
    const altered=Buffer.from(await readFile(path));altered[100]^=1;const wrong=join(directory,"altered.zip");await writeFile(wrong,altered);await choose(c,wrong);
    await waitFor(c,"document.getElementById('caseBundleCheckStatus').textContent.includes('不一致')");
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));
}
