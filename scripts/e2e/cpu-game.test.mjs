// Playing against the computer: one whole game on easy to a checkmate, and the things around it.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();

test("a whole game against the computer on easy ends in checkmate, with the result, the diary and a sticker", async (g) => {
  await g.open();
  await g.selectRadio("level", "easy");
  await g.press("new");
  await g.settled();
  assert.equal(await g.page.eval(`Margins.level`), "easy");
  // the page's own engine plays the orange side, strongly; the computer answers on easy
  const end = await g.playOut({ maxPlies: 160, level: "hard" });
  assert.ok(end.over, `no result after ${end.plies} plies: ${await g.fen()}`);
  const s = await g.state();
  assert.equal(s.over.reason, "checkmate", `the game ended by ${s.over.reason}`);
  assert.equal(s.over.result, "1-0", "orange (the human side) won");
  assert.equal(s.status, "Checkmate. The orange team wins.");
  assert.match(s.san[s.san.length - 1], /#$/);
  assert.ok(s.san.length % 2 === 1, "the last move is orange's");
  assert.equal(s.cardShown, true, "the result card button");
  assert.equal(s.diaryShown, true, "the diary button");
  assert.equal(await g.page.eval(`document.getElementById("resign").disabled`), true);

  // the diary: written to storage and readable in its dialog
  const diary = await g.lsJson("chess-diaries");
  assert.equal(diary.length, 1);
  assert.equal(diary[0].title, "A game against the computer (easy)");
  assert.ok(diary[0].lines.some((l) => /checkmated the purple king/.test(l)), diary[0].lines.join(" | "));
  assert.ok(diary[0].lines[diary[0].lines.length - 1].startsWith("In all:"));
  await g.press("diary");
  await g.waitFor(`document.getElementById("diary-book") && document.getElementById("diary-book").open`);
  assert.match(await g.text("#diary-title"), /A game against the computer \(easy\)/);
  assert.match(await g.text("#diary-book ol"), /checkmated the purple king/);
  await g.closeDialogs();

  // a sticker for beating the computer, kept in storage and counted on the button
  const stickers = await g.stickers();
  assert.ok(stickers.includes("win"), `stickers: ${stickers}`);
  assert.match(await g.text("#stickers-btn"), new RegExp(`^stickers: ${stickers.length} of 19$`));
  await g.press("stickers-btn");
  await g.waitFor(`document.getElementById("sticker-book").open`);
  assert.ok((await g.page.eval(`document.querySelectorAll("#sticker-book li.is-got").length`)) >= 1);
  assert.match(await g.text("#sticker-book li.is-got"), /First win/);
  await g.closeDialogs();

  // the result card: pressing it makes a picture to save
  await g.page.eval(`window.__saved = []; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__saved.push({ type: b.type, size: b.size }); return make(b); };`);
  await g.press("card");
  await g.waitFor(`window.__saved.length === 1`, { label: "the result card picture to be made" });
  const pic = await g.page.eval(`window.__saved[0]`);
  assert.equal(pic.type, "image/png");
  assert.ok(pic.size > 2000, `the picture is only ${pic.size} bytes`);
});

test("the computer answers a move, and the board follows what it played", async (g) => {
  await g.open();
  await g.selectRadio("level", "easy");
  await g.press("new");
  await g.settled();
  await g.move("e2", "e4");
  await g.waitFor(`Margins.played().length === 2`, { label: "the computer to answer", timeout: 30000 });
  await g.settled();
  const s = await g.state();
  assert.equal(s.san.length, 2);
  assert.match(s.status, /Your move|team to move|went to/i);
  assert.equal(await g.page.eval(`new ChessEngine.Game(Margins.fen()).turn`), 0, "it is orange's turn again");
});

test("playing the purple team: the computer opens, and undo takes back both plies", async (g) => {
  await g.open();
  await g.selectRadio("level", "easy");
  await g.page.eval(`document.getElementById("play-purple").click()`);
  await g.settled();
  assert.equal(await g.page.eval(`Margins.human`), 1);
  await g.waitFor(`Margins.played().length === 1`, { label: "the computer's opening move", timeout: 30000 });
  await g.settled();
  const reply = (await g.san())[0];
  // the board is turned so purple is at the bottom
  assert.match(await g.page.eval(`document.querySelector("#squares button").getAttribute("aria-label")`), /^h1,/);
  const mine = await g.page.eval(`(() => { const g = new ChessEngine.Game(Margins.fen()); const m = g.moves().find((x) => (x.piece & 7) === 1); return [ChessEngine.name(m.from), ChessEngine.name(m.to)]; })()`);
  await g.move(mine[0], mine[1]);
  await g.waitFor(`Margins.played().length === 3`, { label: "the computer's second move", timeout: 30000 });
  await g.settled();
  await g.press("undo");
  await g.settled();
  assert.deepEqual(await g.san(), [reply], "undo took back my move and the computer's answer");
});

test("on the teach level the computer gives a tip", async (g) => {
  await g.open();
  await g.selectRadio("level", "teach");
  await g.press("new");
  await g.waitFor(`/^Tip: try the/.test(document.getElementById("status").textContent)`, { label: "the tip", timeout: 20000, probe: `document.getElementById("status").textContent` });
});
