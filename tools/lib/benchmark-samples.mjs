import {createHash} from "node:crypto";
import {createWriteStream} from "node:fs";
import {lstat, mkdir, open, opendir, realpath} from "node:fs/promises";
import {basename, dirname, isAbsolute, join, relative, resolve} from "node:path";
import {Transform} from "node:stream";
import {pipeline} from "node:stream/promises";

const layers = {
  front: /^front_location(\d{4})\d{4}\.nc$/,
  sst: /^sst_(\d{4})\d{4}\.nc$/,
};
const maxEntries = 512;
const maxFiles = 128;
const maxBytes = 128 * 1024 ** 2;

async function canonicalOutput(path, mustBeNew = false) {
  try {
    await lstat(path);
  } catch (error) {
    if (error.code !== "ENOENT" || dirname(path) === path) throw error;
    return join(await canonicalOutput(dirname(path)), basename(path));
  }
  if (mustBeNew) throw Error("Sample report must be a new file");
  return realpath(path);
}

async function* entries(dir, budget, optional = false) {
  let stat;
  try {
    stat = await lstat(dir);
  } catch (error) {
    if (optional && error.code === "ENOENT") return;
    throw error;
  }
  if (!stat.isDirectory() || relative(dir, await realpath(dir))) throw Error("Invalid sample directory");
  for await (const entry of await opendir(dir)) {
    if (++budget.entries > maxEntries) throw Error("Sample entry budget exceeded");
    yield entry.name;
  }
}

function sameFile(expected, observed) {
  return observed.isFile() && ["dev", "ino", "size", "mtimeMs", "ctimeMs"].every(
    key => expected[key] === observed[key],
  );
}

async function stageFile(source, target, budget) {
  const expected = await lstat(source);
  if (!expected.isFile() || relative(source, await realpath(source)) ||
      expected.size < 1 || expected.size > budget.bytes || ++budget.files > maxFiles) {
    throw Error("Invalid or excessive sample files");
  }
  const handle = await open(source, "r");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    if (!sameFile(expected, await handle.stat())) throw Error("Sample changed while staging");
    await mkdir(dirname(target), {recursive: true});
    await pipeline(
      handle.createReadStream({end: expected.size - 1, autoClose: false}),
      new Transform({transform(chunk, _encoding, done) {
        bytes += chunk.length;
        hash.update(chunk);
        done(null, chunk);
      }}),
      createWriteStream(target, {flags: "wx"}),
    );
    if (bytes !== expected.size || !sameFile(expected, await handle.stat()) ||
        !sameFile(expected, await lstat(source))) throw Error("Sample changed while staging");
  } finally {
    await handle.close();
  }
  budget.bytes -= bytes;
  return {bytes, sha256: hash.digest("hex")};
}

export async function stageBenchmarkSamples(sampleRoot, rawTarget, reportPath) {
  const root = resolve(sampleRoot);
  if (!(await lstat(root)).isDirectory() || relative(root, await realpath(root))) {
    throw Error("Invalid sample root");
  }
  const out = relative(root, await canonicalOutput(resolve(reportPath), true));
  if (!isAbsolute(out) && !/^\.\.(?:[/\\]|$)/.test(out)) throw Error("Report overlaps sample root");
  const budget = {entries: 0, bytes: maxBytes, files: 0};
  const facts = [];
  const files = {front: 0, sst: 0};
  for (const [layer, pattern] of Object.entries(layers)) {
    const dir = join(root, layer);
    for await (const year of entries(dir, budget, true)) {
      if (!/^\d{4}$/.test(year)) continue;
      for await (const name of entries(join(dir, year), budget)) {
        if (pattern.exec(name)?.[1] !== year) continue;
        const path = `${layer}/${year}/${name}`;
        const fact = await stageFile(join(root, path), join(rawTarget, path), budget);
        facts.push({name: path, ...fact});
        files[layer]++;
      }
    }
  }
  if (!facts.length) throw Error("No registered daily NetCDF sample filenames");
  facts.sort((first, second) => first.name.localeCompare(second.name, "en"));
  return {
    kind: "explicit_local_netcdf",
    files,
    bytes: maxBytes - budget.bytes,
    snapshot_id: "sha256:" + createHash("sha256").update(JSON.stringify(facts)).digest("hex"),
  };
}
