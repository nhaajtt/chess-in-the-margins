/* The creatures of Chess in the margins, drawn in code with rough.js so every limb can move.
   Each creature is an SVG (viewBox -10 -21 120 120, feet on y = 94, near the bottom edge) built from separate parts:
   legs, tail, body, head, arms or wings, a hat (cap, crown, mitre, battlements) that can fly off,
   a prop, and a face whose eyes and mouth switch between expressions.
   Every part is drawn twice with different seeds; the page shows one copy at a time so the pen line boils.
   The chess sign always sits on the head: a cross on the king's crown, a jewel on the queen's,
   a slit mitre for bishops, battlements for rooks, a horse for knights, small and round for pawns. */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const E = (cx, cy, rx, ry) => `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  const star = (x, y, R, r = R * 0.45) => { let d = ""; for (let i = 0; i < 10; i++) { const rr = i % 2 ? r : R, a = (Math.PI / 5) * i - Math.PI / 2; d += `${i ? "L" : "M"} ${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)} `; } return d + "Z"; };

  const C = {
    cream: "#f8ebcf", orange: "#f2a04a", deep: "#de7a2e", red: "#e2513c", yellow: "#f6c945", sand: "#f2c66c", brown: "#9a5a26",
    white: "#fffaf0", pink: "#f3a0a6", gold: "#f3c33a", indigo: "#6660c8", violet: "#9a8ee8", lav: "#d9d2fa", navy: "#454a92",
    beak: "#f0a040", dark: "#3a2a1a",
  };
  const INK = ["#4a3020", "#3a3478"];

  /* ---------- drawing helpers for one copy of one part ---------- */

  function pen(rc, g, ink, k) {
    let n = 0;
    const shape = (d, fill, o = {}) => {
      const seed = (o.seed || 1) + (n++) * 7 + k * 101;
      const r = o.r ?? 1.15;
      if (fill) {
        if (o.wash !== false) {
          const w = rc.path(d, { stroke: "none", fill, fillStyle: "solid", roughness: r * 0.8, seed });
          w.setAttribute("class", "fl wash");
          w.setAttribute("opacity", o.washOp || "0.5");
          g.append(w);
        }
        const f = rc.path(d, { stroke: "none", fill, fillStyle: o.style || "hachure", hachureGap: o.gap || 2.4, fillWeight: o.weight || 1.5, hachureAngle: o.angle ?? (-50 + ((n * 37) % 80)), roughness: r, seed: seed + 1 });
        f.setAttribute("class", "fl");
        g.append(f);
      }
      if (o.line !== false) {
        const s = rc.path(d, { stroke: o.ink || ink, strokeWidth: o.sw || 1.9, roughness: r, bowing: 1, fill: "none", seed: seed + 3 });
        s.setAttribute("class", "ol");
        g.append(s);
      }
    };
    const line = (d, o = {}) => {
      const s = rc.path(d, { stroke: o.ink || ink, strokeWidth: o.sw || 1.7, roughness: o.r ?? 1.1, bowing: 1, fill: "none", seed: (o.seed || 5) + (n++) * 7 + k * 101 });
      s.setAttribute("class", "ol");
      g.append(s);
    };
    return { shape, line };
  }

  /* ---------- the twelve creatures ---------- */
  // parts are listed back to front; o = the joint each part turns on

  const castleTop = "M26 48 L26 30 L35 30 L35 37 L45 37 L45 30 L55 30 L55 37 L65 37 L65 30 L74 30 L74 48 Z";
  const crownCross = (s) => {
    s.shape("M36 42 L37 30 L43 36 L50 28 L57 36 L63 30 L64 42 Z", C.gold, { style: "zigzag", gap: 2 });
    s.line("M50 29 L50 15 M45 20 L55 20", { sw: 2.6, ink: "#8a5a10" });
    s.shape(E(40, 38, 1.6, 1.6), C.red, { line: false, wash: false, style: "solid" });
    s.shape(E(60, 38, 1.6, 1.6), C.red, { line: false, wash: false, style: "solid" });
  };
  const crownJewel = (s, y = 50) => {
    s.shape(`M34 ${y} L35 ${y - 14} L42 ${y - 7} L50 ${y - 18} L58 ${y - 7} L65 ${y - 14} L66 ${y} Z`, C.gold, { style: "zigzag", gap: 2 });
    s.shape(E(50, y - 21, 3.8, 3.8), C.red, { sw: 1.4 });
    s.shape(E(35, y - 15, 1.8, 1.8), C.red, { line: false, wash: false, style: "solid" });
    s.shape(E(65, y - 15, 1.8, 1.8), C.red, { line: false, wash: false, style: "solid" });
  };
  const horseLegs = (fill, hoof, stripes) => [36, 43, 66, 73].map((x, i) => ({
    n: `leg${i}`, o: [x, 70], d: (s) => {
      s.shape(`M ${x - 3} 69 L ${x - 3.2} 91 L ${x + 3.2} 91 L ${x + 3} 69 Z`, fill, { gap: 2 });
      if (stripes) s.line(`M ${x - 3} 76 L ${x + 3} 77 M ${x - 3} 83 L ${x + 3} 84`, { sw: 1.4 });
      s.shape(E(x, 92, 4, 2.4), hoof, { sw: 1.4 });
    },
  }));

  const SPECS = {
    "w-pawn": { scale: 0.84, parts: [
      { n: "legL", o: [42, 88], d: (s) => s.shape(E(42, 92, 6, 3.4), C.deep) },
      { n: "legR", o: [58, 88], d: (s) => s.shape(E(58, 92, 6, 3.4), C.deep) },
      { n: "body", o: [50, 92], d: (s) => s.shape("M36 91 C33 80 34 66 38 58 L62 58 C66 66 67 80 64 91 Q50 95 36 91 Z", C.cream) },
      { n: "armL", o: [37, 70], d: (s) => s.shape(E(33, 75, 4.2, 6), C.cream) },
      { n: "armR", o: [63, 70], d: (s) => s.shape(E(67, 75, 4.2, 6), C.cream) },
      { n: "hat", o: [50, 62], d: (s) => {
        s.shape("M21 61 C21 40 35 28 50 28 C65 28 79 40 79 61 Q50 69 21 61 Z", C.red, { style: "zigzag", gap: 2.2 });
        [[37, 43, 4.5, 3.5], [55, 36, 5, 3.6], [68, 50, 3.8, 3], [47, 54, 3.5, 2.6], [29, 55, 2.6, 2]].forEach(([x, y, a, b]) => s.shape(E(x, y, a, b), C.white, { sw: 1.1, gap: 1.2, washOp: "0.95" }));
      } },
    ], face: { eyes: [[44, 70], [56, 70]], r: 4.6, mouth: [50, 79, 3.6], cheeks: [[38, 77], [62, 77]] } },

    "b-pawn": { scale: 0.84, blob: true, parts: [
      { n: "legL", o: [40, 88], d: (s) => s.shape(E(40, 92, 6, 3.2), C.indigo) },
      { n: "legR", o: [60, 88], d: (s) => s.shape(E(60, 92, 6, 3.2), C.indigo) },
      { n: "body", o: [50, 92], d: (s) => s.shape("M24 90 C20 64 30 40 50 38 C70 40 80 64 76 90 Q70 85 63 91 Q56 85 50 91 Q44 85 37 91 Q30 85 24 90 Z", C.indigo, { gap: 2.2 }) },
      { n: "armL", o: [27, 66], d: (s) => s.shape(E(22, 70, 4, 6), C.indigo) },
      { n: "armR", o: [73, 66], d: (s) => s.shape(E(78, 70, 4, 6), C.indigo) },
      { n: "hat", o: [50, 40], d: (s) => { s.line("M50 39 Q47 31 51 23", { sw: 1.8 }); s.shape(star(51, 19, 6.5), C.gold, { style: "solid", sw: 1.4 }); } },
    ], face: { eyes: [[42, 60], [58, 60]], r: 6.2, mouth: [50, 73, 3.6], cheeks: [[34, 69], [66, 69]] } },

    "w-rook": { parts: [
      { n: "legL", o: [39, 89], d: (s) => s.shape(E(39, 93, 6, 3), C.deep) },
      { n: "legR", o: [61, 89], d: (s) => s.shape(E(61, 93, 6, 3), C.deep) },
      { n: "body", o: [50, 92], d: (s) => {
        s.shape("M29 92 L31 46 L69 46 L71 92 Z", C.sand);
        s.shape("M43 92 L43 82 Q50 74 57 82 L57 92 Z", C.brown, { gap: 1.8 });
        s.line("M33 76 L39 76 M62 70 L67 70 M34 86 L40 86", { sw: 1.2 });
      } },
      { n: "armL", o: [32, 64], d: (s) => s.shape(E(27, 68, 4.5, 6), C.sand) },
      { n: "armR", o: [68, 64], d: (s) => s.shape(E(73, 68, 4.5, 6), C.sand) },
      { n: "hat", o: [50, 48], d: (s) => { s.shape(castleTop, C.sand, { style: "zigzag" }); s.line("M50 30 L50 13"); s.shape("M50 13 L63 17 L50 22 Z", C.red, { sw: 1.4 }); } },
    ], face: { eyes: [[42, 58], [58, 58]], r: 4.8, mouth: [50, 67, 3.8], cheeks: [[36, 64], [64, 64]] } },

    "b-rook": { parts: [
      { n: "legL", o: [39, 89], d: (s) => s.shape(E(39, 93, 6, 3), C.indigo) },
      { n: "legR", o: [61, 89], d: (s) => s.shape(E(61, 93, 6, 3), C.indigo) },
      { n: "body", o: [50, 92], d: (s) => {
        s.shape("M29 92 Q26 66 31 46 L69 46 Q74 66 71 92 Q50 96 29 92 Z", C.violet, { gap: 2.2 });
        let fur = "";
        for (let i = 0; i < 14; i++) { const y = 50 + i * 3; fur += `M ${29 - (i % 2) * 2} ${y} l -5 ${(i % 3) - 1} M ${71 + (i % 2) * 2} ${y} l 5 ${(i % 3) - 1} `; }
        s.line(fur, { sw: 1.3 });
      } },
      { n: "armL", o: [31, 64], d: (s) => s.shape(E(24, 68, 4.5, 6), C.violet) },
      { n: "armR", o: [69, 64], d: (s) => s.shape(E(76, 68, 4.5, 6), C.violet) },
      { n: "hat", o: [50, 48], d: (s) => { s.shape(castleTop, C.indigo, { style: "zigzag" }); s.shape(star(50, 24, 5), C.gold, { style: "solid", sw: 1.2 }); } },
    ], face: { eyes: [[42, 60], [58, 60]], r: 6, mouth: [50, 72, 3.6], cheeks: [[35, 68], [65, 68]] } },

    "w-knight": { horse: true, parts: [
      ...horseLegs(C.orange, C.brown),
      { n: "tail", o: [79, 60], d: (s) => s.shape("M78 59 C94 54 96 74 86 86 C87 72 82 66 77 63 Z", C.deep, { style: "zigzag" }) },
      { n: "body", o: [56, 90], d: (s) => s.shape(E(56, 63, 25, 13), C.orange) },
      { n: "head", o: [40, 60], d: (s) => {
        s.shape("M33 68 C29 55 27 47 21 43 C13 41 9 35 13 28 C17 21 30 21 36 27 C41 32 43 45 47 57 Z", C.orange);
        s.shape("M27 25 L30 13 L35 25 Z", C.orange, { sw: 1.5 });
        s.shape("M34 24 C44 24 49 38 51 54 C46 47 41 40 36 35 Z", C.deep, { style: "zigzag", gap: 2 });
        s.shape(E(13, 35, 1.3, 1), C.dark, { line: false, wash: false, style: "solid" });
      } },
    ], face: { parent: "head", eyes: [[24, 32]], r: 4.6, mouth: [17, 40, 3], cheeks: [[23, 40]] } },

    "b-knight": { horse: true, parts: [
      ...horseLegs(C.white, C.navy, true),
      { n: "tail", o: [79, 60], d: (s) => { s.line("M78 61 C86 62 88 70 88 78", { sw: 2 }); s.shape("M84 76 L92 80 L86 88 L82 82 Z", C.indigo, { sw: 1.3 }); } },
      { n: "body", o: [56, 90], d: (s) => { s.shape(E(56, 63, 25, 13), C.white, { washOp: "0.9" }); s.line("M44 52 Q47 62 44 74 M53 50 Q56 62 53 76 M62 50 Q65 62 62 76 M71 53 Q74 62 71 72", { sw: 2.2 }); } },
      { n: "head", o: [40, 60], d: (s) => {
        s.shape("M33 68 C29 55 27 47 21 43 C13 41 9 35 13 28 C17 21 30 21 36 27 C41 32 43 45 47 57 Z", C.white, { washOp: "0.9" });
        s.line("M30 50 Q34 46 38 47 M31 58 Q36 54 41 55 M26 42 Q31 39 34 40", { sw: 2 });
        s.shape("M27 25 L30 13 L35 25 Z", C.white, { sw: 1.5 });
        s.shape("M34 24 L38 16 L40 26 L45 19 L45 30 L50 26 L48 38 L53 36 L50 50 Q44 40 36 34 Z", C.violet, { gap: 1.8 });
        s.shape(E(13, 35, 1.3, 1), C.dark, { line: false, wash: false, style: "solid" });
      } },
    ], face: { parent: "head", eyes: [[24, 32]], r: 4.6, mouth: [17, 40, 3], cheeks: [[23, 40]] } },

    "w-bishop": { parts: [
      { n: "legL", o: [43, 89], d: (s) => { s.line("M44 88 L42 93"); s.shape(E(41, 94, 4.5, 2.4), C.deep, { sw: 1.4 }); } },
      { n: "legR", o: [57, 89], d: (s) => { s.line("M56 88 L58 93"); s.shape(E(59, 94, 4.5, 2.4), C.deep, { sw: 1.4 }); } },
      { n: "body", o: [50, 92], d: (s) => s.shape("M32 70 C32 54 42 47 50 47 C58 47 68 54 68 70 C68 84 60 91 50 91 C40 91 32 84 32 70 Z", C.yellow) },
      { n: "armL", o: [33, 70], d: (s) => { s.line("M33 70 L22 63", { sw: 1.8 }); s.line("M22 63 L18 60 M22 63 L19 66", { sw: 1.4 }); } },
      { n: "armR", o: [67, 70], d: (s) => { s.line("M67 70 L78 63", { sw: 1.8 }); s.line("M78 63 L82 60 M78 63 L81 66", { sw: 1.4 }); } },
      { n: "hat", o: [50, 55], d: (s) => {
        s.shape("M30 57 C30 41 40 27 50 11 C60 27 70 41 70 57 Q50 50 30 57 Z", C.deep, { style: "zigzag", gap: 2 });
        s.line("M51 12 L44 33", { sw: 2.6, ink: "#6a3a14" });
        s.line("M31 53 Q50 46 69 53", { sw: 1.4 });
        s.line("M36 40 Q27 31 21 29 M64 40 Q73 31 79 29", { sw: 1.4 });
        s.shape(E(20, 29, 2.6, 2.6), C.brown, { sw: 1.2 });
        s.shape(E(80, 29, 2.6, 2.6), C.brown, { sw: 1.2 });
      } },
    ], face: { eyes: [[43, 66], [57, 66]], r: 4.6, mouth: [50, 76, 3.6], cheeks: [[37, 73], [63, 73]] } },

    "b-bishop": { parts: [
      { n: "legL", o: [42, 89], d: (s) => s.shape(E(42, 93, 5.5, 3), C.navy) },
      { n: "legR", o: [58, 89], d: (s) => s.shape(E(58, 93, 5.5, 3), C.navy) },
      { n: "body", o: [50, 92], d: (s) => { s.shape("M29 92 C29 72 35 60 50 58 C65 60 71 72 71 92 Z", C.violet, { gap: 2.2 }); s.shape(E(50, 61, 16, 13), C.white, { washOp: "0.9", gap: 3 }); s.shape(star(40, 82, 3.5), C.gold, { style: "solid", sw: 1 }); s.shape(star(60, 76, 3), C.gold, { style: "solid", sw: 1 }); } },
      { n: "armL", o: [33, 68], d: (s) => s.shape(E(28, 76, 5, 8), C.violet) },
      { n: "armR", o: [67, 68], d: (s) => s.shape(E(72, 76, 5, 8), C.violet) },
      { n: "hat", o: [50, 51], d: (s) => {
        s.shape(E(50, 51, 24, 5.5), C.indigo, { gap: 2 });
        s.shape("M33 50 C37 36 42 22 48 4 C54 22 60 36 67 50 Q50 46 33 50 Z", C.indigo, { gap: 2 });
        s.line("M49 6 L43 26", { sw: 2.6, ink: "#cfc8ff" });
        s.shape(star(56, 34, 4), C.gold, { style: "solid", sw: 1 });
      } },
    ], face: { eyes: [[44, 60], [56, 60]], r: 4.8, mouth: [50, 68, 3.2], cheeks: [[38, 66], [62, 66]] } },

    "w-queen": { wings: true, parts: [
      { n: "legL", o: [44, 88], d: (s) => { s.line("M45 88 L42 94", { sw: 2 }); s.line("M42 94 L38 95", { sw: 2 }); } },
      { n: "legR", o: [56, 88], d: (s) => { s.line("M55 88 L58 94", { sw: 2 }); s.line("M58 94 L62 95", { sw: 2 }); } },
      { n: "armL", o: [38, 62], d: (s) => s.shape(E(24, 56, 15, 10), C.white, { washOp: "0.7", gap: 3.2 }) },
      { n: "armR", o: [62, 62], d: (s) => s.shape(E(76, 56, 15, 10), C.white, { washOp: "0.7", gap: 3.2 }) },
      { n: "body", o: [50, 92], d: (s) => {
        s.shape(E(50, 69, 20, 22), C.yellow);
        s.shape("M31 74 Q50 70 69 74 L69 79 Q50 75 31 79 Z", C.dark, { gap: 1.4 });
        s.shape("M34 84 Q50 81 66 84 L64 88 Q50 85 36 88 Z", C.dark, { gap: 1.4 });
      } },
      { n: "hat", o: [50, 50], d: (s) => crownJewel(s, 51) },
      { n: "prop", o: [70, 74], d: (s) => { s.line("M70 76 L86 52", { sw: 2.2, ink: C.brown }); s.shape(star(87, 48, 7), C.gold, { style: "solid", sw: 1.4 }); } },
    ], face: { eyes: [[44, 60], [56, 60]], r: 4.4, mouth: [50, 67, 3.4], cheeks: [[38, 65], [62, 65]] } },

    "b-queen": { bird: true, parts: [
      { n: "legL", o: [44, 88], d: (s) => s.line("M45 87 L43 94 M43 94 L39 96 M43 94 L44 97 M43 94 L47 96", { sw: 1.8, ink: C.deep }) },
      { n: "legR", o: [56, 88], d: (s) => s.line("M55 87 L57 94 M57 94 L53 96 M57 94 L56 97 M57 94 L61 96", { sw: 1.8, ink: C.deep }) },
      { n: "body", o: [50, 92], d: (s) => { s.shape(E(50, 67, 22, 24), C.violet, { gap: 2.2 }); s.shape(E(50, 74, 13, 14), C.lav, { gap: 2.4 }); } },
      { n: "armL", o: [31, 60], d: (s) => s.shape("M30 58 C20 64 20 80 27 86 C31 78 33 68 32 58 Z", C.indigo) },
      { n: "armR", o: [69, 60], d: (s) => s.shape("M70 58 C80 64 80 80 73 86 C69 78 67 68 68 58 Z", C.indigo) },
      { n: "hat", o: [50, 46], d: (s) => {
        // a fan of crest feathers behind the crown
        [[-34, 0], [-17, 1], [0, 2], [17, 3], [34, 4]].forEach(([a, k]) => {
          const r = (a * Math.PI) / 180, tx = 50 + Math.sin(r) * 24, ty = 42 - Math.cos(r) * 24;
          s.shape(`M 50 42 Q ${50 + Math.sin(r - 0.25) * 16} ${42 - Math.cos(r - 0.25) * 16} ${tx.toFixed(1)} ${ty.toFixed(1)} Q ${50 + Math.sin(r + 0.25) * 16} ${42 - Math.cos(r + 0.25) * 16} 50 42 Z`, k % 2 ? C.violet : C.indigo, { gap: 1.6, sw: 1.4 });
        });
        crownJewel(s, 49);
      } },
    ], face: { eyes: [[43, 60], [57, 60]], r: 5, mouth: [50, 76, 2.6], beak: true, cheeks: [[37, 67], [63, 67]] } },

    "w-king": { bird: true, parts: [
      { n: "legL", o: [43, 89], d: (s) => s.line("M43 89 L42 94 M42 94 L38 97 M42 94 L42 98 M42 94 L46 97", { sw: 2, ink: C.deep }) },
      { n: "legR", o: [57, 89], d: (s) => s.line("M57 89 L58 94 M58 94 L54 97 M58 94 L58 98 M58 94 L62 97", { sw: 2, ink: C.deep }) },
      { n: "body", o: [50, 92], d: (s) => {
        s.shape("M28 70 C26 51 36 41 50 41 C64 41 74 51 72 70 C72 86 62 93 50 93 C38 93 28 86 28 70 Z", C.orange);
        s.shape("M31 48 L28 36 L40 43 Z", C.orange, { sw: 1.5 });
        s.shape("M69 48 L72 36 L60 43 Z", C.orange, { sw: 1.5 });
        s.shape(E(50, 77, 13, 13), C.cream, { gap: 2.6 });
        s.line("M44 72 l3 3 l3 -3 M50 72 l3 3 l3 -3 M44 80 l3 3 l3 -3 M50 80 l3 3 l3 -3", { sw: 1.1 });
        s.shape(E(42, 56, 9, 9), C.cream, { gap: 3 });
        s.shape(E(58, 56, 9, 9), C.cream, { gap: 3 });
      } },
      { n: "armL", o: [30, 58], d: (s) => s.shape("M29 57 C20 66 20 80 28 87 C32 78 33 66 31 57 Z", C.deep, { style: "zigzag" }) },
      { n: "armR", o: [70, 58], d: (s) => s.shape("M71 57 C80 66 80 80 72 87 C68 78 67 66 69 57 Z", C.deep, { style: "zigzag" }) },
      { n: "hat", o: [50, 42], d: crownCross },
    ], face: { eyes: [[42, 56], [58, 56]], r: 5.4, mouth: [50, 72, 2.6], beak: true, cheeks: [[33, 63], [67, 63]] } },

    "b-king": { bird: true, parts: [
      { n: "legL", o: [42, 90], d: (s) => s.shape(E(42, 94, 7, 3), C.beak, { sw: 1.4 }) },
      { n: "legR", o: [58, 90], d: (s) => s.shape(E(58, 94, 7, 3), C.beak, { sw: 1.4 }) },
      { n: "body", o: [50, 92], d: (s) => {
        s.shape("M28 72 C26 51 36 39 50 39 C64 39 74 51 72 72 C72 88 62 94 50 94 C38 94 28 88 28 72 Z", C.navy, { gap: 2 });
        s.shape("M38 76 C38 60 44 54 50 54 C56 54 62 60 62 76 C62 87 56 90 50 90 C44 90 38 87 38 76 Z", C.white, { washOp: "0.95", gap: 3 });
        s.shape(E(43, 52, 7.5, 7), C.white, { washOp: "0.95", gap: 3, line: false });
        s.shape(E(57, 52, 7.5, 7), C.white, { washOp: "0.95", gap: 3, line: false });
      } },
      { n: "armL", o: [30, 60], d: (s) => s.shape("M29 59 C20 68 18 80 23 87 C28 79 31 69 31 59 Z", C.navy, { gap: 2 }) },
      { n: "armR", o: [70, 60], d: (s) => s.shape("M71 59 C80 68 82 80 77 87 C72 79 69 69 69 59 Z", C.navy, { gap: 2 }) },
      { n: "prop", o: [50, 66], d: (s) => { s.shape("M35 63 Q50 69 65 63 L65 68 Q50 74 35 68 Z", C.red, { gap: 1.8 }); s.shape("M58 68 L62 80 L56 79 L54 69 Z", C.red, { gap: 1.8, sw: 1.4 }); } },
      { n: "hat", o: [50, 41], d: crownCross },
    ], face: { eyes: [[43, 52], [57, 52]], r: 5, mouth: [50, 64, 2.4], beak: true, beakY: 57, cheeks: [[36, 59], [64, 59]] } },
  };

  /* ---------- faces ---------- */

  function face(rc, f, ink) {
    const g = el("g", { class: "p p-face" });
    const soft = { stroke: ink, strokeWidth: 1.6, roughness: 0.55, seed: 3 };
    const eyes = el("g", { class: "eyes" });
    const add = (name, build) => { const v = el("g", { "data-e": name }); build(v); if (name !== "open") v.setAttribute("display", "none"); eyes.append(v); };
    const r = f.r;
    add("open", (v) => f.eyes.forEach(([x, y]) => {
      v.append(rc.ellipse(x, y, r * 2, r * 2.3, { ...soft, fill: "#fffdf6", fillStyle: "solid" }));
      const p = el("g", { class: "pup" });
      p.append(rc.circle(x, y + r * 0.18, r * 1.25, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", roughness: 0.4, seed: 4 }));
      p.append(rc.circle(x - r * 0.28, y - r * 0.12, r * 0.5, { stroke: "none", fill: "#ffffff", fillStyle: "solid", roughness: 0.2, seed: 5 }));
      v.append(p);
    }));
    add("closed", (v) => f.eyes.forEach(([x, y]) => v.append(rc.path(`M ${x - r} ${y} Q ${x} ${y + r * 0.9} ${x + r} ${y}`, { ...soft, strokeWidth: 1.9 }))));
    add("happy", (v) => f.eyes.forEach(([x, y]) => v.append(rc.path(`M ${x - r} ${y + r * 0.4} Q ${x} ${y - r * 1.1} ${x + r} ${y + r * 0.4}`, { ...soft, strokeWidth: 1.9 }))));
    add("hurt", (v) => f.eyes.forEach(([x, y], i) => {
      const s = (f.eyes.length === 1 || i === 0) ? 1 : -1;
      v.append(rc.path(`M ${x - r * s} ${y - r * 0.8} L ${x + r * 0.7 * s} ${y} L ${x - r * s} ${y + r * 0.8}`, { ...soft, strokeWidth: 2 }));
    }));
    add("dizzy", (v) => f.eyes.forEach(([x, y]) => v.append(rc.path(`M ${x} ${y} m ${-r * 0.2} 0 a ${r * 0.2} ${r * 0.2} 0 1 1 ${r * 0.4} 0 a ${r * 0.5} ${r * 0.5} 0 1 1 ${-r} 0 a ${r * 0.8} ${r * 0.8} 0 1 1 ${r * 1.6} 0`, { ...soft, strokeWidth: 1.5 }))));
    add("scared", (v) => f.eyes.forEach(([x, y]) => {
      v.append(rc.ellipse(x, y, r * 2.4, r * 2.7, { ...soft, fill: "#fffdf6", fillStyle: "solid" }));
      v.append(rc.circle(x, y, r * 0.6, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", roughness: 0.3, seed: 6 }));
    }));
    add("cry", (v) => f.eyes.forEach(([x, y]) => {
      v.append(rc.path(`M ${x - r} ${y + r * 0.5} Q ${x} ${y - r * 0.4} ${x + r} ${y + r * 0.5}`, { ...soft, strokeWidth: 1.9 }));
      v.append(rc.path(`M ${x} ${y + r} q ${-r * 0.5} ${r * 1.1} 0 ${r * 1.5} q ${r * 0.5} ${-r * 0.4} 0 ${-r * 1.5} Z`, { stroke: "#4a7fd0", strokeWidth: 1, fill: "#8ec0f4", fillStyle: "solid", roughness: 0.4, seed: 7 }));
    }));
    g.append(eyes);
    // cheeks, beak
    (f.cheeks || []).forEach(([x, y], i) => g.append(rc.ellipse(x, y, r * 1.5, r * 0.9, { stroke: "none", fill: C.pink, fillStyle: "hachure", hachureGap: 1.4, fillWeight: 1.2, roughness: 0.8, seed: 8 + i })));
    if (f.beak) {
      const by = f.beakY || (f.eyes[0][1] + r * 1.1);
      g.append(rc.path(`M ${50 - r * 0.8} ${by} L ${50 + r * 0.8} ${by} L 50 ${by + r * 1.2} Z`, { stroke: ink, strokeWidth: 1.3, fill: C.beak, fillStyle: "solid", roughness: 0.6, seed: 9 }));
    }
    const [mx, my, ms] = f.mouth;
    const mouths = el("g", { class: "mouths" });
    const addM = (name, d, o = {}) => { const v = el("g", { "data-m": name }); v.append(rc.path(d, { stroke: ink, strokeWidth: 1.6, roughness: 0.6, seed: 10, ...o })); if (name !== (f.beak ? "none" : "smile")) v.setAttribute("display", "none"); mouths.append(v); };
    addM("smile", `M ${mx - ms} ${my} Q ${mx} ${my + ms * 1.1} ${mx + ms} ${my}`);
    addM("open", E(mx, my + ms * 0.3, ms * 0.65, ms * 0.8), { fill: "#a3322a", fillStyle: "solid" });
    addM("grin", `M ${mx - ms} ${my} L ${mx + ms} ${my} Q ${mx} ${my + ms * 1.6} ${mx - ms} ${my} Z`, { fill: "#a3322a", fillStyle: "solid" });
    addM("frown", `M ${mx - ms} ${my + ms * 0.6} Q ${mx} ${my - ms * 0.5} ${mx + ms} ${my + ms * 0.6}`);
    addM("wavy", `M ${mx - ms} ${my} Q ${mx - ms / 2} ${my - ms * 0.6} ${mx} ${my} Q ${mx + ms / 2} ${my + ms * 0.6} ${mx + ms} ${my}`);
    const none = el("g", { "data-m": "none" });
    mouths.append(none);
    if (!f.beak) none.setAttribute("display", "none");
    g.append(mouths);
    return g;
  }

  /* ---------- building ---------- */

  function make(p, opts = {}) {
    const black = (p & 8) !== 0;
    const keyName = `${black ? "b" : "w"}-${["", "pawn", "knight", "bishop", "rook", "queen", "king"][p & 7]}`;
    const spec = SPECS[keyName];
    const ink = INK[black ? 1 : 0];
    const copies = opts.copies || 2;
    const svg = el("svg", { viewBox: "-10 -21 120 120", class: `cr cr--${keyName}`, "aria-hidden": "true", focusable: "false" });
    const rc = root.rough.svg(svg);
    const top = el("g", { class: "cr-root" });
    if (spec.scale) top.setAttribute("transform", `translate(50 94) scale(${spec.scale}) translate(-50 -94)`);
    const inner = el("g", { class: "cr-inner" });
    top.append(inner);
    svg.append(top);
    // a crayon shadow on the paper under its feet
    const sh = el("g", { class: "p p-shadow" });
    sh.append(rc.ellipse(50, 95, spec.horse ? 62 : 46, 7, { stroke: "none", fill: "rgba(60,50,40,0.28)", fillStyle: "hachure", hachureGap: 2.2, fillWeight: 1, roughness: 1, seed: 2 }));
    inner.append(sh);
    const parts = { root: inner, svg, legs: [], arms: [], key: keyName, spec };
    spec.parts.forEach((part, idx) => {
      const g = el("g", { class: `p p-${part.n}` });
      g.dataset.o = `${part.o[0]} ${part.o[1]}`;
      for (let k = 0; k < copies; k++) {
        const c = el("g", { class: `f${k}` });
        part.d(pen(rc, c, ink, k + idx * 13), k);
        g.append(c);
      }
      inner.append(g);
      if (part.n.startsWith("leg")) parts.legs.push(g);
      else if (part.n.startsWith("arm")) parts.arms.push(g);
      else parts[part.n] = g;
    });
    const f = face(rc, spec.face, ink);
    (spec.face.parent === "head" ? parts.head : inner).append(f);
    // hats sit above the face
    if (parts.hat) parts.hat.parentNode.append(parts.hat);
    if (parts.prop && !spec.wings) parts.prop.parentNode.append(parts.prop);
    parts.face = f;
    parts.eyes = f.querySelector(".eyes");
    parts.mouths = f.querySelector(".mouths");
    parts.pupils = [...f.querySelectorAll(".pup")];
    parts.state = "open";
    parts.mouth = spec.face.beak ? "none" : "smile";
    if (root.gsap) for (const g of svg.querySelectorAll(".p[data-o]")) root.gsap.set(g, { svgOrigin: g.dataset.o });
    return parts;
  }

  /* ---------- expressions and motion (need GSAP) ---------- */

  function setFace(c, eyes, mouth) {
    if (eyes) { c.state = eyes; for (const v of c.eyes.children) v.setAttribute("display", v.dataset.e === eyes ? "inline" : "none"); }
    if (mouth) { c.mouth = mouth; for (const v of c.mouths.children) v.setAttribute("display", v.dataset.m === mouth ? "inline" : "none"); }
  }
  const restFace = (c) => setFace(c, "open", c.spec.face.beak ? "none" : "smile");

  // the creature's own life while it waits: it breathes, sways, its hat lags behind, it blinks and looks around
  function live(c) {
    const G = root.gsap, R = (a, b) => a + Math.random() * (b - a);
    const t = [];
    const o = (g) => g.dataset.o;
    t.push(G.to(c.root, { scaleY: 1.04, scaleX: 0.985, svgOrigin: "50 94", duration: R(1, 1.5), yoyo: true, repeat: -1, ease: "sine.inOut" }));
    if (c.spec.blob) t.push(G.to(c.root, { skewX: 3, svgOrigin: "50 94", duration: R(1.3, 1.8), yoyo: true, repeat: -1, ease: "sine.inOut" }));
    if (c.spec.wings) c.arms.forEach((a, i) => t.push(G.to(a, { scaleY: 0.45, rotation: i ? -10 : 10, svgOrigin: o(a), duration: 0.07, yoyo: true, repeat: -1, ease: "none" })));
    else c.arms.forEach((a, i) => t.push(G.fromTo(a, { rotation: i ? -6 : 6, svgOrigin: o(a) }, { rotation: i ? 8 : -8, svgOrigin: o(a), duration: R(0.9, 1.4), yoyo: true, repeat: -1, ease: "sine.inOut", delay: i * 0.3 })));
    if (c.hat) t.push(G.fromTo(c.hat, { rotation: -3, svgOrigin: o(c.hat) }, { rotation: 3, svgOrigin: o(c.hat), duration: R(1.1, 1.6), yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.25 }));
    if (c.head) t.push(G.fromTo(c.head, { rotation: -4, svgOrigin: o(c.head) }, { rotation: 4, svgOrigin: o(c.head), duration: R(1.4, 2), yoyo: true, repeat: -1, ease: "sine.inOut" }));
    if (c.tail) t.push(G.fromTo(c.tail, { rotation: -12, svgOrigin: o(c.tail) }, { rotation: 12, svgOrigin: o(c.tail), duration: R(0.5, 0.8), yoyo: true, repeat: -1, ease: "sine.inOut" }));
    // holiday things that dangle (a lantern on a stick, a balloon) swing as it moves
    (c.swing || []).forEach((g, i) => t.push(G.fromTo(g, { rotation: -9, svgOrigin: g.dataset.o }, { rotation: 9, svgOrigin: g.dataset.o, duration: R(0.9, 1.3), yoyo: true, repeat: -1, ease: "sine.inOut", delay: i * 0.2 })));
    if (c.prop) t.push(G.fromTo(c.prop, { rotation: -6, svgOrigin: o(c.prop) }, { rotation: 6, svgOrigin: o(c.prop), duration: R(1, 1.5), yoyo: true, repeat: -1, ease: "sine.inOut" }));
    // now and then shuffle the feet (horses paw the ground)
    if (c.legs.length) t.push(G.timeline({ repeat: -1, repeatDelay: R(2.5, 6), delay: R(0, 3) })
      .to(c.legs[0], { rotation: c.spec.horse ? -24 : -14, svgOrigin: o(c.legs[0]), duration: 0.16, yoyo: true, repeat: c.spec.horse ? 3 : 1, ease: "sine.inOut" })
      .to(c.legs[c.legs.length - 1], { rotation: 14, svgOrigin: o(c.legs[c.legs.length - 1]), duration: 0.16, yoyo: true, repeat: 1, ease: "sine.inOut" }));
    // eyes wander
    if (c.pupils.length) t.push(G.timeline({ repeat: -1, repeatDelay: R(1.5, 4), delay: R(0, 2) })
      .to(c.pupils, { x: () => R(-1.6, 1.6), y: () => R(-0.8, 0.8), duration: 0.25, ease: "power2.out" })
      .to(c.pupils, { x: 0, y: 0, duration: 0.3, ease: "power2.out", delay: R(0.6, 1.4) }));
    let blinkCall;
    const blink = () => {
      if (c.state === "open") {
        setFace(c, "closed");
        G.delayedCall(0.11, () => { if (c.state === "closed") setFace(c, "open"); });
        if (Math.random() < 0.25) G.delayedCall(0.24, () => { if (c.state === "open") { setFace(c, "closed"); G.delayedCall(0.1, () => { if (c.state === "closed") setFace(c, "open"); }); } });
      }
      blinkCall = G.delayedCall(R(2, 5.5), blink);
    };
    blinkCall = G.delayedCall(R(0.4, 4), blink);
    return {
      tweens: t,
      timeScale(v) { t.forEach((x) => x.timeScale(v)); },
      kill() { t.forEach((x) => x.kill()); if (blinkCall) blinkCall.kill(); },
    };
  }

  // legs and arms swing while it travels; returns the looping timeline
  function walk(c, speed = 0.13) {
    const G = root.gsap;
    const tl = G.timeline({ repeat: -1 });
    c.legs.forEach((l, i) => tl.fromTo(l, { rotation: (i % 2 ? -1 : 1) * 26, svgOrigin: l.dataset.o }, { rotation: (i % 2 ? 1 : -1) * 26, svgOrigin: l.dataset.o, duration: speed, yoyo: true, repeat: 1, ease: "sine.inOut" }, 0));
    if (!c.spec.wings) c.arms.forEach((a, i) => tl.fromTo(a, { rotation: (i ? 1 : -1) * 22, svgOrigin: a.dataset.o }, { rotation: (i ? -1 : 1) * 22, svgOrigin: a.dataset.o, duration: speed, yoyo: true, repeat: 1, ease: "sine.inOut" }, 0));
    return tl;
  }
  function settle(c) {
    const G = root.gsap;
    const limbs = [...c.legs, ...c.arms];
    if (limbs.length) G.to(limbs, { rotation: 0, scaleY: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" });
  }

  // the pen draws the outline, then the crayon colours it in
  function drawIn(c, at = 0, dur = 0.9) {
    const G = root.gsap;
    unbake(c);
    const outlines = [...c.svg.querySelectorAll(".ol path")];
    const fills = [...c.svg.querySelectorAll(".fl")];
    const faceBits = [...c.face.querySelectorAll("path")];
    outlines.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = `${L}`; });
    fills.forEach((p) => { p.style.opacity = "0"; });
    G.set(c.face, { opacity: 0 });
    const tl = G.timeline({ delay: at, onComplete: () => { outlines.forEach((p) => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; }); fills.forEach((p) => { p.style.opacity = ""; }); } });
    tl.to(outlines, { strokeDashoffset: 0, duration: dur * 0.55, ease: "power1.inOut", stagger: { each: dur * 0.3 / Math.max(1, outlines.length), from: "start" } })
      .to(fills, { opacity: 1, duration: dur * 0.45, ease: "none", stagger: { each: dur * 0.25 / Math.max(1, fills.length) } }, `-=${dur * 0.15}`)
      .to(c.face, { opacity: 1, duration: 0.2 }, "-=0.2");
    void faceBits;
    return tl;
  }

  /* ---------- baking: the finished pen and crayon lines become pictures ---------- */
  // A moving limb makes the browser paint its whole creature again, every frame, and a creature is
  // some two thousand little pen strokes. Once a creature is drawn, each copy of each part becomes one
  // picture of exactly those strokes (sharper than it shows on screen), so a frame paints a handful of
  // pictures instead. The parts, joints and boiling copies stay as they were.
  // Creatures of one kind are drawn with the same seeds, so one set of pictures serves them all.
  const baked = new Map();
  // a picture is used only once the browser has it loaded and decoded, so a creature is never left
  // without its lines while a picture is still on its way; the decoded copy is kept so it stays ready
  // pictures are made a few at a time, in the gaps between frames, so making them never
  // holds up the drawing or the creatures on the page
  // (a few can be on their way at once, but each starts only in the gap after a frame)
  const waiting = [];
  let running = 0;
  // right after a frame is painted, with a few milliseconds to spend before the next one
  const quiet = (go) => requestAnimationFrame(() => setTimeout(() => { const t = performance.now(); go({ timeRemaining: () => 6 - (performance.now() - t) }); }, 0));
  function pump() {
    while (running < 4 && waiting.length) {
      running++;
      quiet((deadline) => {
        // in one quiet moment, start as many as fit
        let first = true;
        while (waiting.length && (first || (running < 4 && deadline && deadline.timeRemaining() > 6))) {
          if (!first) running++;
          first = false;
          const job = waiting.shift();
          Promise.resolve().then(job.fn).then(job.ok, job.no).finally(() => { running--; pump(); });
        }
        if (first) running--;
      });
    }
  }
  function inTurn(fn) { return new Promise((ok, no) => { waiting.push({ fn, ok, no }); pump(); }); }
  // the PNG is written by a helper beside the page when the browser has one (a canvas left to itself
  // only writes its PNG when the page is idle, which while creatures are moving can take seconds)
  let helper = null, helperId = 0;
  const helped = new Map();
  try {
    if (root.Worker && root.OffscreenCanvas && root.createImageBitmap) {
      helper = new Worker("/bake-worker.js");
      helper.onmessage = (e) => { const done = helped.get(e.data.id); helped.delete(e.data.id); if (done) done(e.data.blob); };
      helper.onerror = () => { helper = null; helped.forEach((done) => done(null)); helped.clear(); };
    }
  } catch { helper = null; }
  function encodeHere(im, W, H) {
    return new Promise((ok) => {
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      cv.getContext("2d").drawImage(im, 0, 0, W, H);
      cv.toBlob(ok, "image/png");
    });
  }
  function encode(im, W, H) {
    if (!helper) return encodeHere(im, W, H);
    // some browsers cannot hand a drawing over as a bitmap; those write the PNG on the page
    return createImageBitmap(im).then((bitmap) => new Promise((ok) => {
      if (!helper) { bitmap.close(); ok(null); return; }
      const id = ++helperId;
      helped.set(id, ok);
      helper.postMessage({ id, bitmap }, [bitmap]);
    })).catch(() => null).then((blob) => blob || encodeHere(im, W, H));
  }
  function render(src, W, H) {
    return new Promise((ok, no) => {
      const im = new Image(W, H);
      im.onload = () => encode(im, W, H).then((blob) => (blob ? ready(URL.createObjectURL(blob)).then(ok, no) : no(new Error("bake"))), no);
      im.onerror = () => no(new Error("bake"));
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
    });
  }
  const held = new Map();
  function ready(url) {
    const im = new Image();
    im.src = url;
    return im.decode().then(() => { held.set(url, im); return url; }, (e) => { URL.revokeObjectURL(url); throw e; });
  }
  // let a picture go once nothing shows it any more
  function release(url) { held.delete(url); URL.revokeObjectURL(url); }
  function bakeOne(id, g, ppu) {
    const k = `${id}@${ppu}`;
    if (baked.has(k)) return baked.get(k);
    const job = inTurn(() => {
      if (!g.isConnected) throw new Error("gone");
      const b = g.getBBox(), pad = 3;
      const x = b.x - pad, y = b.y - pad, w = b.width + pad * 2, h = b.height + pad * 2;
      const W = Math.max(1, Math.ceil(w * ppu)), H = Math.max(1, Math.ceil(h * ppu));
      const copy = g.cloneNode(true);
      copy.removeAttribute("class");
      copy.removeAttribute("transform");
      copy.removeAttribute("data-o");
      copy.querySelectorAll("[style]").forEach((n) => n.removeAttribute("style"));
      const src = `<svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${h}" width="${W}" height="${H}">${new XMLSerializer().serializeToString(copy)}</svg>`;
      return render(src, W, H).then((url) => ({ url, x, y, w, h }));
    });
    baked.set(k, job);
    job.catch(() => baked.delete(k));
    return job;
  }
  // ppu: picture pixels per drawing unit, picked by the page from the creature's size on screen
  async function bake(c, ppu) {
    if (c.ppu === ppu) return true;
    unbake(c);
    const groups = [];
    c.svg.querySelectorAll(".p").forEach((p) => {
      const copies = [...p.children].filter((n) => /^f\d$/.test(n.getAttribute("class") || ""));
      if (copies.length) copies.forEach((g) => groups.push([`${c.key}/${p.getAttribute("class")}/${g.getAttribute("class")}`, g]));
      else if (p.classList.contains("p-shadow")) groups.push([`${c.key}/shadow`, p]);
    });
    const token = (c.bakeToken = {});
    let pics;
    try { pics = await Promise.all(groups.map(([id, g]) => bakeOne(id, g, ppu))); } catch { return false; }
    if (c.bakeToken !== token) return false;
    c.orig = new Map();
    groups.forEach(([, g], i) => {
      const keep = document.createDocumentFragment();
      keep.append(...g.childNodes);
      c.orig.set(g, keep);
      const pic = pics[i];
      g.append(el("image", { href: pic.url, x: pic.x, y: pic.y, width: pic.w, height: pic.h, preserveAspectRatio: "none" }));
    });
    c.ppu = ppu;
    return true;
  }
  // back to pen strokes, before the pen draws it again
  function unbake(c) {
    offCanvas(c);
    c.bakeToken = null;
    if (c.orig) for (const [g, keep] of c.orig) g.replaceChildren(keep);
    c.orig = null;
    c.ppu = 0;
  }

  /* ---------- painting: a drawn creature is shown on a canvas ---------- */
  // Even as pictures, every joint that moves makes the browser restyle, lay out and paint the whole
  // creature again, every frame, and on a phone thirty-two of them is more than a frame can hold.
  // So once a creature is drawn its svg stays only as the skeleton: gsap still turns its joints and
  // swaps its faces there, the browser no longer draws it, and the page paints it onto one canvas a
  // frame, in the same places and the same order. Each copy of each part (the bits that never move
  // inside themselves) is drawn once from its pen strokes onto a little canvas of its own, which every
  // creature of that kind then shares; only the face is drawn stroke by stroke, since it changes.
  const PAD = 20; // drawing units around the creature, room for the limbs to swing out
  const KNOWN = new Set(["g", "path", "image", "text"]);
  // the svg is read once into plain records; after that only what gsap or the page changed is read again
  // still: for a sprite, drawn from the pen strokes alone, whatever the pen happens to be doing to them
  function compile(n, index, still = false, pics = null, c = null) {
    const kids = [];
    for (const k of n.children) {
      const tag = k.localName, cls = k.getAttribute("class") || "";
      if (!KNOWN.has(tag)) { index.odd = true; continue; }
      const node = { el: k, copy: cls === "f0" ? 0 : cls === "f1" ? 1 : -1, t: null, m: null, hide: false, op: 1 };
      const pic = (pics && pics.get(k)) || (c && tag === "g" && stillGroup(c, k) && faceSprite(c, k));
      if (pic) node.sprite = pic;
      else if (tag === "g") node.kids = compile(k, index, still, pics, c);
      else if (tag === "image") {
        const href = k.getAttribute("href");
        node.im = held.get(href);
        if (!node.im) { node.im = new Image(); node.im.src = href; }
        node.box = ["x", "y", "width", "height"].map((a) => Number(k.getAttribute(a)) || 0);
      } else if (tag === "text") {
        // a plain line of words (the zzz of a sleeper), in the font and colours the page's css gives it
        if (k.childElementCount) { index.odd = true; continue; }
        const cs = getComputedStyle(k);
        node.words = k.textContent;
        node.at = [Number(k.getAttribute("x")) || 0, Number(k.getAttribute("y")) || 0];
        node.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        node.align = { middle: "center", end: "right" }[cs.textAnchor] || "left";
        node.fill = cs.fill && cs.fill !== "none" ? cs.fill : null;
        node.stroke = cs.stroke && cs.stroke !== "none" ? cs.stroke : null;
        node.sw = parseFloat(cs.strokeWidth) || 1;
        node.fo = Number(cs.fillOpacity || 1);
        node.so = Number(cs.strokeOpacity || 1);
      } else {
        node.p = new Path2D(k.getAttribute("d") || "");
        const f = k.getAttribute("fill"), st = k.getAttribute("stroke"), dash = k.getAttribute("stroke-dasharray");
        node.fill = f && f !== "none" ? f : null;
        node.stroke = st && st !== "none" ? st : null;
        node.sw = Number(k.getAttribute("stroke-width") || 1);
        node.cap = k.getAttribute("stroke-linecap") || "butt";
        node.join = k.getAttribute("stroke-linejoin") || "miter";
        node.fo = Number(k.getAttribute("fill-opacity") || 1);
        node.so = Number(k.getAttribute("stroke-opacity") || 1);
        node.dash = dash && dash !== "none" ? dash.split(/[\s,]+/).map(Number) : null;
      }
      look(node, still);
      index.set(k, node);
      kids.push(node);
    }
    return kids;
  }
  const WATCHED = ["transform", "display", "style", "opacity"];
  // what can change between frames: shown or not, how see-through, and where the joint has turned
  // what: the one attribute that changed, when that is known
  function look(node, still = false, what = null) {
    const el = node.el;
    if (what !== "transform") {
      const st = el.style, so = still ? "" : st.opacity;
      node.hide = el.getAttribute("display") === "none" || (!still && (st.display === "none" || st.visibility === "hidden"));
      node.op = so !== "" ? Number(so) : Number(el.getAttribute("opacity") ?? 1);
      if (what) return;
    }
    const s = el.getAttribute("transform");
    if (s === node.t) return;
    node.t = s;
    node.m = null;
    if (!s) return;
    if (s.startsWith("matrix(")) {
      const v = s.slice(7, -1).split(/[\s,]+/).map(Number);
      if (v.length === 6 && v.every(Number.isFinite)) { node.m = v; return; }
    }
    let m = new DOMMatrix();
    for (const t of el.transform.baseVal) m = m.multiply(t.matrix);
    node.m = [m.a, m.b, m.c, m.d, m.e, m.f];
  }
  function paintKids(g, kids, a, b, c, d, e, f, alpha, boil) {
    for (const n of kids) {
      if (n.hide || (n.copy >= 0 && n.copy !== boil)) continue;
      const op = alpha * n.op;
      if (!(op > 0)) continue;
      let A = a, B = b, C = c, D = d, E = e, F = f;
      const m = n.m;
      if (m) {
        A = a * m[0] + c * m[1]; B = b * m[0] + d * m[1];
        C = a * m[2] + c * m[3]; D = b * m[2] + d * m[3];
        E = a * m[4] + c * m[5] + e; F = b * m[4] + d * m[5] + f;
      }
      if (n.kids) { paintKids(g, n.kids, A, B, C, D, E, F, op, boil); continue; }
      g.setTransform(A, B, C, D, E, F);
      g.globalAlpha = op;
      if (n.sprite) g.drawImage(n.sprite.bm || n.sprite.cv, n.sprite.x, n.sprite.y, n.sprite.w, n.sprite.h);
      else if (n.words != null) {
        g.font = n.font; g.textAlign = n.align; g.textBaseline = "alphabetic";
        if (n.fill) { g.globalAlpha = op * n.fo; g.fillStyle = n.fill; g.fillText(n.words, n.at[0], n.at[1]); }
        if (n.stroke) { g.globalAlpha = op * n.so; g.strokeStyle = n.stroke; g.lineWidth = n.sw; g.strokeText(n.words, n.at[0], n.at[1]); }
      }
      else if (n.im) { if (n.im.complete && n.im.naturalWidth) g.drawImage(n.im, n.box[0], n.box[1], n.box[2], n.box[3]); }
      else {
        if (n.fill) { g.globalAlpha = op * n.fo; g.fillStyle = n.fill; g.fill(n.p); }
        if (n.stroke) {
          g.globalAlpha = op * n.so; g.strokeStyle = n.stroke; g.lineWidth = n.sw; g.lineCap = n.cap; g.lineJoin = n.join;
          if (n.dash) g.setLineDash(n.dash);
          g.stroke(n.p);
          if (n.dash) g.setLineDash([]);
        }
      }
    }
  }

  // the sprites, by part and sharpness: { cv, x, y, w, h }, drawn a few at a time in the gaps between frames
  const sprites = new Map(), making = new Map(), boxes = new Map();
  const spriteWork = [];
  let spriteSoon = false;
  function spritePump() {
    if (spriteSoon || !spriteWork.length) return;
    spriteSoon = true;
    quiet(() => {
      spriteSoon = false;
      const t = performance.now();
      while (spriteWork.length && performance.now() - t < 4) {
        const job = spriteWork.shift();
        try { job.ok(job.fn()); } catch (e) { job.no(e); }
      }
      spritePump();
    });
  }
  function makeSprite(id, grp, ppu) {
    const k = `${id}@${ppu}`;
    if (sprites.has(k)) return Promise.resolve(sprites.get(k));
    if (making.has(k)) return making.get(k);
    const job = new Promise((ok, no) => { spriteWork.push({ ok, no, fn: () => drawSprite(id, k, grp, ppu) }); spritePump(); });
    making.set(k, job);
    job.then(() => making.delete(k), () => making.delete(k));
    return job;
  }
  function drawSprite(id, k, grp, ppu, c = null) {
    if (sprites.has(k)) return sprites.get(k);
    if (!grp.isConnected) throw new Error("gone");
    // where its strokes reach, found once while the svg is still drawn
    let b = boxes.get(id);
    if (!b) {
      const r = c ? box(c, grp) : grp.getBBox();
      if (!r || (!r.width && !r.height)) throw new Error("empty");
      b = { x: r.x - 3, y: r.y - 3, w: r.width + 6, h: r.height + 6 };
      boxes.set(id, b);
    }
    const W = Math.max(1, Math.ceil(b.w * ppu)), H = Math.max(1, Math.ceil(b.h * ppu));
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const index = new Map();
    const kids = compile(grp, index, true);
    if (index.odd || !g) throw new Error("odd");
    paintKids(g, kids, ppu, 0, 0, ppu, -b.x * ppu, -b.y * ppu, 1, -1);
    const sp = { cv, bm: null, x: b.x, y: b.y, w: W / ppu, h: H / ppu };
    // a finished bitmap is cheaper to draw again and again than a canvas
    if (root.createImageBitmap) createImageBitmap(cv).then((bm) => { sp.bm = bm; sp.cv = null; }, () => {});
    sprites.set(k, sp);
    return sp;
  }
  // The face changes (eyes blink, pupils wander, the mouth swaps), but the strokes inside each of its
  // bits do not: any group whose insides nothing has moved yet becomes a sprite of its own, moved,
  // shown and hidden as a whole. Once something inside one moves, that group is taken apart for good.
  function stillGroup(c, grp) {
    let paths = 0;
    for (const d of grp.querySelectorAll("*")) {
      const t = d.localName;
      if (t === "path") paths++;
      else if (t !== "g") return false;
      if (c.moving.has(d) || d.hasAttribute("display") || d.hasAttribute("data-o") || /^f\d$/.test(d.getAttribute("class") || "") || (d.getAttribute("style") || "").trim()) return false;
    }
    return paths > 0;
  }
  // creatures of one kind share these too: the same place in the same drawing, the same strokes
  function faceSprite(c, grp) {
    let id = c.key, len = 0;
    for (let n = grp; n && n !== c.svg; n = n.parentNode) id += `/${Array.prototype.indexOf.call(n.parentNode.children, n)}`;
    for (const p of grp.querySelectorAll("path")) len += (p.getAttribute("d") || "").length;
    id += `#${len}`;
    try { return drawSprite(id, `${id}@${c.cvPpu}`, grp, c.cvPpu, c); } catch { return null; }
  }
  // the same bits the pictures are made of: each copy of each part, and the shadow
  function spriteGroups(c) {
    const groups = [];
    c.svg.querySelectorAll(".p").forEach((p) => {
      const copies = [...p.children].filter((n) => /^f\d$/.test(n.getAttribute("class") || ""));
      if (copies.length) copies.forEach((g) => groups.push([`${c.key}/${p.getAttribute("class")}/${g.getAttribute("class")}/${g.childElementCount}`, g]));
      else if (p.classList.contains("p-shadow")) groups.push([`${c.key}/shadow`, p]);
    });
    return groups;
  }
  // put a drawn creature on its canvas at ppu (canvas pixels per drawing unit); false if it stays an svg
  async function toCanvas(c, ppu) {
    if (c.cv && c.cvPpu === ppu) return true;
    if (c.noCanvas || !c.svg.isConnected) return false;
    const token = (c.cvToken = {});
    const groups = spriteGroups(c);
    let pics;
    try { pics = await Promise.all(groups.map(([id, g]) => makeSprite(id, g, ppu))); } catch { return false; }
    if (c.cvToken !== token || !c.svg.isConnected) return false;
    offCanvas(c);
    const map = new Map();
    groups.forEach(([, g], i) => map.set(g, pics[i]));
    return onCanvas(c, ppu, map);
  }
  // measure bits of a creature (its own drawing units, before their own transform) even while its svg
  // is hidden behind the canvas: the svg is shown for the moment it takes
  function measure(c, nodes) {
    const hidden = c.svg.style.display === "none";
    if (hidden) c.svg.style.display = "";
    try { return nodes.map((n) => { try { return n.getBBox(); } catch { return null; } }); }
    finally { if (hidden) c.svg.style.display = "none"; }
  }
  const box = (c, node) => measure(c, [node])[0];
  // from a bit's own drawing units to the svg's, through the joints above it as they are now
  function toSvg(c, el) {
    let m = new DOMMatrix();
    for (let n = el.parentNode; n && n !== c.svg; n = n.parentNode) {
      let t = new DOMMatrix();
      for (const x of n.transform.baseVal) t = t.multiply(x.matrix);
      m = t.multiply(m);
    }
    return m;
  }
  // size the canvas to reach PAD past everything drawn, and past bits just added at their full size
  // (they often grow in from nothing); it only ever grows
  function fit(c, added) {
    const vb = c.svg.viewBox.baseVal, ppu = c.cvPpu;
    const boxes = measure(c, [c.svg, ...added]);
    const b = boxes[0];
    if (!b || (!b.width && !b.height)) return false;
    let x0 = b.x, y0 = b.y, x1 = b.x + b.width, y1 = b.y + b.height;
    added.forEach((el, i) => {
      const r = boxes[i + 1];
      if (!r || (!r.width && !r.height)) return;
      const m = toSvg(c, el);
      for (const [x, y] of [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]]) {
        const p = m.transformPoint({ x, y });
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
    });
    x0 = Math.min(vb.x, x0 - PAD); y0 = Math.min(vb.y, y0 - PAD);
    x1 = Math.max(vb.x + vb.width, x1 + PAD); y1 = Math.max(vb.y + vb.height, y1 + PAD);
    if (c.at) {
      const [ax, ay] = c.at;
      if (x0 >= ax && y0 >= ay && x1 <= ax + c.cv.width / ppu && y1 <= ay + c.cv.height / ppu) return true;
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay);
      x1 = Math.max(x1, ax + c.cv.width / ppu); y1 = Math.max(y1, ay + c.cv.height / ppu);
    }
    const W = Math.ceil((x1 - x0) * ppu), H = Math.ceil((y1 - y0) * ppu);
    c.cv.width = W; c.cv.height = H;
    const pc = (u) => `${(u / vb.width) * 100}%`;
    // margins in percent are of the width, so the canvas takes up exactly the svg's square in the layout
    Object.assign(c.cv.style, { width: pc(W / ppu), marginLeft: pc(x0 - vb.x), marginTop: pc(y0 - vb.y), marginBottom: pc(vb.y + vb.height - (y0 + H / ppu)) });
    c.at = [x0, y0, ppu];
    return true;
  }
  // swap the drawn svg for a canvas of the same size and place; the svg keeps its place in the page's
  // layout through the canvas, which reaches out past it by PAD on every side
  function onCanvas(c, ppu, pics) {
    const cv = document.createElement("canvas");
    const g = cv.getContext("2d");
    if (!g) return false;
    cv.className = "cr-canvas";
    cv.setAttribute("aria-hidden", "true");
    Object.assign(c, { cv, g, at: null, cvPpu: ppu, pics, tree: null });
    c.moving = c.moving || new WeakSet();
    // it shows its own canvas until a stage takes it
    c.solo = true;
    c.added = [];
    c.watch = new MutationObserver((recs) => { if (c.cv) take(c, recs); });
    c.watch.observe(c.svg, { childList: true, subtree: true, attributes: true, attributeFilter: WATCHED });
    if (!fit(c, []) || !paint(c, 0)) { offCanvas(c); return false; }
    c.svg.after(cv);
    c.svg.style.display = "none";
    return true;
  }
  function offCanvas(c) {
    c.cvToken = null;
    if (!c.cv) return;
    c.watch.disconnect();
    c.cv.remove();
    c.svg.style.display = "";
    c.cv = c.g = c.tree = c.watch = c.index = c.pics = c.at = null;
    c.cvPpu = 0;
  }
  // take in what gsap and the page changed since the last frame; false if this one has to stay an svg
  // changes reach here twice over: taken at the start of each frame, and handed over by the browser
  // for whatever happens between frames (a face pulled when a click lands), so none is missed
  function take(c, recs) {
    for (const r of recs) {
      if (r.type === "childList") {
        c.tree = null;
        r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.isConnected) c.added.push(n); });
      } else if (c.tree) {
        const n = c.index.get(r.target);
        if (n) look(n, false, r.attributeName);
        // something inside a sprite moved: that sprite is taken apart
        else if (r.target !== c.svg && r.target.isConnected) { c.moving.add(r.target); c.tree = null; }
      }
    }
  }
  function update(c) {
    if (!c.cv) return false;
    take(c, c.watch.takeRecords());
    if (!c.tree) {
      const added = c.added.splice(0);
      c.index = new Map();
      c.tree = compile(c.svg, c.index, false, c.pics, c);
      // something the canvas cannot draw: this one stays an svg
      if (c.index.odd) { offCanvas(c); c.noCanvas = true; return false; }
      if (added && added.length) fit(c, added);
    }
    return true;
  }
  // paint a creature on its own canvas; boil: which of the two copies of every part shows this frame
  function paint(c, boil) {
    if (!update(c)) return false;
    const g = c.g, [x0, y0, k] = c.at;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.cv.width, c.cv.height);
    paintKids(g, c.tree, k, 0, 0, k, -x0 * k, -y0 * k, 1, boil);
    g.globalAlpha = 1;
    return true;
  }

  /* ---------- the stage: the whole cast on one canvas ---------- */
  // Every canvas still costs the graphics card a round trip of its own each frame, and thirty-two of
  // them add up, so the creatures on the board are all painted onto one canvas laid over them, in the
  // order the page stacks them. Each keeps its own canvas, hidden, holding its place in the page; the
  // stage reads where the page has put, turned, faded or tinted it, and paints it there. One that strays
  // past the stage's edges (on its way to the tray, say) shows its own canvas until it is back.
  const cssMatrix = (s) => new DOMMatrix(s);
  // an element's own transform, about its origin, as the page has it now
  function own(cs) {
    const tf = cs.transform, tr = cs.translate, ro = cs.rotate, sc = cs.scale;
    if (tf === "none" && (!tr || tr === "none") && (!ro || ro === "none") && (!sc || sc === "none")) return null;
    const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
    let m = new DOMMatrix().translate(ox, oy);
    if (tr && tr !== "none") m = m.multiply(cssMatrix(`translate(${tr.trim().split(/\s+/).slice(0, 2).join(",")})`));
    if (ro && ro !== "none") m = m.multiply(cssMatrix(`rotate(${ro.trim().split(/\s+/).pop()})`));
    if (sc && sc !== "none") m = m.multiply(cssMatrix(`scale(${sc.trim().split(/\s+/).slice(0, 2).join(",")})`));
    if (tf !== "none") m = m.multiply(cssMatrix(tf));
    return m.translate(-ox, -oy);
  }
  function stage(layer) {
    const cv = document.createElement("canvas");
    cv.className = "cr-stage";
    cv.setAttribute("aria-hidden", "true");
    const g = cv.getContext("2d");
    if (!g) return null;
    layer.prepend(cv);
    const tints = "filter" in g;
    let lw = 0, lh = 0, D = 1, ml = 0, mt = 0, sized = false, dpr = 0;
    // the layer's size is only read again when it changes
    if (root.ResizeObserver) new ResizeObserver(() => { sized = false; }).observe(layer);
    // the stage reaches past the board on every side, a little more above for the hats
    function size() {
      if (sized && dpr === root.devicePixelRatio) return lw > 0;
      sized = !!root.ResizeObserver; dpr = root.devicePixelRatio;
      const w = layer.clientWidth, h = layer.clientHeight;
      if (!w || !h) { lw = 0; return false; }
      const d = Math.min((root.devicePixelRatio || 1) * 1.25, 4096 / (w * 1.5), 4096 / (h * 1.6));
      if (w === lw && h === lh && d === D) return true;
      lw = w; lh = h; D = d; ml = w * 0.25; mt = h * 0.35;
      const W = w + ml * 2, H = h + mt + h * 0.25;
      cv.width = Math.ceil(W * D); cv.height = Math.ceil(H * D);
      Object.assign(cv.style, { left: `${-ml}px`, top: `${-mt}px`, width: `${W}px`, height: `${H}px` });
      return true;
    }
    function place(c) {
      // from the creature's drawing units to the layer's pixels, through each box the page put it in;
      // worked out again only when one of those boxes has a new style or class (most stand still)
      const body = c.cv.parentElement, vb = c.svg.viewBox.baseVal;
      let key = `${D} ${ml} ${mt}`, n = body;
      for (; n && n !== layer; n = n.parentElement) key += `|${n.getAttribute("style")}|${n.className}`;
      if (n !== layer) return { away: true };
      if (key === c.stageKey) return c.stageAt;
      c.stageKey = key;
      c.stageAt = null;
      let m = new DOMMatrix(), op = 1, filter = "", z = 0, top = null;
      for (n = body; n && n !== layer; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility !== "visible") return null;
        op *= Number(cs.opacity);
        if (cs.filter && cs.filter !== "none") filter = `${cs.filter} ${filter}`;
        const t = own(cs);
        m = new DOMMatrix().translate(n.offsetLeft, n.offsetTop).multiply(t || new DOMMatrix()).multiply(m);
        z = parseInt(cs.zIndex, 10) || 0;
        top = n;
      }
      if (!(op > 0)) return null;
      const k = parseFloat(getComputedStyle(body).width) / vb.width;
      m = new DOMMatrix().translate(ml * D, mt * D).scale(D).multiply(m).scale(k).translate(-vb.x, -vb.y);
      return (c.stageAt = { m, op, filter: filter.trim(), z, top, c });
    }
    // does the creature's whole canvas land on the stage?
    function inside(c, m) {
      const [x0, y0, ppu] = c.at, x1 = x0 + c.cv.width / ppu, y1 = y0 + c.cv.height / ppu;
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
        const p = m.transformPoint({ x, y });
        if (p.x < 0 || p.y < 0 || p.x > cv.width || p.y > cv.height) return false;
      }
      return true;
    }
    const solo = (c, on) => { if (c.solo !== on) { c.solo = on; c.cv.style.visibility = on ? "" : "hidden"; } };
    return {
      // cast: the creatures on canvases, any order; boil as for paint
      paint(cast, boil) {
        if (cv.parentNode !== layer) layer.prepend(cv);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, cv.width, cv.height);
        if (!size()) { cast.forEach((c) => { solo(c, true); paint(c, boil); }); return; }
        const shown = [];
        for (const c of cast) {
          if (!update(c)) continue;
          const at = place(c);
          if (!at) { solo(c, false); continue; }
          if (at.away) { solo(c, true); paint(c, boil); continue; }
          if (!inside(c, at.m) || (at.filter && !tints)) { solo(c, true); paint(c, boil); continue; }
          solo(c, false);
          at.i = Array.prototype.indexOf.call(layer.children, at.top);
          shown.push(at);
        }
        shown.sort((a, b) => a.z - b.z || a.i - b.i);
        let tint = "none";
        for (const { c, m, op, filter } of shown) {
          if (tints && (filter || "none") !== tint) g.filter = tint = filter || "none";
          paintKids(g, c.tree, m.a, m.b, m.c, m.d, m.e, m.f, op, boil);
        }
        if (tint !== "none") g.filter = "none";
        g.globalAlpha = 1;
      },
      // a creature taken off the stage shows its own canvas again
      release(c) { if (c.cv) solo(c, true); },
    };
  }

  // The same for a whole drawing that has its own moving bits (the doodles round the page): only runs of
  // plain, still pen strokes become pictures. Anything with a name (a class or an id), a transform, a
  // style of its own, text, or an animation stays exactly as it is, so everything that moves still moves.
  const PLAIN = new Set(["d", "stroke", "stroke-width", "fill", "fill-opacity", "stroke-opacity", "opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray"]);
  function still(n, moving) {
    if (n.nodeType !== 1) return n.nodeType === 3 && !n.textContent.trim();
    const tag = n.localName;
    if (tag !== "g" && tag !== "path") return false;
    for (const a of n.attributes) {
      if (a.name === "style") { if (a.value.replace(/opacity:\s*1;?/g, "").trim()) return false; continue; }
      if (!PLAIN.has(a.name)) return false;
    }
    if (moving.has(n)) return false;
    for (const c of n.childNodes) if (!still(c, moving)) return false;
    return true;
  }
  function picture(nodes, ppu, recolor) { return inTurn(() => picture1(nodes, ppu, recolor)).catch(() => null); }
  // recolor: { strokes: { from: to }, texts: { from: to } } — what the page shows in CSS, written into the picture
  function tint(copy, recolor) {
    if (!recolor) return;
    [copy, ...copy.querySelectorAll("*")].forEach((m) => {
      const s = (m.getAttribute("stroke") || "").toLowerCase();
      if (recolor.strokes && recolor.strokes[s]) m.setAttribute("stroke", recolor.strokes[s]);
      if (m.localName === "text") { const f = (m.getAttribute("fill") || "").toLowerCase(); if (recolor.texts && recolor.texts[f]) m.setAttribute("fill", recolor.texts[f]); }
    });
  }
  function picture1(nodes, ppu, recolor) {
    if (!nodes.every((n) => n.isConnected)) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      if (n.nodeType !== 1) continue;
      const b = n.getBBox();
      if (!b.width && !b.height) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    if (!(x1 > x0)) return null;
    const pad = 4, x = x0 - pad, y = y0 - pad, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
    const W = Math.max(1, Math.ceil(w * ppu)), H = Math.max(1, Math.ceil(h * ppu));
    const xs = new XMLSerializer();
    let body = "";
    for (const n of nodes) {
      if (n.nodeType !== 1) continue;
      const copy = n.cloneNode(true);
      [copy, ...copy.querySelectorAll("[style]")].forEach((m) => m.removeAttribute("style"));
      tint(copy, recolor);
      body += xs.serializeToString(copy);
    }
    const src = `<svg xmlns="${NS}" viewBox="${x} ${y} ${w} ${h}" width="${W}" height="${H}">${body}</svg>`;
    return render(src, W, H).then((url) => ({ url, x, y, w, h }));
  }
  // returns the picture addresses, so the page can let them go when the drawing is thrown away
  async function flatten(top, ppu, minMoves = 24, recolor = null) {
    const moving = new Set();
    if (root.gsap) root.gsap.globalTimeline.getChildren(true, true, false).forEach((t) => t.targets().forEach((x) => moving.add(x)));
    const runs = [];
    const walkRuns = (g) => {
      let run = [];
      const close = () => { if (run.filter((n) => n.nodeType === 1).length) runs.push(run); run = []; };
      for (const c of [...g.childNodes]) {
        if (still(c, moving)) run.push(c);
        else { close(); if (c.nodeType === 1 && c.localName === "g") walkRuns(c); }
      }
      close();
    };
    walkRuns(top);
    // a picture only pays for itself in place of a good handful of pen moves
    const moves = (p) => ((p.getAttribute("d") || "").match(/[a-z]/gi) || []).length;
    const worth = runs.filter((r) => r.reduce((k, n) => k + (n.nodeType !== 1 ? 0 : n.localName === "path" ? moves(n) : [...n.querySelectorAll("path")].reduce((j, q) => j + moves(q), 0)), 0) >= minMoves);
    const pics = await Promise.all(worth.map((r) => picture(r, ppu, recolor)));
    const urls = [];
    worth.forEach((r, i) => {
      const pic = pics[i];
      const first = r.find((n) => n.nodeType === 1);
      if (!pic || !first || !first.isConnected) { if (pic) release(pic.url); return; }
      first.before(el("image", { href: pic.url, x: pic.x, y: pic.y, width: pic.w, height: pic.h, preserveAspectRatio: "none" }));
      r.forEach((n) => n.remove());
      urls.push(pic.url);
    });
    return urls;
  }

  root.Creature = { make, setFace, restFace, live, walk, settle, drawIn, bake, unbake, toCanvas, offCanvas, paint, stage, box, flatten, release, pen, E, INK, SPECS };
})(typeof window !== "undefined" ? window : this);
