/* 数据完整性校验：确认 data/ 下生成的文件结构正确、数值自洽、没有编造字段
 *
 * 用法：node tools/data-check.mjs
 *
 * 这些断言的意义：原型里所有数字都必须能追溯到 data/ 文件，
 * 所以这里既查结构（字段/取值），也查自洽（RLE 还原出的像元数必须等于 quality 里的统计）。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const results = [];
const check = (label, cond, detail) => results.push(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  → " + detail : ""}`);
const readJs = (rel) => {
  const text = readFileSync(join(DATA, rel), "utf8");
  return { text, run: () => { const win = {}; new Function("window", text)(win); return win; } };
};
const decoded = (runs) => runs.reduce((sum, r) => sum + r[2], 0);
const inBox = ([lon, lat], b) => lon >= b[0] - 0.01 && lon <= b[2] + 0.01 && lat >= b[1] - 0.01 && lat <= b[3] + 0.01;

// ===== meta =====
const metaFile = readJs("meta.js");
const META = metaFile.run().OF_DATA_META;
check("meta.js 存在且能解析", !!META);
const BBOX = META.region.bbox;
check("锋面产品与许可写明（Zenodo 20356239 · CC BY 4.0）",
  META.product.doi === "10.5281/zenodo.20356239" && META.product.license === "CC BY 4.0",
  META.product.doi + " / " + META.product.license);
check("已接入的图层标成 real（锋面 + 海温），没接入的标成 not_available",
  ["front_line", "cold_side", "warm_side", "front_objects", "sst"].every((k) => META.status[k] === "real") &&
  ["intensity", "forecast", "sea_state", "fishing_grounds"].every((k) => META.status[k] === "not_available"),
  JSON.stringify(META.status));
check("窗口 / 锚点 / 找鱼范围写清楚",
  BBOX.length === 4 && META.region.anchor.length === 2 && META.region.ranges_km.join(",") === "10,20,30",
  JSON.stringify({ bbox: BBOX, anchor: META.region.anchor }));

// ===== 单日图层 =====
const dayFiles = readdirSync(join(DATA, "day")).filter((f) => f.endsWith(".js")).sort();
check("可用日期与 meta 声明一致",
  dayFiles.map((f) => f.replace(".js", "")).join(",") === META.availability.days.slice().sort().join(","),
  META.availability.days.join(" / "));

const CODETAGS = new Set([-10, 10, 30]);
for (const file of dayFiles) {
  const iso = file.replace(".js", "");
  const day = readJs(join("day", file)).run().OF_DATA_DAYS[iso];
  const tag = iso + ": ";
  check(tag + "文件名与内部日期一致", !!day && day.date === iso, day ? day.date : "缺失");
  check(tag + "来源文件名正确（日期以文件名为准）",
    /^front_location\d{8}\.nc$/.test(day.source_file) && day.source_file.slice(14, 22) === iso.replace(/-/g, ""),
    day.source_file);
  const g = day.grid;
  check(tag + "网格 0.05° 且落在导出窗口内",
    g.dlon === 0.05 && g.dlat === 0.05 && g.nx === 160 && g.ny === 140 &&
    g.lon0 >= BBOX[0] && g.lon0 + (g.nx - 1) * g.dlon <= BBOX[2] &&
    g.lat0 >= BBOX[1] && g.lat0 + (g.ny - 1) * g.dlat <= BBOX[3], JSON.stringify(g));

  const ids = day.objects.map((o) => o.front_id);
  check(tag + "锋面对象有编号且唯一", ids.length > 0 && ids.every((id) => /^F\d{3}$/.test(id)) &&
    new Set(ids).size === ids.length, ids.join(","));
  check(tag + "对象按长度从大到小排（编号稳定）",
    day.objects.every((o, i) => i === 0 || day.objects[i - 1].length_km >= o.length_km), "n=" + ids.length);

  const badLine = day.objects.filter((o) => o.line.length < 2 || !o.line.every((p) => inBox(p, BBOX)));
  check(tag + "对象中心线至少 2 点且都在窗口内", badLine.length === 0,
    badLine.length ? badLine[0].front_id : "全部通过");
  const badNumbers = day.objects.filter((o) => !(o.length_km > 0) || !(o.pixel_count > 0) ||
    !o.codes.every((c) => CODETAGS.has(c)));
  check(tag + "对象长度 / 像元数为正，编码只出现 -10/10/30", badNumbers.length === 0,
    badNumbers.length ? JSON.stringify(badNumbers[0]) : "全部通过");
  check(tag + "线段数 = 对象线 + 短段线",
    day.front_line.length === day.object_line_count + day.short_line_count,
    day.front_line.length + " = " + day.object_line_count + " + " + day.short_line_count);

  const rleKeys = [["nodata_rle", "nodata_cells"], ["cold_side_rle", "cold_side_cells"],
    ["warm_side_rle", "warm_side_cells"], ["front_band_rle", "front_line_cells"]];
  let rleBad = null;
  rleKeys.forEach(([key, stat]) => {
    const runs = day[key];
    if (!runs || runs.some((r) => r[0] < 0 || r[0] >= g.ny || r[1] < 0 || r[1] + r[2] > g.nx || r[2] < 1)) {
      rleBad = key + " 结构非法";
    } else if (decoded(runs) !== day.quality[stat]) {
      rleBad = key + " 还原 " + decoded(runs) + " ≠ quality." + stat + " " + day.quality[stat];
    }
  });
  check(tag + "RLE 结构合法且还原像元数与统计一致", rleBad === null, rleBad || "4 组全部一致");
  check(tag + "有效像元 + 缺测像元 = 总像元",
    day.quality.valid_cells + day.quality.nodata_cells === g.nx * g.ny,
    day.quality.valid_cells + " + " + day.quality.nodata_cells + " = " + g.nx * g.ny);
  const mixSum = Object.values(day.quality.line_code_mix).reduce((a, b) => a + b, 0);
  check(tag + "三种线码像元合计 = 锋面线像元", mixSum === day.quality.front_line_cells,
    mixSum + " vs " + day.quality.front_line_cells);
  const objPixels = day.objects.reduce((sum, o) => sum + o.pixel_count, 0);
  check(tag + "对象像元数不超过锋面线像元总数", objPixels <= day.quality.front_line_cells,
    objPixels + " ≤ " + day.quality.front_line_cells);
  check(tag + "锋面文件里没有 SST / 强度，不冒充（has_sst / has_intensity = false；海温在 sst/ 里单独存）",
    day.has_sst === false && day.has_intensity === false, "sst=" + day.has_sst + " intensity=" + day.has_intensity);
  const kb = statSync(join(DATA, "day", file)).size / 1024;
  check(tag + "单日文件体积可控（< 300 KB）", kb < 300, kb.toFixed(1) + " KB");
}

// ===== 海表温度（NOAA GHRSST，0.5 °C 分档游程） =====
const sstDir = join(DATA, "sst");
const sstFiles = existsSync(sstDir) ? readdirSync(sstDir).filter((f) => f.endsWith(".js")).sort() : [];
const sstDeclared = (META.availability.sst && META.availability.sst.days) || [];
check("海温文件与 meta 声明一致（天数与日期都对得上）",
  sstFiles.map((f) => f.replace(".js", "")).join(",") === sstDeclared.slice().sort().join(","),
  sstFiles.length + " 天 / 声明 " + sstDeclared.length + " 天");
check("海温产品与许可写明（NOAA GHRSST，免账号、可离线留存）",
  /GHRSST/.test(META.availability.sst.product.citation) &&
  /free and open/.test(META.availability.sst.product.license) &&
  /不同源/.test(META.availability.sst.product.note),
  META.availability.sst.product.name_zh);

let sstBad = null;
for (const file of sstFiles) {
  const iso = file.replace(".js", "");
  const payload = readJs(join("sst", file)).run().OF_DATA_SST[iso];
  const tag = "SST " + iso + ": ";
  if (!payload || payload.date !== iso) { sstBad = tag + "日期不符"; break; }
  if (payload.bin_c !== 0.5) { sstBad = tag + "分档不是 0.5 °C"; break; }
  const g = payload.grid;
  if (g.dlon !== 0.05 || g.dlat !== 0.05) { sstBad = tag + "网格不是 0.05°"; break; }
  if (!inBox([g.lon0, g.lat0], BBOX) || g.nx < 150 || g.ny < 130) { sstBad = tag + "网格不在导出窗口内"; break; }
  const cells = decoded(payload.runs);
  if (cells !== payload.stats.valid_cells) {
    sstBad = tag + "RLE 还原 " + cells + " ≠ 统计 " + payload.stats.valid_cells; break;
  }
  if (payload.runs.some((r) => r[3] * payload.bin_c < 0 || r[3] * payload.bin_c > 40)) {
    sstBad = tag + "有越界的温度档位"; break;
  }
  if (payload.runs.some((r) => r[0] < 0 || r[0] >= g.ny || r[1] < 0 || r[1] + r[2] > g.nx)) {
    sstBad = tag + "有游程越出网格"; break;
  }
  if ([payload.stats.vmin_c, payload.stats.vmax_c, payload.stats.mean_c]
    .some((v) => typeof v !== "number" || Number.isNaN(v))) { sstBad = tag + "统计值有 NaN"; break; }
  const kb = statSync(join(DATA, "sst", file)).size / 1024;
  if (kb > 200) { sstBad = tag + "体积过大 " + kb.toFixed(1) + " KB"; break; }
}
check("海温文件自洽（RLE 还原 = 统计值、档位与网格合法、无 NaN）", sstBad === null, sstBad || sstFiles.length + " 天全部通过");

if (sstFiles.includes("2024-08-05.js")) {
  const probe = readJs(join("sst", "2024-08-05.js")).run().OF_DATA_SST["2024-08-05"];
  const g = probe.grid;
  const col = Math.round((124.525 - g.lon0) / g.dlon);
  const row = Math.round((30.025 - g.lat0) / g.dlat);
  const hit = (probe.runs || []).find((r) => r[0] === row && col >= r[1] && col < r[1] + r[2]);
  check("海温与数据源单点值对得上（NOAA ERDDAP 2024-08-05 @ 124.525°E/30.025°N = 30.69 °C）",
    !!hit && Math.abs(hit[3] * probe.bin_c - 30.69) <= 0.26,
    hit ? hit[3] * probe.bin_c + " °C（档位 " + hit[3] + "）" : "该格没有海温");
}

// ===== 数据清单（页面按 days.js 注入 <script>，不再手写日期标签） =====
const INDEX = readJs("days.js").run().OF_DATA_INDEX;
check("days.js 清单与目录一致（加日期不用改 HTML）",
  INDEX.days.join(",") === dayFiles.map((f) => f.replace(".js", "")).join(",") &&
  (INDEX.sst || []).join(",") === sstFiles.map((f) => f.replace(".js", "")).join(","),
  INDEX.days.length + " 天 / 海温 " + (INDEX.sst || []).length + " 天");

// ===== 底图 =====
const baseWin = readJs(join("base", "basemap.js")).run();
const BASE = baseWin.OF_DATA_BASE;
check("底图层齐备（陆地 / 海岸线 / 200 m / 1000 m 等深线）",
  ["land", "coastline", "isobath200", "isobath1000"].every((k) => BASE.layers[k] && BASE.layers[k].chains.length > 0),
  Object.keys(BASE.layers).map((k) => k + ":" + BASE.layers[k].chains.length).join(" "));
const outOfBox = ["land", "coastline", "isobath200", "isobath1000"].flatMap((k) =>
  BASE.layers[k].chains.flat().filter((p) => !inBox(p, BASE.bbox)));
check("底图坐标都在裁剪窗口内", outOfBox.length === 0, outOfBox.length ? "越界 " + outOfBox.length + " 点" : "全部通过");
check("底图写明公有领域来源", /public domain|公有领域/i.test(BASE.license) && /Natural Earth/.test(BASE.source),
  BASE.source + " / " + BASE.license);
const baseKb = statSync(join(DATA, "base", "basemap.js")).size / 1024;
check("底图体积可控（< 400 KB）", baseKb < 400, baseKb.toFixed(1) + " KB");

// ===== 往年同期 =====
const climFile = readJs(join("clim", "same-period.js"));
const CLIM = climFile.run().OF_DATA_CLIM;
check("clim 文件存在且能解析", !!CLIM);
check("往年同期写明唯一口径（front_present = 线像元 > 0）",
  /front_present/.test(CLIM.method) && /probability/.test(CLIM.method), CLIM.method);
check("clim 抽样口径里写清实际取样天数", /实际取样 \d+ 天/.test(CLIM.sample_note), CLIM.sample_note);
const climDays = Object.keys(CLIM.by_day);
check("clim 只统计 8 月 5—7 日这几天", climDays.every((md) => ["08-05", "08-06", "08-07"].includes(md)), climDays.join(","));
check("clim 覆盖 5 个以上年份", Object.keys(CLIM.by_year).length >= 5, Object.keys(CLIM.by_year).join(","));
let climBad = null;
Object.entries(CLIM.by_day).forEach(([md, entry]) => {
  ["10", "20", "30"].forEach((key) => {
    const bucket = entry.by_range[key];
    if (!bucket) { climBad = md + " 缺 " + key + " km"; return; }
    if (bucket.present_days > bucket.days) climBad = md + " " + key + " present_days > days";
    if (bucket.probability !== null && (bucket.probability < 0 || bucket.probability > 1)) climBad = md + " " + key + " 概率越界";
  });
});
check("clim 聚合层每天每个找鱼范围都有结果，概率在 0~1 之间", climBad === null, climBad || "全部通过");
let rowBad = null;
CLIM.rows.forEach((row) => {
  ["10", "20", "30"].forEach((key) => {
    const b = row.by_range[key];
    if (!b) { rowBad = row.date + " 缺 " + key; return; }
    if (!["ok", "no_observation"].includes(b.status)) rowBad = row.date + " " + key + " status=" + b.status;
    if (b.line_cells < 0 || b.valid_cells < 0) rowBad = row.date + " " + key + " 负数";
    if (b.front_present && b.line_cells <= 0) rowBad = row.date + " " + key + " 判有锋面却没有线像元";
    if (!b.front_present && b.line_cells > 0) rowBad = row.date + " " + key + " 有线像元却判无锋面";
    if (b.status === "no_observation" && b.valid_cells !== 0) rowBad = row.date + " " + key + " 无观测却报了有效像元";
  });
});
check("clim 逐日明细：front_present 与线像元数一致，无观测的不报有效像元", rowBad === null, rowBad || "全部通过");
check("生成文件里没有 NaN / Infinity 之类的脏值",
  !/NaN|Infinity/.test(climFile.text) && !/NaN|Infinity/.test(metaFile.text) &&
  dayFiles.every((f) => !/NaN|Infinity/.test(readJs(join("day", f)).text)), "已扫描全部生成文件");

// ===== 汇总 =====
// 数据天数多起来之后（60+ 天 × 每天 14 项）逐条打印会淹掉结果，
// 默认只打失败项；需要看全部用 VERBOSE=1
const verbose = process.env.VERBOSE === "1";
const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(verbose ? results.join("\n") : (failed.length ? failed.join("\n") : "全部通过"));
console.log("\nFAIL 总数 = " + failed.length + " / " + results.length);
process.exit(failed.length ? 1 : 0);
