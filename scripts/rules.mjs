// The rules that end or limit a game, beyond plain move counting. node scripts/rules.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const ctx = {};
vm.runInNewContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), ctx);
const { Game, F_EP, F_KCASTLE, F_QCASTLE } = ctx.ChessEngine;
const sq = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);
const find = (g, f, t, promo) => g.moves().find((m) => m.from === sq(f) && m.to === sq(t) && (promo === undefined || (m.promo & 7) === promo));
const play = (g, ...list) => { for (const s of list) { const m = find(g, s.slice(0, 2), s.slice(2, 4)); assert.ok(m, `illegal ${s} in ${g.fen()}`); g.play(m); } };

test("checkmate and stalemate", () => {
  const g = new Game();
  play(g, "f2f3", "e7e5", "g2g4", "d8h4");
  assert.deepEqual({ ...g.status() }, { over: true, result: "0-1", reason: "checkmate" });
  assert.equal(new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").status().reason, "stalemate");
});

test("threefold repetition", () => {
  const g = new Game();
  play(g, "g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1");
  assert.equal(g.status().over, false);
  play(g, "f6g8");
  assert.equal(g.status().reason, "repetition");
});

test("an en passant square no pawn can use does not make a position new", () => {
  const g = new Game();
  play(g, "e2e4");
  assert.equal(g.key().split(" ")[3], "-");
  const h = new Game("4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1");
  play(h, "e2e4");
  assert.equal(h.key().split(" ")[3], "e3");
  // the double step, then out and back twice: the position right after the step counts as the first of three
  const r = new Game("4k3/8/8/8/8/8/4P3/4K1N1 w - - 0 1");
  play(r, "e2e4", "e8d8", "g1f3", "d8e8", "f3g1", "e8d8", "g1f3", "d8e8");
  assert.equal(r.status().over, false);
  play(r, "f3g1");
  assert.equal(r.status().reason, "repetition");
});

test("fifty moves, unless the last one mates", () => {
  const g = new Game("4k3/8/8/8/8/8/8/R3K3 w - - 99 80");
  play(g, "a1a2");
  assert.equal(g.status().reason, "fifty moves");
  const m = new Game("6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80");
  play(m, "a1a8");
  assert.equal(m.status().reason, "checkmate");
});

test("not enough pieces to mate", () => {
  for (const fen of ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "4k3/8/8/8/8/8/8/1N2K3 b - - 0 1"]) assert.equal(new Game(fen).status().reason, "not enough pieces");
  for (const fen of ["4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1"]) assert.equal(new Game(fen).status().over, false);
});

test("castling: not out of, through or into check, and not after the rook has gone", () => {
  const castles = (fen) => new Game(fen).moves().filter((m) => m.flags & (F_KCASTLE | F_QCASTLE)).length;
  assert.equal(castles("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), 2);
  assert.equal(castles("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1"), 2);
  assert.equal(castles("4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1"), 0);
  assert.equal(castles("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1"), 1);
  assert.equal(castles("4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1"), 1);
  assert.equal(castles("4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1"), 2);
  assert.equal(castles("4k3/8/8/8/8/8/8/R2bK2R w KQ - 0 1"), 1);
  const g = new Game("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
  play(g, "a8a1");
  assert.equal(g.fen().split(" ")[2], "Kk");
});

test("en passant: only right after the double step, and never into a pin", () => {
  const h = new Game("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
  play(h, "d7d5");
  assert.ok(h.moves().some((m) => m.flags & F_EP));
  play(h, "e1d1", "e8d8");
  assert.ok(!h.moves().some((m) => m.flags & F_EP));
  const pinned = new Game("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");
  assert.ok(!pinned.moves().some((m) => m.flags & F_EP));
});

test("a pawn on the last rank becomes any of four pieces", () => {
  const g = new Game("8/P7/8/8/8/8/8/k6K w - - 0 1");
  const promos = g.moves().filter((m) => m.from === sq("a7")).map((m) => m.promo & 7).sort();
  assert.deepEqual([...promos], [2, 3, 4, 5]);
});

test("no move ever leaves your own king in check", () => {
  const g = new Game("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");
  for (const m of g.moves()) { g.make(m); assert.ok(!g.attacked(g.kings[0], 1)); g.unmake(m); }
});
