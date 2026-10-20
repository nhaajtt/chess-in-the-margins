/* The slingshot: the volume control, and a toy. Pull the pebble back to the left and let go: it flies along the
   ruler, and where it lands is how loud everything is. On a wide screen, pull it the other way and it flies at the
   creatures instead, loaded with whatever is in the pouch (a pebble, an acorn, a paper ball, a water balloon, a
   tomato, a rubber duck). Hit them too often and they get their own back: the biggest one stomps the slingshot
   flat, the whole team piles on, or the wizard zaps it to a crisp. Then the pencil draws a new one.
   Shared by the chess game and the lab; each page tells it who its creatures are (see mount()). */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (l) => l[Math.floor(Math.random() * l.length)];
  const el = (t, a = {}, kids = "") => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (kids) e.innerHTML = kids; return e; };
  const INK = "#2b2f3a";

  /* ---------- what goes in the pouch ---------- */
  const AMMO = {
    pebble: `<circle r="8" fill="#9b968c" stroke="${INK}" stroke-width="2"/><path d="M-3 -4 q2 -1 4 0" stroke="#d6d2c8" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    acorn: `<ellipse cx="0" cy="2.5" rx="6.5" ry="8" fill="#c8843c" stroke="${INK}" stroke-width="2"/><path d="M-8.5 -2 Q0 -12 8.5 -2 Q0 1 -8.5 -2 Z" fill="#7a4a1c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M0 -8 L1.5 -12.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
    paper: `<path d="M-8 -2 L-5 -8 L1 -7 L7 -6 L8 0 L6 7 L-1 8 L-7 5 Z" fill="#fbf8ef" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M-4 -3 L2 1 L5 -3 M-3 4 L1 1" stroke="#9aa0ad" stroke-width="1.2" fill="none"/>`,
    balloon: `<ellipse rx="7.5" ry="9" fill="#5aa0e8" stroke="${INK}" stroke-width="2"/><path d="M-1.5 9 L1.5 9 L0 11.5 Z" fill="#5aa0e8" stroke="${INK}" stroke-width="1.5"/><path d="M-3 -4 q1 -3 4 -3" stroke="#d9ecff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    tomato: `<circle r="8" fill="#e8432e" stroke="${INK}" stroke-width="2"/><path d="M0 -8 l-4 -3 M0 -8 l4 -3 M0 -8 l0 -4" stroke="#3d7a33" stroke-width="2.2" stroke-linecap="round"/><path d="M-3.5 -3 q1 -2 3 -2" stroke="#ffb3a6" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    duck: `<ellipse cx="-1" cy="3" rx="8.5" ry="6" fill="#f6c84a" stroke="${INK}" stroke-width="2"/><circle cx="3.5" cy="-4.5" r="4.5" fill="#f6c84a" stroke="${INK}" stroke-width="2"/><path d="M7.5 -5 L11.5 -3.5 L7.5 -2.5" fill="#e8902a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="4.5" cy="-5.5" r="0.9" fill="${INK}"/>`,
  };
  const AMMO_NAMES = Object.keys(AMMO);
  const SPLAT = { tomato: "#e8432e", balloon: "#5aa0e8" };
  const OUCH = ["HEY!", "OI!", "OW!", "RUDE!", "WHO DID THAT?", "HMPH!"];

  /* ---------- a layer over the whole window for anything that flies between the slingshot and the page ---------- */
  let fx = null;
  function fxLayer() {
    if (fx) return fx;
    fx = el("svg", { class: "sl-fx", "aria-hidden": "true" });
    document.body.append(fx);
    const fit = () => fx.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    fit();
    addEventListener("resize", fit);
    return fx;
  }
  function wordAt(x, y, text, color = "#e8432e", G) {
    const t = el("text", { x, y, class: "sl-word", fill: color, "text-anchor": "middle" });
    t.textContent = text;
    fxLayer().append(t);
    if (!G) { setTimeout(() => t.remove(), 900); return; }
    G.timeline({ onComplete: () => t.remove() })
      .fromTo(t, { scale: 0.3, rotation: R(-12, 12), transformOrigin: "50% 50%" }, { scale: 1, duration: 0.25, ease: "back.out(3)" })
      .to(t, { y: -26, opacity: 0, duration: 0.6, delay: 0.5 });
  }

  function mount(holder, o) {
    const G = o.gsap, anim = Boolean(o.anim && G), SND = o.sound, sfx = o.sfx;
    const X0 = 92, X1 = 306, GY = 94, REST = { x: 40, y: 54 }, PULL = 38, L = { x: 27, y: 46 }, Rt = { x: 53, y: 46 };
    const xOf = (v) => X0 + v * (X1 - X0);
    const ticks = Array.from({ length: 11 }, (_, i) => `M${xOf(i / 10).toFixed(1)} ${GY - (i % 5 ? 3 : 6)} L${xOf(i / 10).toFixed(1)} ${GY + 3}`).join(" ");
    holder.classList.add("sl");
    holder.innerHTML = `<svg class="sl__svg" viewBox="0 0 320 116" aria-hidden="true">
      <text class="sl__lab" x="2" y="14" fill="#5d6170">${o.label || "volume: pull the pebble back, let go"}</text>
      <path d="M78 ${GY} Q150 ${GY - 2} 210 ${GY + 1} T316 ${GY - 1}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="${ticks}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
      <text class="sl__lab" x="${X0}" y="112" fill="#5d6170" text-anchor="middle">shh</text>
      <text class="sl__lab" x="${X1}" y="112" fill="#c8452e" text-anchor="middle">LOUD</text>
      <path class="sl__trail" fill="none" stroke="#3c4fb8" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>
      <path class="sl__mark" fill="none" stroke="#3c4fb8" stroke-width="2.5" stroke-linecap="round"/>
      <g class="sl__flag">
        <path d="M0 2 L0 -34" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M0 -34 L22 -28 L0 -21 Z" fill="#e8432e" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
        <text class="sl__pct" x="4" y="-39" fill="${INK}"></text>
      </g>
      <g class="sl__frame">
        <path class="sl__band sl__band--back" fill="none" stroke="#6b4423" stroke-width="3.2" stroke-linecap="round"/>
        <g class="sl__wood">
          <path class="sl__stick sl__stick--l" pathLength="1" d="M40 112 L40 76 Q30 66 27 46" fill="none" stroke="#8a5a2b" stroke-width="6" stroke-linecap="round"/>
          <path class="sl__stick sl__stick--r" pathLength="1" d="M40 78 Q50 66 53 46" fill="none" stroke="#8a5a2b" stroke-width="6" stroke-linecap="round"/>
          <path d="M38 110 L38 80 M37 72 Q30 62 28 50" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
        </g>
        <g class="sl__ammo"></g>
        <path class="sl__band sl__band--front" fill="none" stroke="#6b4423" stroke-width="3.2" stroke-linecap="round"/>
      </g>
      <rect class="sl__grab" x="0" y="20" width="92" height="96" fill="transparent"/>
    </svg>`;
    const help = document.createElement("span");
    help.className = "sl-hidden";
    help.id = `sl-help-${Math.random().toString(36).slice(2, 7)}`;
    help.textContent = "Arrow keys set the volume." + (anim ? " On a wide screen, Enter throws at the next creature." : "");
    const live = document.createElement("span");
    live.className = "sl-hidden";
    live.setAttribute("aria-live", "polite");
    holder.append(help, live);
    holder.setAttribute("aria-describedby", help.id);
    const tell = (t) => { live.textContent = ""; setTimeout(() => { live.textContent = t; }, 50); };
    const svg = holder.firstElementChild, q = (s) => svg.querySelector(s);
    const ammoG = q(".sl__ammo"), back = q(".sl__band--back"), front = q(".sl__band--front"), frame = q(".sl__frame"), wood = q(".sl__wood");
    const trail = q(".sl__trail"), mark = q(".sl__mark"), flag = q(".sl__flag"), pct = q(".sl__pct"), grab = q(".sl__grab");
    const at = { x: REST.x, y: REST.y };
    let loaded = "pebble", broken = false, inFlight = false;
    const load = (name) => { loaded = name; ammoG.innerHTML = AMMO[name]; draw(); };
    const draw = () => {
      ammoG.setAttribute("transform", `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
      const held = !inFlight;
      const p = held ? at : REST;
      back.setAttribute("d", `M${L.x} ${L.y} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
      front.setAttribute("d", `M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${Rt.x} ${Rt.y}`);
    };
    const toView = (x, y) => { const m = svg.getScreenCTM(); const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const r = pt.matrixTransform(m); return [r.x, r.y]; };
    const toSvg = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    const arc = (v) => { const tx = xOf(v), top = GY - 46 - v * 34; return { tx, cx: (REST.x + tx) / 2, cy: top * 2 - (REST.y + GY) / 2 }; };
    const vol = () => (SND.volume ?? 0.7);
    const paintFlag = (v, move = true) => {
      pct.textContent = Math.round(v * 100);
      holder.setAttribute("aria-valuenow", String(Math.round(v * 100)));
      holder.setAttribute("aria-valuetext", v ? `${Math.round(v * 100)} percent` : "silent");
      holder.classList.toggle("is-muted", !SND.on || !v);
      if (move) flag.setAttribute("transform", `translate(${xOf(v).toFixed(1)} ${GY})`);
    };
    holder.setAttribute("role", "slider");
    holder.setAttribute("tabindex", "0");
    holder.setAttribute("aria-label", "Volume");
    holder.setAttribute("aria-valuemin", "0");
    holder.setAttribute("aria-valuemax", "100");
    load("pebble");
    paintFlag(vol());
    const reload = () => {
      at.x = REST.x; at.y = REST.y; inFlight = false;
      load(pick(AMMO_NAMES.filter((n) => n !== loaded)));
      if (anim) G.fromTo(ammoG, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" });
    };

    /* ---------- shooting along the ruler: the volume ---------- */
    const landed = (v) => {
      if (!SND.on && v > 0) { SND.set(true); if (o.paintSound) o.paintSound(); }
      if (SND.setVolume) SND.setVolume(v);
      sfx("ammo", loaded);
      paintFlag(v, !anim);
      if (!anim) { reload(); return; }
      const fxp = { x: Number((flag.getAttribute("transform") || "").match(/translate\(([\d.]+)/)?.[1] || xOf(v)) };
      G.timeline()
        .to(fxp, { x: xOf(v), duration: 0.45, ease: "power2.inOut", onUpdate: () => flag.setAttribute("transform", `translate(${fxp.x.toFixed(1)} ${GY}) rotate(${Math.sin(fxp.x / 4) * 8})`) })
        .call(() => flag.setAttribute("transform", `translate(${xOf(v).toFixed(1)} ${GY})`));
      G.timeline().to(ammoG, { opacity: 0, duration: 0.3, delay: 0.5 }).call(reload);
    };
    const shootVolume = (v) => {
      v = Math.max(0, Math.min(1, v));
      trail.setAttribute("d", ""); mark.setAttribute("d", "");
      if (!anim || v === 0) { landed(v); return; }
      sfx("twang", v);
      const a = arc(v), from = { x: at.x, y: at.y }, t = { u: 0 };
      inFlight = true;
      G.to(t, { u: 1, duration: 0.45 + v * 0.35, ease: "none", onUpdate: () => {
        const u = t.u, s = 1 - u;
        at.x = s * s * from.x + 2 * s * u * a.cx + u * u * a.tx;
        at.y = s * s * from.y + 2 * s * u * a.cy + u * u * (GY - 7);
        draw();
      }, onComplete: () => landed(v) });
    };

    /* ---------- shooting at the creatures ---------- */
    const world = () => anim && innerWidth >= 900 && (!o.world || o.world());
    const aimAt = (dx, dy, power) => {
      const [sx, sy] = toView(REST.x, REST.y), len = Math.hypot(dx, dy) || 1;
      const range = o.range ? o.range() : 700, d = power * range;
      return { sx, sy, tx: sx - (dx / len) * d, ty: sy - (dy / len) * d, d };
    };
    const curve = (a) => { const lift = Math.min(170, a.d * 0.32); return { cx: (a.sx + a.tx) / 2, cy: (a.sy + a.ty) / 2 - lift }; };
    let aimPath = null, aimX = null;
    const showAim = (a) => {
      const f = fxLayer();
      if (!aimPath) { aimPath = el("path", { class: "sl-aim", fill: "none", stroke: "#3c4fb8", "stroke-width": 2, "stroke-dasharray": "2 7", "stroke-linecap": "round" }); aimX = el("path", { class: "sl-aim", fill: "none", stroke: "#3c4fb8", "stroke-width": 2.5, "stroke-linecap": "round" }); f.append(aimPath, aimX); }
      if (!a) { aimPath.setAttribute("d", ""); aimX.setAttribute("d", ""); return; }
      const c = curve(a);
      aimPath.setAttribute("d", `M${a.sx} ${a.sy} Q${c.cx} ${c.cy} ${a.tx} ${a.ty}`);
      aimX.setAttribute("d", `M${a.tx - 7} ${a.ty - 7} L${a.tx + 7} ${a.ty + 7} M${a.tx + 7} ${a.ty - 7} L${a.tx - 7} ${a.ty + 7}`);
    };
    const hits = [];
    let revengeNo = 0, avenging = false;
    const shootWorld = (a) => {
      showAim(null);
      sfx("twang", Math.min(1, a.d / 700));
      inFlight = true;
      at.x = REST.x; at.y = REST.y; draw();
      ammoG.setAttribute("opacity", "0");
      const name = loaded, g = el("g", { class: "sl-shot" }, AMMO[name]);
      fxLayer().append(g);
      const c = curve(a), t = { u: 0 }, spin = R(-720, 720);
      G.to(t, { u: 1, duration: 0.35 + a.d / 1500, ease: "none", onUpdate: () => {
        const u = t.u, s = 1 - u;
        const x = s * s * a.sx + 2 * s * u * c.cx + u * u * a.tx, y = s * s * a.sy + 2 * s * u * c.cy + u * u * a.ty;
        g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(spin * u).toFixed(0)}) scale(${(1.3 + Math.sin(u * Math.PI) * 0.5).toFixed(2)})`);
      }, onComplete: () => { impact(name, a.tx, a.ty, g); G.delayedCall(0.4, () => { ammoG.removeAttribute("opacity"); reload(); }); } });
    };
    // where it lands: a splash, a splat or a bump, and whoever it hit is not amused
    function impact(name, x, y, g) {
      sfx("ammo", name);
      const f = fxLayer();
      if (SPLAT[name]) {
        g.remove();
        const blob = el("g", { class: "sl-splat" });
        for (let i = 0; i < 9; i++) blob.append(el("circle", { cx: x, cy: y, r: R(2, 5), fill: SPLAT[name] }));
        blob.prepend(el("ellipse", { cx: x, cy: y, rx: 13, ry: 9, fill: SPLAT[name], opacity: 0.85 }));
        f.append(blob);
        [...blob.children].slice(1).forEach((d) => G.to(d, { attr: { cx: x + R(-34, 34), cy: y + R(-30, 14) }, duration: 0.35, ease: "power2.out" }));
        G.to(blob, { opacity: 0, duration: 0.8, delay: 1, onComplete: () => blob.remove() });
      } else {
        // it bounces off and rolls to a stop
        const b = { k: 0 }, dir = Math.random() < 0.5 ? -1 : 1;
        G.timeline({ onComplete: () => g.remove() })
          .to(b, { k: 1, duration: 0.5, ease: "power1.out", onUpdate: () => g.setAttribute("transform", `translate(${(x + dir * b.k * 22).toFixed(1)} ${(y - Math.sin(b.k * Math.PI) * 18).toFixed(1)}) rotate(${(dir * b.k * 300).toFixed(0)}) scale(1.3)`) })
          .to(g, { opacity: 0, duration: 0.4, delay: 0.5 });
      }
      const victim = (o.targets ? o.targets() : []).map((t) => ({ t, r: t.rect() })).filter(({ r }) => r && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8)
        .sort((a, b) => Math.hypot(a.r.left + a.r.width / 2 - x, a.r.top + a.r.height / 2 - y) - Math.hypot(b.r.left + b.r.width / 2 - x, b.r.top + b.r.height / 2 - y))[0];
      if (!victim) { tell("Missed. It landed on the paper."); return; }
      const v = victim.t;
      tell(`Hit the ${v.name || "creature"}${name === "duck" ? " with a rubber duck" : ""}. It is cross.`);
      if (o.onHit) o.onHit(v, name);
      sfx("ouch", v.kind, v.side);
      wordAt(x, victim.r.top - 6, name === "duck" ? "QUACK?!" : name === "balloon" ? "SPLOSH!" : pick(OUCH), v.side ? "#3c4fb8" : "#e8432e", G);
      if (v.c) { CR().setFace(v.c, "hurt", v.c.spec.face.beak ? "open" : "frown"); }
      if (v.cross) v.cross(true);
      if (v.act) G.timeline().to(v.act, { x: 5, duration: 0.05, yoyo: true, repeat: 9 }).to(v.act, { x: 0, duration: 0.05 });
      G.delayedCall(0.6, () => { sfx("emote", "grr", v.side); });
      G.delayedCall(2, () => { if (v.cross) v.cross(false); if (v.c && v.c.state === "hurt") CR().restFace(v.c); });
      const now = Date.now();
      hits.push(now);
      while (hits.length && now - hits[0] > 30000) hits.shift();
      if (hits.length >= 4 && !avenging) { hits.length = 0; avenge(v.side); }
    }

    /* ---------- payback ---------- */
    const CR = () => root.Creature;
    const base = () => toView(40, 108);
    function avenge(side) {
      avenging = true;
      let tries = 0;
      const go = () => {
        // a little scene in progress is called off: this is more important
        if (o.calm) o.calm();
        if (o.quiet && !o.quiet()) { if (++tries < 30) { G.delayedCall(0.5, go); return; } avenging = false; return; }
        const order = ["stomp", "gang", "zap"];
        for (let k = 0; k < 3; k++) {
          const kind = order[(revengeNo + k) % 3];
          if (REVENGE[kind](side)) {
            revengeNo = (revengeNo + k + 1) % 3;
            tell(kind === "stomp" ? "That was too many. A big one is stomping on the slingshot." : kind === "gang" ? "That was too many. The whole team is piling onto the slingshot." : "That was too many. The wizard zaps the slingshot to a crisp.");
            if (o.onRevenge) o.onRevenge(kind);
            return;
          }
        }
        avenging = false;
      };
      G.delayedCall(1.2, go);
    }
    const free = (side) => (o.actors ? o.actors() : []).filter((a) => a.side === side && a.free());
    // walk an actor to a point on the screen (feet first), and back home again
    const walkTo = (job, a, vx, vy, speed = 260) => {
      const [fx2, fy2] = a.toFrame(vx, vy), [px, py] = a.pos(), d = Math.hypot(fx2 - px, fy2 - py);
      const gait = CR().walk(a.c, 0.12);
      return job.add(G.timeline({ onComplete: () => { gait.kill(); CR().settle(a.c); } })
        .to(a.el, { ...a.put(fx2, fy2), duration: Math.max(0.4, d / speed), ease: "power1.inOut" }));
    };
    const walkHome = (job, a, speed = 260) => {
      const [hx, hy] = a.home(), [px, py] = a.pos(), d = Math.hypot(hx - px, hy - py);
      const gait = CR().walk(a.c, 0.12);
      return job.add(G.timeline({ onComplete: () => { gait.kill(); CR().settle(a.c); } })
        .to(a.el, { ...a.put(hx, hy), duration: Math.max(0.4, d / speed), ease: "power1.inOut" }));
    };
    const REVENGE = {
      // the biggest creature marches over, jumps, and lands on the slingshot
      stomp(side) {
        const pref = [4, 6, 5, 2, 3, 1];
        const a = free(side).sort((x, y) => pref.indexOf(x.kind) - pref.indexOf(y.kind))[0];
        if (!a) return false;
        const job = o.borrow([a], () => { avenging = false; });
        if (!job) return false;
        const [bx, by] = base();
        CR().setFace(a.c, "hurt", a.c.spec.face.beak ? "open" : "frown");
        if (a.cross) a.cross(true);
        wordAt(bx, by - 120, "THAT'S IT.", side ? "#3c4fb8" : "#e8432e", G);
        sfx("emote", "grr", side);
        walkTo(job, a, bx - 70, by - 4).then(() => {
          if (job.done) return;
          const [fx2, fy2] = a.toFrame(bx, by - 4), w = a.width();
          const up = a.put(fx2, fy2 - w * 1.2), down = a.put(fx2, fy2);
          job.add(G.timeline({ onComplete: () => { if (job.done) return; CR().setFace(a.c, "happy", a.c.spec.face.beak ? "open" : "grin"); walkHome(job, a).then(() => job.end()); } })
            .call(() => sfx("boing"))
            .to(a.el, { x: up.x, y: up.y, duration: 0.35, ease: "power2.out" })
            .to(a.el, { y: down.y, duration: 0.18, ease: "power3.in" })
            .call(() => { sfx("hit", 4, 0); wordAt(bx, by - 60, "STOMP!", side ? "#3c4fb8" : "#e8432e", G); smash(); })
            .to(a.act, { scaleY: 0.75, scaleX: 1.2, duration: 0.08, yoyo: true, repeat: 1, transformOrigin: "50% 100%" })
            .to({}, { duration: 0.6 }));
        });
        return true;
      },
      // the whole team piles on: a cloud of dust, fists and stars
      gang(side) {
        const [bx, by] = base();
        const team = free(side).sort((x, y) => { const p = x.pos(), q2 = y.pos(); const [tx, ty] = x.toFrame(bx, by); return Math.hypot(p[0] - tx, p[1] - ty) - Math.hypot(q2[0] - tx, q2[1] - ty); }).slice(0, 5);
        if (team.length < 3) return false;
        const job = o.borrow(team, () => { avenging = false; });
        if (!job) return false;
        wordAt(bx, by - 130, "GET IT!", side ? "#3c4fb8" : "#e8432e", G);
        sfx("emote", "grr", side);
        let arrived = 0;
        team.forEach((a, i) => {
          CR().setFace(a.c, "hurt", a.c.spec.face.beak ? "open" : "frown");
          if (a.cross) a.cross(true);
          walkTo(job, a, bx + (i - (team.length - 1) / 2) * 34, by - 4, 330).then(() => {
            if (job.done || ++arrived < team.length) return;
            brawl(job, bx, by - 30, () => {
              smash();
              team.forEach((m) => { CR().setFace(m.c, "happy", m.c.spec.face.beak ? "open" : "grin"); if (m.cross) m.cross(false); });
              let home = 0;
              team.forEach((m) => walkHome(job, m, 300).then(() => { if (++home === team.length) job.end(); }));
            }, team);
          });
        });
        return true;
      },
      // the wizard points its staff: a bolt of lightning, and the slingshot is toast
      zap() {
        const a = (o.actors ? o.actors() : []).find((x) => x.kind === 3 && x.side === 1 && x.free());
        if (!a) return false;
        const job = o.borrow([a], () => { avenging = false; });
        if (!job) return false;
        const [bx, by] = base(), r = a.rect();
        const sx = r.left + r.width * 0.5, sy = r.top + r.height * 0.12;
        CR().setFace(a.c, "happy", "grin");
        const arm = a.c.arms[a.c.arms.length - 1];
        if (arm) job.add(G.to(arm, { rotation: -140, svgOrigin: arm.dataset.o, duration: 0.3 }));
        sfx("windup", 3, 1);
        wordAt(sx, sy - 20, pick(["ZAP TIME", "abraca-ZAP", "allow me."]), "#3c4fb8", G);
        const bolt = el("path", { class: "sl-bolt", fill: "none", stroke: "#ffd84a", "stroke-width": 5, "stroke-linejoin": "round", "stroke-linecap": "round" });
        const core = el("path", { class: "sl-bolt", fill: "none", stroke: "#fff6c8", "stroke-width": 2, "stroke-linejoin": "round" });
        const jag = () => { const n = 9; let d = `M${sx} ${sy}`; for (let i = 1; i < n; i++) { const u = i / n; d += ` L${(sx + (bx - sx) * u + R(-16, 16)).toFixed(1)} ${(sy + (by - 40 - sy) * u + R(-16, 16)).toFixed(1)}`; } return d + ` L${bx} ${by - 40}`; };
        job.add(G.timeline({ delay: 0.7, onComplete: () => { bolt.remove(); core.remove(); if (arm) G.to(arm, { rotation: 0, svgOrigin: arm.dataset.o, duration: 0.3 }); sfx("emote", "laugh", 1); G.delayedCall(1.2, () => job.end()); } })
          .call(() => { fxLayer().append(bolt, core); sfx("hit", 3, 1); burn(); })
          .to({}, { duration: 0.09, repeat: 6, onRepeat: () => { const d = jag(); bolt.setAttribute("d", d); core.setAttribute("d", d); } })
          .call(() => { const d = jag(); bolt.setAttribute("d", d); core.setAttribute("d", d); }));
        return true;
      },
    };
    function brawl(job, x, y, done, team) {
      const f = fxLayer(), cloud = el("g", { class: "sl-brawl" });
      const blob = () => { let d = ""; const n = 14; for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2, r = R(48, 66); d += `${i ? "L" : "M"}${(x + Math.cos(t) * r * 1.25).toFixed(1)} ${(y + Math.sin(t) * r * 0.8).toFixed(1)} `; } return d + "Z"; };
      const p = el("path", { fill: "#fbf8ef", stroke: INK, "stroke-width": 3, "stroke-linejoin": "round" });
      cloud.append(p);
      const bits = [];
      for (let i = 0; i < 5; i++) { const s = el("text", { class: "sl-word sl-word--small", fill: pick(["#e8432e", "#3c4fb8", "#e8902a"]), "text-anchor": "middle" }); s.textContent = pick(["POW", "BAM", "★", "✶", "BONK", "WHAM"]); cloud.append(s); bits.push(s); }
      f.append(cloud);
      team.forEach((a) => G.set(a.el, { opacity: 0 }));
      job.add(G.timeline({ onComplete: () => { cloud.remove(); team.forEach((a) => G.set(a.el, { opacity: 1 })); done(); } })
        .fromTo(cloud, { scale: 0.2, svgOrigin: `${x} ${y}` }, { scale: 1, svgOrigin: `${x} ${y}`, duration: 0.2, ease: "back.out(2)" })
        .to({}, { duration: 0.14, repeat: 12, onRepeat: () => {
          p.setAttribute("d", blob());
          bits.forEach((b) => { b.setAttribute("x", (x + R(-70, 70)).toFixed(0)); b.setAttribute("y", (y + R(-46, 40)).toFixed(0)); });
          sfx("hit", pick([1, 2, 6]), Math.random() < 0.5 ? 1 : 0);
        } }, 0.05)
        .to(cloud, { opacity: 0, duration: 0.25 }));
      p.setAttribute("d", blob());
    }

    /* ---------- broken, and drawn again ---------- */
    function smash() {
      broken = true;
      holder.classList.add("is-broken");
      shake();
      const sticks = [...svg.querySelectorAll(".sl__stick")];
      if (anim) {
        sticks.forEach((s, i) => G.to(s, { rotation: i ? 70 : -55, x: i ? 16 : -10, y: 30, svgOrigin: "40 100", duration: 0.5, ease: "bounce.out" }));
        G.to([back, front, ammoG], { opacity: 0, duration: 0.2 });
      }
      G.delayedCall(6, repair);
    }
    function burn() {
      broken = true;
      holder.classList.add("is-broken", "is-burnt");
      const [bx, by] = toView(40, 70);
      for (let i = 0; i < 6; i++) {
        const s = el("circle", { cx: bx + R(-10, 10), cy: by, r: R(5, 9), fill: "#5d6170", opacity: 0.6 });
        fxLayer().append(s);
        G.to(s, { attr: { cy: by - R(60, 110), cx: bx + R(-30, 30), r: R(12, 20) }, opacity: 0, duration: R(1.4, 2.4), delay: i * 0.25, ease: "power1.out", onComplete: () => s.remove() });
      }
      G.to([back, front, ammoG], { opacity: 0, duration: 0.2 });
      G.delayedCall(6, repair);
    }
    function shake() { if (anim) G.fromTo(svg, { x: -4 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" }); }
    // the pencil draws a new one
    function repair() {
      const sticks = [...svg.querySelectorAll(".sl__stick")];
      G.to(frame, { opacity: 0, duration: 0.4, onComplete: () => {
        holder.classList.remove("is-burnt");
        sticks.forEach((s) => G.set(s, { clearProps: "transform" }));
        G.set([back, front, ammoG], { opacity: 1 });
        frame.style.opacity = "1";
        sfx("pencil", 1.2, 0.9);
        sticks.forEach((s, i) => G.fromTo(s, { attr: { "stroke-dasharray": "1 1", "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.6, delay: i * 0.5, ease: "power1.inOut", onComplete: () => { s.removeAttribute("stroke-dasharray"); s.removeAttribute("stroke-dashoffset"); } }));
        G.fromTo([back, front], { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 1.1 });
        G.delayedCall(1.3, () => { broken = false; holder.classList.remove("is-broken"); reload(); });
      } });
    }

    /* ---------- the hand on the band ---------- */
    let pulling = false, power = 0, aim = null;
    grab.addEventListener("pointerdown", (e) => { if (broken || inFlight) return; pulling = true; holder.classList.add("is-pulling"); grab.setPointerCapture(e.pointerId); e.preventDefault(); if (SND.unlock) SND.unlock(); });
    grab.addEventListener("pointermove", (e) => {
      if (!pulling) return;
      const p = toSvg(e);
      let dx = p.x - REST.x, dy = p.y - REST.y;
      const len = Math.hypot(dx, dy), m = Math.min(len, PULL);
      if (len > 0) { dx = dx / len * m; dy = dy / len * m; }
      at.x = REST.x + dx; at.y = REST.y + dy;
      power = Math.min(1, m / PULL);
      draw();
      // pulled back to the left: it will fly along the ruler; any other way (on a wide screen): at the page
      const ruler = dx < 0 && Math.abs(dy) < Math.abs(dx) * 1.2;
      aim = null;
      trail.setAttribute("d", ""); mark.setAttribute("d", "");
      if (power > 0.05 && ruler) {
        showAim(null);
        const a = arc(power);
        trail.setAttribute("d", `M${REST.x} ${REST.y} Q${a.cx.toFixed(1)} ${a.cy.toFixed(1)} ${a.tx.toFixed(1)} ${GY - 7}`);
        mark.setAttribute("d", `M${a.tx - 5} ${GY - 12} L${a.tx + 5} ${GY - 2} M${a.tx + 5} ${GY - 12} L${a.tx - 5} ${GY - 2}`);
      } else if (power > 0.05 && world()) {
        aim = aimAt(dx, dy, power);
        showAim(aim);
      } else showAim(null);
    });
    const release = () => {
      if (!pulling) return;
      pulling = false;
      holder.classList.remove("is-pulling");
      if (aim) shootWorld(aim);
      else if (power > 0.05 && at.x < REST.x) shootVolume(power);
      else if (anim) G.to(at, { x: REST.x, y: REST.y, duration: 0.5, ease: "elastic.out(1, 0.4)", onUpdate: draw });
      else { at.x = REST.x; at.y = REST.y; draw(); }
      showAim(null);
      power = 0; aim = null;
    };
    grab.addEventListener("pointerup", release);
    grab.addEventListener("pointercancel", release);
    // keys: a gentler shot along the ruler, a tenth at a time
    // Enter or Space: a throw at the next creature in line (wide screens), for anyone without a mouse
    let nextTarget = 0;
    holder.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && world() && !broken && !inFlight) {
        const list = (o.targets ? o.targets() : []).filter((t) => { const r = t.rect(); return r && r.bottom > 0 && r.top < innerHeight; });
        if (!list.length) return;
        e.preventDefault();
        const t = list[nextTarget++ % list.length], r = t.rect(), [sx, sy] = toView(REST.x, REST.y);
        const tx = r.left + r.width / 2, ty = r.top + r.height * 0.45;
        shootWorld({ sx, sy, tx, ty, d: Math.hypot(tx - sx, ty - sy) });
        return;
      }
      const v = vol();
      const to = { ArrowRight: v + 0.1, ArrowUp: v + 0.1, ArrowLeft: v - 0.1, ArrowDown: v - 0.1, Home: 0, End: 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const nv = Math.round(Math.max(0, Math.min(1, to)) * 10) / 10;
      if (broken || inFlight) { if (SND.setVolume) SND.setVolume(nv); paintFlag(nv); return; }
      shootVolume(nv);
    });
    return { paint: () => paintFlag(vol(), false) };
  }

  /* ---------- "tap me": the browser keeps a page quiet until it is touched, so a creature asks for that touch ---------- */
  function tapMe(o) {
    const SND = o.sound, G = o.gsap;
    if (SND.live) return;
    const r0 = o.rect();
    if (!r0 || !r0.width) return;
    const sign = document.createElement("button");
    sign.type = "button";
    sign.className = "sl-tapme";
    sign.innerHTML = `<span>${o.text || "tap me to hear the beach"}</span>`;
    document.body.append(sign);
    const placeIt = () => { const r = o.rect(); if (!r) return; sign.style.left = `${r.left + scrollX + r.width / 2}px`; sign.style.top = `${r.top + scrollY + r.height * 0.3}px`; };
    placeIt();
    addEventListener("resize", placeIt);
    if (o.raise) o.raise(true);
    if (G && o.anim) G.fromTo(sign, { scale: 0, rotation: -20 }, { scale: 1, rotation: -4, duration: 0.6, ease: "back.out(2.2)" });
    let gone = false;
    const done = (thanks) => {
      if (gone) return;
      gone = true;
      removeEventListener("resize", placeIt);
      document.removeEventListener("pointerdown", anyTap, true);
      document.removeEventListener("keydown", anyTap, true);
      if (o.raise) o.raise(false);
      if (thanks && o.thanks) o.thanks();
      if (G && o.anim) G.to(sign, { y: 40, rotation: 30, opacity: 0, duration: 0.5, ease: "power2.in", onComplete: () => sign.remove() });
      else sign.remove();
    };
    // when the sound is already on, any touch at all wakes it; when it is off, only the sign turns it on
    const anyTap = (e) => { if (e.target === sign || sign.contains(e.target)) return; if (SND.on) { SND.unlock(); done(true); } };
    sign.addEventListener("click", () => { if (!SND.on) { SND.set(true); if (o.paintSound) o.paintSound(); } else SND.unlock(); done(true); });
    document.addEventListener("pointerdown", anyTap, true);
    document.addEventListener("keydown", anyTap, true);
    setTimeout(() => done(false), 25000);
    return { done };
  }

  root.Sling = { mount, tapMe, AMMO: AMMO_NAMES };
})(window);
