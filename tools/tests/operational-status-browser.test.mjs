import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchBrowser, waitFor} from '../lib/browser-driver.mjs';
import {withService} from '../lib/monthly-test-service.mjs';

const edge=process.env.EDGE??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const execute=promisify(execFile);
async function click(c,selector){
 const p=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
}

test('data explanation explicitly reads layered original service status without changing map or executing work',()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp,requests=[];
 c.onEvent(m=>{if(m.method==='Network.requestWillBeSent')requests.push(m.params.request);});
 try{
  await c.send('Page.enable');await c.send('Network.enable');
  await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  const before=await c.evaluate('({date:state.date,lon:state.lon,lat:state.lat,range:state.range,view:structuredClone(state.view),zoom:state.zoom})');
  assert.equal(requests.some(r=>r.url.endsWith('/api/status')),false);
  await click(c,'#toBasis');await click(c,'#operationalStatus summary');await click(c,'#statusRefresh');
  await waitFor(c,"document.getElementById('operationalStatus')?.dataset.state==='ready'");
  assert.match(await c.evaluate("document.getElementById('statusSummary').textContent"),/入口可达.*活动数据未连接/);
  assert.match(await c.evaluate("document.getElementById('statusLayers').textContent"),/2024-07-01.*2024-08-31.*历史归档/);
  assert.match(await c.evaluate("document.getElementById('statusLayers').textContent"),/研究资格.*未连接/);
  assert.match(await c.evaluate("document.getElementById('statusLayers').textContent"),/代理链路.*未连接/);
  assert.deepEqual(await c.evaluate('({date:state.date,lon:state.lon,lat:state.lat,range:state.range,view:structuredClone(state.view),zoom:state.zoom})'),before);
  assert.equal(requests.some(r=>r.method==='POST'),false);
  assert.equal(requests.filter(r=>r.url.endsWith('/api/status')).length,1);
  assert.equal(requests.some(r=>/\/api\/(data\/|ai\/)/.test(r.url)),false);
  await writeFile('docs/reports/screenshots/ocean-operational-status-1440.png',Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  assert.equal(await c.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await writeFile('docs/reports/screenshots/ocean-operational-status-390.png',Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const view=await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
  await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:25,y:350,deltaX:0,deltaY:-220});
  await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(view)}`);
 }finally{await b.close();}
}));

test('browser shows HTTP failure, malformed, stale and clock-unknown status without reporting current readiness',()=>withService(async base=>{
 const original=await(await fetch(base+'/api/status')).json();
 const b=await launchBrowser(edge),c=b.cdp;let body=original,code=200;
 const pending=[];
 c.onEvent(m=>{if(m.method==='Fetch.requestPaused')pending.push(c.send('Fetch.fulfillRequest',{
  requestId:m.params.requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'}],
  body:Buffer.from(JSON.stringify(body)).toString('base64')
 }));});
 try{
  await c.send('Page.enable');await c.send('Fetch.enable',{patterns:[{urlPattern:'*/api/status',requestStage:'Request'}]});
  for(const [responseCode,change,expected] of [
   [503,{},'error'],[404,{},'error'],[200,{schema:'unsupported'},'error'],
   [200,{sample_age_seconds:91},'stale'],
   [200,{sampled_at:new Date(Date.now()+3600000).toISOString()},'stale'],
  ]){
   code=responseCode;body={...original,...change};
   await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
   await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
   await click(c,'#toBasis');await click(c,'#operationalStatus summary');await click(c,'#statusRefresh');
   await waitFor(c,`document.getElementById('operationalStatus').dataset.state===${JSON.stringify(expected)}`);
   assert.doesNotMatch(await c.evaluate("document.getElementById('statusSummary').textContent"),/入口可达/);
  }
  await Promise.all(pending);
 }finally{await b.close();}
}));

test('late server status cannot overwrite a deliberate switch to offline reading',()=>withService(async base=>{
 const b=await launchBrowser(edge),c=b.cdp;let paused;
 c.onEvent(m=>{if(m.method==='Fetch.requestPaused')paused=m.params.requestId;});
 try{
  await c.send('Page.enable');await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*/api/status',requestStage:'Request'}]});
  await click(c,'#toBasis');await click(c,'#operationalStatus summary');await click(c,'#statusRefresh');
  for(let n=0;n<100&&!paused;n++)await new Promise(r=>setTimeout(r,20));assert.ok(paused);
  await click(c,'#serverModeToggle');
  assert.equal(await c.evaluate("document.getElementById('operationalStatus').dataset.state"),'unknown');
  const original=await(await fetch(base+'/api/status')).json();
  await c.send('Fetch.fulfillRequest',{requestId:paused,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(original)).toString('base64')}).catch(()=>{});
  await click(c,'#statusRefresh');
  assert.equal(await c.evaluate("document.getElementById('operationalStatus').dataset.state"),'offline');
  assert.match(await c.evaluate("document.getElementById('statusSummary').textContent"),/离线地图可用/);
  assert.equal(await c.evaluate("document.getElementById('statusLayers').childElementCount"),0);
 }finally{await b.close();}
}));

test('file based offline page does not infer service readiness from bundled dates',async()=>{
 const b=await launchBrowser(edge),c=b.cdp;
 try{
  await c.send('Page.enable');await c.send('Page.navigate',{url:pathToFileURL(resolve('frontend/prototype/prototype-fishing.html')).href});
  await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
  await click(c,'#toBasis');await click(c,'#operationalStatus summary');await click(c,'#statusRefresh');
  assert.equal(await c.evaluate("document.getElementById('operationalStatus').dataset.state"),'offline');
 }finally{await b.close();}
});

test('operator probe separates actual loopback service from a failing proxy hop without publishing addresses',()=>withService(async base=>{
 const proxy=createServer(async(req,res)=>{
  if(req.url==='/api/status'){res.writeHead(503);res.end('PRIVATE_PROXY_LOG');return;}
  const upstream=await fetch(base+req.url);res.writeHead(upstream.status,{'Content-Type':'application/json'});res.end(await upstream.text());
 });
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 const entry='http://127.0.0.1:'+proxy.address().port;
 try{
  const result=await execute(process.env.OCEAN_EXPERIMENT_PYTHON||'python',['tools/sample-operational-status.py','--direct',base,'--entry',entry],{windowsHide:true,timeout:20000});
  const report=JSON.parse(result.stdout);
  assert.equal(report.paths.direct.health.state,'responding');
  assert.equal(report.paths.direct.status.state,'sampled');
  assert.equal(report.paths.direct.status.layers.map_index,'registered');
  assert.equal(report.paths.entry.health.state,'responding');
  assert.equal(report.paths.entry.status.state,'http_error');
  assert.equal(report.paths.entry.status.http_status,503);
  assert.equal(report.paths.browser.state,'not_connected');
  assert.doesNotMatch(result.stdout,/127\.0\.0\.1|PRIVATE_PROXY|localhost|raw_data_dir/);
  assert.ok(result.stdout.length<16384);
 }finally{await new Promise(r=>proxy.close(r));}
}));
