/* Bold Blue physics stepper (classic script, no dependencies) for "real simulation" slides only (the user picks that
   motion type on the planning page). A fixed-step integrator whose state at time T is always the same, however it is
   reached, so LumiCapture.seek(t) gives the same frame live, in the recorder and in the still for the PDF.

     const sim = BBPhys.sim({ dt: 1 / 120, init: () => state, step: (state, dt, n) => {...} })   // n = step index
     sim.at(T)          the state at time T (steps forward from the nearest checkpoint; never touch it directly)
     const loop = BBPhys.loop(sim, { period: 12, warm: 20, blend: 2.5 })
     loop.sample(t, 'pos')   a Float32Array of state.pos at loop time t, cross-faded over the last `blend` seconds so
                             sample(period) === sample(0) exactly (a seamless loop of a non-periodic simulation)

   Ready-made models (each returns a sim; read the arrays it names):
     BBPhys.particles({ n, box, D, drift, seed, sources })   Brownian diffusion with drift, walls reflect      -> pos
     BBPhys.springs({ nodes, links, k, damping, gravity, pinned, drive })   mass-spring network (semi-implicit Euler) -> pos
     BBPhys.diffusion({ nx, ny, D, dx, sources, sinks })     concentration field on a grid (explicit, stable step) -> u
     BBPhys.flow({ n, field, box, seed })                    tracer particles advected by a velocity field(x,y,z,t) -> pos
   Randomness comes from BBPhys.rand(seed, step, i): a counter-based hash, so no random state has to be stored.
   Spec: .claude/skills/aura-slide/looks/bold-blue/LOOK.md, "Motion types". */
(function () {
  'use strict';
  if (window.BBPhys) return;

  function rand(seed, a, b) {
    let h = (Math.imul(seed | 0, 2246822519) + Math.imul(a | 0, 3266489917) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function gauss(seed, a, b) {             // standard normal from two hashed uniforms (Box-Muller)
    const u = Math.max(1e-9, rand(seed, a, b * 2)), v = rand(seed, a, b * 2 + 1);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clone(s) {
    const o = {};
    for (const k in s) { const v = s[k]; o[k] = ArrayBuffer.isView(v) ? v.slice() : (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v); }
    return o;
  }

  /* the fixed-step core: checkpoints every `every` steps so seeking backwards is cheap */
  function sim({ dt = 1 / 120, init, step, every = 240, maxCheckpoints = 400 }) {
    const checkpoints = new Map();
    let state = init(), n = 0;
    checkpoints.set(0, clone(state));
    function at(T) {
      const target = Math.max(0, Math.round(T / dt));
      if (target < n) {                               // go back to the closest checkpoint at or before the target
        let best = 0; checkpoints.forEach((_, k) => { if (k <= target && k > best) best = k; });
        state = clone(checkpoints.get(best)); n = best;
      }
      while (n < target) {
        step(state, dt, n); n++;
        if (n % every === 0 && !checkpoints.has(n) && checkpoints.size < maxCheckpoints) checkpoints.set(n, clone(state));
      }
      return state;
    }
    return { at, dt, get steps() { return n; } };
  }

  /* seamless loop of a non-periodic simulation: run `warm` seconds first (past the start-up transient), then cross-fade
     the last `blend` seconds of each period back into its start. sample(t) is exactly sample(t + period). */
  /* make: () => sim (called twice: one copy runs the main track, the other the lead-in to the start state, so neither
     ever has to step backwards). Blend arrays must keep their identity per index (particle i is always particle i). */
  function loop(make, { period, warm = 0, blend = null } = {}) {
    const B = blend == null ? Math.min(3, period * 0.25) : blend, W = Math.max(warm, B);
    const smooth = k => k * k * (3 - 2 * k);
    const main = typeof make === 'function' ? make() : make, lead = typeof make === 'function' ? make() : make;
    const bufs = {};
    return {
      period, warm: W, blend: B,
      sample(t, key) {
        const tt = ((t % period) + period) % period;
        const a = main.at(W + tt)[key];
        const out = bufs[key] || (bufs[key] = new Float32Array(a.length));
        out.set(a);
        const w = tt > period - B ? smooth((tt - (period - B)) / B) : 0;
        if (w > 0) {                         // fade into the run that arrives at the start state exactly at t = period
          const b = lead.at(W + tt - period)[key];
          for (let i = 0; i < out.length; i++) out[i] = out[i] * (1 - w) + b[i] * w;
        }
        return out;
      },
    };
  }

  /* --------------------------------------------------------------- models */
  /* Brownian particles: x += drift dt + sqrt(2 D dt) N(0,1), reflecting walls. sources: [{ at:[x,y,z], every:s, r }]
     re-emit particle i at a source on a schedule (keeps a steady stream for diffusion-across-a-barrier pictures). */
  function particles({ n = 200, box = [[-1, 1], [-1, 1], [-1, 1]], D = 0.05, drift = [0, 0, 0], seed = 1, start = null, dt = 1 / 60 } = {}) {
    return sim({ dt, init: () => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) {
        const [lo, hi] = start ? start[a] : box[a];
        pos[i * 3 + a] = lo + (hi - lo) * rand(seed, i, a + 7);
      }
      return { pos };
    }, step: (st, h, k) => {
      const s = Math.sqrt(2 * D * h), p = st.pos;
      for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) {
        const j = i * 3 + a, [lo, hi] = box[a];
        let x = p[j] + drift[a] * h + s * gauss(seed, k, j);
        if (x < lo) x = 2 * lo - x; if (x > hi) x = 2 * hi - x;
        p[j] = Math.min(hi, Math.max(lo, x));
      }
    } });
  }
  /* mass-spring network: nodes [[x,y,z]...], links [[i, j, restLength?]...]; drive(t, pos, n) may move pinned nodes */
  function springs({ nodes, links, k = 60, damping = 1.6, gravity = [0, -9.8, 0], pinned = [], drive = null, dt = 1 / 240 } = {}) {
    const N = nodes.length, pin = new Set(pinned);
    const rest = links.map(l => l[2] ?? Math.hypot(nodes[l[0]][0] - nodes[l[1]][0], nodes[l[0]][1] - nodes[l[1]][1], nodes[l[0]][2] - nodes[l[1]][2]));
    return sim({ dt, init: () => ({ pos: Float32Array.from(nodes.flat()), vel: new Float32Array(N * 3) }), step: (st, h, n) => {
      const p = st.pos, v = st.vel, f = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) for (let a = 0; a < 3; a++) f[i * 3 + a] = gravity[a] - damping * v[i * 3 + a];
      links.forEach((l, q) => {
        const i = l[0] * 3, j = l[1] * 3, dx = p[j] - p[i], dy = p[j + 1] - p[i + 1], dz = p[j + 2] - p[i + 2];
        const L = Math.hypot(dx, dy, dz) || 1e-6, F = k * (L - rest[q]) / L;
        f[i] += F * dx; f[i + 1] += F * dy; f[i + 2] += F * dz; f[j] -= F * dx; f[j + 1] -= F * dy; f[j + 2] -= F * dz;
      });
      for (let i = 0; i < N; i++) {
        if (pin.has(i)) continue;
        for (let a = 0; a < 3; a++) { v[i * 3 + a] += f[i * 3 + a] * h; p[i * 3 + a] += v[i * 3 + a] * h; }
      }
      if (drive) drive(n * h, p, N);
    } });
  }
  /* 2D concentration field u[ny][nx] (flattened), explicit FTCS; the step is split so it is always stable.
     sources: [{ i, j, rate }] add concentration; sinks: [{ i, j, rate }] remove it; edges are no-flux. */
  function diffusion({ nx = 64, ny = 64, D = 1, dx = 1, sources = [], sinks = [], init = null, dt = 1 / 30 } = {}) {
    const stable = 0.2 * dx * dx / D, sub = Math.max(1, Math.ceil(dt / stable)), h = dt / sub;
    return sim({ dt, init: () => ({ u: init ? Float32Array.from(init) : new Float32Array(nx * ny) }), step: (st) => {
      for (let s = 0; s < sub; s++) {
        const u = st.u, nu = new Float32Array(u.length), c = D * h / (dx * dx);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const q = j * nx + i, l = u[j * nx + Math.max(0, i - 1)], r = u[j * nx + Math.min(nx - 1, i + 1)];
          const d = u[Math.max(0, j - 1) * nx + i], t = u[Math.min(ny - 1, j + 1) * nx + i];
          nu[q] = u[q] + c * (l + r + d + t - 4 * u[q]);
        }
        sources.forEach(o => { nu[o.j * nx + o.i] += o.rate * h; });
        sinks.forEach(o => { const q = o.j * nx + o.i; nu[q] = Math.max(0, nu[q] - o.rate * h * nu[q]); });
        st.u = nu;
      }
    } });
  }
  /* passive tracers in a velocity field(x, y, z, t) -> [vx, vy, vz] (RK2); tracers leaving the box re-enter opposite */
  function flow({ n = 300, field, box = [[-1, 1], [-1, 1], [-1, 1]], seed = 3, dt = 1 / 60 } = {}) {
    return sim({ dt, init: () => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = box[a][0] + (box[a][1] - box[a][0]) * rand(seed, i, a);
      return { pos };
    }, step: (st, h, k) => {
      const p = st.pos, t = k * h;
      for (let i = 0; i < n; i++) {
        const j = i * 3, x = p[j], y = p[j + 1], z = p[j + 2];
        const v1 = field(x, y, z, t), v2 = field(x + v1[0] * h / 2, y + v1[1] * h / 2, z + v1[2] * h / 2, t + h / 2);
        for (let a = 0; a < 3; a++) {
          let q = p[j + a] + v2[a] * h; const [lo, hi] = box[a], L = hi - lo;
          if (q < lo) q += L; if (q > hi) q -= L; p[j + a] = q;
        }
      }
    } });
  }

  window.BBPhys = { version: '1.0', rand, gauss, sim, loop, particles, springs, diffusion, flow };
})();
