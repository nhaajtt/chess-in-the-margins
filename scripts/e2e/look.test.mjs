// The look of the page: the four kinds of paper and bold ink, and that the choice is remembered.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();

const KINDS = ["plain", "lined", "squared", "kraft"];
// plain is already chosen when the page opens, so it is picked last (choosing what is chosen changes nothing)
const ORDER = ["lined", "squared", "kraft", "plain"];
const paperImage = (g) => g.page.eval(`document.documentElement.style.getPropertyValue("--paper-img")`);
const ink = (g) => g.page.eval(`getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()`);

test("the page options are there: four papers, bold ink, plain paper chosen", async (g) => {
  await g.open();
  const radios = await g.page.eval(`[...document.querySelectorAll('input[name="look-paper"]')].map((r) => [r.value, r.checked])`);
  assert.deepEqual(radios, [["plain", true], ["lined", false], ["squared", false], ["kraft", false]]);
  assert.equal(await g.page.eval(`[...document.querySelectorAll("#look-opts label")].some((l) => /bold ink/.test(l.textContent))`), true);
  assert.equal(await g.page.eval(`Paper.kind`), "plain");
});

test("each paper kind is applied, drawn differently and stored", async (g) => {
  await g.open();
  const seen = new Map();
  for (const kind of ORDER) {
    await g.page.eval(`document.querySelector('input[name="look-paper"][value="${kind}"]').click()`);
    assert.equal(await g.page.eval(`Paper.kind`), kind);
    assert.equal(await g.ls("chess-paper"), kind);
    assert.equal(await g.page.eval(`document.documentElement.classList.contains("paper-kraft")`), kind === "kraft", `${kind}: the kraft class`);
    const img = await paperImage(g);
    assert.match(img, /^url\("data:image\/jpeg;base64,/, `${kind}: a paper picture is set`);
    seen.set(kind, img);
  }
  assert.equal(new Set(seen.values()).size, 4, "the four papers look different from each other");
});

test("bold ink changes the colours, and turning it off puts them back", async (g) => {
  await g.open();
  const before = await ink(g);
  const toggle = () => g.page.eval(`[...document.querySelectorAll("#look-opts label")].find((l) => /bold ink/.test(l.textContent)).querySelector("input").click()`);
  await toggle();
  assert.equal(await g.page.eval(`document.documentElement.classList.contains("bold-ink")`), true);
  assert.equal(await g.ls("chess-bold"), "1");
  assert.equal(await ink(g), "#14161d");
  assert.notEqual(await ink(g), before);
  await toggle();
  assert.equal(await g.page.eval(`document.documentElement.classList.contains("bold-ink")`), false);
  assert.equal(await g.ls("chess-bold"), "0");
  assert.equal(await ink(g), before);
});

test("the paper and bold ink are remembered across a reload", async (g) => {
  await g.open();
  await g.page.eval(`document.querySelector('input[name="look-paper"][value="kraft"]').click()`);
  await g.page.eval(`[...document.querySelectorAll("#look-opts label")].find((l) => /bold ink/.test(l.textContent)).querySelector("input").click()`);
  await g.page.reload();
  await g.ready();
  assert.equal(await g.page.eval(`Paper.kind`), "kraft");
  assert.equal(await g.page.eval(`document.querySelector('input[name="look-paper"]:checked').value`), "kraft");
  assert.equal(await g.page.eval(`document.documentElement.classList.contains("paper-kraft")`), true);
  assert.equal(await g.page.eval(`document.documentElement.classList.contains("bold-ink")`), true);
  assert.equal(await g.page.eval(`[...document.querySelectorAll("#look-opts label")].find((l) => /bold ink/.test(l.textContent)).querySelector("input").checked`), true);
  assert.match(await paperImage(g), /^url\("data:image\/jpeg/, "the paper is painted again");
});

test("each paper is remembered on its own", async (g) => {
  for (const kind of KINDS) {
    await g.open({ seed: { "chess-paper": kind } });
    assert.equal(await g.page.eval(`Paper.kind`), kind);
    assert.equal(await g.page.eval(`document.querySelector('input[name="look-paper"]:checked').value`), kind);
  }
});

test("a saved value that makes no sense falls back to plain paper and normal ink", async (g) => {
  await g.open({ seed: { "chess-paper": "wood", "chess-bold": "maybe" } });
  assert.equal(await g.page.eval(`Paper.kind`), "plain");
  assert.equal(await g.page.eval(`document.documentElement.classList.contains("bold-ink")`), false);
});

test("the look is applied before the board is drawn (no flash of the wrong paper)", async (g) => {
  await g.open({ seed: { "chess-paper": "squared" } });
  assert.match(await paperImage(g), /^url\(/);
  assert.equal(await g.page.eval(`Paper.kind`), "squared");
});
