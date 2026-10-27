import assert from "node:assert/strict";
import {resolve,dirname,basename,join} from "node:path";
import {spawn} from "node:child_process";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {setTimeout as delay} from "node:timers/promises";

// Actual production app on isolated loopback; no test-only business service.
export async function withService(work) {
  const root=await mkdtemp(join(tmpdir(),"ocean-month-service-"));
  await mkdir(join(root,"raw"));await mkdir(join(root,"cache"));
  const code=`import json,socket,os,uvicorn,platform
from fastapi.staticfiles import StaticFiles
from app.main import app
app.mount('/',StaticFiles(directory=os.environ['OCEAN_TEST_FRONTEND']))
s=socket.socket();s.bind(('127.0.0.1',0));s.listen(128)
print(json.dumps({'port':s.getsockname()[1],'runtime':{'version':platform.python_version(),'implementation':platform.python_implementation(),'workers':1}}),flush=True)
uvicorn.Server(uvicorn.Config(app,log_level='error')).run(sockets=[s])`;
  const child=spawn(process.env.OCEAN_EXPERIMENT_PYTHON || "python",["-c",code],{cwd:resolve("backend"),windowsHide:true,
    env:{...process.env,OCEAN_TEST_FRONTEND:resolve("frontend/prototype"),OCEAN_AI_PROVIDER:"rules",OCEAN_MONTHLY_EXECUTION_TOKEN:"",OCEAN_RAW_DATA_DIR:join(root,"raw"),OCEAN_CACHE_DIR:join(root,"cache")},stdio:["ignore","pipe","pipe"]});
  let output="",errors="",port,runtime;
  child.stdout.on("data",b=>{output+=b.toString();try{const info=JSON.parse(output.split("\n")[0]);port=info.port;runtime=info.runtime;}catch{}});
  child.stderr.on("data",b=>{errors+=b.toString().slice(0,1000);});
  try {
    for(let n=0;n<150&&!port;n++){if(child.exitCode!==null)throw Error("Actual API did not start: "+errors);await delay(50);}
    assert.ok(port,"Actual API listening port");const base=`http://127.0.0.1:${port}`;
    for(let n=0;n<100;n++){try{if((await fetch(base+"/api/health")).ok)break;}catch{}await delay(50);}
    await work(base,{runtime});
  }finally{child.kill();await Promise.race([new Promise(r=>child.once("exit",r)),delay(2000)]);
    if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-month-service-"))await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
}
