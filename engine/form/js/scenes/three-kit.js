// Shared helpers for the 3D scenes (welcome, style, workshop).
// Scenes always load three through ctx.three() (see loadThree) and must draw a 2D fallback when it resolves to null.
// The kit enforces the contract's "one WebGL context at a time": creating a renderer evicts the previous one, whose
// owner is told through onEvict (scenes switch to their 2D version) before its context is released.

export const PAL = {
  bg: '#EEEDF9', pill: '#f7f8fa', ink: '#080909', lilac: '#c9c3ef', white: '#ffffff',
  fur: ['#e4d3e8', '#d7c2dd', '#c5b3d5', '#b09fc7', '#9281b0'],
  pink: '#d89cb3', rose: '#b77292', orange: '#f2a65a', plum: '#5b4a73',
};

// Live counters, read by the dev harness and tests (contexts created/disposed, frame timing).
export const kitStats = { created: 0, disposed: 0, live: 0, evicted: 0, frameMs: 0, workMs: 0, frames: 0 };

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
// Frame-rate independent exponential approach (lambda ~ 1/seconds).
export const damp = (cur, target, lambda, dt) => target + (cur - target) * Math.exp(-lambda * dt);
export const ease = {
  outCubic: t => 1 - Math.pow(1 - clamp(t), 3),
  inOutCubic: t => (t = clamp(t)) < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: t => { t = clamp(t); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inBack: t => { t = clamp(t); const c = 1.5; return (c + 1) * t * t * t - c * t * t; },
};

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Reads 'style.threeD' from either a flat map or nested state objects.
export function pick(state, path, fallback) {
  if (!state || typeof state !== 'object') return fallback;
  if (Object.prototype.hasOwnProperty.call(state, path)) return state[path] ?? fallback;
  let v = state;
  for (const k of path.split('.')) { if (v == null || typeof v !== 'object') return fallback; v = v[k]; }
  return v === undefined || v === null ? fallback : v;
}

// Subscribes to the app bus (an EventTarget); returns an unsubscribe function.
export function onBus(bus, type, fn) {
  if (!bus || typeof bus.addEventListener !== 'function') return () => {};
  const h = e => { try { fn((e && e.detail) || {}); } catch (err) { console.warn('[scene]', type, err); } };
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}

export function listen(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  return () => target.removeEventListener(type, fn, opts);
}

export function div(css, parent, cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  if (css) d.style.cssText = css;
  if (parent) parent.appendChild(d);
  return d;
}

// Creates the scene's root layer inside the container (absolute, transparent, never catches the pointer).
export function makeRoot(el, name) {
  const restore = [];
  if (getComputedStyle(el).position === 'static') { const p = el.style.position; el.style.position = 'relative'; restore.push(() => { el.style.position = p; }); }
  const root = div('position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none;' +
    'contain:layout paint;user-select:none;-webkit-user-select:none;', el, 'aura-scene aura-scene-' + name);
  root.setAttribute('aria-hidden', 'true');
  return { root, remove() { root.remove(); restore.forEach(f => f()); } };
}

// Resolves to the THREE namespace or null. Never throws.
export async function loadThree(ctx) {
  try {
    if (!ctx || typeof ctx.three !== 'function') return null;
    const mod = await ctx.three();
    const T = mod && (mod.WebGLRenderer ? mod : mod.default);
    return T && T.WebGLRenderer ? T : null;
  } catch (e) {
    return null;
  }
}

export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

let liveHandle = null;

// A WebGLRenderer on a canvas filling `container` (transparent, DPR capped). Throws if WebGL is unavailable; the
// caller then falls back to 2D. The backing store follows the container's on-screen size (the stage is scaled with
// a CSS transform), so it is never rendered larger than it is shown. A frame-time governor lowers resolution on
// slow GPUs.
export function createRenderer(THREE, container, opts = {}) {
  const { maxDpr = 1.5, maxPixels = 2.4e6, antialias = true, onResize = null, onEvict = null } = opts;
  if (liveHandle) liveHandle.evict();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;';
  container.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias, premultipliedAlpha: true, powerPreference: 'default', stencil: false });
  } catch (e) {
    canvas.remove();
    throw e;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  kitStats.created++; kitStats.live++;

  let disposed = false, quality = 1, slowFrames = 0;
  const size = { w: 0, h: 0, pw: 0, ph: 0, px: 1 };

  function measure(force) {
    if (disposed) return false;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return false;
    const rect = container.getBoundingClientRect();
    const screenScale = rect.width > 0 ? rect.width / w : 1;
    let px = Math.min(window.devicePixelRatio || 1, maxDpr) * screenScale * quality;
    if (w * h * px * px > maxPixels) px = Math.sqrt(maxPixels / (w * h));
    px = Math.max(0.5, px);
    const pw = Math.max(1, Math.round(w * px)), ph = Math.max(1, Math.round(h * px));
    if (!force && pw === size.pw && ph === size.ph && w === size.w && h === size.h) return false;
    Object.assign(size, { w, h, pw, ph, px });
    renderer.setSize(pw, ph, false);
    if (onResize) onResize(w, h);
    return true;
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (measure()) handle.dirty = true; }) : null;
  if (ro) ro.observe(container);
  const onWin = () => { if (measure()) handle.dirty = true; };
  window.addEventListener('resize', onWin);
  // The stage may still be scaling or fading in on mount; re-measure a couple of times.
  const timers = [setTimeout(onWin, 300), setTimeout(onWin, 1200)];

  function dispose() {
    if (disposed) return;
    disposed = true;
    timers.forEach(clearTimeout);
    if (ro) ro.disconnect();
    window.removeEventListener('resize', onWin);
    try { renderer.renderLists.dispose(); } catch (e) {}
    try { renderer.dispose(); } catch (e) {}
    try { renderer.forceContextLoss(); } catch (e) {}
    canvas.width = 1; canvas.height = 1;
    canvas.remove();
    if (liveHandle === handle) liveHandle = null;
    kitStats.disposed++; kitStats.live--;
  }

  const handle = {
    renderer, canvas, size, dirty: true,
    measure,
    get disposed() { return disposed; },
    // Called with each frame's interval; drops resolution in steps when the GPU can't keep up.
    governor(frameMs) {
      if (frameMs > 26 && frameMs < 200) slowFrames++;
      else if (slowFrames > 0) slowFrames--;
      if (slowFrames > 45 && quality > 0.6) { quality = Math.max(0.6, quality - 0.15); slowFrames = 0; measure(true); }
    },
    evict() {
      if (disposed) return;
      kitStats.evicted++;
      dispose();
      if (onEvict) { try { onEvict(); } catch (e) { console.warn('[scene] evict', e); } }
    },
    dispose,
  };
  liveHandle = handle;
  measure(true);
  return handle;
}

// requestAnimationFrame loop that sleeps while the page is hidden. frame(dt, t) returns false to let the loop idle
// until wake() is called (static scenes cost nothing). dt is clamped so a long pause never makes things jump.
export function createLoop(frame, { onFrameTime } = {}) {
  let raf = 0, last = 0, running = false, alive = true;
  function tick(now) {
    raf = 0;
    if (!alive || !running) return;
    const gap = last ? now - last : 16.7;
    const dt = Math.min(0.05, gap / 1000);
    last = now;
    const t0 = performance.now();
    let keep = true;
    try { keep = frame(dt, now / 1000) !== false; } catch (e) { console.warn('[scene] frame', e); keep = false; }
    const work = performance.now() - t0;
    kitStats.frames++;
    kitStats.frameMs = kitStats.frameMs * 0.95 + gap * 0.05;
    kitStats.workMs = kitStats.workMs * 0.95 + work * 0.05;
    if (onFrameTime) onFrameTime(gap);
    if (keep && running && !document.hidden) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  const wake = () => { if (alive && running && !raf && !document.hidden) raf = requestAnimationFrame(tick); };
  const onVis = () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; } else wake();
  };
  document.addEventListener('visibilitychange', onVis);
  return {
    start() { running = true; wake(); },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; },
    wake,
    get running() { return running; },
    dispose() { alive = false; running = false; if (raf) cancelAnimationFrame(raf); raf = 0; document.removeEventListener('visibilitychange', onVis); },
  };
}

// Calm studio light rig: soft sky/ground fill plus a warm key, a cool fill and a rim.
export function addStudioLights(THREE, scene, { intensity = 1, key = [-0.45, 0.8, 0.6] } = {}) {
  const g = new THREE.Group();
  g.name = 'studio-lights';
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc5b3d5, 1.55 * intensity);
  const k = new THREE.DirectionalLight(0xfff4ea, 1.75 * intensity);
  k.position.set(key[0], key[1], key[2]);
  const fill = new THREE.DirectionalLight(0xe6defa, 0.55 * intensity);
  fill.position.set(0.7, 0.1, 0.5);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7 * intensity);
  rim.position.set(0.2, 0.6, -0.8);
  g.add(hemi, k, fill, rim);
  scene.add(g);
  return { group: g, hemi, key: k, fill, rim };
}

// Material + texture factory. Everything it creates is disposed by dispose(). toon() is a soft four-band cel
// shade that matches the flat illustration style; basic() is unlit (exact palette colour).
export function createKit(THREE) {
  const owned = new Set();
  const cache = new Map();
  const own = x => { if (x) owned.add(x); return x; };
  const grad = own(new THREE.DataTexture(new Uint8Array([118, 168, 214, 255]), 4, 1, THREE.RedFormat));
  grad.minFilter = THREE.NearestFilter; grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false; grad.needsUpdate = true;

  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, own(make())); return cache.get(key); };
  return {
    own,
    gradient: grad,
    toon: (color, extra = {}) => memo('t' + color + JSON.stringify(extra), () => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra })),
    basic: (color, extra = {}) => memo('b' + color + JSON.stringify(extra), () => new THREE.MeshBasicMaterial({ color, ...extra })),
    lambert: (color, extra = {}) => memo('l' + color + JSON.stringify(extra), () => new THREE.MeshLambertMaterial({ color, ...extra })),
    line: (color, opacity = 1) => memo('n' + color + opacity, () => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })),
    // A fresh (uncached) material, for per-object opacity animation.
    fresh: (kind, params) => own(new THREE[kind](kind === 'MeshToonMaterial' ? { gradientMap: grad, ...params } : params)),
    canvasTexture(w, h, draw) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = own(new THREE.CanvasTexture(c));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 2;
      return t;
    },
    // Soft round contact shadow (lilac tinted), for objects floating above a surface.
    shadowTexture() {
      return memo('shadow', () => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        r.addColorStop(0, 'rgba(110,90,150,0.55)'); r.addColorStop(0.5, 'rgba(110,90,150,0.22)'); r.addColorStop(1, 'rgba(110,90,150,0)');
        g.fillStyle = r; g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });
    },
    dispose() {
      owned.forEach(o => { try { o.dispose(); } catch (e) {} });
      owned.clear(); cache.clear();
    },
  };
}

const TEX_SLOTS = ['map', 'gradientMap', 'alphaMap', 'emissiveMap', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap',
  'aoMap', 'lightMap', 'envMap', 'specularMap', 'displacementMap'];

// Disposes every geometry, material and texture under root (safe to call on already-disposed resources).
export function disposeTree(root) {
  if (!root) return;
  const seen = new Set();
  const free = x => { if (x && !seen.has(x)) { seen.add(x); try { x.dispose(); } catch (e) {} } };
  root.traverse(o => {
    if (o.geometry) free(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach(m => { TEX_SLOTS.forEach(s => free(m[s])); free(m); });
    if (o.dispose && o.isInstancedMesh) free(o);
  });
  if (root.background && root.background.isTexture) free(root.background);
  if (root.environment && root.environment.isTexture) free(root.environment);
}

// Centered rounded rectangle as a THREE.Shape (or Path when asHole).
export function roundedRect(THREE, w, h, r, asHole = false) {
  const s = asHole ? new THREE.Path() : new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Soft-edged slab (rounded rectangle extruded along z, centred), the kit's "rounded box".
export function roundedSlab(THREE, w, h, depth, r, bevel = Math.min(2, depth / 3)) {
  const g = new THREE.ExtrudeGeometry(roundedRect(THREE, w - bevel * 2, h - bevel * 2, Math.max(0.5, r - bevel)), {
    depth: Math.max(0.1, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
}

// Heart outline (unit size ~1 wide), as a THREE.Shape; used by welcome and workshop.
export function heartShape(THREE, s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.42 * s);
  h.bezierCurveTo(-0.12 * s, -0.3 * s, -0.5 * s, -0.08 * s, -0.5 * s, 0.16 * s);
  h.bezierCurveTo(-0.5 * s, 0.36 * s, -0.36 * s, 0.48 * s, -0.24 * s, 0.48 * s);
  h.bezierCurveTo(-0.11 * s, 0.48 * s, -0.03 * s, 0.4 * s, 0, 0.32 * s);
  h.bezierCurveTo(0.03 * s, 0.4 * s, 0.11 * s, 0.48 * s, 0.24 * s, 0.48 * s);
  h.bezierCurveTo(0.36 * s, 0.48 * s, 0.5 * s, 0.36 * s, 0.5 * s, 0.16 * s);
  h.bezierCurveTo(0.5 * s, -0.08 * s, 0.12 * s, -0.3 * s, 0, -0.42 * s);
  return h;
}

// Four-point sparkle star (outer radius 1).
export function sparkleShape(THREE, inner = 0.28) {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? inner : 1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

// World point -> container pixel coordinates (x right, y down).
export function toScreen(v, camera, w, h, out = { x: 0, y: 0, z: 0 }) {
  const p = v.clone().project(camera);
  out.x = (p.x + 1) / 2 * w; out.y = (1 - p.y) / 2 * h; out.z = p.z;
  return out;
}

// Draws a rounded rectangle path on a 2D canvas context.
export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A 2D canvas filling the container at the right resolution (used by the fallbacks). draw() is the caller's job.
export function createCanvas2D(container, { maxDpr = 1.5 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;';
  container.appendChild(canvas);
  const g = canvas.getContext('2d');
  const size = { w: 0, h: 0, px: 1 };
  function measure() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return false;
    const rect = container.getBoundingClientRect();
    const px = Math.max(0.5, Math.min(window.devicePixelRatio || 1, maxDpr) * (rect.width > 0 ? rect.width / w : 1));
    const pw = Math.round(w * px), ph = Math.round(h * px);
    if (canvas.width === pw && canvas.height === ph && size.w === w) return false;
    canvas.width = pw; canvas.height = ph;
    Object.assign(size, { w, h, px });
    return true;
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (measure()) api.dirty = true; }) : null;
  if (ro) ro.observe(container);
  const onWin = () => { if (measure()) api.dirty = true; };
  window.addEventListener('resize', onWin);
  const timers = [setTimeout(onWin, 300), setTimeout(onWin, 1200)];
  const api = {
    canvas, g, size, dirty: true, measure,
    // Clears and sets the transform so drawing uses container (design) pixels.
    begin() { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); g.setTransform(size.px, 0, 0, size.px, 0, 0); },
    dispose() { timers.forEach(clearTimeout); if (ro) ro.disconnect(); window.removeEventListener('resize', onWin); canvas.width = canvas.height = 1; canvas.remove(); },
  };
  measure();
  return api;
}
