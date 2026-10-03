// "The look" screen: six looks in the right column, and the hovered / selected look's demo video large in the
// illustration zone. "Claude chooses" plays a playful shuffle through the five looks.
// Bold Blue is listed first, carries a "recommended" badge and is pre-selected until the user picks a look themselves
// (the explicit pick is remembered in localStorage, so a deliberate "Claude chooses" is never overwritten).
// mountLooks(el, illusEl, { getState, setKey, bus, audio }) -> { destroy() }
import { emit } from './bus.js';

export const LOOKS = [
  { name: 'Bold Blue', slug: '2-bold-blue', desc: 'studio 3D and clear charts: warm canvas, one blue phrase, photoreal models', recommended: true },
  { name: 'Pink Punch', slug: '1-pink-punch', desc: 'loud and playful: bold outlines, hard shadows, hot pink' },
  { name: 'Flat-Pack', slug: '3-flat-pack', desc: 'friendly and clear: instruction-manual drawings in blue and yellow' },
  { name: 'Happy Headspace', slug: '4-happy-headspace', desc: 'warm and calm: soft round shapes, orange first' },
  { name: 'Yellow Frame', slug: '5-yellow-frame', desc: 'formal and documentary: serif titles and the yellow frame' },
  { name: 'Claude chooses', slug: null, desc: 'Claude picks the look that suits your topic and audience' },
];
const AUTO = 'Claude chooses';
const RECOMMENDED = 'Bold Blue';
const PICKED_KEY = 'lumi-look-picked';
const userPicked = () => { try { return localStorage.getItem(PICKED_KEY) === '1'; } catch (e) { return false; } };
const rememberPick = () => { try { localStorage.setItem(PICKED_KEY, '1'); } catch (e) { /* private window */ } };
const SHUFFLE_MS = 2600;

// Tiny flat swatches that hint at each look.
const SWATCH = {
  'Pink Punch': '<rect x="11" y="11" width="28" height="28" rx="5" fill="var(--ink)"/><rect x="6" y="6" width="28" height="28" rx="5" fill="#ff4fa3" stroke="var(--ink)" stroke-width="2.5"/><path d="M20 13l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#ffe14d" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/>',
  'Bold Blue': '<rect x="4" y="4" width="36" height="36" rx="8" fill="#1d4ed8"/><circle cx="29" cy="15" r="6" fill="var(--pill)"/><rect x="10" y="25" width="24" height="5" rx="2.5" fill="var(--ink)"/><rect x="10" y="33" width="14" height="3" rx="1.5" fill="var(--pill)"/>',
  'Flat-Pack': '<rect x="4" y="4" width="36" height="36" rx="8" fill="var(--pill)" stroke="#1f5fbf" stroke-width="2"/><path d="M11 30l9-15 9 15z" fill="#ffd23f" stroke="#1f5fbf" stroke-width="2" stroke-linejoin="round"/><rect x="25" y="22" width="9" height="9" rx="1.5" fill="#1f5fbf"/><path d="M11 35h22" stroke="#1f5fbf" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3"/>',
  'Happy Headspace': '<rect x="4" y="4" width="36" height="36" rx="18" fill="#ffe6cc"/><circle cx="18" cy="20" r="10" fill="#ff8a3d"/><circle cx="30" cy="28" r="7" fill="#f4a6c0"/><circle cx="31" cy="13" r="3.5" fill="#ffcc4d"/>',
  'Yellow Frame': '<rect x="4" y="4" width="36" height="36" rx="3" fill="#ffd400"/><rect x="9" y="9" width="26" height="26" fill="var(--pill)"/><text x="22" y="27.5" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-size="13" fill="var(--ink)">Aa</text>',
  'Claude chooses': '<g class="lk-dice"><rect x="5" y="5" width="15" height="15" rx="4" fill="#ff4fa3"/><rect x="24" y="5" width="15" height="15" rx="4" fill="#1d4ed8"/><rect x="5" y="24" width="15" height="15" rx="4" fill="#ffd23f"/><rect x="24" y="24" width="15" height="15" rx="4" fill="#ff8a3d"/></g><circle cx="22" cy="22" r="5.5" fill="var(--ink)"/><path d="M22 19.2v5.6M19.2 22h5.6" stroke="var(--pill)" stroke-width="1.8" stroke-linecap="round"/>',
};

import { h } from './dom.js';

export function mountLooks(el, illusEl, { getState, setKey, bus, audio } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sfx = n => { try { audio && audio.sfx && audio.sfx(n); } catch (e) { /* optional */ } };
  const fire = (type, detail) => {
    try { bus && bus.dispatchEvent ? bus.dispatchEvent(new CustomEvent(type, { detail })) : emit(type, detail); } catch (e) { /* optional */ }
  };
  const current = () => {
    const l = getState && getState().look; const t = l && l.theme;
    if (LOOKS.some(x => x.name === t) && (t !== AUTO || userPicked())) return t;
    return RECOMMENDED;            // nothing chosen by the user yet: Bold Blue is pre-selected
  };
  let alive = true, selected = current(), shown = null, hoverT = 0, leaveT = 0, shuffleT = 0, shuffleIdx = 0, swapT = 0, clicked = false;

  // ---- right column: the options
  const opts = LOOKS.map((L, n) => {
    const b = h('button', { type: 'button', class: 'lk-opt', role: 'radio', 'data-look': L.name, 'data-nosfx': '', 'data-cursor-label': 'pick',
      style: `--d:${n * 45}ms` },
      h('span', { class: 'lk-sw', html: `<svg viewBox="0 0 44 44" aria-hidden="true">${SWATCH[L.name]}</svg>` }),
      h('span', { class: 'lk-txt' }, h('span', { class: 'lk-name' }, L.name,
        L.recommended ? h('span', { class: 'lk-sugg lk-rec', style: 'display:inline-flex;margin-left:8px;background:#0061EF;color:#FFFFFF' }, 'recommended') : null),
        h('span', { class: 'lk-desc' }, L.desc)),
      h('span', { class: 'lk-tick', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
    b.addEventListener('click', () => pick(L.name));
    b.addEventListener('pointerenter', () => preview(L.name));
    b.addEventListener('focus', () => preview(L.name, 0));
    return b;
  });
  const listEl = h('div', { class: 'lk', role: 'radiogroup', 'aria-label': 'the look' }, opts);
  listEl.addEventListener('pointerleave', () => unpreview());
  listEl.addEventListener('focusout', e => { if (!listEl.contains(e.relatedTarget)) unpreview(); });
  listEl.addEventListener('keydown', e => {
    const n = opts.indexOf(document.activeElement);
    if (n < 0) return;
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    opts[(n + d + opts.length) % opts.length].focus();
  });
  el.append(listEl);

  // ---- illustration zone: a framed screen with two stacked videos for smooth swaps
  const mkVid = () => {
    const v = h('video', { class: 'lk-vid', muted: true, loop: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true', disablepictureinpicture: true });
    v.muted = true; v.defaultMuted = true;
    return v;
  };
  const vids = [mkVid(), mkVid()];
  let front = 0;
  const badge = h('span', { class: 'lk-badge' });
  const dots = h('span', { class: 'lk-dots', 'aria-hidden': 'true' }, LOOKS.slice(0, 5).map(() => h('i')));
  const screen = h('div', { class: 'lk-screen' }, vids, h('div', { class: 'lk-top' }, badge, dots));
  const stageEl = h('div', { class: 'lk-stage' + (reduced ? ' lk-reduced' : '') }, screen,
    h('p', { class: 'lk-cap', 'aria-live': 'polite' }));
  const cap = stageEl.lastChild;
  if (illusEl) illusEl.append(stageEl);

  const safePlay = v => { try { const p = v.play(); p && p.catch(() => {}); } catch (e) { /* ignore */ } };
  function showVideo(L, dir = 0) {
    if (!L || !L.slug) return;
    const back = vids[1 - front], cur = vids[front];
    const src = `/themes/${L.slug}.mp4`;
    if (cur.dataset.slug === L.slug && !cur.paused) return;
    cur.pause();
    back.poster = `/themes/${L.slug}.jpg`;
    if (back.dataset.slug !== L.slug) { back.src = src; back.dataset.slug = L.slug; }
    try { back.currentTime = 0; } catch (e) { /* not loaded yet */ }
    safePlay(back);
    back.classList.remove('is-out', 'from-r', 'from-l');
    cur.classList.remove('from-r', 'from-l');
    if (!reduced && dir) back.classList.add(dir > 0 ? 'from-r' : 'from-l');
    back.classList.add('is-in');
    cur.classList.remove('is-in');
    cur.classList.add('is-out');
    front = 1 - front;
    clearTimeout(swapT);
    swapT = setTimeout(() => { if (alive) { cur.pause(); cur.classList.remove('is-out'); } }, 520);
  }
  function stopShuffle() { clearTimeout(shuffleT); shuffleT = 0; stageEl.classList.remove('is-shuffle'); }
  function startShuffle() {
    stopShuffle();
    stageEl.classList.add('is-shuffle');
    const step = (first) => {
      if (!alive) return;
      if (!first) shuffleIdx = (shuffleIdx + 1) % 5;
      showVideo(LOOKS[shuffleIdx], first ? 0 : 1);
      [...dots.children].forEach((d, n) => d.classList.toggle('on', n === shuffleIdx));
      badge.textContent = LOOKS[shuffleIdx].name.toLowerCase();
      if (!first) sfx('tick');
      shuffleT = setTimeout(() => step(false), SHUFFLE_MS);
    };
    step(true);
  }
  function show(name) {
    if (!alive || shown === name) return;
    const prevIdx = LOOKS.findIndex(x => x.name === shown);
    shown = name;
    const L = LOOKS.find(x => x.name === name);
    const isPreview = name !== selected;
    stageEl.classList.toggle('is-preview', isPreview);
    cap.textContent = name === AUTO ? 'claude shuffles the five and picks the best fit for your talk.'
      : `${isPreview ? 'preview: ' : ''}${L.desc}.`;
    if (name === AUTO) { startShuffle(); return; }
    stopShuffle();
    badge.textContent = name.toLowerCase();
    const n = LOOKS.indexOf(L);
    showVideo(L, prevIdx < 0 ? 0 : n > prevIdx ? 1 : -1);
  }
  function preview(name, delay = 140) {
    clearTimeout(leaveT); clearTimeout(hoverT);
    hoverT = setTimeout(() => show(name), delay);
  }
  function unpreview() {
    clearTimeout(hoverT); clearTimeout(leaveT);
    leaveT = setTimeout(() => show(selected), 260);
  }
  function paint() {
    opts.forEach(b => {
      const on = b.dataset.look === selected;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    listEl.classList.toggle('show-sugg', selected === RECOMMENDED && !clicked);
  }
  function pick(name) {
    clicked = true;
    rememberPick();
    const changed = name !== selected;
    selected = name;
    paint();
    if (setKey) setKey('look.theme', name);
    fire('look:change', { theme: name });
    sfx(changed ? 'select' : 'pop');
    const b = opts.find(x => x.dataset.look === name);
    if (b && !reduced) { b.classList.remove('lk-pop'); void b.offsetWidth; b.classList.add('lk-pop'); }
    shown = null;   // replay the chosen look from its start
    clearTimeout(hoverT); clearTimeout(leaveT);
    show(name);
    stageEl.classList.remove('is-preview');
  }

  const onVis = () => {
    const v = vids[front];
    if (document.hidden) { v.pause(); clearTimeout(shuffleT); }
    else if (alive) { if (shown === AUTO) { shown = null; show(AUTO); } else safePlay(v); }
  };
  document.addEventListener('visibilitychange', onVis);

  paint();
  // write the pre-selection into the form state so the brief carries it even when the user never clicks
  { const l = getState && getState().look; if (setKey && (!l || l.theme !== selected)) setKey('look.theme', selected); }
  show(selected);
  requestAnimationFrame(() => alive && listEl.classList.add('lk-ready'));

  return {
    destroy() {
      alive = false;
      clearTimeout(hoverT); clearTimeout(leaveT); clearTimeout(swapT); stopShuffle();
      document.removeEventListener('visibilitychange', onVis);
      for (const v of vids) { v.pause(); v.removeAttribute('src'); v.removeAttribute('poster'); try { v.load(); } catch (e) { /* ignore */ } }
      stageEl.remove();
      listEl.remove();
    },
  };
}
