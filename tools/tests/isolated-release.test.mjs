import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm,readdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {launchBrowser,waitFor} from '../lib/browser-driver.mjs';

const python=process.env.OCEAN_EXPERIMENT_PYTHON||'python',script=resolve('deploy/release.py');
function command(args,options={}){
 const r=spawnSync(python,[script,...args],{encoding:'utf8',windowsHide:true,timeout:180000,...options});
 assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout);
}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-')),repo=join(root,'source');await mkdir(repo);
 const listed=spawnSync('git',['-c','safe.directory='+resolve('.'),'ls-files','-z','backend/app','backend/pyproject.toml','frontend/prototype'],{encoding:'utf8'}).stdout.split('\0').filter(Boolean);
 for(const file of [...listed,'backend/scripts/export_prototype_data.py','deploy/release.py','deploy/release-allowlist.json','deploy/examples/no-front-response.js']){
  await mkdir(dirname(join(repo,file)),{recursive:true});
  try{await copyFile(file,join(repo,file));}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 const git=args=>{const r=spawnSync('git',['-c','safe.directory='+repo,...args],{cwd:repo,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 git(['init','-q']);git(['add','.']);git(['-c','user.name=ReleaseCheck','-c','user.email=check@example.invalid','commit','-qm','Self-authored isolated release software check']);
 return {root,repo,commit:git(['rev-parse','HEAD']),async close(){if(process.env.OCEAN_KEEP_RELEASE_CHECK){console.error('Retained isolated diagnostic fixture: '+root);return;}if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}};
}

async function click(c,selector){const p=await c.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}

test('fixed release starts original API from an independently installed no-Git package',async(t)=>{
 const f=await fixture();let child;
 try{
  const bundle=join(f.root,'release.zip'),isolation=join(f.root,'isolated');
  await writeFile(join(f.repo,'.env'),'SELF_AUTHORED_UNAPPROVED_SECRET');
  await writeFile(join(f.repo,'frontend/prototype/prototype-fishing.html'),'UNAPPROVED_WORKTREE');
  const built=command(['build','--repo',f.repo,'--commit',f.commit,'--out',bundle]);
  const members=spawnSync(python,['-c',"import zipfile,sys,json;print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))",bundle],{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(members.status,0,members.stderr);
  for(const name of ['real-effort-input.json','fixture-effort-sample.json'])assert.equal(JSON.parse(members.stdout).includes('frontend/prototype/data/front_response/'+name),false);
  command(['init','--root',isolation]);
  const installed=command(['install','--bundle',bundle,'--expected',built.bundle_sha256,'--commit',f.commit,'--root',isolation]);
  child=spawn(installed.python,['-I','-S','-B',join(installed.path,'deploy/release.py'),'serve','--release',installed.path,'--expected',built.release_id],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,OCEAN_AI_PROVIDER:'local',OCEAN_MONTHLY_EXECUTION_TOKEN:'untrusted-parent-token'}});
  let output='',errors='',base;child.stdout.on('data',b=>{output+=b;try{base=JSON.parse(output.split('\n')[0]).base;}catch{}});child.stderr.on('data',b=>errors+=b);
  for(let n=0;n<2400&&!base;n++){if(child.exitCode!==null)throw Error(errors);await delay(50);}assert.ok(base,errors);
  for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await delay(50);}
  const identity=await(await fetch(base+'/api/release')).json();assert.equal(identity.source_commit,f.commit);assert.equal(identity.release_id,built.release_id);assert.equal(identity.profile,'isolated-read-only/v1');
  const q='reference_date=2024-08-05&longitude=124.5&latitude=30.2&radius_km=20';
  const page=await(await fetch(base+'/api/query/known-cases?'+q)).json();assert.equal(page.total,4);
  const response=await fetch(base+'/api/query/known-cases/case-2024-06?'+q+'&library_version='+encodeURIComponent(page.library_version));
  assert.equal(response.headers.get('X-Ocean-Release'),built.release_id);const result=await response.json();assert.equal(result.original.metrics.total_hours,10);assert.equal(result.original.metrics.area_time_km2_days,2);
  const zero=await(await fetch(base+'/api/query/known-cases/case-2023-08?'+q+'&library_version='+encodeURIComponent(page.library_version))).json();assert.equal(zero.original.metrics.total_hours,0);
  const later=q.replace('2024-08-05','2025-01-01'),laterPage=await(await fetch(base+'/api/query/known-cases?'+later)).json();
  const unknown=await(await fetch(base+'/api/query/known-cases/case-2024-12?'+later+'&library_version='+encodeURIComponent(laterPage.library_version))).json();assert.equal(unknown.original.metrics.total_hours,null);assert.equal(unknown.original.metrics.density_hours_per_km2_day,null);
  const viewport=await(await fetch(base+'/api/viewport?date=2024-08-05&bbox=120,30,121,31&step=4')).json();assert.equal(viewport.coverage.layers.fishingEffort,'unavailable');assert.equal(viewport.layers.fishingEffort.unit,'fishing_hours');
  assert.equal((await fetch(base+'/api/ai/analyze',{method:'POST',body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/data/index/rebuild',{method:'POST'})).status,403);
  assert.equal((await fetch(base+'/data/front_response/events.js')).status,200);assert.match(await(await fetch(base+'/data/front_response/events.js')).text(),/= null;/);
  const config=await readFile(join(installed.path,'venv','pyvenv.cfg'),'utf8');assert.match(config,/include-system-site-packages = false/);
  assert.equal((await fetch(base+'/.git/config')).status,404);
  for(const name of ['real-effort-input.json','fixture-effort-sample.json'])assert.equal((await fetch(base+'/data/front_response/'+name)).status,404);
  assert.doesNotMatch(await(await fetch(base+'/prototype-fishing.html')).text(),/UNAPPROVED_WORKTREE/);
  await t.test('static ingress never serves files absent from the approved asset manifest',async()=>{
   const extra=join(installed.path,'frontend/prototype/private-note.txt');
   try{await writeFile(extra,'SELF_AUTHORED_PRIVATE_COUNTEREXAMPLE');const response=await fetch(base+'/private-note.txt');await response.text();assert.equal(response.status,404);}
   finally{for(let n=0;n<10;n++){try{await rm(extra,{force:true});break;}catch(e){if(!['EBUSY','EPERM'].includes(e.code)||n===9)throw e;await delay(100);}}}
  });
  await t.test('wrong bundle or source identity cannot alter the installed running version',async()=>{
   const before=await readdir(join(isolation,'versions'));
   for(const [hash,commit,reason] of [['sha256:'+'0'.repeat(64),f.commit,'bundle_integrity_failed'],[built.bundle_sha256,'0'.repeat(40),'source_commit_mismatch']]){
    const r=spawnSync(python,[script,'install','--bundle',bundle,'--expected',hash,'--commit',commit,'--root',isolation],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(r.status,1);assert.equal(JSON.parse(r.stderr).error,reason);
   }
   assert.deepEqual(await readdir(join(isolation,'versions')),before);assert.equal((await(await fetch(base+'/api/release')).json()).release_id,built.release_id);
  });
  await t.test('actual browser reads original A, preserves map conditions and can switch to offline map operation',async()=>{
   const browser=await launchBrowser(process.env.EDGE??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'),c=browser.cdp,requests=[];
   c.onEvent(m=>{if(m.method==='Network.requestWillBeSent')requests.push(m.params.request);});
   try{
    await c.send('Page.enable');await c.send('Network.enable');await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await c.send('Page.navigate',{url:base+'/prototype-fishing.html'});await waitFor(c,"document.getElementById('preferenceStatus')?.getAttribute('aria-busy')==='false'");
    const before=await c.evaluate('({date:state.date,lon:state.lon,lat:state.lat,range:state.range,view:structuredClone(state.view),zoom:state.zoom})');
    const running=await c.evaluate("fetch('/api/release').then(r=>r.json())");assert.equal(running.release_id,built.release_id);
    await click(c,'#workbenchToggle');await click(c,'#knownCaseOpen');await waitFor(c,"document.getElementById('knownCasesPane').dataset.state==='ready'");
    await click(c,"#caseCandidates [data-case-id='case-2024-06']");await waitFor(c,"document.getElementById('caseHours')?.textContent==='10'");
    assert.equal(await c.evaluate("document.getElementById('caseAreaTime').textContent"),'2');
    assert.deepEqual(await c.evaluate('({date:state.date,lon:state.lon,lat:state.lat,range:state.range,view:structuredClone(state.view),zoom:state.zoom})'),before);
    await click(c,'#evidenceClose');await click(c,'#serverModeToggle');await waitFor(c,"OFData.serverMode().userMode==='offline'");
    const box=await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:500,y:350,deltaX:0,deltaY:-120});
    await waitFor(c,`document.getElementById('mapSvg').getAttribute('viewBox')!==${JSON.stringify(box)}`);
    assert.equal(await c.evaluate('window.OF_FRONT_RESPONSE'),null);assert.equal(requests.some(r=>r.method==='POST'),false);
   }finally{await browser.close();}
  });
 }finally{if(child&&child.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:15000});else child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),delay(2000)]);}await f.close();}
});

test('malformed bundle errors are bounded and preserve the existing isolation root',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-'));
 try{
  const isolation=join(root,'isolation'),bundle=join(root,'bad.zip'),bytes=Buffer.from('self-authored bad ZIP');
  command(['init','--root',isolation]);const marker=await readFile(join(isolation,'isolation.json'),'utf8');await writeFile(bundle,bytes);
  const hash='sha256:'+createHash('sha256').update(bytes).digest('hex');
  const result=spawnSync(python,[script,'install','--bundle',bundle,'--expected',hash,'--commit','a'.repeat(40),'--root',isolation],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,1);assert.equal(JSON.parse(result.stderr).error,'invalid_bundle');
  assert.equal(await readFile(join(isolation,'isolation.json'),'utf8'),marker);
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});

test('unsafe archive paths and Windows device aliases are rejected before publishing a version',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-'));
 const make=`import json,sys,hashlib,platform,zipfile
q=json.load(sys.stdin); name=q['member']; data=b'x'
canon=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
sha=lambda x:'sha256:'+hashlib.sha256(x).hexdigest()
m={'schema':'ocean-isolated-release/v1','profile':'isolated-read-only/v1','source_commit':'a'*40,'allowlist_sha256':sha(b'known'),'runtime':{'python':platform.python_version(),'implementation':sys.implementation.name,'cache_tag':sys.implementation.cache_tag,'platform':sys.platform,'machine':platform.machine()},'dependencies':{},'files':{name:{'sha256':sha(data),'bytes':1}}}
m['release_id']=sha(canon(m))
with zipfile.ZipFile(q['out'],'w') as z:z.writestr('manifest.json',canon(m));z.writestr(name,data)
print(json.dumps({'hash':sha(open(q['out'],'rb').read())}))`;
 try{
  const isolation=join(root,'isolation');command(['init','--root',isolation]);
  for(const [n,member] of ['../outside.txt','frontend/prototype/NUL.txt','frontend/prototype/dir./file.txt','runtime/aux.py','frontend/prototype/.ENV','frontend/prototype/.GiT/config'].entries()){
   const bundle=join(root,`bad-${n}.zip`),made=spawnSync(python,['-c',make],{input:JSON.stringify({member,out:bundle}),encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(made.status,0,made.stderr);
   const result=spawnSync(python,[script,'install','--bundle',bundle,'--expected',JSON.parse(made.stdout).hash,'--commit','a'.repeat(40),'--root',isolation],{encoding:'utf8',windowsHide:true,timeout:15000});
   assert.equal(result.status,1,member);assert.equal(JSON.parse(result.stderr).error,'unsafe_member',member);
   assert.deepEqual(await readdir(join(isolation,'versions')),[]);
  }
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});

test('missing declared dependencies fail fixed-source construction without publishing a package',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-')),repo=join(root,'source');
 try{
  await mkdir(join(repo,'deploy'),{recursive:true});await mkdir(join(repo,'backend'));
  await copyFile(script,join(repo,'deploy/release.py'));
  const files=['deploy/release.py','deploy/release-allowlist.json','backend/pyproject.toml'];
  await writeFile(join(repo,'deploy/release-allowlist.json'),JSON.stringify({schema:'ocean-release-allowlist/v1',files:files.map(p=>({source:p,target:p}))}));
  await writeFile(join(repo,'backend/pyproject.toml'),'[project]\nname="self-authored-release-check"\nversion="0.0.0"\ndependencies=["ocean-missing-dependency-for-release==0.0.0"]\n');
  const git=args=>{const r=spawnSync('git',['-c','safe.directory='+repo,...args],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  git(['init','-q']);git(['add','.']);git(['-c','user.name=ReleaseCheck','-c','user.email=check@example.invalid','-c','commit.gpgsign=false','commit','-qm','Known missing dependency']);
  const result=spawnSync(python,[script,'build','--repo',repo,'--commit',git(['rev-parse','HEAD']),'--out',join(root,'unpublished.zip')],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,1);assert.equal(JSON.parse(result.stderr).error,'missing_dependency');assert.equal((await readdir(root)).includes('unpublished.zip'),false);
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});

test('initialization refuses an existing target and preserves its contents',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-'));
 try{
  await writeFile(join(root,'existing.txt'),'SELF_AUTHORED_EXISTING_STATE');
  const r=spawnSync(python,[script,'init','--root',root],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stderr).error,'isolation_root_must_be_new');assert.equal(await readFile(join(root,'existing.txt'),'utf8'),'SELF_AUTHORED_EXISTING_STATE');
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});

test('fixed-source construction refuses credential-shaped material even when it is tracked',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-')),repo=join(root,'source');
 try{
  await mkdir(join(repo,'deploy'),{recursive:true});await mkdir(join(repo,'backend/app'),{recursive:true});await copyFile(script,join(repo,'deploy/release.py'));
  const files=['deploy/release.py','deploy/release-allowlist.json','backend/pyproject.toml','backend/app/not-a-real-key.py'];
  await writeFile(join(repo,'deploy/release-allowlist.json'),JSON.stringify({schema:'ocean-release-allowlist/v1',files:files.map(p=>({source:p,target:p}))}));
  await writeFile(join(repo,'backend/pyproject.toml'),'[project]\nname="self-authored-content-check"\nversion="0.0.0"\ndependencies=[]\n');
  await writeFile(join(repo,files[3]),['-----BEGIN','PRIVATE KEY-----'].join(' ')+'\nSELF_AUTHORED_COUNTEREXAMPLE_ONLY\n');
  const git=args=>{const r=spawnSync('git',['-c','safe.directory='+repo,...args],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  git(['init','-q']);git(['add','.']);git(['-c','user.name=ReleaseCheck','-c','user.email=check@example.invalid','-c','commit.gpgsign=false','commit','-qm','Self-authored content refusal check']);
  const r=spawnSync(python,[script,'build','--repo',repo,'--commit',git(['rev-parse','HEAD']),'--out',join(root,'unpublished.zip')],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stderr).error,'sensitive_source_content');assert.equal((await readdir(root)).includes('unpublished.zip'),false);
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});

test('startup refuses unregistered importable code and configuration before importing original dependencies',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-'));
 const prep=`import sys,json,hashlib,platform,os,shutil
from pathlib import Path
q=json.load(sys.stdin);r=Path(q['root']);(r/'deploy').mkdir(parents=True);(r/'backend').mkdir();(r/'frontend/prototype').mkdir(parents=True)
site=r/'venv'/('Lib/site-packages' if os.name=='nt' else f'lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages');site.mkdir(parents=True)
for p in ['raw','cache','tmp','outputs','logs']:(r/'state'/p).mkdir(parents=True)
shutil.copyfile(q['script'],r/'deploy/release.py');(r/'deploy/release-allowlist.json').write_text('{}')
sha=lambda x:'sha256:'+hashlib.sha256(x).hexdigest();canon=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
files={p:{'bytes':len((r/p).read_bytes()),'sha256':sha((r/p).read_bytes())} for p in ['deploy/release.py','deploy/release-allowlist.json']}
m={'schema':'ocean-isolated-release/v1','profile':'isolated-read-only/v1','source_commit':'a'*40,'allowlist_sha256':sha(b'{}'),'runtime':{'python':platform.python_version(),'implementation':sys.implementation.name,'cache_tag':sys.implementation.cache_tag,'platform':sys.platform,'machine':platform.machine()},'dependencies':{},'files':files};m['release_id']=sha(canon(m));(r/'manifest.json').write_bytes(canon(m))
p=site/'uvicorn.py' if q['extra']=='runtime' else r/q['extra'];p.write_text('raise RuntimeError("UNREGISTERED_IMPORTED")')
print(json.dumps({'id':m['release_id']}))`;
 try{
  for(const [n,extra] of ['backend/uvicorn.py','backend/.env','runtime'].entries()){
   const release=join(root,'case-'+n),made=spawnSync(python,['-c',prep],{input:JSON.stringify({root:release,script,extra}),encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(made.status,0,made.stderr);
   const r=spawnSync(python,['-I','-S','-B',join(release,'deploy/release.py'),'serve','--release',release,'--expected',JSON.parse(made.stdout).id],{encoding:'utf8',windowsHide:true,timeout:15000});
   assert.equal(r.status,1);assert.match(r.stderr,/"error":\s*"unregistered_installed_input"/);assert.doesNotMatch(r.stderr,/UNREGISTERED_IMPORTED/);
  }
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});

test('real directory links remain rejected when the pre-3.12 pathlib capability is absent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ocean-release-check-'));
 const launch=`import json,sys,runpy
from pathlib import Path
q=json.load(sys.stdin)
for c in Path.__mro__:
 if 'is_junction' in c.__dict__:delattr(c,'is_junction');break
sys.argv=[q['script'],'init','--root',q['target']]
runpy.run_path(q['script'],run_name='__main__')`;
 try{
  const target=join(root,'target'),alias=join(root,'alias');await mkdir(target);await symlink(target,alias,process.platform==='win32'?'junction':'dir');
  const r=spawnSync(python,['-I','-S','-c',launch],{input:JSON.stringify({script,target:join(alias,'escaped')}),encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stderr).error,'linked_target');assert.deepEqual(await readdir(target),[]);
 }finally{if(dirname(root)===tmpdir()&&basename(root).startsWith('ocean-release-check-'))await rm(root,{recursive:true,force:true,maxRetries:3});}
});
