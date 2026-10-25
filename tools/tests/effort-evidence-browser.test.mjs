import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, waitFor, sleep } from "../lib/browser-driver.mjs";

const page = pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href;
const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function click(c, selector) {
  const p = await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", ...p, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...p, button: "left", clickCount: 1 });
}
async function open(c, fishing) {
  await c.send("Page.enable");
  if (fishing) await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.OF_API_BASE='http://controlled.invalid/api';window.requests=[];
    window.fetch=url=>{url=String(url);window.requests.push(url);const reply=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status}));
      if(url.endsWith('/health'))return reply({status:'ok'});
      if(url.includes('/frontend/day/'))return reply({front:structuredClone(window.OF_DATA_DAYS[url.split('/').pop()])});
      if(url.includes('/fishing/'))return reply(${JSON.stringify(fishing)});
      return reply({meta:{status:'empty'},layers:{}});};` });
  await c.send("Page.navigate", { url: page });
  await waitFor(c, "document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
}

test("activity shortcut sums every returned in-range cell, distinguishes partial coverage and keeps the map usable", async () => {
  const b = await launchBrowser(edge), c = b.cdp;
  try {
    // Independent reference: 701 * 1 + 3 + 30 = 734 h; the 999 h cell is >20 km away.
    const cells = Array.from({ length: 701 }, (_, i) => ({ lon: 124.5 + i * .000001, lat: 30.201, hours: 1 }));
    cells.push({ lon: 124.5, lat: 30.2001, hours: 3 }, { lon: 124.51, lat: 30.2, hours: 30 }, { lon: 124.5, lat: 31, hours: 999 });
    await open(c, { date: "2024-08-05", cells, cell_count: 704, spatial_resolution_deg: .1, source: { name: "合成合同样例", license: "synthetic", unit: "fishing_hours" } });
    await click(c, "#workbenchToggle"); await click(c, "#fishingActivity");
    await waitFor(c, "document.getElementById('heroVerdict').textContent==='734 h'");
    assert.match(await c.evaluate("document.getElementById('heroLine').textContent"), /部分|覆盖未知/);
    assert.match(await c.evaluate("document.getElementById('heroWhyBody').textContent"), /700|分位/);
    assert.match(await c.evaluate("document.getElementById('heroWhyBody').textContent"), /0.1°|合成合同样例/);
    assert.equal(await c.evaluate("document.querySelectorAll('#nowMetrics .m').length"), 3);
    const before = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await click(c, "#zoomIn");
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"), before);
    assert.equal(await c.evaluate("window.requests.some(u=>/analysis|prepare|model|tasks/.test(u))"), false);
    await click(c, "#nearbyFront");
    assert.match(await c.evaluate("document.getElementById('heroVerdict').textContent"), /km/);
  } finally { await b.close(); }
});

for (const [name, cells, expected] of [
  ["empty", [], "—"],
  ["zero records", [{ lon: 124.5, lat: 30.2, hours: 0 }], "0 h"],
  ["invalid and duplicate", [null, { lon: 124.5, lat: 30.2, hours: null }, { lon: 124.5, lat: 30.201, hours: -2 }, { lon: 124.5, lat: 30.202, hours: 5 }, { lon: 124.5, lat: 30.202, hours: 5 }, { lon: 124.5, lat: 30.203, hours: 30 }], "30 h"],
  ["circle boundary", [{ lon: 124.5, lat: 30.2, hours: 30 }, { lon: 124.5, lat: 30.3798640, hours: 5 }, { lon: 124.5, lat: 30.3798642, hours: 11 }], "35 h"],
]) test(`activity summary handles ${name} without implying full coverage`, async () => {
  const b = await launchBrowser(edge), c = b.cdp;
  try {
    await open(c, { date: "2024-08-05", cells, cell_count: cells.length, spatial_resolution_deg: .1 });
    await click(c, "#workbenchToggle"); await click(c, "#fishingActivity");
    await waitFor(c, `document.getElementById('heroVerdict').textContent===${JSON.stringify(expected)}`);
    assert.match(await c.evaluate("document.getElementById('heroLine').textContent"), /覆盖未知|不能视为零/);
    if (name === "zero records") assert.match(await c.evaluate("document.getElementById('heroLine').textContent"), /返回有效记录均为零/);
    if (name === "invalid and duplicate") assert.match(await c.evaluate("document.getElementById('heroWhyBody').textContent"), /排除 5 条/);
  } finally { await b.close(); }
});

test("offline activity is unavailable and never replaced by demonstration hotspots", async () => {
  const b = await launchBrowser(edge), c = b.cdp;
  try {
    await open(c); await click(c, "#workbenchToggle"); await click(c, "#fishingActivity");
    assert.equal(await c.evaluate("document.getElementById('heroVerdict').textContent"), "—");
    assert.match(await c.evaluate("document.getElementById('heroLine').textContent"), /离线未接入/);
    assert.equal(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=ground]').length"), 0);
  } finally { await b.close(); }
});

test("history opens by month, reads archive samples explicitly and freezes bottom evidence until requested again", async () => {
  const b = await launchBrowser(edge), c = b.cdp;
  try {
    await open(c); await click(c, "#tabs [data-pane=clim]");
    assert.match(await c.evaluate("document.getElementById('historySummary').textContent"), /整月.*未接入|尚无.*整月/);
    assert.equal(await c.evaluate("document.querySelectorAll('#historyChart button').length"), 0);
    await click(c, "#historyRead");
    assert.equal(await c.evaluate("document.querySelectorAll('#historyChart button').length"), 31);
    assert.match(await c.evaluate("document.getElementById('historySummary').textContent"), /样例/);
    await click(c, "#historyDetails");
    assert.equal(await c.evaluate("document.getElementById('evidencePanel').hidden"), false);
    const frozen = await c.evaluate("document.getElementById('historyEvidence').textContent");
    const identity = await c.evaluate("document.getElementById('evidenceIdentity').textContent");
    assert.match(identity, /2024-08-05.*124.50.*30.20.*20 km/);
    const before = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"); await click(c, "#zoomIn");
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"), before);
    await click(c, "#headerFilter"); await click(c, "#dateNext"); await click(c, "#filterClose");
    await click(c, "#historyDetails");
    assert.equal(await c.evaluate("document.getElementById('historyEvidence').textContent"), frozen);
    assert.equal(await c.evaluate("document.getElementById('evidenceIdentity').textContent"), identity);
    assert.match(await c.evaluate("document.getElementById('evidenceStale').textContent"), /待更新/);
    await click(c, "#evidenceClose"); await click(c, "#historyRead");
    await click(c, "#historyChart [data-date='2024-08-07']");
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-07");
    await click(c, "#historyReturn");
    assert.match(await c.evaluate("document.getElementById('historyMonth').textContent"), /2024-08/);
  } finally { await b.close(); }
});

test("experimental forecast keeps baseline and targets explicit, freezes on filter change and never navigates to an unobserved day", async () => {
  const b = await launchBrowser(edge), c = b.cdp;
  try {
    await open(c); await click(c, "#tabs [data-pane=future]");
    assert.equal(await c.evaluate("document.getElementById('pane-future').contains(document.getElementById('futureBars'))"), false);
    await click(c, "#forecastRead");
    assert.match(await c.evaluate("document.getElementById('forecastSummary').textContent"), /基准 2024-08-05.*2024-08-06.*2024-08-08.*未独立验证/);
    await click(c, "#forecastDetails");
    const frozen = await c.evaluate("document.getElementById('forecastEvidence').textContent");
    await click(c, "#headerFilter"); await click(c, "#dateNext"); await click(c, "#filterClose"); await click(c, "#forecastDetails");
    assert.equal(await c.evaluate("document.getElementById('forecastEvidence').textContent"), frozen);
    assert.match(await c.evaluate("document.getElementById('evidenceStale').textContent"), /待更新/);
    await click(c, "#futureDays [data-date='2024-08-07']");
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-06", "a stale forecast cannot navigate using a different analysis context");
    await click(c, "#evidenceClose"); await click(c, "#headerFilter");
    await c.evaluate("document.getElementById('timeDate').value='2024-08-31';document.getElementById('timeDate').dispatchEvent(new Event('change',{bubbles:true}))");
    await click(c, "#filterClose"); await click(c, "#forecastRead"); await click(c, "#forecastDetails");
    assert.match(await c.evaluate("document.getElementById('forecastSummary').textContent"), /2024-09-01.*2024-09-03/);
    assert.equal(await c.evaluate("document.querySelectorAll('#futureDays .clickable').length"), 0);
    await click(c, "#futureDays [data-date='2024-09-01']");
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-31");
  } finally { await b.close(); }
});

test("sparse archive history exposes missing calendar days without presenting a qualified monthly result", async () => {
  const b = await launchBrowser(edge), c = b.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.OF_DATA_DAYS=new Proxy({}, {set(target,key,value){if(key==='2024-08-05')target[key]=value;return true;}});" });
    await open(c); await click(c, "#tabs [data-pane=clim]"); await click(c, "#historyRead");
    assert.match(await c.evaluate("document.getElementById('historySummary').textContent"), /1\/31 日可读.*整月研究汇总未接入/);
    assert.equal(await c.evaluate("document.querySelectorAll('#historyChart button:disabled').length"), 30);
  } finally { await b.close(); }
});
