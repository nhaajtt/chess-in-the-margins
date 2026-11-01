// Checks that the site holds together: every file the page, the offline copy and the manifest name is really
// there, the security headers allow exactly what the page uses, and nothing private is tracked. node scripts/site-check.mjs
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const has = (p) => existsSync(new URL(p.replace(/^\//, "").replace(/\?.*$/, ""), root));
const html = read("index.html");
const sw = read("sw.js");
const vercel = JSON.parse(read("vercel.json"));
const csp = vercel.headers.find((h) => h.source === "/(.*)").headers.find((h) => h.key === "Content-Security-Policy").value;
const directive = (name) => (csp.split(";").map((s) => s.trim().split(/\s+/)).find(([k]) => k === name) || []).slice(1);

test("every local script, style and icon on the page exists", () => {
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]).filter((p) => p !== "/" && !p.startsWith("/_vercel/"));
  assert.ok(refs.length > 10);
  for (const p of refs) assert.ok(has(p), `missing ${p}`);
});

test("the offline copy lists only real files, and every sound", () => {
  const list = (name) => JSON.parse(sw.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`))[1].replace(/,\s*\]/, "]"));
  for (const p of list("CORE").filter((p) => p !== "/")) assert.ok(has(p), `sw.js caches missing ${p}`);
  const sounds = list("SOUNDS");
  for (const p of sounds) assert.ok(has(p), `sw.js caches missing ${p}`);
  const onDisk = readdirSync(new URL("assets/sfx/", root)).filter((f) => f.endsWith(".mp3")).map((f) => `/assets/sfx/${f}`);
  const listed = new Set(sounds.map((p) => p.replace(/\?.*$/, "")));
  for (const p of onDisk) assert.ok(listed.has(p), `sound ${p} is not in the offline copy`);
  const ver = read("sound.js").match(/VER\s*=\s*"?(\d+)"?/);
  if (ver) for (const p of sounds) assert.ok(p.endsWith(`?v=${ver[1]}`), `${p} has a different version than sound.js`);
  for (const script of [...html.matchAll(/<script[^>]+src="(\/[^"]+)"/g)].map((m) => m[1]).filter((p) => !p.startsWith("/_vercel/"))) {
    assert.ok(sw.includes(`"${script}"`), `${script} is on the page but not in the offline copy`);
  }
});

test("the manifest's icons exist", () => {
  const m = JSON.parse(read("manifest.webmanifest"));
  for (const i of m.icons) assert.ok(has(i.src), `missing icon ${i.src}`);
});

test("the security headers allow the rooms service and nothing loose", () => {
  const api = read("game.js").match(/"(https:\/\/[a-z0-9.-]+\.workers\.dev)"/)[1];
  const connect = directive("connect-src");
  assert.ok(connect.includes(api), "connect-src misses the rooms service");
  assert.ok(connect.includes(api.replace(/^https/, "wss")), "connect-src misses the rooms websocket");
  for (const d of ["default-src", "script-src", "style-src", "img-src", "connect-src", "font-src"]) {
    const v = directive(d);
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'", "*", "http:", "https:", "data:"].filter((b) => !(d === "img-src" && b === "data:"))) assert.ok(!v.includes(bad), `${d} allows ${bad}`);
  }
  assert.deepEqual(directive("frame-ancestors"), ["'none'"]);
  assert.deepEqual(directive("object-src"), ["'none'"]);
  const keys = vercel.headers.find((h) => h.source === "/(.*)").headers.map((h) => h.key);
  for (const k of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]) assert.ok(keys.includes(k), `no ${k}`);
});

test("no inline scripts or handlers that the policy would block", () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "inline <script> in index.html");
  assert.ok(!/\son[a-z]+\s*=/i.test(html), "inline event handler in index.html");
  assert.ok(!/\sstyle\s*=/i.test(html), "inline style attribute in index.html");
});

test("nothing private is tracked or shipped", () => {
  const files = execSync("git ls-files", { cwd: root }).toString().trim().split("\n");
  for (const f of files) assert.ok(!/(^|\/)\.env(\.|$)|\.pem$|\.key$|\.dev\.vars$|(^|\/)\.vercel\//.test(f), `${f} should not be in git`);
  const text = files.filter((f) => /\.(js|mjs|json|jsonc|html|css|md|webmanifest|yml)$/.test(f) && !f.startsWith("vendor/") && !f.endsWith("package-lock.json") && f !== "scripts/site-check.mjs");
  const secret = /(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_|sk-[A-Za-z0-9]{20,}|xox[bap]-|eyJhbGciOi[A-Za-z0-9_-]{20,}|VERCEL_OIDC_TOKEN=|CLOUDFLARE_API_TOKEN=\S)/;
  for (const f of text) assert.ok(!secret.test(read(f)), `${f} looks like it holds a secret`);
  const ignore = read(".vercelignore");
  for (const p of ["server", "scripts", ".env"]) assert.ok(ignore.includes(p), `.vercelignore should keep ${p} off the site`);
});
