// Style scene: the live preview for "how lively should it be?". A mini slide with a gear train on it.
//   style.threeD "yes"  -> the gears become a rotating 3D model (orbiting sparks, energy ring, sway)
//   style.twoD   "yes"  -> animated 2D flow arrows, a self-drawing chart and labelled call-outs
//   style.amount 0-100  -> scales gear count, particle count, speed, secondary motion and 2D richness
//   both "no"           -> a clean, still illustration (the loop goes idle)
// Layers: canvas "under" (slide card + flat gears), WebGL (3D gears), canvas "over" (2D annotations).
// Without three.js the under canvas draws the gears with a pseudo-3D extrusion instead.
import {
  PAL, clamp, lerp, damp, smooth, pick, makeRoot, loadThree, createRenderer, createLoop, addStudioLights,
  createKit, disposeTree, createCanvas2D, rr, onBus,
} from './three-kit.js';

const DW = 660, DH = 390;                       // design size of #illus
const CARD = { x: 84, y: 92, w: 470, h: 264, r: 20 };
const CENTER = [404, 222];                      // gear assembly centre (design px)
const MOD = 4.2;                                // gear module (px per tooth of pitch diameter)

// Gear chain, offsets from CENTER in design px (y down). parent/ang place each gear in mesh with its parent.
const GEARS = (() => {
  const spec = [
    { N: 22, color: PAL.fur[3], hub: PAL.fur[4], depth: 14, at: [-36, 8], thr: 0 },
    { N: 12, color: PAL.pink, hub: PAL.rose, depth: 12, parent: 0, ang: -38, thr: 0 },
    { N: 17, color: PAL.lilac, hub: PAL.fur[3], depth: 12, parent: 1, ang: 28, thr: 0 },
    { N: 10, color: PAL.orange, hub: '#d8833a', depth: 10, parent: 2, ang: 96, thr: 0.38 },
    { N: 14, color: PAL.fur[2], hub: PAL.fur[4], depth: 11, parent: 0, ang: 196, thr: 0.68 },
  ];
  const out = [];
  spec.forEach((s, i) => {
    const r = s.N * MOD / 2;
    const g = { ...s, i, r, ra: r + MOD, rr: r - 1.25 * MOD, x: 0, y: 0, theta: 0 };
    if (s.parent === undefined) { g.x = s.at[0]; g.y = s.at[1]; }
    else {
      const p = out[s.parent], d = p.r + r, a = s.ang * Math.PI / 180;
      g.x = p.x + Math.cos(a) * d; g.y = p.y + Math.sin(a) * d;
      g.theta = Math.atan2(g.y - p.y, g.x - p.x);   // contact direction, screen orientation (y down)
    }
    out.push(g);
  });
  return out;
})();

// Rotation of every gear from the driver angle, so the teeth always mesh (angles in screen orientation).
function gearAngles(phi0, out) {
  out[0] = phi0;
  for (let i = 1; i < GEARS.length; i++) {
    const g = GEARS[i], p = GEARS[g.parent], th = g.theta;
    out[i] = -(p.N / g.N) * (out[g.parent] - th) + th + Math.PI + Math.PI / g.N;
  }
  return out;
}

// Gear outline points (screen orientation), shared by the 3D shape and the 2D drawing.
function gearPoints(g) {
  const pts = [], p = Math.PI * 2 / g.N;
  for (let k = 0; k < g.N; k++) {
    const a = k * p;
    pts.push([g.rr, a - 0.31 * p], [g.ra, a - 0.15 * p], [g.ra, a + 0.15 * p], [g.rr, a + 0.31 * p]);
  }
  return pts.map(([r, a]) => [Math.cos(a) * r, Math.sin(a) * r]);
}
const holeCount = g => (g.N >= 16 ? 5 : g.N >= 12 ? 4 : 0);

// 2D annotation call-outs: gear index, label text, offset of the pill from the gear centre, presence threshold.
const LABELS = [
  { gear: 0, text: 'speed', value: 'rpm', off: [-16, 112], thr: 0 },
  { gear: 2, text: 'ratio 22 : 17', off: [92, -96], thr: 0.3 },
  { gear: 1, text: 'torque', off: [10, -122], thr: 0.55 },
  { gear: 3, text: 'output', off: [86, 48], thr: 0.8 },
];

function readState(state, ctx) {
  const s = state || (ctx.getState ? ctx.getState() : null) || {};
  const yes = v => String(v).toLowerCase() !== 'no' && v !== false;
  let amount = +pick(s, 'style.amount', NaN);
  if (!Number.isFinite(amount)) amount = Number.isFinite(+ctx.amount) ? +ctx.amount : 60;
  return { threeD: yes(pick(s, 'style.threeD', 'yes')), twoD: yes(pick(s, 'style.twoD', 'yes')), amount: clamp(amount, 0, 100) / 100 };
}

// Underdamped spring, gives transitions a small friendly overshoot.
function spring(o, key, target, dt, k = 80, c = 12) {
  const vk = key + 'V';
  const v = (o[vk] || 0) + ((target - o[key]) * k - (o[vk] || 0) * c) * dt;
  o[vk] = v;
  o[key] += v * dt;
  return Math.abs(target - o[key]) > 0.002 || Math.abs(o[vk]) > 0.002;
}

function makeModel(st, reduced) {
  return {
    reduced, t: 0, phi: 0, sway: 0,
    target: st,
    p3: st.threeD ? 1 : 0, p2: st.twoD ? 1 : 0, amt: st.amount,
    gearP: GEARS.map(g => (st.amount >= g.thr ? 1 : 0)),
    labelP: LABELS.map(l => (st.twoD && st.amount >= l.thr ? 1 : 0)),
    chartP: st.twoD && st.amount >= 0.18 ? 1 : 0,
    chartDraw: st.twoD ? 1 : 0,
    angles: new Array(GEARS.length).fill(0),
    screen: GEARS.map(g => ({ x: CENTER[0] + g.x, y: CENTER[1] + g.y, s: 1 })),
    speed: 0, intro: reduced ? 1 : 0,
  };
}

// Advances the model; returns true while anything still moves.
function step(m, dt) {
  const T = m.target, rm = m.reduced;
  m.t += dt;
  let busy = false;
  if (m.intro < 1) { m.intro = Math.min(1, m.intro + dt / 0.9); busy = true; }
  busy = spring(m, 'p3', T.threeD ? 1 : 0, dt, 60, 11) || busy;
  busy = spring(m, 'p2', T.twoD ? 1 : 0, dt, 70, 13) || busy;
  const a0 = m.amt;
  m.amt = damp(m.amt, T.amount, 4.5, dt);
  if (Math.abs(m.amt - a0) > 1e-4) busy = true;
  GEARS.forEach((g, i) => { busy = spring(m.gearP, i, m.amt >= g.thr ? 1 : 0, dt, 90, 12) || busy; });
  LABELS.forEach((l, i) => { busy = spring(m.labelP, i, T.twoD && m.amt >= l.thr ? 1 : 0, dt, 90, 13) || busy; });
  busy = spring(m, 'chartP', T.twoD && m.amt >= 0.18 ? 1 : 0, dt, 80, 13) || busy;
  m.chartDraw = T.twoD ? Math.min(1, m.chartDraw + dt / 1.6) : 0;

  // Motion: the gears turn when either kind of animation is on; 3D adds sway and sparks.
  const motion = rm ? 0 : clamp(Math.max(m.p3, m.p2 * 0.8));
  const speedTarget = motion * (0.22 + 1.25 * m.amt);
  m.speed = damp(m.speed, speedTarget, 2.5, dt);
  m.phi += m.speed * dt;
  gearAngles(m.phi, m.angles);
  m.sway = rm ? 0 : (0.18 + 0.42 * m.amt) * clamp(m.p3);
  const live = !rm && (T.threeD || T.twoD);
  return busy || live || m.speed > 0.002 || m.chartDraw < 1 && T.twoD;
}

// ---------------------------------------------------------------- 2D drawing helpers
function gearPath(g, holes = true) {
  const p = new Path2D();
  gearPoints(g).forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  if (holes) {
    const hr = g.r * 0.2;
    p.moveTo(hr, 0); p.arc(0, 0, hr, 0, Math.PI * 2, true);
    const n = holeCount(g);
    for (let k = 0; k < n; k++) {
      const a = k * Math.PI * 2 / n + 0.4, cx = Math.cos(a) * g.r * 0.56, cy = Math.sin(a) * g.r * 0.56, r = g.r * (n > 4 ? 0.15 : 0.13);
      p.moveTo(cx + r, cy); p.arc(cx, cy, r, 0, Math.PI * 2, true);
    }
  }
  return p;
}
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(clamp(c * k, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// Draws the gear train flat (depth 0) or as a pseudo-3D extrusion (depth up to 1). alpha fades everything.
function drawGears2D(g, m, { depth = 0, alpha = 1, sparks = 0 } = {}) {
  if (alpha <= 0.003) return;
  g.save();
  g.globalAlpha = alpha;
  const cx = CENTER[0], cy = CENTER[1] + (m.reduced ? 0 : Math.sin(m.t * 1.1) * 4 * depth * m.amt);
  // soft contact shadow on the card
  g.fillStyle = 'rgba(146,129,176,0.16)';
  g.beginPath(); g.ellipse(cx - 8, CARD.y + CARD.h - 22, 130 * (0.7 + 0.3 * m.amt), 12, 0, 0, Math.PI * 2); g.fill();
  GEARS.forEach((G, i) => {
    const p = m.gearP[i];
    if (p <= 0.01) return;
    const paths = gearPath(G);
    g.save();
    g.translate(cx + G.x, cy + G.y);
    g.scale(Math.max(0.001, p), Math.max(0.001, p));
    const thick = G.depth * 0.55 * depth;
    if (thick > 0.3) {
      g.save(); g.translate(thick * 0.45, thick); g.rotate(m.angles[i]);
      g.fillStyle = shade(G.color, 0.78); g.fill(paths, 'evenodd');
      g.restore();
    }
    g.save(); g.rotate(m.angles[i]);
    g.fillStyle = G.color; g.fill(paths, 'evenodd');
    g.fillStyle = shade(G.color, 0.9);
    g.beginPath(); g.arc(0, 0, G.r * 0.34, 0, Math.PI * 2); g.arc(0, 0, G.r * 0.2, 0, Math.PI * 2, true); g.fill('evenodd');
    g.fillStyle = G.hub; g.beginPath(); g.arc(0, 0, G.r * 0.12, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.ink; g.beginPath(); g.arc(0, 0, Math.max(2.5, G.r * 0.055), 0, Math.PI * 2); g.fill();
    if (i === 0) { // crank
      g.strokeStyle = PAL.fur[4]; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(G.r * 0.62, 0); g.stroke();
      g.fillStyle = PAL.orange; g.beginPath(); g.arc(G.r * 0.62, 0, 6.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    g.restore();
  });
  if (sparks > 0.01) drawSparks2D(g, m, cx, cy, sparks);
  g.restore();
}

function sparkPos(m, k, n, out) {
  const ring = k % 3, a = m.t * (0.5 + ring * 0.18) * (ring === 1 ? -1 : 1) + k * 2.39996;
  const R = 150 + ring * 22, tilt = 0.3 + ring * 0.08;
  out.x = Math.cos(a) * R; out.y = Math.sin(a) * R * tilt - 6; out.z = Math.sin(a);
  out.s = 0.6 + 0.4 * ((k * 7) % 5) / 4;
  return out;
}
const SPARK_COLORS = [PAL.pink, PAL.fur[3], PAL.orange, PAL.lilac, PAL.rose];
const sparkCount = amt => Math.round(4 + amt * 40);

function drawSparks2D(g, m, cx, cy, alpha) {
  const n = sparkCount(m.amt), o = {};
  for (let k = 0; k < n; k++) {
    sparkPos(m, k, n, o);
    const pres = clamp((m.amt * 44 + 4 - k) / 2);
    if (pres <= 0) continue;
    g.globalAlpha = alpha * pres * (0.55 + 0.45 * (o.z + 1) / 2);
    g.fillStyle = SPARK_COLORS[k % 5];
    g.beginPath(); g.arc(cx + o.x, cy + o.y, 3.2 * o.s * (0.8 + 0.25 * o.z), 0, Math.PI * 2); g.fill();
  }
}

function drawCard(g, m) {
  const k = smooth(m.intro);
  g.save();
  g.globalAlpha = k;
  g.translate(0, (1 - k) * 12);
  const { x, y, w, h, r } = CARD;
  g.fillStyle = PAL.fur[0]; rr(g, x + 6, y + 8, w, h, r); g.fill();
  g.fillStyle = PAL.pill; rr(g, x, y, w, h, r); g.fill();
  g.fillStyle = PAL.ink; rr(g, x + 28, y + 26, 156, 14, 7); g.fill();
  g.fillStyle = PAL.lilac; rr(g, x + 28, y + 50, 102, 9, 4.5); g.fill();
  const rows = 4 - Math.round(2 * clamp(m.chartP));
  for (let i = 0; i < 4; i++) {
    const vis = i < rows ? 1 : clamp(1 - m.chartP * 1.4);
    if (vis <= 0.01) continue;
    g.globalAlpha = k * vis;
    g.fillStyle = PAL.fur[3]; g.beginPath(); g.arc(x + 33, y + 92 + i * 26, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.fur[1]; rr(g, x + 46, y + 88 + i * 26, [118, 96, 108, 80][i], 8, 4); g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- 2D annotations (over layer)
function arrowHead(g, x, y, ang, s) {
  g.beginPath();
  g.moveTo(x + Math.cos(ang) * s, y + Math.sin(ang) * s);
  g.lineTo(x + Math.cos(ang + 2.5) * s, y + Math.sin(ang + 2.5) * s);
  g.lineTo(x + Math.cos(ang - 2.5) * s, y + Math.sin(ang - 2.5) * s);
  g.closePath(); g.fill();
}

function drawOverlay(g, m) {
  const p2 = clamp(m.p2);
  if (p2 <= 0.003) return;
  const t = m.reduced ? 0 : m.t, A = m.amt;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';

  // Rotation arrows hugging each gear, direction matching its spin.
  GEARS.forEach((G, i) => {
    const sp = m.screen[i];
    const pres = p2 * clamp(m.gearP[i]) * clamp(A * 4 + 1 - i);
    if (pres <= 0.01) return;
    const spin = gearSpinSign(i);
    const R = (G.ra + 11) * sp.s, a0 = (i * 1.7 + 3.6) + (m.reduced ? 0 : Math.sin(t * 0.3 + i) * 0.1), span = 1.5 * pres;
    g.globalAlpha = pres;
    g.strokeStyle = i % 2 ? PAL.rose : PAL.fur[4]; g.fillStyle = g.strokeStyle; g.lineWidth = 3;
    g.setLineDash([7, 7]); g.lineDashOffset = -t * 22 * spin;
    g.beginPath(); g.arc(sp.x, sp.y, R, a0, a0 + span * spin, spin < 0); g.stroke();
    g.setLineDash([]);
    const ae = a0 + span * spin;
    arrowHead(g, sp.x + Math.cos(ae) * R, sp.y + Math.sin(ae) * R, ae + Math.PI / 2 * spin, 7);
  });

  // Power flow: from the bullet list into the driver gear, with travelling dots.
  const flowP = p2 * clamp(A * 3 + 0.35);
  if (flowP > 0.01) {
    const s0 = m.screen[0];
    const x0 = CARD.x + 176, y0 = CARD.y + 96, x1 = s0.x - GEARS[0].ra * s0.s - 8, y1 = s0.y - 6;
    const cx1 = x0 + 50, cy1 = y0 - 50, cx2 = x1 - 46, cy2 = y1 - 50;
    g.globalAlpha = flowP * 0.9;
    g.strokeStyle = PAL.orange; g.fillStyle = PAL.orange; g.lineWidth = 3.2;
    g.setLineDash([2, 9]); g.lineDashOffset = -t * 30;
    g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(cx1, cy1, cx2, cy2, x1, y1); g.stroke();
    g.setLineDash([]);
    const ang = Math.atan2(y1 - cy2, x1 - cx2);
    arrowHead(g, x1, y1, ang, 8);
    const dots = 1 + Math.round(A * 3);
    for (let k = 0; k < dots; k++) {
      const u = ((t * 0.32 + k / dots) % 1), v = 1 - u;
      const bx = v * v * v * x0 + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * x1;
      const by = v * v * v * y0 + 3 * v * v * u * cy1 + 3 * v * u * u * cy2 + u * u * u * y1;
      g.globalAlpha = flowP * Math.sin(u * Math.PI);
      g.beginPath(); g.arc(bx, by, 4.5, 0, Math.PI * 2); g.fill();
    }
  }

  // Mini line chart in the card (draws itself, then breathes).
  const cp = clamp(m.chartP) * p2;
  if (cp > 0.01) {
    const x = CARD.x + 24, y = CARD.y + 140, w = 176, h = 100;
    g.globalAlpha = cp;
    g.fillStyle = '#ffffff'; rr(g, x, y + (1 - cp) * 10, w, h, 12); g.fill();
    g.strokeStyle = PAL.fur[0]; g.lineWidth = 1.5;
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + 12, y + 18 + k * 24); g.lineTo(x + w - 12, y + 18 + k * 24); g.stroke(); }
    const pts = [], n = 28, draw = clamp(m.chartDraw);
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const v = 0.18 + 0.62 * u + 0.09 * Math.sin(u * 7 + t * (0.6 + A)) * (0.4 + A);
      pts.push([x + 14 + u * (w - 28), y + h - 16 - clamp(v) * (h - 34)]);
    }
    const lastIdx = Math.max(1, Math.round(draw * n));
    g.strokeStyle = PAL.rose; g.lineWidth = 3;
    g.beginPath(); pts.slice(0, lastIdx + 1).forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    if (A > 0.45) {
      g.globalAlpha = cp * clamp((A - 0.45) * 5) * 0.8;
      g.strokeStyle = PAL.fur[3]; g.lineWidth = 2.4; g.setLineDash([5, 6]);
      g.beginPath();
      pts.slice(0, lastIdx + 1).forEach(([px, py], k) => { const yy = py + 18 + 6 * Math.sin(k * 0.5 + t); return k ? g.lineTo(px, Math.min(y + h - 14, yy)) : g.moveTo(px, Math.min(y + h - 14, yy)); });
      g.stroke(); g.setLineDash([]);
      g.globalAlpha = cp;
    }
    const [ex, ey] = pts[lastIdx];
    g.fillStyle = PAL.rose; g.beginPath(); g.arc(ex, ey, 5 + (m.reduced ? 0 : Math.sin(t * 4) * 1.2), 0, Math.PI * 2); g.fill();
    g.fillStyle = PAL.ink; g.font = '14px "DM Sans", system-ui, sans-serif'; g.textBaseline = 'top';
    g.fillText('rpm', x + 14, y + 10);
  }

  // Call-out labels with leader lines.
  g.font = '15px "DM Sans", system-ui, sans-serif'; g.textBaseline = 'middle';
  LABELS.forEach((L, i) => {
    const pres = p2 * clamp(m.labelP[i]) * clamp(m.gearP[L.gear] * 1.5);
    if (pres <= 0.01) return;
    const sp = m.screen[L.gear];
    const rpm = Math.round(m.speed * 60 / (Math.PI * 2) * 10);
    const text = L.value ? `${L.text}  ${rpm} ${L.value}` : L.text;
    const tw = g.measureText(text).width, pw = tw + 26, ph = 30;
    const bob = m.reduced ? 0 : Math.sin(t * 1.3 + i * 1.7) * 3 * A;
    let lx = clamp(sp.x + L.off[0] - pw / 2, 6, DW - pw - 6), ly = clamp(sp.y + L.off[1] + bob, 6, DH - ph - 6);
    const s = 0.7 + 0.3 * pres;
    g.globalAlpha = pres;
    // leader line to a point on the gear's rim
    const ax = lx + pw / 2, ay = ly + ph / 2, ang = Math.atan2(ay - sp.y, ax - sp.x);
    const rx = sp.x + Math.cos(ang) * GEARS[L.gear].r * 0.7 * sp.s, ry = sp.y + Math.sin(ang) * GEARS[L.gear].r * 0.7 * sp.s;
    g.strokeStyle = PAL.ink; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(ax, ay); g.stroke();
    g.fillStyle = PAL.ink; g.beginPath(); g.arc(rx, ry, 3.5, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(ax, ay); g.scale(s, s); g.translate(-ax, -ay);
    g.fillStyle = PAL.ink; rr(g, lx, ly, pw, ph, ph / 2); g.fill();
    g.fillStyle = PAL.pill; g.fillText(text, lx + 13, ly + ph / 2 + 1);
    g.restore();
  });
  g.restore();
}
function gearSpinSign(i) { let s = 1, j = i; while (GEARS[j].parent !== undefined) { s = -s; j = GEARS[j].parent; } return s; }

// ---------------------------------------------------------------- 3D renderer
// createRenderer() allocates a WebGL context; if building the scene throws, release it here (nothing else can).
function create3D(THREE, root, m, onEvict) {
  const gl = createRenderer(THREE, root, { maxPixels: 1.6e6, onEvict });
  try { return build3D(THREE, root, m, onEvict, gl); } catch (e) { try { gl.dispose(); } catch (e2) { /* ignore */ } throw e; }
}

function build3D(THREE, root, m, onEvict, gl) {
  gl.canvas.style.zIndex = '1';
  const kit = createKit(THREE);
  const scene = new THREE.Scene();
  const D = 1400;
  const camera = new THREE.PerspectiveCamera(20, DW / DH, 10, 4000);
  camera.position.set(0, 0, D);
  const lights = addStudioLights(THREE, scene, { intensity: 1, key: [-0.6, 0.75, 0.55] });
  lights.hemi.intensity = 1.0; lights.key.intensity = 2.3;  // more modelling so the teeth read as solid
  let fitS = 1;
  const fit = (w, h) => {
    fitS = Math.min(w / DW, h / DH) || 1;
    camera.aspect = w / h;
    camera.fov = 2 * Math.atan((h / fitS / 2) / D) * 180 / Math.PI;
    camera.updateProjectionMatrix();
  };
  fit(gl.size.w || DW, gl.size.h || DH);

  const holder = new THREE.Group();          // positioned at CENTER
  const asm = new THREE.Group();             // sways
  holder.add(asm);
  scene.add(holder);
  holder.position.set(CENTER[0] - DW / 2, DH / 2 - CENTER[1], 0);

  const gearMeshes = GEARS.map((G, i) => {
    const shape = new THREE.Shape();
    gearPoints(G).forEach(([x, y], k) => (k ? shape.lineTo(x, -y) : shape.moveTo(x, -y)));
    shape.closePath();
    const hub = new THREE.Path(); hub.absarc(0, 0, G.r * 0.2, 0, Math.PI * 2, true); shape.holes.push(hub);
    const n = holeCount(G);
    for (let k = 0; k < n; k++) {
      const a = -(k * Math.PI * 2 / n + 0.4), h = new THREE.Path();
      h.absarc(Math.cos(a) * G.r * 0.56, Math.sin(a) * G.r * 0.56, G.r * (n > 4 ? 0.15 : 0.13), 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const bevel = 1.8, depth = G.depth * 1.7;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 1.1, bevelSegments: 2, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2 + bevel);
    const grp = new THREE.Group();
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(geo, kit.toon(G.color)));
    // hub boss, axle and ink cap
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(G.r * 0.34, G.r * 0.34, depth + 4, 32, 1, true), kit.toon(shade(G.color, 0.9), { side: THREE.DoubleSide }));
    boss.rotation.x = Math.PI / 2;
    const bossRing = new THREE.Mesh(new THREE.RingGeometry(G.r * 0.2, G.r * 0.34, 32), kit.toon(shade(G.color, 0.92)));
    bossRing.position.z = depth / 2 + 2;
    spin.add(boss, bossRing);
    if (i === 0) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(G.r * 0.62, 6, 5), kit.toon(PAL.fur[4]));
      arm.position.set(G.r * 0.31, 0, depth / 2 + 7);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 16, 20), kit.toon(PAL.orange));
      knob.rotation.x = Math.PI / 2; knob.position.set(G.r * 0.62, 0, depth / 2 + 14);
      spin.add(arm, knob);
    }
    grp.add(spin);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(G.r * 0.12, G.r * 0.12, depth + 18, 20), kit.toon(G.hub));
    axle.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(Math.max(3, G.r * 0.07), 16, 10), kit.toon(PAL.ink));
    cap.position.z = depth / 2 + 9;
    grp.add(axle, cap);
    grp.position.set(G.x, -G.y, (i % 2 ? -7 : 7));
    asm.add(grp);
    return { grp, spin };
  });

  // Back strut tying the axles together, so the train reads as one machine.
  const strutMat = kit.toon(PAL.fur[1]);
  const struts = [];
  GEARS.forEach((G, i) => {
    if (G.parent === undefined) return;
    const P = GEARS[G.parent], len = Math.hypot(G.x - P.x, G.y - P.y);
    const s = new THREE.Mesh(new THREE.BoxGeometry(len, 9, 4), strutMat);
    s.position.set((G.x + P.x) / 2, -(G.y + P.y) / 2, -24);
    s.rotation.z = -Math.atan2(G.y - P.y, G.x - P.x);
    asm.add(s);
    struts.push({ mesh: s, i });
  });

  // Energy ring and orbiting sparks.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(176, 1.6, 6, 120), kit.basic(PAL.fur[3], { transparent: true, opacity: 0.55 }));
  ring.rotation.x = Math.PI / 2 - 0.3;
  holder.add(ring);
  const MAXS = 48;
  const sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(4.2, 0), kit.basic('#ffffff'), MAXS);
  const col = new THREE.Color();
  for (let k = 0; k < MAXS; k++) sparks.setColorAt(k, col.set(SPARK_COLORS[k % 5]));
  sparks.frustumCulled = false;
  holder.add(sparks);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(320, 46), kit.basic('#ffffff', { map: kit.shadowTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
  shadow.position.set(-8, -(CARD.y + CARD.h - 22 - CENTER[1]), -40);
  holder.add(shadow);
  const tmp = new THREE.Object3D(), o = {}, v = new THREE.Vector3();

  return {
    gl,
    render() {
      if (gl.disposed) return;
      if (gl.size.w && (Math.abs(camera.aspect - gl.size.w / gl.size.h) > 1e-3)) fit(gl.size.w, gl.size.h);
      const p3 = Math.max(0, m.p3), t = m.reduced ? 0 : m.t;
      holder.visible = p3 > 0.005;
      if (holder.visible) {
        const pop = Math.max(0.001, p3);
        holder.scale.setScalar(0.55 + 0.45 * pop);
        holder.position.y = DH / 2 - CENTER[1] - (1 - Math.min(1, p3)) * 30 + Math.sin(t * 1.1) * 4 * m.amt * (m.reduced ? 0 : 1);
        asm.rotation.y = -0.48 + Math.sin(t * 0.45) * m.sway;
        asm.rotation.x = 0.3 + Math.sin(t * 0.31 + 1) * 0.1 * m.sway;
        asm.rotation.z = Math.sin(t * 0.27) * 0.03 * m.sway;
        gearMeshes.forEach((gm, i) => {
          const p = Math.max(0, m.gearP[i]);
          gm.grp.visible = p > 0.01;
          gm.grp.scale.setScalar(Math.max(0.001, p));
          gm.spin.rotation.z = -m.angles[i];
        });
        struts.forEach(s => { const p = Math.min(m.gearP[s.i], m.gearP[GEARS[s.i].parent]); s.mesh.visible = p > 0.05; s.mesh.scale.set(Math.max(0.001, p), 1, 1); });
        const rich = clamp((m.amt - 0.5) * 3);
        ring.visible = rich > 0.01;
        ring.material.opacity = 0.5 * rich * Math.min(1, p3);
        ring.scale.setScalar(0.96 + 0.04 * Math.sin(t * 2));
        ring.rotation.z = t * 0.2;
        const n = Math.min(MAXS, sparkCount(m.amt) + 1);
        let c = 0;
        for (let k = 0; k < n; k++) {
          const pres = clamp((m.amt * 44 + 4 - k) / 2);
          if (pres <= 0) continue;
          sparkPos(m, k, n, o);
          tmp.position.set(o.x, -o.y, o.z * 120);
          tmp.rotation.set(t + k, t * 0.7 + k, 0);
          tmp.scale.setScalar(pres * o.s);
          tmp.updateMatrix();
          sparks.setMatrixAt(c++, tmp.matrix);
        }
        sparks.count = c;
        sparks.instanceMatrix.needsUpdate = true;
        shadow.material.opacity = 0.5 * Math.min(1, p3);
        // Projected gear centres, so the 2D call-outs stay attached to the moving 3D gears.
        scene.updateMatrixWorld();
        const W = gl.size.w || DW, H = gl.size.h || DH;
        gearMeshes.forEach((gm, i) => {
          gm.grp.getWorldPosition(v); v.project(camera);
          const sx = ((v.x + 1) / 2 * W - (W - DW * fitS) / 2) / fitS, sy = ((1 - v.y) / 2 * H - (H - DH * fitS) / 2) / fitS;
          const k = clamp(p3);
          const flat = m.screen[i];
          flat.x = lerp(CENTER[0] + GEARS[i].x, sx, k); flat.y = lerp(CENTER[1] + GEARS[i].y, sy, k);
          flat.s = lerp(1, holder.scale.x, k);
        });
      } else {
        GEARS.forEach((G, i) => { m.screen[i].x = CENTER[0] + G.x; m.screen[i].y = CENTER[1] + G.y; m.screen[i].s = 1; });
      }
      gl.renderer.render(scene, camera);
    },
    dispose() { disposeTree(scene); kit.dispose(); gl.dispose(); },
  };
}

// ---------------------------------------------------------------- mount
export default {
  mount(el, ctx = {}) {
    const reduced = !!ctx.reducedMotion;
    const { root, remove } = makeRoot(el, 'style');
    const m = makeModel(readState(null, ctx), reduced);
    const under = createCanvas2D(root), over = createCanvas2D(root);
    under.canvas.style.zIndex = '0'; over.canvas.style.zIndex = '2';
    let view3 = null, dead = false, fallback = false, loop;
    const offs = [];

    const paint = () => {
      const s = Math.min(under.size.w / DW, under.size.h / DH) || 1;
      const ox = (under.size.w - DW * s) / 2, oy = (under.size.h - DH * s) / 2;
      under.begin(); under.g.translate(ox, oy); under.g.scale(s, s);
      drawCard(under.g, m);
      if (view3) {
        view3.render();
        drawGears2D(under.g, m, { depth: 0, alpha: clamp(1 - m.p3) });
      } else {
        GEARS.forEach((G, i) => { m.screen[i].x = CENTER[0] + G.x; m.screen[i].y = CENTER[1] + G.y; m.screen[i].s = 1; });
        drawGears2D(under.g, m, { depth: clamp(m.p3), alpha: 1, sparks: clamp(m.p3) * (fallback ? 1 : 0) });
      }
      over.begin(); over.g.translate(ox, oy); over.g.scale(s, s);
      drawOverlay(over.g, m);
    };
    loop = createLoop(dt => { const busy = step(m, dt); paint(); return busy; },
      { onFrameTime: ms => view3 && view3.gl.governor(ms) });

    const toFallback = () => {
      if (dead) return;
      if (view3) { try { view3.dispose(); } catch (e) {} }
      view3 = null; fallback = true; loop.wake();
    };
    loadThree(ctx).then(THREE => {
      if (dead) return;
      if (THREE) {
        try { view3 = create3D(THREE, root, m, toFallback); }
        catch (e) { console.info('[scene] style: 3D unavailable, drawing in 2D'); view3 = null; }
      }
      fallback = !view3;
      loop.start();
    });
    if (document.fonts && document.fonts.load) document.fonts.load('15px "DM Sans"').then(() => loop.wake(), () => {});
    // Draw the card at once (before three has loaded) so the zone is never empty.
    paint();
    offs.push(onBus(ctx.bus, 'state:change', d => { if (d && String(d.key || '').startsWith('style.')) api.update(d.state); }));

    const api = {
      update(state) {
        if (dead) return;
        const st = readState(state, ctx);
        const T = m.target;
        if (st.threeD !== T.threeD || st.twoD !== T.twoD || Math.abs(st.amount - T.amount) > 1e-4) {
          if (st.twoD && !T.twoD) m.chartDraw = 0;
          m.target = st;
        }
        loop.wake();
      },
      destroy() {
        if (dead) return;
        dead = true;
        offs.forEach(f => f());
        loop.dispose();
        if (view3) { try { view3.dispose(); } catch (e) {} view3 = null; }
        under.dispose(); over.dispose();
        remove();
      },
      get debug() { return { mode: view3 ? '3d' : '2d', p3: m.p3, p2: m.p2, amt: m.amt, running: loop.running }; },
    };
    return api;
  },
};
