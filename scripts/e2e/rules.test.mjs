// Two players on one screen: every rule of the game, played by clicking the board, with the animations off.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();
const board = (fen) => fen.split(" ")[0];

test("the start position: 64 squares, the computer to answer, the creatures named", async (g) => {
  await g.open();
  const s = await g.state();
  assert.equal(s.mode, "cpu");
  assert.equal(s.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(await g.page.eval(`document.querySelectorAll("#squares button").length`), 64);
  assert.equal(await g.page.eval(`document.querySelector('#squares button[data-sq="4"]').getAttribute("aria-label")`), "e1, orange owl (king)");
  assert.equal(await g.page.eval(`document.querySelector('input[name=mode]:checked').value`), "cpu");
  assert.equal((await g.pieces()).length, 32);
  assert.match(s.status, /Your move/);
  assert.equal(s.over, null);
});

test("a short game with a capture: the move list, the tray and the status follow", async (g) => {
  await g.open({ mode: "friend" });
  assert.deepEqual(await g.moves([["e2", "e4"], ["d7", "d5"], ["e4", "d5"]]), ["e4", "d5", "exd5"]);
  const s = await g.state();
  assert.equal(board(s.fen), "rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR");
  assert.equal(s.tray1, 1, "the purple pawn should be in the tray");
  assert.equal(s.tray0, 0);
  assert.equal(s.moveRows, 2, "two rows of the move list (move 1 and move 2)");
  assert.match(s.status, /purple team to move/);
  await g.settled();
});

test("illegal moves are ignored, and the other side's creatures cannot be picked up", async (g) => {
  await g.open({ mode: "friend" });
  await g.illegal("e2", "e5");      // a pawn cannot jump three
  await g.illegal("g1", "g3");      // a knight cannot go straight
  await g.illegal("e7", "e5");      // it is orange's turn
  await g.illegal("a1", "a3");      // blocked by its own pawn
  assert.deepEqual(await g.san(), []);
});

test("castling on both sides: the king and the castle move, and the castle really is drawn on its new square", async (g) => {
  await g.open({ mode: "friend", fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" });
  assert.equal(await g.move("e1", "g1"), "O-O");
  assert.equal(board(await g.fen()), "r3k2r/8/8/8/8/8/8/R4RK1");
  assert.equal(await g.move("e8", "c8"), "O-O-O");
  assert.equal(await g.fen(), "2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2");
  await g.settled();
  for (const [sq, expect] of [["g1", true], ["f1", true], ["c8", true], ["d8", true]]) assert.equal(await g.creatureOver(sq), expect, `a creature should stand over ${sq}`);
  assert.equal(await g.creatureOver("h1"), null, "nobody is left on h1");
  assert.equal(await g.creatureOver("a8"), null, "nobody is left on a8");
  assert.ok((await g.stickers()).includes("castle"), "the castling sticker");
  assert.match(await g.text("#moves"), /O-O/);
});

test("castling the other way round: orange long, purple short", async (g) => {
  await g.open({ mode: "friend", fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" });
  assert.equal(await g.move("e1", "c1"), "O-O-O");
  assert.equal(await g.move("e8", "g8"), "O-O");
  assert.equal(await g.fen(), "r4rk1/8/8/8/8/8/8/2KR3R w - - 2 2");
  await g.settled();
  assert.equal(await g.creatureOver("d1"), true);
  assert.equal(await g.creatureOver("f8"), true);
});

test("castling is refused when the king would pass through check or has moved", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1" });
  await g.illegal("e1", "g1");     // f1 is watched by the rook on f2
  assert.equal(await g.move("e1", "d1"), "Kd1");
  await g.load({ mode: "friend", fen: "4k3/8/8/8/8/8/8/R3K2R w - - 0 1" });
  await g.illegal("e1", "g1");     // no castling rights left
});

test("en passant: the pawn that just jumped is taken as it passes", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1" });
  await g.move("d7", "d5");
  assert.equal(await g.move("e5", "d6"), "exd6");
  assert.equal(await g.fen(), "4k3/8/3P4/8/8/8/8/4K3 b - - 0 2");
  await g.settled();
  assert.equal(await g.creatureOver("d6"), true);
  assert.equal((await g.state()).tray1, 1);
  assert.ok((await g.stickers()).includes("ep"), "the en passant sticker");
});

test("en passant only works straight away", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/3p4/8/4P3/8/8/7P/4K3 b - - 0 1" });
  await g.move("d7", "d5");
  await g.move("h2", "h3");
  await g.move("e8", "e7");
  await g.illegal("e5", "d6");
});

for (const [kind, letter, san] of [["queen", "Q", "a8=Q+"], ["rook", "R", "a8=R+"], ["bishop", "B", "a8=B"], ["knight", "N", "a8=N"]]) {
  test(`promotion through the dialog: ${kind}`, async (g) => {
    await g.open({ mode: "friend", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" });
    assert.equal(await g.move("a7", "a8", { promo: kind }), san);
    assert.equal(board(await g.fen()), `${letter}3k3/8/8/8/8/8/8/4K3`);
    await g.settled();
    const there = (await g.pieces()).find((p) => p.at === 0x70);
    assert.equal(there.p, { queen: 5, rook: 4, bishop: 3, knight: 2 }[kind]);
    assert.equal(await g.creatureOver("a8"), true);
    assert.ok((await g.stickers()).includes("promo"), "the promotion sticker");
    assert.match(await g.text("#moves"), new RegExp(`a8=${letter}`));
  });
}

test("the promotion dialog offers four creatures, and Escape cancels the move", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" });
  await g.click("a7");
  await g.click("a8");
  await g.waitFor(`document.getElementById("promo").open`);
  const labels = await g.page.eval(`[...document.querySelectorAll("#promo-row button")].map((b) => b.getAttribute("aria-label"))`);
  assert.deepEqual(labels, ["bee queen (queen)", "castle (rook)", "acorn (bishop)", "pony (knight)"]);
  await g.page.key("Escape");
  await g.waitFor(`!document.getElementById("promo").open`);
  assert.equal(await g.fen(), "4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "nothing moved");
  // and the pawn can still be moved afterwards
  assert.equal(await g.move("a7", "a8", { promo: "knight" }), "a8=N");
});

test("black promotes by capturing", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/8/8/8/8/8/p7/1R2K3 b - - 0 1" });
  assert.equal(await g.move("a2", "b1", { promo: "knight" }), "axb1=N");
  assert.equal(board(await g.fen()), "4k3/8/8/8/8/8/8/1n2K3");
  assert.equal((await g.state()).tray0, 1);
});

test("check is announced, and a move that leaves your own king in check is refused", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/8/8/8/8/8/R7/4K3 w - - 0 1" });
  assert.equal(await g.move("a2", "a8"), "Ra8+");
  assert.match(await g.status(), /Check!/);
  await g.illegal("e8", "d8");     // still on the rook's rank
  assert.equal(await g.move("e8", "e7"), "Ke7");
  await g.load({ mode: "friend", fen: "4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1" });
  await g.illegal("e2", "d3");     // the bishop is pinned to its king
});

test("checkmate ends the game: result, status, sticker and the cards", async (g) => {
  await g.open({ mode: "friend" });
  assert.deepEqual(await g.moves([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]), ["f3", "e5", "g4", "Qh4#"]);
  const s = await g.state();
  assert.equal(s.over.result, "0-1");
  assert.equal(s.over.reason, "checkmate");
  assert.equal(s.status, "Checkmate. The purple team wins.");
  assert.equal(s.cardShown, true);
  assert.equal(await g.page.eval(`document.getElementById("resign").disabled`), true);
  await g.illegal("a2", "a3");     // nobody can move after the end
});

test("stalemate is a draw", async (g) => {
  await g.open({ mode: "friend", fen: "k7/8/1K6/8/8/8/8/2Q5 w - - 0 1" });
  assert.equal(await g.move("c1", "c7"), "Qc7");
  const s = await g.state();
  assert.equal(s.over.result, "1/2-1/2");
  assert.equal(s.over.reason, "stalemate");
  assert.equal(s.status, "Draw by stalemate.");
  assert.ok((await g.stickers()).includes("tea"), "the draw sticker");
  assert.equal(s.diaryShown, true);
});

test("a draw by not enough pieces: bare kings, and king and knight against king", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/8/8/8/8/8/3p4/4K3 w - - 0 1" });
  await g.move("e1", "d2");
  let s = await g.state();
  assert.equal(s.over.reason, "not enough pieces");
  assert.equal(s.status, "Draw by not enough pieces.");
  await g.load({ mode: "friend", fen: "4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1" });
  await g.move("e3", "d5");
  s = await g.state();
  assert.equal(s.over.result, "1/2-1/2");
});

test("a draw by repeating the position three times", async (g) => {
  await g.open({ mode: "friend" });
  const shuffle = [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]];
  for (let i = 0; i < 2; i++) await g.moves(shuffle);
  const s = await g.state();
  assert.equal(s.over && s.over.result, "1/2-1/2", `after 8 plies of shuffling: ${s.status}`);
  assert.equal(s.over.reason, "repetition");
});

test("undo takes back the last move, a capture comes back out of the tray, and castling puts the castle home", async (g) => {
  await g.open({ mode: "friend" });
  await g.moves([["e2", "e4"], ["e7", "e5"], ["g1", "f3"]]);
  await g.press("undo");
  await g.settled();
  assert.deepEqual(await g.san(), ["e4", "e5"]);
  assert.equal(board(await g.fen()), "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR");
  await g.press("undo");
  await g.press("undo");
  await g.press("undo");           // nothing left: harmless
  await g.settled();
  assert.deepEqual(await g.san(), []);
  assert.equal(await g.fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  await g.load({ mode: "friend", fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1" });
  await g.move("e4", "d5");
  assert.equal((await g.state()).tray1, 1);
  await g.press("undo");
  await g.settled();
  const s = await g.state();
  assert.equal(s.tray1, 0, "the pawn left the tray");
  assert.equal(s.fen, "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");

  await g.load({ mode: "friend", fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" });
  await g.move("e1", "g1");
  await g.press("undo");
  await g.settled();
  assert.equal(await g.fen(), "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.equal(await g.creatureOver("h1"), true, "the castle is back on h1");
  assert.equal(await g.move("e1", "c1"), "O-O-O", "and the rights are back too");
});

test("undo after the game ended lets it go on", async (g) => {
  await g.open({ mode: "friend" });
  await g.moves([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
  assert.ok((await g.state()).over);
  await g.press("undo");
  await g.settled();
  const s = await g.state();
  assert.equal(s.over, null);
  assert.equal(await g.page.eval(`document.getElementById("resign").disabled`), false);
  assert.equal(await g.move("d8", "h4"), "Qh4#", "black can play again from where the game was");
});

test("flip turns the board round, and play goes on from there", async (g) => {
  await g.open({ mode: "friend" });
  const first = () => g.page.eval(`document.querySelector("#squares button").getAttribute("aria-label")`);
  assert.match(await first(), /^a8,/);
  await g.press("flip");
  await g.waitFor(`document.querySelector("#squares button").getAttribute("aria-label").startsWith("h1,")`, { label: "the board to turn round" });
  assert.equal(await g.move("e2", "e4"), "e4");
  await g.press("flip");
  await g.waitFor(`document.querySelector("#squares button").getAttribute("aria-label").startsWith("a8,")`);
  assert.equal(await g.move("e7", "e5"), "e5");
  await g.settled();
});

test("resign ends the game for the side to move; New game starts afresh", async (g) => {
  await g.open({ mode: "friend" });
  await g.move("e2", "e4");
  await g.press("resign");
  let s = await g.state();
  assert.equal(s.over.reason, "resigned");
  assert.equal(s.over.result, "1-0", "purple was to move and gave up");
  assert.equal(s.status, "Resigned. The orange team wins.");
  assert.equal(s.cardShown, true);
  assert.equal(s.diaryShown, true);
  assert.equal(await g.page.eval(`document.getElementById("resign").disabled`), true);
  await g.press("new");
  await g.settled();
  s = await g.state();
  assert.equal(s.over, null);
  assert.deepEqual(s.san, []);
  assert.equal(s.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(s.cardShown, false);
  assert.equal(s.moveRows, 0);
});

test("captures of every kind go to the right tray", async (g) => {
  const cases = [
    ["pawn", "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1", "e4", "d5"],
    ["rook", "4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1", "d1", "d5"],
    ["queen", "3qk3/8/8/8/8/8/8/3RK3 w - - 0 1", "d1", "d8"],
    ["bishop", "4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1", "d1", "d5"],
    ["knight", "4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1", "d1", "d5"],
  ];
  await g.open({ mode: "friend" });
  for (const [what, fen, a, b] of cases) {
    await g.load({ mode: "friend", fen });
    const san = await g.move(a, b);
    assert.match(san, /x/, `${what}: ${san}`);
    assert.equal((await g.state()).tray1, 1, `${what} in the purple tray`);
    await g.settled();
    assert.equal(await g.creatureOver(b), true, `${what}: the capturer stands on ${b}`);
  }
});
