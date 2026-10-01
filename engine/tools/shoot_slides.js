#!/usr/bin/env node
// Render every slide of a deck to a 1920 x 1080 PNG (animations at their final state) and write slides.json with each
// slide's title, speaker notes and planned minutes. Used by export_pptx.py and export_notes.py.
//   node .aura/engine/tools/shoot_slides.js <deck.html | build folder> <output folder>
'use strict';
const fs = require('fs'), path = require('path');
const { resolveDeck, serveRootFor, serve, launch, openDeck, shootSlides, slideInfo } = require('./lib/deckpage');

(async () => {
  const [deckArg, outArg] = process.argv.slice(2);
  let deck;
  try { deck = resolveDeck(deckArg); } catch (e) { console.error(e.message); process.exit(2); }
  if (!outArg) { console.error('usage: node shoot_slides.js <deck> <output folder>'); process.exit(2); }
  const out = path.resolve(outArg);
  const server = await serve(serveRootFor(deck));
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.route('**/*', r => (r.request().url().startsWith(server.origin) || /^(data|blob):/.test(r.request().url())) ? r.continue() : r.abort());
    await openDeck(page, server.url(deck));
    const files = await shootSlides(page, out);
    const info = await slideInfo(page);
    fs.writeFileSync(path.join(out, 'slides.json'), JSON.stringify({ deck, title: await page.title(),
      slides: info.map((s, i) => ({ ...s, image: path.basename(files[i] || '') })) }, null, 2));
    console.log(`Rendered ${files.length} slides to ${out}`);
  } catch (e) {
    console.error('Could not render the slides: ' + (e.message || e).toString().split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
})();
