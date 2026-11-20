import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);

test("the fixed activity reference displays every known cell, and distinguishes zero from missing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ocean-effort-reference-test-"));
  const output = join(directory, "report.json");
  try {
    await run(process.execPath, ["tools/check-map-effort-reference.mjs", "--out", output], {
      windowsHide: true,
      timeout: 90_000,
    });
    const report = JSON.parse(await readFile(output, "utf8"));
    assert.equal(report.schema, "ocean-map-effort-reference/v1");
    assert.equal(report.scope, "controlled-authored-fixtures");
    assert.equal(report.real_coverage_verified, false);
    assert.equal(report.performance_comparable, false);
    assert.equal(report.b1_qualified, false);
    assert.deepEqual(report.cases.map(({ date, b0, reference }) => ({
      date, b0, counts: reference.counts, zero: reference.explicit_zero, unknown: reference.unknown,
    })), [
      {
        date: "2024-08-05",
        b0: { markers: 2, hours: 21 },
        counts: { valid_cells: 5, hours: 24 },
        zero: [[124.5, 30.2]],
        unknown: [[125, 30.2]],
      },
      {
        date: "2024-08-06",
        b0: { markers: 700, hours: 700 },
        counts: { valid_cells: 701, hours: 701 },
        zero: [],
        unknown: [[124.6, 30.7]],
      },
    ]);
    for (const day of report.cases) assert.match(day.input_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(report.cases[0].point_checks, [
      { requested: [124.5, 30.2], returned: [124.5, 30.2], state: "known", hours: 0 },
      { requested: [125, 30.2], returned: [124.9, 30.2], state: "unknown", hours: null },
    ]);
    assert.deepEqual(report.cases[1].point_checks, [
      { requested: [124.6, 30.7], returned: [124.5, 30.6], state: "unknown", hours: null },
    ]);
    assert.equal(report.missing_day.status, 404);
    assert.equal(report.missing_day.counts, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
