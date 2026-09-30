// Checks the guide for page overflow and saves a PNG of each page (docs/guide/pNN.png).  usage: node tools/check_pages.js
const { chromium } = require(process.env.PW || 'X:/CLPHP_Project/frontend/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
  await p.goto('file:///' + require('path').resolve(__dirname, '..', 'docs', 'guide', 'guide.html').replace(/\\/g, '/')); await p.waitForTimeout(800);
  const over = await p.$$eval('.page', ps => ps.map((pg, i) => {
    const f = pg.querySelector('footer'); const kids = [...pg.children].filter(c => c.tagName !== 'FOOTER');
    const bottom = Math.max(...kids.map(k => k.getBoundingClientRect().bottom)); const lim = f ? f.getBoundingClientRect().top : pg.getBoundingClientRect().bottom;
    return bottom > lim ? `page ${i + 1} overflows by ${Math.round(bottom - lim)}px` : null; }).filter(Boolean));
  console.log(over.length ? over : 'no overflow');
  const els = await p.$$('.page');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: require('path').resolve(__dirname, '..', 'docs', 'guide', `p${String(i + 1).padStart(2, '0')}.png`) });
  await b.close();
})();
