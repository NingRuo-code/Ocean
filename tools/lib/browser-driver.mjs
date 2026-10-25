import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((done, fail) => { socket.addEventListener("open", done, { once: true }); socket.addEventListener("error", fail, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const call = pending.get(message.id);
    if (call) {
      pending.delete(message.id); clearTimeout(call.timer);
      message.error ? call.fail(new Error(message.error.message)) : call.done(message.result);
    } else for (const listener of listeners) listener(message);
  });
  return {
    onEvent: (listener) => listeners.add(listener),
    send(method, params = {}) {
      return new Promise((done, fail) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, 5000);
        pending.set(id, { done, fail, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression) {
      const value = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw new Error("Browser evaluation failed: " + (value.exceptionDetails.exception?.description || value.exceptionDetails.text));
      return value.result?.value;
    },
    close() {
      for (const call of pending.values()) { clearTimeout(call.timer); call.fail(new Error("Browser closed")); }
      pending.clear(); socket.close();
    },
  };
}

export async function launchBrowser(executable) {
  const temporaryRoot = resolve(tmpdir());
  const profile = await mkdtemp(join(temporaryRoot, "ocean-benchmark-"));
  const child = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1440,900", "about:blank"],
  { stdio: "ignore", windowsHide: true });
  let launchError = null;
  child.on("error", (error) => { launchError = error; });
  let port;
  try {
    for (let attempt = 0; attempt < 100 && !port; attempt++) {
      if (launchError) throw launchError;
      try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); }
      catch { await sleep(100); }
    }
    if (!port) throw new Error("Browser debugging endpoint unavailable");
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = pages.find((entry) => entry.type === "page");
    const cdp = await connectCdp(page.webSocketDebuggerUrl);
    const browser = await connectCdp(version.webSocketDebuggerUrl);
    return {
      cdp, browser, version,
      async close() {
        try { await browser.send("Browser.close"); } catch { /* may close before its reply */ }
        cdp.close(); browser.close(); child.kill();
        if (dirname(profile) === temporaryRoot && basename(profile).startsWith("ocean-benchmark-")) {
          await rm(profile, { recursive: true, force: true }).catch(() => {});
        }
      },
    };
  } catch (error) {
    child.kill();
    if (dirname(profile) === temporaryRoot && basename(profile).startsWith("ocean-benchmark-")) await rm(profile, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
