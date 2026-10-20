/* Every sound in Chess in the margins. The creatures and the world use real recordings: the owl hoots, the pony
   neighs and its hooves clop, the bee buzzes, the acorn's wooden sword swishes and clacks on wood, the penguin
   squeaks, and the beach has its waves (and crickets after dark). The recordings are public domain (CC0) sounds
   from Freesound, trimmed and levelled; see assets/sfx/CREDITS.md. Music, like the story's music box, is played
   on a small Web Audio toy box, which also stands in for any recording that has not loaded yet.
   Off until the player turns it on; the choice is remembered. Browsers only allow audio after a click,
   so the audio context is created on the first use that follows one. */
(function (root) {
  "use strict";
  let ctx = null, out = null, bus = null;
  const BASE = root.SFX_BASE || "/assets/sfx/", VER = "3";
  let on = false, vol = 0.7, master = null;
  try { const v = parseFloat(localStorage.getItem("chess-volume")); if (v >= 0 && v <= 1) vol = v; } catch { /* private window */ }
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
      master = ctx.createGain(); master.gain.value = 0.9 * vol;
      soft.connect(dry).connect(comp);
      soft.connect(room).connect(wet).connect(comp);
      comp.connect(master).connect(ctx.destination);
      out = soft;
      // recordings skip the low-pass: they are already gentle, and the filter would dull them
      bus = ctx.createGain(); bus.gain.value = 1;
      bus.connect(dry); bus.connect(room);
      load();
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
  const SYNTH = {
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


  /* ---------- the recordings ---------- */

  const FILES = ["achoo", "boing", "bonk", "buzz", "clack-wood", "clop", "crumble", "ding", "dizzy", "erase", "fanfare", "flap",
    "flap-soft", "gallop", "grass", "grass-hi", "gull", "hoot-far", "jump", "knock", "page", "paper", "peck", "pencil", "pinch", "poof",
    "pop", "popper", "punch", "rain", "rewind", "ribbit", "sandstep", "scrape", "shutter", "slap", "slide-down", "slide-up", "snore",
    "snort", "sparkle", "spell", "splash", "squeak", "squeak2", "squish", "star", "swish-wood", "swosh", "tea", "thud", "tiptoe", "trot",
    "ufo", "blob-hop", "bloop", "v-blob", "v-acorn", "v-bee", "v-bird", "v-mushroom", "v-owl", "v-penguin", "v-pony", "v-puff", "v-sand", "v-wizard",
    "v-zebra", "waddle", "wand", "whoosh", "yawn", "yay", "zap", "amb-day", "amb-night"];
  const buf = {};
  const has = (n) => Boolean(buf[n]);
  function load() {
    FILES.forEach((n) => {
      fetch(BASE + n + ".mp3?v=" + VER).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => ctx.decodeAudioData(b)).then((d) => { buf[n] = d; if (n.startsWith("amb-")) ambience(); })
        .catch(() => { /* the toy box covers for it */ });
    });
  }
  // how loud each recording sits in the mix (they are all levelled to the same peak)
  const LEVEL = { pencil: 0.45, erase: 0.3, paper: 0.35, page: 0.4, grass: 0.32, "grass-hi": 0.3, tiptoe: 0.35, sandstep: 0.4, waddle: 0.35,
    knock: 0.35, clop: 0.45, trot: 0.4, gallop: 0.4, buzz: 0.3, flap: 0.4, "flap-soft": 0.35, swosh: 0.35, whoosh: 0.35, scrape: 0.35,
    dizzy: 0.35, sparkle: 0.35, star: 0.3, ding: 0.4, pop: 0.45, jump: 0.35, boing: 0.4, thud: 0.45, gull: 0.18, "hoot-far": 0.16,
    yay: 0.4, fanfare: 0.45, rain: 0.35, ufo: 0.35, crumble: 0.5, "blob-hop": 0.4, bloop: 0.45, "amb-day": 0.16, "amb-night": 0.16 };
  // play a recording: when (seconds from now), how loud, how fast (and so how high); a touch of random pitch so repeats differ
  function S(name, at = 0, vol = 1, rate = 1, from = 0, len = 0) {
    const b = buf[name];
    if (!b) return false;
    const t = T() + at, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b;
    src.playbackRate.value = rate * R(0.96, 1.04);
    const v = vol * (LEVEL[name] ?? (name.startsWith("v-") ? 0.5 : 0.55));
    g.gain.setValueAtTime(v, t);
    if (len) { g.gain.setValueAtTime(v, t + len - 0.04); g.gain.linearRampToValueAtTime(0, t + len); }
    src.connect(g).connect(bus);
    src.start(t, from, len ? len + 0.02 : undefined);
    return true;
  }

  // who is who: each kind of piece is a different creature on each team, with its own voice and its own feet
  const WHO = {
    "1-0": "mushroom", "1-1": "blob", "2-0": "pony", "2-1": "zebra", "3-0": "acorn", "3-1": "wizard",
    "4-0": "sand", "4-1": "puff", "5-0": "bee", "5-1": "bird", "6-0": "owl", "6-1": "penguin",
  };
  const who = (kind, side) => WHO[`${kind}-${side ? 1 : 0}`] || "mushroom";
  const voice = (kind, side, at = 0, vol = 1, rate = 1) => S("v-" + who(kind, side), at, vol, rate);
  // footsteps: tiny pitter-patter, hooves, crunching sand, flapping wings...
  const FEET = {
    mushroom: () => S("tiptoe", 0, 0.9, 1.1), blob: () => S("blob-hop", 0, 0.8, R(0.95, 1.1)), pony: () => S("clop"), zebra: () => S("clop", 0, 1, 0.92),
    acorn: () => S("grass-hi"), wizard: () => S("grass", 0, 1, 1.05), sand: () => S("sandstep"), puff: () => S("swosh", 0, 0.6, 0.8),
    bee: () => S("buzz", 0, 0.8), bird: () => S("flap"), owl: () => S("grass", 0, 1.1, 0.85),
    penguin: () => { S("tiptoe", 0, 0.5, 0.8); return S("waddle", 0, 0.8, R(0.9, 1.1)); },
  };
  // getting going: what each creature sounds like as it sets off
  const SETOFF = {
    pony: () => S("trot"), zebra: () => S("trot", 0, 1, 0.92), sand: () => { S("sandstep", 0.3, 0.7); return S("scrape"); }, puff: () => S("whoosh", 0, 0.6, 0.8),
    bee: () => S("buzz", 0, 1, R(0.95, 1.05)), bird: () => { S("flap", 0.25, 0.7); return S("flap"); },
  };
  // the wind-up just before a blow
  const WINDUP = {
    acorn: () => S("swish-wood"), wizard: () => S("spell", 0, 0.7), bee: () => S("wand", 0, 0.7), pony: () => S("snort", 0, 0.7),
    zebra: () => S("snort", 0, 0.7, 0.9), owl: () => S("flap", 0, 1, 0.85), bird: () => S("flap"), penguin: () => S("slide-down", 0, 0.45),
    sand: () => S("scrape", 0, 0.8, 0.8), blob: () => S("blob-hop", 0, 0.9, 0.9), puff: () => S("whoosh", 0, 0.5, 0.9), mushroom: () => S("whoosh"),
  };
  // the blow itself
  const BLOW = {
    mushroom: () => S("bonk"), blob: () => { S("bloop", 0.1, 0.8); return S("squish"); },
    pony: () => { voice(2, 0, 0.12, 0.6); return S("punch"); }, zebra: () => { voice(2, 1, 0.12, 0.6); return S("punch"); },
    acorn: () => { S("knock", 0.09, 0.6, 1.2); return S("clack-wood"); }, wizard: () => S("zap"),
    sand: () => S("crumble"), puff: () => S("poof"),
    bee: () => { S("sparkle", 0.02, 0.8); return S("slap", 0, 0.7); },
    bird: () => { S("peck", 0.08, 0.9); S("peck", 0.16, 0.8); voice(5, 1, 0.25, 0.7); return S("peck"); },
    owl: () => { S("flap-soft", 0.05, 0.6); return S("slap"); }, penguin: () => { S("thud", 0.05, 0.8); voice(6, 1, 0.2, 0.7); return S("splash", 0, 0.8); },
  };

  const REAL = {
    // a tap on a creature whose team is not moving: a soft little blup, nothing more
    nudge() { return S("bloop", 0, 0.28, 1.2); },
    // what the slingshot fires, landing
    ammo(name = "pebble") {
      if (name === "acorn") return S("clack-wood", 0, 0.7, 1.3);
      if (name === "paper") return S("paper", 0, 0.9, 1.1);
      if (name === "balloon") return S("splash");
      if (name === "tomato") { S("bloop", 0.03, 0.5, 0.8); return S("squish"); }
      if (name === "duck") return S("squeak");
      return this.pebble();
    },
    torch() { S("knock", 0.06, 0.4, 1.8); return S("shutter", 0, 0.5, 0.8); },
    pebble() { S("sandstep", 0.03, 0.7, 1.2); return S("knock", 0, 0.7, 1.6); },
    select(kind = 1, side = 0) { return kind === 2 && Math.random() < 0.6 ? S("snort", 0, 0.8, side ? 0.92 : 1) : voice(kind, side); },
    deselect() { return S("paper", 0, 0.6); },
    move(kind = 1, side = 0) { const f = SETOFF[who(kind, side)]; return f ? f() : true; },
    step(kind = 1, side = 0) { return FEET[who(kind, side)](); },
    land(kind = 0, side = 0) { return kind === 2 ? S("clop", 0, 1.1, side ? 0.92 : 1) : kind === 4 && !side ? S("sandstep") : S("grass", 0, 0.7); },
    boing() { return S("jump"); },
    whoosh() { return S("whoosh"); },
    windup(kind = 1, side = 0) { return WINDUP[who(kind, side)](); },
    hit(kind = 1, side = 0) { return BLOW[who(kind, side)](); },
    // the one that was hit cries out in its own voice, a little higher, and goes down with a bump
    ouch(kind = 1, side = 0) { voice(kind, side, 0.05, 0.8, 1.3); return S("thud", 0.3, 0.8); },
    dizzy() { return S("dizzy"); },
    float() { return S("sparkle", 0, 0.7, 1.15); },
    pop() { return S("pop"); },
    check() { return S("ding") && S("ding", 0.2, 0.8); },
    grow() { return S("sparkle") && S("star", 0.3, 0.8); },
    castle() { return S("scrape") && S("knock", 0.9, 0.5); },
    win() { return S("fanfare") && S("yay", 0.4, 0.7); },
    draw() { return S("tea"); },
    scratch(dur = 0.4) { return this.pencil(dur, 0.8); },
    erase(dur = 1.3) { return S("erase", 0, 0.9, 1, 0, Math.min(dur, 1.5)); },
    note() { return this.pencil(0.35, 0.3); },
    emote(e, side = 0) {
      if (e === "laugh") return S("squeak2", 0, 0.7, side ? 1.15 : 1) && S("squeak2", 0.16, 0.6, side ? 1.25 : 1.1);
      if (e === "grr") return S("snort", 0, 0.8, 0.8);
      if (e === "yawn") return S("yawn");
      if (e === "love") return S("sparkle", 0, 0.8, 1.1);
      if (e === "shock") return S("slide-up", 0, 0.4);
      return S("pop");
    },
    tick() { return S("knock", 0, 0.5, 1.3); },
    spout() { return S("splash"); },
    giggle() { return S("squeak") && S("squeak", 0.15, 0.8, 1.15); },
    neigh() { return S("v-pony"); },
    ufo() { return S("ufo"); },
    rain(dur = 4) { return S("rain", 0, 1, 1, 0, Math.min(dur, 6.8)); },
    rewind() { return S("rewind"); },
    yawn() { return S("yawn"); },
    shutter() { return S("shutter"); },
    achoo() { return S("achoo"); },
    snore() { return S("snore"); },
    burp() { return S("ribbit"); },
    pinch() { return S("pinch") && S("pinch", 0.1, 0.8, 1.1); },
    page() { return S("page"); },
    confetti() { return S("popper") && S("yay", 0.15, 0.6); },
    // shooting stars cross the sky in silence (a chime every few seconds soon wears thin)
    shootingstar() { return true; },
    // a real pencil on paper, a different stretch of the recording every time
    pencil(dur = 0.5, busy = 1) {
      const b = buf.pencil;
      if (!b) return false;
      const len = Math.min(dur, b.duration - 0.05);
      return S("pencil", 0, 0.6 + busy * 0.5, R(0.95, 1.05), R(0.2, Math.max(0.2, b.duration - len)), len);
    },
    // a line ruled on the board: one quick stroke of the pencil
    line() { const b = buf.pencil; return b ? S("pencil", 0, 0.8, 1.1, R(0.2, b.duration - 0.2), 0.16) : false; },
    // a creature finishes being drawn and says hello in its own voice
    appear(i = 0, side = 0, kind = 0) { return kind ? voice(kind, side, 0, 0.45) : S("pop", 0, 0.5); },
    // a doodle in the margin is done: the pencil lifts off with a flick
    doodle() { const b = buf.pencil; return b ? S("pencil", 0, 0.6, 1.2, R(0.2, b.duration - 0.12), 0.1) : false; },
    tada() { return S("sparkle", 0, 0.8); },
    hop() { return S("jump", 0, 0.7); },
    scene() { return S("page", 0, 0.8); },
  };
  // the toy box has no recordings for these, so they borrow the nearest thing it has
  // the slingshot's rubber band: a low pluck that drops as it springs back (power 0..1)
  SYNTH.twang = (power = 0.5) => {
    const t = T(), o = osc("triangle", 110 + power * 120, t, t + 0.4), g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(60 + power * 40, t + 0.35);
    const l = osc("sine", 28, t, t + 0.4), lg = ctx.createGain(); lg.gain.value = 18; l.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(out);
    if (has("whoosh")) S("whoosh", 0.02, 0.4 + power * 0.5, 1.3 - power * 0.3);
  };
  SYNTH.pebble = () => SYNTH.tick();
  SYNTH.torch = () => SYNTH.tick();
  SYNTH.nudge = () => {};
  SYNTH.ammo = () => SYNTH.tick();
  SYNTH.shootingstar = () => {};
  SYNTH.move = (kind = 1) => { if (kind === 2) SYNTH.boing(); else if (kind === 4 || kind === 5) SYNTH.step(kind); };
  SYNTH.windup = () => SYNTH.whoosh();
  SYNTH.ouch = () => SYNTH.land();

  /* ---------- the beach all around: waves by day; waves and crickets by night; a gull or a far-off owl now and then ---------- */
  let ambMode = null, ambTimer = 0, ambNow = null, callTimer = 0;
  function ambience(mode = ambMode) {
    ambMode = mode;
    if (!ctx || !on) return;
    const name = mode ? "amb-" + mode : null;
    if (ambNow && (ambNow.name !== name || document.hidden)) {
      const old = ambNow;
      ambNow = null;
      old.g.gain.cancelScheduledValues(ctx.currentTime);
      old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      old.srcs.forEach((s) => { try { s.stop(ctx.currentTime + 2); } catch { /* already stopped */ } });
      clearTimeout(ambTimer); clearTimeout(callTimer);
    }
    if (!name || ambNow || document.hidden || !buf[name]) return;
    const b = buf[name], g = ctx.createGain(), v = LEVEL[name];
    g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(v, ctx.currentTime + 2.5);
    g.connect(bus);
    const me = { name, g, srcs: [] }, X = 2;
    ambNow = me;
    // the loop: each pass starts while the last one fades, so there is never a seam
    const pass = () => {
      if (ambNow !== me) return;
      const t = ctx.currentTime + 0.05, src = ctx.createBufferSource(), pg = ctx.createGain();
      src.buffer = b;
      pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(1, t + X);
      pg.gain.setValueAtTime(1, t + b.duration - X); pg.gain.linearRampToValueAtTime(0, t + b.duration);
      src.connect(pg).connect(g); src.start(t); src.stop(t + b.duration + 0.05);
      me.srcs = me.srcs.slice(-1).concat(src);
      ambTimer = setTimeout(pass, (b.duration - X) * 1000);
    };
    pass();
    const call = () => {
      if (ambNow !== me) return;
      if (mode === "day") S("gull", 0, R(0.6, 1), R(0.9, 1.1)); else S("hoot-far", 0, R(0.6, 1), R(0.95, 1.05));
      callTimer = setTimeout(call, mode === "day" ? R(14000, 40000) : R(25000, 60000));
    };
    callTimer = setTimeout(call, R(5000, 15000));
  }
  document.addEventListener("visibilitychange", () => ambience());

  /* ---------- the trombone, for losing ---------- */
  function trombone(f, at, dur, vol = 0.1, sag = 0) {
    const t = T() + at, o = osc("sawtooth", f, t, t + dur + 0.1), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1300, t + 0.08); lp.frequency.linearRampToValueAtTime(800, t + dur);
    if (sag) o.frequency.linearRampToValueAtTime(f * sag, t + dur);
    const l = osc("sine", 5.5, t, t + dur + 0.1), lg = ctx.createGain();
    lg.gain.value = f * 0.012; l.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol, t + dur - 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(out);
  }
  SYNTH.lose = () => { trombone(233, 0, 0.42); trombone(220, 0.48, 0.42); trombone(208, 0.96, 0.42); trombone(196, 1.44, 1.1, 0.1, 0.94); };

  const Sound = {
    get on() { return on; },
    set(v) {
      on = Boolean(v);
      try { localStorage.setItem("chess-sound", on ? "on" : "off"); } catch { /* fine */ }
      if (on) { ready(); if (!REAL.select(5, 0)) SYNTH.select(5, 0); ambience(); }
      else if (ctx) { ambience(null); ctx.suspend(); }
    },
    play(name, ...args) {
      if (!ready()) return;
      try {
        if (REAL[name] && REAL[name](...args)) return;
        if (SYNTH[name]) SYNTH[name](...args);
      } catch { /* a sound never breaks the game */ }
    },
    // whether the browser lets the page make sound yet (it waits for the first touch)
    get live() { return Boolean(ctx && ctx.state === "running"); },
    unlock() { if (on) ready(); },
    // how loud, 0..1 (remembered); 0 is as good as off
    get volume() { return vol; },
    setVolume(v) {
      vol = Math.max(0, Math.min(1, v));
      try { localStorage.setItem("chess-volume", String(vol)); } catch { /* fine */ }
      if (master) master.gain.setTargetAtTime(0.9 * vol, ctx.currentTime, 0.05);
    },
    // the sound of the place: "day", "night", or null for silence
    ambience(mode) { ambMode = mode; if (on && ready()) ambience(mode); },
  };
  root.Sound = Sound;
})(window);
