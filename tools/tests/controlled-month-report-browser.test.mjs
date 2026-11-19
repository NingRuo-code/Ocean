import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {unlink} from "node:fs/promises";
import {launchBrowser, waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";

const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const owner = "controlled-report-fixture";
const api = "/api/query/monthly-analysis";
const auth = {Authorization: `Bearer ${owner}`};

function layer(kind, bounds, hours) {
  return {id:kind === "front" ? "front-original" : "effort-original",kind,role:"analysis_source",unit:kind === "front" ? "classification_code" : "fishing_hours",
    time_verified:true,bounds_verified:true,support_verified:true,duration_days:1,
    cells:[{bounds,hours,support:"valid"}]};
}

const front = layer("front",[-0.4,-0.4,0.4,0.4],null);
const input = JSON.stringify({
  schema:"ocean-month-distance-input/v1",
  conditions:{schema:"ocean-support-request/v1",purpose:"A_month",month:"2024-08",layer_use:"front_effort",
    method_version:"wgs84-laea-uniform/v1",quality_rule:"complete-common-support/v1",allocation:"overlap_uniform",
    geometries:[{id:"circle",type:"circle",center:[0,0],radius_km:10}]},
  distance_edges_km:[5,20],front_position_error_km:0.01,
  regional_cells:{schema:"ocean-regional-cells/v1",evidence_kind:"synthetic",days:[42,0].map((hours,i) => ({
    date:`2024-08-0${i+1}`,layers:[front,layer("activity",[0.077,-0.001,0.079,0.001],hours)]}))},
  front_days:[{date:"2024-08-01",source_id:"front-original",lines:[[[0.1,-0.04],[0.1,0.04]]]},
    {date:"2024-08-02",source_id:"front-original",lines:[]}]
});

test("workbench previews the owner's frozen distance report through the real service", () => withService(async (base,{distancePath}) => {
  const seeded = await fetch(base+api,{method:"POST",headers:{...auth,"Content-Type":"application/json"},
    body:JSON.stringify({purpose:"monthly_distance_reference",longitude:0,latitude:0,radius_km:10,month:"2024-08",
      input_version:"sha256:"+createHash("sha256").update(input).digest("hex"),
      method_version:"wgs84-distance-bands/v1",parameter_version:"half-open-bands/v1"})});
  assert.equal(seeded.status,200);
  const run = await seeded.json();
  assert.equal(run.state,"completed",JSON.stringify(run));
  await unlink(distancePath);
  const browser = await launchBrowser(edge), c = browser.cdp, methods=[];
  c.onEvent(msg => {if(msg.method === "Network.requestWillBeSent" && msg.params.request.url.startsWith(base+api)) methods.push(msg.params.request.method);});
  try {
    await c.send("Page.enable"); await c.send("Network.enable");
    await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await c.evaluate("document.getElementById('workbenchToggle').click();document.getElementById('monthlyOpen').click()");
    assert.equal(await fetch(base+api+"/reports").then(response => response.status),401);
    const reportUrl=base+api+`/${run.id}/report?result_id=`;
    assert.equal(await fetch(reportUrl+encodeURIComponent(run.result.result_id)).then(response => response.status),401);
    assert.equal(await fetch(reportUrl+"sha256:"+"0".repeat(64),{headers:auth}).then(response => response.status),409);
    await c.evaluate("document.querySelector('#distanceReportControls > summary').click()");
    await c.evaluate(`(()=>{const token=document.getElementById('distanceReportToken');token.value=${JSON.stringify(owner)};token.dispatchEvent(new Event('input'));document.getElementById('distanceReportList').click();})()`);
    await waitFor(c,`document.getElementById('distanceReportSelect')?.value===${JSON.stringify(run.id)}`);
    await c.evaluate("document.getElementById('distanceReportOpen').click()");
    await waitFor(c,"document.getElementById('distanceReportFrame')?.contentDocument?.querySelector('main')");
    const content = await c.evaluate("document.getElementById('distanceReportFrame').contentDocument.querySelector('main').textContent");
    assert.match(content,/合成距离参照.*正式研究资格未通过/s);
    assert.match(content,/2024-08.*半径 10 km/s);
    assert.match(content,/2 \/ 31\s*42(?:\.0+)?\s*0\.098/s);
    assert.match(content,/2024-08-02\s*\S+\s*0(?:\.0+)?\s*0\.049/s);
    assert.match(content,/2024-08-03\s*\S+\s*未知/s);
    assert.ok(content.includes(run.result.result_id));
    assert.match(content,/wgs84-distance-bands\/v1/);
    assert.equal(await c.evaluate("document.getElementById('distanceReportFrame').contentDocument.querySelectorAll('svg').length"),1);
    const report = await fetch(reportUrl+encodeURIComponent(run.result.result_id),{headers:auth}).then(response => response.json());
    assert.equal(report.content_sha256,"sha256:"+createHash("sha256").update(report.html).digest("hex"));
    assert.equal(await c.evaluate("document.getElementById('controlledMonthReport').dataset.reportId"),report.report_id);
    await c.evaluate("window.dispatchEvent(new CustomEvent('ocean-month-draft',{detail:{month:'2024-09',longitude:5,latitude:2,radius_km:20}}))");
    assert.equal(await c.evaluate("document.getElementById('controlledMonthReport').dataset.reportId"),report.report_id);
    assert.match(await c.evaluate("document.getElementById('evidenceIdentity').textContent"),/2024-08.*10 km/);
    await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:890,deviceScaleFactor:1,mobile:true});
    assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
    await c.evaluate("document.getElementById('distanceReportFrame').contentDocument.querySelector('summary').focus()");
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});
    await waitFor(c,"document.getElementById('evidencePanel').hidden");
    assert.equal(await c.evaluate("document.activeElement.id"),"distanceReportOpen");
    await c.evaluate("document.getElementById('distanceReportOpen').click()");
    await waitFor(c,"document.getElementById('distanceReportFrame')?.contentDocument?.querySelector('main')");
    await c.evaluate("document.getElementById('workbenchClose').click()");
    const mapBefore = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:26,y:350,deltaX:0,deltaY:-220});
    await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(mapBefore)}`);
    assert.equal(await c.evaluate("document.getElementById('controlledMonthReport').dataset.reportId"),report.report_id);
    await c.evaluate("document.getElementById('distanceReportToken').value='';document.getElementById('distanceReportToken').dispatchEvent(new Event('input'))");
    assert.equal(await c.evaluate("document.getElementById('distanceReportFrame')"),null);
    assert.ok(methods.length>=2 && methods.every(method => method === "GET"));
  } finally {await browser.close();}
},{caseOwnerToken:owner,distanceFixtureText:input}));
