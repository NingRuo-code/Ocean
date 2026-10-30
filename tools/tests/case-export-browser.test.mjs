import test from "node:test";
import assert from "node:assert/strict";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtemp,readdir,readFile,rm} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {launchBrowser,waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";

import {owner,headers,click,type,savedCase,openCase,exportUrl,downloaded} from "../lib/case-test-browser.mjs";
const edge=process.env.EDGE??"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

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

for(const [leave,format] of [["lock","markdown"],["offline","markdown"],["escape","markdown"],["history","bundle"]]){
  test(`leaving through ${leave} cancels a late owner ${format} without a download`,()=>withService(async base=>{
    await savedCase(base);const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-late-"));let held=null;
    c.onEvent(m=>{if(m.method==="Fetch.requestPaused")held=m.params.requestId;});
    try{
      await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
      await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/"+format+"?*",requestStage:"Request"}]});await click(c,format==="bundle"?"#caseExportBundle":"#caseExportMarkdown");
      for(let n=0;n<100&&!held;n++)await delay(25);assert.ok(held);
      if(leave==="escape"){
        await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape"});
      }else await click(c,leave==="lock"?"#caseLock":leave==="history"?"#observationView":"#serverModeToggle");
      await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});await delay(150);await c.send("Fetch.disable");
      assert.equal(await c.evaluate("document.getElementById('caseOwnerToken').value"),"");assert.equal(await c.evaluate("document.getElementById('caseOriginal').textContent"),"");
      assert.deepEqual(await readdir(directory),[]);
    }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
  },{caseOwnerToken:owner,enableCaseStore:true}));
}

test("a small-screen owner downloads a version bundle whose manifest checks the actual standalone files",()=>withService(async base=>{
  const first=await savedCase(base),browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-bundle-"));
  try{
    await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await click(c,"#caseExportBundle");const file=await downloaded(directory,".zip"),bytes=await readFile(file);
    const response=await fetch(exportUrl(base,first,"bundle"),{headers});assert.deepEqual(bytes,Buffer.from(await response.arrayBuffer()));
    const unpacked=spawnSync("python",["-c","import sys,zipfile,json,base64;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({n:base64.b64encode(z.read(n)).decode() for n in z.namelist()}))",file],{encoding:"utf8",windowsHide:true});
    assert.equal(unpacked.status,0,unpacked.stderr);const files=JSON.parse(unpacked.stdout);
    assert.deepEqual(Object.keys(files),["report.md","daily.csv","manifest.json"]);
    const manifest=JSON.parse(Buffer.from(files["manifest.json"],"base64").toString("utf8"));
    assert.equal(manifest.case_version_id,first.version_id);assert.equal(manifest.report_id,first.report.report_id);
    for(const item of manifest.files){
      const data=Buffer.from(files[item.name],"base64");assert.equal(item.bytes,data.length);assert.equal(item.sha256,"sha256:"+createHash("sha256").update(data).digest("hex"));
      const standalone=await fetch(exportUrl(base,first,item.name==="report.md"?"markdown":"csv"),{headers});assert.deepEqual(data,Buffer.from(await standalone.arrayBuffer()));
    }
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));

test("an oversized binary response fails before creating a download and keeps the ordinary-failure draft",()=>withService(async base=>{
  await savedCase(base);const browser=await launchBrowser(edge),c=browser.cdp,directory=await mkdtemp(join(tmpdir(),"ocean-case-budget-")),pending=[];
  c.onEvent(m=>{if(m.method==="Fetch.requestPaused")pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:"application/zip"}],body:Buffer.alloc(1_048_577,80).toString("base64")}));});
  try{
    await c.send("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory});await openCase(c,base);
    await click(c,"#caseEditFields summary");await type(c,"caseEditNote","超预算也保留本草稿");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/exports/bundle?*",requestStage:"Request"}]});await click(c,"#caseExportBundle");
    await waitFor(c,"document.getElementById('caseArchive').dataset.state==='error'&&!document.getElementById('caseExportBundle').disabled");
    assert.equal(await c.evaluate("document.getElementById('caseEditNote').value"),"超预算也保留本草稿");assert.deepEqual(await readdir(directory),[]);
    await c.send("Fetch.disable");await Promise.allSettled(pending);
  }finally{await browser.close();await rm(directory,{recursive:true,force:true});}
},{caseOwnerToken:owner,enableCaseStore:true}));
