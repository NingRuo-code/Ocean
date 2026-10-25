import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";

test("offline palette build has the same source identity in LF and CRLF checkouts", async () => {
  const root = await mkdtemp(join(tmpdir(), "ocean-palette-build-"));
  try {
    for (const folder of ["tools", "frontend/prototype/palettes", "frontend/prototype/data/sst"]) await mkdir(join(root, folder), { recursive: true });
    for (const file of ["tools/build-display-palettes.mjs", "frontend/prototype/palettes/cmocean_thermal.rgb", "frontend/prototype/palettes/MPL_Purples.rgb"]) await copyFile(file, join(root, file));
    const dir = "frontend/prototype/data/sst", sources = [];
    for (const file of (await readdir(dir)).filter(f => /^\d{4}-\d{2}-\d{2}\.js$/.test(f))) sources.push([file, (await readFile(join(dir, file), "utf8")).replace(/\r\n/g, "\n")]);
    async function build(crlf) {
      for (const [file, text] of sources) await writeFile(join(root, dir, file), crlf ? text.replace(/\n/g, "\r\n") : text);
      execFileSync(process.execPath, ["tools/build-display-palettes.mjs"], { cwd: root, windowsHide: true });
      return Promise.all(["frontend/prototype/data/display-domains.js", "frontend/prototype/palettes/palettes.js"].map(f => readFile(join(root, f), "utf8")));
    }
    const lf = await build(false), crlf = await build(true);
    assert.deepEqual(crlf, lf);
    const manifest = JSON.parse(lf[0].slice(lf[0].indexOf("{")).replace(/;\s*$/, ""));
    assert.equal(manifest.sst.source_hash_encoding, "utf8-lf");
    assert.equal(manifest.sst.sources.length, 62);
    assert.deepEqual(manifest.sst.domain, [20.5, 33]);
    assert.equal(manifest.effort.status, "pending");
  } finally {
    if (dirname(resolve(root)) === resolve(tmpdir()) && basename(root).startsWith("ocean-palette-build-")) await rm(root, { recursive: true, force: true });
  }
});
