// The offline copy: the service worker registers, fills its cache, and a second visit works with no network at all.
//
// The page registers the worker only on https (game.js, "serviceWorker" line), and the test host is plain http on 127.0.0.1, so the
// test registers /sw.js itself; what is tested is the worker and its cache, not the one line that asks for it.
import fs from "node:fs";
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();
const CORE = JSON.parse(fs.readFileSync(new URL("../../sw.js", import.meta.url), "utf8").match(/const CORE = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));

// wait (inside the page) until the worker's cache holds at least n files
const cacheHolds = async (g, n, timeout = 60000) => {
  const ok = await g.page.eval(`(async () => { const t0 = Date.now(); while (Date.now() - t0 < ${timeout}) { const keys = await caches.keys(); if (keys.length) { const c = await caches.open(keys[0]); if ((await c.keys()).length >= ${n}) return true; } await new Promise((r) => setTimeout(r, 100)); } return false; })()`, { timeout: timeout + 10000 });
  assert.equal(ok, true, `the cache never reached ${n} files`);
};

test("the service worker registers, takes control and caches the game", async (g) => {
  await g.open();
  assert.equal(await g.page.eval(`"serviceWorker" in navigator`), true);
  const scope = await g.page.eval(`navigator.serviceWorker.register("/sw.js").then((r) => r.scope)`);
  assert.equal(scope, g.base + "/");
  await g.page.eval(`navigator.serviceWorker.ready.then(() => true)`);
  await g.waitFor(`navigator.serviceWorker.controller !== null`, { label: "the worker to take control", timeout: 30000 });
  // every file of the core list is in the cache
  await cacheHolds(g, CORE.length);
  const cached = await g.page.eval(`caches.keys().then(async (keys) => { const c = await caches.open(keys[0]); return (await c.keys()).map((r) => new URL(r.url).pathname); })`, { timeout: 60000 });
  for (const path of CORE) assert.ok(cached.includes(path), `${path} is in the offline copy`);
  assert.ok(cached.filter((p) => p.endsWith(".mp3")).length > 20, "the sounds are cached too");
});

test("a second visit works offline: a game against the computer can be played", async (g, page) => {
  await g.open();
  await page.eval(`navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then(() => true)`);
  await g.waitFor(`navigator.serviceWorker.controller !== null`, { timeout: 30000, label: "the worker to take control" });
  // wait for the core files to be in the cache, then load once more under the worker's control so the page itself is stored
  await cacheHolds(g, CORE.length);
  await page.reload();
  await g.ready();

  // now there is no network: the machine is offline and the server is gone
  await page.setOffline(true);
  await g.server.close();
  await page.reload();
  await g.ready();
  assert.equal((await g.pieces()).length, 32, "the board is drawn from the offline copy");
  assert.equal(await g.page.eval(`navigator.onLine`), false);
  assert.equal(await g.page.eval(`Boolean(window.ChessEngine && window.Margins && window.Paper && window.Pgn && window.Review && window.Adventure && window.School)`), true, "every script came from the copy");

  await g.selectRadio("level", "easy");
  await g.press("new");
  await g.settled();
  await g.move("e2", "e4");
  await g.waitFor(`Margins.played().length === 2`, { label: "the computer to answer offline", timeout: 30000 });
  await g.settled();
  // two on one screen works too
  await g.selectRadio("mode", "friend");
  await g.settled();
  assert.equal(await g.move("d2", "d4"), "d4");
});
