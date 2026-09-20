/* 生成原型底图：从 Natural Earth 1:10m 公有领域数据里裁出东海一带的
 * 海岸线 + 200 m / 1000 m 等深线，抽稀后落成 window.OF_DATA_BASE。
 *
 * 用法：node tools/build-basemap.mjs
 *
 * 说明：
 * - Natural Earth 为公有领域（无需署名、可商用），此处仍保留来源与版本号便于追溯；
 * - 等深线取自 Natural Earth bathymetry 多边形的环坐标（200 m 即陆架边缘）；
 * - 全部离线提交进仓，双击打开 HTML 时不依赖任何在线底图服务（对应 BR-3）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NE_TAG = "5.1.2";
const NE_BASE = `https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@${NE_TAG}/geojson`;
// 视口最远能缩到 0.4 倍，这里比视口再留一圈，缩放/平移时不至于露出空白
const BBOX = [117.5, 25.0, 131.5, 35.0];
const SIMPLIFY_KM = 1.6;
const MIN_CHAIN_KM = 10;
const LAYERS = [
  { key: "land", file: "ne_10m_land.geojson", label: "陆地（面）", toleranceKm: 4.0, minChainKm: 0 },
  { key: "coastline", file: "ne_10m_coastline.geojson", label: "海岸线", toleranceKm: SIMPLIFY_KM, minChainKm: MIN_CHAIN_KM },
  { key: "isobath200", file: "ne_10m_bathymetry_K_200.geojson", label: "200 m 等深线（陆架边缘）", toleranceKm: SIMPLIFY_KM, minChainKm: MIN_CHAIN_KM },
  { key: "isobath1000", file: "ne_10m_bathymetry_J_1000.geojson", label: "1000 m 等深线", toleranceKm: SIMPLIFY_KM, minChainKm: MIN_CHAIN_KM },
];
// 陆地多边形只需外环填充，用粗一点的容差；等深线/海岸线要保持形状
const LAND_KEYS = new Set(["land"]);
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "base", "basemap.js");

const KM_PER_DEG = 111.195;
const round3 = (v) => Math.round(v * 1000) / 1000;
const kmPerLon = (lat) => KM_PER_DEG * Math.cos((lat * Math.PI) / 180);

function chainLengthKm(chain) {
  let total = 0;
  for (let i = 1; i < chain.length; i++) {
    const [lon0, lat0] = chain[i - 1];
    const [lon1, lat1] = chain[i];
    total += Math.hypot((lon1 - lon0) * kmPerLon((lat0 + lat1) / 2), (lat1 - lat0) * KM_PER_DEG);
  }
  return total;
}

function simplifyChain(chain, toleranceKm) {
  if (chain.length <= 3) return chain;
  const km = chain.map(([lon, lat]) => [lon * kmPerLon(lat), lat * KM_PER_DEG]);
  const keep = new Set([0, chain.length - 1]);
  const stack = [[0, chain.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    if (end <= start + 1) continue;
    let worst = 0;
    let worstIndex = -1;
    const [ax, ay] = km[start];
    const [bx, by] = km[end];
    const dx = bx - ax;
    const dy = by - ay;
    const denom = dx * dx + dy * dy;
    for (let i = start + 1; i < end; i++) {
      const [px, py] = km[i];
      let dist;
      if (denom === 0) {
        dist = Math.hypot(px - ax, py - ay);
      } else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom));
        dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (dist > worst) {
        worst = dist;
        worstIndex = i;
      }
    }
    if (worst > toleranceKm) {
      keep.add(worstIndex);
      stack.push([start, worstIndex], [worstIndex, end]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => chain[i]);
}

const inBox = ([lon, lat]) => lon >= BBOX[0] && lon <= BBOX[2] && lat >= BBOX[1] && lat <= BBOX[3];

// 按点裁切：连续在框内的点合成一段，离开框就断链（够用且不引入几何库）
function clipChain(points) {
  const chains = [];
  let current = [];
  for (const point of points) {
    if (inBox(point)) {
      current.push(point);
    } else if (current.length) {
      chains.push(current);
      current = [];
    }
  }
  if (current.length) chains.push(current);
  return chains;
}

function ringsOf(geometry) {
  const { type, coordinates } = geometry;
  if (type === "LineString") return [coordinates];
  if (type === "MultiLineString") return coordinates;
  if (type === "Polygon") return coordinates;
  if (type === "MultiPolygon") return coordinates.flat();
  return [];
}

function exteriorRingsOf(geometry) {
  const { type, coordinates } = geometry;
  if (type === "Polygon") return [coordinates[0]].filter(Boolean);
  if (type === "MultiPolygon") return coordinates.map((polygon) => polygon[0]).filter(Boolean);
  return [];
}

// 矩形是凸窗口，直接用 Sutherland–Hodgman 裁面（内环/湖面丢弃，原型不需要）
function clipPolygon(box, points) {
  const [minLon, minLat, maxLon, maxLat] = box;
  const planes = [
    { axis: 0, value: minLon, keepGreater: true },
    { axis: 0, value: maxLon, keepGreater: false },
    { axis: 1, value: minLat, keepGreater: true },
    { axis: 1, value: maxLat, keepGreater: false },
  ];
  let output = points;
  for (const plane of planes) {
    const input = output;
    output = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      const currentInside = plane.keepGreater ? current[plane.axis] >= plane.value : current[plane.axis] <= plane.value;
      const previousInside = plane.keepGreater ? previous[plane.axis] >= plane.value : previous[plane.axis] <= plane.value;
      if (currentInside !== previousInside) {
        const other = plane.axis === 0 ? 1 : 0;
        const delta = current[plane.axis] - previous[plane.axis];
        const ratio = delta === 0 ? 0 : (plane.value - previous[plane.axis]) / delta;
        const crossing = [0, 0];
        crossing[plane.axis] = plane.value;
        crossing[other] = previous[other] + (current[other] - previous[other]) * ratio;
        output.push(crossing);
      }
      if (currentInside) output.push(current);
    }
  }
  return output;
}

async function fetchLayer(layer) {
  const url = `${NE_BASE}/${layer.file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${layer.file} 下载失败：HTTP ${response.status}`);
  const data = await response.json();
  const chains = [];
  const isLand = LAND_KEYS.has(layer.key);
  for (const feature of data.features) {
    const rings = isLand ? exteriorRingsOf(feature.geometry) : ringsOf(feature.geometry);
    for (const ring of rings) {
      if (!ring.some(inBox)) continue;
      const pieces = isLand ? [clipPolygon(BBOX, ring)].filter((piece) => piece.length >= 3) : clipChain(ring);
      for (const piece of pieces) {
        const simplified = simplifyChain(piece, layer.toleranceKm);
        if (simplified.length < (isLand ? 3 : 2)) continue;
        if (!isLand && chainLengthKm(simplified) < layer.minChainKm) continue;
        chains.push(simplified.map(([lon, lat]) => [round3(lon), round3(lat)]));
      }
    }
  }
  if (!isLand) chains.sort((a, b) => chainLengthKm(b) - chainLengthKm(a));
  return chains;
}

const base = {
  source: "Natural Earth",
  license: "Public domain（公有领域，无需署名，可商用）",
  citation: "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com",
  version: NE_TAG,
  url: NE_BASE,
  bbox: BBOX,
  simplify_km: SIMPLIFY_KM,
  layers: {},
};

let totalPoints = 0;
for (const layer of LAYERS) {
  const chains = await fetchLayer(layer);
  const isLand = LAND_KEYS.has(layer.key);
  base.layers[layer.key] = {
    label: layer.label,
    kind: isLand ? "polygon" : "chain",
    file: layer.file,
    tolerance_km: layer.toleranceKm,
    holes_dropped: isLand,
    chains,
  };
  const points = chains.reduce((sum, chain) => sum + chain.length, 0);
  totalPoints += points;
  console.log(`  ${layer.key.padEnd(12)} 段=${String(chains.length).padStart(4)} 点=${String(points).padStart(6)}  ${layer.label}`);
}

base.point_count = totalPoints;
const payload =
  "/* 本文件由 ocean-front-prototype/tools/build-basemap.mjs 生成，请勿手工修改。\n" +
  `   数据源：Natural Earth 1:10m（公有领域）@ ${NE_TAG}，已裁剪到 ${BBOX.join(", ")} 并抽稀。*/\n` +
  "window.OF_DATA_BASE = " + JSON.stringify(base) + ";\n";
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, payload, "utf8");
console.log(`  → ${OUT}  ${(Buffer.byteLength(payload, "utf8") / 1024).toFixed(1)} KB`);
