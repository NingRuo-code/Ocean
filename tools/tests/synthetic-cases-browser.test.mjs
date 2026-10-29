import test from "node:test";
import assert from "node:assert/strict";
import {launchBrowser,waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";
import {mkdir,writeFile} from "node:fs/promises";

const edge=process.env.EDGE??"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const owner="self-authored-case-owner";
async function click(c,selector){
  const point=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});
  await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
}
async function type(c,id,value){await c.evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).value=''`);await c.send("Input.insertText",{text:value});}
async function openReport(c,base){
  await c.send("Page.enable");await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
  await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
  await click(c,"#monthlyReportOpen");await waitFor(c,"document.getElementById('monthReport').dataset.state==='ready'");
}

test("owner saves a real-service case and reopens the same frozen report after browser refresh",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;
  try{
    await openReport(c,base);await click(c,"#reportSaveCase");
    await type(c,"caseOwnerToken",owner);await type(c,"caseCreateTitle","我的固定报告");
    await click(c,"#caseSave");await waitFor(c,"document.getElementById('caseArchive').dataset.state==='saved'");
    const id=await c.evaluate("document.getElementById('caseArchive').dataset.caseId");
    assert.match(await c.evaluate("document.getElementById('caseOriginal').textContent"),/40.*7.*2.*29/s);
    await c.send("Page.reload");await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#caseArchiveOpen");
    assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");
    await type(c,"caseOwnerToken",owner);await click(c,"#caseLoad");
    await waitFor(c,"document.querySelectorAll('#caseItems button').length===1");
    await click(c,"#caseItems button");
    await waitFor(c,`document.getElementById('caseArchive').dataset.caseId===${JSON.stringify(id)}`);
    assert.match(await c.evaluate("document.getElementById('caseOriginal').textContent"),/40.*7.*2.*29/s);
    assert.equal(await c.evaluate("localStorage.getItem('caseOwnerToken')"),null);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("a lost save response retries the same durable intent without a duplicate case",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp,pending=[];let failed=false;
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused"){
    const p=m.params;
    if(p.request.method==="POST"&&!failed){failed=true;pending.push(c.send("Fetch.failRequest",{requestId:p.requestId,errorReason:"Failed"}));}
    else pending.push(c.send("Fetch.continueRequest",{requestId:p.requestId}));
  }});
  try{
    await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/monthly-analysis/cases",requestStage:"Response"}]});
    await click(c,"#caseSave");await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'");
    await c.send("Fetch.disable");await Promise.allSettled(pending);
    await click(c,"#caseSave");await waitFor(c,"document.getElementById('caseArchive').dataset.state==='saved'");
    await click(c,"#caseSave");await waitFor(c,"document.getElementById('caseSave').disabled===false");
    const response=await fetch(base+"/api/query/monthly-analysis/cases",{headers:{Authorization:"Bearer "+owner}});
    assert.equal((await response.json()).cases.length,1);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("owner case remains a readable small-screen snapshot and clears its secret on leaving",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;
  try{
    await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);
    await type(c,"caseCreateNote","<img src=x onerror=window.CASE_XSS=1> 人工笔记");
    await click(c,"#caseSave");await waitFor(c,"document.getElementById('caseArchive').dataset.state==='saved'");
    assert.match(await c.evaluate("document.getElementById('caseOriginal').textContent"),/<img src=x/);
    assert.equal(await c.evaluate("!!window.CASE_XSS"),false);
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
    await mkdir("docs/reports/screenshots",{recursive:true});
    await writeFile("docs/reports/screenshots/ocean-synthetic-case-390.png",Buffer.from((await c.send("Page.captureScreenshot",{format:"png"})).data,"base64"));
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});
    await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape"});
    assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");
    assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("an unconfigured case store is an error, never a browser-only save",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;
  try{
    await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);await click(c,"#caseSave");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'");
    assert.equal(await c.evaluate("document.getElementById('caseArchive').dataset.caseId"),undefined);
    assert.match(await c.evaluate("document.getElementById('caseStatus').textContent"),/存储暂不可用/);
  }finally{await browser.close();}
},{caseOwnerToken:owner}));

for(const action of ["offline","close"]){
  test(`an unsubmitted token is cleared when switching ${action}`,()=>withService(async base=>{
    const browser=await launchBrowser(edge),c=browser.cdp;
    try{
      await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);
      await click(c,action==="offline"?"#serverModeToggle":"#resultToggle");
      if(action==="offline")await waitFor(c,"OFData.serverMode().userMode==='offline'");
      assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");
      assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
    }finally{await browser.close();}
  },{caseOwnerToken:owner,enableCaseStore:true}));
}

test("owner edits notes as a new immutable version, searches tags and deliberately reopens version one",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;
  try{
    await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);await click(c,"#caseSave");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='saved'");
    const firstId=await c.evaluate("document.getElementById('caseArchive').dataset.caseId");
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","人工笔记第二版");await type(c,"caseEditTags","海域甲");
    await click(c,"#caseEditSave");await waitFor(c,"document.getElementById('caseArchive').dataset.version==='2'");
    assert.match(await c.evaluate("document.getElementById('caseOriginal').textContent"),/人工笔记第二版/);
    assert.match(await c.evaluate("document.getElementById('caseOriginal').textContent"),/40.*7.*2.*29/s);
    await type(c,"caseSearch","海域甲");await click(c,"#caseLoad");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='listed'");
    assert.equal(await c.evaluate("document.querySelectorAll('#caseItems button').length"),1);
    await click(c,"#caseItems button");await waitFor(c,"document.getElementById('caseVersion')?.options.length===2&&!document.getElementById('caseVersion').disabled");
    await c.evaluate("document.getElementById('caseVersion').focus()");
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowDown",code:"ArrowDown"});
    await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowDown",code:"ArrowDown"});
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab"});
    await waitFor(c,"document.getElementById('caseArchive').dataset.version==='1'");
    assert.equal(await c.evaluate("document.getElementById('caseArchive').dataset.caseId"),firstId);
    assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent.includes('人工笔记第二版')"),false);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("a concurrent newer version preserves the rejected browser draft until explicit latest reading",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp;
  try{
    await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);await click(c,"#caseSave");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='saved'");
    const identity=await c.evaluate("document.getElementById('caseArchive').dataset.caseId"),url=base+"/api/query/monthly-analysis/cases/"+identity;
    const first=await(await fetch(url,{headers:{Authorization:"Bearer "+owner}})).json();
    const response=await fetch(url,{method:"PUT",headers:{Authorization:"Bearer "+owner,"Content-Type":"application/json"},body:JSON.stringify({...first.metadata,note:"另一标签页已保存",base_version:1,base_version_id:first.version_id,intent_id:"d".repeat(32)})});
    assert.equal(response.status,200);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","我尚未提交的草稿");await click(c,"#caseEditSave");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'");
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"我尚未提交的草稿");
    assert.equal(await c.evaluate("document.getElementById('caseArchive').dataset.version"),"1");
    assert.match(await c.evaluate("document.getElementById('caseStatus').textContent"),/草稿未覆盖/);
    await click(c,"#caseLatest");await waitFor(c,"document.getElementById('caseArchive').dataset.version==='2'");
    assert.match(await c.evaluate("document.getElementById('caseOriginal').textContent"),/另一标签页已保存/);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("a lost edit response replays the same version and never appends a duplicate",()=>withService(async base=>{
  const browser=await launchBrowser(edge),c=browser.cdp,pending=[];let failed=false;
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused"){
    const p=m.params;if(p.request.method==="PUT"&&!failed){failed=true;pending.push(c.send("Fetch.failRequest",{requestId:p.requestId,errorReason:"Failed"}));}
    else pending.push(c.send("Fetch.continueRequest",{requestId:p.requestId}));
  }});
  try{
    await openReport(c,base);await click(c,"#reportSaveCase");await type(c,"caseOwnerToken",owner);await click(c,"#caseSave");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='saved'");
    const identity=await c.evaluate("document.getElementById('caseArchive').dataset.caseId");
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","重试不重复版本");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/monthly-analysis/cases/*",requestStage:"Response"}]});
    await click(c,"#caseEditSave");await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'");
    await c.send("Fetch.disable");await Promise.allSettled(pending);await click(c,"#caseEditSave");
    await waitFor(c,"document.getElementById('caseArchive').dataset.version==='2'&&!document.getElementById('caseVersion').disabled");
    assert.equal(await c.evaluate("document.getElementById('caseEditSave').disabled"),true);
    const versions=await(await fetch(base+"/api/query/monthly-analysis/cases/"+identity+"/versions",{headers:{Authorization:"Bearer "+owner}})).json();
    assert.equal(versions.versions.length,2);
  }finally{await browser.close();}
},{caseOwnerToken:owner,enableCaseStore:true}));
