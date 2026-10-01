#!/usr/bin/env node
// Aura deck check: renders a deck in Microsoft Edge with every slide shown and checks each slide against the HARD RULE
// (no text under 26 px) and the power-design slide rules that can be measured. Saves one PNG per slide plus an
// overview sheet to .aura/temp/shots/<deck>/ so the slides can be looked at.
//   node .aura/engine/tools/deck_check.js <build folder | deck.html> [--mode presenter|document] [--notes] [--no-shots]
// Exit code 0 = no errors (warnings are advice), 1 = errors to fix, 2 = the check itself could not run.
'use strict';
const fs = require('fs'), path = require('path');
const { findAuraRoot, resolveDeck, serveRootFor, serve, launch, openDeck, rel } = require('./lib/deckpage');

const MIN_PX = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'hard-rules.json'), 'utf8')).minFontPx; } catch (e) { return 26; } })();
const SCALE = [28, 36, 48, 64, 84, 112, 150, 200, 266];
const BUDGET = { title: 45, section: 8, content: 25, quote: 30, closing: 20, references: 140, document: 75 };
const WHITESPACE = { title: 0.6, section: 0.6, quote: 0.7, closing: 0.6, content: 0.4, references: 0.3 };

const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); if (i < 0) return false; argv.splice(i, 1); return true; };
const val = n => { const i = argv.indexOf(n); return i >= 0 ? argv.splice(i, 2)[1] : null; };
const wantNotes = flag('--notes'), noShots = flag('--no-shots'), modeArg = val('--mode');

/* ------------------------------------------------------------------ in-page measuring ------------------------------- */
function collect({ MIN_PX }) {
  const SKIP = '[data-aura-notes], .notes, .pnotes, [data-aura-ui], script, style, template, noscript';
  const slides = Array.from(document.querySelectorAll('.deck > .slide, body > .slide'));
  const parseRGBA = s => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const declared = new Set(); if (document.fonts) document.fonts.forEach(f => declared.add(f.family.replace(/["']/g, '')));
  const failedFonts = []; if (document.fonts) document.fonts.forEach(f => { if (f.status === 'error') failedFonts.push(f.family.replace(/["']/g, '')); });
  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|emoji|math|fangsong|-apple-system|segoe ui|arial|helvetica|georgia|times new roman|consolas|impact)$/i;
  window.__auraItems = [];
  const out = slides.map((s, si) => {
    const sr = s.getBoundingClientRect();
    const items = [], seen = new Map();
    const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const el = n.parentElement; if (!el || el.closest(SKIP)) continue;
      let it = seen.get(el);
      if (!it) { it = { el, text: '', rects: [] }; seen.set(el, it); items.push(it); }
      it.text += (it.text ? ' ' : '') + t;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const cr of r.getClientRects()) if (cr.width > 0.5 && cr.height > 0.5)
        it.rects.push({ x: cr.left - sr.left, y: cr.top - sr.top, w: cr.width, h: cr.height });
    }
    const fonts = new Set(), sizes = new Set();
    let words = 0;
    const res = { tiny: [], unsafe: [], clipped: [], overlaps: [], systemFonts: [], gradientText: 0 };
    items.forEach(it => {
      const el = it.el, cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize); let eff = fs;
      if (el.closest('svg')) {
        let k = null; try { const m = el.getScreenCTM(); if (m) k = Math.hypot(m.a, m.b); } catch (e) { /* not rendered */ }
        if (!k) { const svg = el.closest('svg'), vb = svg.viewBox && svg.viewBox.baseVal;
          k = vb && vb.width ? (svg.width.baseVal.value || vb.width) / vb.width : 1; }
        eff = fs * k;
      } else if (el.offsetWidth > 0) eff = fs * (el.getBoundingClientRect().width / el.offsetWidth);
      it.px = Math.round(eff * 10) / 10;
      if (eff < MIN_PX - 0.01) res.tiny.push({ text: it.text.slice(0, 60), px: it.px });
      const visible = it.rects.length && cs.visibility !== 'hidden';
      if (!visible) return;
      sizes.add(Math.round(eff));
      const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
      fonts.add(fam);
      if (!declared.has(fam)) res.systemFonts.push(fam);
      words += it.text.split(/\s+/).filter(x => /[A-Za-zÀ-ɏͰ-ϿЀ-ӿঀ-৿]/.test(x)).length;
      // union box, safe zone, clipping
      const L = Math.min(...it.rects.map(r => r.x)), T = Math.min(...it.rects.map(r => r.y));
      const R = Math.max(...it.rects.map(r => r.x + r.w)), B = Math.max(...it.rects.map(r => r.y + r.h));
      it.box = { x: L, y: T, w: R - L, h: B - T };
      if (L < 94 || T < 94 || R > 1826 || B > 986) res.unsafe.push({ text: it.text.slice(0, 50), box: [L, T, R, B].map(Math.round) });
      for (let a = el; a && a !== s.parentElement; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (a === s || acs.overflowX !== 'visible' || acs.overflowY !== 'visible') {
          const ar = a.getBoundingClientRect();
          const ax = ar.left - sr.left, ay = ar.top - sr.top;
          if (L < ax - 2 || T < ay - 2 || R > ax + ar.width + 2 || B > ay + ar.height + 2) { res.clipped.push({ text: it.text.slice(0, 50) }); break; }
        }
      }
      // colour for the contrast pass
      let alpha = 1;
      for (let a = el; a && a !== s.parentElement; a = a.parentElement) alpha *= parseFloat(getComputedStyle(a).opacity);
      let col;
      if (el.closest('svg')) {
        col = parseRGBA(cs.fill); if (col) col[3] *= parseFloat(cs.fillOpacity || 1);
      } else {
        const fill = cs.webkitTextFillColor; col = parseRGBA(fill && !/currentcolor/i.test(fill) ? fill : cs.color);
        if (/text/.test(cs.backgroundClip || cs.webkitBackgroundClip || '')) { col = null; res.gradientText++; }
      }
      if (col && col[3] * alpha > 0.05) {
        window.__auraItems.push({ si, text: it.text.slice(0, 50), rgb: col.slice(0, 3), a: col[3] * alpha, rects: it.rects, px: it.px });
      }
    });
    // overlapping text lines from unrelated elements
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j];
      if (!A.box || !B.box || A.el.contains(B.el) || B.el.contains(A.el)) continue;
      let hit = false;
      for (const a of A.rects) { for (const b of B.rects) {
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ix > 0 && iy > 0 && ix * iy > 0.3 * Math.min(a.w * a.h, b.w * b.h)) { hit = true; break; } } if (hit) break; }
      if (hit) res.overlaps.push([A.text.slice(0, 30), B.text.slice(0, 30)]);
    }
    const broken = Array.from(s.querySelectorAll('img')).filter(im => im.complete && im.naturalWidth === 0).map(im => (im.getAttribute('src') || '').slice(0, 60));
    const has3dFallback = s.querySelectorAll('.aura-3d[data-fallback]').length;
    const notesEl = s.querySelector('[data-aura-notes], .notes');
    const title = s.dataset.title || ((s.querySelector('h1,h2,h3') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    return { index: si, title: title.slice(0, 70), kind: s.dataset.kind || 'content', words, sizes: [...sizes].sort((a, b) => a - b),
      fonts: [...fonts], broken, has3dFallback, hasNotes: !!(notesEl && notesEl.textContent.trim()),
      minutes: parseFloat(s.dataset.minutes) || 0, w: Math.round(sr.width), h: Math.round(sr.height), ...res };
  });
  // text that sits outside every slide (not runtime chrome)
  const stray = [];
  const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w2.nextNode());) {
    const el = n.parentElement; if (!el || !n.textContent.trim() || el.closest(SKIP) || el.closest('.slide')) continue;
    stray.push(n.textContent.trim().slice(0, 40));
  }
  const deck = document.querySelector('.deck');
  return { slides: out, stray, failedFonts: [...new Set(failedFonts)], mode: deck && deck.dataset.mode || 'presenter', runtime: !!window.Aura };
}

// contrast + whitespace from screenshots (one with text hidden, one normal)
async function analysePixels({ si, plain, normal }) {
  const load = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = 'data:image/png;base64,' + src; });
  const pix = async b64 => { const im = await load(b64); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const out = { contrast: [], whitespace: null };
  if (plain) {
    const P = await pix(plain);
    for (const it of window.__auraItems.filter(i => i.si === si)) {
      const rs = [];
      for (const r of it.rects) {
        const cols = Math.max(3, Math.min(14, Math.round(r.w / 36))), rows = 3;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const x = Math.round(r.x + (i + 0.5) * r.w / cols), y = Math.round(r.y + r.h * (0.25 + j * 0.25));
          if (x < 0 || y < 0 || x >= P.w || y >= P.h) continue;
          const k = (y * P.w + x) * 4, bg = [P.d[k], P.d[k + 1], P.d[k + 2]];
          const fg = it.rgb.map((c, n) => it.a * c + (1 - it.a) * bg[n]);
          rs.push(ratio(fg, bg));
        }
      }
      if (!rs.length) continue;
      rs.sort((a, b) => a - b);
      const worst = rs[Math.floor(rs.length * 0.1)];
      out.contrast.push({ text: it.text, ratio: Math.round(worst * 100) / 100 });
    }
  }
  if (normal) {
    const N = await pix(normal), counts = new Map();
    const step = 6, key = k => (N.d[k] >> 3) + ',' + (N.d[k + 1] >> 3) + ',' + (N.d[k + 2] >> 3);
    let total = 0;
    for (let y = 0; y < N.h; y += step) for (let x = 0; x < N.w; x += step) { const k = (y * N.w + x) * 4, q = key(k); counts.set(q, (counts.get(q) || 0) + 1); total++; }
    let best = null, bc = 0; counts.forEach((v, q) => { if (v > bc) { bc = v; best = q; } });
    const ref = best.split(',').map(v => v * 8 + 4);
    let near = 0;
    for (let y = 0; y < N.h; y += step) for (let x = 0; x < N.w; x += step) {
      const k = (y * N.w + x) * 4;
      if (Math.abs(N.d[k] - ref[0]) + Math.abs(N.d[k + 1] - ref[1]) + Math.abs(N.d[k + 2] - ref[2]) < 30) near++;
    }
    out.whitespace = Math.round(near / total * 100) / 100;
  }
  return out;
}

/* ------------------------------------------------------------------ main ------------------------------------------- */
(async () => {
  let deck;
  try { deck = resolveDeck(argv[0]); } catch (e) { console.error(e.message); process.exit(2); }
  const auraRoot = findAuraRoot(deck);
  const name = path.basename(deck) === 'index.html' ? path.basename(path.dirname(deck)) : path.basename(deck, path.extname(deck));
  const shotsDir = path.join(auraRoot || path.dirname(deck), auraRoot ? '.aura/temp/shots' : '_shots', name.replace(/[^\w.-]+/g, '-'));
  const server = await serve(serveRootFor(deck));
  const browser = await launch();
  const errors = [], warnings = [], net = [];
  const err = (s, m) => errors.push({ slide: s, msg: m }), warn = (s, m) => warnings.push({ slide: s, msg: m });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) net.push('console error: ' + m.text().slice(0, 160));
      else if (m.type() === 'warning' && /^Aura /.test(m.text())) net.push(m.text().slice(0, 200));
    });
    page.on('pageerror', e => net.push('script error: ' + String(e.message).split('\n')[0].slice(0, 160)));
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
      net.push('needs the internet (blocked): ' + u.slice(0, 120));
      return route.abort();
    });
    page.on('response', r => { if (r.status() >= 400) net.push('missing file (' + r.status() + '): ' + decodeURIComponent(r.url().replace(server.origin, '')).slice(0, 120)); });

    await openDeck(page, server.url(deck));
    const info = await page.evaluate(collect, { MIN_PX });
    if (!info.slides.length) { console.error('No slides found. Each slide must be a <section class="slide"> inside <main class="deck">.'); process.exit(1); }
    const mode = modeArg || info.mode;

    // screenshots: normal (kept for review) and with the text hidden (for contrast)
    const handles = await page.$$('.deck > .slide, body > .slide');
    const shots = [], normals = [];
    if (!noShots) { fs.mkdirSync(shotsDir, { recursive: true }); for (const f of fs.readdirSync(shotsDir)) if (/\.png$/.test(f)) fs.unlinkSync(path.join(shotsDir, f)); }
    for (let i = 0; i < handles.length; i++) {
      const buf = await handles[i].screenshot({ animations: 'disabled' });
      normals.push(buf.toString('base64'));
      if (!noShots) { const f = path.join(shotsDir, 'slide-' + String(i + 1).padStart(2, '0') + '.png'); fs.writeFileSync(f, buf); shots.push(f); }
    }
    await page.addStyleTag({ content: '.aura-check-hide .slide, .aura-check-hide .slide * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }' +
      '.aura-check-hide .slide svg text, .aura-check-hide .slide svg tspan, .aura-check-hide .slide svg textPath { fill: transparent !important; stroke: transparent !important; }' });
    await page.evaluate(() => document.documentElement.classList.add('aura-check-hide'));
    await page.waitForTimeout(50);
    const pixels = [];
    for (let i = 0; i < handles.length; i++) {
      const plain = (await handles[i].screenshot({ animations: 'disabled' })).toString('base64');
      pixels.push(await page.evaluate(analysePixels, { si: i, plain, normal: normals[i] }));
    }

    // judge every slide
    const deckSizes = new Set(), deckFonts = new Set();
    let minutes = 0;
    info.slides.forEach((s, i) => {
      const n = i + 1, px = pixels[i];
      s.sizes.forEach(v => deckSizes.add(v)); s.fonts.forEach(f => deckFonts.add(f)); minutes += s.minutes;
      s.tiny.forEach(t => err(n, `HARD RULE: text is ${t.px}px (minimum ${MIN_PX}px): "${t.text}"`));
      s.unsafe.forEach(t => err(n, `text inside the 96 px edge safe zone ${JSON.stringify(t.box)}: "${t.text}"`));
      s.clipped.forEach(t => err(n, `text is cut off by its box or the slide edge: "${t.text}"`));
      s.broken.forEach(src => err(n, `picture did not load: ${src}`));
      const kind = BUDGET[s.kind] ? s.kind : 'content';
      const budget = kind === 'content' && mode === 'document' ? BUDGET.document : BUDGET[kind];
      if (s.words > budget) err(n, `${s.words} words; a ${kind} slide in ${mode} mode allows ${budget}. Cut words or split the slide.`);
      px.contrast.forEach(c => {
        if (c.ratio < 3) err(n, `contrast ${c.ratio}:1 is too low (needs 4.5:1, at least 3:1 for large text): "${c.text}"`);
        else if (c.ratio < 4.5) warn(n, `contrast ${c.ratio}:1, aim for 4.5:1 or more (7:1 for projectors): "${c.text}"`);
      });
      if (s.sizes.length > 4) warn(n, `${s.sizes.length} text sizes (${s.sizes.join(', ')} px); use at most 4 per slide.`);
      const off = s.sizes.filter(v => !SCALE.some(k => Math.abs(k - v) <= 1));
      if (off.length) warn(n, `text sizes not on the type scale 28/36/48/64/84/112: ${off.join(', ')} px.`);
      const needWs = WHITESPACE[s.kind] || 0.4;
      if (px.whitespace !== null && px.whitespace < needWs - 0.05) warn(n, `only ${Math.round(px.whitespace * 100)}% empty space (aim for ${Math.round(needWs * 100)}%).`);
      s.overlaps.forEach(o => warn(n, `texts overlap: "${o[0]}" and "${o[1]}"`));
      [...new Set(s.systemFonts)].forEach(f => warn(n, `"${f}" is not an embedded font; use a font from .aura/engine/fonts so it looks the same everywhere.`));
      if (s.gradientText) warn(n, `${s.gradientText} gradient text item(s): contrast not measured; avoid gradients on text.`);
      if (s.has3dFallback) err(n, `a 3D scene did not start (the reason is listed under deck); fix it or turn it into a 2D illustration.`);
      if (wantNotes && !s.hasNotes) warn(n, 'no speaker notes yet.');
      if (s.w !== 1920 || s.h !== 1080) err(n, `slide is ${s.w} x ${s.h}; slides must be exactly 1920 x 1080.`);
    });
    if (deckFonts.size > 4) err(0, `${deckFonts.size} typefaces (${[...deckFonts].join(', ')}); Aura allows at most 4.`);
    if (deckSizes.size > 6) warn(0, `${deckSizes.size} text sizes across the deck (${[...deckSizes].sort((a, b) => a - b).join(', ')}); aim for 6 or fewer.`);
    info.failedFonts.forEach(f => err(0, `font "${f}" failed to load (check its url).`));
    info.stray.forEach(t => err(0, `text outside any slide: "${t}"`));
    [...new Set(net)].forEach(m => err(0, m));
    if (!info.runtime) warn(0, 'the Aura runtime is not loaded: no navigation, notes or animation replay.');

    // overview sheet: every slide small, to look at the whole deck in one picture
    let overview = null;
    if (!noShots && shots.length) {
      const cols = shots.length > 9 ? 4 : 3, tw = cols === 4 ? 450 : 600, th = Math.round(tw * 9 / 16);
      const cells = normals.map((b, i) => `<figure><img src="data:image/png;base64,${b}"><figcaption>${i + 1}</figcaption></figure>`).join('');
      const sheet = await ctx.newPage();
      await sheet.setViewportSize({ width: cols * (tw + 24) + 24, height: 400 });
      await sheet.setContent(`<style>body{margin:0;padding:24px;background:#2a2a2e;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:24px;font:600 26px system-ui;color:#fff}
        figure{margin:0}img{width:${tw}px;height:${th}px;display:block;border-radius:6px}
        figcaption{padding:6px 2px 0}</style>${cells}`);
      overview = path.join(shotsDir, 'overview.png');
      await sheet.screenshot({ path: overview, fullPage: true });
      await sheet.close();
    }

    // report
    const S = info.slides.length;
    const sizes = [...deckSizes].sort((a, b) => a - b);
    console.log(`Aura deck check: ${rel(auraRoot, deck)}`);
    console.log(`  ${S} slides, ${mode} mode, typefaces: ${[...deckFonts].join(', ') || '-'}, sizes: ${sizes.join('/')} px${minutes ? `, planned ${Math.round(minutes * 10) / 10} min` : ''}`);
    const show = (list, label) => list.sort((a, b) => a.slide - b.slide).forEach(x =>
      console.log(`  ${label} ${x.slide ? 'slide ' + x.slide + (info.slides[x.slide - 1].title ? ' "' + info.slides[x.slide - 1].title.slice(0, 32) + '"' : '') : 'deck'}: ${x.msg}`));
    show(errors, 'ERROR'); show(warnings, 'warn ');
    if (shots.length) console.log(`  screenshots: ${rel(auraRoot, shotsDir)}/slide-01.png ... slide-${String(S).padStart(2, '0')}.png${overview ? ', overview.png' : ''}`);
    console.log(errors.length ? `RESULT: ${errors.length} error(s), ${warnings.length} warning(s). Fix the errors and run the check again.`
                              : `RESULT: clean (${warnings.length} warning(s) to consider).` + (shots.length ? ' Look at the screenshots before packing.' : ''));
    const report = { deck: rel(auraRoot, deck), slides: S, mode, errors, warnings, fonts: [...deckFonts], sizes,
      perSlide: info.slides.map((s, i) => ({ n: i + 1, title: s.title, kind: s.kind, words: s.words, sizes: s.sizes,
        whitespace: pixels[i].whitespace, minContrast: pixels[i].contrast.length ? Math.min(...pixels[i].contrast.map(c => c.ratio)) : null })) };
    if (auraRoot) { const d = path.join(auraRoot, '.aura', 'temp', 'check'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name + '.json'), JSON.stringify(report, null, 2)); }
    await ctx.close();
    process.exitCode = errors.length ? 1 : 0;
  } catch (e) {
    console.error('The deck check could not run: ' + (e && e.message ? e.message.split('\n')[0] : e));
    process.exitCode = 2;
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
})();
