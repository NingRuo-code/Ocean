import test from "node:test";
import assert from "node:assert/strict";
import {unlink} from "node:fs/promises";
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
      await c.send("Page.enable");
      await c.send("Network.enable");
      await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
      await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
      await click(c,"#workbenchToggle");
      await click(c,"#monthlyDraftOpen");
      await click(c,root+" summary");
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
