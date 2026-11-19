// The test host behaves like the real one (vercel.json): the same headers, clean URLs, the room link rewrite, and 404 for the host's own paths.
// This file needs no browser.
import fs from "node:fs";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./server.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const rule = (source) => Object.fromEntries(config.headers.find((h) => h.source === source).headers.map((h) => [h.key.toLowerCase(), h.value]));
let host;
before(async () => { host = await startServer(); });
after(async () => { await host.close(); });
const get = (p, opts) => fetch(host.url + p, { redirect: "manual", ...opts });

test("it binds to the loopback address on a free port", () => {
  assert.match(host.url, /^http:\/\/127\.0\.0\.1:\d+$/);
});

test("every response carries the headers of vercel.json", async () => {
  const all = rule("/(.*)");
  for (const p of ["/", "/chess.css", "/game/01-board.js", "/favicon.svg"]) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    for (const [k, v] of Object.entries(all)) assert.equal(r.headers.get(k), v, `${p}: ${k}`);
  }
});

test("assets, the service worker and the manifest get their own rules", async () => {
  assert.equal((await get("/assets/icons/icon-192.png")).headers.get("cache-control"), rule("/(assets|media)/(.*)")["cache-control"]);
  assert.equal((await get("/sw.js")).headers.get("cache-control"), "no-cache");
  assert.equal((await get("/manifest.webmanifest")).headers.get("content-type"), "application/manifest+json");
});

test("file types are right", async () => {
  assert.match((await get("/")).headers.get("content-type"), /^text\/html/);
  assert.match((await get("/game/01-board.js")).headers.get("content-type"), /^text\/javascript/);
  assert.match((await get("/chess.css")).headers.get("content-type"), /^text\/css/);
  assert.equal((await get("/favicon.svg")).headers.get("content-type"), "image/svg+xml");
});

test("clean URLs: /index.html goes to /", async () => {
  const r = await get("/index.html");
  assert.equal(r.status, 308);
  assert.equal(r.headers.get("location"), "/");
});

test("/r/CODE shows the game page, and keeps the address", async () => {
  const home = await (await get("/")).text();
  const r = await get("/r/ABC234");
  assert.equal(r.status, 200);
  assert.equal(await r.text(), home);
  assert.equal(r.headers.get("content-security-policy"), rule("/(.*)")["content-security-policy"]);
  assert.equal((await get("/r/")).status, 404, "the rewrite wants a code");
});

test("the host's own paths answer 404", async () => {
  assert.equal((await get("/api/weather")).status, 404);
  assert.equal((await get("/api/weather?lat=1")).status, 404);
  assert.equal((await get("/_vercel/insights/script.js")).status, 404);
  assert.equal((await get("/_vercel/speed-insights/script.js")).status, 404);
});

test("unknown files are 404, and nothing outside the project is served", async () => {
  assert.equal((await get("/nope.html")).status, 308, "clean URLs redirect first");
  assert.equal((await get("/no-such-file")).status, 404);
  assert.equal((await get("/..%2f..%2fpackage.json")).status, 404);
  assert.equal((await get("/%2e%2e/%2e%2e/etc/passwd")).status, 404);
});

test("only GET and HEAD are answered", async () => {
  assert.equal((await get("/", { method: "POST" })).status, 405);
  assert.equal((await get("/", { method: "HEAD" })).status, 200);
});

test("extra connect-src entries (for the online-rooms test) are added to the policy and nothing else is loosened", async () => {
  const s = await startServer({ connectSrc: ["http://localhost:8787", "ws://localhost:8787"] });
  try {
    const csp = (await fetch(s.url + "/")).headers.get("content-security-policy");
    assert.match(csp, /connect-src 'self' https:\/\/fonts\.googleapis\.com [^;]*http:\/\/localhost:8787 ws:\/\/localhost:8787;/);
    assert.equal(csp.replace(/ http:\/\/localhost:8787 ws:\/\/localhost:8787/, ""), rule("/(.*)")["content-security-policy"]);
  } finally { await s.close(); }
});
