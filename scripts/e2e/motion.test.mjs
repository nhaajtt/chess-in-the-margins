// With the animations ON (the pen draws the board, every move is played out, captures are fights), and the same page with
// reduced motion. Most other tests run with reduced motion because it is fast and still; these keep the animation code honest.
// (The page logs a harmless "GSAP target not found" warning now and then; it is counted and printed at the end, not failed.)
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();
const motion = { motion: true };
const board = (fen) => fen.split(" ")[0];

test("with motion on: the board draws itself, 32 creatures stand on their squares, and a move is played out", async (g) => {
  await g.open({ motion: true });
  assert.equal(await g.page.eval(`Margins.reduce`), false);
  assert.equal((await g.pieces()).length, 32);
  assert.equal(await g.creatureOver("e1"), true);
  assert.equal(await g.page.eval(`document.getElementById("intro").classList.contains("is-on")`), false, "the opening story is not shown again");
  await g.selectRadio("level", "easy");
  await g.press("new");
  await g.settled();
  await g.move("e2", "e4");
  await g.waitFor(`Margins.played().length === 2`, { label: "the computer's reply", timeout: 60000 });
  await g.settled(60000);
  assert.equal(await g.creatureOver("e4"), true, "the mushroom stands on e4 once its walk is over");
});

test("with motion on: castling moves both creatures and they end on the right squares", async (g) => {
  await g.open({ ...motion, mode: "friend", fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" });
  assert.equal(await g.move("e1", "g1"), "O-O");
  await g.settled(60000);
  assert.equal(await g.creatureOver("g1"), true);
  assert.equal(await g.creatureOver("f1"), true);
  assert.equal(await g.creatureOver("h1"), null);
  assert.equal(await g.move("e8", "c8"), "O-O-O");
  await g.settled(60000);
  assert.equal(await g.creatureOver("c8"), true);
  assert.equal(await g.creatureOver("d8"), true);
  assert.equal(await g.creatureOver("a8"), null);
});

test("with motion on: a capture is a fight, and the loser ends up in the tray", async (g) => {
  await g.open({ ...motion, mode: "friend", fen: "4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1" });
  assert.equal(await g.move("e3", "d5"), "Nxd5");
  await g.settled(60000);
  assert.equal((await g.pieces()).length, 3);
  assert.equal(await g.creatureOver("d5"), true);
  assert.equal((await g.state()).tray1, 1);
});

test("with motion on: en passant and promotion", async (g) => {
  await g.open({ ...motion, mode: "friend", fen: "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1" });
  await g.move("d7", "d5");
  await g.move("e5", "d6");
  await g.settled(60000);
  assert.equal(board(await g.fen()), "4k3/8/3P4/8/8/8/8/4K3");
  assert.equal(await g.creatureOver("d6"), true);
  await g.load({ mode: "friend", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" });
  assert.equal(await g.move("a7", "a8", { promo: "knight" }), "a8=N");
  await g.settled(60000);
  assert.equal((await g.pieces()).find((p) => p.at === 0x70).p, 2, "the pawn grew into a pony");
});

test("with motion on: check, checkmate and the end of the game", async (g) => {
  await g.open({ ...motion, mode: "friend" });
  await g.moves([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
  // the result is announced once the last move has been played out
  await g.waitFor(`document.getElementById("status").textContent === "Checkmate. The purple team wins."`, { label: "the result to be announced", timeout: 60000, probe: `document.getElementById("status").textContent` });
  const s = await g.state();
  assert.equal(s.status, "Checkmate. The purple team wins.");
  assert.equal(s.cardShown, true);
  assert.deepEqual(s.san, ["f3", "e5", "g4", "Qh4#"]);
});

test("with motion on: undo, flip and a new game", async (g) => {
  await g.open({ ...motion, mode: "friend" });
  await g.moves([["e2", "e4"], ["d7", "d5"], ["e4", "d5"]]);
  await g.settled(60000);
  await g.press("undo");
  await g.settled(60000);
  assert.deepEqual(await g.san(), ["e4", "d5"]);
  assert.equal((await g.state()).tray1, 0);
  await g.press("flip");                 // the board turns round on the table, which takes a moment
  await g.waitFor(`document.querySelector("#squares button").getAttribute("aria-label").startsWith("h1,")`, { timeout: 15000, label: "the board to turn" });
  await g.settled(60000);
  assert.equal(await g.creatureOver("e4"), true, "creatures follow the turned board");
  await g.press("new");
  await g.settled(60000);
  assert.deepEqual(await g.san(), []);
});

test("with motion on: the opening story plays once and can be skipped", async (g, page) => {
  await page.setReducedMotion(false);
  await page.seedStorage(g.base, { "chess-intro": null, "chess-sky": "day" });
  await page.goto(g.base + "/");
  await g.waitFor(`document.getElementById("intro").classList.contains("is-on")`, { label: "the opening story to start", timeout: 30000 });
  assert.equal(await g.page.eval(`Boolean(window.Margins)`), true);
  await g.page.eval(`document.getElementById("intro-skip").click()`);
  g.motion = true;
  await g.ready();
  assert.equal(await g.ls("chess-intro"), "1", "it is not shown again");
  await page.reload();
  await g.ready();
  assert.equal(await g.page.eval(`document.getElementById("intro").classList.contains("is-on")`), false);
});

/* ---------- reduced motion ---------- */

test("reduced motion: nothing is drawn slowly, the page is ready at once and the whole flow works", async (g) => {
  const t0 = Date.now();
  await g.open({ mode: "friend" });
  assert.ok(Date.now() - t0 < 8000, `the page took ${Date.now() - t0} ms to be ready`);
  assert.equal(await g.page.eval(`Margins.reduce`), true);
  assert.equal(await g.page.eval(`window.matchMedia("(prefers-reduced-motion: reduce)").matches`), true);
  assert.equal(await g.page.eval(`document.getElementById("intro").classList.contains("is-on")`), false);
  // a whole game: moves, a capture, castling, a stalemate-free finish by checkmate, all without a wait for any animation
  await g.moves([["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["e1", "g1"], ["f6", "e4"]]);
  assert.equal((await g.state()).tray0, 1);
  await g.settled(5000);
  await g.press("undo");
  await g.press("undo");
  await g.settled(5000);
  assert.equal((await g.san()).length, 6);
  // and the page reports the same after a reload
  await g.page.reload();
  await g.ready();
  assert.equal(await g.page.eval(`Margins.reduce`), true);
  assert.equal(await g.page.eval(`document.querySelectorAll("#pieces > *").length > 0`), true);
});

test("reduced motion: the creatures do not move on their own", async (g) => {
  await g.open({ mode: "friend" });
  const snapshot = () => g.page.eval(`[...document.querySelectorAll("#pieces > *")].map((e) => e.style.transform).join("|")`);
  const a = await snapshot();
  await g.page.inPage(1200);
  assert.equal(await snapshot(), a, "no creature breathes, blinks or wanders when motion is reduced");
});

test("the same page with motion allowed does move on its own", async (g) => {
  await g.open({ motion: true });
  const snapshot = () => g.page.eval(`[...document.querySelectorAll("#pieces > *")].map((e) => e.style.transform).join("|")`);
  const a = await snapshot();
  await g.page.waitFor(`[...document.querySelectorAll("#pieces > *")].map((e) => e.style.transform).join("|") !== ${JSON.stringify(a)}`, { timeout: 60000, label: "the creatures to stir" });
});
