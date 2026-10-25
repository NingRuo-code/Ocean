/* Non-modal docking/focus behavior adapted from 53762af575c4eb9c38b3d37b8fda0ee5fb043b46.
 * Uses the existing map, filters and result renderers; no task execution is simulated. */
(function () {
  const main = document.querySelector(".main"), header = $("topbar"), side = $("resultPanel");
  const workbench = document.createElement("dialog");
  workbench.id = "taskWorkbench";
  workbench.className = "workbench";
  workbench.setAttribute("aria-label", "工作台");
  workbench.innerHTML = `<div class="panel-head"><div><small>// WORKBENCH</small><h2>工作台</h2></div><button id="workbenchClose" aria-label="收起工作台">×</button></div>
    <section class="wb-shortcuts"><h3>快捷功能</h3><button id="nearbyFront">⌖　附近锋面</button><button id="fishingActivity">◉　捕捞活动</button><button data-open-pane="clim">◷　历史观测</button><button data-open-pane="future">↗　预测参考</button><button id="filterToggle" aria-controls="filterPanel" aria-expanded="false">☷　筛选条件</button><button id="wbLayers" aria-controls="layerDrawer" aria-expanded="false">▧　图层开关</button><button data-open-pane="basis">ⓘ　数据说明</button><p id="layerPresetNote" role="status"></p></section>
    <section id="wbAI"><h3>AI 分析</h3></section>`;
  main.prepend(workbench);
  const filters = document.createElement("section");
  filters.id = "filterPanel"; filters.className = "filter-panel"; filters.hidden = true;
  filters.setAttribute("aria-label", "筛选条件");
  filters.innerHTML = '<div class="panel-head"><h2>筛选条件</h2><button id="filterClose" aria-label="收起筛选">×</button></div><p>日期与范围即时更新；坐标点击“应用”后生效。</p>';
  header.querySelectorAll(".ctx").forEach(item => filters.append(item));
  filters.querySelectorAll(".num").forEach(item => item.remove());
  filters.querySelectorAll("input").forEach(input => input.setAttribute("aria-label", input.id === "locInput" ? "定位坐标" : input.id === "timeDate" ? "观测日期" : "日期滑块"));
  filters.querySelector("#locateBtn").textContent = "应用";
  filters.querySelectorAll(".ctx-lab")[0].textContent = "分析点";
  filters.querySelectorAll(".ctx-lab")[2].textContent = "观测日";
  main.append(filters);
  const playback = document.createElement("div"); playback.className = "playback-notice";
  playback.innerHTML = '<p id="playbackStatus" role="status"></p><button id="playbackContinue" hidden>继续下一可读日</button><button id="playbackStop" hidden>停止播放</button>';
  filters.append(playback);
  $("playbackContinue").onclick = continuePlayback;
  $("playbackStop").onclick = () => setPlaying(false);
  const layers = $("layerDrawer");
  layers.classList.add("layer-panel");
  main.append(layers);
  $("layerToggle").hidden = true;
  layers.querySelectorAll(".legend-row").forEach(row => {
    const label = document.createElement("small"); label.className = "layer-status"; row.append(label);
  });
  const legend = document.createElement("aside");
  legend.id = "mapLegendSummary"; legend.className = "map-legend compact-legend";
  legend.setAttribute("aria-label", "当前图例");
  $("map").append(legend);
  renderLegend();
  const actions = document.createElement("nav");
  actions.className = "header-actions";
  actions.setAttribute("aria-label", "面板");
  actions.innerHTML = '<button id="workbenchToggle" aria-controls="taskWorkbench" aria-expanded="false">工作台</button><button id="headerFilter" aria-controls="filterPanel" aria-expanded="false">筛选</button><button id="resultToggle" aria-controls="resultPanel" aria-expanded="true">结果</button>';
  header.append(actions);
  const loading = document.createElement("div"); loading.id = "loadStatus"; loading.className = "load-status";
  loading.setAttribute("role", "status");
  loading.innerHTML = '<span id="loadStatusText"></span><button id="retryData" hidden>重试当前条件</button>';
  $("map").append(loading);
  const stateText = { loading: "加载中", ready: "就绪", "ready-zero-records": "返回记录均为零（不代表完整海域）",
    "unknown-coverage": "无记录／覆盖未知", "day-missing": "整日缺资料", unprepared: "资料未准备", forbidden: "无权访问", error: "请求失败" };
  window.addEventListener("ocean-load-state", () => {
    renderLegend();
    renderEffortSummary();
    const entries = Object.entries(OFData.loadState());
    $("loadStatusText").textContent = entries.map(([key, value]) => ({ day: "日资料", viewport: "视野", fishing: "活动" }[key]) + "：" + (stateText[value.status] || value.status)).join(" / ");
    $("retryData").hidden = !entries.some(([, value]) => ["error", "day-missing", "unprepared", "forbidden"].includes(value.status));
  });
  $("retryData").onclick = () => { loadThenRefresh(state.date); loadFishing(state.date, true); requestViewportPatch(false); };
  $("wbAI").append($("pane-ai"));
  $("pane-ai").classList.add("active");
  document.querySelector('#tabs [data-pane="ai"]').remove();
  // Keep the legacy AIS evidence accessible through history, outside the compact current result.
  const aisCard = $("aisResponseList").closest(".card");
  $("pane-clim").append(aisCard);
  $("seaDetails").hidden = true; // synthetic sea conditions do not belong in the factual summary.
  function resizeMap() { applyZoom(false); }
  function closeWorkbench() {
    const restore = workbench.contains(document.activeElement);
    workbench.close();
    $("workbenchToggle").setAttribute("aria-expanded", "false");
    resizeMap();
    if (restore) $("workbenchToggle").focus();
  }
  function toggleWorkbench() {
    if (workbench.open) return closeWorkbench();
    if (matchMedia("(max-width:760px)").matches) closeResult();
    workbench.show(); // Intentionally non-modal: map remains interactive.
    $("workbenchToggle").setAttribute("aria-expanded", "true");
    resizeMap();
  }
  function showResult(pane) {
    if (matchMedia("(max-width:760px)").matches && workbench.open) closeWorkbench();
    side.hidden = false;
    $("resultToggle").setAttribute("aria-expanded", "true");
    switchTab(pane);
    $("pane-ai").classList.add("active");
    resizeMap();
  }
  function closeResult() {
    const restore = side.contains(document.activeElement);
    side.hidden = true;
    $("resultToggle").setAttribute("aria-expanded", "false");
    resizeMap();
    if (restore) $("resultToggle").focus();
  }
  let filterOpener = $("headerFilter");
  function showFilters(open, opener, restoreFocus = true) {
    const restore = restoreFocus && filters.contains(document.activeElement);
    if (open && opener) filterOpener = opener;
    if (open) setDrawer(false);
    filters.hidden = !open;
    $("filterToggle").setAttribute("aria-expanded", String(open));
    $("headerFilter").setAttribute("aria-expanded", String(open));
    if (!open && restore) (filterOpener.getClientRects().length ? filterOpener : $("headerFilter")).focus({ preventScroll: true });
  }
  function showLayers(open, restoreFocus = true) {
    const restore = restoreFocus && layers.contains(document.activeElement);
    if (open) showFilters(false, null, false);
    setDrawer(open);
    if (!open && restore) (workbench.open ? $("wbLayers") : $("workbenchToggle")).focus({ preventScroll: true });
  }
  window.addEventListener("ocean-layer-panel", e => {
    $("wbLayers").setAttribute("aria-expanded", String(e.detail.open));
    if (e.detail.open) showFilters(false, null, false);
  });
  function activateTask(pane) {
    setPlaying(false);
    state.currentTask = pane === "effort" ? "effort" : "front";
    if (["now", "clim", "future", "effort"].includes(pane)) {
      Object.assign(state.layers, { sst: pane !== "clim", band: true, front: true, coldwarm: true, nodata: true, ground: pane === "effort", fishing: false });
      window.dispatchEvent(new Event("ocean-layer-preset"));
      $("layerPresetNote").textContent = pane === "future" ? "图层仍为所选日期观测，未绘制未来预报。" : "已应用图层搭配；可在图层中调整。";
      refresh();
    }
    showResult(pane === "effort" ? "now" : pane);
    if (pane === "effort") loadFishing(state.date, true);
  }
  $("workbenchToggle").onclick = toggleWorkbench;
  $("workbenchClose").onclick = closeWorkbench;
  $("resultClose").onclick = closeResult;
  $("resultToggle").onclick = () => side.hidden ? showResult(state.tab === "ai" ? "now" : state.tab) : closeResult();
  $("nearbyFront").onclick = () => activateTask("now");
  $("fishingActivity").onclick = () => activateTask("effort");
  workbench.querySelectorAll("[data-open-pane]").forEach(b => b.onclick = () => activateTask(b.dataset.openPane));
  $("filterToggle").onclick = $("headerFilter").onclick = e => showFilters(filters.hidden, e.currentTarget);
  $("filterClose").onclick = () => showFilters(false);
  window.addEventListener("ocean-map-activate", () => { showFilters(false, null, false); showLayers(false, false); });
  $("wbLayers").onclick = () => showLayers(!state.drawerOpen);
  $("layerClose").onclick = () => showLayers(false);
  layers.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); showLayers(false); }
  });
  setDrawer(false);
  workbench.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeWorkbench(); }
  });
  for (const panel of [side, filters]) panel.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); panel === side ? closeResult() : showFilters(false); }
  });
  if (matchMedia("(max-width:760px)").matches) closeResult();
  resizeMap();
})();
