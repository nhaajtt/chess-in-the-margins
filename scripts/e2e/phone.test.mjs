// A phone: 390 x 844 with touch. The page loads, a move can be played with a finger, and every dialog fits the screen.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();
const PHONE = { viewport: [390, 844], mobile: true };

const rectOf = (g, selector) => g.page.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; })()`);

test("the page loads on a phone: nothing sticks out sideways and the whole board is on screen", PHONE, async (g) => {
  await g.open({ mode: "friend" });
  const m = await g.page.eval(`({ w: innerWidth, h: innerHeight, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth })`);
  assert.equal(m.w, 390);
  assert.ok(m.scroll <= 391, `the page is ${m.scroll}px wide on a 390px screen`);
  const first = await rectOf(g, '#squares button[data-sq="112"]');   // a8
  const last = await rectOf(g, '#squares button[data-sq="7"]');      // h1
  assert.ok(first.left >= -1 && last.right <= 391, `the board spans ${first.left}..${last.right}`);
  assert.ok(first.width >= 36, `squares are ${first.width}px wide: big enough for a finger`);
  assert.equal((await g.pieces()).length, 32);
  // the main controls are all there and big enough to press
  for (const id of ["new", "undo", "flip", "resign"]) {
    const r = await rectOf(g, `#${id}`);
    assert.ok(r.width >= 40 && r.height >= 28, `#${id} is ${r.width}x${r.height}`);
    assert.ok(r.right <= 391 && r.left >= -1, `#${id} is on screen`);
  }
});

test("a move can be played with a finger", PHONE, async (g, page) => {
  await g.open({ mode: "friend" });
  const centre = async (sq) => { await page.eval(`document.querySelector('#squares button[data-sq="${sq}"]').scrollIntoView({ block: "center" })`); const r = await rectOf(g, `#squares button[data-sq="${sq}"]`); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const tap = async (name) => { const n = (name.charCodeAt(0) - 97) + (Number(name[1]) - 1) * 16; const [x, y] = await centre(n); await page.tap(x, y); };
  await tap("e2");
  await tap("e4");
  await g.waitFor(`Margins.played().length === 1`, { label: "the tapped move to be played" });
  assert.deepEqual(await g.san(), ["e4"]);
  await tap("e7");
  await tap("e5");
  await g.waitFor(`Margins.played().length === 2`);
  await g.settled();
});

const OPENERS = [["stickers-btn", "sticker-book"], ["adventure-btn", "adventure-book"], ["school-btn", "school-book"], ["look-back-btn", "review-dialog"], ["pgn-btn", "pgn-dialog"]];
for (const [opener, dialog] of OPENERS) {
  test(`${dialog} fits a phone screen`, PHONE, async (g) => {
    await g.open({ mode: "friend" });
    await g.moves([["e2", "e4"], ["e7", "e5"]]);
    await g.page.eval(`document.getElementById(${JSON.stringify(opener)}).click()`);
    await g.waitFor(`document.getElementById(${JSON.stringify(dialog)}) && document.getElementById(${JSON.stringify(dialog)}).open`);
    const r = await rectOf(g, `#${dialog}`);
    assert.ok(r.left >= -1 && r.right <= 391, `${dialog} spans ${r.left}..${r.right} on a 390px screen`);
    assert.ok(r.top >= -1 && r.bottom <= 845, `${dialog} spans ${r.top}..${r.bottom} on an 844px screen`);
    assert.ok(r.width > 200, `${dialog} is ${r.width}px wide`);
    // what is inside does not push the dialog sideways
    const overflow = await g.page.eval(`(() => { const d = document.getElementById(${JSON.stringify(dialog)}); return d.scrollWidth - d.clientWidth; })()`);
    assert.ok(overflow <= 2, `${dialog} scrolls sideways by ${overflow}px`);
  });
}

test("the promotion dialog and the diary fit a phone screen", PHONE, async (g) => {
  await g.open({ mode: "friend", fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1" });
  await g.click("a7");
  await g.click("a8");
  await g.waitFor(`document.getElementById("promo").open`);
  let r = await rectOf(g, "#promo");
  assert.ok(r.left >= -1 && r.right <= 391 && r.bottom <= 845, `the promotion dialog spans ${r.left}..${r.right}`);
  const buttons = await g.page.eval(`[...document.querySelectorAll("#promo-row button")].map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.right, r.width]; })`);
  assert.equal(buttons.length, 4);
  for (const [l, rr, w] of buttons) assert.ok(l >= 0 && rr <= 390 && w >= 40, `a promotion choice is ${w}px wide at ${l}`);
  await g.pickPromotion("queen");
  await g.press("resign");
  await g.press("diary");
  await g.waitFor(`document.getElementById("diary-book").open`);
  r = await rectOf(g, "#diary-book");
  assert.ok(r.left >= -1 && r.right <= 391 && r.top >= -1 && r.bottom <= 845, `the diary spans ${r.left}..${r.right} x ${r.top}..${r.bottom}`);
});

test("the page also works rotated to landscape", { viewport: [844, 390], mobile: true }, async (g) => {
  await g.open({ mode: "friend" });
  assert.equal(await g.page.eval(`innerWidth`), 844);
  assert.ok((await g.page.eval(`document.documentElement.scrollWidth`)) <= 845);
  assert.equal(await g.move("e2", "e4"), "e4");
});
