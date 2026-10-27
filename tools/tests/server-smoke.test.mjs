import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {withService} from '../lib/monthly-test-service.mjs';

function smoke(base,args=[]){
  return new Promise((done,reject)=>{
    const timeout=args.includes('-TimeoutSec')?[]:['-TimeoutSec','3'];
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('deploy/server-smoke.ps1'),'-BaseUrl',base,...timeout,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>done({code,out,err}));
  });
}

async function withIngress(base,work,alter){
  const ingress=createServer(async(req,res)=>{
    try{
      assert.equal(req.method,'GET');
      const response=await fetch(base+(req.url==='/'?'/prototype-fishing.html':req.url));
      const body=Buffer.from(await response.arrayBuffer());
      const selected=alter?await alter(req.url,response.status,body):{status:response.status,body};
      res.writeHead(selected.status,{'Content-Type':response.headers.get('content-type')||'application/json'});
      res.end(selected.body);
    }catch{res.writeHead(502);res.end();}
  });
  await new Promise(done=>ingress.listen(0,'127.0.0.1',done));
  try{await work('http://127.0.0.1:'+ingress.address().port);}finally{await new Promise(done=>ingress.close(done));}
}

test('original server smoke keeps missing history and explicitly skipped activity limited, with an opt-in strict gate',{skip:process.platform!=='win32'},async()=>{
  await withService(async original=>withIngress(original,async base=>{
    const normal=await smoke(base,['-SkipFishing']);
    assert.equal(normal.code,0,normal.out+normal.err);
    assert.ok(!normal.out.includes('Smoke checks passed.'),'HTTP 200 and skipped data cannot be reported as complete readiness');
    const value=JSON.parse(normal.out);
    assert.equal(value.schema,'ocean-server-smoke/v2');assert.equal(value.status,'limited');
    assert.equal(value.research_qualified,false);assert.equal(value.deployment_performed,false);
    assert.equal(value.checks.find(x=>x.name==='historical-comparison').status,'unavailable');
    assert.equal(value.checks.find(x=>x.name==='fishing-day').status,'skipped');
    assert.equal(value.checks.find(x=>x.name==='viewport').status,'ready');
    const strict=await smoke(base,['-SkipFishing','-RequireReady']);
    assert.equal(strict.code,2);assert.equal(JSON.parse(strict.out).status,'limited');
    assert.equal(normal.out.includes(base),false);
    const missing=await smoke(base);
    assert.equal(missing.code,0,missing.out+missing.err);
    assert.equal(JSON.parse(missing.out).checks.find(x=>x.name==='fishing-day').status,'unavailable');
  }));
});

test('smoke refuses wrong conditions, units and denied or malformed original-service responses without leaking bodies',{skip:process.platform!=='win32'},async()=>{
  await withService(async original=>{
    for(const fault of ['date','bbox','sst-unit','hours-unit','query-date','query-null','denied','malformed']){
      await withIngress(original,async base=>{
        const result=await smoke(base,['-SkipFishing']);
        assert.equal(result.code,1,fault+result.out+result.err);
        const value=JSON.parse(result.out);assert.equal(value.status,'failed');
        assert.equal(value.checks.at(-1).status,'failed');
        assert.equal((result.out+result.err).includes('PRIVATE_SENTINEL'),false);
        assert.equal((result.out+result.err).includes(base),false);
      },(url,status,bytes)=>{
        if(['query-date','query-null'].includes(fault)&&url.startsWith('/api/query/current-state')){
          const body=JSON.parse(bytes);
          if(fault==='query-date')body.parameters.date='2024-08-04';else body.metrics.front_feature_count=null;
          return {status,body:JSON.stringify(body)};
        }
        if(!url.startsWith('/api/viewport?'))return {status,body:bytes};
        if(fault==='denied')return {status:403,body:'PRIVATE_SENTINEL'};
        if(fault==='malformed')return {status,body:'PRIVATE_SENTINEL:not-json'};
        const body=JSON.parse(bytes);
        if(fault==='date')body.meta.date='2024-08-04';
        if(fault==='bbox')body.coverage.requestBbox=[0,0,1,1];
        if(fault==='sst-unit')body.layers.sst.sourceUnit='degree_K';
        if(fault==='hours-unit')body.layers.fishingEffort.unit='kg';
        return {status,body:JSON.stringify(body)};
      });
    }
  });
});

test('daily-activity smoke preserves explicit zero and rejects missing hours, conflicting metadata and counts',{skip:process.platform!=='win32'},async()=>{
  await withService(async original=>{
    for(const fault of ['zero','missing','unit','metric','date','count','availability-date']){
      await withIngress(original,async base=>{
        const result=await smoke(base,['-FishingDate','2024-08-06']);
        assert.equal(result.code,fault==='zero'?0:1,fault+result.out+result.err);
        const value=JSON.parse(result.out);
        if(fault==='zero'){
          assert.equal(value.status,'limited','original history is still unavailable');
          assert.equal(value.checks.find(x=>x.name==='fishing-day').status,'ready');
          assert.equal(value.conditions.fishing_date,'2024-08-06');
        }else assert.equal(value.status,'failed');
      },(url,status,bytes)=>{
        if(url==='/api/fishing/availability')return {status:200,body:JSON.stringify({ready:true,day_count:1,days:[{date:fault==='availability-date'?'2024-08-04':'2024-08-06',cell_count:1}],source:{unit:'hours',license:'CC0-1.0',kind:'self-authored-test'}})};
        if(url==='/api/fishing/2024-08-06')return {status:200,body:JSON.stringify({date:fault==='date'?'2024-08-05':'2024-08-06',cell_count:fault==='count'?2:1,cells:[{lon:122,lat:28,hours:fault==='missing'?null:0}],source:{unit:fault==='unit'?'kg':'hours',metric:fault==='metric'?'catch':'apparent_fishing_effort',license:'CC0-1.0',kind:'self-authored-test'}})};
        return {status,body:bytes};
      });
    }
  });
});

test('invalid smoke arguments fail before networking and never echo private argument values',{skip:process.platform!=='win32'},async()=>{
  for(const [base,args] of [
    ['http://user:PRIVATE_SENTINEL@127.0.0.1:1',[]],
    ['http://127.0.0.1:1',['-FishingDate','PRIVATE_SENTINEL']],
    ['http://127.0.0.1:1',['-TimeoutSec','PRIVATE_SENTINEL']],
    ['http://127.0.0.1:1',['-TimeoutSec','99999999999999999999999']],
  ]){
    const result=await smoke(base,args);assert.equal(result.code,1);
    assert.equal((result.out+result.err).includes('PRIVATE_SENTINEL'),false);
    assert.equal((result.out+result.err).includes('99999999999999999999999'),false);
    const value=JSON.parse(result.out);assert.equal(value.checks[0].name,'arguments');
  }
});

test('viewport smoke rejects invalid support geometry and unknown observations instead of reporting readiness',{skip:process.platform!=='win32'},async(t)=>{
  await withService(async original=>{
    for(const fault of ['partial-outside','partial-missing','unavailable-covered','hours-null','hours-negative','temperature-null','coordinate-invalid']){
      await t.test(fault,async()=>withIngress(original,async base=>{
        const result=await smoke(base,['-SkipFishing']);assert.equal(result.code,1,fault+result.out+result.err);
        assert.equal(JSON.parse(result.out).status,'failed');
      },(url,status,bytes)=>{
        if(!url.startsWith('/api/viewport?'))return {status,body:bytes};
        const body=JSON.parse(bytes);
        if(fault.startsWith('partial')){body.meta.status='partial';body.coverage.status='partial';body.coverage.coveredBbox=fault==='partial-missing'?null:[0,0,1,1];}
        if(fault==='unavailable-covered'){body.meta.status='unavailable';body.coverage.status='unavailable';}
        if(fault==='hours-null')body.layers.fishingEffort.cells[0].hours=null;
        if(fault==='hours-negative')body.layers.fishingEffort.cells[0].hours=-1;
        if(fault==='temperature-null')body.layers.sst.cells[0].value=null;
        if(fault==='coordinate-invalid')body.layers.sst.cells[0].lon=999;
        return {status,body:JSON.stringify(body)};
      }));
    }
  });
});

test('missing layers remain limited while a declared available layer cannot be empty',{skip:process.platform!=='win32'},async()=>{
  await withService(async original=>{
    for(const honest of [true,false])await withIngress(original,async base=>{
      const result=await smoke(base,['-SkipFishing']);
      assert.equal(result.code,honest?0:1,result.out+result.err);
      const value=JSON.parse(result.out);assert.equal(value.status,honest?'limited':'failed');
      if(honest)assert.equal(value.checks.find(x=>x.name==='viewport').status,'partial');
    },(url,status,bytes)=>{
      if(!url.startsWith('/api/viewport?'))return {status,body:bytes};
      const body=JSON.parse(bytes);body.layers.sst.cells=[];
      if(honest){body.meta.status='partial';body.coverage.status='partial';body.coverage.layers.sst='unavailable';delete body.layers.sst.sourceUnit;}
      return {status,body:JSON.stringify(body)};
    });
  });
});
