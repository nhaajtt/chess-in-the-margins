// A tiny static server for the project root that behaves like the real host closely enough for browser tests:
// it sends the same response headers as vercel.json (so the page runs under the real Content-Security-Policy),
// understands cleanUrls and the /r/:code -> / rewrite, and answers 404 for the host-only paths (/api/weather, /_vercel/*).
//   node scripts/e2e/server.mjs [root] [port]        prints the address and keeps serving
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, "..", "..");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff": "font/woff", ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
};

// "/(assets|media)/(.*)", "/r/:code" and friends, turned into a regular expression
function pattern(source) {
  const re = source.replace(/:[A-Za-z_]+/g, "([^/]+)");
  return new RegExp("^" + re + "$");
}

// Names of the paths the real host answers itself and that a plain file server cannot
export const HOST_ONLY = [/^\/api\//, /^\/_vercel\//];

/** Start the server. opts: { root, port, connectSrc: ["http://localhost:8787"] } (extra connect-src entries, for the online-rooms test only) */
export function startServer(opts = {}) {
  const root = path.resolve(opts.root || projectRoot);
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const headerRules = (config.headers || []).map((h) => ({ re: pattern(h.source), headers: h.headers }));
  const rewrites = (config.rewrites || []).map((r) => ({ re: pattern(r.source), to: r.destination }));
  const clean = config.cleanUrls === true;
  const extraConnect = opts.connectSrc || [];
  const seen = [];   // every request path answered, for tests that want to look

  const fileFor = (urlPath) => {
    const rel = decodeURIComponent(urlPath).replace(/^\/+/, "");
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null;      // never leave the project
    const tries = [abs];
    if (urlPath.endsWith("/") || rel === "") tries.unshift(path.join(abs, "index.html"));
    else if (clean) tries.push(abs + ".html");
    for (const f of tries) { try { if (fs.statSync(f).isFile()) return f; } catch { /* next */ } }
    return null;
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = url.pathname;
    seen.push(p);
    const send = (status, body, extra = {}) => {
      const headers = { ...extra };
      if (status !== 404) for (const rule of headerRules) if (rule.re.test(p)) for (const { key, value } of rule.headers) headers[key] = value;
      if (headers["Content-Security-Policy"] && extraConnect.length) {
        headers["Content-Security-Policy"] = headers["Content-Security-Policy"].replace(/connect-src ([^;]*)/, (m, v) => `connect-src ${v} ${extraConnect.join(" ")}`);
      }
      res.writeHead(status, headers);
      res.end(req.method === "HEAD" ? undefined : body);
    };
    if (req.method !== "GET" && req.method !== "HEAD") return send(405, "method not allowed", { "Content-Type": "text/plain" });
    if (HOST_ONLY.some((re) => re.test(p))) return send(404, "", { "Content-Type": "text/plain" });
    // cleanUrls: "/index.html" and "/page.html" are sent to "/" and "/page"
    if (clean && /\.html$/.test(p)) {
      const to = p.replace(/\/index\.html$/, "/").replace(/\.html$/, "") || "/";
      return send(308, "", { Location: to + url.search });
    }
    for (const r of rewrites) if (!fileFor(p) && r.re.test(p)) { p = r.to; break; }
    const file = fileFor(p);
    if (!file) return send(404, "not found", { "Content-Type": "text/plain" });
    const body = fs.readFileSync(file);
    // the rules above match the path the visitor asked for, not the rewritten one, so match again on the original
    send(200, body, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port || 0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ port, url: `http://127.0.0.1:${port}`, seen, close: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(() => ok()); }) });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer({ root: process.argv[2], port: Number(process.argv[3]) || 0 });
  console.log(`serving on ${s.url}`);
}
