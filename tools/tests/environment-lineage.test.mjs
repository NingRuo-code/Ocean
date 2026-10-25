import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve("tools/audit-research-baseline.mjs");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ocean-lineage-"));
  return { root, config: join(root, "environments.json"), output: join(root, "comparison.json") };
}
function snapshot(w, name, content = "abc", processing = "fixture-v1", sourceOptions = {}) {
  const folder = join(w.root, name);
  mkdirSync(folder);
  writeFileSync(join(folder, "daily.csv"), content);
  const registry = { schema: "ocean-source-registry/v1", processing_version: processing, sources: [
    { id: "effort", kind: "activity", role: "analysis_source", locations: ["daily.csv"],
      product: { id: "fixture", channel: "synthetic", version: "v1", unit: "fishing_hours" },
      derived_from: [], license_claims: [], ...sourceOptions },
  ] };
  writeFileSync(join(folder, "registry.json"), JSON.stringify(registry));
  const output = join(folder, "snapshot.json");
  const r = spawnSync(process.execPath, [cli, "--source-registry", join(folder, "registry.json"), "--source-root", folder, "--out", output, "--private-out", join(folder, "private.json")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return output;
}
function compare(w, environments) {
  writeFileSync(w.config, JSON.stringify({ schema: "ocean-environment-lineage-config/v1", environments }));
  return spawnSync(process.execPath, [cli, "--compare-environments", w.config, "--out", w.output, "--report-out", join(w.root, "comparison.md")], { encoding: "utf8" });
}
function daily(folder, resolution, options = {}) {
  const registry = join(folder, "daily-config.json"), output = join(folder, "daily.json");
  writeFileSync(registry, JSON.stringify({ schema: "ocean-daily-audit-registry/v1", evidence_kind: "synthetic", sources: [{ id: "effort", day_boundary: "UTC", format: "activity-csv", resolution_deg: resolution, ...options }] }));
  const r = spawnSync(process.execPath, [cli, "--daily-registry", registry, "--source-snapshot", join(folder, "snapshot.json"), "--private-locators", join(folder, "private.json"), "--start", "2024-08-05", "--end", "2024-08-05", "--out", output], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return output;
}

test("same frozen content at different paths matches bytes without inventing deployment or research identity", () => {
  const w = fixture();
  const a = snapshot(w, "local"), b = snapshot(w, "offline");
  const r = compare(w, [{ id: "local", source_snapshot: a, evidence_kind: "synthetic" }, { id: "offline", source_snapshot: b, evidence_kind: "synthetic" }, { id: "server", evidence_kind: "captured_remote_artifacts" }]);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(readFileSync(w.output, "utf8"));
  const row = report.comparisons.find(c => c.left === "local" && c.right === "offline").sources[0];
  assert.equal(row.content.status, "matched");
  assert.equal(row.fields.find(f => f.field === "processing_version").status, "matched");
  assert.equal(report.environments[0].deployment_commit, null);
  assert.equal(report.comparisons.find(c => c.right === "server").sources[0].content.status, "unknown");
  assert.equal(report.research_ready, false);
  assert.equal(report.public_release_approved, false);
  assert.ok(!readFileSync(w.output, "utf8").includes(w.root.replaceAll("\\", "\\\\")));
  unlinkSync(a); unlinkSync(b); unlinkSync(w.config);
  const replay = spawnSync(process.execPath, [cli, "--read-environment-comparison", w.output], { encoding: "utf8" });
  assert.equal(replay.status, 0, replay.stderr);
  assert.deepEqual(JSON.parse(replay.stdout), report);
});

test("daily audit evidence exposes date, unit and resolution declarations separately from raw precision", () => {
  const w = fixture();
  const content = "date,lon,lat,hours,unit\n2024-08-05,122,30,2,fishing_hours\n";
  const a = snapshot(w, "local", content), b = snapshot(w, "offline", content);
  const da = daily(join(w.root, "local"), .01), db = daily(join(w.root, "offline"), .1);
  const r = compare(w, [{ id: "local", source_snapshot: a, daily_snapshot: da, evidence_kind: "synthetic" }, { id: "offline", source_snapshot: b, daily_snapshot: db, evidence_kind: "synthetic" }]);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(readFileSync(w.output, "utf8"));
  const row = report.comparisons[0].sources[0];
  assert.equal(row.content.status, "matched");
  assert.equal(row.fields.find(f => f.field === "daily.resolution_declared").status, "different");
  assert.equal(row.fields.find(f => f.field === "daily.dates").status, "matched");
  assert.equal(row.fields.find(f => f.field === "daily.resolution_observed").status, "unknown");
  assert.deepEqual(report.environments[0].daily_summary[0].actual_dates, ["2024-08-05"]);
  assert.equal(report.research_ready, false);
});

test("same source with a different hours field exposes changed daily processing and result evidence", () => {
  const w = fixture();
  const content = "date,lon,lat,hours,alt_hours,unit\n2024-08-05,122,30,2,20,fishing_hours\n";
  const a = snapshot(w, "local", content), b = snapshot(w, "offline", content);
  const da = daily(join(w.root, "local"), .01), db = daily(join(w.root, "offline"), .01, { hours_field: "alt_hours" });
  assert.equal(compare(w, [{ id: "local", source_snapshot: a, daily_snapshot: da, evidence_kind: "synthetic" }, { id: "offline", source_snapshot: b, daily_snapshot: db, evidence_kind: "synthetic" }]).status, 0);
  const row = JSON.parse(readFileSync(w.output, "utf8")).comparisons[0].sources[0];
  assert.equal(row.content.status, "matched");
  assert.equal(row.fields.find(f => f.field === "daily.audit_configuration").status, "different");
  assert.equal(row.fields.find(f => f.field === "daily.auditor").status, "matched");
  assert.equal(row.fields.find(f => f.field === "daily.result_evidence").status, "different");
  assert.equal(row.status, "different");
});

test("same name and size cannot hide changed bytes, processing, roles or license evidence", () => {
  const w = fixture();
  const a = snapshot(w, "local", "abc");
  const b = snapshot(w, "offline", "xyz", "old-v0", { role: "precomputed", license_claims: [{ value: "CC BY 4.0", evidence: "synthetic-one" }, { value: "CC BY-NC 4.0", evidence: "synthetic-two" }] });
  const r = compare(w, [{ id: "local", source_snapshot: a, evidence_kind: "synthetic" }, { id: "offline", source_snapshot: b, evidence_kind: "synthetic" }]);
  assert.equal(r.status, 0, r.stderr);
  const row = JSON.parse(readFileSync(w.output, "utf8")).comparisons[0].sources[0];
  assert.equal(row.content.status, "different");
  for (const field of ["processing_version", "role", "license_claims"])
    assert.equal(row.fields.find(f => f.field === field).status, "different");
  assert.ok(row.reasons.includes("license_claim_conflict"));
});

test("latest acquisition and missing lineage remain unknown rather than borrowing audit or deployment dates", () => {
  const w = fixture();
  const options = { derived_from: ["missing-parent"], product: { id: "fixture", channel: "synthetic", version: "latest", unit: "fishing_hours" } };
  const a = snapshot(w, "local", "abc", "fixture-v1", options), b = snapshot(w, "offline", "abc", "fixture-v1", options);
  const env = [{ id: "local", source_snapshot: a, evidence_kind: "synthetic" }, { id: "offline", source_snapshot: b, evidence_kind: "synthetic" }];
  assert.equal(compare(w, env).status, 0);
  let report = JSON.parse(readFileSync(w.output, "utf8"));
  assert.equal(report.environments[0].acquired_at, null);
  assert.ok(report.environments[0].reasons.includes("dynamic_latest_acquisition_unknown"));
  assert.ok(report.comparisons[0].sources[0].reasons.includes("lineage_support_unknown"));
  env[0].acquired_at = "2024-08-06T00:00:00Z";
  assert.equal(compare(w, env).status, 0);
  report = JSON.parse(readFileSync(w.output, "utf8"));
  assert.equal(report.environments[0].acquired_at, "2024-08-06T00:00:00.000Z");
  assert.ok(!report.environments[0].reasons.includes("dynamic_latest_acquisition_unknown"));
  assert.equal(report.environments[0].deployment_commit, null);
});

test("frozen evidence drift, unsafe output and partial content cannot be mistaken for a full match", () => {
  const w = fixture();
  const a = snapshot(w, "local"), b = snapshot(w, "offline");
  const env = [{ id: "local", source_snapshot: a, evidence_kind: "synthetic" }, { id: "offline", source_snapshot: b, evidence_kind: "synthetic" }];
  assert.equal(compare(w, env).status, 0);
  const before = readFileSync(a, "utf8");
  writeFileSync(a, before.replace('"fixture-v1"', '"tampered-v1"'));
  const bad = compare(w, env);
  assert.equal(bad.status, 1);
  assert.ok(!bad.stderr.includes(w.root));
  writeFileSync(a, before);
  w.output = a;
  assert.equal(compare(w, env).status, 1);
  assert.equal(readFileSync(a, "utf8"), before);
  w.output = join(w.root, "comparison.json");
  const partial = snapshot(w, "partial", "abc", "fixture-v1", { locations: ["daily.csv", "missing.csv"] });
  env[1].source_snapshot = partial;
  assert.equal(compare(w, env).status, 0);
  assert.equal(JSON.parse(readFileSync(w.output, "utf8")).comparisons[0].sources[0].content.status, "unknown");
});
