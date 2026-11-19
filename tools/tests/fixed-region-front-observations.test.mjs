import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {basename, dirname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";

const entry = resolve("tools/run-front-response-experiment.mjs");
const start = "2024-08-30", end = "2024-09-08";
const dates = Array.from({length:14}, (_, i) => new Date(Date.UTC(2024, 7, 28+i)).toISOString().slice(0, 10));
const line = (id, longitude) => ({id, points:[[longitude,-0.01],[longitude,0.01]]});
const near = [line("F7",0.04),line("F3",-0.04)];
const relabelled = [line("F9",-0.04),line("F2",0.04)];
const between = [line("F0",0.1)]; // Equatorial geodesic is 11.13 km from centre, 1.13 km outside the circle.

function scenario(days, work, updateSource = () => {}) {
  const dir = mkdtempSync(join(tmpdir(),"ocean-event-b02-"));
  const input = join(dir,"input.json"), params = join(dir,"request.json"), output = join(dir,"run");
  const document = {
    schema:"ocean-fixed-region-front-observations/v1",id:"registered-analytic-fronts",license:"CC0-1.0",
    front_source_id:"front-original",front_position_error_km:0.01,
    geometry:{longitude:0,latitude:0,radius_km:10},
    policy:{enter_distance_km:0.8,exit_distance_km:2,persistence_days:2,clear_days:2},
    regional_cells:{schema:"ocean-regional-cells/v1",evidence_kind:"synthetic",days:days.flatMap((objects,i) => objects === null ? [] : [{
      date:dates[i],layers:[{id:"front-original",kind:"front",role:"analysis_source",unit:"classification_code",
        time_verified:true,bounds_verified:true,support_verified:true,duration_days:1,
        cells:[{bounds:[-0.4,-0.4,0.4,0.4],support:"valid"}]}],
    }])},
    front_days:days.flatMap((objects,i) => objects === null ? [] : [{date:dates[i],source_id:"front-original",objects}]),
  };
  updateSource(document);
  const source = JSON.stringify(document);
  writeFileSync(input,source);
  writeFileSync(params,JSON.stringify({purpose:"fixed_region_event_example",longitude:0,latitude:0,radius_km:10,
    search_start:start,search_end:end,input_version:"sha256:"+createHash("sha256").update(source).digest("hex"),
    method_version:"observed-fixed-exposure/v1",parameter_version:"front-continuity/v1"}));
  const cli=(args, env={}) => spawnSync(process.execPath,[entry,...args],{
    encoding:"utf8",windowsHide:true,env:{...process.env,...env},
  });
  try {
    const result = cli(["--fixed-region-request",params,"--input",input,"--output",output]);
    assert.equal(result.status,0,result.stderr || result.stdout);
    work(JSON.parse(readFileSync(join(output,"summary.json"),"utf8")), {output,input,params,cli});
  } finally {
    if(dirname(resolve(dir))===resolve(tmpdir())&&basename(dir).startsWith("ocean-event-b02-"))rmSync(dir,{recursive:true,force:true});
  }
}

test("registered fixed-circle observations identify continuity, named gaps, re-entry and censored ends", () => {
  scenario([[],[],[...near,line("F5",0.18)],relabelled,null,[],near,[],[],near,near,between,near,null], (result, files) => {
    assert.deepEqual(result.read_range,{start:"2024-08-28",end:"2024-09-10"});
    assert.equal(result.research_ready,false);
    assert.ok(Math.abs(result.geometry.area_km2 - Math.PI*100)<0.1);
    const {observations,events} = result.selection;
    assert.equal(observations.length,14);
    assert.deepEqual(observations[2].object_ids,["F3","F5","F7"]);
    assert.deepEqual(observations[2].objects.map(object => [object.id,object.phase]),[["F3","near"],["F5","clear"],["F7","near"]]);
    assert.equal(observations[2].competing_objects,true);
    assert.deepEqual(observations[3].object_ids,["F2","F9"]);
    assert.equal(observations[4].state,"unknown");
    assert.equal(observations[11].phase,"between_thresholds");
    assert.ok(observations[11].distance_km.lower>1.05 && observations[11].distance_km.upper<1.2);
    assert.deepEqual(events.map(event => event.anchor_date),["2024-08-30","2024-09-06"]);
    assert.deepEqual(events[0].unknown_dates,["2024-09-01"]);
    assert.ok(events[0].merged_dates.includes("2024-09-02"));
    assert.deepEqual(events[0].near_segments,[{start:"2024-08-30",end:"2024-08-31"},{start:"2024-09-03",end:"2024-09-03"}]);
    assert.equal(events[0].exit_observed_date,"2024-09-05");
    assert.equal(events[1].right_truncated,true);
    assert.equal(events[1].exit_observed_date,null);
    assert.doesNotMatch(JSON.stringify(result),/"points"|\[\[0\.04/);
    assert.match(readFileSync(join(files.output,"report.md"),"utf8"),/2024-08-30.*2024-09-06/s);
    unlinkSync(files.input);unlinkSync(files.params);
    const frozen = files.cli(["--read-fixed-region-result",files.output],{OCEAN_EXPERIMENT_PYTHON:"unused"});
    assert.equal(frozen.status,0,frozen.stderr);
    assert.deepEqual(JSON.parse(frozen.stdout),result);
  });
});

test("fully observed no event differs from a first sighting without entry context", () => {
  scenario(dates.map(() => []), result => {
    assert.equal(result.status,"no_observed_entry");
    assert.deepEqual(result.selection.events,[]);
  });
  scenario(dates.map((_,i) => i===12 ? near : i===13 ? null : []), result => {
    assert.equal(result.status,"no_observed_entry");
    assert.equal(result.selection.events[0].right_truncated,true);
    assert.equal(result.selection.events[0].accepted,false);
  });
  scenario(dates.map((_,i) => i===0 ? null : i<4 ? near : []), result => {
    assert.equal(result.status,"observation_incomplete");
    assert.equal(result.selection.events[0].left_truncated,true);
    assert.equal(result.selection.events[0].anchor_date,null);
    assert.equal(result.selection.events[0].reason,"prior_clear_period_unproven");
  });
});

test("missing line material, insufficient search coverage and an uncertain threshold are distinct", () => {
  const points = dates.map(() => []);
  points[4] = [line("F1",10.8 / 111.31949)]; // Straddles the registered 0.8 km entry threshold.
  scenario(points, result => {
    const observed = result.selection.observations;
    assert.equal(result.status,"observation_incomplete");
    assert.equal(observed[2].state,"unknown");
    assert.ok(observed[2].reasons.includes("front_line_material_missing"));
    assert.equal(observed[3].state,"unknown");
    assert.ok(observed[3].reasons.includes("insufficient_search_support"));
    assert.equal(observed[4].state,"unknown");
    assert.ok(observed[4].reasons.includes("distance_interval_crosses_band"));
    assert.deepEqual(result.selection.events,[]);
  }, source => {
    source.front_days.splice(2,1);
    source.regional_cells.days[3].layers[0].cells[0].bounds=[-0.01,-0.01,0.01,0.01];
  });
});
