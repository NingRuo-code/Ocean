/* Reports read the selected public projection. Opening one never runs an analysis. */
(function () {
  const {source, sameSource, json} = OceanPublicRead;
  const button = document.createElement("button");
  button.id = "monthlyReportOpen"; button.textContent = "报告预览"; button.disabled = true;
  button.setAttribute("aria-controls", "evidencePanel"); button.setAttribute("aria-expanded", "false");
  $("monthlyDetails").after(button);
  const content = document.createElement("article"); content.id = "monthReport"; content.dataset.state = "empty";
  const status = document.createElement("p"); status.id = "monthReportStatus"; status.setAttribute("role", "status");
  $("monthlyResult").append(status);
  let selection = null, report = null, generation = 0, controller = null;
  let draft = null;
  const idPattern = /^sha256:[0-9a-f]{64}$/;
  const states = {ready:"有效", partial_support:"部分单元有效", unprepared:"未准备", missing:"缺测", read_failed:"读取失败", no_records:"无记录／覆盖未知", unknown_support:"支持未知"};

  function text(parent, tag, value, id) {
    const node = document.createElement(tag); node.textContent = value;
    if(id) node.id = id;
    parent.append(node); return node;
  }
  function conditions(p) { return `${p.month} · ${fmtCoord(p.longitude,p.latitude)} · ${p.radius_km} km`; }
  function stale() {
    if(!report) return "";
    const p = report.result.parameters;
    const changed = draft && ["month","longitude","latitude","radius_km"].some(k => draft[k] !== p[k]);
    return changed || p.month !== state.date.slice(0,7) || p.longitude !== state.lon || p.latitude !== state.lat || p.radius_km !== state.range
      ? "以下报告保留成果原条件，与当前地图或任务草稿不同。" : "";
  }
  function invalidate(value = null) {
    generation++; controller?.abort(); selection = value; report = null;
    if(button.getAttribute("aria-expanded") === "true") OceanEvidence.close(false);
    content.replaceChildren(); content.dataset.state = "empty"; delete content.dataset.reportId;
    button.disabled = !selection; status.textContent = "";
  }
  function verify(value) {
    if(value?.schema_version !== "ocean-known-month-report/v1" || value.report_version !== "known-month-report/v1" || !idPattern.test(value.report_id) ||
      JSON.stringify(value.result) !== JSON.stringify(selection.result) ||
      !value.interpretation || ["summary","relationship","intervals","boundary"].some(k => typeof value.interpretation[k] !== "string" || value.interpretation[k].length > 500)) throw Error("contract");
    return value;
  }
  function render() {
    content.replaceChildren();
    const r = report.result, m = r.metrics;
    text(content, "h3", "月度活动报告 · 合成样例");
    text(content, "p", conditions(r.parameters), "monthReportConditions");
    text(content, "p", `活动小时 H：${m.total_hours ?? "未知"} h；面积时间 E：${m.area_time_km2_days ?? "未知"} km²·d；有效 / 日历日：${m.supported_days} / ${m.calendar_days} 日。`, "monthReportMetrics");
    text(content, "p", `有效日均：${m.mean_hours_per_supported_day ?? "未知"} h/d；面积时间密度：${m.density_hours_per_km2_day ?? "未知"} h/(km²·d)。`);
    text(content, "h4", "事实与解释");
    text(content, "p", report.interpretation.summary);
    text(content, "p", report.interpretation.relationship);
    text(content, "p", report.interpretation.intervals);
    text(content, "h4", "逐日活动小时");
    const wrap = document.createElement("div"); wrap.className = "monthly-chart-wrap";
    const chart = document.createElement("div"); chart.id = "monthReportChart"; chart.className = "monthly-chart";
    chart.setAttribute("role", "img");
    const max = Math.max(0, ...r.daily.map(d => d.hours ?? 0));
    chart.setAttribute("aria-label", `日历日活动小时，纵轴 0–${max} h；有效零与未知分开。`);
    for(const d of r.daily) {
      const item = document.createElement("div"); item.className = "monthly-day";
      item.dataset.state = d.hours === null ? "unknown" : d.hours === 0 ? "zero" : "known";
      item.title = `${d.date} ${states[d.state]} ${d.hours ?? "未知"} h`;
      const bar = document.createElement("i");
      if(d.hours === null) bar.textContent = "—"; else bar.style.height = `${max ? d.hours/max*80 : 0}px`;
      item.append(bar); text(item, "small", d.date.slice(-2)); chart.append(item);
    }
    wrap.append(chart); content.append(wrap);
    text(content, "p", `纵轴 0–${max} h，横轴为日历日；0 为有效零，— 为未知，未知未补零。`);
    const tableWrap = document.createElement("div"); tableWrap.className = "monthly-table-wrap";
    const table = document.createElement("table"); table.id = "monthReportTable";
    const head = table.createTHead().insertRow();
    for(const label of ["日期","状态","活动小时 (h)","有效面积 (km²)"]) text(head,"th",label);
    const body = table.createTBody();
    for(const d of r.daily) {
      const row = body.insertRow(); row.dataset.date = d.date;
      for(const value of [d.date,states[d.state],d.hours ?? "未知",d.effective_area_km2 ?? "未知"]) text(row,"td",value);
    }
    tableWrap.append(table); content.append(tableWrap);
    text(content, "h4", "方法、来源与局限");
    text(content, "p", `方法：${r.parameters.method_version}；参数：${r.parameters.parameter_version}；输入：${r.parameters.input_version}。`);
    text(content, "p", `来源：${r.source.id} / ${r.source.version}；许可：${r.source.license}；支持依据：${r.source.support_evidence}。`);
    for(const note of r.caveats) text(content,"p",note);
    text(content, "p", report.interpretation.boundary);
    const identity = text(content, "details", ""); text(identity,"summary","成果与报告身份");
    text(identity,"p",`${r.result_id} / ${r.projection_id} / ${report.report_id} / ${report.report_version}`);
    content.dataset.state = "ready"; content.dataset.reportId = report.report_id;
  }
  async function open() {
    if(!selection) return;
    if(!sameSource(selection.from,source())) {invalidate();status.textContent = "阅读来源已改变，请重新读取月结果。";return;}
    if(report) {OceanEvidence.open("month-report",button);return;}
    const token = ++generation, from = selection.from;
    controller?.abort(); controller = new AbortController();
    const activeController = controller, timer = setTimeout(() => activeController.abort(),10000);
    content.dataset.state = "reading"; status.textContent = "正在读取原成果报告…";
    try {
      const r = selection.result;
      const value = from.kind === "server"
        ? await json(`${from.base}/query/monthly-analysis/published/${encodeURIComponent(r.result_id)}/report?projection_id=${encodeURIComponent(r.projection_id)}`,activeController.signal)
        : structuredClone(window.OceanKnownMonthReports?.reports.find(item => item.result.projection_id === r.projection_id));
      if(token !== generation) return;
      if(!sameSource(from,source())) throw Error("source_changed");
      report = verify(value); render(); status.textContent = from.kind === "server" ? "服务报告 · 合成样例" : "离线报告 · 合成样例";
      OceanEvidence.open("month-report",button);
    } catch(error) {
      if(token !== generation) return;
      report = null; content.replaceChildren(); content.dataset.state = "error";
      const messages = {http_403:"此成果不允许公开报告阅读。",http_401:"没有报告阅读权限。",http_409:"成果版本已变化，请重新读取月结果。",contract:"报告与所选成果不一致，请重新读取月结果。",source_changed:"阅读来源已改变，请重新读取月结果。"};
      status.textContent = messages[error.message] || "报告暂不可读，请重试。";
    } finally {clearTimeout(timer);}
  }
  OceanEvidence.register("month-report", {content,button,view:() => report ? {title:"月度报告预览",identity:conditions(report.result.parameters),stale:stale()} : null});
  button.onclick = open;
  window.addEventListener("ocean-month-result",e => invalidate(e.detail));
  window.addEventListener("ocean-load-state",() => {if(selection && !sameSource(selection.from,source())) invalidate();});
  window.addEventListener("ocean-month-draft",e => {draft = e.detail; OceanEvidence.sync();});
})();
