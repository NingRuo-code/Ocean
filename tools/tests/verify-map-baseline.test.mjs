import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scenarios = ["navigation", "reload", "date-change", "zoom", "drag"];
function receipt() {
  const attempts = scenarios.flatMap(scenario => Array.from({ length: 20 }, (_, i) => {
    const run = i + 1;
    const timeout = scenario === "reload" && run === 20;
    const failure = scenario === "zoom" && run === 20;
    return {
      run, scenario, action_attempted: true,
      status: timeout ? "timeout" : failure ? "failure" : "success",
      elapsed_ms: timeout || failure ? null : run,
      after_action_ms: timeout || failure ? null : run - 1,
      first_partial_paint_ms: timeout ? 7 : null,
      browser_errors: failure ? ["browser_exception"] : [],
    };
  }));
  const complete = { attempts: 20, success: 20, failure: 0, timeout: 0, partial_paint_observations: 0,
    p50_ms: 10, p95_ms: 19, tail_note: "empirical nearest-rank; this environment only" };
  const summary = Object.fromEntries(scenarios.map(name => [name, { ...complete }]));
  const insufficient = { success: 19, p95_ms: null, tail_note: "insufficient samples for stable tail claim" };
  Object.assign(summary.reload, insufficient, { timeout: 1, partial_paint_observations: 1 });
  Object.assign(summary.zoom, insufficient, { failure: 1 });
  return { schema: "ocean-map-baseline/v1", artifact_integrity: "unchanged",
    b1_qualified: false, targets_verified: false, protocol: { runs: 20, timeout_ms: 100 }, attempts, summary };
}

async function check(work) {
  const root = await mkdtemp(join(tmpdir(), "ocean-baseline-verifier-"));
  const report = join(root, "report.json");
  try {
    await work(async value => {
      await writeFile(report, JSON.stringify(value));
      return spawnSync(process.execPath, ["tools/verify-map-baseline.mjs", report], {
        encoding: "utf8", windowsHide: true, timeout: 10_000,
      });
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("baseline verification recomputes exact tail ranks and keeps a partial timeout separate", () => check(async run => {
  const input = receipt();
  const result = await run(input);
  assert.equal(result.status, 0, result.stderr);
  const verified = JSON.parse(result.stdout);
  assert.equal(verified.attempts, 100);
  assert.deepEqual(verified.summary, input.summary);
  assert.equal(verified.b1_qualified, false);
  assert.equal(verified.targets_verified, false);
}));

test("baseline verification refuses a fabricated tail, duplicate attempts and timings left after failure", () => check(async run => {
  for (const [change, code] of [
    [report => { report.summary.reload.p95_ms = 19; }, "summary_mismatch"],
    [report => { report.summary.reload.tail_note = "stable tail confirmed"; }, "summary_mismatch"],
    [report => { report.attempts[1].run = 1; }, "invalid_attempt_identity"],
    [report => { report.attempts.at(-21).first_partial_paint_ms = 7; }, "invalid_attempt_timing"],
    [report => { report.attempts[0].elapsed_ms = 100; }, "invalid_attempt_timing"],
    [report => { report.artifact_integrity = "changed"; }, "invalid_attempt_timing"],
    [report => { report.b1_qualified = true; }, "unsupported_report"],
  ]) {
    const input = receipt();
    change(input);
    const result = await run(input);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.deepEqual(JSON.parse(result.stderr), { verified: false, reason: code });
  }
}));
