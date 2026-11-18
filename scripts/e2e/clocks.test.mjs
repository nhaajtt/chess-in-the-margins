// The clocks: they show, they run for the side to move, the increment adds time, and running out of it ends the game.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();

// The page measures time with performance.now(). To see a one-minute clock run out without waiting a minute,
// make that clock run `factor` times faster. Only the page's own stopwatch is changed; timers and the rest are real.
const speedUp = (g, factor) => g.page.eval(`(() => { const real = performance.now.bind(performance), t0 = real(); performance.now = () => t0 + (real() - t0) * ${factor}; })()`);
const clock = (g, side) => g.text(`#clock-${side} span:not(.is-struck)`);

async function friendWithClock(g, minutes, { increment = false } = {}) {
  await g.open({ mode: "friend" });
  if (increment) await g.page.eval(`document.getElementById("clock-inc").click()`);
  await g.selectRadio("clock", String(minutes));
  await g.settled();
}

test("choosing a time shows two clocks; none hides them", async (g) => {
  await g.open({ mode: "friend" });
  assert.equal(await g.page.eval(`document.getElementById("clocks").hidden`), true);
  await g.selectRadio("clock", "5");
  assert.equal(await g.page.eval(`document.getElementById("clocks").hidden`), false);
  assert.equal(await clock(g, 0), "5:00");
  assert.equal(await clock(g, 1), "5:00");
  await g.selectRadio("clock", "0");
  assert.equal(await g.page.eval(`document.getElementById("clocks").hidden`), true);
});

test("only the side to move uses its time", async (g) => {
  await friendWithClock(g, 1);
  await speedUp(g, 30);
  assert.equal(await g.page.eval(`document.querySelector('.cx-clock[data-side="0"]').classList.contains("is-running")`), true, "orange's clock runs first");
  await g.move("e2", "e4");
  assert.equal(await g.page.eval(`document.querySelector('.cx-clock[data-side="1"]').classList.contains("is-running")`), true, "then purple's");
  // a second of real time is half a minute on the sped-up clock: purple has used it, orange has not
  await g.waitFor(`document.querySelector("#clock-1 span:not(.is-struck)").textContent !== "1:00"`, { label: "purple's clock to run" });
  assert.match(await clock(g, 1), /^0:[0-5]\d$/);
  assert.equal(await clock(g, 0), "1:00", "orange's clock stood still");
});

test("a one-minute game is lost on time", async (g) => {
  await friendWithClock(g, 1);
  await speedUp(g, 30);
  await g.move("e2", "e4");
  await g.waitFor(`Margins.over`, { timeout: 30000, label: "purple to run out of time", probe: `document.getElementById("clock-1").textContent` });
  const s = await g.state();
  assert.equal(s.over.reason, "time");
  assert.equal(s.over.result, "1-0", "purple ran out of time, so orange wins");
  assert.equal(s.status, "Out of time. The orange team wins.");
  assert.equal(await clock(g, 1), "0:00");
  assert.equal(s.cardShown, true);
  const diary = await g.lsJson("chess-diaries");
  assert.ok(diary[0].lines.some((l) => /ran out of time/.test(l)), diary[0].lines.join(" | "));
  await g.illegal("e7", "e5");
});

test("the side that must move first can flag before moving", async (g) => {
  await friendWithClock(g, 1);
  await speedUp(g, 30);
  await g.waitFor(`Margins.over`, { timeout: 30000, label: "orange to run out of time" });
  const s = await g.state();
  assert.equal(s.over.reason, "time");
  assert.equal(s.over.result, "0-1");
  assert.equal(s.status, "Out of time. The purple team wins.");
});

test("the increment gives two seconds back after each move", async (g) => {
  await friendWithClock(g, 1, { increment: true });
  await g.move("e2", "e4");
  // 60 s less the little that passed, plus 2 s, shows as 1:02
  assert.equal(await clock(g, 0), "1:02", "orange got two seconds for e4");
  assert.equal(await clock(g, 1), "1:00");
  await g.move("e7", "e5");
  assert.equal(await clock(g, 1), "1:02", "purple got two seconds for e5");
});

test("without the increment a move gives no time back", async (g) => {
  await friendWithClock(g, 1);
  await g.move("e2", "e4");
  await g.move("e7", "e5");
  assert.match(await clock(g, 0), /^(1:00|0:5\d)$/);
  assert.match(await clock(g, 1), /^(1:00|0:5\d)$/);
});

test("a finished game stops the clocks", async (g) => {
  await friendWithClock(g, 1);
  await speedUp(g, 30);
  await g.press("resign");
  const before = await clock(g, 0);
  await g.page.inPage(700);
  assert.equal(await clock(g, 0), before);
  assert.equal((await g.state()).over.reason, "resigned");
});
