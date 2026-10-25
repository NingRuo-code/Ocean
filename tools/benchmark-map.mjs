import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpus, totalmem, platform, release } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser, sleep } from "./lib/browser-driver.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Missing option value");
  return args[index + 1];
};
const page = option("--page", pathToFileURL(resolve(root, "frontend/prototype/prototype-fishing.html")).href);
if (!page.startsWith("file:") && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(page)) throw new Error("Baseline supports only local or isolated loopback pages");
const runs = Number(option("--runs", "3"));
const timeout = Number(option("--timeout-ms", "15000"));
if (!Number.isInteger(runs) || runs < 1 || runs > 20 || !Number.isFinite(timeout) || timeout < 100 || timeout > 60000) throw new Error("Invalid run budget");
const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sampleKind = option("--sample-kind", "B0-current");
if (!["B0-current", "controlled-fixture"].includes(sampleKind)) throw new Error("Unsupported evidence claim");
const hashFile = async (path) => createHash("sha256").update(await readFile(resolve(root, path))).digest("hex");
const artifactHashes = {};
for (const path of ["frontend/prototype/prototype-fishing.html", "frontend/prototype/prototype-fishing.js", "frontend/prototype/prototype-data.js", "frontend/prototype/prototype-map.js", "frontend/prototype/data/meta.js"]) artifactHashes[path] = await hashFile(path);
for (const path of ["frontend/prototype/prototype-workbench.css", "frontend/prototype/prototype-workbench.js", "frontend/prototype/fonts/Saira.ttf"]) {
  if (await stat(resolve(root, path)).then(() => true, () => false)) artifactHashes[path] = await hashFile(path);
}
// Freeze the actual local data bytes, including dynamically loaded days, without exporting values.
async function hashTree(path) {
  for (const item of await readdir(resolve(root, path), { withFileTypes: true })) {
    const child = `${path}/${item.name}`;
    if (item.isDirectory()) await hashTree(child);
    else if (item.isFile() && /\.(js|json)$/.test(item.name)) artifactHashes[child] = await hashFile(child);
  }
}
await hashTree("frontend/prototype/data");
let commit = null;
try { commit = execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { /* unknown, not guessed */ }
const attempts = [];
const environment = { platform: platform(), release: release(), cpu_model: cpus()[0]?.model ?? null,
  cpu_count: cpus().length, ram_bytes: totalmem(), browser: null, gpu: null,
  gpu_disabled_by_runner: false, viewport: { width: 1440, height: 900, dpr: 1 },
  network: "local; no throttling; file transfer sizes may be unavailable", cache: "fresh browser profile then same-profile reload; OS/storage caches uncontrolled" };

for (let run = 1; run <= runs; run++) {
  const browser = await launchBrowser(edge);
  const cdp = browser.cdp;
  try {
    environment.browser = browser.version.Browser;
    try {
      const info = await browser.browser.send("SystemInfo.getInfo");
      environment.gpu = { devices: info.gpu.devices.map((d) => ({ vendor: d.vendorString, device: d.deviceString })), renderer: info.gpu.auxAttributes?.glRenderer ?? null };
    } catch { environment.gpu = null; }
    await cdp.send("Runtime.enable"); await cdp.send("Page.enable"); await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const requests = new Map();
    const errors = [];
    cdp.onEvent((event) => {
      const p = event.params;
      if (event.method === "Runtime.exceptionThrown") errors.push("browser_exception");
      if (event.method === "Network.requestWillBeSent") requests.set(p.requestId, { kind: p.type, started: performance.now(), status: null, encoded_bytes: null });
      if (event.method === "Network.responseReceived" && requests.has(p.requestId)) Object.assign(requests.get(p.requestId), { status: p.response.status, from_cache: !!(p.response.fromDiskCache || p.response.fromServiceWorker), protocol: p.response.protocol, response_timing: p.response.timing ?? null });
      if (event.method === "Network.loadingFinished" && requests.has(p.requestId)) Object.assign(requests.get(p.requestId), { finished: performance.now(), encoded_bytes: p.encodedDataLength > 0 ? p.encodedDataLength : null });
      if (event.method === "Network.loadingFailed" && requests.has(p.requestId)) Object.assign(requests.get(p.requestId), { failed: true, canceled: !!p.canceled, finished: performance.now() });
    });
    const observed = () => cdp.evaluate(`(()=>{const m=document.getElementById('mapSvg'),d=document.getElementById('timeDate');return m&&d?{time_origin:performance.timeOrigin,date:d.value,render_date:m.dataset.renderDate,status:m.dataset.renderStatus,view:m.dataset.viewKey,map_ms:Number(m.dataset.mapMs)||null,panel_ms:Number(m.dataset.panelMs)||null,step:Number(m.dataset.dataStep)||null}:null})()`);
    const measure = async (scenario, cache, action, expected) => {
      requests.clear(); errors.length = 0;
      const started = performance.now();
      const record = { run, scenario, cache, status: "timeout", elapsed_ms: null, observed: null, requests: [], browser_errors: [] };
      try {
        await action();
        const deadline = started + timeout;
        while (performance.now() < deadline) {
          const value = await observed();
          if (value && value.status === "ready" && value.render_date === value.date && expected(value)) {
            await cdp.evaluate("new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))");
            const painted = await observed();
            if (painted?.status === "ready" && painted.render_date === painted.date && expected(painted)) {
              record.status = "success"; record.observed = painted; break;
            }
          }
          await sleep(25);
        }
      } catch { record.status = "failure"; }
      const ended = performance.now();
      record.elapsed_ms = record.status === "success" ? ended - started : null;
      record.attempt_duration_ms = ended - started;
      record.requests = [...requests.values()].map((r) => ({ kind: r.kind, status: r.status, encoded_bytes: r.encoded_bytes, from_cache: r.from_cache ?? null,
        failed: r.failed ?? false, canceled: r.canceled ?? false, duration_ms: r.finished ? r.finished - r.started : null, response_timing: r.response_timing ?? null }));
      record.browser_errors = errors.slice();
      if (record.browser_errors.length && record.status === "success") { record.status = "failure"; record.elapsed_ms = null; }
      attempts.push(record);
      return record;
    };
    await measure("navigation", "fresh-profile", () => cdp.send("Page.navigate", { url: page }), (v) => !!v.date);
    const navigationDocument = await observed();
    await measure("reload", "same-profile", () => cdp.send("Page.reload", { ignoreCache: false }), (v) => !!v.date && v.time_origin !== navigationDocument?.time_origin);
    const before = await observed();
    await measure("date-change", "same-profile", () => cdp.evaluate("document.getElementById('dateNext').click()"), (v) => v.date !== before?.date);
    const view = await observed();
    const center = () => cdp.evaluate("(()=>{const r=document.getElementById('mapSvg').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
    await measure("zoom", "same-profile", async () => {
      const box = await center();
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: box.x, y: box.y, deltaX: 0, deltaY: -120 });
    }, (v) => v.view !== view?.view);
    const beforeDrag = await observed();
    await measure("drag", "same-profile", async () => {
      const box = await center();
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 70, y: box.y + 15, button: "left", buttons: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x + 70, y: box.y + 15, button: "left", clickCount: 1 });
    }, (v) => v.view !== beforeDrag?.view);
  } finally { await browser.close(); }
}
const quantile = (values, q) => values[Math.max(0, Math.ceil(q * values.length) - 1)];
const summary = {};
for (const scenario of ["navigation", "reload", "date-change", "zoom", "drag"]) {
  const group = attempts.filter((a) => a.scenario === scenario);
  const good = group.filter((a) => a.status === "success").map((a) => a.elapsed_ms).sort((a, b) => a - b);
  summary[scenario] = { attempts: group.length, success: good.length, failure: group.filter((a) => a.status === "failure").length,
    timeout: group.filter((a) => a.status === "timeout").length, p50_ms: good.length ? quantile(good, .5) : null,
    p95_ms: good.length >= 20 ? quantile(good, .95) : null, tail_note: good.length < 20 ? "insufficient samples for stable tail claim" : "empirical nearest-rank; this environment only" };
}
const report = { schema: "ocean-map-baseline/v1", generated_at: new Date().toISOString(), sample_kind: sampleKind,
  runner_sha256: await hashFile("tools/benchmark-map.mjs"),
  page_sha256: page.startsWith("file:") ? createHash("sha256").update(await readFile(fileURLToPath(page))).digest("hex") : null,
  commit, artifact_hashes: artifactHashes, environment, attempts, summary, targets_verified: false,
  protocol: { runs, timeout_ms: timeout, clock: "Node monotonic action dispatch to matching observed DOM plus two animation frames; 25ms polling overhead included",
    segments: "Browser render/panel and network segments overlap; not added to elapsed time", canceled: "reported in request records; failed/timed-out attempts retained with null elapsed", cache_limitations: "no production cache purge; OS and storage warmth uncontrolled" },
  limitations: ["B0 activity layer still uses percentile/700-cell truncation; no valid acceleration ratio against a complete-support renderer.",
    "Controlled fixtures verify timing/identity only, not real data coverage. This is not B1 numerical/coverage qualification.",
    "Local measured results do not establish production, server capacity, or 3/1/2-second targets."] };
const output = resolve(option("--out", "data/processed/map-baseline.json"));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ attempts: attempts.length, summary, targets_verified: false }));
if (attempts.some((a) => a.status !== "success")) process.exitCode = 1;
