// Strict power-design rule check for each demo slide (numbers from principles/design-principles.md, Appendix A).
// Prints a pass/fail line per rule and saves a 1920x1080 PNG of each slide. Whitespace + accent area: measure_demo.py.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'X:/CLPHP_Project/frontend/node_modules/playwright');
const dir = path.resolve(__dirname, '..', 'docs', 'screenshots', process.argv[2] || 'theme-demo');
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const summary = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html') && !f.startsWith('card-')).sort()) {
    await p.goto('file:///' + path.join(dir, f).replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const parse = c => { if (!/^rgba?\(/.test(c)) return { r: 255, g: 255, b: 255, a: 0 }; const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      // every element that directly holds visible text (HTML) + every SVG <text>
      const texts = [...document.querySelectorAll('.slide *')].filter(e => e.tagName === 'text' ||
        (e.namespaceURI === 'http://www.w3.org/1999/xhtml' && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())));
      const tw = document.createTreeWalker(document.querySelector('.slide'), NodeFilter.SHOW_TEXT); let words = 0;
      for (let n; (n = tw.nextNode());) words += n.textContent.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
      const sizes = [...new Set(texts.map(e => Math.round(parseFloat(getComputedStyle(e).fontSize))))].sort((a, b) => a - b);
      const h1 = document.querySelector('h1'), hs = getComputedStyle(h1), hSize = parseFloat(hs.fontSize);
      const body = texts.filter(e => e !== h1 && parseFloat(getComputedStyle(e).fontSize) >= 24 && parseFloat(getComputedStyle(e).fontSize) < 48 && e.tagName !== 'text');
      const bodySize = Math.max(...body.map(e => parseFloat(getComputedStyle(e).fontSize)));
      const lines = e => { const c = getComputedStyle(e), box = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((t, k) => t + parseFloat(c[k]), 0);
        return Math.max(1, Math.round((e.getBoundingClientRect().height - box) / parseFloat(c.lineHeight))); };
      const cpl = e => Math.round(e.textContent.trim().length / lines(e));
      const lhBad = [];
      texts.filter(e => e.tagName !== 'text').forEach(e => { const s = getComputedStyle(e), fs = parseFloat(s.fontSize), lh = parseFloat(s.lineHeight) / fs;
        if (fs >= 48 && (lh < 1.05 - 1e-6 || lh > 1.2 + 1e-6)) lhBad.push(`${e.textContent.trim().slice(0, 18)} ${lh.toFixed(2)}`);
        if (fs >= 24 && fs < 48 && lines(e) > 1 && (lh < 1.4 || lh > 1.6)) lhBad.push(`${e.textContent.trim().slice(0, 18)} ${lh.toFixed(2)}`); });
      const contrast = texts.map(e => { const s = getComputedStyle(e), fs = parseFloat(s.fontSize), w = parseInt(s.fontWeight);
        const fg = parse(e.tagName === 'text' ? (s.fill.startsWith('rgb') ? s.fill : s.color) : s.color);
        let bg = bgOf(e); if (e.tagName === 'text') { const rect = e.closest('svg').querySelectorAll('rect'); const q = e.getBBox();
          rect.forEach(rc => { const rb = rc.getBBox(); if (q.x >= rb.x && q.x + q.width <= rb.x + rb.width && q.y >= rb.y && q.y + q.height <= rb.y + rb.height) { const fc = parse(getComputedStyle(rc).fill); if (fc.a > 0) bg = fc; } }); }
        const cr = ratio(over(fg, bg), bg), large = fs >= 24 || (fs >= 18.66 && w >= 700);
        return { t: e.textContent.trim().slice(0, 22), cr: +cr.toFixed(2), need: large ? 3 : 4.5 }; });
      const worst = contrast.reduce((a, c) => (c.cr / c.need < a.cr / a.need ? c : a));
      const COLS = [...Array(12).keys()].map(k => 96 + 146 * k), RIGHT = COLS.map(x => x + 122);
      const off = [], outside = [];
      document.querySelectorAll('[data-grid]').forEach(e => { const q = e.getBoundingClientRect(), n = e.className.baseVal ?? e.className;
        if (!COLS.some(x => Math.abs(q.left - x) <= 1)) off.push(n + ' left ' + Math.round(q.left));
        if (q.left < 95.5 || q.top < 95.5 || q.right > 1824.5 || q.bottom > 984.5) outside.push(n); });
      const gaps = [...document.querySelectorAll('.slide *')].map(e => parseFloat(getComputedStyle(e).marginTop)).filter(v => v > 0);
      const badGaps = gaps.filter(v => ![8, 16, 24, 32, 48, 64, 96, 128].includes(Math.round(v)));
      const pBody = body.filter(e => e.tagName === 'P' || e.tagName === 'SPAN');
      const families = [...new Set(texts.map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()))];
      return { words, h1words: h1.textContent.trim().split(/\s+/).length, sizes, hSize, bodySize, ratio: +(hSize / bodySize).toFixed(2),
        h1cpl: cpl(h1), bodycpl: Math.max(0, ...pBody.map(cpl)), lhBad, worst, off, outside, badGaps, families, fonts: document.fonts.check(`20px ${hs.fontFamily.split(',')[0]}`) };
    });
    const R = [
      ['AURA HARD RULE 1: smallest text >= 26 px', r.sizes[0] >= 26, r.sizes[0]],
      ['AURA font blend: <= 4 typefaces', r.families.length <= 4, r.families.join(' + ')],
      ['#1 headline <= 10 words', r.h1words <= 10, r.h1words],
      ['#3/#20 words per slide <= 25', r.words <= 25, r.words],
      ['#7 <= 4 type sizes', r.sizes.length <= 4, r.sizes.join('/')],
      ['#8 title >= 48, body >= 24, caption >= 18', r.hSize >= 48 && r.bodySize >= 24 && r.sizes[0] >= 18, `${r.hSize}/${r.bodySize}/${r.sizes[0]}`],
      ['#9 line-heights (display 1.05-1.2, body 1.4-1.6)', !r.lhBad.length, r.lhBad.join('; ') || 'ok'],
      ['#10 line length (body <= 60ch, display <= 30ch)', r.bodycpl <= 60 && r.h1cpl <= 30, `body ${r.bodycpl}ch, display ${r.h1cpl}ch`],
      ['#11 contrast (AA 4.5 / 3 large)', r.worst.cr >= r.worst.need, `worst "${r.worst.t}" ${r.worst.cr}:1 (needs ${r.worst.need})`],
      ['#5 safe zone 96 px', !r.outside.length, r.outside.join(', ') || 'ok'],
      ['#16 on the 12-column grid', !r.off.length, r.off.join(', ') || 'ok'],
      ['#15 8-pt spacing', !r.badGaps.length, r.badGaps.join(', ') || 'ok'],
      ['headline:body ratio 2.0-4.0', r.ratio >= 2 && r.ratio <= 4, r.ratio],
      ['free fonts loaded', r.fonts, r.fonts],
    ];
    console.log('\n' + f);
    R.forEach(([n, ok, v]) => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(48)} ${v}`));
    summary.push([f, R.filter(x => !x[1]).length]);
    await p.screenshot({ path: path.join(dir, f.replace('.html', '.png')) });
  }
  console.log('\nFAILED RULES PER SLIDE:', summary.map(([f, n]) => `${f.split('-')[0]}:${n}`).join('  '));
  await b.close();
})();
