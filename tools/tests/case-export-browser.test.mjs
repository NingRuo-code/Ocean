import test from "node:test";
import assert from "node:assert/strict";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {mkdtemp,readdir,readFile,rm} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {launchBrowser,waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";

const edge=process.env.EDGE??"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",owner="self-authored-export-owner";
const headers={Authorization:"Bearer "+owner,"Content-Type":"application/json"};
async function click(c,selector){
  const point=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control: '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
}
async function type(c,id,value){await c.evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).value=''`);await c.send("Input.insertText",{text:value});}
async function savedCase(base){
  const item=(await(await fetch(base+"/api/query/monthly-analysis/published")).json()).results[0];
  const report=await(await fetch(base+"/api/query/monthly-analysis/published/"+encodeURIComponent(item.result_id)+"/report?projection_id="+encodeURIComponent(item.projection_id))).json();
  const response=await fetch(base+"/api/query/monthly-analysis/cases",{method:"POST",headers,body:JSON.stringify({result_id:item.result_id,projection_id:item.projection_id,report_id:report.report_id,intent_id:"8".repeat(32),title:"冻结版本导出",tags:["A,B"],note:"第一版人工笔记"})});
  assert.equal(response.status,200);return response.json();
}
async function openCase(c,base){
  await c.send("Page.enable");await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,"#workbenchToggle");await click(c,"#caseArchiveOpen");await type(c,"caseOwnerToken",owner);await click(c,"#caseLoad");
  await waitFor(c,"document.querySelectorAll('#caseItems button').length===1&&!document.getElementById('caseLoad').disabled");await click(c,"#caseItems button");
  await waitFor(c,"document.getElementById('caseArchive').dataset.state==='opened'&&!document.getElementById('caseVersion').disabled");
}
function exportUrl(base,saved,format){return `${base}/api/query/monthly-analysis/cases/${saved.case_id}/versions/${saved.version}/exports/${format}?version_id=${encodeURIComponent(saved.version_id)}&report_id=${encodeURIComponent(saved.report.report_id)}`;}
async function downloaded(directory,extension){
  for(let n=0;n<200;n++){const file=(await readdir(directory)).find(name=>name.endsWith(extension));if(file)return join(directory,file);await delay(50);}
  assert.fail("Browser did not download "+extension);
}

test("owner actually downloads the selected old case version without exporting the unsaved note draft",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-files-"));
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    const update=await fetch(base+"/api/query/monthly-analysis/cases/"+first.case_id,{method:"PUT",headers,body:JSON.stringify({...first.metadata,note:"第二版外部已保存",base_version:1,base_version_id:first.version_id,intent_id:"9".repeat(32)})});assert.equal(update.status,200);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","本页未保存草稿，不应导出");
    for(const [format,button,extension] of [["markdown","#caseExportMarkdown",".md"],["csv","#caseExportCsv",".csv"]]){
      await click(c,button);const file=await downloaded(directory,extension),bytes=await readFile(file);
      const response=await fetch(exportUrl(base,first,format),{headers});assert.equal(response.status,200);assert.deepEqual(bytes,Buffer.from(await response.arrayBuffer()));
      assert.ok(file.includes(first.version_id.slice(7,19)));assert.match(bytes.toString("utf8"),/第一版人工笔记/);assert.doesNotMatch(bytes.toString("utf8"),/第二版外部已保存|本页未保存草稿/);
      if(format==="csv")assert.ok(bytes.subarray(0,3).equals(Buffer.from([239,187,191])));
      await waitFor(c,"document.getElementById('caseExportMarkdown').disabled===false");
    }
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"本页未保存草稿，不应导出");
    assert.equal(await c.evaluate("document.getElementById('caseArchive').dataset.version"),"1");
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("a denied owner file download clears private evidence and never falls back to a public file",()=>withService(async base=>{
  await savedCase(base);const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-denied-")),pending=[];
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:401,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from("{}").toString("base64")}));});
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","鉴权失效按原安全规则清除本草稿");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/csv?*",requestStage:"Request"}]});await click(c,"#caseExportCsv");
    await waitFor(c,"document.querySelector('#caseArchive [role=status]').textContent.includes('令牌已清除')");
    assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
    assert.match(await c.evaluate("document.querySelector('#caseArchive [role=status]').textContent"),/未保存草稿已清除/);
    assert.deepEqual(await readdir(directory),[]);await Promise.allSettled(pending);await c.send("Fetch.disable");
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("an ordinary failed download retains the draft and explicitly retries the same saved version",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-retry-")),pending=[];
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from("{}").toString("base64")}));});
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","保留普通失败草稿");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/csv?*",requestStage:"Request"}]});await click(c,"#caseExportCsv");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'&&!document.getElementById('caseExportCsv').disabled");
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"保留普通失败草稿");assert.deepEqual(await readdir(directory),[]);
    await c.send("Fetch.disable");await Promise.allSettled(pending);await click(c,"#caseExportCsv");
    const bytes=await readFile(await downloaded(directory,".csv"));assert.match(bytes.toString("utf8"),/第一版人工笔记/);assert.doesNotMatch(bytes.toString("utf8"),/保留普通失败草稿/);
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"保留普通失败草稿");
    const versions=await(await fetch(base+"/api/query/monthly-analysis/cases/"+first.case_id+"/versions",{headers})).json();assert.equal(versions.versions.length,1);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

for(const leave of ["lock","offline","escape"]){
  test(`leaving through ${leave} cancels a late owner file without a download`,()=>withService(async base=>{
    await savedCase(base);const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-late-"));let held=null;
    c.onEvent(m=>{if(m.method==="Fetch.requestPaused")held=m.params.requestId;});
    try{
      await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
      await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/markdown?*",requestStage:"Request"}]});await click(c,"#caseExportMarkdown");
      for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
      if(leave==="escape"){
        await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape"});
      }else await click(c,leave==="lock"?"#caseLock":"#serverModeToggle");
      await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});await delay(150);await c.send("Fetch.disable");
      assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
      assert.deepEqual(await readdir(directory),[]);
    }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
  },{caseOwnerToken:owner,enableCaseStore:true}));
}
