/* 渔场向导 · 交互原型
 *
 * 数据：真实锋面数据（Zenodo 20356239，CC BY 4.0，0.05° 逐日）+ 真实海温（NOAA GHRSST 0.05° 逐日，与锋面不同源）
 *       + 公有领域底图（Natural Earth 1:10m）。
 *       生成脚本：Ocean/backend/scripts/export_prototype_data.py、tools/build-basemap.mjs。
 *       页面只通过 prototype-data.js（window.OFData）取数，不直接读原始文件。
 *
 * 没有真实数据的地方（锋面强度 / 海况 / 真实预报 / 渔场）一律显式标成「待接入」或「示例」，
 * 不插值，不把示例值冒充实测值（需求 FR-7「无数据不编造」）。
 *
 * 信息架构（三层）：
 *   L0 顶栏      ① 从哪出发 ② 找多远 ③ 出海日 —— 全局唯一真源（目标鱼种本期不做，见需求 FR-10）
 *   L1 结论块    已并入「当前」页（2026-09-14）：这天值不值得去 + 首选锋面区 + 为什么
 *   L2 页签      当前 / 历史 / 预测 / AI 分析；数据说明作为支撑入口
 *
 * 数据流：state（唯一真源） --渲染--> DOM；所有 render* 只读 state，不写 state。
 */
"use strict";

// ==================== 常量 ====================
const KM_PER_DEG = 111.195;

// 地图投影：东西向与南北向 1 km 一样长，半径圈才是正圆
const ANCHOR = { lon: 124.5, lat: 30.2 };
const PX_LON = 180;
const KM2PX = PX_LON / (KM_PER_DEG * Math.cos((ANCHOR.lat * Math.PI) / 180));
const PX_LAT = KM2PX * KM_PER_DEG;

// 时间范围直接来自数据（有几天就只让选几天）
const AVAILABLE_DATES = OFData.availableDates();
const DEMO_TODAY = "2024-08-05";      // 项目演示用的「今天」（与需求文档、样例数据一致）
const TODAY = AVAILABLE_DATES.indexOf(DEMO_TODAY) >= 0 ? DEMO_TODAY : OFData.firstDate();
const DATE_MIN = OFData.firstDate();
const DATE_MAX = OFData.lastDate();
const DEFAULT_ZOOM = 0.8;              // 默认视野：略微拉远，海岸线/陆地能进画面

// ==================== 状态（唯一真源） ====================
const state = {
  lon: 124.5, lat: 30.2,                   // ① 从哪出发
  range: 20,                               // ② 找多远（km）
  date: TODAY,                             // ③ 出海日（唯一时间控件）
  layers: { sst: true, band: true, front: true, coldwarm: true, nodata: true, fishing: false },
  select: null,                            // 被选中的对象 {type, id}
  probe: null,                             // 钉住的地图点 {lon, lat}
  tab: "now",
  climMode: "day",                         // 历史页：day / period / month / year
  predWindow: 3,                            // 预测页：1 / 3 / 7 天窗口
  pickOrigin: false,                        // 地图点选出发地模式
  zoom: DEFAULT_ZOOM,                      // 默认略微拉远，让海岸线/陆地进画面
  view: { cx: 500, cy: 320 },              // 视窗中心（SVG 坐标）：滚轮缩放/拖拽平移用
};

const $ = (id) => document.getElementById(id);
const SELECT_LABEL = { front: "锋面区", coldwarm: "冷侧 / 暖侧", fishing: "推荐水域（示例）" };
const SELECT_LAYERS = { front: ["band", "front"], coldwarm: ["coldwarm"], fishing: ["fishing"] };
const LAYER_META = [["sst", "水温（NOAA GHRSST）"], ["band", "锋面带"], ["front", "锋面区"],
  ["coldwarm", "冷侧 / 暖侧"], ["nodata", "无观测"], ["fishing", "推荐水域（示例）"]];
const DIRS16 = ["正北", "东北偏北", "东北", "东北偏东", "正东", "东南偏东", "东南", "东南偏南",
  "正南", "西南偏南", "西南", "西南偏西", "正西", "西北偏西", "西北", "西北偏北"];

// ==================== 小工具 ====================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(str) {          // 只用于「海况示例」这类明确标注的演示值，不参与真实结论
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mdText(iso) { const p = iso.split("-"); return Number(p[1]) + " 月 " + Number(p[2]) + " 日"; }
function kmPerLon(lat) { return KM_PER_DEG * Math.cos((lat * Math.PI) / 180); }
function xy(lon, lat) { return [500 + (lon - ANCHOR.lon) * PX_LON, 320 - (lat - ANCHOR.lat) * PX_LAT]; }
function geoOfXY(x, y) { return [ANCHOR.lon + (x - 500) / PX_LON, ANCHOR.lat - (y - 320) / PX_LAT]; }
function fmtCoord(lon, lat) { return lon.toFixed(2) + "°E, " + lat.toFixed(2) + "°N"; }
function parseCoord(raw) {
  const text = String(raw || "").replace(/[，；;]/g, ",");
  const hits = [];
  const re = /(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW东西南北])?/gi;
  let m;
  while ((m = re.exec(text))) {
    const tag = (m[2] || "").toUpperCase();
    let value = parseFloat(m[1]);
    if (tag === "W" || tag === "西" || tag === "S" || tag === "南") value = -Math.abs(value);
    hits.push({ value, tag });
  }
  if (hits.length < 2) return null;
  const lonHit = hits.find((h) => h.tag === "E" || h.tag === "W" || h.tag === "东" || h.tag === "西");
  const latHit = hits.find((h) => h.tag === "N" || h.tag === "S" || h.tag === "北" || h.tag === "南");
  if (lonHit && latHit) return [lonHit.value, latHit.value];
  return [hits[0].value, hits[1].value];
}

// 点到线段的最短距离（km）与最近的落点
function nearestOnSegment(p, a, b) {
  const kx = kmPerLon(p[1]);
  const ax = a[0] * kx, ay = a[1] * KM_PER_DEG;
  const px = p[0] * kx, py = p[1] * KM_PER_DEG;
  const bx = b[0] * kx, by = b[1] * KM_PER_DEG;
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  const cx = ax + t * dx, cy = ay + t * dy;
  return { km: Math.hypot(px - cx, py - cy), point: [cx / kx, cy / KM_PER_DEG] };
}
function bearing16(from, to) {
  const dx = (to[0] - from[0]) * kmPerLon(from[1]);
  const dy = (to[1] - from[1]) * KM_PER_DEG;
  const deg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  return DIRS16[Math.round(deg / 22.5) % 16];
}
function distKm(from, to) { return Math.hypot((to[0] - from[0]) * kmPerLon(from[1]), (to[1] - from[1]) * KM_PER_DEG); }

// ==================== 数据入口（一律走 OFData） ====================
function dataStatus() { return OFData.dateInfo(state.date); }
function timeLabel() {
  const base = mdText(state.date);
  if (!TODAY) return base + " · 实况观测";
  const n = Math.round((Date.parse(state.date) - Date.parse(TODAY)) / 86400000);
  if (n === 0) return base + "（今天）· 实况观测";
  const tail = state.date === DATE_MAX ? "（最新数据）" : "";
  return base + (n > 0 ? "（+" + n + " 天）" : "（" + n + " 天）") + "· 实况观测" + tail;
}
function serverManifestState() {
  return OFData.serverManifestState ? OFData.serverManifestState() : {
    mode: "local_static",
    status: "not_configured",
    message: "未配置服务器 manifest，使用本地静态数据。",
  };
}
function serverManifestLabel() {
  const s = serverManifestState();
  if (s.status === "available") return "服务器 manifest 最新 " + (s.latestAvailableDate || "未知日期") + " · 本地静态数据";
  if (s.status === "loading") return "正在读取服务器 manifest · 本地静态数据";
  if (s.status === "unavailable" || s.status === "invalid") return "服务器不可用，已回退本地静态数据";
  return "本地静态数据";
}
function serverManifestDescription() {
  const s = serverManifestState();
  if (s.status === "available") {
    return "已读取" + (s.version ? " · version " + s.version : "") +
      (s.latestAvailableDate ? " · latest_available_date " + s.latestAvailableDate : "") +
      (s.generatedAt ? " · generated_at " + s.generatedAt : "") +
      "；当前页面仍从已加载的本地静态 artifact 取数";
  }
  if (s.status === "loading") return "正在读取；读取期间继续使用本地静态 artifact";
  if (s.status === "unavailable" || s.status === "invalid") {
    const a = OFData.attribution ? OFData.attribution() : null;
    const localVersion = a && a.generatedAt ? " · 本地 generated_at " + a.generatedAt : "";
    return "不可用，已回退本地静态 artifact" + localVersion + "；服务器读取失败不解释成 0 或无响应";
  }
  return "未配置，完全使用本地静态 artifact";
}
function serverManifestLimit() {
  const s = serverManifestState();
  if (s.status === "available") return "服务器 manifest 只说明可用 artifact 与数据新鲜度；数值仍由确定性 artifact 提供";
  if (s.status === "loading") return "服务器 manifest 读取期间不改变当前结论；页面继续显示本地静态数据";
  if (s.status === "unavailable" || s.status === "invalid") {
    return "服务器 manifest 读取失败只表示服务器不可用或数据未更新，不代表 fishing hours 为 0 或无响应";
  }
  return "未配置服务器 manifest 时页面完全离线运行，后续可用 ?serverManifest=URL 接入服务器清单";
}
function dayObjects() { return OFData.objects(state.date); }
function originCell() { return OFData.cellInfo(state.date, state.lon, state.lat); }
function qualityOf() { return OFData.quality(state.date); }

// 地图上要画的线：有编号的锋面对象 + 太短没编号的线段（都是同一天的真实数据）
function frontEntries(iso) {
  const d = iso || state.date;
  const objects = OFData.objects(d);
  const lines = OFData.frontLines(d);
  const objectLineCount = OFData.objectLineCount(d);
  const entries = objects.map((o) => ({
    id: o.id, points: o.points, lengthKm: o.lengthKm, pixelCount: o.pixelCount, isObject: true, key: o.id,
  }));
  lines.slice(objectLineCount).forEach((points, i) =>
    entries.push({ id: null, points, lengthKm: null, pixelCount: null, isObject: false, key: "短段 " + (i + 1) }));
  return entries;
}

function nearestOnEntry(entry, lon, lat) {
  const pts = entry.points;
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = nearestOnSegment([lon, lat], pts[i], pts[i + 1]);
    if (!best || r.km < best.km) best = r;
  }
  if (!best && pts.length === 1) best = { km: distKm([lon, lat], pts[0]), point: pts[0] };
  return best;
}

// 每个锋面对象：离定位点多远、哪个方位（几何和地图上画的是同一条线，不会有第二套说法）
function frontInfo(iso, lon, lat, rangeKm) {
  const origin = [lon == null ? state.lon : lon, lat == null ? state.lat : lat];
  const range = rangeKm == null ? state.range : rangeKm;
  return frontEntries(iso || state.date).map((entry) => {
    const near = nearestOnEntry(entry, origin[0], origin[1]);
    if (!near) return null;
    return {
      id: entry.id, key: entry.key, isObject: entry.isObject, points: entry.points,
      lengthKm: entry.lengthKm, pixelCount: entry.pixelCount,
      km: near.km, point: near.point, bearing: bearing16(origin, near.point),
      inRange: near.km <= range,
    };
  }).filter(Boolean).sort((a, b) => a.km - b.km);
}

// 「值得去的水域」：真实渔场数据还没到，这里是示例占位（见「依据」），不参与把握评分
const DEMO_SPOTS = [
  { id: "S1", lon: 124.62, lat: 30.31, rxKm: 22, ryKm: 16, grade: "高" },
  { id: "S2", lon: 123.90, lat: 29.90, rxKm: 16, ryKm: 12, grade: "中" },
];
function spotInfo(lon, lat, rangeKm) {
  const origin = [lon == null ? state.lon : lon, lat == null ? state.lat : lat];
  const range = rangeKm == null ? state.range : rangeKm;
  return DEMO_SPOTS.map((s) => {
    const km = distKm(origin, [s.lon, s.lat]);
    return { id: s.id, lon: s.lon, lat: s.lat, rxKm: s.rxKm, ryKm: s.ryKm, grade: s.grade,
      km, bearing: bearing16(origin, [s.lon, s.lat]), inRange: km <= range, demo: true };
  }).sort((a, b) => a.km - b.km);
}

// 海况：示例数据（没有真实风浪数据源），只在「当前」页展示，不参与结论
function seaState(date) {
  const wind = 3 + (hash("wind" + date) % 4);
  const wave = +(0.6 + (hash("wave" + date) % 10) / 10).toFixed(1);
  const swell = +(0.5 + (hash("swell" + date) % 9) / 10).toFixed(1);
  return { wind, wave, swell, level: wind <= 5 && wave <= 1.5 ? "seaworthy" : wind <= 6 && wave <= 1.8 ? "marginal" : "unsafe" };
}

// ==================== 把握怎么加出来的（每一项都来自真实数据） ====================
function scoreBreakdown(fronts, inRange, cell, quality) {
  const objects = fronts.filter((f) => f.isObject);
  const inRangeObjects = objects.filter((f) => f.inRange);
  const items = [];
  let s = 30;
  items.push(["起评分", 30]);

  const objScore = Math.min(inRangeObjects.length, 3) * 12;
  s += objScore;
  items.push(["范围内锋面区 " + inRangeObjects.length + " 个", objScore]);

  // 冷暖侧照实展示（数据里的 -20 / 20 编码原样用），但本期没有目标鱼种，侧别不参与评分
  const side = cell ? cell.side : null;

  const nearest = fronts[0] || null;
  const nearScore = !nearest ? 0 : nearest.km <= 10 ? 8 : nearest.km <= 20 ? 4 : 0;
  s += nearScore;
  items.push(["最近锋面 " + (nearest ? nearest.km.toFixed(1) + " km" : "—"), nearScore]);

  const longestInRange = inRangeObjects.reduce((m, f) => Math.max(m, f.lengthKm || 0), 0);
  const lenScore = longestInRange >= 100 ? 8 : longestInRange >= 50 ? 4 : 0;
  s += lenScore;
  items.push(["范围内最长锋面区 " + (longestInRange ? Math.round(longestInRange) + " km" : "—"), lenScore]);

  const coverage = quality ? 100 - quality.nodata_percent : null;
  const covScore = coverage === null ? 0 : coverage >= 85 ? 4 : coverage >= 70 ? 0 : -4;
  s += covScore;
  items.push(["数据覆盖 " + (coverage === null ? "未知" : coverage.toFixed(1) + "%"), covScore]);

  return { score: clamp(Math.round(s), 5, 95), items, coverage, side, longestInRange };
}

// 三档结论：只说「这一天值不值得去」；海况没有真实数据，就不拿它下结论
function verdictOf(score) {
  if (score >= 70) return { key: "go", text: "值得去", cls: "ok" };
  if (score >= 50) return { key: "some", text: "可以看看", cls: "caution" };
  return { key: "low", text: "线索不足", cls: "stop" };
}

// 一次快照（多个 render 复用；state 一变就作废）
let _snap = null;
function snapshotFor(iso, lon, lat, rangeKm) {
  const d = iso || state.date;
  const x = lon == null ? state.lon : lon;
  const y = lat == null ? state.lat : lat;
  const range = rangeKm == null ? state.range : rangeKm;
  const status = OFData.dateInfo(d);
  const ok = status.ok;
  const fronts = ok ? frontInfo(d, x, y, range) : [];
  const inRange = fronts.filter((f) => f.inRange);
  const cell = ok ? OFData.cellInfo(d, x, y) : null;
  const quality = ok ? OFData.quality(d) : null;
  const core = ok
    ? scoreBreakdown(fronts, inRange, cell, quality)
    : { score: 0, items: [], coverage: null, side: null, longestInRange: 0 };
  return Object.assign({
    status, ok, fronts, inRange, nearest: fronts[0] || null, cell, quality,
    objects: ok ? OFData.objects(d) : [], spots: ok ? spotInfo(x, y, range) : [],
  }, core);
}

function snapshot() {
  if (_snap) return _snap;
  _snap = snapshotFor(state.date, state.lon, state.lat, state.range);
  return _snap;
}
function invalidate() { _snap = null; }

// ==================== 地图（SVG） ====================
const NS = "http://www.w3.org/2000/svg";
function el(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}
// 经纬度折线 → SVG path
function pathOf(pts) { return pts.map((p, i) => (i ? "L " : "M ") + xy(p[0], p[1]).join(",")).join(" "); }
// 显示层平滑（Catmull-Rom → 三次贝塞尔）：只影响画线，数据点、距离、命中判定仍用原始点
function smoothPathOf(pts) {
  if (pts.length < 3) return pathOf(pts);
  const p = pts.map((q) => xy(q[0], q[1]));
  let d = "M" + p[0][0].toFixed(1) + "," + p[0][1].toFixed(1);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p[i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) +
      " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
  }
  return d;
}
// 多条折线合成一个 path（一个 DOM 节点，几千段也不卡）
function chainsPath(chains) { return chains.map((pts) => pathOf(pts) + " Z").join(" "); }
function chainLinesPath(chains) { return chains.map((pts) => pathOf(pts)).join(" "); }

// 逐行 RLE 还原成矩形（每格一个矩形，合成一个 path；不插值、不放大）
// 相邻行里起止相同的 run 会合并成一个矩形，避免 0.05° 格子拼出"马赛克 + 缝"
function rlePath(runs, grid) {
  const w = grid.dlon * PX_LON;
  const h = grid.dlat * PX_LAT;
  let d = "";
  let open = null;   // { x, row, count, rows }
  const flush = () => {
    if (!open) return;
    const x = 500 + (grid.lon0 + open.col * grid.dlon - ANCHOR.lon) * PX_LON;
    const yTop = 320 - (grid.lat0 + (open.row + open.rows) * grid.dlat - ANCHOR.lat) * PX_LAT;
    d += "M" + x.toFixed(1) + "," + yTop.toFixed(1) + "h" + (open.count * w).toFixed(1) +
      "v" + (open.rows * h).toFixed(1) + "h" + (-open.count * w).toFixed(1) + "z";
    open = null;
  };
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (open && run[0] === open.row + open.rows && run[1] === open.col && run[2] === open.count) {
      open.rows += 1;
    } else {
      flush();
      open = { row: run[0], col: run[1], count: run[2], rows: 1 };
    }
  }
  flush();
  return d;
}

function drawProbeMark(svg) {
  if (!state.probe) return;
  const p = xy(state.probe.lon, state.probe.lat);
  el("line", { x1: p[0] - 11, y1: p[1], x2: p[0] + 11, y2: p[1], stroke: "#ffd9a0", "stroke-width": 1.4 }, svg);
  el("line", { x1: p[0], y1: p[1] - 11, x2: p[0], y2: p[1] + 11, stroke: "#ffd9a0", "stroke-width": 1.4 }, svg);
  el("circle", { cx: p[0], cy: p[1], r: 3.2, fill: "#ffd9a0" }, svg);
}

// 底图：真实陆地 / 海岸线 / 等深线（Natural Earth 1:10m，公有领域）
function drawBackground(svg) {
  const base = OFData.basemap;
  el("rect", { x: -400, y: -400, width: 1800, height: 1440, fill: "#0d2135", "data-layer": "ocean" }, svg);
  if (!base) return;
  el("path", { d: chainLinesPath(base.layers.isobath200.chains), fill: "none",
    stroke: "rgba(120,190,215,0.42)", "stroke-width": 1, "stroke-dasharray": "7 5" }, svg);
  el("path", { d: chainLinesPath(base.layers.isobath1000.chains), fill: "none",
    stroke: "rgba(90,150,205,0.34)", "stroke-width": 1, "stroke-dasharray": "3 6" }, svg);
}

// 当前视窗（SVG 坐标），缩放后也能把经纬网标到可见边上
function currentView() {
  const raw = ($("mapSvg").getAttribute("viewBox") || "0 0 1000 640").trim().split(/\s+/).map(Number);
  return { x: raw[0], y: raw[1], w: raw[2] || 1000, h: raw[3] || 640 };
}

// 真实经纬网：按整数度画线并标度数（原来是无标签的等分格网，看不出这是哪儿）
function drawGraticule(host) {
  const g = host;
  const box = currentView();
  const lonMin = geoOfXY(box.x, 0)[0], lonMax = geoOfXY(box.x + box.w, 0)[0];
  const latMax = geoOfXY(0, box.y)[1], latMin = geoOfXY(0, box.y + box.h)[1];
  const tag = (text, x, y) => {
    const t = el("text", { x, y, fill: "rgba(186,214,235,0.6)", "font-size": 10.5,
      "paint-order": "stroke", stroke: "rgba(6,14,24,0.85)", "stroke-width": 3 }, g);
    t.textContent = text;
  };
  for (let lon = Math.ceil(lonMin); lon <= Math.floor(lonMax); lon++) {
    const x = xy(lon, 0)[0];
    el("line", { x1: x, y1: box.y, x2: x, y2: box.y + box.h, stroke: "rgba(150,200,230,0.10)" }, g);
    if (lon % 2 === 0) tag(lon + "°E", x + 3, box.y + 12);
  }
  for (let lat = Math.ceil(latMin); lat <= Math.floor(latMax); lat++) {
    const y = xy(0, lat)[1];
    el("line", { x1: box.x, y1: y, x2: box.x + box.w, y2: y, stroke: "rgba(150,200,230,0.10)" }, g);
    if (lat % 2 === 0) tag(lat + "°N", box.x + 4, y - 3);
  }
}

// 海温色带：按数据里的 0.5 °C 档位取色（不插值，只是给档位配颜色）
const SST_RAMP = [[16, "#2b3f8f"], [20, "#2f7fc1"], [23, "#37b3b8"], [25, "#7ecb6a"],
  [27, "#e8d75a"], [29, "#f0a341"], [31, "#e2694a"], [33, "#b52f3f"]];
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16));
  return "rgb(" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",") + ")";
}
function sstColor(c) {
  if (c <= SST_RAMP[0][0]) return SST_RAMP[0][1];
  for (let i = 1; i < SST_RAMP.length; i++) {
    if (c <= SST_RAMP[i][0]) {
      const t = (c - SST_RAMP[i - 1][0]) / (SST_RAMP[i][0] - SST_RAMP[i - 1][0]);
      return mixHex(SST_RAMP[i - 1][1], SST_RAMP[i][1], t);
    }
  }
  return SST_RAMP[SST_RAMP.length - 1][1];
}

// 真实海表温度场（NOAA GHRSST）：按档位分组后画，档位内相邻行会合并，看起来是连续温度场
function drawSst(svg, iso) {
  if (!state.layers.sst) return;
  const day = OFData.sst(iso);
  if (!day) return;
  const binC = day.bin_c;
  const byBin = new Map();
  (day.runs || []).forEach((run) => {
    if (!byBin.has(run[3])) byBin.set(run[3], []);
    byBin.get(run[3]).push(run);
  });
  byBin.forEach((runs, bin) => {
    el("path", { d: rlePath(runs, day.grid), "data-layer": "sst", fill: sstColor(bin * binC),
      stroke: "none", "shape-rendering": "crispEdges",
      opacity: 0.52 * (state.select && state.select.type !== "sst" ? 0.35 : 1) }, svg);
  });
}

// 陆地画在数据层之上：海上的"没有观测"用斜线纹理，陆地是实色块 + 亮海岸线
// （数据里的 -128 同时包含陆地与云；陆地填充要明显浅于海面，否则等于看不见）
function drawLand(svg) {
  const base = OFData.basemap;
  if (!base) return;
  el("path", { d: chainsPath(base.layers.land.chains), "data-layer": "land",
    fill: "#3a5068", stroke: "none" }, svg);
  el("path", { d: chainLinesPath(base.layers.coastline.chains), "data-layer": "coast",
    fill: "none", stroke: "rgba(196,229,252,0.9)", "stroke-width": 1.4 }, svg);
}

// 海上没有观测的像元（云 / 未观测；数据里 -128 与陆地共用编码）
function drawNodata(svg, iso, grid) {
  const day = OFData.day(iso);
  if (!day || !state.layers.nodata) return;
  el("path", { d: rlePath(day.nodata_rle || [], grid), "data-layer": "nodata",
    fill: "url(#nodataHatch)", stroke: "none", "shape-rendering": "crispEdges", opacity: 0.5 }, svg);
}


// 数据图层：一切按数据原样画，不做外推（锋面线只在显示层平滑，几何与距离仍用原始点）
function drawDataLayers(svg, snap, iso, grid, sel) {
  const dim = (k) => (sel && sel.type !== k ? 0.16 : 1);
  const entries = frontEntries();
  const selected = sel && sel.type === "front" && sel.id ? entries.find((e) => e.id === sel.id) : null;

  // 冷侧 / 暖侧：数据里的 -20 / 20 编码，一格不改
  if (state.layers.coldwarm) {
    const on = !!sel && sel.type === "coldwarm";
    el("path", { d: rlePath(OFData.bandRuns(iso, "cold"), grid), "data-layer": "cold",
      fill: "rgba(38,104,178,0.42)", stroke: "none", "shape-rendering": "crispEdges",
      opacity: dim("coldwarm") }, svg);
    el("path", { d: rlePath(OFData.bandRuns(iso, "warm"), grid), "data-layer": "warm",
      fill: "rgba(198,88,58,0.40)", stroke: "none", "shape-rendering": "crispEdges",
      opacity: dim("coldwarm") }, svg);
    if (on) {
      el("path", { d: rlePath(OFData.bandRuns(iso, "cold"), grid), fill: "none",
        stroke: "#5cb4ff", "stroke-width": 1.6 }, svg);
      el("path", { d: rlePath(OFData.bandRuns(iso, "warm"), grid), fill: "none",
        stroke: "#ffab5c", "stroke-width": 1.6 }, svg);
    }
  }

  // 锋面带：数据里的 -10 / 10 / 30 像元原样画；编码含义有歧义，图上不解释
  if (state.layers.band) {
    el("path", { d: rlePath(OFData.bandRuns(iso, "front"), grid), "data-layer": "band",
      fill: "rgba(255,236,170,0.5)", stroke: "none", "shape-rendering": "crispEdges",
      opacity: 0.9 * dim("front") }, svg);
  }

  // 锋面线：对象中心线 + 未编号短段
  if (state.layers.front) {
    entries.forEach((entry) => {
      const isSel = !!(selected && entry.isObject && entry.id === selected.id);
      const stroke = isSel ? "#4dd4c6" : entry.isObject ? "#ffffff" : "rgba(255,255,255,0.55)";
      const width = isSel ? 3.4 : entry.isObject ? 2.3 : 1.3;
      const d = smoothPathOf(entry.points);
      el("path", { d, fill: "none", stroke: "rgba(6,14,24,0.6)", "stroke-width": width + 2.4,
        opacity: (entry.isObject ? 0.85 : 0.55) * dim("front"), "stroke-linecap": "round" }, svg);
      if (isSel) {
        el("path", { d, fill: "none", stroke: "#4dd4c6", "stroke-width": 9,
          opacity: 0.28, "stroke-linecap": "round" }, svg);
      }
      el("path", { d, "data-layer": "front-line", fill: "none", stroke, "stroke-width": width,
        opacity: (entry.isObject ? 0.95 : 0.7) * dim("front"), "stroke-linecap": "round" }, svg);
    });
    // 编号只给对象；放不下就跳过，不再互相压字
    const placed = [];
    entries.filter((e) => e.isObject).forEach((entry) => {
      const mid = entry.points[Math.floor(entry.points.length / 2)];
      const p = xy(mid[0], mid[1]);
      const isSel = !!(selected && entry.id === selected.id);
      const text = entry.id + " · " + Math.round(entry.lengthKm) + " km";
      const box = { x: p[0] + 5, y: p[1] - 20, w: text.length * 6.4, h: 14 };
      const clash = placed.some((q) => !(box.x + box.w < q.x || q.x + q.w < box.x ||
        box.y + box.h < q.y || q.y + q.h < box.y));
      if (clash && !isSel) return;
      if (!clash) placed.push(box);
      el("text", { x: p[0] + 6, y: p[1] - 8, "data-layer": "front-label",
        fill: isSel ? "#8ff2e4" : "rgba(255,255,255,0.78)", "font-size": 10.5,
        "paint-order": "stroke", stroke: "rgba(8,16,26,0.9)", "stroke-width": 3,
        opacity: isSel ? 1 : dim("front") }, svg).textContent = text;
    });
  }

  // 值得去的水域（示例，未接入真实渔场数据）
  if (state.layers.fishing) {
    (snap.spots || []).forEach((s) => {
      const p = xy(s.lon, s.lat);
      const rx = s.rxKm * KM2PX, ry = s.ryKm * KM2PX;
      const isSel = !!sel && sel.type === "fishing" && (!sel.id || sel.id === s.id);
      el("ellipse", { cx: p[0], cy: p[1], rx, ry, fill: "rgba(255,180,84,0.20)",
        stroke: "rgba(255,200,120,0.45)", "stroke-dasharray": "4 3", opacity: dim("fishing") }, svg);
      el("text", { x: p[0] - rx, y: p[1] - ry - 5, fill: "#ffc46b", "font-size": 11,
        "paint-order": "stroke", stroke: "rgba(8,16,26,0.9)", "stroke-width": 3,
        opacity: 0.45 + 0.55 * dim("fishing") }, svg).textContent = "推荐水域 " + s.id + "（示例）";
      if (isSel) {
        const q = xy(state.lon, state.lat);
        el("line", { x1: q[0], y1: q[1], x2: p[0], y2: p[1], stroke: "#ffb454", "stroke-width": 1.2,
          "stroke-dasharray": "5 4", opacity: 0.8 }, svg);
      }
    });
  }
}

// 定位点与找鱼范围（没数据时也保留，作为参照）
function drawOriginLayer(svg) {
  const q = xy(state.lon, state.lat);
  [10, 20, 30].forEach((km) => {
    const r = km * KM2PX;
    const isRange = km === state.range;
    el("circle", { cx: q[0], cy: q[1], r, fill: isRange ? "rgba(77,212,198,0.05)" : "none",
      stroke: isRange ? "rgba(77,212,198,0.55)" : "rgba(140,225,212,0.26)", "stroke-width": isRange ? 1.2 : 1,
      "stroke-dasharray": isRange ? "5 4" : "3 5" }, svg);
    el("text", { x: q[0], y: q[1] - r - 4, "text-anchor": "middle",
      fill: isRange ? "rgba(165,242,230,0.9)" : "rgba(140,225,212,0.4)",
      "font-size": isRange ? 10 : 8.5 }, svg).textContent = km + " km";
  });
  el("circle", { cx: q[0], cy: q[1], r: 8, fill: "none", stroke: "#4dd4c6", "stroke-width": 2, class: "pulse" }, svg);
  el("circle", { cx: q[0], cy: q[1], r: 5, fill: "#fff" }, svg);
  el("text", { x: q[0] + 14, y: q[1] - 12, fill: "#fff", "font-size": 13, "font-weight": "bold",
    "paint-order": "stroke", stroke: "rgba(8,16,26,0.85)", "stroke-width": 3 }, svg)
    .textContent = fmtCoord(state.lon, state.lat);
  el("text", { x: 956, y: 40, fill: "rgba(200,225,240,0.6)", "font-size": 13 }, svg).textContent = "N ↑";
}

function drawMap() {
  const svg = $("mapSvg");
  svg.innerHTML = "";
  const defs = el("defs", {}, svg);
  const snap = snapshot();
  const ok = snap.ok;
  const iso = state.date;
  const grid = ok ? OFData.grid(iso) : null;

  // 没数据就盖一层说明，不让地图假装有东西
  $("mapEmpty").hidden = ok;
  if (!ok) {
    $("mapEmptyTitle").textContent = snap.status.title;
    $("mapEmptyDesc").textContent = snap.status.desc + "（当前选的是 " + timeLabel() + "）";
  }

  // 缺测（-128）的斜线纹理：陆地与云在数据里同码，靠底图把两者分开画
  const hatch = el("pattern", { id: "nodataHatch", width: 6, height: 6,
    patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 6, height: 6, fill: "rgba(150,166,182,0.30)" }, hatch);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "rgba(206,222,238,0.5)", "stroke-width": 1.6 }, hatch);

  drawBackground(svg);
  const gratHost = el("g", { id: "gratHost" }, svg);
  drawGraticule(gratHost);
  if (ok) {
    drawSst(svg, iso);
    drawNodata(svg, iso, grid);
    drawDataLayers(svg, snap, iso, grid, state.select);
  }
  drawLand(svg);                       // 陆地压在数据层之上：海上缺测用纹理，陆地保持实色
  drawOriginLayer(svg);
  drawProbeMark(svg);
  el("style", {}, defs).textContent =
    "@keyframes pulseAnim{0%{r:8;opacity:.9}100%{r:32;opacity:0}}.pulse{animation:pulseAnim 1.6s ease-out infinite}";
  updateScaleBar();
}

// ==================== 鼠标放到地图上：看那个点的数据 ====================
let hoverPt = null;   // {lon, lat, x, y}，x/y 是相对地图的像素

// 经纬度 <-> 屏幕像素（用 SVG 的变换矩阵，缩放后也不会错位）
function screenOf(lon, lat) {
  const svg = $("mapSvg");
  const p = svg.createSVGPoint();
  const q = xy(lon, lat);
  p.x = q[0]; p.y = q[1];
  const s = p.matrixTransform(svg.getScreenCTM());
  const r = $("map").getBoundingClientRect();
  return { x: s.x - r.left, y: s.y - r.top };
}
function geoOfScreen(clientX, clientY) {
  const svg = $("mapSvg");
  const p = svg.createSVGPoint();
  p.x = clientX; p.y = clientY;
  const loc = p.matrixTransform(svg.getScreenCTM().inverse());
  return geoOfXY(loc.x, loc.y);
}

// 某个点的真实像元：缺测（陆地/云/未观测）还是锋面线、冷侧、暖侧
function cellAt(lon, lat) { return OFData.cellInfo(state.date, lon, lat); }

// 从任意点看最近的锋面（对象或短段），几何与地图同源
function nearestFrontFrom(lon, lat) {
  let best = null;
  frontEntries().forEach((entry) => {
    const near = nearestOnEntry(entry, lon, lat);
    if (!near) return;
    if (!best || near.km < best.km) {
      best = { id: entry.id, isObject: entry.isObject, lengthKm: entry.lengthKm, km: near.km, point: near.point };
    }
  });
  return best;
}

// ==================== 指针查询：鼠标指到哪，就显示那里的真实数据 ====================
function frontTitle(entry) {
  return entry.id ? "锋面区 " + entry.id : "短段锋面";
}

// 浮层只留 4 项：经纬度（head）/ 水温 / 最近锋面距离 / 是否锋面区（是则给冷暖侧）
function probeHTML(lon, lat) {
  const head = '<div class="mp-coord">' + fmtCoord(lon, lat) + "</div>";
  const foot = '<div class="mp-foot">点击钉住 / Esc 取消</div>';
  const st = dataStatus();
  if (!st.ok) return head + '<div class="mp-note">' + st.title + "，该日期无数据，不做估算</div>" + foot;

  const cell = cellAt(lon, lat);
  const bbox = OFData.attribution() ? OFData.attribution().region.bbox : null;
  if (!cell || !cell.inGrid) {
    return head + '<div class="mp-note">该位置不在数据范围内' +
      (bbox ? "（已覆盖 " + bbox[0] + "~" + bbox[2] + "°E，" + bbox[1] + "~" + bbox[3] + "°N）" : "") + "</div>" + foot;
  }
  if (cell.nodata) {
    return head + '<div class="mp-note">这里没有观测数据（陆地、云或未观测，数据里统一用 -128 表示）</div>' + foot;
  }

  let h = head;
  // 水温：这一格的真实档位值（NOAA GHRSST，与锋面不同源），没有就直说，绝不插值
  const sstHere = OFData.sstCell(state.date, lon, lat);
  const tempV = sstHere && sstHere.valueC !== null ? sstHere.valueC.toFixed(1) + " °C"
    : sstHere && sstHere.inGrid ? "该格无水温数据" : "该日期无数据";
  h += '<div class="mp-row"><span class="mp-k">水温</span><span class="mp-v">' + tempV + "</span></div>";

  // 最近锋面：只给距离（往哪个方向开，看地图上的锋面线与范围环）
  const nf = nearestFrontFrom(lon, lat);
  h += '<div class="mp-row"><span class="mp-k">最近锋面</span><span class="mp-v">' +
    (nf ? nf.km.toFixed(1) + " km" : "—") + "</span></div>";

  // 是否锋面区：落在锋面线上报「是 · 锋面线」，落在冷暖侧报侧别，其余报「否」
  h += '<div class="mp-row"><span class="mp-k">锋面区</span><span class="mp-v">' +
    (cell.line ? "是 · 锋面线" : cell.side ? "是 · " + cell.side : "否") + "</span></div>";
  return h + foot;
}

function renderProbe() {
  const box = $("mapProbe");
  let lon = 0, lat = 0, pos = null;
  if (state.probe) {
    lon = state.probe.lon; lat = state.probe.lat;
    const p = screenOf(lon, lat);
    pos = { x: p.x + 14, y: p.y + 14 };
  } else if (hoverPt) {
    lon = hoverPt.lon; lat = hoverPt.lat;
    pos = { x: hoverPt.x + 16, y: hoverPt.y + 16 };
  }
  if (!pos) { box.hidden = true; return; }
  box.innerHTML = probeHTML(lon, lat);
  box.hidden = false;
  const r = $("map").getBoundingClientRect();
  box.style.transform = "translate(" + Math.round(clamp(pos.x, 8, Math.max(8, r.width - box.offsetWidth - 8))) +
    "px," + Math.round(clamp(pos.y, 8, Math.max(8, r.height - box.offsetHeight - 8))) + "px)";
}

// ==================== 选中回执：点了谁、怎么取消 ====================
function pickInfo() {
  const s = state.select;
  if (!s) return null;
  const snap = snapshot();
  if (s.type === "front") {
    const f = (snap.fronts || []).find((x) => x.isObject && x.id === s.id);
    if (!f) return null;
    return { name: "锋面区 " + f.id,
      body: "长 <b>" + Math.round(f.lengthKm) + " km</b> · 离你 <b>" + f.km.toFixed(1) +
        " km</b> · " + f.bearing + "<br/>" + (f.inRange ? "在作业范围内" : "超出作业范围") +
        " · 你在" + (snap.cell && snap.cell.side ? snap.cell.side : "锋区外") };
  }
  if (s.type === "fishing") {
    const p = (snap.spots || []).find((x) => x.id === s.id);
    if (!p) return null;
    return { name: "推荐水域 " + p.id + "（示例）",
      body: "离你 <b>" + p.km.toFixed(1) + " km</b> · " + p.bearing + " · 范围约 " + (p.rxKm * 2) + " × " + (p.ryKm * 2) +
        " km<br/>示例数据，暂无真实渔场来源" };
  }
  return { name: "冷侧 / 暖侧",
    body: "蓝色为冷侧、橙色为暖侧，锋面线位于两者之间（数据原始编码 −20 / 20）" };
}
function renderPick() {
  const box = $("mapPick");
  const info = pickInfo();
  if (!info) { box.hidden = true; return; }
  $("pickName").innerHTML = info.name;
  $("pickBody").innerHTML = info.body;
  box.hidden = false;
}

// ==================== 选中（全站只有一套语义） ====================
function toggleSelect(type, id) {
  const same = !!(state.select && state.select.type === type && (!id || !state.select.id || state.select.id === id));
  state.select = same ? null : { type: type, id: id || null };
  if (!same) {
    (SELECT_LAYERS[type] || []).forEach((k) => { state.layers[k] = true; });
    state.probe = null;   // 选中对象与钉住的点只留一个，免得两个框抢同一块位置
  }
  renderLegend(); drawMap(); syncSelect(); renderPick(); renderProbe();
  showToast(same ? "已取消选中" : "已选中「" + SELECT_LABEL[type] + (id ? " " + id : "") + "」");
}
function syncSelect() {
  document.querySelectorAll("[data-type]").forEach((node) => {
    const t = node.dataset.type, i = node.dataset.id || "";
    const on = !!(state.select && state.select.type === t && (!state.select.id || !i || state.select.id === i));
    node.classList.toggle("active", on);
  });
}
function renderLegend() {
  document.querySelectorAll(".legend-row[data-layer]").forEach((row) => {
    const on = !!state.layers[row.dataset.layer];
    row.style.opacity = on ? "1" : "0.45";
    row.style.filter = on ? "none" : "grayscale(1)";
    row.style.textDecoration = on ? "none" : "line-through";
  });
}

// ==================== 结论块（已并入「当前」页，随页签切换显示） ====================
function heroTarget() {
  const snap = snapshot();
  const objectsInRange = snap.inRange.filter((f) => f.isObject);
  if (objectsInRange.length) {
    const f = objectsInRange[0];
    return { type: "front", id: f.id, label: "锋面区 " + f.id, km: f.km, bearing: f.bearing, fallback: false };
  }
  const anyObject = snap.fronts.find((f) => f.isObject);
  if (anyObject) {
    return { type: "front", id: anyObject.id, label: "锋面区 " + anyObject.id, km: anyObject.km,
      bearing: anyObject.bearing, fallback: true, note: "范围内暂无线索，展示最近的一条" };
  }
  const anyLine = snap.fronts[0];
  if (anyLine) {
    return { type: null, id: null, label: "短段锋面", km: anyLine.km, bearing: anyLine.bearing, fallback: true,
      note: "长度不足 " + (snap.quality ? snap.quality.object_min_length_km : 20) + " km，未单独编号" };
  }
  return null;
}

function renderHero() {
  const snap = snapshot();
  const v = $("heroVerdict"), l = $("heroLine"), body = $("heroWhyBody");
  $("heroWhen").textContent = timeLabel();

  if (!snap.ok) {
    v.textContent = "先看数据";
    v.className = "verdict caution";
    l.innerHTML = "<b>" + snap.status.title + "</b> — " + snap.status.desc;
    body.innerHTML = '<div class="line"><span class="k">当前日期</span> → ' + timeLabel() + "</div>" +
      '<div class="line"><span class="k">说明</span> → 该日期没有实况数据，不输出评分与建议</div>';
    syncSelect(); renderPick();
    return;
  }

  const verdict = verdictOf(snap.score);
  v.textContent = verdict.text;
  v.className = "verdict " + verdict.cls;

  const t = heroTarget();
  const inRangeCount = snap.inRange.filter((f) => f.isObject).length;
  let line = "作业范围 " + state.range + " km 内 <b>" +
    (inRangeCount ? inRangeCount + " 个锋面区" : "暂无锋面区") + "</b> · 把握度 <b>" + snap.score + "%</b>。";
  if (t) line += "首选 <b>" + t.bearing + " " + t.km.toFixed(1) + " km</b> 的" + t.label + "。";
  else line += "可扩大作业范围或换个日期。";
  l.innerHTML = line;

  body.innerHTML =
    snap.items.map((it) => '<div class="line"><span class="k">' + it[0] + "</span> → <b>" +
      (it[1] > 0 ? "+" : "") + it[1] + "</b></div>").join("") +
    '<div class="line"><span class="k">合计把握度</span> → <b>' + snap.score + "%</b></div>" +
    '<div class="line"><span class="k">数据来源</span> → 锋面：Zenodo 20356239 · 水温：NOAA GHRSST</div>' +
    '<div class="line"><span class="k">未参与评分</span> → 水温、锋面强度、海况、预报、渔场</div>' +
    '<div class="line"><span class="k">结论分档</span> → ≥70% 值得去 · 50–69% 可以看看 · <50% 线索不足</div>';
  syncSelect();
  renderPick();
}

// ==================== L2-当前（真实观测数据） ====================
function metricCell(label, value, unit, type, id) {
  return "<div class=\"m\"" + (type ? ' data-type="' + type + '" data-id="' + (id || "") + '" style="cursor:pointer"' : "") + ">" +
    '<div class="k">' + label + '</div><div class="v">' + value + "<small>" + (unit || "") + "</small></div></div>";
}
function frontRow(f, marker) {
  return '<div class="row clickable' + (marker === "lead" ? " lead" : "") + '" data-type="front" data-id="' + f.id + '"><span class="i">' +
    (f.inRange ? "✓" : "·") + "</span>" +
    '<span class="grow"><b>' + f.id + " · 长 " + Math.round(f.lengthKm) + " km</b> " + f.bearing + " " + f.km.toFixed(1) + " km" +
    "<small>" + (f.inRange ? "范围内" : "范围外") + " · 点击在地图上定位</small></span>" +
    '<span class="tag ' + (f.inRange ? "ok" : "plain") + ' side-tag">' + (f.inRange ? "范围内" : "范围外") + "</span></div>";
}
function fmtHours(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return (Math.round(v * 10) / 10).toString() + " h";
}
function fmtLift(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v > 0 ? "+" : "") + v + "%";
}
function windowText(w) {
  if (!w) return "未声明";
  const rel = w.relative_days ? "相对 " + w.relative_days.join(" ~ ") + " 天" : "相对天数未声明";
  return w.start + " ~ " + w.end + "（" + rel + "）";
}
function aisStatusText(response) {
  if (!response) return "待接入";
  if (response.available === false) return "不可用";
  return response.enhanced ? "响应增强" : "未见明确增强";
}
function aisShortCaveat(meta, response) {
  if (!meta) return "未声明数据来源";
  if (response && response.available === false) return "缺测/未授权/缺范围只表示证据不可用，不等于 0 fishing hours";
  if (meta.isSynthetic) return "synthetic fixture 只验证契约与界面路径，不是真实 AIS/GFW 证据";
  return "用于解释历史表观捕捞活动响应，不参与当前把握度评分";
}
function aisEvidenceLine(response) {
  if (!response) return "AIS 响应待接入";
  if (response.available === false) return "AIS 响应不可用：" + response.status + "；不生成增强/无增强结论";
  return aisStatusText(response) + "：post1-3=" + fmtHours(response.post13Hours) +
    "，pre7=" + fmtHours(response.pre7Hours) + "，control=" + fmtHours(response.controlHours) +
    "，lift=" + fmtLift(response.liftPercent);
}

function renderNow() {
  const snap = snapshot();
  const st = snap.status;
  $("nowScopeTag").textContent = state.range + " km 内";

  if (!st.ok) {
    $("nowMetrics").innerHTML = "";
    $("seaTag").textContent = "没数据"; $("seaTag").className = "tag warn";
    $("seaList").innerHTML = "";
    $("nowLead").innerHTML = "";
    $("nowFronts").innerHTML = "";
    $("nowFrontTag").textContent = "没数据";
    renderAisResponse(snap);
    const e0 = $("nowEmpty");
    e0.hidden = false;
    e0.innerHTML = "<b>" + st.title + "</b><br/>" + st.desc;
    return;
  }

  const objects = snap.objects;
  const coverage = snap.coverage;
  const nearest = snap.nearest;
  const anchorSst = OFData.sstCell(state.date, state.lon, state.lat);
  $("nowScopeTag").textContent = state.range + " km 内" +
    (coverage === null ? "" : " · 数据覆盖 " + coverage.toFixed(1) + "%") +
    (anchorSst && anchorSst.valueC !== null ? " · 定位点水温 " + anchorSst.valueC.toFixed(1) + " °C" : "");
  $("nowMetrics").innerHTML =
    metricCell("锋面区", String(objects.length), "个") +
    metricCell("最近锋面", nearest ? nearest.km.toFixed(1) : "—", "km", "front",
      nearest && nearest.isObject ? nearest.id : "") +
    metricCell("所处侧", snap.side || "锋区外", "", "coldwarm") +
    metricCell("把握度", String(snap.score), "%");

  // 海况：示例数据，不参与评分
  const sea = seaState(state.date);
  $("seaTag").textContent = "示例数据 · 仅供参考";
  $("seaTag").className = "tag warn";
  $("seaList").innerHTML =
    '<div class="row"><span class="i">≈</span><span class="grow"><b>风力 ' + sea.wind + " 级 · 浪高 " + sea.wave +
    " m · 涌浪 " + sea.swell + ' m</b><small>示例数据，非实况</small></span></div>' +
    '<div class="row"><span class="i">!</span><span class="grow"><b>正式出海请以官方海洋预报为准</b>' +
    "<small>本页评分不含海况</small></span></div>";

  const objectLines = snap.fronts.filter((f) => f.isObject);
  const inRangeObjects = objectLines.filter((f) => f.inRange);
  const shortCount = snap.fronts.length - objectLines.length;
  $("nowFrontTag").textContent = "共 " + objectLines.length + " 个 · 范围内 " + inRangeObjects.length +
    (shortCount ? " · 短段 " + shortCount : "");
  const leadLines = inRangeObjects.length ? inRangeObjects.slice(0, 3)
    : (nearest && nearest.isObject ? [nearest] : []);
  $("nowLead").innerHTML = leadLines.length
    ? leadLines.map((f) => frontRow(f, "lead")).join("")
    : '<div class="row"><span class="i">!</span><span class="grow"><b>范围内暂无明确锋面区</b><small>可扩大作业范围或换相邻日期复核</small></span></div>';
  $("nowFronts").innerHTML = objectLines.map((f) => frontRow(f, "")).join("");
  document.querySelectorAll("#nowLead .clickable, #nowFronts .clickable").forEach((node) =>
    node.addEventListener("click", () => toggleSelect(node.dataset.type, node.dataset.id)));

  const e = $("nowEmpty");
  if (!inRangeObjects.length) {
    e.hidden = false;
    e.innerHTML = "<b>作业范围内暂无锋面区</b><br/>" +
      (nearest ? "最近的一条在" + nearest.bearing + " " + nearest.km.toFixed(1) + " km（" +
        (nearest.isObject ? nearest.id : "短段锋面") + "）" : "该日期没有检出锋面线") +
      "。可扩大作业范围或换个日期。";
  } else {
    e.hidden = true;
  }
  $("nowMetrics").querySelectorAll(".m[data-type]").forEach((node) =>
    node.addEventListener("click", () => {
      if (node.dataset.type === "front" && !node.dataset.id) return;
      toggleSelect(node.dataset.type, node.dataset.id);
    }));
  syncSelect();
  renderAisResponse(snap);
}

function renderAisResponse(snap) {
  const tag = $("aisResponseTag");
  const list = $("aisResponseList");
  const why = $("aisResponseWhyBody");
  const meta = OFData.frontResponseMeta();
  const response = snap && snap.ok ? OFData.frontResponse(state.date, state.range) : null;

  if (!snap || !snap.ok) {
    tag.textContent = "等待锋面数据";
    tag.className = "tag warn";
    list.innerHTML = '<div class="row"><span class="i">!</span><span class="grow"><b>当前日期没有锋面观测</b><small>不计算 AIS 响应证据</small></span></div>';
  } else if (!OFData.frontResponseAvailable() || !response) {
    tag.textContent = "待接入";
    tag.className = "tag plain";
    list.innerHTML =
      '<div class="row"><span class="i">1</span><span class="grow"><b>暂不参与当前把握度</b><small>真实 AIS/GFW 表观捕捞活动样例尚未接入，不生成响应增强结论</small></span></div>' +
      '<div class="row"><span class="i">2</span><span class="grow"><b>已预留数据入口</b><small>后续接入 data/front_response/events.js 后展示 fishing hours、前后窗口变化和对照区结果</small></span></div>';
  } else if (response.available === false) {
    tag.textContent = "不可用";
    tag.className = "tag plain";
    list.innerHTML =
      '<div class="row"><span class="i">!</span><span class="grow"><b>当前日期/范围暂无响应表记录</b><small>状态：' +
      response.status + '；不把缺失解释成 0 fishing hours</small></span></div>' +
      '<div class="row"><span class="i">2</span><span class="grow"><b>保持空态</b><small>' +
      aisShortCaveat(meta, response) + "</small></span></div>";
  } else {
    const enhanced = response.enhanced ? "响应增强" : "未见明确增强";
    tag.textContent = meta && meta.isSynthetic ? "夹具 · " + enhanced : enhanced;
    tag.className = "tag " + (response.enhanced ? "ok" : "plain");
    list.innerHTML =
      '<div class="row"><span class="i">1</span><span class="grow"><b>' + enhanced +
      '</b><small>' + aisShortCaveat(meta, response) + "</small></span></div>" +
      '<div class="row"><span class="i">2</span><span class="grow"><b>' +
      fmtHours(response.post13Hours) + " · " + fmtLift(response.liftPercent) +
      '</b><small>后 1-3 天 fishing hours 与前 7 天基线比较</small></span></div>' +
      '<div class="row"><span class="i">3</span><span class="grow"><b>control ' + fmtHours(response.controlHours) +
      '</b><small>同日非锋面对照区，至少离锋面 ' +
      (response.control && response.control.min_distance_km ? response.control.min_distance_km : "—") +
      " km</small></span></div>";
  }

  const source = meta && meta.source ? meta.source : {};
  const method = meta && meta.method ? meta.method : {};
  const boundary = meta && meta.publicBoundary ? meta.publicBoundary : {};
  const detailRows = [
    ["数据定位", (meta ? meta.metric + " / " + meta.unit : "apparent_fishing_effort / fishing_hours") + "，不是渔获量、产量或收益"],
    ["来源", (source.kind || "not_available") + (source.license ? " · " + source.license : "")],
    ["事件身份", (response && response.frontEventId ? response.frontEventId : state.date + ":—") + "；front_id 是项目内单日临时编号，不是长期锋面轨迹 ID"],
    ["空间窗口", "10 / 20 / 30 km 锋面缓冲区，界面当前使用 <b>" + state.range + " km</b>"],
    ["前 7 天基线", windowText(response && response.preWindow)],
    ["后 1-3 天响应", windowText(response && response.postWindow)],
    ["前后 7 天探索", windowText(response && response.exploratoryWindow)],
    ["非锋面对照", response && response.control
      ? "同日、同海区、至少离锋面 " + response.control.min_distance_km + " km；面积配比 " + response.control.area_ratio
      : "未声明"],
    ["数值明细", response && response.available
      ? "pre7=" + fmtHours(response.pre7Hours) + "；post1-3=" + fmtHours(response.post13Hours) +
        "；control=" + fmtHours(response.controlHours) + "；lift=" + fmtLift(response.liftPercent)
      : "不可用状态不输出 fishing hours / lift / enhanced_flag"],
    ["增强判定", method.enhancement_rule || "post1_3_hours >= pre7_hours * 1.2 and post1_3_hours > non_front_control_hours"],
    ["公开边界", boundary.note || (meta ? meta.note : "未声明")],
    ["当前状态", meta ? meta.status + (meta.isSynthetic ? " · synthetic fixture" : "") : "未声明"],
  ];
  why.innerHTML = detailRows.map((row) =>
    '<div class="line"><span class="k">' + row[0] + "</span> → " + row[1] + "</div>").join("");
}

// ==================== 历史 / 预测共用统计 ====================
function dateIndex(iso) { return AVAILABLE_DATES.indexOf(iso); }
function datesBetween(start, end) { return AVAILABLE_DATES.filter((d) => d >= start && d <= end); }
function datesInMonth(iso) {
  const ym = iso.slice(0, 7);
  return AVAILABLE_DATES.filter((d) => d.slice(0, 7) === ym);
}
function datesInYear(iso) {
  const y = iso.slice(0, 4);
  return AVAILABLE_DATES.filter((d) => d.slice(0, 4) === y);
}
function recentObservationDates(iso, count) {
  const idx = dateIndex(iso);
  if (idx < 0) return [];
  return AVAILABLE_DATES.slice(Math.max(0, idx - count + 1), idx + 1);
}
function recentObservationWindow(iso, count) {
  const idx = dateIndex(iso);
  if (idx < 0) return [];
  const start = Math.max(0, idx - count + 1);
  return AVAILABLE_DATES.slice(start, idx + 1);
}
function daySignal(iso) {
  const snap = snapshotFor(iso, state.lon, state.lat, state.range);
  return {
    date: iso,
    ok: snap.ok,
    score: snap.score,
    present: snap.inRange.some((f) => f.isObject),
    objects: snap.inRange.filter((f) => f.isObject).length,
    nearestKm: snap.nearest ? snap.nearest.km : null,
    coverage: snap.coverage,
  };
}
function aggregateObservationDates(dates) {
  const rows = dates.map(daySignal).filter((r) => r.ok);
  const present = rows.filter((r) => r.present).length;
  const best = rows.reduce((m, r) => (!m || r.score > m.score ? r : m), null);
  const avgScore = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : null;
  const avgCoverage = rows.length ? rows.reduce((s, r) => s + (r.coverage || 0), 0) / rows.length : null;
  return { dates, rows, valid: rows.length, present, best, avgScore, avgCoverage };
}
function climRateFor(md, range) {
  const clim = OFData.clim;
  const entry = clim && clim.by_day ? clim.by_day[md] : null;
  const bucket = entry && entry.by_range ? entry.by_range[String(range)] : null;
  return bucket ? bucket.probability : null;
}
function baselineSeries() {
  const snap = snapshot();
  if (!snap.ok) return [];
  const recent = recentObservationDates(state.date, 4).map(daySignal).filter((r) => r.ok);
  const first = recent[0], last = recent[recent.length - 1];
  const trend = first && last && recent.length > 1 ? last.score - first.score : 0;
  const persistence = recent.length ? recent.filter((r) => r.present).length / recent.length : 0;
  const climRate = climRateFor(state.date.slice(5), state.range);
  const historyBoost = climRate == null ? 0 : (climRate - 0.35) * 18;
  const missingPenalty = ["intensityAvailable", "forecastAvailable", "seaStateAvailable", "fishingAvailable"]
    .filter((fn) => !OFData[fn]()).length;
  return [1, 2, 3, 4, 5, 6, 7].map((offset) => {
    const date = addDays(state.date, offset);
    const score = clamp(Math.round(snap.score + trend * 0.35 + (persistence - 0.5) * 14 + historyBoost - offset * 3), 5, 85);
    const confidence = clamp(Math.round(76 - offset * 6 - missingPenalty * 5 + Math.max(0, persistence - 0.5) * 12), 25, 72);
    return { offset, date, score, confidence, hasObservation: OFData.hasDay(date) };
  });
}
function renderRecentClimWindow(days, label) {
  const dates = recentObservationWindow(state.date, days);
  const agg = aggregateObservationDates(dates);
  const bars = $("climBars"), heat = $("climHeat"), stat = $("climStat"), years = $("climYears"), hint = $("climHint");
  hint.textContent = label + " · 实况回放";
  hint.className = "tag ok";
  bars.innerHTML = climBarsHTML(dates.map((d) => d.slice(5)), dates.map((d) => daySignal(d).score),
    dates.map((d) => d === state.date), dates.map((d) => mdText(d) + " · 把握度 " + daySignal(d).score + "%"));
  heat.innerHTML = climHeatHTML(dates);
  stat.innerHTML = dates.length
    ? "<b>" + label + "</b> · 已导出 " + dates.length + " 天，" + state.range + " km 内有锋面的日期 " +
      agg.present + "/" + agg.valid + " 天，平均把握度 <b>" + (agg.avgScore == null ? "—" : Math.round(agg.avgScore) + "%") + "</b>"
    : "<b>" + label + "暂无实况</b><br/>需要先补导对应日期。";
  years.innerHTML =
    '<div class="line"><span class="k">当前窗口</span> → ' + (dates.length ? dates[0] + " ~ " + dates[dates.length - 1] : "—") + "</div>" +
    '<div class="line"><span class="k">最佳日期</span> → <b>' + (agg.best ? mdText(agg.best.date) + " · " + agg.best.score + "%" : "—") + "</b></div>" +
    '<div class="line"><span class="k">窗口性质</span> → 连续日实况回放；未导出的日期不进入分母</div>' +
    '<div class="line"><span class="k">多年对比</span> → 现有多年样本只有每年 8 月 5—7 日，暂不能代表任意连续 ' + days + " 日窗口</div>";
}

// ==================== L2-预测（规则基线，不冒充正式预报） ====================
function renderFuture() {
  const snap = snapshot();
  const recent = aggregateObservationDates(recentObservationDates(state.date, 4));
  const climRate = climRateFor(state.date.slice(5), state.range);
  const series = baselineSeries();
  const windowDays = state.predWindow;
  const inWindow = series.filter((r) => r.offset <= windowDays);
  const best = inWindow.reduce((m, r) => (!m || r.score > m.score ? r : m), null);
  document.querySelectorAll("#futureWindow button").forEach((b) => b.classList.toggle("active", Number(b.dataset.window) === windowDays));
  $("futureTag").textContent = windowDays + " 天 · 规则参考";
  $("futureBestTag").textContent = best ? ("第 " + best.offset + " 天 · " + best.score + "%") : "暂无";
  if (!snap.ok) {
    $("futureBars").innerHTML = "";
    $("futureList").innerHTML =
      '<div class="row"><span class="i">!</span><span class="grow"><b>当前日期无数据</b><small>先切换到有实况数据的出海日，再生成规则预测参考</small></span></div>';
    $("futureDays").innerHTML = "";
    $("futureWhyBody").innerHTML = "";
    return;
  }
  $("futureList").innerHTML =
    '<div class="row"><span class="i">0</span><span class="grow"><b>' + windowDays + " 天窗口首选 " +
    (best ? mdText(best.date) + " · " + best.score + "%" : "暂无") + "</b>" +
    "<small>点击 1 / 3 / 7 天切换评估窗口；下方仍保留 7 天全貌</small></span></div>" +
    '<div class="row"><span class="i">1</span><span class="grow"><b>当前锋面信号 ' + snap.score + "%</b>" +
    "<small>使用范围内锋面区、最近距离、最长锋面区和数据覆盖计算</small></span></div>" +
    '<div class="row"><span class="i">2</span><span class="grow"><b>近几日持续性 ' +
    (recent.valid ? recent.present + "/" + recent.valid : "—") + "</b>" +
    "<small>只看已导出的实况日期，不读取未来实况作为预测依据</small></span></div>" +
    '<div class="row"><span class="i">3</span><span class="grow"><b>历史同期 ' +
    (climRate == null ? "暂无样本" : Math.round(climRate * 100) + "%") + "</b>" +
    "<small>统一口径 front_present；强度、AIS、海况尚未接入</small></span></div>";
  $("futureBars").innerHTML = series.map((r) =>
    '<i class="future' + (best && r.offset === best.offset ? " active" : "") + (r.offset > windowDays ? " dim" : "") + '" title="第 ' + r.offset +
    " 天规则参考 " + r.score + '%" style="height:' + Math.max(5, r.score) + '%"></i>').join("");
  $("futureDays").innerHTML =
    series.map((r) =>
      '<div class="row' + (r.hasObservation ? " clickable" : "") + (best && r.offset === best.offset ? " active" : "") + '" data-date="' + r.date + '">' +
      '<span class="i">' + r.offset + "</span><span class=\"grow\"><b>" + mdText(r.date) +
      " · 规则参考 " + r.score + "%</b><small>" + (r.offset <= windowDays ? "窗口内" : "窗口外参考") + " · 依据完整度 " + r.confidence + "% · " +
      (r.hasObservation ? "可切换查看该日实况" : "超出当前样例观测日期") +
      "</small></span></div>").join("");
  $("futureWhyBody").innerHTML =
    '<div class="line"><span class="k">当前信号</span> → 当前把握度 <b>' + snap.score + "%</b></div>" +
    '<div class="line"><span class="k">持续性</span> → 近几日范围内有锋面 <b>' +
    (recent.valid ? recent.present + "/" + recent.valid : "—") + "</b> 天</div>" +
    '<div class="line"><span class="k">历史参照</span> → 同期出现比例 <b>' +
    (climRate == null ? "暂无样本" : Math.round(climRate * 100) + "%") + "</b></div>" +
    '<div class="line"><span class="k">边界</span> → 未使用未来实况；强度、AIS、真实海况与业务预报尚未接入</div>';
  $("futureDays").querySelectorAll(".clickable").forEach((node) =>
    node.addEventListener("click", () => setDate(node.dataset.date)));
}

// ==================== L2-历史（实况聚合 + 真实多年度统计，口径见需求 §5.2） ====================
function climBarsHTML(labels, heights, actives, titles) {
  return labels.map((label, i) =>
    '<i class="' + (actives[i] ? "active" : "") + '" title="' + titles[i] + '" style="height:' +
    Math.max(5, Math.round(heights[i])) + '%"></i>').join("");
}
function climHeatHTML(dates) {
  return dates.map((d) => {
    const r = daySignal(d);
    const cls = ["heat-cell"];
    if (r.ok) cls.push("has");
    if (r.present || r.score >= 60) cls.push("hot");
    if (d === state.date) cls.push("active");
    const title = r.ok ? mdText(d) + " · 把握度 " + r.score + "% · " + (r.present ? "范围内有锋面" : "范围内无锋面")
      : mdText(d) + " · 无实况";
    return '<span class="' + cls.join(" ") + '" title="' + title + '"></span>';
  }).join("");
}

function renderClim() {
  const mode = state.climMode;
  document.querySelectorAll("#climPeriod button").forEach((b) => b.classList.toggle("active", b.dataset.period === mode));
  const bars = $("climBars"), heat = $("climHeat"), stat = $("climStat"), years = $("climYears"), hint = $("climHint");
  const clim = OFData.clim;
  heat.innerHTML = "";

  if (!clim) {
    hint.textContent = "统计未导出"; hint.className = "tag warn";
    bars.innerHTML = ""; years.innerHTML = "";
    stat.innerHTML = "<b>暂无历史统计</b><br/>需先更新数据（<code>export_prototype_data.py --mode clim</code>）。";
    return;
  }

  if (mode === "month") {
    const dates = datesInMonth(state.date);
    const agg = aggregateObservationDates(dates);
    hint.textContent = dates.length ? state.date.slice(0, 7) + " · 实况回放" : "样本不足";
    hint.className = dates.length ? "tag ok" : "tag warn";
    bars.innerHTML = climBarsHTML(dates.map((d) => d.slice(8)), dates.map((d) => daySignal(d).score),
      dates.map((d) => d === state.date), dates.map((d) => mdText(d) + " · 把握度 " + daySignal(d).score + "%"));
    heat.innerHTML = climHeatHTML(dates);
    stat.innerHTML = dates.length
      ? "<b>当月实况</b> · 已导出 " + dates.length + " 天，" + state.range + " km 内有锋面的日期 " +
        agg.present + "/" + agg.valid + " 天，平均把握度 <b>" + (agg.avgScore == null ? "—" : Math.round(agg.avgScore) + "%") + "</b>"
      : "<b>该月没有导出实况</b><br/>需要先补导对应月份数据。";
    years.innerHTML = dates.length
      ? '<div class="line"><span class="k">当前可算</span> → 使用 ' + dates[0] + " ~ " + dates[dates.length - 1] +
        " 的逐日实况回放</div>" +
        '<div class="line"><span class="k">多年整月</span> → 现有多年样本只有每年 8 月 5—7 日，不能代表完整月份</div>' +
        '<div class="line"><span class="k">最佳日期</span> → <b>' + (agg.best ? mdText(agg.best.date) + " · " + agg.best.score + "%" : "—") +
        "</b></div>" +
        '<div class="line"><span class="k">统计方式</span> → 单日先按当前把握度评分，再按月份聚合；未导出的日期不进入分母</div>'
      : '<div class="line"><span class="k">当前可算</span> → 暂无该月实况样例</div>' +
        '<div class="line"><span class="k">多年整月</span> → 需要补齐逐日历史样本后才能输出</div>' +
        '<div class="line"><span class="k">统计方式</span> → 未导出的日期不进入分母</div>';
    return;
  }

  if (mode === "year") {
    const dates = datesInYear(state.date);
    const agg = aggregateObservationDates(dates);
    hint.textContent = dates.length ? state.date.slice(0, 4) + " · 样例年" : "样本不足";
    hint.className = dates.length ? "tag ok" : "tag warn";
    bars.innerHTML = climBarsHTML(dates.map((d) => d.slice(5)), dates.map((d) => daySignal(d).score),
      dates.map((d) => d === state.date), dates.map((d) => mdText(d) + " · 把握度 " + daySignal(d).score + "%"));
    heat.innerHTML = climHeatHTML(dates);
    stat.innerHTML = dates.length
      ? "<b>整年视图</b> · 当前只导出 " + dates.length + " 天样例，" + state.range + " km 内有锋面的日期 " +
        agg.present + "/" + agg.valid + " 天；这不是完整全年统计。"
      : "<b>该年没有导出实况</b><br/>需要先补导对应年份数据。";
    years.innerHTML =
      '<div class="line"><span class="k">当前覆盖</span> → ' + (dates.length ? dates[0] + " ~ " + dates[dates.length - 1] : "—") + "</div>" +
      '<div class="line"><span class="k">全年缺口</span> → 需要补齐 1 月 1 日到 12 月 31 日逐日锋面，才能输出全年频率、最高月份和年际对比</div>' +
      '<div class="line"><span class="k">多年对比</span> → 现有多年样本仅覆盖 2015–2024 年 8 月 5—7 日，不能冒充 1982–2024 全年统计</div>' +
      '<div class="line"><span class="k">最佳日期</span> → <b>' + (agg.best ? mdText(agg.best.date) + " · " + agg.best.score + "%" : "—") +
      "</b></div>";
    return;
  }

  if (mode === "week") {
    renderRecentClimWindow(7, "近 7 日");
    return;
  }

  if (mode === "halfmonth") {
    renderRecentClimWindow(15, "近 15 日");
    return;
  }

  const key = String(state.range);
  const yearRows = Object.keys(clim.by_year).sort();
  const widestKey = Object.keys(clim.by_day[Object.keys(clim.by_day)[0]].by_range)
    .map(Number).sort((a, b) => b - a)[0];

  if (mode === "period") {
    const wideKey = String(widestKey);
    const probs = yearRows.map((y) => {
      const bucket = clim.by_year[y].by_range[wideKey] || clim.by_year[y].by_range[key];
      return bucket ? bucket.probability || 0 : 0;
    });
    const labels = yearRows.map((y) => y + " 年");
    bars.innerHTML = climBarsHTML(labels, probs.map((p) => p * 100), yearRows.map(() => false),
      yearRows.map((y, i) => y + " 年同期 · " + widestKey + " km 内 " + Math.round(probs[i] * 100) + "% 的日子有锋面"));
    const start = addDays(state.date, -2);
    const localDates = datesBetween(start, state.date);
    const local = aggregateObservationDates(localDates);
    stat.innerHTML = "<b>近三日</b> · 当前样例 " + state.range + " km 内有锋面的日期 " +
      local.present + "/" + local.valid + " 天；多年同期参照（" + widestKey + " km）：" +
      yearRows.map((y, i) => y + " " + Math.round(probs[i] * 100) + "%").join(" · ");
    hint.textContent = "近三日 · 同期参照"; hint.className = "tag";
    years.innerHTML =
      '<div class="line"><span class="k">当前近三日</span> → ' + (localDates.length ? localDates.join("、") : "样例不足") + "</div>" +
      '<div class="line"><span class="k">为什么看 ' + widestKey + " km</span> → 锋面在海上很散，只看 " + state.range +
      " km 经常是 0%</div>" +
      '<div class="line"><span class="k">统计方式</span> → ' + clim.method + "</div>" +
      '<div class="line"><span class="k">样本</span> → ' + clim.sample_note + "</div>" +
      yearRows.map((y) => {
        const bucket = clim.by_year[y].by_range[wideKey];
        const narrow = clim.by_year[y].by_range[key];
        return '<div class="line"><span class="k">' + y + " 年（" + (bucket ? bucket.days : 0) + " 天）</span> → <b>" +
          (bucket ? bucket.present_days + "/" + bucket.days : "—") + "</b> 天有锋面 · 锋面线格数 " +
          (bucket ? bucket.line_cells : "—") + "（" + state.range + " km 内：" +
          (narrow ? narrow.present_days + "/" + narrow.days : "—") + "）</div>";
      }).join("");
    return;
  }

  // mode === "day"：往年「这一天」的对比
  const md = state.date.slice(5);
  const entry = clim.by_day[md];
  if (!entry) {
    hint.textContent = "暂无该日期"; hint.className = "tag warn";
    bars.innerHTML = ""; years.innerHTML = "";
    stat.innerHTML = "<b>" + mdText(state.date) + " 不在历史同期取样范围内</b><br/>已取样日期为 " +
      Object.keys(clim.by_day).join("、") + "。";
    return;
  }
  const item = entry.by_range[key];
  const cells = yearRows.map((y) => entry.years[y] && entry.years[y][key] ? entry.years[y][key] : null);
  const maxLine = Math.max(1, ...cells.map((c) => (c ? c.line_cells : 0)));
  const thisYear = state.date.slice(0, 4);
  bars.innerHTML = climBarsHTML(yearRows.map((y) => y), cells.map((c) => (c ? c.line_cells / maxLine * 100 : 0)),
    yearRows.map((y) => y === thisYear),
    yearRows.map((y, i) => y + " 年 " + md + " · " + (cells[i] && cells[i].front_present ? "有锋面" :
      cells[i] ? "无锋面" : "缺测") + " · 锋面线格数 " + (cells[i] ? cells[i].line_cells : "—")));

  const others = yearRows.filter((y) => y !== thisYear);
  const otherPresent = others.filter((y, i) => {
    const c = entry.years[y] && entry.years[y][key];
    return c && c.front_present;
  }).length;
  const otherValid = others.filter((y) => entry.years[y] && entry.years[y][key] &&
    entry.years[y][key].status === "ok").length;
  const climRate = otherValid ? otherPresent / otherValid : null;
  const mine = entry.years[thisYear] && entry.years[thisYear][key] ? entry.years[thisYear][key] : null;
  stat.innerHTML = "<b>" + mdText(state.date) + "</b> · 往年 " + item.days + " 个年份样本里，" + state.range +
    " km 内出现锋面的比例 <b>" + Math.round((item.probability || 0) * 100) + "%</b>（" + item.present_days + "/" + item.days +
    " 天）";
  const diff = mine && mine.status === "ok" && climRate !== null ? (mine.front_present ? 1 : 0) - climRate : null;
  const level = diff === null ? "没有样本" : diff > 0.2 ? "比常年活跃" : diff < -0.2 ? "比常年弱" : "和常年差不多";
  hint.textContent = "这一天 · " + item.days + " 年样本"; hint.className = "tag " + (diff === null ? "" : diff > 0.2 ? "ok" : diff < -0.2 ? "warm" : "ok");

  const wide = entry.by_range[String(widestKey)];
  years.innerHTML =
    '<div class="line"><span class="k">' + widestKey + " km 内</span> → <b>" +
    Math.round((wide ? wide.probability || 0 : 0) * 100) + "%</b> 的日子有锋面（" +
    (wide ? wide.present_days + "/" + wide.days : "—") + " 天）</div>" +
    '<div class="line"><span class="k">其他年份（' + otherValid + " 年有数据）</span> → <b>" +
    (climRate === null ? "—" : Math.round(climRate * 100) + "%") + "</b> 的日子有锋面</div>" +
    '<div class="line"><span class="k">' + thisYear + " 年同期</span> → <b>" +
    (mine ? (mine.front_present ? "有锋面" : "无锋面") + "（锋面线格数 " + mine.line_cells + "）" : "缺测") + "</b></div>" +
    '<div class="line"><span class="k">与常年对比</span> → ' + level + "，" + (level === "比常年活跃"
      ? "往年同期也常出锋面" : level === "比常年弱"
      ? "往年同期更多，建议结合当日实况判断" : "往年经验可作参考") + "</div>" +
    '<div class="line"><span class="k">统计方式</span> → ' + clim.method + "（" + clim.sample_note + "）</div>";
}

// ==================== L2-依据（数据从哪来 / 怎么算的 / 还做不到什么） ====================
function tableRows(rows) {
  return rows.map((r) => '<div class="tr"><span class="th">' + r[0] + '</span><span class="td">' + r[1] + "</span></div>").join("");
}
function listRows(rows) {
  return rows.map((r) => '<div class="row"><span class="i">' + r[0] + '</span><span class="grow">' + r[1] + "</span></div>").join("");
}

function renderBasis() {
  const a = OFData.attribution();
  if (!a) {
    $("basisData").innerHTML = tableRows([["数据文件", "data/ 目录里没有生成好的数据"]]);
    $("basisRules").innerHTML = "";
    $("basisLimits").innerHTML = listRows([["!", "先跑 Ocean/backend/scripts/export_prototype_data.py 与 tools/build-basemap.mjs"]]);
    return;
  }
  const st = a.status;
  const statusText = (key, real, missing) => (st[key] === "real" ? real : missing);
  const responseMeta = OFData.frontResponseMeta();
  const responseSource = responseMeta && responseMeta.source ? responseMeta.source : null;
  const responseMethod = responseMeta && responseMeta.method ? responseMeta.method : null;
  const responseBoundary = responseMeta && responseMeta.publicBoundary ? responseMeta.publicBoundary : null;
  $("basisData").innerHTML = tableRows([
    ["锋面数据", "Zenodo " + a.doi + " · " + a.resolutionDeg + "° 逐日 · " + a.license],
    ["水温数据", a.sst && a.sst.ready
      ? "NOAA GHRSST · " + a.sst.product.resolution_deg + "° 逐日 · 按 " + a.sst.bin_c +
        " °C 分档（" + a.sst.days.length + " 天）"
      : "未接入"],
    ["冷暖侧", statusText("cold_side", "−20 / 20 编码，原样用", "未接入")],
    ["编号规则", "本系统内编号（连通域 → 中心线 → 抽稀），非数据集自带编号"],
    ["底图", "Natural Earth 1:10m 陆地 / 海岸线 / 等深线"],
    ["数据日期", a.days[0] + " ~ " + a.days[a.days.length - 1] + "（" + a.days.length + " 天）"],
    ["历史同期", a.clim.ready
      ? a.clim.years[0] + "–" + a.clim.years[a.clim.years.length - 1] + " 年 · 每年 8 月 5—7 日取样（实际取样 " +
        ((a.clim.sample_note || "").match(/实际取样 (\d+) 天/) || [0, "—"])[1] + " 天）"
      : "未导出"],
    ["服务器 manifest", serverManifestDescription()],
    ["规则预测参考", "本地规则基线：当前锋面信号 + 近几日持续性 + 历史同期；不等于业务预报"],
    ["AIS 响应", OFData.frontResponseAvailable() && responseMeta
      ? (responseMeta.isSynthetic
        ? "已接入 synthetic fixture：用于验证 front-response 表契约与 UI，不是真实 AIS/GFW 证据"
        : "已接入 front-response 表：GFW 风格 apparent fishing effort")
      : "待接入：GFW 风格 apparent fishing effort；当前只保留数据入口和展示口径"],
    ["AIS metric/unit", responseMeta ? responseMeta.metric + " / " + responseMeta.unit : "待接入"],
    ["AIS 来源/许可", responseSource
      ? (responseSource.kind || "unknown") + " · " + (responseSource.license || "license 未声明") +
        (responseSource.attribution ? " · " + responseSource.attribution : "")
      : "待接入"],
    ["AIS 公开边界", responseBoundary
      ? responseBoundary.commit_policy + " · raw/fine-grained committed=" +
        responseBoundary.raw_or_fine_grained_data_committed + " · " + responseBoundary.note
      : "待接入"],
    ["AI 分析", "本地证据组织与任务编排，不生成新的科学数值，不调用在线模型"],
    ["锋面强度", "未接入"],
    ["海况", "示例数据，仅供参考"],
    ["预报", "未接入"],
    ["渔场", "示例占位，暂无真实渔场 / 船位数据；AIS 响应不等于渔获量"],
    ["数据版本", a.generatedAt],
  ]);
  $("basisRules").innerHTML = listRows([
    ["1", "<b>作业范围</b>：以出发地为圆心，" + a.region.ranges_km.join(" / ") + " km 内的锋面计入评分；范围内没有编号锋面时展示最近的一条并注明"],
    ["2", "<b>把握度</b>：起评分 30；范围内每个锋面区 +12（最多 3 个）；最近锋面 ≤10 km +8、≤20 km +4；最长锋面区 ≥100 km +8、≥50 km +4；数据覆盖 ≥85% +4、<70% −4；冷暖侧只展示、不加分"],
    ["3", "<b>结论分档</b>：≥70% 值得去 · 50–69% 可以看看 · <50% 线索不足"],
    ["4", "<b>历史同期</b>：半径内锋面线格数 > 0 记 front_present = true；比例 = 有锋面的天数 ÷ 有效天数"],
    ["5", "<b>锋面区识别</b>：连通域中心线 + 抽稀（6 km），长度 ≥ " +
      (OFData.quality(a.days[a.days.length - 1]) ? OFData.quality(a.days[a.days.length - 1]).object_min_length_km : 20) + " km 才编号"],
    ["6", "<b>AIS 响应</b>：" + (responseMethod
      ? "按 " + responseMethod.buffer_km.join(" / ") + " km 锋面缓冲区汇总 apparent fishing effort；后 " +
        responseMethod.post_window_days.join("-") + " 天与前 " + responseMethod.pre_window_days +
        " 天基线、同日非锋面对照区比较"
      : "待接入 front-response 方法")],
    ["7", "<b>AIS 不参与评分</b>：AIS response 是证据来源与解释材料，不改变当前把握度 Product Score"],
  ]);
  $("basisLimits").innerHTML = listRows(
    a.knownIssues.map((text) => ["!", text]).concat([
      ["!", "海表温度数据来自 NOAA GHRSST，与锋面数据不是同一产品；按 0.5 °C 分档展示，不参与评分"],
      ["!", "预测页输出的是规则预测参考，用于演示预测工作流；真实锋面预报、强度场与回测指标尚未接入"],
      ["!", responseMeta && responseMeta.isSynthetic
        ? "AIS 响应当前为 synthetic fixture，只验证契约与界面路径；真实 GFW/AIS 样例仍待接入，不代表真实渔获量、产量或收益"
        : "AIS 响应数据待接入；未来使用的是表观捕捞小时数，不代表真实渔获量、产量或收益"],
      ["!", responseMethod && responseMethod.control_validation
        ? "非锋面对照边界：" + responseMethod.control_validation
        : "真实 AIS/GFW 样例接入前必须复核 license、署名、公开展示范围和 50 km 非锋面对照区几何排除"],
      ["!", serverManifestLimit()],
      ["!", "海况与预报暂无真实数据源，本页输出仅基于锋面数据"],
      ["!", "底图为 Natural Earth 1:10m（公有领域）；在国内正式发布需替换为带审图号的合规底图"],
    ]));
}

// ==================== L2-AI 分析（证据组织，不直接生成科学数值） ====================
function renderAI() {
  const snap = snapshot();
  const summary = $("aiSummary"), plan = $("aiPlan"), next = $("aiNext");
  if (!snap.ok) {
    $("aiTag").textContent = "等待数据";
    $("aiPlanTag").textContent = "未执行";
    $("aiNextTag").textContent = "换日期";
    summary.innerHTML = '<div class="row"><span class="i">!</span><span class="grow"><b>' + snap.status.title +
      "</b><small>" + snap.status.desc + "</small></span></div>";
    plan.innerHTML = "";
    $("aiEvidenceBody").innerHTML = "";
    next.innerHTML = '<div class="row"><span class="i">1</span><span class="grow"><b>切换出海日</b><small>当前可选 ' +
      DATE_MIN + " ~ " + DATE_MAX + "</small></span></div>";
    return;
  }
  const verdict = verdictOf(snap.score);
  const target = heroTarget();
  const recent = aggregateObservationDates(recentObservationDates(state.date, 4));
  const month = aggregateObservationDates(datesInMonth(state.date));
  const base = baselineSeries();
  const bestBase = base.reduce((m, r) => (!m || r.score > m.score ? r : m), null);
  const climRate = climRateFor(state.date.slice(5), state.range);
  const sea = seaState(state.date);
  const responseMeta = OFData.frontResponseMeta();
  const response = OFData.frontResponse(state.date, state.range);
  const responseReady = OFData.frontResponseAvailable() && response;

  $("aiTag").textContent = "证据驱动";
  $("aiPlanTag").textContent = "本地规则";
  $("aiNextTag").textContent = target ? "继续验证" : "扩大范围";
  summary.innerHTML =
    '<div class="row"><span class="i">1</span><span class="grow"><b>' + verdict.text + " · 把握度 " + snap.score +
    "%</b><small>结论由当前锋面区、距离、长度和数据覆盖计算</small></span></div>" +
    '<div class="row"><span class="i">2</span><span class="grow"><b>' +
    (target ? target.label + " · " + target.bearing + " " + target.km.toFixed(1) + " km" : "作业范围内暂无明确锋面区") +
    "</b><small>" + (target ? (target.fallback ? "范围内暂无线索，展示最近的一条" : "范围内首选，已在地图标出") :
      "可放大作业范围或换相邻日期复核") + "</small></span></div>" +
    '<div class="row"><span class="i">3</span><span class="grow"><b>历史参照 ' +
    (climRate == null ? "样本不足" : Math.round(climRate * 100) + "%") +
    "</b><small>当前月样例 " + month.present + "/" + month.valid + " 天在范围内有锋面</small></span></div>" +
    '<div class="row"><span class="i">4</span><span class="grow"><b>' + aisEvidenceLine(response) +
    "</b><small>AIS response 只作为证据来源，不改变当前把握度评分</small></span></div>";

  plan.innerHTML =
    '<div class="row"><span class="i">A</span><span class="grow"><b>解析任务</b><small>' +
    mdText(state.date) + "，" + fmtCoord(state.lon, state.lat) + "，作业范围 " + state.range + " km</small></span></div>" +
    '<div class="row"><span class="i">B</span><span class="grow"><b>调用工具</b><small>当前查询 → 历史同期 → AIS response → 规则预测参考 → 限制检查</small></span></div>' +
    '<div class="row"><span class="i">C</span><span class="grow"><b>证据边界</b><small>海况为示例值（风力 ' +
    sea.wind + " 级、浪高 " + sea.wave + " m），AI 只组织证据，不生成 fishing hours 或科学数值</small></span></div>";

  $("aiEvidenceBody").innerHTML =
    '<div class="line"><span class="k">当前证据</span> → <b>当前页</b>：锋面区数量、最近距离、所处侧和数据覆盖</div>' +
    '<div class="line"><span class="k">历史证据</span> → <b>历史页</b>：当日 / 3 日 / 7 日 / 15 日 / 当月 / 整年的可用样例与同期统计</div>' +
    '<div class="line"><span class="k">AIS 响应</span> → <b>当前页</b>：' +
    (responseReady ? aisEvidenceLine(response) : "已预留数据入口，真实 apparent fishing effort 样例待接入") +
    (responseMeta && responseMeta.note ? "；" + responseMeta.note : "") + "</div>" +
    '<div class="line"><span class="k">预测证据</span> → <b>预测页</b>：' + state.predWindow + " 天规则预测参考，首选 " +
    (bestBase ? mdText(bestBase.date) + " · " + bestBase.score + "%" : "暂无") + "</div>" +
    '<div class="line"><span class="k">限制证据</span> → <b>数据说明</b>：强度、真实海况、真实预报尚未接入；AIS fixture 不是真实 GFW/AIS 证据</div>';

  next.innerHTML =
    '<div class="row clickable" data-pane-jump="future"><span class="i">1</span><span class="grow"><b>查看规则预测参考</b><small>' +
    (bestBase ? "当前规则建议优先看第 " + bestBase.offset + " 天，规则参考 " + bestBase.score + "%" : "当前日期暂无规则参考") +
    "</small></span></div>" +
    '<div class="row clickable" data-pane-jump="clim"><span class="i">2</span><span class="grow"><b>切到历史尺度</b><small>对照当日、近三日、当月和整年样例</small></span></div>' +
    '<div class="row clickable" data-pane-jump="basis"><span class="i">3</span><span class="grow"><b>核对数据说明</b><small>确认哪些数据真实接入，哪些仍是示例或未接入</small></span></div>';
  next.querySelectorAll("[data-pane-jump]").forEach((node) =>
    node.addEventListener("click", () => switchTab(node.dataset.paneJump)));
}

// ==================== 提示条（只用于确认操作，不播报结论） ====================
let toastTimer;
function showToast(text) {
  $("toastLoc").textContent = text;
  const t = $("toast");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ==================== 统一刷新（state → 全部渲染） ====================
function clampDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  if (iso < DATE_MIN) return DATE_MIN;
  if (iso > DATE_MAX) return DATE_MAX;
  return iso;
}
function setDate(iso) {
  const d = clampDate(iso);
  if (!d) return;
  if (d !== iso) showToast("可选日期为 " + mdText(DATE_MIN) + " ~ " + mdText(DATE_MAX));
  if (d === state.date) return;
  state.date = d;
  refresh();
}

let playTimer = null;
function setPlaying(on) {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  const btn = $("datePlay");
  if (!on) {
    btn.textContent = "▶";
    btn.classList.remove("on");
    btn.title = "播放逐日变化";
    return;
  }
  btn.textContent = "Ⅱ";
  btn.classList.add("on");
  btn.title = "暂停播放";
  playTimer = setInterval(() => {
    const idx = dateIndex(state.date);
    const next = idx >= 0 && idx < AVAILABLE_DATES.length - 1 ? AVAILABLE_DATES[idx + 1] : AVAILABLE_DATES[0];
    setDate(next);
  }, 900);
}
function renderTimeRail() {
  const idx = Math.max(0, dateIndex(state.date));
  $("timeRail").min = 0;
  $("timeRail").max = Math.max(0, AVAILABLE_DATES.length - 1);
  $("timeRail").value = idx;
  $("timeRailText").textContent = (idx + 1) + "/" + AVAILABLE_DATES.length;
}

function refresh() {
  invalidate();
  renderLegend();
  drawMap();
  renderHero();
  renderNow();
  renderFuture();
  renderClim();
  renderBasis();
  renderAI();
  renderProbe();
  renderPick();
  $("dataStamp").textContent = timeLabel() + " · " + serverManifestLabel();
  document.querySelectorAll("#rangeSeg button").forEach((b) => b.classList.toggle("active", Number(b.dataset.range) === state.range));
  $("timeDate").value = state.date;
  $("timeDate").min = DATE_MIN;
  $("timeDate").max = DATE_MAX;
  renderTimeRail();
  syncOriginPicker();
}

function switchTab(name) {
  state.tab = name;
  document.querySelectorAll("#tabs button").forEach((b) => {
    const on = b.dataset.pane === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("active", p.id === "pane-" + name));
}

// 视窗：中心 + 缩放；中心被夹在数据窗口内，拖动不会把图拖没
const VIEW_BOX = { x0: -310, y0: -470, x1: 1130, y1: 986 };
function applyZoom(smooth) {
  const w = 1000 / state.zoom, h = 640 / state.zoom;
  state.view.cx = clamp(state.view.cx, VIEW_BOX.x0 + w / 2, VIEW_BOX.x1 - w / 2);
  state.view.cy = clamp(state.view.cy, VIEW_BOX.y0 + h / 2, VIEW_BOX.y1 - h / 2);
  const svg = $("mapSvg");
  svg.style.transition = smooth === false ? "none" : "all .25s ease";
  svg.setAttribute("viewBox", (state.view.cx - w / 2) + " " + (state.view.cy - h / 2) + " " + w + " " + h);
  refreshGraticule();
  updateScaleBar();
}
function refreshGraticule() {
  const host = $("gratHost");
  if (!host) return;
  host.innerHTML = "";
  drawGraticule(host);
}
// 比例尺：把"图上 50 km"换算成屏幕像素（纯几何换算，不涉及数据）
function updateScaleBar() {
  const bar = $("mapScale");
  if (!bar) return;
  const rect = $("mapSvg").getBoundingClientRect();
  const box = currentView();
  if (!rect.width || !box.w) return;
  const s = Math.max(rect.width / box.w, rect.height / box.h);
  const km = 50;
  bar.style.width = (km * KM2PX * s).toFixed(0) + "px";
  $("mapScaleText").textContent = km + " km";
}
// 以光标为中心缩放：把光标底下的地点钉在原位
function zoomAt(clientX, clientY, factor) {
  const svg = $("mapSvg"), rect = svg.getBoundingClientRect();
  const target = geoOfScreen(clientX, clientY);
  const next = clamp(state.zoom * factor, 0.6, 8);
  if (next === state.zoom) return;
  state.zoom = next;
  applyZoom(false);
  const box = currentView();
  const s = Math.max(rect.width / box.w, rect.height / box.h);
  const p = screenOf(target[0], target[1]);
  state.view.cx += (p.x - (clientX - rect.left)) / s;
  state.view.cy += (p.y - (clientY - rect.top)) / s;
  applyZoom(false);
}
function centerOn(lon, lat, zoom) {
  const p = xy(lon, lat);
  state.view.cx = p[0];
  state.view.cy = p[1];
  if (zoom) state.zoom = zoom;
  applyZoom();
}
function syncOriginPicker() {
  const btn = $("pickOriginBtn");
  if (btn) {
    btn.classList.toggle("active", state.pickOrigin);
    btn.textContent = state.pickOrigin ? "点地图" : "点选";
    btn.title = state.pickOrigin ? "点击地图设置出发地，Esc 取消" : "在地图上点选出发地";
  }
  const map = $("map");
  if (map) map.classList.toggle("pick-origin", state.pickOrigin);
}
function setOrigin(lon, lat, source) {
  state.lon = lon;
  state.lat = lat;
  state.select = null;
  state.probe = null;
  hoverPt = null;
  state.pickOrigin = false;
  $("locInput").value = fmtCoord(state.lon, state.lat);
  syncOriginPicker();
  refresh();
  centerOn(state.lon, state.lat);
  showToast((source === "map" ? "已把出发地设为 " : "已定位到 ") + fmtCoord(state.lon, state.lat));
}

// ==================== 事件绑定 ====================
function bind() {
  // ② 找多远
  document.querySelectorAll("#rangeSeg button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.range = Number(btn.dataset.range);
      state.select = null;
      refresh();
      showToast("作业范围：" + state.range + " km");
    });
  });

  // ③ 出海日（全站唯一的时间控件）
  $("timeDate").addEventListener("change", (e) => setDate(e.target.value));
  $("datePrev").addEventListener("click", () => setDate(addDays(state.date, -1)));
  $("dateNext").addEventListener("click", () => setDate(addDays(state.date, 1)));
  $("datePlay").addEventListener("click", () => setPlaying(!playTimer));
  $("timeRail").addEventListener("input", (e) => {
    const d = AVAILABLE_DATES[Number(e.target.value)];
    if (d) setDate(d);
  });

  // ① 从哪出发
  const doLocate = () => {
    const pair = parseCoord($("locInput").value.trim());
    if (!pair) { showToast("没看懂坐标，示例：124.50°E, 30.20°N"); return; }
    setOrigin(pair[0], pair[1], "input");
  };
  $("locateBtn").addEventListener("click", doLocate);
  $("pickOriginBtn").addEventListener("click", () => {
    state.pickOrigin = !state.pickOrigin;
    state.select = null;
    state.probe = null;
    hoverPt = null;
    syncOriginPicker();
    renderLegend(); drawMap(); syncSelect(); renderPick(); renderProbe();
    showToast(state.pickOrigin ? "点击地图设置出发地" : "已取消点选出发地");
  });
  $("locInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doLocate(); });

  // ===== 地图：拖拽平移 / 滚轮以光标为中心缩放 =====
  let drag = null, suppressClick = false;
  const interactive = (t) => !!(t && t.closest && t.closest(".map-legend, .map-controls, .map-pick, .map-probe"));
  $("map").addEventListener("mousedown", (e) => {
    if (e.button !== 0 || interactive(e.target)) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    hoverPt = null;
    renderProbe();
  });
  window.addEventListener("mouseup", () => {
    if (drag && drag.moved > 4) suppressClick = true;   // 拖动结束那一下不算点击
    drag = null;
  });
  $("map").addEventListener("wheel", (e) => {
    if (interactive(e.target)) return;
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });
  window.addEventListener("resize", updateScaleBar);

  // ===== 地图：鼠标指到哪，就显示哪里的数据 =====
  const map = $("map");
  let pending = null, raf = 0;
  map.addEventListener("mousemove", (e) => {
    if (drag) {
      const rect = $("mapSvg").getBoundingClientRect();
      const box = currentView();
      const s = Math.max(rect.width / box.w, rect.height / box.h);
      state.view.cx -= (e.clientX - drag.x) / s;
      state.view.cy -= (e.clientY - drag.y) / s;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
      applyZoom(false);
      return;
    }
    const r = map.getBoundingClientRect();
    pending = { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const p = pending;
      pending = null;
      if (!p || state.probe) return;   // 已经钉住时，鼠标不再抢浮层
      const g = geoOfScreen(p.cx, p.cy);
      hoverPt = { lon: g[0], lat: g[1], x: p.x, y: p.y };
      renderProbe();
    });
  });
  map.addEventListener("mouseleave", () => { hoverPt = null; renderProbe(); });
  map.addEventListener("click", (e) => {
    if (suppressClick) { suppressClick = false; return; }   // 拖动之后的那一下不算点击
    if (e.target.closest && e.target.closest(".map-legend, .map-controls, .map-pick, .map-probe, .map-empty")) return;
    const g = geoOfScreen(e.clientX, e.clientY);
    if (state.pickOrigin) {
      setOrigin(g[0], g[1], "map");
      return;
    }
    const onPinned = state.probe && distKm([state.probe.lon, state.probe.lat], g) < 5;
    hoverPt = null;
    if (onPinned) {
      state.probe = null;
      showToast("已取消钉住");
    } else {
      const cell = cellAt(g[0], g[1]);
      state.probe = { lon: g[0], lat: g[1] };
      state.select = null;
      showToast(!cell || !cell.inGrid ? "已钉住：这一点在导出范围外"
        : cell.nodata ? "已钉住：这一点没有观测数据" : "已钉住 " + fmtCoord(g[0], g[1]));
    }
    renderLegend(); drawMap(); syncSelect(); renderPick(); renderProbe();
  });
  $("pickClose").addEventListener("click", () => {
    state.select = null;
    renderLegend(); drawMap(); syncSelect(); renderPick(); renderProbe();
    showToast("已取消选中");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.pickOrigin) {
      state.pickOrigin = false;
      syncOriginPicker();
      showToast("已取消点选出发地");
      return;
    }
    if (e.key !== "Escape" || (!state.probe && !state.select)) return;
    state.probe = null;
    state.select = null;
    hoverPt = null;
    renderLegend(); drawMap(); syncSelect(); renderPick(); renderProbe();
    showToast("已取消选中");
  });

  // 地图缩放按钮（焦点在地图中心；滚轮与拖动见上）
  const mapCenter = () => { const r = $("map").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  $("zoomIn").addEventListener("click", () => { const c = mapCenter(); zoomAt(c[0], c[1], 1.25); });
  $("zoomOut").addEventListener("click", () => { const c = mapCenter(); zoomAt(c[0], c[1], 1 / 1.25); });
  $("recenter").addEventListener("click", () => centerOn(state.lon, state.lat, DEFAULT_ZOOM));

  // 图层开关（图例）
  document.querySelectorAll(".legend-row[data-layer]").forEach((row) => {
    row.addEventListener("click", () => {
      const k = row.dataset.layer;
      state.layers[k] = !state.layers[k];
      if (!state.layers[k] && state.select && state.select.type === k) state.select = null;
      renderLegend(); drawMap(); syncSelect(); renderPick();
      const meta = LAYER_META.find((m) => m[0] === k) || [k, k];
      showToast("图层「" + meta[1] + "」已" + (state.layers[k] ? "打开" : "关掉"));
    });
  });

  // 页签（当前 / 历史 / 预测 / AI 分析；←→ 可切换）
  const tabBtns = Array.from(document.querySelectorAll("#tabs button"));
  tabBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.pane));
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabBtns.length) % tabBtns.length;
      tabBtns[n].focus();
      switchTab(tabBtns[n].dataset.pane);
    });
  });

  // 历史：只看哪一段（日期锚点跟着顶栏走，页内没有第二个日期控件）
  document.querySelectorAll("#climPeriod button").forEach((btn) => {
    btn.addEventListener("click", () => { state.climMode = btn.dataset.period; renderClim(); });
  });
  document.querySelectorAll("#futureWindow button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.predWindow = Number(btn.dataset.window);
      renderFuture();
      renderAI();
    });
  });
  $("toBasis").addEventListener("click", () => switchTab("basis"));
  window.addEventListener("of-server-manifest", () => refresh());
}

// ==================== 启动 ====================
bind();
refresh();
applyZoom(false);      // 按 state.zoom 设定初始视野（默认略微拉远，海岸线在画面内）
switchTab("now");
