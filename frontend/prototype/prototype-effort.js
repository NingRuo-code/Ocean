/* Display-only summary of the existing /fishing/{date} response. The returned
 * grid is not the finer source of record for front-buffer research. */
function renderEffortSummary() {
  const active = state.currentTask === "effort";
  $("currentHeading").textContent = active ? "AIS 表观捕捞活动" : "附近锋面";
  $("nowLead").closest(".card").hidden = active;
  if (!active) return;

  const day = OFData.fishingDay(state.date), load = OFData.loadState().fishing;
  const status = load?.status;
  const unavailable = { loading: "活动资料加载中", error: "活动资料请求失败，可重试", forbidden: "无权访问活动资料", "day-missing": "当日缺活动资料", unprepared: "活动资料尚未准备" };
  const cells = Array.isArray(day?.cells) ? day.cells : [];
  const keys = new Map();
  for (const cell of cells) {
    if (!cell) continue;
    const key = cell.lon + ":" + cell.lat;
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  let hours = 0, count = 0, rejected = 0;
  for (const cell of cells) {
    if (!cell || ![cell.lon, cell.lat, cell.hours].every(Number.isFinite) || Math.abs(cell.lon) > 180 || Math.abs(cell.lat) > 90 || cell.hours < 0 || keys.get(cell.lon + ":" + cell.lat) !== 1) { rejected++; continue; }
    // Great-circle distance between the analysis point and each display-cell
    // centre. Include the boundary; do not imply exact polygon clipping.
    const rad = Math.PI / 180, a = Math.sin((cell.lat - state.lat) * rad / 2) ** 2 +
      Math.cos(state.lat * rad) * Math.cos(cell.lat * rad) * Math.sin((cell.lon - state.lon) * rad / 2) ** 2;
    const km = 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
    if (km <= state.range + 1e-9) { hours += cell.hours; count++; }
  }
  const blocked = unavailable[status] || (!OFData.serverEnabled() && !day ? "离线未接入活动资料" : "");
  const readable = !blocked && count > 0 && Number.isFinite(hours) && (!day.date || day.date === state.date);
  const reason = blocked || (cells.length ? "圈内无有效返回格点，覆盖未知" : "无活动记录，覆盖未知");
  const resolution = Number.isFinite(day?.spatial_resolution_deg) && day.spatial_resolution_deg > 0 ? day.spatial_resolution_deg + "° 展示网格" : "展示粒度未声明";
  const near = snapshot().nearest;
  $("nowScopeTag").textContent = state.range + " km / " + resolution;
  $("heroWhen").textContent = state.date + " / 归档活动";
  $("heroVerdict").textContent = readable ? fmtHours(hours) : "—";
  $("heroLine").textContent = readable ? (hours === 0 ? "返回有效记录均为零；" : "圈内已返回格点的部分累计；") + "覆盖未知，不代表全圈总量或渔获。" : reason + "，不能视为零活动。";
  $("nowMetrics").innerHTML = metricCell("圈内返回格", String(count), "个") +
    metricCell("最近锋面", near ? near.km.toFixed(1) : "—", "km") + metricCell("作业范围", String(state.range), "km");
  const source = day?.source || {};
  $("heroWhyBody").textContent = "日期 " + state.date + "；分析点 " + fmtCoord(state.lon, state.lat) + "；范围 " + state.range + " km。来源：" + (source.name || "未声明") +
    "；许可：" + (source.license || "未声明") + "；资料版本：" + (day?.version || "未声明") + "；" + resolution +
    "。按格心大圆距离筛入，累加完整返回数组中的有效唯一格点，不按绘制圆点反算；无完整覆盖合同，始终只报告已返回记录的部分累计。" +
    "现有地图仍按当日分位筛选且最多显示 700 点，不能代表活动全集；全量显示与聚合另行验收。" +
    (rejected ? "已排除 " + rejected + " 条非法或重复格点。" : "") +
    (day?.cell_count !== undefined && day.cell_count !== cells.length ? "声明格数与返回条数不符，完整性未确认。" : "") +
    "多船累计可以超过 24 小时；AIS 行为估计不等于渔获量、鱼群密度或作业成功概率。展示网格不替代锋面缓冲研究真源。" +
    (near ? "最近锋面位于" + near.bearing + " " + near.km.toFixed(1) + " km，仅为同日位置事实，不能据此认定锋面导致活动变化。" : "当日锋面位置未就绪。 ");
}
