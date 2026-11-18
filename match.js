// "Play someone now": asks the rooms service for a room with a stranger in it.
// It only talks to the service and hands back a room code; the page opens the room itself.
(function () {
  "use strict";
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8787" : "https://chess-rooms.chess-rooms.workers.dev";
  const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
  const TIMEOUT = 10000; // ms before giving up on the service

  // find({ signal }) -> { code, waiting }
  // waiting is true when you opened the room and a stranger will join, false when you are joining one that waits
  async function find({ signal } = {}) {
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    const timer = setTimeout(stop, TIMEOUT);
    if (signal) { if (signal.aborted) stop(); else signal.addEventListener("abort", stop, { once: true }); }
    let res;
    try {
      res = await fetch(`${API}/match`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: ctl.signal, credentials: "omit" });
    } catch {
      if (signal && signal.aborted) throw new Error("Search cancelled.");
      throw new Error(navigator.onLine === false ? "You look offline. Check your connection and try again." : "Could not reach the game service. Try again in a moment.");
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", stop);
    }
    if (res.status === 429) throw new Error("Too many tries. Wait a minute and try again.");
    if (!res.ok) throw new Error(res.status === 503 ? "No room is free right now. Try again in a moment." : "Could not find a game. Try again in a moment.");
    let data = null;
    try { data = await res.json(); } catch { /* handled below */ }
    const code = data && typeof data.code === "string" ? data.code.toUpperCase() : "";
    if (!CODE_RE.test(code)) throw new Error("The game service gave an odd answer. Try again.");
    return { code, waiting: data.waiting === true };
  }

  window.Matchmaker = { find };
})();
