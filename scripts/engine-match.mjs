// Plays the current engine's "hard" level against the one committed in HEAD and prints wins/draws/losses.
// node scripts/engine-match.mjs [games=20] [msPerMove=200]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { cpus } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import vm from "node:vm";

const here = (p) => new URL(p, import.meta.url);
const load = (src) => { const ctx = {}; vm.runInNewContext(src, ctx); return ctx.ChessEngine; };

// a few varied starts (each already a few moves in)
const OPENINGS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
  "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
  "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
  "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3",
];

function playGame(Newer, Older, fen, newIsWhite, ms) {
  const g = new Newer.Game(fen);
  for (let ply = 0; ply < 160; ply++) {
    const st = g.status();
    if (st.over) return st.result === "1/2-1/2" ? 0.5 : (st.result === "1-0") === newIsWhite ? 1 : 0;
    const newTurn = (g.turn === 0) === newIsWhite;
    let m;
    if (newTurn) m = Newer.think(g, "hard", { ms });
    else {
      // the old engine works on its own board, so hand it the same position and map the answer back
      const old = Older.think(new Older.Game(g.fen()), "hard");
      m = g.moves().find((x) => x.from === old.from && x.to === old.to && (x.promo & 7) === (old.promo & 7));
    }
    g.play(m);
    // call it early once one side is far ahead in material and the game is well along
    if (ply > 60 && ply % 10 === 0) {
      let d = 0;
      for (let sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } const p = g.board[sq]; if (p) d += (p & 8 ? -1 : 1) * Newer.VALUE[p & 7] * ((p & 7) === 6 ? 0 : 1); }
      if (Math.abs(d) >= 900) return (d > 0) === newIsWhite ? 1 : 0;
    }
  }
  return 0.5;
}

if (!isMainThread) {
  const { jobs, ms, oldSrc } = workerData;
  const Newer = load(readFileSync(here("../engine.js"), "utf8")), Older = load(oldSrc);
  parentPort.postMessage(jobs.map(([i, fen, white]) => [i, playGame(Newer, Older, fen, white, ms)]));
} else {
  const games = Number(process.argv[2]) || 20, ms = Number(process.argv[3]) || 200;
  const oldSrc = execFileSync("git", ["show", "HEAD:engine.js"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  const Newer = load(readFileSync(here("../engine.js"), "utf8"));

  // speed check: nodes a second from a busy middlegame
  const g = new Newer.Game("r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9");
  const t = Date.now(), r = Newer.search(g, "hard", { ms: 1000 });
  console.log(`speed: ${Math.round(r.nodes / ((Date.now() - t) / 1000)).toLocaleString()} nodes/s, depth ${r.depth} in about a second`);

  const jobs = Array.from({ length: games }, (_, i) => [i, OPENINGS[(i >> 1) % OPENINGS.length], i % 2 === 0]);
  const n = Math.max(1, Math.min(4, cpus().length - 1, games));
  const lanes = Array.from({ length: n }, (_, k) => jobs.filter((_, i) => i % n === k));
  const results = [];
  let done = 0;
  for (const lane of lanes) {
    const w = new Worker(here(import.meta.url), { workerData: { jobs: lane, ms, oldSrc } });
    w.on("message", (rs) => { results.push(...rs); if (++done === n) report(); });
    w.on("error", (e) => { console.error(e); process.exit(1); });
  }
  function report() {
    const w = results.filter(([, s]) => s === 1).length, d = results.filter(([, s]) => s === 0.5).length, l = results.length - w - d;
    console.log(`new hard (${ms} ms a move) vs old hard, ${results.length} games: +${w} =${d} -${l}  score ${(w + d / 2)}/${results.length}`);
    process.exit(w > l ? 0 : 1);
  }
}
