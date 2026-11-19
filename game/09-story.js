/* Chess in the margins, part 9 of 10: the opening story. */
"use strict";

/* ---------- the opening, once per visitor ---------- */

// "your move", written under the board once everything has been drawn
function writeYourMove(at) {
  const y = $("yourmove");
  if (!y || !anim) return;
  G.delayedCall(at, () => {
    // online, only the player whose turn it is gets told
    if (mode === "online" && (game.turn !== human || net.players.length < 2)) return;
    G.fromTo(y, { clipPath: "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0% 0 0)", duration: 1.1, ease: "steps(12)" });
    G.to(y, { opacity: 0, duration: 0.6, delay: 3.5 });
  });
}

// the opening is a short story told in pen. Each scene is written and drawn on the page,
// then an eraser rubs it out from left to right and the next scene is drawn in its place.
const storyLives = [];
// the star of the story: coloured in orange crayon, outlined in purple ink. That is the whole quarrel.
const theStar = (cx, cy, R2, seed = 21) => (rc) => {
  const g = svgEl("g", { class: "st-star" });
  g.append(rc.polygon(starPts(cx, cy, R2, R2 * 0.44), { stroke: "none", fill: "#f39a2e", fillStyle: "hachure", hachureGap: 3.2, fillWeight: 2.4, hachureAngle: -35, roughness: 1.4, seed }));
  g.append(rc.polygon(starPts(cx, cy, R2, R2 * 0.44), { stroke: "#6660c8", strokeWidth: Math.max(2.4, R2 / 22), roughness: 1.2, seed: seed + 1 }));
  g.append(rc.circle(cx - R2 * 0.14, cy - R2 * 0.06, R2 * 0.09, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: seed + 2 }));
  g.append(rc.circle(cx + R2 * 0.14, cy - R2 * 0.06, R2 * 0.09, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: seed + 3 }));
  g.append(rc.arc(cx, cy + R2 * 0.07, R2 * 0.22, R2 * 0.14, 0.3, Math.PI - 0.3, false, { stroke: "#2b2f3a", strokeWidth: 2, seed: seed + 4 }));
  return g;
};
const twinkle = (cx, cy) => (el) => {
  storyLives.push({ kill: G.to(el, { rotation: 8, svgOrigin: `${cx} ${cy}`, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill });
  storyLives.push({ kill: G.to(el, { scale: 1.08, svgOrigin: `${cx} ${cy}`, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill });
};
const hop = (c, h = 18, times = 3, d = 0.18) => G.timeline().to(c.wrap, { y: `-=${h}`, duration: d, yoyo: true, repeat: times * 2 - 1, ease: "power2.out" });
const waveArm = (c, n = 5) => { const a2 = c.arms[c.arms.length - 1]; if (a2 && !c.spec.wings) G.to(a2, { rotation: -130, svgOrigin: a2.dataset.o, duration: 0.2, yoyo: true, repeat: n }); };
const SCENES = [
  {
    draw(sc) {
      sc.write("Chess in the margins", 500, 245, 86, [["Chess", "#c8452e"], [" in the margins", "#3c4fb8"]]);
      // the author's name in navy, its shadow in royal gold just behind it
      sc.write("", 502, 327, 30, [["a little story drawn by ", "rgba(0,0,0,0)"], ["nhaajt", "#c9a227"]]);
      sc.write("", 500, 325, 30, [["a little story drawn by ", "#5d6170"], ["nhaajt", "#14213d"]]);
      sc.write("", 502, 370, 28, [["một câu chuyện nhỏ vẽ bởi ", "rgba(0,0,0,0)"], ["nhaajt", "#c9a227"]], undefined, true);
      sc.write("", 500, 368, 28, [["một câu chuyện nhỏ vẽ bởi ", "#5d6170"], ["nhaajt", "#14213d"]], undefined, true);
      sc.ink((rc) => rc.path("M 300 270 Q 400 284 500 270 T 700 272", { stroke: "#c8452e", strokeWidth: 2.4, roughness: 1.2, seed: 3 }));
      sc.ink(theStar(232, 210, 18, 4), twinkle(232, 210));
      sc.ink(theStar(768, 212, 14, 8), twinkle(768, 212));
      sc.creature(6, 120, 400, 120, "happy", false, (c) => waveArm(c));
      sc.creature(14, 760, 400, 120, "happy", false, (c) => waveArm(c));
    },
  },
  {
    en: "Once upon a time, one notebook page had two neighbours.",
    vi: "Ngày xửa ngày xưa, trên một trang vở có hai nhà hàng xóm.",
    hold: 0.8,
    draw(sc) {
      sc.ink((rc) => rc.line(500, 150, 502, 570, { stroke: "#e2483d", strokeWidth: 2.4, roughness: 1, seed: 11 }));
      sc.write("the Orange Meadow", 250, 190, 30, null, "#c8452e");
      sc.write("Đồng Cỏ Cam", 250, 222, 24, null, "#c8452e", true);
      sc.write("the Purple Inkwell", 750, 190, 30, null, "#3c4fb8");
      sc.write("Lọ Mực Tím", 750, 222, 24, null, "#3c4fb8", true);
      sc.ink((rc) => { let d = ""; for (let i = 0; i < 14; i++) { const x = 40 + i * 32; d += `M ${x} 560 l -4 -14 M ${x + 5} 560 l 0 -18 M ${x + 10} 560 l 4 -12 `; } return rc.path(d, { stroke: "#5aa04a", strokeWidth: 1.8, roughness: 1.3, seed: 12 }); });
      sc.ink((rc) => rc.path("M 880 560 L 878 470 Q 878 452 896 452 L 944 452 Q 962 452 962 470 L 960 560 Z", { stroke: "#2b2f3a", strokeWidth: 1.8, fill: "#6660c8", fillStyle: "hachure", hachureGap: 4, roughness: 1.2, seed: 13 }));
      sc.ink((rc) => rc.rectangle(902, 430, 36, 22, { stroke: "#2b2f3a", strokeWidth: 1.6, fill: "#c8955a", fillStyle: "solid", roughness: 1, seed: 14 }));
      sc.creature(6, 60, 300, 140, null, false, (c) => waveArm(c, 3));
      sc.creature(1, 210, 390, 110, null, false, (c) => hop(c, 14, 2));
      sc.creature(2, 320, 360, 140);
      sc.creature(14, 540, 300, 140, null, false, (c) => waveArm(c, 3));
      sc.creature(9, 690, 390, 110, null, false, (c) => hop(c, 14, 2));
      sc.creature(10, 760, 360, 140, null, true);
      sc.pop("good morning!", 130, 290, 24, "#c8452e", 2.4, -4);
      sc.pop("chào buổi sáng!", 610, 290, 24, "#3c4fb8", 2.8, 4);
    },
  },
  {
    en: "They got along fine. Mostly. The mushrooms and the blobs even played tag.",
    vi: "Họ sống khá hoà thuận. Phần lớn là vậy. Nấm và ma blob còn chơi đuổi bắt.",
    hold: 1.4,
    draw(sc) {
      sc.ink((rc) => rc.line(500, 150, 502, 570, { stroke: "#e2483d", strokeWidth: 2.4, roughness: 1, seed: 15 }));
      sc.creature(1, 140, 410, 110, "happy", false, (c) => G.timeline({ repeat: 1, yoyo: true }).to(c.wrap, { x: "+=520", duration: 2.2, ease: "sine.inOut" }));
      sc.creature(9, 300, 410, 110, "scared", false, (c) => G.timeline({ repeat: 1, yoyo: true }).to(c.wrap, { x: "+=520", duration: 2.2, ease: "sine.inOut" }));
      sc.pop("tag!", 500, 380, 40, "#c8452e", 3.2, -8);
      sc.pop("không công bằng!", 500, 430, 26, "#3c4fb8", 4.2, 5);
      sc.creature(3, 760, 230, 100, "happy");
      sc.creature(11, 860, 230, 100, "happy");
    },
  },
  {
    en: "Then one rainy afternoon, someone doodled a star right on the red line.",
    vi: "Rồi một chiều mưa, ai đó vẽ nguệch ngoạc một ngôi sao ngay trên đường kẻ đỏ.",
    hold: 0.8,
    draw(sc) {
      sc.ink((rc) => rc.line(500, 150, 502, 570, { stroke: "#e2483d", strokeWidth: 2.4, roughness: 1, seed: 16 }));
      sc.ink((rc) => { let d = ""; for (let i = 0; i < 26; i++) { const x = 40 + (i * 37) % 920, y = 150 + ((i * 53) % 80); d += `M ${x} ${y} l -6 16 `; } return rc.path(d, { stroke: "#8ec0f4", strokeWidth: 1.6, roughness: 0.8, seed: 17 }); });
      sc.ink((rc) => rc.path("M 420 470 C 450 300 560 300 580 420", { stroke: "#5d6170", strokeWidth: 1.6, strokeLineDash: [6, 8], roughness: 1, seed: 18 }));
      sc.ink(theStar(500, 360, 92, 21), twinkle(500, 360));
      sc.ink((rc) => rc.path("M 380 250 l -16 -16 M 620 250 l 16 -16 M 370 400 l -20 6 M 630 400 l 20 6 M 500 240 l 0 -24", { stroke: "#e0a21a", strokeWidth: 2.4, roughness: 1, seed: 22 }));
      sc.creature(6, 90, 330, 150, "scared", false, (c) => G.to(c.pupils, { x: 2.4, duration: 0.3 }));
      sc.creature(14, 760, 330, 150, "scared", false, (c) => G.to(c.pupils, { x: -2.4, duration: 0.3 }));
      sc.pop("!", 175, 320, 64, "#c8452e", 2.4);
      sc.pop("!", 845, 320, 64, "#3c4fb8", 2.5);
      sc.pop("ooh, shiny", 500, 540, 26, "#5d6170", 3.2);
    },
  },
  {
    en: "“It's coloured in ORANGE crayon,” said the owl king. “So it's ours!”",
    vi: "“Nó được tô bằng sáp CAM,” vua Cú nói. “Vậy nó là của bọn ta!”",
    hold: 0.6,
    draw(sc) {
      sc.ink(theStar(560, 380, 80, 31), (el) => G.fromTo(el.firstChild, { opacity: 0.4 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 5 }));
      sc.ink((rc) => rc.path("M 330 330 Q 400 300 470 350", { stroke: "#c8452e", strokeWidth: 2.4, roughness: 1, seed: 33 }));
      sc.ink((rc) => rc.path("M 456 336 L 472 352 L 450 356", { stroke: "#c8452e", strokeWidth: 2.4, roughness: 1, seed: 34 }));
      sc.creature(6, 140, 300, 190, "happy", false, (c) => { hop(c, 22, 2); const a2 = c.arms[1]; if (a2) G.to(a2, { rotation: -80, svgOrigin: a2.dataset.o, duration: 0.3 }); });
      sc.creature(1, 40, 440, 90, "happy", false, (c) => hop(c, 12, 4, 0.15));
      sc.creature(2, 330, 440, 110, "happy", false, (c) => hop(c, 12, 4, 0.16));
      sc.pop("ORANGE!", 560, 520, 42, "#c8452e", 2.6, -5);
      sc.pop("CAM!", 700, 260, 34, "#c8452e", 3.0, 6);
    },
  },
  {
    en: "“But the OUTLINE is purple ink,” said the penguin king. “So it's ours!”",
    vi: "“Nhưng NÉT VIỀN là mực tím,” vua Chim Cánh Cụt đáp. “Vậy nó là của bọn ta!”",
    hold: 0.6,
    draw(sc) {
      sc.ink(theStar(440, 380, 80, 41), (el) => G.fromTo(el.children[1], { opacity: 0.2 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 5 }));
      sc.ink((rc) => rc.path("M 670 330 Q 600 300 530 350", { stroke: "#3c4fb8", strokeWidth: 2.4, roughness: 1, seed: 43 }));
      sc.ink((rc) => rc.path("M 544 336 L 528 352 L 550 356", { stroke: "#3c4fb8", strokeWidth: 2.4, roughness: 1, seed: 44 }));
      sc.creature(14, 670, 300, 190, "happy", false, (c) => { hop(c, 22, 2); const a2 = c.arms[0]; if (a2) G.to(a2, { rotation: 80, svgOrigin: a2.dataset.o, duration: 0.3 }); });
      sc.creature(9, 870, 440, 90, "happy", false, (c) => hop(c, 12, 4, 0.15));
      sc.creature(10, 560, 440, 110, "happy", true, (c) => hop(c, 12, 4, 0.16));
      sc.pop("PURPLE!", 440, 520, 42, "#3c4fb8", 2.6, 5);
      sc.pop("TÍM!", 300, 260, 34, "#3c4fb8", 3.0, -6);
    },
  },
  {
    en: "So they pulled. And pulled. The star stretched like chewing gum.",
    vi: "Thế là họ kéo. Kéo mãi. Ngôi sao dãn ra như kẹo cao su.",
    hold: 2.2,
    draw(sc) {
      const rope = sc.ink((rc) => rc.path("M 260 390 Q 500 410 740 390", { stroke: "#7a5a2a", strokeWidth: 3, roughness: 1.4, seed: 51 }));
      sc.ink(theStar(500, 380, 70, 52), (el) => storyLives.push({ kill: G.to(el, { scaleX: 1.45, scaleY: 0.8, svgOrigin: "500 380", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill }));
      void rope;
      sc.creature(6, 120, 300, 170, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "-=18", rotation: -8, svgOrigin: "200 470", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill }));
      sc.creature(14, 710, 300, 170, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "+=18", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill }));
      sc.creature(1, 20, 420, 90, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "-=10", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.1 }).kill }));
      sc.creature(9, 890, 420, 90, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "+=10", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.1 }).kill }));
      sc.pop("hngggh!", 230, 270, 30, "#c8452e", 2.4, -6);
      sc.pop("ugh!!", 790, 270, 30, "#3c4fb8", 2.8, 6);
      sc.pop("boing", 500, 300, 28, "#5d6170", 4.0, -3);
    },
  },
  {
    en: "The pony tried sitting on it. The blob tried swallowing it. Ptui.",
    vi: "Chú ngựa thử ngồi lên nó. Ma blob thử nuốt chửng nó. Phụt.",
    hold: 2.4,
    draw(sc) {
      const star = sc.ink(theStar(500, 430, 60, 61), (el) => {
        G.timeline({ delay: 1.6 })
          .to(el, { scale: 0.2, svgOrigin: "500 430", duration: 0.2 })
          .to(el, { opacity: 0, duration: 0.05 })
          .to(el, { opacity: 1, scale: 1, x: 40, y: -120, rotation: 400, svgOrigin: "500 430", duration: 0.6, ease: "power2.out", delay: 0.6 })
          .to(el, { y: 0, x: 0, rotation: 720, svgOrigin: "500 430", duration: 0.6, ease: "bounce.out" });
      });
      void star;
      sc.creature(2, 380, 230, 150, "happy", false, (c) => G.timeline().to(c.wrap, { y: "+=110", x: "+=40", duration: 0.4, ease: "power2.in" }).to(c.wrap, { y: "-=150", x: "-=120", rotation: -40, duration: 0.5, ease: "power2.out" }).to(c.wrap, { y: "+=40", rotation: 0, duration: 0.4, ease: "bounce.out" }).call(() => CR.setFace(c, "dizzy", "wavy")));
      sc.creature(9, 640, 380, 120, "happy", true, (c) => G.timeline({ delay: 1.2 }).to(c.wrap, { x: "-=110", duration: 0.35, ease: "power2.in" }).to(c.root, { scale: 1.6, svgOrigin: "50 94", duration: 0.25 }).call(() => CR.setFace(c, "hurt", "open")).to(c.root, { scale: 1, svgOrigin: "50 94", duration: 0.25, delay: 0.5 }).to(c.wrap, { x: "+=110", duration: 0.5, ease: "power2.out" }));
      sc.pop("boing!", 420, 330, 34, "#c8452e", 2.6, -8);
      sc.pop("gulp…", 560, 360, 28, "#3c4fb8", 3.4, 4);
      sc.pop("PTUI!", 590, 300, 44, "#3c4fb8", 4.2, -6);
    },
  },
  {
    en: "Then the snail, who had been crossing the page for three days, spoke up.",
    vi: "Rồi chú ốc sên, đã bò ngang trang giấy suốt ba ngày, lên tiếng.",
    hold: 3.0,
    draw(sc) {
      const sn = sc.ink((rc) => {
        const g = svgEl("g", {});
        g.append(rc.path("M 120 470 L 200 470 Q 218 460 210 446 L 218 424 M 210 446 L 200 424", { stroke: "#3c4fb8", strokeWidth: 2.4, roughness: 1, seed: 71 }));
        g.append(rc.circle(140, 446, 56, { stroke: "#b4561d", strokeWidth: 2.4, fill: "#f0c08a", fillStyle: "hachure", hachureGap: 4, roughness: 1, seed: 72 }));
        g.append(rc.path("M 140 446 m -12 0 a 12 12 0 1 1 24 0 a 8 8 0 1 1 -16 0", { stroke: "#b4561d", strokeWidth: 2, seed: 73 }));
        g.append(rc.circle(218, 422, 6, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: 74 }));
        return g;
      }, (el) => storyLives.push({ kill: G.to(el, { x: 260, duration: 9, ease: "none" }).kill }));
      void sn;
      sc.ink((rc) => rc.path("M 520 250 Q 520 190 640 190 L 820 190 Q 900 190 900 250 Q 900 310 820 310 L 580 310 L 500 360 L 530 306 Q 520 296 520 250 Z", { stroke: "#2b2f3a", strokeWidth: 2, fill: "#fffdf6", fillStyle: "solid", roughness: 1.2, seed: 75 }));
      sc.pop("“…why not play for it?”", 710, 245, 30, "#2b2f3a", 2.4);
      sc.pop("“…sao không đánh cờ mà phân xử?”", 710, 285, 22, "#5d6170", 3.0);
      sc.creature(6, 60, 220, 110, "scared", false, (c) => G.to(c.pupils, { x: 2, y: 1.5, duration: 0.3 }));
      sc.creature(14, 230, 220, 110, "scared", false, (c) => G.to(c.pupils, { x: 2, y: 1.5, duration: 0.3 }));
    },
  },
  {
    en: "So they settled it the old way: sixty-four squares, one move at a time.",
    vi: "Thế là họ phân xử theo cách xưa: sáu mươi tư ô cờ, mỗi lượt một nước.",
    hold: 0.6,
    draw(sc) {
      sc.ink((rc) => { let d = ""; for (let i = 0; i <= 4; i++) { d += `M ${380 + i * 60} 250 L ${380 + i * 60} 490 M 380 ${250 + i * 60} L 620 ${250 + i * 60} `; } return rc.path(d, { stroke: "#2b2f3a", strokeWidth: 2.2, roughness: 1.1, seed: 81 }); });
      sc.ink((rc) => { let d = ""; for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) if ((r + f) % 2) { const x = 384 + f * 60, y = 254 + r * 60; for (let i = 0; i < 6; i++) d += `M ${x + 6 + i * 9} ${y + 48} l ${(i % 3) - 1} -10 `; } return rc.path(d, { stroke: "#5aa04a", strokeWidth: 1.6, roughness: 1, seed: 82 }); });
      sc.ink(theStar(500, 200, 30, 83), twinkle(500, 200));
      sc.creature(1, 390, 380, 50, "happy");
      sc.creature(9, 570, 250, 50, "happy");
      sc.creature(6, 130, 330, 150, "open", false, (c) => { const a2 = c.arms[1]; if (a2) G.to(a2, { rotation: -100, svgOrigin: a2.dataset.o, duration: 0.4 }); G.to(c.wrap, { rotation: 10, svgOrigin: "205 480", duration: 0.4, yoyo: true, repeat: 1, delay: 0.6 }); });
      sc.creature(14, 720, 330, 150, "open", false, (c) => { const a2 = c.arms[0]; if (a2) G.to(a2, { rotation: 100, svgOrigin: a2.dataset.o, duration: 0.4 }); G.to(c.wrap, { rotation: -10, svgOrigin: "795 480", duration: 0.4, yoyo: true, repeat: 1, delay: 0.6 }); });
      sc.pop("a fair fight!", 500, 548, 30, "#2b2f3a", 2.6);
    },
  },
  {
    en: "Winner keeps the star. Loser has to draw the next one.",
    vi: "Bên thắng giữ ngôi sao. Bên thua phải vẽ ngôi sao tiếp theo.",
    hold: 0.8,
    draw(sc) {
      sc.ink(theStar(500, 330, 70, 91), (el) => storyLives.push({ kill: G.to(el, { rotation: 360, svgOrigin: "500 330", duration: 4, repeat: -1, ease: "none" }).kill }));
      [1, 2, 6, 3].forEach((pc, i) => sc.creature(pc, 40 + i * 95, 420, 95, "happy", false, (c) => hop(c, 16, 3, 0.16 + i * 0.01)));
      [9, 10, 14, 11].forEach((pc, i) => sc.creature(pc, 590 + i * 95, 420, 95, "happy", false, (c) => hop(c, 16, 3, 0.17 + i * 0.01)));
      sc.pop("your move!", 500, 215, 46, "#c8452e", 3.0, -3);
      sc.pop("tới lượt bạn!", 500, 572, 30, "#3c4fb8", 3.4, 2);
    },
  },
];

function story() {
  const box = $("intro"), skip = $("intro-skip");
  if (!window.rough) return Promise.resolve();
  box.replaceChildren(skip);
  box.classList.add("is-on");
  G.set(box, { opacity: 1 });
  const svg = svgEl("svg", { viewBox: "0 0 1000 600", class: "st-svg", preserveAspectRatio: "xMidYMid meet" });
  box.append(svg);
  const rc = rough.svg(svg);
  let cancelled = false;

  // what one scene can put on the page; everything it adds is collected so it can be drawn in and rubbed out
  function makeScene(g) {
    const items = { inks: [], texts: [], crs: [] };
    return {
      items,
      write(text, x, y, size, parts, color = "#2b2f3a", vi = false) {
        const t = svgEl("text", { x, y, "text-anchor": "middle", class: `st-text${vi ? " st-vi" : ""}`, "font-size": size });
        if (parts) for (const [w, col] of parts) { const sp = svgEl("tspan", { fill: col, stroke: col }); sp.textContent = w; t.append(sp); }
        else { t.setAttribute("fill", color); t.setAttribute("stroke", color); t.textContent = text; }
        g.append(t);
        items.texts.push(t);
      },
      ink(make, act) { const el = make(rc); g.append(el); items.inks.push(el); if (act) (items.inkActs = items.inkActs || []).push([el, act]); return el; },
      // the sticky words that pop up during a scene (bubbles, sound effects): written later, not with the caption
      pop(text, x, y, size, color, at = 2.2, rot = 0) { const t = svgEl("text", { x, y, "text-anchor": "middle", class: "st-pop", "font-size": size, fill: color, transform: `rotate(${rot} ${x} ${y})` }); t.textContent = text; t.style.opacity = "0"; g.append(t); (items.pops = items.pops || []).push([t, at]); return t; },
      creature(p, x, y, w, face, flip, act) {
        const c = CR.make(p);
        // the creature's own svg sits at 0,0 at 120 units; a wrapper places and sizes it on the page
        c.svg.setAttribute("x", 0); c.svg.setAttribute("y", 0); c.svg.setAttribute("width", 120); c.svg.setAttribute("height", 120);
        const wrap = svgEl("g", { transform: `translate(${x} ${y}) scale(${w / 120})` });
        const inner = svgEl("g", flip ? { transform: "translate(120 0) scale(-1 1)" } : {});
        inner.append(c.svg); wrap.append(inner); g.append(wrap);
        c.svg.dataset.x = x + w / 2;
        c.wrap = wrap; c.at = [x, y, w];
        items.crs.push({ c, face, act });
      },
    };
  }

  const dashAll = (els) => els.flatMap((el) => [...(el.tagName === "path" ? [el] : el.querySelectorAll("path"))]).map((p) => {
    const L = CR.lengthOf(p);
    p.style.strokeDasharray = `${L} ${L}`;
    return [p, L];
  });
  const midX = (el) => { try { const b = el.getBBox(); return b.x + b.width / 2; } catch { return 500; } };

  function drawScene(sc, g, tl, at) {
    const { inks, texts, crs } = sc.items;
    // the caption is written first, the English line then the Vietnamese one
    tl.call(() => { sfx("scene"); sfx("pencil", 1.4, 0.8); }, null, at);
    tl.call(() => sfx("pencil", 1.4, 0.6), null, at + 0.7);
    texts.forEach((t, i) => {
      tl.fromTo(t, { strokeDashoffset: 2600, fillOpacity: 0 }, { strokeDashoffset: 0, duration: 1.3, ease: "power1.inOut" }, at + i * 0.35)
        .to(t, { fillOpacity: 1, duration: 0.5 }, at + i * 0.35 + 0.9);
    });
    // the pen draws every line from left to right across the page
    const dashed = dashAll(inks);
    dashed.forEach(([p, L]) => { p.style.strokeDashoffset = `${L}`; });
    inks.forEach((el) => { G.set(el, { opacity: 1 }); });
    dashed.forEach(([p, L]) => tl.to(p, { strokeDashoffset: 0, duration: Math.min(1.1, 0.3 + L / 900), ease: "power1.inOut" }, at + 0.6 + (midX(p) / 1000) * 0.9));
    crs.forEach(({ c, face, act }, i) => {
      const t0 = at + 1 + i * 0.22;
      tl.add(CR.drawIn(c, 0, 0.8), t0);
      tl.call(() => { if (!cancelled) sfx("appear", i + 1, i % 2); }, null, t0 + 0.75);
      tl.call(() => {
        if (cancelled) return;
        if (act) sfx("hop", i);
        const l = CR.live(c); storyLives.push(l);
        if (face) CR.setFace(c, face, c.spec.face.beak ? "open" : face === "happy" ? "grin" : face === "hurt" ? "grin" : "open");
        if (act) act(c);
      }, null, t0 + 0.9);
    });
    const drawn = at + Math.max(2.4, 1 + crs.length * 0.22 + 1, texts.length * 0.35 + 1.6);
    (sc.items.inkActs || []).forEach(([el, act], i) => tl.call(() => { if (!cancelled) { act(el); sfx("doodle", i); } }, null, drawn - 0.3));
    (sc.items.pops || []).forEach(([t, when]) => tl.call(() => sfx("pop"), null, at + when));
    (sc.items.pops || []).forEach(([t, when]) => tl.fromTo(t, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)" }, at + when));
    return drawn;
  }

  // a pink eraser sweeps across and the strokes it passes disappear
  const eraser = svgEl("g", { class: "st-eraser" });
  eraser.append(rc.rectangle(-30, -16, 60, 32, { stroke: "#a0505a", strokeWidth: 1.8, fill: "#f3a0b0", fillStyle: "solid", roughness: 1, seed: 90 }));
  eraser.append(rc.rectangle(10, -16, 20, 32, { stroke: "#2b3a78", strokeWidth: 1.8, fill: "#6f8fd8", fillStyle: "hachure", hachureGap: 3, roughness: 1, seed: 91 }));
  G.set(eraser, { opacity: 0 });
  function eraseScene(g, sc, tl, at, dur = 1.3) {
    const { inks, texts, crs } = sc.items;
    tl.call(() => sfx("erase", dur), null, at);
    tl.call(() => { svg.append(eraser); }, null, at)
      .set(eraser, { opacity: 1, x: -40, y: 160, rotation: -25 }, at)
      .to(eraser, { x: 1040, duration: dur, ease: "none" }, at)
      .to(eraser, { keyframes: [{ y: 460, duration: dur / 6 }, { y: 180, duration: dur / 6 }, { y: 480, duration: dur / 6 }, { y: 150, duration: dur / 6 }, { y: 470, duration: dur / 6 }, { y: 260, duration: dur / 6 }], ease: "sine.inOut" }, at)
      .to(eraser, { rotation: -10, duration: dur / 12, yoyo: true, repeat: 11 }, at)
      .set(eraser, { opacity: 0 }, at + dur);
    tl.call(() => {
      dashAll(inks).forEach(([p, L]) => {
        const d = (midX(p) / 1000) * dur;
        G.fromTo(p, { strokeDashoffset: 0 }, { strokeDashoffset: -L, duration: 0.3, delay: d, ease: "power1.in" });
        G.to(p, { opacity: 0, duration: 0.25, delay: d + 0.08 });
      });
      texts.forEach((t) => { const d = (midX(t) / 1000) * dur; G.to(t, { fillOpacity: 0, strokeDashoffset: -2600, duration: 0.45, delay: Math.max(0, d - 0.15), ease: "power1.in" }); });
      (sc.items.pops || []).forEach(([t]) => { const d = (midX(t) / 1000) * dur; G.to(t, { opacity: 0, duration: 0.3, delay: d }); });
      crs.forEach(({ c }) => { const d = (Number(c.svg.dataset.x) / 1000) * dur; G.to(c.svg, { opacity: 0, duration: 0.3, delay: d }); });
      // eraser crumbs
      for (let i = 0; i < 10; i++) {
        const cr = rc.circle(0, 0, 4, { stroke: "none", fill: "#e8a0ac", fillStyle: "solid", seed: 95 + i });
        svg.append(cr);
        const x = 80 + i * 90;
        G.timeline({ delay: (x / 1000) * dur, onComplete: () => cr.remove() }).set(cr, { x, y: 300 + R(-120, 120) }).to(cr, { y: "+=60", x: `+=${R(-20, 20)}`, opacity: 0, duration: 0.8, ease: "power1.in" });
      }
    }, null, at);
    tl.call(() => { storyLives.splice(0).forEach((l) => l.kill()); g.remove(); }, null, at + dur + 0.35);
    return at + dur + 0.45;
  }

  const tl = G.timeline();
  let at = 0.3;
  // a sound switch on the story page itself, since the story starts before anyone reaches the panel
  const sndBtn = document.createElement("button");
  sndBtn.type = "button";
  sndBtn.className = "cx-intro__sound";
  const paintSnd = () => { sndBtn.textContent = SND.on ? "sound: on" : "sound: off"; sndBtn.setAttribute("aria-pressed", String(SND.on)); };
  paintSnd();
  sndBtn.addEventListener("click", () => { SND.set(!SND.on); paintSnd(); const main = $("sound"); if (main) main.textContent = SND.on ? "sound: on" : "sound: off"; });
  box.append(sndBtn);
  SCENES.forEach((scene) => {
    const g = svgEl("g", { class: "st-scene" });
    svg.append(g);
    const sc = makeScene(g);
    if (scene.en) { sc.write(scene.en, 500, 70, scene.en.length > 70 ? 26 : 32, null, "#2b2f3a"); sc.write(scene.vi, 500, 112, scene.vi.length > 70 ? 23 : 27, null, "#5d6170", true); }
    scene.draw(sc);
    // the scene stays invisible until its turn
    G.set(g, { opacity: 0 });
    tl.set(g, { opacity: 1 }, at);
    tl.call(() => g.removeAttribute("display"), null, at);
    const end = drawScene(sc, g, tl, at);
    at = eraseScene(g, sc, tl, end + 2.2 + (scene.hold || 0));
    // and out of the page's way altogether, once it has been measured: thousands of strokes waiting
    // their turn would otherwise be styled and laid out again with every frame of the scenes before
    g.setAttribute("display", "none");
  });
  return new Promise((ok) => {
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      storyLives.splice(0).forEach((l) => l.kill());
      G.to(box, { opacity: 0, duration: 0.4, onComplete: () => { box.classList.remove("is-on"); box.replaceChildren(skip); G.set(box, { opacity: 1 }); } });
      ok();
    };
    // the music box plays softly under the whole story
    for (let t = 0.3, bar = 0; t < at - 1; t += 1.6, bar++) { const b = bar; tl.call(() => { if (!cancelled) sfx("musicbox", b); }, null, t); }
    tl.call(finish, null, at);
    skip.onclick = () => { tl.kill(); finish(); };
    skip.tabIndex = 0;
  });
}
const book = story;

function intro() {
  let seen = false;
  try { seen = localStorage.getItem("chess-intro") === "1"; } catch { /* no storage: show it */ }
  if (!anim || seen || roomFromUrl()) return Promise.resolve();
  try { localStorage.setItem("chess-intro", "1"); } catch { /* fine */ }
  return book();
}
