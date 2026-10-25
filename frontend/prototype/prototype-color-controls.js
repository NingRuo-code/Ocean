(function () {
  const settings = document.createElement("section"); settings.id = "colorSettings";
  settings.innerHTML = '<h4 tabindex="-1" id="colorSettingsHeading">显示标尺</h4><p id="sstDomainInfo" role="status"></p><div class="color-actions"><button id="sstLocalEnhance">局部增强</button><button id="sstFixed">返回固定温标</button><button id="sstRestore" aria-pressed="false">恢复完整海温</button></div><details><summary>来源与精度</summary><p>色表：<a href="https://www.ncl.ucar.edu/Document/Graphics/ColorTables/cmocean_thermal.shtml" target="_blank" rel="noopener">NCL cmocean_thermal</a>。固定域仅来自当前登记的归档资料，不是全年正式温标。局部增强只改变颜色，保持原网格、0.5°C 源分档与实际读数，不补缺测、不生成更细温度。下/上越界有独立边框；无水温不着温度色。</p><p id="sstDomainSource"></p></details>';
  $("layerDrawer").append(settings);
  const effortInfo = document.createElement("p"); effortInfo.id = "effortDomainInfo"; effortInfo.setAttribute("role", "status"); settings.append(effortInfo);
  const effortSource = document.createElement("p"); effortSource.innerHTML = '<a href="https://www.ncl.ucar.edu/Document/Graphics/ColorTables/MPL_Purples.shtml" target="_blank" rel="noopener">NCL MPL_Purples</a> 反向明亮段；仅有已登记资料域时使用对数颜色和大小。0 小时为空心点。地图仍保留分位筛选与最多 700 点限制，不代表活动全集。'; settings.append(effortSource);
  function update() {
    const domain = OFColors.sstDomain(), local = OFColors.local(), scope = OFColors.manifest.sst;
    $("sstDomainInfo").textContent = (local ? "局部增强（锁定 " + local.date + " 视野）" : OFColors.sstModeLabel()) + "：" + domain.join("–") + " °C" + (local && local.date !== state.date ? "；日期已变，请重新增强或返回固定。" : "");
    document.querySelectorAll(".swatch.sst").forEach(node => { node.style.background = OFColors.sstGradient(); });
    $("sstDomainSource").textContent = scope.dates[0] + " 至 " + scope.dates.at(-1) + "，" + scope.sources.length + " 份归档导出 / " + scope.product.id + " " + scope.product.version + " / " + scope.version + "。其他日期或服务资料的正式适用域待确认，仍以此固定参照显示，越界不改真实读数。";
    $("sstRestore").setAttribute("aria-pressed", String(OFColors.restoreSst()));
    const fishing = OFData.fishingDay(state.date), scale = OFColors.effortScale(fishing);
    effortInfo.textContent = OFColors.effortLabel(fishing) + (scale ? " / " + scale.version + "。仅改变显示，读数保留实际小时。" : "。当前使用统一大小标记，不编码强弱；原始小时仍可查询，范围累计仍是部分记录。全年正式域与来源版本待数据审计。 ");
    document.querySelectorAll(".swatch.ground").forEach(node => { node.style.background = scale ? OFColors.effortGradient() : "#bfc8d0"; });
  }
  function redraw() { renderLegend(); drawMap(); renderProbe(); update(); }
  $("sstLocalEnhance").onclick = () => {
    const box = OFMap.visibleBounds(_view, mapAspect());
    if (!box || !OFColors.enhance(sstDisplaySources(), box, state.date)) { showToast("当前视野没有可用水温，保持现有温标"); return; }
    redraw();
  };
  $("sstFixed").onclick = () => { OFColors.fixed(); redraw(); };
  $("sstRestore").onclick = () => { OFColors.setRestoreSst(!OFColors.restoreSst()); redraw(); };
  document.addEventListener("click", e => {
    const button = e.target.closest?.("#sstLegendOpen,#effortLegendOpen");
    if (!button) return;
    window.dispatchEvent(new CustomEvent("ocean-colors-open", { detail: { opener: button.id } }));
    $("colorSettingsHeading").focus({ preventScroll: true }); settings.scrollIntoView({ block: "nearest" });
  });
  window.addEventListener("ocean-applied-context", update);
  window.addEventListener("ocean-load-state", update);
  update(); renderLegend();
})();
