/* Bold Blue timeline (classic script, no dependencies): keyframes, easing, loop periods and camera tours, all pure
   functions of t so a scene can be sought to any frame (the capture contract in runtime.js).
     BBTime.ease.inOut(k)                          easing curves on 0..1
     BBTime.wrap(t, period)                        t folded into [0, period)
     BBTime.phase(t, period)                       2 pi * wrap(t, period) / period: the loop angle, exactly 0 at t = period
                                                   (use it for every sin / cos so seek(period) is bit-identical to seek(0))
     BBTime.wave(t, period, n = 1, phase = 0)      sin of harmonic n of the loop (always seamless)
     BBTime.pulse(t, period, at, width)            0..1 bump centred at `at` seconds, wraps round the loop
     BBTime.segments(t, [5.5, 5, 5, 7.5])          { i, local, k, start } - which shot / step of a cycling sequence
     BBTime.track([[t0, v0], [t1, v1], ...], { period, ease })   value at t (numbers or arrays), loops back to the first key
     BBTime.tour({ period, shots: [{ pos, target, hold, move }] })  camera keyframe tour: tour(t) -> { pos, target, i, k }
   Spec: .claude/skills/aura-slide/looks/bold-blue/LOOK.md, "Motion". */
(function () {
  'use strict';
  if (window.BBTime) return;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = {
    linear: k => k,
    in: k => k * k * k,
    out: k => 1 - Math.pow(1 - k, 3),
    inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    smooth: k => k * k * k * (k * (k * 6 - 15) + 10),          // zero velocity and acceleration at both ends
    sine: k => 0.5 - 0.5 * Math.cos(Math.PI * k),
    // the reference deck's entrance curve, cubic-bezier(.16, .84, .30, 1), solved numerically
    bb: (() => { const B = (a, b, k) => 3 * a * k * (1 - k) * (1 - k) + 3 * b * k * k * (1 - k) + k * k * k;
      return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x;
        for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (B(0.16, 0.30, t) < x) lo = t; else hi = t; } return B(0.84, 1, t); }; })(),
  };
  const wrap = (t, p) => (p > 0 ? ((t % p) + p) % p : 0);
  const phase = (t, p) => TAU * wrap(t, p) / p;
  const wave = (t, p, n = 1, ph = 0) => Math.sin(n * phase(t, p) + ph);
  function pulse(t, p, at, width) {
    let d = Math.abs(wrap(t - at, p)); d = Math.min(d, p - d);
    return d >= width ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d / width);
  }
  function segments(t, lens) {
    const total = lens.reduce((a, b) => a + b, 0), tt = wrap(t, total);
    let start = 0;
    for (let i = 0; i < lens.length; i++) {
      if (tt < start + lens[i] || i === lens.length - 1) return { i, local: tt - start, k: clamp((tt - start) / lens[i]), start, total };
      start += lens[i];
    }
    return { i: 0, local: 0, k: 0, start: 0, total };
  }
  const lerp = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k);
  /* keys [[time, value], ...] sorted; with a period the last key eases back to the first at t = period */
  function track(keys, { period = 0, ease: e = ease.inOut } = {}) {
    const ks = keys.slice().sort((a, b) => a[0] - b[0]);
    if (period) ks.push([period + ks[0][0], ks[0][1]]);
    return t => {
      const tt = period ? wrap(t - ks[0][0], period) + ks[0][0] : t;
      if (tt <= ks[0][0]) return ks[0][1];
      for (let i = 0; i < ks.length - 1; i++) {
        const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
        if (tt <= t1) return lerp(v0, v1, e(clamp((tt - t0) / Math.max(1e-6, t1 - t0))));
      }
      return ks[ks.length - 1][1];
    };
  }
  /* camera tour: each shot holds `hold` seconds, then moves for `move` seconds to the next shot (the last shot moves back
     to the first). The tour's period is the sum of every hold + move. */
  function tour({ shots, ease: e = ease.smooth }) {
    const lens = []; shots.forEach(s => { lens.push(s.hold ?? 3, s.move ?? 2); });
    const period = lens.reduce((a, b) => a + b, 0);
    const fn = t => {
      const g = segments(t, lens), i = g.i >> 1, moving = g.i % 2 === 1, a = shots[i], b = shots[(i + 1) % shots.length];
      const k = moving ? e(g.k) : 0;
      return { pos: lerp(a.pos, b.pos, k), target: lerp(a.target, b.target, k), i, k, moving, focus: moving && k > 0.5 ? (i + 1) % shots.length : i };
    };
    fn.period = period;
    return fn;
  }
  window.BBTime = { version: '1.0', ease, clamp, wrap, phase, wave, pulse, segments, track, tour, lerp };
})();
