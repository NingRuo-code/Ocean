import test from "node:test";
import assert from "node:assert/strict";
import {access, unlink, writeFile} from "node:fs/promises";
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
      await waitFor(c,"document.getElementById('ownerRuns').dataset.state==='uncertain'");
      assert.equal(submissions.length,2);
      const rejected=await fetch(base+route+"/intents/"+submissions[1].intent_id+query,{headers});
      assert.equal(rejected.status,404);
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
      assert.deepEqual(record.error,{code:"execution_evidence_changed"});
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
