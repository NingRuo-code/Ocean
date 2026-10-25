/* Non-modal docking/focus behavior adapted from 53762af575c4eb9c38b3d37b8fda0ee5fb043b46.
 * Uses the existing map, filters and result renderers; no task execution is simulated. */
(function () {
  const main = document.querySelector(".main"), header = $("topbar"), side = $("resultPanel");
  const workbench = document.createElement("dialog");
  workbench.id = "taskWorkbench";
  workbench.className = "workbench";
  workbench.setAttribute("aria-label", "工作台");
  workbench.innerHTML = `<div class="panel-head"><div><small>// WORKBENCH</small><h2>工作台</h2></div><button id="workbenchClose" aria-label="收起工作台">×</button></div>
    <section class="wb-shortcuts"><h3>快捷功能</h3><button id="nearbyFront">⌖　附近锋面</button><button data-open-pane="clim">◷　历史观测</button><button data-open-pane="future">↗　预测参考</button><button id="filterToggle" aria-controls="filterPanel" aria-expanded="false">☷　筛选条件</button><button id="wbLayers">▧　图层开关</button><button data-open-pane="basis">ⓘ　数据说明</button></section>
    <section id="wbAI"><h3>AI 分析</h3></section>`;
  main.prepend(workbench);
  const filters = document.createElement("section");
  filters.id = "filterPanel"; filters.className = "filter-panel"; filters.hidden = true;
  filters.setAttribute("aria-label", "筛选条件");
  filters.innerHTML = '<div class="panel-head"><h2>筛选条件</h2><button id="filterClose" aria-label="收起筛选">×</button></div><p>修改后即时更新</p>';
  header.querySelectorAll(".ctx").forEach(item => filters.append(item));
  filters.querySelectorAll(".num").forEach(item => item.remove());
  filters.querySelectorAll("input").forEach(input => input.setAttribute("aria-label", input.id === "locInput" ? "定位坐标" : input.id === "timeDate" ? "观测日期" : "日期滑块"));
  main.append(filters);
  const actions = document.createElement("nav");
  actions.className = "header-actions";
  actions.setAttribute("aria-label", "面板");
  actions.innerHTML = '<button id="workbenchToggle" aria-controls="taskWorkbench" aria-expanded="false">工作台</button><button id="headerFilter">筛选</button><button id="resultToggle" aria-controls="resultPanel" aria-expanded="true">结果</button>';
  header.append(actions);
  const loading = document.createElement("div"); loading.id = "loadStatus"; loading.className = "load-status";
  loading.setAttribute("role", "status");
  loading.innerHTML = '<span id="loadStatusText"></span><button id="retryData" hidden>重试当前条件</button>';
  $("map").append(loading);
  const stateText = { loading: "加载中", ready: "就绪", "ready-zero-records": "返回记录均为零（不代表完整海域）",
    "unknown-coverage": "无记录／覆盖未知", "day-missing": "整日缺资料", unprepared: "资料未准备", forbidden: "无权访问", error: "请求失败" };
  window.addEventListener("ocean-load-state", () => {
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
  function showFilters(open) {
    const restore = filters.contains(document.activeElement);
    filters.hidden = !open;
    $("filterToggle").setAttribute("aria-expanded", String(open));
    if (!open && restore) $("headerFilter").focus();
  }
  $("workbenchToggle").onclick = toggleWorkbench;
  $("workbenchClose").onclick = closeWorkbench;
  $("resultClose").onclick = closeResult;
  $("resultToggle").onclick = () => side.hidden ? showResult(state.tab === "ai" ? "now" : state.tab) : closeResult();
  $("nearbyFront").onclick = () => showResult("now");
  workbench.querySelectorAll("[data-open-pane]").forEach(b => b.onclick = () => showResult(b.dataset.openPane));
  $("filterToggle").onclick = $("headerFilter").onclick = () => showFilters(filters.hidden);
  $("filterClose").onclick = () => showFilters(false);
  $("wbLayers").onclick = () => { drawerPinned = !state.drawerOpen; setDrawer(drawerPinned); };
  workbench.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeWorkbench(); }
  });
  for (const panel of [side, filters]) panel.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); panel === side ? closeResult() : showFilters(false); }
  });
  if (matchMedia("(max-width:760px)").matches) closeResult();
  resizeMap();
})();
