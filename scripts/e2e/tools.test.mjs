// Saving and loading games (PGN and FEN), the look back at a game, and the names of openings.
import { e2e, assert } from "./harness.mjs";

const { test, todo } = e2e();

const RUY = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *";
const RUY_SANS = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7"];
const RUY_FEN = "r1bq1rk1/2pnbppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1 w - - 1 11";

const openPgn = async (g) => { await g.press("pgn-btn"); await g.waitFor(`document.getElementById("pgn-dialog") && document.getElementById("pgn-dialog").open`); };
const setText = (g, v) => g.page.eval(`document.getElementById("pgn-text").value = ${JSON.stringify(v)}`);
const msg = (g) => g.page.eval(`({ text: document.getElementById("pgn-msg").textContent, bad: document.getElementById("pgn-msg").classList.contains("is-bad") })`);

test("PGN export: the game so far, with its headers, and a copy on the clipboard", async (g) => {
  await g.open({ mode: "friend" });
  await g.page.grantClipboard(g.base);
  await g.moves([["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "b5"], ["a7", "a6"]]);
  await openPgn(g);
  await g.press("pgn-copy-game");
  await g.waitFor(`document.getElementById("pgn-msg").textContent !== ""`, { probe: `document.getElementById("pgn-msg").textContent` });
  const text = await g.page.eval(`document.getElementById("pgn-text").value`);
  assert.match(text, /^\[Event "Chess in the margins"\]/);
  assert.match(text, /\[White "Orange"\]\n\[Black "Purple"\]\n\[Result "\*"\]/);
  assert.match(text, /\n\n1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6 \*\n$/);
  assert.deepEqual(await msg(g), { text: "The game is copied.", bad: false });
  const onClipboard = await g.page.eval(`navigator.clipboard.readText()`);
  assert.equal(onClipboard.replace(/\r\n/g, "\n"), text, "the clipboard holds the same text");
  await g.press("pgn-copy-fen");
  await g.waitFor(`document.getElementById("pgn-msg").textContent === "The position is copied."`);
  assert.equal(await g.page.eval(`document.getElementById("pgn-text").value`), await g.fen());
});

test("PGN export of a finished game and of a game from a set-up position", async (g) => {
  await g.open({ mode: "friend" });
  await g.moves([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
  assert.match(await g.page.eval(`Pgn.export()`), /\[Result "0-1"\]\n\n1\. f3 e5 2\. g4 Qh4# 0-1\n$/);
  await g.load({ mode: "friend", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" });
  await g.move("a7", "a8", { promo: "queen" });
  const out = await g.page.eval(`Pgn.export()`);
  assert.match(out, /\[SetUp "1"\]\n\[FEN "4k3\/P7\/8\/8\/8\/8\/8\/4K3 w - - 0 1"\]/);
  assert.match(out, /1\. a8=Q\+ \*/);
});

test("PGN import keeps the moves: a long game loads and can be played on", async (g) => {
  await g.open({ mode: "friend" });
  await openPgn(g);
  await setText(g, RUY);
  await g.press("pgn-play");
  await g.waitFor(`!document.getElementById("pgn-dialog").open`, { label: "the dialog to close", probe: `document.getElementById("pgn-msg").textContent` });
  await g.settled();
  assert.deepEqual(await g.san(), RUY_SANS);
  assert.equal(await g.fen(), RUY_FEN);
  assert.equal(await g.page.eval(`Margins.mode`), "friend");
  assert.equal((await g.state()).moveRows, 10);
  assert.equal(await g.creatureOver("g1"), true, "the castled king stands on g1");
  assert.equal(await g.creatureOver("e1"), true, "and the castle, which then went to e1");
  assert.equal(await g.move("b1", "d2"), "Nbd2", "play goes on from there");
  assert.equal(await g.page.eval(`Pgn.export().includes("11. Nbd2")`), true);
});

test("PGN import with a header position, a comment and a result", async (g) => {
  await g.open({ mode: "friend" });
  const pgn = `[Event "x"]\n[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n[Result "1-0"]\n\n1. e4 {the pawn runs} Kd7 2. e5 1-0\n`;
  await openPgn(g);
  await setText(g, pgn);
  await g.press("pgn-play");
  await g.waitFor(`!document.getElementById("pgn-dialog").open`);
  await g.settled();
  assert.deepEqual(await g.san(), ["e4", "Kd7", "e5"]);
  assert.equal(await g.fen(), "8/3k4/8/4P3/8/8/8/4K3 b - - 0 2");
});

test("FEN import: the position loads with no moves played, and illegal positions are explained", async (g) => {
  await g.open({ mode: "friend" });
  await openPgn(g);
  await setText(g, "4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await g.press("pgn-play");
  await g.waitFor(`!document.getElementById("pgn-dialog").open`);
  await g.settled();
  assert.equal(await g.fen(), "4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  assert.deepEqual(await g.san(), []);
  assert.equal(await g.move("a7", "a8", { promo: "rook" }), "a8=R+");
});

test("invalid input gets a message and changes nothing", async (g) => {
  await g.open({ mode: "friend" });
  await g.moves([["e2", "e4"]]);
  const before = await g.fen();
  await openPgn(g);
  for (const bad of ["this is not chess", "1. e4 e5 2. Ke3", "8/8/8/8 w - - 0 1", "4k3/8/8/8/8/8/8/8 w - - 0 1", ""]) {
    await setText(g, bad);
    await g.press("pgn-play");
    await g.waitFor(`document.getElementById("pgn-msg").classList.contains("is-bad")`, { label: `a message for ${JSON.stringify(bad)}` });
    const m = await msg(g);
    assert.ok(m.text.length > 5, `a real message for ${JSON.stringify(bad)}`);
    assert.equal(await g.page.eval(`document.getElementById("pgn-dialog").open`), true, "the dialog stays open");
    assert.equal(await g.fen(), before, `${JSON.stringify(bad)} must not change the board`);
    await g.page.eval(`document.getElementById("pgn-msg").classList.remove("is-bad"); document.getElementById("pgn-msg").textContent = ""`);
  }
});

test("the look back marks a known blunder and sums up each team", async (g) => {
  await g.open({ mode: "friend" });
  await g.moves([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
  await g.press("look-back-btn");
  await g.waitFor(`document.getElementById("review-dialog") && document.getElementById("review-dialog").open`);
  await g.waitFor(`document.getElementById("rv-progress").textContent === "The owl has looked at every move."`, { timeout: 60000, label: "the owl to finish", probe: `document.getElementById("rv-progress").textContent` });
  const rows = await g.page.eval(`[...document.querySelectorAll("#rv-moves .rv-mv")].map((b) => b.getAttribute("aria-label"))`);
  assert.equal(rows.length, 4);
  assert.match(rows[2], /g4, blunder$/, `move 3 is the blunder: ${rows.join(" | ")}`);
  assert.doesNotMatch(rows[3], /blunder|mistake/, "the mate is not a mistake");
  const teacher = await g.page.eval(`[...document.querySelectorAll("#rv-moves .rv-teacher")].map((e) => e.textContent)`);
  assert.ok(teacher.length >= 1 && teacher[0].length > 10, "the teacher says why");
  assert.match(await g.text("#rv-summary"), /The orange team: \d ticks?, \d mistakes?, 1 blunder\./);
  // stepping through the game: the board on the page follows
  await g.page.eval(`document.querySelector('#review-dialog [data-go="first"]').click()`);
  assert.equal(await g.text("#rv-now"), "The start of the game.");
  await g.page.eval(`document.querySelector('#review-dialog [data-go="next"]').click()`);
  assert.match(await g.text("#rv-now"), /^Move 1, orange: f3\./);
  assert.equal(await g.page.eval(`document.querySelectorAll("#rv-board .rv-sq svg").length`), 32);
  await g.closeDialogs();
});

// Known bug, not fixed here: review.js sets the "no moves" sentence (line 185) and then show(n) at line 347 replaces it with an empty string (line 209).
test("the look back with nothing played says so", async (g) => {
  await g.open({ mode: "friend" });
  await g.press("look-back-btn");
  await g.waitFor(`document.getElementById("review-dialog").open`);
  assert.match(await g.text("#rv-now"), /no moves to look at yet/);
});

test("the owl names an opening once, when it is reached", async (g) => {
  await g.open({ mode: "friend" });
  // the owl's line is soon replaced by the next remark, so keep every line the note board ever shows
  await g.page.eval(`window.__lines = []; new MutationObserver(() => window.__lines.push(document.getElementById("talk").textContent)).observe(document.getElementById("talk"), { childList: true, characterData: true, subtree: true });`);
  await g.moves([["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "b5"]]);
  await g.waitFor(`window.__lines.some((l) => l === "the owl knows this one: the Ruy Lopez")`, { label: "the Ruy Lopez note", probe: `window.__lines` });
  const lines = await g.page.eval(`window.__lines.filter((l) => l.startsWith("the owl knows"))`);
  assert.equal(new Set(lines).size, lines.length, `no name repeated: ${lines}`);
  assert.equal(await g.page.eval(`Openings.find(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]).name`), "Ruy Lopez");
});
