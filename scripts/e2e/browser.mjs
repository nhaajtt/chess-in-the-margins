// Drives a headless Chrome/Chromium over the DevTools protocol, with nothing but Node's built-ins.
//   const browser = await Browser.launch();  const page = await browser.newPage();  await page.goto(url);  ...  await browser.close();
//
// One fact shapes everything here: in headless Chrome, page timers and worker messages stall unless an awaited
// Runtime.evaluate (awaitPromise) is pending. So every wait happens INSIDE the page, as a promise that is being
// awaited; Node never sleeps while the page is expected to make progress.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/* ---------- finding Chrome ---------- */

const WINDOWS = [
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
];
const MAC = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const LINUX_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "microsoft-edge"];

export function findChrome() {
  const env = process.env.CHROME_PATH;
  if (env) { if (fs.existsSync(env)) return env; throw new Error(`CHROME_PATH is set to ${env}, but that file does not exist`); }
  for (const p of [...WINDOWS, ...MAC].filter(Boolean)) if (fs.existsSync(p)) return p;
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    for (const n of LINUX_NAMES) {
      for (const ext of process.platform === "win32" ? [".exe", ""] : [""]) {
        const p = path.join(dir, n + ext);
        try { if (fs.statSync(p).isFile()) return p; } catch { /* not here */ }
      }
    }
  }
  for (const p of ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium", "/opt/google/chrome/chrome"]) if (fs.existsSync(p)) return p;
  throw new Error("No Chrome or Chromium found. Set CHROME_PATH to the browser's executable.");
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/* ---------- what counts as a problem ---------- */

// Things the test host answers 404 on purpose (the real host owns them), and the fonts the page asks the internet for.
const EXPECTED_404 = [/\/api\/weather(\?|$)/, /\/_vercel\//];
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const isExpected404 = (url) => EXPECTED_404.some((re) => re.test(url || ""));
// A warning that is known and harmless; it is counted, not failed.
const KNOWN_WARNINGS = [/GSAP target .* not found/i];

/* ---------- the connection ---------- */

export class Browser {
  static async launch({ width = 1280, height = 900, args = [] } = {}) {
    const exe = findChrome();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "citm-e2e-"));
    const port = await freePort();
    const chrome = spawn(exe, [
      "--headless=new", `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`, "--no-first-run", "--no-default-browser-check", "--mute-audio", "--disable-extensions",
      "--disable-background-networking", "--disable-dev-shm-usage", "--disable-sync", "--disable-component-update", "--disable-features=Translate,MediaRouter",
      "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
      ...(process.env.CI || process.getuid?.() === 0 ? ["--no-sandbox"] : []), ...args, "about:blank",
    ], { stdio: "ignore" });
    const b = new Browser(chrome, profile, port);
    try { await b.connect(); } catch (e) { await b.close(); throw e; }
    return b;
  }

  constructor(chrome, profile, port) {
    this.chrome = chrome; this.profile = profile; this.port = port;
    this.pid = chrome.pid;
    this.nextId = 0; this.waiting = new Map(); this.pages = new Map();   // sessionId -> Page
    this.closed = false;
  }

  async connect() {
    let info;
    for (let i = 0; i < 120 && !info; i++) {
      if (this.chrome.exitCode !== null) throw new Error(`the browser exited at start (code ${this.chrome.exitCode})`);
      try { info = await (await fetch(`http://127.0.0.1:${this.port}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    if (!info) throw new Error("the browser did not open its debugging port");
    this.ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((ok, bad) => { this.ws.onopen = ok; this.ws.onerror = () => bad(new Error("could not connect to the browser")); });
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    this.ws.onclose = () => { for (const w of this.waiting.values()) w.reject(new Error("the browser connection closed")); this.waiting.clear(); };
    this.version = info.Browser;
  }

  onMessage(m) {
    if (m.id !== undefined) {
      const w = this.waiting.get(m.id);
      if (!w) return;
      this.waiting.delete(m.id);
      if (m.error) w.reject(new Error(`${w.method}: ${m.error.message}`)); else w.resolve(m.result);
    } else if (m.sessionId && this.pages.has(m.sessionId)) this.pages.get(m.sessionId).onEvent(m.method, m.params);
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      if (this.closed) return reject(new Error("the browser is closed"));
      const id = ++this.nextId;
      this.waiting.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  /** A fresh page in its own browser context (its own storage, cookies and service workers). */
  async newPage(opts = {}) {
    const { browserContextId } = await this.send("Target.createBrowserContext", { disposeOnDetach: false });
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, sessionId, targetId, browserContextId, opts);
    this.pages.set(sessionId, page);
    await page.init();
    return page;
  }

  async close() {
    if (this.closed) return;
    try { await Promise.race([this.send("Browser.close"), new Promise((r) => setTimeout(r, 2000))]); } catch { /* going away anyway */ }
    this.closed = true;
    try { this.ws?.close(); } catch { /* already */ }
    if (this.chrome.exitCode === null) {
      this.chrome.kill();
      await new Promise((r) => { const t = setTimeout(r, 3000); this.chrome.once("exit", () => { clearTimeout(t); r(); }); });
      if (this.chrome.exitCode === null) { try { process.kill(this.pid, "SIGKILL"); } catch { /* gone */ } }
    }
    // Chrome can hold the profile for a moment after it exits
    for (let i = 0; i < 20; i++) {
      try { fs.rmSync(this.profile, { recursive: true, force: true }); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }
  }
}

/* ---------- a page ---------- */

export class Page {
  constructor(browser, sessionId, targetId, contextId, opts) {
    this.browser = browser; this.sessionId = sessionId; this.targetId = targetId; this.contextId = contextId;
    this.opts = opts;
    this.problems = [];          // { kind, text }
    this.allowed = [];           // problems that were expected and let through, for the record
    this.warningsCounted = { gsapTargetMissing: 0 };
    this.responses = [];         // { url, status }
    this.listeners = new Map();
    this.expected404 = [];       // URLs a test says will answer 404 on purpose
  }
  expect404(re) { this.expected404.push(re); }
  isExpected404(url) { return isExpected404(url) || this.expected404.some((re) => re.test(url || "")); }

  send(method, params = {}) { return this.browser.send(method, params, this.sessionId); }

  async init() {
    const s = (m, p) => this.send(m, p);
    await Promise.all([s("Runtime.enable"), s("Log.enable"), s("Page.enable"), s("Network.enable")]);
    await s("Runtime.addBinding", { name: "__e2eReport" });
    // report page-side faults that the console would only half show; the page cannot hide them from us
    await s("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const say = (kind, text) => { try { window.__e2eReport(JSON.stringify({ kind, text: String(text).slice(0, 500) })); } catch (e) {} };
      addEventListener("securitypolicyviolation", (e) => say("csp", e.violatedDirective + " blocked " + (e.blockedURI || e.sample || "inline") + " at " + (e.sourceFile || "") + ":" + (e.lineNumber || 0)));
      addEventListener("unhandledrejection", (e) => say("rejection", (e.reason && (e.reason.stack || e.reason.message)) || e.reason));
      addEventListener("error", (e) => say("exception", e.message + " at " + (e.filename || "") + ":" + (e.lineno || 0)));
    })();` });
    // Fonts come from the internet: answer them with nothing, so a run does not depend on being online. Anything else external is refused.
    await s("Fetch.enable", { patterns: [{ urlPattern: "https://*" }] });
    if (this.opts.width) await this.setViewport(this.opts.width, this.opts.height, this.opts.mobile);
  }

  /* ---- events ---- */
  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  problem(kind, text) {
    const t = String(text).replace(/\s+/g, " ").slice(0, 400);
    this.problems.push({ kind, text: t });
  }
  onEvent(method, p) {
    if (method === "Fetch.requestPaused") {
      const url = p.request.url;
      if (FONT_HOSTS.test(url)) {
        this.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: /gstatic/.test(url) ? "font/woff2" : "text/css" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: "" }).catch(() => {});
      } else {
        this.problem("external", `the page asked the internet for ${url}`);
        this.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }).catch(() => {});
      }
    } else if (method === "Runtime.exceptionThrown") {
      const d = p.exceptionDetails;
      this.problem("exception", (d.exception && (d.exception.description || d.exception.value)) || d.text);
    } else if (method === "Runtime.bindingCalled" && p.name === "__e2eReport") {
      try { const m = JSON.parse(p.payload); this.problem(m.kind, m.text); } catch { /* ignore */ }
    } else if (method === "Runtime.consoleAPICalled") {
      const text = p.args.map((a) => (a.value !== undefined ? a.value : a.description || "")).join(" ");
      if (p.type === "error") this.problem("console.error", text);
      else if (p.type === "warning") {
        if (KNOWN_WARNINGS.some((re) => re.test(text))) { this.warningsCounted.gsapTargetMissing++; this.allowed.push({ kind: "warning", text }); }
      } else if (p.type === "assert") this.problem("console.assert", text);
    } else if (method === "Log.entryAdded") {
      const e = p.entry;
      if (e.level !== "error") return;
      const net = /Failed to load resource/i.test(e.text);
      if (net && this.isExpected404(e.url)) { this.allowed.push({ kind: "404", text: e.url }); return; }
      if (net && FONT_HOSTS.test(e.url || "")) { this.allowed.push({ kind: "font", text: e.url }); return; }
      this.problem("log.error", `${e.text} ${e.url || ""}`);
    } else if (method === "Network.responseReceived") {
      const { url, status } = p.response;
      this.responses.push({ url, status });
      if (status >= 400 && !this.isExpected404(url) && !FONT_HOSTS.test(url)) this.problem("http", `${status} for ${url}`);
    }
    for (const fn of this.listeners.get(method) || []) fn(p);
  }

  /** Throw if anything went wrong since the page opened (or since the last call). */
  assertClean(label = "the page") {
    const bad = this.problems.splice(0);
    if (bad.length) throw new Error(`${label} had ${bad.length} problem(s):\n` + bad.map((b) => `  [${b.kind}] ${b.text}`).join("\n"));
  }

  /* ---- navigation and settings ---- */
  // resolves when the page fires its load event (or after the timeout, so a page that never finishes cannot hang a test)
  loaded(timeout) {
    return new Promise((ok) => {
      const timer = setTimeout(done, timeout);
      const listener = () => done();
      this.on("Page.loadEventFired", listener);
      function done() { clearTimeout(timer); ok(); }
    });
  }
  async goto(url, { timeout = 60000 } = {}) {
    const loaded = this.loaded(timeout);
    const r = await this.send("Page.navigate", { url });
    if (r.errorText) throw new Error(`could not open ${url}: ${r.errorText}`);
    await loaded;
  }
  async reload() {
    const loaded = this.loaded(60000);
    await this.send("Page.reload");
    await loaded;
  }
  setReducedMotion(on) { return this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: on ? "reduce" : "no-preference" }] }); }
  setViewport(width, height, mobile = false) {
    return this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  }
  setOffline(offline) {
    return this.send("Network.emulateNetworkConditions", { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }

  /**
   * Put localStorage entries in place for an origin before its next page starts (a null value removes the key).
   * Done once per call: a reload of the same tab does not write them again, so what the page saved in between stays.
   */
  async seedStorage(origin, entries) {
    if (this.seedScript) await this.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: this.seedScript });
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const { identifier } = await this.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      if (location.origin !== ${JSON.stringify(origin)}) return;
      const mark = "__e2e_seed_${nonce}";
      if (sessionStorage.getItem(mark)) return;
      sessionStorage.setItem(mark, "1");
      for (const [k, v] of ${JSON.stringify(Object.entries(entries))}) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    })();` });
    this.seedScript = identifier;
  }

  /* ---- running code in the page ---- */
  /** Evaluate an expression (a promise is awaited). Rejects with the page's error text, or after `timeout` ms. */
  // safe-anything:ignore runs test code in the test browser
  async eval(expression, { timeout = 30000, label } = {}) {
    let timer;
    const stuck = new Promise((_, bad) => { timer = setTimeout(() => bad(new Error(`timed out after ${timeout} ms in the page: ${label || String(expression).slice(0, 120)}`)), timeout); });
    try {
      const r = await Promise.race([this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }), stuck]);
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(`the page threw: ${(d.exception && (d.exception.description || d.exception.value)) || d.text}\n  in: ${String(expression).slice(0, 160)}`);
      }
      return r.result.value;
    } finally { clearTimeout(timer); }
  }

  /**
   * Wait, inside the page, until `expression` is truthy. Throws when it never is, with the value of `probe` (an expression) for a clue.
   * Polls with a short in-page timer, so the page keeps running while we wait.
   */
  async waitFor(expression, { timeout = 20000, label, probe } = {}) {
    // E2E_TIMEOUT_SCALE=0.25 makes every wait give up four times sooner (used to see quickly what a deliberate break turns red)
    timeout = Math.round(timeout * (Number(process.env.E2E_TIMEOUT_SCALE) || 1));
    const code = `new Promise((resolve) => {
      const t0 = Date.now();
      const test = () => { try { return Boolean(${expression}); } catch (e) { return false; } };
      (function poll() {
        if (test()) return resolve({ ok: true });
        if (Date.now() - t0 > ${timeout}) { let probe = null; try { probe = ${probe ? `(${probe})` : "null"}; } catch (e) { probe = String(e); } return resolve({ ok: false, probe }); }
        setTimeout(poll, 40);
      })();
    })`;
    const r = await this.eval(code, { timeout: timeout + 15000, label: label || expression });
    if (!r.ok) throw new Error(`gave up waiting ${timeout} ms for: ${label || expression}${r.probe != null ? `\n  last seen: ${JSON.stringify(r.probe)}` : ""}`);
  }

  /** Wait a number of milliseconds inside the page (use only when time itself is what is being tested). */
  inPage(ms) { return this.eval(`new Promise((r) => setTimeout(r, ${ms}))`, { timeout: ms + 15000 }); }

  /* ---- real input ---- */
  async key(key, { shift = false } = {}) {
    const codes = { Tab: ["Tab", 9], Enter: ["Enter", 13], Escape: ["Escape", 27], ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40], ArrowLeft: ["ArrowLeft", 37], ArrowRight: ["ArrowRight", 39], " ": ["Space", 32], Home: ["Home", 36], End: ["End", 35] };
    const [code, vk] = codes[key] || [`Key${key.toUpperCase()}`, key.toUpperCase().charCodeAt(0)];
    const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: shift ? 8 : 0 };
    const text = key.length === 1 ? key : key === "Enter" ? "\r" : undefined;
    await this.send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", ...base, ...(text ? { text } : {}) });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }
  /** A finger tap at page coordinates (needs touch emulation, which this turns on). */
  async tap(x, y) {
    await this.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await this.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await this.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  /** Let the page use the clipboard (copy and read back). */
  grantClipboard(origin) {
    return this.browser.send("Browser.grantPermissions", { origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], browserContextId: this.contextId });
  }
  async screenshot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  }

  async close() {
    this.browser.pages.delete(this.sessionId);
    try { await this.browser.send("Target.closeTarget", { targetId: this.targetId }); } catch { /* gone */ }
    try { await this.browser.send("Target.disposeBrowserContext", { browserContextId: this.contextId }); } catch { /* gone */ }
  }
}
