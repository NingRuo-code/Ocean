/* Server-side process/publish job shell for Ocean.
 *
 * The first supported layer is front_response. It reuses
 * tools/build-front-response.mjs to keep Front Response Table generation
 * deterministic. By default this is a dry-run: no public artifact is written.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ARTIFACTS = join(ROOT, "server_data", "public_artifacts");
const DEFAULT_INPUT = join(ROOT, "server_data", "authorized_aggregate", "examples", "front-response-authorized.example.json");
const DEFAULT_OUTPUT = join(ROOT, "server_data", "public_artifacts", "front_response", "events.js");
const DEFAULT_LOG_DIR = join(ROOT, "server_data", "logs", "jobs");
const DEFAULT_STAGING_DIR = join(ROOT, "server_data", "logs", "staging");
const VALID_JOB_STATUS = new Set(["success", "failed", "partial", "skipped"]);

const usage = () => `Usage:
  node tools/server-process-artifact.mjs --layer front_response [--input path] [--output path] [--dry-run|--execute] [--publish] [--write-job|--no-write]

Defaults:
  --layer front_response --dry-run --write-job

Safety:
  Dry-run validates the requested layer plan but writes no public artifact.
  Execute without --publish validates into staging and records a skipped publish.
  Execute with --publish writes a staging artifact first, validates it, then replaces the public artifact.
`;

const parseArgs = (argv) => {
  const args = {
    layer: "front_response",
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    dryRun: true,
    publish: false,
    writeJob: true,
    logDir: DEFAULT_LOG_DIR,
    stagingDir: DEFAULT_STAGING_DIR
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--layer") args.layer = argv[++i];
    else if (arg === "--input") args.input = resolve(argv[++i]);
    else if (arg === "--output") args.output = resolve(argv[++i]);
    else if (arg === "--log-dir") args.logDir = resolve(argv[++i]);
    else if (arg === "--staging-dir") args.stagingDir = resolve(argv[++i]);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--execute") args.dryRun = false;
    else if (arg === "--publish") args.publish = true;
    else if (arg === "--write-job") args.writeJob = true;
    else if (arg === "--no-write") args.writeJob = false;
    else if (arg === "--fixed-now") args.fixedNow = argv[++i];
    else throw new Error("Unknown argument: " + arg);
  }
  return args;
};

const compact = (iso) => iso.replace(/[-:.TZ]/g, "").slice(0, 14);
const repoRel = (path) => relative(ROOT, path).replaceAll("\\", "/");
const safeLayer = (value) => String(value || "unknown").replace(/[^A-Za-z0-9_.-]+/g, "_");
const isInside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === "" || (!!rel && !rel.startsWith("..") && !rel.includes(":"));
};
const outputBoundaryError = (output) => {
  if (!isInside(PUBLIC_ARTIFACTS, output)) {
    return "Output must stay under server_data/public_artifacts/: " + repoRel(output);
  }
  if (/raw|intermediate|authorized_aggregate|mmsi|vessel|track/i.test(repoRel(output))) {
    return "Output path cannot expose raw/intermediate/authorized aggregate or identifiable track data: " + repoRel(output);
  }
  return null;
};
const baseJob = (args, now) => ({
  schema_version: "ocean-process-job/v1",
  job_id: "process_" + compact(now) + "_" + safeLayer(args.layer),
  job_type: "process",
  mode: args.dryRun ? "dry_run" : "execute",
  layer: args.layer,
  started_at: now,
  finished_at: now,
  status: "success",
  error: null,
  input_paths: [repoRel(args.input)],
  staging_paths: [],
  output_artifacts: [],
  publish: {
    requested: args.publish === true,
    public_artifacts_written: false,
    replace_existing: false,
    reason: "Dry-run or validation-only process job did not publish."
  },
  validation_summary: {
    data_contract_checked: false,
    checks: []
  }
});
const failJob = (job, code, message, retryable = false) => ({
  ...job,
  status: "failed",
  error: { code, message, retryable },
  output_artifacts: []
});
const skippedJob = (job, code, message) => ({
  ...job,
  status: "skipped",
  error: { code, message, retryable: false },
  output_artifacts: []
});

const loadFrontResponse = (path) => {
  const text = readFileSync(path, "utf8");
  const win = {};
  new Function("window", text)(win);
  return win.OF_FRONT_RESPONSE;
};
const validatePublicOutput = (path) => {
  const payload = loadFrontResponse(path);
  const checks = [];
  const check = (label, ok, detail) => checks.push({ label, status: ok ? "pass" : "fail", detail });
  check("schema", payload && payload.schema_version === "front-response/v1", payload && payload.schema_version);
  check("metric", payload && payload.metric === "apparent_fishing_effort", payload && payload.metric);
  check("unit", payload && payload.unit === "fishing_hours", payload && payload.unit);
  check("public boundary", payload && payload.public_boundary &&
    payload.public_boundary.raw_or_fine_grained_data_committed === false,
    payload && payload.public_boundary && JSON.stringify(payload.public_boundary));
  check("events", payload && Array.isArray(payload.events) && payload.events.length > 0,
    payload && payload.events && String(payload.events.length));
  const failed = checks.filter((item) => item.status === "fail");
  return {
    ok: failed.length === 0,
    checks,
    event_count: payload && Array.isArray(payload.events) ? payload.events.length : 0
  };
};

const runFrontResponseBuilder = (input, output) => {
  const result = spawnSync(process.execPath, [
    join(ROOT, "tools", "build-front-response.mjs"),
    "--input", input,
    "--output", output
  ], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "build-front-response failed").trim());
  }
  return (result.stdout || "").trim();
};
const runDataCheck = () => {
  const result = spawnSync(process.execPath, [join(ROOT, "tools", "data-check.mjs")], {
    cwd: ROOT,
    encoding: "utf8"
  });
  return {
    ok: result.status === 0,
    output: (result.stdout || result.stderr || "").trim()
  };
};

const buildJob = (args) => {
  const now = args.fixedNow || new Date().toISOString();
  const job = baseJob(args, now);
  if (args.layer !== "front_response") {
    return failJob(job, "unsupported_layer", "Only front_response processing is implemented in this first server process job.");
  }
  const boundaryError = outputBoundaryError(args.output);
  if (boundaryError) return failJob(job, "invalid_output_boundary", boundaryError);
  if (!existsSync(args.input)) {
    return failJob(job, "input_not_found", "Authorized aggregate input was not found: " + repoRel(args.input));
  }

  if (args.dryRun) {
    job.validation_summary.checks.push({ label: "dry_run_plan", status: "pass", detail: "No public artifact was written." });
    job.output_artifacts.push({
      path: repoRel(args.output),
      status: "planned",
      layer: args.layer,
      generated_by: "tools/build-front-response.mjs"
    });
    return job;
  }

  mkdirSync(args.stagingDir, { recursive: true });
  const stagingOutput = join(args.stagingDir, job.job_id + ".events.js");
  job.staging_paths.push(repoRel(stagingOutput));

  try {
    const stdout = runFrontResponseBuilder(args.input, stagingOutput);
    const validation = validatePublicOutput(stagingOutput);
    job.validation_summary = {
      data_contract_checked: true,
      checks: validation.checks,
      event_count: validation.event_count,
      build_stdout: stdout
    };
    if (!validation.ok) {
      return failJob(job, "validation_failed", "Generated artifact failed public output validation.");
    }
    if (!args.publish) {
      return skippedJob(job, "publish_not_requested", "Validated staging artifact, but --publish was not requested.");
    }
    const dataCheck = runDataCheck();
    job.validation_summary.checks.push({
      label: "data-check",
      status: dataCheck.ok ? "pass" : "fail",
      detail: dataCheck.output
    });
    if (!dataCheck.ok) {
      return failJob(job, "data_check_failed", "Repository data contract check failed before publish.");
    }
    mkdirSync(dirname(args.output), { recursive: true });
    const tmpOutput = args.output + ".tmp";
    rmSync(tmpOutput, { force: true });
    renameSync(stagingOutput, tmpOutput);
    renameSync(tmpOutput, args.output);
    job.output_artifacts.push({
      path: repoRel(args.output),
      status: "published",
      layer: args.layer,
      generated_by: "tools/build-front-response.mjs"
    });
    job.publish = {
      requested: true,
      public_artifacts_written: true,
      replace_existing: true,
      reason: "Staging artifact passed validation before replacing public output."
    };
    return job;
  } catch (error) {
    return failJob(job, "process_failed", error.message, false);
  }
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const job = buildJob(args);
  if (!VALID_JOB_STATUS.has(job.status)) throw new Error("Invalid job status: " + job.status);
  if (args.writeJob) {
    mkdirSync(args.logDir, { recursive: true });
    writeFileSync(join(args.logDir, job.job_id + ".json"), JSON.stringify(job, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify({
    job_id: job.job_id,
    status: job.status,
    layer: job.layer,
    publish: job.publish,
    output_artifacts: job.output_artifacts,
    write_job: args.writeJob
  }, null, 2));
  if (job.status === "failed") process.exitCode = 1;
};

try {
  main();
} catch (error) {
  console.error("FAIL: " + error.message);
  process.exit(1);
}
