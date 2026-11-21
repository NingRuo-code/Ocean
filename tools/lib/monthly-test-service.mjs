import {resolve,dirname,basename,join} from "node:path";
import {execFile,spawn} from "node:child_process";
import {promisify} from "node:util";
import {once} from "node:events";
import {mkdtemp,mkdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {setTimeout as delay} from "node:timers/promises";

// Actual production app on isolated loopback; no test-only business service.
export async function withService(work, {
  collectRuntimeInventory = false,
  caseOwnerToken = "",
  enableCaseStore = false,
  publishedFixtureText = null,
  enableSyntheticRuns = false,
  syntheticRunPath = null,
  distanceFixtureText = null,
  qualifyDistanceFixture = false,
  qualifiedRunPath = null,
  holdDistanceResult = false,
  holdDistancePublication = false,
  traceDistanceProcess = false,
  prepareRaw = null,
  projectRoot = process.cwd(),
} = {}) {
  const root=await mkdtemp(join(tmpdir(),"ocean-month-service-"));
  await mkdir(join(root,"raw"));await mkdir(join(root,"cache"));
  if(publishedFixtureText!==null)await writeFile(join(root,"published.json"),publishedFixtureText,"utf8");
  const distancePath=join(root,"distance.json"), distanceSupport=join(root,"distance-support.json");
  const distanceResultReady=join(root,"distance-result-ready"), releaseDistanceResult=join(root,"release-distance-result");
  const distanceProcessStarted=join(root,"distance-process-started");
  const distanceIntentsStarted=join(root,"distance-intents-started");
  if(distanceFixtureText!==null)await writeFile(distancePath,distanceFixtureText,"utf8");
  const inventoryCode=collectRuntimeInventory?`
def installed_distributions():
    import hashlib,importlib.metadata,re,time,collections
    started=time.monotonic()
    try:
        packages=[]
        for dist in importlib.metadata.distributions():
            if len(packages)>=2048:
                raise ValueError('package_count_budget')
            name=dist.metadata.get('Name')
            version=dist.version
            if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}',name):
                raise ValueError('invalid_package_metadata')
            if not isinstance(version,str) or not re.fullmatch(r'[0-9][A-Za-z0-9.!+_-]{0,127}',version):
                raise ValueError('invalid_package_metadata')
            packages.append({'name':re.sub(r'[-_.]+','-',name).lower(),'version':version})
        packages.sort(key=lambda p:(p['name'],p['version']))
        identity=hashlib.sha256(json.dumps(packages,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        duplicate_names=sorted(name for name,count in collections.Counter(p['name'] for p in packages).items() if count>1)
        return {'status':'ambiguous' if duplicate_names else 'recorded','count':len(packages),'packages':packages,'snapshot_id':'sha256:'+identity,
                'duplicate_names':duplicate_names,'scope':'visible_distribution_metadata','sampled':'service_startup','byte_integrity_verified':False,'collection_ms':(time.monotonic()-started)*1000}
    except Exception:
        return {'status':'unavailable','reason':'runtime_inventory_unavailable','count':None,'packages':None,'snapshot_id':None,
                'duplicate_names':None,'scope':'visible_distribution_metadata','sampled':'service_startup','byte_integrity_verified':False,'collection_ms':(time.monotonic()-started)*1000}
`:'';
  const code=`import json,socket,os,uvicorn,platform
from fastapi.staticfiles import StaticFiles
import app.config as config
config.settings=config.Settings(_env_file=None)
${publishedFixtureText===null?'':`from pathlib import Path
import app.published_months as published
published.PUBLISHED_PATH=Path(os.environ['OCEAN_TEST_PUBLISHED'])`}
${holdDistanceResult || holdDistancePublication?`from pathlib import Path
from time import monotonic,sleep
def pause_distance():
    Path(os.environ["OCEAN_TEST_DISTANCE_READY"]).touch()
    release=Path(os.environ["OCEAN_TEST_DISTANCE_RELEASE"])
    deadline=monotonic()+12
    while not release.exists():
        if monotonic() >= deadline:
            raise TimeoutError("Test did not release the distance result")
        sleep(0.02)
`:''}
${holdDistanceResult?`import app.synthetic_runs as owner_runs
calculate_distance=owner_runs.calculate_distance_reference
def hold_after_calculation(*args):
    result=calculate_distance(*args)
    pause_distance()
    return result
owner_runs.calculate_distance_reference=hold_after_calculation`:''}
${holdDistancePublication?`import app.monthly_distance_process as distance_process
begin_distance_publication=distance_process.DistanceRunControl.begin_publication
def hold_at_publication(control):
    publish=begin_distance_publication(control)
    pause_distance()
    return publish
distance_process.DistanceRunControl.begin_publication=hold_at_publication`:''}
${traceDistanceProcess?`from pathlib import Path
import app.monthly_distance_process as distance_process
spawn_distance=distance_process.Popen
accept_intent=distance_process.DistanceRunControl.enable_cancellation
started_processes=0
started_intents=0
def trace_distance(*args, **kwargs):
    global started_processes
    child=spawn_distance(*args, **kwargs)
    started_processes+=1
    Path(os.environ["OCEAN_TEST_DISTANCE_PROCESS_STARTED"]).write_text(str(started_processes),encoding="ascii")
    return child
def trace_accepted_intent(control):
    global started_intents
    accept_intent(control)
    started_intents+=1
    Path(os.environ["OCEAN_TEST_DISTANCE_INTENTS_STARTED"]).write_text(str(started_intents),encoding="ascii")
distance_process.Popen=trace_distance
distance_process.DistanceRunControl.enable_cancellation=trace_accepted_intent`:''}
from app.main import app
${inventoryCode}
app.mount('/',StaticFiles(directory=os.environ['OCEAN_TEST_FRONTEND']))
s=socket.socket();s.bind(('127.0.0.1',0));s.listen(128)
runtime={'version':platform.python_version(),'implementation':platform.python_implementation(),'workers':1}
${collectRuntimeInventory?"runtime['installed_distributions']=installed_distributions()":''}
print(json.dumps({'port':s.getsockname()[1],'runtime':runtime}),flush=True)
uvicorn.Server(uvicorn.Config(app,log_level='error')).run(sockets=[s])`;
  const inherited=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('OCEAN_')));
  const distanceStorePath=qualifiedRunPath||join(root,"distance-runs.sqlite3");
  let child;
  async function stop(signal="SIGTERM"){
    if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return;
    const closed=once(child,"exit",{signal:AbortSignal.timeout(3000)});
    child.kill(signal);
    await closed;
  }
  let output="",port,runtime,startError=null;
  try {
    if(prepareRaw)await prepareRaw(join(root,"raw"));
    if(qualifyDistanceFixture){
      const fixture=JSON.parse(distanceFixtureText);
      const conditions=join(root,"distance-conditions.json"), cells=join(root,"distance-cells.json");
      await writeFile(conditions,JSON.stringify(fixture.conditions),"utf8");
      await writeFile(cells,JSON.stringify(fixture.regional_cells),"utf8");
      await promisify(execFile)(process.execPath,[
        resolve(projectRoot,"tools/audit-research-baseline.mjs"),"--support-request",conditions,
        "--regional-input",cells,"--out",distanceSupport,
      ],{timeout:30_000,windowsHide:true});
    }
    child=spawn(process.env.OCEAN_EXPERIMENT_PYTHON || "python",["-c",code],{cwd:resolve(projectRoot,"backend"),windowsHide:true,
      env:{...inherited,OCEAN_TEST_FRONTEND:resolve(projectRoot,"frontend/prototype"),OCEAN_PROTOTYPE_DATA_DIR:resolve(projectRoot,"frontend/prototype/data"),OCEAN_API_PREFIX:'/api',OCEAN_AI_PROVIDER:"rules",OCEAN_MONTHLY_EXECUTION_TOKEN:caseOwnerToken,...(publishedFixtureText===null?{}:{OCEAN_TEST_PUBLISHED:join(root,"published.json")}),...(enableCaseStore?{OCEAN_CASE_STORE_PATH:join(root,"cases.sqlite3")}:{}),...(enableSyntheticRuns?{OCEAN_SYNTHETIC_RUN_STORE_PATH:syntheticRunPath||join(root,"runs.sqlite3")}:{}),...(distanceFixtureText===null?{}:{OCEAN_MONTHLY_DISTANCE_INPUT_PATH:distancePath}),...(qualifyDistanceFixture?{OCEAN_SUPPORT_SNAPSHOT_PATH:distanceSupport,OCEAN_QUALIFIED_DISTANCE_RUN_STORE_PATH:distanceStorePath}:{}),...((holdDistanceResult||holdDistancePublication)?{OCEAN_TEST_DISTANCE_READY:distanceResultReady,OCEAN_TEST_DISTANCE_RELEASE:releaseDistanceResult}:{}),...(traceDistanceProcess?{OCEAN_TEST_DISTANCE_PROCESS_STARTED:distanceProcessStarted,OCEAN_TEST_DISTANCE_INTENTS_STARTED:distanceIntentsStarted}:{}),OCEAN_RAW_DATA_DIR:join(root,"raw"),OCEAN_CACHE_DIR:join(root,"cache")},stdio:["ignore","pipe","pipe"]});
    child.on('error',()=>{startError=true;});
    child.stdout.on("data",b=>{output+=b.toString();try{const info=JSON.parse(output.split("\n")[0]);port=info.port;runtime=info.runtime;}catch{}});
    child.stderr.resume();
    const startupDeadline = performance.now() + 45_000;
    let base;
    for (;;) {
      if (startError || child.exitCode !== null || child.signalCode !== null) {
        throw Error("Actual API did not start");
      }
      const remaining = startupDeadline - performance.now();
      if (remaining <= 0) throw Error("Actual API did not become healthy");
      if (port) {
        base = `http://127.0.0.1:${port}`;
        try {
          const health = await fetch(base+"/api/health", {
            signal: AbortSignal.timeout(Math.max(1, Math.min(1000, Math.floor(remaining)))),
          });
          await health.body?.cancel();
          if (health.ok) break;
        } catch {
          // The listener can be published before Uvicorn finishes startup.
        }
      }
      await delay(Math.min(50, remaining));
    }
    await work(base,{runtime,distancePath,distanceSupport,distanceResultReady,releaseDistanceResult,distanceStorePath,distanceProcessStarted,distanceIntentsStarted,interrupt:()=>stop('SIGKILL')});
  }finally{await stop().catch(()=>stop('SIGKILL'));
    if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-month-service-"))await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
}
