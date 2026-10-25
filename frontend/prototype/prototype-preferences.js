/* Applied conditions only. View history keeps its existing, independent storage. */
(function () {
  "use strict";
  const KEY = "ocean.applied.v1";
  const notice = document.createElement("p");
  notice.id = "preferenceStatus"; notice.setAttribute("role", "status");
  $("taskWorkbench").querySelector(".wb-shortcuts").append(notice);
  const layerKeys = Object.keys(state.layers);
  let ready = false, touched = false, stored = null, storageFailed = false, manualLayers = {};
  const feedback = text => { notice.textContent = text; };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { stored = JSON.parse(raw); }
      catch { feedback("保存条件已损坏，已使用默认值。"); }
    }
  }
  catch { storageFailed = true; feedback("无法读取保存条件，当前操作仍可继续。"); }
  function save() {
    if (!ready || storageFailed) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ schema: "ocean-applied-preferences/v1", date: state.date,
        point: { lon: state.lon, lat: state.lat }, radius_km: state.range, layers: manualLayers }));
    } catch { storageFailed = true; feedback("此浏览器无法保存条件，本次操作仍可继续。"); }
  }
  const userTouched = event => {
    if (!ready && event.isTrusted && event.target.closest("#filterPanel, #layerDrawer, #map, .wb-shortcuts")) touched = true;
  };
  document.addEventListener("input", userTouched, true);
  document.addEventListener("pointerdown", userTouched, true);
  document.addEventListener("keydown", userTouched, true);
  window.addEventListener("ocean-applied-context", save);
  window.addEventListener("ocean-layer-choice", e => {
    if (layerKeys.includes(e.detail.key) && typeof e.detail.value === "boolean") manualLayers[e.detail.key] = e.detail.value;
    save();
  });
  window.addEventListener("ocean-layer-preset", () => { manualLayers = {}; save(); });
  Promise.resolve(window.OceanMapReady).then(() => {
    if (touched) {
      feedback("已保留本次操作，未覆盖为上次条件。");
    } else if (stored && stored.schema === "ocean-applied-preferences/v1") {
      let invalid = false;
      const dates = OFData.availableDates();
      if (typeof stored.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(stored.date) && dates.includes(stored.date)) state.date = stored.date;
      else invalid = true;
      const point = stored.point;
      if (point && Number.isFinite(point.lon) && Number.isFinite(point.lat) && point.lon >= -180 && point.lon <= 180 && point.lat >= -90 && point.lat <= 90) {
        state.lon = point.lon; state.lat = point.lat;
      } else invalid = true;
      if ([10, 20, 30].includes(stored.radius_km)) state.range = stored.radius_km; else invalid = true;
      if (stored.layers && typeof stored.layers === "object" && !Array.isArray(stored.layers)) {
        for (const [key, value] of Object.entries(stored.layers)) {
          if (layerKeys.includes(key) && typeof value === "boolean") { state.layers[key] = value; manualLayers[key] = value; }
          else invalid = true;
        }
      } else invalid = true;
      $("locInput").value = fmtCoord(state.lon, state.lat);
      loadThenRefresh(state.date);
      feedback(invalid ? "部分上次条件已失效，已使用可用默认值。" : "已恢复上次筛选和手动图层。");
    } else if (stored) feedback("保存条件格式已失效，已使用默认值。");
    ready = true;
    document.removeEventListener("input", userTouched, true);
    document.removeEventListener("pointerdown", userTouched, true);
    document.removeEventListener("keydown", userTouched, true);
    save();
  }).catch(() => { ready = true; feedback("资料范围尚未确认，未恢复上次条件。"); });
})();
