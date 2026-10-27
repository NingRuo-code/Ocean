import test from 'node:test';
import assert from 'node:assert/strict';
import {withService} from '../lib/monthly-test-service.mjs';
import {launchBrowser,waitFor} from '../lib/browser-driver.mjs';

test('original viewport renders honest partial support without global prewarming or replacing daily activity',async()=>{
  await withService(async(base)=>{
    const browser=await launchBrowser(process.env.EDGE??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'),c=browser.cdp;
    const errors=[];c.onEvent(e=>{if(e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails);});
    try{
      await c.send('Runtime.enable');await c.send('Page.enable');
      await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`
        window.viewportCalls=[];window.viewportFault=false;
        const originalFetch=window.fetch;window.fetch=(url,options)=>{
          if(String(url).includes('/viewport?')){
            window.viewportCalls.push(String(url));
            if(window.viewportFault===true)return Promise.resolve(new Response('{}',{status:403}));
            if(window.viewportFault==='date')return originalFetch(url,options).then(async response=>{
              const body=await response.json();body.meta.date='2024-08-04';return new Response(JSON.stringify(body));
            });
            if(window.viewportFault==='precision')return originalFetch(url,options).then(async response=>{
              const body=await response.json();body.layers.sst.cells[0].value=22.17;return new Response(JSON.stringify(body));
            });
          }
          return originalFetch(url,options);
        };`});
      await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
      await waitFor(c,"window.OFData?.serverEnabled() && viewportCalls.length>0 && OFData.loadState().viewport?.status==='partial' && document.getElementById('mapSvg').dataset.renderStatus==='partial'");
      const result=await c.evaluate(`({status:OFData.viewportState(state.date),render:document.getElementById('mapSvg').dataset.renderStatus,
        calls:viewportCalls,day:OFData.fishingDay(state.date),text:document.getElementById('serverModeToggle').textContent})`);
      assert.equal(result.status.status,'partial');
      assert.equal(result.status.coverage.layers.sst,'partial');
      assert.equal(result.render,'partial');assert.match(result.text,/部分覆盖/);
      assert.equal(result.day,null,'historical response points do not replace daily fishing data');
      assert.ok(result.calls.every(url=>!url.includes('-180%2C-90%2C180%2C90')),'planar startup never prewarms the global bbox');
      await c.evaluate("if(!state.layers.ground)document.querySelector('[data-layer=ground]').click();drawMap()");
      assert.ok(await c.evaluate("document.querySelectorAll('[data-layer=response-point]').length>0"));
      assert.match(await c.evaluate("document.getElementById('mapLegendSummary').textContent"),/历史后1–3日/);
      const before=await c.evaluate('viewportCalls.length');
      await c.evaluate('OFData.ensureViewport(state.date)');
      assert.equal(await c.evaluate('viewportCalls.length'),before,'settled partial support is reusable without refetch');
      await c.evaluate("document.getElementById('globeReset').click()");
      await waitFor(c,"globeMode() && OFData.viewportState(state.date)?.status==='partial'");
      const globe=await c.evaluate('OFData.viewWindow()');
      assert.equal(globe.step,40);assert.ok(globe.bbox[1]>-90,'hemisphere envelope omits the invisible opposite latitude band');
      await c.evaluate("document.getElementById('globeReset').click()");
      await waitFor(c,"!globeMode() && OFData.viewportState(state.date)?.status==='partial'");
      await c.evaluate("window.viewportFault='precision';OFData.ensureViewport(state.date,true)");
      assert.equal(await c.evaluate("OFData.patches(state.date).filter(p=>!p.primary).some(p=>p.sst?.runs.some(r=>Math.abs(r[3]*p.sst.bin_c-22.17)<1e-9))"),true,'controlled 22.17°C remains 22.17°C instead of rebinned 22°C');
      await c.evaluate('window.viewportFault=false');
      await c.evaluate("OFData.setViewWindow({lonMin:0,latMin:0,lonMax:1,latMax:1});OFData.ensureViewport(state.date)");
      assert.equal(await c.evaluate('OFData.viewportState(state.date).status'),'empty');
      assert.equal(await c.evaluate('OFData.viewportReady(state.date)'),false);
      await c.evaluate("window.viewportFault=true;OFData.setViewWindow({lonMin:10,latMin:0,lonMax:11,latMax:1});OFData.ensureViewport(state.date)");
      assert.equal(await c.evaluate('OFData.loadState().viewport.status'),'forbidden');
      assert.equal(await c.evaluate('OFData.hasDay(state.date)'),true,'failed viewport retains local day fallback');
      await c.evaluate("syncServerModeUi()");
      assert.match(await c.evaluate("document.getElementById('serverModeToggle').textContent"),/无权访问/);
      await c.evaluate("window.viewportFault='date';OFData.ensureViewport(state.date,true)");
      assert.equal(await c.evaluate('OFData.loadState().viewport.status'),'error');
      await c.evaluate("window.viewportFault=false;OFData.ensureViewport(state.date,true)");
      assert.equal(await c.evaluate('OFData.viewportState(state.date).status'),'empty','manual retry reaches original service again');
      await c.evaluate("OFData.setServerMode('offline');refresh()");
      assert.equal(await c.evaluate('OFData.serverEnabled()'),false);
      assert.equal(await c.evaluate("document.getElementById('mapEmpty').hidden"),true);
      assert.deepEqual(errors,[]);
    }finally{await browser.close();}
  });
});
