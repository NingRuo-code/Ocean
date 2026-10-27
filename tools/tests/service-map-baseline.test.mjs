import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';

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
  const execution=await execute(process.execPath,['tools/benchmark-map.mjs','--isolated-service','--runs','1','--timeout-ms','1500','--out',out],{windowsHide:true,timeout:35000}).catch(error=>error);
  assert.equal(execution.code,1,'Missing raw sources must not become successful observations');
  const report=JSON.parse(await readFile(out,'utf8'));
  assert.equal(report.service.kind,'isolated_original_app');
  assert.equal(report.service.status.layers.fishing_effort,'not_connected');
  assert.equal(report.service.status.layers.p0_qualification,'not_connected');
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
