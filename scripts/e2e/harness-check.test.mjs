// The safety net checks itself: the real security policy is in force in the page, and every kind of fault the other tests
// rely on being reported (console error, exception, rejected promise, policy violation, missing file) really is reported.
import fs from "node:fs";
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();
const vercel = JSON.parse(fs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const policy = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;

// run `code` in the page, wait for the page to report it, hand back what was reported and clear it so the test stays clean
async function reported(g, code, kind) {
  await g.page.eval(code);
  await g.page.waitFor(`true`);
  const deadline = Date.now() + 5000;
  while (!g.page.problems.some((p) => p.kind === kind) && Date.now() < deadline) await g.page.inPage(50);
  return g.page.problems.splice(0);
}

test("the page is served with the real Content-Security-Policy", async (g) => {
  await g.open();
  const headers = await g.page.eval(`fetch(location.href).then((r) => Object.fromEntries([...r.headers]))`);
  assert.equal(headers["content-security-policy"], policy);
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
});

test("an inline script is refused, and the test notices", async (g) => {
  await g.open();
  const found = await reported(g, `(() => { const s = document.createElement("script"); s.textContent = "window.__ran = true"; document.head.append(s); })()`, "csp");
  assert.ok(found.some((p) => p.kind === "csp" && /script-src/.test(p.text)), JSON.stringify(found));
  assert.equal(await g.page.eval(`window.__ran === true`), false, "the inline script did not run");
});

test("an inline style attribute is refused, and the test notices", async (g) => {
  await g.open();
  const found = await reported(g, `document.getElementById("status").setAttribute("style", "color: red")`, "csp");
  assert.ok(found.some((p) => p.kind === "csp" && /style-src/.test(p.text)), JSON.stringify(found));
});

test("a script or a picture from another site is refused", async (g) => {
  await g.open();
  const found = await reported(g, `(() => { const i = new Image(); i.src = "http://127.0.0.1:1/x.png"; document.body.append(i); })()`, "csp");
  assert.ok(found.some((p) => p.kind === "csp"), JSON.stringify(found));
});

test("a console error is reported", async (g) => {
  await g.open();
  const found = await reported(g, `console.error("something is wrong")`, "console.error");
  assert.ok(found.some((p) => p.kind === "console.error" && /something is wrong/.test(p.text)));
});

test("an uncaught exception is reported", async (g) => {
  await g.open();
  const found = await reported(g, `setTimeout(() => { throw new Error("boom"); }, 0)`, "exception");
  assert.ok(found.some((p) => p.kind === "exception" && /boom/.test(p.text)));
});

test("an unhandled promise rejection is reported", async (g) => {
  await g.open();
  const found = await reported(g, `(() => { Promise.reject(new Error("nobody caught this")); })()`, "rejection");
  assert.ok(found.some((p) => p.kind === "rejection" && /nobody caught this/.test(p.text)));
});

test("a missing file is reported, but the two paths the real host serves itself are not", async (g) => {
  await g.open();
  // /api/weather and /_vercel/* answer 404 here on purpose (the page asks for them on its own and copes)
  await g.page.eval(`fetch("/api/weather").then((r) => r.status)`);
  await g.page.eval(`fetch("/_vercel/insights/script.js").then((r) => r.status)`);
  assert.deepEqual(g.page.problems.splice(0), []);
  await g.page.eval(`fetch("/no-such-file.js").then((r) => r.status)`);
  const deadline = Date.now() + 5000;
  while (!g.page.problems.some((p) => p.kind === "http") && Date.now() < deadline) await g.page.inPage(50);
  assert.ok(g.page.problems.splice(0).some((p) => p.kind === "http" && /404 .*no-such-file/.test(p.text)));
});

test("asking the internet for anything but the fonts is reported", async (g) => {
  await g.open();
  await g.page.eval(`fetch("https://example.com/x").catch(() => 0)`);
  const found = g.page.problems.splice(0);
  assert.ok(found.some((p) => p.kind === "csp" || p.kind === "external" || p.kind === "log.error"), JSON.stringify(found));
});
