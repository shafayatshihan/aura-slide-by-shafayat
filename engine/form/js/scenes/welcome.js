// Welcome scene: a few soft 3D objects (slide cards, a paper plane, a heart, a ring, a light bulb, a pencil and
// sparkles) drifting in the empty space around the full-mode character, with gentle pointer parallax.
// Everything is modelled in stage pixels (1600x900) so the character keep-out is checked exactly on screen; the 3D
// renderer and the 2D fallback both draw from the same model.
import {
  PAL, clamp, lerp, damp, ease, onBus, listen, makeRoot, loadThree, createRenderer, createLoop, addStudioLights,
  createKit, disposeTree, roundedSlab, heartShape, sparkleShape, createCanvas2D, rr,
} from './three-kit.js';

const BW = 1600, BH = 900;
// Character silhouette in full mode, [y, xLeft, xRight] in stage px (measured from the video). Nothing above y=228.
const SIL = [[228, 720, 800], [250, 672, 864], [300, 618, 956], [350, 577, 1001], [400, 536, 1059], [450, 476, 1134],
  [500, 418, 1191], [550, 368, 1242], [600, 330, 1295], [650, 302, 1332], [700, 280, 1356], [750, 265, 1364],
  [800, 257, 1367], [900, 257, 1367]];
const MARGIN = 16;

export function silhouetteAt(y) {
  if (y < SIL[0][0]) return null;
  for (let i = 1; i < SIL.length; i++) {
    if (y <= SIL[i][0]) {
      const a = SIL[i - 1], b = SIL[i], t = (y - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
  }
  return [SIL[SIL.length - 1][1], SIL[SIL.length - 1][2]];
}

// Horizontal push (px) that moves a circle off the silhouette, 0 when clear. Coordinates in 1600x900 space.
export function silhouettePush(cx, cy, r, margin = MARGIN) {
  const R = r + margin;
  let push = 0;
  for (let i = 0; i <= 12; i++) {
    let yy = cy - R + (2 * R * i) / 12;
    if (yy < SIL[0][0]) { if (cy + R < SIL[0][0]) continue; yy = SIL[0][0]; }
    const s = silhouetteAt(yy);
    if (!s) continue;
    const hw = Math.sqrt(Math.max(0, R * R - (yy - cy) * (yy - cy)));
    if (cx + hw <= s[0] || cx - hw >= s[1]) continue;
    const left = cx < (s[0] + s[1]) / 2;
    const pen = left ? (cx + hw) - s[0] : s[1] - (cx - hw);
    if (pen > Math.abs(push)) push = left ? -pen : pen;
  }
  return push;
}

// Object layout (stage px). r = keep-out radius on screen; alt = fallback anchors if text covers the first one.
const OBJECTS = [
  { id: 'cardA', type: 'card', design: 'bars', w: 150, h: 86, at: [168, 588], alt: [[150, 640]], z: 24, yaw: 0.46, roll: 0.1, depth: 0.75 },
  { id: 'cardB', type: 'card', design: 'pie', w: 138, h: 78, at: [1468, 640], alt: [[1480, 700]], z: 12, yaw: -0.48, roll: -0.11, depth: 0.6 },
  { id: 'cardC', type: 'card', design: 'image', w: 104, h: 60, at: [1082, 300], alt: [[1090, 255]], z: -18, yaw: -0.36, roll: 0.07, depth: 0.35 },
  { id: 'heart', type: 'heart', at: [592, 238], alt: [[600, 170]], r: 30, z: 8, depth: 0.5 },
  { id: 'ring', type: 'ring', at: [1068, 166], alt: [[1110, 150]], r: 44, z: -8, depth: 0.42 },
  { id: 'bulb', type: 'bulb', at: [1486, 806], alt: [[1500, 760]], r: 44, z: 16, depth: 0.6 },
  { id: 'pencil', type: 'pencil', at: [126, 798], alt: [[110, 760]], r: 62, z: 26, depth: 0.85 },
];
const SPARKLES = [
  [612, 150, PAL.orange, 11], [946, 214, PAL.fur[3], 9], [1548, 172, PAL.pink, 10], [1562, 462, PAL.orange, 8],
  [48, 470, PAL.fur[3], 10], [226, 690, PAL.pink, 8], [1398, 560, PAL.fur[3], 9], [420, 44, PAL.lilac, 9],
  [1196, 52, PAL.orange, 8], [1560, 880, PAL.fur[3], 8],
];

function makeModel(reduced) {
  const objs = OBJECTS.map((o, i) => {
    const r = o.r || Math.hypot(o.w, o.h) / 2 + 4;
    return {
      ...o, r, i, ax: o.at[0], ay: o.at[1], tx: o.at[0], ty: o.at[1], visible: true,
      x: o.at[0], y: o.at[1], rx: 0, ry: 0, rz: 0, s: 0, p: 0, pTarget: 1, pFrom: 0, pStart: 0.15 + i * 0.09,
      phase: i * 1.7 + 0.4, hover: 0, avoid: 0, hop: -10,
    };
  });
  const sparkles = SPARKLES.map((s, i) => ({ ax: s[0], ay: s[1], x: s[0], y: s[1], color: s[2], size: s[3], visible: true,
    phase: i * 2.1, p: 0, pTarget: 1, pFrom: 0, pStart: 0.5 + i * 0.07, s: 0, rot: 0, r: s[3] }));
  return {
    objs, sparkles, reduced, t: 0,
    pointer: { x: 0, y: 0, sx: -1e4, sy: -1e4, nx: 0, ny: 0, inside: false },
    plane: { state: 'wait', wait: reduced ? 1e9 : 1.6, u: 0, y0: 62, loopAt: 0.42, loop: true, x: -200, y: 62, angle: 0,
      trail: [], trailClock: 0, p: 0 },
    exitAll: false,
  };
}

const presenceTween = (o, t, dur) => {
  const k = clamp((t - o.pStart) / dur);
  return o.pTarget > o.pFrom ? lerp(o.pFrom, o.pTarget, ease.outBack(k)) : lerp(o.pFrom, o.pTarget, ease.inOutCubic(k));
};

function setPresence(list, target, t, stagger = 0.06) {
  list.forEach((o, i) => {
    if (o.pTarget === target) return;
    o.pFrom = o.p; o.pTarget = target; o.pStart = t + i * stagger;
  });
}

// Advances the model by dt seconds. W/H = container size; sx/sy map design px to it.
function step(m, dt, W, H) {
  const t = (m.t += dt);
  const sx = W / BW, sy = H / BH, rm = m.reduced;
  const P = m.pointer;
  P.nx = damp(P.nx, P.inside && !rm ? clamp((P.sx / sx - BW / 2) / (BW / 2), -1, 1) : 0, 3, dt);
  P.ny = damp(P.ny, P.inside && !rm ? clamp((P.sy / sy - BH / 2) / (BH / 2), -1, 1) : 0, 3, dt);
  let busy = !rm;

  for (const o of m.objs) {
    o.p = presenceTween(o, t, o.pTarget > o.pFrom ? 0.85 : 0.45);
    if (Math.abs(o.p - o.pTarget) > 0.001 || t < o.pStart + 0.9) busy = true;
    o.ax = damp(o.ax, o.tx, 4, dt); o.ay = damp(o.ay, o.ty, 4, dt);
    const ph = o.phase, w = rm ? 0 : 1;
    const bob = w * 7 * Math.sin(t * 0.85 + ph), drift = w * 5 * Math.sin(t * 0.37 + ph * 1.3);
    const par = 4 + 14 * o.depth;
    const dx = (P.sx / sx) - o.x, dy = (P.sy / sy) - o.y, dist = Math.hypot(dx, dy);
    o.hover = damp(o.hover, P.inside && !rm ? clamp(1 - (dist - o.r * 0.4) / 170) : 0, 5, dt);
    const shy = o.hover * 7 / Math.max(1, dist);
    const hopT = t - o.hop, hop = hopT > 0 && hopT < 1.4 && !rm ? 16 * Math.exp(-3.4 * hopT) * Math.sin(hopT * 11) : 0;
    let x = o.ax + drift - P.nx * par - dx * shy + o.avoid;
    let y = o.ay + bob - P.ny * par * 0.6 - dy * shy - hop;
    // Hard keep-out: never let the circle touch the character, whatever parallax or drift adds up to.
    const push = silhouettePush(x, y, o.r * Math.max(0.01, o.p));
    if (push) { o.avoid += push; x += push; } else o.avoid = damp(o.avoid, 0, 0.6, dt);
    o.x = x; o.y = y;
    const sway = w;
    switch (o.type) {
      case 'card':
        o.ry = o.yaw + sway * 0.22 * Math.sin(t * 0.42 + ph) + o.hover * clamp(dx / 200, -1, 1) * 0.35;
        o.rx = sway * 0.12 * Math.sin(t * 0.33 + ph * 0.7) - o.hover * clamp(dy / 200, -1, 1) * 0.3;
        o.rz = o.roll + sway * 0.05 * Math.sin(t * 0.5 + ph);
        break;
      case 'heart': {
        const beat = rm ? 0 : Math.max(0, Math.sin(t * 5.2)) * (Math.sin(t * 1.3) > 0.55 ? 1 : 0);
        o.ry = sway * 0.45 * Math.sin(t * 0.6 + ph) + o.hover * 0.5;
        o.rx = sway * 0.1 * Math.sin(t * 0.5);
        o.rz = 0.18 + sway * 0.08 * Math.sin(t * 0.7 + ph);
        o.beat = beat * 0.09 + o.hover * 0.05;
        break;
      }
      case 'ring':
        o.rx = 1.05 + sway * 0.3 * Math.sin(t * 0.31 + ph);
        o.ry = sway * (t * 0.35 + o.hover * 1.2);
        o.rz = 0.4 + sway * 0.15 * Math.sin(t * 0.4);
        o.moon = rm ? 0.8 : t * 1.25;
        break;
      case 'bulb':
        o.rz = -0.22 + sway * 0.12 * Math.sin(t * 0.55 + ph) + o.hover * 0.12;
        o.ry = sway * 0.5 * Math.sin(t * 0.3 + ph);
        o.rx = 0;
        o.glow = clamp(damp(o.glow || 0, Math.max(o.hover > 0.35 ? 1 : 0, rm ? 0.5 : 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 0.55 + 1)), 6)), 4, dt));
        break;
      case 'pencil':
        o.rz = 0.62 + sway * 0.14 * Math.sin(t * 0.47 + ph) + o.hover * 0.15;
        o.rx = sway * (t * 0.5) + o.hover * 0.6;
        o.ry = 0.25 + sway * 0.18 * Math.sin(t * 0.36);
        break;
    }
    o.s = Math.max(0, o.p) * (1 + o.hover * 0.07 + (o.beat || 0));
  }

  for (const s of m.sparkles) {
    s.p = presenceTween(s, t, s.pTarget > s.pFrom ? 0.7 : 0.4);
    const tw = rm ? 1 : 0.62 + 0.38 * Math.sin(t * 1.7 + s.phase);
    s.s = Math.max(0, s.p) * tw;
    s.rot = rm ? 0 : Math.sin(t * 0.4 + s.phase) * 0.5;
    s.x = s.ax - P.nx * 6; s.y = s.ay - P.ny * 4;
  }

  // Paper plane: glides across the top band from the left, now and then with a loop-the-loop.
  const pl = m.plane;
  pl.p = damp(pl.p, m.exitAll ? 0 : 1, 6, dt);
  if (pl.state === 'wait') {
    pl.wait -= dt;
    if (pl.wait <= 0 && !m.exitAll && !rm) {
      pl.state = 'fly'; pl.u = 0; pl.y0 = 52 + Math.random() * 26; pl.loop = Math.random() < 0.7;
      pl.loopAt = 0.3 + Math.random() * 0.3; pl.trail.length = 0; pl.lx = null;
    }
  } else {
    const L = 0.085, inLoop = pl.loop && pl.u > pl.loopAt && pl.u < pl.loopAt + L;
    pl.u += dt / 15 * (inLoop ? 0.28 : 1);
    const bx = lerp(-110, BW + 110, pl.u);
    let y = pl.y0 + 12 * Math.sin(pl.u * Math.PI * 2.6), x = bx;
    if (inLoop) {
      const th = (pl.u - pl.loopAt) / L * Math.PI * 2, R = 22;
      x += R * Math.sin(th); y -= R * (1 - Math.cos(th));
    }
    if (pl.lx != null) {
      const ang = Math.atan2(-(y - pl.ly), x - pl.lx);
      if (Number.isFinite(ang) && (Math.abs(x - pl.lx) + Math.abs(y - pl.ly)) > 0.01) pl.angle = lerpAngle(pl.angle, ang, clamp(dt * 14));
    }
    pl.lx = x; pl.ly = y; pl.x = x; pl.y = y;
    pl.trailClock += dt;
    if (pl.trailClock > 0.07) { pl.trailClock = 0; pl.trail.push({ x, y, age: 0 }); if (pl.trail.length > 22) pl.trail.shift(); }
    if (pl.u >= 1) { pl.state = 'wait'; pl.wait = 4 + Math.random() * 5; }
  }
  for (const d of pl.trail) d.age += dt;
  if (pl.state === 'fly' || pl.trail.some(d => d.age < 1.6)) busy = true;
  return busy || m.sparkles.some(s => Math.abs(s.p - s.pTarget) > 0.001);
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------------------------------------------------------------- 3D renderer
function create3D(THREE, root, m, onEvict) {
  const gl = createRenderer(THREE, root, { maxPixels: 2.3e6, onEvict });
  const kit = createKit(THREE);
  const scene = new THREE.Scene();
  const D = 1800;
  const camera = new THREE.PerspectiveCamera(30, BW / BH, 10, 5000);
  camera.position.set(0, 0, D);
  addStudioLights(THREE, scene, { intensity: 1, key: [-0.5, 0.75, 0.75] });
  const meshes = new Map();
  let W = BW, H = BH;
  const fit = (w, h) => {
    W = w; H = h;
    camera.aspect = w / h;
    camera.fov = 2 * Math.atan((h / 2) / D) * 180 / Math.PI;
    camera.updateProjectionMatrix();
  };
  fit(gl.size.w || BW, gl.size.h || BH);
  gl.measure(true);

  const toon = c => kit.toon(c);
  for (const o of m.objs) {
    const g = new THREE.Group();
    g.userData.parts = {};
    if (o.type === 'card') buildCard(THREE, kit, g, o);
    else if (o.type === 'heart') {
      const geo = new THREE.ExtrudeGeometry(heartShape(THREE, 54), { depth: 6, bevelEnabled: true, bevelThickness: 8, bevelSize: 6.5, bevelSegments: 5, curveSegments: 22 });
      geo.center();
      g.add(new THREE.Mesh(geo, toon(PAL.pink)));
    } else if (o.type === 'ring') {
      g.add(new THREE.Mesh(new THREE.TorusGeometry(25, 9.5, 18, 48), toon(PAL.fur[3])));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(6.5, 20, 14), toon(PAL.orange));
      g.add(moon);
      g.userData.parts.moon = moon;
    } else if (o.type === 'bulb') buildBulb(THREE, kit, g);
    else if (o.type === 'pencil') buildPencil(THREE, kit, g);
    scene.add(g);
    meshes.set(o, g);
  }
  const starGeo = new THREE.ShapeGeometry(sparkleShape(THREE, 0.3));
  const sparkMeshes = m.sparkles.map(s => { const me = new THREE.Mesh(starGeo, kit.basic(s.color)); me.position.z = -30; scene.add(me); return me; });

  // Paper plane: two folded wings plus the keel, nose along +x.
  const plane = new THREE.Group();
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    34, 0, 0, -34, 6, -26, -32, 0, 0,
    34, 0, 0, -32, 0, 0, -34, 6, 26,
  ], 3));
  wingGeo.computeVertexNormals();
  const keelGeo = new THREE.BufferGeometry();
  keelGeo.setAttribute('position', new THREE.Float32BufferAttribute([34, 0, 0, -28, -10, 0, -32, 0, 0], 3));
  keelGeo.computeVertexNormals();
  plane.add(new THREE.Mesh(wingGeo, kit.toon(PAL.pill, { side: THREE.DoubleSide })));
  plane.add(new THREE.Mesh(keelGeo, kit.toon(PAL.lilac, { side: THREE.DoubleSide })));
  plane.rotation.order = 'ZYX';
  scene.add(plane);
  const trailGeo = new THREE.CircleGeometry(2.6, 10);
  const trail = new THREE.InstancedMesh(trailGeo, kit.basic(PAL.fur[3], { transparent: true, opacity: 0.75 }), 24);
  trail.count = 0;
  trail.frustumCulled = false;
  scene.add(trail);
  const tmp = new THREE.Object3D();

  // Design px -> world (keeps each object's on-screen centre and size exact whatever its depth).
  const place = (obj3, x, y, z, s) => {
    const k = (D - z) / D;
    obj3.position.set((x * W / BW - W / 2) * k, (H / 2 - y * H / BH) * k, z);
    obj3.scale.setScalar(Math.max(1e-4, s * k * (W / BW)));
  };

  return {
    resize: (w, h) => fit(w, h),
    gl,
    render(t) {
      if (gl.disposed) return;
      if (gl.size.w !== W || gl.size.h !== H) fit(gl.size.w, gl.size.h);
      for (const o of m.objs) {
        const g = meshes.get(o);
        g.visible = o.s > 0.002;
        if (!g.visible) continue;
        place(g, o.x, o.y, o.z, o.s);
        g.rotation.set(o.rx, o.ry, o.rz);
        const parts = g.userData.parts;
        if (parts.moon) { const a = o.moon; parts.moon.position.set(Math.cos(a) * 25, Math.sin(a) * 25, 0); parts.moon.position.z = Math.sin(a * 2) * 4; }
        if (parts.bars) parts.bars.forEach((b, i) => { b.scale.y = Math.max(0.05, b.userData.h * (m.reduced ? 1 : 0.78 + 0.22 * Math.sin(t * 1.4 + i * 1.3 + o.phase))); });
        if (parts.pie) parts.pie.rotation.y = m.reduced ? 0.5 : t * 0.5;
        if (parts.glow) { parts.glow.material.opacity = 0.15 + 0.75 * (o.glow || 0); parts.glow.scale.setScalar(70 + 22 * (o.glow || 0)); parts.fil.material.color.set((o.glow || 0) > 0.5 ? PAL.orange : PAL.rose); }
      }
      m.sparkles.forEach((s, i) => {
        const me = sparkMeshes[i];
        me.visible = s.s > 0.002;
        place(me, s.x, s.y, -30, s.size * s.s);
        me.rotation.z = s.rot;
      });
      const pl = m.plane;
      plane.visible = pl.state === 'fly' && pl.p > 0.01;
      if (plane.visible) {
        place(plane, pl.x, pl.y, 40, pl.p);
        plane.rotation.set(-1.05 + 0.12 * Math.sin(t * 1.3), 0, pl.angle);
      }
      let n = 0;
      for (const d of pl.trail) {
        const k = 1 - d.age / 1.6;
        if (k <= 0) continue;
        place(tmp, d.x, d.y, 38, k * pl.p);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        trail.setMatrixAt(n++, tmp.matrix);
      }
      trail.count = n;
      trail.instanceMatrix.needsUpdate = true;
      gl.renderer.render(scene, camera);
    },
    dispose() {
      disposeTree(scene);
      kit.dispose();
      gl.dispose();
    },
  };
}

function cardFace(kit, design, w, h) {
  const S = 3;
  return kit.canvasTexture(Math.round(w * S), Math.round(h * S), (g, cw, ch) => {
    g.scale(S, S);
    const ink = 'rgba(8,9,9,0.78)';
    g.fillStyle = PAL.lilac; rr(g, 9, 9, w - 18, 7, 3.5); g.fill();
    g.fillStyle = ink; rr(g, 9, 22, w * 0.42, 6, 3); g.fill();
    g.fillStyle = PAL.fur[2]; rr(g, 9, 32, w * 0.3, 4.5, 2.25); g.fill();
    if (design === 'image') {
      g.fillStyle = PAL.fur[0]; rr(g, 9, 40, w - 18, h - 49, 5); g.fill();
      g.save(); rr(g, 9, 40, w - 18, h - 49, 5); g.clip();
      g.fillStyle = PAL.orange; g.beginPath(); g.arc(w * 0.72, 49, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.fur[3]; g.beginPath(); g.moveTo(9, h - 9); g.lineTo(w * 0.36, 46); g.lineTo(w * 0.6, h - 9); g.fill();
      g.fillStyle = PAL.fur[4]; g.beginPath(); g.moveTo(w * 0.4, h - 9); g.lineTo(w * 0.66, 52); g.lineTo(w - 9, h - 9); g.fill();
      g.restore();
    } else if (design === 'bars') {
      g.fillStyle = PAL.fur[1]; for (let i = 0; i < 3; i++) { rr(g, 9, 44 + i * 9, w * 0.34, 4, 2); g.fill(); }
      g.fillStyle = 'rgba(8,9,9,0.25)'; g.fillRect(w * 0.5, h - 13, w * 0.42, 1.6);
    } else if (design === 'pie') {
      g.fillStyle = PAL.fur[1]; for (let i = 0; i < 3; i++) { rr(g, w * 0.56, 42 + i * 9, w * 0.3, 4, 2); g.fill(); }
      [PAL.pink, PAL.lilac, PAL.orange].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(w * 0.53, 44 + i * 9, 2.3, 0, Math.PI * 2); g.fill(); });
    }
  });
}

function buildCard(THREE, kit, g, o) {
  const body = new THREE.Mesh(roundedSlab(THREE, o.w, o.h, 7, 11, 2.2), kit.toon(PAL.pill));
  g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h),
    kit.fresh('MeshToonMaterial', { map: cardFace(kit, o.design, o.w, o.h), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.z = 3.62;
  g.add(face);
  if (o.design === 'bars') {
    const geo = new THREE.BoxGeometry(11, 1, 7);
    geo.translate(0, 0.5, 0);
    const cols = [PAL.fur[2], PAL.pink, PAL.fur[4]], hs = [20, 32, 44];
    g.userData.parts.bars = hs.map((hh, i) => {
      const b = new THREE.Mesh(geo, kit.toon(cols[i]));
      b.userData.h = hh;
      b.position.set(o.w * 0.08 + i * 15, -o.h / 2 + 13, 7.2);
      g.add(b);
      return b;
    });
  } else if (o.design === 'pie') {
    const pie = new THREE.Group();
    const cols = [PAL.pink, PAL.lilac, PAL.orange], sl = [0, 2.6, 4.6, Math.PI * 2], hs = [9, 6, 12];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, hs[i], 28, 1, false, sl[i], sl[i + 1] - sl[i]), kit.toon(cols[i]));
      c.position.y = hs[i] / 2;
      pie.add(c);
    }
    pie.rotation.x = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(pie);
    holder.position.set(-o.w * 0.24, -o.h * 0.16, 3.6);
    holder.rotation.x = Math.PI / 2;
    pie.rotation.x = 0;
    g.add(holder);
    g.userData.parts.pie = pie;
  }
}

function buildBulb(THREE, kit, g) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 - (i / 16) * (Math.PI * 0.78); pts.push(new THREE.Vector2(Math.max(0.01, Math.cos(a) * 24), 14 + Math.sin(a) * 24)); }
  pts.push(new THREE.Vector2(13, -10), new THREE.Vector2(11.5, -15));
  pts[0].x = 0.01;
  const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), kit.toon('#fbf8ff', { transparent: true, opacity: 0.62, depthWrite: false }));
  const base = [];
  for (let i = 0; i <= 5; i++) { const y = -15 - i * 3.6; base.push(new THREE.Vector2(i % 2 ? 10.6 : 12, y)); }
  base.push(new THREE.Vector2(8, -35), new THREE.Vector2(3.5, -38.5), new THREE.Vector2(0.01, -39));
  base.unshift(new THREE.Vector2(0.01, -15));
  const screw = new THREE.Mesh(new THREE.LatheGeometry(base, 28), kit.toon(PAL.fur[3]));
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-6, -9, 0), new THREE.Vector3(-6, 6, 0), new THREE.Vector3(-3, 14, 0),
    new THREE.Vector3(0, 10, 0), new THREE.Vector3(3, 14, 0), new THREE.Vector3(6, 6, 0), new THREE.Vector3(6, -9, 0)]);
  const fil = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 1.3, 6, false), kit.fresh('MeshBasicMaterial', { color: PAL.orange }));
  const glowTex = kit.canvasTexture(64, 64, (c) => {
    const r = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(242,166,90,0.75)'); r.addColorStop(0.45, 'rgba(242,166,90,0.25)'); r.addColorStop(1, 'rgba(242,166,90,0)');
    c.fillStyle = r; c.fillRect(0, 0, 64, 64);
  });
  const glow = new THREE.Sprite(kit.fresh('SpriteMaterial', { map: glowTex, transparent: true, depthWrite: false, opacity: 0.4 }));
  glow.position.y = 12;
  g.add(glow, fil, screw, glass);
  g.userData.parts.glow = glow;
  g.userData.parts.fil = fil;
}

function buildPencil(THREE, kit, g) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 84, 6), kit.toon(PAL.orange));
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8, 20, 6), kit.toon('#f6e7da'));
  wood.position.y = 52;
  const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.7, 6.2, 12), kit.toon(PAL.ink));
  lead.position.y = 59;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 9, 20), kit.toon(PAL.lilac));
  band.position.y = -46;
  const eraser = new THREE.Mesh(new THREE.CapsuleGeometry(8, 6, 6, 18), kit.toon(PAL.pink));
  eraser.position.y = -54;
  const inner = new THREE.Group();
  inner.add(body, wood, lead, band, eraser);
  inner.rotation.z = -Math.PI / 2;
  g.add(inner);
}

// ---------------------------------------------------------------- 2D fallback renderer
function create2D(root, m) {
  const cv = createCanvas2D(root);
  const g = cv.g;
  const card = (o) => {
    const w = o.w, h = o.h, cy = Math.cos(o.ry), cx = Math.cos(o.rx);
    g.save();
    g.rotate(-o.rz);
    g.scale(Math.max(0.2, Math.abs(cy)), Math.max(0.3, Math.abs(cx)));
    g.fillStyle = PAL.fur[1]; rr(g, -w / 2 + 2, -h / 2 + 4, w, h, 11); g.fill();
    g.fillStyle = PAL.pill; rr(g, -w / 2, -h / 2, w, h, 11); g.fill();
    g.translate(-w / 2, -h / 2);
    g.fillStyle = PAL.lilac; rr(g, 9, 9, w - 18, 7, 3.5); g.fill();
    g.fillStyle = 'rgba(8,9,9,0.78)'; rr(g, 9, 22, w * 0.42, 6, 3); g.fill();
    if (o.design === 'bars') {
      [[PAL.fur[2], 20], [PAL.pink, 32], [PAL.fur[4], 44]].forEach(([c, hh], i) => {
        const k = m.reduced ? 1 : 0.78 + 0.22 * Math.sin(m.t * 1.4 + i * 1.3 + o.phase);
        g.fillStyle = c; rr(g, w * 0.55 + i * 15, h - 13 - hh * k, 11, hh * k, 2); g.fill();
      });
    } else if (o.design === 'pie') {
      const a0 = m.reduced ? 0.5 : m.t * 0.5;
      [[PAL.pink, 0, 2.6], [PAL.lilac, 2.6, 4.6], [PAL.orange, 4.6, Math.PI * 2]].forEach(([c, a, b]) => {
        g.fillStyle = c; g.beginPath(); g.moveTo(w * 0.26, h * 0.66); g.arc(w * 0.26, h * 0.66, 15, a + a0, b + a0); g.fill();
      });
    } else {
      g.fillStyle = PAL.fur[0]; rr(g, 9, 40, w - 18, h - 49, 5); g.fill();
      g.fillStyle = PAL.fur[3]; g.beginPath(); g.moveTo(12, h - 9); g.lineTo(w * 0.36, 46); g.lineTo(w * 0.6, h - 9); g.fill();
      g.fillStyle = PAL.orange; g.beginPath(); g.arc(w * 0.72, 49, 5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  };
  const heart = (o) => {
    g.save(); g.rotate(-o.rz); g.scale(Math.max(0.35, Math.abs(Math.cos(o.ry))), 1); g.scale(54, -54);
    const p = new Path2D('M0,-0.42 C-0.12,-0.3 -0.5,-0.08 -0.5,0.16 C-0.5,0.36 -0.36,0.48 -0.24,0.48 C-0.11,0.48 -0.03,0.4 0,0.32 C0.03,0.4 0.11,0.48 0.24,0.48 C0.36,0.48 0.5,0.36 0.5,0.16 C0.5,-0.08 0.12,-0.3 0,-0.42Z');
    g.fillStyle = PAL.rose; g.save(); g.translate(0.03, -0.04); g.fill(p); g.restore();
    g.fillStyle = PAL.pink; g.fill(p);
    g.restore();
  };
  const ring = (o) => {
    g.save(); g.rotate(-o.rz); g.scale(1, Math.max(0.3, Math.abs(Math.cos(o.rx))));
    g.lineWidth = 19; g.strokeStyle = PAL.fur[4]; g.beginPath(); g.arc(1, 2, 25, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = PAL.fur[3]; g.beginPath(); g.arc(0, 0, 25, 0, Math.PI * 2); g.stroke();
    g.restore();
    const a = o.moon || 0;
    g.fillStyle = PAL.orange; g.beginPath(); g.arc(Math.cos(a) * 25, -Math.sin(a) * 25 * 0.45, 6.5, 0, Math.PI * 2); g.fill();
  };
  const bulb = (o) => {
    g.save(); g.rotate(-o.rz);
    const glow = o.glow || 0;
    const r = g.createRadialGradient(0, -12, 0, 0, -12, 46);
    r.addColorStop(0, `rgba(242,166,90,${0.15 + 0.5 * glow})`); r.addColorStop(1, 'rgba(242,166,90,0)');
    g.fillStyle = r; g.beginPath(); g.arc(0, -12, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(251,248,255,0.92)'; g.beginPath(); g.arc(0, -14, 24, 0, Math.PI * 2); g.fill();
    g.strokeStyle = glow > 0.5 ? PAL.orange : PAL.rose; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-6, 9); g.lineTo(-6, -6); g.lineTo(-3, -14); g.lineTo(0, -10); g.lineTo(3, -14); g.lineTo(6, -6); g.lineTo(6, 9); g.stroke();
    g.fillStyle = PAL.fur[3]; for (let i = 0; i < 5; i++) { rr(g, -12 + (i % 2), 14 + i * 4, 24 - (i % 2) * 2, 4, 2); g.fill(); }
    g.fillStyle = PAL.fur[4]; g.beginPath(); g.arc(0, 36, 5, 0, Math.PI); g.fill();
    g.restore();
  };
  const pencil = (o) => {
    g.save(); g.rotate(-o.rz);
    g.fillStyle = PAL.orange; g.fillRect(-42, -8, 84, 16);
    g.fillStyle = 'rgba(8,9,9,0.08)'; g.fillRect(-42, 2, 84, 6);
    g.fillStyle = '#f6e7da'; g.beginPath(); g.moveTo(42, -8); g.lineTo(62, 0); g.lineTo(42, 8); g.fill();
    g.fillStyle = PAL.ink; g.beginPath(); g.moveTo(56, -2.6); g.lineTo(62, 0); g.lineTo(56, 2.6); g.fill();
    g.fillStyle = PAL.lilac; g.fillRect(-51, -8.6, 9, 17.2);
    g.fillStyle = PAL.pink; rr(g, -64, -8, 15, 16, 7); g.fill();
    g.restore();
  };
  const star = (s) => {
    g.save(); g.translate(s.x, s.y); g.rotate(s.rot); g.scale(s.size * s.s, s.size * s.s);
    g.fillStyle = s.color; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 0.3 : 1; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.restore();
  };
  return {
    gl: null,
    render() {
      cv.begin();
      const W = cv.size.w, H = cv.size.h;
      g.save();
      g.scale(W / BW, H / BH);
      for (const s of m.sparkles) if (s.s > 0.002) star(s);
      const pl = m.plane;
      for (const d of pl.trail) {
        const k = 1 - d.age / 1.6;
        if (k <= 0) continue;
        g.fillStyle = PAL.fur[3]; g.globalAlpha = 0.75 * pl.p; g.beginPath(); g.arc(d.x, d.y, 2.6 * k, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      if (pl.state === 'fly' && pl.p > 0.01) {
        g.save(); g.translate(pl.x, pl.y); g.rotate(-pl.angle); g.scale(pl.p, pl.p);
        g.fillStyle = PAL.lilac; g.beginPath(); g.moveTo(34, 0); g.lineTo(-30, 0); g.lineTo(-26, 11); g.closePath(); g.fill();
        g.fillStyle = PAL.pill; g.beginPath(); g.moveTo(34, 0); g.lineTo(-34, -20); g.lineTo(-30, 0); g.closePath(); g.fill();
        g.fillStyle = PAL.fur[0]; g.beginPath(); g.moveTo(34, 0); g.lineTo(-30, 0); g.lineTo(-34, 7); g.closePath(); g.fill();
        g.restore();
      }
      const order = m.objs.slice().sort((a, b) => a.z - b.z);
      for (const o of order) {
        if (o.s <= 0.002) continue;
        g.save(); g.translate(o.x, o.y); g.scale(o.s, o.s);
        if (o.type === 'card') card(o); else if (o.type === 'heart') heart(o); else if (o.type === 'ring') ring(o);
        else if (o.type === 'bulb') bulb(o); else if (o.type === 'pencil') pencil(o);
        g.restore();
      }
      g.restore();
    },
    dispose() { cv.dispose(); },
  };
}

// ---------------------------------------------------------------- keep-outs from the page's own text
function scanText(el, root, m) {
  const stage = el.closest('#stage') || el.parentElement;
  if (!stage) return;
  const base = el.getBoundingClientRect();
  const W = el.clientWidth || BW, k = base.width > 0 ? base.width / W : 1, sx = BW / W, sy = BH / (el.clientHeight || BH);
  const char = stage.querySelector('#char');
  const rects = [];
  stage.querySelectorAll('h1,h2,h3,h4,p,button,a,label,li,small,input,textarea,select,[class*="badge"],[class*="pill"],[data-keepout]').forEach(n => {
    if (root.contains(n) || el.contains(n) || (char && char.contains(n))) return;
    if (n.checkVisibility && !n.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
    const r = n.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    rects.push({ x: (r.left - base.left) / k * sx - 14, y: (r.top - base.top) / k * sy - 14, w: r.width / k * sx + 28, h: r.height / k * sy + 28 });
  });
  const hit = (x, y, r) => rects.some(q => {
    const nx = clamp(x, q.x, q.x + q.w), ny = clamp(y, q.y, q.y + q.h);
    return (x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r;
  });
  for (const o of m.objs) {
    const spots = [o.at, ...(o.alt || [])];
    const free = spots.find(([x, y]) => !hit(x, y, o.r + 6) && !silhouettePush(x, y, o.r));
    if (free) { o.tx = free[0]; o.ty = free[1]; }
    const vis = !!free;
    if (vis !== o.visible) { o.visible = vis; setPresence([o], vis && !m.exitAll ? 1 : 0, m.t, 0); }
  }
  for (const s of m.sparkles) {
    const vis = !hit(s.ax, s.ay, s.size + 4);
    if (vis !== s.visible) { s.visible = vis; setPresence([s], vis && !m.exitAll ? 1 : 0, m.t, 0); }
  }
}

export default {
  mount(el, ctx = {}) {
    const reduced = !!ctx.reducedMotion;
    const { root, remove } = makeRoot(el, 'welcome');
    const m = makeModel(reduced);
    let view = null, loop = null, dead = false;
    const offs = [];

    const frame = (dt, t) => {
      if (!view) return false;
      const W = el.clientWidth || BW, H = el.clientHeight || BH;
      const busy = step(m, dt, W, H);
      view.render(m.t);
      return busy || !reduced;
    };
    const use2D = () => {
      if (dead) return;
      if (view && view.gl) { try { view.dispose(); } catch (e) {} }
      view = create2D(root, m);
      loop.wake();
    };

    loop = createLoop(frame, { onFrameTime: ms => view && view.gl && view.gl.governor(ms) });
    loadThree(ctx).then(THREE => {
      if (dead) return;
      if (THREE) {
        try { view = create3D(THREE, root, m, use2D); } catch (e) { console.info('[scene] welcome: 3D unavailable, drawing in 2D'); view = null; }
      }
      if (!view) view = create2D(root, m);
      loop.start();
      scan();
    });

    // Keep-outs: re-measure the welcome copy as it settles and whenever the window changes.
    const scan = () => { if (!dead) { scanText(el, root, m); loop.wake(); } };
    const scanTimers = [setTimeout(scan, 80), setTimeout(scan, 600), setTimeout(scan, 1600), setTimeout(scan, 3200)];
    offs.push(listen(window, 'resize', scan));

    offs.push(listen(window, 'pointermove', e => {
      const r = el.getBoundingClientRect(), k = r.width / (el.clientWidth || BW) || 1;
      m.pointer.sx = (e.clientX - r.left) / k; m.pointer.sy = (e.clientY - r.top) / k;
      m.pointer.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      loop.wake();
    }, { passive: true }));
    offs.push(listen(document, 'pointerleave', () => { m.pointer.inside = false; loop.wake(); }));
    offs.push(listen(window, 'blur', () => { m.pointer.inside = false; }));

    const bus = ctx.bus;
    offs.push(onBus(bus, 'char:mode', d => {
      m.exitAll = d.mode === 'stage';
      setPresence(m.objs.filter(o => o.visible), m.exitAll ? 0 : 1, m.t, 0.05);
      setPresence(m.sparkles.filter(s => s.visible), m.exitAll ? 0 : 1, m.t, 0.03);
      loop.wake();
    }));
    offs.push(onBus(bus, 'ui:press', () => { m.objs.forEach((o, i) => { o.hop = m.t + i * 0.045; }); loop.wake(); }));

    return {
      update() { loop.wake(); },
      destroy() {
        if (dead) return;
        dead = true;
        scanTimers.forEach(clearTimeout);
        offs.forEach(f => f());
        loop.dispose();
        if (view) { try { view.dispose(); } catch (e) {} view = null; }
        remove();
      },
      // Debug hook for the dev harness: current on-screen circles of every object (stage px).
      get debug() { return { objs: m.objs.map(o => ({ id: o.id, x: o.x, y: o.y, r: o.r * o.s, visible: o.visible })), mode: view && view.gl ? '3d' : '2d' }; },
    };
  },
};
