import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";

const scenarios = ["navigation", "reload", "date-change", "zoom", "drag"];
const maxBytes = 16 * 1024 * 1024;
const statuses = ["success", "failure", "timeout"];
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isTime = value => Number.isFinite(value) && value >= 0;

class VerificationError extends Error {}

function sameReport(first, second) {
  return second.isFile() && ["dev", "ino", "size", "mtimeNs", "ctimeNs"].every(key => first[key] === second[key]);
}

async function readReport(path) {
  const stat = await lstat(path, { bigint: true });
  if (!stat.isFile() || stat.size > maxBytes) throw new VerificationError("invalid_report_file");
  const handle = await open(path, "r");
  try {
    if (!sameReport(stat, await handle.stat({ bigint: true }))) throw new VerificationError("report_changed");
    const blocks = [];
    for await (const block of handle.createReadStream({ end: maxBytes, autoClose: false })) blocks.push(block);
    const bytes = Buffer.concat(blocks);
    if (bytes.length > maxBytes) throw new VerificationError("invalid_report_file");
    if (BigInt(bytes.length) !== stat.size || !sameReport(stat, await handle.stat({ bigint: true })) ||
        !sameReport(stat, await lstat(path, { bigint: true }))) throw new VerificationError("report_changed");
    return [JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), bytes];
  } finally {
    await handle.close();
  }
}

function verifyAttempt(row, deadline, integrity) {
  const { status, elapsed_ms, after_action_ms, first_partial_paint_ms, action_attempted, browser_errors } = row;
  const success = status === "success";
  const partial = first_partial_paint_ms !== null;
  if (!statuses.includes(status) || typeof action_attempted !== "boolean" || !Array.isArray(browser_errors) ||
      (!action_attempted && status !== "failure") ||
      (success && (!isTime(elapsed_ms) || elapsed_ms >= deadline || !isTime(after_action_ms) || after_action_ms > elapsed_ms)) ||
      (!success && (elapsed_ms !== null || after_action_ms !== null)) ||
      (partial && (!isTime(first_partial_paint_ms) || first_partial_paint_ms >= deadline ||
        (success && first_partial_paint_ms > elapsed_ms))) ||
      ((success || partial) && (!action_attempted || browser_errors.length || integrity !== "unchanged"))) {
    throw new VerificationError("invalid_attempt_timing");
  }
}

function summarize(rows) {
  const durations = rows.filter(row => row.status === "success").map(row => row.elapsed_ms).sort((a, b) => a - b);
  // Only complete attempts participate. An even sample uses the lower
  // median under the benchmark's nearest-rank convention.
  const middle = Math.floor((durations.length - 1) / 2);
  const tail = Math.ceil(19 * durations.length / 20) - 1;
  return {
    attempts: rows.length, success: durations.length,
    failure: rows.filter(row => row.status === "failure").length,
    timeout: rows.filter(row => row.status === "timeout").length,
    partial_paint_observations: rows.filter(row => row.first_partial_paint_ms !== null).length,
    p50_ms: durations[middle] ?? null,
    p95_ms: durations.length >= 20 ? durations[tail] : null,
    tail_note: durations.length >= 20 ? "empirical nearest-rank; this environment only" :
      "insufficient samples for stable tail claim",
  };
}

function verify(report) {
  if (!isRecord(report) || report.schema !== "ocean-map-baseline/v1" ||
      report.b1_qualified !== false || report.targets_verified !== false ||
      !["unchanged", "changed"].includes(report.artifact_integrity)) {
    throw new VerificationError("unsupported_report");
  }
  const { runs, timeout_ms: deadline } = report.protocol ?? {};
  if (!Number.isInteger(runs) || runs < 1 || runs > 20 || !Number.isFinite(deadline) ||
      deadline < 100 || deadline > 60_000 || !Array.isArray(report.attempts) ||
      report.attempts.length !== runs * scenarios.length) {
    throw new VerificationError("invalid_protocol");
  }
  const groups = new Map(scenarios.map(name => [name, new Map()]));
  for (const row of report.attempts) {
    const group = isRecord(row) ? groups.get(row.scenario) : undefined;
    if (!group || !Number.isInteger(row.run) || row.run < 1 || row.run > runs || group.has(row.run)) {
      throw new VerificationError("invalid_attempt_identity");
    }
    verifyAttempt(row, deadline, report.artifact_integrity);
    group.set(row.run, row);
  }
  const summary = Object.fromEntries([...groups].map(([name, rows]) => [name, summarize([...rows.values()])]));
  if (!isRecord(report.summary) || Object.keys(report.summary).length !== scenarios.length ||
      scenarios.some(name => !isRecord(report.summary[name]) ||
        Object.entries(summary[name]).some(([key, value]) => report.summary[name][key] !== value))) {
    throw new VerificationError("summary_mismatch");
  }
  return summary;
}

try {
  if (process.argv.length !== 3) throw new VerificationError("expected_one_report_path");
  const [report, bytes] = await readReport(process.argv[2]);
  const summary = verify(report);
  console.log(JSON.stringify({
    verified: true, scope: "attempt_bookkeeping_only",
    report_sha256: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
    artifact_integrity: report.artifact_integrity,
    b1_qualified: false, targets_verified: false, attempts: report.attempts.length, summary,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    verified: false, reason: error instanceof VerificationError ? error.message : "invalid_report_file",
  }));
  process.exitCode = 2;
}
