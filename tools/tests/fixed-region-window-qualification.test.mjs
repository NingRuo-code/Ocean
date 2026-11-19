import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename, dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";

const experiment = resolve("tools/run-front-response-experiment.mjs");
const audit = resolve("tools/audit-research-baseline.mjs");
const digest = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const monthEnd = "2024-08-31";
const scope = {id:"circle",type:"circle",center:[0,0],radius_km:10};
const shift = (day,offset) => new Date(Date.parse(day)+offset*86400000).toISOString().slice(0,10);

function controlled(directory, anchor = monthEnd) {
  const base = {purpose:"fixed_region_event_example",longitude:0,latitude:0,radius_km:10,search_start:anchor,search_end:anchor};
  const run = (entry, args, env={}) => {
    const output=spawnSync(process.execPath,[entry,...args],{encoding:"utf8",windowsHide:true,env:{...process.env,...env}});
    assert.equal(output.status,0,output.stderr || output.stdout);
    return output.stdout;
  };
  const write = (name, document) => {const path=join(directory,name);writeFileSync(path,JSON.stringify(document));return path;};
  let fixturePath = resolve("tools/examples/b02-front-continuity.json");
  if (anchor !== monthEnd) {
    const fixture=JSON.parse(readFileSync(fixturePath,"utf8"));
    const offset=(Date.parse(anchor)-Date.parse(monthEnd))/86400000;
    for(const row of [...fixture.front_days,...fixture.regional_cells.days]) row.date=shift(row.date,offset);
    fixture.front_source_version=digest(JSON.stringify([fixture.regional_cells,fixture.front_days]));
    fixturePath=write("front-input.json",fixture);
  }
  const evidence = run(experiment,["--fixed-region-request",write("front-request.json",{
    ...base,input_version:digest(readFileSync(fixturePath)),method_version:"observed-fixed-exposure/v1",parameter_version:"front-continuity/v1",
  }),"--input",fixturePath,"--output",join(directory,"front-result")]);
  const frontSummary = readFileSync(join(directory,"front-result","summary.json"),"utf8");
  const frontManifest = readFileSync(join(directory,"front-result","manifest.json"),"utf8");
  const front = JSON.parse(frontSummary);
  assert.equal(front.result_id,JSON.parse(evidence).result_id);
  const makeSnapshot = (blocked, {frontVersion=front.source.front_source_version, blockedQuality=false, nullLicense=false}={}) => {
    const claim = {state:"verified",evidence_id:"sha256:"+"c".repeat(64)};
    const cells = {schema:"ocean-regional-cells/v1",evidence_kind:"synthetic",days:Array.from({length:11},(_,i) => {
      const day = shift(anchor,i-7);
      const layer = (kind,id,unit,hours) => ({kind,id,unit,role:"analysis_source",time_verified:true,bounds_verified:true,
        support_verified:true,duration_days:1,cells:[{bounds:[-0.4,-0.4,0.4,0.4],hours,support:"valid"}]});
      return {date:day,layers:[layer("front","front-original","classification_code",null),layer("activity","effort-original","fishing_hours",0)]};
    }),qualification_evidence:{schema:"ocean-support-evidence/v1",source_versions:{...(frontVersion?{"front-original":frontVersion}:{}),"effort-original":claim.evidence_id},
      processing_version:claim.evidence_id,license:nullLicense ? null : blocked ? {state:"blocked"} : claim,
      quality_rule:{id:"complete-common-support/v1",...(blockedQuality?{state:"blocked"}:claim)},geometry:{circle:{...claim,request_geometry:scope}}}};
    const output=join(directory,blocked?"blocked-support.json":"support.json");
    const conditions={schema:"ocean-support-request/v1",purpose:"B_event",event_date:anchor,event_day_rule:"exclude_event_day/v1",
      month:anchor.slice(0,7),layer_use:"front_effort",method_version:"wgs84-laea-uniform/v1",quality_rule:"complete-common-support/v1",
      allocation:"overlap_uniform",geometries:[scope]};
    run(audit,["--support-request",write("p0-conditions.json",conditions),"--regional-input",write("cells.json",cells),"--out",output]);
    return readFileSync(output,"utf8");
  };
  function windowReport(snapshot, name, failure = false) {
    const source = write(`${name}.json`,{schema:"ocean-fixed-region-window-evidence/v1",
      front_summary_json:frontSummary,front_manifest_json:frontManifest,support_snapshots:[snapshot]});
    const request = write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-window-qualification/v1",parameter_version:"p0-event-calendar/v1"});
    const output = join(directory,name);
    if (failure) {
      const processResult=spawnSync(process.execPath,[experiment,"--fixed-region-request",request,"--input",source,"--output",output],{encoding:"utf8",windowsHide:true});
      assert.equal(processResult.status,2,processResult.stdout);
      const manifest=JSON.parse(readFileSync(join(output,"manifest.json"),"utf8"));
      assert.equal(manifest.state,"failed");
      assert.deepEqual(manifest.artifacts,{});
      return null;
    }
    run(experiment,["--fixed-region-request",request,"--input",source,"--output",output]);
    unlinkSync(source);unlinkSync(request);
    return JSON.parse(run(experiment,["--read-fixed-region-result",output],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
  }
  return {front, makeSnapshot, windowReport};
}

test("B uses the matching P0 B_event audit for cross-month windows and holds unlicensed aggregates",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  try {
    const {front,makeSnapshot,windowReport}=controlled(directory);
    const snapshot=makeSnapshot(false);
    const result=windowReport(snapshot,"window-result");
    assert.equal(result.front_result_id,front.result_id);
    assert.equal(result.research_ready,false);
    const event=result.events[0], primary=event.support.front_effort;
    assert.equal(event.anchor_date,monthEnd);
    assert.equal(primary.support_snapshot_id,JSON.parse(snapshot).support_snapshot_id);
    assert.deepEqual(primary.windows.post3.dates,["2024-09-01","2024-09-02","2024-09-03"]);
    assert.equal(primary.windows.event_day.dates[0],monthEnd);
    assert.equal(primary.windows.pre7.dates[0],"2024-08-24");
    assert.equal(primary.windows.post7.dates.at(-1),"2024-09-07");
    assert.equal(primary.windows.post3.computational_support,"supported");
    assert.equal(primary.windows.post7.computational_support,"limited");
    assert.equal(primary.windows.post3.hours_available,true);
    assert.equal(primary.windows.post3.eligible_for_synthetic_effect,true);
    assert.equal(primary.windows.post7.hours_available,false);
    assert.equal(primary.windows.post3.data_gate_passed,false);
    assert.deepEqual(primary.windows.post7.excluded_dates,["2024-09-04","2024-09-05","2024-09-06","2024-09-07"]);
    assert.equal(primary.daily.find(day=>day.date==="2024-09-01").front_exposure,"near");
    assert.equal(primary.daily.find(day=>day.date==="2024-09-07").front_exposure,"unknown");
    assert.equal(primary.daily.find(day=>day.date==="2024-09-07").within_candidate_span,null);
    assert.equal(event.support.front_effort_sst.status,"snapshot_not_registered");
    const blocked=windowReport(makeSnapshot(true),"blocked-result").events[0].support.front_effort;
    assert.equal(blocked.windows.post3.status,"blocked_by_license");
    assert.equal(blocked.windows.post3.hours_available,false);
    assert.equal(blocked.windows.post3.area_time_available,false);
    assert.ok(blocked.daily.every(day=>day.hours===null && day.area_time_km2_days===null && day.common_support_id===null));
    const quality=windowReport(makeSnapshot(false,{blockedQuality:true}),"quality-result").events[0].support.front_effort;
    assert.equal(quality.windows.post3.status,"unsupported");
    assert.equal(quality.windows.post3.computational_support,"supported");
    assert.equal(quality.windows.post3.hours_available,true);
    assert.equal(quality.windows.post3.eligible_for_synthetic_effect,false);
    const mismatched=windowReport(makeSnapshot(false,{frontVersion:"sha256:"+"a".repeat(64)}),"mismatch-result").events[0].support.front_effort;
    assert.equal(mismatched.windows.post3.status,"front_version_mismatch");
    assert.equal(mismatched.windows.post3.hours_available,false);
    assert.equal(mismatched.source_provenance.source_versions["front-original"],"sha256:"+"a".repeat(64));
    const unlicensed=windowReport(makeSnapshot(false,{nullLicense:true}),"unknown-license-result").events[0].support.front_effort;
    assert.equal(unlicensed.windows.post3.status,"license_unverified");
    assert.equal(unlicensed.windows.post3.hours_available,false);
    windowReport(snapshot.replace("exclude_event_day/v1","include_event_day/v1"),"tampered-result",true);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("a month-start anchor preserves the exact previous-month pre-window",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  try {
    const {makeSnapshot,windowReport}=controlled(directory,"2024-09-01");
    const {windows,daily}=windowReport(makeSnapshot(false),"window-result").events[0].support.front_effort;
    assert.deepEqual(windows.pre7.dates,["2024-08-25","2024-08-26","2024-08-27","2024-08-28","2024-08-29","2024-08-30","2024-08-31"]);
    assert.deepEqual(windows.event_day.dates,["2024-09-01"]);
    assert.deepEqual(windows.post3.dates,["2024-09-02","2024-09-03","2024-09-04"]);
    assert.equal(daily.find(day=>day.date==="2024-09-04").hours,0);
    assert.equal(daily.find(day=>day.date==="2024-09-05").hours,null);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});
