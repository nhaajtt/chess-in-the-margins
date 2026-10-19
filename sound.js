/* Every sound in Chess in the margins, played on a little toy box made with the Web Audio API:
   a marimba, small bells, a slide whistle, a wood block, soap bubbles and a soft drum. Every note comes
   from one cheerful five-note scale, so sounds that overlap always fit together; a soft low-pass and a
   touch of room keep everything round and gentle, never sharp. No voices, no recordings.
   Off until the player turns it on; the choice is remembered. Browsers only allow audio after a click,
   so the audio context is created on the first use that follows one. */
(function (root) {
  "use strict";
  let ctx = null, out = null;
  let on = false;
  try { on = localStorage.getItem("chess-sound") === "on"; } catch { /* private window */ }

  function ready() {
    if (!on) return false;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // the chain: everything -> soft low-pass -> a little room -> gentle compressor -> speakers
      const soft = ctx.createBiquadFilter();
      soft.type = "lowpass"; soft.frequency.value = 4200; soft.Q.value = 0.5;
      const room = ctx.createConvolver();
      room.buffer = roomTail(1.3);
      const wet = ctx.createGain(); wet.gain.value = 0.22;
      const dry = ctx.createGain(); dry.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
      const master = ctx.createGain(); master.gain.value = 0.8;
      soft.connect(dry).connect(comp);
      soft.connect(room).connect(wet).connect(comp);
      comp.connect(master).connect(ctx.destination);
      out = soft;
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  // a short, dark room: decaying noise with the highs taken out
  function roomTail(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.25; d[i] = lp * Math.pow(1 - i / n, 3); }
    }
    return b;
  }
  const R = (a, b) => a + Math.random() * (b - a);
  const T = () => ctx.currentTime + 0.01;

  /* ---------- the scale: C major pentatonic, from low to high ---------- */
  const NOTE = (() => { const steps = [0, 2, 4, 7, 9], out2 = []; for (let o = 0; o < 4; o++) steps.forEach((s) => out2.push(130.81 * Math.pow(2, o + s / 12))); return out2; })();
  // degree: 0 is a low C, 5 the C above it, and so on
  const deg = (d) => NOTE[Math.max(0, Math.min(NOTE.length - 1, Math.round(d)))];

  /* ---------- the instruments ---------- */

  function env(g, at, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }
  function osc(type, f, at, end) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.start(at); o.stop(end); return o; }
  // marimba: a round fundamental and a quick bright partial
  function marimba(f, at = 0, vol = 0.3, decay = 0.45) {
    const t = T() + at;
    const g = ctx.createGain(); env(g, t, vol, 0.004, decay); g.connect(out);
    osc("sine", f, t, t + decay + 0.05).connect(g);
    const g2 = ctx.createGain(); env(g2, t, vol * 0.25, 0.002, decay * 0.25); g2.connect(out);
    osc("sine", f * 4, t, t + decay * 0.3 + 0.05).connect(g2);
  }
  // a little bell: sine partials that ring
  function bell(f, at = 0, vol = 0.16, decay = 1.1) {
    const t = T() + at;
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([k, v]) => {
      const g = ctx.createGain(); env(g, t, vol * v, 0.003, decay / k); g.connect(out);
      osc("sine", f * k, t, t + decay / k + 0.05).connect(g);
    });
  }
  // wood block: a knock with no ring
  function wood(f, at = 0, vol = 0.22) {
    const t = T() + at;
    const g = ctx.createGain(); env(g, t, vol, 0.001, 0.07); g.connect(out);
    const o = osc("sine", f * 1.6, t, t + 0.1); o.frequency.exponentialRampToValueAtTime(f, t + 0.03); o.connect(g);
  }
  // slide whistle: a pure tone that glides, with a little wobble
  function whistle(f0, f1, at = 0, dur = 0.4, vol = 0.12, wobble = 0) {
    const t = T() + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    const o = osc("sine", f0, t, t + dur + 0.05);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (wobble) { const l = osc("sine", 7, t, t + dur + 0.05); const lg = ctx.createGain(); lg.gain.value = wobble; l.connect(lg).connect(o.frequency); }
    o.connect(g);
  }
  // soap bubble: a quick upward blip
  function bubble(f = 500, at = 0, vol = 0.18) {
    const t = T() + at;
    const g = ctx.createGain(); env(g, t, vol, 0.004, 0.09); g.connect(out);
    const o = osc("sine", f, t, t + 0.12); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.08); o.connect(g);
  }
  // soft drum: a pillowy thump
  function pomf(f = 140, at = 0, vol = 0.32, decay = 0.22) {
    const t = T() + at;
    const g = ctx.createGain(); env(g, t, vol, 0.004, decay); g.connect(out);
    const o = osc("sine", f, t, t + decay + 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + decay); o.connect(g);
  }
  // shaker: a breath of soft noise, for paper, rain and wind
  let noiseBuf = null;
  function shaker(at = 0, dur = 0.12, vol = 0.05, freq = 2600) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = T() + at;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const run = (degrees, at = 0, gap = 0.07, play = marimba, vol) => degrees.forEach((d, i) => play(deg(d), at + i * gap, vol));

  /* ---------- what each action sounds like ---------- */

  // each kind of creature has its own little note, the purple team a step higher
  const HOME = { 1: 7, 2: 9, 3: 8, 4: 5, 5: 11, 6: 6 };
  const SFX = {
    select(kind = 1, side = 0) { const d = HOME[kind] + (side ? 2 : 0); marimba(deg(d), 0, 0.26); marimba(deg(d + 2), 0.07, 0.22); },
    deselect() { marimba(deg(9), 0, 0.14, 0.3); marimba(deg(7), 0.06, 0.12, 0.3); },
    // tiny feet: tick, tock
    step(kind = 1) {
      if (kind === 4) { shaker(0, 0.3, 0.05, 900); wood(deg(3), 0.22, 0.12); return; }
      if (kind === 5) { bubble(deg(10), 0, 0.08); bubble(deg(12), 0.08, 0.06); return; }
      const d = kind === 6 ? 4 : kind === 2 ? 8 : 6;
      wood(deg(d), 0, 0.16); wood(deg(d + 1), 0.11, 0.12);
    },
    boing() { whistle(deg(7), deg(14), 0, 0.22, 0.1); whistle(deg(14), deg(9), 0.22, 0.25, 0.08); },
    land() { pomf(120, 0, 0.22, 0.16); },
    whoosh() { whistle(deg(9), deg(16), 0, 0.28, 0.07, 6); shaker(0, 0.28, 0.025, 1800); },
    // the fights: comic and soft, each creature its own way
    hit(kind = 1, side = 0) {
      const H = {
        "1-0": () => { wood(deg(4), 0, 0.3); whistle(deg(10), deg(15), 0.04, 0.18, 0.08); },                       // mushroom: bonk!
        "1-1": () => { pomf(220, 0, 0.26, 0.18); whistle(deg(8), deg(4), 0.02, 0.22, 0.08, 10); },                  // blob: squish
        "2-0": () => { whistle(deg(12), deg(5), 0, 0.16, 0.09); pomf(110, 0.14, 0.32); wood(deg(9), 0.3, 0.14); wood(deg(8), 0.4, 0.12); }, // pony: kick, clip-clop
        "2-1": () => { whistle(deg(13), deg(6), 0, 0.16, 0.09); pomf(110, 0.14, 0.32); wood(deg(10), 0.3, 0.14); wood(deg(9), 0.4, 0.12); },
        "3-0": () => { whistle(deg(16), deg(7), 0, 0.14, 0.1); wood(deg(12), 0.13, 0.22); bell(deg(14), 0.15, 0.08, 0.5); }, // acorn: swish... clack, with a glint
        "3-1": () => { for (let i = 0; i < 7; i++) bell(deg(i % 2 ? 12 : 14), i * 0.035, 0.07, 0.25); whistle(deg(11), deg(16), 0, 0.25, 0.05, 40); }, // wizard: a fizzing sparkly zap
        "4-0": () => { pomf(90, 0, 0.4, 0.35); run([9, 7, 5, 4, 2], 0.08, 0.05, marimba, 0.12); },                 // sandcastle: kaboom, and the sand trickles down
        "4-1": () => { pomf(160, 0, 0.24, 0.2); bubble(deg(9), 0.05); bubble(deg(11), 0.12); },                   // puffball: poof
        "5-0": () => { run([10, 12, 14, 15, 17], 0, 0.05, bell, 0.09); },                                             // bee queen: the wand twinkles
        "5-1": () => { wood(deg(14), 0, 0.2); wood(deg(14), 0.09, 0.18); whistle(deg(13), deg(15), 0.2, 0.15, 0.06); }, // crested bird: peck peck, tweet
        "6-0": () => { shaker(0, 0.14, 0.06, 1400); pomf(260, 0.1, 0.28, 0.1); },                                     // owl: a wing flap, pap!
        "6-1": () => { whistle(deg(12), deg(4), 0, 0.5, 0.09); pomf(150, 0.45, 0.26); },                              // penguin: wheee... flop
      };
      (H[`${kind}-${side ? 1 : 0}`] || H["1-0"])();
    },
    dizzy() { for (let i = 0; i < 6; i++) bell(deg(i % 2 ? 13 : 15), i * 0.12, 0.06, 0.35); },
    float() { run([7, 9, 10, 12], 0, 0.12, bell, 0.07); },
    pop() { bubble(deg(9), 0, 0.3); },
    check() { bell(deg(12), 0, 0.12); bell(deg(12), 0.18, 0.11); },
    grow() { run([5, 7, 8, 9, 10, 12, 14, 15], 0, 0.06, marimba, 0.16); bell(deg(15), 0.5, 0.1); },
    castle() { shaker(0, 0.35, 0.05, 800); wood(deg(3), 0.3, 0.16); wood(deg(5), 0.4, 0.14); },
    win() { [[5, 0], [7, 0.13], [9, 0.26], [10, 0.39], [9, 0.55], [10, 0.68], [12, 0.82]].forEach(([d, at], i) => marimba(deg(d), at, 0.24, i === 6 ? 0.9 : 0.4)); bell(deg(15), 0.82, 0.1, 1.4); },
    lose() { whistle(deg(9), deg(7), 0, 0.35, 0.09, 5); whistle(deg(8), deg(6), 0.4, 0.35, 0.09, 5); whistle(deg(7), deg(3), 0.8, 0.8, 0.09, 8); },
    draw() { bell(deg(14), 0, 0.09, 0.6); bell(deg(15), 0.16, 0.09, 0.6); },
    scratch(dur = 0.4) { this.pencil(dur, 0.8); },
    erase(dur = 1.3) { for (let i = 0; i < Math.round(dur / 0.2); i++) shaker(i * 0.2, 0.18, 0.022, 1100); },
    note() { wood(deg(10), 0, 0.12); },
    emote(e, side = 0) {
      const b = side ? 2 : 0;
      if (e === "laugh") run([10 + b, 9 + b, 10 + b, 9 + b], 0, 0.09, marimba, 0.14);
      else if (e === "grr") whistle(deg(4 + b), deg(3 + b), 0, 0.4, 0.08, 12);
      else if (e === "yawn") whistle(deg(9 + b), deg(4 + b), 0, 0.8, 0.07);
      else if (e === "love") { bell(deg(10 + b), 0, 0.1); bell(deg(12 + b), 0.12, 0.1); }
      else if (e === "shock") whistle(deg(7 + b), deg(14 + b), 0, 0.18, 0.09);
      else run([7 + b, 9 + b], 0, 0.1, marimba, 0.16);
    },
    tick() { wood(deg(12), 0, 0.08); },
    spout() { bubble(deg(5), 0, 0.12); bubble(deg(7), 0.07, 0.1); bubble(deg(9), 0.14, 0.08); },
    // poked: a squeaky toy, twice
    giggle() { whistle(deg(12), deg(14), 0, 0.09, 0.08); whistle(deg(13), deg(15), 0.12, 0.09, 0.07); },
    neigh() { whistle(deg(9), deg(13), 0, 0.45, 0.08, 14); },
    ufo() { whistle(deg(9), deg(14), 0, 1.3, 0.06, 18); whistle(deg(14), deg(9), 1.3, 1.2, 0.05, 18); },
    rain(dur = 4) { for (let i = 0; i < Math.round(dur / 0.11); i++) marimba(deg(R(9, 17)), i * 0.11 + R(0, 0.05), 0.04, 0.2); },
    rewind() { run([15, 14, 12, 10, 9, 7, 5], 0, 0.04, marimba, 0.1); },
    yawn() { whistle(deg(8), deg(3), 0, 0.9, 0.06, 4); },
    shutter() { wood(deg(11), 0, 0.14); wood(deg(9), 0.08, 0.12); },
    achoo() { whistle(deg(7), deg(9), 0, 0.25, 0.06); whistle(deg(9), deg(11), 0.35, 0.25, 0.06); pomf(200, 0.75, 0.28, 0.14); shaker(0.75, 0.25, 0.05, 1600); },
    snore() { whistle(deg(2), deg(4), 0, 0.7, 0.06, 6); whistle(deg(9), deg(7), 0.8, 0.5, 0.04); },
    burp() { whistle(deg(4), deg(2), 0, 0.22, 0.1, 20); },
    pinch() { wood(deg(14), 0, 0.16); wood(deg(15), 0.08, 0.14); },
    page() { shaker(0, 0.35, 0.04, 1700); },
    confetti() { run([9, 12, 10, 14, 12, 15], 0, 0.06, bubble, 0.1); },
    shootingstar() { run([17, 16, 14, 13, 11], 0, 0.06, bell, 0.05); },
    /* ---------- drawing: the pencil, and a note for everything that appears ---------- */
    // a pencil scribbling: soft scritch-scratch strokes, never hissy (busy: 0..1, how hard it draws)
    pencil(dur = 0.5, busy = 1) {
      const n = Math.max(2, Math.round(dur / 0.09));
      for (let i = 0; i < n; i++) shaker(i * 0.09 + R(0, 0.03), R(0.06, 0.1), 0.05 * busy * R(0.7, 1.1), R(1600, 2600));
    },
    // a line drawn with a ruler ends with a tiny tick; the ticks climb the scale one after another
    line(i = 0) { wood(deg(5 + (i % 12)), 0, 0.09); },
    // a creature finishes being drawn: its note, a little higher on every file, with a sparkle on top
    appear(i = 0, side = 0) { const d = 5 + (i % 8) + (side ? 2 : 0); marimba(deg(d), 0, 0.13, 0.5); bell(deg(d + 5), 0.05, 0.035, 0.6); },
    // a doodle in the margin is done: a bubble or a bell, taking turns
    doodle(i = 0) { if (i % 2) bubble(deg(9 + (i * 3) % 7), 0, 0.12); else bell(deg(10 + (i * 2) % 6), 0, 0.05, 0.6); },
    // the board and everyone on it are ready
    tada() { run([7, 9, 10, 12], 0, 0.08, marimba, 0.2); bell(deg(15), 0.32, 0.09, 1.2); },
    // a creature in the story hops, waves or jumps
    hop(i = 0) { whistle(deg(8 + (i % 4)), deg(12 + (i % 4)), 0, 0.14, 0.07); },
    // a new page of the story: a little harp run
    scene() { run([5, 7, 9, 10, 12, 14], 0, 0.045, bell, 0.05); },
    // the story's music box: a lullaby, one bar at a time, very quiet under everything else
    musicbox(bar = 0) {
      const BARS = [[7, 9, 10, 9], [7, 5, 7, 4], [5, 7, 9, 12], [10, 9, 7, 9], [7, 9, 10, 12], [14, 12, 10, 9], [7, 9, 7, 5], [4, 5, 7, 7]];
      BARS[bar % BARS.length].forEach((d, i) => bell(deg(d), i * 0.4, 0.035, 0.9));
      marimba(deg([2, 0, 3, 4, 2, 4, 0, 2][bar % 8]), 0, 0.05, 1.2);
    },
    // after each move, the team that moved hums a little: brighter when ahead, gentler when behind
    tune(side = 0, mood = 0) {
      const b = side ? 2 : 0;
      const line = mood > 0 ? [7, 9, 10, 12] : mood < 0 ? [9, 8, 7] : [7, 9];
      run(line.map((d) => d + b), 0.25, 0.09, marimba, 0.07);
    },
  };

  const Sound = {
    get on() { return on; },
    set(v) {
      on = Boolean(v);
      try { localStorage.setItem("chess-sound", on ? "on" : "off"); } catch { /* fine */ }
      if (on) { ready(); SFX.select(5, 0); }
      else if (ctx) ctx.suspend();
    },
    play(name, ...args) {
      if (!ready() || !SFX[name]) return;
      try { SFX[name](...args); } catch { /* a sound never breaks the game */ }
    },
  };
  root.Sound = Sound;
})(window);
