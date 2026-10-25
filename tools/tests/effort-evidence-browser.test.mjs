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
