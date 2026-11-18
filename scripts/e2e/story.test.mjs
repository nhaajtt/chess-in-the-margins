// The golden star (eight chapters against bosses) and the school (lessons on a practice board).
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();

// what each chapter should set up: [boss, level, which side you play, how many creatures the boss starts with]
const CHAPTERS = [
  ["Blob", "easy", 0, 13], ["Mushroom", "easy", 1, 13], ["Zebra", "easy", 0, 15], ["Acorn", "normal", 1, 15],
  ["Wizard", "normal", 0, 15], ["Bee queen", "hard", 1, 15], ["Owl king", "hard", 1, 16], ["Penguin king", "master", 0, 16],
];

const openAdventure = async (g) => { await g.press("adventure-btn"); await g.waitFor(`document.getElementById("adventure-book") && document.getElementById("adventure-book").open`); };
const adv = (g) => g.text("#adventure-book");
// press a button in the open adventure or school page by its words
const pressIn = (g, dialog, words) => g.page.eval(`(() => { const b = [...document.querySelectorAll("#${dialog} button")].find((x) => x.textContent.trim() === ${JSON.stringify(words)}); if (!b) return false; b.click(); return true; })()`);

test("the contents page lists eight chapters; only the first is open", async (g) => {
  await g.open();
  await openAdventure(g);
  const rows = await g.page.eval(`[...document.querySelectorAll("#adventure-book .adv-row")].map((b) => ({ label: b.getAttribute("aria-label"), disabled: b.disabled }))`);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((r) => r.disabled), [false, true, true, true, true, true, true, true]);
  assert.match(rows[0].label, /^Chapter 1, The sleepy blob$/);
  assert.match(rows[1].label, /^Chapter 2, locked\. Win chapter 1 first$/);
  assert.match(await adv(g), /0 of 8 chapters won/);
});

test("chapter 1 starts: the tag, the level, your side and the handicap position", async (g) => {
  await g.open();
  await openAdventure(g);
  await g.page.eval(`document.querySelector("#adventure-book .adv-row").click()`);
  await g.waitFor(`document.querySelector("#adventure-book .adv-page")`);
  assert.match(await adv(g), /The sleepy blob/);
  assert.ok(await pressIn(g, "adventure-book", "Play"));
  await g.waitFor(`!document.getElementById("adventure-book").open`, { label: "the contents page to close" });
  await g.settled();
  const s = await g.page.eval(`({ tag: Margins.tag, level: Margins.level, human: Margins.human, mode: Margins.mode, fen: Margins.fen(), status: document.getElementById("status").textContent })`);
  assert.equal(s.tag, "adventure:1");
  assert.equal(s.level, "easy");
  assert.equal(s.human, 0);
  assert.equal(s.mode, "cpu");
  assert.equal(s.fen, "1nb1kbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1");
  assert.equal(s.status, "Chapter 1: Blob. You play orange.");
  assert.equal(await g.page.eval(`document.getElementById("talk").textContent`), "the blob yawns. it forgot half its team at home");
  // the boss is a creature short: purple has no queen and no rooks
  assert.equal(s.fen.split(" ")[0].split("/")[0], "1nb1kbn1");
});

test("every chapter sets up its own game", async (g) => {
  await g.open({ seed: { "chess-adventure": "[1,2,3,4,5,6,7]" } });
  for (let i = 0; i < 8; i++) {
    await openAdventure(g);
    await g.page.eval(`document.querySelectorAll("#adventure-book .adv-row")[${i}].click()`);
    assert.ok(await pressIn(g, "adventure-book", "Play"), `chapter ${i + 1} has a Play button`);
    await g.waitFor(`!document.getElementById("adventure-book").open`);
    await g.settled();
    const [boss, level, human, count] = CHAPTERS[i];
    const s = await g.page.eval(`({ tag: Margins.tag, level: Margins.level, human: Margins.human, fen: Margins.fen(), status: document.getElementById("status").textContent })`);
    assert.equal(s.tag, `adventure:${i + 1}`);
    assert.equal(s.level, level, `chapter ${i + 1} level`);
    assert.equal(s.human, human, `chapter ${i + 1} side`);
    // (the status line is only still the chapter's own words before the boss has moved)
    if (human === 0) assert.equal(s.status, `Chapter ${i + 1}: ${boss}. You play orange.`);
    const bossLetters = human === 0 ? /[a-z]/g : /[A-Z]/g;
    assert.equal((s.fen.split(" ")[0].match(bossLetters) || []).length, count, `chapter ${i + 1}: the boss starts with ${count} creatures`);
    assert.equal((s.fen.split(" ")[0].match(human === 0 ? /[A-Z]/g : /[a-z]/g) || []).length, 16, "you have all of yours");
    if (human === 1) {
      // the boss plays orange and moves first
      await g.waitFor(`Margins.played().length >= 1`, { label: `the boss's first move in chapter ${i + 1}`, timeout: 30000 });
    }
  }
});

test("a lost chapter offers another try and keeps no star", async (g) => {
  await g.open();
  await openAdventure(g);
  await g.page.eval(`document.querySelector("#adventure-book .adv-row").click()`);
  await pressIn(g, "adventure-book", "Play");
  await g.settled();
  await g.move("e2", "e4");
  await g.waitFor(`Margins.played().length === 2 && !Margins.busy`, { label: "the boss to answer", timeout: 30000 });
  await g.press("resign");
  await g.waitFor(`document.getElementById("adventure-book").open`, { label: "the lose page to open", timeout: 15000 });
  assert.ok(await pressIn(g, "adventure-book", "Try again"), "a Try again button");
  assert.equal(await g.lsJson("chess-adventure"), null);
  await g.waitFor(`!document.getElementById("adventure-book").open`);
  await g.settled();
  assert.deepEqual(await g.san(), [], "a fresh game of chapter 1");
  assert.equal(await g.page.eval(`Margins.tag`), "adventure:1");
});

test("a won chapter opens the next, saves the star, and it survives a reload", async (g) => {
  await g.open();
  await openAdventure(g);
  await g.page.eval(`document.querySelector("#adventure-book .adv-row").click()`);
  await pressIn(g, "adventure-book", "Play");
  await g.settled();
  const end = await g.playOut({ maxPlies: 200, level: "hard" });
  assert.ok(end.over && end.over.reason === "checkmate" && end.over.result === "1-0", `the game ended with ${JSON.stringify(end)}`);
  await g.waitFor(`document.getElementById("adventure-book").open`, { label: "the victory page to open", timeout: 15000 });
  assert.match(await adv(g), /Chapter 1 won!/);
  assert.deepEqual(await g.lsJson("chess-adventure"), [1]);
  assert.ok(await pressIn(g, "adventure-book", "Next chapter"));
  await g.waitFor(`/The mushroom who charges/.test(document.getElementById("adventure-book").textContent)`);
  await g.closeDialogs();
  await g.page.reload();
  await g.ready();
  await openAdventure(g);
  assert.match(await adv(g), /1 of 8 chapters won/);
  const rows = await g.page.eval(`[...document.querySelectorAll("#adventure-book .adv-row")].map((b) => b.disabled)`);
  assert.deepEqual(rows, [false, false, true, true, true, true, true, true], "chapters 1 and 2 are open after a reload");
  assert.match(await g.page.eval(`document.querySelector("#adventure-book .adv-item").className`), /is-won/);
});

test("a drawn chapter is not a win", async (g) => {
  await g.open();
  await g.page.eval(`Margins.load({ fen: "4k3/8/8/8/8/8/3p4/4K3 w - - 0 1", mode: "cpu", level: "easy", human: 0, tag: "adventure:1" })`);
  await g.settled();
  await g.move("e1", "d2");     // king takes the last pawn: bare kings, a draw
  await g.waitFor(`document.getElementById("adventure-book") && document.getElementById("adventure-book").open`, { timeout: 15000, label: "the page after a draw" });
  assert.match(await adv(g), /A draw! Nobody gets the star yet/);
  assert.equal(await g.lsJson("chess-adventure"), null);
});

test("school: the list, one lesson with stars finished, and the progress kept", async (g) => {
  await g.open();
  await g.press("school-btn");
  await g.waitFor(`document.getElementById("school-book").open`);
  assert.equal(await g.page.eval(`document.querySelectorAll("#school-book .sch-row").length`), 11);
  assert.match(await g.text("#school-book"), /0 of 11 lessons done/);
  await g.page.eval(`[...document.querySelectorAll("#school-book .sch-row")].find((b) => b.getAttribute("aria-label") === "The owl king (king)").click()`);
  await g.waitFor(`document.querySelector("#school-book .sch-board")`);
  const sq = (n) => g.page.eval(`document.querySelector('#school-book .sch-sq[data-sq="${n}"]').click()`);
  // pick the king up and put it down on each square in turn (squares are 0x88 numbers: e1 = 4, e2 = 20, e3 = 36)
  const walk = async (...path) => { for (let i = 0; i + 1 < path.length; i++) { await sq(path[i]); await sq(path[i + 1]); } };
  // task 1: two steps to the star on e3
  await walk(4, 20, 36);
  await g.waitFor(`/Done in 2 moves/.test(document.querySelector("#school-book .sch-say").textContent)`, { label: "task 1 done", probe: `document.querySelector("#school-book .sch-say").textContent` });
  assert.ok(await pressIn(g, "school-book", "Next task"));
  // task 2: f2, g3 and h4 in three steps
  await g.waitFor(`/Task 2 of 2/.test(document.getElementById("school-book").textContent)`);
  await walk(4, 21, 38, 55);
  await g.waitFor(`/Done in 3 moves/.test(document.querySelector("#school-book .sch-say").textContent)`, { label: "task 2 done", probe: `document.querySelector("#school-book .sch-say").textContent` });
  assert.match(await g.text("#school-book .sch-say"), /fewest possible/);
  assert.deepEqual(await g.lsJson("chess-school"), ["king"]);
  await g.closeDialogs();
  await g.page.reload();
  await g.ready();
  await g.press("school-btn");
  assert.match(await g.text("#school-book"), /1 of 11 lessons done/);
  assert.match(await g.page.eval(`[...document.querySelectorAll("#school-book .sch-row")].find((b) => b.getAttribute("aria-label").startsWith("The owl king")).getAttribute("aria-label")`), /, done$/);
});

test("school: a real-rules lesson (castling) rejects a wrong move and accepts the right one", async (g) => {
  await g.open();
  await g.press("school-btn");
  await g.waitFor(`document.getElementById("school-book").open`);
  await g.page.eval(`[...document.querySelectorAll("#school-book .sch-row")].find((b) => b.getAttribute("aria-label") === "Castling").click()`);
  await g.waitFor(`document.querySelector("#school-book .sch-board")`);
  const sq = (n) => g.page.eval(`document.querySelector('#school-book .sch-sq[data-sq="${n}"]').click()`);
  // short side: the king e1 (4) to f1 (5) is a move, but not a castle
  await sq(4); await sq(5);
  await g.waitFor(`/Not that one/.test(document.querySelector("#school-book .sch-say").textContent)`, { label: "the not-that-one message" });
  await g.waitFor(`document.querySelector('#school-book .sch-sq[data-sq="4"] svg') !== null && document.querySelector('#school-book .sch-sq[data-sq="5"] svg') === null`, { label: "the king to be put back" });
  await sq(4); await sq(6);
  await g.waitFor(`/exactly it/.test(document.querySelector("#school-book .sch-say").textContent)`, { label: "the castle accepted" });
  assert.equal(await g.lsJson("chess-school"), null, "one task of two is not a finished lesson");
  assert.ok(await pressIn(g, "school-book", "Next task"));
  await g.waitFor(`/Task 2 of 2/.test(document.getElementById("school-book").textContent)`);
  await sq(4); await sq(2);
  await g.waitFor(`/exactly it/.test(document.querySelector("#school-book .sch-say").textContent)`);
  assert.deepEqual(await g.lsJson("chess-school"), ["castling"]);
});
