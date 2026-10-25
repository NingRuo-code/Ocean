/* Display mappings only; no spatial interpolation or changes to source values. */
(function () {
  const manifest = window.OF_DISPLAY_DOMAINS, thermal = window.OF_PALETTES.cmocean_thermal.colors;
  const purples = window.OF_PALETTES.MPL_Purples.colors.slice(0, 65).reverse();
  let local = null, restoreSst = false;
  function paletteColor(colors, t) {
    const x = Math.max(0, Math.min(1, t)) * (colors.length - 1), a = colors[Math.floor(x)], b = colors[Math.ceil(x)];
    return "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - x % 1) + parseInt(b.slice(i, i + 2), 16) * (x % 1)).toString(16).padStart(2, "0")).join("");
  }
  function sstDomain() { return local?.domain || manifest.sst.domain; }
  function sstStyle(value) {
    const [min, max] = sstDomain();
    return { color: Number.isFinite(value) ? paletteColor(thermal, (value - min) / (max - min)) : "none",
      range: !Number.isFinite(value) ? "missing" : value < min ? "below" : value > max ? "above" : "within" };
  }
  function enhance(sources, box, date) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < sources.length; i++) {
      const { sst } = sources[i];
      const g = sst.grid;
      for (const [row, col, count, bin] of sst.runs || []) {
        const lat = g.lat0 + row * g.dlat, left = g.lon0 + col * g.dlon, right = left + (count - 1) * g.dlon;
        if (lat < box.latMin || lat > box.latMax || right < box.lonMin || left > box.lonMax) continue;
        const start = Math.max(col, Math.ceil((box.lonMin - g.lon0) / g.dlon)), end = Math.min(col + count - 1, Math.floor((box.lonMax - g.lon0) / g.dlon));
        let visible = false;
        for (let c = start; c <= end && !visible; c++) {
          const lon = g.lon0 + c * g.dlon;
          visible = !sources.slice(0, i).some(other => {
            const f = other.sst.grid, x = Math.round((lon - f.lon0) / f.dlon), y = Math.round((lat - f.lat0) / f.dlat);
            return x >= 0 && x < f.nx && y >= 0 && y < f.ny;
          });
        }
        if (!visible) continue;
        const v = bin * sst.bin_c;
        if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
      }
    }
    if (!Number.isFinite(min)) return false;
    if (min === max) { min -= 0.25; max += 0.25; }
    local = { domain: [min, max], date, box }; return true;
  }
  function gradient(colors) { return "linear-gradient(90deg," + colors.map((color, i) => color + " " + i * 100 / (colors.length - 1) + "%").join(",") + ")"; }
  function sstModeLabel() {
    if (local) return "局部增强";
    const scope = manifest.sst, sources = OFData.sstSources(state.date);
    const matches = !OFData.serverEnabled() && scope.dates.includes(state.date) && sources.length && sources.every(({ sst }) =>
      sst.product?.id === scope.product.id && sst.product?.version === scope.product.version && sst.bin_c === scope.bin_c);
    return matches ? "限定归档固定" : "固定参照 / 适用性待确认";
  }
  function effortScale(day) {
    const scope = manifest.effort;
    return scope && ["scoped", "synthetic"].includes(scope.status) && Array.isArray(scope.domain) && scope.domain.length === 2 &&
      scope.domain.every(Number.isFinite) && scope.domain[0] === 0 && scope.domain[1] > 0 &&
      Array.isArray(scope.dates) && scope.dates.includes(day?.date) && typeof scope.evidence_id === "string" && scope.evidence_id.length > 0 &&
      typeof scope.version === "string" && scope.version.length > 0 && ["hours", "fishing_hours"].includes(scope.unit) &&
      ["hours", "hour", "fishing_hours", "h"].includes(day?.source?.unit) && day?.source?.dataset === scope.product?.id &&
      typeof scope.product?.id === "string" && typeof scope.product?.version === "string" && day?.version === scope.product.version &&
      Number.isFinite(scope.resolution_deg) && scope.resolution_deg > 0 && day?.spatial_resolution_deg === scope.resolution_deg ? scope : null;
  }
  function effortStyle(day, hours) {
    const scale = effortScale(day);
    if (!scale) return { color: "#bfc8d0", radius: 3, range: hours === 0 ? "zero" : "pending", quantitative: false };
    if (hours === 0) return { color: purples[0], radius: 2.5, range: "zero", quantitative: true };
    const t = Math.min(1, Math.log1p(hours) / Math.log1p(scale.domain[1]));
    return { color: paletteColor(purples, t), radius: 2.5 + 6 * Math.sqrt(t), range: hours > scale.domain[1] ? "above" : "within", quantitative: true };
  }
  function effortLabel(day) {
    const scale = effortScale(day);
    return scale ? "0–" + scale.domain[1] + " h / 对数 log1p / " + (scale.status === "synthetic" ? "合成合同域（非实证）" : "限定资料域") : "活动标尺待确认 / 统一标记";
  }
  window.OFColors = { sstStyle, sstDomain, sstModeLabel, sstGradient: () => gradient(thermal), enhance,
    effortScale, effortStyle, effortLabel, effortGradient: () => gradient(purples),
    fixed: () => { local = null; }, local: () => local, manifest,
    restoreSst: () => restoreSst, setRestoreSst: value => { restoreSst = value; },
    sstOpacity: () => state.layers.ground && !restoreSst ? 0.27 : 0.64 };
})();
