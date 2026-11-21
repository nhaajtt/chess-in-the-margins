/* The page options: which paper to write on, bold ink, and a little buzz on touch devices.
   The saved choices are applied the moment this runs; the controls are built in one small fieldset. */
(function () {
  "use strict";
  const M = window.Margins;
  if (!M) return;
  const root = document.documentElement;
  const canBuzz = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  // buzz patterns in milliseconds: on, off, on, ...
  const PATTERNS = {
    move: [12],
    capture: [18, 40, 18],
    check: [60],
    end: [40, 60, 40, 60, 120]
  };
  // which pattern a move earns; a check beats a capture, a capture beats a plain move
  function patternFor(d) {
    if (!d) return null;
    if (d.check) return PATTERNS.check;
    if (d.move && d.move.captured) return PATTERNS.capture;
    return PATTERNS.move;
  }

  const get = (k, fallback) => { const v = M.store.get(k); return v === null || v === undefined ? fallback : v; };
  let bold = get("chess-bold", "0") === "1";
  let buzz = get("chess-buzz", canBuzz && !M.reduce ? "1" : "0") === "1";

  function applyBold() { root.classList.toggle("bold-ink", bold); }
  applyBold();

  function buzzNow(p) {
    if (!canBuzz || !buzz || !p || M.reduce) return;
    try { navigator.vibrate(p); } catch { /* not allowed right now */ }
  }
  if (canBuzz) {
    M.on("move", (e) => buzzNow(patternFor(e.detail || e)));
    M.on("end", () => buzzNow(PATTERNS.end));
  }

  const PAPERS = [["plain", "plain"], ["lined", "lined"], ["squared", "squared"], ["kraft", "brown kraft"]];
  function build() {
    if (document.getElementById("look-opts")) return;
    const fs = document.createElement("fieldset");
    fs.className = "cx-opts";
    fs.id = "look-opts";
    const lg = document.createElement("legend");
    lg.textContent = "The page";
    fs.append(lg);
    const add = (type, name, value, text, checked, onchange) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = type; if (name) input.name = name; input.value = value; input.checked = checked;
      input.addEventListener("change", () => onchange(input));
      label.append(input, document.createTextNode(text));
      fs.append(label);
    };
    const now = window.Paper ? window.Paper.kind : "plain";
    PAPERS.forEach(([k, t]) => add("radio", "look-paper", k, t, k === now, (i) => {
      if (!i.checked) return;
      if (window.Paper) window.Paper.set(k);
      M.store.set("chess-paper", k);
    }));
    add("checkbox", "", "bold", "bold ink", bold, (i) => { bold = i.checked; M.store.set("chess-bold", bold ? "1" : "0"); applyBold(); });
    if (canBuzz) add("checkbox", "", "buzz", "buzz", buzz, (i) => {
      buzz = i.checked; M.store.set("chess-buzz", buzz ? "1" : "0");
      if (buzz) buzzNow(PATTERNS.move);
    });
    const slot = document.getElementById("look-slot");
    const after = document.getElementById("clock-opts");
    if (slot) slot.append(fs);
    else if (after) after.after(fs);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
