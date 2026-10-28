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
  const downloads = new Set();
  let downloadBusy = false;
  let draft = null;
  const idPattern = /^sha256:[0-9a-f]{64}$/;

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
    for(const url of downloads) URL.revokeObjectURL(url);
    downloads.clear(); downloadBusy = false;
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
    wrap.append(chart); content.append(wrap);
    const scale = text(content, "p", "");
    const tableWrap = document.createElement("div"); tableWrap.className = "monthly-table-wrap";
    const table = document.createElement("table"); table.id = "monthReportTable";
    const head = table.createTHead().insertRow();
    for(const label of ["日期","状态","活动小时 (h)","有效面积 (km²)"]) text(head,"th",label);
    table.createTBody();
    scale.textContent = OceanMonthEvidence.render(chart,table,r.daily)+" 0 为有效零，未知未补零。";
    tableWrap.append(table); content.append(tableWrap);
    text(content, "h4", "方法、来源与局限");
    text(content, "p", `方法：${r.parameters.method_version}；参数：${r.parameters.parameter_version}；输入：${r.parameters.input_version}。`);
    text(content, "p", `来源：${r.source.id} / ${r.source.version}；许可：${r.source.license}；支持依据：${r.source.support_evidence}。`);
    for(const note of r.caveats) text(content,"p",note);
    text(content, "p", report.interpretation.boundary);
    const identity = text(content, "details", ""); text(identity,"summary","成果与报告身份");
    text(identity,"p",`${r.result_id} / ${r.projection_id} / ${report.report_id} / ${report.report_version}`);
    const actions = document.createElement("div"); actions.className = "monthly-actions";
    for(const [format,label,id] of [["markdown","下载 Markdown 报告","monthReportMarkdown"],["csv","下载逐日汇总 CSV","monthReportCsv"]]) {
      const action = text(actions,"button",label,id); action.onclick = () => download(format);
    }
    content.append(actions);
    text(content,"p","文件只含本合成成果的允许聚合；未知日留空，真实研究与 PDF 导出尚未验收。","monthReportDownloadStatus");
    content.dataset.state = "ready"; content.dataset.reportId = report.report_id;
  }
  async function download(format) {
    if(!report || !selection || downloadBusy) return;
    if(!sameSource(selection.from,source())) {invalidate();status.textContent = "阅读来源已改变，请重新读取月结果。";return;}
    const token = generation, frozen = report, from = selection.from;
    downloadBusy = true;
    $("monthReportMarkdown").disabled = true; $("monthReportCsv").disabled = true;
    $("monthReportDownloadStatus").textContent = "正在核对当前公开权限与报告版本…";
    controller?.abort();controller = new AbortController();
    const activeController = controller, timer = setTimeout(() => activeController.abort(),10000);
    try {
      const r = frozen.result;
      let data;
      if(from.kind === "server") data = await OceanPublicRead.text(`${from.base}/query/monthly-analysis/published/${encodeURIComponent(r.result_id)}/report/${format}?projection_id=${encodeURIComponent(r.projection_id)}&report_id=${encodeURIComponent(frozen.report_id)}`,activeController.signal);
      else {
        if(window.OceanKnownMonthReports?.schema_version !== "ocean-offline-month-reports/v1") throw Error("contract");
        data = window.OceanKnownMonthReports.exports?.[frozen.report_id]?.[format];
        if(typeof data !== "string" || new TextEncoder().encode(data).length > 1048576) throw Error("contract");
      }
      if(token !== generation) return;
      if(!sameSource(from,source())) throw Error("source_changed");
      const extension = format === "markdown" ? "md" : "csv";
      const url = URL.createObjectURL(new Blob([data],{type:format === "markdown" ? "text/markdown;charset=utf-8" : "text/csv;charset=utf-8"}));
      downloads.add(url);
      const link = document.createElement("a");link.href = url;
      link.download = `Ocean-month-${r.parameters.month}-${r.result_id.slice(7,19)}-${frozen.report_id.slice(7,19)}.${extension}`;
      document.body.append(link);link.click();link.remove();
      setTimeout(() => {URL.revokeObjectURL(url);downloads.delete(url);},1000);
      $("monthReportDownloadStatus").textContent = "文件已交给浏览器下载；内容对应当前报告原条件。";
    } catch(error) {
      if(token !== generation) return;
      invalidate(selection);
      status.textContent = ["http_401","http_403"].includes(error.message) ? "此成果当前不允许下载，请重新读取月结果。" : error.message === "http_409" ? "成果或报告版本已变化，请重新读取月结果。" : "下载未完成，请重新预览报告后重试。";
    } finally {
      clearTimeout(timer);
      if(token === generation) {downloadBusy = false;$("monthReportMarkdown").disabled = false;$("monthReportCsv").disabled = false;}
    }
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
  function cancelPending() {if(content.dataset.state === "reading") invalidate(selection);}
  window.addEventListener("ocean-history-view",e => {if(e.detail !== "monthly") cancelPending();});
  window.addEventListener("ocean-workbench-task",cancelPending);
})();
