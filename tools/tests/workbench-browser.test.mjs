import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, sleep } from "../lib/browser-driver.mjs";

test("nearby-front workbench keeps independent panels, factual results and an operable map", async () => {
  const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
  const c = browser.cdp;
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate", { url: pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href });
    await sleep(600);
    assert.equal(await c.evaluate("!!document.getElementById('workbenchToggle')"), true);
    await c.evaluate("document.getElementById('workbenchToggle').click();document.getElementById('nearbyFront').click()");
    assert.equal(await c.evaluate("document.getElementById('taskWorkbench').open && !document.getElementById('resultPanel').hidden"), true);
    assert.equal(await c.evaluate("/把握度|值得去|评分依据/.test(document.getElementById('pane-now').innerText)"), false);
    assert.equal(await c.evaluate("document.querySelectorAll('#nowMetrics .m').length"), 3);
    assert.equal(await c.evaluate("document.getElementById('taskWorkbench').contains(document.getElementById('pane-ai'))"), true);
    assert.equal(await c.evaluate("document.querySelectorAll('#tabs button').length"), 3);
    const old = await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')");
    await c.evaluate("document.getElementById('zoomIn').click()");
    assert.notEqual(await c.evaluate("document.getElementById('mapSvg').getAttribute('viewBox')"), old);
    for (const width of [1440, 1280, 390]) {
      await c.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await c.evaluate("document.getElementById('workbenchClose').click();document.getElementById('resultClose').click()");
      await sleep(100);
      assert.equal(await c.evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `overflow at ${width}`);
      if (width > 760) await c.evaluate("document.getElementById('workbenchToggle').click();document.getElementById('nearbyFront').click()");
      await mkdir("docs/reports/screenshots", { recursive: true });
      const screenshot = await c.send("Page.captureScreenshot", { format: "png" });
      await writeFile(`docs/reports/screenshots/ocean-workbench-${width}.png`, Buffer.from(screenshot.data, "base64"));
    }
  } finally { await browser.close(); }
});
