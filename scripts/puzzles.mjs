// Puzzle set for the game: builds puzzles.js from the Lichess puzzle database and checks it. node scripts/puzzles.mjs --check | --build [temp-dir]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const ctx = {};
vm.runInNewContext(readFileSync(new URL("engine.js", root), "utf8"), ctx);
const { Game, VALUE, BLACK } = ctx.ChessEngine;

const sqName = (s) => "abcdefgh"[s & 7] + ((s >> 4) + 1);
const LETTER = { 2: "n", 3: "b", 4: "r", 5: "q" };
const text = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? LETTER[m.promo & 7] : "");
const find = (g, s) => g.moves().find((m) => text(m) === s);
const material = (g, colour) => { let t = 0; for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = g.board[r * 16 + f]; if (p && (p & 7) !== 6 && !!(p & BLACK) === !!colour) t += VALUE[p & 7]; } return t; };
const mated = (g) => g.status().reason === "checkmate";
const mateIn1 = (g) => g.moves().some((m) => { g.play(m); const r = mated(g); g.takeBack(); return r; });

export const KINDS = { mate1: { n: 1, count: 60 }, mate2: { n: 3, count: 120 }, mate3: { n: 5, count: 60 }, win: { n: 3, count: 60 } };

// Returns a list of problems with one puzzle (empty when it is sound).
export function problems(p) {
  const bad = [];
  const spec = KINDS[p.kind];
  if (!spec) return [`unknown kind ${p.kind}`];
  if (!Array.isArray(p.line) || p.line.length !== spec.n) return [`line must have ${spec.n} moves`];
  let g;
  try { g = new Game(p.fen); } catch (e) { return ["fen does not parse"]; }
  if (g.fen().split(" ")[0] !== p.fen.split(" ")[0]) return ["fen does not parse"];
  if (g.status().over) return ["already over"];
  const solver = g.turn;
  const start = material(g, solver) - material(g, solver ^ 1);
  for (let i = 0; i < p.line.length; i++) {
    const m = find(g, p.line[i]);
    if (!m) return [`illegal move ${p.line[i]} at ${i}`];
    g.play(m);
    if (i === 0 && p.kind === "mate2") {
      // every reply must allow a mate in one
      const replies = g.moves();
      if (!replies.length) bad.push("no reply (mate in one)");
      for (const r of replies) { g.play(r); if (!mateIn1(g)) bad.push(`reply ${text(r)} escapes`); g.takeBack(); }
    }
  }
  if (p.kind !== "win" && !mated(g)) bad.push("line does not end in checkmate");
  if (p.kind === "win") {
    const gain = material(g, solver) - material(g, solver ^ 1) - start;
    if (gain < 300) bad.push(`gains only ${gain}`);
  }
  if (p.kind === "mate1" && !mateIn1(new Game(p.fen))) bad.push("no mate in one");
  return bad;
}

export function loadPuzzles(file = new URL("puzzles.js", root)) {
  const w = {};
  vm.runInNewContext(readFileSync(file, "utf8"), { window: w });
  return w.CHESS_PUZZLES;
}

export function checkAll(list = loadPuzzles()) {
  const errors = [];
  const ids = new Set();
  const counts = {};
  for (const p of list) {
    if (ids.has(p.id)) errors.push(`${p.id}: duplicate id`);
    ids.add(p.id);
    counts[p.kind] = (counts[p.kind] || 0) + 1;
    for (const b of problems(p)) errors.push(`${p.id}: ${b}`);
  }
  for (const k in KINDS) if (counts[k] !== KINDS[k].count) errors.push(`${k}: ${counts[k] || 0} puzzles, want ${KINDS[k].count}`);
  return { errors, counts };
}

// ---- building ----
const URL_DB = "https://database.lichess.org/lichess_db_puzzle.csv.zst";
const WIN_THEMES = ["fork", "hangingPiece", "pin", "skewer", "discoveredAttack", "trappedPiece", "attraction", "deflection"];
const LIMIT = 60e6; // compressed bytes to read at most

async function harvest(dir, existingIds) {
  const cache = join(dir, "candidates.json");
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const ac = new AbortController();
  const res = await fetch(URL_DB, { signal: ac.signal, headers: { "User-Agent": "puzzle-fetch" } });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const dec = zlib.createZstdDecompress();
  let bytes = 0;
  (async () => {
    try {
      for await (let c of res.body) {
        if (!bytes) c = c.subarray(12); // the file opens with a 12-byte skippable frame
        bytes += c.length;
        if (!dec.write(c)) await new Promise((r) => dec.once("drain", r));
        if (bytes > LIMIT) break;
      }
    } catch {}
    ac.abort();
    dec.end();
  })();
  const rl = readline.createInterface({ input: dec, crlfDelay: Infinity });
  const rows = [];
  let n = 0;
  try {
    for await (const line of rl) {
      if (++n === 1) continue;
      const c = line.split(",");
      if (c.length < 8) continue;
      const [id, fen, moves, rating, , pop, plays, themes] = c;
      const known = existingIds.has(id);
      if (!known && (+pop < 90 || +plays < 1000)) continue;
      const t = themes.split(" ");
      const mv = moves.split(" ");
      let kind = null;
      if (t.includes("mateIn1") && mv.length === 2) kind = "mate1";
      else if (t.includes("mateIn2") && mv.length === 4) kind = "mate2";
      else if (t.includes("mateIn3") && mv.length === 6) kind = "mate3";
      else if (mv.length === 4 && !t.some((x) => x.startsWith("mate")) && WIN_THEMES.some((x) => t.includes(x))) kind = "win";
      if (!kind && !known) continue;
      rows.push({ id, fen, moves: mv, rating: +rating, kind });
    }
  } catch (e) { if (!rows.length) throw e; }
  ac.abort();
  if (!rows.length) throw new Error("no rows read");
  console.log(`read ${n} rows from about ${(bytes / 1e6).toFixed(0)} MB compressed, kept ${rows.length}`);
  writeFileSync(cache, JSON.stringify(rows));
  return rows;
}

// Puts the opponent's first move on the board and returns the puzzle as the solver sees it.
function convert(r) {
  const g = new Game(r.fen);
  const m = find(g, r.moves[0]);
  if (!m) return null;
  g.play(m);
  return { id: r.id, kind: r.kind, rating: r.rating, fen: g.fen(), line: r.moves.slice(1) };
}

const RANGE = { mate1: [600, 1500], mate2: [600, 1500], mate3: [1000, 1800], win: [600, 1500] };
function spread(items, n) { // n items evenly spread over the rating order
  items.sort((a, b) => a.rating - b.rating);
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * (items.length - 1)) / (n - 1))]);
}

const row = (p) => `  { id: "${p.id}", kind: "${p.kind}",${p.rating !== undefined ? ` rating: ${p.rating},` : ""} fen: "${p.fen}", line: [${p.line.map((x) => `"${x}"`).join(",")}] },`;

async function build(dir) {
  mkdirSync(dir, { recursive: true });
  const orig = join(dir, "puzzles.orig.js"); // the file as it was before the first build
  const old = loadPuzzles(existsSync(orig) ? orig : undefined).map((p) => ({ ...p, kind: "mate2" }));
  const oldIds = new Set(old.map((p) => p.id));
  const rows = await harvest(dir, oldIds);
  const rated = new Map(rows.filter((r) => oldIds.has(r.id)).map((r) => [r.id, r.rating]));
  for (const p of old) if (rated.has(p.id)) p.rating = rated.get(p.id);
  for (const p of old) if (p.rating === undefined) { // not in the part of the file we read: ask the site
    const r = await fetch(`https://lichess.org/api/puzzle/${p.id}`, { headers: { "User-Agent": "puzzle-fetch" } });
    if (r.ok) p.rating = (await r.json()).puzzle.rating;
  }
  console.log(`old puzzles rated: ${rated.size} of ${old.length}`);
  const out = [];
  for (const kind of Object.keys(KINDS)) {
    const [lo, hi] = RANGE[kind];
    const keep = kind === "mate2" ? old : [];
    const need = KINDS[kind].count - keep.length;
    const pool = rows.filter((r) => r.kind === kind && !oldIds.has(r.id) && r.rating >= lo && r.rating <= hi).map(convert).filter((p) => p && problems(p).length === 0);
    const picked = spread(pool, need);
    console.log(kind, "pool", pool.length, "picked", picked.length, "of", need);
    if (picked.length < need) throw new Error(`${kind}: only ${picked.length} of ${need} candidates pass`);
    const all = keep.concat(picked);
    all.sort((a, b) => (a.rating ?? -1) - (b.rating ?? -1)); // unrated old ones, if any, go first
    out.push(...all);
  }
  const head = `/* Chess puzzles from the Lichess puzzle database (lichess.org, Creative Commons 0), each checked with engine.js (node scripts/puzzles.mjs --check).
   Kinds: mate1, mate2, mate3 (mate in one, two, three) and win (win a piece), easiest first within each kind.
   Each one: the position with the solver to move, and the line (solver move, answer, solver move ...) in from-to notation. */\n`;
  writeFileSync(new URL("puzzles.js", root), `${head}window.CHESS_PUZZLES = [\n${out.map(row).join("\n")}\n];\n`);
  console.log("wrote puzzles.js", out.length);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--build");
  if (i >= 0) await build(process.argv[i + 1] || join(tmpdir(), "lichess-puzzles"));
  const { errors, counts } = checkAll();
  console.log(JSON.stringify(counts));
  if (errors.length) { console.error(errors.slice(0, 30).join("\n")); console.error(`${errors.length} problems`); process.exit(1); }
  console.log("puzzles ok");
}
