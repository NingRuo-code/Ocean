import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

test("real browser baseline waits for matching data and marks small-sample tails unknown", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-"));
  const page = join(root, "controlled.html");
  writeFileSync(page, `<!doctype html><meta charset="utf-8">
    <input id="timeDate" type="date" value="2024-08-05"><button id="dateNext">next</button>
    <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-04" data-render-status="ready" data-view-key="initial"><path d="M0 0L200 200"/></svg>
    <script>
    const map=document.getElementById('mapSvg');
    setTimeout(()=>{map.dataset.renderDate='2024-08-05';map.dataset.renderStatus='ready';},350);
    document.getElementById('dateNext').onclick=()=>{document.getElementById('timeDate').value='2024-08-06';map.dataset.renderStatus='pending';setTimeout(()=>{map.dataset.renderDate='2024-08-06';map.dataset.renderStatus='ready';},200)};
    map.onwheel=()=>{map.dataset.renderStatus='pending';setTimeout(()=>{map.dataset.viewKey='zoomed';map.dataset.renderStatus='ready';},180)};
    map.onpointerup=()=>{map.dataset.viewKey='dragged'};
    </script>`);
  const out = join(root, "baseline.json");
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"),
    "--page", pathToFileURL(page).href, "--runs", "1", "--timeout-ms", "2500",
    "--sample-kind", "controlled-fixture", "--out", out], { encoding: "utf8", timeout: 25000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(report.schema, "ocean-map-baseline/v1");
  assert.equal(report.sample_kind, "controlled-fixture");
  const navigation = report.attempts.find((a) => a.scenario === "navigation");
  assert.equal(navigation.status, "success");
  assert.ok(navigation.elapsed_ms >= 300, String(navigation.elapsed_ms));
  assert.ok(report.attempts.find((a) => a.scenario === "reload").elapsed_ms >= 300);
  assert.ok(report.attempts.find((a) => a.scenario === "date-change").elapsed_ms >= 170);
  assert.ok(report.attempts.find((a) => a.scenario === "zoom").elapsed_ms >= 150);
  assert.equal(report.summary.navigation.p95_ms, null);
  assert.equal(report.targets_verified, false);
  assert.equal(report.environment.gpu_disabled_by_runner, false);
});

test("basemap-only and wrong-date attempts remain timeouts in the report", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-failure-"));
  const page = join(root, "empty.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<input id="timeDate" value="2024-08-05"><button id="dateNext">next</button><svg id="mapSvg" width="600" height="400" data-render-date="2024-08-04" data-render-status="base-only"></svg>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"), "--page", pathToFileURL(page).href,
    "--runs", "1", "--timeout-ms", "150", "--sample-kind", "controlled-fixture", "--out", out], { encoding: "utf8", timeout: 25000 });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(report.attempts.length, 5);
  assert.ok(report.attempts.every(a => a.status !== "success" && a.elapsed_ms === null));
  assert.equal(report.summary.navigation.timeout, 1);
});
