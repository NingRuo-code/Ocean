import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = join(ROOT, "data", "front_response", "fixture-effort-sample.json");
const DEFAULT_OUTPUT = join(ROOT, "data", "front_response", "events.js");

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
}

const inputPath = argValue("--input", DEFAULT_INPUT);
const outputPath = argValue("--output", DEFAULT_OUTPUT);
const payload = JSON.parse(readFileSync(inputPath, "utf8"));

function fail(message) {
  throw new Error("front-response build failed: " + message);
}

function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(label + " must be a finite number");
  if (value < 0) fail(label + " must be non-negative");
  return value;
}

function responseId(date, frontId, bufferKm) {
  return "FR-" + date.replaceAll("-", "") + "-" + frontId + "-" + bufferKm;
}

function addIsoDays(iso, days) {
  return new Date(Date.parse(iso + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}

function liftPercent(pre7Hours, post13Hours) {
  if (pre7Hours === 0) return post13Hours === 0 ? 0 : null;
  return Math.round(((post13Hours - pre7Hours) / pre7Hours) * 100);
}

function windowsFor(date, input) {
  const preDays = input.time_window.pre_window_days;
  const postDays = input.time_window.post_window_days;
  const exploratoryDays = input.time_window.exploratory_window_days;
  return {
    pre_window: {
      relative_days: [-preDays, -1],
      start: addIsoDays(date, -preDays),
      end: addIsoDays(date, -1),
      value_field: "pre7_hours",
    },
    post_window: {
      relative_days: postDays,
      start: addIsoDays(date, postDays[0]),
      end: addIsoDays(date, postDays[1]),
      value_field: "post1_3_hours",
    },
    exploratory_window: {
      relative_days: exploratoryDays,
      start: addIsoDays(date, exploratoryDays[0]),
      end: addIsoDays(date, exploratoryDays[1]),
    },
  };
}

function controlFor(input) {
  return {
    min_distance_km: input.spatial_window.control_min_distance_km,
    area_ratio: input.spatial_window.control_area_ratio,
    sampling: input.spatial_window.control_sampling || input.spatial_window.control,
  };
}

function validateInput(input) {
  if (input.schema_version !== "front-response-input/v1") fail("schema_version must be front-response-input/v1");
  if (!["synthetic_fixture", "real"].includes(input.status)) fail("status must be synthetic_fixture or real");
  if (input.status === "synthetic_fixture" && input.is_synthetic !== true) fail("synthetic fixture must set is_synthetic=true");
  if (!input.source || !input.source.kind) fail("source.kind is required");
  if (!input.time_window || !input.spatial_window || !input.processing || !input.public_boundary) {
    fail("time_window, spatial_window, processing, and public_boundary are required");
  }
  if (input.time_window.pre_window_days !== 7) fail("pre_window_days must be 7 for P1");
  if (!Array.isArray(input.time_window.post_window_days) ||
      input.time_window.post_window_days.join(",") !== "1,3") {
    fail("post_window_days must be [1, 3] for P1");
  }
  if (!Array.isArray(input.time_window.exploratory_window_days) ||
      input.time_window.exploratory_window_days.join(",") !== "-7,7") {
    fail("exploratory_window_days must be [-7, 7] for P1");
  }
  if (!Array.isArray(input.spatial_window.buffer_km) || input.spatial_window.buffer_km.join(",") !== "10,20,30") {
    fail("spatial_window.buffer_km must be [10, 20, 30]");
  }
  if (typeof input.spatial_window.control_min_distance_km !== "number" ||
      !Number.isFinite(input.spatial_window.control_min_distance_km) ||
      input.spatial_window.control_min_distance_km < 50) {
    fail("control_min_distance_km must be a finite number and at least 50");
  }
  if (!(input.spatial_window.control_area_ratio > 0)) fail("control_area_ratio must be positive");
  if (typeof input.spatial_window.control_sampling !== "string" ||
      !input.spatial_window.control_sampling.trim()) {
    fail("control_sampling is required");
  }
  if (input.processing.metric !== "apparent_fishing_effort") fail("metric must be apparent_fishing_effort");
  if (input.processing.unit !== "fishing_hours") fail("unit must be fishing_hours");
  if (!Array.isArray(input.front_events) || input.front_events.length === 0) fail("front_events must not be empty");
  if (!input.processing.control_validation) fail("processing.control_validation is required");
}

function buildEvents(input) {
  const events = [];
  for (const frontEvent of input.front_events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(frontEvent.date || "")) fail("front_event date is invalid");
    if (!/^F\d{3}$/.test(frontEvent.front_id || "")) fail("front_id must look like F001");
    if (!frontEvent.buffers || typeof frontEvent.buffers !== "object") fail("buffers are required");
    const missingBuffers = input.spatial_window.buffer_km.filter((bufferKm) => !frontEvent.buffers[String(bufferKm)]);
    if (missingBuffers.length) {
      fail(frontEvent.date + ":" + frontEvent.front_id + " missing buffer(s): " + missingBuffers.join(","));
    }

    for (const [bufferKey, values] of Object.entries(frontEvent.buffers)) {
      const bufferKm = Number(bufferKey);
      if (!input.spatial_window.buffer_km.includes(bufferKm)) fail("buffer " + bufferKey + " is not declared");
      const baseEvent = {
        response_id: responseId(frontEvent.date, frontEvent.front_id, bufferKm),
        front_event_id: frontEvent.date + ":" + frontEvent.front_id,
        date: frontEvent.date,
        front_id: frontEvent.front_id,
        front_id_scope: input.processing.front_id_scope || "local_day",
        buffer_km: bufferKm,
        ...windowsFor(frontEvent.date, input),
        control: controlFor(input),
      };

      if (values.status && values.status !== "available") {
        events.push({
          ...baseEvent,
          status: values.status,
          coverage_status: values.coverage_status || values.status,
          reason: values.reason || values.status,
          evidence_label: "不可用",
          note: values.note || "Coverage unavailable; do not interpret as zero fishing hours.",
        });
        continue;
      }

      const pre7Hours = finiteNumber(values.pre7_hours, "pre7_hours");
      const post13Hours = finiteNumber(values.post1_3_hours, "post1_3_hours");
      const controlHours = finiteNumber(values.non_front_control_hours, "non_front_control_hours");
      const lift = liftPercent(pre7Hours, post13Hours);
      if (lift == null) fail("pre7_hours=0 cannot produce a finite lift when post1_3_hours is non-zero");
      const enhanced = post13Hours >= pre7Hours * 1.2 && post13Hours > controlHours;

      events.push({
        ...baseEvent,
        pre7_hours: pre7Hours,
        post1_3_hours: post13Hours,
        non_front_control_hours: controlHours,
        lift_percent: lift,
        enhanced_flag: enhanced,
        status: "available",
        coverage_status: "available",
        evidence_label: enhanced ? "响应增强" : "无明显增强",
        note: input.status === "synthetic_fixture"
          ? "Synthetic fixture for conversion-path validation only; not real AIS/GFW evidence."
          : "Generated from authorized apparent fishing effort sample.",
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.front_id.localeCompare(b.front_id) || a.buffer_km - b.buffer_km);
}

function buildByDate(events) {
  return events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = { status: "available", date: event.date, by_range: {} };
    acc[event.date].by_range[String(event.buffer_km)] = event;
    return acc;
  }, {});
}

function repoRelative(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

validateInput(payload);
const events = buildEvents(payload);
const output = {
  schema_version: "front-response/v1",
  status: payload.status,
  is_synthetic: payload.is_synthetic === true,
  source: payload.source,
  metric: payload.processing.metric,
  unit: payload.processing.unit,
  time_window: payload.time_window,
  spatial_window: payload.spatial_window,
  public_boundary: payload.public_boundary,
  method: {
    buffer_km: payload.spatial_window.buffer_km,
    pre_window_days: payload.time_window.pre_window_days,
    post_window_days: payload.time_window.post_window_days,
    exploratory_window_days: payload.time_window.exploratory_window_days,
    control: payload.spatial_window.control,
    control_min_distance_km: payload.spatial_window.control_min_distance_km,
    control_area_ratio: payload.spatial_window.control_area_ratio,
    control_sampling: payload.spatial_window.control_sampling,
    control_validation: payload.processing.control_validation,
    enhancement_rule: payload.processing.enhancement_rule,
  },
  note: payload.public_boundary.note,
  generated_at: payload.generated_at || new Date().toISOString(),
  generated_by: {
    script: "tools/build-front-response.mjs",
    input: repoRelative(inputPath),
  },
  events,
  by_date: buildByDate(events),
};

const js = "(function () {\n  \"use strict\";\n\n  window.OF_FRONT_RESPONSE = " + JSON.stringify(output, null, 2) + ";\n})();\n";
writeFileSync(outputPath, js, "utf8");
console.log("Wrote " + repoRelative(outputPath) + " with " + events.length + " response rows.");
