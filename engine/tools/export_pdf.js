#!/usr/bin/env node
// PDF backup of a deck: one 1920 x 1080 page per slide, animations at their final state, 3D as still pictures,
// real (selectable) text.
//   node .aura/engine/tools/export_pdf.js "4 - Your slides/<Title>.html" ["<out.pdf>"]
'use strict';
const fs = require('fs'), path = require('path');
const { findAuraRoot, resolveDeck, serveRootFor, serve, launch, openDeck, rel } = require('./lib/deckpage');

(async () => {
  const [deckArg, outArg] = process.argv.slice(2);
  let deck;
  try { deck = resolveDeck(deckArg); } catch (e) { console.error(e.message); process.exit(2); }
  const out = path.resolve(outArg || deck.replace(/\.html?$/i, '') + '.pdf');
  const root = findAuraRoot(deck);
  const server = await serve(serveRootFor(deck));
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.route('**/*', r => (r.request().url().startsWith(server.origin) || /^(data|blob):/.test(r.request().url())) ? r.continue() : r.abort());
    await openDeck(page, server.url(deck));
    const count = await page.$$eval('.deck > .slide, body > .slide', els => els.length);
    if (!count) throw new Error('no slides found');
    await page.emulateMedia({ media: 'print' });
    const tmp = out + '.part';
    await page.pdf({ path: tmp, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const pages = (fs.readFileSync(tmp, 'latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
    fs.renameSync(tmp, out);
    console.log(`PDF saved: ${rel(root, out)}`);
    console.log(`  ${pages} pages for ${count} slides, ${(fs.statSync(out).size / 1048576).toFixed(2)} MB`);
    if (pages !== count) { console.error(`  The PDF has ${pages} pages but the deck has ${count} slides: a slide is probably taller than 1080 px.`); process.exitCode = 1; }
  } catch (e) {
    console.error('Could not make the PDF: ' + (e.message || e).toString().split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
})();
