import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, sleep, waitFor } from "../lib/browser-driver.mjs";

const page = pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href;
const ready = c => waitFor(c, "document.getElementById('preferenceStatus')?.getAttribute('aria-busy') === 'false'");
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

test("workbench shows applied conditions through the original filter and keeps drafts separate from map navigation", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");await c.send("Page.navigate", {url:page});await ready(c);
    await click(c,"#workbenchToggle");
    assert.equal(await c.evaluate("!!document.getElementById('workbenchContext')"),true);
    assert.equal(await c.evaluate("document.getElementById('wbContextPoint').textContent"),"124.50°E, 30.20°N");
    await click(c,"#workbenchContext");
    assert.equal(await c.evaluate("document.getElementById('filterPanel').hidden"),false);
    await fill(c,"#locInput","125,31");
    await click(c,"#rangeSeg [data-range='30']");
    await click(c,"#dateNext");
    assert.equal(await c.evaluate("document.getElementById('wbContextDate').textContent"),"2024-08-06");
    assert.equal(await c.evaluate("document.getElementById('wbContextRange').textContent"),"30 km");
    assert.equal(await c.evaluate("document.getElementById('wbContextPoint').textContent"),"124.50°E, 30.20°N","unapplied coordinate draft is not the analysis point");
    await click(c,"#locateBtn");
    assert.equal(await c.evaluate("document.getElementById('wbContextPoint').textContent"),"125.00°E, 31.00°N");
    await key(c,"Escape");
    assert.equal(await c.evaluate("document.activeElement.id"),"workbenchContext");
    assert.equal(await c.evaluate("document.getElementById('workbenchContext').getAttribute('aria-expanded')"),"false");
    await click(c,"#workbenchMapHelp summary");
    assert.equal(await c.evaluate("document.getElementById('workbenchMapHelp').open"),true);
    assert.match(await c.evaluate("document.getElementById('workbenchMapHelp').textContent"),/设置分析点[\s\S]*回到分析点/);
    const context = await c.evaluate("document.getElementById('workbenchContext').textContent");
    const point = await mapPoint(c);
    await c.send("Input.dispatchMouseEvent",{type:"mousePressed",...point,button:"left",clickCount:1});
    await c.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:point.x+70,y:point.y+15,button:"left",buttons:1});
    await c.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:point.x+70,y:point.y+15,button:"left",clickCount:1});
    await click(c,"#recenter");
    await pointer(c,await mapPoint(c));
    assert.equal(await c.evaluate("document.getElementById('workbenchContext').textContent"),context,"drag, recenter and probe do not set a new analysis point");
    await click(c,"#workbenchContext");await click(c,"#pickOriginBtn");
    await pointer(c,await mapPoint(c));
    const assigned = await c.evaluate("document.getElementById('wbContextPoint').textContent");
    assert.notEqual(assigned,"125.00°E, 31.00°N","explicit map point selection updates applied context");
    assert.equal(await c.evaluate(`document.getElementById('mapSvg').textContent.includes(${JSON.stringify(assigned)})`),true);
    await key(c,"Escape");
    assert.equal(await c.evaluate("document.getElementById('taskWorkbench').open"),true,"map Escape must not seize workbench focus");
    await click(c,"#workbenchMapHelp summary");await key(c,"Escape");
    assert.equal(await c.evaluate("document.getElementById('taskWorkbench').open"),false);
    assert.equal(await c.evaluate("document.activeElement.id"),"workbenchToggle");
    await click(c,"#workbenchToggle");
    assert.equal(await c.evaluate("document.getElementById('wbContextPoint').textContent"),assigned);
    assert.equal(await c.evaluate("document.getElementById('taskWorkbench').matches(':modal')"),false);
    for (const pane of ["clim","future","basis"]) {
      await click(c,`#taskWorkbench [data-open-pane='${pane}']`);
      assert.equal(await c.evaluate(`document.getElementById('pane-${pane}').classList.contains('active')`),true);
      assert.equal(await c.evaluate("document.getElementById('wbContextPoint').textContent"),assigned);
    }
    assert.match(await c.evaluate("document.getElementById('futureBestTag').textContent"),/未独立验证/);
  } finally {await browser.close();}
});

test("unified filters preserve drafts, apply only valid coordinates and distinguish map click from drag or zoom", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate", { url: page });
    await ready(c);
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
    await c.send("Page.enable"); await c.send("Page.navigate", { url: page }); await ready(c);
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

test("small-screen floating controls leave both workbench modules reachable by touch", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  async function tap(selector) {
    const p = await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    assert.equal(await c.evaluate(`document.querySelector(${JSON.stringify(selector)}).contains(document.elementFromPoint(${p.x},${p.y}))`), true, selector + " must be unobstructed");
    await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
    await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  try {
    await c.send("Page.enable");
    await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await c.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await c.send("Page.navigate", { url: page }); await ready(c);
    await tap("#workbenchToggle");
    for (const [button, panel] of [["#wbLayers", "#layerDrawer"], ["#filterToggle", "#filterPanel"]]) {
      await tap(button);
      assert.equal(await c.evaluate(`(()=>{const w=document.getElementById('taskWorkbench').getBoundingClientRect(),p=document.querySelector(${JSON.stringify(panel)}).getBoundingClientRect();return w.bottom<=p.top;})()`), true, "small-screen panels must not cover the workbench");
      await tap("#aiEvidence summary");
      assert.equal(await c.evaluate("document.getElementById('aiEvidence').open"), true);
      await tap("#aiEvidence summary");
      assert.equal(await c.evaluate("document.querySelector('#taskWorkbench').open"), true);
    }
  } finally { await browser.close(); }
});

test("empty activity remains coverage-unknown after an ordinary radius refresh", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.OF_API_BASE='http://controlled.invalid/api';
      window.fetch=url=>{url=String(url);const reply=body=>Promise.resolve(new Response(JSON.stringify(body)));
        if(url.endsWith('/health'))return reply({status:'ok'});
        if(url.includes('/frontend/day/'))return reply({front:structuredClone(window.OF_DATA_DAYS[url.split('/').pop()])});
        if(url.includes('/fishing/'))return reply({cells:[]});
        return reply({meta:{status:'empty'},layers:{}});};` });
    await c.send("Page.navigate", { url: page }); await ready(c);
    await click(c, "#workbenchToggle"); await click(c, "#wbLayers"); await click(c, "#layerDrawer [data-layer=ground]");
    await waitFor(c, "document.querySelector('#layerDrawer [data-layer=ground] .layer-status').textContent==='覆盖未知'");
    await click(c, "#filterToggle"); await click(c, "#rangeSeg [data-range='30']"); await click(c, "#wbLayers");
    assert.match(await c.evaluate("document.querySelector('#layerDrawer [data-layer=ground] .layer-status').textContent"), /覆盖未知/);
    assert.equal(await c.evaluate("[...document.querySelectorAll('#mapLegendSummary .key-row')].find(n=>n.textContent.includes('表观活动')).querySelectorAll('.swatch').length"), 0);
  } finally { await browser.close(); }
});

test("reopening restores only applied conditions and manual layers while retaining the independent map view", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable"); await c.send("Page.navigate", { url: page }); await ready(c);
    await click(c, "#headerFilter"); await fill(c, "#locInput", "125,31"); await click(c, "#locateBtn");
    await click(c, "#rangeSeg [data-range='30']"); await click(c, "#dateNext");
    await fill(c, "#locInput", "126,32"); await click(c, "#filterClose");
    await click(c, "#workbenchToggle"); await click(c, "#wbLayers"); await click(c, "#layerDrawer [data-layer='sst']");
    await click(c, "#layerClose"); await click(c, "#workbenchClose"); await sleep(650);
    const before = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.send("Page.reload"); await ready(c);
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
    await c.send("Page.navigate", { url: page }); await ready(c);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-05");
    assert.equal(await c.evaluate("document.getElementById('locInput').value"), "124.50°E, 30.20°N");
    assert.match(await c.evaluate("document.getElementById('preferenceStatus').textContent"), /无法|失效|损坏/);
    await click(c, "#headerFilter"); await click(c, "#rangeSeg [data-range='30']");
    assert.equal(await c.evaluate("document.querySelector('#rangeSeg button.active').dataset.range"), "30");
    if (scenario !== "blocked") assert.equal(await c.evaluate("JSON.parse(localStorage.getItem('ocean.applied.v1')).radius_km"), 30, "corrupt data must not permanently disable future valid saving");
  } finally { await browser.close(); }
});

test("calendar playback pauses at an internal missing day and resumes only by explicit continuation", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.OF_DATA_DAYS=new Proxy({}, {set(target,key,value){if(key!=='2024-08-06')target[key]=value;return true;}});" });
    await c.send("Page.navigate", { url: page }); await ready(c);
    await click(c, "#headerFilter"); await click(c, "#datePlay"); await sleep(1150);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-06", "missing calendar days must not be silently skipped");
    assert.equal(await c.evaluate("document.getElementById('datePlay').classList.contains('on')"), false);
    assert.match(await c.evaluate("document.getElementById('playbackStatus').textContent"), /2024-08-06.*缺|2024-08-06.*未/);
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').dataset.renderStatus"), "ready");
    await click(c, "#playbackContinue"); await sleep(150);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-07");
    await click(c, "#playbackStop"); await sleep(1050);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-07");
    await c.evaluate("document.getElementById('timeDate').value='2024-08-31';document.getElementById('timeDate').dispatchEvent(new Event('change',{bubbles:true}))");
    await click(c, "#datePlay"); await sleep(1050);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-31", "end of range must stop instead of wrapping");
    assert.equal(await c.evaluate("document.getElementById('datePlay').classList.contains('on')"), false);
  } finally { await browser.close(); }
});

for (const scenario of ["unprepared", "network", "late"]) test(`playback isolates ${scenario} responses and never restarts after a manual day change`, async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.OF_API_BASE='http://controlled.invalid/api';window.requests=[];
      window.fetch=(url)=>{url=String(url);window.requests.push(url);const reply=(body,status=200)=>new Response(JSON.stringify(body),{status});
        if(url.endsWith('/health'))return Promise.resolve(reply({status:'ok'}));
        if(url.includes('/frontend/day/')){const iso=url.split('/').pop();
          if(iso==='2024-08-06'&&${JSON.stringify(scenario)}==='unprepared')return Promise.resolve(reply({},409));
          if(iso==='2024-08-06'&&${JSON.stringify(scenario)}==='network')return Promise.reject(new TypeError('network'));
          const front=structuredClone(window.OF_DATA_DAYS[iso]);
          return new Promise(done=>setTimeout(()=>done(reply({front})),iso==='2024-08-06'&&${JSON.stringify(scenario)}==='late'?700:10));}
        return Promise.resolve(reply({meta:{status:'empty'},layers:{}}));};` });
    await c.send("Page.navigate", { url: page }); await ready(c);
    await click(c, "#headerFilter"); await click(c, "#datePlay");
    if (scenario === "late") {
      await sleep(1000); await click(c, "#dateNext"); await sleep(900);
      assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-07");
      assert.equal(await c.evaluate("document.getElementById('mapSvg').dataset.renderDate"), "2024-08-07");
    } else {
      await sleep(1600);
      assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-06");
      assert.match(await c.evaluate("document.getElementById('playbackStatus').textContent"), scenario === "network" ? /读取失败/ : /未准备/);
      assert.equal(await c.evaluate("window.requests.filter(u=>u.includes('/frontend/day/2024-08-06')).length"), scenario === "network" ? 2 : 1);
    }
    assert.equal(await c.evaluate("document.getElementById('datePlay').classList.contains('on')"), false);
    assert.equal(await c.evaluate("window.requests.some(u=>/prepare|analysis|model|tasks/.test(u))"), false);
  } finally { await browser.close(); }
});
