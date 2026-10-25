import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, sleep } from "../lib/browser-driver.mjs";

test("actual page isolates late day responses and classifies/retries activity failures without dropping other layers", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  const errors=[]; c.onEvent(e=>{if(e.method==='Runtime.exceptionThrown') errors.push(e.params.exceptionDetails);});
  try {
    await c.send("Runtime.enable");
    await c.send("Page.enable");
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.OF_API_BASE='http://controlled.invalid/api';window.fixtureMode='normal';window.fixtureCalls=0;
      const originalFetch=window.fetch;window.fetch=(url,options)=>{
        if(!String(url).includes('controlled.invalid')) return originalFetch(url,options);
        const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
        if(String(url).endsWith('/health')) return Promise.resolve(reply({status:'ok'}));
        if(String(url).includes('/frontend/day/')) {
          if(window.fixtureMode==='malformed-day') return Promise.resolve(reply({}));
          const iso=String(url).split('/').pop(), front=structuredClone(window.OF_DATA_DAYS[iso]);
          front.source_file='controlled-'+iso;
          return new Promise(done=>setTimeout(()=>done(reply({front})),iso==='2024-08-06'?350:30));
        }
        if(String(url).includes('/fishing/')) {
          window.fixtureCalls++;
          if(window.fixtureMode==='delayed') return new Promise(done=>setTimeout(()=>done(reply({cells:[{lon:124,lat:30,hours:1}]})),250));
          if(window.fixtureMode==='forbidden') return Promise.resolve(reply({},403));
          if(window.fixtureMode==='missing') return Promise.resolve(reply({},404));
          if(window.fixtureMode==='unprepared') return Promise.resolve(reply({},409));
          if(window.fixtureMode==='network') return Promise.reject(new TypeError('network'));
          if(window.fixtureMode==='empty') return Promise.resolve(reply({cells:[]}));
          return Promise.resolve(reply({cells:[{lon:124,lat:30,hours:0}]}));
        }
        return Promise.resolve(reply({meta:{status:'empty'},layers:{}}));
      };` });
    await c.send("Page.navigate", { url: pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href });
    await sleep(900);
    const view = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.evaluate("document.getElementById('dateNext').click()");
    await sleep(60);
    await c.evaluate("document.getElementById('dateNext').click()");
    await sleep(600);
    assert.equal(await c.evaluate("document.getElementById('timeDate').value"), "2024-08-07", JSON.stringify(errors));
    assert.equal(await c.evaluate("OFData.day('2024-08-06').source_file === 'controlled-2024-08-06'"), false);
    assert.equal(await c.evaluate("document.getElementById('mapSvg').dataset.renderDate"), "2024-08-07");
    assert.equal(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"), view);
    assert.equal(await c.evaluate("OFData.serverEnabled()"), true, await c.evaluate("JSON.stringify(OFData.serverMode())"));
    const malformed = await c.evaluate("(async()=>{window.fixtureMode='malformed-day';OFData.setRequestContext({scenario:'malformed-day'});await OFData.ensureDay('2024-08-07',true);return OFData.loadState().day.status})()");
    assert.equal(malformed, "error");
    assert.equal(await c.evaluate("document.getElementById('retryData').hidden"), false);
    for (const [mode, status, calls] of [["forbidden","forbidden",1],["missing","day-missing",1],["unprepared","unprepared",1],["network","error",2],["empty","unknown-coverage",1],["normal","ready-zero-records",1]]) {
      const result = await c.evaluate(`(async()=>{window.fixtureMode=${JSON.stringify(mode)};window.fixtureCalls=0;
        OFData.setRequestContext({scenario:${JSON.stringify(mode)}});await OFData.ensureFishing(${JSON.stringify(mode === "normal" ? "2024-07-02" : "2024-07-01")});
        return {state:OFData.loadState().fishing?.status,calls:window.fixtureCalls,front:OFData.hasDay('2024-08-07'),server:OFData.serverEnabled()};})()`);
      assert.equal(result.state, status, mode); assert.equal(result.calls, calls, mode);
      assert.equal(result.front, true); assert.equal(result.server, true);
    }
    await c.evaluate("window.fixtureMode='delayed';window.fixtureCalls=0;document.getElementById('dateNext').click();if(!state.layers.ground)document.querySelector('[data-layer=ground]').click()");
    await sleep(80);
    await c.evaluate("document.querySelector('#rangeSeg [data-range=\"30\"]').click()");
    await sleep(650);
    assert.ok(await c.evaluate("window.fixtureCalls>=2"), "radius change reissues canceled activity");
    assert.equal(await c.evaluate("OFData.fishingDay(state.date)?.cells[0].hours"), 1);
    assert.equal(await c.evaluate("OFData.loadState().fishing?.status"), "ready");
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').dataset.renderStatus"), "ready", "uncovered viewport is not complete detail");
    await c.evaluate("OFData.setServerMode('offline')");
    assert.equal(await c.evaluate("OFData.serverEnabled()"), false);
    assert.equal(await c.evaluate("OFData.day('2024-08-07').source_file === 'controlled-2024-08-07'"), false);
  } finally { await browser.close(); }
});
