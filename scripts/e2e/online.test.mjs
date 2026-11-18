// Online rooms: two pages play each other through the real Worker, started locally with the wrangler in server/node_modules.
//   npm run test:e2e:online
// The page talks to http://localhost:8787 when it is opened from this machine (game.js, API), so that is the port used here.
// If wrangler cannot be started (not installed, port 8787 busy, no permission), every test in this file is skipped with the reason.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { before, after } from "node:test";
import { e2e, assert, Game } from "./harness.mjs";

const PORT = 8787;
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "server");
const wranglerBin = path.join(serverDir, "node_modules", "wrangler", "bin", "wrangler.js");

// The page's own policy only allows its own origin and the live rooms service; for this file it also gets the local one.
const { test, server } = e2e({ connectSrc: [`http://localhost:${PORT}`, `ws://localhost:${PORT}`] });

let wrangler = null, skipReason = "", persist = "";
const skipIf = () => skipReason;

const answers = async () => { try { await fetch(`http://127.0.0.1:${PORT}/rooms/AAAAAA`, { signal: AbortSignal.timeout(2000) }); return true; } catch { return false; } };

function stopWrangler() {
  if (!wrangler) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(wrangler.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-wrangler.pid, "SIGKILL");
  } catch { /* already gone */ }
  wrangler = null;
}

before(async () => {
  if (!fs.existsSync(wranglerBin)) { skipReason = `wrangler is not installed (run "npm ci" in server/): ${wranglerBin}`; return; }
  if (await answers()) { skipReason = `something is already listening on port ${PORT}; stop it, or run this file when the port is free`; return; }
  persist = fs.mkdtempSync(path.join(os.tmpdir(), "citm-wrangler-"));
  const origin = server().url;
  wrangler = spawn(process.execPath, [wranglerBin, "dev", "--port", String(PORT), "--ip", "127.0.0.1", "--var", `ALLOWED_ORIGINS:${origin}`, "--persist-to", persist, "--log-level", "info"], {
    cwd: serverDir, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1", NO_COLOR: "1", WRANGLER_SEND_METRICS: "false", WRANGLER_HIDE_BANNER: "true", CLOUDFLARE_ACCOUNT_ID: "" },
  });
  const log = [];
  const keep = (b) => { log.push(String(b)); if (log.length > 60) log.shift(); };
  wrangler.stdout.on("data", keep); wrangler.stderr.on("data", keep);
  let exited = false;
  wrangler.on("exit", () => { exited = true; });
  const t0 = Date.now();
  while (Date.now() - t0 < 100000 && !exited && !(await answers())) await new Promise((r) => setTimeout(r, 500));
  if (exited || !(await answers())) {
    skipReason = `wrangler did not start on port ${PORT} (${exited ? "it exited" : "no answer in 100 s"}): ${log.join("").replace(/\s+/g, " ").slice(-300)}`;
    stopWrangler();
  }
}, { timeout: 150000 });

after(() => {
  stopWrangler();
  if (persist) try { fs.rmSync(persist, { recursive: true, force: true }); } catch { /* the OS clears it */ }
});

const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const names = (g) => g.page.eval(`[...document.querySelectorAll("#room-players li")].map((li) => li.textContent.replace(/\\s+/g, " ").trim())`);
// every line the note board shows, kept from now on (a line is soon replaced by the next)
const watchNotes = (g) => g.page.eval(`window.__notes = []; new MutationObserver(() => window.__notes.push(document.getElementById("talk").textContent)).observe(document.getElementById("talk"), { childList: true, characterData: true, subtree: true });`);

// The service gives the room's first visitor a random colour, so the test finds out who is who and plays accordingly.
const sides = async (a, b) => {
  const colour = await a.page.eval(`Margins.human`);
  return colour === 0 ? { white: a, black: b } : { white: b, black: a };
};
// remember every sound the page plays (an emote plays one), since the little speech bubbles are only drawn with motion on
const spyOnSounds = (g) => g.page.eval(`window.__sounds = []; const play = Sound.play.bind(Sound); Sound.play = (name, ...rest) => { window.__sounds.push([name, ...rest]); return play(name, ...rest); };`);

test("two pages play a room: create, join, moves both ways, an emote, a draw offer, a dropped connection and the way back", { skipIf, timeout: 240000 }, async (a) => {
  // --- A opens a room ---
  await a.open({ seed: { "chess-name": "Ann" } });
  await a.selectRadio("mode", "online");
  assert.equal(await a.page.eval(`document.getElementById("online").hidden`), false, "the online panel opens");
  assert.equal(await a.page.eval(`document.getElementById("lobby").hidden`), false);
  await a.press("room-create");
  await a.waitFor(`/^[A-HJ-NP-Z2-9]{6}$/.test(document.getElementById("room-code-show").textContent)`, { label: "a room code", timeout: 30000, probe: `document.getElementById("online-msg").textContent` });
  const code = await a.text("#room-code-show");
  assert.match(code, CODE);
  await a.waitFor(`Margins.human >= 0 && document.querySelectorAll("#room-players li").length >= 2`, { label: "A to be seated", timeout: 30000, probe: `document.getElementById("online-msg").textContent` });
  const lobby = (await names(a)).join("|");     // orange is listed first, whoever got which seat
  assert.match(lobby, /Ann \(you\)(orange|purple)/);
  assert.match(lobby, /waiting…(orange|purple)/);
  assert.equal(await a.page.eval(`location.pathname`), `/r/${code}`);
  assert.ok(await a.ls(`chess-room-${code}`), "A keeps its seat token");
  await watchNotes(a);
  await spyOnSounds(a);

  // --- B follows the link ---
  const pageB = await a.browser.newPage();
  const b = new Game(pageB, a.base);
  // keep hold of every socket the page opens, so the test can cut the line
  await pageB.send("Page.addScriptToEvaluateOnNewDocument", { source: "(() => { const Native = window.WebSocket; window.__sockets = []; window.WebSocket = new Proxy(Native, { construct(t, args) { const s = new t(...args); window.__sockets.push(s); return s; } }); })();" });
  try {
    await b.open({ path: `/r/${code}`, seed: { "chess-name": "Bob" } });
    await b.waitFor(`Margins.mode === "online" && Margins.human >= 0 && document.querySelectorAll("#room-players li.is-on").length === 2`, { label: "B to be seated", timeout: 30000, probe: `document.getElementById("online-msg").textContent` });
    await a.waitFor(`document.querySelectorAll("#room-players li.is-on").length === 2`, { label: "A to see B arrive", timeout: 30000 });
    assert.notEqual(await a.page.eval(`Margins.human`), await b.page.eval(`Margins.human`), "the two seats are different colours");
    const listA = (await names(a)).join("|"), listB = (await names(b)).join("|");
    assert.match(listA, /Ann \(you\)/); assert.match(listA, /Bob(orange|purple)/);
    assert.match(listB, /Bob \(you\)/); assert.match(listB, /Ann(orange|purple)/);
    await spyOnSounds(b);
    const { white, black } = await sides(a, b);
    assert.match(await black.page.eval(`document.querySelector("#squares button").getAttribute("aria-label")`), /^h1,/, "purple sees the board from its own side");
    assert.match(await white.page.eval(`document.querySelector("#squares button").getAttribute("aria-label")`), /^a8,/);

    // --- moves, both ways ---
    const both = async (n) => {
      for (const g of [a, b]) await g.waitFor(`Margins.played().length === ${n}`, { label: `${n} moves on a page`, timeout: 30000, probe: `document.getElementById("online-msg").textContent` });
    };
    await white.click("e2"); await white.click("e4");
    await both(1);
    await black.click("e7"); await black.click("e5");
    await both(2);
    await white.click("g1"); await white.click("f3");
    await both(3);
    assert.deepEqual(await a.san(), ["e4", "e5", "Nf3"]);
    assert.deepEqual(await b.san(), ["e4", "e5", "Nf3"]);
    assert.equal(await a.fen(), await b.fen(), "both pages hold the same position");
    // it is purple's turn: orange's creatures do not move
    await white.click("d2"); await white.click("d4");
    await white.page.inPage(400);
    assert.equal((await white.san()).length, 3, "a player cannot move out of turn");
    assert.match(await white.text("#online-msg"), /Not your turn yet/);
    // an illegal move from purple is refused and changes nothing
    await black.click("e5"); await black.click("e3");
    await black.page.inPage(400);
    assert.equal((await black.san()).length, 3);
    await a.settled(); await b.settled();

    // --- an emote: a reaction sent by purple is heard by both pages ---
    await black.page.eval(`document.querySelector('#emotes button[data-e="wave"]').click()`);
    for (const g of [a, b]) await g.waitFor(`window.__sounds.some((s) => s[0] === "emote" && s[1] === "wave" && s[2] === 1)`, { label: "the emote to arrive", timeout: 15000, probe: `window.__sounds.slice(-5)` });

    // --- a draw is offered by A ---
    await a.press("room-draw");
    assert.equal(await a.text("#online-msg"), "You offered a draw.");
    await b.waitFor(`/offers a draw/.test(document.getElementById("online-msg").textContent)`, { label: "B to hear of the offer", timeout: 15000, probe: `document.getElementById("online-msg").textContent` });

    // --- B loses its connection: A sees B doze off, B reconnects by itself and A hears that B is back ---
    const token = await b.ls(`chess-room-${code}`);
    assert.ok(token, "B keeps its seat token");
    const seat = await b.page.eval(`Margins.human`);
    await b.page.eval(`window.__sockets.forEach((s) => s.close(1000, "the test cut the line"))`);
    await a.waitFor(`window.__notes.some((n) => /Bob's creatures doze off/.test(n))`, { label: "A to notice that B left", timeout: 30000, probe: `({ notes: window.__notes.slice(-4), players: document.getElementById("room-players").innerHTML })` });
    await a.waitFor(`window.__notes.some((n) => /Bob is back!/.test(n))`, { label: "A to hear that B is back", timeout: 30000, probe: `window.__notes.slice(-4)` });
    await b.waitFor(`Margins.human === ${seat} && document.querySelectorAll("#room-players li.is-on").length === 2`, { label: "B to be reconnected", timeout: 30000, probe: `document.getElementById("online-msg").textContent` });

    // --- B closes the page and opens the link again: the stored token gives it the same seat and the same game back ---
    await b.page.reload();
    await b.ready();
    await b.waitFor(`Margins.human === ${seat} && Margins.played().length === 3`, { label: "B to be back in the game", timeout: 30000, probe: `({ human: Margins.human, moves: Margins.played().length, msg: document.getElementById("online-msg").textContent })` });
    assert.equal(await b.ls(`chess-room-${code}`), token, "the same seat token");
    assert.equal(await b.fen(), await a.fen());
    // purple plays on, and the other page sees it
    await black.click("b8"); await black.click("c6");
    await both(4);
    assert.equal((await a.san())[3], "Nc6");

    // --- a move withdraws an offer, so A offers again, and B accepts it; both pages end the game ---
    await a.press("room-draw");
    await b.waitFor(`/offers a draw/.test(document.getElementById("online-msg").textContent)`, { label: "B to hear of the second offer", timeout: 15000, probe: `document.getElementById("online-msg").textContent` });
    await b.press("room-draw");
    for (const g of [a, b]) await g.waitFor(`Margins.over && Margins.over.reason === "agreement"`, { label: "the draw to be agreed", timeout: 30000, probe: `({ over: Margins.over, msg: document.getElementById("online-msg").textContent, moves: Margins.played().length })` });
    assert.equal((await a.state()).over.result, "1/2-1/2");
    assert.equal((await b.state()).over.result, "1/2-1/2");
    assert.equal(await a.page.eval(`document.getElementById("room-draw").disabled`), true, "no more draw offers once it is over");
    pageB.assertClean("page B");
  } finally {
    await pageB.close();
  }
});

test("a room code that does not exist is refused with a message", { skipIf }, async (g, page) => {
  page.expect404(/\/rooms\/ZZZZZZ$/);     // the service says 404, and the page turns that into a message
  await g.open();
  await g.selectRadio("mode", "online");
  await g.page.eval(`document.getElementById("room-code").value = "ZZZZZZ"; document.getElementById("room-join").requestSubmit()`);
  await g.waitFor(`document.getElementById("online-msg").textContent === "There is no room with that code."`, { label: "the no-such-room message", timeout: 20000, probe: `document.getElementById("online-msg").textContent` });
  await g.page.eval(`document.getElementById("room-code").value = "abc"; document.getElementById("room-join").requestSubmit()`);
  await g.waitFor(`document.getElementById("online-msg").textContent === "A room code is six letters and numbers."`);
});

test("leaving a room puts the page back to a game of its own", { skipIf }, async (g) => {
  await g.open();
  await g.selectRadio("mode", "online");
  await g.press("room-create");
  await g.waitFor(`/^[A-HJ-NP-Z2-9]{6}$/.test(document.getElementById("room-code-show").textContent)`, { timeout: 30000, probe: `document.getElementById("online-msg").textContent` });
  await g.waitFor(`Margins.human >= 0`, { timeout: 30000, probe: `({ human: Margins.human, msg: document.getElementById("online-msg").textContent, mode: Margins.mode, players: document.getElementById("room-players").textContent })` });
  await g.press("room-leave");
  await g.waitFor(`document.getElementById("lobby").hidden === false && document.getElementById("online-msg").textContent === "You left the room."`, { timeout: 20000 });
  assert.equal(await g.page.eval(`location.pathname`), "/");
});

// Known bug, not fixed here: when a room's result arrives (a draw agreed, a resignation), applyState() writes the result in the
// status line through finish() and then immediately overwrites it with the turn text (game.js:4030, statusLine), so the page
// says "Your move." or "Waiting for ..." about a game that is over.
test("the status line says how an online game ended", { skipIf, timeout: 120000, todo: "game.js:4030 overwrites the result with statusLine()" }, async (a) => {
  await a.open({ seed: { "chess-name": "Ann" } });
  await a.selectRadio("mode", "online");
  await a.press("room-create");
  await a.waitFor(`/^[A-HJ-NP-Z2-9]{6}$/.test(document.getElementById("room-code-show").textContent)`, { timeout: 30000 });
  const code = await a.text("#room-code-show");
  const pageB = await a.browser.newPage();
  const b = new Game(pageB, a.base);
  try {
    await b.open({ path: `/r/${code}`, seed: { "chess-name": "Bob" } });
    await b.waitFor(`document.querySelectorAll("#room-players li.is-on").length === 2 && Margins.human >= 0`, { timeout: 30000 });
    await a.waitFor(`document.querySelectorAll("#room-players li.is-on").length === 2`, { timeout: 30000 });
    await a.press("resign");
    await b.waitFor(`Margins.over`, { timeout: 20000 });
    await a.waitFor(`Margins.over`, { timeout: 20000 });
    await a.page.inPage(300);
    assert.match(await a.status(), /^Resigned./, "the status line says the game was resigned");
    assert.match(await b.status(), /^Resigned./);
  } finally { await pageB.close(); }
});
