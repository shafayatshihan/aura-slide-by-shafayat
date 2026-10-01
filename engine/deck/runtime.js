/* Lumi deck runtime (classic script, no dependencies).
   Load it in <head>; slides are <section class="slide"> inside <main class="deck">.
   Modes (URL): normal | ?aura=all (every slide stacked, final states: print, PDF, checks)
                | ?aura=still (normal navigation, no motion) | ?aura=presenter (notes view, used by the P window)
                | ?aura=edit (the app's editor preview: clicks select [data-edit] text instead of moving on)
   Embedded in a frame, the deck tells its parent {aura:'slide', index (1-based), count} on every slide change; in edit
   mode a click on a [data-edit] element posts {aura:'edit', id, slide (1-based), text}. The parent may post
   {aura:'go', index (0-based)}.
   API: Aura.scene(id, setup)  - lazy three.js scene for <div class="aura-3d" data-scene="id">
        Aura.canvas(id, setup) - lazy 2D canvas loop for <div class="aura-canvas" data-canvas="id">
        Aura.go(n), Aura.next(), Aura.prev(), Aura.slides(), Aura.ready (Promise), Aura.on(type, fn)
   Runtime chrome is marked data-aura-ui and never shows text below 26 px. */
(function () {
  'use strict';
  if (window.Aura && window.Aura.version) return;

  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  const mode = params.get('aura') || (location.hash === '#all' ? 'all' : '');
  const ALL = mode === 'all';
  const PRESENTER_WINDOW = mode === 'presenter';
  const EDIT = mode === 'edit';
  const EMBEDDED = (() => { try { return window.parent && window.parent !== window; } catch (e) { return true; } })();
  const reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const STILL = ALL || mode === 'still' || reduceMQ.matches;
  const W = 1920, H = 1080, MAX_LIVE_3D = 3;

  if (ALL) html.classList.add('aura-all');
  if (STILL) html.classList.add('aura-still');
  if (EDIT) html.classList.add('aura-edit');

  const sceneDefs = new Map(), canvasDefs = new Map(), listeners = {};
  let slides = [], current = -1, deckEl = null, presenter = PRESENTER_WINDOW, peer = null;
  let readyResolve; const ready = new Promise(r => { readyResolve = r; });

  const emit = (type, detail) => {
    (listeners[type] || []).forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
    document.dispatchEvent(new CustomEvent('aura:' + type, { detail }));
  };

  /* ---------------- slide info ---------------- */
  function notesOf(s) {
    const n = s.querySelector('[data-aura-notes], .notes');
    if (!n) return '';
    const blocks = n.querySelectorAll('p, li');
    const text = blocks.length ? Array.from(blocks, b => b.textContent.replace(/\s+/g, ' ').trim()).join('\n\n')
                               : n.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
    return text;
  }
  function titleOf(s) {
    if (s.dataset.title) return s.dataset.title;
    const h = s.querySelector('h1, h2, h3');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function info() {
    return slides.map((s, i) => ({ index: i, number: i + 1, title: titleOf(s), notes: notesOf(s),
      minutes: parseFloat(s.dataset.minutes) || null, kind: s.dataset.kind || 'content' }));
  }

  /* ---------------- fitting ---------------- */
  let scale = 1;
  function fit() {
    if (ALL || !deckEl) return;
    const panel = presenter ? Math.max(360, innerWidth * 0.34) : 0;
    const w = Math.max(1, innerWidth - panel), h = Math.max(1, innerHeight);
    scale = Math.min(w / W, h / H);
    // no hairline letterbox when the window is within 2 px of 16:9
    if (w - W * scale < 2) scale = Math.max(scale, w / W);
    if (h - H * scale < 2) scale = Math.max(scale, h / H);
    deckEl.style.setProperty('--aura-scale', scale);
    deckEl.style.setProperty('--aura-x', ((w - W * scale) / 2) + 'px');
    deckEl.style.setProperty('--aura-y', ((h - H * scale) / 2) + 'px');
    live3d.forEach(r => sizeRenderer(r));
  }

  /* ---------------- animated pieces (3D + 2D canvas) ---------------- */
  let threePromise = null;
  function loadThree() {
    if (!threePromise) threePromise = import('three');
    return threePromise;
  }
  const live3d = new Set();       // records with a live WebGL renderer
  const running = new Set();      // records animating right now
  let raf = 0, last = 0;

  function holderSize(el) { return { w: el.offsetWidth || W, h: el.offsetHeight || H }; }
  function sizeRenderer(rec) {
    if (!rec.renderer) return;
    const { w, h } = holderSize(rec.el);
    const pr = ALL ? 1 : Math.min(1.5, Math.max(0.5, (window.devicePixelRatio || 1) * scale));
    rec.renderer.setPixelRatio(pr);
    rec.renderer.setSize(w, h, false);
    if (rec.camera && rec.camera.isPerspectiveCamera) { rec.camera.aspect = w / h; rec.camera.updateProjectionMatrix(); }
    if (rec.api && rec.api.resize) rec.api.resize(w, h);
  }

  async function ensure3d(el) {
    if (el._aura) return el._aura;
    const id = el.dataset.scene, setup = sceneDefs.get(id);
    if (!setup) return null;
    const rec = { el, kind: '3d', t0: 0, used: performance.now() };
    el._aura = rec;
    try {
      const THREE = await loadThree();
      const canvas = document.createElement('canvas');
      el.appendChild(canvas);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: ALL, powerPreference: 'default' });
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      rec.renderer = renderer; rec.canvas = canvas;
      const { w, h } = holderSize(el);
      const api = (await setup({ THREE, el, canvas, renderer, width: w, height: h, still: STILL, reducedMotion: reduceMQ.matches })) || {};
      rec.api = api; rec.scene = api.scene; rec.camera = api.camera;
      live3d.add(rec);
      sizeRenderer(rec);
      return rec;
    } catch (err) {
      console.warn('Aura 3D scene "' + id + '" could not start:', err && err.message ? err.message : err);
      dispose3d(rec);
      el.setAttribute('data-fallback', '');
      el._aura = { el, failed: true };
      return null;
    }
  }
  function render3d(rec, t, dt) {
    if (!rec || !rec.renderer) return;
    if (rec.api.update) rec.api.update(t, dt);
    if (rec.scene && rec.camera) rec.renderer.render(rec.scene, rec.camera);
  }
  function dispose3d(rec) {
    if (!rec) return;
    running.delete(rec); live3d.delete(rec);
    try { if (rec.api && rec.api.dispose) rec.api.dispose(); } catch (e) { /* ignore */ }
    if (rec.scene && rec.scene.traverse) {
      rec.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        mats.forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
      });
    }
    if (rec.renderer) { rec.renderer.dispose(); if (rec.renderer.forceContextLoss) rec.renderer.forceContextLoss(); }
    if (rec.canvas && rec.canvas.parentNode) rec.canvas.remove();
    rec.renderer = null;
    if (rec.el && rec.el._aura === rec) rec.el._aura = null;
  }
  function trimLive() {
    if (live3d.size <= MAX_LIVE_3D) return;
    const idle = Array.from(live3d).filter(r => !running.has(r)).sort((a, b) => a.used - b.used);
    while (live3d.size > MAX_LIVE_3D && idle.length) dispose3d(idle.shift());
  }

  function ensureCanvas(el) {
    if (el._aura) return el._aura;
    const setup = canvasDefs.get(el.dataset.canvas);
    if (!setup) return null;
    const canvas = document.createElement('canvas');
    const { w, h } = holderSize(el);
    const pr = ALL ? 1 : Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(w * pr); canvas.height = Math.round(h * pr);
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d'); ctx.scale(pr, pr);
    const rec = { el, kind: '2d', canvas, ctx, t0: 0 };
    try { rec.api = setup({ el, canvas, ctx, width: w, height: h, still: STILL, reducedMotion: reduceMQ.matches }) || {}; }
    catch (e) { console.warn('Aura canvas "' + el.dataset.canvas + '" failed:', e); rec.api = {}; }
    if (typeof rec.api === 'function') rec.api = { update: rec.api };
    el._aura = rec;
    return rec;
  }
  function stillTime(el) { const v = parseFloat(el.dataset.still); return isFinite(v) ? v : 1.5; }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016); last = now;
    running.forEach(rec => {
      const t = (now - rec.t0) / 1000;
      try { if (rec.kind === '3d') render3d(rec, t, dt); else if (rec.api.update) rec.api.update(t, dt); }
      catch (e) { console.error(e); running.delete(rec); }
    });
    if (running.size && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && running.size && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } }

  async function startPieces(slide) {
    const token = slide;
    const pieces = slide.querySelectorAll('.aura-3d[data-scene], .aura-canvas[data-canvas]');
    for (const el of pieces) {
      const rec = el.classList.contains('aura-3d') ? await ensure3d(el) : ensureCanvas(el);
      if (!rec || rec.failed || slides[current] !== token) continue;
      rec.used = performance.now();
      if (STILL) {      // reduced motion: one calm still frame
        const t = stillTime(el);
        if (rec.kind === '3d') render3d(rec, t, 0); else if (rec.api.update) rec.api.update(t, 0);
        continue;
      }
      if (!rec.t0) rec.t0 = performance.now();
      running.add(rec);
    }
    trimLive(); kick();
  }
  function stopPieces(slide) {
    running.forEach(rec => { if (slide.contains(rec.el)) running.delete(rec); });
  }

  // all-slides mode: render each 3D scene once at its still time, keep it as a picture, free the GPU context
  async function renderStills() {
    for (const el of document.querySelectorAll('.aura-3d[data-scene]')) {
      const rec = await ensure3d(el);
      if (!rec || rec.failed) continue;
      try {
        render3d(rec, stillTime(el), 0);
        const img = new Image();
        img.alt = ''; img.src = rec.canvas.toDataURL('image/png');
        await img.decode().catch(() => {});
        el.appendChild(img);
      } catch (e) { console.warn('Aura still render failed:', e); }
      dispose3d(rec);
      el._aura = { el, still: true };
    }
    for (const el of document.querySelectorAll('.aura-canvas[data-canvas]')) {
      const rec = ensureCanvas(el);
      if (rec && rec.api.update) { try { rec.api.update(stillTime(el), 0); } catch (e) { console.error(e); } }
    }
  }

  /* ---------------- navigation ---------------- */
  function go(i, opts) {
    opts = opts || {};
    if (!slides.length || ALL) return;
    i = Math.max(0, Math.min(slides.length - 1, i | 0));
    if (i === current && !opts.force) return;
    const prev = slides[current];
    if (prev) { prev.classList.remove('is-current', 'is-entering'); stopPieces(prev); emit('leave', { index: current, slide: prev }); }
    current = i;
    const s = slides[i];
    s.classList.add('is-current');
    s.classList.remove('is-entering'); void s.offsetWidth; s.classList.add('is-entering');   // replay data-anim
    startPieces(s);
    if (!opts.noHash) { try { history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1)); } catch (e) { /* file: urls */ } }
    updateChrome();
    if (!opts.fromPeer) tellPeer();
    if (EMBEDDED) { try { window.parent.postMessage({ aura: 'slide', index: i + 1, count: slides.length }, '*'); } catch (e) { /* cross-origin */ } }
    emit('slide', { index: i, slide: s });
  }
  const next = () => go(current + 1), prev = () => go(current - 1);

  /* ---------------- chrome ---------------- */
  let ui = {};
  const ICONS = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'
  };
  function buildChrome() {
    const progress = document.createElement('div');
    progress.className = 'aura-ui aura-progress'; progress.setAttribute('data-aura-ui', '');
    progress.setAttribute('aria-hidden', 'true'); progress.innerHTML = '<i></i>';
    const bar = document.createElement('nav');
    bar.className = 'aura-ui aura-bar'; bar.setAttribute('data-aura-ui', ''); bar.setAttribute('aria-label', 'Slide controls');
    bar.innerHTML = '<button type="button" data-act="prev" aria-label="Previous slide">' + ICONS.prev + '</button>' +
      '<span class="aura-count" aria-live="polite"></span>' +
      '<button type="button" data-act="next" aria-label="Next slide">' + ICONS.next + '</button>' +
      '<button type="button" data-act="notes" aria-label="Speaker notes (N)">' + ICONS.notes + '</button>' +
      '<button type="button" data-act="full" aria-label="Full screen (F)">' + ICONS.full + '</button>';
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      ({ prev, next, notes: toggleNotes, full: toggleFull })[b.dataset.act]();
    });
    const panel = document.createElement('aside');
    panel.className = 'aura-notes-panel'; panel.setAttribute('data-aura-ui', '');
    panel.innerHTML = '<div class="aura-np-head"><span class="aura-np-time" title="Click to restart the timer">0:00</span>' +
      '<span class="aura-np-plan"></span></div><div class="aura-np-next"></div><div class="aura-np-notes"></div>';
    const black = document.createElement('div');
    black.setAttribute('data-aura-ui', ''); black.className = 'aura-ui';
    black.style.cssText = 'inset:0;background:#000;display:none;z-index:60';
    document.body.append(progress, bar, panel, black);
    ui = { progress: progress.firstChild, count: bar.querySelector('.aura-count'), panel, black,
      time: panel.querySelector('.aura-np-time'), plan: panel.querySelector('.aura-np-plan'),
      next: panel.querySelector('.aura-np-next'), notes: panel.querySelector('.aura-np-notes') };
    ui.time.addEventListener('click', () => { t0 = Date.now(); });
  }
  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function updateChrome() {
    if (!ui.count) return;
    const n = slides.length;
    ui.count.textContent = (current + 1) + ' / ' + n;
    ui.progress.style.width = (n > 1 ? (current / (n - 1)) * 100 : 100) + '%';
    if (presenter) {
      const meta = info();
      ui.notes.textContent = meta[current] ? meta[current].notes : '';
      ui.next.textContent = meta[current + 1] ? 'Next: ' + (meta[current + 1].title || 'slide ' + (current + 2)) : 'Last slide';
      const before = meta.slice(0, current).reduce((a, m) => a + (m.minutes || 0), 0);
      const here = meta[current] && meta[current].minutes;
      ui.plan.textContent = here ? 'plan ' + fmt(before * 60) + ' to ' + fmt((before + here) * 60) : 'slide ' + (current + 1) + ' of ' + n;
    }
  }
  let t0 = Date.now(), clock = 0;
  function setPresenter(on) {
    presenter = on;
    html.classList.toggle('aura-presenter', on);
    clearInterval(clock);
    if (on) { clock = setInterval(() => { ui.time.textContent = fmt((Date.now() - t0) / 1000); }, 500); }
    fit(); updateChrome();
  }
  function toggleNotes() { setPresenter(!presenter); }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else html.requestFullscreen && html.requestFullscreen().catch(() => {});
  }
  function toggleBlack() { ui.black.style.display = ui.black.style.display === 'none' ? 'block' : 'none'; }

  // second window for dual screens: same deck in presenter view, kept in step both ways
  function openPresenterWindow() {
    const url = location.href.split('#')[0].replace(/([?&])aura=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const w = window.open(url + (url.includes('?') ? '&' : '?') + 'aura=presenter#' + (current + 1), 'aura-presenter', 'width=1280,height=760');
    if (w) peer = w;
  }
  function tellPeer() {
    const target = peer && !peer.closed ? peer : (window.opener && !window.opener.closed ? window.opener : null);
    if (target) { try { target.postMessage({ aura: 'go', index: current }, '*'); } catch (e) { /* closed */ } }
  }
  window.addEventListener('message', e => {
    if (!e.data || e.data.aura !== 'go') return;
    if (e.source && e.source !== window) peer = e.source;
    go(e.data.index, { fromPeer: true });
  });

  /* ---------------- input ---------------- */
  let digits = '', digitTimer = 0;
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) { digits += k; clearTimeout(digitTimer); digitTimer = setTimeout(() => { digits = ''; }, 1500); return; }
    if (k === 'Enter' && digits) { go(parseInt(digits, 10) - 1); digits = ''; e.preventDefault(); return; }
    const map = {
      ArrowRight: next, ArrowDown: next, PageDown: next, ' ': next, Enter: next, l: next,
      ArrowLeft: prev, ArrowUp: prev, PageUp: prev, Backspace: prev, h: prev,
      Home: () => go(0), End: () => go(slides.length - 1),
      f: toggleFull, F: toggleFull, n: toggleNotes, N: toggleNotes, p: openPresenterWindow, P: openPresenterWindow,
      b: toggleBlack, B: toggleBlack, '.': toggleBlack
    };
    if (e.shiftKey && k === ' ') { prev(); e.preventDefault(); return; }
    const fn = map[k];
    if (fn) { e.preventDefault(); fn(); }
  }
  const interactive = el => el.closest('a, button, input, textarea, select, label, [contenteditable="true"], [contenteditable=""], [data-interactive], [data-aura-ui]');
  let down = null;
  function onPointerDown(e) { if (e.button === 0 || e.pointerType === 'touch') down = { x: e.clientX, y: e.clientY, t: Date.now(), type: e.pointerType }; }
  function onPointerUp(e) {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y, d = down; down = null;
    if (interactive(e.target)) return;
    if (EDIT) {                     // editor preview: a click picks the text element, never changes slide
      const el = e.target.closest && e.target.closest('[data-edit]');
      if (el && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const slide = slides.indexOf(el.closest('.slide')) + 1;
        const msg = { aura: 'edit', id: el.getAttribute('data-edit'), slide, text: el.textContent.replace(/\s+/g, ' ').trim() };
        try { window.parent.postMessage(msg, '*'); } catch (err) { /* not embedded */ }
        emit('edit', msg);
      }
      return;
    }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) { dx < 0 ? next() : prev(); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - d.t < 600) {
      if (d.type === 'touch' && e.clientX < innerWidth / 3) prev(); else next();
    }
  }
  let idle = 0;
  function onMove() {
    html.classList.add('aura-show-ui'); html.classList.remove('aura-hide-cursor');
    clearTimeout(idle);
    idle = setTimeout(() => { html.classList.remove('aura-show-ui'); if (document.fullscreenElement) html.classList.add('aura-hide-cursor'); }, 2400);
  }

  /* ---------------- start ---------------- */
  function init() {
    deckEl = document.querySelector('.deck') || document.body;
    slides = Array.from(deckEl.querySelectorAll(':scope > .slide'));
    if (!slides.length) slides = Array.from(document.querySelectorAll('.slide'));
    slides.forEach((s, i) => {
      s.setAttribute('aria-roledescription', 'slide');
      s.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
      s.querySelectorAll('[data-delay]').forEach(el => el.style.setProperty('--d', (parseFloat(el.dataset.delay) || 0) + 'ms'));
    });
    const finish = () => { html.dataset.auraReady = '1'; readyResolve(info()); emit('ready', info()); };
    if (ALL) {
      Promise.all([document.fonts ? document.fonts.ready : null, renderStills()]).then(finish, finish);
      return;
    }
    buildChrome();
    fit();
    addEventListener('resize', fit);
    addEventListener('keydown', onKey);
    deckEl.addEventListener('pointerdown', onPointerDown);
    addEventListener('pointerup', onPointerUp);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n) go(n - 1, { noHash: true }); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    addEventListener('beforeprint', () => html.classList.add('aura-all'));
    addEventListener('afterprint', () => { if (!ALL) html.classList.remove('aura-all'); });
    if (PRESENTER_WINDOW) setPresenter(true);
    const start = parseInt((location.hash || '').slice(1), 10);
    go(start ? start - 1 : 0, { force: true, noHash: !start });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(finish, finish);
  }

  window.Aura = {
    version: '0.3.0', mode: ALL ? 'all' : (PRESENTER_WINDOW ? 'presenter' : (EDIT ? 'edit' : (STILL ? 'still' : 'normal'))), ready,
    scene(id, setup) { sceneDefs.set(id, setup); },
    canvas(id, setup) { canvasDefs.set(id, setup); },
    go: n => go(n - 1), next: () => next(), prev: () => prev(),
    current: () => current + 1, slides: info,
    on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); return () => { listeners[type] = listeners[type].filter(f => f !== fn); }; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();
