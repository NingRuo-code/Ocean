import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, unlinkSync, existsSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";

const entry = resolve("tools/run-front-response-experiment.mjs");
const request = { purpose:"fixed_region_event_example", longitude:124.5, latitude:30.2,
  radius_km:20, search_start:"2024-08-05", search_end:"2024-08-08",
  input_version:"synthetic-event/v1", method_version:"observed-entry-example/v1",
  parameter_version:"fixed-support-windows/v1" };

function scenario(work) {
  const root=mkdtempSync(join(tmpdir(),"ocean-event-cli-")),params=join(root,"request.json"),out=join(root,"result"),source=join(root,"synthetic.json");
  writeFileSync(params,JSON.stringify(request));
  writeFileSync(source,readFileSync("backend/app/examples/fixed-region-event.json"));
  const call=(args,env={})=>spawnSync(process.execPath,[entry,...args],{encoding:"utf8",windowsHide:true,env:{...process.env,...env}});
  try { work({root,params,out,source,call,execute:()=>call(["--fixed-region-request",params,"--input",source,"--output",out])}); }
  finally { if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-event-cli-"))rmSync(root,{recursive:true,force:true}); }
}

test("original experiment entry runs a fixed-region example with independently known windows",()=>{
  const root=mkdtempSync(join(tmpdir(),"ocean-event-example-"));
  try{
    const params=join(root,"request.json"),out=join(root,"result");
    writeFileSync(params,JSON.stringify(request));
    const run=spawnSync(process.execPath,[entry,"--fixed-region-request",params,"--output",out],{encoding:"utf8",windowsHide:true});
    assert.equal(run.status,0,run.stderr);
    const summary=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
    assert.equal(summary.kind,"fixed_region_event_example");
    assert.equal(summary.event.anchor_date,"2024-08-05");
    assert.equal(summary.windows.pre7.total_hours,28);
    assert.equal(summary.windows.pre7.area_time_km2_days,28);
    assert.equal(summary.windows.post1_3.total_hours,36);
    assert.equal(summary.windows.post1_3.area_time_km2_days,12);
    assert.equal(summary.changes.post1_3.relative_density_change_percent,200);
    assert.equal(summary.windows.post1_7.total_hours,56);
    assert.equal(summary.changes.post1_7.relative_density_change_percent,100);
    assert.equal(summary.evidence_kind,"synthetic_example");
    assert.equal(summary.research_ready,false);
  }finally{
    if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-event-example-"))rmSync(root,{recursive:true,force:true});
  }
});

test("frozen reading needs neither source nor Python, rejects tampering and never overwrites results",()=>scenario(({params,out,source,call,execute})=>{
  assert.equal(execute().status,0);
  const frozen=readFileSync(join(out,"summary.json"),"utf8");
  assert.equal(execute().status,2);
  assert.equal(readFileSync(join(out,"summary.json"),"utf8"),frozen);
  unlinkSync(source);unlinkSync(params);
  const read=call(["--read-fixed-region-result",out],{OCEAN_EXPERIMENT_PYTHON:"deliberately-unavailable"});
  assert.equal(read.status,0,read.stderr);
  assert.deepEqual(JSON.parse(read.stdout),JSON.parse(frozen));
  writeFileSync(join(out,"report.md"),"tampered report");
  assert.equal(call(["--read-fixed-region-result",out]).status,2);
}));

test("explicit fixed-region reuse requires identical current bytes and preserves old completed results",()=>scenario(({root,params,out,source,call,execute})=>{
  const first=execute();assert.equal(first.status,0,first.stdout);
  const original=JSON.parse(first.stdout), frozen=readFileSync(join(out,"summary.json"),"utf8");
  const command=(folder,extra=[])=>call(["--fixed-region-request",params,"--input",source,"--output",folder,...extra]);
  const direct=join(root,"independent");
  assert.equal(command(direct).status,0);
  assert.equal(readFileSync(join(direct,"summary.json"),"utf8"),frozen);
  const reused=command(out,["--reuse-result",out]);
  assert.equal(reused.status,0,reused.stderr);
  assert.equal(JSON.parse(reused.stdout).run_id,original.run_id);
  assert.equal(JSON.parse(reused.stdout).versioned_result_id,original.versioned_result_id);
  assert.equal(JSON.parse(reused.stdout).reused,true);
  assert.equal(JSON.parse(readFileSync(join(out,"manifest.json"),"utf8")).source_freshness,"unknown");

  const stat=statSync(source), current=readFileSync(source,"utf8");
  const replaced=current.replace(/"hours": [1-8](?!\d)/,'"hours": 9');
  assert.notEqual(replaced,current);
  assert.equal(Buffer.byteLength(replaced),stat.size);
  writeFileSync(source,replaced);utimesSync(source,stat.atime,stat.mtime);
  const changed=join(root,"changed");
  const missed=command(changed,["--reuse-result",out]);assert.equal(missed.status,0,missed.stdout);
  assert.notEqual(JSON.parse(missed.stdout).result_id,original.result_id);
  assert.notEqual(JSON.parse(readFileSync(join(changed,"manifest.json"),"utf8")).execution_id,
    JSON.parse(readFileSync(join(out,"manifest.json"),"utf8")).execution_id);
  assert.equal(readFileSync(join(out,"summary.json"),"utf8"),frozen);
  const occupied=join(root,"occupied");mkdirSync(occupied);
  assert.equal(command(occupied,["--reuse-result",out]).status,2);
  assert.deepEqual(readdirSync(occupied),[]);

  unlinkSync(source);
  const failed=join(root,"failed-retry");
  assert.equal(command(failed,["--reuse-result",changed]).status,2);
  assert.equal(JSON.parse(readFileSync(join(failed,"manifest.json"),"utf8")).state,"failed");
  assert.deepEqual(JSON.parse(call(["--read-fixed-region-result",out],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}).stdout),JSON.parse(frozen));
}));

test("fixed execution uses staged sources, versions identical answers and withholds invalid engine output",()=>scenario(({root,params,source})=>{
  const project=join(root,"workspace"),lib=join(project,"tools","lib"),app=join(project,"backend","app");
  mkdirSync(lib,{recursive:true});mkdirSync(app,{recursive:true});
  const copiedEntry=join(project,"tools","run-front-response-experiment.mjs");
  cpSync(entry,copiedEntry);
  for(const name of ["fixed-region-example.mjs","fixed-region-reuse.mjs"]) cpSync(join("tools","lib",name),join(lib,name));
  for(const name of ["__init__.py","fixed_region_example.py","fixed_region_models.py","analysis_support.py","monthly_models.py","schemas.py"]) {
    cpSync(join("backend","app",name),join(app,name));
  }
  const model=join(app,"fixed_region_models.py"),engine=join(app,"fixed_region_example.py");
  const originalModel=readFileSync(model,"utf8"),originalEngine=readFileSync(engine,"utf8");
  const call=(folder,extra=[])=>spawnSync(process.execPath,[copiedEntry,"--fixed-region-request",params,"--input",source,
    "--output",folder,...extra],{encoding:"utf8",windowsHide:true});
  writeFileSync(engine,`from pathlib import Path\nPath(${JSON.stringify(model)}).write_text("raise RuntimeError('live checkout changed')")\n`+originalEngine);
  const first=join(root,"first");
  const initial=call(first);assert.equal(initial.status,0,initial.stdout || initial.stderr);
  assert.equal(readFileSync(model,"utf8"),"raise RuntimeError('live checkout changed')");
  assert.deepEqual(readdirSync(first).sort(),["manifest.json","report.md","summary.json"]);
  const original=JSON.parse(initial.stdout);
  writeFileSync(model,originalModel+"\n# Versioned engine update with the same descriptive result.\n");
  writeFileSync(engine,originalEngine);
  const fresh=call(join(root,"fresh"),["--reuse-result",first]);
  assert.equal(fresh.status,0,fresh.stdout || fresh.stderr);
  assert.equal(JSON.parse(fresh.stdout).reused,false);
  assert.equal(JSON.parse(fresh.stdout).result_id,original.result_id);
  assert.notEqual(JSON.parse(fresh.stdout).versioned_result_id,original.versioned_result_id);

  writeFileSync(engine,"import json\nprint(json.dumps({'state': 'completed', 'result': {'kind': 'fixed_region_event_example'}}))\n");
  const invalid=join(root,"invalid"),failed=call(invalid,["--reuse-result",first]);
  assert.equal(failed.status,2);
  assert.equal(JSON.parse(failed.stdout).state,"failed");
  assert.deepEqual(readdirSync(invalid),["manifest.json"]);
  assert.equal(JSON.parse(readFileSync(join(invalid,"manifest.json"),"utf8")).execution_id,undefined);
}));

test("missing, duplicate-key and unqualified sources publish failed manifests with no half result",()=>{
  for(const kind of ["missing","duplicate","real"])scenario(({params,out,source,call,execute})=>{
    if(kind==="missing")unlinkSync(source);
    else{
      let text=readFileSync(source,"utf8");
      text=kind==="duplicate"?text.replace('"unit": "fishing_hours"','"unit": "minutes", "unit": "fishing_hours"'):text.replace('"synthetic_example"','"real"');
      writeFileSync(source,text);
    }
    const result=execute();assert.equal(result.status,2);
    const manifest=JSON.parse(readFileSync(join(out,"manifest.json"),"utf8"));
    assert.equal(manifest.state,"failed");assert.equal(manifest.error.code,"controlled_event_failed");
    assert.equal(existsSync(join(out,"summary.json")),false);assert.equal(existsSync(join(out,"report.md")),false);
    assert.equal(JSON.stringify(manifest).includes(source),false);
    unlinkSync(params);
    const read=call(["--read-fixed-region-result",out]);assert.equal(read.status,0);assert.equal(JSON.parse(read.stdout).state,"failed");
  });
});

test("old moving-buffer experiment retains its original schema and known radius groups",()=>scenario(({root,call})=>{
  const out=join(root,"legacy");
  const run=call(["--output",out,"--iterations","20"]);assert.equal(run.status,0,run.stderr);
  const summary=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
  assert.equal(summary.schema_version,"front-response-experiment/v1");
  assert.equal(summary.experiment_id,"front-response-static-prototype");
  assert.deepEqual(summary.by_buffer.map(row=>row.buffer_km),[10,20,30]);
  assert.equal(summary.kind,undefined);
}));

test("frozen reader rejects a manifest whose conditions or evidence role disagree with its result",()=>{
  for(const change of ["conditions","qualification"])scenario(({out,call,execute})=>{
    assert.equal(execute().status,0);
    const path=join(out,"manifest.json"),manifest=JSON.parse(readFileSync(path,"utf8"));
    if(change==="conditions")manifest.parameters.latitude=0;
    else manifest.research_ready=true;
    writeFileSync(path,JSON.stringify(manifest));
    assert.equal(call(["--read-fixed-region-result",out]).status,2);
  });
});

test("invalid UTF-8 source bytes are rejected rather than replaced in public metadata",()=>scenario(({out,source,execute})=>{
  const bytes=readFileSync(source),position=bytes.indexOf(Buffer.from("CC0-1.0"));
  assert.ok(position>0);bytes[position]=255;writeFileSync(source,bytes);
  assert.equal(execute().status,2);
  const manifest=JSON.parse(readFileSync(join(out,"manifest.json"),"utf8"));
  assert.equal(manifest.state,"failed");assert.equal(existsSync(join(out,"summary.json")),false);
}));
