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
    <svg id="mapSvg" width="600" height="400" viewBox="0 -13.33333333333331 1000 666.6666666666666" data-render-date="2024-08-04" data-render-status="ready"
      data-view-key='["2024-08-05",124.5,30.2,1,"plane"]'><path d="M0 0L200 200"/></svg>
    <script>
    const map=document.getElementById('mapSvg');
    setTimeout(()=>{map.dataset.renderDate='2024-08-05';map.dataset.renderStatus='ready';},350);
    document.getElementById('dateNext').onclick=()=>{document.getElementById('timeDate').value='2024-08-06';map.dataset.renderStatus='pending';setTimeout(()=>{map.dataset.renderDate='2024-08-06';map.dataset.viewKey=JSON.stringify(['2024-08-06',124.5,30.2,1,'plane']);map.dataset.renderStatus='ready';},200)};
    const zoom = Math.exp(.192), width = 1000 / zoom, height = width / 1.5;
    map.onwheel=()=>{map.dataset.renderStatus='pending';setTimeout(()=>{
      map.dataset.viewKey=JSON.stringify(['2024-08-06',124.5,30.2,zoom,'plane']);
      map.setAttribute('viewBox', [500-width/2,320-height/2,width,height].join(' '));
      map.dataset.renderStatus='ready';
    },180)};
    map.onpointerup=()=>{
      map.dataset.viewKey=JSON.stringify(['2024-08-06',124.5-70*width/600/180,
        30.2+15*width/600/(180/Math.cos(30.2*Math.PI/180)),zoom,'plane']);
      map.setAttribute('viewBox', [500-width*(.5+70/600),320-height/2-15*width/600,width,height].join(' '));
    };
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
  assert.ok(navigation.after_action_ms >= 0 && navigation.after_action_ms <= navigation.elapsed_ms);
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

test("date and view actions do not accept an unrelated ready map", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-action-"));
  const page = join(root, "actions.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<!doctype html>
    <input id="timeDate" type="date" value="2024-08-05"><button id="dateNext">next</button>
    <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready" data-view-key="initial"></svg>
    <script>
    const date = document.getElementById('timeDate');
    const map = document.getElementById('mapSvg');
    document.getElementById('dateNext').onclick = () => {
      date.value = map.dataset.renderDate = '2024-08-07';
    };
    map.onwheel = () => {
      date.value = map.dataset.renderDate = '2024-08-08';
      map.dataset.viewKey = 'zoomed-on-wrong-date';
    };
    map.onpointerup = () => { location.href = 'unrelated.html'; };
    </script>`);
  writeFileSync(join(root, "unrelated.html"), `<!doctype html>
    <input id="timeDate" type="date" value="2024-08-08">
    <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-08" data-render-status="ready" data-view-key="another-document"></svg>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"),
    "--page", pathToFileURL(page).href, "--runs", "1", "--timeout-ms", "900",
    "--sample-kind", "controlled-fixture", "--out", out], { encoding: "utf8", timeout: 25000 });
  const report = JSON.parse(readFileSync(out, "utf8"));
  const [navigation, reload, dateChange, zoom, drag] = report.attempts;
  assert.deepEqual([navigation.status, reload.status], ["success", "success"]);
  assert.equal(dateChange.last_observed?.date, "2024-08-07");
  assert.equal(zoom.last_observed?.view, "zoomed-on-wrong-date");
  assert.ok(drag.requests.some(request => request.kind === "Document"), "Drag dispatched a navigation to another document");
  assert.deepEqual([dateChange.status, zoom.status], ["timeout", "timeout"]);
  assert.notEqual(drag.status, "success", "A different document must never complete the drag");
  assert.ok([dateChange, zoom, drag].every(attempt => attempt.elapsed_ms === null));
  assert.equal(result.status, 1, result.stderr);
});

test("switching to the next date on a different viewport does not record either paint time", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-date-view-"));
  const page = join(root, "date-view.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<!doctype html>
    <input id="timeDate" type="date" value="2024-08-05"><button id="dateNext">next</button>
    <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready"
      data-view-key='["2024-08-05",124.5,30.2,1,"flat"]'></svg>
    <script>
    const date = document.getElementById("timeDate");
    const map = document.getElementById("mapSvg");
    window.OFData = {serverEnabled: () => true, viewportReady: () => map.dataset.renderStatus === "ready",
      viewportState: () => ({status: "partial", usable: true})};
    document.getElementById("dateNext").onclick = () => {
      date.value = map.dataset.renderDate = "2024-08-06";
      map.dataset.viewKey = JSON.stringify([date.value, 127, 30.2, 1, "flat"]);
      map.dataset.renderStatus = "partial";
      setTimeout(() => { map.dataset.renderStatus = "ready"; }, 350);
    };
    </script>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"),
    "--page", pathToFileURL(page).href, "--runs", "1", "--timeout-ms", "1200",
    "--sample-kind", "controlled-fixture", "--out", out], { encoding: "utf8", timeout: 25000 });
  const report = JSON.parse(readFileSync(out, "utf8"));
  const attempt = report.attempts.find(item => item.scenario === "date-change");
  assert.equal(attempt.last_observed.date, "2024-08-06");
  assert.equal(attempt.last_observed.status, "ready");
  assert.equal(attempt.status, "timeout");
  assert.equal(attempt.first_partial_paint_ms, null);
  assert.equal(attempt.elapsed_ms, null);
  assert.equal(report.summary["date-change"].success, 0);
  assert.equal(result.status, 1, result.stderr);
});

test("paint after the action budget does not count as successful completion", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-deadline-"));
  const page = join(root, "late-paint.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<!doctype html><meta charset="utf-8">
    <input id="timeDate" value="2024-08-05"><button id="dateNext">next</button>
    <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-05" data-render-status="ready" data-view-key="initial"></svg>
    <script>
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => setTimeout(() => nativeFrame(callback), 400);
    </script>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"), "--page", pathToFileURL(page).href,
    "--runs", "1", "--timeout-ms", "500", "--sample-kind", "controlled-fixture", "--out", out],
  { encoding: "utf8", timeout: 25000 });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(readFileSync(out, "utf8"));
  const navigation = report.attempts.find((attempt) => attempt.scenario === "navigation");
  assert.equal(navigation.last_observed?.status, "ready", "Readiness must be observed before checking paint");
  assert.equal(navigation.status, "timeout");
  assert.equal(navigation.observed, null);
  assert.equal(navigation.elapsed_ms, null);
  assert.equal(navigation.after_action_ms, null);
  assert.ok(navigation.attempt_duration_ms >= report.protocol.timeout_ms);
  assert.equal(report.summary.navigation.success, 0);
  assert.equal(report.summary.navigation.timeout, 1);
  assert.equal(report.summary.navigation.p50_ms, null);
});

test("partial coverage has its own paint time and never enters full-success percentiles", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-partial-"));
  const page = join(root, "partial.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<!doctype html>
    <input id="timeDate" value="2024-08-05"><button id="dateNext">next</button>
    <svg id="mapSvg" width="600" height="400" data-render-date="2024-08-04" data-render-status="partial"
      data-view-key='["2024-08-05",124.5,30.2,1,"flat"]'></svg>
    <script>
    const map = document.getElementById('mapSvg');
    const date = document.getElementById('timeDate');
    let frames = 0;
    const frame = window.requestAnimationFrame.bind(window);
    const ready = () => map.dataset.renderStatus === 'ready';
    window.OFData = {serverEnabled:()=>true,viewportReady:ready,viewportState:()=>({status:'partial',usable:true})};
    window.requestAnimationFrame = callback => {
      if (ready()) return setTimeout(() => frame(callback), 850);
      if (date.value === '2024-08-06' && ++frames === 2) map.dataset.renderStatus = 'ready';
      return frame(callback);
    };
    setTimeout(()=>{map.dataset.renderDate=date.value}, 260);
    document.getElementById('dateNext').onclick=()=>{
      date.value='2024-08-06';
      // Leave the old render date visible before painting partial coverage for the new day.
      setTimeout(()=>{map.dataset.renderDate=date.value;map.dataset.viewKey=JSON.stringify([date.value,124.5,30.2,1,'flat'])}, 110);
    };
    </script>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"),
    "--page", pathToFileURL(page).href, "--runs", "1", "--timeout-ms", "650",
    "--sample-kind", "controlled-fixture", "--out", out], { encoding: "utf8", timeout: 25000 });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(readFileSync(out, "utf8"));
  const nav = report.attempts.find(a => a.scenario === "navigation");
  assert.ok(nav.first_partial_paint_ms >= 240 && nav.first_partial_paint_ms < 650, String(nav.first_partial_paint_ms));
  assert.equal(nav.status, "timeout");
  assert.equal(nav.elapsed_ms, null);
  const changed = report.attempts.find(a => a.scenario === "date-change");
  assert.equal(changed.last_observed?.status, "ready");
  assert.equal(changed.status, "timeout", "Full readiness needs a new paint confirmation");
  assert.equal(changed.first_partial_paint_ms, null);
  assert.equal(report.summary.navigation.partial_paint_observations, 1);
  assert.equal(report.summary.navigation.p50_ms, null);
  assert.equal(report.summary.navigation.p95_ms, null);
});

test("ready paints at the wrong zoom or drag target do not count", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-geometry-"));
  const page = join(root, "wrong-geometry.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<!doctype html><meta charset="utf-8">
    <input id="timeDate" value="2024-08-05"><button id="dateNext">next</button>
    <svg id="mapSvg" width="600" height="400" viewBox="0 -13.33333333333331 1000 666.6666666666666"
      data-render-date="2024-08-05" data-render-status="ready"
      data-view-key='["2024-08-05",124.5,30.2,1,"plane"]'></svg>
    <script>
    const map = document.getElementById('mapSvg'), date = document.getElementById('timeDate');
    function paint(lon, lat, zoom, status) {
      const w = 1000 / zoom, h = w / 1.5;
      map.setAttribute('viewBox', [500 + 180 * (lon - 124.5) - w/2,
        320 - (180 / Math.cos(30.2 * Math.PI/180)) * (lat - 30.2) - h/2, w, h].join(' '));
      map.dataset.renderDate = date.value;
      map.dataset.viewKey = JSON.stringify([date.value,lon,lat,zoom,'plane']);
      map.dataset.renderStatus = status;
    }
    window.OFData = {serverEnabled:()=>true,viewportReady:()=>true,viewportState:()=>({status:'partial',usable:true})};
    document.getElementById('dateNext').onclick = () => { date.value='2024-08-06'; paint(124.5,30.2,1,'ready'); };
    map.onwheel = () => { paint(125,30.2,Math.exp(.192),'partial'); setTimeout(()=>{map.dataset.renderStatus='ready'},150); };
    map.onpointerup = () => {
      const zoom = Math.exp(.192), width = 1000 / zoom;
      paint(125-70*width/600/180,30.2+15*width/600/(180/Math.cos(30.2*Math.PI/180)),zoom,'partial');
      // Publish the correct view identity but move the actual SVG window in the opposite direction.
      const parts = map.getAttribute('viewBox').split(' ').map(Number);
      parts[0] += 2*70*width/600;
      map.setAttribute('viewBox', parts.join(' '));
      setTimeout(()=>{map.dataset.renderStatus='ready'},150);
    };
    </script>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"), "--page", pathToFileURL(page).href,
    "--runs", "1", "--timeout-ms", "650", "--sample-kind", "controlled-fixture", "--out", out],
  { encoding: "utf8", timeout: 25000 });
  const report = JSON.parse(readFileSync(out, "utf8"));
  for (const scenario of ["zoom", "drag"]) {
    const attempt = report.attempts.find(entry => entry.scenario === scenario);
    assert.equal(attempt.last_observed?.status, "ready", scenario);
    assert.ok(attempt.expected_viewport, scenario);
    if (scenario === "drag") {
      assert.ok(Math.abs(JSON.parse(attempt.last_observed.view)[1] - attempt.expected_viewport.view[1]) < 1e-10);
      assert.ok(Math.abs(attempt.last_observed.box[0] - attempt.expected_viewport.box[0]) > 100);
    }
    assert.equal(attempt.status, "timeout", scenario);
    assert.equal(attempt.first_partial_paint_ms, null, scenario);
    assert.equal(attempt.elapsed_ms, null, scenario);
  }
  assert.equal(result.status, 1, result.stderr);
});

test("centered globe wheel tolerates subpixel rounding across the date line", () => {
  const root = mkdtempSync(join(tmpdir(), "ocean-baseline-globe-"));
  const page = join(root, "globe.html"), out = join(root, "baseline.json");
  writeFileSync(page, `<!doctype html><meta charset="utf-8">
    <input id="timeDate" value="2024-08-05"><button id="dateNext">next</button><svg id="mapSvg" width="601" height="401"></svg>
    <script>
    const map = document.getElementById('mapSvg'), date = document.getElementById('timeDate');
    const radians = Math.PI/180, y = 180/Math.cos(30.2*radians);
    function paint(lon,lat,zoom) {
      const w = 1000/zoom, h = w*401/601;
      map.setAttribute('viewBox', [500+180*(lon-124.5)-w/2,320-y*(lat-30.2)-h/2,w,h].join(' '));
      map.dataset.renderDate = date.value;
      map.dataset.renderStatus = 'ready';
      map.dataset.viewKey = JSON.stringify([date.value,lon,lat,zoom,'globe']);
    }
    paint(179.99,80,.1);
    document.getElementById('dateNext').onclick = () => { date.value='2024-08-06'; paint(179.99,80,.1); };
    const zoom = .1*Math.exp(.192);
    map.onwheel = () => paint(-179.95,80,zoom);
    map.onpointerup = () => {
      const units = 1000/zoom/601;
      const lon = -179.95-70*units/(y*Math.cos(80*radians))+360;
      paint(lon,80+15*units/y,zoom);
    };
    </script>`);
  const result = spawnSync(process.execPath, [resolve("tools/benchmark-map.mjs"), "--page", pathToFileURL(page).href,
    "--runs", "1", "--timeout-ms", "1500", "--sample-kind", "controlled-fixture", "--out", out],
  { encoding: "utf8", timeout: 25000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(out, "utf8"));
  for (const scenario of ["zoom", "drag"]) {
    const attempt = report.attempts.find(item => item.scenario === scenario);
    assert.equal(attempt.observed.status, "ready", scenario);
    assert.equal(attempt.expected_viewport.view[4], "globe");
  }
});
