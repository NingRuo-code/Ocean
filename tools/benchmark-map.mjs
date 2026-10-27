import { writeFile, mkdir, readdir, stat } from "node:fs/promises";
import {createReadStream} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpus, totalmem, platform, release } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {withService} from "./lib/monthly-test-service.mjs";
import { launchBrowser, sleep } from "./lib/browser-driver.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const values=new Set(['--page','--runs','--timeout-ms','--sample-kind','--out']);
for(let i=0;i<args.length;i++){
  if(args[i]==='--isolated-service')continue;
  if(!values.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown or incomplete baseline option');
  i++;
}
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Missing option value");
  return args[index + 1];
};
function localPage(value){
  let url;try{url=new URL(value);}catch{throw Error("Invalid local page");}
  const localFile=url.protocol==='file:'&&!url.hostname;
  const loopback=['http:','https:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((!localFile&&!loopback)||url.username||url.password||url.search||url.hash)throw Error("Baseline requires a local file or loopback page without credentials or query overrides");
  return url.href;
}
const page = localPage(option("--page", pathToFileURL(resolve(root, "frontend/prototype/prototype-fishing.html")).href));
const runs = Number(option("--runs", "3"));
const timeout = Number(option("--timeout-ms", "15000"));
if (!Number.isInteger(runs) || runs < 1 || runs > 20 || !Number.isFinite(timeout) || timeout < 100 || timeout > 60000) throw new Error("Invalid run budget");
const edge = process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const scenarios = ["navigation", "reload", "date-change", "zoom", "drag"];
async function runBaseline(page, isolatedService = false, serviceRuntime = null, startupFailed = false) {
  const sampleKind = option("--sample-kind", "B0-current");
  if (!["B0-current", "controlled-fixture"].includes(sampleKind)) throw new Error("Unsupported evidence claim");
  const hashFile = async (path) => {
    const hash=createHash('sha256');let bytes=0;
    for await(const chunk of createReadStream(resolve(root,path))){
      bytes+=chunk.length;if(bytes>33554432)throw Error('Artifact file budget exceeded');hash.update(chunk);
    }
    return hash.digest('hex');
  };
  async function collectArtifacts() {
    const hashes={};let bytes=0,count=0;
    async function visit(path){
      for(const item of await readdir(resolve(root,path),{withFileTypes:true})){
        const child=`${path}/${item.name}`;
        if(item.isDirectory())await visit(child);
        else if(item.isFile()&&/\.(js|json|css|html|ttf|woff2?|svg|py)$/.test(item.name)){
          const size=(await stat(resolve(root,child))).size;
          bytes+=size;count++;
          if(size>33554432||bytes>536870912||count>20000)throw Error("Artifact identity budget exceeded");
          hashes[child]=await hashFile(child);
        }
      }
    }
    await visit("frontend/prototype");
    if(isolatedService){await visit("backend/app");hashes["backend/pyproject.toml"]=await hashFile("backend/pyproject.toml");}
    for(const path of ["tools/benchmark-map.mjs","tools/lib/browser-driver.mjs","tools/lib/monthly-test-service.mjs"])hashes[path]=await hashFile(path);
    if(page.startsWith('file:'))hashes.entry_document=await hashFile(fileURLToPath(page));
    return Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b,'en')));
  }
  const identityStarted=performance.now(),artifactHashes=await collectArtifacts();
  const identityBeforeMs=performance.now()-identityStarted;
  let commit = null;
  let trackedChanges=null;
  try { commit = execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { /* unknown, not guessed */ }
  try{execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'diff','--quiet','HEAD','--','tools/benchmark-map.mjs','tools/lib/monthly-test-service.mjs','tools/lib/browser-driver.mjs','frontend/prototype','backend/app','backend/pyproject.toml'],{cwd:root,stdio:'ignore'});trackedChanges=false;}catch(error){trackedChanges=error.status===1?true:null;}
  const attempts = [];
  const environment = { node_version: process.version, run_environments: [], cache_layers: {browser: "fresh profile then same-profile reload", service: isolatedService ? "empty at start; shared across all browser runs" : "not controlled", os_storage: "uncontrolled"}, platform: platform(), release: release(), cpu_model: cpus()[0]?.model ?? null,
    cpu_count: cpus().length, ram_bytes: totalmem(), browser: null, gpu: null,
    gpu_disabled_by_runner: false, viewport: { width: 1440, height: 900, dpr: 1 },
    network: "local; no throttling; file transfer sizes may be unavailable", cache: "fresh browser profile then same-profile reload; OS/storage caches uncontrolled" };

  for (let run = 1; run <= runs; run++) {
    let browser=null;
    const lifecycleStarted=performance.now();
    try {
      if(startupFailed)throw Error('service_startup_failed');
      browser = await launchBrowser(edge);
      const cdp = browser.cdp;
      environment.browser = browser.version.Browser;
      try {
        const info = await browser.browser.send("SystemInfo.getInfo");
        environment.gpu = { devices: info.gpu.devices.map((d) => ({ vendor: d.vendorString, device: d.deviceString })), renderer: info.gpu.auxAttributes?.glRenderer ?? null };
      } catch { environment.gpu = null; }
      environment.run_environments.push({run,browser:environment.browser,gpu:environment.gpu});
      await cdp.send("Runtime.enable"); await cdp.send("Page.enable"); await cdp.send("Network.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const requests = new Map();
      const errors = [];
      cdp.onEvent((event) => {
        const p = event.params;
        if (event.method === "Runtime.exceptionThrown") errors.push("browser_exception");
        if (event.method === "Network.requestWillBeSent") requests.set(p.requestId, { role: requestRole(p.request.url), method: p.request.method, kind: p.type, started: performance.now(), status: null, encoded_bytes: null });
        if (event.method === "Network.responseReceived" && requests.has(p.requestId)) Object.assign(requests.get(p.requestId), { status: p.response.status, from_cache: !!(p.response.fromDiskCache || p.response.fromServiceWorker), protocol: p.response.protocol, response_timing: p.response.timing ?? null, content_encoding: responseEncoding(p.response.headers) });
        if (event.method === "Network.loadingFinished" && requests.has(p.requestId)) Object.assign(requests.get(p.requestId), { finished: performance.now(), encoded_bytes: p.encodedDataLength > 0 ? p.encodedDataLength : null });
        if (event.method === "Network.loadingFailed" && requests.has(p.requestId)) Object.assign(requests.get(p.requestId), { failed: true, canceled: !!p.canceled, finished: performance.now() });
      });
      const observed = () => cdp.evaluate(`(()=>{const m=document.getElementById('mapSvg'),d=document.getElementById('timeDate');return m&&d?{time_origin:performance.timeOrigin,date:d.value,render_date:m.dataset.renderDate,status:m.dataset.renderStatus,view:m.dataset.viewKey,map_ms:Number(m.dataset.mapMs)||null,panel_ms:Number(m.dataset.panelMs)||null,step:Number(m.dataset.dataStep)||null,server_enabled:!!window.OFData?.serverEnabled(),viewport_ready:!!window.OFData?.viewportReady(d.value),layer_states:Object.fromEntries(Object.entries(window.OFData?.loadState?.()||{}).map(([k,v])=>[k,v.status]))}:null})()`);
      const measure = async (scenario, cache, action, expected) => {
        requests.clear(); errors.length = 0;
        const started = performance.now();
        let actionEnded = null;
        const record = { run, scenario, cache, action_attempted:true, status: "timeout", elapsed_ms: null, observed: null, requests: [], browser_errors: [] };
        try {
          await action();
          actionEnded = performance.now();
          const deadline = started + timeout;
          while (performance.now() < deadline) {
            const value = await observed();
            record.last_observed=value;
            if(isolatedService&&value?.server_enabled&&["day-missing","forbidden","error","unprepared"].includes(value.layer_states.day)){
              record.status="failure";record.failure_reason=value.layer_states.day;break;
            }
            const matching = value => value && value.status === "ready" && value.render_date === value.date && expected(value) &&
              (!isolatedService || value.server_enabled && value.viewport_ready);
            if (matching(value)) {
              await cdp.evaluate("new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))");
              const painted = await observed();
              if (matching(painted)) {
                record.status = "success"; record.observed = painted; break;
              }
            }
            await sleep(25);
          }
        } catch { record.status = "failure";record.failure_reason="action_or_observation_failed"; }
        const ended = performance.now();
        record.elapsed_ms = record.status === "success" ? ended - started : null;
        record.after_action_ms = record.status === "success" && actionEnded !== null ? ended - actionEnded : null;
        record.action_dispatch_ms = actionEnded === null ? null : actionEnded - started;
        record.attempt_duration_ms = ended - started;
        record.requests = [...requests.values()].map((r) => ({ role: r.role, method: r.method, content_encoding: r.content_encoding ?? null, kind: r.kind, status: r.status, encoded_bytes: r.encoded_bytes, from_cache: r.from_cache ?? null,
          failed: r.failed ?? false, canceled: r.canceled ?? false, duration_ms: r.finished ? r.finished - r.started : null, response_timing: r.response_timing ?? null }));
        record.browser_errors = errors.slice();
        if (record.browser_errors.length && record.status === "success") { record.status = "failure"; record.failure_reason='browser_exception';record.elapsed_ms = null;record.after_action_ms=null; }
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
    } catch {
      for(const scenario of scenarios){
        if(attempts.some(a=>a.run===run&&a.scenario===scenario))continue;
        attempts.push({run,scenario,cache:scenario==='navigation'?'fresh-profile':'same-profile',
          status:'failure',elapsed_ms:null,after_action_ms:null,action_dispatch_ms:null,
          attempt_duration_ms:null,action_attempted:false,lifecycle_failure_ms:performance.now()-lifecycleStarted,failure_phase:startupFailed?'service_startup':browser?'session_observation':'browser_startup',
          observed:null,last_observed:null,requests:[],browser_errors:[]});
      }
    } finally { if(browser)await browser.close(); }
  }
  let service = {kind: isolatedService?'isolated_original_app':'not_managed', status: null, release: null,reason:startupFailed?'service_startup_failed':null};
  if (isolatedService&&!startupFailed) {
    try {
      const response = await fetch(new URL("/api/status", page), {signal:AbortSignal.timeout(3000),cache:"no-store"});
      if (!response.ok) throw Error("status_unavailable");
      const value = await response.json();
      if (value.schema !== "ocean-operational-status/v1") throw Error("status_invalid");
      service = {kind:"isolated_original_app",runtime:serviceRuntime,release:value.release,status:{sampled_at:value.sampled_at,policy_version:value.policy_version,
        layers:Object.fromEntries(Object.entries(value.layers).map(([key,layer])=>[key,layer.state]))}};
    } catch { service = {kind:"isolated_original_app",runtime:serviceRuntime,release:null,status:null,reason:"status_unavailable"}; }
  }
  const identityAfterStarted=performance.now(),afterHashes=await collectArtifacts();
  const identityAfterMs=performance.now()-identityAfterStarted;
  const artifactIntegrity=JSON.stringify(afterHashes)===JSON.stringify(artifactHashes)?"unchanged":"changed";
  if(artifactIntegrity!=="unchanged")for(const attempt of attempts){
    if(attempt.status==="success"){attempt.status="failure";attempt.failure_reason="artifact_changed";attempt.elapsed_ms=null;attempt.after_action_ms=null;}
  }
  const quantile = (values, q) => values[Math.max(0, Math.ceil(q * values.length) - 1)];
  const summary = {};
  for (const scenario of scenarios) {
    const group = attempts.filter((a) => a.scenario === scenario);
    const good = group.filter((a) => a.status === "success").map((a) => a.elapsed_ms).sort((a, b) => a - b);
    summary[scenario] = { attempts: group.length, success: good.length, failure: group.filter((a) => a.status === "failure").length,
      timeout: group.filter((a) => a.status === "timeout").length, p50_ms: good.length ? quantile(good, .5) : null,
      p95_ms: good.length >= 20 ? quantile(good, .95) : null, tail_note: good.length < 20 ? "insufficient samples for stable tail claim" : "empirical nearest-rank; this environment only" };
  }
  const report = { service, artifact_integrity:artifactIntegrity, identity_collection_ms:{before:identityBeforeMs,after:identityAfterMs}, b1_qualified: false, schema: "ocean-map-baseline/v1", generated_at: new Date().toISOString(), sample_kind: sampleKind,
    runner_sha256: artifactHashes['tools/benchmark-map.mjs'],
    page_sha256: artifactHashes.entry_document??null,
    commit, tracked_changes_present:trackedChanges, artifact_hashes: artifactHashes, environment, attempts, summary, targets_verified: false,
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

}

function requestRole(value) {
  try {
    const path=new URL(value).pathname;
    if(path==="/api/health")return "health";
    if(path==="/api/viewport")return "viewport";
    if(/^\/api\/frontend\/day\//.test(path))return "day";
    if(/^\/api\/fishing\//.test(path))return "fishing";
    if(path.startsWith("/api/"))return "other_api";
    return /\.(js|css|html|ttf)$/.test(path)?"static_asset":"other";
  } catch { return "other"; }
}
function responseEncoding(headers) {
  const entry=Object.entries(headers||{}).find(([key])=>key.toLowerCase()==="content-encoding");
  if(!entry)return "identity";
  return ["gzip","br","deflate","zstd","identity"].includes(entry[1])?entry[1]:"other";
}
if(args.includes("--isolated-service")){
  if(args.includes("--page") || option("--sample-kind","B0-current")!=="B0-current")throw Error("Isolated original service cannot override page or claim a fixture");
  let entered=false;
  try{await withService((base,context)=>{entered=true;return runBaseline(base+"/prototype-fishing.html",true,context.runtime);});}
  catch{if(entered)throw Error('Managed baseline could not finish');await runBaseline(page,true,null,true);}
} else await runBaseline(page);
