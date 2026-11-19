// Small guards: things that must not happen twice, or late, or against the wrong game.
// Page-side stand-ins for the network (a fake WebSocket and a fake fetch) keep these off the rooms service.
import { e2e, assert } from "./harness.mjs";

const { test } = e2e();

// a WebSocket that never connects but remembers who asked, and a fetch that answers the rooms service slowly
const FAKE_NET = `(() => {
  window.__sockets = [];
  window.WebSocket = class { constructor(url) { this.url = url; this.readyState = 0; window.__sockets.push(this); } send() {} close() {} };
  window.__roomCalls = 0;
  const real = window.fetch.bind(window);
  window.fetch = (url, opts) => {
    if (String(url).endsWith("/rooms") && opts && opts.method === "POST") {
      window.__roomCalls++;
      return new Promise((ok) => setTimeout(() => ok({ ok: true, status: 201, json: async () => ({ code: "ABCDEF" }) }), 300));
    }
    return real(url, opts);
  };
})()`;

test("a page load makes no GSAP call on an empty list of targets", async (g, page) => {
  await g.open({ motion: true });
  await g.page.inPage(1500);
  assert.equal(page.warningsCounted.gsapTargetMissing, 0, "no 'GSAP target not found' warning while the page loads");
});

test("changing the mode while the board is busy still starts a new game in the new mode", async (g) => {
  await g.open({ motion: true, mode: "friend" });
  await g.move("e2", "e4");
  await g.settled();
  await g.press("flip");
  assert.equal(await g.page.eval(`Margins.busy`), true, "the board is turning");
  await g.selectRadio("mode", "cpu");
  await g.waitFor(`Margins.mode === "cpu" && Margins.played().length === 0 && !Margins.busy`, { label: "a fresh board under the new mode", probe: `Margins.played().length`, timeout: 15000 });
});

test("a finished game's replay does not fire in the next game", async (g) => {
  await g.open({ motion: true, mode: "friend" });
  await g.moves([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
  await g.waitFor(`Margins.over`, { label: "the mate" });
  // start another game and make a move at once; the old replay is due about two and a half seconds after the mate
  await g.page.eval(`(() => {
    document.getElementById("new").click();
    const b = (n) => document.querySelector('#squares button[data-sq="' + n + '"]');
    b(0x14).click(); b(0x34).click();
  })()`);
  await g.page.inPage(3600);
  assert.equal(await g.page.eval(`document.querySelectorAll(".cx-replay").length`), 0, "no REPLAY banner over the new game");
});

test("the opening can be started once, not twice by a double click", async (g) => {
  await g.open({ motion: true });
  await g.page.eval(`(() => {
    window.__scenes = 0;
    const play = Sound.play;
    Sound.play = function (name, ...a) { if (name === "scene") window.__scenes++; return play.call(this, name, ...a); };
    const b = document.getElementById("again"); b.click(); b.click();
  })()`);
  await g.page.inPage(1200);
  assert.equal(await g.page.eval(`window.__scenes`), 1, "one story, one first scene");
  await g.page.eval(`document.getElementById("intro-skip").click()`);
});

test("two quick clicks on 'Open a room' ask for one room", async (g) => {
  await g.open();
  await g.page.eval(FAKE_NET);
  await g.page.eval(`(() => { const b = document.getElementById("room-create"); b.click(); b.click(); })()`);
  await g.page.inPage(700);
  assert.equal(await g.page.eval(`window.__roomCalls`), 1);
  assert.equal(await g.page.eval(`window.__sockets.length`), 1);
  // and once the first answer is in, the button works again
  await g.page.eval(`document.getElementById("room-create").click()`);
  await g.page.inPage(100);
  assert.equal(await g.page.eval(`window.__roomCalls`), 2);
  await g.page.inPage(500);
});

test("a room that says it has expired is not reconnected; an ordinary drop still is", async (g) => {
  await g.open();
  await g.page.eval(FAKE_NET);
  await g.page.eval(`Margins.enterRoom("ABCDEF")`);
  assert.equal(await g.page.eval(`window.__sockets.length`), 1);
  // an ordinary drop: the message and a second try after about a second
  await g.page.eval(`window.__sockets[0].onclose({ code: 1006, reason: "" })`);
  assert.equal(await g.text("#online-msg"), "Lost the connection. Reconnecting…");
  await g.waitFor(`window.__sockets.length === 2`, { label: "the second try", timeout: 5000 });
  // the room itself says it is gone
  await g.page.eval(`window.__sockets[1].onclose({ code: 1000, reason: "room expired" })`);
  assert.equal(await g.text("#online-msg"), "This room has expired. Make a new one.");
  await g.page.inPage(2600);
  assert.equal(await g.page.eval(`window.__sockets.length`), 2, "no third try");
});
