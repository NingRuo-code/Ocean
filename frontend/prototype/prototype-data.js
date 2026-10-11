/* 数据适配层：页面唯一的数据入口
 *
 * 上游文件（都由脚本生成，不要手改）：
 *   data/meta.js               数据产品、许可、可用日期、缺什么        ← export_prototype_data.py
 *   data/day/<日期>.js          真实锋面：对象中心线 / 锋面线 / 冷暖侧 RLE ← export_prototype_data.py
 *   data/clim/same-period.js   往年同期统计（唯一口径）               ← export_prototype_data.py --mode clim
 *   data/front_response/events.js  锋面事件与 AIS 表观捕捞响应表       ← 后续 GFW/AIS 样例闭环生成
 *   data/base/basemap.js       陆地 / 海岸线 / 等深线（公有领域）      ← tools/build-basemap.mjs
 *
 * 原则：没有真实数据的地方一律返回 null / 空数组，由界面显式说明「待接入」；
 *       任何情况下都不用插值、哈希或示例值冒充实测数据。
 */
(function () {
  "use strict";

  const META = window.OF_DATA_META || null;
  const DAYS = window.OF_DATA_DAYS || {};
  const CLIM = window.OF_DATA_CLIM || null;
  const BASE = window.OF_DATA_BASE || null;
  const SST = window.OF_DATA_SST || {};
  const FRONT_RESPONSE = window.OF_FRONT_RESPONSE || null;
  const SORTED_DATES = Object.keys(DAYS).sort();
  const SST_DATES = Object.keys(SST).sort();

  const BAND_KIND = { front: "front_band_rle", coldwarm: "cold_side_rle", cold: "cold_side_rle", warm: "warm_side_rle" };

  function toObject(raw) {
    return {
      id: raw.front_id,
      points: raw.line,          // [[lon, lat], ...] 真实中心线
      lengthKm: raw.length_km,
      pixelCount: raw.pixel_count,
      codes: raw.codes,          // 数据里出现的锋面线编码，原样保留
      centroid: raw.centroid,
      bbox: raw.bbox,
    };
  }

  function frontResponseStatusReady() {
    return !!(FRONT_RESPONSE && ["real", "synthetic_fixture"].indexOf(FRONT_RESPONSE.status) >= 0);
  }

  function serverManifestState() {
    const state = window.OF_SERVER_MANIFEST_STATE || {};
    return {
      mode: state.mode || "local_static",
      status: state.status || "not_configured",
      url: state.url || null,
      version: state.version || null,
      generatedAt: state.generated_at || null,
      latestAvailableDate: state.latest_available_date || null,
      error: state.error || null,
      message: state.message || "",
    };
  }

  function serverManifest() {
    return window.OF_SERVER_MANIFEST || null;
  }

  function normalizeFrontResponse(raw, iso, rangeKm) {
    if (!raw) return null;
    const base = {
      status: raw.status || "available",
      responseId: raw.response_id || null,
      frontEventId: raw.front_event_id || null,
      date: raw.date || iso || null,
      frontId: raw.front_id || null,
      frontIdScope: raw.front_id_scope || "local_day",
      bufferKm: raw.buffer_km == null ? rangeKm || null : raw.buffer_km,
      preWindow: raw.pre_window || null,
      postWindow: raw.post_window || null,
      exploratoryWindow: raw.exploratory_window || null,
      control: raw.control || null,
      coverageStatus: raw.coverage_status || raw.status || "available",
      reason: raw.reason || raw.status || "",
      evidenceLabel: raw.evidence_label || (raw.enhanced_flag ? "响应增强" : "未见明确增强"),
      isSynthetic: !!(FRONT_RESPONSE && FRONT_RESPONSE.is_synthetic),
      note: raw.note || "",
      raw: raw,
    };
    if (raw.status && raw.status !== "available") {
      return {
        ...base,
        available: false,
      };
    }
    return {
      ...base,
      available: true,
      pre7Hours: raw.pre7_hours,
      post13Hours: raw.post1_3_hours,
      controlHours: raw.non_front_control_hours,
      liftPercent: raw.lift_percent,
      enhanced: raw.enhanced_flag === true,
    };
  }

  const OFData = {
    meta: META,
    basemap: BASE,
    clim: CLIM,

    // ---- 日期与可用性 ----
    availableDates: function () { return SORTED_DATES.slice(); },
    firstDate: function () { return SORTED_DATES[0] || null; },
    lastDate: function () { return SORTED_DATES[SORTED_DATES.length - 1] || null; },
    hasDay: function (iso) { return Object.prototype.hasOwnProperty.call(DAYS, iso); },
    day: function (iso) { return DAYS[iso] || null; },

    // 页面用它决定「有数据 / 没数据」，没数据必须给原因，不给结论
    dateInfo: function (iso) {
      if (!META) {
        return { ok: false, title: "没有数据文件", desc: "data/ 目录里没有生成好的数据，先跑导出脚本（见 README）" };
      }
      if (!SORTED_DATES.length) {
        return { ok: false, title: "没有导出的日期", desc: "data/day/ 下没有文件，先跑 export_prototype_data.py" };
      }
      if (!DAYS[iso]) {
        return {
          ok: false,
          title: "这天没有数据",
          desc: "演示数据只导出了 " + SORTED_DATES[0] + " ~ " + SORTED_DATES[SORTED_DATES.length - 1] +
            "，共 " + SORTED_DATES.length + " 天；数据集本身是逐日的，缺的日期可以按需补导",
        };
      }
      return { ok: true, title: "", desc: "" };
    },

    // ---- 单日真实图层 ----
    grid: function (iso) { return DAYS[iso] ? DAYS[iso].grid : null; },
    sourceFile: function (iso) { return DAYS[iso] ? DAYS[iso].source_file : null; },
    objects: function (iso) { return DAYS[iso] ? DAYS[iso].objects.map(toObject) : []; },
    objectById: function (iso, id) {
      const found = DAYS[iso] ? DAYS[iso].objects.find(function (item) { return item.front_id === id; }) : null;
      return found ? toObject(found) : null;
    },
    // 所有锋面线段（含太短、没进对象列表的），都来自同一天的真实数据
    frontLines: function (iso) { return DAYS[iso] ? DAYS[iso].front_line.slice() : []; },
    objectLineCount: function (iso) { return DAYS[iso] ? DAYS[iso].object_line_count : 0; },
    // 冷暖侧 / 锋面带 / 缺测：逐行 RLE [row, start, count(, code)]，渲染时按 grid 还原成矩形
    bandRuns: function (iso, kind) {
      if (!DAYS[iso]) return [];
      const key = BAND_KIND[kind];
      return key && DAYS[iso][key] ? DAYS[iso][key] : [];
    },
    quality: function (iso) { return DAYS[iso] ? DAYS[iso].quality : null; },

    // 某个经纬度落在哪一种像元里（真实掩码，原样返回，不做任何推测）
    cellInfo: function (iso, lon, lat) {
      const day = DAYS[iso];
      if (!day) return null;
      const grid = day.grid;
      const col = Math.round((lon - grid.lon0) / grid.dlon);
      const row = Math.round((lat - grid.lat0) / grid.dlat);
      if (col < 0 || col >= grid.nx || row < 0 || row >= grid.ny) {
        return { inGrid: false, row: row, col: col, cellLon: null, cellLat: null,
          nodata: false, line: false, code: null, side: null };
      }
      const hit = function (runs) {
        for (let i = 0; i < runs.length; i++) {
          const run = runs[i];
          if (run[0] === row && col >= run[1] && col < run[1] + run[2]) return run;
        }
        return null;
      };
      const band = hit(day.front_band_rle || []);
      const nodata = hit(day.nodata_rle || []);
      const cold = hit(day.cold_side_rle || []);
      const warm = hit(day.warm_side_rle || []);
      return {
        inGrid: true,
        row: row,
        col: col,
        cellLon: Math.round((grid.lon0 + col * grid.dlon) * 1000) / 1000,
        cellLat: Math.round((grid.lat0 + row * grid.dlat) * 1000) / 1000,
        nodata: !!nodata,
        line: !!band,
        code: band && band.length > 3 ? band[3] : null,
        cold: !!cold,
        warm: !!warm,
        side: cold ? "冷侧" : warm ? "暖侧" : null,
      };
    },

    // ---- 海表温度（NOAA GHRSST，0.5 °C 分箱游程；没有导出的日期返回 null） ----
    sstDates: function () { return SST_DATES.slice(); },
    hasSst: function (iso) { return Object.prototype.hasOwnProperty.call(SST, iso); },
    sst: function (iso) { return SST[iso] || null; },
    sstStats: function (iso) { return SST[iso] ? SST[iso].stats : null; },
    sstBinC: function () {
      return (META && META.availability && META.availability.sst && META.availability.sst.bin_c) || 0.5;
    },
    // 某个经纬度落在哪一档海温：直接在真实游程里查，不做插值
    sstCell: function (iso, lon, lat) {
      const day = SST[iso];
      if (!day) return null;
      const g = day.grid;
      const col = Math.round((lon - g.lon0) / g.dlon);
      const row = Math.round((lat - g.lat0) / g.dlat);
      if (col < 0 || col >= g.nx || row < 0 || row >= g.ny) return { inGrid: false, valueC: null, bin: null };
      const runs = day.runs || [];
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        if (run[0] === row && col >= run[1] && col < run[1] + run[2]) {
          return { inGrid: true, valueC: Math.round(run[3] * day.bin_c * 10) / 10, bin: run[3] };
        }
      }
      return { inGrid: true, valueC: null, bin: null };  // 这一格没有有效海温
    },

    // ---- 明确「还没有」的东西：一律返回 false，让界面说清楚 ----
    sstAvailable: function () { return !!(META && META.status && META.status.sst === "real"); },
    intensityAvailable: function () { return !!(META && META.status && META.status.intensity === "real"); },
    forecastAvailable: function () { return !!(META && META.status && META.status.forecast === "real"); },
    seaStateAvailable: function () { return !!(META && META.status && META.status.sea_state === "real"); },
    fishingAvailable: function () { return !!(META && META.status && META.status.fishing_grounds === "real"); },
    frontResponseAvailable: function () {
      return !!(frontResponseStatusReady() && (FRONT_RESPONSE.by_date || FRONT_RESPONSE.events));
    },
    frontResponse: function (iso, rangeKm) {
      if (!frontResponseStatusReady()) return null;
      const day = FRONT_RESPONSE.by_date && FRONT_RESPONSE.by_date[iso];
      if (!day) {
        return normalizeFrontResponse({ status: "not_in_sample", reason: "missing_date" }, iso, rangeKm);
      }
      if (rangeKm != null && day.by_range && day.by_range[String(rangeKm)]) {
        return normalizeFrontResponse(day.by_range[String(rangeKm)], iso, rangeKm);
      }
      if (rangeKm != null) {
        return normalizeFrontResponse({ status: "not_in_sample", reason: "missing_range" }, iso, rangeKm);
      }
      return normalizeFrontResponse(day, iso, rangeKm);
    },
    frontResponseMeta: function () {
      return FRONT_RESPONSE ? {
        schemaVersion: FRONT_RESPONSE.schema_version || null,
        status: FRONT_RESPONSE.status || "not_available",
        source: FRONT_RESPONSE.source || null,
        metric: FRONT_RESPONSE.metric || "apparent_fishing_effort",
        unit: FRONT_RESPONSE.unit || "fishing_hours",
        timeWindow: FRONT_RESPONSE.time_window || null,
        spatialWindow: FRONT_RESPONSE.spatial_window || null,
        method: FRONT_RESPONSE.method || null,
        publicBoundary: FRONT_RESPONSE.public_boundary || null,
        isSynthetic: !!FRONT_RESPONSE.is_synthetic,
        note: FRONT_RESPONSE.note || "",
        generatedAt: FRONT_RESPONSE.generated_at || null,
      } : null;
    },
    serverManifestState: serverManifestState,
    serverManifest: serverManifest,
    serverLayerStatus: function (layerName) {
      const manifest = serverManifest();
      return manifest && manifest.layers ? (manifest.layers[layerName] || null) : null;
    },
    climReady: function () { return !!(META && META.availability && META.availability.clim && META.availability.clim.ready && CLIM); },

    // ---- 「依据」页要用的出处信息 ----
    attribution: function () {
      if (!META) return null;
      return {
        name: META.product.name,
        nameZh: META.product.name_zh,
        version: META.product.version,
        doi: META.product.doi,
        url: META.product.url,
        license: META.product.license,
        citation: META.product.citation,
        resolutionDeg: META.product.resolution_deg,
        region: META.region,
        grid: META.grid,
        days: META.availability.days,
        sst: META.availability.sst || null,
        clim: META.availability.clim,
        basemap: META.availability.basemap,
        status: META.status,
        generatedAt: META.generated_at,
        knownIssues: META.known_issues || [],
      };
    },
  };

  window.OFData = OFData;
})();
