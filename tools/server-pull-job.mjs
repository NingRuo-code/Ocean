/* Server-side pull job shell for Ocean.
 *
 * This script creates an auditable job record for a manual source/date-range
 * pull. It defaults to dry-run mode: no network request, no raw data write, and
 * no public artifact publication. Use --execute only after a source connector is
 * implemented and credentials are configured on the server.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REGISTRY = join(ROOT, "server_data", "sources", "sources.example.json");
const DEFAULT_MANIFEST = join(ROOT, "server_data", "public_artifacts", "artifact-manifest.example.json");
const DEFAULT_LOG_DIR = join(ROOT, "server_data", "logs", "jobs");
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86400000;

const usage = () => `Usage:
  node tools/server-pull-job.mjs --source <source_id> --start YYYY-MM-DD --end YYYY-MM-DD [--dry-run|--execute] [--write-job|--no-write]
  node tools/server-pull-job.mjs --source <source_id> --check-latest [--write-job|--no-write]
  node tools/server-pull-job.mjs --list-sources

Defaults:
  --dry-run --write-job

Safety:
  Dry-run never downloads raw data and never publishes public artifacts.
  Execute mode is currently connector-gated; unsupported sources are skipped with an explicit error.
`;

const parseArgs = (argv) => {
  const args = {
    dryRun: true,
    writeJob: true,
    registry: DEFAULT_REGISTRY,
    manifest: DEFAULT_MANIFEST,
    logDir: DEFAULT_LOG_DIR
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--list-sources") args.listSources = true;
    else if (arg === "--check-latest") args.checkLatest = true;
    else if (arg === "--source") args.sourceId = argv[++i];
    else if (arg === "--start") args.start = argv[++i];
    else if (arg === "--end") args.end = argv[++i];
    else if (arg === "--registry") args.registry = join(ROOT, argv[++i]);
    else if (arg === "--manifest") args.manifest = join(ROOT, argv[++i]);
    else if (arg === "--log-dir") args.logDir = join(ROOT, argv[++i]);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--execute") args.dryRun = false;
    else if (arg === "--write-job") args.writeJob = true;
    else if (arg === "--no-write") args.writeJob = false;
    else if (arg === "--fixed-now") args.fixedNow = argv[++i];
    else throw new Error("Unknown argument: " + arg);
  }
  return args;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const compact = (iso) => iso.replace(/[-:.TZ]/g, "").slice(0, 14);
const safeId = (value) => String(value || "unknown").replace(/[^A-Za-z0-9_.-]+/g, "_");
const toDate = (iso) => {
  if (!VALID_DATE.test(iso || "")) throw new Error("Date must be YYYY-MM-DD: " + iso);
  const date = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error("Invalid date: " + iso);
  }
  return date;
};
const isoDate = (date) => date.toISOString().slice(0, 10);
const dateList = (startIso, endIso) => {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (start > end) throw new Error("--start must be before or equal to --end");
  const days = Math.round((end - start) / MS_PER_DAY) + 1;
  if (days > 366) throw new Error("Date range is too large for one pull job: " + days + " days");
  return Array.from({ length: days }, (_, index) => isoDate(new Date(start.getTime() + index * MS_PER_DAY)));
};
const withinCoverage = (source, start, end) => {
  const coverage = source.date_coverage || {};
  if (coverage.start && start < coverage.start) return false;
  if (coverage.end && end > coverage.end) return false;
  return true;
};
const rawTargetFor = (source, date) => {
  const ymd = date.replace(/-/g, "");
  if (source.source_type === "front") return `server_data/raw/front_location/front_location${ymd}.nc`;
  if (source.source_type === "front_intensity") return `server_data/raw/front_intensity/front_intensity_${ymd}.nc`;
  if (source.source_type === "sst") return `server_data/raw/sst/sst_${date}.nc`;
  if (source.source_type === "gfw_ais_effort") return `server_data/raw/gfw_ais/gfw_effort_${date}.json`;
  return `server_data/raw/${source.source_id}/${source.source_id}_${date}.raw`;
};
const credentialConfigured = (source) => {
  if (source.credential_mode === "none") return true;
  const name = "OCEAN_SOURCE_" + source.source_id.toUpperCase().replace(/[^A-Z0-9]+/g, "_") + "_CREDENTIAL";
  return Boolean(process.env[name]);
};

const sourceSnapshot = (source) => source ? {
  license: source.license,
  credential_mode: source.credential_mode,
  update_cadence: source.update_cadence,
  public_display_boundary: source.public_display_boundary,
  caveat: source.caveat
} : null;
const baseJob = (args, source, now) => ({
    schema_version: "ocean-pull-job/v1",
    job_id: (args.checkLatest ? "pull_check_" : "pull_") + compact(now) + "_" + safeId(args.sourceId),
    job_type: args.checkLatest ? "pull_check" : "pull",
    mode: args.dryRun ? "dry_run" : "execute",
    source_id: args.sourceId || null,
    source_type: source ? source.source_type : null,
    started_at: now,
    finished_at: now,
    status: "success",
    error: null,
    date_range: null,
    source_snapshot: sourceSnapshot(source),
    credential_required: source ? source.credential_mode !== "none" : false,
    credential_configured: source && source.credential_mode !== "none" ? credentialConfigured(source) : null,
    planned_downloads: [],
    input_paths: [],
    output_artifacts: [],
    publish: {
      auto_publish: false,
      public_artifacts_written: false,
      reason: "Pull/check jobs only stage source status or raw plans. Publishing requires a later validate/process step."
    },
    validation_summary: {
      data_contract_checked: false,
      note: "No public artifact was generated by this job."
    }
});
const failJob = (job, code, message, retryable = false) => ({
  ...job,
  status: "failed",
  error: { code, message, retryable },
  planned_downloads: [],
  output_artifacts: []
});

const buildLatestCheckJob = (args, source, manifest, now) => {
  const job = baseJob(args, source, now);
  const sourceEnd = source.date_coverage && source.date_coverage.end;
  const knownLatest = manifest.latest_available_date || null;
  const candidateStart = knownLatest ? isoDate(new Date(toDate(knownLatest).getTime() + MS_PER_DAY)) : null;
  job.latest_check = {
    known_latest_available_date: knownLatest,
    source_registered_end: sourceEnd,
    source_status: sourceEnd && knownLatest && knownLatest >= sourceEnd ? "up_to_date_for_registered_archive" : "needs_source_check",
    candidate_start: sourceEnd && candidateStart && candidateStart <= sourceEnd ? candidateStart : null,
    candidate_end: sourceEnd || null,
    auto_publish: false
  };
  return job;
};

const buildJob = (args, registry, manifest) => {
  const now = args.fixedNow || new Date().toISOString();
  const sources = Array.isArray(registry.sources) ? registry.sources : [];
  const source = sources.find((item) => item.source_id === args.sourceId);
  const job = baseJob(args, source, now);
  if (!source) return failJob(job, "unknown_source", "Unknown source_id: " + args.sourceId);

  if (args.checkLatest) {
    return buildLatestCheckJob(args, source, manifest || {}, now);
  }

  let days = [];
  try {
    days = dateList(args.start, args.end);
  } catch (error) {
    return failJob(job, "invalid_date_range", error.message);
  }
  job.date_range = {
    start: args.start,
    end: args.end,
    days: days.length
  };
  job.planned_downloads = days.map((date) => ({
    date,
    target_path: rawTargetFor(source, date),
    artifact_status: "planned_raw_only"
  }));

  if (!withinCoverage(source, args.start, args.end)) {
    job.status = "skipped";
    job.error = {
      code: "date_out_of_source_coverage",
      message: "Requested date range is outside the registered source coverage.",
      retryable: false
    };
    job.planned_downloads = [];
    return job;
  }

  if (!args.dryRun && source.credential_mode !== "none" && !job.credential_configured) {
    job.status = "skipped";
    job.error = {
      code: "credential_not_configured",
      message: "The source requires a server-side credential. Configure it outside Git before executing the pull.",
      retryable: false
    };
    job.planned_downloads = [];
    return job;
  }

  if (!args.dryRun) {
    job.status = "skipped";
    job.error = {
      code: "pull_connector_not_implemented",
      message: "The source is registered, but no network connector is implemented yet. No raw data was downloaded.",
      retryable: false
    };
    job.planned_downloads = [];
  }

  return job;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!existsSync(args.registry)) throw new Error("Source registry not found: " + args.registry);
  const registry = readJson(args.registry);
  const manifest = existsSync(args.manifest) ? readJson(args.manifest) : {};
  const sources = Array.isArray(registry.sources) ? registry.sources : [];

  if (args.listSources) {
    console.log(sources.map((source) => source.source_id).join("\n"));
    return;
  }
  if (!args.sourceId || (!args.checkLatest && (!args.start || !args.end))) {
    const now = args.fixedNow || new Date().toISOString();
    const job = failJob(
      baseJob(args, null, now),
      "invalid_arguments",
      "--source is required; --start and --end are required unless --check-latest is used."
    );
    if (args.writeJob) {
      mkdirSync(args.logDir, { recursive: true });
      writeFileSync(join(args.logDir, job.job_id + ".json"), JSON.stringify(job, null, 2) + "\n", "utf8");
    }
    console.log(JSON.stringify({
      job_id: job.job_id,
      status: job.status,
      source_id: job.source_id,
      date_range: job.date_range,
      write_job: args.writeJob
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const job = buildJob(args, registry, manifest);
  if (args.writeJob) {
    mkdirSync(args.logDir, { recursive: true });
    writeFileSync(join(args.logDir, job.job_id + ".json"), JSON.stringify(job, null, 2) + "\n", "utf8");
  }
  console.log(JSON.stringify({
    job_id: job.job_id,
    status: job.status,
    source_id: job.source_id,
    date_range: job.date_range,
    latest_check: job.latest_check,
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
