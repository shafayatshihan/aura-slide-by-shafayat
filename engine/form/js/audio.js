// Lumi sound: an original, procedurally generated lo-fi music engine and soft UI sounds,
// built entirely from Web Audio nodes (no audio files). Everything degrades to silence if Web Audio is missing.
import { emit } from './bus.js';

const STORE = 'aura-audio';
const DEFAULTS = { music: true, sfx: true, volume: 0.6 };
const LOOKAHEAD = 0.12;          // seconds scheduled ahead of the clock
const TICK_MS = 25;              // scheduler wake-up interval
const MUSIC_LEVEL = 1.15;        // music bus level under the master volume
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BRIGHT_KEYS = [0, 2, 3, 5, 7, 9, 10];
const PENT = [0, 2, 4, 7, 9];

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const mod = (a, n) => ((a % n) + n) % n;
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ shared per-context buffers
const BUFFERS = new WeakMap();
function buffers(ctx) {
  let b = BUFFERS.get(ctx);
  if (b) return b;
  const sr = ctx.sampleRate, r = seeded(90210);
  const noise = ctx.createBuffer(1, sr * 2, sr);           // the one shared white-noise buffer
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;

  const crackle = ctx.createBuffer(2, sr * 5, sr);         // sparse vinyl ticks, looped
  for (let ch = 0; ch < 2; ch++) {
    const d = crackle.getChannelData(ch);
    for (let p = 0; p < 5 * 11; p++) {
      const pos = Math.floor(r() * (d.length - 64)), w = 6 + Math.floor(r() * 26);
      const amp = (0.06 + 0.94 * Math.pow(r(), 6)) * (r() < 0.5 ? -1 : 1);
      for (let j = 0; j < w; j++) d[pos + j] += amp * Math.exp(-j / (w * 0.28)) * (j % 2 ? -0.55 : 1);
    }
  }

  const len = Math.floor(sr * 2.2);                        // soft, dark room impulse response
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len, coef = 0.15 + 0.75 * k;
      lp += (r() * 2 - 1 - lp) * (1 - coef);
      d[i] = i < sr * 0.014 ? 0 : lp * Math.exp(-(i / sr) * 3.1) * (1 - k);
    }
  }
  b = { noise, crackle, ir };
  BUFFERS.set(ctx, b);
  return b;
}

function softClipCurve() {
  const n = 4097, c = new Float32Array(n), knee = 0.6, room = 0.25;   // linear to 0.6, ceiling 0.85 (-1.4 dBFS)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
    c[i] = ax <= knee ? x : Math.sign(x) * (knee + room * Math.tanh((ax - knee) / room));
  }
  return c;
}

// ------------------------------------------------------------------ core graph (shared by music and sfx)
function createCore(ctx, volume) {
  const B = buffers(ctx);
  const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };

  const mix = g(1), hp = filt('highpass', 28), vol = g(volumeGain(volume));
  const clip = ctx.createWaveShaper(); clip.curve = softClipCurve(); clip.oversample = '2x';
  mix.connect(hp).connect(vol).connect(clip).connect(ctx.destination);

  const verbIn = g(1), verb = ctx.createConvolver(), verbTone = filt('lowpass', 5200, 0.5), verbOut = g(0.55);
  verb.buffer = B.ir;
  verbIn.connect(verb).connect(verbTone).connect(verbOut).connect(mix);

  const sfxTone = filt('lowpass', 7600, 0.5), sfxDry = g(2.3), sfxWet = g(2.3);
  sfxDry.connect(sfxTone); sfxWet.connect(sfxTone); sfxTone.connect(mix);
  sfxDry.connect(g(0.08)).connect(verbIn);
  const wetSend = g(0.42); sfxWet.connect(wetSend).connect(verbIn);

  const core = {
    ctx, B, mix, vol, verbIn, sfxDry, sfxWet, g, filt,
    live: 0, created: 0, nodes: 0, ends: [],
    // Register a short-lived voice: nodes are disconnected when its source ends, so they can be collected.
    track(src, nodes, end) {
      core.live++; core.created++; core.nodes += nodes.length; core.ends.push(end);
      src.onended = () => { core.live--; for (const n of nodes) { try { n.disconnect(); } catch (e) { /* already gone */ } } };
    },
    pending(t) { core.ends = core.ends.filter(e => e > t); return core.ends.length; },
    noiseSrc(t, dur, loop = false) {
      const s = ctx.createBufferSource(); s.buffer = B.noise; s.loop = loop;
      s.start(t, loop ? 0 : Math.random() * Math.max(0.01, 1.95 - dur)); s.stop(t + dur);
      return s;
    },
    destroy() { try { mix.disconnect(); verbOut.disconnect(); clip.disconnect(); } catch (e) { /* ignore */ } },
  };
  return core;
}
const volumeGain = v => Math.max(0, Math.min(1, v)) ** 2;

// ------------------------------------------------------------------ music engine
const CHORDS = {   // rootless, colourful voicings (the bass plays the root)
  maj7: [0, 4, 7, 11], maj9: [4, 7, 11, 14], '69': [4, 7, 9, 14], m7: [3, 7, 10, 12], m9: [3, 7, 10, 14],
  dom9: [4, 10, 14, 7], dom13: [4, 10, 14, 21], sus9: [5, 7, 10, 14], m6: [3, 7, 9, 12],
};
const PROGS = [
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'dom9']],     // I  vi  ii  V
  [[5, 'maj9'], [4, 'm7'], [9, 'm9'], [0, 'maj9']],     // IV iii vi  I
  [[0, 'maj7'], [5, 'maj9'], [4, 'm7'], [9, 'm9']],     // I  IV  iii vi
  [[2, 'm9'], [7, 'dom13'], [0, 'maj9'], [0, '69']],    // ii V   I   I6/9
  [[5, 'maj9'], [7, 'sus9'], [4, 'm7'], [9, 'm9']],     // IV Vsus iii vi
  [[0, 'maj9'], [4, 'm7'], [5, 'maj9'], [5, 'm6']],     // I  iii IV  iv6
  [[9, 'm9'], [5, 'maj9'], [0, 'maj9'], [7, 'sus9']],   // vi IV  I   Vsus
];
const KEYS_PATS = [[[0, 16, 1]], [[0, 10, 1], [10, 6, 0.7]], [[0, 6, 1], [6, 4, 0.6], [10, 6, 0.75]], [[0, 8, 1], [8, 8, 0.72]], [[0, 3, 0.9], [3, 13, 0.75]]];
const BASS_PATS = [
  [[0, 'r', 7, 1], [10, 'r', 4, 0.8], [14, '5', 2, 0.6]],
  [[0, 'r', 12, 1], [14, 'a', 2, 0.7]],
  [[0, 'r', 6, 1], [6, 'r', 3, 0.6], [10, '5', 4, 0.8]],
  [[0, 'r', 14, 1], [14, 'a', 2, 0.6]],
];
const KICK_PATS = [[0, 10], [0, 7, 10], [0, 3, 10], [0, 10, 13], [0, 8, 11]];
const SECTIONS = {
  intro:     { bars: 4, kick: 0, snare: 0, brush: 0.5, hats: 'sparse', mel: 0, lp: 1700, bass: 0.7 },
  groove:    { bars: 8, kick: 1, snare: 1, brush: 0.3, hats: 'eighths', mel: 0.3, lp: 3000, bass: 1 },
  melody:    { bars: 8, kick: 1, snare: 1, brush: 0.3, hats: 'sixteenths', mel: 0.75, lp: 3400, bass: 1 },
  breakdown: { bars: 4, kick: 0.6, snare: 0, brush: 1, hats: 'sparse', mel: 0.5, lp: 1500, bass: 0.6, half: true },
  lift:      { bars: 8, kick: 1, snare: 1, brush: 0.4, hats: 'sixteenths', mel: 0.55, lp: 4100, bass: 1, modulate: true },
};
const NEXT = { intro: ['groove'], groove: ['melody', 'breakdown', 'lift', 'melody'], melody: ['groove', 'breakdown', 'lift'], breakdown: ['groove', 'lift', 'melody'], lift: ['melody', 'groove', 'breakdown'] };

function createMusic(core, { seed = Date.now(), bpm } = {}) {
  const { ctx, g, filt } = core;
  const R = seeded(seed);
  const pick = a => a[Math.floor(R() * a.length)];
  const hum = (s = 0.007) => (R() - 0.5) * s;
  const osc = (type, f, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; return o; };

  // persistent graph (torn down by stop())
  const out = g(0), verbSend = g(0);
  out.connect(core.mix); verbSend.connect(core.verbIn);
  const tonal = g(1), duck = g(1), tape = ctx.createDelay(0.05), warm = filt('lowpass', 1700, 0.4);
  tape.delayTime.value = 0.015;
  tonal.connect(duck).connect(tape).connect(warm).connect(out);

  const keysTrem = g(0.88), keysL = ctx.createStereoPanner(), keysR = ctx.createStereoPanner();
  keysL.pan.value = -0.4; keysR.pan.value = 0.4;
  keysL.connect(keysTrem); keysR.connect(keysTrem); keysTrem.connect(tonal);
  keysTrem.connect(g(0.3)).connect(verbSend);
  const bassLP = filt('lowpass', 340, 0.6); bassLP.connect(tonal);
  const melPan = ctx.createStereoPanner(); melPan.pan.value = -0.22;
  const melBus = g(1); melBus.connect(melPan).connect(tonal); melBus.connect(g(0.55)).connect(verbSend);

  const drums = g(1), drumLP = filt('lowpass', 8200, 0.5); drums.connect(drumLP).connect(out);
  const hatPan = ctx.createStereoPanner(); hatPan.pan.value = 0.2;
  const hatBus = filt('highpass', 6800, 0.6); hatBus.connect(hatPan).connect(drums);
  const snareBus = filt('bandpass', 1900, 0.7), snareHP = filt('highpass', 450);
  snareBus.connect(snareHP).connect(drums); snareHP.connect(g(0.12)).connect(verbSend);
  const clickBus = filt('bandpass', 2600, 1.2); clickBus.connect(drums);
  const riserBus = filt('bandpass', 600, 1.4); riserBus.connect(g(0.6)).connect(verbSend); riserBus.connect(out);

  const lfos = [];
  const lfo = (f, depth, target) => { const o = osc('sine', f), d = g(depth); o.connect(d).connect(target); o.start(); lfos.push(o); };
  lfo(4.3, 0.1, keysTrem.gain);            // electric-piano tremolo
  lfo(0.43, 0.0011, tape.delayTime);       // tape wow
  lfo(6.2, 0.00006, tape.delayTime);       // tape flutter

  const crackle = ctx.createBufferSource(); crackle.buffer = core.B.crackle; crackle.loop = true;
  crackle.connect(filt('highpass', 1100)).connect(g(0.05)).connect(out);
  const hiss = ctx.createBufferSource(); hiss.buffer = core.B.noise; hiss.loop = true;
  hiss.connect(filt('bandpass', 5200, 0.35)).connect(g(0.009)).connect(out);
  crackle.start(); hiss.start(); lfos.push(crackle, hiss);

  // ---------------------------------------------------------- instruments (short-lived voices)
  function kick(t, v) {
    const o = osc('sine', 120), a = g(0);
    o.frequency.setValueAtTime(122, t); o.frequency.exponentialRampToValueAtTime(47, t + 0.12);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.3 * v, t + 0.005); a.gain.setTargetAtTime(0, t + 0.03, 0.08);
    o.connect(a).connect(drums); o.start(t); o.stop(t + 0.7); core.track(o, [o, a], t + 0.7);
    const n = core.noiseSrc(t, 0.05), c = g(0);
    c.gain.setValueAtTime(0.06 * v, t); c.gain.setTargetAtTime(0, t, 0.006);
    n.connect(c).connect(clickBus); core.track(n, [n, c], t + 0.05);
    duck.gain.setTargetAtTime(0.68, t, 0.012);   // sidechain-style pump
    duck.gain.setTargetAtTime(1, t + 0.07, 0.13);
  }
  function snare(t, v) {
    const n = core.noiseSrc(t, 0.5), a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.42 * v, t + 0.006); a.gain.setTargetAtTime(0, t + 0.01, 0.075);
    n.connect(a).connect(snareBus); core.track(n, [n, a], t + 0.5);
    const o = osc('triangle', 185), b = g(0);
    b.gain.setValueAtTime(0.07 * v, t); b.gain.setTargetAtTime(0, t, 0.035);
    o.connect(b).connect(drums); o.start(t); o.stop(t + 0.25); core.track(o, [o, b], t + 0.25);
  }
  function brush(t, v, len = 0.16) {
    const n = core.noiseSrc(t, len + 0.4), a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.11 * v, t + len * 0.7); a.gain.setTargetAtTime(0, t + len * 0.7, 0.05);
    n.connect(a).connect(snareBus); core.track(n, [n, a], t + len + 0.4);
  }
  function hat(t, v, open = false) {
    const d = open ? 0.6 : 0.15, n = core.noiseSrc(t, d), a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.085 * v, t + 0.0015); a.gain.setTargetAtTime(0, t + 0.002, open ? 0.08 : 0.017);
    n.connect(a).connect(hatBus); core.track(n, [n, a], t + d);
  }
  function riser(t, len) {
    const n = core.noiseSrc(t, len + 0.3, true), a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.05, t + len); a.gain.setTargetAtTime(0, t + len, 0.06);
    riserBus.frequency.setValueAtTime(500, t); riserBus.frequency.exponentialRampToValueAtTime(3200, t + len);
    n.connect(a).connect(riserBus); core.track(n, [n, a], t + len + 0.3);
  }
  function ep(t, midi, dur, v) {
    const f = mtof(midi), rel = 0.16, end = t + dur + rel * 6;
    const m = osc('sine', f), mg = g(0);
    mg.gain.setValueAtTime(f * 1.25 * v, t); mg.gain.setTargetAtTime(f * 0.16, t, 0.22);
    m.connect(mg);
    const nodes = [m, mg];
    for (const [det, pan] of [[-5, keysL], [5, keysR]]) {
      const c = osc('sine', f, det), a = g(0);
      mg.connect(c.frequency);
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.085 * v, t + 0.014);
      a.gain.setTargetAtTime(0, t + 0.014, 1.5); a.gain.setTargetAtTime(0, t + dur, rel);
      c.connect(a).connect(pan); c.start(t); c.stop(end); nodes.push(c, a);
    }
    const tine = osc('sine', f * 4), tg = g(0);
    tg.gain.setValueAtTime(0.01 * v, t); tg.gain.setTargetAtTime(0, t, 0.05);
    tine.connect(tg).connect(keysTrem); tine.start(t); tine.stop(t + 0.5); nodes.push(tine, tg);
    m.start(t); m.stop(end); core.track(m, nodes, end);
  }
  function bassNote(t, midi, dur, v) {
    const f = mtof(midi), end = t + dur + 0.5;
    const o = osc('sine', f), o2 = osc('triangle', f), g2 = g(0.4), a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.13 * v, t + 0.014);
    a.gain.setTargetAtTime(0.085 * v, t + 0.014, 0.3); a.gain.setTargetAtTime(0, t + dur, 0.06);
    o.connect(a); o2.connect(g2).connect(a); a.connect(bassLP);
    o.start(t); o2.start(t); o.stop(end); o2.stop(end);
    core.track(o, [o, o2, g2, a], end);
  }
  function lead(t, midi, dur, v, soft) {
    const f = mtof(midi), tau = soft ? 0.5 : 0.32, end = t + Math.max(dur, 0.1) + tau * 6;
    const o = osc(soft ? 'triangle' : 'sine', f), a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.09 * v, t + (soft ? 0.04 : 0.005));
    a.gain.setTargetAtTime(0, t + 0.04, tau);
    o.connect(a).connect(melBus);
    const p = osc('sine', f * 4.01), pa = g(0);
    pa.gain.setValueAtTime(soft ? 0 : 0.012 * v, t); pa.gain.setTargetAtTime(0, t, 0.04);
    p.connect(pa).connect(melBus);
    o.start(t); p.start(t); o.stop(end); p.stop(t + 0.4);
    core.track(o, [o, a, p, pa], end);
  }

  // ---------------------------------------------------------- sequencer
  const tempo = bpm || 76 + Math.floor(R() * 9);
  const s16 = 60 / tempo / 4, swing = 0.57 + R() * 0.05, swingOff = (swing - 0.5) * 2 * s16;
  let key = pick([0, 2, 5, 7]), homeKey = key;
  let grid = 0, step = 0, sec = null, barInSec = 0, voicing = [], center = 64, chord = null, nextChord = null;
  let phrase = [], motif = null, lastProg = -1;
  const log = [];

  function newSection(t, name) {
    const cfg = SECTIONS[name];
    if (cfg.modulate) {
      let k = key;
      for (let i = 0; i < 6 && (k === key || !BRIGHT_KEYS.includes(k)); i++) k = mod(key + pick([2, 5, -2, 7, -5]), 12);
      key = k;
    } else if (name === 'breakdown' && R() < 0.4) key = homeKey;
    let p = Math.floor(R() * PROGS.length);
    if (p === lastProg) p = (p + 1 + Math.floor(R() * (PROGS.length - 1))) % PROGS.length;
    lastProg = p;
    const keep = sec && R() < 0.4;
    sec = {
      name, cfg, prog: PROGS[p],
      keysPat: keep ? sec.keysPat : (cfg.half ? KEYS_PATS[0] : pick(KEYS_PATS)),
      bassPat: keep ? sec.bassPat : (cfg.half ? BASS_PATS[1] : pick(BASS_PATS)),
      kickPat: cfg.half ? [0] : (keep ? sec.kickPat : pick(KICK_PATS)),
      melSoft: R() < 0.35, riser: name !== 'intro' && (cfg.half || R() < 0.3),
    };
    barInSec = 0;
    warm.frequency.setTargetAtTime(cfg.lp, t, 1.1);
    log.push({ at: +t.toFixed(3), name, key: KEY_NAMES[key], prog: p, bars: cfg.bars });
  }

  function chordAt(i) { const [deg, q] = sec.prog[mod(i, 4)]; return { root: mod(key + deg, 12), q }; }
  function voice(ch) {
    const notes = CHORDS[ch.q].map(iv => {
      const pc = mod(ch.root + iv, 12);
      let m = pc + 12 * Math.round((center - pc) / 12);
      while (m < 55) m += 12;
      while (m > 76) m -= 12;
      return m;
    }).sort((a, b) => a - b);
    for (let i = 1; i < notes.length; i++) if (notes[i] - notes[i - 1] < 2 && notes[i] + 12 <= 79) notes[i] += 12;
    notes.sort((a, b) => a - b);
    center = 0.6 * (notes.reduce((s, n) => s + n, 0) / notes.length) + 0.4 * 64;
    return notes;
  }
  function makePhrase() {
    const scale = [];
    for (let m = 67; m <= 88; m++) if (PENT.includes(mod(m - key, 12))) scale.push(m);
    const tones = CHORDS[chord.q].map(iv => mod(chord.root + iv, 12));
    let idx;
    if (motif && R() < 0.5) {     // answer the last motif: same rhythm, shifted pitches
      const shift = pick([-2, -1, 1, 2]);
      return motif.map(n => ({ ...n, idx: Math.max(0, Math.min(scale.length - 1, n.idx + shift)), midi: 0 }))
        .map(n => ({ ...n, midi: scale[n.idx] }));
    }
    const starts = scale.map((m, i) => i).filter(i => tones.includes(mod(scale[i], 12)) && scale[i] < 82);
    idx = starts.length ? pick(starts) : 4;
    const out = [], count = 2 + Math.floor(R() * 4);
    let s = pick([0, 2, 4, 6, 8]);
    for (let i = 0; i < count && s < 16; i++) {
      out.push({ step: s, idx, midi: scale[idx], dur: 2 });
      s += pick([2, 2, 3, 4, 4, 6]);
      idx = Math.max(0, Math.min(scale.length - 1, idx + pick([-2, -1, -1, 1, 1, 2, 0])));
    }
    out[out.length - 1].dur = 6;
    motif = out;
    return out;
  }

  function beginBar(t) {
    if (!sec) newSection(t, 'intro');
    else if (barInSec >= sec.cfg.bars) newSection(t, pick(NEXT[sec.name].filter(n => n !== sec.name)));
    chord = chordAt(barInSec); nextChord = barInSec + 1 < sec.cfg.bars ? chordAt(barInSec + 1) : chordAt(0);
    voicing = voice(chord);
    phrase = sec.cfg.mel && R() < sec.cfg.mel ? makePhrase() : [];
  }

  function scheduleStep(t0) {
    const st = step;
    if (st === 0) beginBar(t0);
    const c = sec.cfg, lastBar = barInSec === c.bars - 1;
    const t = t0 + (st % 2 ? swingOff : 0);
    // drums
    const fillZone = lastBar && st >= 12 && c.snare && R() < 0.5;
    if (c.kick && sec.kickPat.includes(st) && !(fillZone && st > 12)) kick(t + hum(0.003), (st === 0 ? 1 : 0.8) * c.kick);
    if (c.snare && (st === 4 || st === 12)) snare(t + 0.012 + hum(), 0.88 + R() * 0.14);
    if (fillZone && st % 2 && st > 12) snare(t + hum(), 0.3 + R() * 0.2);
    if (c.half && st === 8) snare(t + 0.012, 0.45);
    if (c.brush && (st === 2 || st === 10) && R() < c.brush * 0.5) brush(t, 0.5 + R() * 0.5);
    if (c.brush && (st === 7 || st === 15) && R() < c.brush * 0.25) brush(t, 0.35, 0.09);
    const hv = 0.8 + R() * 0.25;
    if (c.hats === 'sparse' ? st % 4 === 2 : c.hats === 'eighths' ? st % 2 === 0 : (st % 2 === 0 || R() < 0.35)) {
      const open = st === 14 && R() < 0.18;
      hat(t + hum(0.004), (st % 4 === 0 ? 0.75 : st % 2 ? 0.38 : 0.55) * hv, open);
    }
    if (sec.riser && lastBar && st === 8) riser(t, 8 * s16);
    // keys
    for (const [at, len, v] of sec.keysPat) {
      if (at !== st) continue;
      const roll = R() < 0.5 ? 1 : -1, dur = len * s16 - 0.03;
      voicing.forEach((m, i) => ep(t + 0.004 + i * (0.011 + R() * 0.01) * (roll > 0 ? 1 : 0) + (roll < 0 ? (voicing.length - 1 - i) * 0.012 : 0),
        m, dur, v * (0.85 + R() * 0.2)));
    }
    // bass
    for (const [at, kind, len, v] of sec.bassPat) {
      if (at !== st) continue;
      let m = 36 + chord.root;
      if (m > 45) m -= 12;
      if (kind === '5') m += 7;
      if (kind === 'a') { m = 36 + nextChord.root + (R() < 0.5 ? -1 : 2); if (m > 46) m -= 12; }
      bassNote(t + hum(0.004), m, len * s16 - 0.02, v * c.bass);
    }
    // melody
    for (const n of phrase) if (n.step === st) lead(t + hum(0.01), n.midi, n.dur * s16, 0.7 + R() * 0.3, sec.melSoft);
    step = (st + 1) % 16;
    if (step === 0) barInSec++;
  }

  return {
    get bpm() { return tempo; }, get key() { return key; }, get section() { return sec ? sec.name : ''; }, log,
    start(at) { grid = at; },
    schedule(until) {
      if (grid < ctx.currentTime - 0.05) grid = ctx.currentTime + 0.03;   // resync after a pause
      while (grid < until) { scheduleStep(grid); grid += s16; }
    },
    fade(on, t, tau) {
      for (const [p, v] of [[out.gain, MUSIC_LEVEL], [verbSend.gain, 1]]) {
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.setTargetAtTime(on ? v : 0, t, tau);
      }
    },
    stop() {
      for (const s of lfos) { try { s.stop(); } catch (e) { /* not started */ } }
      try { out.disconnect(); verbSend.disconnect(); } catch (e) { /* ignore */ }
    },
  };
}

// ------------------------------------------------------------------ ui sounds
function playSfx(core, name, t, key) {
  const { ctx, g } = core;
  const base = 60 + (key <= 6 ? key : key - 12);
  const P = (i, oct = 1) => base + 12 * oct + 12 * Math.floor(i / 5) + PENT[mod(i, 5)];

  function blip(at, midi, { type = 'sine', a = 0.003, tau = 0.06, gain = 0.08, glide = 0, gt = 0.05, wet = false, partial = 0 } = {}) {
    const f = mtof(midi), o = ctx.createOscillator(), v = g(0), end = at + a + tau * 7;
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, at + gt);
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(gain, at + a); v.gain.setTargetAtTime(0, at + a, tau);
    o.connect(v).connect(wet ? core.sfxWet : core.sfxDry);
    o.start(at); o.stop(end);
    const nodes = [o, v];
    if (partial) {
      const p = ctx.createOscillator(), pv = g(0);
      p.frequency.value = f * partial; pv.gain.setValueAtTime(gain * 0.22, at); pv.gain.setTargetAtTime(0, at, Math.min(0.05, tau * 0.4));
      p.connect(pv).connect(wet ? core.sfxWet : core.sfxDry); p.start(at); p.stop(end); nodes.push(p, pv);
    }
    core.track(o, nodes, end);
  }
  function puff(at, { f = 3000, q = 1, a = 0.002, tau = 0.01, gain = 0.03, to = 0, len = 0, wet = false } = {}) {
    const dur = a + Math.max(len, tau * 7) + 0.05, n = core.noiseSrc(at, dur, dur > 1.5), bp = core.filt('bandpass', f, q), v = g(0);
    if (to) bp.frequency.exponentialRampToValueAtTime(to, at + (len || dur));
    v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(gain, at + a); v.gain.setTargetAtTime(0, at + a, tau);
    n.connect(bp).connect(v).connect(wet ? core.sfxWet : core.sfxDry);
    core.track(n, [n, bp, v], at + dur);
  }
  const mallet = (at, midi, gain = 0.07, tau = 0.22, wet = true) => blip(at, midi, { a: 0.003, tau, gain, wet, partial: 4.01 });

  switch (name) {
    case 'hover': blip(t, P(4, 2), { a: 0.002, tau: 0.022, gain: 0.016 }); break;
    case 'click': blip(t, P(0, 1), { type: 'triangle', a: 0.001, tau: 0.028, gain: 0.06, glide: 0.86, gt: 0.04 }); puff(t, { f: 3400, q: 1.6, tau: 0.007, gain: 0.02 }); break;
    case 'tick': blip(t, P(2, 2), { a: 0.001, tau: 0.012, gain: 0.045 }); puff(t, { f: 6000, q: 2, tau: 0.004, gain: 0.012 }); break;
    case 'type': blip(t, P(Math.floor(Math.random() * 5), 2), { a: 0.001, tau: 0.014, gain: 0.026 }); puff(t, { f: 5200, q: 2, tau: 0.004, gain: 0.01 }); break;
    case 'select': mallet(t, P(0)); mallet(t + 0.06, P(3), 0.065); break;
    case 'deselect': mallet(t, P(3), 0.05, 0.14); mallet(t + 0.06, P(1), 0.04, 0.14); break;
    case 'next': mallet(t, P(0), 0.055); mallet(t + 0.045, P(2), 0.055); mallet(t + 0.09, P(3), 0.06, 0.3); break;
    case 'back': mallet(t, P(3), 0.055); mallet(t + 0.06, P(1), 0.05, 0.25); break;
    case 'whoosh': puff(t, { f: 380, to: 2300, q: 0.9, a: 0.16, tau: 0.09, gain: 0.07, len: 0.3, wet: true }); break;
    case 'drop':
      blip(t, P(2, 0), { a: 0.003, tau: 0.08, gain: 0.13, glide: 0.34, gt: 0.14 });
      blip(t + 0.09, P(4, 1), { a: 0.002, tau: 0.05, gain: 0.04, glide: 1.25, gt: 0.04, wet: true }); break;
    case 'upload': [0, 1, 2, 3].forEach((i, n) => blip(t + n * 0.05, P(i + 2), { a: 0.004, tau: 0.08, gain: 0.04, glide: 1.06, gt: 0.04, wet: true })); break;
    case 'success': [0, 2, 3, 5].forEach((i, n) => mallet(t + n * 0.07, P(i), 0.06, n === 3 ? 0.5 : 0.3)); break;
    case 'error':
      blip(t, P(2, 0), { type: 'triangle', a: 0.008, tau: 0.09, gain: 0.08, glide: 0.97, gt: 0.08 });
      blip(t + 0.12, P(0, 0), { type: 'triangle', a: 0.008, tau: 0.13, gain: 0.08, glide: 0.97, gt: 0.1 }); break;
    case 'toggle': blip(t, P(3, 1), { type: 'triangle', a: 0.001, tau: 0.02, gain: 0.05 }); blip(t + 0.05, P(5, 1), { a: 0.001, tau: 0.03, gain: 0.045 }); puff(t, { f: 4200, q: 2, tau: 0.005, gain: 0.012 }); break;
    case 'slide': puff(t, { f: 1100, to: 3000, q: 1.2, a: 0.05, tau: 0.05, gain: 0.03, len: 0.16 }); blip(t, P(1, 1), { a: 0.01, tau: 0.05, gain: 0.03, glide: 1.22, gt: 0.12 }); break;
    case 'launch':
      puff(t, { f: 300, to: 3400, q: 1, a: 0.6, tau: 0.12, gain: 0.06, len: 0.65, wet: true });
      for (let i = 0; i < 6; i++) mallet(t + 0.08 + i * 0.06, P(i), 0.045, 0.2);
      [5, 7, 8].forEach(i => mallet(t + 0.5, P(i), 0.035, 0.55)); break;
    case 'done':
      for (let i = 0; i < 6; i++) mallet(t + i * 0.05, P(i), 0.045, 0.18);
      [5, 7, 8, 10].forEach((i, n) => mallet(t + 0.34 + n * 0.012, P(i), 0.035, 0.7));
      blip(t + 0.34, P(0, -1), { a: 0.006, tau: 0.18, gain: 0.07 }); break;
    case 'pop': blip(t, P(0, 0), { a: 0.002, tau: 0.035, gain: 0.1, glide: 2.8, gt: 0.05 }); puff(t + 0.02, { f: 2600, q: 1.5, tau: 0.006, gain: 0.015 }); break;
    default: return false;
  }
  return true;
}
const SFX_GAP = { hover: 60, type: 35, tick: 30, click: 40, pop: 40, toggle: 50 };
const SFX_NAMES = ['hover', 'click', 'select', 'deselect', 'next', 'back', 'whoosh', 'type', 'drop', 'upload', 'success', 'error', 'toggle', 'slide', 'launch', 'done', 'pop', 'tick'];

// ------------------------------------------------------------------ live controller
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || '{}') || {};
    return {
      music: typeof p.music === 'boolean' ? p.music : DEFAULTS.music,
      sfx: typeof p.sfx === 'boolean' ? p.sfx : DEFAULTS.sfx,
      volume: Number.isFinite(p.volume) ? Math.max(0, Math.min(1, p.volume)) : DEFAULTS.volume,
    };
  } catch (e) { return { ...DEFAULTS }; }
}
const prefs = loadPrefs();
let ctx = null, core = null, music = null, timer = 0, offTimer = 0, visTimer = 0, unsupported = false, lastKey = 5;
const lastSfx = {};

function save() { try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch (e) { /* private mode */ } }
function announce() { try { emit('audio:change', { music: prefs.music, sfx: prefs.sfx, volume: prefs.volume }); } catch (e) { /* ignore */ } }
function tick() {
  try {
    if (music && ctx && ctx.state === 'running') { music.schedule(ctx.currentTime + LOOKAHEAD); lastKey = music.key; }
  } catch (e) { /* keep the page alive */ }
}
function ensureMusic() {
  clearTimeout(offTimer);
  const now = ctx.currentTime;
  if (!music) { music = createMusic(core, { seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 }); music.start(now + 0.08); }
  music.fade(true, now, 1.1);
  if (!timer) timer = setInterval(tick, TICK_MS);
  tick();
}
function stopMusic(fadeTau = 0.35) {
  if (!music) return;
  music.fade(false, ctx.currentTime, fadeTau);
  clearTimeout(offTimer);
  offTimer = setTimeout(() => {
    if (prefs.music && !document.hidden) return;
    clearInterval(timer); timer = 0;
    if (music) { lastKey = music.key; music.stop(); music = null; }
  }, fadeTau * 7000);
}
function onVisibility() {
  if (!ctx) return;
  clearTimeout(visTimer);
  if (document.hidden) {
    if (music) music.fade(false, ctx.currentTime, 0.12);
    visTimer = setTimeout(() => { if (document.hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 700);
  } else {
    ctx.resume().then(() => { if (prefs.music && music) { music.fade(true, ctx.currentTime, 0.6); tick(); } }).catch(() => {});
  }
}

export const audio = {
  start() {
    try {
      if (unsupported) return;
      const ua = navigator.userActivation;
      if (!ctx && ua && !ua.hasBeenActive) return;               // autoplay rules: wait for a real gesture
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { unsupported = true; return; }
        ctx = new AC();
        core = createCore(ctx, prefs.volume);
        document.addEventListener('visibilitychange', onVisibility);
      }
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
      if (prefs.music && !music) ensureMusic();
      announce();
    } catch (e) { unsupported = !ctx; }
  },
  setMusic(on) {
    try {
      prefs.music = !!on; save();
      if (ctx) { if (prefs.music) ensureMusic(); else stopMusic(); }
    } catch (e) { /* ignore */ }
    announce();
  },
  setSfx(on) { prefs.sfx = !!on; save(); announce(); },
  setVolume(v) {
    const x = Number(v);
    if (!Number.isFinite(x)) return;
    prefs.volume = Math.max(0, Math.min(1, x)); save();
    try { if (core) core.vol.gain.setTargetAtTime(volumeGain(prefs.volume), ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
    announce();
  },
  sfx(name) {
    try {
      if (!prefs.sfx || !ctx || !core || ctx.state === 'closed' || document.hidden) return;
      const now = performance.now(), gap = SFX_GAP[name] || 25;
      if (now - (lastSfx[name] || 0) < gap || core.live > 220) return;
      lastSfx[name] = now;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      playSfx(core, name, ctx.currentTime + 0.005, music ? music.key : lastKey);
    } catch (e) { /* never break the page for a sound */ }
  },
  state() {
    return {
      music: prefs.music, sfx: prefs.sfx, volume: prefs.volume,
      supported: !unsupported, started: !!ctx, running: !!ctx && ctx.state === 'running',
      playing: !!music && prefs.music, bpm: music ? music.bpm : 0, key: music ? KEY_NAMES[music.key] : '',
      section: music ? music.section : '', voices: core ? core.live : 0,
    };
  },
  names: SFX_NAMES.slice(),
};

// Render the music engine (and optional sfx) offline, with the same graph and look-ahead scheduling as live playback.
// Returns { buffer, log, samples: [{t, pending, created, nodes}] }. Used by the dev harness and tests.
export async function renderOffline({ seconds = 64, sampleRate = 44100, volume = 1, seed = 20251001, bpm, music: withMusic = true, sfx = [] } = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext is not available');
  const octx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const oc = createCore(octx, volume);
  const m = withMusic ? createMusic(oc, { seed, bpm }) : null;
  if (m) { m.start(0.05); m.fade(true, 0, 0.6); }
  const samples = [], step = 0.25;
  for (const [at, name, key] of sfx) playSfx(oc, name, at, key ?? 5);
  for (let i = 0; i * step < seconds - step; i++) {
    const t = i * step;
    octx.suspend(t).then(() => {
      if (m) m.schedule(t + step + LOOKAHEAD);
      samples.push({ t, pending: oc.pending(t), created: oc.created, nodes: oc.nodes });
      octx.resume();
    });
  }
  const buffer = await octx.startRendering();
  return { buffer, log: m ? m.log : [], samples, bpm: m ? m.bpm : 0 };
}
