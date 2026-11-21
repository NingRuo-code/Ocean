import test from "node:test";
import assert from "node:assert/strict";
import {access, readFile, unlink, writeFile} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
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
      await prepareDistanceInBrowser(c,base);
      await click(c,"#ownerRunSubmit");
      await waitForServiceFile(distanceResultReady);
      await click(c,"#ownerRunCancel");
      await waitFor(c,"document.getElementById('ownerRunCancelStatus').textContent.includes('无法撤回')");
      await writeFile(releaseDistanceResult,"publish");
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='completed'");
      const id=await c.evaluate("document.getElementById('ownerRuns').dataset.runId");
      assert.match(await c.evaluate("document.getElementById('ownerRunCancelStatus').textContent"),/已经完成/);
      const published=await(await fetch(base+route+"/"+id+"?purpose="+mode,{headers})).json();
      assert.equal(published.state,"completed");
      assert.equal(published.result.days.length,31);
      assert.equal(Object.hasOwn(published,"cancelled"),false);
    } finally {
      await writeFile(releaseDistanceResult,"publish");
      await browser.close();
    }
  },{caseOwnerToken:owner,distanceFixtureText:fixture,qualifyDistanceFixture:true,holdDistancePublication:true})
);
