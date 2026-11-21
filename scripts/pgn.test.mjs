// Reading and writing games as text, and the table of opening names. node --test scripts/pgn.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const ctx = {};
vm.createContext(ctx);
for (const f of ["engine.js", "pgn.js", "openings.js"]) vm.runInContext(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), ctx);
const E = ctx.ChessEngine, { build, checkFen } = ctx.PgnCore, { Openings } = ctx;
// results from the other context are copied, so deepEqual does not trip over two different Array types
const parse = (e, t) => JSON.parse(JSON.stringify(ctx.PgnCore.parse(e, t)));

// the moves of a parsed game as { from, to, promo }, the way Margins.played() hands them out
function asMoves(start, sans) {
  const g = new E.Game(start);
  return sans.map((s) => {
    const m = g.moves().find((x) => g.san(x) === s);
    assert.ok(m, `illegal ${s}`);
    g.play(m);
    return { from: m.from, to: m.to, promo: m.promo || 0 };
  });
}

const OPERA = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 {This is a weak move} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 (9... Qe6 10. Bxe6) 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8
13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ $3 Nxb8 17. Rd8# 1-0`;

test("a famous game reads, and ends in mate", () => {
  const r = parse(E, OPERA);
  assert.equal(r.moves.length, 33);
  assert.equal(r.moves[32], "Rd8#");
  assert.equal(r.result, "1-0");
  assert.equal(r.fen, E.START);
  assert.equal(new E.Game(r.finalFen).status().reason, "checkmate");
});

test("write then read gives the same game", () => {
  const r = parse(E, OPERA);
  const text = build(E, E.START, asMoves(E.START, r.moves), { date: new Date(2026, 0, 5) });
  assert.match(text, /\[Site "chess\.nhaajt\.com"\]/);
  assert.match(text, /\[Date "2026\.01\.05"\]/);
  assert.match(text, /\[Result "1-0"\]/);
  assert.ok(!/\[FEN/.test(text));
  assert.ok(text.split("\n").every((l) => l.length <= 80));
  const back = parse(E, text);
  assert.deepEqual(back.moves, r.moves);
  assert.equal(back.finalFen, r.finalFen);
});

test("a game from a set-up position keeps SetUp and FEN, and black can move first", () => {
  const fen = "r3k2r/pppq1ppp/2n5/8/8/2N5/PPPQ1PPP/R3K2R b KQkq - 3 9";
  const sans = ["O-O-O", "O-O", "Kb8"];
  const text = build(E, fen, asMoves(fen, sans));
  assert.match(text, /\[SetUp "1"\]/);
  assert.match(text, /\[FEN "r3k2r/);
  assert.match(text, /9\.\.\. O-O-O 10\. O-O Kb8 \*/);
  const back = parse(E, text);
  assert.equal(back.fen, fen);
  assert.deepEqual(back.moves, sans);
});

test("promotion, with a capture, in every spelling", () => {
  const fen = "r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1";
  for (const mv of ["bxa8=Q+", "bxa8Q+", "bxa8=q", "b8=N", "b8=R", "b8=B"]) {
    const r = parse(E, `[SetUp "1"]\n[FEN "${fen}"]\n\n1. ${mv}`);
    assert.equal(r.moves.length, 1, mv);
  }
  assert.equal(parse(E, `[FEN "${fen}"]\n\n1. bxa8=N`).moves[0], "bxa8=N");
  const text = build(E, fen, asMoves(fen, ["bxa8=Q+"]));
  assert.deepEqual(parse(E, text).moves, ["bxa8=Q+"]);
});

test("castling both ways, with letters or zeros", () => {
  const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
  assert.deepEqual(parse(E, `[FEN "${fen}"]
1. O-O O-O-O+`).moves, ["O-O", "O-O-O"]);
  assert.deepEqual(parse(E, `[FEN "${fen}"]
1. O-O-O O-O`).moves, ["O-O-O", "O-O"]);
  const z = parse(E, `[FEN "${fen}"]
1. 0-0-0 0-0`);
  assert.equal(z.moves.length, 2);
  assert.ok(z.moves[0].startsWith("O-O-O") && z.moves[1].startsWith("O-O"));
});

test("two rooks that can go to one square: file, rank, or both", () => {
  const f1 = "4k3/8/8/8/8/8/4K3/R6R w - - 0 1";
  assert.equal(parse(E, `[FEN "${f1}"]
1. Rad1`).moves[0], "Rad1");
  assert.equal(parse(E, `[FEN "${f1}"]
1. Rhd1`).moves[0], "Rhd1");
  assert.throws(() => parse(E, `[FEN "${f1}"]
1. Rd1`), /Rd1/);
  const f2 = "4k3/8/8/R7/8/8/8/R3K3 w - - 0 1";
  assert.equal(parse(E, `[FEN "${f2}"]
1. R1a3`).moves[0], "R1a3");
  const f3 = "4k3/8/8/8/8/2Q1Q3/8/2Q1K3 w - - 0 1";
  assert.equal(parse(E, `[FEN "${f3}"]
1. Qc3e5`).moves[0], "Qce5+");
});

test("a plain FEN is a start with no moves", () => {
  const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
  const r = parse(E, fen);
  assert.deepEqual(r, { fen, moves: [], finalFen: fen, result: "*" });
  assert.equal(parse(E, "4k3/8/8/8/8/8/4P3/4K3 b").fen, "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1");
});

test("noise: numbers without spaces, notes, side lines, results", () => {
  const r = parse(E, "1.e4 e5 2.Nf3 ; a note to the end of the line\nNc6 3.Bb5!? (3.Bc4 Bc5) a6 $1 4.Ba4 *");
  assert.deepEqual(r.moves, ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4"]);
  assert.equal(r.result, "*");
  assert.equal(parse(E, "e4 e5 1/2-1/2").result, "1/2-1/2");
});

test("garbage gets a friendly error", () => {
  for (const bad of ["", "   ", "hello world", "1. e4 e5 2. Ke4", "1. e5", "[FEN \"nonsense\"]\n1. e4", "8/8/8/8/8/8/8/8 w - - 0 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", "{ just a comment }", "1-0"]) {
    assert.throws(() => parse(E, bad), (e) => typeof e.message === "string" && e.message.length > 10, JSON.stringify(bad));
  }
  assert.throws(() => parse(E, "1. e4 e5 2. Nf3 Nc6 3. Bb9"), /Bb9/);
  assert.throws(() => parse(E, null));
  assert.equal(checkFen("8/8/8/8/8/8/8/8 w - - 0 1"), null);
});

test("the opening table: every line is legal, no line is listed twice", () => {
  const seen = new Set();
  assert.ok(Openings.lines.length >= 115, `${Openings.lines.length} lines`);
  for (const l of Openings.lines) {
    const key = l.moves.join(" ");
    assert.ok(!seen.has(key), `twice: ${key}`);
    seen.add(key);
    const g = new E.Game();
    for (const s of l.moves) {
      const m = g.moves().find((x) => g.san(x).replace(/[+#]/g, "") === s.replace(/[+#]/g, ""));
      assert.ok(m, `${l.name}: illegal ${s} in ${l.moves.join(" ")}`);
      assert.equal(g.san(m), s, `${l.name}: write ${s} as ${g.san(m)}`);
      g.play(m);
    }
  }
});

test("the longest named line wins", () => {
  const sicilian = ["e4", "c5"];
  assert.equal(Openings.find(sicilian).name, "Sicilian Defence");
  const najdorf = "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5".split(" ");
  assert.equal(Openings.find(najdorf).name, "Sicilian Defence: Najdorf Variation");
  assert.equal(Openings.find("e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6".split(" ")).name, "Ruy Lopez: Exchange Variation");
  assert.equal(Openings.find("e4 e5 Nf3 Nc6 Bb5+".split(" ")).name, "Ruy Lopez");
  assert.equal(Openings.find([]), null);
  assert.equal(Openings.find(["a3"]), null);
  assert.equal(Openings.find(["d4", "d5", "c4"]).eco, "D06");
});

test("the look back marks a blunder that allows mate, and says so in plain words", async () => {
  vm.runInContext(readFileSync(new URL("../review.js", import.meta.url), "utf8"), ctx);
  const { describe, judge, explain, fallback } = ctx.Review._lab;
  const moves = asMoves(E.START, ["f3", "e5", "g4", "Qh4#"]);
  const data = describe(E.START, moves);
  data.look = [];
  for (let i = 0; i < data.fens.length; i++) {
    data.look[i] = i === data.moves.length ? { score: -100000, move: null } : await fallback(data.fens[i]);
  }
  data.marks = [];
  for (let k = 0; k < data.moves.length; k++) data.marks[k] = judge(data, k);
  assert.equal(data.marks[2].sym, "??");
  assert.equal(data.marks[2].mate, "allowed");
  assert.match(explain(data, 2, data.marks[2]), /checkmate/);
  assert.equal(data.marks[3].sym, "!");   // the mating move
});

test("a hanging piece is called out by creature and square", async () => {
  const { describe, judge, explain, fallback } = ctx.Review._lab;
  // white can take the black queen on d5 with the pawn; instead the king steps aside
  const fen = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
  const data = describe(fen, asMoves(fen, ["Kf2"]));
  data.look = [await fallback(data.fens[0]), await fallback(data.fens[1])];
  data.marks = [];
  const mk = judge(data, 0);
  assert.equal(mk.sym, "??");
  assert.match(explain(data, 0, mk), /the mushroom could have taken the crested bird on d5/);
});
