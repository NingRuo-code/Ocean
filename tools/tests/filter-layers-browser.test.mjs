import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, sleep } from "../lib/browser-driver.mjs";

const page = pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href;
async function click(c, selector) {
  const point = await c.evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}
async function key(c, key, code = key, modifiers = 0) {
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers });
}
async function fill(c, selector, value) {
  await click(c, selector);
  await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).select()`);
  await c.send("Input.insertText", { text: value });
}
async function mapPoint(c) {
  return c.evaluate("(()=>{const r=document.getElementById('map').getBoundingClientRect();return {x:r.left+r.width*.65,y:r.top+110};})()");
}
async function pointer(c, point) {
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
}

test("unified filters preserve drafts, apply only valid coordinates and distinguish map click from drag or zoom", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate", { url: page });
    await sleep(650);
    await click(c, "#headerFilter");
    assert.equal(await c.evaluate("document.querySelectorAll('#topbar .ctx').length"), 0);
    await fill(c, "#locInput", "125,31");
    await click(c, "#rangeSeg [data-range='30']");
    assert.equal(await c.evaluate("document.getElementById('mapSvg').textContent.includes('124.50°E, 30.20°N')"), true);
    await key(c, "Escape");
    assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"), true);
    assert.equal(await c.evaluate("document.activeElement.id"), "headerFilter");
    await click(c, "#headerFilter");
    assert.equal(await c.evaluate("document.getElementById('locInput').value"), "125,31");
    await click(c, "#locateBtn");
    assert.equal(await c.evaluate("document.getElementById('mapSvg').textContent.includes('125.00°E, 31.00°N')"), true);
    await fill(c, "#locInput", "200,95");
    await click(c, "#locateBtn");
    assert.equal(await c.evaluate("document.getElementById('mapSvg').textContent.includes('125.00°E, 31.00°N')"), true, "out-of-domain input must not change the applied point");
    const point = await mapPoint(c);
    await c.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + 60, y: point.y + 12, button: "left", buttons: 1 });
    await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + 60, y: point.y + 12, button: "left", clickCount: 1 });
    await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", ...point, deltaX: 0, deltaY: -80 });
    await click(c, "#zoomIn");
    assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"), false);
    await pointer(c, point);
    assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"), true, "an actual map click closes the floating filter");
    assert.equal(await c.evaluate("document.getElementById('mapProbe').hidden"), false, "the same click still probes the map");
    await click(c, "#headerFilter");
    await click(c, "#pickOriginBtn");
    await pointer(c, point);
    assert.equal(await c.evaluate("document.getElementById('map').classList.contains('pick-origin')"), false);
    assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"), true);
  } finally { await browser.close(); }
});

test("layer controls are exclusive with filters, keyboard accessible and preserve manual choices across ordinary refresh", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable"); await c.send("Page.navigate", { url: page }); await sleep(650);
    await click(c, "#workbenchToggle"); await click(c, "#filterToggle"); await click(c, "#wbLayers");
    assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"), true);
    assert.equal(await c.evaluate("document.getElementById('layerDrawer').getAttribute('aria-hidden')"), "false");
    assert.equal(await c.evaluate("(()=>{const p=document.getElementById('layerDrawer').getBoundingClientRect(),w=document.getElementById('taskWorkbench').getBoundingClientRect();return p.left>=w.right;})()"), true, "floating controls leave both workbench modules accessible");
    await click(c, "#layerDrawer [data-layer='sst']");
    assert.equal(await c.evaluate("document.querySelector('#layerDrawer [data-layer=sst]').getAttribute('aria-pressed')"), "false");
    assert.equal(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=sst]').length"), 0);
    await click(c, "#layerClose"); await click(c, "#filterToggle"); await click(c, "#dateNext");
    await click(c, "#wbLayers");
    assert.equal(await c.evaluate("document.querySelector('#layerDrawer [data-layer=sst]').getAttribute('aria-pressed')"), "false");
    await click(c, "#layerDrawer [data-layer='sst']"); await key(c, " ", "Space");
    assert.equal(await c.evaluate("document.querySelector('#layerDrawer [data-layer=sst]').getAttribute('aria-pressed')"), "false");
    await key(c, "Escape");
    assert.equal(await c.evaluate("document.activeElement.id"), "wbLayers");
    await click(c, "#nearbyFront"); await click(c, "#wbLayers");
    assert.equal(await c.evaluate("document.querySelector('#layerDrawer [data-layer=sst]').getAttribute('aria-pressed')"), "true");
    assert.match(await c.evaluate("document.querySelector('#layerDrawer [data-layer=ground]').innerText"), /离线|未接入/);
    const point = await mapPoint(c); await pointer(c, point);
    assert.equal(await c.evaluate("document.getElementById('layerDrawer').getAttribute('aria-hidden')"), "true");
    await click(c, "#filterToggle");
    assert.equal(await c.evaluate("document.getElementById('layerDrawer').getAttribute('aria-hidden')"), "true");
  } finally { await browser.close(); }
});

test("reopening restores only applied conditions and manual layers while retaining the independent map view", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable"); await c.send("Page.navigate", { url: page }); await sleep(650);
    await click(c, "#headerFilter"); await fill(c, "#locInput", "125,31"); await click(c, "#locateBtn");
    await click(c, "#rangeSeg [data-range='30']"); await click(c, "#dateNext");
    await fill(c, "#locInput", "126,32"); await click(c, "#filterClose");
    await click(c, "#workbenchToggle"); await click(c, "#wbLayers"); await click(c, "#layerDrawer [data-layer='sst']");
    await click(c, "#layerClose"); await click(c, "#workbenchClose"); await sleep(650);
    const before = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.send("Page.reload"); await sleep(750);
    assert.equal(await c.evaluate("document.getElementById('locInput').value"), "125.00°E, 31.00°N");
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-06");
    assert.equal(await c.evaluate("document.querySelector('#rangeSeg button.active').dataset.range"), "30");
    assert.equal(await c.evaluate("document.querySelector('#layerDrawer [data-layer=sst]').getAttribute('aria-pressed')"), "false");
    assert.equal(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"), before);
    assert.equal(await c.evaluate("document.getElementById('datePlay').classList.contains('on')"), false);
    assert.match(await c.evaluate("document.getElementById('preferenceStatus').textContent"), /已恢复/);
  } finally { await browser.close(); }
});

for (const scenario of ["expired", "corrupt", "blocked"]) test(`saved preferences degrade honestly when ${scenario}`, async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    const source = scenario === "blocked" ? "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('disabled','SecurityError')}})" :
      `localStorage.setItem('ocean.applied.v1',${JSON.stringify(scenario === "corrupt" ? "{invalid" : JSON.stringify({ schema: "ocean-applied-preferences/v1", date: "2099-01-01", point: { lon: 300, lat: 95 }, radius_km: 999, layers: { sst: false, unknown: true } }))});`;
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source });
    await c.send("Page.navigate", { url: page }); await sleep(650);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-05");
    assert.equal(await c.evaluate("document.getElementById('locInput').value"), "124.50°E, 30.20°N");
    assert.match(await c.evaluate("document.getElementById('preferenceStatus').textContent"), /无法|失效|损坏/);
    await click(c, "#headerFilter"); await click(c, "#rangeSeg [data-range='30']");
    assert.equal(await c.evaluate("document.querySelector('#rangeSeg button.active').dataset.range"), "30");
    if (scenario !== "blocked") assert.equal(await c.evaluate("JSON.parse(localStorage.getItem('ocean.applied.v1')).radius_km"), 30, "corrupt data must not permanently disable future valid saving");
  } finally { await browser.close(); }
});
