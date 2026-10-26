import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "frontend", "prototype", "data", "front_response", "events.js");
const DEFAULT_OUTPUT_DIR = join(ROOT, "outputs", "experiments", "front-response-static-prototype");
const DEFAULT_SEED = 20261013;
const DEFAULT_ITERATIONS = 2000;

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
}

function numericArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(name + " must be a positive finite number");
  }
  return Math.floor(value);
}

const inputPath = argValue("--input", DEFAULT_INPUT);
const outputDir = argValue("--output", DEFAULT_OUTPUT_DIR);
const seed = numericArg("--seed", DEFAULT_SEED);
const iterations = numericArg("--iterations", DEFAULT_ITERATIONS);

function repoRelative(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function extractAssignedObject(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error("Cannot find " + marker);
  const start = text.indexOf("{", markerIndex);
  if (start < 0) throw new Error("Cannot find object after " + marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  throw new Error("Unterminated object for " + marker);
}

function loadFrontResponse(path) {
  const payload = extractAssignedObject(readFileSync(path, "utf8"), "window.OF_FRONT_RESPONSE");
  if (payload.schema_version !== "front-response/v1") {
    throw new Error("Expected front-response/v1, got " + payload.schema_version);
  }
  if (payload.metric !== "apparent_fishing_effort" || payload.unit !== "fishing_hours") {
    throw new Error("Expected apparent_fishing_effort in fishing_hours");
  }
  if (!Array.isArray(payload.events) || payload.events.length === 0) {
    throw new Error("front-response payload has no events");
  }
  return payload;
}

function lcg(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0);
}

function round(value, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function percentile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function bootstrapMeanCi(values, rng, iterationCount) {
  if (!values.length) return { low: null, high: null };
  const estimates = [];
  for (let iteration = 0; iteration < iterationCount; iteration += 1) {
    const sample = [];
    for (let index = 0; index < values.length; index += 1) {
      sample.push(values[Math.floor(rng() * values.length)]);
    }
    estimates.push(mean(sample));
  }
  return {
    low: round(percentile(estimates, 0.025), 4),
    high: round(percentile(estimates, 0.975), 4),
  };
}

function permutationPValue(differences, rng, iterationCount) {
  if (!differences.length) return null;
  const observed = Math.abs(mean(differences));
  let extreme = 0;
  for (let iteration = 0; iteration < iterationCount; iteration += 1) {
    const permuted = differences.map((value) => (rng() < 0.5 ? value : -value));
    if (Math.abs(mean(permuted)) >= observed) extreme += 1;
  }
  return round((extreme + 1) / (iterationCount + 1), 4);
}

function hasCompletePost7Record(event) {
  return Number.isFinite(event.post7_hours) &&
    Number.isFinite(event.post7_lift_percent) &&
    typeof event.post7_enhanced_flag === "boolean";
}

function responseMetricFor(payload) {
  const available = payload.events.filter((event) => event.status === "available" && event.coverage_status === "available");
  const post7WindowDays = payload.time_window?.post7_window_days;
  const hasPost7 = available.length > 0 &&
    Array.isArray(post7WindowDays) &&
    post7WindowDays.join(",") === "1,7" &&
    available.every(hasCompletePost7Record);
  return hasPost7
    ? {
        field: "post7_hours",
        liftField: "post7_lift_percent",
        enhancedField: "post7_enhanced_flag",
        windowDays: post7WindowDays,
      }
    : {
        field: "post1_3_hours",
        liftField: "lift_percent",
        enhancedField: "enhanced_flag",
        windowDays: payload.time_window?.post_window_days ?? null,
      };
}

function experimentReadiness(payload, responseMetric) {
  const available = payload.events.filter((event) => event.status === "available" && event.coverage_status === "available");
  const post7WindowDays = payload.time_window?.post7_window_days;
  const hasPost7Window = Array.isArray(post7WindowDays) && post7WindowDays.join(",") === "1,7";
  const post7RecordCount = available.filter(hasCompletePost7Record).length;
  const complete = responseMetric.field === "post7_hours";
  const requiredNextSteps = complete
    ? []
    : [
        "Produce a true post7_hours aggregate from authorized real apparent-fishing-effort input.",
        "Set time_window.post7_window_days to [1, 7] in the front-response input.",
        "Rerun tools/build-front-response.mjs and tools/run-front-response-experiment.mjs before marking the 7-day experiment complete.",
      ];
  return {
    acceptance_item: "before_after_7day_windows",
    status: complete ? "complete" : "partial",
    before_after_7day_complete: complete,
    post_response_field: responseMetric.field,
    post7_window_declared: hasPost7Window,
    available_record_count: available.length,
    records_with_complete_post7: post7RecordCount,
    missing_complete_post7_records: Math.max(0, available.length - post7RecordCount),
    required_next_steps: requiredNextSteps,
  };
}

function availableRecords(events, bufferKm, responseField) {
  return events.filter(
    (event) =>
      event.buffer_km === bufferKm &&
      event.status === "available" &&
      event.coverage_status === "available" &&
      Number.isFinite(event.pre7_hours) &&
      Number.isFinite(event[responseField]) &&
      Number.isFinite(event.non_front_control_hours),
  );
}

function summarizeBuffer(payload, bufferKm, rng, responseMetric) {
  const totalRecords = payload.events.filter((event) => event.buffer_km === bufferKm).length;
  const records = availableRecords(payload.events, bufferKm, responseMetric.field);
  const responseValues = records.map((event) => event[responseMetric.field]);
  const postMinusControl = records.map((event) => event[responseMetric.field] - event.non_front_control_hours);
  const postMinusPre = records.map((event) => event[responseMetric.field] - event.pre7_hours);
  const liftPercent = records.map((event) => event[responseMetric.liftField]).filter(Number.isFinite);
  const enhancedCount = records.filter((event) => event[responseMetric.enhancedField] === true).length;
  const summary = {
    buffer_km: bufferKm,
    sample_count: records.length,
    total_record_count: totalRecords,
    coverage_ratio: totalRecords ? round(records.length / totalRecords, 4) : null,
    enhanced_count: enhancedCount,
    enhanced_ratio: records.length ? round(enhancedCount / records.length, 4) : null,
    pre7_hours_total: round(sum(records.map((event) => event.pre7_hours)), 2),
    post_response_field: responseMetric.field,
    post_response_hours_total: round(sum(responseValues), 2),
    post1_3_hours_total: round(sum(records.map((event) => event.post1_3_hours)), 2),
    non_front_control_hours_total: round(sum(records.map((event) => event.non_front_control_hours)), 2),
    post_minus_control_hours_mean: round(mean(postMinusControl), 4),
    post_minus_pre7_hours_mean: round(mean(postMinusPre), 4),
    lift_percent_mean: round(mean(liftPercent), 4),
    lift_percent_median: round(percentile(liftPercent, 0.5), 4),
    bootstrap_ci_post_minus_control_mean: bootstrapMeanCi(postMinusControl, rng, iterations),
    permutation_p_value_post_vs_control: permutationPValue(postMinusControl, rng, iterations),
  };
  if (responseMetric.field === "post7_hours") {
    summary.post7_hours_total = summary.post_response_hours_total;
  }
  return {
    ...summary,
  };
}

function buildSummary(payload) {
  const rng = lcg(seed);
  const buffers = [...new Set(payload.events.map((event) => event.buffer_km))].sort((a, b) => a - b);
  const responseMetric = responseMetricFor(payload);
  const readiness = experimentReadiness(payload, responseMetric);
  const byBuffer = buffers.map((bufferKm) => summarizeBuffer(payload, bufferKm, rng, responseMetric));
  return {
    schema_version: "front-response-experiment/v1",
    experiment_id: "front-response-static-prototype",
    generated_from: repoRelative(inputPath),
    metric: payload.metric,
    unit: payload.unit,
    source: payload.source,
    status: payload.status,
    is_synthetic: payload.is_synthetic === true,
    parameters: {
      buffer_km: buffers,
      pre_window_days: payload.time_window?.pre_window_days ?? null,
      post_window_days: payload.time_window?.post_window_days ?? null,
      post7_window_days: payload.time_window?.post7_window_days ?? null,
      post_response_field: responseMetric.field,
      post_response_window_days: responseMetric.windowDays,
      exploratory_window_days: payload.time_window?.exploratory_window_days ?? null,
      control: payload.spatial_window?.control ?? null,
      control_min_distance_km: payload.spatial_window?.control_min_distance_km ?? null,
      bootstrap_iterations: iterations,
      permutation_iterations: iterations,
      random_seed: seed,
    },
    coverage: {
      sample_start: payload.time_window?.sample_start ?? null,
      sample_end: payload.time_window?.sample_end ?? null,
      event_count: payload.events.length,
      available_record_count: payload.events.filter((event) => event.status === "available").length,
    },
    readiness,
    by_buffer: byBuffer,
    caveats: [
      "This experiment uses aggregate apparent fishing-effort hours only.",
      responseMetric.field === "post7_hours"
        ? "This experiment uses the true post7_hours field because the input artifact provides a [1, 7] post-event aggregate."
        : "The committed aggregate has pre7_hours and post1_3_hours inside a -7 to +7 day exploratory window; it does not contain a separate post7_hours field, so the experiment uses post1_3_hours as the post-event response metric.",
      "Missing or unavailable records are excluded from numerical samples and are reflected in coverage_ratio, not treated as zero.",
      "Raw or fine-grained AIS/GFW data is not committed.",
    ],
  };
}

function renderReport(summary) {
  const lines = [
    "# Front Response Experiment",
    "",
    "## Scope",
    "",
    "This report summarizes deterministic apparent fishing-effort response around ocean-front events. It uses aggregate fishing-hour records from the committed public-boundary artifact and compares front buffers with same-day non-front controls.",
    "",
    "## Method",
    "",
    `- Buffers: ${summary.parameters.buffer_km.join(", ")} km`,
    `- Pre window: ${summary.parameters.pre_window_days} days before the event`,
    `- Post response metric: ${summary.parameters.post_response_field}`,
    `- Post response window: days ${summary.parameters.post_response_window_days.join(" to ")} after the event`,
    `- Analysis context window: days ${summary.parameters.exploratory_window_days.join(" to ")}`,
    `- Control: ${summary.parameters.control}`,
    `- Bootstrap/permutation iterations: ${summary.parameters.bootstrap_iterations}`,
    `- Random seed: ${summary.parameters.random_seed}`,
    "",
    "## Readiness",
    "",
    `- 7-day before/after status: ${summary.readiness.status}`,
    `- Full before/after 7-day complete: ${summary.readiness.before_after_7day_complete ? "yes" : "no"}`,
    `- Available records with complete post7 fields: ${summary.readiness.records_with_complete_post7} / ${summary.readiness.available_record_count}`,
    summary.readiness.required_next_steps.length
      ? `- Next required step: ${summary.readiness.required_next_steps[0]}`
      : "- Next required step: none",
    "",
    "## Results",
    "",
    "| Buffer km | Samples | Coverage | Enhanced | Mean post-control hours | 95% bootstrap CI | Permutation p | Mean lift % |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const item of summary.by_buffer) {
    lines.push(
      "| " + [
        item.buffer_km,
        item.sample_count,
        item.coverage_ratio == null ? "n/a" : `${round(item.coverage_ratio * 100, 2)}%`,
        item.enhanced_ratio == null ? "n/a" : `${item.enhanced_count} (${round(item.enhanced_ratio * 100, 2)}%)`,
        item.post_minus_control_hours_mean,
        `${item.bootstrap_ci_post_minus_control_mean.low} to ${item.bootstrap_ci_post_minus_control_mean.high}`,
        item.permutation_p_value_post_vs_control,
        item.lift_percent_mean,
      ].join(" | ") + " |",
    );
  }
  lines.push(
    "",
    "## Boundaries",
    "",
    "- The metric is apparent fishing effort measured in fishing hours.",
    "- These results are evidence for activity response only, not catch, yield, revenue, biomass, or guaranteed fishing success.",
    "- Missing coverage is represented through coverage fields and exclusions, not by filling missing values with zero.",
    summary.parameters.post_response_field === "post7_hours"
      ? "- The input includes a true post-7-day aggregate, so the before/after comparison uses symmetric 7-day response totals."
      : "- A full post-7-day aggregate should be added later if the research question requires symmetric 7-day before/after totals.",
    "",
  );
  return lines.join("\n");
}

function buildManifest(summary, artifacts) {
  return {
    schema_version: "front-response-experiment-manifest/v1",
    experiment_id: summary.experiment_id,
    inputs: [
      {
        path: repoRelative(inputPath),
        schema_version: "front-response/v1",
        metric: summary.metric,
        unit: summary.unit,
        public_boundary: "aggregate_only",
      },
    ],
    parameters: summary.parameters,
    readiness: summary.readiness,
    generated_artifacts: artifacts.map((path) => repoRelative(path)),
    caveats: summary.caveats,
  };
}

if (process.argv.includes("--fixed-region-request") || process.argv.includes("--read-fixed-region-result")) {
  const { runFixedRegionExample } = await import("./lib/fixed-region-example.mjs");
  process.exitCode = runFixedRegionExample(process.argv.slice(2), ROOT);
} else {
const payload = loadFrontResponse(inputPath);
const summary = buildSummary(payload);
mkdirSync(outputDir, { recursive: true });
const summaryPath = join(outputDir, "summary.json");
const reportPath = join(outputDir, "report.md");
const manifestPath = join(outputDir, "manifest.json");
writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
writeFileSync(reportPath, renderReport(summary), "utf8");
writeFileSync(
  manifestPath,
  JSON.stringify(buildManifest(summary, [manifestPath, summaryPath, reportPath]), null, 2) + "\n",
  "utf8",
);
console.log("front-response experiment written to " + repoRelative(outputDir));

}
