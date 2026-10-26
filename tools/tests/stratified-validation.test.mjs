import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync,unlinkSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename,dirname,join,resolve} from "node:path";
import {spawnSync} from "node:child_process";

const entry=resolve("tools/run-front-response-experiment.mjs");
function scenario(work) {
 const root=mkdtempSync(join(tmpdir(),"ocean-strata-cli-"));
 const request=join(root,"request.json"),source=join(root,"snapshots.json"),out=join(root,"result");
 writeFileSync(request,readFileSync("docs/data/g3-known-validation.example.json"));
 writeFileSync(source,readFileSync("backend/app/examples/g3-known-snapshots.json"));
 const call=(args,env={})=>spawnSync(process.execPath,[entry,...args],{encoding:"utf8",windowsHide:true,env:{...process.env,...env}});
 try {work({root,request,source,out,call,submit:()=>call(["--g3-validation-request",request,"--input",source,"--output",out])});}
 finally {if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-strata-cli-"))rmSync(root,{recursive:true,force:true});}
}

test("explicit G3 request reads native A months into all year-season cells and retains missing candidates",()=>scenario(({out,submit})=>{
 const run=submit();assert.equal(run.status,0,run.stderr);
 const result=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
 assert.equal(result.kind,"stratified_validation_example");
 assert.equal(result.analysis_kind,"monthly_spatial_example");
 assert.equal(result.rows.length,8);assert.equal(result.strata.length,4);
 const summer=result.strata.find(s=>s.year===2024&&s.season==="summer");
 assert.equal(summer.metrics.total_hours,40);
 assert.equal(summer.metrics.area_time_km2_days,5);
 assert.equal(summer.metrics.density_hours_per_km2_day,8); // (10+30)/(2+3), not mean(5,10)=7.5.
 const zero=result.strata.find(s=>s.year===2023&&s.season==="summer");
 assert.equal(zero.metrics.total_hours,0);assert.equal(zero.metrics.density_hours_per_km2_day,0);
 assert.equal(result.rows.find(r=>r.candidate.id==="missing-2023-01").reason,"source_result_missing");
 assert.equal(result.rows.find(r=>r.candidate.month==="2024-07").reason,"source_not_public");
 assert.equal(result.rows.find(r=>r.candidate.month==="2024-12").metrics.total_hours,null);
 assert.equal(result.confirmatory,false);assert.equal(result.research_ready,false);assert.equal(result.intervals,null);
 const report=readFileSync(join(out,"report.md"),"utf8");
 assert.ok(report.includes("2023")&&report.includes("2024")&&report.includes("winter")&&report.includes("summer"));
 assert.ok(report.includes("missing-2023-01")&&report.includes("同支持"));
}));


test("G3 frozen result reopens without source, request or Python and preserves conditions",()=>scenario(({request,source,out,call,submit})=>{
 assert.equal(submit().status,0);
 const frozen=readFileSync(join(out,'summary.json'),'utf8');
 assert.equal(submit().status,2);assert.equal(readFileSync(join(out,'summary.json'),'utf8'),frozen);
 unlinkSync(request);unlinkSync(source);
 const read=call(['--read-g3-validation-result',out],{OCEAN_EXPERIMENT_PYTHON:'not-available'});
 assert.equal(read.status,0,read.stderr);assert.deepEqual(JSON.parse(read.stdout),JSON.parse(frozen));
 const manifestPath=join(out,'manifest.json'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
 manifest.parameters.candidates[0].month='2025-02';writeFileSync(manifestPath,JSON.stringify(manifest));
 assert.equal(call(['--read-g3-validation-result',out]).status,2);
}));

test("an empty snapshot registry retains every candidate and empty known support, without old experiments",()=>scenario(({source,out,submit})=>{
 const pack=JSON.parse(readFileSync(source,'utf8'));pack.snapshots=[];writeFileSync(source,JSON.stringify(pack));
 assert.equal(submit().status,0);
 const result=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));
 assert.equal(result.status,'not_ready');assert.equal(result.rows.length,8);assert.equal(result.strata.length,4);
 assert.ok(result.rows.every(r=>r.reason==='source_result_missing'&&!r.metrics));
 assert.ok(result.strata.every(s=>s.metrics.total_hours===null&&s.metrics.area_time_km2_days===null));
 assert.equal(result.parameters.bootstrap_iterations,undefined);assert.equal(result.experiment_id,undefined);
}));

test("invalid bytes, duplicate keys and budgets fail atomically without leaking paths",()=>{
 for(const kind of ['utf8','duplicate','budget'])scenario(({source,out,submit,call})=>{
  const data=readFileSync(source);
  if(kind==='utf8'){data[data.indexOf(Buffer.from('CC0-1.0'))]=255;writeFileSync(source,data);}
  else if(kind==='duplicate')writeFileSync(source,data.toString('utf8').replace('"snapshots": [','"snapshots": [], "snapshots": ['));
  else writeFileSync(source,' '.repeat(1_048_577));
  const run=submit();assert.equal(run.status,2);
  const manifest=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));
  assert.equal(manifest.state,'failed');assert.equal(manifest.error.code,'controlled_validation_failed');
  assert.equal(existsSync(join(out,'summary.json')),false);assert.equal(existsSync(join(out,'report.md')),false);
  assert.equal((JSON.stringify(manifest)+run.stderr+run.stdout).includes(source),false);
  const read=call(['--read-g3-validation-result',out]);assert.equal(read.status,0);assert.equal(JSON.parse(read.stdout).state,'failed');
 });
});

test("B requests, duplicate monthly support and confirmation flags cannot silently run A validation",()=>{
 for(const kind of ['B','duplicate','confirmation'])scenario(({request,out,submit})=>{
  const data=JSON.parse(readFileSync(request,'utf8'));
  if(kind==='B')data.analysis_kind='fixed_region_event_example';
  else if(kind==='duplicate')data.candidates.push({...data.candidates[0],id:'different-label'});
  else data.confirmatory=true;
  writeFileSync(request,JSON.stringify(data));assert.equal(submit().status,2);
  assert.equal(JSON.parse(readFileSync(join(out,'manifest.json'),'utf8')).state,'failed');
  assert.equal(existsSync(join(out,'summary.json')),false);
 });
});

test("G3 reader cannot consume C/B results or accept a modified evidence report",()=>scenario(({out,submit,call})=>{
 assert.equal(submit().status,0);
 assert.equal(call(['--read-regional-comparison-result',out]).status,2);
 assert.equal(call(['--read-fixed-region-result',out]).status,2);
 assert.equal(call(['--read-g3-validation-result',out,'--output',out]).status,2);
 writeFileSync(join(out,'report.md'),'modified evidence');
 assert.equal(call(['--read-g3-validation-result',out]).status,2);
}));
