/* Every sound in Chess in the margins. Most are recorded effects in /sfx (made with ElevenLabs sound
   effects, one per action: a wooden sword slash, a wand's sparkle, a wizard's electric zap...); they are
   fetched only once the player turns sound on. Anything without a recording, or heard before the
   recordings arrive, is made on the spot with the Web Audio API.
   Off until the player turns it on; the choice is remembered. Browsers only allow audio after a click,
   so the audio context is created on the first use that follows one. */
(function (root) {
  "use strict";
  let ctx = null, master = null, noiseBuf = null;
  let on = false;
  try { on = localStorage.getItem("chess-sound") === "on"; } catch { /* private window */ }

  function ready() {
    if (!on) return false;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      // a gentle compressor so a fight with many sounds at once never gets harsh
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }
  /* ---------- the recordings ---------- */

  const RECORDED = ["hit-1-0", "hit-1-1", "hit-2-0", "hit-2-1", "hit-3-0", "hit-3-1", "hit-4-0", "hit-4-1", "hit-5-0", "hit-5-1", "hit-6-0", "hit-6-1",
    "whoosh", "boing", "land", "step", "castle", "float", "dizzy", "pop", "check", "grow", "win", "lose", "draw", "spout", "giggle", "neigh", "ufo",
    "rain", "rewind", "yawn", "shutter", "achoo", "snore", "burp", "pinch", "page", "note", "scratch", "erase", "shootingstar", "confetti", "select", "deselect"];
  // how loud each kind sits in the mix (the busy ones quieter)
  const LEVEL = { step: 0.45, scratch: 0.4, erase: 0.45, select: 0.55, deselect: 0.5, note: 0.6, rain: 0.6, ufo: 0.8, win: 0.9, lose: 0.9 };
  const buffers = new Map();
  let loading = null;
  const base = (document.currentScript && document.currentScript.dataset.sfx) || "/sfx/";
  function loadAll() {
    if (loading || !ctx) return;
    loading = Promise.all(RECORDED.map((n) => fetch(`${base}${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then((b) => buffers.set(n, b)).catch(() => {})));
  }
  const lastAt = new Map();
  function playRecorded(n) {
    const b = buffers.get(n);
    if (!b) return false;
    const t = ctx.currentTime;
    // the same sound fired twice in a blink plays once
    if (t - (lastAt.get(n) || -1) < 0.06) return true;
    lastAt.set(n, t);
    const src = ctx.createBufferSource();
    src.buffer = b;
    // a touch of variety, so repeats never sound like a machine
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    const g = ctx.createGain();
    g.gain.value = (LEVEL[n] || 0.85) * (0.9 + Math.random() * 0.2);
    src.connect(g).connect(master);
    src.start();
    return true;
  }
  // which recording an action plays: fights depend on the kind of creature and its team
  const recordingFor = (name, args) => (name === "hit" ? `hit-${args[0] || 1}-${args[1] ? 1 : 0}` : name);

  const now = () => ctx.currentTime;
  const R = (a, b) => a + Math.random() * (b - a);

  // one note: a waveform gliding from f0 to f1 with a short envelope
  function tone({ type = "sine", f0 = 440, f1 = f0, at = 0, dur = 0.15, vol = 0.3, attack = 0.005, curve = "exp", vibrato = 0 }) {
    const t = now() + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) curve === "exp" ? o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur) : o.frequency.linearRampToValueAtTime(f1, t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // a burst of filtered noise: dust, whooshes, crayon on paper
  function noise({ at = 0, dur = 0.2, vol = 0.2, type = "bandpass", f0 = 1200, f1 = f0, q = 1, attack = 0.01 }) {
    const t = now() + at;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    src.playbackRate.value = R(0.8, 1.2);
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, R(0, 0.5)); src.stop(t + dur + 0.05);
  }

  // each kind of creature has its own voice, so the two teams and the six kinds sound different
  const VOICE = { 1: 520, 2: 330, 3: 440, 4: 260, 5: 660, 6: 300 };
  const SFX = {
    // picking a creature up: a happy little pop, higher for the purple team
    select(kind = 1, side = 0) { const f = VOICE[kind] * (side ? 1.25 : 1); tone({ type: "triangle", f0: f, f1: f * 1.6, dur: 0.09, vol: 0.28 }); tone({ type: "sine", f0: f * 2, f1: f * 2.4, at: 0.05, dur: 0.08, vol: 0.12 }); },
    // putting it down again
    deselect() { tone({ type: "triangle", f0: 500, f1: 280, dur: 0.12, vol: 0.18 }); noise({ dur: 0.12, vol: 0.08, f0: 3000, f1: 800, q: 0.8 }); },
    // the oranges popping up
    hint(i = 0) { tone({ type: "sine", f0: 900 + i * 40, f1: 1300 + i * 40, at: i * 0.035, dur: 0.05, vol: 0.06 }); },
    // a step or a hop; knights gallop, rooks slide, queens flutter, kings waddle
    step(kind = 1) {
      if (kind === 4) { noise({ dur: 0.35, vol: 0.18, type: "lowpass", f0: 900, f1: 300, q: 0.5, attack: 0.05 }); return; }
      if (kind === 5) { for (let i = 0; i < 5; i++) noise({ at: i * 0.05, dur: 0.04, vol: 0.06, f0: 2500, q: 2 }); tone({ type: "sine", f0: 700, f1: 1100, dur: 0.25, vol: 0.06, vibrato: 30 }); return; }
      const f = kind === 6 ? 140 : kind === 2 ? 220 : 180;
      tone({ type: "sine", f0: f * 2, f1: f, dur: 0.09, vol: 0.22 });
      noise({ dur: 0.05, vol: 0.06, type: "lowpass", f0: 600, q: 0.6 });
    },
    // a jump: boing
    boing(kind = 2) { const f = kind === 2 ? 180 : 240; tone({ type: "triangle", f0: f, f1: f * 2.4, dur: 0.28, vol: 0.2, vibrato: 18, curve: "lin" }); },
    // landing on the paper
    land() { tone({ type: "sine", f0: 160, f1: 70, dur: 0.12, vol: 0.3 }); noise({ dur: 0.1, vol: 0.08, type: "lowpass", f0: 900, q: 0.7 }); },
    // the run-up before a fight
    whoosh() { noise({ dur: 0.35, vol: 0.18, f0: 400, f1: 2400, q: 1.2, attack: 0.15 }); },
    // the hit itself, different for each move
    hit(kind = 1, side = 0) {
      noise({ dur: 0.18, vol: 0.32, type: "lowpass", f0: 2000, f1: 200, q: 0.8 });
      if (kind === 1 && side) { tone({ type: "sine", f0: 300, f1: 80, dur: 0.4, vol: 0.3 }); tone({ type: "square", f0: 120, f1: 60, at: 0.25, dur: 0.15, vol: 0.06 }); return; } // gulp
      if (kind === 3 && side) { for (let i = 0; i < 6; i++) tone({ type: "sawtooth", f0: R(800, 2200), f1: R(200, 600), at: i * 0.03, dur: 0.07, vol: 0.06 }); return; } // zap
      if (kind === 4 && !side) { tone({ type: "sine", f0: 90, f1: 40, dur: 0.5, vol: 0.45 }); return; } // boom
      if (kind === 5) { [1320, 1760, 2093].forEach((f, i) => tone({ type: "sine", f0: f, at: i * 0.05, dur: 0.25, vol: 0.08 })); return; } // zing of stars
      tone({ type: "square", f0: 220, f1: 110, dur: 0.12, vol: 0.12 });
      tone({ type: "triangle", f0: 880, f1: 330, at: 0.02, dur: 0.18, vol: 0.18 }); // bonk
    },
    // the loser going cross-eyed, then floating away
    dizzy() { tone({ type: "sine", f0: 1200, f1: 600, dur: 0.6, vol: 0.06, vibrato: 60, curve: "lin" }); },
    float() { tone({ type: "sine", f0: 400, f1: 900, dur: 0.7, vol: 0.08, vibrato: 12 }); },
    // a hat flying off
    pop() { tone({ type: "sine", f0: 600, f1: 1400, dur: 0.06, vol: 0.2 }); },
    // check: a little alarm bell
    check() { [0, 0.16].forEach((at) => { tone({ type: "triangle", f0: 1568, at, dur: 0.35, vol: 0.14 }); tone({ type: "sine", f0: 3136, at, dur: 0.2, vol: 0.05 }); }); },
    // promotion: a rising sparkle
    grow() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: "triangle", f0: f, at: i * 0.07, dur: 0.3, vol: 0.1 })); },
    // castling: two quick hops
    castle() { this.boing(4); tone({ type: "triangle", f0: 300, f1: 600, at: 0.15, dur: 0.15, vol: 0.12 }); },
    // the end: a kazoo fanfare for a win, a sad trombone for the other side, a lullaby for a draw
    win() { [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.62], [1047, 0.75]].forEach(([f, at], i) => tone({ type: "sawtooth", f0: f, at, dur: i === 5 ? 0.6 : 0.16, vol: 0.07, vibrato: 8 })); },
    lose() { [[392, 0], [370, 0.3], [349, 0.6]].forEach(([f, at]) => tone({ type: "sawtooth", f0: f, at, dur: 0.3, vol: 0.06 })); tone({ type: "sawtooth", f0: 330, f1: 300, at: 0.9, dur: 0.9, vol: 0.06, vibrato: 10 }); },
    draw() { [[659, 0], [523, 0.35], [587, 0.7], [392, 1.05]].forEach(([f, at]) => tone({ type: "sine", f0: f, at, dur: 0.5, vol: 0.08 })); },
    // writing and drawing: a pencil scratching across paper
    scratch(dur = 0.4, at = 0) { for (let i = 0; i < Math.max(1, Math.round(dur / 0.07)); i++) noise({ at: at + i * 0.07 + R(0, 0.02), dur: 0.06, vol: 0.05, f0: R(3500, 5500), q: 3 }); },
    // the eraser rubbing a scene out
    erase(dur = 1.3) { for (let i = 0; i < Math.round(dur / 0.11); i++) noise({ at: i * 0.11, dur: 0.1, vol: 0.07, type: "lowpass", f0: R(700, 1100), q: 0.6, attack: 0.03 }); },
    // the sticky note slapped on
    note() { noise({ dur: 0.06, vol: 0.12, type: "highpass", f0: 1800, q: 0.7 }); },
    // emotes: a word from a king
    emote(e, side = 0) {
      const b = side ? 1.2 : 1;
      if (e === "laugh") [0, 0.12, 0.24].forEach((at) => tone({ type: "square", f0: 520 * b, f1: 420 * b, at, dur: 0.09, vol: 0.06 }));
      else if (e === "grr") tone({ type: "sawtooth", f0: 110 * b, f1: 90 * b, dur: 0.4, vol: 0.1, vibrato: 25 });
      else if (e === "yawn") tone({ type: "sine", f0: 500 * b, f1: 200 * b, dur: 0.8, vol: 0.1, curve: "lin" });
      else if (e === "love") [659, 880].forEach((f, i) => tone({ type: "sine", f0: f * b, at: i * 0.1, dur: 0.3, vol: 0.1 }));
      else if (e === "shock") tone({ type: "triangle", f0: 400 * b, f1: 1400 * b, dur: 0.18, vol: 0.14 });
      else [0, 0.1].forEach((at, i) => tone({ type: "triangle", f0: (i ? 784 : 659) * b, at, dur: 0.14, vol: 0.12 }));
    },
    // the clock when time is short
    tick() { tone({ type: "square", f0: 1800, dur: 0.02, vol: 0.04 }); },
    // the frog's tongue, the whale's spout: the page's own little noises
    spout() { noise({ dur: 0.5, vol: 0.06, type: "highpass", f0: 1500, f1: 4000, q: 0.5, attack: 0.08 }); },
    // a poked creature giggles
    giggle() { [0, 0.09, 0.18, 0.27].forEach((at, i) => tone({ type: "triangle", f0: 900 - i * 60, f1: 1200 - i * 60, at, dur: 0.06, vol: 0.09 })); },
    // a pony asks a question
    neigh() { tone({ type: "sawtooth", f0: 700, f1: 380, dur: 0.55, vol: 0.05, vibrato: 30, curve: "lin" }); },
    ufo() { tone({ type: "sine", f0: 300, f1: 900, dur: 1.4, vol: 0.06, vibrato: 40, curve: "lin" }); tone({ type: "sine", f0: 905, f1: 305, at: 1.4, dur: 1.2, vol: 0.05, vibrato: 40, curve: "lin" }); },
    rain(dur = 4) { for (let i = 0; i < Math.round(dur / 0.08); i++) noise({ at: i * 0.08, dur: 0.07, vol: 0.03, type: "highpass", f0: R(2500, 6000), q: 0.6 }); },
    rewind() { for (let i = 0; i < 6; i++) tone({ type: "square", f0: 1400 - i * 120, f1: 1800 - i * 120, at: i * 0.05, dur: 0.04, vol: 0.03 }); },
    yawn() { tone({ type: "sawtooth", f0: 260, f1: 180, dur: 0.9, vol: 0.04, vibrato: 6, curve: "lin" }); },
    shutter() { noise({ dur: 0.05, vol: 0.2, type: "highpass", f0: 2000, q: 0.7 }); noise({ at: 0.09, dur: 0.06, vol: 0.15, type: "bandpass", f0: 1200, q: 1 }); },
    // each team has a little tune after its move: brighter when ahead, sadder when behind
    tune(side = 0, mood = 0) {
      const base = side ? [587, 698, 880, 1175] : [523, 659, 784, 1047];
      const notes = mood > 0 ? base : mood < 0 ? [base[2], base[1] * 0.94, base[0] * 0.94] : [base[0], base[2]];
      notes.forEach((f, i) => tone({ type: "triangle", f0: f, at: 0.25 + i * 0.09, dur: 0.12, vol: 0.05 }));
    },
  };

  const Sound = {
    get on() { return on; },
    set(v) {
      on = Boolean(v);
      try { localStorage.setItem("chess-sound", on ? "on" : "off"); } catch { /* fine */ }
      if (on) { ready(); loadAll(); SFX.select(5, 0); }
      else if (ctx) ctx.suspend();
    },
    play(name, ...args) {
      if (!ready()) return;
      loadAll();
      try {
        if (playRecorded(recordingFor(name, args))) return;
        if (SFX[name]) SFX[name](...args);
      } catch { /* a sound never breaks the game */ }
    },
  };
  root.Sound = Sound;
})(window);
