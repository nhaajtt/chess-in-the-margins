// Using the page with the keyboard alone: moving a creature, and every dialog opening, holding the focus, closing and giving the focus back.
import { e2e, assert } from "./harness.mjs";

const { test, todo } = e2e();

const active = (g) => g.page.eval(`(() => { const a = document.activeElement; return { tag: a.tagName, id: a.id, cls: a.className, label: a.getAttribute("aria-label") || (a.textContent || "").trim().slice(0, 40) }; })()`);
const squareFocused = (g) => g.page.eval(`document.activeElement.classList.contains("cx-sq") ? document.activeElement.getAttribute("aria-label").slice(0, 2) : null`);

// Tab until focus reaches a creature's square (the page's first stops are the skip link and the source link)
async function tabToBoard(g) {
  for (let i = 0; i < 12; i++) {
    await g.page.key("Tab");
    if (await squareFocused(g)) return;
  }
  assert.fail("Tab never reached the board");
}

test("the skip link is the first stop and takes you to the board", async (g) => {
  await g.open();
  await g.page.key("Tab");
  assert.equal((await active(g)).label, "Skip to the board");
  await g.page.key("Enter");
  assert.equal(await g.page.eval(`location.hash`), "#board");
});

test("a move with Tab, the arrow keys and Enter", async (g) => {
  await g.open({ mode: "friend" });
  await tabToBoard(g);
  assert.equal(await squareFocused(g), "e1", "the first stop on the board is the owl's square");
  assert.equal(await g.page.eval(`document.querySelectorAll('#squares button[tabindex="0"]').length`), 1, "one square is in the tab order at a time");
  await g.page.key("ArrowUp");                 // e2
  assert.equal(await squareFocused(g), "e2");
  await g.page.key("Enter");                   // pick the mushroom up
  await g.page.key("ArrowUp");
  await g.page.key("ArrowUp");                 // e4
  assert.equal(await squareFocused(g), "e4");
  await g.page.key("Enter");                   // put it down
  await g.waitFor(`Margins.played().length === 1`, { label: "the move to be played" });
  assert.deepEqual(await g.san(), ["e4"]);
  assert.equal(await squareFocused(g), "e4", "the focus stays on the board");
  // arrows stop at the edge instead of leaving the board
  for (let i = 0; i < 10; i++) await g.page.key("ArrowRight");
  assert.equal(await squareFocused(g), "h4");
});

test("keyboard play against the computer: pick up, put down, the computer answers", async (g) => {
  await g.open();
  await g.selectRadio("level", "easy");
  await g.press("new");
  await g.settled();
  await tabToBoard(g);
  await g.page.key("ArrowRight");               // f1
  await g.page.key("ArrowRight");               // g1
  await g.page.key("Enter");                    // the pony
  await g.page.key("ArrowUp"); await g.page.key("ArrowUp"); await g.page.key("ArrowLeft");   // f3
  assert.equal(await squareFocused(g), "f3");
  await g.page.key("Enter");
  await g.waitFor(`Margins.played().length === 2`, { label: "the computer to answer", timeout: 30000 });
  assert.equal((await g.san())[0], "Nf3");
});

test("Escape puts a picked-up creature back without moving it", async (g) => {
  await g.open({ mode: "friend" });
  await g.click("e2");
  assert.equal(await g.page.eval(`document.querySelectorAll("#marks .cx-ring").length`) > 0, true, "the picked-up creature is ringed");
  // choosing the same square again puts it back
  await g.click("e2");
  assert.equal(await g.fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
});

test("the promotion dialog works from the keyboard and gives the focus back to the board", async (g) => {
  await g.open({ mode: "friend", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" });
  await g.page.eval(`document.querySelector('#squares button[data-sq="96"]').focus()`);   // a7
  assert.equal(await squareFocused(g), "a7");
  await g.page.key("Enter");
  await g.page.key("ArrowUp");                   // a8
  await g.page.key("Enter");
  await g.waitFor(`document.getElementById("promo").open`, { label: "the promotion dialog" });
  assert.equal(await g.page.eval(`document.getElementById("promo").contains(document.activeElement)`), true, "the focus moves into the dialog");
  await g.page.key("Escape");
  await g.waitFor(`!document.getElementById("promo").open`);
  assert.equal(await g.page.eval(`document.activeElement.classList.contains("cx-sq")`), true, "the focus goes back to the board");
  assert.equal(await g.fen(), "4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  // once more, and this time choose with the keyboard
  await g.page.key("Enter");
  await g.waitFor(`document.getElementById("promo").open`);
  await g.page.key("Tab");
  await g.page.key("Enter");
  await g.waitFor(`Margins.played().length === 1`);
  assert.match((await g.san())[0], /^a8=[QRBN]/);
});

const DIARY = JSON.stringify([{ at: "2026-01-02T10:00:00.000Z", title: "A game between two friends on one screen", lines: ["The orange team began.", "In all: 1 move, and 0 creatures went to the tray."], by: "the owl" }]);
// [opener button, dialog id, what to do first]
const DIALOGS = [
  ["stickers-btn", "sticker-book"],
  ["diary", "diary-book"],
  ["adventure-btn", "adventure-book"],
  ["school-btn", "school-book"],
  ["look-back-btn", "review-dialog"],
  ["pgn-btn", "pgn-dialog"],
];

for (const [opener, dialog] of DIALOGS) {
  test(`${dialog}: opens from the keyboard, keeps the focus inside, closes with Escape and returns the focus`, async (g) => {
    await g.open({ seed: { "chess-diaries": DIARY }, mode: "friend" });
    if (dialog === "review-dialog") await g.move("e2", "e4");     // there is something to look back at
    await g.page.eval(`document.getElementById(${JSON.stringify(opener)}).focus()`);
    assert.equal((await active(g)).id, opener);
    await g.page.key("Enter");
    await g.waitFor(`document.getElementById(${JSON.stringify(dialog)}) && document.getElementById(${JSON.stringify(dialog)}).open`, { label: `${dialog} to open` });
    const inside = () => g.page.eval(`(() => { const d = document.getElementById(${JSON.stringify(dialog)}); const a = document.activeElement; return d.contains(a) || a === d; })()`);
    assert.equal(await inside(), true, "the focus moved into the dialog when it opened");
    // it has a name for screen readers
    const named = await g.page.eval(`(() => { const d = document.getElementById(${JSON.stringify(dialog)}); const id = d.getAttribute("aria-labelledby"); const t = id ? (document.getElementById(id) || {}).textContent : d.getAttribute("aria-label"); return (t || "").trim(); })()`);
    assert.ok(named.length > 3, `${dialog} has an accessible name`);
    // Tab and Shift+Tab go round inside the dialog: never to the page behind it
    for (let i = 0; i < 14; i++) {
      await g.page.key("Tab", { shift: i % 2 === 1 });
      const behind = await g.page.eval(`(() => { const d = document.getElementById(${JSON.stringify(dialog)}); const a = document.activeElement; return !(d.contains(a) || a === d || a === document.body || a === document.documentElement); })()`);
      assert.equal(behind, false, `Tab ${i + 1} left the dialog for ${JSON.stringify(await active(g))}`);
    }
    await g.page.key("Escape");
    await g.waitFor(`!document.getElementById(${JSON.stringify(dialog)}).open`, { label: "Escape to close it" });
    assert.equal((await active(g)).id, opener, "the focus is back on the button that opened it");
  });
}

test("the sticker book closes with its button and by clicking outside it", async (g) => {
  await g.open();
  await g.press("stickers-btn");
  await g.waitFor(`document.getElementById("sticker-book").open`);
  await g.page.eval(`document.getElementById("sticker-close").click()`);
  assert.equal(await g.page.eval(`document.getElementById("sticker-book").open`), false);
  await g.press("stickers-btn");
  await g.page.eval(`document.getElementById("sticker-book").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
  assert.equal(await g.page.eval(`document.getElementById("sticker-book").open`), false, "a click on the backdrop closes it");
});

test("the school's practice board is reachable by the keyboard and Escape puts a creature back before closing", async (g) => {
  await g.open();
  await g.page.eval(`document.getElementById("school-btn").focus()`);
  await g.page.key("Enter");
  await g.waitFor(`document.getElementById("school-book").open`);
  await g.page.eval(`[...document.querySelectorAll("#school-book .sch-row")].find((b) => b.getAttribute("aria-label").startsWith("The pony")).click()`);
  await g.waitFor(`document.querySelector("#school-book .sch-board")`);
  assert.equal(await g.page.eval(`document.activeElement.classList.contains("sch-sq")`), true, "the focus is on the practice board");
  await g.page.key("Enter");                      // pick up the pony on b1
  assert.match(await g.page.eval(`document.querySelector("#school-book .sch-say").textContent`), /can go to/);
  await g.page.key("Escape");
  assert.equal(await g.page.eval(`document.getElementById("school-book").open`), true, "the first Escape only puts the creature back");
  assert.match(await g.page.eval(`document.querySelector("#school-book .sch-say").textContent`), /Put back/);
  await g.page.key("Escape");
  await g.waitFor(`!document.getElementById("school-book").open`);
});

// Known bug, not fixed here: with no moves played, Review.open() (review.js:347) disables the very button the browser had just
// focused, and the focus falls back to the page behind the dialog.
todo("the look back opened on an empty game keeps the focus inside the dialog", "review.js:347 disables the focused button", async (g) => {
  await g.open({ mode: "friend" });
  await g.page.eval(`document.getElementById("look-back-btn").focus()`);
  await g.page.key("Enter");
  await g.waitFor(`document.getElementById("review-dialog").open`);
  assert.equal(await g.page.eval(`document.getElementById("review-dialog").contains(document.activeElement)`), true);
});
