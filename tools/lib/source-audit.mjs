import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, rename, lstat, readdir, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, extname } from "node:path";

const SCHEMA = "ocean-source-audit/v1";
const CONTRACT = "source-registration/v1";
const extensions = new Set([".js", ".json", ".csv", ".nc", ".nc4", ".parquet"]);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const within = (root, target) => {
  const rel = relative(root, target);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("..\\") && !rel.startsWith("../"));
};

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
  await rename(temporary, path);
}

async function canonicalTarget(path) {
  const absolute = resolve(path);
  try { return await realpath(absolute); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = dirname(absolute);
    if (parent === absolute) throw error;
    return resolve(await canonicalTarget(parent), relative(parent, absolute));
  }
}

async function inspectSource(source, root, budget, privateLocations) {
  const product = Object.fromEntries(["id", "channel", "version", "unit"].map((key) => [key, source.product?.[key] ?? null]));
  const missing = Object.entries(product).filter(([, value]) => !value).map(([key]) => `product.${key}`);
  const files = [];
  const issues = [];
  const seen = new Set();
  let discovered = 0;
  let bytes = 0;
  let locationsRead = 0;
  const visit = async (path) => {
    if (budget.files <= 0) { issues.push("file_budget_exceeded"); return; }
    const actual = await realpath(path);
    if (!within(root, actual)) { issues.push("outside_source_root"); return; }
    if (seen.has(actual)) return;
    seen.add(actual);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) { issues.push("symbolic_link_not_followed"); return; }
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort()) {
        if (budget.files <= 0) { issues.push("file_budget_exceeded"); break; }
        await visit(resolve(path, name));
      }
      return;
    }
    if (!stat.isFile() || !extensions.has(extname(path).toLowerCase())) return;
    discovered++;
    budget.files--;
    if (stat.size > budget.bytes) { issues.push("byte_budget_exceeded"); return; }
    const hash = createHash("sha256");
    let size = 0;
    for await (const chunk of createReadStream(path)) {
      size += chunk.length;
      if (size > budget.bytes) throw Object.assign(new Error("budget"), { code: "BYTE_BUDGET" });
      hash.update(chunk);
    }
    budget.bytes -= size;
    bytes += size;
    const id = `${source.id}:${String(files.length + 1).padStart(4, "0")}`;
    files.push({ id, bytes: size, sha256: hash.digest("hex") });
    privateLocations.push({ id, path: actual });
  };
  for (const location of source.locations ?? []) {
    const path = resolve(root, location);
    privateLocations.push({ source: source.id, location: path });
    if (!within(root, path)) { issues.push("outside_source_root"); continue; }
    try { await visit(path); locationsRead++; }
    catch (error) { issues.push(error.code === "ENOENT" ? "missing_location" : `access_${error.code ?? "unknown"}`); }
  }
  const claims = (source.license_claims ?? []).map((claim) => ({ value: claim.value ?? null, evidence: claim.evidence ?? null }));
  const distinct = new Set(claims.map((claim) => claim.value?.trim().toLowerCase()).filter(Boolean));
  const access = files.length ? (issues.length ? "partial" : "readable") :
    (issues.some(i => i.includes("budget") || i.startsWith("access_")) ? "unknown" : locationsRead ? "empty" : issues.includes("missing_location") ? "missing" : "unknown");
  return {
    id: source.id, kind: source.kind, role: source.role, product,
    derived_from: source.derived_from ?? [],
    inspection: { declaration: missing.length ? "incomplete" : "complete", access,
      semantic_verification: "not_performed", effective_support: "unknown" },
    license: { status: distinct.size > 1 ? "conflict" : distinct.size ? "unverified" : "unknown", claims,
      public_release_approved: false },
    inventory: { files_read: files.length, files_discovered: discovered || (locationsRead ? 0 : null),
      bytes_read: files.length ? bytes : locationsRead ? 0 : null },
    files, gaps: [...new Set([...missing, ...issues, ...(!(source.locations?.length) ? ["locations_unknown"] : []),
      "semantic_verification_pending", "effective_support_unknown", "license_review_required"])],
  };
}

function markdown(snapshot) {
  return ["# Ocean 来源审计快照", "", `- 快照：${snapshot.snapshot_id}`, `- 生成时间：${snapshot.generated_at}`,
    "- 文件可读不等于语义已核实、有效观测或研究就绪；许可声明不等于公开批准。", "",
    "| 来源 | 类型 / 角色 | 可读状态 | 许可 | 语义 / 有效支持 | 待核项 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...snapshot.sources.map((s) => `| ${s.id} | ${s.kind} / ${s.role} | ${s.inspection.access} | ${s.license.status} | ${s.inspection.semantic_verification} / unknown | ${s.gaps.join(", ")} |`), ""].join("\n");
}

export async function runSourceAudit(args, defaultRoot) {
  const option = (name) => {
    const index = args.indexOf(name);
    if (index < 0) return null;
    if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} requires a value`);
    return args[index + 1];
  };
  const frozen = option("--read-snapshot");
  if (frozen) {
    const snapshot = await readSourceSnapshot(resolve(frozen));
    process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
    return;
  }
  const registryPath = resolve(option("--source-registry"));
  const root = await realpath(resolve(option("--source-root") ?? defaultRoot));
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  if (registry.schema !== "ocean-source-registry/v1" || !Array.isArray(registry.sources)) throw new Error("Invalid source registry");
  const ids = new Set();
  for (const source of registry.sources) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(source.id) || ids.has(source.id) ||
      !["front", "sst", "activity", "response"].includes(source.kind) ||
      !["analysis_source", "display", "precomputed"].includes(source.role)) throw new Error("Invalid source declaration");
    for (const key of ["locations", "derived_from", "license_claims"]) {
      if (source[key] != null && !Array.isArray(source[key])) throw new Error("Invalid declaration list");
    }
    if ((source.locations ?? []).some((v) => typeof v !== "string") ||
      (source.derived_from ?? []).some((v) => typeof v !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(v))) throw new Error("Invalid declaration reference");
    if ((source.license_claims ?? []).some((v) => !v || typeof v.value !== "string" || typeof v.evidence !== "string")) throw new Error("Invalid license evidence");
    if (Object.values(source.product ?? {}).some((v) => v != null && typeof v !== "string")) throw new Error("Invalid product declaration");
    ids.add(source.id);
  }
  const output = option("--out");
  const report = option("--report-out");
  const internal = option("--private-out");
  const targets = await Promise.all([output, report, internal].filter(Boolean).map(canonicalTarget));
  const inputs = await Promise.all([registryPath, ...registry.sources.flatMap((s) => (s.locations ?? []).map((p) => resolve(root, p)))].map(canonicalTarget));
  if (targets.some((target, index) => inputs.some((input) => within(input, target)) ||
    targets.some((other, otherIndex) => index !== otherIndex && (within(other, target) || within(target, other))))) {
    throw new Error("Output overlaps source or another audit output");
  }
  const privateLocations = [];
  const budget = { files: 1000, bytes: 256 * 1024 * 1024 };
  const sources = [];
  for (const source of registry.sources) sources.push(await inspectSource(source, root, budget, privateLocations));
  for (const source of sources) {
    source.gaps.push(...source.derived_from.filter((id) => !ids.has(id)).map((id) => `lineage_unknown:${id}`));
    const reachesSelf = (id, seen = new Set()) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return (sources.find(s => s.id === id)?.derived_from ?? []).some(parent => parent === source.id || reachesSelf(parent, seen));
    };
    if (reachesSelf(source.id)) source.gaps.push("lineage_cycle");
  }
  const identity = { contract: CONTRACT, processing_version: registry.processing_version ?? null, sources };
  const snapshot = { schema: SCHEMA, snapshot_id: `sha256:${digest(identity)}`, generated_at: new Date().toISOString(),
    ...identity, research_ready: false, public_release_approved: false,
    scope: "Registered local evidence only; no server access, semantic/coverage verification or research qualification." };
  if (output) await atomicJson(resolve(output), snapshot);
  else process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
  if (report) { await mkdir(dirname(resolve(report)), { recursive: true }); await writeFile(resolve(report), markdown(snapshot)); }
  if (internal) await atomicJson(resolve(internal), { schema: "ocean-source-locators/private-v1", snapshot_id: snapshot.snapshot_id, locations: privateLocations });
  if (output) process.stdout.write(`审计完成：${sources.length} 个已登记来源；研究资格 unknown，公开许可未批准。\n`);
}

export async function readSourceSnapshot(path) {
  const snapshot = JSON.parse(await readFile(path, "utf8"));
  const identity = { contract: snapshot.contract, processing_version: snapshot.processing_version, sources: snapshot.sources };
  if (snapshot.schema !== SCHEMA || snapshot.snapshot_id !== `sha256:${digest(identity)}` ||
    snapshot.research_ready !== false || snapshot.public_release_approved !== false) throw new Error("Invalid audit snapshot");
  return snapshot;
}
