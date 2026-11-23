// Shared pieces for the browser tests: one server and one browser per test file, a fresh page (its own storage)
// per test, and a Game helper that knows how to read and drive the board.
//
//   const { test } = e2e();
//   test("castling", async (g) => { await g.open({ fen: "...", mode: "friend" }); await g.move("e1", "g1"); ... });
//
// A test fails if the page logged an error, threw, rejected a promise, broke the Content-Security-Policy or asked the
// network for something that was not there (the paths the real host serves itself are the only exception).
import { test as nodeTest, before, after } from "node:test";
import assert from "node:assert/strict";
import { Browser } from "./browser.mjs";
import { startServer } from "./server.mjs";

export { assert };

const FILES = "abcdefgh";
export const sqNum = (name) => (Number(name[1]) - 1) * 16 + FILES.indexOf(name[0]);
export const sqName = (n) => FILES[n & 7] + ((n >> 4) + 1);

/** Everything the tests ask of the page, in one place, so a change to the page means a change here only. */
export class Game {
  constructor(page, base) { this.page = page; this.base = base; }

  /* ---- opening the page ---- */

  /**
   * Open the game. opts:
   *   motion   keep the animations (default: reduced motion, which is fast and still)
   *   seed     { "chess-...": "value" } written to localStorage before the page starts
   *   path     what to open (default "/")
   *   fen/mode/level/human/style/moves/tag   start a set-up game through Margins.load once the page is ready
   */
  async open(opts = {}) {
    const p = this.page;
    this.motion = Boolean(opts.motion);
    await p.setReducedMotion(!this.motion);
    // storage is written before the page exists, so the page never sees a different state
    const seed = { "chess-intro": "1", "chess-sky": "day", ...(opts.seed || {}) };
    await p.seedStorage(this.base, seed);
    await p.goto(this.base + (opts.path || "/"));
    await this.ready();
    if (opts.fen || opts.mode || opts.moves || opts.level || opts.human != null || opts.tag) {
      await this.load({ mode: "friend", ...opts });
    }
    return this;
  }

  /** Margins is there, the 64 squares are drawn, the board is not busy and the status line has words. */
  async ready(timeout = 90000) {
    await this.page.waitFor(
      `window.Margins && !Margins.busy && document.querySelectorAll('#squares button').length === 64 && document.getElementById('status').textContent.trim().length > 0`,
      { timeout, label: "the game to be ready", probe: `({ margins: Boolean(window.Margins), squares: document.querySelectorAll('#squares button').length, status: (document.getElementById('status') || {}).textContent })` });
    // with the animations on, the pen draws the board and the creatures first; the page says "your move" once it is done
    if (this.motion) await this.page.waitFor(`/inset\\(0px 0% 0px 0px\\)/.test(document.getElementById("yourmove").style.clipPath)`, { timeout, label: "the board to be drawn" });
    if (this.motion) await this.settled();
  }

  /** Margins.load(...) and wait for the board to show it. */
  async load(opts) {
    const ok = await this.page.eval(`Margins.load(${JSON.stringify(opts)})`);
    assert.equal(ok, true, "Margins.load refused (the board was busy)");
    await this.settled();
  }

  /* ---- reading ---- */

  // safe-anything:ignore runs test code in the test browser
  eval(code, o) { return this.page.eval(code, o); }
  waitFor(code, o) { return this.page.waitFor(code, o); }

  async state() {
    return this.page.eval(`(() => {
      const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.trim().replace(/\\s+/g, " ") : null; };
      const n = (id) => document.getElementById(id).children.length;
      return { status: t("status"), san: Margins.played().map((m) => m.san), fen: Margins.fen(), mode: Margins.mode, over: Margins.over, busy: Margins.busy,
        tray0: n("tray-0"), tray1: n("tray-1"), moveRows: document.querySelectorAll("#moves li").length,
        diaryShown: !document.getElementById("diary").hidden, cardShown: !document.getElementById("card").hidden,
        openDialogs: [...document.querySelectorAll("dialog[open]")].map((d) => d.id || d.className) };
    })()`);
  }
  async fen() { return this.page.eval(`Margins.fen()`); }
  async san() { return this.page.eval(`Margins.played().map((m) => m.san)`); }
  async status() { return this.page.eval(`document.getElementById("status").textContent.trim().replace(/\\s+/g, " ")`); }
  text(selector) { return this.page.eval(`(document.querySelector(${JSON.stringify(selector)}) || {}).textContent`).then((t) => (t == null ? null : t.trim().replace(/\s+/g, " "))); }
  ls(key) { return this.page.eval(`localStorage.getItem(${JSON.stringify(key)})`); }
  lsJson(key) { return this.ls(key).then((v) => (v == null ? null : JSON.parse(v))); }
  async stickers() { return Object.keys((await this.lsJson("chess-stickers")) || {}); }

  /**
   * The creatures on the page, as the page itself holds them: [{ at, p }] with at = 0x88 square and p = piece code (1 pawn .. 6 king, +8 purple).
   * While a move is still being played out, a creature's `at` lags behind the game, which is what settled() waits for.
   */
  pieces() {
    return this.page.eval(`[...document.querySelectorAll("#pieces > *")].filter((e) => e.__p).map((e) => ({ at: e.__at, p: e.__p }))`);
  }

  /** The creatures on the page match the position of the game exactly (same squares, same kinds), and nothing is mid-move. */
  async settled(timeout = 30000) {
    await this.page.waitFor(`(() => {
      if (Margins.busy) return false;
      const code = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
      const want = [];
      Margins.fen().split(" ")[0].split("/").forEach((row, i) => { let f = 0; for (const ch of row) { if (/\\d/.test(ch)) f += +ch; else { want.push(((7 - i) * 16 + f) + ":" + (code[ch.toLowerCase()] + (ch === ch.toLowerCase() ? 8 : 0))); f++; } } });
      const have = [...document.querySelectorAll("#pieces > *")].filter((e) => e.__p).map((e) => e.__at + ":" + e.__p);
      return want.length === have.length && want.sort().join() === have.sort().join();
    })()`, { timeout, label: "the creatures to stand where the game says", probe: `[...document.querySelectorAll("#pieces > *")].filter((e) => e.__p).map((e) => e.__at + ":" + e.__p).sort().join(" ") + " | " + Margins.fen()` });
  }

  /** Is the creature standing on `square` really drawn over that square's button? (Looks at the page, not at the game's records.) */
  creatureOver(square) {
    const n = sqNum(square);
    return this.page.eval(`(() => {
      const b = document.querySelector('#squares button[data-sq="${n}"]').getBoundingClientRect();
      const el = [...document.querySelectorAll("#pieces > *")].find((e) => e.__p && e.__at === ${n});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      return cx > b.left - 2 && cx < b.right + 2 && r.bottom > b.top && r.bottom < b.bottom + b.height * 0.6;
    })()`);
  }

  /* ---- doing ---- */

  /** Press a square's button. */
  click(square) { return this.page.eval(`document.querySelector('#squares button[data-sq="${sqNum(square)}"]').click()`); }

  /**
   * Play a move with two clicks and wait until the game has it. { promo: "queen" } picks that piece in the dialog.
   * Returns the move written in standard notation.
   */
  async move(from, to, { promo } = {}) {
    const before = (await this.san()).length;
    await this.click(from);
    await this.click(to);
    if (promo) {
      await this.waitFor(`document.getElementById("promo").open`, { label: "the promotion dialog to open" });
      await this.pickPromotion(promo);
    }
    await this.waitFor(`Margins.played().length > ${before}`, { label: `the move ${from}-${to} to be played`, probe: `({ status: document.getElementById("status").textContent, fen: Margins.fen(), over: Margins.over })` });
    return (await this.san())[before];
  }
  async pickPromotion(kind) {
    const ok = await this.page.eval(`(() => { const b = [...document.querySelectorAll("#promo-row button")].find((x) => x.getAttribute("aria-label").includes("(${kind})")); if (!b) return false; b.click(); return true; })()`);
    assert.ok(ok, `no ${kind} button in the promotion dialog`);
    await this.waitFor(`!document.getElementById("promo").open`, { label: "the promotion dialog to close" });
  }
  async moves(list) { const out = []; for (const [a, b, o] of list) out.push(await this.move(a, b, o)); return out; }

  /** Click a move that must NOT be accepted, give the page a moment, and check nothing changed. */
  async illegal(from, to) {
    const before = await this.fen();
    await this.click(from);
    await this.click(to);
    await this.page.inPage(250);
    assert.equal(await this.fen(), before, `${from}-${to} should not have been played`);
    if (await this.page.eval(`document.querySelector("dialog[open]") !== null`)) await this.page.eval(`document.querySelector("dialog[open]").close()`);
  }

  /** Press one of the page's buttons and wait for the board to catch up. */
  async press(id) {
    await this.page.eval(`document.getElementById(${JSON.stringify(id)}).click()`);
  }
  async selectRadio(name, value) {
    await this.page.eval(`document.querySelector('input[name="${name}"][value="${value}"]').click()`);
  }
  async closeDialogs() { await this.page.eval(`document.querySelectorAll("dialog[open]").forEach((d) => d.close())`); }

  /**
   * Play the human's side with the page's own engine until the game ends or `maxPlies` is reached.
   * `pick(game, legal)` chooses a move (default: the engine at depth "hard", which is quick and strong enough to beat the easy levels).
   * Everything runs in the page; the next move is asked for only once the computer has answered.
   */
  async playOut({ maxPlies = 120, level = "hard", timeout = 240000 } = {}) {
    return this.page.eval(`new Promise((resolve, reject) => {
      const E = ChessEngine;
      const t0 = Date.now();
      const step = () => {
        try {
          if (Margins.over) return resolve({ over: Margins.over, plies: Margins.played().length });
          if (Date.now() - t0 > ${timeout - 5000}) return reject(new Error("the game did not finish in time: " + Margins.fen()));
          const n = Margins.played().length;
          if (n >= ${maxPlies}) return resolve({ over: null, plies: n });
          const g = new E.Game(Margins.fen());
          const mine = g.turn === Margins.human;
          if (!mine || Margins.busy) return setTimeout(step, 60);
          const m = E.think(g, ${JSON.stringify(level)});
          if (!m) return setTimeout(step, 60);
          const btn = (sq) => document.querySelector('#squares button[data-sq="' + sq + '"]');
          btn(m.from).click(); btn(m.to).click();
          const choose = () => {
            const dlg = document.getElementById("promo");
            if (dlg.open) { const q = [...document.querySelectorAll("#promo-row button")].find((b) => b.getAttribute("aria-label").includes("(queen)")); if (q) q.click(); }
          };
          choose();
          // wait until our move shows up in the game, then look again
          const wait = () => (Margins.played().length > n ? step() : (choose(), setTimeout(wait, 30)));
          wait();
        } catch (e) { reject(e); }
      };
      step();
    })`, { timeout });
  }
}

/* ---------- the test file wrapper ---------- */

/**
 * Call once at the top of a test file. Starts a server and a browser before the first test and stops both after the last.
 * opts: { connectSrc: [...] } extra connect-src entries for the page's policy (the online-rooms test needs its local service).
 */
export function e2e(opts = {}) {
  let server, browser;
  before(async () => {
    server = await startServer({ connectSrc: opts.connectSrc });
    browser = await Browser.launch();
  }, { timeout: 90000 });
  after(async () => {
    const note = browser && browser.gsapWarnings ? `GSAP "target not found" warnings tolerated in this file: ${browser.gsapWarnings}` : "";
    if (note) console.log(`# ${note}`);
    await browser?.close();
    await server?.close();
  }, { timeout: 60000 });

  const make = (run) => (name, o, fn) => {
    if (typeof o === "function") { fn = o; o = {}; }
    const { viewport, mobile, timeout = 180000, skipIf, ...rest } = o;
    run(name, { timeout, ...rest }, async (t) => {
      const why = skipIf && skipIf();
      if (why) { t.skip(why); return; }
      const page = await browser.newPage(viewport ? { width: viewport[0], height: viewport[1], mobile } : {});
      const g = new Game(page, server.url);
      g.server = server; g.browser = browser;
      try {
        await fn(g, page);
        page.assertClean(`"${name}"`);
      } catch (err) {
        if (page.problems.length) err.message += "\n  The page also reported:\n" + page.problems.map((b) => `    [${b.kind}] ${b.text}`).join("\n");
        throw err;
      } finally {
        browser.gsapWarnings = (browser.gsapWarnings || 0) + page.warningsCounted.gsapTargetMissing;
        await page.close();
      }
    });
  };
  const t = make(nodeTest);
  // a test for a bug that is known and not fixed yet: it runs, and its failure is reported but does not fail the run
  const todo = (name, why, o, fn) => {
    if (typeof o === "function") { fn = o; o = {}; }
    return make(nodeTest)(name, { ...o, todo: why }, fn);
  };
  return { test: t, todo, server: () => server, browser: () => browser };
}
