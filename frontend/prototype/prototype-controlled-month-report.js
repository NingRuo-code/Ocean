/* Owner previews read only completed month records from the selected service. */
(function () {
  const {source, sameSource, json} = OceanPublicRead;
  const root = document.createElement("details");
  root.id = "distanceReportControls";
  root.innerHTML = `<summary>本人月度距离报告</summary>
    <label>本人读取令牌 <input id="distanceReportToken" type="password" autocomplete="off" spellcheck="false"></label>
    <button type="button" id="distanceReportList">读取已完成结果</button>
    <label class="monthly-select">已有结果 <select id="distanceReportSelect" disabled></select></label>
    <button type="button" id="distanceReportOpen" aria-controls="evidencePanel" aria-expanded="false" disabled>预览所选报告</button>
    <p id="distanceReportStatus" role="status"></p>`;
  $("monthlyResult").after(root);
  const token = $("distanceReportToken"), list = $("distanceReportList");
  const select = $("distanceReportSelect"), open = $("distanceReportOpen"), status = $("distanceReportStatus");
  const content = document.createElement("article");
  content.id = "controlledMonthReport";
  const runId = /^[0-9a-f]{32}$/;
  const hash = /^sha256:[0-9a-f]{64}$/;
  const documentStart = "<!DOCTYPE html>";
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`;
  const conditionKeys = ["month", "longitude", "latitude", "radius_km"];
  let from = source(), catalog = [], report = null, draft = null, controller = null;

  function describe(item) {
    const p = item.parameters;
    return `${p.month} · ${fmtCoord(p.longitude, p.latitude)} · ${p.radius_km} km`;
  }

  function update() {
    root.hidden = from.kind !== "server";
    list.disabled = !token.value || Boolean(controller);
    select.disabled = !catalog.length;
    open.disabled = !select.value || Boolean(controller);
  }

  function clearReport() {
    controller?.abort();
    controller = null;
    report = null;
    if (open.getAttribute("aria-expanded") === "true") OceanEvidence.close(false);
    content.replaceChildren();
    delete content.dataset.reportId;
  }

  function reset(message = "") {
    clearReport();
    catalog = [];
    select.replaceChildren();
    status.textContent = message;
    update();
  }

  async function read(path, message, consume) {
    if (!sameSource(from, source()) || from.kind !== "server" || !token.value) return;
    const active = new AbortController();
    controller = active;
    update();
    status.textContent = message;
    const timer = setTimeout(() => active.abort(), 10000);
    try {
      const value = await json(from.base + "/query/monthly-analysis" + path, active.signal, {
        headers: {Authorization: "Bearer " + token.value}, redirect: "error",
      });
      if (controller !== active || !sameSource(from, source())) return;
      if (active.signal.aborted) throw Error("timeout");
      consume(value);
    } catch (error) {
      if (controller !== active) return;
      if (["http_401", "http_403"].includes(error.message)) {
        token.value = "";
        reset("本人报告读取未获授权。");
      } else {
        status.textContent = ["http_404", "http_409"].includes(error.message)
          ? "所选结果已不可用，请重新读取目录。" : "报告资料读取失败，请重试。";
      }
    } finally {
      clearTimeout(timer);
      if (controller === active) controller = null;
      update();
    }
  }

  function validItem(item) {
    const p = item?.parameters;
    return runId.test(item?.id) && hash.test(item.result_id) &&
      ["synthetic", "audited_cells"].includes(item.evidence_kind) &&
      /^\d{4}-\d{2}$/.test(p?.month) && [p.longitude, p.latitude, p.radius_km].every(Number.isFinite);
  }

  function show(value, chosen) {
    if (value?.schema_version !== "ocean-distance-report/v1" || !hash.test(value.report_id) ||
        value.result_id !== chosen.result_id || value.evidence_kind !== chosen.evidence_kind ||
        !conditionKeys.every(key => value.parameters?.[key] === chosen.parameters[key]) ||
        typeof value.html !== "string" || !value.html.startsWith(documentStart)) throw Error("contract");
    const frame = document.createElement("iframe");
    frame.id = "distanceReportFrame";
    frame.title = "月度距离报告正文";
    // The parent can forward Escape. The sandbox disables scripts in the report.
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.style.cssText = "width:100%;height:36vh;min-height:12rem;border:0";
    frame.addEventListener("load", () => {
      frame.contentDocument?.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          event.preventDefault();
          OceanEvidence.close();
        }
      });
    });
    frame.srcdoc = documentStart + policy + value.html.slice(documentStart.length);
    report = value;
    content.dataset.reportId = value.report_id;
    const boundary = document.createElement("p");
    boundary.textContent = "本报告为月度距离分析。事件与区域比较报告待接入。";
    content.replaceChildren(boundary, frame);
    status.textContent = chosen.evidence_kind === "synthetic" ? "已读取合成距离参照。" : "已读取本人登记的距离参照。";
    OceanEvidence.open("controlled-month-report", open);
  }

  OceanEvidence.register("controlled-month-report", {content, button:open, view:() => {
    if (!report) return null;
    const p = report.parameters;
    const stale = p.month !== state.date.slice(0, 7) || p.longitude !== state.lon ||
      p.latitude !== state.lat || p.radius_km !== state.range ||
      (draft && conditionKeys.some(key => draft[key] !== p[key]));
    return {title:"月度距离报告预览", identity:describe(report),
      stale:stale ? "报告保留所选结果的原条件。" : ""};
  }});
  list.onclick = () => {
    reset();
    read("/reports", "正在读取已完成结果…", value => {
      if (value?.schema_version !== "ocean-distance-report-catalog/v1" || !Array.isArray(value.runs) ||
          value.runs.length > 256 || !value.runs.every(validItem) || new Set(value.runs.map(run => run.id)).size !== value.runs.length) {
        throw Error("contract");
      }
      catalog = value.runs;
      for (const run of catalog) {
        const option = document.createElement("option");
        option.value = run.id;
        const kind = run.evidence_kind === "synthetic" ? "合成参照" : "登记参照";
        option.textContent = `${describe(run)} · ${kind} · ${run.result_id.slice(7, 19)}`;
        select.append(option);
      }
      status.textContent = catalog.length ? "请选择要预览的原结果。" : "当前服务没有已完成的距离结果。";
    });
  };
  open.onclick = () => {
    const chosen = catalog.find(run => run.id === select.value);
    if (!chosen) return;
    clearReport();
    read(`/${chosen.id}/report?` + new URLSearchParams({result_id:chosen.result_id}),
      "正在读取冻结报告…", value => show(value, chosen));
  };
  token.addEventListener("input", () => reset());
  select.addEventListener("change", () => {clearReport(); status.textContent = "请选择预览。"; update();});
  window.addEventListener("ocean-load-state", () => {
    const next = source();
    if (sameSource(from, next)) return;
    from = next;
    token.value = "";
    reset();
  });
  window.addEventListener("ocean-month-draft", event => {draft = event.detail; OceanEvidence.sync();});
  window.addEventListener("ocean-history-view", event => {
    if (event.detail !== "monthly") {clearReport(); status.textContent = ""; update();}
  });
  window.addEventListener("ocean-workbench-task", () => {
    if (controller) {clearReport(); status.textContent = ""; update();}
  });
  update();
})();
