// The puzzles as a player sees them: every kind solved by its stored line, wrong moves, and the three-minute rush.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();

const PROMO = { n: "knight", b: "bishop", r: "rook", q: "queen" };

async function openPuzzles(g, kind, seed) {
  await g.open({ seed });
  await g.selectRadio("mode", "puzzle");
  await g.selectRadio("pkind", kind);
  await g.settled();
}
const current = (g) => g.page.eval(`CHESS_PUZZLES.find((p) => p.fen === Margins.fen()) || null`);

// Play the stored line from the position on the board: our moves by clicking, the answers come from the page.
async function solve(g, puz) {
  for (let i = 0; i < puz.line.length; i += 2) {
    const u = puz.line[i];
    await g.click(u.slice(0, 2));
    await g.click(u.slice(2, 4));
    if (u[4]) { await g.waitFor(`document.getElementById("promo").open`); await g.pickPromotion(PROMO[u[4]]); }
    if (i + 1 < puz.line.length) await g.waitFor(`Margins.played().length >= ${i + 2}`, { label: `the answer to move ${i / 2 + 1}`, probe: `document.getElementById("status").textContent` });
  }
}

// a legal move that is certainly not the answer: for a mate in one, any move that does not mate; otherwise any move off the line
const wrongMove = (g, puz) => g.page.eval(`(() => {
  const g = new ChessEngine.Game(Margins.fen());
  const line = ${JSON.stringify(puz.line)};
  for (const m of g.moves()) {
    const u = ChessEngine.name(m.from) + ChessEngine.name(m.to);
    if (u === line[0].slice(0, 4)) continue;
    g.make(m);
    const mate = g.inCheck() && g.moves().length === 0;
    g.unmake(m);
    if (!mate) return [ChessEngine.name(m.from), ChessEngine.name(m.to)];
  }
})()`);

for (const [kind, what] of [["mate1", "mate in one"], ["mate2", "mate in two"], ["mate3", "mate in three"], ["win", "win a piece"]]) {
  test(`the ${what} puzzle is solved by its stored line, and the progress is kept`, async (g) => {
    await openPuzzles(g, kind);
    const puz = await current(g);
    assert.ok(puz, "the board shows one of the stored puzzles");
    assert.equal(puz.kind, kind);
    assert.match(await g.status(), /to move/);
    await solve(g, puz);
    await g.waitFor(`/^Solved!/.test(document.getElementById("status").textContent)`, { label: "the puzzle to be solved", probe: `document.getElementById("status").textContent`, timeout: 15000 });
    assert.match(await g.status(), /first time/);
    assert.deepEqual(await g.lsJson("chess-puzzles-solved"), [puz.id]);
    assert.ok((await g.stickers()).includes("puzzle"), "the Puzzler sticker");
  });
}

test("a wrong move is put back with a message, and the next try counts", async (g) => {
  await openPuzzles(g, "mate1");
  const puz = await current(g);
  const [from, to] = await wrongMove(g, puz);
  await g.click(from);
  await g.click(to);
  await g.waitFor(`document.getElementById("status").textContent === "That is not mate yet. Try again."`, { label: "the wrong-move message", probe: `document.getElementById("status").textContent` });
  await g.waitFor(`Margins.played().length === 0 && !Margins.busy`, { label: "the move to be put back" });
  await g.settled();
  assert.equal(await g.fen(), puz.fen);
  assert.equal(await g.lsJson("chess-puzzles-solved"), null, "nothing is marked as solved");
  await solve(g, puz);
  await g.waitFor(`/^Solved!/.test(document.getElementById("status").textContent)`, { probe: `document.getElementById("status").textContent` });
  assert.match(await g.status(), /after 1 try/);
});

test("in a puzzle where only the line works, a different move is wrong too", async (g) => {
  await openPuzzles(g, "win");
  const puz = await current(g);
  const [from, to] = await wrongMove(g, puz);
  await g.click(from);
  await g.click(to);
  await g.waitFor(`document.getElementById("status").textContent === "Not that one. Try again."`, { probe: `document.getElementById("status").textContent` });
  await g.waitFor(`Margins.played().length === 0`);
  assert.equal(await g.fen(), puz.fen);
});

test("New game in puzzle mode gives another puzzle; solving three earns the Puzzle fiend sticker", async (g) => {
  await openPuzzles(g, "mate1");
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const puz = await current(g);
    assert.ok(!seen.includes(puz.id), "a different puzzle each time");
    seen.push(puz.id);
    await solve(g, puz);
    await g.waitFor(`/^Solved!/.test(document.getElementById("status").textContent)`, { probe: `document.getElementById("status").textContent` });
    if (i < 2) {
      await g.waitFor(`!Margins.busy`, { label: "the board to be free" });
      await g.press("new");
      await g.waitFor(`Margins.fen() !== ${JSON.stringify(puz.fen)} && CHESS_PUZZLES.some((p) => p.fen === Margins.fen())`, { label: "the next puzzle" });
      await g.settled();
    }
  }
  assert.deepEqual((await g.lsJson("chess-puzzles-solved")).sort(), seen.slice().sort());
  assert.ok((await g.stickers()).includes("puzzle3"), "the Puzzle fiend sticker");
});

test("the rush: solve two, fail three; the score is shown and the best is kept", async (g) => {
  await openPuzzles(g, "rush");
  const rush = () => g.text("#rush");
  assert.match(await rush(), /^[23]:\d\d left, 0 solved, ♥♥♥$/);
  const next = async (fen) => { await g.waitFor(`Margins.fen() !== ${JSON.stringify(fen)} && CHESS_PUZZLES.some((p) => p.fen === Margins.fen()) && !Margins.busy`, { label: "the next rush puzzle", timeout: 15000 }); await g.settled(); };
  // solve two
  for (let n = 1; n <= 2; n++) {
    const puz = await current(g);
    assert.ok(puz, "a rush puzzle is on the board");
    await solve(g, puz);
    await g.waitFor(`/ ${n} solved,/.test(document.getElementById("rush").textContent)`, { label: `${n} solved`, probe: `document.getElementById("rush").textContent`, timeout: 15000 });
    await next(puz.fen);
  }
  assert.match(await rush(), /, 2 solved, ♥♥♥$/);
  // fail three
  for (let lives = 3; lives >= 1; lives--) {
    const puz = await current(g);
    const [from, to] = await wrongMove(g, puz);
    await g.click(from);
    await g.click(to);
    if (lives > 1) {
      await g.waitFor(`document.getElementById("rush").textContent.endsWith("${"♥".repeat(lives - 1)}")`, { label: `${lives - 1} lives left`, probe: `document.getElementById("rush").textContent`, timeout: 15000 });
      await next(puz.fen);
    }
  }
  await g.waitFor(`document.getElementById("rush").textContent === "rush over: 2 solved"`, { label: "the rush to end", probe: `document.getElementById("rush").textContent`, timeout: 15000 });
  assert.equal(await g.status(), "Three wrong moves! You solved 2 puzzles, your best yet. New game starts another rush.");
  assert.equal(await g.ls("chess-rush-best"), "2");
  // a worse second rush leaves the best alone
  await g.press("new");
  await g.settled();
  assert.match(await rush(), /left, 0 solved, ♥♥♥$/);
  for (let lives = 3; lives >= 1; lives--) {
    const puz = await current(g);
    const [from, to] = await wrongMove(g, puz);
    await g.click(from);
    await g.click(to);
    if (lives > 1) { await g.waitFor(`document.getElementById("rush").textContent.endsWith("${"♥".repeat(lives - 1)}")`, { timeout: 15000 }); await next(puz.fen); }
  }
  await g.waitFor(`document.getElementById("rush").textContent === "rush over: 0 solved"`, { timeout: 15000 });
  assert.match(await g.status(), /You solved 0 puzzles \(your best is 2\)/);
  assert.equal(await g.ls("chess-rush-best"), "2");
});

test("leaving puzzle mode hides the puzzle options and the rush line", async (g) => {
  await openPuzzles(g, "rush");
  assert.equal(await g.page.eval(`document.getElementById("puzzle-opts").hidden`), false);
  await g.selectRadio("mode", "friend");
  await g.settled();
  assert.equal(await g.page.eval(`document.getElementById("puzzle-opts").hidden`), true);
  assert.equal(await g.page.eval(`document.getElementById("rush").hidden`), true);
  assert.equal(await g.fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
});

test("the rush clock running out while a winning move is being answered does not count it as solved", async (g) => {
  await openPuzzles(g, "rush");
  // a rush that has climbed far enough to hand out 'win a piece' puzzles: ask for new puzzles until one comes
  await g.page.eval(`(() => { rush.score = 10; for (let i = 0; i < 200; i++) { rush.next = true; newGame(); if (kindOf(puz) === "win") break; } })()`);
  const puz = await current(g);
  assert.equal(puz.kind, "win");
  await g.click(puz.line[0].slice(0, 2));
  await g.click(puz.line[0].slice(2, 4));
  await g.waitFor(`Margins.played().length >= 2 && !Margins.busy`, { label: "the answer to the first move", timeout: 15000 });
  const [a, b] = [puz.line[2].slice(0, 2), puz.line[2].slice(2, 4)];
  const sq = (n) => (Number(n[1]) - 1) * 16 + "abcdefgh".indexOf(n[0]);
  // the last move, and in the same breath the clock runs out
  await g.page.eval(`(() => { const b = (n) => document.querySelector('#squares button[data-sq="' + n + '"]'); b(${sq(a)}).click(); b(${sq(b)}).click(); rushEnd(); })()`);
  await g.page.inPage(800);
  assert.match(await g.status(), /^Time! You solved 10 puzzles/);
  assert.equal(await g.ls("chess-puzzles-solved"), null, "nothing is added to the solved puzzles");
  assert.equal(await g.page.eval(`Margins.busy`), false, "the board is not left busy");
});
