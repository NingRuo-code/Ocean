/* 地图投影与视野模块（页面唯一的地图几何真源）
 *
 * 两档投影，按「可见经度跨度 span」自动切换，切换点中心比例完全连续：
 *   - 平面档 plane（span ≤ 40°）：等距 km 投影（锚点 124.5°E / 30.2°N，东西与南北 1 km 等长）
 *     数学与旧版内联 xy()/geoOfXY() 完全一致 → 比例尺、km 半径圈、几何距离一个数都不变。
 *   - 球面档 globe（span > 40°）：正射投影（orthographic）画成球。球半径 R 取「球心处每度 = PX_LON 单位」，
 *     所以进入球面档的瞬间中心比例与平面档相同；缩放到最小即为「整颗地球」。
 *
 * 视野真源：{ lon0, lat0 }（地理中心）+ zoom（沿用旧语义：viewBox 宽 = 1000 / zoom）
 *   span = SPAN_AT_ZOOM1 / zoom
 *
 * 坐标约定：两档都把「视野中心」映到同一个 SVG 坐标（平面档 = xy(lon0, lat0)，球面档 = 正对观测者的球心点），
 * 因此 viewBox、比例尺、鼠标反算的老逻辑不必换坐标系。
 */
(function () {
  "use strict";

  const KM_PER_DEG = 111.195;
  const DEG = Math.PI / 180;
  const ANCHOR = { lon: 124.5, lat: 30.2 };
  const PX_LON = 180;                                            // 平面档：每经度的 SVG 单位
  const PX_LAT = (PX_LON / (KM_PER_DEG * Math.cos(ANCHOR.lat * DEG))) * KM_PER_DEG;
  const COS_ANCHOR = Math.cos(ANCHOR.lat * DEG);
  const SPAN_AT_ZOOM1 = 1000 / PX_LON;                           // zoom = 1 时可见经度跨度
  const PLANE_MAX_SPAN = 40;                                     // ≤ 40° 用平面档；再往上用球面档
  // 球半径：取「每度纬度 = PX_LAT 单位」。这样球心处 x/y 两向的比例与平面档**完全一致**
  // （R·cosφ0·DEG = PX_LON、R·DEG = PX_LAT），切换瞬间只差曲率、不差比例。
  const R_GLOBE = PX_LAT / DEG;                                  // ≈11937 单位
  const SPAN_MIN = 0.6;
  const SPAN_MAX_HARD = 380;                                     // 缩到最小：整颗球完整可见（留余量）
  // 平面档的平移范围：v1.9 起数据按视野取数（全球都能取），不再把平面档锁在东亚，
  // 而是允许任意经纬度 —— 只要求「可见框整体落在 ±180 内」，免得跨 180° 画出假连线；
  // 纬度留 ±78（等距平面在高纬会失真，更靠极地交给球面档）。
  const PAN_BOUNDS = { lonMin: -180, lonMax: 180, latMin: -78, latMax: 78 };
  const PAN_MARGIN = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrapLon = (lon) => (((lon + 180) % 360) + 360) % 360 - 180;

  // ---- 平面档（与旧版 xy()/geoOfXY() 逐位一致）----
  function xyPlane(lon, lat) { return [500 + (lon - ANCHOR.lon) * PX_LON, 320 - (lat - ANCHOR.lat) * PX_LAT]; }
  function geoOfPlane(x, y) { return [ANCHOR.lon + (x - 500) / PX_LON, ANCHOR.lat - (y - 320) / PX_LAT]; }

  function spanOf(zoom) { return SPAN_AT_ZOOM1 / zoom; }
  function zoomForSpan(span) { return SPAN_AT_ZOOM1 / span; }
  function modeOf(span) { return span > PLANE_MAX_SPAN ? "globe" : "plane"; }
  // 缩放下限：让整颗球在给定长宽比下完整可见（aspect = 宽 / 高）
  function maxSpan(aspect) {
    const need = (2 * R_GLOBE * 1.06) / PX_LON;                  // 球直径换算成「经度跨度」
    return clamp(need * Math.max(0.5, aspect), PLANE_MAX_SPAN + 4, SPAN_MAX_HARD);
  }

  // ---- 正射投影（球面档）----
  function ortho(lon, lat, lon0, lat0) {
    const dLon = (lon - lon0) * DEG;
    const phi = lat * DEG, phi0 = lat0 * DEG;
    const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
    const sinL = Math.sin(dLon), cosL = Math.cos(dLon);
    return {
      x: cosPhi * sinL,
      y: Math.cos(phi0) * sinPhi - Math.sin(phi0) * cosPhi * cosL,
      z: Math.sin(phi0) * sinPhi + Math.cos(phi0) * cosPhi * cosL,   // z ≥ 0 → 可见半球
    };
  }

  const isGlobe = (view) => !!(view && view.mode === "globe");

  // 经纬度 → SVG 坐标（球面档下背面点贴到球缘：画填充面时保持闭合；标记类请先用 visible() 判断）
  function toSvg(lon, lat, view) {
    if (!isGlobe(view)) return xyPlane(lon, lat);
    const c = xyPlane(view.lon0, view.lat0);
    const o = ortho(lon, lat, view.lon0, view.lat0);
    let x = o.x, y = o.y;
    if (o.z < 0) { const r = Math.hypot(x, y) || 1; x /= r; y /= r; }
    return [c[0] + R_GLOBE * x, c[1] - R_GLOBE * y];
  }

  function visible(lon, lat, view) {
    if (!isGlobe(view)) return true;
    return ortho(lon, lat, view.lon0, view.lat0).z >= 0;
  }

  // SVG 坐标 → 经纬度（球外返回 null）
  function fromSvg(x, y, view) {
    if (!isGlobe(view)) return geoOfPlane(x, y);
    const c = xyPlane(view.lon0, view.lat0);
    const dx = (x - c[0]) / R_GLOBE;
    const dy = (c[1] - y) / R_GLOBE;
    const rho = Math.hypot(dx, dy);
    if (rho > 1) return null;                                    // 球外
    if (rho === 0) return [view.lon0, view.lat0];
    const phi0 = view.lat0 * DEG;
    const cAng = Math.asin(Math.min(1, rho));
    const sinC = Math.sin(cAng), cosC = Math.cos(cAng);
    const sinPhi = cosC * Math.sin(phi0) + (dy * sinC * Math.cos(phi0)) / rho;
    const lat = Math.asin(clamp(sinPhi, -1, 1)) / DEG;
    const lon = view.lon0 + Math.atan2(dx * sinC, rho * Math.cos(phi0) * cosC - dy * Math.sin(phi0) * sinC) / DEG;
    return [wrapLon(lon), lat];
  }

  // ---- 球面档的可见性重建（v1.11）----
  // 旧做法是把背面点「贴到球缘」（toSvg 里 z<0 时归一化）——那会让闭合多边形自交：
  // 填充整片反转（海陆颜色互换）、还会连出横穿球面的直线。改成：
  //   ① 只投影可见点；② 整条不可见就整条不画；③ 闭合面在出界段之间**沿球缘补弧**（采样 3°）。
  function projectTrue(lon, lat, view) {
    const c = xyPlane(view.lon0, view.lat0);
    const o = ortho(lon, lat, view.lon0, view.lat0);
    return [c[0] + R_GLOBE * o.x, c[1] - R_GLOBE * o.y];
  }

  function globeRuns(pts, view) {
    const runs = [];
    let current = null;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!visible(p[0], p[1], view)) { current = null; continue; }
      if (!current) { current = []; runs.push(current); }
      current.push(projectTrue(p[0], p[1], view));
    }
    return runs;
  }

  // 沿球缘（屏幕空间的圆）补一段弧：取短弧，采样 3°
  function limbArc(from, to, view, out) {
    const c = xyPlane(view.lon0, view.lat0);
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    const a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
    let delta = a1 - a0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const steps = Math.max(2, Math.ceil(Math.abs(delta) / (3 * DEG)));
    for (let i = 1; i < steps; i++) {
      const a = a0 + (delta * i) / steps;
      out.push([c[0] + R_GLOBE * Math.cos(a), c[1] + R_GLOBE * Math.sin(a)]);
    }
  }

  function globePath(pts, view, closed, fmt) {
    const runs = globeRuns(pts, view);
    if (!runs.length) return "";                       // 整条不可见：不画
    if (!closed) {
      return runs.map(function (run) {
        if (run.length < 2) return "";
        let d = "M" + fmt(run[0][0]) + "," + fmt(run[0][1]);
        for (let k = 1; k < run.length; k++) d += "L" + fmt(run[k][0]) + "," + fmt(run[k][1]);
        return d;
      }).filter(Boolean).join(" ");
    }
    if (runs.length === 1) {
      const run = runs[0];
      if (run.length < 2) return "";
      let d = "M" + fmt(run[0][0]) + "," + fmt(run[0][1]);
      for (let k = 1; k < run.length; k++) d += "L" + fmt(run[k][0]) + "," + fmt(run[k][1]);
      return d + "Z";
    }
    // 多段：段与段之间用球缘弧连起来（含最后一段回到第一段），保证轮廓不自交
    const ring = [];
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const next = runs[(i + 1) % runs.length];
      for (let k = 0; k < run.length; k++) ring.push(run[k]);
      limbArc(run[run.length - 1], next[0], view, ring);
    }
    if (ring.length < 3) return "";
    let d = "M" + fmt(ring[0][0]) + "," + fmt(ring[0][1]);
    for (let k = 1; k < ring.length; k++) d += "L" + fmt(ring[k][0]) + "," + fmt(ring[k][1]);
    return d + "Z";
  }

  // 经纬度折线 → SVG path：球面档按可见性切段，闭合面沿球缘补弧（不画假连续、不自交）
  function path(pts, view, opts) {
    const o = opts || {};
    const digits = o.round == null ? 1 : o.round;
    const fmt = (v) => Number(v.toFixed(digits));
    if (isGlobe(view)) return globePath(pts, view, !!o.closed, fmt);
    let d = "", open = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = toSvg(p[0], p[1], view);
      d += (open ? "L" : "M") + fmt(q[0]) + "," + fmt(q[1]);
      open = true;
    }
    if (o.closed && d) d += "Z";
    return d;
  }
  function paths(chains, view, opts) {
    const o = opts || {};
    return chains.map((pts) => path(pts, view, o)).filter(Boolean).join(" ");
  }

  // ---- 视野夹取 ----
  function halfLatSpan(span, aspect) { return (span * COS_ANCHOR) / (2 * aspect); }

  function clampCenter(lon, lat, span, aspect) {
    const mode = modeOf(span);
    if (mode === "globe") return { lon: wrapLon(lon), lat: clamp(lat, -89, 89), mode: mode };
    const halfLon = span / 2;
    const halfLat = halfLatSpan(span, aspect);
    const lonMin = PAN_BOUNDS.lonMin - PAN_MARGIN, lonMax = PAN_BOUNDS.lonMax + PAN_MARGIN;
    const latMin = PAN_BOUNDS.latMin - PAN_MARGIN, latMax = PAN_BOUNDS.latMax + PAN_MARGIN;
    return {
      lon: 2 * halfLon >= lonMax - lonMin ? (lonMin + lonMax) / 2 : clamp(lon, lonMin + halfLon, lonMax - halfLon),
      lat: 2 * halfLat >= latMax - latMin ? (latMin + latMax) / 2 : clamp(lat, latMin + halfLat, latMax - halfLat),
      mode: mode,
    };
  }

  // 当前可见的地理范围（球面档返回 null：看到的是半个球，不是矩形）
  function visibleBounds(view, aspect) {
    if (isGlobe(view)) return null;
    const halfLon = view.span / 2;
    const halfLat = halfLatSpan(view.span, aspect);
    return {
      lonMin: view.lon0 - halfLon, lonMax: view.lon0 + halfLon,
      latMin: view.lat0 - halfLat, latMax: view.lat0 + halfLat,
    };
  }

  // ---- 经纬网 ----
  const sampleOf = (from, to, step) => {
    const out = [];
    for (let v = from; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(6)));
    return out;
  };
  function graticuleStep(span) { return span > 120 ? 30 : span > 60 ? 15 : 10; }

  // [{kind:"lon"|"lat", value, d, label:[lon,lat]|null}]：平面档是直线，球面档是采样曲线
  function graticule(view, aspect) {
    const out = [];
    if (!isGlobe(view)) {
      const box = visibleBounds(view, aspect);
      for (let lon = Math.ceil(box.lonMin); lon <= Math.floor(box.lonMax); lon++) {
        out.push({ kind: "lon", value: lon, d: path([[lon, box.latMin], [lon, box.latMax]], view), label: [lon, box.latMax] });
      }
      for (let lat = Math.ceil(box.latMin); lat <= Math.floor(box.latMax); lat++) {
        out.push({ kind: "lat", value: lat, d: path([[box.lonMin, lat], [box.lonMax, lat]], view), label: [box.lonMin, lat] });
      }
      return out;
    }
    const step = graticuleStep(view.span);
    const lats = sampleOf(-85, 85, 3);
    const lons = sampleOf(-179, 180, 3);
    for (let lon = -180; lon < 180; lon += step) {
      const pts = lats.map((lat) => [lon, lat]);
      out.push({ kind: "lon", value: lon, d: path(pts, view, { round: 0 }),
        label: pts.find((p) => visible(p[0], p[1], view)) || null });
    }
    for (let lat = -75; lat <= 75; lat += step) {
      const pts = lons.map((lon) => [lon, lat]);
      out.push({ kind: "lat", value: lat, d: path(pts, view, { round: 0 }),
        label: pts.find((p) => visible(p[0], p[1], view)) || null });
    }
    return out;
  }

  // 数据覆盖框：球面档下是弯边四边形（按采样点画），平面档是矩形
  function boxPath(bbox, view, step) {
    const [lonMin, latMin, lonMax, latMax] = bbox;
    const s = step || 2;
    const ring = [];
    for (let lon = lonMin; lon <= lonMax + 1e-9; lon += s) ring.push([lon, latMin]);
    for (let lat = latMin; lat <= latMax + 1e-9; lat += s) ring.push([lonMax, lat]);
    for (let lon = lonMax; lon >= lonMin - 1e-9; lon -= s) ring.push([lon, latMax]);
    for (let lat = latMax; lat >= latMin - 1e-9; lat -= s) ring.push([lonMin, lat]);
    return path(ring, view, { closed: true });     // 球面档：出界段沿球缘补弧；整框在背面则返回 ""
  }

  // 比例尺用：屏幕每像素代表多少公里（球面档取球心处，随纬度变化，页面会注明口径）
  function kmPerPx(lat, pxPerUnit) {
    return (KM_PER_DEG * Math.cos(lat * DEG)) / PX_LON / pxPerUnit;
  }

  window.OFMap = {
    ANCHOR: ANCHOR,
    PX_LON: PX_LON,
    PX_LAT: PX_LAT,
    R_GLOBE: R_GLOBE,
    KM_PER_DEG: KM_PER_DEG,
    PLANE_MAX_SPAN: PLANE_MAX_SPAN,
    SPAN_MIN: SPAN_MIN,
    SPAN_AT_ZOOM1: SPAN_AT_ZOOM1,
    PAN_BOUNDS: PAN_BOUNDS,
    DATA_BBOX: [105, 3, 150, 45],        // 服务器导出窗口（球面档下画成覆盖框）
    BASE_BBOX: [117.5, 25, 131.5, 35],   // 1:10m 东海细节底图范围
    xyPlane: xyPlane,
    geoOfPlane: geoOfPlane,
    spanOf: spanOf,
    zoomForSpan: zoomForSpan,
    modeOf: modeOf,
    maxSpan: maxSpan,
    toSvg: toSvg,
    fromSvg: fromSvg,
    visible: visible,
    path: path,
    paths: paths,
    clampCenter: clampCenter,
    visibleBounds: visibleBounds,
    graticule: graticule,
    boxPath: boxPath,
    kmPerPx: kmPerPx,
    wrapLon: wrapLon,
  };
})();
