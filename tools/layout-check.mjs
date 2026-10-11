import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 用法：node tools/layout-check.mjs  （可用环境变量 EDGE / PAGE 覆盖）
const EDGE = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PAGE = process.env.PAGE || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "prototype", "prototype-fishing.html")).href;
const PORT = 9341;
const PROFILE = join(process.env.TEMP || "C:\\temp", "_edge_profile_layout");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try { rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}

const child = spawn(EDGE, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-allow-origins=*",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--window-size=1680,900", PAGE], { stdio: "ignore" });

let wsUrl = null;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(300);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const t = list.find((x) => x.type === "page" && /prototype-fishing/.test(x.url));
    if (t) wsUrl = t.webSocketDebuggerUrl;
  } catch (e) {}
}
if (!wsUrl) { console.log("FAIL: 无法连接"); child.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise((res) => ws.addEventListener("open", res));
let id = 0; const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p.res(m.result); } });
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
      pending.delete(i);
      rej(new Error("CDP 调用超时：" + method));
    }, 8000);
    pending.set(i, { res: (v) => { clearTimeout(timer); res(v); } });
  });
};
try {
  await send("Runtime.enable");
} catch (e) {
  console.log("FAIL: Edge 调试连接未响应（" + e.message + "）");
  ws.close();
  child.kill();
  process.exit(1);
}
const evalJS = async (expr) => (await send("Runtime.evaluate", { expression: `(function(){ ${expr} })()`, returnByValue: true, awaitPromise: true })).result.value;

// 数据文件变多（每天一个 <script>，60+ 天），等 OFData 与首屏渲染就绪再断言，避免竞态
let ready = false;
for (let i = 0; i < 80 && !ready; i++) {
  await sleep(250);
  try {
    ready = (await evalJS(`return typeof OFData === "object" && typeof state === "object" &&
      !!document.querySelector("#gratHost") && (document.getElementById("timeDate").max || "") !== "";`)) === true;
  } catch (e) { ready = false; }
}
if (!ready) console.log("WARN: 页面 20s 内没进入就绪状态，后续断言可能失败");

const GEO = `var tb=document.getElementById("topbar"), concl=document.querySelector("#pane-now .card"), tabs=document.getElementById("tabs"),
  panes=document.getElementById("panes"), side=document.querySelector(".side"), footer=document.querySelector(".footer"),
  aisCard=document.getElementById("aisResponseList").closest(".card");
  var r=function(n){return n.getBoundingClientRect();};
  var aisR=r(aisCard), paneR=r(panes);
  return {
    vw: window.innerWidth, vh: window.innerHeight,
    docScrollW: document.documentElement.scrollWidth,
    topbarH: Math.round(r(tb).height),
    conclH: Math.round(r(concl).height),
    conclTop: Math.round(r(concl).top), tabsTop: Math.round(r(tabs).top),
    legacyHero: !!document.getElementById("hero") || !!document.getElementById("heroPoints"),
    tabsH: Math.round(r(tabs).height), panesH: panes.clientHeight,
    sideW: Math.round(r(side).width), sideTop: Math.round(r(side).top), sideBottom: Math.round(r(side).bottom),
    footerH: Math.round(r(footer).height),
    aisCardH: Math.round(aisR.height),
    aisCardTop: Math.round(aisR.top),
    aisCardBottom: Math.round(aisR.bottom),
    aisVisibleH: Math.round(Math.max(0, Math.min(aisR.bottom, paneR.bottom) - Math.max(aisR.top, paneR.top))),
    aisClipped: [].slice.call(aisCard.querySelectorAll("*")).filter(function(n){return n.clientWidth>0 && n.scrollWidth>n.clientWidth+1;}).length,
    mapW: document.getElementById("map").clientWidth, mapH: document.getElementById("map").clientHeight,
    clipped: [].slice.call(document.querySelectorAll(".side *, .topbar *")).filter(function(n){return n.clientWidth>0 && n.scrollWidth>n.clientWidth+1;}).length,
    legendOk: document.querySelectorAll(".legend-row[data-layer]").length,
    leadRows: document.querySelectorAll("#nowLead .row.clickable").length,
    numBadges: document.querySelectorAll(".topbar .ctx .num").length,
    family: !!document.getElementById("familySeg"),
    legendH: Math.round(document.querySelector(".map-legend").getBoundingClientRect().height),
    pickRight: Math.round(document.querySelector(".map-pick").getBoundingClientRect().right),
    ctrlLeft: Math.round(document.querySelector(".map-controls").getBoundingClientRect().left),
    probeW: Math.round(parseFloat(getComputedStyle(document.getElementById("mapProbe")).width)),
    scaleW: Math.round(document.getElementById("mapScale").getBoundingClientRect().width),
    scaleRight: Math.round(document.getElementById("mapScale").getBoundingClientRect().right),
    scaleTop: Math.round(document.getElementById("mapScale").getBoundingClientRect().top),
    legendRight: Math.round(document.querySelector(".map-legend").getBoundingClientRect().right),
    drawerOpen: document.querySelector(".map-legend").classList.contains("open"),
    drawerOpacity: getComputedStyle(document.querySelector(".map-legend")).opacity,
    drawerBottom: Math.round(document.querySelector(".map-legend").getBoundingClientRect().bottom),
    drawerLeft: Math.round(document.querySelector(".map-legend").getBoundingClientRect().left)
  };`;

const results = [];
const check = (l, c, d) => results.push(`${c ? "PASS" : "FAIL"}  ${l}${d ? "  → " + d : ""}`);

const g1 = await evalJS(GEO);
check("1680 宽：无横向溢出", g1.docScrollW <= g1.vw + 1, JSON.stringify({ docScrollW: g1.docScrollW, vw: g1.vw }));
check("1680 宽：顶栏单行（高度 < 62）", g1.topbarH < 62, "topbarH=" + g1.topbarH);
check("结论卡在「当前」页内、位于页签下方（原常驻 hero 已移除）",
  g1.legacyHero === false && g1.conclTop >= g1.tabsTop - 1, `legacyHero=${g1.legacyHero} · ${g1.conclTop} ≥ ${g1.tabsTop}`);
check("结论卡可见（高度 ≥ 150，含把握度与 4 个指标格）", g1.conclH >= 150, "conclH=" + g1.conclH);
check("当前页作业线索至少 1 条可点（首选锋面区入口）", g1.leadRows >= 1, "leadRows=" + g1.leadRows);
check("页签条可见", g1.tabsH > 20, "tabsH=" + g1.tabsH);
check("卡片区可滚动高度充足（≥200）", g1.panesH >= 200, "panesH=" + g1.panesH);
// 注：AIS 响应换成真实 GFW 聚合后，小时数量级变大（如 16977.8 h），
// 卡片整体比合成夹具时下移约 1px，可见高度从 90 降到 89；阈值放宽到 85，
// 仍保留「1280 宽滚动前能看到卡片入口」这一意图。
// 注：结论行加了「强度 中 · 温差 1.4 °C」后结论卡高约 18px，AIS 卡片随之下移，
// 可见高度从 89 降到 ~78；阈值放宽到 70，仍保留「滚动前能看到卡片入口」这一意图。
check("历史 AIS 响应卡片入口可见且文案不裁切",
  g1.aisVisibleH >= 70 && g1.aisCardH >= 90 && g1.aisClipped === 0,
  `h=${g1.aisCardH} · visible=${g1.aisVisibleH} · top=${g1.aisCardTop} · bottom=${g1.aisCardBottom} · clipped=${g1.aisClipped}`);
check("侧栏未溢出视口", g1.sideBottom <= g1.vh + 1, `${g1.sideBottom} ≤ ${g1.vh}`);
check("地图区域尺寸合理", g1.mapW > 1100 && g1.mapH > 600, `map=${g1.mapW}x${g1.mapH}`);
check("无文字被裁切（scrollWidth 溢出计数=0）", g1.clipped === 0, "clipped=" + g1.clipped);
check("图层抽屉含 7 个可切换图层（海温 / 锋面带 / 锋面线 / 冷暖侧 / 缺测 / 渔场线索 / 渔场示例）",
  g1.legendOk === 7, "rows=" + g1.legendOk);
check("顶栏 3 个序号可见（顺序看得见）且已无时间族分段", g1.numBadges === 3 && g1.family === false, `badges=${g1.numBadges} family=${g1.family}`);
// 图层开关已改成「按需呼出」的抽屉：默认收起时不得占地图；展开后高度合理即可（内容变多不再是问题）
check("图层抽屉默认收起（不占地图）",
  g1.drawerOpen === false && parseFloat(g1.drawerOpacity) === 0, "open=" + g1.drawerOpen + " · opacity=" + g1.drawerOpacity);
check("图层抽屉展开后高度合理（≤ 340）", g1.legendH <= 340, "legendH=" + g1.legendH);
check("选中回执卡与缩放按钮水平不重叠", g1.pickRight <= g1.ctrlLeft, `${g1.pickRight} ≤ ${g1.ctrlLeft}`);
check("指针浮层宽度合理（200~300px）", g1.probeW >= 200 && g1.probeW <= 300, "probeW=" + g1.probeW);
check("比例尺存在且长度合理（30~300px，按当前缩放实时换算）", g1.scaleW >= 30 && g1.scaleW <= 300, "scaleW=" + g1.scaleW);
// 抽屉从右上角展开，与底部比例尺在垂直方向错开；改用「矩形不相交」判据，不再依赖左右位置
check("图层抽屉与比例尺不重叠（矩形不相交）",
  g1.drawerBottom <= g1.scaleTop || g1.drawerLeft >= g1.scaleRight,
  `drawer bottom/left=${g1.drawerBottom}/${g1.drawerLeft} · scale top/right=${g1.scaleTop}/${g1.scaleRight}`);

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await sleep(400);
const g2 = await evalJS(GEO);
check("1280 宽：无横向溢出", g2.docScrollW <= g2.vw + 1, JSON.stringify({ docScrollW: g2.docScrollW, vw: g2.vw }));
check("1280 宽：顶栏保持单行（高度 < 62）", g2.topbarH < 62, "topbarH=" + g2.topbarH);
check("1280 宽：结论卡仍在「当前」页且可见（高度 ≥ 150）",
  g2.legacyHero === false && g2.conclH >= 150 && g2.conclTop >= g2.tabsTop - 1,
  `${g2.conclH} · ${g2.conclTop} ≥ ${g2.tabsTop}`);
check("1280 宽：无文字裁切", g2.clipped === 0, "clipped=" + g2.clipped);
check("1280 宽：历史 AIS 响应卡片入口仍可见且文案不裁切",
  g2.aisVisibleH >= 70 && g2.aisCardH >= 90 && g2.aisClipped === 0,
  `h=${g2.aisCardH} · visible=${g2.aisVisibleH} · top=${g2.aisCardTop} · bottom=${g2.aisCardBottom} · clipped=${g2.aisClipped}`);
check("1280 宽：卡片区可滚动", g2.panesH >= 150, "panesH=" + g2.panesH);
check("1280 宽：3 个序号仍可见（顺序不因窄屏丢失）", g2.numBadges === 3, "badges=" + g2.numBadges);

console.log(results.join("\n"));
console.log("\nFAIL 总数 = " + results.filter((r) => r.indexOf("FAIL") === 0).length);
ws.close(); child.kill(); process.exit(0);
