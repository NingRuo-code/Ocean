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
  const LOCAL_DAYS = { ...DAYS }, LOCAL_SST = { ...SST };
  let requestContext = "initial", requestEpoch = 0, modeGeneration = 0, dataVersion = null;
  const activeRequests = new Set(), loadStates = {};
  function publishLoad(layer, status) {
    loadStates[layer] = { status, epoch: requestEpoch, context: requestContext };
    window.dispatchEvent(new CustomEvent("ocean-load-state"));
  }
  function setRequestContext(context) {
    const key = JSON.stringify(context);
    if (key === requestContext) return requestEpoch;
    requestContext = key; requestEpoch++;
    for (const controller of activeRequests) controller.abort();
    activeRequests.clear();
    Object.keys(loadStates).forEach(key => delete loadStates[key]);
    window.dispatchEvent(new CustomEvent("ocean-load-state"));
    return requestEpoch;
  }
  function loadState() { return JSON.parse(JSON.stringify(loadStates)); }
  function resetServerData() {
    modeGeneration++;
    setRequestContext(["mode-change", requestEpoch]);
    Object.keys(DAYS).forEach(key => delete DAYS[key]); Object.assign(DAYS, LOCAL_DAYS);
    Object.keys(SST).forEach(key => delete SST[key]); Object.assign(SST, LOCAL_SST);
    Object.keys(PATCHES).forEach(key => delete PATCHES[key]);
    FISHING.days = {}; FISHING.inflight = {};
    SERVER.inflight = {}; VIEW_WINDOW.inflight = {};
  }
  async function requestJson(url, layer, epoch) {
    if (epoch !== requestEpoch) throw new Error("obsolete");
    publishLoad(layer, "loading");
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController(); activeRequests.add(controller);
      const timer = setTimeout(() => controller.abort(), 8000);
      let transient = false;
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (epoch !== requestEpoch) throw new Error("obsolete");
        if (!response.ok) {
          transient = response.status === 408 || response.status === 429 || response.status >= 500;
          const error = new Error("request_failed");
          error.loadStatus = response.status === 401 || response.status === 403 ? "forbidden" : response.status === 404 ? "day-missing" : response.status === 409 ? "unprepared" : "error";
          throw error;
        }
        const payload = await response.json();
        if (epoch !== requestEpoch) throw new Error("obsolete");
        return payload;
      } catch (error) {
        if (epoch !== requestEpoch) throw new Error("obsolete");
        transient = transient || error.name === "TypeError" || error.name === "AbortError";
        if (transient && attempt === 0) continue;
        publishLoad(layer, error.loadStatus || "error");
        throw error;
      } finally { clearTimeout(timer); activeRequests.delete(controller); }
    }
  }

  // ---- 服务器增强模式（可选）----
  // 后端 /api/frontend/day/<date> 会按需产出与离线 data/day|sst/<date>.js 完全一致的结构，
  // 这里把它注入 DAYS/SST 缓存，下游渲染函数无需任何改动即可绘制服务器上的全量日期。
  // 重要：file:// 打开或未配置 API 时本模式整体关闭，离线行为与断言保持原样。
  const SERVER = {
    base: null,
    enabled: false,
    available: false,
    checking: false,
    userMode: "auto",
    status: "offline",
    reason: "",
    sortedDates: [],
    dateSet: {},
    inflight: {},
    healthInflight: null,
  };

  function serverBase() {
    if (typeof location !== "undefined" && location.search) {
      const params = new URLSearchParams(location.search);
      const fromQuery = params.get("api");
      if (fromQuery) return fromQuery.replace(/\/+$/, "");
    }
    if (typeof window.OF_API_BASE === "string" && window.OF_API_BASE) {
      return window.OF_API_BASE.replace(/\/+$/, "");
    }
    // 同源部署（nginx 已把 /api 反代到后端）时用相对路径；file:// 下没有同源 API
    if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) return "/api";
    return null;
  }

  function mergedDates() {
    if (!SERVER.enabled || !SERVER.sortedDates.length) return SORTED_DATES;
    const merged = SORTED_DATES.slice().concat(SERVER.sortedDates).sort();
    return merged.filter(function (iso, index) { return index === 0 || merged[index - 1] !== iso; });
  }

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

  // ---- 服务器增强模式：探测 / 按需加载（不改变离线行为）----

  function setServerOffline(reason) {
    SERVER.enabled = false;
    SERVER.available = false;
    SERVER.checking = false;
    SERVER.status = "offline";
    SERVER.reason = reason || "";
    SERVER.healthInflight = null;
    if (typeof VIEW_WINDOW !== "undefined") {
      VIEW_WINDOW.inflight = {};

    }
  }

  /** 探测 /api/health；任何失败都退回离线模式，但把原因留给界面显示。 */
  function initServerMode(options) {
    const force = !!(options && options.force);
    const base = serverBase();
    if (!base) {
      setServerOffline("未配置 API 地址");
      SERVER.base = null;
      return Promise.resolve(false);
    }
    if (SERVER.userMode === "offline" && !force) {
      SERVER.base = base;
      SERVER.enabled = false;
      SERVER.available = false;
      SERVER.status = "manual_offline";
      SERVER.reason = "已手动切换到离线模式";
      return Promise.resolve(false);
    }
    if (SERVER.enabled && !force) return Promise.resolve(true);
    if (SERVER.healthInflight && !force) return SERVER.healthInflight;
    SERVER.base = base;
    SERVER.checking = true;
    SERVER.status = "checking";
    SERVER.reason = "";
    const healthGeneration = modeGeneration;
    const task = fetch(base + "/health", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("health HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        if (healthGeneration !== modeGeneration || SERVER.userMode === "offline") return false;
        if (!data || data.status !== "ok") throw new Error("health status " + (data && data.status ? data.status : "unknown"));
        const nextVersion = data.data_version ?? data.revision ?? data.version ?? null;
        if (dataVersion !== nextVersion) resetServerData();
        dataVersion = nextVersion;
        SERVER.available = true;
        SERVER.enabled = true;
        SERVER.checking = false;
        SERVER.status = "server";
        SERVER.reason = "";
        return true;
      })
      .catch(function (error) {
        if (healthGeneration !== modeGeneration) return false;
        setServerOffline(error && error.message ? error.message : "服务器不可用");
        return false;
      })
      .then(function (ok) { SERVER.healthInflight = null; return ok; });
    SERVER.healthInflight = task;
    return task;
  }

  function serverEnabled() { return SERVER.enabled === true; }

  /** 服务器是否可用于该日期；日期具体有没有数据由 viewport 结构化返回说明。 */
  function serverAvailable(iso) { return !!(SERVER.enabled && /^\d{4}-\d{2}-\d{2}$/.test(iso || "")); }

  function serverMode() {
    return {
      base: SERVER.base,
      enabled: SERVER.enabled === true,
      available: SERVER.available === true,
      checking: SERVER.checking === true,
      userMode: SERVER.userMode,
      status: SERVER.status,
      reason: SERVER.reason,
      dataVersion: dataVersion,
    };
  }

  function setServerMode(mode) {
    resetServerData();
    if (mode === "offline") {
      SERVER.userMode = "offline";
      SERVER.enabled = false;
      SERVER.status = "manual_offline";
      SERVER.reason = "已手动切换到离线模式";
      VIEW_WINDOW.inflight = {};

      return Promise.resolve(false);
    }
    SERVER.userMode = "auto";
    return initServerMode({ force: true });
  }

  /** 当前身份内共享单日请求；临时故障重试一次，其他失败由用户重试。 */
  function ensureDay(iso, force) {
    if (!force && Object.prototype.hasOwnProperty.call(DAYS, iso)) return Promise.resolve(true);
    if (!serverAvailable(iso)) return Promise.resolve(false);
    const epoch = requestEpoch, identity = epoch + ":" + iso;
    if (SERVER.inflight[identity]) return SERVER.inflight[identity];
    const url = SERVER.base + "/frontend/day/" + iso;
    const task = requestJson(url, "day", epoch)
      .then(function (payload) {
        if (epoch !== requestEpoch) return false;
        if (!payload?.front?.grid || (payload.front.date && payload.front.date !== iso)) throw new Error("invalid_front_payload");
        DAYS[iso] = payload.front;
        if (payload.sst) SST[iso] = payload.sst;
        if (payload.window) addPatch(iso, payload, true);   // 注册成「主片」（作业海域，永远是 0.05°）
        publishLoad("day", "ready");
        return true;
      })
      .catch(function () {
        if (epoch === requestEpoch && loadStates.day?.status === "loading") publishLoad("day", "error");
        return false;
      })
      .then(function (ok) { delete SERVER.inflight[identity]; return ok; });
    SERVER.inflight[identity] = task;
    return task;
  }

  // ---- 视野窗口片：服务器按「当前视野」出数（bbox + 降采样）----
  // 目的：球面 / 大洲尺度也能看到真实数据 —— 后端按窗口取原始全球网格，
  // 窗口很大时自动降采样成概览（front.overview 标明口径，概览不做对象识别）；
  // 放大到 40° 以内自动换 0.05° 明细。离线（file://）没有服务器，只有本地那一片，行为不变。
  const PATCHES = {};              // iso -> [patch]（patch = 一片数据 + 自己的 grid）
  const MAX_PATCHES_PER_DATE = 4;
  const VIEW_WINDOW = { key: null, bbox: null, step: 1, inflight: {} };

  /** 视野跨度 → 降采样档（与后端 STEPS 对齐：1=0.05°、4=0.2°、20=1°、40=2°）
   *  阈值按「屏幕上看什么」定：≤25° 仍给 0.05° 明细（25°×25° 约 25 万格，后端 ~0.5s、可缓存），
   *  再大才逐档降采样，避免球面/大洲尺度拖不动的粗格。 */
  function stepForWindow(spanDeg) {
    if (!(spanDeg > 0)) return 1;
    if (spanDeg <= 25) return 1;
    if (spanDeg <= 60) return 4;
    if (spanDeg <= 120) return 20;
    return 40;
  }

  function bboxKey(bbox, step) {
    return bbox.map(function (value) { return Math.round(value * 100) / 100; }).join(",") + "@" + step;
  }

  /** 可见范围 → 「5° 对齐 + 2° 余量」的窗口（拖一点就重新取数会很浪费） */
  function snapViewBbox(bounds) {
    if (!bounds) return { bbox: [-180, -90, 180, 90], step: 40 };     // 球面档：整颗地球（2° 概览）
    const margin = 2;
    const floor5 = function (value) { return Math.max(-180, Math.floor((value - margin) / 5) * 5); };
    const ceil5 = function (value) { return Math.min(180, Math.ceil((value + margin) / 5) * 5); };
    const floor5lat = function (value) { return Math.max(-90, Math.floor((value - margin) / 5) * 5); };
    const ceil5lat = function (value) { return Math.min(90, Math.ceil((value + margin) / 5) * 5); };
    let minLon = floor5(bounds.lonMin), maxLon = ceil5(bounds.lonMax);
    let minLat = floor5lat(bounds.latMin), maxLat = ceil5lat(bounds.latMax);
    if (maxLon - minLon < 5) { const mid = (maxLon + minLon) / 2; minLon = mid - 2.5; maxLon = mid + 2.5; }
    if (maxLat - minLat < 5) { const mid = (maxLat + minLat) / 2; minLat = mid - 2.5; maxLat = mid + 2.5; }
    minLon = Math.max(-180, minLon); maxLon = Math.min(180, maxLon);
    minLat = Math.max(-90, minLat); maxLat = Math.min(90, maxLat);
    // 档位按「可见跨度」定（窗口本身要 5° 吸附 + 2° 余量，比可见范围大一圈）
    const step = stepForWindow(bounds.lonMax - bounds.lonMin);
    return { bbox: [minLon, minLat, maxLon, maxLat], step: step };
  }

  /** 页面在视野变化后调用；返回 true 表示窗口变了（需要重新取数） */
  function setViewWindow(bounds) {
    const next = snapViewBbox(bounds);
    const key = bboxKey(next.bbox, next.step);
    const changed = key !== VIEW_WINDOW.key;
    VIEW_WINDOW.key = key;
    VIEW_WINDOW.bbox = next.bbox;
    VIEW_WINDOW.step = next.step;
    return changed;
  }

  function viewWindow() {
    return { key: VIEW_WINDOW.key, bbox: VIEW_WINDOW.bbox, step: VIEW_WINDOW.step };
  }

  function addPatch(iso, payload, isPrimary) {
    const window = payload.window || {};
    const bbox = Array.isArray(window.bbox) ? window.bbox.slice(0, 4) : null;
    if (!payload.front || !payload.front.grid || !bbox) return null;
    const entry = {
      key: bboxKey(bbox, Number(window.step) || 1),
      bbox: bbox,
      step: Number(window.step) || 1,
      resolutionDeg: Number(window.resolution_deg) || payload.front.grid.dlon || 0.05,
      mode: window.mode || "detail",
      overview: !!payload.front.overview,
      grid: payload.front.grid,
      front: payload.front,
      sst: payload.sst || null,
      sstCoarse: payload.sst_coarse || null,      // 全球粗格海温（1°）：垫在明细下面，别处也有海温
      primary: !!isPrimary,
    };
    const list = PATCHES[iso] || (PATCHES[iso] = []);
    const at = list.findIndex(function (item) { return item.key === entry.key; });
    if (at >= 0) list[at] = entry; else list.push(entry);
    while (list.length > MAX_PATCHES_PER_DATE) {
      const victim = list.findIndex(function (item) { return !item.primary; });
      if (victim < 0) break;
      list.splice(victim, 1);
    }
    return entry;
  }

  function viewportUrl(iso, bbox, step) {
    return SERVER.base + "/viewport?date=" + encodeURIComponent(iso) +
      "&bbox=" + encodeURIComponent(bbox.join(",")) +
      "&step=" + encodeURIComponent(step);
  }

  function lineBbox(points) {
    if (!Array.isArray(points) || !points.length) return [0, 0, 0, 0];
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    points.forEach(function (p) {
      if (!Array.isArray(p) || p.length < 2) return;
      minLon = Math.min(minLon, Number(p[0]));
      minLat = Math.min(minLat, Number(p[1]));
      maxLon = Math.max(maxLon, Number(p[0]));
      maxLat = Math.max(maxLat, Number(p[1]));
    });
    return [minLon, minLat, maxLon, maxLat].map(function (v) { return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0; });
  }

  function lineCentroid(points) {
    const valid = (points || []).filter(function (p) { return Array.isArray(p) && p.length >= 2; });
    if (!valid.length) return [0, 0];
    const sum = valid.reduce(function (acc, p) { acc[0] += Number(p[0]); acc[1] += Number(p[1]); return acc; }, [0, 0]);
    return [Math.round((sum[0] / valid.length) * 1000) / 1000, Math.round((sum[1] / valid.length) * 1000) / 1000];
  }

  function gridFromBbox(bbox, resolutionDeg) {
    const d = Number(resolutionDeg) || 0.05;
    return {
      lon0: bbox[0],
      lat0: bbox[1],
      dlon: d,
      dlat: d,
      nx: Math.max(1, Math.round((bbox[2] - bbox[0]) / d) + 1),
      ny: Math.max(1, Math.round((bbox[3] - bbox[1]) / d) + 1),
    };
  }

  function mergeRuns(runs) {
    const sorted = runs.slice().sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1] || (a[3] || 0) - (b[3] || 0);
    });
    const merged = [];
    sorted.forEach(function (run) {
      const last = merged[merged.length - 1];
      if (last && last[0] === run[0] && last[3] === run[3] && last[1] + last[2] === run[1]) {
        last[2] += run[2];
      } else {
        merged.push(run.slice());
      }
    });
    return merged;
  }

  function frontRunsFromObjects(objects, grid) {
    const seen = {};
    const runs = [];
    objects.forEach(function (front) {
      (front.line || []).forEach(function (p) {
        const col = Math.round((Number(p[0]) - grid.lon0) / grid.dlon);
        const row = Math.round((Number(p[1]) - grid.lat0) / grid.dlat);
        if (col < 0 || col >= grid.nx || row < 0 || row >= grid.ny) return;
        const key = row + ":" + col;
        if (seen[key]) return;
        seen[key] = true;
        runs.push([row, col, 1, 10]);
      });
    });
    return mergeRuns(runs);
  }

  function sstFromViewport(layer, bbox, resolutionDeg) {
    const cells = layer && Array.isArray(layer.cells) ? layer.cells : [];
    if (!cells.length) return null;
    const grid = gridFromBbox(bbox, resolutionDeg);
    const binC = 0.5;
    const runs = [];
    cells.forEach(function (cell) {
      const lon = Number(cell.lon);
      const lat = Number(cell.lat);
      const value = Number(cell.value);
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(value)) return;
      const col = Math.round((lon - grid.lon0) / grid.dlon);
      const row = Math.round((lat - grid.lat0) / grid.dlat);
      if (col < 0 || col >= grid.nx || row < 0 || row >= grid.ny) return;
      runs.push([row, col, 1, Math.round(value / binC)]);
    });
    return {
      grid: grid,
      bin_c: binC,
      runs: mergeRuns(runs),
      stats: layer.stats || {},
      product: { unit: "degree_C", bin_c: binC },
      source_file: "backend:/api/viewport",
    };
  }

  function rememberViewportFishing(iso, layer) {
    const cells = layer && Array.isArray(layer.cells) ? layer.cells : [];
    if (!cells.length) return;
    FISHING.days[iso] = {
      date: iso,
      cell_count: cells.length,
      cells: cells.map(function (cell) {
        return {
          lon: Number(cell.lon),
          lat: Number(cell.lat),
          hours: Number(cell.hours) || 0,
          vessel_count: Number(cell.vesselCount || cell.vessel_count) || 0,
          frontId: cell.frontId || null,
        };
      }),
      source: layer.source || null,
    };
  }

  function viewportPayloadToPatchPayload(iso, payload) {
    if (!payload || !payload.meta || !payload.layers) return null;
    const coverage = payload.coverage || {};
    const bbox = coverage.coveredBbox || coverage.bbox || payload.meta.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4 || payload.meta.status === "unavailable") return null;
    const step = Number(payload.meta.step) || 1;
    const baseRes = payload.meta.resolution && Number(payload.meta.resolution.spatial_deg) ? Number(payload.meta.resolution.spatial_deg) : 0.05;
    const resolutionDeg = Math.round(baseRes * step * 1000) / 1000;
    const grid = gridFromBbox(bbox, resolutionDeg);
    const features = (payload.layers.fronts && payload.layers.fronts.features) || [];
    const objects = features
      .filter(function (feature) { return feature && feature.geometry && feature.geometry.type === "LineString"; })
      .map(function (feature, index) {
        const props = feature.properties || {};
        const line = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [];
        return {
          front_id: String(props.frontId || props.front_id || ("V" + String(index + 1).padStart(3, "0"))),
          line: line,
          length_km: Number(props.lengthKm || props.length_km || 0),
          pixel_count: Number(props.pixelCount || props.pixel_count || line.length || 0),
          codes: Array.isArray(props.codes) ? props.codes : [],
          centroid: Array.isArray(props.centroid) ? props.centroid : lineCentroid(line),
          bbox: Array.isArray(props.bbox) ? props.bbox : lineBbox(line),
        };
      });
    const frontRuns = frontRunsFromObjects(objects, grid);
    rememberViewportFishing(iso, payload.layers.fishingEffort);
    return {
      window: {
        bbox: bbox,
        step: step,
        resolution_deg: resolutionDeg,
        mode: step > 1 ? "overview" : "detail",
      },
      front: {
        grid: grid,
        source_file: "backend:/api/viewport",
        objects: objects,
        object_line_count: objects.length,
        front_line: objects.map(function (item) { return item.line; }),
        front_band_rle: frontRuns,
        cold_side_rle: [],
        warm_side_rle: [],
        nodata_rle: [],
        overview: step > 1,
        quality: { coverage_status: coverage.status || payload.meta.status },
      },
      sst: sstFromViewport(payload.layers.sst, bbox, resolutionDeg),
      sst_coarse: null,
    };
  }

  /** 视野与预热共享当前身份内请求；失败不关闭其他可用图层。 */
  function fetchPatch(iso, key, url, kind) {
    const list = PATCHES[iso] || [];
    if (list.some(function (item) { return item.key === key; })) return Promise.resolve(true);
    const epoch = requestEpoch, identity = epoch + ":" + iso + ":" + key;
    if (VIEW_WINDOW.inflight[identity]) return VIEW_WINDOW.inflight[identity];
    const task = requestJson(url, "viewport", epoch)
      .then(function (payload) {
        if (epoch !== requestEpoch) return false;
        if (payload.meta?.date && payload.meta.date !== iso) throw new Error("response_date_mismatch");
        if (payload.meta?.status === "empty" || payload.meta?.status === "unavailable") {
          publishLoad("viewport", payload.meta.status === "empty" ? "unknown-coverage" : "unprepared");
          return false;
        }
        const adapted = kind === "viewport" ? viewportPayloadToPatchPayload(iso, payload) : payload;
        const ok = !!addPatch(iso, adapted, false);
        publishLoad("viewport", ok ? "ready" : "unknown-coverage");
        return ok;
      })
      .catch(function (error) {
        if (epoch === requestEpoch && !loadStates.viewport?.status?.match(/forbidden|day-missing|unprepared|error/)) publishLoad("viewport", "error");
        return false;
      })
      .then(function (ok) { delete VIEW_WINDOW.inflight[identity]; return ok; });
    VIEW_WINDOW.inflight[identity] = task;
    return task;
  }

  /** 该窗口（按 step 要求的分辨率）是否已经被现有片覆盖 —— 覆盖了就不必再打服务器。
   *  例：启动时默认视野窗口 110,20,135,40 完全落在主片 105,3,150,45（同为 0.05°）里。 */
  function coveredByPatch(iso, bbox, step) {
    const need = 0.05 * (Number(step) || 1) + 1e-9;
    return (PATCHES[iso] || []).some(function (item) {
      if (item.resolutionDeg > need) return false;
      const b = item.bbox || (item.grid ? [item.grid.lon0, item.grid.lat0,
        item.grid.lon0 + item.grid.dlon * item.grid.nx, item.grid.lat0 + item.grid.dlat * item.grid.ny] : null);
      return !!b && b[0] <= bbox[0] + 1e-6 && b[1] <= bbox[1] + 1e-6 &&
        b[2] >= bbox[2] - 1e-6 && b[3] >= bbox[3] - 1e-6;
    });
  }

  /** 取某天当前视野的窗口片 */
  function ensureViewport(iso) {
    if (!SERVER.enabled || !VIEW_WINDOW.bbox) return Promise.resolve(false);
    if (coveredByPatch(iso, VIEW_WINDOW.bbox, VIEW_WINDOW.step)) return Promise.resolve(true);
    return fetchPatch(iso, VIEW_WINDOW.key, viewportUrl(iso, VIEW_WINDOW.bbox, VIEW_WINDOW.step), "viewport");
  }

  /** 预热「整颗地球 2° 概览」：服务器模式下启动就把全球锋面拿一次，
   *  这样缩到球面立刻有数据（不必等 0.42s 防抖 + 首次 ~2s 现算；服务器侧也有缓存）。 */
  const GLOBAL_BBOX = [-180, -90, 180, 90];
  const OVERVIEW_STEP = 40;                       // 2°：全球 180×90，实测 89KB / 缓存命中 0.03s
  function prefetchOverview(iso) {
    if (!SERVER.enabled) return Promise.resolve(false);
    const key = bboxKey(GLOBAL_BBOX, OVERVIEW_STEP);
    return fetchPatch(iso, key, viewportUrl(iso, GLOBAL_BBOX, OVERVIEW_STEP), "viewport");
  }

  /** 渲染用：该日所有数据片，按「粗 → 细」排（概览先画，明细压在上面） */
  function patches(iso) {
    const list = SERVER.enabled ? (PATCHES[iso] || []).slice() : [];
    const local = DAYS[iso];
    if (local && !list.some(function (item) { return item.primary; })) {
      list.push({
        key: "local", bbox: null, step: 1,
        resolutionDeg: local.grid && local.grid.dlon ? local.grid.dlon : 0.05,
        mode: "detail", overview: false,
        grid: local.grid, front: local, sst: SST[iso] || null, sstCoarse: null, primary: true,
      });
    }
    return list.sort(function (a, b) {
      if (a.resolutionDeg !== b.resolutionDeg) return b.resolutionDeg - a.resolutionDeg;
      return (a.primary ? 1 : 0) - (b.primary ? 1 : 0);
    });
  }

  /** 作业海域（永远取「主片」：服务器模式下是按 bbox 取数时的默认窗口，离线时是本地那一片） */
  function workingWindow(iso) {
    const list = patches(iso);
    const primary = list.find(function (item) { return item.primary; });
    const pick = primary || list[list.length - 1];
    if (!pick || !pick.grid) return null;
    const g = pick.grid;
    return {
      bbox: [g.lon0, g.lat0, g.lon0 + g.dlon * g.nx, g.lat0 + g.dlat * g.ny],
      resolutionDeg: pick.resolutionDeg,
      source: primary ? "primary" : "finest",
    };
  }

  // 注意口径：这是基于 AIS 行为估计的「表观捕捞活动」（fishing hours），
  // 不是渔获量/产量/鱼群密度，界面必须照实标注（见 docs/data-governance-gfw-ais.md）。
  const FISHING = { days: {}, inflight: {} };

  function fishingAvailable() {
    return SERVER.enabled === true || !!(META && META.status && META.status.fishing_grounds === "real");
  }

  function fishingDay(iso) { return fishingAvailable() ? (FISHING.days[iso] || null) : null; }

  /** 按需取某天的渔场格点；未启用服务器、当日无数据（404）或取数失败时返回 false
   *  空记录只表示覆盖未知；临时故障自动重试一次，仍失败允许手动重试。 */
  function ensureFishing(iso) {
    if (FISHING.days[iso]) {
      const cells = FISHING.days[iso].cells;
      publishLoad("fishing", !cells?.length ? "unknown-coverage" : cells.every(c => c.hours === 0) ? "ready-zero-records" : "ready");
      return Promise.resolve(true);
    }
    if (!serverEnabled()) return Promise.resolve(false);
    const epoch = requestEpoch, identity = epoch + ":" + iso;
    if (FISHING.inflight[identity]) return FISHING.inflight[identity];
    const task = requestJson(SERVER.base + "/fishing/" + iso, "fishing", epoch)
      .then(function (data) {
        if (epoch !== requestEpoch) return false;
        if (data?.date && data.date !== iso) throw new Error("response_date_mismatch");
        FISHING.days[iso] = data && Array.isArray(data.cells) ? data : null;
        const cells = FISHING.days[iso]?.cells;
        publishLoad("fishing", !cells?.length ? "unknown-coverage" : cells.every(c => c.hours === 0) ? "ready-zero-records" : "ready");
        return !!FISHING.days[iso];
      })
      .catch(function () { if (epoch === requestEpoch && loadStates.fishing?.status === "loading") publishLoad("fishing", "error"); return false; })
      .then(function (ok) { delete FISHING.inflight[identity]; return ok; });
    FISHING.inflight[identity] = task;
    return task;
  }

  // ---- 锋面强度（本项目口径：跨锋面 SST 温差 / 梯度）----
  // 数据集自带的 frontal_intensity 变量尚未下载（43 个分年包约 90 GB，盘不够）；
  // 需求文档 §6.2 把「frontal_intensity 与局地温度梯度」并列为强度因素，
  // 因此这里用「跨锋面温差」作为强度口径，并在界面上始终写明口径，不冒充数据集原变量。
  const KM_PER_DEG_LAT = 111.195;

  function kmPerDegLonAt(lat) {
    return KM_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  }

  /**
   * 沿锋面线两侧取样求温差。
   * 做法：把折线投影到以折线中点为原点的局部 km 平面 → 在平面里沿法向各偏移 halfKm →
   * 反投影回经纬度 → 用 sstCell 取真实档位温度（不插值）→ 统计温差与梯度。
   */
  function frontIntensity(iso, points, halfKm) {
    const day = SST[iso];
    if (!day || !Array.isArray(points) || points.length < 2) return null;
    const offsetKm = halfKm || 10;
    const mid = points[Math.floor(points.length / 2)];
    const lon0 = mid[0];
    const lat0 = mid[1];
    const kx = kmPerDegLonAt(lat0);
    const project = (p) => [(p[0] - lon0) * kx, (p[1] - lat0) * KM_PER_DEG_LAT];
    const unproject = (x, y) => [lon0 + x / kx, lat0 + y / KM_PER_DEG_LAT];

    const step = Math.max(1, Math.floor(points.length / 12));   // 最多 12 个采样点
    const diffs = [];
    for (let i = 0; i + 1 < points.length; i += step) {
      const a = project(points[i]);
      const b = project(points[i + 1]);
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const len = Math.hypot(tx, ty);
      if (!len) continue;
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const nx = -ty / len;
      const ny = tx / len;
      const left = unproject(c[0] + nx * offsetKm, c[1] + ny * offsetKm);
      const right = unproject(c[0] - nx * offsetKm, c[1] - ny * offsetKm);
      const tl = OFData.sstCell(iso, left[0], left[1]);
      const tr = OFData.sstCell(iso, right[0], right[1]);
      if (!tl || !tr) continue;
      if (tl.valueC == null || tr.valueC == null) continue;   // 缺测不参与，也不补 0
      diffs.push(Math.abs(tl.valueC - tr.valueC));
    }
    if (!diffs.length) return null;
    const mean = diffs.reduce(function (sum, v) { return sum + v; }, 0) / diffs.length;
    const max = Math.max.apply(null, diffs);
    return {
      available: true,
      metric: "cross_front_sst_difference",
      offsetKm: offsetKm,
      sampleCount: diffs.length,
      meanRangeC: Math.round(mean * 100) / 100,
      maxRangeC: Math.round(max * 100) / 100,
      gradientCPerKm: Math.round((mean / (offsetKm * 2)) * 1000) / 1000,
      note: "口径：锋面线两侧各 " + offsetKm + " km 的 SST 差（数据集 frontal_intensity 未接入）",
    };
  }

  /** 强度分档（展示用；阈值写在界面上，避免被读成官方强度等级）。 */
  function intensityLevel(meanRangeC) {
    if (meanRangeC == null) return { label: "未知", tone: "plain" };
    if (meanRangeC >= 2) return { label: "强", tone: "strong" };
    if (meanRangeC >= 1) return { label: "中", tone: "medium" };
    return { label: "弱", tone: "weak" };
  }

  /** 单片内的「这一格是什么」（原来的 cellInfo 主体，改成按片查询） */
  function cellInfoInPatch(patch, lon, lat) {
    const day = patch.front;
    const grid = patch.grid;
    if (!day || !grid) return null;
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
  }

  /** 单片内的海温档位（原来的 sstCell 主体） */
  function sstCellInPatch(patch, lon, lat) {
    const day = patch.sst;
    if (!day || !day.grid) return null;
    const g = day.grid;
    const col = Math.round((lon - g.lon0) / g.dlon);
    const row = Math.round((lat - g.lat0) / g.dlat);
    if (col < 0 || col >= g.nx || row < 0 || row >= g.ny) return { inGrid: false, valueC: null, bin: null };
    const runs = day.runs || [];
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (run[0] === row && col >= run[1] && col < run[1] + run[2]) {
        return { inGrid: true, valueC: Math.round(run[3] * day.bin_c * 10) / 10, bin: run[3],
          resolutionDeg: g.dlon || 0.05 };
      }
    }
    return { inGrid: true, valueC: null, bin: null, resolutionDeg: g.dlon || 0.05 };
  }

  const OFData = {
    setRequestContext: setRequestContext,
    loadState: loadState,
    meta: META,
    basemap: BASE,                                  // 1:10m 东海细节（离线兜底档）
    basemapAsia: window.OF_DATA_ASIA || null,       // 1:50m 西太平洋（区域档）
    basemapWorld: window.OF_DATA_WORLD || null,     // 1:110m 全球（球面档）
    clim: CLIM,

    // ---- 服务器增强模式（可选）----
    // 未启用时 serverEnabled() 恒为 false、serverAvailable() 恒为 false、ensureDay() 立即返回 false，
    // 因此离线（file://）行为与既有断言不受影响。
    serverEnabled: serverEnabled,
    serverAvailable: serverAvailable,
    serverMode: serverMode,
    setServerMode: setServerMode,
    initServerMode: initServerMode,
    ensureDay: ensureDay,

    // ---- 视野窗口片（v1.9：服务器按当前视野出数，球面/大洲尺度也有真实数据）----
    patches: patches,
    patchCount: function (iso) { return patches(iso).length; },
    setViewWindow: setViewWindow,
    viewWindow: viewWindow,
    ensureViewport: ensureViewport,
    viewportReady: function (iso) { return !!(VIEW_WINDOW.bbox && coveredByPatch(iso, VIEW_WINDOW.bbox, VIEW_WINDOW.step)); },
    prefetchOverview: prefetchOverview,
    workingWindow: workingWindow,
    stepForWindow: stepForWindow,

    // ---- 渔场线索（GFW 表观捕捞活动；仅服务器模式可用）----
    fishingAvailable: fishingAvailable,
    fishingDay: fishingDay,
    ensureFishing: ensureFishing,

    // ---- 锋面强度（口径：跨锋面 SST 温差 / 梯度）----
    frontIntensity: frontIntensity,
    intensityLevel: intensityLevel,

    // ---- 日期与可用性 ----
    availableDates: function () { return mergedDates(); },
    firstDate: function () { const all = mergedDates(); return all[0] || null; },
    lastDate: function () { const all = mergedDates(); return all[all.length - 1] || null; },
    // 注意：hasDay 的语义仍是「本地数据已就绪」，服务器上存在但未加载的日期不算 —— 渲染前必须先 ensureDay。
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
        if (serverAvailable(iso)) {
          return {
            ok: false,
            title: "正在从服务器取这一天",
            desc: "该日期在服务器上有数据，页面会按需加载（加载完成前不给结论）。",
          };
        }
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
    // v1.9：一天可能有多片数据（概览 + 明细），从**最细的一片**开始找；返回里带该片的分辨率，
    // 界面据此说明「这是概览格（1°）」，不会把 1° 的聚合格说成 0.05° 的观测。
    cellInfo: function (iso, lon, lat) {
      const list = patches(iso);
      if (!list.length) return null;
      const ordered = list.slice().sort(function (a, b) { return a.resolutionDeg - b.resolutionDeg; });
      let outside = null;
      for (let i = 0; i < ordered.length; i++) {
        const info = cellInfoInPatch(ordered[i], lon, lat);
        if (!info) continue;
        info.resolutionDeg = ordered[i].resolutionDeg;
        info.overview = ordered[i].overview;
        if (info.inGrid) return info;
        if (!outside) outside = info;
      }
      return outside;
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
    // v1.9：海温可能来自不同的片（东海子集 + 按视野取的子集），从最细的一片开始找
    // v1.11：同一片还可能有全球粗格海温（sstCoarse）→ 一并纳入候选，仍按分辨率从细到粗找
    sstCell: function (iso, lon, lat) {
      const candidates = [];
      patches(iso).forEach(function (item) {
        if (item.sst) candidates.push({ sst: item.sst });
        if (item.sstCoarse) candidates.push({ sst: item.sstCoarse });
      });
      if (!candidates.length) return null;
      candidates.sort(function (a, b) {
        return (a.sst.grid.dlon || 0.05) - (b.sst.grid.dlon || 0.05);
      });
      let outside = null;
      for (let i = 0; i < candidates.length; i++) {
        const info = sstCellInPatch(candidates[i], lon, lat);
        if (!info) continue;
        if (info.inGrid) return info;
        if (!outside) outside = info;
      }
      return outside;   // 都不在网格里：明说"不在已下载的海温范围内"
    },

    // ---- 明确「还没有」的东西：一律返回 false，让界面说清楚 ----
    sstAvailable: function () { return !!(META && META.status && META.status.sst === "real"); },
    intensityAvailable: function () { return !!(META && META.status && META.status.intensity === "real"); },
    forecastAvailable: function () { return !!(META && META.status && META.status.forecast === "real"); },
    seaStateAvailable: function () { return !!(META && META.status && META.status.sea_state === "real"); },
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
