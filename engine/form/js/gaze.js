// Eyes that follow the pointer (studio-footer gaze spec). On desktop the character video never plays: it is scrubbed
// to the frame whose gaze angle is closest to the angle from the character's eyes to the pointer. The frame table
// (gaze-frames.json) holds rows of [angle in radians, time in seconds]. Below 700 px wide the video simply loops,
// muted, and stays still for reduced motion.
//   const gaze = initGaze(videoEl);  gaze.lookAt(x, y);  gaze.release();  gaze.setPaused(true);  gaze.destroy();
import { on } from './bus.js';

const SRC_W = 1920, SRC_H = 1080;   // source video size
const EYE_X = 948, EYE_Y = 418;     // midpoint between the eyes, in source pixels
const DEAD_ZONE = 8;                // px: a pointer this close to the eyes leaves the gaze alone
const NUDGE = 1 / 240;              // aim inside a frame, never on its boundary
const MIN_STEP = 1 / 48;            // ignore changes smaller than half a frame
const END_GUARD = 1 / 24;           // keep one frame clear of the end
const MOVE_SLOP = 4;                // px the pointer must travel to take back control from lookAt()
const TAU = Math.PI * 2;

export function initGaze(video, { framesUrl = '/assets/gaze-frames.json' } = {}) {
  const small = matchMedia('(max-width: 699.98px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const loader = new AbortController();
  const live = { passive: true, capture: true };
  let frames = null;          // [[angle, time], ...] once loaded
  let pointer = null;         // last real pointer position, client px
  let virtual = null;         // lookAt() target: {x, y, from}
  let wanted = 0;             // newest target time; the video rests on frame 0
  let paused = false, mobile = false, dead = false;
  let raf = 0, follow = 0, followUntil = 0, followEnd = 0, lastBox = '';

  // Screen position of the eye midpoint, from the video's live box (object-fit: cover, centred).
  function eye() {
    const r = video.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const s = Math.max(r.width / SRC_W, r.height / SRC_H);
    return { x: r.left + (r.width - SRC_W * s) / 2 + EYE_X * s,
             y: r.top + (r.height - SRC_H * s) / 2 + EYE_Y * s };
  }

  function nearest(angle) {
    let best = frames[0][1], bestD = Infinity;
    for (const [a, t] of frames) {
      let d = Math.abs(angle - a) % TAU;
      if (d > Math.PI) d = TAU - d;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  // One seek at a time; 'seeked' calls back in with whatever target is newest by then.
  function seek() {
    if (dead || paused || mobile || video.readyState < 2 || video.seeking) return;
    const end = Number.isFinite(video.duration) ? video.duration - END_GUARD : Infinity;
    const t = Math.max(0, Math.min(wanted, end));
    if (Math.abs(t - video.currentTime) > MIN_STEP) video.currentTime = t;
  }

  function update() {
    const p = virtual || pointer;
    if (dead || paused || mobile || !frames || !p) return;
    const e = eye();
    if (!e) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    if (Math.hypot(dx, dy) < DEAD_ZONE) return;
    let a = Math.atan2(dy, dx);
    if (a < 0) a += TAU;
    wanted = nearest(a) + NUDGE;
    seek();
  }

  // Pointer bursts collapse into one update per frame, using only the latest position.
  function schedule() {
    if (!raf && !dead) raf = requestAnimationFrame(() => { raf = 0; update(); });
  }

  function onPointer(e) {
    pointer = { x: e.clientX, y: e.clientY };
    if (virtual) {
      // lookAt() holds until the pointer really travels (browsers also send moves on the same spot)
      const f = virtual.from;
      if (f && Math.hypot(pointer.x - f.x, pointer.y - f.y) < MOVE_SLOP) return;
      virtual = null;
    }
    schedule();
  }

  // While the character box animates between full and stage mode the eyes move under a still pointer:
  // re-aim every frame until the box has settled.
  function onMode() {
    const now = performance.now();
    followUntil = now + 900;
    followEnd = now + 3000;
    if (!follow && !dead) follow = requestAnimationFrame(followStep);
  }
  function followStep(now) {
    follow = 0;
    const r = video.getBoundingClientRect();
    const box = `${r.left},${r.top},${r.width},${r.height}`;
    const moving = box !== lastBox;
    lastBox = box;
    if (moving) update();
    if (now < followUntil || (moving && now < followEnd)) follow = requestAnimationFrame(followStep);
  }

  function syncMode() {
    if (dead) return;
    mobile = small.matches;
    if (mobile) {
      video.muted = true;
      video.loop = true;
      if (paused || still.matches) video.pause();
      else { const p = video.play(); if (p) p.catch(() => {}); }
      return;
    }
    video.loop = false;
    if (!video.paused) video.pause();
    if (virtual || pointer) schedule();
    else { wanted = 0; seek(); }
  }

  const onPlay = () => { if (!mobile) video.pause(); };   // desktop never plays

  video.autoplay = false;
  video.addEventListener('seeked', seek);
  video.addEventListener('loadeddata', seek);
  video.addEventListener('canplay', seek);
  video.addEventListener('play', onPlay);
  addEventListener('pointermove', onPointer, live);
  addEventListener('pointerdown', onPointer, live);
  addEventListener('dragover', onPointer, live);       // the eyes watch files being dragged in too
  addEventListener('resize', schedule, { passive: true });
  addEventListener('scroll', schedule, live);
  small.addEventListener('change', syncMode);
  still.addEventListener('change', syncMode);
  const offMode = on('char:mode', onMode);
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
  if (resized) resized.observe(video);
  syncMode();

  fetch(framesUrl, { signal: loader.signal })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(rows => {
      const ok = (Array.isArray(rows) ? rows : []).filter(r => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]));
      frames = ok.length ? ok.map(([a, t]) => [((a % TAU) + TAU) % TAU, t]) : null;
      if (frames) schedule();
    })
    .catch(err => { if (err.name !== 'AbortError') console.warn('[gaze] frame table unavailable:', err.message); });

  return {
    lookAt(x, y) {
      if (dead || !Number.isFinite(x) || !Number.isFinite(y)) return;
      virtual = { x, y, from: pointer && { x: pointer.x, y: pointer.y } };
      schedule();
    },
    release() {
      if (dead || !virtual) return;
      virtual = null;
      if (pointer) schedule();
      else { wanted = 0; seek(); }
    },
    setPaused(v) {
      if (dead) return;
      paused = !!v;
      if (mobile) syncMode();
      else if (!paused) { if (virtual || pointer) schedule(); else seek(); }
    },
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(follow);
      loader.abort();
      video.removeEventListener('seeked', seek);
      video.removeEventListener('loadeddata', seek);
      video.removeEventListener('canplay', seek);
      video.removeEventListener('play', onPlay);
      removeEventListener('pointermove', onPointer, live);
      removeEventListener('pointerdown', onPointer, live);
      removeEventListener('dragover', onPointer, live);
      removeEventListener('resize', schedule, { passive: true });
      removeEventListener('scroll', schedule, live);
      small.removeEventListener('change', syncMode);
      still.removeEventListener('change', syncMode);
      offMode();
      if (resized) resized.disconnect();
      if (mobile) video.pause();
    },
  };
}
