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
 *   L0 左侧浮层  分析点 / 作业范围 / 观测日 —— 统一应用条件（坐标草稿另存于输入框）
 *   L1 右侧摘要  最近锋面 / 范围内对象 / 资料限制，不表示捕捞收益
 *   L2 工作台    快捷功能与 AI 说明；右侧保留当前 / 历史 / 预测，数据说明作为支撑入口
 *
 * 数据流：state（唯一真源） --渲染--> DOM；所有 render* 只读 state，不写 state。
 */
"use strict";

// ==================== 常量 ====================
const KM_PER_DEG = 111.195;

// 地图投影统一由 prototype-map.js（OFMap）提供：平面档等距 km（半径圈才是正圆），
// 缩得太远自动切到球面档（正射投影，最小缩放 = 整颗地球）。这里只留兼容别名。
const ANCHOR = OFMap.ANCHOR;
const PX_LON = OFMap.PX_LON;
const PX_LAT = OFMap.PX_LAT;
const KM2PX = PX_LON / (KM_PER_DEG * Math.cos((ANCHOR.lat * Math.PI) / 180));

// 时间范围直接来自数据（有几天就只让选几天）
// 「服务器增强模式」启用后这三个值会被 applyServerRange() 重新计算，故用 let。
let AVAILABLE_DATES = OFData.availableDates();
const DEMO_TODAY = "2024-08-05";      // 项目演示用的「今天」（与需求文档、样例数据一致）
const TODAY = AVAILABLE_DATES.indexOf(DEMO_TODAY) >= 0 ? DEMO_TODAY : OFData.firstDate();
let DATE_MIN = OFData.firstDate();
let DATE_MAX = OFData.lastDate();
const DEFAULT_ZOOM = 0.8;              // 离线兜底视野（东海窗口 120–128°E，略微拉远让海岸线进画面）
const SERVER_ZOOM = 0.35;              // 服务器模式视野：数据窗口扩到 105–150°E，显示约 16° 经度
const MAX_ZOOM = 8;                    // 最深：0.05° 像元级别
const GLOBE_FADE_MS = 220;             // 平面↔球面切换时的淡出时长（遮住投影形变那一下）
// 视野记忆：下次打开回到上次停留的地方（localStorage 不可用时静默降级）
const VIEW_KEY = "of.view.v1";

// ==================== 状态（唯一真源） ====================
const state = {
  lon: 124.5, lat: 30.2,                   // ① 从哪出发
  range: 20,                               // ② 找多远（km）
  date: TODAY,                             // ③ 出海日（唯一时间控件）
  layers: { sst: true, band: true, front: true, coldwarm: true, nodata: true, ground: false, fishing: false },
  select: null,                            // 被选中的对象 {type, id}
  probe: null,                             // 钉住的地图点 {lon, lat}
  tab: "now",
  climMode: "day",                         // 历史页：day / period / month / year
  predWindow: 3,                            // 预测页：1 / 3 / 7 天窗口
  pickOrigin: false,                        // 地图点选出发地模式
  zoom: DEFAULT_ZOOM,                      // 视野缩放：viewBox 宽 = 1000 / zoom（可见经度跨度 = 5.556 / zoom）
  view: { lon0: 124.5, lat0: 30.2 },       // 视野中心（地理真源）：拖拽/缩放都只改这两个数 + zoom
};
let viewRestored = false;                  // 是否从「视野记忆」恢复（服务器模式不再覆盖它）

const $ = (id) => document.getElementById(id);
const SELECT_LABEL = { front: "锋面区", coldwarm: "冷侧 / 暖侧", fishing: "推荐水域（示例）" };
const SELECT_LAYERS = { front: ["band", "front"], coldwarm: ["coldwarm"], fishing: ["fishing"] };
const LAYER_META = [["sst", "水温（NOAA GHRSST）"], ["band", "锋面带"], ["front", "锋面区 · 强度"],
  ["coldwarm", "冷侧 / 暖侧"], ["nodata", "无观测"], ["ground", "渔场线索（表观捕捞活动）"],
  ["fishing", "推荐水域（示例）"]];
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
// 当前视野（投影模块的入参）：缓存成一个对象——xy() 每次绘制要调用上万次，不做逐次分配
const _view = { lon0: state.view.lon0, lat0: state.view.lat0, span: OFMap.spanOf(DEFAULT_ZOOM), mode: "plane" };
function syncView() {
  _view.lon0 = state.view.lon0;
  _view.lat0 = state.view.lat0;
  _view.span = OFMap.spanOf(state.zoom);
  _view.mode = OFMap.modeOf(_view.span);
  return _view;
}
function globeMode() { return _view.mode === "globe"; }
// 经纬度 <-> SVG 坐标：平面档与旧版逐位一致；球面档走正射投影（球外/背面返回 null，调用方要说清楚）
function xy(lon, lat) { return OFMap.toSvg(lon, lat, _view); }
function geoOfXY(x, y) { return OFMap.fromSvg(x, y, _view); }
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
  if (hits.length !== 2 || text.replace(re, "").replace(/[\s,°]/g, "")) return null;
  const lonHit = hits.find((h) => h.tag === "E" || h.tag === "W" || h.tag === "东" || h.tag === "西");
  const latHit = hits.find((h) => h.tag === "N" || h.tag === "S" || h.tag === "北" || h.tag === "南");
  if (hits.filter(h => /[EW东西]/.test(h.tag)).length > 1 || hits.filter(h => /[NS南北]/.test(h.tag)).length > 1) return null;
  if (lonHit && latHit) return [lonHit.value, latHit.value];
  if (lonHit) return [lonHit.value, hits.find(h => h !== lonHit).value];
  if (latHit) return [hits.find(h => h !== latHit).value, latHit.value];
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
  return state.date + " / 归档观测";
}
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

// 锋面强度：口径＝跨锋面 SST 温差（数据集自带的 frontal_intensity 未接入）。
// 当日没有海温或两侧取样落到缺测时返回 null —— 不猜、不用 0 顶替。
function intensityOf(entry, iso) {
  if (!entry || !entry.points || entry.points.length < 2) return null;
  const raw = OFData.frontIntensity(iso || state.date, entry.points);
  if (!raw) return null;
  const level = OFData.intensityLevel(raw.meanRangeC);
  return { label: level.label, meanRangeC: raw.meanRangeC, gradientCPerKm: raw.gradientCPerKm,
    sampleCount: raw.sampleCount, note: raw.note };
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
function chainLinesPath(chains) { return chains.map((pts) => pathOf(pts)).join(" "); }

// 概览档的锋面线：把聚合格按「行中线」画成细线段 —— 位置照实、但不假装一格 2° 宽的带。
// 相邻行的线段视觉上自然连成锋面线；平面档直接连直线，球面档按 ≤15° 采样并断开背面段。
function bandSegmentPath(runs, grid) {
  let d = "";
  let open = null;
  const flush = () => {
    if (!open) return;
    const lat = grid.lat0 + (open.row + open.rows / 2) * grid.dlat;
    const lonA = grid.lon0 + open.col * grid.dlon;
    const lonB = lonA + open.count * grid.dlon;
    if (globeMode()) {
      const segs = Math.max(1, Math.ceil((lonB - lonA) / RLE_SEG_DEG));
      const pts = [];
      let anyVisible = false;
      for (let k = 0; k <= segs; k++) {
        const lon = lonA + ((lonB - lonA) * k) / segs;
        pts.push([lon, lat]);
        if (OFMap.visible(lon, lat, _view)) anyVisible = true;
      }
      if (anyVisible) d += OFMap.path(pts, _view, {});
    } else {
      const a = xy(lonA, lat), b = xy(lonB, lat);
      d += "M" + a[0].toFixed(1) + "," + a[1].toFixed(1) + "L" + b[0].toFixed(1) + "," + b[1].toFixed(1);
    }
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

// 逐行 RLE 还原成矩形（每格一个矩形，合成一个 path；不插值、不放大）
// 相邻行里起止相同的 run 会合并成一个矩形，避免 0.05° 格子拼出"马赛克 + 缝"
// ⚠️ 平面档是线性投影 → 可以直接用屏幕矩形拼（快、无缝）；
//    球面档**必须走投影**（否则矩形按平面常量摆到盘外，看起来就是"几条直线把区域切开"）。
function rlePath(runs, grid) {
  return globeMode() ? rlePathGlobe(runs, grid) : rlePathPlane(runs, grid);
}

function rlePathPlane(runs, grid) {
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

// 球面档：把每个 run 沿经度切成 ≤ SEG_DEG 的小条，逐条按正交投影画。
// - 整条在背面 → 不画（这是原来"大三角形"的来源：背面四角被直接连线）；
// - 跨地平线 → 交给 OFMap.path(rim)，背面角自动贴到球缘，保持闭合、不连线穿球。
// SEG_DEG 取 15°：正交投影在 15° 内的弦高误差 <1%（球面上≈1 像素级），点数是原来的 1/8~1/4。
const RLE_SEG_DEG = 15;
function rlePathGlobe(runs, grid) {
  const segCols = Math.max(1, Math.round(RLE_SEG_DEG / Math.max(grid.dlon, 0.001)));
  let d = "";
  let open = null;
  const flush = () => {
    if (!open) return;
    const c0 = open.col, c1 = open.col + open.count;
    const latMin = grid.lat0 + open.row * grid.dlat;
    const latMax = latMin + open.rows * grid.dlat;
    for (let c = c0; c < c1; c += segCols) {
      const cols = Math.min(segCols, c1 - c);
      const lonMin = grid.lon0 + c * grid.dlon;
      const lonMax = lonMin + cols * grid.dlon;
      const ring = [[lonMin, latMin], [lonMax, latMin], [lonMax, latMax], [lonMin, latMax]];
      let anyVisible = false;
      for (let k = 0; k < ring.length && !anyVisible; k++) {
        anyVisible = OFMap.visible(ring[k][0], ring[k][1], _view);
      }
      if (!anyVisible) continue;
      d += OFMap.path(ring, _view, { closed: true });
    }
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
  // 球面档：钉在背面或球外的点不画（免得看起来像钉在球缘上）
  if (!OFMap.visible(state.probe.lon, state.probe.lat, _view)) return;
  const p = xy(state.probe.lon, state.probe.lat);
  el("line", { x1: p[0] - 11, y1: p[1], x2: p[0] + 11, y2: p[1], stroke: "#ffd9a0", "stroke-width": 1.4 }, svg);
  el("line", { x1: p[0], y1: p[1] - 11, x2: p[0], y2: p[1] + 11, stroke: "#ffd9a0", "stroke-width": 1.4 }, svg);
  el("circle", { cx: p[0], cy: p[1], r: 3.2, fill: "#ffd9a0" }, svg);
}

// 底图分档（LOD）：
//   球面档 → 1:110m 世界轮廓 + 地球圆盘；平面档 → 跨度 > 10° 叠 1:50m 西太平洋，恒叠 1:10m 东海细节
function basemapSets() {
  if (globeMode()) return [{ data: OFData.basemapWorld, detailed: false }];
  // v1.9：平面档也能拖到任何海域，底图按「可见框和哪一档有交集」叠，
  // 都不覆盖时用 1:110m 世界轮廓兜底 —— 保证任何视野都有海岸线，不出现"只有数据没有陆地"。
  const box = OFMap.visibleBounds(_view, mapAspect());
  const hits = function (data) {
    const b = data && (data.bbox || [-180, -90, 180, 90]);
    if (!b || !box) return false;
    return box.lonMax >= b[0] && box.lonMin <= b[2] && box.latMax >= b[1] && box.latMin <= b[3];
  };
  const world = OFData.basemapWorld, asia = OFData.basemapAsia, local = OFData.basemap;
  const sets = [];
  const inLocal = hits(local);
  if (asia && hits(asia) && (_view.span > 10 || !inLocal)) sets.push({ data: asia, detailed: false });
  if (local && inLocal) sets.push({ data: local, detailed: true });
  if (!sets.length && world) sets.push({ data: world, detailed: false });
  return sets.filter((s) => !!s.data);
}

// 底图：真实陆地 / 海岸线 / 等深线（Natural Earth，公有领域）
function drawBackground(svg) {
  const box = currentView();
  if (globeMode()) {
    // 球面档：先铺深空底色，再画地球圆盘（正射投影的可见半球）
    el("rect", { x: box.x - 4, y: box.y - 4, width: box.w + 8, height: box.h + 8,
      fill: "#050b14", "data-layer": "space" }, svg);
    const c = xy(_view.lon0, _view.lat0);
    el("circle", { cx: c[0], cy: c[1], r: OFMap.R_GLOBE, fill: "#0e2440", "data-layer": "globe" }, svg);
    el("circle", { cx: c[0], cy: c[1], r: OFMap.R_GLOBE, fill: "none",
      stroke: "rgba(120,190,225,0.55)", "stroke-width": 1.6 }, svg);
    return;
  }
  el("rect", { x: box.x - 4, y: box.y - 4, width: box.w + 8, height: box.h + 8,
    fill: "#0d2135", "data-layer": "ocean" }, svg);
  // 等深线只在东海细节档画（跨度过大时线条挤在一起没有信息量）
  const base = OFData.basemap;
  if (!base || _view.span > 12) return;
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

// 真实经纬网：平面档按整数度画直线并标度数；球面档按 10°/15°/30° 画采样曲线（跟着球面弯）
function drawGraticule(host) {
  const g = host;
  const box = currentView();
  const aspect = box.h > 0 ? box.w / box.h : 1.6;
  const tag = (text, x, y) => {
    const t = el("text", { x, y, fill: "rgba(186,214,235,0.6)", "font-size": 10.5,
      "paint-order": "stroke", stroke: "rgba(6,14,24,0.85)", "stroke-width": 3 }, g);
    t.textContent = text;
  };
  if (globeMode()) {
    const step = _view.span > 120 ? 30 : _view.span > 60 ? 15 : 10;
    OFMap.graticule(_view, aspect).forEach((line) => {
      if (!line.d) return;
      el("path", { d: line.d, fill: "none", stroke: "rgba(150,200,230,0.14)" }, g);
      if (!line.label || line.value % (step * 2) !== 0) return;
      const q = xy(line.label[0], line.label[1]);
      tag(line.value + (line.kind === "lon" ? "°E" : "°N"), q[0] + 4, q[1] + (line.kind === "lon" ? 12 : -4));
    });
    return;
  }
  const b = OFMap.visibleBounds(_view, aspect);
  for (let lon = Math.ceil(b.lonMin); lon <= Math.floor(b.lonMax); lon++) {
    const x = xy(lon, b.latMin)[0];
    el("line", { x1: x, y1: box.y, x2: x, y2: box.y + box.h, stroke: "rgba(150,200,230,0.10)" }, g);
    if (lon % 2 === 0) tag(lon + "°E", x + 3, box.y + 12);
  }
  for (let lat = Math.ceil(b.latMin); lat <= Math.floor(b.latMax); lat++) {
    const y = xy(b.lonMin, lat)[1];
    el("line", { x1: box.x, y1: y, x2: box.x + box.w, y2: y, stroke: "rgba(150,200,230,0.10)" }, g);
    if (lat % 2 === 0) tag(lat + "°N", box.x + 4, y - 3);
  }
}

// 海温色带：按数据里的 0.5 °C 档位取色（不插值，只是给档位配颜色）
function sstColor(c) { return OFColors.sstStyle(c).color; }

// Paint a single winning source at each location; preserve each source grid.
function sstDisplaySources() {
  return OFData.sstSources(state.date).filter(source => !globeMode() || source.sst.grid.dlon > 0.1);
}
function sstFootprint(day) {
  return rlePath(Array.from({ length: day.grid.ny }, (_, row) => [row, 0, day.grid.nx]), day.grid);
}
function drawSstSources(svg) {
  if (!state.layers.sst) return;
  // The same finest-first source order is used by point readings. Mask the
  // entire higher-priority grid, including holes, so coarse colours cannot
  // leak into fine-grid missing values or blend underneath valid fine cells.
  const sources = sstDisplaySources(), defs = $("mapSvg").querySelector("defs"), box = currentView();
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i], group = el("g", { "data-sst-resolution": source.sst.grid.dlon }, svg);
    if (i > 0) {
      const id = "sst-cover-" + i, mask = el("mask", { id, maskUnits: "userSpaceOnUse", x: box.x, y: box.y, width: box.w, height: box.h }, defs);
      el("rect", { x: box.x, y: box.y, width: box.w, height: box.h, fill: "white" }, mask);
      for (let j = 0; j < i; j++) el("path", { d: sstFootprint(sources[j].sst), fill: "black" }, mask);
      group.setAttribute("mask", "url(#" + id + ")");
    }
    drawSstLayer(group, source.sst);
    const day = source.sst;
    if ((day.runs || []).reduce((n, run) => n + run[2], 0) < day.grid.nx * day.grid.ny) {
      const id = "sst-missing-" + i, mask = el("mask", { id, maskUnits: "userSpaceOnUse", x: box.x, y: box.y, width: box.w, height: box.h }, defs);
      el("path", { d: sstFootprint(day), fill: "white" }, mask);
      el("path", { d: rlePath(day.runs || [], day.grid), fill: "black" }, mask);
      el("path", { d: sstFootprint(day), fill: "url(#sstMissingHatch)", mask: "url(#" + id + ")", "data-layer": "sst-missing" }, group);
    }
  }
}

function drawSstLayer(svg, day) {
  const binC = day.bin_c || OFData.sstBinC();
  const byBin = new Map();
  (day.runs || []).forEach((run) => {
    if (!byBin.has(run[3])) byBin.set(run[3], []);
    byBin.get(run[3]).push(run);
  });
  const base = OFColors.sstOpacity(); // All winning sources share opacity; no coarse/fine colour blending.
  byBin.forEach((runs, bin) => {
    const range = OFColors.sstStyle(bin * binC).range;
    el("path", { d: rlePath(runs, day.grid), "data-layer": "sst", "data-value-c": bin * binC, "data-range": OFColors.sstStyle(bin * binC).range, fill: sstColor(bin * binC),
      stroke: range === "below" ? "#86b6cf" : range === "above" ? "#fff9db" : "none", "stroke-width": 0.8,
      "stroke-dasharray": range === "within" ? "none" : "2 2", "shape-rendering": "crispEdges", opacity: base }, svg);
  });
}

// 绕极环（南极大陆：环里包含 ±90 的极点）**不画填充**：
// 它在平面档不可能表示成合法多边形（闭合弦横穿整幅地图 → 非零填充把陆地翻到另一侧），
// 球面档同样会连出横穿球面的直线。海岸线层是独立折线，轮廓照旧画出来。
// （数据层同样值得修：tools/build-basemap.mjs 的 splitAtAntimeridian 只把环切开、
//   没沿反经线补到极点；这里先在渲染层兜住，避免整档底图退化。）
const polarFiltered = new WeakMap();
function landFillChains(data) {
  const cached = polarFiltered.get(data);
  if (cached) return cached;
  const land = data.layers && data.layers.land;
  const chains = (land && land.chains) || [];
  const kept = chains.filter(function (ring) {
    for (let i = 0; i < ring.length; i++) {
      if (Math.abs(ring[i][1]) >= 89.5) return false;
    }
    return true;
  });
  polarFiltered.set(data, kept);
  return kept;
}

// 陆地画在数据层之上：海上的"没有观测"用斜线纹理，陆地是实色块 + 亮海岸线
// （数据里的 -128 同时包含陆地与云；陆地填充要明显浅于海面，否则等于看不见）
// 分档：最细的一档最亮；球面档只有 1:110m 世界轮廓，填充略暗以突出球体感。
function drawLand(svg) {
  const sets = basemapSets();
  sets.forEach((set, i) => {
    const top = i === sets.length - 1;
    const layers = set.data.layers || {};
    // 1:110m 世界档在平面档只画轮廓不填色：它的环跨 180°/极点，平面投影下存在
    // "填充落到另一侧"的退化情形（实测在几内亚湾视图会把整幅画面填成陆地色）。
    // 球面档有可见性重建，填色安全，照旧填。
    const bbox = set.data.bbox || [-180, -90, 180, 90];
    const wholeGlobe = bbox[0] <= -180 && bbox[1] <= -90 && bbox[2] >= 180 && bbox[3] >= 90;
    if (layers.land && (globeMode() || !wholeGlobe)) {
      const d = OFMap.paths(landFillChains(set.data), _view, { closed: true });
      if (d) el("path", { d, "data-layer": "land", stroke: "none",
        fill: globeMode() ? "#33475e" : top ? "#3a5068" : "#31465c" }, svg);
    }
    if (layers.coastline) {
      const d = OFMap.paths(layers.coastline.chains, _view);
      if (d) el("path", { d, "data-layer": "coast", fill: "none",
        stroke: globeMode() ? "rgba(190,225,250,0.72)" : top ? "rgba(196,229,252,0.9)" : "rgba(160,205,235,0.5)",
        "stroke-width": globeMode() ? 1.1 : top ? 1.4 : 1.0 }, svg);
    }
  });
}

// 海上没有观测的像元（云 / 未观测；数据里 -128 与陆地共用编码）
function drawNodataPatch(svg, patch) {
  if (!state.layers.nodata || !patch.front) return;
  el("path", { d: rlePath(patch.front.nodata_rle || [], patch.grid), "data-layer": "nodata",
    fill: "url(#nodataHatch)", stroke: "none", "shape-rendering": "crispEdges",
    opacity: patch.overview ? 0.3 : 0.5 }, svg);
}


// 一片数据里的锋面图层（栅格 + 对象线）。概览片只画栅格：1° 的聚合格不是锋面对象
function drawFrontPatch(svg, patch, sel) {
  const day = patch.front;
  if (!day) return;
  const dim = (k) => (sel && sel.type !== k ? 0.16 : 1);
  const grid = patch.grid;
  const alpha = patch.overview ? 0.7 : 1;          // 概览整体压一点，和明细区分

  // 冷侧 / 暖侧：数据里的 -20 / 20 编码，一格不改
  if (state.layers.coldwarm) {
    const on = !!sel && sel.type === "coldwarm";
    el("path", { d: rlePath(day.cold_side_rle || [], grid), "data-layer": "cold",
      fill: "rgba(38,104,178,0.42)", stroke: "none", "shape-rendering": "crispEdges",
      opacity: dim("coldwarm") * alpha }, svg);
    el("path", { d: rlePath(day.warm_side_rle || [], grid), "data-layer": "warm",
      fill: "rgba(198,88,58,0.40)", stroke: "none", "shape-rendering": "crispEdges",
      opacity: dim("coldwarm") * alpha }, svg);
    if (on) {
      el("path", { d: rlePath(day.cold_side_rle || [], grid), fill: "none",
        stroke: "#5cb4ff", "stroke-width": 1.6 }, svg);
      el("path", { d: rlePath(day.warm_side_rle || [], grid), fill: "none",
        stroke: "#ffab5c", "stroke-width": 1.6 }, svg);
    }
  }

  // 锋面带：数据里的 -10 / 10 / 30 像元原样画；编码含义有歧义，图上不解释
  if (state.layers.band) {
    if (patch.overview) {
      // 概览档：按聚合格的行中线画细线（否则 2° 的块铺开会把全球涂成一片黄）
      el("path", { d: bandSegmentPath(day.front_band_rle || [], grid), "data-layer": "band",
        fill: "none", stroke: "rgba(255,236,170,0.9)", "stroke-width": 1.3,
        "stroke-linecap": "round", opacity: 0.95 * dim("front") * alpha }, svg);
    } else {
      el("path", { d: rlePath(day.front_band_rle || [], grid), "data-layer": "band",
        fill: "rgba(255,236,170,0.5)", stroke: "none", "shape-rendering": "crispEdges",
        opacity: 0.9 * dim("front") * alpha }, svg);
    }
  }

  // 锋面线：只有明细片才有对象中心线与未编号短段（概览片后端不返回对象清单）
  if (!state.layers.front || patch.overview) return;
  const entries = patchEntries(patch);
  const selected = sel && sel.type === "front" && sel.id ? sel.id : null;
  entries.forEach((entry) => {
    const isSel = !!(selected && entry.isObject && entry.id === selected);
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
    const nearestId = snapshot().fronts.find(f => f.isObject)?.id;
    entries.filter((e) => e.isObject && patch.primary && (e.id === nearestId || e.id === selected)).forEach((entry) => {
      const mid = entry.points[Math.floor(entry.points.length / 2)];
      const p = xy(mid[0], mid[1]);
      const isSel = !!(selected && entry.id === selected);
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

// 取一片里的锋面线段：主片沿用既有对象口径（ID / 长度来自 OFData），窗口片直接用自带的清单
function patchEntries(patch) {
  if (patch.primary) return frontEntries();
  const day = patch.front;
  const objects = (day.objects || []).map((o) => ({
    id: o.front_id, points: o.line, lengthKm: o.length_km, isObject: true,
  }));
  const shortLines = (day.front_line || []).slice(day.object_line_count || 0)
    .map((pts) => ({ id: null, points: pts, lengthKm: 0, isObject: false }));
  return objects.concat(shortLines);
}

// 与数据片无关的图层（渔场线索 / 推荐水域示例）
function drawExtras(svg, snap, iso, sel) {
  const dim = (k) => (sel && sel.type !== k ? 0.16 : 1);
  // 渔场线索（GFW 表观捕捞活动，fishing hours）：登记域内使用浅紫对数标尺；域未知时仅用统一标记。
  // 刻意与 SST 的连续色带在形态上区分（点阵 vs 色带）；低于当日中位数的格子不画，避免糊成一片。
  if (state.layers.ground) {
    // 历史事件窗口只画独立方标，不计入当日格网、均值或强弱色标。
    OFData.viewportResponses(iso).forEach(layer => {
      (layer.cells || []).filter(OFData.fishingCellValid).slice(0, 700).forEach(cell => {
        const p = xy(cell.lon, cell.lat);
        const marker = el("rect", { x: p[0] - 3, y: p[1] - 3, width: 6, height: 6,
          fill: "none", stroke: "#ba9fe8", "stroke-width": 1.2,
          "data-layer": "response-point", "aria-label": "历史响应窗口 " + cell.hours + " h" }, svg);
        el("title", {}, marker).textContent = "历史锋面后1–3日响应 " + cell.hours + " h · " +
          cell.bufferKm + " km窗口；多半径可重叠，非当日格点或渔获量";
      });
    });
    const fishing = OFData.fishingDay(iso);
    const cells = fishing && OFData.fishingHoursUnitSupported(fishing) && Array.isArray(fishing.cells) ? fishing.cells.filter(OFData.fishingCellValid) : [];
    if (cells.length) {
      const values = cells.map((c) => c.hours).sort((a, b) => a - b);
      const q = (f) => values[Math.min(values.length - 1, Math.max(0, Math.floor(values.length * f)))];
      const t60 = q(0.6);
      const drawn = cells
        .filter((c) => Number.isFinite(c.hours) && c.hours >= t60)
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 700);                                   // 上限兜底，防止极端日期卡顿
      drawn.forEach((cell) => {
        const p = xy(cell.lon, cell.lat);
        const style = OFColors.effortStyle(fishing, cell.hours);
        const point = el("circle", { cx: p[0], cy: p[1], r: style.radius, fill: cell.hours === 0 ? "none" : style.color,
          stroke: style.range === "above" ? "#fff" : style.color, "stroke-width": 1,
          "stroke-dasharray": style.range === "above" ? "2 2" : "none", opacity: 0.9 * dim("ground"),
          "data-layer": "ground", "data-hours": cell.hours, "data-range": style.range,
          "aria-label": "AIS 表观捕捞活动 " + cell.hours + " h" }, svg);
        el("title", {}, point).textContent = cell.hours + " h / AIS 表观捕捞活动 / " +
          (style.range === "above" ? "超过登记显示域，保留真实小时" : style.quantitative ? "限定统一标尺" : "标尺待确认，不编码强弱");
      });
    }
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
// 球面档不画 km 半径圈（球面上圆的形状会变形，画了一圈反而不诚实），只保留定位点与坐标
function drawOriginLayer(svg) {
  const q = xy(state.lon, state.lat);
  if (!globeMode()) {
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
  }
  el("circle", { cx: q[0], cy: q[1], r: 8, fill: "none", stroke: "#4dd4c6", "stroke-width": 2, class: "pulse" }, svg);
  el("circle", { cx: q[0], cy: q[1], r: 5, fill: "#fff" }, svg);
  el("text", { x: q[0] + 14, y: q[1] - 12, fill: "#fff", "font-size": 13, "font-weight": "bold",
    "paint-order": "stroke", stroke: "rgba(8,16,26,0.85)", "stroke-width": 3 }, svg)
    .textContent = fmtCoord(state.lon, state.lat);
  if (!globeMode()) {
    el("text", { x: 956, y: 40, fill: "rgba(200,225,240,0.6)", "font-size": 13 }, svg).textContent = "N ↑";
  }
}

// 球面档的框：作业海域（卡片结论用的窗口）+ 当前已取的那一片（按视野出数的窗口）
function drawGlobeCoverage(svg) {
  const area = OFMap.DATA_BBOX;
  const d = OFMap.boxPath(area, _view);
  if (d) {
    el("path", { d, fill: "rgba(77,212,198,0.06)", stroke: "rgba(77,212,198,0.65)",
      "stroke-width": 1.2, "stroke-dasharray": "6 4", "data-layer": "coverage" }, svg);
    const label = xy((area[0] + area[2]) / 2, area[3]);
    el("text", { x: label[0], y: label[1] - 8, "text-anchor": "middle", fill: "rgba(165,242,230,0.95)",
      "font-size": 12, "paint-order": "stroke", stroke: "rgba(6,14,24,0.9)", "stroke-width": 3 }, svg)
      .textContent = "作业海域 105–150°E / 3–45°N";
  }
  // 已取的数据片各自画个框（球面档最有用：一眼看出哪块是 0.05°、哪块是概览）
  OFData.patches(state.date).forEach(function (patch) {
    if (!patch.bbox || patch.primary) return;
    if (patch.bbox[0] <= -180 && patch.bbox[1] <= -90) return;      // 整颗地球的概览片不必画框
    const box = OFMap.boxPath(patch.bbox, _view);
    if (!box) return;
    el("path", { d: box, fill: "none", stroke: "rgba(226,240,255,0.40)",
      "stroke-width": 1, "stroke-dasharray": "3 5", "data-layer": "window" }, svg);
    const mid = xy((patch.bbox[0] + patch.bbox[2]) / 2, patch.bbox[1]);
    el("text", { x: mid[0], y: mid[1] + 14, "text-anchor": "middle", fill: "rgba(226,240,255,0.72)",
      "font-size": 11, "paint-order": "stroke", stroke: "rgba(6,14,24,0.9)", "stroke-width": 3 }, svg)
      .textContent = "已取 " + resolutionLabel(patch.resolutionDeg);
  });
}

// 分辨率文案：0.05° / 0.2° / 1° / 2°
function resolutionLabel(deg) {
  const n = Number(deg) || 0.05;
  return (n < 0.1 ? n.toFixed(2) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")) + "°";
}

function drawMap(opts) {
  const renderStarted = performance.now();
  const skipData = !!(opts && opts.skipData);   // 球面档拖动中：只画底图与框，松手再补数据
  const svg = $("mapSvg");
  svg.innerHTML = "";
  const defs = el("defs", {}, svg);
  const snap = snapshot();
  const iso = state.date;
  const ok = snap.ok || (OFData.serverEnabled() && OFData.patches(iso).some(p => !p.primary && p.front));
  const globe = globeMode();

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
  const sstHatch = el("pattern", { id: "sstMissingHatch", width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(-45)" }, defs);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 5, stroke: "#9daab7", "stroke-width": 1, opacity: 0.4 }, sstHatch);

  // 所有图层放进一档 stage：平面↔球面切换时整档淡出，遮住投影形变那一下
  const stage = el("g", { id: "mapStage", style: "transition:opacity " + GLOBE_FADE_MS + "ms ease" }, svg);
  drawBackground(stage);
  const gratHost = el("g", { id: "gratHost" }, stage);
  drawGraticule(gratHost);
  if (ok && !skipData) {
    drawSstSources(stage);
    // 一天可能有多片（作业海域明细 + 按视野取的概览/明细）：概览先画，明细压在上面。
    // 球面档只画概览片：0.05° 在球面上≈0.3 像素、却要重投影上万条游程，
    // 而概览片本来就是按窗口取的全球粗格（服务器模式），离线则只留世界轮廓与作业海域框。
    OFData.patches(iso).forEach(function (patch) {
      if (globe && patch.resolutionDeg <= 0.1) return;
      drawNodataPatch(stage, patch);
      drawFrontPatch(stage, patch, patch.primary ? state.select : null);
    });
    drawExtras(stage, snap, iso, state.select);
  }
  if (globe) drawGlobeCoverage(stage);          // 作业海域 + 已取窗口（很便宜，拖动中也画）
  drawLand(stage);                     // 陆地压在数据层之上：海上缺测用纹理，陆地保持实色
  drawOriginLayer(stage);
  drawProbeMark(stage);
  el("style", {}, defs).textContent =
    "@keyframes pulseAnim{0%{r:8;opacity:.9}100%{r:32;opacity:0}}.pulse{animation:pulseAnim 1.6s ease-out infinite}";
  syncViewHint(globe);
  updateScaleBar();
  const rendered = ok && !skipData ? OFData.patches(iso).filter(p => !globe || p.resolutionDeg > 0.1) : [];
  svg.dataset.renderSupport = JSON.stringify(rendered.map(p => p.bbox || [p.grid.lon0, p.grid.lat0, p.grid.lon0 + p.grid.dlon * p.grid.nx, p.grid.lat0 + p.grid.dlat * p.grid.ny]));
  svg.dataset.renderDate = iso;
  svg.dataset.renderStatus = rendered.length ? "ready" : skipData || ok ? "base-only" : "unavailable";
  if (OFData.serverEnabled() && !OFData.viewportReady(iso)) svg.dataset.renderStatus = viewportLoading ? "pending" : "partial";
  svg.dataset.mapMs = String(performance.now() - renderStarted);
  svg.dataset.dataStep = rendered.length ? String(Math.min(...rendered.map(p => p.resolutionDeg))) : "";
  syncRenderView();
}

// Public render evidence for the browser baseline; a basemap alone is never data-ready.
function syncRenderView() {
  const svg = $("mapSvg");
  svg.dataset.viewKey = JSON.stringify([state.date, state.view.lon0, state.view.lat0, state.zoom, _view.mode]);
  const support = JSON.parse(svg.dataset.renderSupport || "[]");
  const bounds = OFMap.visibleBounds(_view, mapAspect());
  const overlaps = support.some(b => !bounds || b[0] <= bounds.lonMax && b[2] >= bounds.lonMin && b[1] <= bounds.latMax && b[3] >= bounds.latMin);
  if (!overlaps) svg.dataset.renderStatus = "unavailable";
  else if (OFData.serverEnabled() && !OFData.viewportReady(state.date)) svg.dataset.renderStatus = viewportLoading ? "pending" : "partial";
  else if (svg.dataset.renderDate === state.date) svg.dataset.renderStatus = "ready";
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
  let head = '<div class="mp-coord">' + fmtCoord(lon, lat) + "</div>";
  if (state.layers.ground) {
    const hit = OFData.fishingCellAt(state.date, lon, lat);
    const text = hit.status === "ready" ? hit.hours + " h" : ({ "unit-conflict": "单位冲突", "unknown-resolution": "粒度未声明，查看标记原值", ambiguous: "格点匹配有歧义", unavailable: "活动资料未就绪", "unknown-coverage": "无记录／覆盖未知" }[hit.status]);
    head += '<div class="mp-row"><span class="mp-k">表观活动</span><span class="mp-v">' + text + "</span></div>";
  }
  const foot = '<div class="mp-foot">点击钉住 / Esc 取消</div>';
  const st = dataStatus();
  if (!st.ok) return head + '<div class="mp-note">' + st.title + "，该日期无数据，不做估算</div>" + foot;

  // SST and front masks are independent. A missing front observation must not
  // hide an available temperature; globe probes use the displayed coarse source.
  const sstHere = OFData.sstCell(state.date, lon, lat, state.layers.sst ? sstDisplaySources() : undefined);
  const tempV = sstHere && sstHere.valueC !== null ? sstHere.valueC.toFixed(1) + " °C"
    : sstHere && sstHere.inGrid ? "该格无水温数据" : "该位置无水温资料";
  head += '<div class="mp-row"><span class="mp-k">水温' + (!state.layers.sst ? "（图层关闭）" : "") + '</span><span class="mp-v">' + tempV +
    (sstHere?.resolutionDeg ? " / " + sstHere.resolutionDeg + "° 网格" : "") + "</span></div>";
  const cell = cellAt(lon, lat);
  const bbox = OFData.attribution() ? OFData.attribution().region.bbox : null;
  if (!cell || !cell.inGrid) {
    return head + '<div class="mp-note">该位置不在锋面数据范围内' +
      (bbox ? "（已覆盖 " + bbox[0] + "~" + bbox[2] + "°E，" + bbox[1] + "~" + bbox[3] + "°N）" : "") + "</div>" + foot;
  }
  if (cell.nodata) {
    return head + '<div class="mp-note">锋面缺测（陆地、云或未观测，锋面资料用 -128 表示）</div>' + foot;
  }

  let h = head;
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
    const inten = intensityOf(f);
    return { name: "锋面区 " + f.id,
      body: "长 <b>" + Math.round(f.lengthKm) + " km</b> · 离你 <b>" + f.km.toFixed(1) +
        " km</b> · " + f.bearing + "<br/>" + (f.inRange ? "在作业范围内" : "超出作业范围") +
        " · 你在" + (snap.cell && snap.cell.side ? snap.cell.side : "锋区外") +
        "<br/>强度 <b>" + (inten ? inten.label : "未知") + "</b>" +
        (inten
          ? "（跨锋面温差 " + inten.meanRangeC.toFixed(1) + " °C · 梯度 " + inten.gradientCPerKm.toFixed(3) +
            " °C/km，" + inten.sampleCount + " 个断面取样）"
          : "（当日无海温或缺测，不计算）") };
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
  const legendRows = [];
  document.querySelectorAll(".legend-row[data-layer]").forEach((row) => {
    const on = !!state.layers[row.dataset.layer];
    row.setAttribute("aria-pressed", String(on));
    row.style.opacity = on ? "1" : "0.45";
    row.style.filter = on ? "none" : "grayscale(1)";
    row.style.textDecoration = on ? "none" : "line-through";
    const label = row.querySelector(".layer-status");
    if (label) {
      const k = row.dataset.layer;
      const status = OFData.loadState();
      const load = status[k === "ground" ? "fishing" : "day"];
      const fishing = k === "ground" ? OFData.fishingDay(state.date) : null;
      const usable = fishing?.cells?.some(OFData.fishingCellValid);
      const unavailable = ["loading", "error", "forbidden", "day-missing", "unprepared", "unknown-coverage", "unit-conflict"];
      const readiness = k === "fishing" ? "example" : k === "ground" && !OFData.fishingAvailable() && !OFData.serverEnabled() ? "offline" :
        load && unavailable.includes(load.status) ? load.status :
        k === "ground" && fishing && !OFData.fishingHoursUnitSupported(fishing) ? "unit-conflict" :
        k === "ground" && fishing && !usable ? "unknown-coverage" :
        (k === "ground" ? !!usable : k === "sst" ? OFData.hasSst(state.date) : OFData.hasDay(state.date)) ? "ready" : "not-ready";
      label.textContent = readiness === "ready" ? (on ? "已显示" : "已隐藏") :
        ({ example: "示例，非实测", offline: "离线未接入", loading: "加载中", error: "请求失败", forbidden: "无权访问", "day-missing": "当日缺资料", unprepared: "未准备", "unknown-coverage": "覆盖未知", "unit-conflict": "单位冲突", "not-ready": "当日未就绪" }[readiness]);
      row.dataset.visibility = on ? "on" : "off";
      row.dataset.readiness = readiness;
      if (on && ["sst", "front", "coldwarm", "ground"].includes(k)) {
        const ready = readiness === "ready";
        const swatches = [...row.querySelectorAll(".swatch")].map(n => n.outerHTML).join("");
        let key = ready ? swatches : "";
        if (ready && k === "sst") key = '<button id="sstLegendOpen" type="button" aria-controls="layerDrawer" class="scale-key"><span class="scale-ramp" style="background:' + OFColors.sstGradient() + '"></span>' + OFColors.sstDomain().join("–") + " °C / " + OFColors.sstModeLabel() + "</button>";
        if (ready && k === "ground") key = '<button id="effortLegendOpen" type="button" aria-controls="layerDrawer" class="scale-key">' + (OFColors.effortScale(fishing) ? '<span class="scale-ramp" style="background:' + OFColors.effortGradient() + '"></span>' : "") + OFColors.effortLabel(fishing) + " / ◯ 0h</button>";
        legendRows.push('<div class="key-row">' + key +
          ({ sst: "水温", front: "锋面线", coldwarm: "冷侧 / 暖侧", ground: "表观活动 / 小时" }[k]) + (ready ? "" : "：" + label.textContent) + "</div>");
      }
    }
  });
  const summary = $("mapLegendSummary");
  if (state.layers.ground && OFData.viewportResponses(state.date).some(layer => layer.cells?.length)) {
    legendRows.push('<div class="key-row">□ 历史后1–3日响应 / 多半径可重叠，非当日格网</div>');
  }
  if (summary) { summary.innerHTML = legendRows.join(""); summary.hidden = !legendRows.length; }
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
  const snap = snapshot(), near = snap.nearest;
  $("heroWhen").textContent = timeLabel();
  $("heroVerdict").className = "verdict";
  $("heroVerdict").textContent = snap.ok && near ? near.km.toFixed(1) + " km" : "—";
  $("heroLine").textContent = !snap.ok ? snap.status.title + "：" + snap.status.desc :
    near ? "最近锋面在" + near.bearing + "，" + state.range + " km 范围内有 " + snap.inRange.filter(f => f.isObject).length + " 个锋面区。" :
    "当前支持范围内未检出锋面；缺测区域不作判断。";
  $("heroWhyBody").textContent = "锋面来自 Zenodo 展示数据；距离为定位点至锋面几何的最近距离，不代表捕捞收益。";
  syncSelect(); renderPick();
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
  return "用于解释历史表观捕捞活动响应，不代表渔获量";
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
    metricCell("范围内锋面区", String(snap.inRange.filter(f => f.isObject).length), "个") +
    metricCell("水温", anchorSst && anchorSst.valueC !== null ? anchorSst.valueC.toFixed(1) : "—", "°C") +
    metricCell("所处侧", snap.side || "锋区外", "", "coldwarm");

  // 海况：示例数据，不参与评分
  const sea = seaState(state.date);
  $("seaTag").textContent = "示例数据 · 仅供参考";
  $("seaTag").className = "tag warn";
  $("seaList").innerHTML =
    '<div class="row"><span class="i">≈</span><span class="grow"><b>风力 ' + sea.wind + " 级 · 浪高 " + sea.wave +
    " m · 涌浪 " + sea.swell + ' m</b><small>示例数据，非实况</small></span></div>' +
    '<div class="row"><span class="i">!</span><span class="grow"><b>正式出海请以官方海洋预报为准</b>' +
    "<small>示例不用于作业判断</small></span></div>";

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

function renderAisResponse(snap, explicit = false) {
  if (window.OceanEvidence && !explicit) return;
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
  return datesBetween(addDays(iso, 1 - count), iso);
}
function observationReadable(iso) {
  const quality = OFData.quality(iso), cell = OFData.primaryCellInfo(iso, state.lon, state.lat);
  return OFData.hasDay(iso) && Number.isFinite(quality?.valid_cells) && quality.valid_cells > 0 &&
    !!cell?.inGrid && !cell.nodata && !cell.overview;
}
function daySignal(iso) {
  const snap = snapshotFor(iso, state.lon, state.lat, state.range);
  return {
    date: iso,
    ok: snap.ok && observationReadable(iso),
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
function climPointSupported() {
  const anchor = OFData.meta?.region?.anchor;
  return Array.isArray(anchor) && anchor.length === 2 && anchor.every(Number.isFinite) &&
    Math.abs(anchor[0] - state.lon) < 1e-7 && Math.abs(anchor[1] - state.lat) < 1e-7;
}
function climRateFor(md, range) {
  if (!climPointSupported()) return null;
  const clim = OFData.clim;
  const entry = clim && clim.by_day ? clim.by_day[md] : null;
  const bucket = entry && entry.by_range ? entry.by_range[String(range)] : null;
  return bucket ? bucket.probability : null;
}
function baselineSeries() {
  const snap = snapshot();
  if (!snap.ok || !observationReadable(state.date)) return [];
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
    return { offset, date, score, confidence, hasObservation: observationReadable(date) };
  });
}
function renderRecentClimWindow(days, label) {
  const dates = recentObservationWindow(state.date, days);
  const agg = aggregateObservationDates(dates);
  const bars = $("climBars"), heat = $("climHeat"), stat = $("climStat"), years = $("climYears"), hint = $("climHint");
  hint.textContent = label + " · 实况回放";
  hint.className = "tag ok";
  bars.innerHTML = observationBarsHTML(dates);
  heat.innerHTML = climHeatHTML(dates);
  stat.innerHTML = dates.length
    ? "<b>" + label + "</b> · 已导出 " + dates.length + " 天，" + state.range + " km 内有锋面的日期 " +
      agg.present + "/" + agg.valid + " 个有观测样例日；缺日与缺测不视为未检出。"
    : "<b>" + label + "暂无实况</b><br/>需要先补导对应日期。";
  years.innerHTML =
    '<div class="line"><span class="k">当前窗口</span> → ' + (dates.length ? dates[0] + " ~ " + dates[dates.length - 1] : "—") + "</div>" +
    '<div class="line"><span class="k">可读样例</span> → <b>' + agg.valid + " 日</b></div>" +
    '<div class="line"><span class="k">窗口性质</span> → 连续日历窗口的实况样例；缺日不补齐，未导出或无有效观测的日期不进入分母</div>' +
    '<div class="line"><span class="k">多年对比</span> → 现有多年样本只有每年 8 月 5—7 日，暂不能代表任意连续 ' + days + " 日窗口</div>";
}

// ==================== L2-预测（规则基线，不冒充正式预报） ====================
function renderFuture(explicit = false) {
  if (window.OceanEvidence && !explicit) { window.OceanEvidence.sync(); return; }
  const snap = snapshot();
  const recent = aggregateObservationDates(recentObservationDates(state.date, 4));
  const climRate = climRateFor(state.date.slice(5), state.range);
  const series = baselineSeries();
  const windowDays = state.predWindow;
  const inWindow = series.filter((r) => r.offset <= windowDays);
  const best = inWindow.reduce((m, r) => (!m || r.score > m.score ? r : m), null);
  document.querySelectorAll("#futureWindow button").forEach((b) => b.classList.toggle("active", Number(b.dataset.window) === windowDays));
  $("futureTag").textContent = windowDays + " 天 · 规则参考";
  $("futureBestTag").textContent = "实验 / 未独立验证";
  if (!snap.ok || !observationReadable(state.date)) {
    $("futureBars").innerHTML = "";
    $("futureList").innerHTML =
      '<div class="row"><span class="i">!</span><span class="grow"><b>当前日期无数据</b><small>先切换到有实况数据的出海日，再生成规则预测参考</small></span></div>';
    $("futureDays").innerHTML = "";
    $("futureWhyBody").innerHTML = "";
    return;
  }
  $("futureList").innerHTML =
    '<div class="row"><span class="i">0</span><span class="grow"><b>' + windowDays + " 天规则窗口 " +
    (best ? mdText(best.date) + " · 规则分值 " + best.score + "（非概率）" : "暂无") + "</b>" +
    "<small>点击 1 / 3 / 7 天切换评估窗口；下方仍保留 7 天全貌</small></span></div>" +
    '<div class="row"><span class="i">1</span><span class="grow"><b>当前锋面规则分值 ' + snap.score + "（非概率）</b>" +
    "<small>使用范围内锋面区、最近距离、最长锋面区和数据覆盖计算</small></span></div>" +
    '<div class="row"><span class="i">2</span><span class="grow"><b>近几日持续性 ' +
    (recent.valid ? recent.present + "/" + recent.valid : "—") + "</b>" +
    "<small>只看已导出的实况日期，不读取未来实况作为预测依据</small></span></div>" +
    '<div class="row"><span class="i">3</span><span class="grow"><b>历史同期 ' +
    (climRate == null ? "暂无样本" : Math.round(climRate * 100) + "%") + "</b>" +
    "<small>统一口径 front_present；强度、AIS、海况尚未接入</small></span></div>";
  $("futureBars").innerHTML = series.map((r) =>
    '<i class="future' + (best && r.offset === best.offset ? " active" : "") + (r.offset > windowDays ? " dim" : "") + '" title="第 ' + r.offset +
      " 天规则分值 " + r.score + '（非概率）" style="height:' + Math.max(5, r.score) + '%"></i>').join("");
  $("futureDays").innerHTML =
    series.map((r) =>
      '<div class="row' + (r.hasObservation ? " clickable" : "") + (best && r.offset === best.offset ? " active" : "") + '" data-date="' + r.date + '">' +
      '<span class="i">' + r.offset + "</span><span class=\"grow\"><b>" + mdText(r.date) +
      " · 规则分值 " + r.score + "（非概率）</b><small>" + (r.offset <= windowDays ? "窗口内" : "窗口外参考") + " · 输入支持尚未独立验证 · " +
      (r.hasObservation ? "可切换查看该日实况" : "超出当前样例观测日期") +
      "</small></span></div>").join("");
  $("futureWhyBody").innerHTML =
    '<div class="line"><span class="k">当前信号</span> → 既有规则分值 <b>' + snap.score + "（非概率）</b></div>" +
    '<div class="line"><span class="k">持续性</span> → 近几日范围内有锋面 <b>' +
    (recent.valid ? recent.present + "/" + recent.valid : "—") + "</b> 天</div>" +
    '<div class="line"><span class="k">历史参照</span> → 同期出现比例 <b>' +
    (climRate == null ? "暂无样本" : Math.round(climRate * 100) + "%") + "</b></div>" +
    '<div class="line"><span class="k">边界</span> → 未使用未来实况；强度、AIS、真实海况与业务预报尚未接入</div>';
  $("futureDays").querySelectorAll(".clickable").forEach((node) =>
    node.addEventListener("click", () => {
      if (window.OceanEvidence && !window.OceanEvidence.isCurrent("future")) { showToast("条件已改变，请先更新规则参考"); return; }
      if (observationReadable(node.dataset.date)) setDate(node.dataset.date);
    }));
}

// ==================== L2-历史（实况聚合 + 真实多年度统计，口径见需求 §5.2） ====================
function climBarsHTML(labels, heights, actives, titles) {
  return labels.map((label, i) =>
    '<i class="' + (actives[i] ? "active" : "") + '" title="' + titles[i] + '" style="height:' +
    Math.max(0, Math.round(heights[i])) + '%"></i>').join("");
}
function observationBarsHTML(dates) {
  const rows = dates.map(daySignal);
  return climBarsHTML(dates.map(d => d.slice(5)), rows.map(r => r.ok && r.present ? 100 : 0),
    dates.map(d => d === state.date), rows.map(r => r.date + " / " + (!r.ok ? "缺资料或支持未知" : r.present ? "范围内检出锋面区" : "已观测部分未检出锋面区")));
}
function climHeatHTML(dates) {
  return dates.map((d) => {
    const r = daySignal(d);
    const cls = ["heat-cell"];
    if (r.ok) cls.push("has");
    if (r.ok && r.present) cls.push("hot");
    if (d === state.date) cls.push("active");
    const title = r.ok ? mdText(d) + " · " + (r.present ? "范围内检出锋面区" : "已观测部分未检出锋面区")
      : mdText(d) + " · 缺资料或支持未知";
    return '<span class="' + cls.join(" ") + '" title="' + title + '"></span>';
  }).join("");
}

function renderClim(explicit = false) {
  if (window.OceanEvidence && !explicit) { window.OceanEvidence.sync(); return; }
  const mode = state.climMode;
  document.querySelectorAll("#climPeriod button").forEach((b) => b.classList.toggle("active", b.dataset.period === mode));
  const bars = $("climBars"), heat = $("climHeat"), stat = $("climStat"), years = $("climYears"), hint = $("climHint");
  const clim = OFData.clim;
  heat.innerHTML = "";

  if (["day", "period"].includes(mode) && !climPointSupported()) {
    hint.textContent = "取样点不匹配"; hint.className = "tag warn";
    bars.innerHTML = ""; years.textContent = "多年同期统计来自导出元信息中的固定取样点；未对当前分析点重算。可使用逐日归档样例查看当前点，不能迁用固定点频率。";
    stat.textContent = "固定取样点统计不支持当前分析点；不显示该点的同期频率。";
    return;
  }

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
    bars.innerHTML = observationBarsHTML(dates);
    heat.innerHTML = climHeatHTML(dates);
    stat.innerHTML = dates.length
      ? "<b>当月实况</b> · 已导出 " + dates.length + " 天，" + state.range + " km 内有锋面的日期 " +
        agg.present + "/" + agg.valid + " 个有观测样例日；不是完整海域的无锋面判断。"
      : "<b>该月没有导出实况</b><br/>需要先补导对应月份数据。";
    years.innerHTML = dates.length
      ? '<div class="line"><span class="k">当前可算</span> → 使用 ' + dates[0] + " ~ " + dates[dates.length - 1] +
        " 的逐日实况回放</div>" +
        '<div class="line"><span class="k">多年整月</span> → 现有多年样本只有每年 8 月 5—7 日，不能代表完整月份</div>' +
        '<div class="line"><span class="k">有效样例</span> → <b>' + agg.valid + " 日</b></div>" +
        '<div class="line"><span class="k">统计方式</span> → 按已有观测是否检出锋面区计数；未导出或无有效观测的日期不进入分母</div>'
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
    bars.innerHTML = observationBarsHTML(dates);
    heat.innerHTML = climHeatHTML(dates);
    stat.innerHTML = dates.length
      ? "<b>整年视图</b> · 当前只导出 " + dates.length + " 天样例，" + state.range + " km 内有锋面的日期 " +
        agg.present + "/" + agg.valid + " 天；这不是完整全年统计。"
      : "<b>该年没有导出实况</b><br/>需要先补导对应年份数据。";
    years.innerHTML =
      '<div class="line"><span class="k">当前覆盖</span> → ' + (dates.length ? dates[0] + " ~ " + dates[dates.length - 1] : "—") + "</div>" +
      '<div class="line"><span class="k">全年缺口</span> → 需要补齐 1 月 1 日到 12 月 31 日逐日锋面，才能输出全年频率、最高月份和年际对比</div>' +
      '<div class="line"><span class="k">多年对比</span> → 现有多年样本仅覆盖 2015–2024 年 8 月 5—7 日，不能冒充 1982–2024 全年统计</div>' +
      '<div class="line"><span class="k">有效样例</span> → <b>' + agg.valid + " 日</b></div>";
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
    ["1", "<b>作业范围</b>：以出发地为圆心，" + a.region.ranges_km.join(" / ") + " km 内展示锋面；范围内没有编号锋面时展示最近的一条并注明"],
    ["2", "<b>当前结果</b>：只报告距离、方位、水温和数据覆盖；冷暖侧只展示、不加分，当前页已取消评分"],
    ["3", "<b>旧规则演示</b>：历史与预测页仍保留未验证的规则信号；这些值没有概率解释，不用于作业判断"],
    ["4", "<b>历史同期</b>：半径内锋面线格数 > 0 记 front_present = true；比例 = 有锋面的天数 ÷ 有效天数"],
    ["5", "<b>锋面区识别</b>：连通域中心线 + 抽稀（6 km），长度 ≥ " +
      (OFData.quality(a.days[a.days.length - 1]) ? OFData.quality(a.days[a.days.length - 1]).object_min_length_km : 20) + " km 才编号"],
    ["6", "<b>AIS 响应</b>：" + (responseMethod
      ? "按 " + responseMethod.buffer_km.join(" / ") + " km 锋面缓冲区汇总 apparent fishing effort；后 " +
        responseMethod.post_window_days.join("-") + " 天与前 " + responseMethod.pre_window_days +
        " 天基线、同日非锋面对照区比较"
      : "待接入 front-response 方法")],
    ["7", "<b>AIS 不参与评分</b>：AIS response 是历史证据来源与解释材料，不能推出当前捕捞收益"],
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
      ["!", "海况与预报暂无真实数据源，本页输出仅基于锋面数据"],
      ["!", "底图为 Natural Earth 1:10m（公有领域）；在国内正式发布需替换为带审图号的合规底图"],
    ]));
}

// ==================== L2-AI 分析（证据组织，不直接生成科学数值） ====================
function renderAI() {
  $("aiTag").textContent = "模型未接入";
  $("aiNextTag").textContent = "本地证据";
  $("aiSummary").textContent = "可先查看附近锋面、历史观测与数据来源。多轮分析待接入。";
  $("aiEvidenceBody").textContent = "日期 " + state.date + " / 半径 " + state.range + " km；结果随筛选即时更新。";
  $("aiPlan").textContent = "月度统计、事件响应、区域比较将在对应任务验收后接入。";
  $("aiNext").textContent = "";
}

let toastTimer;
function showToast(text) {
  $("toastLoc").textContent = text;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}
function clampDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso < DATE_MIN ? DATE_MIN : iso > DATE_MAX ? DATE_MAX : iso;
}
function loadThenRefresh(iso) {
  const identity = syncRequestContext();
  const local = OFData.hasDay(iso);
  if (local) refresh();                          // 先用本地数据渲染（快）
  if (!OFData.serverAvailable(iso)) {
    if (!local) refresh();                       // 本地也没有 → 走空态
    return Promise.resolve(local);
  }
  if (!local) refresh();                         // 本地没有：空态会说明「正在从服务器取这一天」
  return OFData.ensureDay(iso, local).then(function (ok) {
    if (state.date !== iso || identity !== syncRequestContext()) return false;
    if (!ok && !OFData.hasDay(iso)) showToast(mdText(iso) + " 没取到，请换个日期");
    refresh();
    warmOverview(iso);                            // 只补当前视野，不额外预热全球
    loadFishing(iso);                             // 渔场线索图层开着时，同一天也把当日捕捞格点取回来
    return ok && OFData.hasDay(iso);
  });
}

// 补当前视野：不改变日资料/研究状态，到位后只重画地图
function warmOverview(iso) {
  if (!OFData.serverEnabled()) return;
  const identity = syncRequestContext();
  OFData.prefetchOverview(iso).then(function (ok) {
    if (!ok || state.date !== iso || identity !== syncRequestContext()) return;
    invalidate();
    drawMap();
    syncViewHint();
  });
}

// 渔场线索（GFW 表观捕捞活动）：取当日 0.1° 格点，到位后只重画地图，不打乱其它面板。
// 只在图层打开（或用户刚打开图层、notify=true）时发请求。
// 取不到就什么都不画，保留不可用原因，绝不把缺失当 0。
function loadFishing(iso, notify) {
  if (!OFData.serverEnabled()) return;                    // 离线（file://）没有渔场数据源
  if (!state.layers.ground && notify !== true) return;    // 图层关着就不打扰服务器
  const identity = syncRequestContext();
  OFData.ensureFishing(iso).then(function (ok) {
    if (state.date !== iso || identity !== syncRequestContext()) return;
    if (ok) {
      invalidate();
      drawMap();
      if (typeof renderEffortSummary === "function") renderEffortSummary();
      return;
    }
    if (notify === true) {
      showToast(iso + " 活动资料未就绪或不可用，请查看加载状态；不代表零活动");
    }
  });
}

function setDate(iso) {
  setPlaying(false);
  const d = clampDate(iso);
  if (!d) return;
  if (d !== iso) showToast("可选日期为 " + mdText(DATE_MIN) + " ~ " + mdText(DATE_MAX));
  if (d === state.date) return;
  state.date = d;
  loadThenRefresh(d);
}

let playTimer = null, playActive = false, playGeneration = 0, playbackPaused = false;
function playbackUi(message) {
  const btn = $("datePlay");
  btn.textContent = playActive ? "Ⅱ" : "▶";
  btn.classList.toggle("on", playActive);
  btn.title = playActive ? "暂停播放" : "播放逐日变化";
  const status = $("playbackStatus");
  if (status) status.textContent = message || "";
  const next = $("playbackContinue"), stop = $("playbackStop");
  if (next) next.hidden = !playbackPaused || !AVAILABLE_DATES.some(d => d > state.date);
  if (stop) stop.hidden = !playActive && !playbackPaused;
}
function setPlaying(on) {
  clearTimeout(playTimer); playTimer = null;
  playGeneration++; playActive = !!on; playbackPaused = false;
  playbackUi(on ? "按日历逐日播放；缺日将暂停。" : "");
  if (on) schedulePlayback();
}
function schedulePlayback() {
  const generation = playGeneration;
  playTimer = setTimeout(() => {
    playTimer = null;
    if (!playActive || generation !== playGeneration) return;
    if (state.date >= DATE_MAX) { setPlaying(false); playbackUi("已到资料范围末尾，播放停止。"); return; }
    advancePlayback(addDays(state.date, 1), generation);
  }, 900);
}
async function advancePlayback(iso, generation) {
  state.date = iso;
  playbackUi(iso + "：正在读取日资料。");
  let failedLayer = "day";
  let loaded = await loadThenRefresh(iso);
  if (loaded && state.layers.ground && playActive && generation === playGeneration) {
    failedLayer = "fishing";
    loaded = await OFData.ensureFishing(iso);
    if (["unknown-coverage", "unit-conflict"].includes(OFData.loadState().fishing?.status)) loaded = false;
  }
  if (!playActive || generation !== playGeneration || state.date !== iso) return;
  const quality = OFData.quality(iso);
  if (!loaded || !OFData.hasDay(iso) || quality?.valid_cells === 0) {
    const status = OFData.loadState()[failedLayer]?.status;
    const reason = quality?.valid_cells === 0 ? "全天没有有效观测" : ({ unprepared: "资料未准备", forbidden: "无权访问", error: "读取失败", "day-missing": "整日缺资料", "unknown-coverage": "无活动记录／覆盖未知", "unit-conflict": "活动单位冲突" }[status]) || (failedLayer === "fishing" ? "活动资料未就绪" : "当日缺资料或支持未知");
    setPlaying(false); playbackPaused = true;
    playbackUi(iso + "：" + reason + "，已暂停。可继续下一可读日。");
    return;
  }
  playbackUi(iso + (quality?.nodata_cells > 0 ? "：部分格点缺测；不代表完整海域支持。" : "：日资料可读，研究完整性另核。"));
  schedulePlayback();
}
function continuePlayback() {
  const next = AVAILABLE_DATES.find(d => d > state.date);
  setPlaying(false);
  if (!next) { playbackUi("后续没有已登记可读日期。"); return; }
  playActive = true;
  advancePlayback(next, playGeneration);
}
function renderTimeRail() {
  const idx = Math.max(0, dateIndex(state.date));
  $("timeRail").min = 0;
  $("timeRail").max = Math.max(0, AVAILABLE_DATES.length - 1);
  $("timeRail").value = idx;
  $("timeRailText").textContent = (idx + 1) + "/" + AVAILABLE_DATES.length;
}

function refresh() {
  syncRequestContext();
  const panelStarted = performance.now();
  invalidate();
  renderLegend();
  drawMap();
  renderHero();
  renderNow();
  if (typeof renderEffortSummary === "function") renderEffortSummary();
  renderFuture();
  renderClim();
  renderBasis();
  renderAI();
  renderProbe();
  renderPick();
  $("dataStamp").textContent = timeLabel() + " · 真实锋面数据";
  syncServerModeUi();
  document.querySelectorAll("#rangeSeg button").forEach((b) => b.classList.toggle("active", Number(b.dataset.range) === state.range));
  $("timeDate").value = state.date;
  $("timeDate").min = DATE_MIN;
  $("timeDate").max = DATE_MAX;
  renderTimeRail();
  syncOriginPicker();
  requestViewportPatch(true);        // 换日期后这一片也要跟着换（窗口没变则命中缓存，不重复取）
  $("mapSvg").dataset.panelMs = String(Math.max(0, performance.now() - panelStarted - Number($("mapSvg").dataset.mapMs || 0)));
  window.dispatchEvent(new Event("ocean-applied-context"));
}

// 服务器增强模式启用后刷新日期范围与视野（AVAILABLE_DATES / DATE_MIN / DATE_MAX 用 let 的原因）
function applyServerRange() {
  AVAILABLE_DATES = OFData.availableDates();
  DATE_MIN = OFData.firstDate();
  DATE_MAX = OFData.lastDate();
  // 服务器模式的数据窗口比离线兜底大得多（105–150°E / 3–45°N），默认视野相应拉远；
  // 但「上次停留的视野」优先（视野记忆），别把它顶掉。
  if (!viewRestored) {
    state.zoom = SERVER_ZOOM;
    applyZoom(false);
  }
}

function syncServerModeUi() {
  const btn = $("serverModeToggle");
  if (!btn || !OFData.serverMode) return;
  const mode = OFData.serverMode();
  btn.classList.remove("server", "warn");
  if (mode.enabled) {
    const status = OFData.loadState().viewport?.status || OFData.viewportState(state.date)?.status;
    const label = { partial: "部分覆盖", empty: "范围外无覆盖", unavailable: "视窗未就绪", forbidden: "无权访问", error: "读取失败", "day-missing": "视窗缺资料", loading: "视窗加载中" }[status];
    btn.textContent = "服务器模式" + (label ? " · " + label : "");
    btn.classList.add("server");
    btn.classList.toggle("warn", ["forbidden", "error", "unavailable", "day-missing"].includes(status));
    const current = OFData.viewportState(state.date);
    const layerNames = { fronts: "锋面", sst: "水温", fishingEffort: "历史响应" };
    const supportNames = { available: "可用", partial: "部分覆盖", empty: "范围外无覆盖", unavailable: "未就绪" };
    btn.title = "按当前视野取数；未覆盖区域无结论，失败时保留已有同日资料。点击切回离线数据" +
      (current ? "\n" + Object.entries(current.coverage.layers).map(([key, value]) => layerNames[key] + "：" + supportNames[value]).join(" · ") +
        "\n" + current.caveats.join("\n") : "");
    return;
  }
  if (mode.checking) {
    btn.textContent = "检测中";
    btn.title = "正在检测 /api/health";
    return;
  }
  if (mode.status === "manual_offline") {
    btn.textContent = "离线模式";
    btn.title = "已手动使用本地离线数据；点击重新检测服务器";
    return;
  }
  btn.textContent = "离线模式";
  btn.classList.toggle("warn", !!mode.reason);
  btn.title = mode.reason ? "服务器不可用：" + mode.reason + "；点击重新检测" : "当前使用本地离线数据；点击检测服务器";
}

function setDrawer(open) {
  const drawer = $("layerDrawer");
  const btn = $("layerToggle");
  if (!drawer || !btn) return;
  drawer.classList.toggle("open", open);
  drawer.hidden = !open;
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  state.drawerOpen = open;
  window.dispatchEvent(new CustomEvent("ocean-layer-panel", { detail: { open } }));
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

// ==================== 视野：中心 + 缩放（两档投影自动切换） ====================
// 视窗长宽比跟着元素真实大小走。旧版固定 640/zoom + preserveAspectRatio="slice"，
// 元素比例不一致时会被裁掉一条边：既让"能看到的范围"变小，也让两轴边界不一致。
function mapAspect() {
  const r = $("map").getBoundingClientRect();
  return r.height > 0 ? r.width / r.height : 1.6;
}
// 缩放下限：整颗地球刚好装得下（球面档）；上限：0.05° 像元级
function zoomOutLimit() { return OFMap.SPAN_AT_ZOOM1 / OFMap.maxSpan(mapAspect()); }
function clampZoom(z) { return clamp(z, zoomOutLimit(), MAX_ZOOM); }
function viewSpan() { return OFMap.spanOf(state.zoom); }

// 拖动/缩放共用的位移换算：SVG 单位 → 经纬度（两档各自的每度尺度）
function nudgeView(dxUnits, dyUnits, atLat) {
  if (globeMode()) {
    const perDeg = (OFMap.R_GLOBE * Math.PI) / 180;
    state.view.lon0 -= dxUnits / (perDeg * Math.max(0.15, Math.cos((atLat * Math.PI) / 180)));
    state.view.lat0 += dyUnits / perDeg;
  } else {
    state.view.lon0 -= dxUnits / PX_LON;
    state.view.lat0 += dyUnits / PX_LAT;
  }
  state.view.lon0 = OFMap.wrapLon(state.view.lon0);
  state.view.lat0 = clamp(state.view.lat0, -89, 89);
}

function applyZoom(smooth, opts) {
  const aspect = mapAspect();
  state.zoom = clampZoom(state.zoom);
  const before = _view.mode;
  const c = OFMap.clampCenter(state.view.lon0, state.view.lat0, viewSpan(), aspect);
  state.view.lon0 = c.lon;
  state.view.lat0 = c.lat;
  syncView();
  const w = 1000 / state.zoom, h = w / aspect;          // 视窗比例 = 元素比例 → 不再裁切
  const o = xy(state.view.lon0, state.view.lat0);
  const svg = $("mapSvg");
  svg.style.transition = smooth === false ? "none" : "all .25s ease";
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("viewBox", (o[0] - w / 2) + " " + (o[1] - h / 2) + " " + w + " " + h);
  if (before !== _view.mode) {
    drawMap();                                          // 平面↔球面：几何全变，必须整档重画
    fadeInStage();
  } else if (globeMode()) {
    drawMap(opts);                                      // 球面档：转动的是球面，几何必须重投影
  } else {
    refreshGraticule();                                 // 平面档：只动视窗，经纬网节流重画
  }
  updateScaleBar();
  saveViewSoon();
  syncRequestContext();
  requestViewportPatch(true);                           // 视野变了 → 防抖后按需取这一片
  syncRenderView();
}
// 投影切换：新档从半透明淡入，遮住"等距平面 ↔ 正射球面"那一下形变
function fadeInStage() {
  const stage = $("mapStage");
  if (!stage) return;
  stage.style.transition = "none";
  stage.style.opacity = "0.3";
  requestAnimationFrame(() => {
    const s = $("mapStage");
    if (!s) return;
    s.style.transition = "opacity " + GLOBE_FADE_MS + "ms ease";
    s.style.opacity = "1";
  });
}
// 经纬网节流重画：拖动时不再每帧重建（旧版每帧 innerHTML 清空重画，是发涩的主因）
let gratTimer = 0;
function refreshGraticule(soon) {
  if (soon) {
    if (gratTimer) return;
    gratTimer = setTimeout(() => { gratTimer = 0; refreshGraticule(); }, 140);
    return;
  }
  const host = $("gratHost");
  if (!host) return;
  host.innerHTML = "";
  drawGraticule(host);
}
// 比例尺：把"图上 N km"换算成屏幕像素（纯几何换算，不涉及数据）。
// 平面档选一个落在 60–140 px 的整数刻度；球面档比例随纬度变化，不给假装精确的数字。
const NICE_KM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
function updateScaleBar() {
  const bar = $("mapScale"), text = $("mapScaleText");
  if (!bar || !text) return;
  const rect = $("mapSvg").getBoundingClientRect();
  const box = currentView();
  if (!rect.width || !box.w) return;
  if (globeMode()) {
    bar.style.width = "0px";
    bar.style.opacity = "0.25";
    text.textContent = "球面视图 · 比例随纬度变化";
    return;
  }
  const kmPerPx = OFMap.kmPerPx(state.view.lat0, box.w / rect.width);
  const want = NICE_KM.find((km) => km / kmPerPx >= 60) || NICE_KM[NICE_KM.length - 1];
  bar.style.opacity = "1";
  bar.style.width = Math.round(want / kmPerPx) + "px";
  text.textContent = want + " km";
}
// 口径提示：球面档说明当前是几度概览；平面档在视野跑出作业海域时说实话（卡片结论仍用作业海域）
function syncViewHint() {
  const hint = $("mapViewHint");
  if (!hint) return;
  const span = Math.round(_view.span);
  const ready = OFData.hasDay(state.date) || OFData.serverAvailable(state.date);
  const list = ready ? OFData.patches(state.date) : [];
  // 当前视野中心实际能看到的最高分辨率（有了它，提示才不会写着"2° 概览"却其实已经铺了 0.2°）
  const bboxOf = function (patch) {
    if (patch.bbox) return patch.bbox;
    if (!patch.grid) return null;
    const g = patch.grid;
    return [g.lon0, g.lat0, g.lon0 + g.dlon * g.nx, g.lat0 + g.dlat * g.ny];
  };
  const covering = list.filter(function (patch) {
    if (globeMode() && patch.resolutionDeg <= 0.1) return false;   // 球面档不画 0.05°，提示也只说能看见的
    const b = bboxOf(patch);
    return b && state.view.lon0 >= b[0] - 0.5 && state.view.lon0 <= b[2] + 0.5 &&
      state.view.lat0 >= b[1] - 0.5 && state.view.lat0 <= b[3] + 0.5;
  }).sort(function (a, b) { return a.resolutionDeg - b.resolutionDeg; });
  const here = covering[0] || null;
  const detailed = list.some(function (item) { return item.resolutionDeg <= 0.05; });

  if (globeMode()) {
    hint.hidden = false;
    if (!OFData.serverEnabled()) {
      hint.textContent = "球面视图（可见约 " + span + "° 经度）：离线版只带了作业海域那一片数据，" +
        "球面上只画世界轮廓 / 作业海域框；要看 0.05° 栅格就放大，" +
        "填上 API 地址（window.OF_API_BASE）后球面会自动取这一片的概览";
      return;
    }
    const kind = here
      ? (here.resolutionDeg <= 0.05 ? "0.05° 明细" :
        resolutionLabel(here.resolutionDeg) + " 概览（真实数据按块聚合，不做对象识别）")
      : (viewportLoading ? "正在取这一片的数据…" : "这一片还没有数据（先画世界轮廓，不编数据）");
    hint.textContent = "球面视图（可见约 " + span + "° 经度）：视野中心 " + kind +
      "；放大到 25° 以内自动换 0.05° 明细";
    return;
  }
  // 平面档：只有「可见范围完全落在作业海域之外」才提示（默认视野与作业海域有交集时不打扰）
  const win = ready ? OFData.workingWindow(state.date) : null;
  const box = OFMap.visibleBounds(_view, mapAspect());
  if (win && win.bbox && box) {
    const apart = box.lonMax < win.bbox[0] || box.lonMin > win.bbox[2] ||
      box.latMax < win.bbox[1] || box.latMin > win.bbox[3];
    if (apart) {
      hint.hidden = false;
      hint.textContent = "当前视野在作业海域之外：图上数据是按这个窗口取的真实数据" +
        (detailed ? "（0.05°）" : "（概览）") + "；右侧结论与统计仍基于作业海域 " +
        Math.round(win.bbox[0]) + "–" + Math.round(win.bbox[2]) + "°E / " +
        Math.round(win.bbox[1]) + "–" + Math.round(win.bbox[3]) + "°N" +
        (OFData.serverEnabled() ? "" : "（离线模式只带了这一片数据，不会自动取别处）");
      return;
    }
  }
  hint.hidden = true;
  hint.textContent = "";        // 收起时清空，避免截图/读屏里留着球面档的旧话
}

// 视野变了就去问服务器要这一片（防抖：拖动/缩放停稳后再发请求；同样的窗口不重复要）
let viewportTimer = 0, viewportLoading = false;
function syncRequestContext() {
  const prior = OFData.loadState();
  const epoch = OFData.setRequestContext({ date: state.date, lon: state.lon, lat: state.lat, radius: state.range,
    view: [state.view.lon0, state.view.lat0, state.zoom], mode: OFData.serverMode().userMode,
    enabled: OFData.serverEnabled(), version: OFData.serverMode().dataVersion });
  if (OFData.serverEnabled() && Object.values(prior).some(v => v.epoch !== epoch)) {
    // Reissue canceled work under the new identity, including cached-view changes.
    if (prior.day?.status === "loading") queueMicrotask(() => loadThenRefresh(state.date));
    if (prior.fishing?.status === "loading") queueMicrotask(() => loadFishing(state.date, true));
  }
  return epoch;
}
function requestViewportPatch(soon) {
  if (!OFData.serverEnabled()) return;
  if (viewportTimer) clearTimeout(viewportTimer);
  OFData.setViewWindow(viewportRequestBounds());
  viewportLoading = !OFData.viewportReady(state.date);
  if (viewportLoading) $("mapSvg").dataset.renderStatus = "pending";
  const delay = soon === false ? 0 : 420;
  viewportTimer = setTimeout(() => {
    viewportTimer = 0;
    const iso = state.date;
    const identity = syncRequestContext();
    if (!OFData.hasDay(iso) && !OFData.serverAvailable(iso)) return;
    const bounds = viewportRequestBounds();
    OFData.setViewWindow(bounds); // ensureViewport handles cache coverage; date and mode are part of request identity.
    viewportLoading = true;
    if (globeMode()) syncViewHint();
    // 只有慢的时候才提示（快的时候提示反而刷屏）
    const slowNotice = setTimeout(function () {
      if (identity !== syncRequestContext()) return;
      showToast("正在取这一片的数据（按当前视野取数，窗口很大时给概览）…");
    }, 600);
    OFData.ensureViewport(iso, soon === false).then((ok) => {
      clearTimeout(slowNotice);
      if (identity !== syncRequestContext()) return;
      viewportLoading = false;
      syncServerModeUi();
      if (!ok && !OFData.serverEnabled()) showToast("服务器取数失败，已回到离线模式");
      invalidate();                      // 取到就重画（地图自己给出反馈，不再弹提示刷屏）
      drawMap();
      syncViewHint();
      renderLegend(); renderPick(); renderProbe();
    });
  }, delay);
}

// 球面可见半球的经纬包围框；极点可见时经度需覆盖全球，但不预取背面纬带。
function viewportRequestBounds() {
  return OFMap.visibleBounds(_view, mapAspect()) || {
    lonMin: -180, lonMax: 180,
    latMin: Math.max(-90, _view.lat0 - 90), latMax: Math.min(90, _view.lat0 + 90),
  };
}

// 一键在「整颗地球」与「数据窗口」之间切换
function centerGlobe() {
  if (globeMode()) {
    centerOn(127.5, 24, OFMap.zoomForSpan(18));
    showToast("已回到数据窗口（105–150°E / 3–45°N）");
  } else {
    state.zoom = zoomOutLimit();
    centerOn(127.5, 24, state.zoom);
    warmOverview(state.date);                     // 立刻取当前球面包围框，仍复用同身份请求
    showToast("已缩到整颗地球（滚轮可放大）");
  }
}

// 以光标为中心缩放：把光标底下的地点钉在原位（平面档与球面档同一套算法）
function zoomAt(clientX, clientY, factor) {
  const svg = $("mapSvg"), rect = svg.getBoundingClientRect();
  const target = geoOfScreen(clientX, clientY);
  const next = clampZoom(state.zoom * factor);
  if (next === state.zoom) return;
  state.zoom = next;
  applyZoom(false);
  const box = currentView();
  const s = rect.width / box.w;
  if (target && !globeMode()) {
    const p = screenOf(target[0], target[1]);
    nudgeView((p.x - (clientX - rect.left)) / s, (p.y - (clientY - rect.top)) / s, target[1]);
  } else if (target && globeMode() && OFMap.visible(target[0], target[1], _view)) {
    const p = screenOf(target[0], target[1]);
    nudgeView((p.x - (clientX - rect.left)) / s, (p.y - (clientY - rect.top)) / s, target[1]);
  }
  applyZoom(false);
}
function centerOn(lon, lat, zoom) {
  state.view.lon0 = OFMap.wrapLon(lon);
  state.view.lat0 = clamp(lat, -89, 89);
  if (zoom) state.zoom = clampZoom(zoom);
  applyZoom();
}
// ==================== 视野记忆：下次打开回到上次停留的区域 ====================
function saveViewSoon() {
  clearTimeout(saveViewSoon.timer);
  saveViewSoon.timer = setTimeout(saveView, 500);
}
function saveView() {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({
      lon0: Math.round(state.view.lon0 * 1000) / 1000,
      lat0: Math.round(state.view.lat0 * 1000) / 1000,
      zoom: Math.round(state.zoom * 10000) / 10000,
    }));
  } catch (e) { /* 隐私模式 / 禁用存储：静默降级，不记忆 */ }
}
function loadView() {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const lon0 = Number(v && v.lon0), lat0 = Number(v && v.lat0), zoom = Number(v && v.zoom);
    if (!isFinite(lon0) || !isFinite(lat0) || !isFinite(zoom) || zoom <= 0) return null;
    return { lon0: OFMap.wrapLon(lon0), lat0: clamp(lat0, -89, 89), zoom: zoom };
  } catch (e) { return null; }
}
function clearView() {
  try { localStorage.removeItem(VIEW_KEY); } catch (e) { /* 同上 */ }
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
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    showToast("坐标超出范围：经度需在−180至180，纬度需在−90至90之间");
    return false;
  }
  setPlaying(false);
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
  return true;
}

// ==================== 事件绑定 ====================
function bind() {
  // ② 找多远
  document.querySelectorAll("#rangeSeg button").forEach((btn) => {
    btn.addEventListener("click", () => {
      setPlaying(false);
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
  $("datePlay").addEventListener("click", () => setPlaying(!playActive));
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
  // 指针事件统一鼠标 / 触摸 / 笔（并保留 mouse 回退：既有自动化检查用合成 MouseEvent 驱动）
  let drag = null, suppressClick = false, sawPointer = false;
  const interactive = (t) => !!(t && t.closest && t.closest(".map-legend, .map-controls, .map-pick, .map-probe, .load-status"));
  const dragStart = (x, y) => { drag = { x: x, y: y, moved: 0 }; hoverPt = null; renderProbe(); };
  const dragMove = (x, y) => {
    if (!drag) return false;
    const rect = $("mapSvg").getBoundingClientRect();
    const box = currentView();
    const s = rect.width / box.w;                     // 视窗不再裁切：两轴同一个比例
    nudgeView((x - drag.x) / s, (y - drag.y) / s, state.view.lat0);
    drag.moved += Math.abs(x - drag.x) + Math.abs(y - drag.y);
    drag.x = x;
    drag.y = y;
    const wasGlobe = globeMode();
    syncView();
    if (wasGlobe || globeMode()) {
      // 球面档：拖动的是「球体转动」——中心点始终留在画面正中的球心，
      // 所以必须走 applyZoom（它会同步 viewBox），只调 drawMap 会让球被拖出画面。
      if (!drag.raf) {
        drag.raf = requestAnimationFrame(() => {
          if (drag) drag.raf = 0;
          applyZoom(false, { skipData: true });
        });
      }
    } else {
      applyZoom(false);                               // 平面档：只改 viewBox，不重画数据
      refreshGraticule(true);
    }
    return true;
  };
  const dragEnd = () => {
    if (drag && drag.moved > 4) suppressClick = true;  // 拖动结束那一下不算点击
    const moved = !!(drag && drag.moved > 4);
    if (drag) { drag = null; saveViewSoon(); }
    if (moved && globeMode()) applyZoom(false);       // 松手：同步 viewBox 并补回数据片
    const host = $("gratHost");
    if (host && !globeMode()) refreshGraticule();
    if (globeMode()) updateScaleBar();
  };
  const mapPane = $("map");
  mapPane.addEventListener("pointerdown", (e) => {
    sawPointer = true;
    if (e.button !== 0 || interactive(e.target)) return;
    if (mapPane.setPointerCapture) { try { mapPane.setPointerCapture(e.pointerId); } catch (err) {} }
    dragStart(e.clientX, e.clientY);
  });
  mapPane.addEventListener("pointermove", (e) => { if (sawPointer) dragMove(e.clientX, e.clientY); });
  mapPane.addEventListener("pointerup", () => dragEnd());
  mapPane.addEventListener("pointercancel", () => dragEnd());
  mapPane.addEventListener("mousedown", (e) => {
    if (sawPointer) return;                            // 已经在走指针事件，避免重复触发
    if (e.button !== 0 || interactive(e.target)) return;
    dragStart(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => { if (!sawPointer) dragEnd(); });
  mapPane.addEventListener("wheel", (e) => {
    if (interactive(e.target)) return;
    e.preventDefault();
    // 连续缩放：滚轮/触控板（含 ctrl+wheel 捏合）同一个路径，不再按固定 1.2 倍跳变
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const factor = Math.exp(-e.deltaY * unit * 0.0016);
    zoomAt(e.clientX, e.clientY, factor);
  }, { passive: false });
  window.addEventListener("resize", () => { applyZoom(false); });

  // ===== 地图：鼠标指到哪，就显示哪里的数据 =====
  const map = $("map");
  let pending = null, raf = 0, lastPinAt = 0;
  map.addEventListener("mousemove", (e) => {
    if (drag && !sawPointer) { dragMove(e.clientX, e.clientY); return; }   // 合成鼠标事件（自动化）走这条
    if (drag) return;
    const r = map.getBoundingClientRect();
    pending = { x: e.clientX - r.left, y: e.clientY - r.top, cx: e.clientX, cy: e.clientY };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const p = pending;
      pending = null;
      if (!p || state.probe) return;   // 已经钉住时，鼠标不再抢浮层
      const g = geoOfScreen(p.cx, p.cy);
      if (!g) { hoverPt = null; renderProbe(); return; }   // 球面档：指到了球外
      hoverPt = { lon: g[0], lat: g[1], x: p.x, y: p.y };
      renderProbe();
    });
  });
  map.addEventListener("mouseleave", () => { hoverPt = null; renderProbe(); });
  map.addEventListener("click", (e) => {
    if (suppressClick) { suppressClick = false; return; }   // 拖动之后的那一下不算点击
    if (e.target.closest && e.target.closest(".map-legend, .map-controls, .map-pick, .map-probe, .map-empty, .load-status")) return;
    window.dispatchEvent(new Event("ocean-map-activate"));
    const g = geoOfScreen(e.clientX, e.clientY);
    if (!g) { showToast("这一点在地球背面或球外，没有坐标"); return; }
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
      lastPinAt = Date.now();
      showToast(!cell || !cell.inGrid ? "已钉住：这一点在导出范围外"
        : cell.nodata ? "已钉住：这一点没有观测数据" : "已钉住 " + fmtCoord(g[0], g[1]));
    }
    renderLegend(); drawMap(); syncSelect(); renderPick(); renderProbe();
  });
  // 双击放大：第一下点击会先钉住，这里在 400 ms 内把它撤回（保持「点一下=钉住」的既有语义）
  map.addEventListener("dblclick", (e) => {
    if (e.target.closest && e.target.closest(".map-legend, .map-controls, .map-pick, .map-probe, .map-empty")) return;
    if (state.probe && Date.now() - lastPinAt < 400) state.probe = null;
    zoomAt(e.clientX, e.clientY, 1.7);
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
  // 复位到「当前模式的默认视野」：服务器模式数据窗口更大，用 0.8 会把视野缩回东海
  $("recenter").addEventListener("click", () => {
    centerOn(state.lon, state.lat, OFData.serverEnabled() ? SERVER_ZOOM : DEFAULT_ZOOM);
    showToast("视野已回到出发地");
  });
  $("globeReset").addEventListener("click", () => centerGlobe());

  // 键盘：地图聚焦时方向键平移、+/- 缩放（可访问性；页签方向键逻辑不受影响）
  $("map").setAttribute("tabindex", "0");
  $("map").addEventListener("keydown", (e) => {
    const step = 40;
    const pan = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (pan) {
      e.preventDefault();
      const box = currentView();
      const s = $("mapSvg").getBoundingClientRect().width / box.w;
      nudgeView(pan[0] / s, pan[1] / s, state.view.lat0);
      const wasGlobe = globeMode();
      syncView();
      if (wasGlobe || globeMode()) drawMap(); else { applyZoom(false); refreshGraticule(); }
      return;
    }
    if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      e.preventDefault();
      const c = mapCenter();
      zoomAt(c[0], c[1], e.key === "+" || e.key === "=" ? 1.25 : 1 / 1.25);
    }
  });

  // 图层开关（图例）
  document.querySelectorAll(".legend-row[data-layer]").forEach((row) => {
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
    });
    row.addEventListener("click", () => {
      setPlaying(false);
      const k = row.dataset.layer;
      state.layers[k] = !state.layers[k];
      if (!state.layers[k] && state.select && state.select.type === k) state.select = null;
      renderLegend(); drawMap(); syncSelect(); renderPick();
      const meta = LAYER_META.find((m) => m[0] === k) || [k, k];
      showToast("图层「" + meta[1] + "」已" + (state.layers[k] ? "打开" : "关掉"));
      window.dispatchEvent(new CustomEvent("ocean-layer-choice", { detail: { key: k, value: state.layers[k] } }));
      if (k === "ground" && state.layers[k]) loadFishing(state.date, true);
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
    btn.addEventListener("click", () => { state.climMode = btn.dataset.period; window.OceanEvidence ? window.OceanEvidence.read("clim") : renderClim(); });
  });
  document.querySelectorAll("#futureWindow button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.predWindow = Number(btn.dataset.window);
      window.OceanEvidence ? window.OceanEvidence.read("future") : renderFuture();
      renderAI();
    });
  });
  $("toBasis").addEventListener("click", () => switchTab("basis"));
  $("serverModeToggle").addEventListener("click", () => {
    setPlaying(false);
    const mode = OFData.serverMode ? OFData.serverMode() : { enabled: false };
    if (mode.enabled) {
      OFData.setServerMode("offline").then(function () {
        syncServerModeUi();
        refresh();
        showToast("已切换到离线模式");
      });
      return;
    }
    syncServerModeUi();
    OFData.setServerMode("auto").then(function (enabled) {
      syncServerModeUi();
      if (!enabled) {
        showToast("服务器不可用，继续使用离线数据");
        return;
      }
      applyServerRange();
      refresh();
      loadThenRefresh(state.date);
      showToast("已切换到服务器模式");
    });
  });

}

// ==================== 启动 ====================
// 视野记忆：上次关掉时停在哪，这次就回到哪（localStorage 不可用 / 首次打开时用默认东海视野）
const savedView = loadView();
if (savedView) {
  state.view.lon0 = savedView.lon0;
  state.view.lat0 = savedView.lat0;
  state.zoom = savedView.zoom;
  viewRestored = true;
}
bind();
syncView();
refresh();
applyZoom(false);      // 按 state.zoom 设定初始视野（默认略微拉远，海岸线在画面内）
switchTab("now");
if (viewRestored) showToast("已回到上次停留的视野（“◎”回到出发地，“🌍”看整颗地球）");

// 服务器增强模式（可选）：成功则把日期范围扩到服务器上的全量日期并重渲染；
// file:// 打开或 API 不可达时静默跳过，页面保持纯离线行为。
window.OceanMapReady = OFData.initServerMode().then(function (enabled) {
  syncServerModeUi();
  if (!enabled) return;
  applyServerRange();
  refresh();
  loadThenRefresh(state.date);   // 首屏也拉一份服务器版本：服务器数据窗口比离线兜底大
});
