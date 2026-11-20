import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { launchBrowser, waitFor } from "./lib/browser-driver.mjs";
import { withService } from "./lib/monthly-test-service.mjs";

// Authored data only. Grid coordinates here are integer tenths of a degree.
const fixtures = [
  { date: "2024-08-05", origin: [1245, 302], size: [6, 1], hours: [0, 1, 2, 8, 13] },
  { date: "2024-08-06", origin: [1220, 282], size: [27, 26], hours: Array(701).fill(1) },
];
const missingDate = "2024-08-07";
const cellSize = .1;
const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sha256 = (content) => "sha256:" + createHash("sha256").update(content).digest("hex");
const comparePosition = (a, b) => a.lat - b.lat || a.lon - b.lon;
const afterTwoFrames = (cdp) => cdp.evaluate(
  "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
);

function prepareFixture({ date, origin: [west, south], size: [columns, rows], hours }) {
  const positions = Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return { lon: (west + column) / 10, lat: (south + row) / 10, x: column, y: rows - 1 - row };
  });
  const cells = hours.map((hours, index) => {
    const { lon, lat } = positions[index];
    return { lon, lat, hours, vessel_count: Number(hours > 0) };
  });
  const bbox = [west, south, west + columns - 1, south + rows - 1].map(value => value / 10);
  const payload = JSON.stringify({
    date, cells, bbox, spatial_resolution_deg: cellSize,
    total_hours: hours.reduce((total, hours) => total + hours, 0), cell_count: cells.length,
  });
  return { date, positions, size: [columns, rows], payload, cells, bbox };
}

async function readDailyCells(base, fixture) {
  const response = await fetch(base + "/api/fishing/" + fixture.date, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, "authored day must be available through the original activity API");
  const day = await response.json();
  assert.equal(day.date, fixture.date);
  assert.equal(day.spatial_resolution_deg, cellSize);
  assert.equal(day.source.unit, "hours");
  assert.deepEqual(day.bbox, fixture.bbox);
  const cells = day.cells.map(({ lon, lat, hours }) => ({ lon, lat, hours })).sort(comparePosition);
  assert.deepEqual(cells, fixture.cells.map(({ lon, lat, hours }) => ({ lon, lat, hours })),
    "the daily API must preserve every authored coordinate and value");
  assert.equal(day.cell_count, cells.length);
  assert.equal(day.total_hours, cells.reduce((sum, cell) => sum + cell.hours, 0));
  return cells;
}

async function checkPoints(base, { date, cells, positions }) {
  // Sample explicit zeros and absent positions, not every positive cell.
  const witnesses = positions.map(({ lon, lat }, index) => ({ lon, lat, hours: cells[index]?.hours ?? null }))
    .filter(({ hours }) => hours === 0 || hours === null);
  return Promise.all(witnesses.map(async ({ lon, lat, hours }) => {
    const query = new URLSearchParams({ longitude: String(lon), latitude: String(lat) });
    const response = await fetch(`${base}/api/fishing/${date}/point?${query}`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    const point = await response.json();
    assert.equal(point.date, date);
    assert.deepEqual([point.longitude, point.latitude], [lon, lat]);
    assert.equal(point.source.unit, "hours");
    // The point API may return a neighbor. Only the exact source cell can
    // establish whether the requested cell was observed.
    const exact = point.matched && point.cell_lon === lon && point.cell_lat === lat;
    const reportedHours = exact ? point.hours : null;
    assert.equal(exact, hours !== null, "known and missing point support must agree with the daily grid");
    assert.equal(reportedHours, hours);
    return {
      requested: [lon, lat], returned: point.matched ? [point.cell_lon, point.cell_lat] : null,
      state: exact ? "known" : "unknown", hours: reportedHours,
    };
  }));
}

async function readB0(cdp, base, cases) {
  await cdp.send("Page.navigate", { url: base + "/prototype-fishing.html" });
  await waitFor(cdp, "window.OFData?.serverEnabled() && document.getElementById('timeDate')?.value==='2024-08-05'");
  await cdp.evaluate("document.getElementById('workbenchToggle').click(); document.getElementById('fishingActivity').click(); true");
  const result = [];
  for (const [index, fixture] of cases.entries()) {
    const date = JSON.stringify(fixture.date);
    if (index) await cdp.evaluate("document.getElementById('dateNext').click(); true");
    await waitFor(cdp, `document.getElementById('timeDate')?.value===${date} &&
      window.OFData?.fishingDay(${date})?.cells?.length===${fixture.cells.length} &&
      document.getElementById('mapSvg')?.dataset.renderDate===${date} &&
      document.querySelectorAll('#mapSvg [data-layer=ground]').length>0`);
    await afterTwoFrames(cdp);
    const markers = await cdp.evaluate(`document.getElementById('mapSvg')?.dataset.renderDate===${date} ?
      Array.from(document.querySelectorAll('#mapSvg circle[data-layer=ground]'), circle => Number(circle.dataset.hours)) : null`);
    assert.ok(markers?.length && markers.every(Number.isFinite), "expected painted B0 activity markers for this day");
    result.push({ markers: markers.length, hours: markers.reduce((sum, hours) => sum + hours, 0) });
  }
  return result;
}

async function readReference(cdp, frameId, fixture, cells) {
  const [columns, rows] = fixture.size;
  const byPosition = new Map(cells.map(({ lon, lat, hours }) => [`${lon},${lat}`, hours]));
  const tiles = fixture.positions.map(({ lon, lat, x, y }) => {
    const hours = byPosition.get(`${lon},${lat}`);
    const state = hours === undefined ? "unknown" : hours === 0 ? "zero" : "positive";
    return `<rect x="${x}" y="${y}" width="1" height="1" data-lon="${lon}" data-lat="${lat}"
      class="${state}" ${hours === undefined ? "" : `data-hours="${hours}"`}>
      <title>${lon}, ${lat}: ${hours === undefined ? "unknown" : `${hours} hours`}</title></rect>`;
  }).join("");
  await cdp.send("Page.setDocumentContent", { frameId, html: `<!doctype html><meta charset="utf-8">
    <style>rect { stroke-width: .06 } .positive { fill: #7451ae; stroke: white }
      .zero { fill: white; stroke: #7451ae } .unknown { fill: #ddd; stroke: #333; stroke-dasharray: .15 .1 }</style>
    <p>Authored grid only · purple: positive · white: zero · dashed: unknown</p>
    <svg role="img" aria-label="Activity reference ${fixture.date}"
      viewBox="0 0 ${columns} ${rows}" width="${columns * 24}" height="${rows * 24}">${tiles}</svg>` });
  await afterTwoFrames(cdp);
  const plotted = await cdp.evaluate(`Array.from(document.querySelectorAll('svg rect'), tile => {
    const { x, y, width, height } = tile.getBBox();
    const style = getComputedStyle(tile);
    return { lon: Number(tile.dataset.lon), lat: Number(tile.dataset.lat), x, y, width, height,
      shown: style.visibility==='visible' && style.display!=='none' && tile.getBoundingClientRect().width>0,
      state: tile.getAttribute('class'), fill: style.fill, dashed: style.strokeDasharray !== 'none',
      hours: tile.hasAttribute('data-hours') ? Number(tile.dataset.hours) : null };
  })`);
  assert.equal(plotted.length, fixture.positions.length);
  const fillsByState = new Map();
  for (const [index, tile] of plotted.entries()) {
    assert.deepEqual({ lon: tile.lon, lat: tile.lat, x: tile.x, y: tile.y }, fixture.positions[index]);
    assert.ok(tile.shown && tile.width === 1 && tile.height === 1, "all reference tiles must have visible geometry");
    const expected = fixture.cells[index]?.hours ?? null;
    assert.equal(tile.hours, expected);
    assert.equal(tile.state, expected === null ? "unknown" : expected === 0 ? "zero" : "positive");
    assert.equal(tile.dashed, expected === null);
    assert.ok(tile.fill && tile.fill !== "none", "reference cells must have a visible fill");
    if (!fillsByState.has(tile.state)) fillsByState.set(tile.state, tile.fill);
    assert.equal(tile.fill, fillsByState.get(tile.state));
  }
  assert.equal(new Set(fillsByState.values()).size, fillsByState.size, "each observed state must have a different fill");
  const known = plotted.filter(tile => tile.hours !== null);
  const coordinates = (tile) => [tile.lon, tile.lat];
  return {
    counts: { valid_cells: known.length, hours: known.reduce((sum, tile) => sum + tile.hours, 0) },
    explicit_zero: known.filter(tile => tile.hours === 0).map(coordinates),
    unknown: plotted.filter(tile => tile.hours === null).map(coordinates),
  };
}

const { values } = parseArgs({ options: { out: { type: "string" } } });
if (!values.out) throw new Error("Usage: node tools/check-map-effort-reference.mjs --out <new-report.json>");
const runnerUrl = new URL(import.meta.url);
const runnerSha256 = sha256(await readFile(runnerUrl));
const cases = fixtures.map(prepareFixture);
await withService(async (base) => {
  const dailyCells = await Promise.all(cases.map(fixture => readDailyCells(base, fixture)));
  const pointChecks = await Promise.all(cases.map(fixture => checkPoints(base, fixture)));
  const missing = await fetch(base + "/api/fishing/" + missingDate, { signal: AbortSignal.timeout(10_000) });
  await missing.body?.cancel();
  assert.equal(missing.status, 404, "a missing day must not become a known zero day");
  const browser = await launchBrowser(edge);
  try {
    const { cdp } = browser;
    const b0 = await readB0(cdp, base, cases);
    await cdp.send("Page.navigate", { url: "about:blank" });
    await waitFor(cdp, "location.href==='about:blank' && document.readyState==='complete'");
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const observed = [];
    for (const [index, fixture] of cases.entries()) {
      observed.push({
        date: fixture.date, input_sha256: sha256(fixture.payload), bbox: fixture.bbox,
        b0: b0[index], point_checks: pointChecks[index],
        reference: await readReference(cdp, frameTree.frame.id, fixture, dailyCells[index]),
      });
    }
    assert.equal(sha256(await readFile(runnerUrl)), runnerSha256, "runner bytes changed during the check");
    const report = {
      schema: "ocean-map-effort-reference/v1", scope: "controlled-authored-fixtures",
      reference_runner_sha256: runnerSha256,
      browser: browser.version.Browser, cell_size_degrees: cellSize,
      b1_qualified: false, real_coverage_verified: false, performance_comparable: false,
      cases: observed, missing_day: { date: missingDate, status: missing.status, counts: null },
    };
    await writeFile(values.out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  } finally {
    await browser.close();
  }
}, { prepareRaw: async (raw) => {
  const directory = join(raw, "fishing");
  await mkdir(directory);
  for (const { date, payload } of cases) {
    await writeFile(join(directory, `effort-${date.replaceAll("-", "")}.json`), payload);
  }
} });
