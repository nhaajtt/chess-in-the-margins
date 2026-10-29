/* After dark you play by torchlight: the room goes dark, a big torch clicks on in the corner of the screen, and a
   warm pool of light falls on what matters (the chess board, or wherever the pointer is on the lab page). The rest
   of the page stays in the dark. Shared by the chess game and the lab. */
(function (root) {
  "use strict";
  const M = 40;
  const T = { on: false, k: 0, dark: 0, shade: null, lit: null, timer: 0, o: null, px: null, py: null };

  function build() {
    const o = T.o;
    if (o.lit) {
      const lit = document.createElement("div");
      lit.className = "torch-lit";
      lit.setAttribute("aria-hidden", "true");
      o.lit.before.before(lit);
      T.lit = lit;
    }
    const shade = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    shade.setAttribute("class", "torch-shade");
    shade.setAttribute("aria-hidden", "true");
    // the dark is a sheet with a hole: the mask is white where it is dark, black where the light falls, grey in the beam
    shade.innerHTML = `<defs>
      <radialGradient id="torch-spot"><stop offset="0.55" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
      <linearGradient id="torch-cone" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6a6a6a"/><stop offset="1" stop-color="#a0a0a0"/></linearGradient>
      <mask id="torch-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="99999" height="99999">
        <rect class="torch-all" x="0" y="0" fill="#fff"/><path class="torch-cone" fill="url(#torch-cone)"/><ellipse class="torch-spot" fill="url(#torch-spot)"/>
      </mask></defs>
      <rect class="torch-dark" x="0" y="0" fill="#060914" mask="url(#torch-mask)" opacity="0"/>
      <path class="torch-haze" fill="rgba(255, 228, 160, 0.06)"/>
      <g class="torch-body" opacity="0">
        <path d="M-236 -21 Q-242 0 -236 21 L-74 23 Q-69 0 -74 -23 Z" fill="#e8902a" stroke="#191b22" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M-214 -20 Q-212 0 -214 20 M-198 -21 Q-196 0 -198 21 M-182 -21 Q-180 0 -182 21" fill="none" stroke="#b5651d" stroke-width="3" stroke-linecap="round"/>
        <path d="M-138 -23 L-136 -33 L-112 -33 L-110 -23" fill="#c8452e" stroke="#191b22" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-76 -24 L-8 -44 Q3 0 -8 44 L-76 24 Z" fill="#cdd2dc" stroke="#191b22" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M-56 -28 L-56 28" stroke="#9aa1b0" stroke-width="3"/>
        <path d="M-6 -41 Q5 0 -6 41" fill="none" stroke="#ffe7a6" stroke-width="7" stroke-linecap="round"/>
      </g>`;
    document.body.append(shade);
    T.shade = shade;
    const relayout = () => { if (T.on || T.k) requestAnimationFrame(layout); };
    addEventListener("scroll", relayout, { passive: true });
    addEventListener("resize", relayout);
    if (o.follow) {
      // the light follows the pointer (on a touch screen, the last touch)
      addEventListener("pointermove", (e) => { T.px = e.clientX; T.py = e.clientY; relayout(); }, { passive: true });
      addEventListener("pointerdown", (e) => { T.px = e.clientX; T.py = e.clientY; relayout(); }, { passive: true });
    }
  }
  // where the light, the beam and the torch go right now
  function layout() {
    const { shade, lit, o } = T;
    if (!shade) return;
    const vw = innerWidth, vh = innerHeight;
    let cx, cy, rx, ry;
    if (o.follow) {
      const r = Math.min(340, Math.max(170, vw * 0.24));
      cx = (T.px ?? vw * 0.55) + M; cy = (T.py ?? vh * 0.45) + M; rx = r * 1.15 * T.k; ry = r * T.k;
    } else {
      const r = o.target();
      if (!r) return;
      cx = r.left + r.width / 2 + M; cy = r.top + r.height / 2 + M;
      rx = r.width * 0.9 * T.k; ry = r.height * (vw < 900 ? 0.8 : 0.9) * T.k;
    }
    // the warm, lit paper under the target, placed by the page; first, while the page's layout is still
    // fresh from measuring the target, so the writes below do not make it work the layout out again
    if (lit) { o.lit.place(lit, rx, ry); lit.style.opacity = String(Math.min(1, T.k * 1.2)); }
    const q = (s) => shade.querySelector(s);
    ["torch-all", "torch-dark"].forEach((c) => { const e = q("." + c); e.setAttribute("width", vw + M * 2); e.setAttribute("height", vh + M * 2); });
    const spot = q(".torch-spot");
    spot.setAttribute("cx", cx); spot.setAttribute("cy", cy); spot.setAttribute("rx", Math.max(1, rx)); spot.setAttribute("ry", Math.max(1, ry));
    q(".torch-dark").setAttribute("opacity", T.dark);
    // the torch is held at the bottom corner of the screen, pointing at the light
    const narrow = vw < 900, k = narrow ? 0.55 : Math.min(0.85, vw / 1700 + 0.1);
    const hx = (narrow ? 70 : Math.min(190, vw * 0.11)) + M, hy = vh - (narrow ? 34 : 110) + M;
    const a = Math.atan2(cy - hy, cx - hx), nx = -Math.sin(a), ny = Math.cos(a);
    const g = q(".torch-body");
    g.setAttribute("transform", `translate(${hx.toFixed(1)} ${hy.toFixed(1)}) rotate(${(a * 180 / Math.PI).toFixed(1)}) scale(${k.toFixed(2)})`);
    g.setAttribute("opacity", Math.min(1, T.dark * 1.6));
    // the beam: from the edge of the lens to either side of the pool of light
    const w0 = 40 * k, w1 = (rx + ry) / 2 * 0.8;
    const d = T.k > 0.05 ? `M${hx + nx * w0} ${hy + ny * w0} L${cx + nx * w1} ${cy + ny * w1} L${cx - nx * w1} ${cy - ny * w1} L${hx - nx * w0} ${hy - ny * w0} Z` : "";
    q(".torch-cone").setAttribute("d", d);
    q(".torch-haze").setAttribute("d", d);
    const cg = shade.querySelector("#torch-cone");
    cg.setAttribute("x1", hx); cg.setAttribute("y1", hy); cg.setAttribute("x2", cx); cg.setAttribute("y2", cy);
  }
  function set(on) {
    const o = T.o;
    if (!o || on === T.on) return;
    T.on = on;
    if (!T.shade) { if (!on) return; build(); }
    const G = o.gsap, anim = o.anim && G;
    document.body.classList.toggle("is-torch", on);
    clearInterval(T.timer);
    if (G) G.killTweensOf(T);
    T.shade.style.display = "";
    if (on) {
      // what it lights can move (the camera follows the fights), so the light keeps checking where it is
      if (!o.follow) T.timer = setInterval(layout, 400);
      if (!anim) { T.dark = o.dark || 0.68; T.k = 1; layout(); return; }
      // the room goes dark, then click: the torch comes on and the pool of light opens up
      G.timeline({ onUpdate: layout })
        .to(T, { dark: o.dark || 0.68, duration: 0.9, ease: "power1.inOut" })
        .call(() => { if (o.sfx) o.sfx("torch"); })
        .to(T, { k: 1, duration: 0.6, ease: "back.out(1.6)" });
    } else {
      const gone = () => { layout(); if (!T.on) T.shade.style.display = "none"; };
      if (!anim) { T.dark = 0; T.k = 0; gone(); return; }
      G.to(T, { dark: 0, k: 0, duration: 0.8, ease: "power1.inOut", onUpdate: layout, onComplete: gone });
    }
  }
  root.Torch = { init(o) { T.o = o; }, set, layout };
})(window);
