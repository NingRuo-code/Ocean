import assert from "node:assert/strict";
import {resolve,dirname,basename,join} from "node:path";
import {spawn} from "node:child_process";
import {mkdtemp,mkdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {setTimeout as delay} from "node:timers/promises";

// Actual production app on isolated loopback; no test-only business service.
export async function withService(work,{collectRuntimeInventory=false,caseOwnerToken="",enableCaseStore=false,publishedFixtureText=null}={}) {
  const root=await mkdtemp(join(tmpdir(),"ocean-month-service-"));
  await mkdir(join(root,"raw"));await mkdir(join(root,"cache"));
  if(publishedFixtureText!==null)await writeFile(join(root,"published.json"),publishedFixtureText,"utf8");
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
from app.main import app
${inventoryCode}
app.mount('/',StaticFiles(directory=os.environ['OCEAN_TEST_FRONTEND']))
s=socket.socket();s.bind(('127.0.0.1',0));s.listen(128)
runtime={'version':platform.python_version(),'implementation':platform.python_implementation(),'workers':1}
${collectRuntimeInventory?"runtime['installed_distributions']=installed_distributions()":''}
print(json.dumps({'port':s.getsockname()[1],'runtime':runtime}),flush=True)
uvicorn.Server(uvicorn.Config(app,log_level='error')).run(sockets=[s])`;
  const inherited=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('OCEAN_')));
  const child=spawn(process.env.OCEAN_EXPERIMENT_PYTHON || "python",["-c",code],{cwd:resolve("backend"),windowsHide:true,
    env:{...inherited,OCEAN_TEST_FRONTEND:resolve("frontend/prototype"),OCEAN_PROTOTYPE_DATA_DIR:resolve("frontend/prototype/data"),OCEAN_API_PREFIX:'/api',OCEAN_AI_PROVIDER:"rules",OCEAN_MONTHLY_EXECUTION_TOKEN:caseOwnerToken,...(publishedFixtureText===null?{}:{OCEAN_TEST_PUBLISHED:join(root,"published.json")}),...(enableCaseStore?{OCEAN_CASE_STORE_PATH:join(root,"cases.sqlite3")}:{}),OCEAN_RAW_DATA_DIR:join(root,"raw"),OCEAN_CACHE_DIR:join(root,"cache")},stdio:["ignore","pipe","pipe"]});
  let output="",port,runtime,startError=null;
  child.on('error',()=>{startError=true;});
  child.stdout.on("data",b=>{output+=b.toString();try{const info=JSON.parse(output.split("\n")[0]);port=info.port;runtime=info.runtime;}catch{}});
  child.stderr.resume();
  try {
    for(let n=0;n<150&&!port;n++){if(startError||child.exitCode!==null)throw Error("Actual API did not start");await delay(50);}
    assert.ok(port,"Actual API listening port");const base=`http://127.0.0.1:${port}`;
    for(let n=0;n<100;n++){try{if((await fetch(base+"/api/health")).ok)break;}catch{}await delay(50);}
    await work(base,{runtime});
  }finally{child.kill();await Promise.race([new Promise(r=>child.once("exit",r)),delay(2000)]);
    if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-month-service-"))await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
}
