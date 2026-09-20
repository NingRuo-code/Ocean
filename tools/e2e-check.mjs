import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 用法：node tools/e2e-check.mjs   （可用环境变量 EDGE / PAGE 覆盖）
const EDGE = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PAGE = process.env.PAGE || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "prototype-fishing.html")).href;
const PORT = 9337;
const PROFILE = join(process.env.TEMP || "C:\\temp", "_edge_profile_e2e");
const OUT = process.env.TEMP || "C:\\temp";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const addIsoDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
try { rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}

const child = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-allow-origins=*", `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  "--window-size=1680,900", PAGE], { stdio: "ignore" });

let wsUrl = null;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(300);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const t = list.find((x) => x.type === "page" && /prototype-fishing/.test(x.url));
    if (t) wsUrl = t.webSocketDebuggerUrl;
  } catch (e) {}
}
if (!wsUrl) { console.log("FAIL: 未能连接 Edge 调试端口"); child.kill(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });

let msgId = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  } else if (m.method === "Runtime.exceptionThrown") {
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errors.push(m.params.args.map((a) => a.value).join(" "));
  }
});
const send = (method, params = {}) => {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      rej(new Error("CDP 调用超时：" + method));
    }, 8000);
    pending.set(id, {
      res: (v) => { clearTimeout(timer); res(v); },
      rej: (e) => { clearTimeout(timer); rej(e); },
    });
  });
};

try {
  await send("Runtime.enable");
  await send("Page.enable");
} catch (e) {
  console.log("FAIL: Edge 调试连接未响应（" + e.message + "）");
  ws.close();
  child.kill();
  process.exit(1);
}

const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(function(){ ${expr} })()`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("eval 异常: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
  return r.result.value;
};

// 数据文件变多（每天一个 <script>，60+ 天），等 OFData 与首屏渲染就绪再断言，避免竞态
let pageReady = false;
for (let i = 0; i < 80 && !pageReady; i++) {
  await sleep(250);
  try {
    pageReady = (await evalJS(`return typeof OFData === "object" && typeof state === "object" &&
      !!document.querySelector("#gratHost") && (document.getElementById("timeDate").max || "") !== "";`)) === true;
  } catch (e) { pageReady = false; }
}
if (!pageReady) console.log("WARN: 页面 20s 内没进入就绪状态，后续断言可能失败");
const click = (sel) => evalJS(`var n=document.querySelector(${JSON.stringify(sel)}); if(!n) return "NOT_FOUND"; n.click(); return "OK";`);
const setVal = (sel, val) => evalJS(`var n=document.querySelector(${JSON.stringify(sel)}); if(!n) return "NOT_FOUND"; n.value=${JSON.stringify(val)}; n.dispatchEvent(new Event("change",{bubbles:true})); return "OK";`);
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(r.data, "base64"));
};
// 按经纬度把鼠标移到地图上（走真实 mousemove）
const hoverGeo = async (lon, lat) => {
  await evalJS(`var m=document.getElementById("map"), r=m.getBoundingClientRect(), p=screenOf(${lon}, ${lat});
    m.dispatchEvent(new MouseEvent("mousemove",{clientX:r.left+p.x, clientY:r.top+p.y, bubbles:true})); return 1;`);
  await sleep(150);
};
const clickGeo = async (lon, lat) => {
  await evalJS(`var m=document.getElementById("map"), r=m.getBoundingClientRect(), p=screenOf(${lon}, ${lat});
    m.dispatchEvent(new MouseEvent("click",{clientX:r.left+p.x, clientY:r.top+p.y, bubbles:true})); return 1;`);
  await sleep(150);
};
const PROBE = `var b=document.getElementById("mapProbe"), m=document.getElementById("map");
  var rb=b.getBoundingClientRect(), rm=m.getBoundingClientRect();
  return { hidden:b.hidden, text:b.textContent, rows:b.querySelectorAll(".mp-row").length, h:Math.round(rb.height),
    inBounds: rb.left>=rm.left-1 && rb.top>=rm.top-1 && rb.right<=rm.right+1 && rb.bottom<=rm.bottom+1 };`;
const results = [];
const check = (label, cond, detail) => { results.push(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  → " + detail : ""}`); };

// ===== 1) 真实数据接进来了 =====
const boot = await evalJS(`var m = OFData.meta, days = OFData.availableDates();
  return { hasAdapter: typeof OFData === "object", doi: m.product.doi, license: m.product.license,
    days: days, status: m.status, grid: OFData.grid(days[0]),
    input: { value: document.getElementById("timeDate").value, min: document.getElementById("timeDate").min, max: document.getElementById("timeDate").max },
    paths: { coast: document.querySelectorAll('#mapSvg path[data-layer="coast"]').length,
      land: document.querySelectorAll('#mapSvg path[data-layer="land"]').length,
      landFill: (document.querySelector('#mapSvg path[data-layer="land"]') || { getAttribute: function () { return null; } }).getAttribute("fill"),
      oceanFill: (document.querySelector('#mapSvg rect[data-layer="ocean"]') || { getAttribute: function () { return null; } }).getAttribute("fill"),
      cold: document.querySelectorAll('#mapSvg path[data-layer="cold"]').length,
      warm: document.querySelectorAll('#mapSvg path[data-layer="warm"]').length,
      band: document.querySelectorAll('#mapSvg path[data-layer="band"]').length,
      nodata: document.querySelectorAll('#mapSvg path[data-layer="nodata"]').length,
      grat: document.querySelectorAll('#mapSvg #gratHost line').length,
      objectLines: document.querySelectorAll('#mapSvg path[data-layer="front-line"][stroke="#ffffff"]').length },
    dataObjects: OFData.objects(document.getElementById("timeDate").value).length };`);
check("适配层 OFData 已加载且能读到真实数据文件", boot.hasAdapter === true && boot.days.length >= 3, boot.days.length + " 天：" + boot.days[0] + " ~ " + boot.days[boot.days.length - 1]);
check("数据产品与许可写在页面上（Zenodo 20356239 · CC BY 4.0）",
  boot.doi === "10.5281/zenodo.20356239" && boot.license === "CC BY 4.0", boot.doi + " / " + boot.license);
check("真实图层标成 real（锋面 + 海温），没接的（强度/海况/预报/渔场）标成 not_available",
  boot.status.front_line === "real" && boot.status.sst === "real" && boot.status.forecast === "not_available",
  JSON.stringify(boot.status));
check("日期控件范围 = 已导出观测日期（不写死日期）",
  boot.input.min === boot.days[0] && boot.input.max === boot.days[boot.days.length - 1] &&
  boot.days.indexOf(boot.input.value) >= 0,
  JSON.stringify(boot.input) + " · 共 " + boot.days.length + " 天");
check("地图用的是真实底图（海岸线 / 冷暖侧 / 锋面带 / 缺测掩码都画出来了）",
  boot.paths.coast === 1 && boot.paths.cold === 1 && boot.paths.warm === 1 && boot.paths.band === 1 && boot.paths.nodata === 1,
  JSON.stringify(boot.paths));
check("地图有真实经纬网（0.05° 数据窗口上的整数度格网）", boot.paths.grat >= 4, boot.paths.grat + " 条格网线");
check("陆地是实色块且与海面底色不同（不是同色看不见）",
  boot.paths.land === 1 && boot.paths.landFill && boot.paths.landFill !== boot.paths.oceanFill,
  "陆地 " + boot.paths.landFill + " vs 海面 " + boot.paths.oceanFill);

// 光栅化后数像素：陆地必须真的占了画面（防止"画了但看不见"）
const raster = await evalJS(`
  var src = document.getElementById("mapSvg").cloneNode(true);
  src.setAttribute("width", 1000); src.setAttribute("height", 640);
  var xml = new XMLSerializer().serializeToString(src);
  var url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = 1000; c.height = 640;
      var ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, 1000, 640);
      var d = ctx.getImageData(0, 0, 1000, 640).data;
      var land = 0, ocean = 0;
      for (var i = 0; i < d.length; i += 8) {
        if (d[i] === 58 && d[i + 1] === 80 && d[i + 2] === 104) land++;
        if (d[i] === 13 && d[i + 1] === 33 && d[i + 2] === 53) ocean++;
      }
      resolve({ imgOk: img.width + "x" + img.height, land: land * 2, ocean: ocean * 2 });
    };
    img.onerror = function () { resolve({ imgError: true }); };
    img.src = url;
  });`);
check("光栅化后陆地像素确实占了画面（默认视野里能看到海岸线与陆地）",
  raster.imgOk === "1000x640" && raster.land > 20000,
  "陆地 " + raster.land + " px · " + JSON.stringify(raster));
check("地图上的锋面对象线与数据文件一致（没有手写几何）",
  boot.paths.objectLines === boot.dataObjects, boot.paths.objectLines + " = " + boot.dataObjects);
await shot("shot-1-now.png");

// ===== 2) L0 顶栏：顺序看得见、时间只有一个入口 =====
const top = await evalJS(`return {
  nums: document.querySelectorAll(".topbar .ctx .num").length,
  labels: [].map.call(document.querySelectorAll(".topbar .ctx .ctx-lab"), function(n){ return n.textContent; }),
  dateInputs: document.querySelectorAll(".topbar input[type=date]").length,
  railInputs: document.querySelectorAll(".topbar input[type=range]#timeRail").length,
  playBtns: document.querySelectorAll("#datePlay").length,
  pickOriginBtns: document.querySelectorAll("#pickOriginBtn").length,
  railMax: document.getElementById("timeRail").max,
  railText: document.getElementById("timeRailText").textContent,
  otherInputs: document.querySelectorAll(".topbar input[type=month], .topbar input[type=number]").length,
  hasFamily: !!document.getElementById("familySeg"),
  topText: (document.querySelector(".topbar") || {}).textContent || "",
  rangeBtns: document.querySelectorAll("#rangeSeg button").length,
  fishingDefault: !!state.layers.fishing,
  fishingPaths: document.querySelectorAll('#mapSvg [data-layer="fishing"]').length,
  fishingLegend: (document.querySelector('.legend-row[data-layer="fishing"]') || {}).textContent || "" };`);
check("顶栏按使用顺序分成 3 组（出发地/作业范围/出海日）",
  top.nums === 3 && top.labels.join("|") === "出发地|作业范围|出海日", top.nums + " 组 · " + top.labels.join("/"));
check("顶栏没有第二套数据来源开关（观测/预报/气候 已删）",
  top.hasFamily === false && !/观测来源|预报|气候/.test(top.topText), "familySeg 不存在");
check("顶栏只有 1 个日期控件，无 month/number",
  top.dateInputs === 1 && top.otherInputs === 0, JSON.stringify({ date: top.dateInputs, other: top.otherInputs }));
check("出海日组内有同源时间轴与播放按钮",
  top.railInputs === 1 && top.playBtns === 1 && Number(top.railMax) === boot.days.length - 1 && /\/\d+/.test(top.railText),
  JSON.stringify({ rail: top.railInputs, play: top.playBtns, max: top.railMax, text: top.railText }));
check("找鱼范围 3 档可直接点", top.rangeBtns === 3, "rangeBtns=" + top.rangeBtns);
check("出发地支持输入定位和地图点选", top.pickOriginBtns === 1 && /点选/.test(top.topText), "pickOriginBtns=" + top.pickOriginBtns);
check("推荐水域是示例层，默认关闭，避免被误读成真实渔场数据",
  top.fishingDefault === false && top.fishingPaths === 0 && /示例，默认关/.test(top.fishingLegend),
  JSON.stringify({ layer: top.fishingDefault, paths: top.fishingPaths, text: top.fishingLegend }));

// ===== 3) 页签分层与默认态 =====
const tabs = await evalJS(`var bs = [].slice.call(document.querySelectorAll("#tabs button"));
  return { n: bs.length,
    labels: bs.map(function(b){ return b.textContent.trim(); }),
    primary: bs.filter(function(b){ return b.classList.contains("primary"); }).map(function(b){ return b.dataset.pane; }),
    secondary: bs.filter(function(b){ return b.classList.contains("secondary"); }).map(function(b){ return b.textContent.trim(); }),
    active: document.querySelector("#tabs button.active").dataset.pane,
    paneNow: document.getElementById("pane-now").classList.contains("active") };`);
check("页签 = 当前 / 历史 / 预测 / AI 分析",
  tabs.n === 4 && tabs.primary.join(",") === "now,clim,future,ai" &&
  tabs.labels.join("/") === "当前/历史/预测/AI 分析" && tabs.secondary.length === 0, JSON.stringify(tabs));
check("默认落在「当前」页", tabs.active === "now" && tabs.paneNow === true, tabs.active);

// ===== 3.1) 历史 AIS 响应：Front Response Table 契约入口 =====
const ais20 = await evalJS(`var r = OFData.frontResponse(document.getElementById("timeDate").value, state.range);
  return {
    available: OFData.frontResponseAvailable(),
    meta: OFData.frontResponseMeta(),
    response: r,
    tag: document.getElementById("aisResponseTag").textContent,
    list: document.getElementById("aisResponseList").textContent,
    why: document.getElementById("aisResponseWhyBody").textContent
  };`);
check("AIS 响应表通过 OFData 暴露，并明确当前是 synthetic fixture",
  ais20.available === true && ais20.meta.status === "synthetic_fixture" && ais20.meta.isSynthetic === true &&
  ais20.response.available === true && ais20.response.frontIdScope === "local_day",
  JSON.stringify({ status: ais20.meta.status, synthetic: ais20.meta.isSynthetic, scope: ais20.response.frontIdScope }));
check("当前页历史 AIS 响应卡片能展示响应增强夹具，并说明不是真实 AIS/GFW 证据",
  /夹具 · 响应增强/.test(ais20.tag) && /57\.8 h/.test(ais20.list) && /\+36%/.test(ais20.list) &&
  /synthetic fixture/.test(ais20.list) && /不是长期锋面轨迹 ID/.test(ais20.why),
  ais20.tag + " · " + ais20.list.slice(0, 80));
const ais10 = await evalJS(`document.querySelector('#rangeSeg button[data-range="10"]').click();
  var r = OFData.frontResponse(document.getElementById("timeDate").value, state.range);
  return { range: state.range, response: r, tag: document.getElementById("aisResponseTag").textContent,
    list: document.getElementById("aisResponseList").textContent };`);
check("切到 10 km 后，同一契约能展示“无明显增强”状态",
  ais10.range === 10 && ais10.response.available === true && ais10.response.enhanced === false &&
  /夹具 · 未见明确增强/.test(ais10.tag) && /34 h/.test(ais10.list),
  ais10.tag + " · range=" + ais10.range);
await evalJS(`document.querySelector('#rangeSeg button[data-range="20"]').click(); return state.range;`);

// ===== 4) 结论块：已并入「当前」页（2026-09-14 起不再常驻） =====
const hero = await evalJS(`return {
  inNow: !!document.querySelector("#pane-now #heroLine"),
  legacy: !!document.getElementById("hero") || !!document.getElementById("heroPoints"),
  verdict: document.getElementById("heroVerdict").textContent,
  line: document.getElementById("heroLine").textContent,
  when: document.getElementById("heroWhen").textContent,
  lead: (document.querySelector("#nowLead .row.clickable") || {}).textContent || "",
  why: document.getElementById("heroWhyBody").textContent };`);
check("结论块在「当前」页内，不再有常驻 hero 与首选点位卡",
  hero.inNow === true && hero.legacy === false, "inNow=" + hero.inNow + " · legacy=" + hero.legacy);
check("结论块给出三档结论之一（值得去 / 可以看看 / 线索不足）",
  ["值得去", "可以看看", "线索不足"].indexOf(hero.verdict) >= 0, hero.verdict);
check("结论行含范围内锋面区数量 / 把握度 / 方位 / 距离（已无航时·油耗）",
  /作业范围 20 km 内/.test(hero.line) && /(个锋面区|暂无锋面区)/.test(hero.line) &&
  /把握度 \d+%/.test(hero.line) && /(正北|东北|正东|东南|正南|西南|正西|西北)/.test(hero.line) &&
  /km/.test(hero.line) && !/小时|油耗/.test(hero.line), hero.line.slice(0, 70));
check("结论卡写明看的是哪一天、数据是实况观测",
  /（今天）|（\+\d 天）|（-\d 天）/.test(hero.when) && /观测/.test(hero.when), hero.when);
check("结论块首选锋面区指向数据里的真实对象编号（取「作业线索」首条）",
  /F\d{3}/.test(hero.lead) && boot.dataObjects > 0, hero.lead.replace(/\s+/g, " ").slice(0, 48));
check("「评分依据」列出分项与合计，并说明未参与评分的项",
  /起评分/.test(hero.why) && /合计把握/.test(hero.why) &&
  /数据来源/.test(hero.why) && /未参与评分/.test(hero.why), hero.why.slice(0, 40));

// ===== 5) 现在页（真实观测数据） =====
const now = await evalJS(`var ms = [].slice.call(document.querySelectorAll("#nowMetrics .m")).map(function(n){ return n.textContent; });
  return { ms: ms, scope: document.getElementById("nowScopeTag").textContent,
    sea: document.getElementById("seaList").textContent, seaTag: document.getElementById("seaTag").textContent,
    cards: document.querySelectorAll("#pane-now > .card").length,
    leadRows: document.querySelectorAll("#nowLead .row").length,
    leadClickable: document.querySelectorAll("#nowLead .row.clickable").length,
    detailsText: (document.querySelector("#nowFrontDetails summary") || {}).textContent || "",
    fronts: document.querySelectorAll("#nowFronts .row").length, frontTag: document.getElementById("nowFrontTag").textContent,
    dataObjects: OFData.objects(document.getElementById("timeDate").value).length,
    coverage: 100 - OFData.quality(document.getElementById("timeDate").value).nodata_percent,
    bodyText: document.body.innerText };`);
check("现在页 4 个指标格（锋面区 / 最近锋面 / 所处侧 / 把握度）",
  now.ms.length === 4 && /锋面区/.test(now.ms[0]) && /把握/.test(now.ms[3]), now.ms.length + " 格");
check("现在页的范围标签跟着「作业范围」走，并标出数据覆盖",
  /20 km/.test(now.scope) && new RegExp(now.coverage.toFixed(1) + "%").test(now.scope), now.scope);
check("海况安全提示标成「示例数据 · 仅供参考」，并提示以官方预报为准",
  /示例数据/.test(now.seaTag) && /仅供参考/.test(now.seaTag) && /官方海洋预报/.test(now.sea), now.seaTag);
check("当前页默认三张信息卡（当前观测 / 历史 AIS 响应 / 展开细节），海况仍作为展开项",
  now.cards === 3 && /全部锋面区/.test(now.detailsText), "cards=" + now.cards + " · " + now.detailsText);
check("当前页默认作业线索不超过 3 条，完整清单保留在展开项",
  now.leadRows >= 1 && now.leadRows <= 3 && now.fronts === now.dataObjects,
  "lead=" + now.leadRows + " / all=" + now.fronts + " / data=" + now.dataObjects);
const shownCoverage = now.scope.match(/(\d+\.\d)%/);
check("数据覆盖数与数据文件一致（缺测率来自真实掩码）",
  !!shownCoverage && Math.abs(parseFloat(shownCoverage[1]) - now.coverage) < 0.05,
  (shownCoverage ? shownCoverage[1] : "—") + "% vs 数据 " + now.coverage.toFixed(1) + "%");
// 海温现在有真实数据：页面上的温度必须能在数据文件里找到（按 0.5 °C 档位比对）
const sstNow = await evalJS(`var iso = document.getElementById("timeDate").value;
  var day = OFData.sst(iso);
  var bins = {}; ((day || {}).runs || []).forEach(function (r) { bins[r[3]] = 1; });
  return { tag: document.getElementById("nowScopeTag").textContent,
    cell: OFData.sstCell(iso, 124.5, 30.2), stats: OFData.sstStats(iso),
    bins: Object.keys(bins).length,
    paths: document.querySelectorAll('#mapSvg path[data-layer="sst"]').length };`);
const shownTemp = (sstNow.tag.match(/定位点水温 ([\d.]+) °C/) || [])[1];
check("页面上的水温与数据文件一致（定位点档位，不是编造值）",
  sstNow.cell && sstNow.cell.valueC !== null ? shownTemp === sstNow.cell.valueC.toFixed(1)
    : shownTemp === undefined,
  "页面 " + (shownTemp || "—") + " vs 数据 " + (sstNow.cell ? sstNow.cell.valueC : "null"));
check("页面不出现数据里没有的温度（范围也来自同一天的数据）",
  !/\d+\.\d °C/.test(now.bodyText) ||
  (sstNow.stats && parseFloat(now.bodyText.match(/([\d.]+) °C/)[1]) >= sstNow.stats.vmin_c - 0.05 &&
    parseFloat(now.bodyText.match(/([\d.]+) °C/)[1]) <= sstNow.stats.vmax_c + 0.05),
  "数据 " + (sstNow.stats ? sstNow.stats.vmin_c + "~" + sstNow.stats.vmax_c + " °C" : "—"));
check("地图上海温一层一档（档位数 = 数据文件里的档位数，没有手写色块）",
  sstNow.paths > 0 && sstNow.paths === sstNow.bins, sstNow.paths + " = " + sstNow.bins);
await shot("shot-2-now-detail.png");

// ===== 6) 预测页：规则预测参考，不冒充业务预报 =====
await click('#tabs button[data-pane="future"]');
const fut = await evalJS(`return {
  cards: document.querySelectorAll("#pane-future > .card").length,
  dayBox: !!document.getElementById("futureDaysBox"),
  bars: document.querySelectorAll("#futureBars i").length,
  rows: document.querySelectorAll("#futureDays .row").length,
  clickable: document.querySelectorAll("#futureDays .row.clickable").length,
  windows: [].map.call(document.querySelectorAll("#futureWindow button"), function(b){ return b.textContent.trim(); }),
  activeWindow: document.querySelector("#futureWindow button.active").dataset.window,
  why: document.getElementById("futureWhyBody").textContent,
  observable: [1,2,3,4,5,6,7].filter(function (n) {
    var d = new Date(Date.parse(document.getElementById("timeDate").value + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
    return OFData.hasDay(d);
  }).length,
  tag: document.getElementById("futureTag").textContent,
  list: document.getElementById("futureList").textContent,
  days: OFData.availableDates() };`);
check("预测页给出 7 天规则预测参考（有柱、有行）", fut.bars === 7 && fut.rows === 7, `bars=${fut.bars} rows=${fut.rows}`);
check("预测页合并为一张预测卡，逐日明细放入展开项",
  fut.cards === 1 && fut.dayBox === true, "cards=" + fut.cards);
check("预测页支持 1 / 3 / 7 天窗口切换，并提供依据展开",
  fut.windows.join("/") === "1 天/3 天/7 天" && fut.activeWindow === "3" &&
  /当前信号/.test(fut.why) && /持续性/.test(fut.why) && /历史参照/.test(fut.why),
  fut.windows.join("/") + " · active=" + fut.activeWindow);
check("预测页写明规则参考来源与真实预报缺口",
  /规则参考/.test(fut.tag) && /近几日持续性/.test(fut.list) && /历史同期/.test(fut.list) &&
  /强度、AIS、海况尚未接入/.test(fut.list),
  fut.tag + " · " + fut.list.slice(0, 30));
check("预测页只允许点已有样例日期回看实况",
  fut.clickable === fut.observable, fut.clickable + " 条可点 · 7 天内已有实况 " + fut.observable + " 天");
const pickDay = await evalJS(`var rows = document.querySelectorAll("#futureDays .row.clickable");
  var idx = Math.min(2, rows.length - 1);
  var d = rows[idx].dataset.date; rows[idx].click();
  return { d: d, top: document.getElementById("timeDate").value };`);
await sleep(150);
check("点某天 → 顶栏「出海日」同步（全站仍只有一个时间真源）", pickDay.d === pickDay.top, pickDay.d + " = " + pickDay.top);
await shot("shot-3-future.png");
const stepped = await evalJS(`var before = document.getElementById("timeDate").value;
  document.getElementById("datePrev").click(); document.getElementById("datePrev").click();
  var after = document.getElementById("timeDate").value;
  return { before: before, after: after,
    rail: document.getElementById("timeRail").value,
    expectedRail: String(OFData.availableDates().indexOf(after)),
    railText: document.getElementById("timeRailText").textContent };`);
check("「出海日」◀ 按天回退（期望值按数据推导，不写死日期）",
  stepped.after === addIsoDays(stepped.before, -2), stepped.before + " → " + stepped.after + "（期望 " + addIsoDays(stepped.before, -2) + "）");
check("日期变化后时间轴同步",
  stepped.rail === stepped.expectedRail && /\/\d+/.test(stepped.railText),
  "rail=" + stepped.rail + " · expected=" + stepped.expectedRail + " · " + stepped.railText);

// ===== 7) 历史（真实多年度统计 + 实况聚合，页内没有日期控件） =====
await click('#tabs button[data-pane="clim"]');
const clim = await evalJS(`var data = OFData.clim;
  return { inputs: document.querySelectorAll("#pane-clim input").length,
    btns: [].map.call(document.querySelectorAll("#climPeriod button"), function(b){ return b.textContent.trim(); }),
    bars: document.querySelectorAll("#climBars i").length,
    hint: document.getElementById("climHint").textContent,
    stat: document.getElementById("climStat").textContent,
    years: document.getElementById("climYears").textContent,
    method: data.method, sample: data.sample_note,
    daySamples: data.by_day["08-05"].by_range["20"].days,
    yearCount: Object.keys(data.by_year).length,
    gap: (function () {
      var md = document.getElementById("timeDate").value.slice(5);
      var entry = data.by_day[md] || { years: {} };
      var yearsOfDay = Object.keys(entry.years);
      return Object.keys(data.by_year).some(function (y) { return yearsOfDay.indexOf(y) < 0; });
    })(),
    missingMarked: [].slice.call(document.querySelectorAll("#climBars i")).some(function(b){ return /缺测/.test(b.getAttribute("title") || ""); }),
    note: (document.querySelector("#pane-clim .hint") || {}).textContent || "" };`);
check("历史页没有任何日期输入框（锚点跟着顶栏出海日）",
  clim.inputs === 0 && /出海日/.test(clim.note), "inputs=" + clim.inputs);
check("历史尺度有 6 个按钮：当日 / 3日 / 7日 / 15日 / 当月 / 整年",
  clim.btns.join("/") === "当日/3 日/7 日/15 日/当月/整年", clim.btns.join("/"));
check("「这一天」柱数 = 数据里覆盖的全部年份（有缺样本的年份才标「缺测」）",
  clim.bars === clim.yearCount && clim.missingMarked === clim.gap,
  clim.bars + " 柱 / " + clim.yearCount + " 年 · 缺测标注=" + clim.missingMarked + "（数据里是否有缺口=" + clim.gap + "）");
check("写明口径（比例 + 样本数）与唯一算法口径",
  /比例/.test(clim.stat) && /%/.test(clim.stat) && /年份样本/.test(clim.stat) && /front_present/.test(clim.years),
  clim.stat.slice(0, 46));
check("写明抽样口径（实际取样天数）", /实际取样 \d+ 天/.test(clim.sample), clim.sample.slice(-30));
await shot("shot-4-clim.png");

const climPeriod = await evalJS(`document.querySelector('#climPeriod button[data-period="period"]').click();
  return { bars: document.querySelectorAll("#climBars i").length,
    stat: document.getElementById("climStat").textContent, years: document.getElementById("climYears").textContent };`);
check("「近三日」按年份给占比，并说明为什么要看大半径",
  climPeriod.bars === clim.yearCount && /100 km/.test(climPeriod.stat) && /为什么看 100 km/.test(climPeriod.years),
  climPeriod.stat.slice(0, 40));
const climWeek = await evalJS(`document.querySelector('#climPeriod button[data-period="week"]').click();
  return { bars: document.querySelectorAll("#climBars i").length,
    heat: document.querySelectorAll("#climHeat .heat-cell").length,
    stat: document.getElementById("climStat").textContent, years: document.getElementById("climYears").textContent,
    hint: document.getElementById("climHint").textContent };`);
check("「7 日」展示连续日实况窗口，并说明多年连续窗口缺口",
  climWeek.bars > 0 && climWeek.heat === climWeek.bars && /近 7 日/.test(climWeek.stat) && /连续日实况回放/.test(climWeek.years), climWeek.hint);
const climHalf = await evalJS(`document.querySelector('#climPeriod button[data-period="halfmonth"]').click();
  return { bars: document.querySelectorAll("#climBars i").length,
    heat: document.querySelectorAll("#climHeat .heat-cell").length,
    stat: document.getElementById("climStat").textContent, years: document.getElementById("climYears").textContent,
    hint: document.getElementById("climHint").textContent };`);
check("「15 日」展示连续日实况窗口，并说明样本边界",
  climHalf.bars > 0 && climHalf.heat === climHalf.bars && /近 15 日/.test(climHalf.stat) && /未导出的日期不进入分母/.test(climHalf.years), climHalf.hint);
const climMonth = await evalJS(`document.querySelector('#climPeriod button[data-period="month"]').click();
  return { bars: document.querySelectorAll("#climBars i").length,
    heat: document.querySelectorAll("#climHeat .heat-cell").length,
    stat: document.getElementById("climStat").textContent, years: document.getElementById("climYears").textContent,
    hint: document.getElementById("climHint").textContent };`);
check("「当月」展示已导出实况样例，并说明多年整月缺口",
  climMonth.bars > 0 && climMonth.heat === climMonth.bars && /当月实况/.test(climMonth.stat) && /多年整月/.test(climMonth.years), climMonth.hint);
const climYear = await evalJS(`document.querySelector('#climPeriod button[data-period="year"]').click();
  return { bars: document.querySelectorAll("#climBars i").length,
    heat: document.querySelectorAll("#climHeat .heat-cell").length,
    stat: document.getElementById("climStat").textContent, years: document.getElementById("climYears").textContent,
    hint: document.getElementById("climHint").textContent };`);
check("「整年」展示样例年，并说明不是完整全年统计",
  climYear.bars > 0 && climYear.heat === climYear.bars && /整年视图/.test(climYear.stat) && /全年缺口/.test(climYear.years), climYear.hint);
await evalJS(`document.querySelector('#climPeriod button[data-period="day"]').click(); return 1;`);

// ===== 8) AI 分析 + 数据说明 =====
await click('#tabs button[data-pane="ai"]');
const ai = await evalJS(`return {
  tag: document.getElementById("aiTag").textContent,
  summary: document.getElementById("aiSummary").textContent,
  plan: document.getElementById("aiPlan").textContent,
  next: document.getElementById("aiNext").textContent,
  evidence: document.getElementById("aiEvidenceBody").textContent,
  cards: document.querySelectorAll("#pane-ai > .card").length,
  planBox: !!document.getElementById("aiPlanBox") };`);
check("AI 分析只做证据组织与任务编排",
  /证据驱动/.test(ai.tag) && /解析任务/.test(ai.plan) && /证据边界/.test(ai.plan) &&
  /查看规则预测参考/.test(ai.next) && /当前证据/.test(ai.evidence) && /预测证据/.test(ai.evidence),
  ai.tag + " · " + ai.plan.slice(0, 36));
check("AI 页合并为一张复核卡，任务编排放入展开项",
  ai.cards === 1 && ai.planBox === true, "cards=" + ai.cards);
await evalJS(`switchTab("basis"); return 1;`);
const basis = await evalJS(`return {
  data: document.querySelectorAll("#basisData .tr").length,
  rules: document.querySelectorAll("#basisRules .row").length,
  limits: document.querySelectorAll("#basisLimits .row").length,
  dataText: document.getElementById("basisData").textContent,
  rulesText: document.getElementById("basisRules").textContent,
  limitsText: document.getElementById("basisLimits").textContent,
  noFuel: !/航时|油耗/.test(document.body.textContent) };`);
check("数据说明：数据来源至少 14 行 / 算法不少于 5 条（含 AIS 响应时可增加）/ 局限不少于 7 条",
  basis.data >= 14 && basis.rules >= 5 && basis.limits >= 7,
  JSON.stringify({ data: basis.data, rules: basis.rules, limits: basis.limits }));
check("全页（含隐藏面板）不再出现「航时 / 油耗」文案", basis.noFuel === true, "noFuel=" + basis.noFuel);
check("数据来源写清产品、许可与底图出处",
  /zenodo\.20356239/.test(basis.dataText) && /CC BY 4\.0/.test(basis.dataText) &&
  /Natural Earth/.test(basis.dataText), "DOI / 许可 / 底图都有了");
check("算法说明给出口径（起评分 / 数据覆盖 / front_present）",
  /起评分/.test(basis.rulesText) && /数据覆盖/.test(basis.rulesText) && /front_present/.test(basis.rulesText), "ok");
check("局限里逐条写明数据来源与没接入的东西（海温来源 / 规则预测参考 / 强度 / 海况 / 预报 / 渔场 / -128 语义）",
  /-128/.test(basis.limitsText) && /海表温度/.test(basis.limitsText) && /海况/.test(basis.limitsText) &&
  /预报/.test(basis.limitsText) && /规则预测参考/.test(basis.limitsText), basis.limitsText.slice(0, 40));
check("局限里提示底图精度与国内发布的审图号要求",
  /Natural Earth/.test(basis.limitsText) && /审图号/.test(basis.limitsText), "ok");
await shot("shot-5-basis.png");
await click('#tabs button[data-pane="now"]');

// ===== 9) 指针查询：指到哪，就显示那里的真实数据 =====
// 找一个真实存在锋面线的像元（从数据里取，不猜坐标）
const bandPoint = await evalJS(`var iso = document.getElementById("timeDate").value;
  var day = OFData.day(iso), g = day.grid, run = day.front_band_rle[0];
  return { iso: iso, lon: g.lon0 + (run[1] + Math.floor(run[2] / 2)) * g.dlon, lat: g.lat0 + run[0] * g.dlat,
    code: run[3] };`);
await hoverGeo(bandPoint.lon, bandPoint.lat);
const p1 = await evalJS(PROBE);
check("鼠标移到锋面线像元 → 浮层只给坐标 + 水温 + 最近锋面距离 + 锋面区",
  p1.hidden === false && /\d+\.\d+°E, \d+\.\d+°N/.test(p1.text) && /水温/.test(p1.text) &&
  /最近锋面/.test(p1.text) && /锋面区/.test(p1.text), p1.text.slice(0, 40));
check("浮层里的「锋面区」按数据判为锋面线（与取样像元同源）",
  p1.text.indexOf("是 · 锋面线") >= 0, "数据像元编码 " + bandPoint.code + " → 浮层判为锋面线");
check("浮层含该格真实水温（或明确说明没有，绝不插值）",
  /\d+\.\d °C/.test(p1.text) || /该格无水温数据|该日期无数据/.test(p1.text), "水温有值或缺省已说明");
check("浮层已精简到 4 项（1 行坐标 + 3 行信息，不含方位 / 编码 / 数据类型 / 推荐水域）",
  p1.rows === 3 && p1.h <= 150 && !/离你|方位|数据类型|推荐水域|编码/.test(p1.text),
  "rows=" + p1.rows + " · h=" + p1.h + "px · " + p1.text.replace(/\s+/g, " ").slice(0, 60));
const probeTemp = (p1.text.match(/([\d.]+) °C/) || [])[1];
const dataTemp = await evalJS(`var c = OFData.sstCell(document.getElementById("timeDate").value, ${bandPoint.lon}, ${bandPoint.lat});
  return c && c.valueC !== null ? c.valueC.toFixed(1) : null;`);
check("浮层里的海温就是该点在数据文件里的值（与数据同源）",
  probeTemp === undefined || probeTemp === dataTemp,
  "浮层 " + (probeTemp || "—") + " vs 数据 " + dataTemp);
check("浮层不会跑出地图边界", p1.inBounds === true, String(p1.inBounds));
await shot("shot-6-probe.png");

// 缺测像元（陆地 / 云）：必须只说没观测，不给数值
const noDataPoint = await evalJS(`var iso = document.getElementById("timeDate").value;
  var day = OFData.day(iso), g = day.grid, best = null;
  day.nodata_rle.forEach(function(r){ var d = Math.pow(r[0]-g.ny/2,2) + Math.pow(r[1]-g.nx/2,2);
    if (!best || d < best.d) best = { d: d, row: r[0], col: r[1] }; });
  return { lon: g.lon0 + best.col * g.dlon, lat: g.lat0 + best.row * g.dlat };`);
await hoverGeo(noDataPoint.lon, noDataPoint.lat);
const p2 = await evalJS(PROBE);
check("鼠标移到没有观测的像元 → 直说没有观测数据，不给任何数值",
  /没有观测数据/.test(p2.text) && !/离你/.test(p2.text) && !/待接入/.test(p2.text) &&
  !/最近锋面/.test(p2.text) && p2.rows === 0, "rows=" + p2.rows + " · " + p2.text.slice(0, 30));

// 钉住 / 取消 / Esc
await hoverGeo(bandPoint.lon, bandPoint.lat);
await clickGeo(bandPoint.lon, bandPoint.lat);
const pin1 = await evalJS(PROBE);
const pinTxt = pin1.text;
check("点一下就钉住（浮层留在原地）", pin1.hidden === false && /钉住/.test(pin1.text), pinTxt.slice(0, 22));
await hoverGeo(noDataPoint.lon, noDataPoint.lat);
const pin2 = await evalJS(PROBE);
check("钉住后鼠标乱动不会改掉浮层", pin2.text === pinTxt, pin2.text === pinTxt ? "内容保持不变" : "被改掉了");
await shot("shot-7-pinned.png");
await clickGeo(bandPoint.lon, bandPoint.lat);
check("再点同一个点 → 取消钉住", (await evalJS(PROBE)).hidden === true, "已取消");
await clickGeo(noDataPoint.lon, noDataPoint.lat);
await evalJS(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return 1;`);
check("Esc 取消钉住", (await evalJS(PROBE)).hidden === true, "已取消");

// ===== 10) 选中回执：点了谁、怎么取消 =====
const pick = await evalJS(`var pt = document.querySelector("#nowLead .row.clickable"); var id = pt.dataset.id; pt.click();
  return { id: id, hidden: document.getElementById("mapPick").hidden,
    name: document.getElementById("pickName").textContent,
    body: document.getElementById("pickBody").textContent,
    x: document.getElementById("pickClose").textContent.trim(),
    dimmed: [].slice.call(document.querySelectorAll("#mapSvg *")).filter(function(n){ return n.getAttribute("opacity") === "0.16"; }).length };`);
await sleep(150);
check("点当前页作业线索首条 → 地图上出现「选中回执」卡（标题是真实对象编号）",
  pick.hidden === false && pick.name.indexOf(pick.id) >= 0, pick.name + " · " + pick.body.slice(0, 24));
check("回执卡给出长度 / 距离 / 侧别（都来自数据）",
  /长 \d+ km/.test(pick.body) && /离你/.test(pick.body) && /你在/.test(pick.body), pick.body.slice(0, 36));
check("选中后地图上其它对象被压暗", pick.dimmed > 0, "dimmed=" + pick.dimmed);
check("回执卡带 ✕ 可以取消", pick.x === "✕", pick.x);
await shot("shot-8-pick.png");
await click("#pickClose");
const pickOff = await evalJS(`return { hidden: document.getElementById("mapPick").hidden,
  dimmed: [].slice.call(document.querySelectorAll("#mapSvg *")).filter(function(n){ return n.getAttribute("opacity") === "0.16"; }).length };`);
check("点 ✕ → 取消选中并恢复地图", pickOff.hidden === true && pickOff.dimmed === 0, JSON.stringify(pickOff));

// ===== 11) 图层开关真实重绘 =====
const layer = await evalJS(`function cnt(sel){ return document.querySelectorAll(sel).length; }
  var band = document.querySelector('.legend-row[data-layer="band"]');
  band.click(); var bandOff = cnt('#mapSvg path[data-layer="band"]');
  band.click(); var bandOn = cnt('#mapSvg path[data-layer="band"]');
  var nod = document.querySelector('.legend-row[data-layer="nodata"]');
  var before = { on: !!state.layers.nodata, paths: cnt('#mapSvg path[data-layer="nodata"]') };
  nod.click(); var nodOff = cnt('#mapSvg path[data-layer="nodata"]');
  nod.click(); var nodOn = cnt('#mapSvg path[data-layer="nodata"]');
  return { bandOff: bandOff, bandOn: bandOn, nodOff: nodOff, nodOn: nodOn, before: before,
    afterOn: !!state.layers.nodata, runs: (OFData.day(state.date).nodata_rle || []).length };`);
check("锋面带 / 缺测图层开关都真实重绘",
  layer.bandOff === 0 && layer.bandOn === 1 && layer.nodOff === 0 && layer.nodOn === 1,
  JSON.stringify(layer));

// ===== 11.5) 地图交互：缩放 / 平移 / 比例尺 / 经纬网标注（纯几何，不改数据） =====
const zoom = await evalJS(`var r = document.getElementById("map").getBoundingClientRect();
  var c = [r.left + r.width / 2, r.top + r.height / 2];
  var before = currentView();
  var gratLines = document.querySelectorAll("#gratHost line").length;
  var gratTexts = [].map.call(document.querySelectorAll("#gratHost text"), function(n){ return n.textContent; });
  zoomAt(c[0], c[1], 2);
  var after = currentView();
  var bar = document.getElementById("mapScale").style.width;
  document.getElementById("recenter").click();
  var back = currentView();
  return { before: before, after: after, back: back, bar: bar,
    zoomAfter: state.zoom, gratLines: gratLines, gratTexts: gratTexts };`);
check("缩放改变视窗，比例尺跟着换算（图上 50 km 换算成像素）",
  zoom.after.w < zoom.before.w && /^\d+px$/.test(zoom.bar) && parseInt(zoom.bar, 10) > 0,
  "viewBox " + zoom.before.w + " → " + zoom.after.w + " · bar=" + zoom.bar);
check("经纬网标出真实度数（°E / °N），不是等分格网",
  zoom.gratLines >= 4 && zoom.gratTexts.some((t) => /°E$/.test(t)) && zoom.gratTexts.some((t) => /°N$/.test(t)),
  zoom.gratLines + " 条 · " + zoom.gratTexts.slice(0, 4).join(" / "));
check("「回到定位点」复位视窗与缩放（回到初始默认视野）",
  zoom.back.w === zoom.before.w && zoom.back.x === zoom.before.x && zoom.back.y === zoom.before.y,
  JSON.stringify(zoom.back) + " = " + JSON.stringify(zoom.before));

// ===== 11.6) 地图点选出发地：坐标输入与地图点击同源 =====
const originPick = await evalJS(`var btn = document.getElementById("pickOriginBtn");
  btn.click();
  return { on: !!state.pickOrigin, active: btn.classList.contains("active"), text: btn.textContent,
    mapMode: document.getElementById("map").classList.contains("pick-origin") };`);
check("点「点选」进入地图设置出发地模式",
  originPick.on === true && originPick.active === true && originPick.mapMode === true && /点地图/.test(originPick.text),
  JSON.stringify(originPick));
await clickGeo(bandPoint.lon, bandPoint.lat);
const originAfter = await evalJS(`return { on: !!state.pickOrigin, lon: state.lon, lat: state.lat,
  input: document.getElementById("locInput").value,
  mapMode: document.getElementById("map").classList.contains("pick-origin"),
  probeHidden: document.getElementById("mapProbe").hidden,
  pickHidden: document.getElementById("mapPick").hidden };`);
check("点地图后出发地、输入框、结论状态一起更新",
  originAfter.on === false && originAfter.mapMode === false &&
  Math.abs(originAfter.lon - bandPoint.lon) < 0.01 && Math.abs(originAfter.lat - bandPoint.lat) < 0.01 &&
  originAfter.input.indexOf(originAfter.lon.toFixed(2) + "°E") >= 0 &&
  originAfter.probeHidden === true && originAfter.pickHidden === true,
  JSON.stringify(originAfter));
const originTyped = await evalJS(`var input = document.getElementById("locInput");
  input.value = "30.20N，124.50E";
  document.getElementById("locateBtn").click();
  return { lon: state.lon, lat: state.lat, input: input.value, scope: document.getElementById("nowScopeTag").textContent };`);
check("坐标输入支持 N/E 标注和中文逗号，并归一成经度、纬度",
  Math.abs(originTyped.lon - 124.5) < 0.01 && Math.abs(originTyped.lat - 30.2) < 0.01 &&
  /124\.50°E, 30\.20°N/.test(originTyped.input) && /20 km/.test(originTyped.scope),
  JSON.stringify(originTyped));

// ===== 12) 目标鱼种已下线（本期不做）：没有第二套偏好真源 =====
const noSpecies = await evalJS(`return {
  selects: document.querySelectorAll("#speciesSel, .topbar select").length,
  scope: document.getElementById("nowScopeTag").textContent,
  why: document.getElementById("heroWhyBody").textContent,
  rules: document.getElementById("basisRules").textContent };`);
check("顶栏已无鱼种控件（可调维度只剩定位 / 范围 / 日期）",
  noSpecies.selects === 0, "顶栏 select 数 = " + noSpecies.selects);
check("作用域标签不再带鱼种（只写范围 / 观测覆盖 / 定位点海温）",
  !/带鱼|小黄鱼|鲐鱼|乌贼/.test(noSpecies.scope), noSpecies.scope);
check("把握明细里没有「鱼偏好」这类加成项", !/偏好/.test(noSpecies.why), noSpecies.why.slice(0, 40));
check("「依据」页写明冷暖侧只展示、不加分",
  /冷暖侧只展示、不加分/.test(noSpecies.rules), noSpecies.rules.slice(0, 26));

// ===== 13) 找鱼范围 =====
const r10 = await evalJS(`document.querySelector('#rangeSeg button[data-range="10"]').click();
  return { scope: document.getElementById("nowScopeTag").textContent, line: document.getElementById("heroLine").textContent,
    tag: document.getElementById("nowFrontTag").textContent };`);
check("找鱼范围 10 km 生效（真源驱动，清单也跟着变）",
  /10 km/.test(r10.scope) && /10 km/.test(r10.line) && /范围内/.test(r10.tag), r10.tag.slice(0, 30));
await shot("shot-9-range10.png");
await evalJS(`document.querySelector('#rangeSeg button[data-range="30"]').click(); return 1;`);
const r30 = await evalJS(`return document.getElementById("nowScopeTag").textContent;`);
check("找鱼范围 30 km 生效", /30 km/.test(r30), r30.slice(0, 30));
await evalJS(`document.querySelector('#rangeSeg button[data-range="20"]').click(); return 1;`);

// ===== 14) 日期越界被钳制（范围就是已导出的观测日期） =====
const bounds = await evalJS(`return { min: OFData.firstDate(), max: OFData.lastDate(),
  value: document.getElementById("timeDate").value,
  inputMin: document.getElementById("timeDate").min, inputMax: document.getElementById("timeDate").max };`);
check("日期控件范围与数据一致（不写死日期）",
  bounds.inputMin === bounds.min && bounds.inputMax === bounds.max,
  bounds.inputMin + " ~ " + bounds.inputMax);
const clampHi = await evalJS(`var n = document.getElementById("timeDate"); n.value = "2099-12-01";
  n.dispatchEvent(new Event("change", { bubbles: true })); return n.value;`);
check("日期超出已导出范围 → 收敛到数据里的最后一天", clampHi === bounds.max, clampHi + " = " + bounds.max);
const clampLo = await evalJS(`var n = document.getElementById("timeDate"); n.value = "1999-01-01";
  n.dispatchEvent(new Event("change", { bubbles: true })); return n.value;`);
check("日期早于导出起点 → 收敛到数据里的第一天", clampLo === bounds.min, clampLo + " = " + bounds.min);
const noData = await evalJS(`var d = new Date(Date.parse(OFData.firstDate() + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  return OFData.dateInfo(d);`);
check("没导出的日期给出明确原因与可选范围（不是空图）",
  noData.ok === false && /这天没有数据/.test(noData.title) && noData.desc.indexOf(bounds.min) >= 0,
  noData.desc.slice(0, 46));

// ===== 15) 键盘可达性 =====
const kb = await evalJS(`var b = document.querySelector('#tabs button[data-pane="now"]'); b.focus();
  b.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  return document.getElementById("pane-clim").classList.contains("active");`);
check("方向键可切换页签（可访问性）", kb === true, String(kb));
await click('#tabs button[data-pane="now"]');

// ===== 16) 覆盖层可见性：按 computed style 与命中测试判，不看 hidden 属性 =====
// （曾经的回归：.map-empty{display:grid} 压过 UA 的 [hidden]{display:none}，
//   有数据时遮罩也一直盖在地图上，而只断言 el.hidden 的测试全绿。）
const vis = await evalJS(`var ov = document.getElementById("mapEmpty"), m = document.getElementById("map"),
    r = m.getBoundingClientRect();
  var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { empty: getComputedStyle(ov).display, hiddenAttr: ov.hidden,
    probe: getComputedStyle(document.getElementById("mapProbe")).display,
    pick: getComputedStyle(document.getElementById("mapPick")).display,
    hitIsOverlay: !!(hit && hit.closest && hit.closest(".map-empty")),
    svg: getComputedStyle(document.getElementById("mapSvg")).display,
    legend: document.querySelector(".map-legend").getBoundingClientRect().width };`);
check("有数据时地图遮罩真的不显示（computed style，不只是 hidden 属性）",
  vis.empty === "none" && vis.hiddenAttr === true, "display=" + vis.empty + " · hidden=" + vis.hiddenAttr);
check("地图中心点到的是地图本身（遮罩没有挡住交互）", vis.hitIsOverlay === false, "命中遮罩=" + vis.hitIsOverlay);
check("指针浮层 / 选中回执卡无内容时不占位",
  vis.probe === "none" && vis.pick === "none", "probe=" + vis.probe + " · pick=" + vis.pick);
const emptyState = await evalJS(`var no = new Date(Date.parse(OFData.firstDate() + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  state.date = no; refresh();
  var ov = document.getElementById("mapEmpty");
  return { display: getComputedStyle(ov).display, title: document.getElementById("mapEmptyTitle").textContent,
    desc: document.getElementById("mapEmptyDesc").textContent,
    hero: document.getElementById("heroVerdict").textContent };`);
check("没有数据的那一天才出现遮罩，并说明原因（不给结论）",
  emptyState.display !== "none" && /没有数据/.test(emptyState.title) && /先看数据/.test(emptyState.hero),
  emptyState.display + " · " + emptyState.title + " · " + emptyState.hero);
await shot("shot-10-empty.png");
await evalJS(`state.date = OFData.lastDate(); refresh(); return 1;`);
const restored = await evalJS(`return { display: getComputedStyle(document.getElementById("mapEmpty")).display,
  date: document.getElementById("timeDate").value, hero: document.getElementById("heroVerdict").textContent };`);
check("回到有数据的日期 → 遮罩消失、结论恢复",
  restored.display === "none" && restored.date === bounds.max, restored.date + " · display=" + restored.display);

// ===== 17) 时间播放 =====
const playback = await evalJS(`state.date = OFData.firstDate(); refresh();
  var before = document.getElementById("timeDate").value;
  document.getElementById("datePlay").click();
  return new Promise(function(resolve) {
    setTimeout(function() {
      var mid = document.getElementById("timeDate").value;
      document.getElementById("datePlay").click();
      resolve({ before: before, after: document.getElementById("timeDate").value,
        mid: mid, playing: document.getElementById("datePlay").classList.contains("on"),
        text: document.getElementById("datePlay").textContent });
    }, 1050);
  });`);
check("播放按钮会推进日期，暂停后按钮复位",
  playback.mid > playback.before && playback.after === playback.mid && playback.playing === false && playback.text === "▶",
  JSON.stringify(playback));

// ===== 18) 运行期异常 =====
check("无运行期 JS 异常（含资源加载失败）", errors.length === 0, errors.slice(0, 3).join(" || ") || "none");

console.log(results.join("\n"));
console.log("\nFAIL 总数 = " + results.filter((r) => r.startsWith("FAIL")).length + " / " + results.length);
ws.close();
child.kill();
process.exit(0);
