import test from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {launchBrowser, waitFor} from "../lib/browser-driver.mjs";
import {withService} from "../lib/monthly-test-service.mjs";
import {mkdir, writeFile} from "node:fs/promises";

const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function click(c, selector) {
  const point = await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent", {type:"mousePressed", button:"left", clickCount:1, ...point});
  await c.send("Input.dispatchMouseEvent", {type:"mouseReleased", button:"left", clickCount:1, ...point});
}

test("selected public month opens an original-condition report through the actual service without analysis", () => withService(async base => {
  const browser = await launchBrowser(edge), c = browser.cdp, requests = [];
  c.onEvent(m => {if(m.method === "Network.requestWillBeSent") requests.push(m.params.request);});
  try {
    await c.send("Network.enable"); await c.send("Page.enable");
    await c.send("Page.navigate", {url:base+"/prototype-fishing.html"});
    await waitFor(c, "document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c, "#workbenchToggle"); await click(c, "#monthlyOpen");
    await waitFor(c, "document.getElementById('monthlyResult').dataset.state==='ready'");
    await click(c, "#monthlyReportOpen");
    await waitFor(c, "document.getElementById('monthReport')?.dataset.state==='ready'");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"), false);
    assert.match(await c.evaluate("document.getElementById('monthReportConditions').textContent"), /2024-02.*20 km/);
    assert.match(await c.evaluate("document.getElementById('monthReportMetrics').textContent"), /40.*7.*2.*29/s);
    assert.match(await c.evaluate("document.getElementById('monthReport').textContent"), /关系.*未估计.*真实研究资格未通过/s);
    assert.equal(await c.evaluate("document.querySelectorAll('#monthReportChart [data-state=unknown]').length"), 27);
    assert.equal(await c.evaluate("document.querySelectorAll('#monthReportChart [data-state=zero]').length"), 1);
    const identity = await c.evaluate("document.getElementById('monthReport').dataset.reportId");
    await c.evaluate("document.getElementById('monthlyDraftOpen').click()");
    assert.equal(await c.evaluate("document.getElementById('monthReport').dataset.reportId"), identity);
    assert.equal(requests.some(r => r.method === "POST"), false);
    assert.ok(requests.some(r => r.url.includes("/report?projection_id=")));
  } finally {await browser.close();}
}));

test("a delayed report cannot replace a subsequently selected zero-result report", () => withService(async base => {
  const browser = await launchBrowser(edge), c = browser.cdp, pending = [];
  let held = null;
  c.onEvent(m => {if(m.method === "Fetch.requestPaused") {
    if(!held) held = m.params.requestId;
    else pending.push(c.send("Fetch.continueRequest",{requestId:m.params.requestId}));
  }});
  try {
    await c.send("Page.enable"); await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/report?*",requestStage:"Request"}]});
    await click(c,"#monthlyReportOpen");
    await waitFor(c,"document.getElementById('monthReport').dataset.state==='reading'");
    await c.evaluate("document.getElementById('monthlySavedResult').selectedIndex=1;document.getElementById('monthlySavedResult').dispatchEvent(new Event('change'))");
    await waitFor(c,"document.getElementById('monthlyHours').textContent==='0'");
    await click(c,"#monthlyReportOpen");
    await waitFor(c,"document.getElementById('monthReport').dataset.state==='ready'");
    assert.match(await c.evaluate("document.getElementById('monthReportMetrics').textContent"),/H：0 h/);
    if(held) await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});
    await Promise.allSettled(pending);await c.send("Fetch.disable");
    assert.match(await c.evaluate("document.getElementById('monthReportMetrics').textContent"),/H：0 h/);
  } finally {await browser.close();}
}));

test("offline report preserves zero and unknown days, keyboard focus and a usable small-screen map", async () => {
  const browser = await launchBrowser(edge), c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate",{url:pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle"); await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
    await click(c,"#monthlyReportOpen");
    await waitFor(c,"document.getElementById('monthReport').dataset.state==='ready'");
    await mkdir("docs/reports/screenshots",{recursive:true});
    for(const width of [1440,390]) {
      await c.send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width===390});
      if(width===390) await click(c,"#workbenchClose");
      assert.equal(await c.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
      const screenshot = await c.send("Page.captureScreenshot",{format:"png"});
      await writeFile(`docs/reports/screenshots/ocean-known-month-report-${width}.png`,Buffer.from(screenshot.data,"base64"));
    }
    const before = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.send("Input.dispatchMouseEvent",{type:"mouseWheel",x:25,y:350,deltaX:0,deltaY:-220});
    await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(before)}`);
    await c.evaluate("document.getElementById('evidenceClose').focus()");
    await c.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
    assert.equal(await c.evaluate("document.activeElement.id"),"monthlyReportOpen");
    await c.evaluate("document.getElementById('monthlySavedResult').selectedIndex=1;document.getElementById('monthlySavedResult').dispatchEvent(new Event('change'))");
    await waitFor(c,"document.getElementById('monthlyHours').textContent==='0'");
    await click(c,"#monthlyReportOpen");
    await waitFor(c,"document.getElementById('monthReport').dataset.state==='ready'");
    assert.match(await c.evaluate("document.getElementById('monthReportMetrics').textContent"),/H：0 h/);
    assert.equal(await c.evaluate("document.querySelectorAll('#monthReportChart [data-state=unknown]').length"),28);
  } finally {await browser.close();}
});

test("leaving the monthly view cancels a pending report instead of reopening its panel later", () => withService(async base => {
  const browser = await launchBrowser(edge), c = browser.cdp;
  let held = null;
  c.onEvent(m => {if(m.method === "Fetch.requestPaused") held = m.params.requestId;});
  try {
    await c.send("Page.enable");await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/report?*",requestStage:"Request"}]});
    await click(c,"#monthlyReportOpen");
    await waitFor(c,"document.getElementById('monthReport').dataset.state==='reading'");
    await click(c,"#observationView");
    assert.equal(await c.evaluate("document.getElementById('monthReport').dataset.state"),"empty");
    if(held) await c.send("Fetch.continueRequest",{requestId:held}).catch(()=>{});
    await c.send("Fetch.disable");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
    assert.equal(await c.evaluate("document.getElementById('monthReport').textContent"),"");
  } finally {await browser.close();}
}));

test("denied report reads show no report and never silently use the offline copy", () => withService(async base => {
  const browser = await launchBrowser(edge), c = browser.cdp, pending = [];
  c.onEvent(m => {if(m.method==="Fetch.requestPaused") pending.push(c.send("Fetch.fulfillRequest",{requestId:m.params.requestId,responseCode:403,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from('{"detail":"restricted"}').toString("base64")}));});
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate",{url:base+"/prototype-fishing.html"});
    await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    await click(c,"#workbenchToggle");await click(c,"#monthlyOpen");
    await waitFor(c,"document.getElementById('monthlyResult').dataset.state==='ready'");
    await c.send("Fetch.enable",{patterns:[{urlPattern:"*/report?*",requestStage:"Request"}]});
    await click(c,"#monthlyReportOpen");
    await waitFor(c,"document.getElementById('monthReport').dataset.state==='error'");
    assert.equal(await c.evaluate("document.getElementById('monthReport').textContent"),"");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"),true);
    assert.match(await c.evaluate("document.getElementById('monthReportStatus').textContent"),/不允许/);
    await Promise.allSettled(pending); await c.send("Fetch.disable");
  } finally {await browser.close();}
}));
