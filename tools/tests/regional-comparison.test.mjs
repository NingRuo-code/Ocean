import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const entry = resolve("tools/run-front-response-experiment.mjs");
function scenario(work) {
  const root = mkdtempSync(join(tmpdir(), "ocean-comparison-cli-"));
  const request = join(root, "request.json"), source = join(root, "snapshots.json");
  writeFileSync(request, readFileSync("docs/data/regional-comparison-month.example.json"));
  writeFileSync(source, readFileSync("backend/app/examples/regional-known-snapshots.json"));
  const call = (args, env = {}) => spawnSync(process.execPath, [entry, ...args], {
    encoding: "utf8", windowsHide: true, env: { ...process.env, ...env },
  });
  const out = join(root, "comparison");
  try { work({ root, request, source, out, call,
    submit: () => call(["--regional-comparison-request", request, "--input", source, "--output", out]),
  }); }
  finally {
    if (dirname(resolve(root)) === resolve(tmpdir()) && basename(root).startsWith("ocean-comparison-cli-")) {
      rmSync(root, { recursive: true, force: true });
    }
  }
}

test("original entry reads two already-computed regional snapshots and writes a readable comparison", () => scenario(({ out, submit }) => {
  const response = submit();
  assert.equal(response.status, 0, response.stderr);
  const result = JSON.parse(readFileSync(join(out, "summary.json"), "utf8"));
  assert.equal(result.kind, "regional_comparison_example");
  assert.equal(result.rows[0].metrics.total_hours, 40);
  assert.equal(result.rows[0].metrics.area_time_km2_days, 7);
  assert.equal(result.rows[1].metrics.total_hours, 0);
  assert.equal(result.rows[1].metrics.area_time_km2_days, 4);
  assert.equal(result.rows[0].source_result_id, "sha256:d90e75c6573eeccea442e0bded57b5faffb7401bb1ca9b4bef05b2f197b736ea");
  const report = readFileSync(join(out, "report.md"), "utf8");
  assert.ok(report.includes("区域甲") && report.includes("区域乙"));
  assert.ok(report.includes("fishing_hours") && report.includes("40"));
  assert.equal(result.research_ready, false);
}));

test("comparison reopens without source files or Python and refuses overwrite or changed nested conditions", () => scenario(({ request, source, out, call, submit }) => {
  assert.equal(submit().status, 0);
  const frozen = readFileSync(join(out, "summary.json"), "utf8");
  assert.equal(submit().status, 2);
  assert.equal(readFileSync(join(out, "summary.json"), "utf8"), frozen);
  unlinkSync(request); unlinkSync(source);
  const read = call(["--read-regional-comparison-result", out], { OCEAN_EXPERIMENT_PYTHON: "not-available" });
  assert.equal(read.status, 0, read.stderr);
  assert.deepEqual(JSON.parse(read.stdout), JSON.parse(frozen));
  const path = join(out, "manifest.json"), manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.parameters.candidates[0].name = "different label";
  writeFileSync(path, JSON.stringify(manifest));
  assert.equal(call(["--read-regional-comparison-result", out]).status, 2);
}));

test("comparison reuses identical normalized inputs and excludes a source whose permission changes", () => scenario(({ root, request, source, out, call, submit }) => {
  const first = submit();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).source_freshness, "unknown");
  const frozen = readFileSync(join(out, "summary.json"), "utf8");
  const initial = JSON.parse(frozen);
  assert.equal(initial.result_id, "sha256:ad186603a839ab2fcd52cd5620980ecfbe750361ea83ff0af2d432eda28a4b52");
  const retry = join(root, "retry");
  const reuse = () => call(["--regional-comparison-request", request, "--input", source,
    "--reuse-regional-comparison-result", out, "--output", retry]);

  // JSON transport formatting can change while the requested conditions and source content do not.
  writeFileSync(request, JSON.stringify(JSON.parse(readFileSync(request, "utf8"))));
  const repeated = reuse();
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).reused, true);
  assert.equal(JSON.parse(repeated.stdout).result_id, initial.result_id);
  assert.equal(existsSync(retry), false);

  const sourceText = readFileSync(source, "utf8");
  const index = JSON.parse(sourceText).snapshots.findIndex(entry => entry.result.result_id === initial.rows[1].source_result_id);
  assert.ok(index >= 0);
  let seen = 0;
  writeFileSync(source, sourceText.replace(/"access": "public_aggregate"/g,
    match => seen++ === index ? '"access": "owner_only"' : match));
  const afterPermissionChange = reuse();
  assert.equal(afterPermissionChange.status, 0, afterPermissionChange.stderr);
  assert.equal(JSON.parse(afterPermissionChange.stdout).reused, false);
  const changed = JSON.parse(readFileSync(join(retry, "summary.json"), "utf8"));
  assert.notEqual(changed.result_id, initial.result_id);
  assert.equal(changed.rows[0].metrics.total_hours, 40);
  assert.equal(changed.rows[1].reason, "source_not_public");
  assert.equal(changed.rows[1].metrics, undefined);
  assert.equal(changed.rows[1].candidate.source, undefined);
  assert.equal(changed.parameters.candidates[1].snapshot_sha256, undefined);
  assert.doesNotMatch(readFileSync(join(retry, "report.md"), "utf8"),
    new RegExp(initial.rows[1].source_result_id));
  assert.equal(readFileSync(join(out, "summary.json"), "utf8"), frozen);
}));

test("missing snapshots keep candidates and prerequisites while withholding unverified source details", () => scenario(({ request, source, out, submit }) => {
  const pack = JSON.parse(readFileSync(source, "utf8"));
  pack.snapshots = [];
  writeFileSync(source, JSON.stringify(pack));
  const requested = JSON.parse(readFileSync(request, "utf8"));
  requested.candidates[0].source.id = "unverified-source-label";
  writeFileSync(request, JSON.stringify(requested));
  assert.equal(submit().status, 0);
  const result = JSON.parse(readFileSync(join(out, "summary.json"), "utf8"));
  assert.equal(result.status, "not_ready");
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].reason, "source_result_missing");
  assert.equal(result.rows[0].required, "existing_A_result");
  assert.equal(result.rows[0].metrics, undefined);
  assert.equal(result.rows[0].candidate.result_id, undefined);
  assert.doesNotMatch(JSON.stringify(result) + readFileSync(join(out, "report.md"), "utf8"),
    /unverified-source-label/);
}));

test("event snapshots stay in their own board with actual four-window values", () => scenario(({ request, out, submit }) => {
  writeFileSync(request, readFileSync("docs/data/regional-comparison-event.example.json"));
  assert.equal(submit().status, 0);
  const result = JSON.parse(readFileSync(join(out, "summary.json"), "utf8"));
  assert.equal(result.analysis_kind, "fixed_region_event_example");
  assert.equal(result.rows[0].windows.post1_3.total_hours, 36);
  assert.equal(result.rows[0].windows.post1_7.total_hours, 56);
  assert.equal(result.rows[1].windows.post1_7.total_hours, 0);
  assert.equal(result.rows[0].source_result_id, "sha256:165250767af9f9d72d11b8fcaeb00f7fe3c3ffcdcb2f19fdec5594de5a170ffc");
  assert.equal(result.rows[0].metrics, undefined);
  const report = readFileSync(join(out, "report.md"), "utf8");
  assert.ok(report.includes("post1_3") && report.includes("post1_7"));
}));

test("duplicate-key, invalid UTF-8 and over-budget packs fail without publishing a partial table", () => {
  for (const kind of ["duplicate", "utf8", "budget"]) scenario(({ source, out, submit }) => {
    const bytes = readFileSync(source);
    if (kind === "duplicate") writeFileSync(source, bytes.toString("utf8").replace('"snapshots": [', '"snapshots": [], "snapshots": ['));
    else if (kind === "utf8") { bytes[bytes.indexOf(Buffer.from("CC0-1.0"))] = 255; writeFileSync(source, bytes); }
    else writeFileSync(source, " ".repeat(1_048_577));
    assert.equal(submit().status, 2);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    assert.equal(manifest.state, "failed");
    assert.equal(manifest.error.code, "controlled_comparison_failed");
    assert.equal(existsSync(join(out, "summary.json")), false);
    assert.equal(existsSync(join(out, "report.md")), false);
    assert.equal(JSON.stringify(manifest).includes(source), false);
  });
});

test("comparison and event result purposes cannot be exchanged by selecting another reader", () => scenario(({ out, call, submit }) => {
  assert.equal(submit().status, 0);
  assert.equal(call(["--read-fixed-region-result", out]).status, 2);
  assert.equal(call(["--read-regional-comparison-result", out, "--output", out]).status, 2);
  writeFileSync(join(out, "report.md"), "modified report");
  assert.equal(call(["--read-regional-comparison-result", out]).status, 2);
}));

test("frozen comparison keeps region identity across reorder, method switch and failed replacement", () => scenario(({ root, request, source, out, call, submit }) => {
  const original = JSON.parse(readFileSync(request, "utf8"));
  const sourceText = readFileSync(source, "utf8");
  const pack = JSON.parse(sourceText);
  const compatibility = JSON.parse(readFileSync("backend/app/examples/regional-comparability-snapshots.json", "utf8"));
  writeFileSync(request, JSON.stringify(original));
  assert.equal(submit().status, 0);
  const frozen = readFileSync(join(out, "summary.json"), "utf8");
  const initial = JSON.parse(frozen);
  assert.equal(initial.rows[0].metrics.total_hours, 40);
  assert.equal(initial.rows[1].metrics.total_hours, 0);
  const rewrite = (name, input) => {
    writeFileSync(request, JSON.stringify(input));
    const directory = join(root, name);
    const run = call(["--regional-comparison-request", request, "--input", source,
      "--reuse-regional-comparison-result", out, "--output", directory]);
    assert.equal(run.status, 0, run.stderr);
    const receipt = JSON.parse(run.stdout);
    assert.equal(receipt.reused, false);
    assert.notEqual(receipt.result_id, initial.result_id);
    assert.equal(receipt.source_freshness, "unknown");
    return JSON.parse(readFileSync(join(directory, "summary.json"), "utf8"));
  };
  const reordered = rewrite("reordered", { ...original, candidates: [...original.candidates].reverse() });
  assert.deepEqual(reordered.rows.map(row => row.candidate.id), initial.rows.map(row => row.candidate.id).reverse());
  assert.deepEqual(reordered.rows.map(row => row.metrics), initial.rows.map(row => row.metrics).reverse());
  const updatedMethod = rewrite("method-v2", { ...original, method_version: "known-snapshots/v2" });
  assert.equal(updatedMethod.parameters.method_version, "known-snapshots/v2");
  assert.ok(Array.isArray(updatedMethod.pairs));

  const replaced = original.candidates[0];
  const index = pack.snapshots.findIndex(value => value.result.result_id === replaced.result_id);
  assert.ok(index >= 0);
  const entry = pack.snapshots[index];
  const facts = { ...compatibility.snapshots[0].comparison_facts,
    result_id: entry.result.result_id, snapshot_sha256: entry.snapshot_sha256, source_state: "failed" };
  let position = 0;
  writeFileSync(source, sourceText.replace(/"access": "public_aggregate"/g,
    match => position++ === index ? `"comparison_facts": ${JSON.stringify(facts)}, ${match}` : match));
  const reviewed = rewrite("failed-source", original);
  assert.equal(reviewed.rows[0].reason, "source_failed");
  assert.equal(reviewed.rows[0].metrics, undefined);
  assert.equal(reviewed.rows[0].candidate.result_id, undefined);
  assert.deepEqual(reviewed.rows[1].metrics, initial.rows[1].metrics);
  const read = call(["--read-regional-comparison-result", out], { OCEAN_EXPERIMENT_PYTHON: "not-available" });
  assert.equal(read.status, 0, read.stderr);
  assert.deepEqual(JSON.parse(read.stdout), initial);
  assert.equal(readFileSync(join(out, "summary.json"), "utf8"), frozen);
}));
