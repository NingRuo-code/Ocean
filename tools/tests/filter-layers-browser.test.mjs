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
