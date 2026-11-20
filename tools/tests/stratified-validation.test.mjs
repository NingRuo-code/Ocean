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

test("G3 coverage review reads native P0 snapshots, keeps missing candidates and excludes effect values", () =>
 scenario(({root,request,source,out,call})=>{
  const layer = (kind, hours) => ({
   id: kind === "activity" ? "effort-original" : "front-original",
   kind, role: "analysis_source", unit: kind === "activity" ? "fishing_hours" : "classification_code",
   time_verified: true, bounds_verified: true, support_verified: true, duration_days: 1,
   cells: [{bounds: [-1,-1,1,1], hours, support: "valid", side: "unknown"}],
  });
  const cells = join(root,"cells.json"), conditionPath = join(root,"conditions.json");
  const dates = ["2023-12-24","2023-12-25","2023-12-26","2023-12-27","2023-12-28","2023-12-29",
   "2023-12-30","2023-12-31","2024-01-01","2024-01-02","2024-01-03"];
  writeFileSync(cells, JSON.stringify({schema:"ocean-regional-cells/v1", evidence_kind:"synthetic",
   days:dates.map(date=>({date,layers:[layer("front",null),layer("activity",date==="2023-12-31"?0:42)]}))}));
  const conditions = {
   schema:"ocean-support-request/v1", month:"2023-12", layer_use:"front_effort",
   method_version:"wgs84-laea-uniform/v1", quality_rule:"complete-common-support/v1",
   allocation:"overlap_uniform", geometries:[{id:"central",type:"circle",center:[0,0],radius_km:20}],
  };
  const readAudit = (purpose, options = {}) => {
   const snapshot = join(root, purpose+".json");
   writeFileSync(conditionPath, JSON.stringify({...conditions,purpose,...options}));
   const audit = spawnSync(process.execPath, [resolve("tools/audit-research-baseline.mjs"),
    "--support-request",conditionPath,"--regional-input",cells,"--out",snapshot],
   {encoding:"utf8",windowsHide:true,timeout:20000});
   assert.equal(audit.status,0,audit.stderr);
   return readFileSync(snapshot,"utf8").trim();
  };
  // P0 permits December cells only in an A-month input.
  const fullCells = readFileSync(cells,"utf8");
  const decemberCells = JSON.parse(fullCells);
  decemberCells.days = decemberCells.days.filter(day => day.date.startsWith("2023-12"));
  writeFileSync(cells,JSON.stringify(decemberCells));
  const monthly = readAudit("A_month");
  writeFileSync(cells,fullCells);
  const event = readAudit("B_event",{event_date:"2023-12-31",event_day_rule:"exclude_event_day/v1"});
  const monthlyId = JSON.parse(monthly).support_snapshot_id, eventId = JSON.parse(event).support_snapshot_id;
  const badId = "sha256:" + "b".repeat(64);
  const invalid = JSON.stringify({schema:"ocean-support-qualification/v1", support_snapshot_id:badId});
  writeFileSync(source,`{"schema":"ocean-g3-support-pack/v1","snapshots":[${monthly},${event},${invalid}]}`);
  writeFileSync(request,JSON.stringify({
   purpose:"g3_candidate_support", method_version:"candidate-support/v1", season_year_rule:"calendar_year",
   layer_use:"front_effort", years:[2022,2023,2024], seasons:{winter:[12,1,2],summer:[6,7,8]},
   regions:[{id:"central",name:"Central",longitude:0,latitude:0},
    {id:"east",name:"East",longitude:2,latitude:0}],
   candidates:[
    {id:"dec",month:"2023-12",season:"winter",region_id:"central",radius_km:20,monthly_snapshot_id:monthlyId,
     event:{date:"2023-12-31",snapshot_id:eventId}},
    {id:"jan",month:"2024-01",season:"winter",region_id:"central",radius_km:20},
    {id:"dec-east",month:"2023-12",season:"winter",region_id:"east",radius_km:20,monthly_snapshot_id:monthlyId,
     event:{date:"2023-12-31",snapshot_id:monthlyId}},
    {id:"feb",month:"2024-02",season:"winter",region_id:"east",radius_km:20,monthly_snapshot_id:badId},
   ],
  }));
  const run=call(["--g3-candidate-support-request",request,"--input",source,"--output",out]);
  assert.equal(run.status,0,run.stderr);
  const result=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
  assert.equal(result.evidence_kind,"coverage_metadata");
  assert.equal(result.research_ready,false);
  assert.equal(result.rows[0].monthly.snapshot_id,monthlyId);
  assert.equal(result.rows[0].monthly.calendar.expected_days,31);
  assert.equal(result.rows[0].monthly.calendar.included_days,8);
  assert.equal(result.rows[0].event.snapshot_id,eventId);
  assert.deepEqual(result.rows[0].event.windows.post3.dates,["2024-01-01","2024-01-02","2024-01-03"]);
  assert.equal(result.rows[0].event.windows.post3.included_days,3);
  assert.equal(result.rows[0].event.windows.post7.expected_days,7);
  assert.equal(result.rows[0].event.windows.post7.included_days,3);
  assert.equal(result.rows[0].event.event_day.date,"2023-12-31");
  const context = result.rows[0].event.context_days;
  assert.equal(context.length,15);
  assert.equal(context.find(day=>day.date==="2023-12-31").state,"computed");
  assert.deepEqual(context.filter(day=>!day.included).map(day=>day.date),
    ["2024-01-04","2024-01-05","2024-01-06","2024-01-07"]);
  assert.deepEqual(context.filter(day=>!day.included).map(day=>day.source_states.activity), Array(4).fill("unprepared"));
  const report = readFileSync(join(out,"report.md"),"utf8");
  assert.match(report,/2024-01-04/);
  assert.match(report,/2022.*winter.*central.*no_candidates/);
  assert.equal(result.rows[1].monthly.status,"not_prepared");
  assert.equal(result.rows[1].event.identification,"not_evaluated");
  assert.equal(result.rows[2].monthly.reason,"requested_geometry_not_in_snapshot");
  assert.equal(result.rows[2].event.reason,"requested_conditions_not_in_snapshot");
  assert.equal(result.rows[3].monthly.status,"invalid_snapshot");
  assert.equal(result.strata.length,12);
  assert.equal(result.strata.filter(stratum=>stratum.year===2022&&stratum.status==="no_candidates").length,4);
  assert.equal(result.strata.find(s=>s.year===2024&&s.season==="summer").status,"no_candidates");
  assert.doesNotMatch(JSON.stringify(result),/total_hours|density_hours|area_time_km2_days|"hours":/);
  unlinkSync(source);
  const read=call(["--read-g3-candidate-support-result",out],{OCEAN_EXPERIMENT_PYTHON:"not-available"});
  assert.equal(read.status,0,read.stderr);
  assert.deepEqual(JSON.parse(read.stdout),result);
 }));

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


test("the committed known G3 bundle still reopens after a Windows-style Git checkout",()=>scenario(({root,call})=>{
 const prefix=join(root,'checkout').replaceAll('\\','/')+'/';
 const folder='docs/reports/g3-known-validation-2026-10-26';
 const checkout=spawnSync('git',['-c','safe.directory='+resolve('.'),'-c','core.autocrlf=true','checkout-index','--prefix='+prefix,'--',...['manifest.json','summary.json','report.md'].map(name=>folder+'/'+name)],{encoding:'utf8',windowsHide:true});
 assert.equal(checkout.status,0,checkout.stderr);
 const read=call(['--read-g3-validation-result',join(prefix,folder)],{OCEAN_EXPERIMENT_PYTHON:'not-available'});
 assert.equal(read.status,0,read.stderr);
 const result=JSON.parse(read.stdout);assert.equal(result.kind,'stratified_validation_example');assert.equal(result.rows.length,8);
}));
