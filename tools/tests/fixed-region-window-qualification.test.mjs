import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename, dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";

const experiment = resolve("tools/run-front-response-experiment.mjs");
const audit = resolve("tools/audit-research-baseline.mjs");
const digest = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const monthEnd = "2024-08-31";
const scope = {id:"circle",type:"circle",center:[0,0],radius_km:10};
const shift = (day,offset) => new Date(Date.parse(day)+offset*86400000).toISOString().slice(0,10);
const staticProof = (value, scopeId) => ({value,scope:"static_for_registered_circle",evidence_id:digest(scopeId)});

function controlled(directory, anchor = monthEnd, nextAnchor = null, radius = 10) {
  const base = {purpose:"fixed_region_event_example",longitude:0,latitude:0,radius_km:radius,search_start:anchor,search_end:nextAnchor ?? anchor};
  const run = (entry, args, env={}) => {
    const output=spawnSync(process.execPath,[entry,...args],{encoding:"utf8",windowsHide:true,env:{...process.env,...env}});
    assert.equal(output.status,0,output.stderr || output.stdout);
    return output.stdout;
  };
  const write = (name, document) => {const path=join(directory,name);writeFileSync(path,JSON.stringify(document));return path;};
  let fixturePath = resolve("tools/examples/b02-front-continuity.json");
  if (anchor !== monthEnd || nextAnchor || radius!==10) {
    const fixture=JSON.parse(readFileSync(fixturePath,"utf8"));
    fixture.geometry.radius_km=radius;
    const offset=(Date.parse(anchor)-Date.parse(monthEnd))/86400000;
    for(const row of [...fixture.front_days,...fixture.regional_cells.days]) row.date=shift(row.date,offset);
    if(nextAnchor) {
      const active = new Set([anchor,shift(anchor,1),nextAnchor,shift(nextAnchor,1)]);
      const template=fixture.regional_cells.days[0].layers;
      const objects=fixture.front_days.find(row=>row.date===anchor).objects;
      const length=(Date.parse(nextAnchor)-Date.parse(anchor))/86400000+5;
      const calendar=Array.from({length},(_,i)=>shift(anchor,i-2));
      fixture.regional_cells.days=calendar.map(date=>({date,layers:template}));
      fixture.front_days=calendar.map(date=>({date,source_id:fixture.front_source_id,objects:active.has(date)?objects:[]}));
    }
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
  const makeSnapshot = (blocked, {frontVersion=front.source.front_source_version, blockedQuality=false, nullLicense=false,
    days=11, hours=()=>0, varySupportAt=null, halfSupport=false, eventDate=anchor, processingVersion=null,
    activitySource="effort-original", longitude=0, omitAt=null}={}) => {
    const claim = {state:"verified",evidence_id:"sha256:"+"c".repeat(64)};
    const region={...scope,center:[longitude,0],radius_km:radius};
    const cells = {schema:"ocean-regional-cells/v1",evidence_kind:"synthetic",days:Array.from({length:days},(_,i) => {
      if(i-7===omitAt) return null;
      const day = shift(eventDate,i-7);
      const layer = (kind,id,unit,hours) => ({kind,id,unit,role:"analysis_source",time_verified:true,bounds_verified:true,
        support_verified:true,duration_days:1,cells:[{bounds:[-0.4,-0.4,0.4,0.4],hours,support:"valid"}]});
      const frontLayer=layer("front","front-original","classification_code",null);
      if(halfSupport||i-7===varySupportAt) frontLayer.cells=[{bounds:[-0.4,-0.4,longitude,0.4],support:"valid"},{bounds:[longitude,-0.4,0.4,0.4],support:"land"}];
      return {date:day,layers:[frontLayer,layer("activity",activitySource,"fishing_hours",hours(i-7))]};
    }).filter(Boolean),qualification_evidence:{schema:"ocean-support-evidence/v1",source_versions:{...(frontVersion?{"front-original":frontVersion}:{}),"effort-original":claim.evidence_id,"effort-other":claim.evidence_id},
      processing_version:processingVersion ?? claim.evidence_id,license:nullLicense ? null : blocked ? {state:"blocked"} : claim,
      quality_rule:{id:"complete-common-support/v1",...(blockedQuality?{state:"blocked"}:claim)},geometry:{circle:{...claim,request_geometry:region}}}};
    const output=join(directory,blocked?"blocked-support.json":"support.json");
    const conditions={schema:"ocean-support-request/v1",purpose:"B_event",event_date:eventDate,event_day_rule:"exclude_event_day/v1",
      month:eventDate.slice(0,7),layer_use:"front_effort",method_version:"wgs84-laea-uniform/v1",quality_rule:"complete-common-support/v1",
      allocation:"overlap_uniform",geometries:[region],
      ...(activitySource==="effort-original"?{}:{source_ids:{front:"front-original",activity:activitySource}})};
    run(audit,["--support-request",write("p0-conditions.json",conditions),"--regional-input",write("cells.json",cells),"--out",output]);
    return readFileSync(output,"utf8");
  };
  function windowReport(snapshot, name, failure = false, {reuseFrom=null,verifyReuse=false}={}) {
    const source = write(`${name}.json`,{schema:"ocean-fixed-region-window-evidence/v1",
      front_summary_json:frontSummary,front_manifest_json:frontManifest,support_snapshots:[snapshot].flat()});
    const request = write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-window-qualification/v1",parameter_version:"p0-event-calendar/v1"});
    const output = join(directory,name);
    const args=["--fixed-region-request",request,"--input",source,"--output",output];
    if(reuseFrom) args.push("--reuse-result",join(directory,reuseFrom));
    if (failure) {
      const processResult=spawnSync(process.execPath,[experiment,...args],{encoding:"utf8",windowsHide:true});
      assert.equal(processResult.status,2,processResult.stdout);
      const manifest=JSON.parse(readFileSync(join(output,"manifest.json"),"utf8"));
      assert.equal(manifest.state,"failed");
      assert.deepEqual(manifest.artifacts,{});
      return null;
    }
    const current=JSON.parse(run(experiment,args));
    if(verifyReuse) {
      const repeated=JSON.parse(run(experiment,[...args,"--reuse-result",output]));
      assert.equal(repeated.reused,true);
      assert.equal(repeated.run_id,current.run_id);
      assert.equal(repeated.execution_id,current.execution_id);
    }
    unlinkSync(source);unlinkSync(request);
    return JSON.parse(run(experiment,["--read-fixed-region-result",output],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
  }
  function windowEffects(snapshot, name) {
    const windows = `${name}-windows`;
    windowReport(snapshot,windows);
    const source = write(`${name}.json`,{schema:"ocean-fixed-region-window-effects-input/v1",
      window_summary_json:readFileSync(join(directory,windows,"summary.json"),"utf8"),
      window_manifest_json:readFileSync(join(directory,windows,"manifest.json"),"utf8")});
    const request = write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-window-effects/v1",parameter_version:"exact-common-support/v1"});
    const output=join(directory,name);
    run(experiment,["--fixed-region-request",request,"--input",source,"--output",output]);
    unlinkSync(source);unlinkSync(request);
    return JSON.parse(run(experiment,["--read-fixed-region-result",output],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
  }
  function registerControl(id, longitude, exposureOffset=null, supportOptions={}) {
    const {exitDistance=2,eventDate=anchor,alsoEventDate=null,...p0Options}=supportOptions;
    const controlBase={...base,longitude,search_start:shift(eventDate,-7),search_end:shift(alsoEventDate ?? eventDate,7)};
    const fixture=JSON.parse(readFileSync(fixturePath,"utf8"));
    const layer=fixture.regional_cells.days[0].layers;
    fixture.id=id;
    fixture.geometry.longitude=longitude;
    fixture.policy.enter_distance_km=Math.min(fixture.policy.enter_distance_km,exitDistance/2);
    fixture.policy.exit_distance_km=exitDistance;
    fixture.front_source_version=front.source.front_source_version;
    const extent=19+(alsoEventDate ? (Date.parse(alsoEventDate)-Date.parse(eventDate))/86400000 : 0);
    const calendar=Array.from({length:extent},(_,i)=>shift(eventDate,i-9));
    fixture.regional_cells.days=calendar.map(date=>({date,layers:layer}));
    fixture.front_days=calendar.map(date=>({date,source_id:fixture.front_source_id,objects:
      exposureOffset!==null && date===shift(eventDate,exposureOffset)
        ? [{id:"LaterFront",points:[[longitude,-0.01],[longitude,0.01]]}] : []}));
    const input=write(`${id}-source.json`,fixture);
    const request=write(`${id}-request.json`,{...controlBase,input_version:digest(readFileSync(input)),
      method_version:"observed-fixed-exposure/v1",parameter_version:"front-continuity/v1"});
    const output=join(directory,id);
    run(experiment,["--fixed-region-request",request,"--input",input,"--output",output]);
    const supportSnapshots=[makeSnapshot(false,{days:15,longitude,eventDate,...p0Options})];
    if(alsoEventDate) supportSnapshots.push(makeSnapshot(false,{days:15,longitude,eventDate:alsoEventDate,...p0Options}));
    return {id,longitude,latitude:0,radius_km:radius,search_start:controlBase.search_start,search_end:controlBase.search_end,
      covariates:{distance_to_coast_km:staticProof(8,`${id} coast`)},front_summary_json:readFileSync(join(output,"summary.json"),"utf8"),
      front_manifest_json:readFileSync(join(output,"manifest.json"),"utf8"),
      support_snapshots:supportSnapshots};
  }
  function fixedControls(controls, targetRun, name, covariateLimits={distance_to_coast_km:3}, clearance=2, requiredWindow="post7") {
    const source=write(`${name}.json`,{schema:"ocean-fixed-region-controls-input/v1",
      target_summary_json:readFileSync(join(directory,targetRun,"summary.json"),"utf8"),
      target_manifest_json:readFileSync(join(directory,targetRun,"manifest.json"),"utf8"),
      target_covariates:{distance_to_coast_km:staticProof(7,"target coast")},
      policy:{required_window:requiredWindow,max_center_distance_km:40,minimum_area_ratio:0.8,
        control_clearance_km:clearance,front_position_error_km:0.01,covariate_limits:covariateLimits},controls});
    const request=write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-comparable-controls/v1",parameter_version:"frozen-single-control/v1"});
    const output=join(directory,name);
    run(experiment,["--fixed-region-request",request,"--input",source,"--output",output]);
    unlinkSync(source);unlinkSync(request);
    return JSON.parse(run(experiment,["--read-fixed-region-result",output],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
  }
  function eventInference(controlRuns, name, policyOptions={}, previous=null) {
    const artifacts=[controlRuns].flat().map(controlRun=>({summary_json:readFileSync(join(directory,controlRun,"summary.json"),"utf8"),
      manifest_json:readFileSync(join(directory,controlRun,"manifest.json"),"utf8")}));
    const source=write(`${name}.json`,{schema:"ocean-fixed-region-event-inference-input/v1",control_runs:artifacts,
      policy:{window:"post3",estimand:"equal_event",adjacency_days:3,confidence_level:0.9,iterations:400,
        seed:20261119,minimum_groups:2,assumption:"between_groups_registered",rationale:"Synthetic independent nominated groups.",...policyOptions}});
    const request=write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-group-uncertainty/v1",parameter_version:"registered-group-percentile/v1"});
    const output=join(directory,name);
    const previousPath=previous && join(directory,previous);
    const extra=previousPath ? ["--reuse-result",previousPath] : [];
    const executed=JSON.parse(run(experiment,["--fixed-region-request",request,"--input",source,"--output",output,...extra]));
    unlinkSync(source);unlinkSync(request);
    const resultPath=executed.reused ? previousPath : output;
    const result=JSON.parse(run(experiment,["--read-fixed-region-result",resultPath],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
    if(previousPath) {
      assert.equal(executed.reused,name==="match-reuse");
      assert.equal(executed.versioned_result_id,result.versioned_result_id);
      if(executed.reused) assert.equal(existsSync(output),false);
    }
    return result;
  }
  function eventLag(controlRun, name) {
    const root=join(directory,controlRun), output=join(directory,name);
    const source=write(`${name}.json`,{schema:"ocean-fixed-region-event-lag-input/v1",
      control_summary_json:readFileSync(join(root,"summary.json"),"utf8"),control_manifest_json:readFileSync(join(root,"manifest.json"),"utf8"),
      policy:{cohort_mode:"common_long_window_support/v1",group_adjacency_days:3}});
    const request=write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-lag-cohort/v1",parameter_version:"paired-relative-day/v1"});
    run(experiment,["--fixed-region-request",request,"--input",source,"--output",output]);
    unlinkSync(source);unlinkSync(request);
    const result=JSON.parse(run(experiment,["--read-fixed-region-result",output],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
    return {result,output};
  }
  function readingPack(controlRun, inferenceRun, lagRun, name, {use="local_allowed_aggregate",corruptFigure=false,expectFailure=false}={}) {
    const artifact=runName=>({summary_json:readFileSync(join(directory,runName,"summary.json"),"utf8"),
      manifest_json:readFileSync(join(directory,runName,"manifest.json"),"utf8")});
    const source=write(`${name}.json`,{schema:"ocean-fixed-region-reading-pack-input/v1",use,
      controls:artifact(controlRun),inference:artifact(inferenceRun),lag:artifact(lagRun),
      lag_svg:readFileSync(join(directory,lagRun,"lag.svg"),"utf8")+(corruptFigure?"\n":"")});
    const request=write(`${name}-request.json`,{...base,input_version:digest(readFileSync(source)),
      method_version:"fixed-event-reading-pack/v1",parameter_version:"frozen-aggregate-evidence/v1"});
    const output=join(directory,name);
    if(expectFailure) {
      const failure=spawnSync(process.execPath,[experiment,"--fixed-region-request",request,"--input",source,"--output",output],{encoding:"utf8",windowsHide:true});
      assert.equal(failure.status,2,failure.stdout);
      assert.deepEqual(JSON.parse(readFileSync(join(output,"manifest.json"),"utf8")).artifacts,{});
      return null;
    }
    run(experiment,["--fixed-region-request",request,"--input",source,"--output",output]);
    unlinkSync(source);unlinkSync(request);
    const result=JSON.parse(run(experiment,["--read-fixed-region-result",output],{OCEAN_EXPERIMENT_PYTHON:"unavailable"}));
    return {result,output};
  }
  return {front, makeSnapshot, windowReport, windowEffects, registerControl, fixedControls,eventInference,eventLag,readingPack};
}

test("B uses the matching P0 B_event audit for cross-month windows and holds unlicensed aggregates",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  try {
    const {front,makeSnapshot,windowReport}=controlled(directory);
    const snapshot=makeSnapshot(false);
    const result=windowReport(snapshot,"window-result",false,{verifyReuse:true});
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
    windowReport(snapshot.replace("exclude_event_day/v1","include_event_day/v1"),"tampered-result",true,{reuseFrom:"window-result"});
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("same-day controls stay fixed and later front exposure excludes an otherwise valid background",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  try {
    const {makeSnapshot,windowEffects,registerControl,fixedControls}=controlled(directory);
    const target=windowEffects(makeSnapshot(false,{days:15,hours:offset=>offset<0 ? 10 : 20}),"target-effects");
    const good=registerControl("good",0.24), exposed=registerControl("exposed",-0.24,5);
    const result=fixedControls([exposed,good],"target-effects","controls");
    const event=result.events[0];
    assert.equal(event.matching.selected.id,"good");
    assert.equal(event.matching.selected.weight,1);
    assert.equal(event.matching.selected.scope,"retrospective_full_window");
    assert.equal(event.matching.selected.covariates.distance_to_coast_km.control_evidence_id,digest("good coast"));
    assert.equal(event.matching.candidates.find(c=>c.id==="exposed").reason,"front_exposure_not_clear");
    assert.deepEqual(event.matching.candidates.find(c=>c.id==="exposed").exposure_dates,["2024-09-05"]);
    assert.equal(event.contrasts.post3.pre7.control_density,0);
    assert.equal(event.contrasts.post3.post.control_density,0);
    assert.ok(Math.abs(event.contrasts.post3.change_difference-target.events[0].changes.post3.absolute_density_change)<1e-12);
    const noMatch=fixedControls([exposed],"target-effects","no-match").events[0];
    assert.equal(noMatch.matching.selected,null);
    assert.equal(noMatch.contrasts.post3,null);
    assert.equal(noMatch.target_changes.post3.absolute_density_change,target.events[0].changes.post3.absolute_density_change);
    const weak=registerControl("weak",0.22,null,{exitDistance:1});
    const failedClearance=fixedControls([weak],"target-effects","unproven-clearance").events[0];
    assert.equal(failedClearance.matching.selected,null);
    assert.equal(failedClearance.matching.candidates[0].reason,"front_clearance_not_proven");
    const fractional=registerControl("fractional",0.22,null,{exitDistance:0.2});
    const equalClearance=fixedControls([fractional],"target-effects","fractional-clearance",{distance_to_coast_km:3},0.2).events[0];
    assert.equal(equalClearance.matching.selected.id,"fractional");
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("same-day comparisons retain direction and require registered covariates and support balance",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  try {
    const {makeSnapshot,windowEffects,registerControl,fixedControls}=controlled(directory);
    windowEffects(makeSnapshot(false,{days:15,hours:day=>day<0 ? 10 : 20}),"target-effects");
    const valid=registerControl("valid",0.24,null,{hours:day=>day<0 ? 30 : 10});
    const narrow=registerControl("narrow",-0.24,null,{halfSupport:true});
    const event=fixedControls([narrow,valid],"target-effects","checked-controls").events[0];
    assert.equal(event.matching.selected.id,"valid");
    const imbalance=event.matching.candidates.find(item=>item.id==="narrow");
    assert.equal(imbalance.reason,"same_day_support_imbalance");
    assert.ok(imbalance.pair_checks.every(row=>Math.abs(row.area_ratio-0.5)<1e-6));
    assert.ok(event.contrasts.post3.pre7.same_day_density_difference<0);
    assert.ok(event.contrasts.post3.post.same_day_density_difference>0);
    const unmeasured=fixedControls([{...valid,covariates:{}}],"target-effects","unknown-coast").events[0];
    assert.equal(unmeasured.matching.selected,null);
    assert.equal(unmeasured.matching.candidates[0].covariates.distance_to_coast_km.status,"unknown");
    const temporal=fixedControls([valid],"target-effects","unverified-sst",{sst_c:2}).events[0];
    assert.equal(temporal.matching.selected,null);
    assert.equal(temporal.matching.candidates[0].covariates.sst_c.status,"unverified_temporal_support");
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

test("B effects use additive H/E on identical support and retain zero baseline and unequal areas",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  try {
    const {makeSnapshot,windowEffects}=controlled(directory);
    const hours = day => day<0 ? 10 : day===0 ? 5000 : day<=3 ? 20 : 30;
    const estimate=windowEffects(makeSnapshot(false,{days:15,hours}),"effects-result");
    const event=estimate.events[0];
    assert.equal(event.changes.post3.status,"comparable");
    assert.ok(Math.abs(event.changes.post3.relative_change_percent-100)<1e-8);
    assert.ok(Math.abs(event.changes.post7.relative_change_percent-(180/70-1)*100)<1e-8);
    assert.ok(Math.abs(event.windows.post3.area_time_km2_days/event.windows.pre7.area_time_km2_days-3/7)<1e-8);
    assert.equal(event.windows.pre7.supported_days,7);
    assert.equal(estimate.pooled.post7.event_count,1);
    assert.equal(estimate.pooled.post7.equal_event_difference,event.changes.post7.absolute_density_change);
    assert.equal(estimate.pooled.post7.pooled_density_difference,event.changes.post7.absolute_density_change);

    const zero=windowEffects(makeSnapshot(false,{days:15,hours:day=>day<0 ? 0 : hours(day)}),"zero-effect").events[0];
    assert.equal(zero.windows.pre7.total_hours,0);
    assert.ok(zero.changes.post3.absolute_density_change>0);
    assert.equal(zero.changes.post3.relative_change_percent,null);
    assert.equal(zero.changes.post3.relative_reason,"zero_baseline");

    const area=windowEffects(makeSnapshot(false,{days:15,hours,varySupportAt:2}),"area-effect").events[0];
    assert.equal(area.changes.post3.status,"common_support_changed");
    assert.equal(area.changes.post3.absolute_density_change,null);
    assert.ok(area.windows.post3.area_time_km2_days>0);
    assert.equal(area.windows.post3.common_support_status,"varies_within_window");

    const partial=windowEffects(makeSnapshot(false,{hours}),"partial-effect").events[0];
    assert.equal(partial.changes.post3.status,"comparable");
    assert.equal(partial.changes.post7.status,"incomplete_window");
    assert.equal(partial.windows.post7.total_hours,null);
    assert.equal(partial.windows.post7.supported_days,3);
    assert.ok(partial.windows.post7.known_subset.total_hours>0);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("overlapping calendars keep event weights while withholding pooled exposure",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  const second="2024-09-10";
  try {
    const {makeSnapshot,windowEffects}=controlled(directory,monthEnd,second);
    const globalHours = (anchor, offset) => 100+(Date.parse(shift(anchor,offset))-Date.parse(monthEnd))/86400000;
    const result=windowEffects([
      makeSnapshot(false,{days:15,hours:offset=>globalHours(monthEnd,offset)}),
      makeSnapshot(false,{days:15,eventDate:second,hours:offset=>globalHours(second,offset)}),
    ],"overlap-effect");
    for(const phase of ["post3","post7"]) {
      assert.equal(result.pooled[phase].event_count,2);
      assert.equal(result.pooled[phase].pooled_status,"overlapping_dates");
      assert.equal(result.pooled[phase].pooled_density_difference,null);
      const directMean=result.events.reduce((sum,event)=>sum+event.changes[phase].absolute_density_change,0)/2;
      assert.ok(Math.abs(result.pooled[phase].equal_event_difference-directMean)<1e-12);
    }
    assert.deepEqual(result.pooled.post3.overlapping_dates,["2024-09-03"]);
    assert.deepEqual(result.pooled.post7.overlapping_dates,["2024-09-03","2024-09-04","2024-09-05","2024-09-06","2024-09-07"]);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("distinct supported areas separate equal-event and pooled effects, and incompatible provenance holds both",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  const second="2024-09-20";
  try {
    const {makeSnapshot,windowEffects}=controlled(directory,monthEnd,second);
    const first=makeSnapshot(false,{days:15,hours:d=>d<0 ? 10 : 20});
    const half={days:15,eventDate:second,halfSupport:true,hours:d=>d<0 ? 10 : 40};
    const result=windowEffects([first,makeSnapshot(false,half)],"weights-effect");
    const [a,b]=result.events;
    assert.ok(Math.abs(b.windows.pre7.area_time_km2_days/a.windows.pre7.area_time_km2_days-0.5)<1e-6);
    assert.ok(Math.abs(b.changes.post3.absolute_density_change/a.changes.post3.absolute_density_change-3)<1e-8);
    const pooled=result.pooled.post3;
    assert.equal(pooled.pooled_status,"available");
    assert.ok(Math.abs(pooled.pooled_density_difference/pooled.equal_event_difference-5/6)<1e-6);

    const changed=windowEffects([first,makeSnapshot(false,{...half,processingVersion:digest("other processing")})],"provenance-effect");
    assert.ok(changed.events.every(event=>event.changes.post3.status==="comparable"));
    assert.equal(changed.pooled.post3.pooled_status,"incompatible_provenance");
    assert.equal(changed.pooled.post3.equal_event_difference,null);
    assert.equal(changed.pooled.post3.pooled_density_difference,null);

    const selected=windowEffects([first,makeSnapshot(false,{...half,activitySource:"effort-other"})],"source-choice-effect");
    assert.ok(selected.events.every(event=>event.changes.post3.status==="comparable"));
    assert.deepEqual(selected.events[0].provenance.source_versions,selected.events[1].provenance.source_versions);
    assert.notEqual(selected.events[0].provenance.selected_source_ids.activity,selected.events[1].provenance.selected_source_ids.activity);
    assert.equal(selected.pooled.post3.pooled_status,"incompatible_provenance");
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("registered independent B groups give reproducible percentile endpoints and exact descriptive fallback",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  const second="2024-09-20";
  try {
    const {makeSnapshot,windowEffects,registerControl,fixedControls,eventInference}=controlled(directory,monthEnd,second);
    windowEffects([makeSnapshot(false,{days:15,hours:offset=>offset<0 ? 10 : 20}),
      makeSnapshot(false,{days:15,eventDate:second,hours:offset=>offset<0 ? 10 : 50})],"target-effects");
    const first=registerControl("north",0.24), other=registerControl("south",-0.24,null,{eventDate:second});
    const contrasts=fixedControls([first,other],"target-effects","fixed-controls");
    assert.equal(contrasts.matched_events,2);
    const expected=contrasts.events.map(event=>event.contrasts.post3.change_difference).sort((a,b)=>a-b);
    const result=eventInference("fixed-controls","event-interval");
    assert.equal(result.counts.candidate_events,2);
    assert.equal(result.counts.eligible_events,2);
    assert.equal(result.counts.usable_groups,2);
    assert.equal(result.inference.status,"estimated_for_registered_assumptions");
    assert.equal(result.inference.lower,expected[0]);
    assert.equal(result.inference.upper,expected[1]);
    assert.equal(result.inference.estimate,(expected[0]+expected[1])/2);
    assert.equal(result.inference.valid_iterations,400);
    const repeated=eventInference("fixed-controls","repeat-interval");
    assert.deepEqual(repeated.inference,result.inference);
    const reused=eventInference("fixed-controls","match-reuse",{},"event-interval");
    assert.deepEqual(reused,result);
    const newSeed=eventInference("fixed-controls","seed-changed",{seed:23},"event-interval");
    assert.equal(newSeed.policy.seed,23);
    assert.notEqual(newSeed.versioned_result_id,result.versioned_result_id);
    const newWindow=eventInference("fixed-controls","window-changed",{window:"post7"},"event-interval");
    assert.equal(newWindow.policy.window,"post7");
    assert.notEqual(newWindow.versioned_result_id,result.versioned_result_id);
    const pooled=eventInference("fixed-controls","pooled-interval",{estimand:"pooled_area_time"});
    assert.equal(pooled.inference.status,"estimated_for_registered_assumptions");
    assert.ok(Math.abs(pooled.inference.estimate-result.inference.estimate)<1e-12);
    assert.ok(Math.abs(pooled.inference.lower-expected[0])<1e-12);
    assert.ok(Math.abs(pooled.inference.upper-expected[1])<1e-12);
    const unverified=eventInference("fixed-controls","unverified-interval",{assumption:"unverified"});
    assert.equal(unverified.inference.reason,"between_group_assumptions_unverified");
    assert.equal(unverified.inference.lower,null);
    assert.equal(unverified.inference.estimate,result.inference.estimate);

    const secondaryDir=join(directory,"radius20");mkdirSync(secondaryDir);
    const variant=controlled(secondaryDir,monthEnd,second,20);
    assert.equal(variant.front.source.front_source_version,contrasts.front_lineage.source_version);
    variant.windowEffects([variant.makeSnapshot(false,{days:15,hours:offset=>offset<0 ? 10 : 20}),
      variant.makeSnapshot(false,{days:15,eventDate:second,hours:offset=>offset<0 ? 10 : 50})],"target-effects");
    variant.fixedControls([],"target-effects","fixed-controls");
    const combined=eventInference(["fixed-controls","radius20/fixed-controls"],"multi-radius-interval");
    assert.equal(combined.counts.event_radius_rows,4);
    assert.equal(combined.counts.eligible_events,2);
    assert.equal(combined.counts.usable_groups,2);
    assert.ok(combined.dependence_links.some(link=>link.reasons.includes("same_anchor_radius_variant")));
    assert.deepEqual(combined.inference,result.inference);
    variant.fixedControls([],"target-effects","different-policy",{distance_to_coast_km:3},3);
    const held=eventInference(["fixed-controls","radius20/different-policy"],"held-variant",{},"multi-radius-interval");
    assert.notEqual(held.versioned_result_id,combined.versioned_result_id);
    assert.equal(held.radius_compatibility["20"],"control_policy_mismatch");
    assert.equal(held.counts.event_radius_rows,4);
    assert.equal(held.counts.grouped_radius_rows,2);
    assert.deepEqual(held.inference,result.inference);

    const old=join(directory,"legacy-controls");mkdirSync(old);
    const oldReport=structuredClone(contrasts);
    for(const event of oldReport.events) delete event.target_provenance;
    const oldText=JSON.stringify(oldReport);
    const oldManifest=JSON.parse(readFileSync(join(directory,"fixed-controls","manifest.json"),"utf8"));
    oldManifest.artifacts["summary.json"]=digest(oldText);
    writeFileSync(join(old,"summary.json"),oldText);writeFileSync(join(old,"manifest.json"),JSON.stringify(oldManifest));
    const legacy=eventInference("legacy-controls","legacy-interval");
    assert.equal(legacy.inference.reason,"event_provenance_unverified");
    assert.deepEqual(legacy.individual_effects.map(item=>item.estimate).sort((a,b)=>a-b),expected);
    const historical=join(directory,"historical-controls");mkdirSync(historical);
    const historicalReport=structuredClone(contrasts),historicalManifest=structuredClone(oldManifest);
    for(const key of ["execution_id","versioned_result_id","source_freshness"]) {
      delete historicalReport[key];
      delete historicalManifest[key];
    }
    delete historicalReport.front_lineage;
    const historicalText=JSON.stringify(historicalReport);
    historicalManifest.artifacts["summary.json"]=digest(historicalText);
    writeFileSync(join(historical,"summary.json"),historicalText);
    writeFileSync(join(historical,"manifest.json"),JSON.stringify(historicalManifest));
    writeFileSync(join(historical,"report.md"),readFileSync(join(directory,"fixed-controls","report.md")));
    const frozen=spawnSync(process.execPath,[experiment,"--read-fixed-region-result",historical],{encoding:"utf8",windowsHide:true,
      env:{...process.env,OCEAN_EXPERIMENT_PYTHON:"unavailable"}});
    assert.equal(frozen.status,0,frozen.stderr);
    assert.deepEqual(JSON.parse(frozen.stdout),historicalReport);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("shared event days and shared control identity form one group and prevent pooled reuse",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  const second="2024-09-10";
  try {
    const {makeSnapshot,windowEffects,registerControl,fixedControls,eventInference}=controlled(directory,monthEnd,second);
    const rates=(day,offset)=>30+(Date.parse(shift(day,offset))-Date.parse(monthEnd))/86400000;
    windowEffects([makeSnapshot(false,{days:15,hours:offset=>rates(monthEnd,offset)}),
      makeSnapshot(false,{days:15,eventDate:second,hours:offset=>rates(second,offset)})],"target-effects");
    const shared=registerControl("shared",0.24,null,{alsoEventDate:second});
    assert.equal(fixedControls([shared],"target-effects","fixed-controls").matched_events,2);
    const equal=eventInference("fixed-controls","dependency-interval");
    assert.equal(equal.counts.usable_groups,1);
    assert.equal(equal.groups[0].members.length,2);
    assert.ok(equal.dependence_links[0].reasons.includes("shared_window_dates"));
    assert.ok(equal.dependence_links[0].reasons.includes("reused_control_location"));
    assert.equal(equal.inference.reason,"insufficient_registered_groups");
    assert.ok(equal.inference.estimate>0);
    const pooled=eventInference("fixed-controls","overlap-pooled",{estimand:"pooled_area_time"});
    assert.equal(pooled.inference.reason,"overlapping_dates_for_pooled_estimate");
    assert.equal(pooled.inference.lower,null);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("lag plots preserve short-only cases and verify a fixed common cohort without bridging gaps",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  const second="2024-09-20";
  try {
    const {makeSnapshot,windowEffects,registerControl,fixedControls,eventLag}=controlled(directory,monthEnd,second);
    const hours=offset=>offset<0 ? 2 : offset===0 ? 99 : 5;
    windowEffects([makeSnapshot(false,{days:15,hours}),makeSnapshot(false,{days:11,eventDate:second,hours})],"target-effects");
    const known=registerControl("known",0.24), short=registerControl("short",-0.24,null,{eventDate:second});
    const controls=fixedControls([known,short],"target-effects","lag-controls",undefined,2,"post3");
    assert.ok(controls.events[0].contrasts.post7);
    assert.ok(controls.events[1].contrasts.post3);
    assert.equal(controls.events[1].contrasts.post7,null);
    const {result,output}=eventLag("lag-controls","lag-evidence");
    assert.deepEqual(result.cohorts.post3.member_anchors,[monthEnd,second]);
    assert.deepEqual(result.cohorts.post7.member_anchors,[monthEnd]);
    assert.deepEqual(result.cohorts.common.member_anchors,[monthEnd]);
    assert.equal(result.cohorts.common.equal_event_window_effects.post7,controls.events[0].contrasts.post7.change_difference);
    const at=(series,offset)=>result.profiles[series].find(day=>day.offset===offset);
    assert.equal(at("available",3).event_count,2);
    assert.equal(at("available",4).event_count,1);
    assert.equal(at("common",3).event_count,1);
    assert.equal(at("common",4).event_count,1);
    assert.equal(at("common",0).status,"anchor_day_diagnostic");
    assert.equal(at("common",0).density_difference,null);
    assert.equal(result.events[1].daily.find(day=>day.offset===4).target.hours,null);
    assert.equal(result.events[0].daily.find(day=>day.offset===1).target.front_exposure,"near");
    assert.ok(Math.abs(at("common",3).target.hours/at("common",3).target.area_time -
      controls.events[0].contrasts.post3.post.target_density)<1e-12);
    const chart=join(output,"lag.svg"), svg=readFileSync(chart,"utf8");
    assert.match(svg,/data-series="available"/);
    assert.match(svg,/data-series="common"/);
    assert.doesNotMatch(svg,/<polyline/);
    writeFileSync(chart,svg+"tampered");
    assert.equal(spawnSync(process.execPath,[experiment,"--read-fixed-region-result",output],{encoding:"utf8",windowsHide:true}).status,2);

    const laterFront=registerControl("later-front",0.24,5);
    fixedControls([laterFront,short],"target-effects","short-only-controls",undefined,2,"post3");
    const onlyShort=eventLag("short-only-controls","short-only-lag").result;
    assert.equal(onlyShort.cohorts.common.event_count,0);
    assert.equal(onlyShort.cohorts.post3.event_count,2);
    assert.equal(onlyShort.profiles.available.find(day=>day.offset===4).event_count,1);
    assert.equal(onlyShort.profiles.available.find(day=>day.offset===5).density_difference,null);
    assert.equal(onlyShort.profiles.available.find(day=>day.offset===6).event_count,1);
    assert.ok(onlyShort.profiles.common.every(day=>day.density_difference===null));

    const missing=registerControl("missing",0.24,null,{omitAt:5});
    fixedControls([missing,short],"target-effects","control-gap",undefined,2,"post3");
    const gap=eventLag("control-gap","gap-lag").result;
    assert.equal(gap.cohorts.common.event_count,0);
    assert.equal(gap.profiles.available.find(day=>day.offset===4).event_count,1);
    assert.equal(gap.profiles.available.find(day=>day.offset===5).density_difference,null);
    assert.equal(gap.profiles.available.find(day=>day.offset===6).event_count,1);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});

test("one reading pack binds original plot, aggregate tables, interval status and source identities",()=>{
  const directory=mkdtempSync(join(tmpdir(),"ocean-b03-"));
  const second="2024-09-20";
  try {
    const {makeSnapshot,windowEffects,registerControl,fixedControls,eventInference,eventLag,readingPack}=controlled(directory,monthEnd,second);
    const hours=day=>day<0?10:20;
    windowEffects([makeSnapshot(false,{days:15,hours}),makeSnapshot(false,{eventDate:second,hours})],"target-effects");
    const control=registerControl("registered",0.24);
    const b05=fixedControls([control],"target-effects","control-read");
    const b06=eventInference("control-read","group-read",{adjacency_days:21});
    const {result:b07,output:lagOutput}=eventLag("control-read","lag-read");
    const pack=readingPack("control-read","group-read","lag-read","reading-pack");
    assert.deepEqual(pack.result.source_results,{control:b05.result_id,inference:b06.result_id,lag:b07.result_id});
    assert.equal(pack.result.research_ready,false);
    assert.equal(pack.result.inference.reason,"insufficient_registered_groups");
    assert.equal(pack.result.events[0].windows.post3.change_difference,b05.events[0].contrasts.post3.change_difference);
    assert.equal(pack.result.events[1].lag_group_id,2);
    assert.equal(pack.result.events[1].inference_group_id,1);
    assert.equal(pack.result.grouping.inference.groups.length,1);
    assert.equal(pack.result.grouping.lag.groups.length,2);
    assert.equal(readFileSync(join(pack.output,"lag.svg"),"utf8"),readFileSync(join(lagOutput,"lag.svg"),"utf8"));
    const md=readFileSync(join(pack.output,"report.md"),"utf8");
    assert.match(md,/合成样例/);
    assert.match(md,/区间.*组数不足/s);
    assert.match(md,/持续暴露/);
    const csv=readFileSync(join(pack.output,"daily.csv"),"utf8");
    const original=b07.events[0].daily.find(day=>day.offset===1);
    assert.ok(csv.includes(`${monthEnd},2024-09-01,1,${original.target.hours},${original.target.area_time},0,`));
    assert.ok(csv.includes(pack.result.versioned_result_id));
    const [header,...rows]=readFileSync(join(pack.output,"windows.csv"),"utf8").trimEnd().split("\n").map(line=>line.split(","));
    const windows=rows.map(row=>Object.fromEntries(header.map((key,index)=>[key,row[index]])));
    const unknownControl=windows.find(row=>row.anchor_date===second && row.window==="post3" && row.phase==="post");
    assert.equal(unknownControl.control_hours,"");
    assert.ok(Number(unknownControl.target_hours)>0);
    const incomplete=windows.find(row=>row.anchor_date===second && row.window==="post7" && row.phase==="post");
    assert.equal(incomplete.target_hours,"");
    assert.ok(Number(incomplete.target_known_subset_hours)>0);
    assert.equal(incomplete.target_supported_days,"3");
    assert.match(incomplete.target_excluded_dates,/2024-09-24/);
    for(const file of ["lag.svg","daily.csv","windows.csv"]) {
      assert.equal(JSON.parse(readFileSync(join(pack.output,"manifest.json"),"utf8")).artifacts[file],digest(readFileSync(join(pack.output,file))));
    }
    readingPack("control-read","group-read","lag-read","tampered-plot",{corruptFigure:true,expectFailure:true});
    readingPack("control-read","group-read","lag-read","public-pack",{use:"public",expectFailure:true});
    fixedControls([],"target-effects","different-control");
    eventInference("different-control","different-group");
    readingPack("control-read","different-group","lag-read","different-inputs",{expectFailure:true});
    unlinkSync(join(lagOutput,"lag.svg"));
    assert.equal(spawnSync(process.execPath,[experiment,"--read-fixed-region-result",pack.output],{encoding:"utf8",windowsHide:true,
      env:{...process.env,OCEAN_EXPERIMENT_PYTHON:"unavailable"}}).status,0);
  } finally {
    if(dirname(resolve(directory))===resolve(tmpdir())&&basename(directory).startsWith("ocean-b03-"))rmSync(directory,{recursive:true,force:true});
  }
});
