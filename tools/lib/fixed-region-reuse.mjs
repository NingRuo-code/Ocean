import {spawnSync} from "node:child_process";
import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";

const launcherFiles=[
  "tools/run-front-response-experiment.mjs",
  "tools/lib/fixed-region-example.mjs",
  "tools/lib/fixed-region-reuse.mjs",
];
const sampleFiles=[
  "backend/app/__init__.py", "backend/app/fixed_region_example.py", "backend/app/fixed_region_models.py",
  "backend/app/analysis_support.py", "backend/app/monthly_models.py", "backend/app/schemas.py",
];
const referenceFiles=[
  "tools/audit_daily_sources.py", "tools/audit_regional_support.py", "tools/audit_support_qualification.py",
  "tools/compute_monthly_distance.py", "tools/monthly_block_uncertainty.py", "tools/monthly_distance_background.py",
  "tools/monthly_sensitivity_plan.py", "tools/monthly_side_environment.py", "tools/fixed_region_front_observations.py",
  "tools/fixed_region_window_qualification.py", "tools/fixed_region_window_effects.py", "tools/fixed_region_comparable_controls.py",
  "tools/fixed_region_event_inference.py", "tools/fixed_region_event_lag.py", "tools/fixed_region_event_evidence.py",
];

const probe=`
import json, sys
from importlib.metadata import version
if sys.argv[1] == 'reference':
    import pyproj, shapely
    result = {'native': [pyproj.proj_version_str, shapely.geos_version_string],
              'packages': {name: version(name) for name in ('numpy', 'pyproj', 'shapely', 'xarray', 'pandas')}}
else:
    result = {'packages': {'pydantic': version('pydantic'), 'pydantic_core': version('pydantic-core')}}
print(json.dumps({'python': sys.version, **result}))
`;

export function fixedEngineSources(root, method, read) {
  const phase=method==="observed-entry-example/v1" ? sampleFiles : referenceFiles;
  return Object.fromEntries([...launcherFiles,...phase].map(name=>[name,read(join(root,name))]));
}

export function stageFixedEngine(engine, sources) {
  mkdirSync(join(engine,"backend"),{recursive:true});
  for(const [name,content] of Object.entries(sources)) {
    if(!name.endsWith(".py")) continue;
    const path=join(engine,name);
    mkdirSync(dirname(path),{recursive:true});
    writeFileSync(path,content);
  }
}

export function fixedExecutionFingerprint(python, cwd, method, sources, transport, hash) {
  const child=spawnSync(python,
    ["-B","-c",probe,method==="observed-entry-example/v1"?"sample":"reference"],{
      cwd,encoding:"utf8",windowsHide:true,timeout:15000,maxBuffer:16384,
    });
  if(child.status!==0) throw Error("runtime_identity_unavailable");
  const runtime=JSON.parse(child.stdout);
  if(typeof runtime.python!=="string" || !runtime.packages) throw Error("runtime_identity_unavailable");
  const sourceHashes=Object.fromEntries(Object.entries(sources).map(([name,content])=>[name,hash(content)]));
  return hash(JSON.stringify({schema:"fixed-event-execution/v1",transport,sources:sourceHashes,runtime,
    node:process.version,platform:process.platform,arch:process.arch}));
}
