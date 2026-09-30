// Screenshot each theme sample at 1920x1080, check text stays inside the 96 px safe zone and nothing overlaps.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'X:/CLPHP_Project/frontend/node_modules/playwright');
const dir = path.resolve(__dirname, '..', 'docs', 'screenshots', 'theme-samples');
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
    await p.goto('file:///' + path.join(dir, f).replace(/\\/g, '/'), { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const box = e => e.getBoundingClientRect();
      const t = [...document.querySelectorAll('h1,.kicker,.people')].map(e => [e.className || e.tagName, box(e)]);
      const out = t.filter(([, q]) => q.left < 95 || q.top < 95 || q.right > 1825 || q.bottom > 985).map(([n]) => n);
      const h = box(document.querySelector('h1')), pe = box(document.querySelector('.people'));
      const overlap = !(h.bottom <= pe.top || pe.bottom <= h.top || h.right <= pe.left || pe.right <= h.left);
      const fam = getComputedStyle(document.querySelector('h1')).fontFamily;
      return { outside: out, titleLines: Math.round(h.height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)), gap: Math.round(pe.top - h.bottom), overlap, fam,
               fontsOk: document.fonts.check('64px ' + fam.split(',')[0]) };
    });
    console.log(f.padEnd(28), JSON.stringify(r));
    await p.screenshot({ path: path.join(dir, f.replace('.html', '.png')) });
  }
  await b.close();
})();
