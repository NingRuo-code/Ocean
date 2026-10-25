import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const cli = resolve("tools/audit-research-baseline.mjs");
function workspace() {
  const root = mkdtempSync(join(tmpdir(), "ocean-source-audit-"));
  mkdirSync(join(root, "private-input"));
  writeFileSync(join(root, "private-input", "daily.csv"), "abc");
  const registry = {
    schema: "ocean-source-registry/v1",
    processing_version: "known-fixture-v1",
    sources: [{ id: "activity-original", kind: "activity", role: "analysis_source",
      locations: ["private-input/daily.csv"],
      product: { id: "fixture-effort", channel: "local-authorized-sample", version: "v1", unit: "fishing_hours" },
      derived_from: [], license_claims: [] }],
  };
  const registryPath = join(root, "registry.json");
  writeFileSync(registryPath, JSON.stringify(registry));
  return { root, registry, registryPath, output: join(root, "public.json") };
}
function run(w, extra = []) {
  return spawnSync(process.execPath, [cli, "--source-registry", w.registryPath,
    "--source-root", w.root, "--out", w.output, ...extra], { encoding: "utf8" });
}

test("explicit audit publishes a content-addressed summary without promoting readable data to research support", () => {
  const w = workspace();
  const result = run(w, ["--report-out", join(w.root, "report.md"), "--private-out", join(w.root, "internal.json")]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(w.output, "utf8"));
  assert.equal(report.schema, "ocean-source-audit/v1");
  assert.match(report.snapshot_id, /^sha256:[a-f0-9]{64}$/);
  const source = report.sources[0];
  assert.equal(source.inspection.access, "readable");
  assert.equal(source.inspection.semantic_verification, "not_performed");
  assert.equal(source.inspection.effective_support, "unknown");
  assert.equal(source.files[0].sha256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(source.license.status, "unknown");
  assert.equal(report.research_ready, false);
  assert.equal(report.public_release_approved, false);
  assert.ok(!readFileSync(w.output, "utf8").includes(w.root));
  assert.ok(!readFileSync(w.output, "utf8").includes("private-input"));
  assert.ok(readFileSync(join(w.root, "report.md"), "utf8").includes("unknown"));
  assert.ok(readFileSync(join(w.root, "internal.json"), "utf8").includes(w.root.replaceAll("\\", "\\\\")));
});

test("reading a frozen snapshot does not reopen or rescan original inputs", () => {
  const w = workspace();
  assert.equal(run(w).status, 0);
  const original = JSON.parse(readFileSync(w.output, "utf8"));
  unlinkSync(join(w.root, "private-input", "daily.csv"));
  unlinkSync(w.registryPath);
  const result = spawnSync(process.execPath, [cli, "--read-snapshot", w.output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), original);
});

test("unknown declarations, missing inputs and conflicting license evidence remain visible gaps", () => {
  const w = workspace();
  w.registry.sources[0].license_claims = [
    { value: "CC BY 4.0", evidence: "local-metadata" },
    { value: "CC BY-NC 4.0", evidence: "channel-marker" },
  ];
  w.registry.sources.push({ id: "display-only", kind: "activity", role: "display",
    locations: ["absent.csv"], derived_from: ["missing-parent"] });
  writeFileSync(w.registryPath, JSON.stringify(w.registry));
  const result = run(w);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(w.output, "utf8"));
  assert.equal(report.sources[0].license.status, "conflict");
  const missing = report.sources[1];
  assert.equal(missing.inspection.declaration, "incomplete");
  assert.equal(missing.inspection.access, "missing");
  assert.equal(missing.inventory.files_discovered, null);
  assert.equal(missing.inventory.bytes_read, null);
  assert.equal(missing.product.unit, null);
  assert.ok(missing.gaps.includes("lineage_unknown:missing-parent"));
  assert.equal(report.research_ready, false);
});

test("output choices cannot overwrite source evidence or mix private locators into the public snapshot", () => {
  for (const target of ["registry", "source", "private-collision"]) {
    const w = workspace();
    const input = target === "registry" ? w.registryPath : join(w.root, "private-input", "daily.csv");
    const before = readFileSync(input, "utf8");
    const output = target === "private-collision" ? w.output : input;
    const extra = target === "private-collision" ? ["--private-out", output] : [];
    const result = spawnSync(process.execPath, [cli, "--source-registry", w.registryPath,
      "--source-root", w.root, "--out", output, ...extra], { encoding: "utf8" });
    assert.equal(result.status, 1, target);
    assert.equal(readFileSync(input, "utf8"), before);
  }
});
