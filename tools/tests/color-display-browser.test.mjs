import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { launchBrowser, waitFor } from "../lib/browser-driver.mjs";
const page = pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href;
const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
async function click(c, selector) {
  const p = await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await c.send("Input.dispatchMouseEvent", {type:"mousePressed",...p,button:"left",clickCount:1});
  await c.send("Input.dispatchMouseEvent", {type:"mouseReleased",...p,button:"left",clickCount:1});
}
async function open(c, source) {
  await c.send("Page.enable");
  if(source) await c.send("Page.addScriptToEvaluateOnNewDocument",{source});
  await c.send("Page.navigate",{url:page});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
}
test("thermal map and legend share a fixed audited archive domain, with explicit local enhancement and unchanged readings",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await open(c);
    assert.match(await c.evaluate("document.getElementById('sstLegendOpen')?.textContent||''"),/20.5.*33.*°C/);
    const before=await c.evaluate("({color:document.querySelector('#mapSvg [data-layer=sst][data-value-c=\"30\"]').getAttribute('fill'),reading:document.getElementById('nowScopeTag').textContent})");
    await click(c,"#sstLegendOpen"); await click(c,"#sstLocalEnhance");
    assert.match(await c.evaluate("document.getElementById('sstLegendOpen').textContent"),/局部增强/);
    assert.equal(await c.evaluate("document.getElementById('nowScopeTag').textContent"),before.reading);
    await click(c,"#sstFixed");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst][data-value-c=\"30\"]').getAttribute('fill')"),before.color);
    await click(c,"#layerClose"); await click(c,"#headerFilter"); await click(c,"#dateNext"); await click(c,"#filterClose");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst][data-value-c=\"30\"]').getAttribute('fill')"),before.color);
  }finally{await b.close();}
});

test("front lines remain visible while only nearest and selected primary objects receive labels",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await open(c);
    assert.equal(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=front-label]').length"),1);
    const lines=await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=front-line]').length");
    await click(c,"#nowFrontDetails summary");
    const id=await c.evaluate("document.querySelector('#nowFronts [data-id]').dataset.id");
    await click(c,`#nowFronts [data-id='${id}']`);
    assert.ok(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=front-label]').length")<=2);
    assert.equal(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=front-line]').length"),lines);
    assert.match(await c.evaluate("[...document.querySelectorAll('#mapSvg [data-layer=front-label]')].map(n=>n.textContent).join(' ')"),new RegExp(id));
  }finally{await b.close();}
});

test("fine SST masks the coarse field including holes, while out-of-domain readings keep their true values",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await open(c,`window.OF_API_BASE='http://controlled.invalid/api';window.fetch=url=>{url=String(url);const reply=x=>Promise.resolve(new Response(JSON.stringify(x)));
      if(url.endsWith('/health'))return reply({status:'ok'});
      if(url.includes('/frontend/day/')){const iso=url.split('/').pop().split('?')[0],front=structuredClone(window.OF_DATA_DAYS[iso]);return reply({front,
        window:{bbox:[120,27,128,34],step:1,resolution_deg:.05},sst:{date:iso,bin_c:.5,product:{id:'contract-fixture',version:'synthetic'},grid:{lon0:124.5,lat0:30.2,dlon:.05,dlat:.05,nx:2,ny:2},runs:[[0,0,1,30],[0,1,1,60],[1,0,1,80]]},
        sst_coarse:{bin_c:.5,grid:{lon0:124,lat0:30,dlon:1,dlat:1,nx:2,ny:2},runs:[[0,0,2,40],[1,0,2,40]]}});}
      return reply({meta:{status:'empty'},layers:{}});};`);
    assert.match(await c.evaluate("document.getElementById('nowScopeTag').textContent"),/水温 15.0 °C/);
    assert.match(await c.evaluate("document.getElementById('sstLegendOpen').textContent"),/适用性待确认/);
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst][data-value-c=\"15\"]').getAttribute('data-range')"),"below");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst][data-value-c=\"40\"]').getAttribute('data-range')"),"above");
    assert.notEqual(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst][data-value-c=\"40\"]').getAttribute('stroke')"),"none");
    assert.equal(await c.evaluate("(()=>{const coarse=document.querySelector('#mapSvg [data-sst-resolution=\"1\"]'),ref=coarse.getAttribute('mask'),mask=document.querySelector('#mapSvg '+ref.slice(4,-1)),origin=document.querySelector('#mapSvg .pulse');return [...mask.querySelectorAll('path')].some(p=>p.getAttribute('fill')==='black'&&p.isPointInFill(new DOMPoint(+origin.getAttribute('cx')+1,+origin.getAttribute('cy')-1)));})()"),true);
    assert.ok(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=sst-missing]').length")>0);
  }finally{await b.close();}
});

const effortFixture = (registered = true, zero = false) => `
  ${registered ? `let domains;Object.defineProperty(window,'OF_DISPLAY_DOMAINS',{get:()=>domains,set:v=>{domains={...v,effort:{status:'synthetic',version:'contract-scale/v1',domain:[0,100],dates:['2024-08-05','2024-08-06'],product:{id:'contract-fixture',version:'v1'},resolution_deg:.1,unit:'hours',evidence_id:'synthetic-display-contract'}}}});` : ""}
  window.OF_API_BASE='http://controlled.invalid/api';window.fetch=url=>{url=String(url);const reply=x=>Promise.resolve(new Response(JSON.stringify(x)));
    if(url.endsWith('/health'))return reply({status:'ok'});
    if(url.includes('/frontend/day/'))return reply({front:structuredClone(window.OF_DATA_DAYS[url.split('/').pop().split('?')[0]])});
    if(url.includes('/fishing/')){const date=url.split('/').pop();return reply({date,version:'v1',spatial_resolution_deg:.1,source:{name:'合成合同样例',dataset:'contract-fixture',unit:'hours'},cells:[
      {lon:124.5,lat:30.2,hours:${zero ? 0 : 30}},{lon:124.51,lat:30.2,hours:${zero ? 0 : "date==='2024-08-05'?50:3200"}},{lon:124.52,lat:30.2,hours:0}]});}
    return reply({meta:{status:'empty'},layers:{}});};`;

test("registered activity scale stays identical across dates, preserves raw hours and allows restoring SST opacity",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await open(c,effortFixture());
    const opacity=await c.evaluate("document.querySelector('#mapSvg [data-layer=sst]').getAttribute('opacity')");
    await click(c,"#workbenchToggle");await click(c,"#fishingActivity");
    await waitFor(c,"!!document.querySelector('#mapSvg [data-layer=ground][data-hours=\"30\"]')");
    const style=await c.evaluate("(()=>{const e=document.querySelector('#mapSvg [data-layer=ground][data-hours=\"30\"]');return {fill:e.getAttribute('fill'),r:e.getAttribute('r'),title:e.textContent};})()");
    assert.match(style.title,/30 h/);
    await click(c,"#mapSvg .pulse");
    assert.match(await c.evaluate("document.getElementById('mapProbe').textContent"),/表观活动.*30 h/);
    assert.match(await c.evaluate("document.getElementById('effortLegendOpen')?.textContent||''"),/0.*100.*h.*对数/);
    assert.notEqual(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst]').getAttribute('opacity')"),opacity);
    await click(c,"#effortLegendOpen");await click(c,"#sstRestore");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst]').getAttribute('opacity')"),opacity);
    await click(c,"#layerClose");await click(c,"#headerFilter");await click(c,"#dateNext");await click(c,"#filterClose");
    await waitFor(c,"!!document.querySelector('#mapSvg [data-layer=ground][data-hours=\"3200\"]')");
    const after=await c.evaluate("(()=>{const e=document.querySelector('#mapSvg [data-layer=ground][data-hours=\"30\"]');return {fill:e.getAttribute('fill'),r:e.getAttribute('r')};})()");
    assert.equal(after.fill,style.fill);assert.equal(after.r,style.r);
    assert.match(await c.evaluate("document.querySelector('#mapSvg [data-hours=\"3200\"]').textContent"),/3200 h/);
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-hours=\"3200\"]').getAttribute('data-range')"),"above");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-layer=sst]').getAttribute('opacity')"),opacity);
  }finally{await b.close();}
});

for(const scenario of ["missing", "version", "invalid-domain"]) test(`activity scale falls back honestly for ${scenario} registration`,async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    let source=effortFixture(scenario!=="missing");
    if(scenario==="version")source=source.replace("date,version:'v1'","date,version:'v2'");
    if(scenario==="invalid-domain")source=source.replace("domain:[0,100]","domain:[0,-1]");
    await open(c,source);await click(c,"#workbenchToggle");await click(c,"#fishingActivity");
    await waitFor(c,"!!document.querySelector('#mapSvg [data-hours=\"30\"]')");
    assert.match(await c.evaluate("document.getElementById('effortLegendOpen').textContent"),/待确认.*统一标记/);
    assert.equal(await c.evaluate("document.querySelectorAll('#effortLegendOpen .scale-ramp').length"),0);
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-hours=\"30\"]').getAttribute('r')"),"3");
    assert.match(await c.evaluate("document.querySelector('#mapSvg [data-hours=\"30\"]').textContent"),/30 h/);
  }finally{await b.close();}
});

test("valid zero activity has hollow markers without an illegal logarithm or a positive minimum",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await open(c,effortFixture(true,true));await click(c,"#workbenchToggle");await click(c,"#fishingActivity");
    await waitFor(c,"!!document.querySelector('#mapSvg [data-hours=\"0\"]')");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-hours=\"0\"]').getAttribute('fill')"),"none");
    assert.equal(await c.evaluate("document.querySelector('#mapSvg [data-hours=\"0\"]').getAttribute('data-range')"),"zero");
    assert.equal(await c.evaluate("document.getElementById('heroVerdict').textContent"),"0 h");
  }finally{await b.close();}
});

test("unknown activity coverage never receives a normal scale or zero markers",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await open(c,effortFixture().replace(/cells:\[[\s\S]*?\]/,"cells:[]"));
    await click(c,"#workbenchToggle");await click(c,"#fishingActivity");
    await waitFor(c,"document.getElementById('heroLine').textContent.includes('覆盖未知')");
    assert.equal(await c.evaluate("document.getElementById('heroVerdict').textContent"),"—");
    assert.equal(await c.evaluate("document.getElementById('effortLegendOpen')"),null);
    assert.equal(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=ground]').length"),0);
  }finally{await b.close();}
});

test("small-screen touch opens the shared scale panel, Escape returns focus and hidden layers lose their legend",async()=>{
  const b=await launchBrowser(edge),c=b.cdp;
  try{
    await c.send("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await c.send("Emulation.setTouchEmulationEnabled",{enabled:true});
    await open(c);
    const p=await c.evaluate("(()=>{const r=document.getElementById('sstLegendOpen').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
    await c.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p]});
    await c.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    assert.equal(await c.evaluate("document.activeElement.id"),"colorSettingsHeading");
    assert.equal(await c.evaluate("(()=>{const p=document.getElementById('layerDrawer'),r=p.getBoundingClientRect();return !p.hidden&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;})()"),true);
    for(const type of ["keyDown","keyUp"])await c.send("Input.dispatchKeyEvent",{type,key:"Escape",code:"Escape"});
    assert.equal(await c.evaluate("document.activeElement.id"),"sstLegendOpen");
    await click(c,"#sstLegendOpen");await click(c,"#layerDrawer [data-layer=sst]");
    assert.equal(await c.evaluate("document.getElementById('sstLegendOpen')"),null);
    await click(c,"#layerClose");
    assert.equal(await c.evaluate("document.activeElement.id"),"workbenchToggle");
    assert.equal(await c.evaluate("document.querySelectorAll('#mapSvg [data-layer=sst]').length"),0);
  }finally{await b.close();}
});
