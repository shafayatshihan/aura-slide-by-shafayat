/* Bold Blue deck helpers (classic script; load after runtime.js and before your own slide scripts).
   - Page numbers: every <span class="bb-pageno"></span> becomes "03 / 12" (DM Mono, filled at load, so moving slides
     never leaves a stale number).
   - Count-ups: <span data-bb-count>45</span> shows its final value in the PDF / check / editor and counts up from 0
     each time the slide is entered during the talk (decimals and thousands separators are kept).
   - BBChart.line(holder, spec): the reference deck's line chart, drawn as SVG at the holder's real pixel size so every
     label is exactly the size written here (ticks, axis titles and end labels 28 px; step labels, the event pill and the
     source / "illustrative" caption 20 px - the only chart texts allowed below 28 px, marked .bb-steplbl / .bb-cap).
   Spec: .claude/skills/aura-slide/looks/bold-blue/LOOK.md, section "2D charts". */
(function () {
  'use strict';
  if (window.BB) return;
  const NS = 'http://www.w3.org/2000/svg';
  const html = document.documentElement;
  const mode = new URLSearchParams(location.search).get('aura') || '';
  const STILL = mode === 'all' || mode === 'still' || html.classList.contains('aura-all') || html.classList.contains('aura-still') ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const queue = [];
  const whenReady = fn => { if (document.readyState === 'loading') queue.push(fn); else fn(); };
  document.addEventListener('DOMContentLoaded', () => { while (queue.length) { try { queue.shift()(); } catch (e) { console.error(e); } } });

  /* ------------------------------------------------------------------ page numbers */
  function pageNumbers() {
    const slides = Array.from(document.querySelectorAll('.deck > .slide'));
    const pad = n => String(n).padStart(2, '0');
    slides.forEach((s, i) => s.querySelectorAll('.bb-pageno').forEach(el => {
      el.setAttribute('data-edit', 'no'); el.textContent = pad(i + 1) + ' / ' + pad(slides.length);
    }));
  }

  /* ------------------------------------------------------------------ count-ups */
  function parseNum(txt) {
    const m = /-?[\d,]*\.?\d+/.exec(txt || ''); if (!m) return null;
    const raw = m[0], dec = (raw.split('.')[1] || '').length;
    return { v: parseFloat(raw.replace(/,/g, '')), dec, comma: raw.includes(','), pre: txt.slice(0, m.index), post: txt.slice(m.index + raw.length) };
  }
  function fmt(p, v) {
    let s = v.toFixed(p.dec);
    if (p.comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.pre + s + p.post;
  }
  function countUp(slide) {
    if (STILL) return;
    slide.querySelectorAll('[data-bb-count]').forEach(el => {
      const p = el._bb || (el._bb = parseNum(el.textContent)); if (!p) return;
      const from = parseFloat(el.dataset.bbFrom || '0'), dur = parseFloat(el.dataset.bbDur || '1800'), delay = parseFloat(el.dataset.delay || '400');
      const t0 = performance.now() + delay;
      el.textContent = fmt(p, from);
      const step = now => {
        const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(p, from + (p.v - from) * e);
        if (k < 1 && slide.classList.contains('is-current')) requestAnimationFrame(step); else el.textContent = fmt(p, p.v);
      };
      requestAnimationFrame(step);
    });
  }

  /* ------------------------------------------------------------------ SVG helpers */
  function S(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, str, { size = 28, weight = 600, fill = '#6E6861', anchor = 'middle', rotate = null, mono = false, cls = null } = {}) {
    const t = S('text', { x, y, class: cls, 'text-anchor': anchor, 'font-family': mono ? 'DM Mono, monospace' : 'Poppins, sans-serif', 'font-size': size,
      'font-weight': weight, fill, transform: rotate != null ? `rotate(${rotate} ${x} ${y})` : null }, parent);
    t.textContent = str; return t;
  }
  let uid = 0;

  /* ------------------------------------------------------------------ the line chart
     spec = {
       x: { min, max, ticks: [..], title: 'time elapsed, min' }, y: { min, max, ticks: [..], title: 'temperature, °C' },
       series: [{ name: 'evaporator', color: '#E23B00', points: [[x, y], ...], markers: false }],
       steps: { at: [x0, x1, ...], labels: ['5 W', ...], highlight: 5 },     // optional dashed step lines + top labels
       band: { from: x, to: x, color: '#FFCE00' },                          // optional highlighted region
       event: { x, y, label: 'the turning point' },                           // optional marked moment
       illustrative: false,      // true: the curve shows a shape, not data - prints "illustrative" and draws no y tick numbers
       source: 'Source: Author et al., 2021, Fig. 3'                          // required for real (published / user) data
     } */
  function line(holder, spec) {
    const el = typeof holder === 'string' ? document.querySelector(holder) : holder;
    if (!el) return;
    whenReady(() => draw(el, spec));
  }
  function draw(el, spec) {
    el.setAttribute('data-edit', 'no');
    el.innerHTML = '';
    const cs = getComputedStyle(el), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const W = Math.max(400, (el.clientWidth - padX) || 1000), H = Math.max(300, (el.clientHeight - padY) || 700), id = 'bbc' + (++uid);
    const longest = Math.max(0, ...spec.series.map(s => (s.name || '').length));
    const note = [spec.illustrative || spec.sample ? 'illustrative' : null, spec.source || null].filter(Boolean).join(' · ');
    const pad = { l: 150, r: Math.min(260, 40 + longest * 17), t: spec.steps ? 112 : 48, b: note ? 184 : 140 };
    const x0 = pad.l, x1 = W - pad.r, y0 = H - pad.b, y1 = pad.t;
    const X = v => x0 + (v - spec.x.min) / (spec.x.max - spec.x.min) * (x1 - x0);
    const Y = v => y0 - (v - spec.y.min) / (spec.y.max - spec.y.min) * (y0 - y1);
    const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.label || '', class: 'bb-chart-svg' }, el);
    svg.style.display = 'block'; svg.style.overflow = 'visible';
    const defs = S('defs', {}, svg);
    const grad = S('linearGradient', { id: id + 'g', gradientUnits: 'userSpaceOnUse', x1: x0, y1: 0, x2: x1, y2: 0 }, defs);
    [['0', '#0061EF'], ['.3', '#5431A5'], ['.55', '#9B6BFF'], ['.8', '#5431A5'], ['1', '#0061EF']].forEach(([o, c]) => S('stop', { offset: o, 'stop-color': c }, grad));
    const mk = S('marker', { id: id + 'a', markerUnits: 'userSpaceOnUse', markerWidth: 22, markerHeight: 22, refX: 11, refY: 11, orient: 'auto' }, defs);
    S('path', { d: 'M3 3 L19 11 L3 19 Z', fill: '#2D2C2B' }, mk);

    // highlighted region + step lines + step labels
    if (spec.band) S('rect', { x: X(spec.band.from), y: y1 - 10, width: X(spec.band.to) - X(spec.band.from), height: y0 - y1 + 10, rx: 10, fill: spec.band.color || '#FFCE00', opacity: 0.16 }, svg);
    spec.y.ticks.forEach(v => S('path', { d: `M${x0 + 24} ${Y(v)} H${x1}`, stroke: '#2D2C2B', 'stroke-width': 1.5, opacity: 0.08 }, svg));
    if (spec.steps) {
      const at = spec.steps.at;
      at.forEach((v, i) => { if (i > 0) S('path', { d: `M${X(v)} ${y1 - 10} V${y0}`, stroke: '#A8A29B', 'stroke-width': 2, 'stroke-dasharray': '6 8' }, svg); });
      (spec.steps.labels || []).forEach((lab, i) => {
        const a = at[i], b = i + 1 < at.length ? at[i + 1] : spec.x.max, cx = (X(a) + X(b)) / 2, hi = i === spec.steps.highlight;
        if (hi) S('rect', { x: cx - 48, y: y1 - 62, width: 96, height: 36, rx: 18, fill: '#FFCE00' }, svg);
        T(svg, cx, y1 - 36, lab, { size: 20, weight: hi ? 700 : 600, fill: hi ? '#2D2C2B' : '#6E6861', cls: 'bb-steplbl' });
      });
    }
    // y axis (ink arrow) + ticks + title
    S('path', { d: `M${x0} ${y0 + 34} V${y1 - 40}`, stroke: '#2D2C2B', 'stroke-width': 4, 'stroke-linecap': 'round', 'marker-end': `url(#${id}a)` }, svg);
    if (!spec.illustrative) spec.y.ticks.forEach(v => T(svg, x0 - 18, Y(v) + 10, String(v), { anchor: 'end' }));
    if (spec.y.title) T(svg, 40, (y0 + y1) / 2, spec.y.title, { weight: 700, fill: '#2D2C2B', rotate: -90 });
    // x axis: the gradient arrow bar
    const clip = S('clipPath', { id: id + 'c' }, defs);
    S('rect', { x: x0, y: y0 + 28, width: x1 - x0 + 30, height: 12, rx: 6 }, clip);
    S('path', { d: `M${x1 + 24} ${y0 + 14} L${x1 + 58} ${y0 + 34} L${x1 + 24} ${y0 + 54} Z` }, clip);
    const blur = S('filter', { id: id + 'b', x: '-5%', y: '-300%', width: '110%', height: '700%' }, defs);
    S('feGaussianBlur', { stdDeviation: 7 }, blur);
    const gb = S('g', { filter: `url(#${id}b)`, opacity: 0.6 }, svg);
    S('rect', { x: x0, y: y0 + 10, width: x1 - x0 + 70, height: 48, fill: `url(#${id}g)`, 'clip-path': `url(#${id}c)` }, gb);
    S('rect', { x: x0, y: y0 + 10, width: x1 - x0 + 70, height: 48, fill: `url(#${id}g)`, 'clip-path': `url(#${id}c)` }, svg);
    (spec.illustrative && !spec.x.keepTicks ? [] : spec.x.ticks).forEach(v => T(svg, X(v), y0 + 92, String(v)));
    if (spec.x.title) T(svg, (x0 + x1) / 2, y0 + 136, spec.x.title, { weight: 700, fill: '#2D2C2B' });
    // series: draw-on lines, direct labels at the right end (no legend box)
    spec.series.forEach((s, k) => {
      const pts = s.points.filter(p => p[0] >= spec.x.min && p[0] <= spec.x.max);
      if (!pts.length) return;
      const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
      const pth = S('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, 'data-anim': 'draw' }, svg);
      pth.style.setProperty('--d', (300 + k * 250) + 'ms');
      if (s.markers) pts.forEach(p => S('circle', { cx: X(p[0]), cy: Y(p[1]), r: 9, fill: '#2D2C2B', stroke: '#FFFFFF', 'stroke-width': 3 }, svg));
      const last = pts[pts.length - 1];
      if (s.name) T(svg, X(last[0]) + 16, Y(last[1]) + 10, s.name, { anchor: 'start', weight: 700, fill: s.color });
    });
    // the marked moment: vertical ink line, dark pill, breathing yellow halo
    if (spec.event) {
      const ex = X(spec.event.x), ey = Y(spec.event.y);
      S('path', { d: `M${ex} ${y1 + 62} V${y0}`, stroke: '#2D2C2B', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
      const w = Math.max(200, spec.event.label.length * 11 + 56);
      S('rect', { x: ex - w / 2, y: y1, width: w, height: 60, rx: 30, fill: '#2D2C2B' }, svg);
      T(svg, ex, y1 + 38, spec.event.label, { size: 20, weight: 700, fill: '#FFFFFF', cls: 'bb-cap' });
      S('circle', { cx: ex, cy: ey, r: 26, fill: '#FFCE00', opacity: 0.55, class: 'bb-breathe' }, svg);
      S('circle', { cx: ex, cy: ey, r: 11, fill: '#2D2C2B', stroke: '#FFFFFF', 'stroke-width': 4 }, svg);
    }
    if (note) T(svg, W - 8, H - 8, note, { size: 20, weight: 600, anchor: 'end', cls: 'bb-cap' });
  }

  /* ------------------------------------------------------------------ wiring */
  const style = document.createElement('style');
  style.textContent = '@keyframes bbBreathe{0%,100%{transform:scale(.82)}55%{transform:scale(1.14)}}' +
    '.bb-breathe{transform-box:fill-box;transform-origin:center}.slide.is-current .bb-breathe{animation:bbBreathe 3.4s ease-in-out infinite}';
  (document.head || html).appendChild(style);
  whenReady(pageNumbers);
  document.addEventListener('aura:slide', e => { const s = e.detail && e.detail.slide; if (s) countUp(s); });

  window.BB = { version: '1.0', pageNumbers, countUp };
  window.BBChart = { line };
})();
