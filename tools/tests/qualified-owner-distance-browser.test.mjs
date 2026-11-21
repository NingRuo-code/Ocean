import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {access, mkdir, readFile, unlink, writeFile} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import {join} from "node:path";
import {launchBrowser, waitFor} from "../lib/browser-driver.mjs";
import {click, headers, owner, type} from "../lib/case-test-browser.mjs";
import {withService} from "../lib/monthly-test-service.mjs";

const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const root = "#ownerRuns";
const route = "/api/query/monthly-analysis/owner-runs";
const mode = "monthly_distance_reference";
const month = "2024-08";
const coordinates = {longitude:124.5,latitude:30.2,radius_km:10};
const dates = Array.from({length:31}, (_, i) => month + "-" + String(i + 1).padStart(2,"0"));

function layer(kind, hours) {
  return {
    id:kind==="front"?"front-original":"effort-original",kind,role:"analysis_source",
    unit:kind==="front"?"classification_code":"fishing_hours",
    time_verified:true,bounds_verified:true,support_verified:true,duration_days:1,
    cells:[{bounds:[124.1,29.8,124.9,30.6],hours,support:"valid"}],
  };
}

const fixture = JSON.stringify({
  schema:"ocean-month-distance-input/v1",
  conditions:{schema:"ocean-support-request/v1",purpose:"A_month",month,layer_use:"front_effort",
    method_version:"wgs84-laea-uniform/v1",quality_rule:"complete-common-support/v1",allocation:"overlap_uniform",
    geometries:[{id:"circle",type:"circle",center:[coordinates.longitude,coordinates.latitude],radius_km:coordinates.radius_km}]},
  distance_edges_km:[5,20],front_position_error_km:0.01,
  regional_cells:{schema:"ocean-regional-cells/v1",evidence_kind:"synthetic",
    days:dates.map((date,i)=>({date,layers:[layer("front",null),layer("activity",i===1?0:40)]}))},
  front_days:dates.map(date=>({date,source_id:"front-original",lines:[[[124.55,30.15],[124.55,30.25]]]})),
});

async function useControlledVisibility(c) {
  // Keep unrelated desktop focus changes out of the measured retry/reconnect paths.
  await c.send("Page.addScriptToEvaluateOnNewDocument",{source:
    "Object.defineProperty(document,'hidden',{get:()=>window.oceanTestHidden===true});"+
    "document.addEventListener('visibilitychange',event=>{if(event.isTrusted)event.stopImmediatePropagation()},true);",
  });
}

async function openOwner(c,base) {
  await c.send("Page.enable");
  await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,"#workbenchToggle");
  await click(c,"#monthlyDraftOpen");
  await click(c,root+" summary");
}

async function prepareDistanceInBrowser(c,base) {
  await openOwner(c,base);
  await c.evaluate(`(()=>{
    document.getElementById('ownerRunPurpose').value=${JSON.stringify(mode)};
    document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'));
    for(const [id,value] of Object.entries({monthDraftMonth:${JSON.stringify(month)},monthDraftLongitude:'124.5',monthDraftLatitude:'30.2',monthDraftRadius:'10'})){
      const field=document.getElementById(id);
      field.value=value;
      field.dispatchEvent(new Event('input',{bubbles:true}));
    }
  })()`);
  assert.equal(await c.evaluate("document.getElementById('ownerRunPrepare').disabled"),true);
  await type(c,"ownerRunToken",owner);
  await click(c,"#ownerRunPrepare");
  await waitFor(c,`document.querySelector('${root}').dataset.state==='prepared'`);
}

test("owner prepares and submits the same frozen P0 distance sample through the browser", () =>
  withService(async (base,{distancePath,distanceSupport})=>{
    const browser=await launchBrowser(edge), c=browser.cdp, submissions=[];
    c.onEvent(msg=>{
      const request=msg.params?.request;
      if(msg.method==="Network.requestWillBeSent"&&request.method==="POST"&&request.url===base+route){
        submissions.push(JSON.parse(request.postData));
      }
    });
    try{
      const options = base+route+"/distance-options?"+new URLSearchParams({...coordinates,month});
      assert.equal((await fetch(options)).status,401);
      await c.send("Network.enable");
      await prepareDistanceInBrowser(c,base);
      assert.equal(submissions.length,0);
      await c.evaluate("document.getElementById('ownerRunSubmit').click();document.getElementById('ownerRunSubmit').click()");
      await waitFor(c,`document.querySelector('${root}').dataset.state==='completed'`,40_000);
      assert.equal(submissions.length,1);
      assert.equal(submissions[0].request.purpose,mode);
      const id=await c.evaluate(`document.querySelector('${root}').dataset.runId`);
      const query="?purpose="+mode;
      const run=await(await fetch(base+route+"/"+id+query,{headers})).json();
      assert.equal(run.result.parameters.support_snapshot_id,submissions[0].request.support_snapshot_id);
      assert.equal(run.result.days[1].common.hours,0);
      assert.equal(run.result.days.length,31);
      assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/合成距离参照.*真实研究/s);
      assert.equal(await c.evaluate("document.getElementById('monthDraftSubmit').disabled"),true);
      assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/月度距离分带.*距离未知/s);
      assert.equal(await c.evaluate("document.querySelector('#ownerRunResult tr[data-date=\\\"2024-08-02\\\"] [data-field=hours]').textContent"),"0");
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_spatial_example';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),"");
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_distance_reference';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");

      await click(c,"#ownerRunPrepare");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      await unlink(distancePath);
      await unlink(distanceSupport);
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'");
      assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/明确拒绝/);
      assert.equal(await c.evaluate("document.getElementById('ownerRunPrepare').disabled"),false);
      assert.equal(submissions.length,2);
      const rejected=await fetch(base+route+"/intents/"+submissions[1].intent_id+query,{headers});
      assert.equal(rejected.status,404);
      assert.equal(rejected.headers.get("X-Ocean-Submission-State"),null);
      await click(c,"#ownerRunHistory");
      await waitFor(c,`document.querySelector('${root}').dataset.state==='history'`);
      await click(c,"#ownerRunItems button");
      await waitFor(c,`document.querySelector('${root}').dataset.state==='completed'`);
      assert.equal(await c.evaluate(`document.querySelector('${root}').dataset.runId`),id);
      assert.equal(submissions.length,2);
      assert.equal((await(await fetch(base+route+query,{headers})).json()).runs.length,1);
    } finally {
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true})
);

const sstFixture = JSON.parse(fixture);
sstFixture.conditions.layer_use = "front_effort_sst";
for(const day of sstFixture.regional_cells.days){
  day.layers.push({...layer("sst",null),id:"sst-original",unit:"degree_C"});
}

test("distance history can read supported SST records and a terminal engine failure", () =>
  withService(async (base,{distancePath})=>{
    const params=new URLSearchParams({...coordinates,month,layer_use:"front_effort_sst"});
    async function submit(intent_id){
      const options=await fetch(base+route+"/distance-options?"+params,{headers});
      assert.equal(options.status,200,await options.clone().text());
      const {input_sha256,request}=await options.json();
      const response=await fetch(base+route,{
        method:"POST",headers,body:JSON.stringify({intent_id,input_sha256,request}),
      });
      assert.equal(response.status,200,await response.clone().text());
      return response.json();
    }
    const completed=await submit("1".repeat(32));
    assert.equal(completed.state,"completed");
    const malformedLines=structuredClone(sstFixture);
    malformedLines.front_days[0].source_id="wrong-front-source";
    await writeFile(distancePath,JSON.stringify(malformedLines),"utf8");
    const failed=await submit("2".repeat(32));
    assert.equal(failed.state,"failed");
    assert.equal(failed.result,null);

    const browser=await launchBrowser(edge), c=browser.cdp;
    try{
      await openOwner(c,base);
      await type(c,"ownerRunToken",owner);
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_distance_reference';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      await click(c,"#ownerRunHistory");
      await waitFor(c,"document.querySelectorAll('#ownerRunItems button').length===2");
      await click(c,'#ownerRunItems button[data-run-id="'+completed.id+'"]');
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      await click(c,'#ownerRunItems button[data-run-id="'+failed.id+'"]');
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='failed'");
      assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/终态失败/);
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_spatial_example';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value.length>0"),true);
      await click(c,"#serverModeToggle");
      await waitFor(c,"document.getElementById('ownerRunToken').value==='' && document.getElementById('ownerRunHistory').disabled");
    } finally {
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:JSON.stringify(sstFixture),qualifyDistanceFixture:true})
);

async function waitForComputedDistance(path) {
  const deadline = Date.now()+22_000;
  while (Date.now()<deadline) {
    try {
      await access(path);
      return;
    } catch (error) {
      if(error.code!=="ENOENT")throw error;
    }
    await delay(30);
  }
  assert.fail("The actual child did not complete in time");
}

test("a closed panel can recover the same run when P0 is withdrawn during execution", () =>
  withService(async (base,{distanceSupport,distanceResultReady,releaseDistanceResult})=>{
    const browser=await launchBrowser(edge), c=browser.cdp, submissions=[];
    c.onEvent(msg=>{
      const request=msg.params?.request;
      if(msg.method==="Network.requestWillBeSent"&&request.method==="POST"&&request.url===base+route){
        submissions.push(JSON.parse(request.postData));
      }
    });
    try{
      await c.send("Network.enable");
      await prepareDistanceInBrowser(c,base);
      await click(c,"#ownerRunSubmit");
      await waitForComputedDistance(distanceResultReady);
      assert.equal(submissions.length,1);
      await click(c,"#monthDraftClose");
      assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value"),"");
      await unlink(distanceSupport);
      await writeFile(releaseDistanceResult,"release");
      const url=base+route+"/intents/"+submissions[0].intent_id+"?purpose="+mode;
      const deadline=Date.now()+8_000;
      let record;
      while(Date.now()<deadline){
        const response=await fetch(url,{headers});
        if(response.status===200){
          record=await response.json();
          break;
        }
        assert.equal(response.status,404,await response.text());
        await delay(50);
      }
      assert.equal(record?.state,"failed");
      assert.deepEqual(record.error,{code:"calculation_failed"});
      assert.equal(record.failure_reason,"execution_evidence_changed");
      assert.equal(record.result,null);

      await click(c,"#monthlyDraftOpen");
      await type(c,"ownerRunToken",owner);
      await click(c,"#ownerRunFindIntent");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='failed'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),record.id);
      assert.match(await c.evaluate("document.getElementById('ownerRunResult').textContent"),/中止.*无法.*核验/s);
      assert.equal(submissions.length,1);
    } finally {
      await writeFile(releaseDistanceResult,"release");
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,holdDistanceResult:true})
);

test("recovers a timed-out qualified response with only a read of the original intent", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge), c=browser.cdp, requests=[];
    let lostResponse;
    c.onEvent(msg=>{
      if(msg.method==="Network.requestWillBeSent"&&msg.params.request.url.startsWith(base+route)){
        requests.push(msg.params.request);
      }
      if(msg.method==="Fetch.requestPaused"&&msg.params.responseStatusCode){
        const requestId=msg.params.requestId;
        lostResponse=(async()=>{
          const raw=await c.send("Fetch.getResponseBody",{requestId});
          // Leave the committed response paused until the browser's own deadline aborts its read.
          return JSON.parse(raw.base64Encoded?Buffer.from(raw.body,"base64").toString():raw.body);
        })();
      }
    });
    try{
      await c.send("Network.enable");
      await useControlledVisibility(c);
      await prepareDistanceInBrowser(c,base);
      const zoom=await c.evaluate("state.zoom");
      await c.send("Fetch.enable",{patterns:[{urlPattern:"*/owner-runs",requestStage:"Response"}]});
      const submittedAt=Date.now();
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='submitting'");
      await click(c,"#zoomIn");
      await waitFor(c,"state.zoom!=="+zoom);
      const applied=await c.evaluate("({lon:state.lon,lat:state.lat,date:state.date,range:state.range,zoom:state.zoom})");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='uncertain'",55_000);
      assert.ok(Date.now()-submittedAt>=39_000);
      assert.equal(await c.evaluate("document.getElementById('ownerRunSubmit').disabled"),true);
      const run=await lostResponse;
      assert.equal(run.state,"completed");
      await c.send("Fetch.disable");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'",12_000);
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),run.id);
      assert.deepEqual(await c.evaluate("({lon:state.lon,lat:state.lat,date:state.date,range:state.range,zoom:state.zoom})"),applied);
      const intentPath=route+"/intents/"+run.intent_id+"?purpose="+mode;
      assert.equal(requests.filter(request=>request.method==="POST").length,1);
      assert.equal(requests.filter(request=>request.method==="GET"&&request.url===base+intentPath).length,1);
      const stored=await(await fetch(base+route+"?purpose="+mode,{headers})).json();
      assert.equal(stored.runs.length,1);
    } finally {
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true})
);

test("preserves a qualified receipt during disconnect and reauthorizes the same receipt after reload", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge), c=browser.cdp, requests=[];
    c.onEvent(msg=>{
      if(msg.method==="Network.requestWillBeSent"&&msg.params.request.url.startsWith(base+route)){
        requests.push(msg.params.request);
      }
    });
    try{
      await c.send("Network.enable");
      await prepareDistanceInBrowser(c,base);
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'",30_000);
      const runId=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const previous=await c.evaluate("document.getElementById('ownerRunResult').textContent");
      const online={offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1};
      await c.send("Network.emulateNetworkConditions",{...online,offline:true});
      await waitFor(c,"navigator.onLine===false && document.getElementById('ownerRuns').dataset.state==='uncertain'");
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),previous);
      assert.equal(await c.evaluate("document.getElementById('ownerRunRead').disabled"),true);
      const disconnected=requests.length;
      await delay(850);
      assert.equal(requests.length,disconnected);
      await c.send("Network.emulateNetworkConditions",online);
      await waitFor(c,"navigator.onLine===true && document.getElementById('ownerRuns').dataset.state==='completed'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),runId);

      await openOwner(c,base);
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_distance_reference';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      assert.equal(await c.evaluate("document.getElementById('ownerRunToken').value"),"");
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),"");
      const unauthenticated=requests.length;
      await delay(850);
      assert.equal(requests.length,unauthenticated);
      await type(c,"ownerRunToken",owner);
      await click(c,"#ownerRunFindIntent");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),runId);
      assert.equal(requests.filter(request=>request.method==="POST").length,1);
      assert.equal(requests.filter(request=>request.method==="GET"&&request.url.includes("/intents/")).length,2);
    } finally{
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true})
);

test("recovers a damaged qualified reference through history and preserves an explicit selection", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge), c=browser.cdp, requests=[];
    const query="?purpose="+mode;
    const key="ocean-owner-qualified-distance-run-ref/v1";
    c.onEvent(msg=>{
      if(msg.method==="Network.requestWillBeSent"&&msg.params.request.url.startsWith(base+route)){
        requests.push(msg.params.request);
      }
    });
    try{
      await c.send("Network.enable");
      await useControlledVisibility(c);
      await prepareDistanceInBrowser(c,base);
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'",40_000);
      const original=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const submission=JSON.parse(requests.find(request=>request.method==="POST").postData);
      const requested={...submission,intent_id:"d".repeat(32)};
      const response=await fetch(base+route,{method:"POST",headers,body:JSON.stringify(requested)});
      assert.equal(response.status,200);
      const other=await response.json();
      assert.notEqual(other.id,original);

      await c.evaluate("localStorage.setItem("+JSON.stringify(key)+",'{broken')");
      await openOwner(c,base);
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_distance_reference';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.referenceState"),"invalid");
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),"");
      await type(c,"ownerRunToken",owner);
      await click(c,"#ownerRunHistory");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='history'");
      await click(c,'#ownerRunItems button[data-run-id="'+original+'"]');
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),original);

      const prior=await c.evaluate("JSON.parse(localStorage.getItem("+JSON.stringify(key)+"))");
      await click(c,"#ownerRunNew");
      const beforeReopen=requests.length;
      await click(c,root+" summary");
      await waitFor(c,"!document.getElementById('ownerRuns').open");
      await click(c,root+" summary");
      await waitFor(c,"document.getElementById('ownerRuns').open");
      await delay(850);
      assert.equal(await c.evaluate("localStorage.getItem("+JSON.stringify(key)+")"),null);
      assert.equal(requests.length,beforeReopen);

      const unresolved={...prior,run_id:null,intent_id:other.intent_id};
      const inject="localStorage.setItem("+JSON.stringify(key)+","+JSON.stringify(JSON.stringify(unresolved))+");";
      await c.evaluate(inject+"document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      await click(c,"#ownerRunHistory");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='history'");
      await click(c,'#ownerRunItems button[data-run-id="'+original+'"]');
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      assert.equal(await c.evaluate("document.getElementById('ownerRunSubmit').disabled"),true);
      const online={offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1};
      await c.send("Network.emulateNetworkConditions",{...online,offline:true});
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='uncertain'");
      const returning=requests.length;
      await c.send("Network.emulateNetworkConditions",online);
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),original);
      assert.deepEqual(requests.slice(returning).map(request=>[request.method,request.url]),[
        ["GET",base+route+"/intents/"+submission.intent_id+query],
      ]);
      assert.equal(await c.evaluate("localStorage.getItem("+JSON.stringify(key)+")"),JSON.stringify(unresolved));
      assert.equal(requests.filter(request=>request.method==="POST").length,1);
    } finally{
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true})
);

test("bounds intent recovery and stops when the panel closes or authorization is lost", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge), c=browser.cdp, calls=[];
    const intent="e".repeat(32);
    const query=base+route+"/intents/"+intent+"?purpose="+mode;
    const pending=[];
    c.onEvent(msg=>{
      if(msg.method==="Network.requestWillBeSent"&&msg.params.request.url===query){
        calls.push({method:msg.params.request.method,at:msg.params.timestamp});
      }
      if(msg.method==="Fetch.requestPaused"){
        const headers=Object.entries(msg.params.request.headers)
          .filter(([name])=>name.toLowerCase()!=="authorization")
          .map(([name,value])=>({name,value}));
        pending.push(c.send("Fetch.continueRequest",{requestId:msg.params.requestId,headers}));
      }
    });
    try{
      await c.send("Network.enable");
      await useControlledVisibility(c);
      await openOwner(c,base);
      const ref={schema_version:"ocean-owner-qualified-distance-run-ref/v1",base:await c.evaluate("OceanPublicRead.source().base"),intent_id:intent,run_id:null};
      await c.evaluate("localStorage.setItem('ocean-owner-qualified-distance-run-ref/v1',"+JSON.stringify(JSON.stringify(ref))+");document.getElementById('ownerRunPurpose').value='monthly_distance_reference';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      await type(c,"ownerRunToken",owner);
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.referenceState"),"available");
      assert.equal(await c.evaluate("document.getElementById('ownerRunFindIntent').disabled"),false);
      await c.evaluate("document.getElementById('ownerRunFindIntent').click()");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='uncertain'");
      await click(c,root+" summary");
      await waitFor(c,"!document.getElementById('ownerRuns').open");
      await delay(850);
      assert.equal(calls.length,1);
      await c.evaluate("window.oceanTestHidden=true;document.dispatchEvent(new Event('visibilitychange'))");
      await click(c,root+" summary");
      await waitFor(c,"document.getElementById('ownerRuns').open");
      await delay(850);
      assert.equal(calls.length,1);
      await c.evaluate("window.oceanTestHidden=false;document.dispatchEvent(new Event('visibilitychange'))");
      const deadline=Date.now()+43_000;
      while(calls.length<6&&Date.now()<deadline)await delay(50);
      assert.equal(calls.length,6,JSON.stringify({
        elapsed: calls.map(call=>call.at-calls[0].at),
        view: await c.evaluate("({hidden:document.hidden,open:document.getElementById('ownerRuns').open,state:document.getElementById('ownerRuns').dataset.state})")
      }));
      const recovered=calls.slice(1);
      for(const [i,seconds] of [1.2,2.4,4.8,8].entries()){
        assert.ok(recovered[i+1].at-recovered[i].at>=seconds-0.15);
      }
      await delay(8250);
      assert.equal(calls.length,6);
      assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/暂不可核实/);

      await c.send("Fetch.enable",{patterns:[{urlPattern:query,requestStage:"Request"}]});
      await click(c,root+" summary");
      await waitFor(c,"!document.getElementById('ownerRuns').open");
      await click(c,root+" summary");
      await waitFor(c,"document.getElementById('ownerRunToken').value==='' && document.getElementById('ownerRuns').dataset.state==='locked'");
      await Promise.all(pending);
      const stopped=calls.length;
      await delay(1450);
      assert.equal(stopped,7);
      assert.equal(calls.length,stopped);
      assert.ok(calls.every(call=>call.method==="GET"));
      const stored=await(await fetch(base+route+"?purpose="+mode,{headers})).json();
      assert.equal(stored.runs.length,0);
    } finally{
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true})
);

test("an actual service interruption leaves the pending intent unknown without publishing a partial run", () => {
  const options={caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true};
  return withService(async (base,{distanceStorePath,distanceResultReady,releaseDistanceResult,interrupt})=>{
    const browser=await launchBrowser(edge), c=browser.cdp, submissions=[];
    const query="?purpose="+mode;
    c.onEvent(msg=>{
      const request=msg.params?.request;
      if(msg.method==="Network.requestWillBeSent"&&request.method==="POST"&&request.url===base+route){
        submissions.push(JSON.parse(request.postData).intent_id);
      }
    });
    try {
      await c.send("Network.enable");
      await prepareDistanceInBrowser(c,base);
      await writeFile(releaseDistanceResult,"release first result");
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'",40_000);
      const completed=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const published=await c.evaluate("document.getElementById('ownerRunResult').textContent");
      await unlink(distanceResultReady);
      await unlink(releaseDistanceResult);
      await click(c,"#ownerRunPrepare");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      await click(c,"#ownerRunSubmit");
      const deadline=Date.now()+30_000;
      let running=false;
      while(!running&&Date.now()<deadline){
        running=await access(distanceResultReady).then(()=>true,()=>false);
        if(!running)await delay(50);
      }
      assert.equal(running,true,"the actual engine reached the pre-commit test pause");
      assert.equal(submissions.length,2);
      assert.equal((await fetch(base+route+"/intents/"+submissions[1]+query,{headers})).status,404);
      await interrupt();
      await assert.rejects(fetch(base+"/api/health",{signal:AbortSignal.timeout(1500)}));
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='uncertain'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),completed);
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),published);
      assert.equal(await c.evaluate("document.getElementById('ownerRunSubmit').disabled"),true);
      assert.equal(await c.evaluate("document.getElementById('ownerRunNew').disabled"),true);

      await withService(async restarted=>{
        const pending=await fetch(restarted+route+"/intents/"+submissions[1]+query,{headers});
        assert.equal(pending.status,404);
        const resumed=await fetch(restarted+route+"/intents/"+submissions[0]+query,{headers});
        assert.equal(resumed.status,200);
        assert.equal((await resumed.json()).id,completed);
        const history=await(await fetch(restarted+route+query,{headers})).json();
        assert.deepEqual(history.runs.map(run=>run.id),[completed]);
      },{...options,qualifiedRunPath:distanceStorePath});
      assert.equal(submissions.length,2);
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.state"),"uncertain");
    } finally {
      await browser.close();
    }
  },{...options,holdDistanceResult:true});
});


test("the qualified browser can explicitly cancel the real worker and reopen its terminal record", () =>
  withService(async (base,{distanceProcessStarted})=>{
    const browser=await launchBrowser(edge), c=browser.cdp, posts=[];
    const query="?purpose="+mode;
    c.onEvent(msg=>{
      const request=msg.params?.request;
      if(msg.method==="Network.requestWillBeSent"&&request.method==="POST"&&request.url.startsWith(base+route)){
        posts.push(request);
      }
    });
    try{
      await c.send("Network.enable");
      await prepareDistanceInBrowser(c,base);
      assert.equal(await c.evaluate("document.getElementById('ownerRunCancel').disabled"),true);
      await click(c,"#ownerRunSubmit");
      const deadline=Date.now()+30_000;
      let started=false;
      while(!started&&Date.now()<deadline){
        started=await access(distanceProcessStarted).then(()=>true,()=>false);
        if(!started)await delay(35);
      }
      assert.equal(started,true);
      assert.equal(posts.length,1);
      const intent=JSON.parse(posts[0].postData).intent_id;
      const cancelPath=base+route+"/intents/"+intent+"/cancel";
      assert.equal(await c.evaluate("document.getElementById('ownerRunCancel').disabled"),false);
      await c.send("Fetch.enable",{patterns:[{urlPattern:"*/cancel",requestStage:"Response"}]});
      await click(c,"#ownerRunCancel");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='cancelled'",25_000);
      await c.send("Fetch.disable");
      await delay(350);
      assert.match(await c.evaluate("document.getElementById('ownerRunCancelStatus').textContent"),/已确认取消/);
      const id=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const body=await(await fetch(base+route+"/intents/"+intent+query,{headers})).json();
      assert.equal(body.id,id);
      assert.equal(body.cancelled,true);
      assert.equal(body.result,null);
      assert.equal(await c.evaluate("document.querySelector('#ownerRunResult table')===null"),true);
      assert.deepEqual(posts.map(request=>request.url),[base+route,cancelPath]);

      await openOwner(c,base);
      await c.evaluate("document.getElementById('ownerRunPurpose').value='monthly_distance_reference';document.getElementById('ownerRunPurpose').dispatchEvent(new Event('change'))");
      await type(c,"ownerRunToken",owner);
      await click(c,"#ownerRunFindIntent");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='cancelled'");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),id);
      assert.deepEqual(posts.map(request=>request.url),[base+route,cancelPath]);
    } finally{
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,traceDistanceProcess:true})
);


async function waitForServiceFile(path, expected) {
  const deadline=Date.now()+25_000;
  while(Date.now()<deadline){
    const observed=await readFile(path,"utf8").catch(()=>null);
    if(observed!==null&&(expected===undefined||observed===expected))return;
    await delay(35);
  }
  assert.fail("The actual service did not reach the observed stage");
}

test("the browser withdraws a same-owner submission waiting for the previous calculation to commit", () =>
  withService(async (base,{distanceProcessStarted,distanceIntentsStarted,distanceResultReady,releaseDistanceResult})=>{
    const browser=await launchBrowser(edge), c=browser.cdp;
    let first;
    try {
      await prepareDistanceInBrowser(c,base);
      await writeFile(releaseDistanceResult,"publish the selected original");
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      const chosen=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const preserved=await c.evaluate("document.getElementById('ownerRunResult').textContent");
      await unlink(releaseDistanceResult);
      await unlink(distanceResultReady);
      await click(c,"#ownerRunPrepare");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      const query=new URLSearchParams({...coordinates,month});
      const options=await(await fetch(base+route+"/distance-options?"+query,{headers})).json();
      first=fetch(base+route,{method:"POST",headers,body:JSON.stringify({
        intent_id:"b".repeat(32),input_sha256:options.input_sha256,request:options.request,
      })});
      await waitForServiceFile(distanceResultReady);
      await click(c,"#ownerRunSubmit");
      await waitForServiceFile(distanceIntentsStarted,"3");
      const queued=await c.evaluate("JSON.parse(localStorage.getItem('ocean-owner-qualified-distance-run-ref/v1')).intent_id");
      await click(c,"#ownerRunCancel");
      await waitFor(c,"document.getElementById('ownerRunCancelStatus').textContent.includes('已提出取消')");
      await writeFile(releaseDistanceResult,"release first result");
      const original=await(await first).json();
      assert.equal(original.state,"completed");
      await waitFor(c,"document.getElementById('ownerRunCancelStatus').textContent.includes('已确认取消')");
      assert.equal(await readFile(distanceProcessStarted,"utf8"),"2");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),chosen);
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),preserved);
      const result=await(await fetch(base+route+"/intents/"+queued+"?purpose="+mode,{headers})).json();
      assert.equal(result.cancelled,true);
      assert.equal(result.result,null);
    } finally {
      await writeFile(releaseDistanceResult,"release");
      await first?.catch(()=>{});
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,holdDistanceResult:true,traceDistanceProcess:true})
);

test("the browser learns that a real calculation has reached publication and keeps its completed result", () =>
  withService(async (base,{distanceResultReady,releaseDistanceResult})=>{
    const browser=await launchBrowser(edge), c=browser.cdp;
    try {
      await useControlledVisibility(c);
      await prepareDistanceInBrowser(c,base);
      await writeFile(releaseDistanceResult,"publish selected result");
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      const chosen=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const preserved=await c.evaluate("document.getElementById('ownerRunResult').textContent");
      const map=await c.evaluate("({zoom:state.zoom,center:state.view,date:state.date,range:state.range})");
      await unlink(releaseDistanceResult);
      await unlink(distanceResultReady);
      await click(c,"#ownerRunPrepare");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      await click(c,"#ownerRunSubmit");
      await waitForServiceFile(distanceResultReady);
      const intent=await c.evaluate("JSON.parse(localStorage.getItem('ocean-owner-qualified-distance-run-ref/v1')).intent_id");
      await click(c,"#ownerRunCancel");
      await waitFor(c,"document.getElementById('ownerRunCancelStatus').textContent.includes('无法撤回')");
      await writeFile(releaseDistanceResult,"publish competing result");
      await waitFor(c,"document.getElementById('ownerRunCancelStatus').textContent.includes('已经完成')");
      const published=await(await fetch(base+route+"/intents/"+intent+"?purpose="+mode,{headers})).json();
      assert.equal(published.state,"completed");
      assert.equal(published.result.days.length,31);
      assert.equal(Object.hasOwn(published,"cancelled"),false);
      assert.notEqual(published.id,chosen);
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),chosen);

      await click(c,root+" summary");
      await waitFor(c,"!document.getElementById('ownerRuns').open");
      await click(c,root+" summary");
      await waitFor(c,"document.getElementById('ownerRunStatus').textContent.includes('可靠提交')");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),chosen);
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),preserved);
      assert.deepEqual(await c.evaluate("({zoom:state.zoom,center:state.view,date:state.date,range:state.range})"),map);
    } finally {
      await writeFile(releaseDistanceResult,"publish");
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,holdDistancePublication:true})
);


async function timedOutOwnerRun(c,base) {
  await prepareDistanceInBrowser(c,base);
  await click(c,"#ownerRunSubmit");
  await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='failed'");
  return c.evaluate("document.getElementById('ownerRuns').dataset.runId");
}

test("a lost explicit retry receipt recovers the new attempt without repeating the calculation", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge), c=browser.cdp, requests=[];
    let discarded;
    c.onEvent(msg=>{
      const request=msg.params?.request;
      if(msg.method==="Network.requestWillBeSent"&&request.url.startsWith(base+route)){
        requests.push(request);
      }
      if(msg.method==="Fetch.requestPaused"&&msg.params.responseStatusCode){
        discarded=c.send("Fetch.failRequest",{requestId:msg.params.requestId,errorReason:"Failed"});
      }
    });
    try{
      await c.send("Network.enable");
      await useControlledVisibility(c);
      const parent=await timedOutOwnerRun(c,base);
      const original=await(await fetch(base+route+"/"+parent+"?purpose="+mode,{headers})).json();
      assert.equal(original.failure_reason,"execution_timed_out");
      await click(c,"#ownerRunRetry");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      assert.match(await c.evaluate("document.getElementById('ownerRunPrepared').textContent"),/原条件重试/);
      assert.equal(requests.filter(request=>request.method==="POST").length,1);

      await c.send("Fetch.enable",{patterns:[{urlPattern:"*/retry",requestStage:"Response"}]});
      await c.evaluate("document.getElementById('ownerRunSubmit').click();document.getElementById('ownerRunSubmit').click()");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'",35_000);
      await discarded;
      await c.send("Fetch.disable");
      const newId=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      assert.notEqual(newId,parent);
      const retry=await(await fetch(base+route+"/"+newId+"?purpose="+mode,{headers})).json();
      assert.equal(retry.retry.parent_run_id,parent);
      assert.equal(retry.retry.parent_record_id,original.record_id);
      assert.equal(retry.retry.mode,"same_conditions");
      assert.deepEqual(retry.request,original.request);
      assert.equal(requests.filter(request=>request.method==="POST").length,2);
      assert.equal(requests.filter(request=>request.url===base+route+"/"+parent+"/retry").length,1);
      assert.equal(requests.filter(request=>request.url===base+route+"/intents/"+retry.intent_id+"?purpose="+mode).length,1);
      assert.deepEqual(await(await fetch(base+route+"/"+parent+"?purpose="+mode,{headers})).json(),original);
    } finally {
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,shortenFirstDistance:true})
);

test("the browser requires a distinct explicit request when the original registered evidence changed", () =>
  withService(async (base,{distancePath,distanceSupportState})=>{
    const browser=await launchBrowser(edge), c=browser.cdp, posts=[];
    c.onEvent(msg=>{
      const request=msg.params?.request;
      if(msg.method==="Network.requestWillBeSent"&&request.method==="POST"&&request.url.startsWith(base+route)){
        posts.push(request);
      }
    });
    try{
      await c.send("Network.enable");
      const parent=await timedOutOwnerRun(c,base);
      const original=await(await fetch(base+route+"/"+parent+"?purpose="+mode,{headers})).json();
      await click(c,"#ownerRunRetry");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      await writeFile(distanceSupportState,JSON.stringify({schema:"ocean-support-state/v1",state:"expired"}));
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'");
      assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/明确拒绝/);
      const expired=JSON.parse(posts[1].postData).intent_id;
      assert.equal((await fetch(base+route+"/intents/"+expired+"?purpose="+mode,{headers})).status,404);
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),parent);
      await unlink(distanceSupportState);

      const changed=JSON.parse(fixture);
      changed.front_position_error_km=0.27;
      await writeFile(distancePath,JSON.stringify(changed));
      await click(c,"#ownerRunRetry");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='error'");
      assert.match(await c.evaluate("document.getElementById('ownerRunStatus').textContent"),/原条件.*不.*重试/);
      assert.equal(posts.length,2);
      await click(c,"#ownerRunRetryCurrent");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      const prepared=await c.evaluate("document.getElementById('ownerRunPrepared').textContent");
      assert.match(prepared,/按当前条件提交新请求/);
      assert.ok(prepared.includes(original.input_sha256));
      assert.equal(posts.length,2);
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      const current=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const newRun=await(await fetch(base+route+"/"+current+"?purpose="+mode,{headers})).json();
      assert.equal(newRun.retry.mode,"current_conditions");
      assert.equal(newRun.retry.parent_run_id,parent);
      assert.notEqual(newRun.input_sha256,original.input_sha256);
      assert.equal(posts.length,3);
      assert.deepEqual(await(await fetch(base+route+"/"+parent+"?purpose="+mode,{headers})).json(),original);
    } finally {
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,shortenFirstDistance:true,watchSupportExpiry:true})
);


test("owner task history filters and pages frozen records without changing the active result or map", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge), c=browser.cdp, posts=[], revocations=[];
    let unavailableDetail=null;
    c.onEvent(msg=>{
      if(msg.method==="Network.requestWillBeSent"&&msg.params.request.url.startsWith(base+route)&&
          msg.params.request.method==="POST")posts.push(msg.params.request);
      if(msg.method==="Fetch.requestPaused"){
        if(msg.params.request.url===unavailableDetail){
          revocations.push(c.send("Fetch.fulfillRequest",{requestId:msg.params.requestId,responseCode:503}));
          return;
        }
        const requestHeaders=Object.entries(msg.params.request.headers)
          .filter(([name])=>name.toLowerCase()!=="authorization")
          .map(([name,value])=>({name,value}));
        revocations.push(c.send("Fetch.continueRequest",{requestId:msg.params.requestId,headers:requestHeaders}));
      }
    });
    try{
      await c.send("Network.enable");
      const failed=await timedOutOwnerRun(c,base);
      await click(c,"#ownerRunPrepare");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='prepared'");
      await click(c,"#ownerRunSubmit");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      const selected=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      const result=await c.evaluate("document.getElementById('ownerRunResult').textContent");
      const before=posts.length;

      const options=await(await fetch(base+route+"/options",{headers})).json();
      const {month,longitude,latitude,radius_km}=options.conditions[0];
      const legacyRequest={month,longitude,latitude,radius_km,purpose:"monthly_spatial_example",
        input_version:options.input_version,method_version:options.method_version,parameter_version:options.parameter_version};
      let legacy;
      for(const marker of ["1","2","3","4"]){
        const seeded=await fetch(base+route,{method:"POST",headers,body:JSON.stringify({
          intent_id:marker.repeat(32),input_sha256:options.input_sha256,request:legacyRequest,
        })});
        assert.equal(seeded.status,200);
        legacy=await seeded.json();
      }

      async function pressEscape(){
        await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
        await c.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
      }
      await click(c,"#ownerTaskHistoryOpen");
      assert.equal(await c.evaluate("document.activeElement.id"),"ownerTaskHistoryPurpose");
      await pressEscape();
      await waitFor(c,"document.getElementById('ownerTaskHistory').hidden");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),selected);
      await click(c,"#ownerTaskHistoryOpen");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===5");
      await click(c,"#ownerTaskHistoryNext");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===1");
      await click(c,"#ownerTaskHistoryPrevious");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===5");
      await click(c,'#ownerTaskHistoryItems button[data-run-id="'+legacy.id+'"]');
      await waitFor(c,"document.getElementById('ownerTaskHistoryDetail').textContent.includes("+JSON.stringify(legacy.result.result_id)+")");
      assert.match(await c.evaluate("document.getElementById('ownerTaskHistoryDetail').textContent"),/聚合结果快照 · 已保存.*原资料.*按原版本复算仍待核验/s);

      await c.evaluate("document.querySelector('#ownerTaskHistoryForm [name=start_date]').value='2026-12-31';document.querySelector('#ownerTaskHistoryForm [name=end_date]').value='2026-01-01'");
      await click(c,"#ownerTaskHistoryApply");
      await waitFor(c,"document.getElementById('ownerTaskHistoryStatus').textContent.includes('上次核实')");
      assert.equal(await c.evaluate("document.getElementById('ownerTaskHistoryNext').disabled"),true);
      await click(c,'#ownerTaskHistoryItems button[data-run-id="'+legacy.id+'"]');
      await waitFor(c,"/已读取.*上次核实/.test(document.getElementById('ownerTaskHistoryStatus').textContent)");
      const original=await(await fetch(base+route+"/"+failed+"?purpose="+mode,{headers})).json();
      const day=original.submitted_at.slice(0,10);
      await c.evaluate("document.getElementById('ownerTaskHistoryPurpose').value='monthly_distance_reference';document.getElementById('ownerTaskHistoryStatusFilter').value='interrupted';"+
        "document.querySelector('#ownerTaskHistoryForm [name=start_date]').value="+JSON.stringify(day)+";"+
        "document.querySelector('#ownerTaskHistoryForm [name=end_date]').value="+JSON.stringify(day));
      await click(c,"#ownerTaskHistoryApply");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===1");
      await click(c,"#ownerTaskHistoryItems button");
      await waitFor(c,"document.getElementById('ownerTaskHistoryDetail').dataset.runId==="+JSON.stringify(failed));
      assert.match(await c.evaluate("document.getElementById('ownerTaskHistoryDetail').textContent"),/原任务条件.*时限.*聚合结果快照 · 无结果记录/s);
      await c.evaluate("document.getElementById('ownerTaskHistoryStatusFilter').value=''");
      await click(c,"#ownerTaskHistoryApply");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===2");
      await click(c,'#ownerTaskHistoryItems button[data-run-id="'+selected+'"]');
      await waitFor(c,"document.getElementById('ownerTaskHistoryDetail').dataset.runId==="+JSON.stringify(selected));
      const detailText="document.getElementById('ownerTaskHistoryDetail').textContent";
      assert.match(await c.evaluate(detailText),/共同支持子集.*P0 sha256:.*聚合结果快照 · 已保存/s);
      for(const scenario of [
        {suffix:"/"+selected+"?purpose="+mode,message:"已读取轻量记录",body:/原任务条件.*聚合结果快照 · 已保存/s},
        {suffix:"/history/"+selected+"/evidence?purpose="+mode,message:"产物状态暂不可核实",body:/共同支持子集.*P0 sha256:/s},
      ]){
        unavailableDetail=base+route+scenario.suffix;
        await c.send("Fetch.enable",{patterns:[{urlPattern:unavailableDetail.replace("?","\\?"),requestStage:"Request"}]});
        await click(c,'#ownerTaskHistoryItems button[data-run-id="'+selected+'"]');
        await waitFor(c,"document.getElementById('ownerTaskHistoryStatus').textContent.includes("+JSON.stringify(scenario.message)+")");
        assert.match(await c.evaluate(detailText),scenario.body);
        await c.send("Fetch.disable");
        unavailableDetail=null;
      }
      await c.evaluate("document.getElementById('ownerTaskHistoryStatusFilter').value='interrupted'");
      await click(c,"#ownerTaskHistoryApply");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===1");
      await click(c,"#ownerTaskHistoryItems button");
      await waitFor(c,"document.getElementById('ownerTaskHistoryDetail').dataset.runId==="+JSON.stringify(failed));
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),selected);
      assert.equal(await c.evaluate("document.getElementById('ownerRunResult').textContent"),result);
      const zoom=await c.evaluate("state.zoom");
      await click(c,"#zoomIn");
      await waitFor(c,"state.zoom!=="+zoom);
      const mapBefore=await c.evaluate("JSON.stringify(state.view)");
      const grip=await c.evaluate(`(()=>{
        const map=document.getElementById('map'),r=map.getBoundingClientRect();
        for(const horizontal of [.65,.75,.55,.85,.45,.35,.25]){
          for(const top of [110,r.height*.13,r.height*.28,r.height*.5,r.height*.65]){
            const x=r.left+r.width*horizontal,y=r.top+top;
            const hit=document.elementFromPoint(x,y);
            if(hit&&map.contains(hit)&&!hit.closest('button,input,select,.map-legend,.map-controls,.map-pick,.map-probe,.load-status'))return{x,y};
          }
        }
        return null;
      })()`);
      assert.ok(grip,"A visible map point can receive the pointer");
      await c.send("Input.dispatchMouseEvent",{type:"mouseMoved",...grip});
      await c.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",buttons:1,clickCount:1,...grip});
      for(const distance of [16,32,48]){
        await c.send("Input.dispatchMouseEvent",{type:"mouseMoved",button:"left",buttons:1,x:grip.x+distance,y:grip.y+distance/3});
      }
      await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",buttons:0,clickCount:1,x:grip.x+48,y:grip.y+16});
      await waitFor(c,"JSON.stringify(state.view)!=="+JSON.stringify(mapBefore));
      assert.equal(await c.evaluate("document.getElementById('ownerTaskHistory').hidden"),false);
      const offline={offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1};
      await c.send("Network.emulateNetworkConditions",offline);
      await waitFor(c,"document.getElementById('ownerTaskHistoryStatus').textContent.includes('暂不可核实')");
      assert.equal(await c.evaluate("document.getElementById('ownerTaskHistoryDetail').dataset.runId"),failed);
      assert.equal(await c.evaluate("document.getElementById('ownerTaskHistoryApply').disabled"),true);
      await c.send("Network.emulateNetworkConditions",{...offline,offline:false});
      await waitFor(c,"navigator.onLine && !document.getElementById('ownerTaskHistoryApply').disabled");

      await c.evaluate("document.querySelector('#ownerTaskHistoryItems button').focus()");
      await pressEscape();
      await waitFor(c,"document.getElementById('ownerTaskHistory').hidden");
      assert.equal(await c.evaluate("document.getElementById('ownerRuns').dataset.runId"),selected);
      assert.equal(await c.evaluate("document.activeElement.id"),"ownerTaskHistoryOpen");

      await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
      await click(c,"#ownerTaskHistoryOpen");
      await waitFor(c,"!document.getElementById('ownerTaskHistory').hidden && document.querySelectorAll('#ownerTaskHistoryItems button').length===1");
      assert.equal(await c.evaluate("document.getElementById('ownerTaskHistory').scrollWidth <= document.getElementById('ownerTaskHistory').clientWidth + 1"),true);
      await c.send("Fetch.enable",{patterns:[{urlPattern:"*/owner-runs/history*",requestStage:"Request"}]});
      await waitFor(c,"!document.getElementById('ownerTaskHistoryApply').disabled");
      await click(c,"#ownerTaskHistoryApply");
      await waitFor(c,"document.getElementById('ownerRunToken').value==='' && document.getElementById('ownerTaskHistory').hidden");
      await Promise.all(revocations);
      assert.equal(await c.evaluate("document.getElementById('ownerTaskHistoryDetail').textContent"),"");
      assert.equal(posts.length,before);
    } finally {
      await browser.close();
    }
  },{caseOwnerToken:owner,enableSyntheticRuns:true,distanceFixtureText:fixture,qualifyDistanceFixture:true,shortenFirstDistance:true})
);


const digest=value=>createHash("sha256").update(value).digest("hex");
function sortedArchiveKeys(_key,value){
  return value&&typeof value==="object"&&!Array.isArray(value)
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value;
}
const catalog=JSON.parse(await readFile("docs/data/august-2024-archive-members.json","utf8"));
const canonicalCatalog=JSON.stringify(catalog,sortedArchiveKeys).replace(/[^\x00-\x7f]/g,
  character=>"\\u"+character.charCodeAt(0).toString(16).padStart(4,"0"));
const preparationVersion="sha256:"+digest(canonicalCatalog);
const preparationArtifact="sha256:"+"b".repeat(64);
const preparationSource={
  source_id:"zenodo_front_location",source_type:"front",display_name:"已核验的受控归档",
  credential_mode:"none",access_level:"public",authorization_scope:"public_open_data",license:"CC BY 4.0",date_coverage:{start:"2024-08-01",end:"2024-08-31"},
  spatial_coverage:{prototype_bbox:[120,27,128,34]},
  preparation:{
    archive_access:"verified",connector:"verified",processing:"verified",license:"verified",cost:"verified",
    source_version:preparationVersion,regions:{east_china:[120,27,128,34]},layers:["front"],purposes:["map"],
    targets:["day_artifact"],estimated_bytes_per_unit:20,
    reusable_units:[{date:"2024-08-05",region_id:"east_china",layer:"front",target:"day_artifact",
      source_version:preparationVersion,artifact_id:preparationArtifact}],
  },
};
const preparationRegistry=JSON.stringify({schema_version:"ocean-source-registry/v1",sources:[
  preparationSource,
  {...preparationSource,source_id:"blocked-front",display_name:"存在缺项的登记归档",
    credential_mode:"env_token",credential_env_var:"OCEAN_SOURCE_T02_BROWSER_CREDENTIAL",
    preparation:{...preparationSource.preparation,source_version:null,archive_access:"unknown",connector:"unsupported"}},
]});

const preparationManifest=JSON.stringify({
  schema_version:"ocean-artifact-manifest/v1",
  registry_id:"sha256:"+digest(preparationRegistry),
  preparation_evidence:{zenodo_front_location:{
    source_version:preparationVersion,
    archive_check:{schema:"ocean-august-archive-member-check/v1",month:"2024-08",catalog_sha256:preparationVersion.slice(7),
      sources:{front:{record:20356239,members:[
        {date:"2024-08-05",name:"front_location20240805.nc",status:"matched",sha256:"c".repeat(64)},
        {date:"2024-08-06",name:"front_location20240806.nc",status:"matched",sha256:"d".repeat(64)},
      ]}}},
    connector_sha256:"sha256:"+digest(await readFile("backend/scripts/fetch_zenodo_front_samples.py")),
    processor_sha256:"sha256:"+digest(JSON.stringify({
      "backend/app/frontend_payload.py":"sha256:"+digest(await readFile("backend/app/frontend_payload.py")),
      "backend/scripts/export_prototype_data.py":"sha256:"+digest(await readFile("backend/scripts/export_prototype_data.py")),
      "tools/audit_daily_sources.py":"sha256:"+digest(await readFile("tools/audit_daily_sources.py")),
      "tools/prepare_owner_front_day.py":"sha256:"+digest(await readFile("tools/prepare_owner_front_day.py")),
      "tools/verify_august_archive_members.py":"sha256:"+digest(await readFile("tools/verify_august_archive_members.py")),
    })),
    license_evidence_id:"sha256:"+"e".repeat(64),
    cost_evidence_id:"sha256:"+"f".repeat(64),
    reusable_units:preparationSource.preparation.reusable_units,
  }},
});

test("the owner previews only registered archive preparation and sees missing credentials and connectors", () =>
  withService(async base=>{
    const browser=await launchBrowser(edge),c=browser.cdp,posts=[];
    const preview=base+"/api/data/owner-preparation";
    c.onEvent(msg=>{
      if(msg.method==="Network.requestWillBeSent"&&msg.params.request.method==="POST")posts.push(msg.params.request);
    });
    try{
      assert.equal((await fetch(preview+"/registry")).status,401);
      await c.send("Network.enable");
      await openOwner(c,base);
      assert.equal(await c.evaluate("document.getElementById('ownerPreparationOpen').disabled"),true);
      await type(c,"ownerRunToken",owner);
      await click(c,"#ownerPreparationOpen");
      await waitFor(c,"document.querySelector('#ownerPreparationSource option[value=zenodo_front_location]')!==null");

      const choose=async sourceId=>{
        await c.evaluate("(sourceId=>{const source=document.getElementById('ownerPreparationSource');"+
          "source.value=sourceId;source.dispatchEvent(new Event('change',{bubbles:true}));"+
          "const form=document.getElementById('ownerPreparationForm');form.elements.region_id.value='east_china';"+
          "form.elements.purpose.value='map';form.elements.target.value='day_artifact';form.elements.start_date.value='2024-08-05';"+
          "form.elements.end_date.value='2024-08-06';form.querySelector('[name=layers][value=front]').click();})("+JSON.stringify(sourceId)+")");
      };
      await choose("zenodo_front_location");
      await click(c,"#ownerPreparationPreview");
      await waitFor(c,"!!document.getElementById('ownerPreparationResult').dataset.planId");
      const plan=await(await fetch(preview+"/plan",{method:"POST",headers,body:posts[0].postData})).json();
      assert.equal(posts[0].url,preview+"/plan");
      assert.equal(plan.execution_started,false);
      assert.equal(plan.can_prepare,true);
      assert.equal(await c.evaluate("document.getElementById('ownerPreparationResult').dataset.planId"),plan.plan_id);
      const prepared=await c.evaluate("document.getElementById('ownerPreparationResult').textContent");
      assert.match(prepared,/同版本复用.*待准备/s);
      assert.ok(prepared.includes(preparationArtifact));
      assert.match(prepared,/120、27、128、34/);
      await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
      assert.equal(await c.evaluate("document.getElementById('ownerPreparation').scrollWidth<=document.getElementById('ownerPreparation').clientWidth+1"),true);

      await choose("blocked-front");
      await click(c,"#ownerPreparationPreview");
      await waitFor(c,"document.getElementById('ownerPreparationResult').textContent.includes('缺少凭据')");
      const report=await c.evaluate("document.getElementById('ownerPreparationResult').textContent");
      assert.match(report,/连接器不可用/);
      assert.match(report,/归档访问未知/);
      assert.match(report,/源版本未知/);
      assert.doesNotMatch(report,/OCEAN_SOURCE/);
      await c.evaluate("document.getElementById('ownerPreparationForm').elements.start_date.value='2024-01-01'");
      await click(c,"#ownerPreparationPreview");
      assert.equal(await c.evaluate("document.getElementById('ownerPreparationForm').checkValidity()"),false);
      assert.equal(posts.length,2);
      assert.ok(posts.every(item=>item.url===preview+"/plan"));
    } finally{
      await browser.close();
    }
  },{caseOwnerToken:owner,ownerPreparationRegistryText:preparationRegistry,ownerPreparationManifestText:preparationManifest})
);


for(const corrupt of [false,true])test(corrupt
  ?"a changed original front day fails in Edge without publishing any result"
  :"the owner explicitly prepares an original front day in Edge without launching analysis", async t=>{
  const relative="front/2024/front_location20240805.nc";
  const original=await readFile("data/raw/"+relative).catch(()=>null);
  const rawDigest="37610c878649fc39eb43a7d1203ea48b14cab7d9c7fa21de2ecad81d0dc8e2c5";
  if(!original||digest(original)!==rawDigest){t.skip("Checked original front member is not installed");return;}
  const source={...preparationSource,display_name:"Zenodo 20356239 锋面",
    preparation:{...preparationSource.preparation,estimated_bytes_per_unit:original.length,reusable_units:[]}};
  const registry=JSON.stringify({schema_version:"ocean-source-registry/v1",sources:[source]});
  const evidence=JSON.parse(preparationManifest);
  evidence.registry_id="sha256:"+digest(registry);
  const proof=evidence.preparation_evidence.zenodo_front_location;
  proof.reusable_units=[];
  proof.archive_check.sources.front.members=proof.archive_check.sources.front.members.slice(0,1);
  proof.archive_check.sources.front.members[0].sha256=rawDigest;
  proof.license_evidence_id="sha256:"+digest(await readFile("docs/data/august-2024-source-registry.json"));
  proof.cost_evidence_id="sha256:"+digest(await readFile("docs/data/august-2024-archive-members.json"));
  let stagedOriginal;
  await withService(async (base,{releaseFrontPreparation})=>{
    const browser=await launchBrowser(edge),c=browser.cdp,posts=[],reads=[];
    const api=base+"/api/data/owner-preparation";
    let firstUnsent=null;
    c.onEvent(msg=>{
      if(msg.method==="Fetch.requestPaused"&&msg.params.request.method==="POST")firstUnsent=msg.params.requestId;
    });
    c.onEvent(msg=>{
      if(msg.method!=="Network.requestWillBeSent")return;
      if(msg.params.request.method==="POST")posts.push(msg.params.request);
      if(msg.params.request.method==="GET"&&msg.params.request.url.startsWith(api+"/intents/"))reads.push(msg.params.request.url);
    });
    try{
      await c.send("Network.enable");
      await openOwner(c,base);
      await type(c,"ownerRunToken",owner);
      let view=await c.evaluate("JSON.stringify(state.view)");
      await click(c,"#ownerPreparationOpen");
      await waitFor(c,"!!document.querySelector('#ownerPreparationSource option[value=zenodo_front_location]')");
      await c.evaluate(`(()=>{
        const f=document.getElementById("ownerPreparationForm"),source=f.elements.source_id;
        source.value="zenodo_front_location";
        source.dispatchEvent(new Event("change",{bubbles:true}));
        f.elements.region_id.value="east_china";
        f.elements.purpose.value="map";
        f.elements.target.value="day_artifact";
        f.elements.start_date.value=f.elements.end_date.value="2024-08-05";
        f.querySelector("[name=layers][value=front]").click();
      })()`);
      await click(c,"#ownerPreparationPreview");
      await waitFor(c,"!document.getElementById('ownerPreparationExecute')?.disabled && !!document.getElementById('ownerPreparationExecute')");
      assert.deepEqual(posts.map(p=>p.url),[api+"/plan"]);
      if(!corrupt)await c.send("Fetch.enable",{patterns:[{urlPattern:api+"/tasks",requestStage:"Request"}]});
      await c.evaluate("document.getElementById('ownerPreparationExecute').click();document.getElementById('ownerPreparationExecute').click()");
      if(!corrupt){
        for(let retries=0;!firstUnsent&&retries<80;retries++)await delay(25);
        assert.ok(firstUnsent,"The browser pauses its first POST before it reaches the server");
        await c.evaluate("(()=>{const end=document.getElementById('ownerPreparationForm').elements.end_date;"+
          "end.value='2024-08-06';end.dispatchEvent(new Event('change',{bubbles:true}));})()");
        await waitFor(c,"!document.getElementById('ownerPreparationReplayTask').hidden");
        await c.send("Fetch.failRequest",{requestId:firstUnsent,errorReason:"Aborted"}).catch(()=>{});
        await c.send("Fetch.disable");
        const absent=await fetch(api+"/intents/"+JSON.parse(posts[1].postData).intent_id,{headers});
        assert.equal(absent.status,404);
        await click(c,"#ownerRunLock");
        await waitFor(c,"document.getElementById('ownerPreparation').hidden && document.getElementById('ownerRunToken').value===''");
        await type(c,"ownerRunToken",owner);
        await click(c,"#ownerPreparationOpen");
        await waitFor(c,"!document.getElementById('ownerPreparationReplayTask').hidden && !document.getElementById('ownerPreparationReplayTask').disabled");
        await click(c,"#ownerPreparationReplayTask");
      }
      await waitFor(c,"document.getElementById('ownerPreparationTaskDetails').dataset.state==='processing'");
      const body=JSON.parse(posts.at(-1).postData);
      if(!corrupt)assert.deepEqual(body,JSON.parse(posts[1].postData));
      const processing=await(await fetch(api+"/intents/"+body.intent_id,{headers})).json();
      assert.equal(processing.state,"processing");
      const artifactPath=api+"/tasks/"+processing.id+"/artifact";
      assert.equal((await fetch(artifactPath,{headers})).status,404);
      if(!corrupt){
        const catalog=await c.evaluate("fetch('/api/catalog').then(response=>response.ok)");
        assert.equal(catalog,true);
        await c.evaluate("document.getElementById('zoomIn').click()");
        await waitFor(c,"JSON.stringify(state.view)!=="+JSON.stringify(view));
        view=await c.evaluate("JSON.stringify(state.view)");
        await click(c,"#ownerRuns summary");
        await waitFor(c,"!document.getElementById('ownerRuns').open");
        const before=reads.length;
        await delay(650);
        assert.equal(reads.length,before);
        await click(c,"#ownerRuns summary");
        await waitFor(c,"document.getElementById('ownerRuns').open");
      }
      await click(c,"#ownerPreparationClose");
      await waitFor(c,"document.getElementById('ownerPreparation').hidden");
      await writeFile(releaseFrontPreparation,"release","utf8");
      await click(c,"#ownerPreparationOpen");
      const terminal=corrupt?"failed":"ready";
      await waitFor(c,"document.getElementById('ownerPreparationTaskDetails').dataset.state==="+JSON.stringify(terminal));
      const details=await c.evaluate("document.getElementById('ownerPreparationTaskDetails').textContent");
      if(corrupt){
        assert.match(details,/已受理.*处理中.*准备失败/s);
        assert.doesNotMatch(details,/已就绪|产物 sha256/);
      }else{
        assert.match(details,/已受理.*处理中.*校验中.*登记中.*已就绪/s);
        assert.match(details,/2024-08-05.*本人可见.*east_china.*120、27、128、34.*0.05°.*产物 sha256:.*19102.*3298.*411.*观测时刻仍待核.*研究用途资格待独立核验/s);
      }
      assert.equal(await c.evaluate("JSON.stringify(state.view)"),view);
      assert.deepEqual(posts.map(p=>p.url),corrupt?[api+"/plan",api+"/tasks"]:[api+"/plan",api+"/tasks",api+"/tasks"]);
      const ready=await(await fetch(api+"/intents/"+body.intent_id,{headers})).json();
      assert.equal(ready.state,terminal);
      assert.equal(ready.id,processing.id);
      assert.equal((await fetch(artifactPath)).status,401);
      if(corrupt){
        assert.equal((await fetch(artifactPath,{headers})).status,404);
        assert.equal(ready.artifact,null);
        assert.equal(ready.error,"processing_failed");
      }else{
        const artifact=await(await fetch(artifactPath,{headers})).json();
        assert.equal(artifact.artifact_id,ready.artifact.artifact_id);
        assert.equal(artifact.raw_sha256,rawDigest);
        assert.equal(artifact.research_ready,false);
      }
      const replayed=await(await fetch(api+"/tasks",{method:"POST",headers,body:JSON.stringify(body)})).json();
      assert.deepEqual(replayed,ready);
      await click(c,"#ownerPreparationClose");
      await click(c,"#ownerTaskHistoryOpen");
      await waitFor(c,"document.querySelectorAll('#ownerTaskHistoryItems button').length===1");
      await c.evaluate("document.getElementById('ownerTaskHistoryPurpose').value='archive_preparation'");
      await click(c,"#ownerTaskHistoryApply");
      await waitFor(c,"document.querySelector('#ownerTaskHistoryItems button')?.textContent.includes('归档准备') && !document.getElementById('ownerTaskHistoryApply').disabled");
      await click(c,"#ownerTaskHistoryItems button");
      const readHistory="document.getElementById('ownerTaskHistoryDetail').textContent";
      await waitFor(c,readHistory+".includes('原资料 · 存在，版本未复核')");
      assert.match(await c.evaluate(readHistory),corrupt?/处理或校验失败.*聚合结果快照 · 无结果记录/s:
        /有效 19102 格.*聚合结果快照 · 已保存.*地图产物 · 已保存.*按原版本复算仍待核验/s);
      if(!corrupt){
        await unlink(stagedOriginal);
        await click(c,"#ownerTaskHistoryItems button");
        await waitFor(c,readHistory+".includes('原资料 · 缺失')");
        assert.match(await c.evaluate(readHistory),/有效 19102 格.*地图产物 · 已保存/s);
      }
      assert.equal(await c.evaluate("JSON.stringify(state.view)"),view);
      assert.deepEqual(posts.map(p=>p.url),corrupt?[api+"/plan",api+"/tasks"]:[api+"/plan",api+"/tasks",api+"/tasks"]);
    }finally{await browser.close();}
  },{
    caseOwnerToken:owner,ownerPreparationRegistryText:registry,ownerPreparationManifestText:JSON.stringify(evidence),
    enableOwnerPreparationExecution:true,
    holdFrontPreparation:true,
    prepareRaw:async raw=>{
      await mkdir(join(raw,"front","2024"),{recursive:true});
      const data=Buffer.from(original);
      if(corrupt)data[data.length-1]^=1;
      stagedOriginal=join(raw,relative);
      await writeFile(stagedOriginal,data);
    },
  });
});
