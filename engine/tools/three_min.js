#!/usr/bin/env node
// One minified ES module of three.js (three.module.js + three.core.js), made with the rolldown that ships in the
// engine. pack_deck.py uses it to keep 3D decks small; it falls back to the raw files when this fails.
//   node .aura/engine/tools/three_min.js <output.js>     (prints the output path; reuses it when already built)
'use strict';
const fs = require('fs'), path = require('path');
const NM = path.resolve(__dirname, '..', 'node_modules');

(async () => {
  const out = path.resolve(process.argv[2] || 'three.min.js');
  const mod = path.join(NM, 'three', 'build', 'three.module.js');
  if (!fs.existsSync(mod)) throw new Error('three.js is not installed');
  const version = JSON.parse(fs.readFileSync(path.join(NM, 'three', 'package.json'), 'utf8')).version;
  const stamp = out + '.version';
  if (fs.existsSync(out) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === version) { console.log(out); return; }
  const { build } = require(path.join(NM, 'rolldown'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const entry = out + '.entry.mjs';
  fs.writeFileSync(entry, 'export * from ' + JSON.stringify(mod.split(path.sep).join('/')) + ';\n');
  try {
    const res = await build({ input: entry, write: false, logLevel: 'silent', output: { format: 'esm', minify: true } });
    const code = res.output[0].code;
    if (code.length < 100000 || /from\s*["']\.\//.test(code)) throw new Error('unexpected bundle');
    fs.writeFileSync(out, code);
    fs.writeFileSync(stamp, version);
    console.log(out);
  } finally { fs.rmSync(entry, { force: true }); }
})().catch(e => { console.error('three_min: ' + (e.message || e)); process.exit(1); });
