/* Hands the computer's thinking to a worker so the page stays smooth. Loaded after game.js.
   If anything goes wrong the promise rejects and the game thinks on the main thread instead. */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof Worker === "undefined") return;
  let worker = null, next = 1;
  const waiting = new Map();

  function drop(err) {
    for (const w of waiting.values()) { clearTimeout(w.timer); w.reject(err); }
    waiting.clear();
    if (worker) { worker.terminate(); worker = null; }
  }
  function open() {
    if (worker) return worker;
    worker = new Worker("/engine-worker.js");
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      clearTimeout(w.timer);
      if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data);
    };
    worker.onerror = () => drop(new Error("the thinking worker failed"));
    return worker;
  }
  function ask(job, limit) {
    return new Promise((resolve, reject) => {
      const id = next++;
      try { open().postMessage({ ...job, id }); } catch (err) { drop(err); reject(err); return; }
      // a search that never answers would freeze the opponent: give up and start a fresh worker next time
      const timer = setTimeout(() => drop(new Error("the thinking worker took too long")), limit);
      waiting.set(id, { resolve, reject, timer });
    });
  }

  const thinkFor = (fen, level, style) => ask({ fen, level, style }, 6000).then((r) => {
    if (!r.move) throw new Error("no move");
    return r.move;
  });
  const analyse = (fen, opts = {}) => ask({ fen, analyse: true, ms: opts.ms }, 6000 + (opts.ms || 0)).then((r) => ({ move: r.move, score: r.score, depth: r.depth }));

  window.Thinker = { analyse };
  if (window.Margins && typeof window.Margins.setThinker === "function") window.Margins.setThinker(thinkFor);
})();
