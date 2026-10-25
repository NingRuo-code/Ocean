/* Existing deterministic sample/experimental renderers run only on an explicit
 * read action. Opening a tab or evidence panel never recalculates a result. */
(function () {
  const main = document.querySelector(".main"), records = { clim: null, future: null };
  const panel = document.createElement("section");
  panel.id = "evidencePanel"; panel.className = "evidence-panel"; panel.hidden = true;
  panel.setAttribute("aria-label", "结果详细证据");
  panel.innerHTML = '<div class="panel-head"><div><small>// EVIDENCE</small><h2 id="evidenceTitle">详细证据</h2></div><button id="evidenceClose" aria-label="收起详细证据">×</button></div><p id="evidenceIdentity"></p><p id="evidenceStale" role="status"></p><div id="historyEvidence"></div><div id="forecastEvidence"></div>';
  main.append(panel);
  const history = $("pane-clim"), future = $("pane-future");
  while (history.firstChild) $("historyEvidence").append(history.firstChild);
  while (future.firstChild) $("forecastEvidence").append(future.firstChild);
  const sourceIdentity = document.createElement("p"); sourceIdentity.id = "historicalSourceIdentity"; sourceIdentity.className = "result-identity";
  $("historyEvidence").prepend(sourceIdentity);
  history.innerHTML = '<section class="card"><h3>历史观测 <span id="historyMonth"></span></h3><p class="result-brief" id="historySummary"></p><p class="result-identity" id="historyIdentity"></p><p class="result-stale" id="historyStale" role="status"></p><button id="historyRead">读取当前月归档样例</button><div id="historyMetrics" class="metric"></div><div id="historyChart" class="history-calendar" aria-label="逐日锋面观测样例"></div><p class="result-note">日格：有锋面 / 未检出 / 缺资料。不是活动响应统计。</p><button id="historyDetails" aria-controls="evidencePanel" aria-expanded="false" disabled>详细证据</button></section>';
  future.innerHTML = '<section class="card"><h3>规则预测参考 <span class="tag plain">实验 / 未独立验证</span></h3><p class="result-brief" id="forecastSummary">尚无经过独立验证的活动预测；可显式读取已有本地规则参考。</p><p class="result-identity" id="forecastIdentity"></p><p class="result-stale" id="forecastStale" role="status"></p><button id="forecastRead">读取当前规则参考</button><div id="forecastMetrics" class="metric"></div><button id="forecastDetails" aria-controls="evidencePanel" aria-expanded="false" disabled>详细证据</button></section>';
  const back = document.createElement("button"); back.id = "historyReturn"; back.textContent = "返回历史月份"; back.hidden = true;
  $("pane-now").prepend(back);
  state.climMode = "month";
  let shown = null, opener = null;

  function context(kind) {
    const mode = OFData.serverMode();
    return { date: state.date, lon: state.lon, lat: state.lat, range: state.range,
      period: kind === "clim" ? state.climMode : state.predWindow,
      service: mode.enabled ? "server" : "offline", dataVersion: mode.dataVersion ?? null,
      product: OFData.meta?.product?.version ?? null, exported: OFData.meta?.generated_at ?? null };
  }
  function identity(c) {
    return c.date + " / " + fmtCoord(c.lon, c.lat) + " / " + c.range + " km / 产品 " + (c.product || "未声明") +
      (c.service === "server" ? " / 服务资料版本 " + (c.dataVersion || "未声明") : " / 归档导出 " + (c.exported || "未声明"));
  }
  function stale(kind) { return records[kind] && JSON.stringify(records[kind].context) !== JSON.stringify(context(kind)); }
  function sync() {
    $("historyMonth").textContent = records.clim?.context.date.slice(0, 7) || state.date.slice(0, 7);
    if (!records.clim) $("historySummary").textContent = "可信整月汇总未接入；可主动读取当前月已就绪的归档样例，不能据此认定整月研究合格。";
    for (const [kind, prefix] of [["clim", "history"], ["future", "forecast"]]) {
      $(prefix + "Stale").textContent = stale(kind) ? "条件已改变，以下保留原结果，待更新。" : "";
    }
    if (shown && records[shown]) $("evidenceStale").textContent = stale(shown) ? "条件已改变，证据仍属于原结果，待更新。" : "";
  }
  function close(restore = true) {
    panel.hidden = true;
    $("historyDetails").setAttribute("aria-expanded", "false"); $("forecastDetails").setAttribute("aria-expanded", "false");
    if (restore && opener?.getClientRects().length) opener.focus({ preventScroll: true });
  }
  function show(kind, button) {
    if (!records[kind]) return;
    if (shown === kind && !panel.hidden) { close(); return; }
    shown = kind; opener = button;
    $("historyEvidence").hidden = kind !== "clim"; $("forecastEvidence").hidden = kind !== "future";
    $("evidenceTitle").textContent = kind === "clim" ? "历史样例证据" : "实验规则证据";
    $("evidenceIdentity").textContent = identity(records[kind].context);
    panel.hidden = false;
    $("historyDetails").setAttribute("aria-expanded", String(kind === "clim")); $("forecastDetails").setAttribute("aria-expanded", String(kind === "future"));
    sync();
    window.dispatchEvent(new Event("ocean-evidence-open"));
    $("evidenceClose").focus({ preventScroll: true });
  }
  function read(kind) {
    const c = context(kind);
    if (kind === "clim") {
      renderClim(true); renderAisResponse(snapshot(), true);
      const anchor = OFData.meta?.region?.anchor, response = OFData.frontResponseMeta();
      sourceIdentity.textContent = "同期统计固定取样点：" + (Array.isArray(anchor) && anchor.length === 2 && anchor.every(Number.isFinite) ? fmtCoord(anchor[0], anchor[1]) : "未声明") +
        "。以下既有 AIS 响应表按日期与缓冲半径索引，未按当前分析点筛选，不代表该分析圈的响应。" +
        "响应表来源：" + (response?.source?.attribution || "未声明") + "；生成版本：" + (response?.generatedAt || "未声明") +
        "；原支持海域：" + (response?.spatialWindow?.region || "未声明") + "。";
      const days = datesInMonth(c.date).filter(d => OFData.hasDay(d));
      const agg = aggregateObservationDates(days);
      const month = c.date.slice(0, 7), n = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
      $("historySummary").textContent = "归档样例：" + agg.valid + "/" + n + " 日可读；可信整月研究汇总未接入，多年同期仅每年 8 月 5—7 日取样。";
      $("historyMetrics").innerHTML = metricCell("可读日", String(agg.valid), "天") + metricCell("有锋面日", String(agg.present), "天") + metricCell("范围", String(c.range), "km");
      $("historyChart").replaceChildren();
      for (let d = 1; d <= n; d++) {
        const iso = month + "-" + String(d).padStart(2, "0"), row = agg.rows.find(r => r.date === iso);
        const button = document.createElement("button"); button.dataset.date = iso;
        const text = row ? (row.present ? "有锋面" : "未检出") : "缺资料";
        button.textContent = d + " " + (row ? (row.present ? "●" : "○") : "—");
        button.setAttribute("aria-label", iso + " " + text); button.title = iso + " " + text; button.disabled = !row;
        button.classList.toggle("has-front", !!row?.present);
        button.onclick = () => {
          // A frozen sample cannot authorize switching a now-unavailable date.
          if (stale("clim")) { showToast("条件已改变，请先更新归档样例"); return; }
          if (!OFData.hasDay(iso)) return;
          state.currentTask = "front"; setDate(iso); switchTab("now"); back.hidden = false; close(false);
        };
        $("historyChart").append(button);
      }
    } else {
      renderFuture(true);
      const snap = snapshot();
      $("forecastSummary").textContent = snap.ok ? "基准 " + c.date + "；目标 " + addDays(c.date, 1) + " 至 " + addDays(c.date, c.period) + "。仅为规则演示，未独立验证，也不是表观活动概率。" : "基准日缺有效观测，不能生成规则参考。";
      $("forecastMetrics").innerHTML = snap.ok ? metricCell("参考窗口", String(c.period), "天") + metricCell("当前最近锋面", snap.nearest ? snap.nearest.km.toFixed(1) : "—", "km") : "";
    }
    records[kind] = { context: c };
    const prefix = kind === "clim" ? "history" : "forecast";
    $(prefix + "Identity").textContent = identity(c);
    $(prefix + "Details").disabled = false;
    if (shown === kind) $("evidenceIdentity").textContent = identity(c);
    sync();
  }
  $("historyRead").onclick = () => read("clim"); $("forecastRead").onclick = () => read("future");
  $("historyDetails").onclick = e => show("clim", e.currentTarget); $("forecastDetails").onclick = e => show("future", e.currentTarget);
  $("evidenceClose").onclick = () => close();
  panel.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
  back.onclick = () => { switchTab("clim"); back.hidden = true; sync(); };
  window.addEventListener("ocean-applied-context", sync);
  window.addEventListener("ocean-load-state", sync);
  window.addEventListener("ocean-control-open", () => close(false));
  window.OceanEvidence = { sync, read, isCurrent: kind => !!records[kind] && !stale(kind) };
  sync();
})();
