import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const entry = resolve("tools/run-front-response-experiment.mjs");
function scenario(work) {
  const root=mkdtempSync(join(tmpdir(),"ocean-comparability-"));
  const request=join(root,"request.json"), source=join(root,"snapshots.json"), out=join(root,"result");
  writeFileSync(request,readFileSync("docs/data/regional-comparability-month.example.json"));
  writeFileSync(source,readFileSync("backend/app/examples/regional-comparability-snapshots.json"));
  const call=(args,env={})=>spawnSync(process.execPath,[entry,...args],{encoding:"utf8",windowsHide:true,env:{...process.env,...env}});
  try { work({root,request,source,out,call,submit:()=>call(["--regional-comparison-request",request,"--input",source,"--output",out])}); }
  finally { if(dirname(resolve(root))===resolve(tmpdir())&&basename(root).startsWith("ocean-comparability-"))rmSync(root,{recursive:true,force:true}); }
}

test("actual comparison entry reads a partial three-region matrix and explains every metric",()=>scenario(({out,submit})=>{
  const response=submit();assert.equal(response.status,0,response.stderr);
  const result=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
  assert.equal(result.status,"partial");assert.equal(result.rows.length,3);
  assert.equal(result.pairs[0].metrics.total_hours.status,"comparable");
  assert.equal(result.rows[0].metric_assessments.total_hours.value,40);
  assert.equal(result.rows[1].metric_assessments.total_hours.value,0);
  assert.equal(result.rows[2].metric_assessments.total_hours.status,"not_ready");
  const report=readFileSync(join(out,"report.md"),"utf8");
  assert.ok(report.includes("区域 × 指标")&&report.includes("区域对 × 指标"));
  assert.ok(report.includes("source_result_missing")&&report.includes("comparable"));
}));

test("metric-local incompatibility leaves other qualified metrics and the third missing column intact",()=>scenario(({source,out,submit})=>{
  writeFileSync(source,readFileSync(source,"utf8").replace('"weighting": "additive-hours/v1"','"weighting": "event_equal/v1"'));
  assert.equal(submit().status,0);
  const result=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
  assert.equal(result.pairs[0].metrics.total_hours.status,"incomparable");
  assert.equal(result.pairs[0].metrics.density_hours_per_km2_day.status,"comparable");
  assert.equal(result.rows.length,3);
  assert.ok(readFileSync(join(out,"report.md"),"utf8").includes("metric_semantics_mismatch"));
}));

test("compatibility snapshot reopens without Python or inputs and rejects a changed report",()=>scenario(({request,source,out,call,submit})=>{
  assert.equal(submit().status,0);
  const frozen=readFileSync(join(out,"summary.json"),"utf8");
  assert.equal(submit().status,2);
  unlinkSync(request);unlinkSync(source);
  const read=call(["--read-regional-comparison-result",out],{OCEAN_EXPERIMENT_PYTHON:"unavailable"});
  assert.equal(read.status,0);assert.deepEqual(JSON.parse(read.stdout),JSON.parse(frozen));
  writeFileSync(join(out,"report.md"),"changed");
  assert.equal(call(["--read-regional-comparison-result",out]).status,2);
}));

test("event compatibility uses actual separate windows and source identities",()=>scenario(({request,out,submit})=>{
  writeFileSync(request,readFileSync("docs/data/regional-comparability-event.example.json"));
  assert.equal(submit().status,0);
  const result=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
  assert.equal(result.rows[0].metric_assessments["post1_3.total_hours"].value,36);
  assert.equal(result.rows[0].metric_assessments["post1_7.total_hours"].value,56);
  assert.equal(result.rows[1].metric_assessments["post1_7.total_hours"].value,0);
  assert.equal(result.pairs[0].metrics["post1_3.total_hours"].status,"comparable");
  assert.equal(result.rows[0].source_result_id,"sha256:165250767af9f9d72d11b8fcaeb00f7fe3c3ffcdcb2f19fdec5594de5a170ffc");
}));

test("unknown freshness is readable but never advertised as a currently qualified pair",()=>scenario(({source,out,submit})=>{
  writeFileSync(source,readFileSync(source,"utf8").replace('"freshness": "verified_frozen"','"freshness": "unknown"'));
  assert.equal(submit().status,0);
  const result=JSON.parse(readFileSync(join(out,"summary.json"),"utf8"));
  assert.equal(result.status,"no_comparable_pairs");
  assert.equal(result.rows[0].metric_assessments.total_hours.original_value,40);
  assert.equal(result.pairs[0].metrics.total_hours.status,"limited_side_by_side");
}));
