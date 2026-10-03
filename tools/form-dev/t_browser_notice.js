// D-02 test: open a deck with a UA that looks like Firefox (no window.chrome), then as Edge; count the "this browser may not show the 3D" notices.
// usage: node t_browser_notice.js <deck.html>   (env ENGINE = the engine folder)
const path = require('path');
const dp = require(path.join(process.env.ENGINE, 'tools', 'lib', 'deckpage.js'));
(async () => {
  const f = path.resolve(process.argv[2]);
  const srv = await dp.serve(dp.serveRootFor(f));
  const browser = await dp.launch();
  const out = {};
  try {
    for (const [name, ua, strip] of [['firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0', true],
                                     ['chromium', null, false]]) {
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: ua || undefined });
      if (strip) await ctx.addInitScript(() => { try { delete window.chrome; } catch (e) { window.chrome = undefined; } });
      const page = await ctx.newPage();
      await page.goto(srv.url(f), { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.dataset.auraReady === '1', null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(400);
      out[name] = await page.evaluate(() => document.querySelectorAll('.aura-browser-note').length);
      await ctx.close();
    }
  } finally { await browser.close(); await srv.close(); }
  console.log(`firefox=${out.firefox} chromium=${out.chromium}`);
  process.exit(out.firefox === 1 && out.chromium === 0 ? 0 : 1);
})().catch(e => { console.error(String(e && e.message || e)); process.exit(2); });
