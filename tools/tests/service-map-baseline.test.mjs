import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir,copyFile,appendFile,symlink,link} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';

const execute=promisify(execFile);
test('baseline rejects credential-confused remote pages and conflicting original-service claims',async()=>{
 for(const args of [
  ['--page','http://127.0.0.1:80@example.invalid/'],
  ['--page','file://remote.invalid/share/page.html'],
  ['--isolated-service','--sample-kind','controlled-fixture'],
 ]){
  const result=await execute(process.execPath,['tools/benchmark-map.mjs',...args],{windowsHide:true,timeout:5000}).catch(error=>error);
  assert.equal(result.code,1);
  assert.match(result.stderr,/Baseline requires|cannot override page or claim a fixture/);
 }
});
test('existing baseline CLI records real original-app missing-day failure with explicit caches and no fabricated B1 claim',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),out=join(root,'report.json');
 try{
  const foreign=join(root,'PRIVATE-foreign-data');await mkdir(foreign);
  // This asserts the real missing-day state, not a latency target under parallel tests.
  const execution=await execute(process.execPath,['tools/benchmark-map.mjs','--isolated-service','--runs','1','--timeout-ms','5000','--out',out],{windowsHide:true,timeout:45000,env:{...process.env,OCEAN_PROTOTYPE_DATA_DIR:foreign,OCEAN_API_PREFIX:'/PRIVATE_API',OCEAN_AI_PROVIDER:'local',OCEAN_MONTHLY_EXECUTION_TOKEN:'PRIVATE_TOKEN'}}).catch(error=>error);
  assert.equal(execution.code,1,'Missing raw sources must not become successful observations');
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.service.kind,'isolated_original_app');
  assert.equal(report.service.status.layers.fishing_effort,'not_connected');
  assert.equal(report.service.status.layers.p0_qualification,'not_connected');
  assert.equal(report.service.status.layers.map_index,'registered','Must bind actual API input to the frozen workspace exports');
  assert.equal(report.service.status.layers.models,'rules_only');
  assert.equal(report.service.release,null);
  assert.ok(/^\d+\.\d+\.\d+$/.test(report.service.runtime.version));
  assert.match(report.artifact_hashes['frontend/prototype/prototype-effort.js'],/^[a-f0-9]{64}$/);
  assert.match(report.artifact_hashes['backend/app/main.py'],/^[a-f0-9]{64}$/);
  assert.equal(report.artifact_integrity,'unchanged');
  assert.equal(report.environment.cache_layers.service,'empty at start; shared across all browser runs');
  assert.equal(report.attempts.length,5);
  assert.ok(report.attempts.every(a=>a.status!=='success'&&a.elapsed_ms===null&&a.after_action_ms===null));
  const navigation=report.attempts[0];
  assert.ok(navigation.requests.some(r=>r.role==='health'&&r.status===200));
  assert.ok(navigation.requests.every(r=>r.method==='GET'));
  assert.ok(navigation.requests.some(r=>r.role==='day'&&r.status===404));
  assert.equal(navigation.failure_reason,'day-missing');
  assert.equal(navigation.last_observed.server_enabled,true);
  assert.equal(report.sample_kind,'B0-current');
  assert.equal(report.b1_qualified,false);
  assert.equal(report.targets_verified,false);
  assert.equal(report.summary.navigation.p95_ms,null);
  assert.equal(report.summary.navigation.p50_ms,null);
  assert.doesNotMatch(JSON.stringify(report),/127\.0\.0\.1|AppData|VscodeProject|localhost:/);
 }finally{
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('managed benchmark measures the real day API with an explicitly staged NetCDF sample',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-'));
 const raw=join(root,'PRIVATE-sample-root'),out=join(root,'report.json');
 const relativeName='front/2024/front_location20240805.nc';
 const sample=join(raw,relativeName);
 try{
  await mkdir(dirname(sample),{recursive:true});
  await execute(process.env.OCEAN_EXPERIMENT_PYTHON||'python',['-c',`
import sys
import numpy as np
import xarray as xr
xr.Dataset(
    {"front": (("lat", "lon", "time"), np.full((3, 3, 1), 10, dtype="int8"))},
    coords={"lat": [29.95, 30, 30.05], "lon": [124, 124.05, 124.1],
            "time": [np.datetime64("2024-08-05")]},
).to_netcdf(sys.argv[1], engine="scipy")
`,sample],{windowsHide:true,timeout:20000});
  await mkdir(join(raw,'fishing-source'));
  await writeFile(join(raw,'fishing-source','PRIVATE-unused.csv'),'unrelated');
  const bytes=await readFile(sample);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const execution=await execute(process.execPath,[
   resolve('tools/benchmark-map.mjs'),'--isolated-service','--sample-root',raw,
   '--runs','1','--timeout-ms','2500','--out',out,
  ],{cwd:root,windowsHide:true,timeout:35000}).catch(error=>error);
  const report=await readFile(out,'utf8').then(JSON.parse).catch(()=>{
   assert.fail(execution.stderr||'Managed benchmark did not write its report');
  });
  assert.deepEqual(report.input,{
   kind:'explicit_local_netcdf',
   files:{front:1,sst:0},bytes:bytes.length,
   snapshot_id:'sha256:'+createHash('sha256').update(JSON.stringify([
    {name:relativeName,bytes:bytes.length,sha256},
   ])).digest('hex'),
  });
  assert.equal(report.service.kind,'isolated_original_app');
  const exporter='backend/scripts/export_prototype_data.py';
  assert.equal(report.artifact_hashes[exporter],createHash('sha256').update(await readFile(exporter)).digest('hex'));
  assert.ok(report.attempts[0].requests.some(request=>request.role==='day'&&request.status===200));
  assert.deepEqual(await readFile(sample),bytes);
  assert.equal(report.b1_qualified,false);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE-sample-root|PRIVATE-unused|front_location/);
 }finally{
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('explicit benchmark samples reject linked source folders and report writes in the sample root',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-'));
 try{
  const raw=join(root,'PRIVATE-raw'),outside=join(root,'PRIVATE-outside');
  const plain=join(root,'plain-raw');
  await mkdir(join(raw,'front'),{recursive:true});
  await mkdir(outside);
  await writeFile(join(outside,'front_location20240805.nc'),'must not be staged through a link');
  await symlink(outside,join(raw,'front','2024'),process.platform==='win32'?'junction':'dir');
  await mkdir(join(plain,'front','2024'),{recursive:true});
  const plainSample=join(plain,'front','2024','front_location20240805.nc');
  await writeFile(plainSample,'isolated input');
  const outsideReport=join(root,'report.json');
  const insideReport=join(plain,'PRIVATE-report.json');
  const linkedReport=join(root,'linked-report.json');
  await link(plainSample,linkedReport);
  for(const [options,input,out] of [
   [['--isolated-service'],raw,outsideReport],
   [['--isolated-service'],plain,insideReport],
   [['--isolated-service'],plain,linkedReport],
   [[],plain,outsideReport],
  ]){
   const result=await execute(process.execPath,[
    'tools/benchmark-map.mjs',...options,'--sample-root',input,'--runs','1','--out',out,
   ],{windowsHide:true,timeout:15000,env:{...process.env,EDGE:join(root,'unused-browser')}}).catch(error=>error);
   assert.equal(result.code,1);
   assert.match(result.stderr,/Invalid or unavailable NetCDF benchmark samples|Local samples require --isolated-service/);
   assert.doesNotMatch(result.stderr,/PRIVATE-raw|PRIVATE-outside|PRIVATE-report/);
  }
  await assert.rejects(readFile(outsideReport),{code:'ENOENT'});
  await assert.rejects(readFile(insideReport),{code:'ENOENT'});
  assert.equal(await readFile(plainSample,'utf8'),'isolated input');
  assert.equal(await readFile(linkedReport,'utf8'),'isolated input');
 }finally{
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('service startup and runtime configuration failures are safe reports without raw errors',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-'));
 try{
  for(const [name,env] of [
   ['spawn',{OCEAN_EXPERIMENT_PYTHON:join(root,'PRIVATE-MISSING-python.exe')}],
   ['python-init',{PYTHONHOME:join(root,'PRIVATE-PYTHONHOME')}],
  ]){
   const out=join(root,name+'.json');
   const result=await execute(process.execPath,['tools/benchmark-map.mjs','--isolated-service','--runs','1','--out',out],{windowsHide:true,timeout:25000,env:{...process.env,...env}}).catch(error=>error);
   assert.equal(result.code,1);
   assert.doesNotMatch(result.stderr,/PRIVATE|AppData|Traceback|Fatal Python/);
   const report=JSON.parse(await readFile(out,'utf8'));
   assert.equal(report.service.reason,'service_startup_failed');
   assert.ok(report.attempts.every(a=>a.failure_phase==='service_startup'&&!a.action_attempted&&a.elapsed_ms===null));
   assert.doesNotMatch(JSON.stringify(report),/PRIVATE|AppData|Traceback|Fatal Python/);
  }
 }finally{if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});}
});

test('managed benchmark waits for a slow original-app startup before recording browser attempts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),out=join(root,'report.json');
 try{
  await writeFile(join(root,'sitecustomize.py'),'import time\ntime.sleep(8.25)\n');
  const execution=await execute(process.execPath,[
   'tools/benchmark-map.mjs','--isolated-service','--runs','1','--timeout-ms','1500','--out',out,
  ],{windowsHide:true,timeout:55000,env:{...process.env,PYTHONPATH:root}}).catch(error=>error);
  assert.equal(execution.code,1);
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.service.status?.layers.process,'responding');
  assert.ok(report.attempts[0].action_attempted);
  assert.ok(report.attempts[0].requests.some(request=>request.role==='health'&&request.status===200));
  assert.equal(report.attempts[0].elapsed_ms,null);
 }finally{
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('original-service baseline identifies installed package versions without recording installation paths or direct URLs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),out=join(root,'report.json');
 try{
  const metadata=join(root,'ocean_baseline_inventory_probe-1.2.3.dist-info');await mkdir(metadata);
  await writeFile(join(metadata,'METADATA'),'Metadata-Version: 2.1\nName: ocean-baseline-inventory-probe\nVersion: 1.2.3\n');
  await writeFile(join(metadata,'direct_url.json'),JSON.stringify({url:'https://PRIVATE_TOKEN@example.invalid/private'}));
  const execution=await execute(process.execPath,['tools/benchmark-map.mjs','--isolated-service','--runs','1','--timeout-ms','200','--out',out],{
   windowsHide:true,timeout:30000,env:{...process.env,PYTHONPATH:root}
  }).catch(error=>error);
  assert.equal(execution.code,1,'No raw input was provided');
  const report=JSON.parse(await readFile(out,'utf8')),inventory=report.service.runtime.installed_distributions;
  assert.ok(['recorded','ambiguous'].includes(inventory.status),'Visible duplicate registrations must remain explicit');
  assert.match(inventory.snapshot_id,/^sha256:[a-f0-9]{64}$/);
  assert.ok(inventory.packages.some(p=>p.name==='ocean-baseline-inventory-probe'&&p.version==='1.2.3'));
  assert.ok(inventory.packages.some(p=>p.name==='fastapi'));
  assert.ok(inventory.packages.some(p=>p.name==='uvicorn'));
  assert.equal(inventory.packages.filter(p=>p.name==='ocean-baseline-inventory-probe').length,1);
  assert.equal(inventory.packages.length,inventory.count);
  assert.doesNotMatch(JSON.stringify(inventory),/PRIVATE_TOKEN|example\.invalid|AppData|ocean-service-baseline-|direct_url/);
  assert.equal(report.b1_qualified,false);
 }finally{if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});}
});

test('duplicate normalized package names remain ambiguous with both versions retained',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),out=join(root,'report.json');
 try{
  for(const [dir,name,version] of [['probe_a','Ocean_Baseline_Probe','1.2.3'],['probe_b','ocean-baseline-probe','2.0.0']]){
   const metadata=join(root,dir+'.dist-info');await mkdir(metadata);
   await writeFile(join(metadata,'METADATA'),`Metadata-Version: 2.1\nName: ${name}\nVersion: ${version}\n`);
  }
  await execute(process.execPath,['tools/benchmark-map.mjs','--isolated-service','--runs','1','--timeout-ms','200','--out',out],{
   windowsHide:true,timeout:30000,env:{...process.env,PYTHONPATH:root}
  }).catch(()=>{});
  const report=JSON.parse(await readFile(out,'utf8')),inventory=report.service.runtime.installed_distributions;
  assert.equal(inventory.status,'ambiguous');
  assert.ok(inventory.duplicate_names.includes('ocean-baseline-probe'));
  assert.deepEqual(inventory.packages.filter(p=>p.name==='ocean-baseline-probe'),[
   {name:'ocean-baseline-probe',version:'1.2.3'},{name:'ocean-baseline-probe',version:'2.0.0'}
  ]);
  assert.equal(report.targets_verified,false);
 }finally{if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});}
});

test('unreadable package declarations produce an explicit unavailable inventory without leaking metadata',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),out=join(root,'report.json');
 try{
  const metadata=join(root,'probe.dist-info');await mkdir(metadata);
  await writeFile(join(metadata,'METADATA'),'Metadata-Version: 2.1\nName: ocean-baseline-probe\nVersion: https://PRIVATE_SENTINEL@example.invalid/path\n');
  const execution=await execute(process.execPath,['tools/benchmark-map.mjs','--isolated-service','--runs','1','--timeout-ms','200','--out',out],{
   windowsHide:true,timeout:30000,env:{...process.env,PYTHONPATH:root}
  }).catch(error=>error);
  assert.equal(execution.code,1);
  const report=JSON.parse(await readFile(out,'utf8')),inventory=report.service.runtime.installed_distributions;
  assert.equal(inventory.status,'unavailable');
  assert.equal(inventory.reason,'runtime_inventory_unavailable');
  assert.equal(inventory.packages,null);
  assert.equal(inventory.count,null);
  assert.equal(inventory.snapshot_id,null);
  assert.equal(inventory.duplicate_names,null);
  assert.equal(report.service.status.layers.map_index,'registered','Inventory failure must not become service-startup failure');
  assert.doesNotMatch(JSON.stringify(report)+execution.stderr,/PRIVATE_SENTINEL|example\.invalid\/path/);
 }finally{if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});}
});

test('browser runtime exceptions invalidate both total and after-action success timings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),page=join(root,'error.html'),out=join(root,'report.json');
 try{
  await writeFile(page,`<input id="timeDate" value="2024-08-05"><button id="dateNext">next</button><svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready" data-view-key="first"></svg><script>const m=document.getElementById('mapSvg');document.getElementById('dateNext').onclick=()=>{document.getElementById('timeDate').value='2024-08-06';m.dataset.renderDate='2024-08-06'};m.onwheel=()=>m.dataset.viewKey='zoom';m.onpointerup=()=>m.dataset.viewKey='drag';throw Error('PRIVATE_CONTROLLED_BROWSER_ERROR');</script>`);
  const result=await execute(process.execPath,['tools/benchmark-map.mjs','--page',pathToFileURL(page).href,'--sample-kind','controlled-fixture','--runs','1','--timeout-ms','1500','--out',out],{windowsHide:true,timeout:15000}).catch(error=>error);
  assert.equal(result.code,1);
  const report=JSON.parse(await readFile(out,'utf8'));
  const bad=report.attempts.filter(a=>a.browser_errors.length);
  assert.ok(bad.length>0);
  assert.ok(bad.every(a=>a.status==='failure'&&a.elapsed_ms===null&&a.after_action_ms===null));
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_CONTROLLED/);
 }finally{if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});}
});

test('a browser exception after partial paint invalidates that attempt’s partial timing', async () => {
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-'));
 const page=join(root,'partial-then-error.html'),out=join(root,'report.json');
 try {
  await writeFile(page,`<input id="timeDate" value="2024-08-05"><button id="dateNext">next</button>
   <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="partial"
     data-view-key='["2024-08-05",124.5,30.2,1,"plane"]'></svg>
   <script>
     window.OFData={serverEnabled:()=>true,viewportReady:()=>false,
       viewportState:()=>({status:"partial",usable:true})};
     setTimeout(()=>{throw Error("PRIVATE_PARTIAL_ERROR")},520);
   </script>`);
  const execution=await execute(process.execPath,[
   'tools/benchmark-map.mjs','--page',pathToFileURL(page).href,'--sample-kind','controlled-fixture',
   '--runs','1','--timeout-ms','1600','--out',out,
  ],{windowsHide:true,timeout:30000}).catch(error=>error);
  assert.equal(execution.code,1);
  const report=JSON.parse(await readFile(out,'utf8'));
  const navigation=report.attempts.find(a=>a.scenario==='navigation');
  assert.equal(navigation.last_observed?.viewport_partial_usable,true);
  assert.ok(navigation.browser_errors.includes('browser_exception'));
  assert.equal(navigation.first_partial_paint_ms,null);
  assert.equal(navigation.failure_reason,'browser_exception');
  assert.equal(report.summary.navigation.partial_paint_observations,0);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_PARTIAL_ERROR/);
 } finally {
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('navigation and reload cannot count a different ready map as the requested entry page', async () => {
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-'));
 const out=join(root,'report.json');
 const server=createServer((req,res)=>{
  if(req.url==='/entry.html'){
   res.writeHead(302,{Location:'/redirected.html'}).end();
   return;
  }
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(
   '<input id="timeDate" value="2024-08-05"><button id="dateNext">next</button>'+
   '<svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready"></svg>');
 });
 try {
  await new Promise((done,fail)=>server.once('error',fail).listen(0,'127.0.0.1',done));
  const url='http://127.0.0.1:'+server.address().port+'/entry.html';
  const execution=await execute(process.execPath,[
   'tools/benchmark-map.mjs','--page',url,'--sample-kind','controlled-fixture',
   '--runs','1','--timeout-ms','1000','--out',out,
  ],{windowsHide:true,timeout:25000}).catch(error=>error);
  assert.equal(execution.code,1);
  const report=JSON.parse(await readFile(out,'utf8'));
  for(const scenario of ['navigation','reload']){
   const attempt=report.attempts.find(a=>a.scenario===scenario);
   assert.equal(attempt.last_observed?.status,'ready');
   assert.equal(attempt.elapsed_ms,null);
   assert.equal(attempt.first_partial_paint_ms,null);
   assert.equal(report.summary[scenario].success,0);
  }
  assert.doesNotMatch(JSON.stringify(report),/127\.0\.0\.1|redirected\.html/);
 } finally {
  server.closeAllConnections();
  await new Promise(done=>server.close(done));
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('a tracked browser driver change cannot be reported as clean committed code',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),fixture=join(root,'source'),out=join(root,'report.json');
 try{
  for(const name of ['tools/benchmark-map.mjs','tools/lib/monthly-test-service.mjs','tools/lib/browser-driver.mjs']){
   await mkdir(dirname(join(fixture,name)),{recursive:true});await copyFile(name,join(fixture,name));
  }
  await mkdir(join(fixture,'frontend/prototype'),{recursive:true});
  await writeFile(join(fixture,'frontend/prototype/prototype-fishing.html'),`<input id="timeDate" value="2024-08-05"><button id="dateNext">next</button><svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready" data-view-key='["2024-08-05",124.5,30.2,1,"flat"]'></svg><script>const m=document.getElementById('mapSvg');document.getElementById('dateNext').onclick=()=>{document.getElementById('timeDate').value='2024-08-06';m.dataset.renderDate='2024-08-06';m.dataset.viewKey=JSON.stringify(['2024-08-06',124.5,30.2,1,'flat'])};m.onwheel=()=>m.dataset.viewKey='zoom';m.onpointerup=()=>m.dataset.viewKey='drag';</script>`);
  const git=async args=>execute('git',['-c','safe.directory='+fixture,...args],{cwd:fixture,windowsHide:true});
  await git(['init','-q','-b','codex/identity-fixture']);await git(['add','.']);
  await git(['-c','user.name=BaselineCheck','-c','user.email=check@example.invalid','commit','-qm','Self-authored timing fixture']);
  await appendFile(join(fixture,'tools/lib/browser-driver.mjs'),'\n// self-authored tracked change\n');
  const run=await execute(process.execPath,[join(fixture,'tools/benchmark-map.mjs'),'--runs','1','--timeout-ms','1000','--out',out],{cwd:fixture,windowsHide:true,timeout:15000}).catch(error=>error);
  assert.equal(run.code,1,'The fixture deliberately does not implement the camera gestures');
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.tracked_changes_present,true);
  assert.equal(report.artifact_integrity,'unchanged');
 }finally{if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});}
});

test('entry source changed during a run invalidates successes before quantiles are calculated',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),page=join(root,'entry.html'),out=join(root,'report.json');
 let changed=false,server;
 try{
  server=createServer(async(req,res)=>{await writeFile(page,html+'<!-- changed source -->');changed=true;res.writeHead(204);res.end();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const html=`<input id="timeDate" value="2024-08-05"><button id="dateNext">next</button>
   <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready" data-view-key="first"></svg>
   <script>const m=document.getElementById('mapSvg');document.getElementById('dateNext').onclick=()=>{document.getElementById('timeDate').value='2024-08-06';m.dataset.renderDate='2024-08-06'};m.onwheel=()=>m.dataset.viewKey='zoom';m.onpointerup=()=>m.dataset.viewKey='drag';fetch('http://127.0.0.1:${server.address().port}/marker').catch(()=>{});</script>`;
  await writeFile(page,html);
  const result=await execute(process.execPath,['tools/benchmark-map.mjs','--page',pathToFileURL(page).href,'--sample-kind','controlled-fixture','--runs','1','--timeout-ms','2500','--out',out],{windowsHide:true,timeout:25000}).catch(error=>error);
  assert.ok(changed);
  assert.equal(result.code,1);
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.artifact_integrity,'changed');
  assert.equal(report.summary.navigation.success,0);
  assert.equal(report.summary.navigation.p50_ms,null);
  assert.ok(report.attempts.some(a=>a.failure_reason==='artifact_changed'));
 }finally{
  if(server)await new Promise(r=>server.close(r));
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});

test('browser startup failure retains all planned attempts with unknown timings and no private error text',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-service-baseline-')),out=join(root,'failed.json');
 try{
  const result=await execute(process.execPath,['tools/benchmark-map.mjs','--runs','1','--out',out],{
   windowsHide:true,timeout:15000,env:{...process.env,EDGE:join(root,'PRIVATE-MISSING-browser.exe')}
  }).catch(error=>error);
  assert.equal(result.code,1);
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.attempts.length,5);
  assert.ok(report.attempts.every(a=>a.status==='failure'&&a.failure_phase==='browser_startup'&&a.elapsed_ms===null));
  assert.equal(report.summary.navigation.failure,1);
  assert.equal(report.summary.navigation.p50_ms,null);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE-MISSING|AppData|browser\.exe|ocean-service-baseline-/);
 }finally{
  if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith('ocean-service-baseline-'))await rm(root,{recursive:true,force:true});
 }
});
