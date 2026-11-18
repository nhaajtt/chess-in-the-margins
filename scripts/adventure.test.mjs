// Checks the story chapters: legal set-ups, kings, who plays which side. node --test scripts/adventure.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const ctx = {};
vm.runInNewContext(readFileSync(new URL("../engine.js", import.meta.url), "utf8"), ctx);
const { Game } = ctx.ChessEngine;

const page = {};
page.window = page;
vm.runInNewContext(readFileSync(new URL("../adventure.js", import.meta.url), "utf8"), page);
const chapters = page.Adventure.chapters;

const CREATURE = [null, ["mushroom", "blob"], ["pony", "zebra"], ["acorn", "wizard"], ["castle", "puffball"], ["bee queen", "crested bird"], ["owl", "penguin"]];
const VALUE = [0, 1, 3, 3, 5, 9, 0];
const material = (g, color) => { let s = 0; for (let sq = 0; sq < 128; sq++) { if (sq & 0x88) continue; const p = g.get(sq); if (p && (p >> 3) === color) s += VALUE[p & 7]; } return s; };
const count = (g, piece) => { let n = 0; for (let sq = 0; sq < 128; sq++) if (!(sq & 0x88) && g.get(sq) === piece) n++; return n; };

test("eight chapters, ids in order, texts in both languages", () => {
  assert.equal(chapters.length, 8);
  chapters.forEach((c, i) => {
    assert.equal(c.id, i + 1);
    for (const t of [c.title, c.story, c.win]) { assert.ok(t.en.length > 5, `${c.id} en`); assert.ok(t.vi.length > 5, `${c.id} vi`); }
    const sentences = c.story.en.split(/[.!?]+\s/).filter(Boolean).length;
    assert.ok(sentences >= 2 && sentences <= 5, `chapter ${c.id} story has ${sentences} sentences`);
    assert.ok(["easy", "normal", "hard", "master"].includes(c.level));
    assert.ok(["careful", "reckless", "greedy", "sleepy"].includes(c.style));
    assert.ok(c.human === 0 || c.human === 1);
  });
});

test("the difficulty only climbs and ends on master", () => {
  const order = ["easy", "normal", "hard", "master"];
  for (let i = 1; i < chapters.length; i++) assert.ok(order.indexOf(chapters[i].level) >= order.indexOf(chapters[i - 1].level), `chapter ${i + 1} gets easier`);
  assert.equal(chapters[7].level, "master");
  assert.equal(chapters[0].level, "easy");
});

test("every set-up is a legal position with both kings", () => {
  for (const c of chapters) {
    const g = new Game(c.fen);
    assert.equal(count(g, 6), 1, `chapter ${c.id}: one orange king`);
    assert.equal(count(g, 14), 1, `chapter ${c.id}: one purple king`);
    assert.equal(g.turn, 0, `chapter ${c.id}: orange moves first`);
    // the side not to move must not already be in check, and the mover must have a move
    assert.equal(g.attacked(g.kings[1], 0), false, `chapter ${c.id}: purple king is in check`);
    assert.equal(g.inCheck(), false, `chapter ${c.id}: orange is in check`);
    assert.ok(g.moves().length > 0, `chapter ${c.id}: no moves`);
    assert.equal(g.status().over, false, `chapter ${c.id}: already over`);
    // kings never touch
    const dr = Math.abs((g.kings[0] >> 4) - (g.kings[1] >> 4)), df = Math.abs((g.kings[0] & 7) - (g.kings[1] & 7));
    assert.ok(Math.max(dr, df) > 1, `chapter ${c.id}: kings touch`);
    // no pawns on the first or last rank
    for (let f = 0; f < 8; f++) for (const r of [0, 7]) assert.notEqual(g.get(r * 16 + f) & 7, 1, `chapter ${c.id}: pawn on the edge`);
    // the fen round-trips
    assert.equal(new Game(g.fen()).fen(), g.fen());
  }
});

test("the texts say the side the visitor really plays", () => {
  for (const c of chapters) {
    const mine = c.human === 0 ? "orange" : "purple", other = c.human === 0 ? "purple" : "orange";
    assert.equal(c.side, mine, `chapter ${c.id}: side field`);
    assert.match(c.story.en, new RegExp(`You play ${mine}`), `chapter ${c.id}: English side`);
    assert.doesNotMatch(c.story.en, new RegExp(`You play ${other}`));
    const viMine = c.human === 0 ? "quân cam" : "quân tím", viOther = c.human === 0 ? "quân tím" : "quân cam";
    assert.ok(c.story.vi.includes(`Bạn chơi ${viMine}`), `chapter ${c.id}: Vietnamese side`);
    assert.ok(!c.story.vi.includes(`Bạn chơi ${viOther}`));
  }
});

test("the boss is a creature of the other team and never has more than you", () => {
  for (const c of chapters) {
    const bossColor = c.human === 0 ? 1 : 0;
    assert.equal(c.piece >> 3, bossColor, `chapter ${c.id}: boss piece colour`);
    const creature = CREATURE[c.piece & 7][bossColor];
    assert.equal(creature.toLowerCase(), c.boss.toLowerCase().replace("penguin king", "penguin").replace("owl king", "owl"), `chapter ${c.id}: boss name`);
    const g = new Game(c.fen);
    assert.ok(material(g, bossColor) <= material(g, c.human), `chapter ${c.id}: boss has more material`);
  }
  // early bosses start without a queen or rooks, the last two are even
  const early = new Game(chapters[0].fen);
  assert.equal(count(early, 13), 0);
  assert.equal(count(early, 12), 0);
  for (const i of [6, 7]) { const g = new Game(chapters[i].fen); assert.equal(material(g, 0), material(g, 1)); }
});

// ---- the lessons in school.js ----
const school = { ChessEngine: ctx.ChessEngine };
school.window = school;
vm.runInNewContext(readFileSync(new URL("../school.js", import.meta.url), "utf8"), school);
const { lessons, par, solutions } = school.School;

test("school: every lesson has text in both languages and tasks that can be solved", () => {
  assert.equal(lessons.length, 11);
  for (const l of lessons) {
    assert.ok(l.rule.en && l.rule.vi && l.title.en && l.title.vi, l.id);
    assert.ok(l.tasks.length >= 1);
    for (const task of l.tasks) {
      assert.ok(task.text.en && task.text.vi, `${l.id}: task text`);
      if (task.kind === "stars") assert.ok(par(task) > 0, `${l.id}: star task cannot be solved`);
      else {
        const g = new Game(task.fen);
        assert.equal(g.turn, 0, `${l.id}: orange moves`);
        assert.equal(g.attacked(g.kings[1], 0), false, `${l.id}: purple already in check`);
        assert.ok(solutions(task) >= 1, `${l.id}: nothing solves ${task.fen}`);
      }
    }
  }
});

test("school: the fewest moves for the star tasks", () => {
  const task = (id, i) => lessons.find((l) => l.id === id).tasks[i];
  assert.equal(par(task("knight", 1)), 3);
  assert.equal(par(task("rook", 2)), 3);
  assert.equal(par(task("queen", 1)), 3);
  assert.equal(par(task("pawn", 1)), 2);
});
