/* One presentation of frozen daily support for the month reader and its report. */
(function () {
  const states = {ready:"有效",partial_support:"部分单元有效",unprepared:"未准备",missing:"缺测",read_failed:"读取失败",no_records:"无记录／覆盖未知",unknown_support:"支持未知"};
  function render(chart, table, daily) {
    chart.replaceChildren(); table.tBodies[0].replaceChildren(); delete chart.dataset.state;
    const known = daily.filter(d => d.hours !== null), max = Math.max(0, ...known.map(d => d.hours));
    const scale = !known.length ? "没有可绘制的已知日值。" : max ? `纵轴：0–${max} h；横轴为日历日。` : "有效日均为0 h，未知日不绘柱。";
    chart.setAttribute("aria-label", scale);
    if(!known.length) chart.dataset.state = "empty";
    else for(const d of daily) {
      const item = document.createElement("div"); item.className = "monthly-day";
      item.dataset.state = d.hours === null ? "unknown" : d.hours === 0 ? "zero" : "known";
      item.title = `${d.date} ${states[d.state]} ${d.hours ?? "未知"} h`;
      const bar = document.createElement("i");
      if(d.hours === null) bar.textContent = "—"; else bar.style.height = `${max ? d.hours/max*80 : 0}px`;
      const label = document.createElement("small"); label.textContent = d.date.slice(-2);
      item.append(bar,label); chart.append(item);
    }
    for(const d of daily) {
      const row = table.tBodies[0].insertRow(); row.dataset.date = d.date;
      for(const [field,value] of [["date",d.date],["state",states[d.state]],["hours",d.hours ?? "未知"],["area",d.effective_area_km2 ?? "未知"]]) {
        const cell = row.insertCell(); cell.dataset.field = field; cell.textContent = value;
      }
    }
    return scale;
  }
  window.OceanMonthEvidence = Object.freeze({render});
})();
