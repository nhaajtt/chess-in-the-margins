// Checks the move generator in engine.js against known perft counts. node scripts/perft.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.runInNewContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), ctx);
const { Game, perft, think } = ctx.ChessEngine;

const cases = [
  ["start", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902, 197281]],
  ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
  ["position 3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
  ["position 4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
];
let ok = true;
for (const [label, fen, want] of cases) {
  const g = new Game(fen);
  want.forEach((n, i) => {
    const got = perft(g, i + 1);
    const pass = got === n;
    ok &&= pass;
    console.log(`${pass ? "ok  " : "FAIL"} ${label} depth ${i + 1}: ${got}${pass ? "" : ` (want ${n})`}`);
  });
  if (g.fen() !== new Game(fen).fen()) { ok = false; console.log("FAIL", label, "board not restored"); }
}
// the opponent should find mate in one and answer within its time budget
const mate = new Game("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1");
const t = Date.now();
const m = think(mate, "hard");
const san = mate.san(m);
console.log(`${san === "Rd8#" ? "ok  " : "FAIL"} mate in one: ${san} in ${Date.now() - t} ms`);
ok &&= san === "Rd8#";
const g = new Game();
const t2 = Date.now();
think(g, "hard");
console.log(`opening move on hard took ${Date.now() - t2} ms`);
process.exit(ok ? 0 : 1);
