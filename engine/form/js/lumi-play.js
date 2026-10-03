// "Something to do while Claude works": a small offline game next to the real current step of the run, shown on the build
// page under the slide preview. Help Lumi catch the falling sparks: move the mouse (or a finger) over the arena.
//   - pure canvas + SVG, no assets, no network; one requestAnimationFrame loop that only runs while the arena is on screen,
//     the page is visible AND the pointer is over it, so it costs nothing otherwise
//   - it never takes keyboard focus: there is nothing focusable in the arena and no key is read
//   - it stops for good when the run ends (setRunning(false)) and can be hidden ("hide"; remembered, "play" brings it back)
// mountPlay(host) -> { setRunning(bool), setStep({ head, sub }), destroy() }
import { lumiArt } from './lumi-art.js';

const W = 1120, H = 276;                 // canvas pixels (the arena is drawn at 560 x 138 stage px, so 2x for sharp edges)
const KEY = 'lumi.play.hidden';
const store = {
  get() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
  set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* private window */ } },
};
import { h } from './dom.js';

export function mountPlay(host) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alive = true, running = false, hidden = store.get(), best = 0, score = 0, streak = 0, raf = 0, last = 0, inside = false, onScreen = true, spawnIn = 0.4, t = 0;
  let lumiX = W / 2, targetX = W / 2, mood = 'happy', moodT = 0, bonk = 0;
  const sparks = [], pops = [];

  const canvas = h('canvas', { class: 'pl-cv', width: W, height: H, 'aria-hidden': 'true' });
  const g = canvas.getContext('2d');
  const lumi = h('span', { class: 'pl-lumi', html: lumiArt({ size: 52 }) });
  const scoreEl = h('span', { class: 'pl-score' }, '0');
  const bestEl = h('span', { class: 'pl-best' });
  const hint = h('span', { class: 'pl-hint' }, 'move the mouse here and help lumi catch the sparks');
  const hideB = h('button', { type: 'button', class: 'pl-hide', 'data-nosfx': '', 'aria-label': 'hide the game', title: 'hide the game' }, 'hide');
  const arena = h('div', { class: 'pl-arena', role: 'img', 'aria-label': 'a small game while claude works: move the mouse to help lumi catch falling sparks' },
    canvas, lumi, h('span', { class: 'pl-hud' }, h('span', { class: 'pl-hud-l' }, 'sparks'), scoreEl, bestEl), hint, hideB);
  const stepHead = h('p', { class: 'pl-step-h' }, 'claude is getting started');
  const stepSub = h('p', { class: 'pl-step-s' }, 'waking up');
  const showB = h('button', { type: 'button', class: 'pl-show', 'data-nosfx': '', 'data-cursor-label': 'play' }, 'play while you wait');
  const step = h('div', { class: 'pl-step', 'aria-live': 'polite' }, h('span', { class: 'pl-step-i', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('div', { class: 'pl-step-t' }, stepHead, stepSub), showB);
  const root = h('div', { class: 'pl-play', hidden: true }, arena, step);
  host.append(root);

  const pointerX = e => { const r = arena.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1))) * W; };
  arena.addEventListener('pointerenter', e => { inside = true; targetX = pointerX(e); sync(); });
  arena.addEventListener('pointermove', e => { targetX = pointerX(e); });
  arena.addEventListener('pointerleave', () => { inside = false; sync(); });
  arena.addEventListener('pointercancel', () => { inside = false; sync(); });
  arena.addEventListener('mousedown', e => { if (e.target === arena || e.target === canvas) e.preventDefault(); });   // a click here must not pull focus out of a text box
  hideB.addEventListener('click', () => { hidden = true; store.set(true); paintMode(); sync(); });
  showB.addEventListener('click', () => { hidden = false; store.set(false); paintMode(); sync(); });
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  addEventListener('blur', onVis); addEventListener('focus', onVis);
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { onScreen = es.some(e => e.isIntersecting); sync(); }, { threshold: 0.3 }) : null;
  if (io) io.observe(arena);

  function paintMode() {
    root.classList.toggle('is-nogame', hidden);
    arena.hidden = hidden;
    showB.hidden = !hidden;
    bestEl.textContent = best ? `best ${best}` : '';
  }
  const playing = () => alive && running && !hidden && inside && onScreen && !document.hidden && document.hasFocus();
  function sync() {
    const on = playing();
    root.classList.toggle('is-playing', on);
    if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!on) lumi.firstChild && lumi.firstChild.classList.remove('is-running');
  }

  function spawn() {
    const r = Math.random(), kind = r < 0.07 ? 'heart' : r < 0.22 ? 'cloud' : 'spark';
    sparks.push({ kind, x: 40 + Math.random() * (W - 80), y: -20, vy: (120 + Math.random() * 90 + Math.min(score, 60) * 2.2) * 2, spin: Math.random() * 6, size: kind === 'heart' ? 17 : kind === 'cloud' ? 19 : 13 });
  }
  function setMood(m, ms) {
    if (m === mood) { moodT = ms; return; }
    mood = m; moodT = ms; lumi.innerHTML = lumiArt({ size: 52, mood: m });
  }
  function star(x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.38 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
  }
  function draw() {
    g.clearRect(0, 0, W, H);
    for (const s of sparks) {
      if (s.kind === 'spark') { g.fillStyle = '#f2a65a'; star(s.x, s.y, s.size, s.spin); g.fill(); g.fillStyle = '#ffe3b8'; star(s.x, s.y, s.size * 0.5, s.spin); g.fill(); }
      else if (s.kind === 'heart') {
        g.fillStyle = '#d993b4'; g.beginPath(); const r = s.size; g.moveTo(s.x, s.y + r * 0.9);
        g.bezierCurveTo(s.x - r * 1.5, s.y - r * 0.2, s.x - r * 0.6, s.y - r * 1.2, s.x, s.y - r * 0.4);
        g.bezierCurveTo(s.x + r * 0.6, s.y - r * 1.2, s.x + r * 1.5, s.y - r * 0.2, s.x, s.y + r * 0.9); g.fill();
      } else {
        g.fillStyle = '#9d97b5'; g.beginPath(); g.arc(s.x - 9, s.y + 2, 10, 0, 7); g.arc(s.x + 3, s.y - 5, 12, 0, 7); g.arc(s.x + 13, s.y + 3, 9, 0, 7); g.fill();
        g.fillStyle = '#7b7596'; g.beginPath(); g.arc(s.x - 3, s.y + 2, 1.9, 0, 7); g.arc(s.x + 7, s.y + 2, 1.9, 0, 7); g.fill();
      }
    }
    for (const p of pops) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.color; g.font = '700 26px Epilogue, system-ui, sans-serif'; g.fillText(p.text, p.x - 10, p.y); }
    g.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0;
    if (!playing()) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    spawnIn -= dt;
    if (spawnIn <= 0) { spawn(); spawnIn = Math.max(0.32, 0.95 - score * 0.012) * (0.7 + Math.random() * 0.6); }
    const dx = targetX - lumiX; lumiX += dx * Math.min(1, dt * 11);
    const moving = Math.abs(dx) > 6;
    lumi.firstChild && lumi.firstChild.classList.toggle('is-running', moving);
    const hop = bonk > 0 ? Math.sin(bonk * 14) * 4 : 0;
    lumi.style.transform = `translate(${(lumiX / W) * 560 - 26}px, ${-Math.max(0, hop)}px)`;
    bonk = Math.max(0, bonk - dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.y += s.vy * dt; s.spin += dt * 3;
      const near = Math.abs(s.x - lumiX) < 64 && s.y > H - 120 && s.y < H - 24;
      if (near) {
        if (s.kind === 'cloud') { streak = 0; score = Math.max(0, score - 2); pops.push({ text: '-2', x: s.x, y: s.y, life: 1, color: '#7b7596' }); setMood('hmm', 0.9); }
        else { const add = (s.kind === 'heart' ? 5 : 1) * (1 + Math.min(4, Math.floor(streak / 5))); streak++; score += add; bonk = 0.35; pops.push({ text: `+${add}`, x: s.x, y: s.y, life: 1, color: s.kind === 'heart' ? '#c2679a' : '#d98529' }); setMood('happy', 0.6); }
        sparks.splice(i, 1); scoreEl.textContent = String(score);
        if (score > best) { best = score; bestEl.textContent = `best ${best}`; }
      } else if (s.y > H + 24) { if (s.kind !== 'cloud') streak = 0; sparks.splice(i, 1); }
    }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.y -= 46 * dt; p.life -= dt * 1.4; if (p.life <= 0) pops.splice(i, 1); }
    if (moodT > 0 && (moodT -= dt) <= 0) setMood('happy', 0);
    draw();
    raf = requestAnimationFrame(frame);
  }
  paintMode();

  return {
    setRunning(v) {
      running = !!v;
      root.hidden = !running;
      if (!running) { sparks.length = 0; pops.length = 0; streak = 0; score = 0; scoreEl.textContent = '0'; g.clearRect(0, 0, W, H); }
      sync();
    },
    setStep({ head, sub } = {}) { if (head != null) stepHead.textContent = head; if (sub != null) stepSub.textContent = sub; },
    destroy() {
      alive = false; sync();
      document.removeEventListener('visibilitychange', onVis); removeEventListener('blur', onVis); removeEventListener('focus', onVis);
      if (io) io.disconnect();
      root.remove();
    },
  };
}
