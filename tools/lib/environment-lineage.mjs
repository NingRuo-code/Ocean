import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename, realpath, stat } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readSourceSnapshot } from "./source-audit.mjs";

const SCHEMA = "ocean-environment-comparison/v1";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const identifier = value => typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const within = (parent, child) => { const p = relative(parent, child); return p === "" || (!isAbsolute(p) && p !== ".." && !p.startsWith(`..\\`) && !p.startsWith("../")); };
const known = value => value !== null && value !== undefined && value !== "";

function dailySummary(snapshot) {
  return snapshot.sources.map(source => {
    if (!identifier(source.id) || !Array.isArray(source.days) || source.days.some(r => typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)))) throw new Error("Invalid daily summary");
    const rows = source.days.filter(r => r.file_id);
    const unique = values => [...new Set(values)].sort();
    return { source_id: source.id, requested_range: snapshot.range, actual_dates: unique(rows.map(r => r.date)),
      resolution_observed: unique(rows.flatMap(r => r.grid ? [r.grid.lon?.step, r.grid.lat?.step].filter(v => typeof v === "number" && Number.isFinite(v) && v !== 0).map(Math.abs) : [])),
      resolution_declared: unique(rows.map(r => r.resolution_deg_declared).filter(v => typeof v === "number" && Number.isFinite(v) && v > 0)),
      unit_evidence: unique(rows.filter(r => typeof r.unit === "string").map(r => hash([r.unit, r.unit_status ?? r.decoding?.unit_basis ?? "unverified"]))),
      time_verified_dates: unique(rows.filter(r => r.time_verified === true).map(r => r.date)),
      missing_dates: unique(source.days.filter(r => r.state === "missing").map(r => r.date)),
      meaning: "audit_observations_and_declarations; not_research_qualification" };
  });
}

function field(name, left, right) {
  const available = known(left) && known(right);
  return { field: name, status: !available ? "unknown" : hash(left) === hash(right) ? "matched" : "different",
    left_evidence: known(left) ? `sha256:${hash(left)}` : null, right_evidence: known(right) ? `sha256:${hash(right)}` : null };
}

function sourceComparison(a, b, left, right) {
  const fields = [field("processing_version", left.snapshot?.processing_version, right.snapshot?.processing_version),
    field("aggregation_version", left.config.aggregation_version, right.config.aggregation_version)];
  for (const name of ["kind", "role", "product.id", "product.channel", "product.version", "product.unit", "derived_from"])
    fields.push(field(name, name.startsWith("product.") ? a?.product?.[name.slice(8)] : a?.[name], name.startsWith("product.") ? b?.product?.[name.slice(8)] : b?.[name]));
  const claims = s => Array.isArray(s?.license?.claims) ? s.license.claims.map(c => JSON.stringify([c.value, c.evidence])).sort() : null;
  fields.push(field("license_claims", claims(a), claims(b)));
  const da = left.daily?.find(s => s.source_id === (a?.id ?? b.id));
  const db = right.daily?.find(s => s.source_id === (a?.id ?? b.id));
  for (const [name, key] of [["requested_range", "requested_range"], ["dates", "actual_dates"], ["resolution_observed", "resolution_observed"], ["resolution_declared", "resolution_declared"], ["units", "unit_evidence"], ["time_verified_dates", "time_verified_dates"], ["missing_dates", "missing_dates"]])
    fields.push(field(`daily.${name}`, da && (key === "missing_dates" || da[key]?.length) ? da[key] : null, db && (key === "missing_dates" || db[key]?.length) ? db[key] : null));
  const complete = source => source?.inspection?.access === "readable" && Array.isArray(source.files) && source.files.length > 0;
  const fingerprints = source => source.files.map(f => `${f.sha256}:${f.bytes}`).sort();
  const content = { status: complete(a) && complete(b) ? hash(fingerprints(a)) === hash(fingerprints(b)) ? "matched" : "different" : "unknown",
    basis: "sha256_multiset; names_sizes_or_health_alone_are_insufficient" };
  const reasons = [];
  if (!a || !b) reasons.push("source_evidence_unavailable");
  if ([a, b].some(s => s?.license?.status === "conflict")) reasons.push("license_claim_conflict");
  if ([a, b].some(s => (s?.gaps ?? []).some(g => g === "lineage_cycle" || g.startsWith("lineage_unknown:")))) reasons.push("lineage_support_unknown");
  const parents = [...new Set([...(a?.derived_from ?? []), ...(b?.derived_from ?? [])])];
  for (const id of parents) {
    const x = left.snapshot?.sources.find(s => s.id === id), y = right.snapshot?.sources.find(s => s.id === id);
    fields.push(field(`lineage.${id}.content`, complete(x) ? fingerprints(x) : null, complete(y) ? fingerprints(y) : null));
  }
  if (content.status === "unknown") reasons.push("complete_nonempty_content_evidence_required");
  const status = content.status === "different" || fields.some(f => f.status === "different") ? "different" : content.status === "unknown" || fields.some(f => f.status === "unknown") || reasons.length ? "unknown" : "matched";
  return { source_id: a?.id ?? b.id, status, content, fields, reasons };
}

async function canonical(path) {
  try { return await realpath(path); }
  catch (error) { if (error.code !== "ENOENT") throw error; const parent = dirname(path); if (parent === path) throw error; return resolve(await canonical(parent), relative(parent, path)); }
}

async function atomic(path, text) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, { flag: "wx" });
  await rename(temporary, path);
}

export async function runEnvironmentComparison(args) {
  const option = name => { const i = args.indexOf(name); if (i < 0) return null; if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Missing argument"); return resolve(args[i + 1]); };
  const frozen = option("--read-environment-comparison");
  if (frozen) {
    if ((await stat(frozen)).size > 16 * 1024 * 1024) throw new Error("Comparison budget exceeded");
    const report = JSON.parse(await readFile(frozen, "utf8"));
    const { comparison_id, generated_at, ...identity } = report;
    if (report.schema !== SCHEMA || comparison_id !== `sha256:${hash(identity)}` || report.research_ready !== false || report.public_release_approved !== false) throw new Error("Invalid comparison");
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  const configPath = option("--compare-environments");
  if (!configPath) throw new Error("Missing configuration");
  if ((await stat(configPath)).size > 64 * 1024) throw new Error("Configuration budget exceeded");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.schema !== "ocean-environment-lineage-config/v1" || !Array.isArray(config.environments) || config.environments.length < 2 || config.environments.length > 8) throw new Error("Invalid environment configuration");
  const ids = new Set();
  const inputs = [configPath], environments = [];
  for (const entry of config.environments) {
    if (!identifier(entry.id) || ids.has(entry.id) || !["synthetic", "real_local_artifacts", "captured_remote_artifacts"].includes(entry.evidence_kind)) throw new Error("Invalid environment");
    ids.add(entry.id);
    if (entry.deployment_commit != null && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(entry.deployment_commit)) throw new Error("Invalid deployment identity");
    if (entry.aggregation_version != null && (typeof entry.aggregation_version !== "string" || entry.aggregation_version.length > 256)) throw new Error("Invalid aggregation identity");
    if (entry.acquired_at != null && (typeof entry.acquired_at !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(entry.acquired_at) || !Number.isFinite(Date.parse(entry.acquired_at)))) throw new Error("Invalid acquisition time");
    let snapshot = null, daily = null, dailyId = null;
    if (entry.source_snapshot) {
      const path = resolve(dirname(configPath), entry.source_snapshot);
      inputs.push(path);
      if ((await stat(path)).size > 16 * 1024 * 1024) throw new Error("Source snapshot budget exceeded");
      snapshot = await readSourceSnapshot(path);
      if (!Array.isArray(snapshot.sources) || new Set(snapshot.sources.map(s => s.id)).size !== snapshot.sources.length) throw new Error("Invalid source identities");
      for (const source of snapshot.sources) {
        if (!identifier(source.id) || !["front", "sst", "activity", "response"].includes(source.kind) || !["analysis_source", "display", "precomputed"].includes(source.role) || !Array.isArray(source.files) || source.files.some(f => !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.bytes) || f.bytes < 0)) throw new Error("Invalid source evidence");
        if (!Array.isArray(source.derived_from) || source.derived_from.some(id => !identifier(id)) || !Array.isArray(source.gaps) || source.gaps.some(g => typeof g !== "string")) throw new Error("Invalid source lineage");
      }
    }
    if (entry.daily_snapshot) {
      const path = resolve(dirname(configPath), entry.daily_snapshot);
      inputs.push(path);
      if ((await stat(path)).size > 16 * 1024 * 1024) throw new Error("Daily snapshot budget exceeded");
      const reader = resolve(dirname(fileURLToPath(import.meta.url)), "../audit_daily_sources.py");
      const result = spawnSync(process.env.OCEAN_AUDIT_PYTHON || "python", [reader, "--read-daily-snapshot", path], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30000 });
      if (result.error || result.status !== 0) throw new Error("Invalid daily evidence");
      const report = JSON.parse(result.stdout);
      if (!snapshot || report.source_snapshot_id !== snapshot.snapshot_id) throw new Error("Mismatched daily evidence");
      if (!Array.isArray(report.range) || report.range.length !== 2 || report.range.some(v => typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) || report.sources.some(s => !snapshot.sources.some(parent => parent.id === s.id))) throw new Error("Invalid daily scope");
      daily = dailySummary(report);
      dailyId = report.daily_snapshot_id;
    }
    const reasons = snapshot ? [] : ["source_snapshot_unavailable; capture_registered_source_snapshot"];
    if (snapshot?.sources.some(s => /latest/i.test(s.product?.version ?? "")) && !entry.acquired_at) reasons.push("dynamic_latest_acquisition_unknown");
    if (!entry.deployment_commit) reasons.push("deployment_identity_unavailable; obtain_environment_commit_evidence");
    environments.push({ config: entry, snapshot, daily, dailyId, reasons });
  }
  const output = option("--out"), markdown = option("--report-out");
  const targets = await Promise.all([output, markdown].filter(Boolean).map(canonical));
  const evidencePaths = await Promise.all(inputs.map(canonical));
  if (targets.some((t, i) => evidencePaths.some(p => within(t, p)) || targets.some((other, j) => i !== j && (within(t, other) || within(other, t))))) throw new Error("Overlapping output");
  const comparisons = [];
  for (let i = 0; i < environments.length; i++) for (let j = i + 1; j < environments.length; j++) {
    const a = environments[i], b = environments[j];
    const ids = [...new Set([...(a.snapshot?.sources ?? []), ...(b.snapshot?.sources ?? [])].map(s => s.id))].sort();
    comparisons.push({ left: a.config.id, right: b.config.id, deployment: field("deployment_commit", a.config.deployment_commit, b.config.deployment_commit),
      sources: ids.map(id => sourceComparison(a.snapshot?.sources.find(s => s.id === id), b.snapshot?.sources.find(s => s.id === id), a, b)) });
  }
  const identity = { schema: SCHEMA, contract: "environment-lineage/v1", implementation_fingerprint: hash(await readFile(fileURLToPath(import.meta.url), "utf8")), environments: environments.map(({ config: e, snapshot, daily, dailyId, reasons }) => ({
    id: e.id, evidence_kind: e.evidence_kind, snapshot_id: snapshot?.snapshot_id ?? null, deployment_commit: e.deployment_commit ?? null,
    daily_snapshot_id: dailyId, daily_summary: daily,
    acquired_at: e.acquired_at ? new Date(e.acquired_at).toISOString() : null,
    acquisition_basis: e.acquired_at ? "maintainer_declaration; not_snapshot_generation_time" : "unknown", deployment_basis: e.deployment_commit ? "maintainer_evidence_declaration" : "unknown", reasons,
  })), comparisons, research_ready: false, public_release_approved: false };
  const report = { ...identity, comparison_id: `sha256:${hash(identity)}`, generated_at: new Date().toISOString() };
  if (output) await atomic(output, JSON.stringify(report, null, 2) + "\n");
  else process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (markdown) await atomic(markdown, ["# Ocean 环境资料身份比较", "", `比较：${report.comparison_id}`, "", "内容相同不代表部署、语义、覆盖或许可通过；unknown保留未核实。", "", "| 环境 | 证据类别 | 部署提交（声明） | 取得时刻（声明） | 未核项 |", "| --- | --- | --- | --- | --- |",
    ...identity.environments.map(e => `| ${e.id} | ${e.evidence_kind} | ${e.deployment_commit ?? "unknown"} | ${e.acquired_at ?? "unknown"} | ${e.reasons.join(", ")} |`), "", "| 环境 | 来源 | 整体 | 内容 | 字段原因 |", "| --- | --- | --- | --- | --- |",
    ...comparisons.flatMap(c => c.sources.map(s => `| ${c.left} / ${c.right} | ${s.source_id} | ${s.status} | ${s.content.status} | ${[...s.fields.filter(f => f.status !== "matched").map(f => `${f.field}:${f.status}`), ...s.reasons].join(", ")} |`)), ""].join("\n"));
}
