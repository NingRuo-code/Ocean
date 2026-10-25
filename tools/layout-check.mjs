import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, waitFor } from "./lib/browser-driver.mjs";

const browser = await launchBrowser(process.env.EDGE ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
const c = browser.cdp;
try {
  await c.send("Page.enable");
  for (const width of [1680, 1440, 1280, 390]) {
    await c.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send("Page.navigate", { url: process.env.PAGE || pathToFileURL(resolve("frontend/prototype/prototype-fishing.html")).href });
    await waitFor(c, "document.getElementById('preferenceStatus')?.getAttribute('aria-busy') === 'false'");
    const before = await c.evaluate(`(()=>{const side=document.getElementById('resultPanel'),wb=document.getElementById('taskWorkbench');
      return {overflow:document.documentElement.scrollWidth>innerWidth,closed:side.hidden&&!wb.open,top:document.getElementById('topbar').offsetHeight};})()`);
    assert.equal(before.overflow, false, `page overflow ${width}`);
    assert.ok(before.top < 64, `header ${width}`);
    if (width < 760) assert.equal(before.closed, true, "small screen panels closed by default");
    await c.evaluate("document.getElementById('workbenchToggle').click();document.getElementById('nearbyFront').click()");
    const layout = await c.evaluate(`(()=>{const m=document.getElementById('map').getBoundingClientRect(),w=document.getElementById('taskWorkbench').getBoundingClientRect(),s=document.getElementById('resultPanel').getBoundingClientRect();
      return {map:m.width,disjoint:w.right<=m.left+1&&m.right<=s.left+1,clipped:[...document.querySelectorAll('.side *, .workbench *')].filter(n=>n.clientWidth>0&&n.scrollWidth>n.clientWidth+2).map(n=>n.id||n.className),metrics:document.querySelectorAll('#nowMetrics .m').length};})()`);
    assert.equal(layout.metrics, 3);
    assert.deepEqual(layout.clipped, [], `text clipping ${width}`);
    if (width > 760) { assert.ok(layout.map >= width - 600); assert.equal(layout.disjoint, true); }
    await c.evaluate("document.getElementById('headerFilter').click()");
    assert.equal(await c.evaluate("document.getElementById('filterPanel').getBoundingClientRect().right<=innerWidth && !document.getElementById('filterPanel').hidden"), true);
    console.log(`PASS ${width}: panels, filters, text and map bounds`);
  }
} finally { await browser.close(); }
