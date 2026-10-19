/* Holidays in the margins. Around a holiday (a day or two before and after) the creatures dress up and
   the page fills with that holiday's doodles: Halloween, Christmas, New Year, Lunar New Year (Tết),
   Mid-Autumn (Trung Thu), Valentine's Day and April Fools'.
   The chess signs always stay in sight: hats go on the pawns, the others get scarves, capes and bows.
   ?theme=halloween (or any other name, or none) in the address shows a theme on any day. */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const R = (a, b) => a + Math.random() * (b - a);
  const E = (cx, cy, rx, ry) => `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  const starD = (x, y, Rr, r = Rr * 0.45, n = 5) => { let d = ""; for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r : Rr, a = (Math.PI / n) * i - Math.PI / 2; d += `${i ? "L" : "M"} ${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)} `; } return d + "Z"; };
  const heartD = (x, y, s) => `M ${x} ${y + s * 0.9} C ${x - s * 1.3} ${y + s * 0.1} ${x - s * 0.9} ${y - s * 0.9} ${x} ${y - s * 0.3} C ${x + s * 0.9} ${y - s * 0.9} ${x + s * 1.3} ${y + s * 0.1} ${x} ${y + s * 0.9} Z`;

  /* ---------- which holiday it is ---------- */

  // the lunar dates move every year: the first day of Tết and the full moon of the eighth month
  const TET = { 2025: "01-29", 2026: "02-17", 2027: "02-06", 2028: "01-26", 2029: "02-13", 2030: "02-03", 2031: "01-23", 2032: "02-11", 2033: "01-31", 2034: "02-19", 2035: "02-08", 2036: "01-28" };
  const MOON = { 2025: "10-06", 2026: "09-25", 2027: "09-15", 2028: "10-03", 2029: "09-22", 2030: "09-12", 2031: "10-01", 2032: "09-19", 2033: "09-08", 2034: "09-27", 2035: "09-16", 2036: "10-04" };
  const day = (y, md) => { const [m, d] = md.split("-").map(Number); return new Date(y, m - 1, d); };
  // the owner's birthday, as "MM-DD" (null: no birthday theme unless asked for with ?theme=birthday)
  const BIRTHDAY = "01-01";
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const near = (now, at, before, after) => { const t = (now - at) / 86400000; return t >= -before && t < after + 1; };

  const THEMES = {
    halloween: { note: "happy Halloween! everyone came in costume", when: (n, y) => near(n, day(y, "10-31"), 2, 2) },
    christmas: { note: "merry Christmas! the creatures wrapped up warm", when: (n, y) => near(n, day(y, "12-25"), 3, 2) },
    newyear: { note: "happy New Year! one more game before midnight?", when: (n, y) => near(n, day(y, "01-01"), 0, 1) || near(n, day(y, "12-31"), 1, 0) },
    tet: { note: "Chúc mừng năm mới! happy Lunar New Year", when: (n, y) => TET[y] && near(n, day(y, TET[y]), 2, 4) },
    midautumn: { note: "Trung Thu vui vẻ! the moon is out for the lanterns", when: (n, y) => MOON[y] && near(n, day(y, MOON[y]), 2, 2) },
    valentine: { note: "happy Valentine's Day, from both teams", when: (n, y) => near(n, day(y, "02-14"), 2, 2) },
    aprilfools: { note: "nothing is different today. nothing at all.", when: (n, y) => near(n, day(y, "04-01"), 1, 1) },
    womensday: { note: () => (new Date().getMonth() === 9 ? "Vietnamese Women's Day! the creatures brought flowers" : "happy Women's Day! flowers for everyone"), when: (n, y) => near(n, day(y, "10-20"), 1, 1) || near(n, day(y, "03-08"), 1, 1) },
    childrensday: { note: "happy Children's Day! sweets for everyone (the crab took two)", when: (n, y) => near(n, day(y, "06-01"), 1, 1) },
    teachersday: { note: "happy Teachers' Day! the owl is giving a lecture", when: (n, y) => near(n, day(y, "11-20"), 1, 1) },
    birthday: { note: () => (THEMES.newyear.when(today(), today().getFullYear()) ? "happy birthday, and happy New Year! the creatures baked a cake. the crab ate a bit." : "happy birthday! the creatures baked a cake. the crab ate a bit of it."), when: (n, y) => Boolean(BIRTHDAY) && near(n, day(y, BIRTHDAY), 0, 0) },
  };
  function pick(now = new Date()) {
    let asked = null;
    try { asked = new URLSearchParams(location.search).get("theme"); } catch { /* no address */ }
    if (asked !== null) return THEMES[asked] ? asked : null;
    const n = new Date(now.getFullYear(), now.getMonth(), now.getDate()), y = n.getFullYear();
    if (THEMES.birthday.when(n, y)) return "birthday";
    for (const id in THEMES) if (THEMES[id].when(n, y)) return id;
    return null;
  }
  const id = pick();
  function night(now = new Date()) {
    let asked = null;
    try { asked = new URLSearchParams(location.search).get("time"); } catch { /* no address */ }
    if (asked === "night") return true;
    if (asked === "day") return false;
    const h = now.getHours();
    return h >= 19 || h < 6;
  }

  /* ---------- costumes ---------- */

  const box = (g) => { try { const b = g.getBBox(); return b.width || b.height ? b : null; } catch { return null; } };
  // a costume piece is drawn twice, like every part, so its lines boil with the rest of the creature
  function wear(c, parent, name, draw, before = null) {
    const CR = root.Creature, rc = root.rough.svg(c.svg);
    const ink = CR.INK[c.key[0] === "b" ? 1 : 0];
    const g = el("g", { class: `p p-cos p-cos-${name}` });
    for (let k = 0; k < 2; k++) {
      const copy = el("g", { class: `f${k}` });
      draw(CR.pen(rc, copy, ink, k + 700), k);
      g.append(copy);
    }
    if (before) parent.insertBefore(g, before); else parent.append(g);
    return g;
  }
  const tilt = (g, deg, ox, oy) => g.setAttribute("transform", `rotate(${deg} ${ox} ${oy})`);

  const PIECES = {
    santa(s, cx, top, w) {
      s.shape(`M ${cx - w / 2} ${top + 2} Q ${cx - w * 0.1} ${top - w * 1.05} ${cx + w * 0.62} ${top - w * 0.66} L ${cx + w / 2} ${top + 2} Z`, "#d93a2e", { gap: 2 });
      s.shape(E(cx, top + 3, w * 0.6, w * 0.17), "#fffaf0", { gap: 1.6 });
      s.shape(E(cx + w * 0.64, top - w * 0.66, w * 0.15, w * 0.15), "#fffaf0", { gap: 1.4 });
    },
    witch(s, cx, top, w, band) {
      s.shape(E(cx, top + 2, w * 0.85, w * 0.16), "#3a2f4a", { gap: 2 });
      s.shape(`M ${cx - w * 0.38} ${top + 1} L ${cx - w * 0.05} ${top - w * 0.95} L ${cx + w * 0.3} ${top - w * 1.12} L ${cx + w * 0.1} ${top - w * 0.8} L ${cx + w * 0.38} ${top + 1} Z`, "#4a3d60", { gap: 2 });
      s.shape(`M ${cx - w * 0.34} ${top - 4} L ${cx + w * 0.34} ${top - 4} L ${cx + w * 0.36} ${top + 1} L ${cx - w * 0.36} ${top + 1} Z`, band, { gap: 1.4, sw: 1.2 });
    },
    party(s, cx, top, w, a, b) {
      s.shape(`M ${cx - w * 0.36} ${top + 2} L ${cx + w * 0.08} ${top - w * 1.05} L ${cx + w * 0.36} ${top + 2} Z`, a, { gap: 2 });
      s.line(`M ${cx - w * 0.2} ${top - w * 0.3} L ${cx + w * 0.26} ${top - w * 0.18} M ${cx - w * 0.06} ${top - w * 0.66} L ${cx + w * 0.16} ${top - w * 0.6}`, { ink: b, sw: 2.2 });
      s.shape(E(cx + w * 0.08, top - w * 1.08, w * 0.12, w * 0.12), b, { gap: 1.2 });
    },
    nonla(s, cx, top, w) {
      s.shape(`M ${cx - w * 0.95} ${top + 4} Q ${cx - w * 0.3} ${top - w * 0.25} ${cx} ${top - w * 0.55} Q ${cx + w * 0.3} ${top - w * 0.25} ${cx + w * 0.95} ${top + 4} Q ${cx} ${top + 9} ${cx - w * 0.95} ${top + 4} Z`, "#e9cf86", { gap: 2.2, angle: 8 });
      s.line(`M ${cx} ${top - w * 0.52} L ${cx - w * 0.5} ${top + 4} M ${cx} ${top - w * 0.52} L ${cx + w * 0.5} ${top + 4} M ${cx} ${top - w * 0.52} L ${cx} ${top + 6}`, { ink: "#a88a40", sw: 1.1 });
      s.line(`M ${cx - w * 0.55} ${top + 5} Q ${cx} ${top + w * 0.7} ${cx + w * 0.55} ${top + 5}`, { ink: "#c8452e", sw: 1.2 });
    },
    antlers(s, x, y) {
      s.line(`M ${x} ${y} L ${x - 4} ${y - 16} L ${x - 12} ${y - 22} M ${x - 4} ${y - 16} L ${x + 2} ${y - 26} M ${x - 2} ${y - 9} L ${x - 10} ${y - 10}`, { ink: "#7a4a1c", sw: 2.6 });
      s.line(`M ${x + 8} ${y + 1} L ${x + 10} ${y - 14} L ${x + 4} ${y - 22} M ${x + 10} ${y - 14} L ${x + 18} ${y - 21}`, { ink: "#7a4a1c", sw: 2.6 });
    },
    scarf(s, cx, y, w, a, b) {
      const h = Math.max(6, w * 0.16);
      s.shape(`M ${cx - w / 2} ${y} Q ${cx} ${y + h * 0.6} ${cx + w / 2} ${y} L ${cx + w / 2} ${y + h} Q ${cx} ${y + h * 1.6} ${cx - w / 2} ${y + h} Z`, a, { gap: 1.8 });
      s.shape(`M ${cx + w * 0.2} ${y + h * 0.8} L ${cx + w * 0.36} ${y + h * 3.2} L ${cx + w * 0.16} ${y + h * 3.3} L ${cx + w * 0.06} ${y + h} Z`, a, { gap: 1.8 });
      s.line(`M ${cx - w * 0.3} ${y + 1} L ${cx - w * 0.32} ${y + h * 1.2} M ${cx - w * 0.05} ${y + 2} L ${cx - w * 0.06} ${y + h * 1.3} M ${cx + w * 0.22} ${y + h * 1.6} L ${cx + w * 0.3} ${y + h * 1.5} M ${cx + w * 0.25} ${y + h * 2.4} L ${cx + w * 0.33} ${y + h * 2.3}`, { ink: b, sw: 2.2 });
    },
    bow(s, cx, y, w, col) {
      s.shape(`M ${cx} ${y} L ${cx - w * 0.32} ${y - w * 0.16} L ${cx - w * 0.32} ${y + w * 0.16} Z`, col, { gap: 1.4 });
      s.shape(`M ${cx} ${y} L ${cx + w * 0.32} ${y - w * 0.16} L ${cx + w * 0.32} ${y + w * 0.16} Z`, col, { gap: 1.4 });
      s.shape(E(cx, y, w * 0.07, w * 0.07), col, { gap: 1 });
    },
    cape(s, cx, y, w, h, out, lining) {
      s.shape(`M ${cx - w * 0.36} ${y} Q ${cx - w * 0.7} ${y + h * 0.5} ${cx - w * 0.78} ${y + h} L ${cx + w * 0.78} ${y + h} Q ${cx + w * 0.7} ${y + h * 0.5} ${cx + w * 0.36} ${y} Z`, out, { gap: 2.4 });
      s.shape(`M ${cx - w * 0.62} ${y + h * 0.55} L ${cx - w * 0.78} ${y + h} L ${cx - w * 0.5} ${y + h} Z M ${cx + w * 0.62} ${y + h * 0.55} L ${cx + w * 0.78} ${y + h} L ${cx + w * 0.5} ${y + h} Z`, lining, { gap: 1.6, line: false });
      s.shape(`M ${cx - w * 0.36} ${y + 2} L ${cx - w * 0.52} ${y - w * 0.3} L ${cx - w * 0.2} ${y - 2} Z M ${cx + w * 0.36} ${y + 2} L ${cx + w * 0.52} ${y - w * 0.3} L ${cx + w * 0.2} ${y - 2} Z`, out, { gap: 1.6 });
    },
    batwings(s, cx, y, w) {
      const side = (d) => `M ${cx + d * w * 0.3} ${y} L ${cx + d * w * 0.95} ${y - w * 0.35} Q ${cx + d * w * 0.85} ${y + w * 0.05} ${cx + d * w * 0.95} ${y + w * 0.25} Q ${cx + d * w * 0.75} ${y + w * 0.12} ${cx + d * w * 0.68} ${y + w * 0.3} Q ${cx + d * w * 0.55} ${y + w * 0.14} ${cx + d * w * 0.4} ${y + w * 0.3} Z`;
      s.shape(side(-1), "#3a2f4a", { gap: 1.8 });
      s.shape(side(1), "#3a2f4a", { gap: 1.8 });
    },
    lantern(s, x, y, size) {
      s.line(`M ${x} ${y} L ${x + size * 0.9} ${y - size * 2.2}`, { ink: "#7a4a1c", sw: 2 });
      const lx = x + size * 0.9, ly = y - size * 2.2 + size * 0.9;
      s.line(`M ${lx} ${y - size * 2.2} L ${lx} ${ly - size * 0.7}`, { sw: 1 });
      s.shape(starD(lx, ly, size, size * 0.48), "#e8432e", { gap: 1.6 });
      s.shape(starD(lx, ly, size * 0.45, size * 0.22), "#f6c945", { gap: 1.2, line: false });
      s.line(`M ${lx - 2} ${ly + size * 0.9} L ${lx - 3} ${ly + size * 1.6} M ${lx + 2} ${ly + size * 0.9} L ${lx + 3} ${ly + size * 1.6}`, { ink: "#e8432e", sw: 1.4 });
    },
    balloon(s, x, y, size) {
      s.line(`M ${x} ${y} Q ${x + 8} ${y - size * 1.4} ${x + 4} ${y - size * 2.4}`, { sw: 1 });
      s.shape(heartD(x + 4, y - size * 3, size), "#ef5a7a", { gap: 1.8 });
    },
    groucho(s, eyes, r, nx, ny, my) {
      eyes.forEach(([x, y]) => s.line(E(x, y, r * 1.6, r * 1.5), { sw: 2.2, ink: "#1f1a2a" }));
      if (eyes.length > 1) s.line(`M ${eyes[0][0] + r * 1.6} ${eyes[0][1]} Q ${(eyes[0][0] + eyes[1][0]) / 2} ${eyes[0][1] - r * 0.6} ${eyes[1][0] - r * 1.6} ${eyes[1][1]}`, { sw: 2, ink: "#1f1a2a" });
      eyes.forEach(([x, y]) => s.line(`M ${x - r * 1.5} ${y - r * 2} Q ${x} ${y - r * 2.9} ${x + r * 1.5} ${y - r * 2}`, { sw: 3.2, ink: "#1f1a2a" }));
      s.shape(E(nx, ny, r * 1.1, r * 1.3), "#f0a0a0", { gap: 1.2 });
      s.shape(`M ${nx - r * 2.2} ${my} Q ${nx - r} ${my - r * 1.4} ${nx} ${my - r * 0.5} Q ${nx + r} ${my - r * 1.4} ${nx + r * 2.2} ${my} Q ${nx} ${my - r * 0.3} ${nx - r * 2.2} ${my} Z`, "#2a2230", { gap: 1, style: "solid" });
    },
    blossom(s, x, y, size, col) {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; s.shape(E(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size * 0.6, size * 0.45, size * 0.45), col, { gap: 1.2, sw: 1 }); }
      s.shape(E(x, y, size * 0.3, size * 0.3), "#f6c945", { gap: 1, line: false });
    },
    heart(s, x, y, size, col) { s.shape(heartD(x, y, size), col, { gap: 1.4 }); },
    flower(s, x, y, size, col) {
      s.line(`M ${x} ${y} Q ${x + size * 0.4} ${y - size * 1.4} ${x + size * 0.2} ${y - size * 2.6}`, { ink: "#3f8a3a", sw: 2 });
      s.shape(`M ${x + size * 0.2} ${y - size * 1.2} q ${size * 0.8} ${-size * 0.5} ${size * 0.9} ${size * 0.2} q ${-size * 0.6} ${size * 0.2} ${-size * 0.9} ${-size * 0.2} Z`, "#6fbf5a", { gap: 1.2, sw: 1 });
      const fx = x + size * 0.2, fy = y - size * 2.9;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; s.shape(E(fx + Math.cos(a) * size * 0.5, fy + Math.sin(a) * size * 0.5, size * 0.42, size * 0.42), col, { gap: 1.1, sw: 1 }); }
      s.shape(E(fx, fy, size * 0.28, size * 0.28), "#f6c945", { gap: 1, line: false });
    },
    lolly(s, x, y, size) {
      s.line(`M ${x} ${y} L ${x + size * 0.5} ${y - size * 2.4}`, { ink: "#c8a050", sw: 2 });
      const lx = x + size * 0.5, ly = y - size * 3.1;
      s.shape(E(lx, ly, size * 0.85, size * 0.85), "#ef5a7a", { gap: 1.4 });
      s.line(`M ${lx} ${ly} m -1 0 a 2 2 0 1 1 3 1 a 4 4 0 1 1 -6 -2 a 6 6 0 1 1 9 3`, { ink: "#fffaf0", sw: 1.6 });
    },
    mortar(s, cx, top, w) {
      s.shape(`M ${cx - w * 0.36} ${top + 2} L ${cx - w * 0.32} ${top - w * 0.2} L ${cx + w * 0.32} ${top - w * 0.2} L ${cx + w * 0.36} ${top + 2} Z`, "#2a2230", { gap: 1.8 });
      s.shape(`M ${cx - w * 0.75} ${top - w * 0.22} L ${cx} ${top - w * 0.46} L ${cx + w * 0.75} ${top - w * 0.22} L ${cx} ${top + w * 0.02} Z`, "#3a2f4a", { gap: 2 });
      s.line(`M ${cx} ${top - w * 0.24} L ${cx + w * 0.55} ${top - w * 0.16} L ${cx + w * 0.58} ${top + w * 0.25}`, { ink: "#f6c945", sw: 1.8 });
      s.shape(E(cx + w * 0.58, top + w * 0.3, w * 0.06, w * 0.1), "#f6c945", { gap: 1, sw: 1 });
    },
    specs(s, eyes, r) {
      eyes.forEach(([x, y]) => s.line(E(x, y, r * 1.4, r * 1.3), { sw: 1.4, ink: "#5a3a1a" }));
      if (eyes.length > 1) s.line(`M ${eyes[0][0] + r * 1.4} ${eyes[0][1]} L ${eyes[1][0] - r * 1.4} ${eyes[1][1]}`, { sw: 1.4, ink: "#5a3a1a" });
    },
  };

  // dress one creature for the holiday; returns the bits that swing on their own
  function dress(c, theme = id) {
    if (!theme || !c || !root.rough) return;
    const kind = ["", "pawn", "knight", "bishop", "rook", "queen", "king"].indexOf(c.key.slice(2));
    const black = c.key[0] === "b";
    const f = c.spec.face;
    const P = PIECES;
    const body = box(c.body) || { x: 30, y: 40, width: 40, height: 50 };
    const hat = c.hat ? box(c.hat) : null;
    const head = c.head ? box(c.head) : null;
    const neckY = f.mouth[1] + f.r * 1.5, cx = 50, w = Math.min(body.width * 0.9, 52);
    // the top of the head, where a hat goes on a pawn
    const top = black ? body.y + 3 : (hat ? hat.y + 4 : body.y);
    const hatW = black ? body.width * 0.8 : (hat ? hat.width * 0.62 : 30);
    const behind = c.root.querySelector(".p-legL, .p-tail, .p-body");
    const front = (g) => c.root.insertBefore(g, c.face && c.face.parentNode === c.root ? c.face : null);
    const swing = [];
    const onHead = (name, draw) => wear(c, kind === 1 && !black && c.hat ? c.hat : c.root, name, draw);
    const team = (a, b) => (black ? b : a);

    if (theme === "aprilfools") {
      const holder = c.face.parentNode;
      const nose = kind === 2 ? [f.mouth[0] - 2, f.mouth[1] - 6] : [cx, (f.eyes[0][1] + f.mouth[1]) / 2 + 1];
      wear(c, holder, "groucho", (s) => P.groucho(s, f.eyes, f.r, nose[0], nose[1], f.mouth[1] - (f.beak ? -2 : 1)));
      return swing;
    }
    if (theme === "teachersday" && kind !== 1) {
      // everyone but the pawns turns up to class in reading glasses
      wear(c, c.face.parentNode, "specs", (s) => P.specs(s, f.eyes, f.r));
      return swing;
    }
    if (kind === 2) {
      // knights: something on the head, which turns with it
      const hx = head ? head.x + head.width * 0.62 : 34, hy = head ? head.y + 6 : 14;
      const on = (name, draw) => wear(c, c.head || c.root, name, draw);
      if (theme === "christmas") on("antlers", (s) => P.antlers(s, hx, hy));
      else if (theme === "halloween") on("witch", (s) => P.witch(s, hx, hy, 20, "#f08a24"));
      else if (theme === "newyear") on("party", (s) => P.party(s, hx, hy, 18, "#4a8fe0", "#f6c945"));
      else if (theme === "tet") on("blossom", (s) => P.blossom(s, hx, hy + 2, 7, "#f4a6c0"));
      else if (theme === "midautumn") on("blossom", (s) => P.blossom(s, hx, hy + 2, 7, "#f6c945"));
      else if (theme === "valentine") on("heart", (s) => P.heart(s, hx, hy, 6, "#ef5a7a"));
      else if (theme === "womensday") on("blossom", (s) => P.blossom(s, hx, hy + 2, 7, "#ef7aa0"));
      else if (theme === "childrensday" || theme === "birthday") on("party", (s) => P.party(s, hx, hy, 18, "#3fb39a", "#f6c945"));
      return swing;
    }
    if (kind === 1) {
      // pawns: the full costume, since their sign is being small and round
      if (theme === "christmas") onHead("santa", (s) => P.santa(s, cx, top, hatW));
      else if (theme === "halloween") {
        if (black) wear(c, c.root, "bat", (s) => P.batwings(s, cx, body.y + body.height * 0.45, body.width * 0.8), behind);
        else onHead("witch", (s) => P.witch(s, cx, top, hatW, "#9a8ee8"));
      } else if (theme === "newyear") onHead("party", (s) => P.party(s, cx, top, hatW, team("#e8432e", "#3fb39a"), "#f6c945"));
      else if (theme === "tet") onHead("nonla", (s) => P.nonla(s, cx, top, hatW));
      else if (theme === "midautumn") {
        const g = wear(c, c.root, "lantern", (s) => P.lantern(s, cx + body.width * 0.42, body.y + body.height * 0.55, 12));
        g.dataset.o = `${cx + body.width * 0.42} ${body.y + body.height * 0.55}`;
        swing.push(g);
      } else if (theme === "valentine") {
        const g = wear(c, c.root, "balloon", (s) => P.balloon(s, cx + body.width * 0.45, body.y + body.height * 0.5, 12));
        g.dataset.o = `${cx + body.width * 0.45} ${body.y + body.height * 0.5}`;
        swing.push(g);
      } else if (theme === "womensday" || theme === "childrensday") {
        const hx = cx + body.width * 0.44, hy = body.y + body.height * 0.55;
        const g = wear(c, c.root, theme === "womensday" ? "flower" : "lolly", (s) => (theme === "womensday" ? P.flower(s, hx, hy, 8, team("#ef5a7a", "#9a8ee8")) : P.lolly(s, hx, hy, 8)));
        g.dataset.o = `${hx} ${hy}`;
        swing.push(g);
      } else if (theme === "teachersday") onHead("mortar", (s) => P.mortar(s, cx, top, hatW));
      else if (theme === "birthday") onHead("party", (s) => P.party(s, cx, top, hatW, team("#ef5a7a", "#4a8fe0"), "#f6c945"));
      return swing;
    }
    // the rest keep their crowns, mitres and battlements, and dress below them
    if (theme === "halloween") wear(c, c.root, "cape", (s) => P.cape(s, cx, neckY, w, 94 - neckY - 4, "#2a2230", team("#c8452e", "#f08a24")), behind);
    else if (theme === "christmas") front(wear(c, c.root, "scarf", (s) => P.scarf(s, cx, neckY - 2, w * 0.9, team("#d93a2e", "#3f9a5a"), "#fffaf0")));
    else if (theme === "newyear") front(wear(c, c.root, "bow", (s) => P.bow(s, cx, neckY + 2, w * 0.8, "#f3c33a")));
    else if (theme === "tet") front(wear(c, c.root, "scarf", (s) => P.scarf(s, cx, neckY - 2, w * 0.9, "#d93a2e", "#f6c945")));
    else if (theme === "midautumn") front(wear(c, c.root, "scarf", (s) => P.scarf(s, cx, neckY - 2, w * 0.9, "#f08a24", "#f6c945")));
    else if (theme === "valentine") front(wear(c, c.root, "bow", (s) => P.bow(s, cx, neckY + 2, w * 0.8, "#ef5a7a")));
    else if (theme === "womensday") front(wear(c, c.root, "corsage", (s) => P.blossom(s, cx + w * 0.22, neckY + 6, 5, team("#ef5a7a", "#f4a6c0"))));
    else if (theme === "childrensday" || theme === "birthday") front(wear(c, c.root, "bow", (s) => P.bow(s, cx, neckY + 2, w * 0.8, ["#e8432e", "#4a8fe0", "#3fb39a", "#f6c945"][kind % 4])));
    return swing;
  }

  /* ---------- the page's holiday doodles ---------- */
  // x: the drawing helpers of the doodle layer (see drawDeco in game.js)
  function decorate(x) {
    const theme = id;
    if (night()) nightfall(x);
    if (!theme) return;
    const { deco, W, H, narrow, rc, mover, loop, anim, G, svgEl } = x;
    const pen = { stroke: "#2b2f3a", strokeWidth: 1.6, roughness: 1.2 };
    const rightX = W - (narrow ? 40 : 75), leftX = narrow ? 40 : 75;
    // a few things fall or rise across the whole page, all in one group
    const rain = (cls, n, make, opts = {}) => {
      const g = svgEl("g", { class: cls });
      deco.append(g);
      if (!anim) return g;
      for (let i = 0; i < n; i++) {
        const p = make(i);
        g.append(p);
        const x0 = R(0, W), fall = opts.up ? -1 : 1;
        const y0 = opts.up ? H + 30 : -30, y1 = opts.up ? -40 : H + 30;
        G.set(p, { x: x0, y: y0 });
        loop(G.to(p, { y: y1, duration: R(opts.slow || 9, (opts.slow || 9) * 1.7), ease: "none", repeat: -1, delay: -R(0, 14) }));
        loop(G.to(p, { x: x0 + R(-40, 40) * fall, rotation: R(-120, 120), duration: R(2, 4), yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
      return g;
    };
    const across = (g, y, every, dur, bob = 18) => {
      if (!anim) { G.set(g, { x: W * 0.3, y }); return; }
      G.set(g, { x: -120, y });
      loop(G.timeline({ repeat: -1, repeatDelay: every })
        .fromTo(g, { x: -120 }, { x: W + 120, duration: dur, ease: "none" })
        .fromTo(g, { y: y }, { y: y - bob, duration: dur / 6, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0));
    };
    const stars = [...deco.querySelectorAll(".d-bunting .d-star")].map((s) => { try { const b = s.getBBox(); return [b.x + b.width / 2, b.y + b.height]; } catch { return null; } }).filter(Boolean);

    if (theme === "halloween") {
      // bats flap across the top of the page
      for (let i = 0; i < (narrow ? 2 : 4); i++) {
        const bat = mover("t-bat", (g) => {
          const wl = svgEl("g", { class: "t-wing" }), wr = svgEl("g", { class: "t-wing" });
          wl.append(rc.path("M 0 0 L -22 -10 Q -18 -2 -22 4 Q -14 0 -12 6 Q -6 2 0 4 Z", { stroke: "#1f1a2a", strokeWidth: 1.3, fill: "#3a2f4a", fillStyle: "solid", seed: 2000 + i }));
          wr.append(rc.path("M 0 0 L 22 -10 Q 18 -2 22 4 Q 14 0 12 6 Q 6 2 0 4 Z", { stroke: "#1f1a2a", strokeWidth: 1.3, fill: "#3a2f4a", fillStyle: "solid", seed: 2010 + i }));
          g.append(wl, wr);
          g.append(rc.ellipse(0, 2, 10, 12, { stroke: "#1f1a2a", strokeWidth: 1.3, fill: "#2a2230", fillStyle: "solid", seed: 2020 + i }));
          g.append(rc.circle(-2, 0, 2.4, { stroke: "none", fill: "#f6c945", fillStyle: "solid", seed: 2030 }));
          g.append(rc.circle(2, 0, 2.4, { stroke: "none", fill: "#f6c945", fillStyle: "solid", seed: 2031 }));
        });
        if (anim) loop(G.to(bat.querySelectorAll(".t-wing"), { scaleY: -0.4, svgOrigin: "0 0", duration: 0.12 + i * 0.02, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        across(bat, 40 + i * 34, 4 + i * 3, 9 + i * 2, 24);
      }
      // jack-o'-lanterns whose candles flicker
      [[leftX, H * 0.6], [rightX, H * 0.42]].forEach(([px, py], i) => {
        if (narrow && i) return;
        const pk = mover("t-pumpkin", (g) => {
          g.append(rc.path("M 0 -26 q 2 -10 8 -12", { stroke: "#4a7a2a", strokeWidth: 3, seed: 2040 + i }));
          g.append(rc.ellipse(0, 0, 66, 52, { ...pen, stroke: "#9a4a1a", fill: "#f08a24", fillStyle: "hachure", hachureGap: 3, seed: 2041 + i }));
          g.append(rc.path("M -10 -24 Q -16 0 -10 24 M 10 -24 Q 16 0 10 24", { stroke: "#9a4a1a", strokeWidth: 1.2, seed: 2042 }));
          const glow = svgEl("g", { class: "t-glow" });
          glow.append(rc.polygon([[-16, -6], [-8, -6], [-12, -14]], { stroke: "none", fill: "#ffe27a", fillStyle: "solid", seed: 2043 }));
          glow.append(rc.polygon([[16, -6], [8, -6], [12, -14]], { stroke: "none", fill: "#ffe27a", fillStyle: "solid", seed: 2044 }));
          glow.append(rc.path("M -18 6 L -10 12 L -4 6 L 4 12 L 10 6 L 18 8 Q 0 22 -18 6 Z", { stroke: "none", fill: "#ffe27a", fillStyle: "solid", seed: 2045 }));
          g.append(glow);
        });
        G.set(pk, { x: px, y: py, scale: narrow ? 0.7 : 1 });
        if (anim) {
          loop(G.to(pk.querySelector(".t-glow"), { opacity: 0.45, duration: 0.09, yoyo: true, repeat: -1, repeatDelay: 0.05, ease: "steps(2)" }));
          loop(G.to(pk, { rotation: i ? 4 : -4, svgOrigin: `${px} ${py + 24}`, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        }
      });
      // a spider's web in the right margin
      if (!narrow) {
        const wx = rightX, wy = H * 0.24;
        x.doodle("t-web", (r, g, k) => {
          for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.append(r.line(wx, wy, wx + Math.cos(a) * 44, wy + Math.sin(a) * 44, { stroke: "#8a8f9a", strokeWidth: 1, roughness: 1, seed: 2050 + i + k * 30 })); }
          [14, 26, 38].forEach((rr, j) => { let d = ""; for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; d += `${i ? "L" : "M"} ${(wx + Math.cos(a) * rr).toFixed(1)} ${(wy + Math.sin(a) * rr).toFixed(1)} `; } g.append(r.path(d, { stroke: "#8a8f9a", strokeWidth: 1, roughness: 1.2, seed: 2060 + j + k * 30 })); });
        });
      }
      // a witch on her broom crosses the sky now and then
      const witch = mover("t-witch", (g) => {
        g.append(rc.line(-34, 6, 26, 0, { stroke: "#7a4a1c", strokeWidth: 3, seed: 2070 }));
        g.append(rc.path("M -34 6 L -48 -2 M -34 6 L -50 6 M -34 6 L -48 14", { stroke: "#c8a050", strokeWidth: 2, seed: 2071 }));
        g.append(rc.path("M -6 2 L 2 -20 L 10 2 Z", { stroke: "#1f1a2a", strokeWidth: 1.3, fill: "#4a3d60", fillStyle: "solid", seed: 2072 }));
        g.append(rc.circle(2, -24, 10, { stroke: "#2a5a2a", strokeWidth: 1.2, fill: "#8fd08a", fillStyle: "solid", seed: 2073 }));
        g.append(rc.path("M -8 -26 L 12 -26 M -2 -26 L 4 -44 L 8 -26", { stroke: "#1f1a2a", strokeWidth: 1.6, fill: "#3a2f4a", fillStyle: "solid", seed: 2074 }));
        g.append(rc.path("M -2 -30 Q -16 -34 -18 -20", { stroke: "#e8432e", strokeWidth: 2, seed: 2075 }));
      });
      across(witch, narrow ? 80 : 150, 14, 12, 30);
    }

    if (theme === "christmas") {
      rain("t-snow", narrow ? 16 : 30, (i) => { const f = rc.circle(0, 0, R(4, 9), { stroke: "#9ab4d8", strokeWidth: 1, fill: "#ffffff", fillStyle: "solid", seed: 2100 + i }); const g = svgEl("g"); g.append(f); return g; }, { slow: 10 });
      // a tree with blinking baubles and a twinkling star
      if (!narrow) {
        const tx = rightX, ty = H * 0.5;
        const tree = mover("t-tree", (g) => {
          g.append(rc.rectangle(tx - 7, ty + 52, 14, 18, { stroke: "#5a3a1a", strokeWidth: 1.4, fill: "#9a5a26", fillStyle: "hachure", hachureGap: 2, seed: 2110 }));
          [[0, 56, 44], [-30, 44, 34], [-58, 32, 24]].forEach(([dy, half, h], j) => g.append(rc.polygon([[tx - half, ty + dy + h], [tx, ty + dy - h * 0.6], [tx + half, ty + dy + h]], { stroke: "#2a5a2a", strokeWidth: 1.5, fill: "#3f9a5a", fillStyle: "hachure", hachureGap: 3, seed: 2111 + j })));
          const balls = svgEl("g", { class: "t-balls" });
          [[-20, 30, "#e8432e"], [16, 22, "#f6c945"], [-4, 8, "#4a8fe0"], [22, 40, "#ef5a7a"], [-14, -12, "#f6c945"], [8, -26, "#e8432e"]].forEach(([dx, dy, col], j) => { const b = svgEl("g", { class: "t-ball" }); b.append(rc.circle(tx + dx, ty + dy, 9, { stroke: "#1f1a2a", strokeWidth: 1, fill: col, fillStyle: "solid", seed: 2120 + j })); balls.append(b); });
          g.append(balls);
          const st = svgEl("g", { class: "t-topstar" });
          st.append(rc.path(starD(tx, ty - 80, 11), { stroke: "#b57a10", strokeWidth: 1.3, fill: "#f7c933", fillStyle: "solid", seed: 2130 }));
          g.append(st);
        });
        if (anim) {
          loop(G.to(tree.querySelectorAll(".t-ball"), { opacity: 0.35, duration: 0.5, yoyo: true, repeat: -1, stagger: { each: 0.25, repeat: -1, yoyo: true } }));
          loop(G.to(tree.querySelector(".t-topstar"), { scale: 1.25, rotation: 20, svgOrigin: `${tx} ${ty - 80}`, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        }
      }
      // a snowman in the left margin, its arms waving
      {
        const sx = leftX, sy = H * 0.62;
        const sm = mover("t-snowman", (g) => {
          g.append(rc.circle(sx, sy + 26, 50, { ...pen, stroke: "#8aa0c0", fill: "#ffffff", fillStyle: "solid", seed: 2140 }));
          g.append(rc.circle(sx, sy - 10, 34, { ...pen, stroke: "#8aa0c0", fill: "#ffffff", fillStyle: "solid", seed: 2141 }));
          g.append(rc.rectangle(sx - 12, sy - 44, 24, 18, { stroke: "#1f1a2a", strokeWidth: 1.3, fill: "#2a2230", fillStyle: "solid", seed: 2142 }));
          g.append(rc.line(sx - 18, sy - 26, sx + 18, sy - 26, { stroke: "#1f1a2a", strokeWidth: 2.4, seed: 2143 }));
          g.append(rc.circle(sx - 6, sy - 14, 4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 2144 }));
          g.append(rc.circle(sx + 6, sy - 14, 4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 2145 }));
          g.append(rc.polygon([[sx, sy - 9], [sx + 16, sy - 6], [sx, sy - 4]], { stroke: "#c8601a", strokeWidth: 1, fill: "#f08a24", fillStyle: "solid", seed: 2146 }));
          g.append(rc.path(`M ${sx - 14} ${sy + 4} L ${sx + 14} ${sy + 4} L ${sx + 10} ${sy + 22}`, { stroke: "#d93a2e", strokeWidth: 4, roughness: 0.8, seed: 2147 }));
          const arm = svgEl("g", { class: "t-smarm" });
          arm.append(rc.path(`M ${sx + 22} ${sy + 18} L ${sx + 44} ${sy - 4} M ${sx + 38} ${sy + 2} L ${sx + 46} ${sy + 6}`, { stroke: "#7a4a1c", strokeWidth: 2, seed: 2148 }));
          g.append(arm);
          g.append(rc.path(`M ${sx - 22} ${sy + 18} L ${sx - 42} ${sy + 4}`, { stroke: "#7a4a1c", strokeWidth: 2, seed: 2149 }));
        });
        G.set(sm, { scale: narrow ? 0.7 : 1, svgOrigin: `${sx} ${sy}` });
        if (anim) loop(G.to(sm.querySelector(".t-smarm"), { rotation: -22, svgOrigin: `${sx + 22} ${sy + 18}`, duration: 0.35, yoyo: true, repeat: -1, repeatDelay: 0.2, ease: "sine.inOut" }));
      }
      // fairy lights under the string of stars
      if (stars.length) {
        const lights = svgEl("g", { class: "t-lights" });
        deco.append(lights);
        const cols = ["#e8432e", "#3f9a5a", "#4a8fe0", "#f6c945"];
        stars.forEach(([bx, by], i) => { const b = svgEl("g", { class: "t-bulb" }); b.append(rc.ellipse(bx + 22, by - 12, 8, 11, { stroke: "#1f1a2a", strokeWidth: 1, fill: cols[i % 4], fillStyle: "solid", seed: 2160 + i })); lights.append(b); });
        if (anim) loop(G.to(lights.children, { opacity: 0.25, duration: 0.4, yoyo: true, repeat: -1, stagger: { each: 0.18, repeat: -1, yoyo: true } }));
      }
    }

    const newYearToo = theme === "birthday" && THEMES.newyear.when(today(), today().getFullYear());
    if (theme === "newyear" || newYearToo) {
      rain("t-confetti", narrow ? 16 : 34, (i) => { const g = svgEl("g"); g.append(rc.rectangle(-3, -5, 6, 10, { stroke: "none", fill: ["#e8432e", "#f6c945", "#4a8fe0", "#3fb39a", "#ef5a7a"][i % 5], fillStyle: "solid", seed: 2200 + i })); return g; }, { slow: 8 });
      // fireworks burst over the page, one after another
      if (anim) {
        const sky = svgEl("g", { class: "t-fireworks" });
        deco.append(sky);
        loop(G.timeline({ repeat: -1, repeatDelay: 1.1 }).call(() => {
          const fx = R(W * 0.1, W * 0.9), fy = R(40, Math.min(220, H * 0.25)), col = ["#e8432e", "#f6c945", "#4a8fe0", "#ef5a7a", "#3fb39a"][Math.floor(R(0, 5))];
          const burst = svgEl("g");
          for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; burst.append(rc.line(0, 0, Math.cos(a) * 14, Math.sin(a) * 14, { stroke: col, strokeWidth: 2.2, roughness: 0.6, seed: 2230 + i })); }
          sky.append(burst);
          G.timeline({ onComplete: () => burst.remove() }).fromTo(burst, { x: fx, y: fy, scale: 0.2, opacity: 1, svgOrigin: "0 0" }, { scale: 3, duration: 0.9, ease: "power2.out" }).to(burst, { opacity: 0, y: fy + 20, duration: 0.6 }, "-=0.4");
        }));
      }
      if (!narrow && !newYearToo) {
        const year = new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear();
        const sign = mover("t-banner", (g) => {
          g.append(rc.rectangle(rightX - 52, H * 0.3, 104, 74, { stroke: "#b57a10", strokeWidth: 1.6, fill: "#fff3c4", fillStyle: "solid", seed: 2240 }));
          [["Happy", 22], ["New Year", 44], [String(year), 66]].forEach(([t, dy]) => { const tx = svgEl("text", { x: rightX, y: H * 0.3 + dy, class: "t-word" }); tx.textContent = t; g.append(tx); });
        });
        if (anim) loop(G.to(sign, { rotation: 3, svgOrigin: `${rightX} ${H * 0.3}`, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }

    if (theme === "tet") {
      // red lanterns hang from the string of stars and sway
      // only from the stars clear of the title, so the lanterns never hide it
      const title = document.querySelector(".cx-title"), dr = deco.getBoundingClientRect();
      let tr = null;
      if (title) { const r = document.createRange(); r.selectNodeContents(title); tr = r.getBoundingClientRect(); }
      const clear = tr && tr.width ? stars.filter(([bx]) => bx + dr.left < tr.left - 24 || bx + dr.left > tr.right + 24) : stars.filter((_, i) => i % 3 === 1);
      clear.forEach(([bx, by], i) => {
        const ln = mover("t-lantern", (g) => {
          g.append(rc.line(bx, by - 6, bx, by + 16, { stroke: "#7a4a1c", strokeWidth: 1.2, seed: 2300 + i }));
          g.append(rc.ellipse(bx, by + 34, 34, 38, { stroke: "#9a2a1a", strokeWidth: 1.5, fill: "#e8432e", fillStyle: "hachure", hachureGap: 2.6, seed: 2301 + i }));
          g.append(rc.rectangle(bx - 9, by + 13, 18, 4, { stroke: "#b57a10", strokeWidth: 1, fill: "#f6c945", fillStyle: "solid", seed: 2302 }));
          g.append(rc.rectangle(bx - 9, by + 51, 18, 4, { stroke: "#b57a10", strokeWidth: 1, fill: "#f6c945", fillStyle: "solid", seed: 2303 }));
          g.append(rc.path(`M ${bx - 4} ${by + 56} L ${bx - 5} ${by + 72} M ${bx} ${by + 56} L ${bx} ${by + 74} M ${bx + 4} ${by + 56} L ${bx + 5} ${by + 72}`, { stroke: "#f6c945", strokeWidth: 1.4, seed: 2304 }));
        });
        if (anim) loop(G.to(ln, { rotation: i % 2 ? 7 : -7, svgOrigin: `${bx} ${by - 6}`, duration: 1.4 + i * 0.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      });
      // an apricot branch (hoa mai) in the left margin, dropping petals
      {
        const bx = narrow ? 10 : 20, by = H * 0.56;
        const branch = mover("t-mai", (g) => {
          g.append(rc.path(`M ${bx} ${by + 90} Q ${bx + 40} ${by + 40} ${bx + 70} ${by - 30} M ${bx + 34} ${by + 46} Q ${bx + 70} ${by + 40} ${bx + 104} ${by + 10} M ${bx + 56} ${by} Q ${bx + 30} ${by - 30} ${bx + 20} ${by - 60}`, { stroke: "#5a3a1a", strokeWidth: 3, roughness: 1.3, seed: 2310 }));
          [[70, -30], [104, 10], [20, -60], [50, 30], [86, 26], [36, -20], [62, -6]].forEach(([dx, dy], j) => {
            for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.append(rc.circle(bx + dx + Math.cos(a) * 6, by + dy + Math.sin(a) * 6, 8, { stroke: "#c89a10", strokeWidth: 0.8, fill: "#f6c945", fillStyle: "solid", seed: 2320 + j * 5 + p })); }
            g.append(rc.circle(bx + dx, by + dy, 4, { stroke: "none", fill: "#e8632e", fillStyle: "solid", seed: 2360 + j }));
          });
        });
        G.set(branch, { scale: narrow ? 0.7 : 1, svgOrigin: `${bx} ${by + 90}` });
        if (anim) {
          const petals = svgEl("g", { class: "t-petals" });
          deco.append(petals);
          loop(G.timeline({ repeat: -1, repeatDelay: 0.7 }).call(() => {
            const p = svgEl("g");
            p.append(rc.circle(0, 0, 7, { stroke: "#c89a10", strokeWidth: 0.8, fill: "#f6c945", fillStyle: "solid", seed: 2370 }));
            petals.append(p);
            const x0 = bx + R(20, 100), y0 = by + R(-50, 20);
            G.timeline({ onComplete: () => p.remove() }).fromTo(p, { x: x0, y: y0, opacity: 1 }, { x: x0 + R(30, 90), y: y0 + R(120, 220), rotation: R(-200, 200), duration: R(3, 5), ease: "sine.in" }).to(p, { opacity: 0, duration: 0.6 }, "-=0.6");
          }));
        }
      }
      // a string of firecrackers in the right margin goes off every so often
      if (!narrow) {
        const fx = rightX, fy = H * 0.3;
        const cr = mover("t-crackers", (g) => {
          g.append(rc.line(fx, fy - 20, fx, fy + 130, { stroke: "#7a4a1c", strokeWidth: 1.4, seed: 2380 }));
          for (let i = 0; i < 7; i++) { const c = svgEl("g", { class: "t-cracker" }); c.append(rc.rectangle(fx + (i % 2 ? 2 : -14), fy + i * 18, 12, 16, { stroke: "#9a2a1a", strokeWidth: 1.2, fill: "#e8432e", fillStyle: "solid", seed: 2381 + i })); c.append(rc.line(fx + (i % 2 ? 2 : -14), fy + i * 18 + 6, fx + (i % 2 ? 14 : -2), fy + i * 18 + 6, { stroke: "#f6c945", strokeWidth: 1.4, seed: 2390 + i })); g.append(c); }
        });
        if (anim) {
          const pops = [...cr.querySelectorAll(".t-cracker")].reverse();
          loop(G.timeline({ repeat: -1, repeatDelay: 9 })
            .to(pops, { opacity: 0, scale: 1.6, svgOrigin: `${fx} ${fy + 60}`, duration: 0.08, stagger: { each: 0.16, onStart() { const t = this.targets()[0]; const b = t.getBBox(); const w = svgEl("text", { x: b.x + R(-30, 30), y: b.y + R(-6, 10), class: "t-pop" }); w.textContent = Math.random() < 0.5 ? "đùng!" : "pop!"; deco.append(w); G.timeline({ onComplete: () => w.remove() }).fromTo(w, { scale: 0.3, opacity: 1, svgOrigin: `${b.x} ${b.y}` }, { scale: 1.2, duration: 0.25, ease: "back.out(3)" }).to(w, { opacity: 0, y: -14, duration: 0.5 }); } } })
            .to(pops, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.05 }, "+=2"));
        }
      }
      // the lion dance (múa lân) bounces along the bottom of the page
      const lion = mover("t-lion", (g) => {
        g.append(rc.path("M 10 0 Q 40 -16 70 0 Q 60 14 10 12 Z", { stroke: "#9a2a1a", strokeWidth: 1.4, fill: "#f6c945", fillStyle: "hachure", hachureGap: 2.4, seed: 2400 }));
        g.append(rc.path("M 16 -2 Q 30 -6 44 -2 M 34 -6 Q 48 -10 62 -4", { stroke: "#e8432e", strokeWidth: 2, seed: 2401 }));
        g.append(rc.rectangle(-30, -38, 46, 40, { stroke: "#9a2a1a", strokeWidth: 1.6, fill: "#e8432e", fillStyle: "hachure", hachureGap: 2.4, seed: 2402 }));
        g.append(rc.path("M -30 -38 L -34 -52 L -20 -40 M 16 -38 L 20 -52 L 6 -40", { stroke: "#b57a10", strokeWidth: 1.6, fill: "#f6c945", fillStyle: "solid", seed: 2403 }));
        g.append(rc.circle(-16, -24, 12, { stroke: "#1f1a2a", strokeWidth: 1.2, fill: "#ffffff", fillStyle: "solid", seed: 2404 }));
        g.append(rc.circle(2, -24, 12, { stroke: "#1f1a2a", strokeWidth: 1.2, fill: "#ffffff", fillStyle: "solid", seed: 2405 }));
        g.append(rc.circle(-15, -23, 5, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 2406 }));
        g.append(rc.circle(3, -23, 5, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 2407 }));
        g.append(rc.path("M -24 -8 Q -7 2 10 -8", { stroke: "#1f1a2a", strokeWidth: 1.6, fill: "#ffffff", fillStyle: "solid", seed: 2408 }));
        g.append(rc.path("M -6 2 L -12 14 M 4 2 L 8 14 M 30 12 L 26 22 M 52 12 L 56 22", { stroke: "#1f1a2a", strokeWidth: 2, seed: 2409 }));
      });
      across(lion, H - 46, 12, 14, 12);
    }

    if (theme === "midautumn") {
      // the full moon, with Cuội sitting under his banyan tree
      if (!narrow) {
        const mx = rightX - 20, my = H * 0.32;
        const moon = mover("t-fullmoon", (g) => {
          g.append(rc.circle(mx, my, 104, { stroke: "#c89a10", strokeWidth: 1.6, fill: "#fbe39a", fillStyle: "hachure", hachureGap: 3, seed: 2500 }));
          g.append(rc.path(`M ${mx + 10} ${my + 30} L ${mx + 12} ${my - 4} M ${mx + 12} ${my - 4} Q ${mx - 6} ${my - 16} ${mx - 16} ${my - 12} M ${mx + 12} ${my - 4} Q ${mx + 26} ${my - 20} ${mx + 34} ${my - 12}`, { stroke: "#8a6a20", strokeWidth: 2.4, seed: 2501 }));
          g.append(rc.circle(mx + 12, my - 18, 34, { stroke: "#8a6a20", strokeWidth: 1, fill: "rgba(138,106,32,0.35)", fillStyle: "hachure", hachureGap: 2.2, seed: 2502 }));
          g.append(rc.circle(mx - 14, my + 22, 8, { stroke: "#8a6a20", strokeWidth: 1, fill: "rgba(138,106,32,0.45)", fillStyle: "solid", seed: 2503 }));
          g.append(rc.path(`M ${mx - 14} ${my + 26} L ${mx - 14} ${my + 36}`, { stroke: "#8a6a20", strokeWidth: 3, seed: 2504 }));
          g.append(rc.path(`M ${mx - 30} ${my + 32} q -2 -10 2 -12 q 2 4 0 12 Z M ${mx - 26} ${my + 34} q 4 -12 6 -10 q -2 6 -6 10`, { stroke: "#8a6a20", strokeWidth: 1, fill: "#fffaf0", fillStyle: "solid", seed: 2505 }));
        });
        if (anim) loop(G.to(moon, { scale: 1.04, svgOrigin: `${mx} ${my}`, duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
      // star lanterns drift up the page
      rain("t-lanterns", narrow ? 4 : 7, (i) => { const g = svgEl("g"); g.append(rc.path(starD(0, 0, 13, 6), { stroke: "#9a2a1a", strokeWidth: 1.3, fill: ["#e8432e", "#f6c945", "#ef5a7a"][i % 3], fillStyle: "solid", seed: 2510 + i })); g.append(rc.line(0, 10, 0, 26, { stroke: "#7a4a1c", strokeWidth: 1, seed: 2520 + i })); return g; }, { up: true, slow: 16 });
      // mooncakes on the sand
      if (x.beach) [[0.5, 30], [0.62, 22]].forEach(([t, off], i) => {
        const [bx, by] = x.beach.B(t, off);
        mover("t-mooncake", (g) => {
          g.append(rc.circle(bx, by, 26, { stroke: "#8a5a1a", strokeWidth: 1.4, fill: "#d8a050", fillStyle: "hachure", hachureGap: 2.2, seed: 2530 + i }));
          g.append(rc.circle(bx, by, 14, { stroke: "#8a5a1a", strokeWidth: 1, seed: 2532 + i }));
          g.append(rc.path(`M ${bx - 4} ${by} L ${bx + 4} ${by} M ${bx} ${by - 4} L ${bx} ${by + 4}`, { stroke: "#8a5a1a", strokeWidth: 1, seed: 2534 }));
        });
      });
    }

    if (theme === "valentine") {
      rain("t-hearts", narrow ? 8 : 16, (i) => { const g = svgEl("g"); g.append(rc.path(heartD(0, 0, R(6, 11)), { stroke: "#b8324a", strokeWidth: 1.1, fill: ["#ef5a7a", "#f4a6c0", "#e8432e"][i % 3], fillStyle: "solid", seed: 2600 + i })); return g; }, { up: true, slow: 12 });
      // cupid flies over with his bow
      const cupid = mover("t-cupid", (g) => {
        const wing = svgEl("g", { class: "t-cwing" });
        wing.append(rc.path("M -4 -10 Q -24 -34 -30 -14 Q -18 -12 -4 -4 Z", { stroke: "#9ab4d8", strokeWidth: 1.2, fill: "#ffffff", fillStyle: "solid", seed: 2610 }));
        g.append(wing);
        g.append(rc.circle(0, 0, 26, { stroke: "#c08060", strokeWidth: 1.3, fill: "#f6c9a0", fillStyle: "solid", seed: 2611 }));
        g.append(rc.circle(-2, -16, 18, { stroke: "#c08060", strokeWidth: 1.2, fill: "#f6c9a0", fillStyle: "solid", seed: 2612 }));
        g.append(rc.path("M -10 -22 Q -2 -32 8 -22", { stroke: "#e8b030", strokeWidth: 3, seed: 2613 }));
        g.append(rc.path("M 12 -12 Q 26 0 12 14", { stroke: "#9a5a26", strokeWidth: 2, seed: 2614 }));
        g.append(rc.path("M 12 -12 L 12 14 M 4 1 L 30 1", { stroke: "#7a4a1c", strokeWidth: 1, seed: 2615 }));
        g.append(rc.path(heartD(33, 1, 4), { stroke: "#b8324a", strokeWidth: 1, fill: "#ef5a7a", fillStyle: "solid", seed: 2616 }));
      });
      if (anim) loop(G.to(cupid.querySelector(".t-cwing"), { scaleY: 0.4, svgOrigin: "-4 -4", duration: 0.15, yoyo: true, repeat: -1 }));
      across(cupid, narrow ? 90 : 140, 10, 13, 26);
      // little hearts hang between the stars
      stars.forEach(([bx, by], i) => { if (i % 2) return; const h = mover("t-hheart", (g) => g.append(rc.path(heartD(bx + 22, by - 10, 6), { stroke: "#b8324a", strokeWidth: 1, fill: "#ef5a7a", fillStyle: "solid", seed: 2620 + i }))); if (anim) loop(G.to(h, { scale: 1.25, svgOrigin: `${bx + 22} ${by - 10}`, duration: 0.45, yoyo: true, repeat: -1, ease: "sine.inOut", delay: i * 0.1 })); });
    }

    if (theme === "womensday") {
      rain("t-petals", narrow ? 10 : 22, (i) => { const g = svgEl("g"); g.append(rc.ellipse(0, 0, R(8, 12), R(5, 7), { stroke: "#d0607a", strokeWidth: 0.8, fill: ["#f4a6c0", "#ef7aa0", "#fbd0dc"][i % 3], fillStyle: "solid", seed: 2800 + i })); return g; }, { slow: 11 });
      if (!narrow) {
        const bx = rightX, by = H * 0.42;
        const bq = mover("t-bouquet", (g) => {
          [[-18, -60, "#ef5a7a"], [0, -74, "#f6c945"], [18, -62, "#9a8ee8"], [-8, -48, "#ef7aa0"], [10, -50, "#e8432e"]].forEach(([dx, dy, col], j) => {
            g.append(rc.line(bx, by + 10, bx + dx * 0.8, by + dy + 8, { stroke: "#3f8a3a", strokeWidth: 1.6, seed: 2820 + j }));
            for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.append(rc.circle(bx + dx + Math.cos(a) * 6, by + dy + Math.sin(a) * 6, 9, { stroke: "#9a3a5a", strokeWidth: 0.8, fill: col, fillStyle: "solid", seed: 2830 + j * 5 + p })); }
            g.append(rc.circle(bx + dx, by + dy, 5, { stroke: "none", fill: "#f6c945", fillStyle: "solid", seed: 2860 + j }));
          });
          g.append(rc.polygon([[bx - 26, by - 30], [bx + 26, by - 30], [bx + 6, by + 30], [bx - 6, by + 30]], { stroke: "#a0705a", strokeWidth: 1.4, fill: "#f6e2c0", fillStyle: "hachure", hachureGap: 3, seed: 2870 }));
          g.append(rc.path(`M ${bx - 10} ${by + 4} Q ${bx} ${by + 12} ${bx + 10} ${by + 4} M ${bx} ${by + 8} L ${bx - 8} ${by + 26} M ${bx} ${by + 8} L ${bx + 8} ${by + 26}`, { stroke: "#e8432e", strokeWidth: 2, seed: 2871 }));
        });
        if (anim) loop(G.to(bq, { rotation: 3, svgOrigin: `${bx} ${by + 30}`, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }

    if (theme === "childrensday" || theme === "birthday") {
      rain("t-balloons", narrow ? 6 : 12, (i) => { const g = svgEl("g"); g.append(rc.ellipse(0, 0, 22, 28, { stroke: "#5d6170", strokeWidth: 1.1, fill: ["#e8432e", "#4a8fe0", "#3fb39a", "#f6c945", "#ef5a7a"][i % 5], fillStyle: "solid", seed: 2900 + i })); g.append(rc.path("M 0 14 q 4 10 -2 20 q -4 8 2 16", { stroke: "#5d6170", strokeWidth: 1, seed: 2910 + i })); return g; }, { up: true, slow: 13 });
    }
    if (theme === "childrensday") {
      // two kites tug at their strings
      [[W * 0.2, 150, "#e8432e"], [W * 0.8, 120, "#4a8fe0"]].forEach(([kx, ky, col], i) => {
        if (narrow && i) return;
        const kite = mover("t-kite", (g) => {
          g.append(rc.polygon([[kx, ky - 30], [kx + 22, ky], [kx, ky + 34], [kx - 22, ky]], { stroke: "#2b2f3a", strokeWidth: 1.4, fill: col, fillStyle: "hachure", hachureGap: 2.6, seed: 2920 + i }));
          g.append(rc.path(`M ${kx} ${ky - 30} L ${kx} ${ky + 34} M ${kx - 22} ${ky} L ${kx + 22} ${ky}`, { stroke: "#2b2f3a", strokeWidth: 1, seed: 2922 + i }));
          const tail = svgEl("g", { class: "t-ktail" });
          tail.append(rc.path(`M ${kx} ${ky + 34} q 10 16 -4 30 q -12 14 4 30`, { stroke: "#2b2f3a", strokeWidth: 1.2, seed: 2924 + i }));
          [[2, 52], [-2, 80]].forEach(([dx, dy], j) => tail.append(rc.path(`M ${kx + dx - 6} ${ky + dy - 4} L ${kx + dx + 6} ${ky + dy + 4} M ${kx + dx + 6} ${ky + dy - 4} L ${kx + dx - 6} ${ky + dy + 4}`, { stroke: "#f6c945", strokeWidth: 2.4, seed: 2926 + j })));
          g.append(tail);
          g.append(rc.line(kx, ky + 4, kx + (i ? -120 : 120), H, { stroke: "#8a8f9a", strokeWidth: 0.8, roughness: 0.4, seed: 2928 + i }));
        });
        if (anim) {
          loop(G.to(kite, { rotation: i ? -8 : 8, x: i ? -14 : 14, y: -10, svgOrigin: `${kx} ${ky + 34}`, duration: 2.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
          loop(G.to(kite.querySelector(".t-ktail"), { skewX: 14, svgOrigin: `${kx} ${ky + 34}`, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        }
      });
    }
    if (theme === "teachersday" && !narrow) {
      // the blackboard: someone got their sums wrong, and someone else marked it
      const bx = rightX - 10, by = H * 0.36;
      const board = mover("t-chalkboard", (g) => {
        g.append(rc.rectangle(bx - 62, by - 44, 124, 88, { stroke: "#7a4a1c", strokeWidth: 3, fill: "#2f4a3a", fillStyle: "solid", roughness: 1.2, seed: 3000 }));
        g.append(rc.line(bx - 40, by + 44, bx - 50, by + 80, { stroke: "#7a4a1c", strokeWidth: 3, seed: 3001 }));
        g.append(rc.line(bx + 40, by + 44, bx + 50, by + 80, { stroke: "#7a4a1c", strokeWidth: 3, seed: 3002 }));
        const sum = svgEl("text", { x: bx - 6, y: by - 8, class: "t-chalk" }); sum.textContent = "2 + 2 = 5"; g.append(sum);
        g.append(rc.line(bx + 14, by - 22, bx + 34, by - 2, { stroke: "#e8432e", strokeWidth: 2.4, seed: 3003 }));
        const fix = svgEl("text", { x: bx + 40, y: by + 24, class: "t-chalk t-chalk--red" }); fix.textContent = "4"; g.append(fix);
        const grade = svgEl("text", { x: bx - 34, y: by + 30, class: "t-chalk t-chalk--red" }); grade.textContent = "A+"; g.append(grade);
      });
      const apple = mover("t-apple", (g) => {
        g.append(rc.circle(bx + 52, by + 70, 22, { stroke: "#9a2a1a", strokeWidth: 1.3, fill: "#e8432e", fillStyle: "hachure", hachureGap: 2, seed: 3010 }));
        g.append(rc.path(`M ${bx + 52} ${by + 60} q 2 -8 8 -10`, { stroke: "#5a3a1a", strokeWidth: 2, seed: 3011 }));
        g.append(rc.ellipse(bx + 58, by + 56, 10, 5, { stroke: "#2a5a2a", strokeWidth: 1, fill: "#6fbf5a", fillStyle: "solid", seed: 3012 }));
      });
      if (anim) {
        loop(G.to(board.querySelectorAll(".t-chalk--red"), { scale: 1.15, svgOrigin: `${bx} ${by}`, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.to(apple, { rotation: 6, svgOrigin: `${bx + 52} ${by + 80}`, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }
    if (theme === "birthday") {
      const at = x.beach ? x.beach.B(0.55, 34) : [leftX, H * 0.62];
      const [cx0, cy0] = at;
      const cake = mover("t-cake", (g) => {
        g.append(rc.rectangle(cx0 - 34, cy0 - 26, 68, 30, { stroke: "#8a5a3a", strokeWidth: 1.4, fill: "#f6d2c2", fillStyle: "hachure", hachureGap: 2.4, seed: 3020 }));
        g.append(rc.rectangle(cx0 - 24, cy0 - 48, 48, 22, { stroke: "#8a5a3a", strokeWidth: 1.4, fill: "#fff3c4", fillStyle: "hachure", hachureGap: 2.4, seed: 3021 }));
        g.append(rc.path(`M ${cx0 - 34} ${cy0 - 22} q 8 8 16 0 q 8 8 16 0 q 8 8 16 0 q 8 8 18 0`, { stroke: "#ef5a7a", strokeWidth: 2.4, seed: 3022 }));
        const flames = svgEl("g", { class: "t-flames" });
        [-14, 0, 14].forEach((dx, j) => {
          g.append(rc.rectangle(cx0 + dx - 2, cy0 - 62, 4, 14, { stroke: "none", fill: ["#4a8fe0", "#ef5a7a", "#3fb39a"][j], fillStyle: "solid", seed: 3023 + j }));
          flames.append(rc.ellipse(cx0 + dx, cy0 - 67, 6, 10, { stroke: "none", fill: "#f6a020", fillStyle: "solid", seed: 3026 + j }));
        });
        g.append(flames);
        // a crab-sized bite out of the corner
        g.append(rc.path(`M ${cx0 + 34} ${cy0 - 26} q -8 4 -4 10 q -6 4 4 10`, { stroke: "#8a5a3a", strokeWidth: 1.4, fill: "#f3eee2", fillStyle: "solid", seed: 3029 }));
      });
      if (anim) loop(G.to(cake.querySelector(".t-flames"), { scaleY: 0.7, scaleX: 1.2, svgOrigin: `${cx0} ${cy0 - 62}`, duration: 0.12, yoyo: true, repeat: -1, ease: "steps(2)" }));
      if (!narrow) {
        const sign = mover("t-banner", (g) => {
          g.append(rc.rectangle(rightX - 52, H * 0.3, 104, 56, { stroke: "#b8324a", strokeWidth: 1.6, fill: "#ffe0ea", fillStyle: "solid", seed: 3030 }));
          [["happy", 22], ["birthday!", 44]].forEach(([t, dy]) => { const tx = svgEl("text", { x: rightX, y: H * 0.3 + dy, class: "t-word" }); tx.textContent = t; g.append(tx); });
        });
        if (anim) loop(G.to(sign, { rotation: -3, svgOrigin: `${rightX} ${H * 0.3}`, duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }

    if (theme === "aprilfools") {
      // the sun is in disguise too
      if (x.sun) {
        const [sx, sy, r] = x.sun;
        const g = mover("t-sunglasses", (gg) => {
          gg.append(rc.circle(sx - r * 0.38, sy - r * 0.1, r * 0.62, { stroke: "#1f1a2a", strokeWidth: 2.2, seed: 2700 }));
          gg.append(rc.circle(sx + r * 0.38, sy - r * 0.1, r * 0.62, { stroke: "#1f1a2a", strokeWidth: 2.2, seed: 2701 }));
          gg.append(rc.circle(sx, sy + r * 0.2, r * 0.36, { stroke: "#c06a6a", strokeWidth: 1.2, fill: "#f0a0a0", fillStyle: "solid", seed: 2702 }));
          gg.append(rc.path(`M ${sx - r * 0.5} ${sy + r * 0.42} Q ${sx} ${sy + r * 0.2} ${sx + r * 0.5} ${sy + r * 0.42} Q ${sx} ${sy + r * 0.34} ${sx - r * 0.5} ${sy + r * 0.42} Z`, { stroke: "#1f1a2a", strokeWidth: 1.4, fill: "#2a2230", fillStyle: "solid", seed: 2703 }));
        });
        const sun = deco.querySelector(".d-sun");
        if (sun) sun.append(g);
      }
    }
  }

  // at night: fireflies, the sun asleep in a nightcap, the moon wide awake
  function nightfall(x) {
    const { deco, W, H, narrow, rc, mover, loop, anim, G, svgEl } = x;
    if (anim) {
      const flies = svgEl("g", { class: "t-fireflies" });
      deco.append(flies);
      for (let i = 0; i < (narrow ? 8 : 16); i++) {
        const f = svgEl("g");
        f.append(rc.circle(0, 0, 14, { stroke: "none", fill: "rgba(255,240,140,0.35)", fillStyle: "solid", seed: 3400 + i }));
        f.append(rc.circle(0, 0, 5, { stroke: "none", fill: "#fff6a8", fillStyle: "solid", seed: 3420 + i }));
        flies.append(f);
        const x0 = R(0, W), y0 = R(H * 0.15, H * 0.95);
        G.set(f, { x: x0, y: y0 });
        loop(G.to(f, { x: x0 + R(-80, 80), y: y0 + R(-60, 60), duration: R(3, 6), yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.to(f, { opacity: 0.15, duration: R(0.6, 1.4), yoyo: true, repeat: -1, ease: "sine.inOut", delay: R(0, 2) }));
      }
    }
    if (x.sun) {
      const [sx, sy, r] = x.sun;
      const cap = mover("t-sleepcap", (g) => {
        g.append(rc.circle(sx - r * 0.38, sy - r * 0.12, r * 0.5, { stroke: "none", fill: "#f7c933", fillStyle: "solid", seed: 3440 }));
        g.append(rc.circle(sx + r * 0.38, sy - r * 0.12, r * 0.5, { stroke: "none", fill: "#f7c933", fillStyle: "solid", seed: 3441 }));
        g.append(rc.path(`M ${sx - r * 0.56} ${sy - r * 0.1} Q ${sx - r * 0.38} ${sy + r * 0.05} ${sx - r * 0.2} ${sy - r * 0.1} M ${sx + r * 0.2} ${sy - r * 0.1} Q ${sx + r * 0.38} ${sy + r * 0.05} ${sx + r * 0.56} ${sy - r * 0.1}`, { stroke: "#5a3a1a", strokeWidth: 1.6, seed: 3442 }));
        g.append(rc.path(`M ${sx - r * 0.9} ${sy - r * 0.5} Q ${sx} ${sy - r * 1.6} ${sx + r * 1.3} ${sy - r * 1.5} L ${sx + r * 0.9} ${sy - r * 0.5} Z`, { stroke: "#3c4fb8", strokeWidth: 1.4, fill: "#8fa8f0", fillStyle: "hachure", hachureGap: 2.4, seed: 3443 }));
        g.append(rc.circle(sx + r * 1.32, sy - r * 1.5, r * 0.3, { stroke: "#3c4fb8", strokeWidth: 1, fill: "#ffffff", fillStyle: "solid", seed: 3444 }));
      });
      const sun = deco.querySelector(".d-sun");
      if (sun) sun.append(cap);
    }
    if (x.moon) {
      const [mx, my, r] = x.moon;
      const eye = mover("t-moon-eye", (g) => {
        g.append(rc.circle(mx - r * 0.45, my - r * 0.05, r * 0.42, { stroke: "#2b2f3a", strokeWidth: 1.2, fill: "#ffffff", fillStyle: "solid", seed: 3450 }));
        g.append(rc.circle(mx - r * 0.42, my - r * 0.04, r * 0.18, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 3451 }));
      });
      const moon = deco.querySelector(".d-moon");
      if (moon) moon.append(eye);
    }
  }

  const note = id ? (typeof THEMES[id].note === "function" ? THEMES[id].note() : THEMES[id].note) : null;
  root.Themes = { id, note, list: Object.keys(THEMES), pick, night, dress, decorate };
})(typeof window !== "undefined" ? window : this);
