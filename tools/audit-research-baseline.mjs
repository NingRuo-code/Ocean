import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Inspect local export metadata only. File coverage is not valid-observation coverage.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = join(root, "frontend/prototype/data");
const context = vm.createContext({ window: {} });
const load = (path) => vm.runInContext(readFileSync(path, "utf8"), context, { timeout: 2000 });
load(join(data, "meta.js"));
const layers = {};
for (const [layer, key] of [["day", "OF_DATA_DAYS"], ["sst", "OF_DATA_SST"]]) {
  const dir = join(data, layer);
  const files = readdirSync(dir).filter((name) => /^\d{4}-\d{2}-\d{2}\.js$/.test(name)).sort();
  const months = {};
  const mismatches = [];
  for (const file of files) {
    const date = file.slice(0, 10);
    const month = date.slice(0, 7);
    (months[month] ||= []).push(date);
    load(join(dir, file));
    if (context.window[key]?.[date]?.date !== date) mismatches.push(date);
  }
  layers[layer] = {
    file_count: files.length,
    first: files[0]?.slice(0, 10) ?? null,
    last: files.at(-1)?.slice(0, 10) ?? null,
    date_mismatches: mismatches,
    months: Object.fromEntries(Object.entries(months).map(([month, dates]) => {
      const [year, m] = month.split("-").map(Number);
      const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
      const missing = Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter((d) => !dates.includes(d));
      return [month, { files: dates.length, expected_days: days, missing_dates: missing, files_complete: missing.length === 0 }];
    })),
  };
}
load(join(data, "front_response/events.js"));
const table = context.window.OF_FRONT_RESPONSE;
const events = table.events ?? [];
const report = {
  schema: "ocean-local-research-baseline/v1",
  scope: "local committed exports; no server access or valid-observation verification",
  layers,
  front_resolution_deg: context.window.OF_DATA_META.product.resolution_deg,
  available_ui_radii_km: context.window.OF_DATA_META.region.ranges_km,
  local_fishing_grid_directory_present: existsSync(join(data, "fishing_effort")),
  ais_complete_months_verified: false,
  fine_analysis_grid_verified: false,
  response_table: {
    declared_status: table.status,
    events: events.length,
    dates: new Set(events.map((e) => e.date)).size,
    events_with_post7_hours: events.filter((e) => Number.isFinite(e.post7_hours)).length,
    declared_window: table.time_window,
    usable_as_arbitrary_fixed_region_event_study: false,
  },
  caveats: [
    "Complete local files do not establish complete observations or local effective ocean area.",
    "AIS daily grid coverage and source analysis resolution must be verified separately.",
    "Existing event rows are not independent event samples or arbitrary-location results.",
    "ADR-0001 fine analysis resolution remains a requirement until explicitly reviewed.",
  ],
};
const json = JSON.stringify(report, null, 2) + "\n";
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0) {
  if (!process.argv[outIndex + 1]) throw new Error("--out requires a file path");
  const out = resolve(process.argv[outIndex + 1]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
} else process.stdout.write(json);
if (Object.values(layers).some((layer) => layer.date_mismatches.length)) process.exitCode = 1;
