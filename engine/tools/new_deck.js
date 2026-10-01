#!/usr/bin/env node
// Start a new deck from the Aura template.
//   node .aura/engine/tools/new_deck.js "<Deck title>" --theme pink-punch [--slug my-deck] [--kicker "Thesis defence"] [--force]
// Creates .aura/temp/build/<slug>/index.html (runtime, theme, three.js import map already wired) and an assets/ folder.
//
// Give every editable text a stable id (run after writing or changing slides; safe to run any number of times):
//   node .aura/engine/tools/new_deck.js --ids .aura/temp/build/<slug> [--check]
// Adds data-edit="s<slide>-<n>" to every title, kicker, body line, label and caption that has none, keeps every id that
// already exists (ids are names, not positions: they never change when slides move), and renames accidental duplicates
// (the first element keeps the id, the copy gets a new one). --check only reports and exits 3 when something is missing.
'use strict';
const fs = require('fs'), path = require('path');
const { ENGINE, findAuraRoot } = require('./lib/deckpage');

const THEMES = { 'pink-punch': 'Pink Punch', 'bold-blue': 'Bold Blue', 'flat-pack': 'Flat-Pack',
  'happy-headspace': 'Happy Headspace', 'yellow-frame': 'Yellow Frame' };
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args.splice(i, 2)[1] : null; };
const flag = n => { const i = args.indexOf('--' + n); return i >= 0 ? (args.splice(i, 1), true) : false; };

/* ---------------- data-edit ids ---------------- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
  'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use']);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption', 'blockquote', 'td', 'th', 'dt', 'dd',
  'caption', 'text']);
const TEXT_CLASSES = /(^|\s)(kicker|title|headline|sub|subtitle|lead|label|caption|source|big-num|stat|quote|pill)(\s|$)/;
const attrOf = (attrs, name) => {
  const m = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(attrs);
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
};
const hasAttr = (attrs, name) => new RegExp('(?:^|\\s)' + name + '(\\s|=|$)', 'i').test(attrs);

function assignIds(html) {
  // tags in document order; comments, scripts and styles are skipped whole
  const tok = /<!--[\s\S]*?-->|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  const stack = [], found = [];
  let slideNo = 0, lastEnd = 0, m;
  const inside = key => stack.some(e => e[key]);
  while ((m = tok.exec(html))) {
    const [all, , closeName, openName, attrs = '', selfClose] = m;
    const between = html.slice(lastEnd, m.index);           // text between tags belongs to every open candidate
    if (between.trim()) for (const e of stack) if (e.cand) e.text += between;
    lastEnd = m.index + all.length;
    if (closeName) {
      const name = closeName.toLowerCase();
      let k = stack.length - 1;
      while (k >= 0 && stack[k].name !== name) k--;
      if (k < 0) continue;
      while (stack.length > k) { const e = stack.pop(); if (e.cand) found.push(e); }
      continue;
    }
    if (!openName) continue;
    const name = openName.toLowerCase();
    const cls = attrOf(attrs, 'class') || '';
    const existing = attrOf(attrs, 'data-edit');
    const e = { name, start: m.index, nameEnd: m.index + 1 + openName.length, text: '' };
    e.slide = name === 'section' && /(^|\s)slide(\s|$)/.test(cls);
    if (e.slide) slideNo++;
    e.skip = (name === 'aside' && (hasAttr(attrs, 'data-aura-notes') || /(^|\s)notes(\s|$)/.test(cls)))
      || name === 'defs' || hasAttr(attrs, 'data-aura-ui') || /^(no|off|false)$/i.test(existing || '');
    const inSlide = inside('slide');
    if (inSlide && !inside('skip') && !inside('cand') && !e.skip && (existing || TEXT_TAGS.has(name) || TEXT_CLASSES.test(cls))) {
      e.cand = true;
      e.id = existing;
      e.slideAt = slideNo;
      if (existing !== null) {
        const q = /(\sdata-edit\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/i.exec(attrs);
        e.idStart = e.nameEnd + q.index + q[1].length; e.idLen = q[2].length;
      }
    }
    if (selfClose || (VOID.has(name) && !TEXT_TAGS.has(name))) { if (e.cand && e.id) found.push(e); continue; }
    stack.push(e);
  }
  found.sort((a, b) => a.start - b.start);
  const used = new Set(), maxBySlide = {}, edits = [];
  let added = 0, renamed = 0, kept = 0;
  for (const e of found) {
    const mm = e.id && /^s(\d+)-(\d+)$/.exec(e.id);
    if (mm) maxBySlide[mm[1]] = Math.max(maxBySlide[mm[1]] || 0, +mm[2]);
  }
  const nextId = k => { let n = (maxBySlide[k] || 0) + 1, id; while (used.has(id = 's' + k + '-' + n)) n++; maxBySlide[k] = n; return id; };
  for (const e of found) {
    if (e.id && !used.has(e.id)) { used.add(e.id); kept++; continue; }
    if (!e.id && !e.text.replace(/&nbsp;|&#160;/g, ' ').trim()) continue;      // empty boxes filled by a script: leave alone
    const id = nextId(e.slideAt); used.add(id);
    if (e.id) { edits.push({ at: e.idStart, len: e.idLen, str: '"' + id + '"' }); renamed++; }
    else { edits.push({ at: e.nameEnd, len: 0, str: ' data-edit="' + id + '"' }); added++; }
  }
  edits.sort((a, b) => b.at - a.at);
  let out = html;
  for (const x of edits) out = out.slice(0, x.at) + x.str + out.slice(x.at + x.len);
  return { html: out, added, renamed, kept, slides: slideNo };
}

if (flag('ids')) {
  const checkOnly = flag('check');
  let target = path.resolve(args[0] || '.');
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) { console.error('Deck not found: ' + target); process.exit(1); }
  const src = fs.readFileSync(target, 'utf8');
  const r = assignIds(src);
  if (!checkOnly && r.html !== src) {
    const tmp = target + '.part';
    fs.writeFileSync(tmp, r.html, 'utf8');
    fs.renameSync(tmp, target);
  }
  console.log(`Editable text ids: ${r.kept} kept, ${r.added} ${checkOnly ? 'missing' : 'added'}, ` +
    `${r.renamed} duplicate${r.renamed === 1 ? '' : 's'} ${checkOnly ? 'found' : 'renamed'} (${r.slides} slides)`);
  process.exit(checkOnly && (r.added || r.renamed) ? 3 : 0);
}

/* ---------------- new deck ---------------- */
const force = flag('force');
let theme = (opt('theme') || 'happy-headspace').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const slugArg = opt('slug'), kicker = opt('kicker') || '';
const title = args.join(' ').trim();

if (!title) {
  console.error('usage: node new_deck.js "<Deck title>" --theme pink-punch|bold-blue|flat-pack|happy-headspace|yellow-frame\n' +
    '       node new_deck.js --ids <build folder> [--check]');
  process.exit(1);
}
if (!THEMES[theme]) { console.error('Unknown theme "' + theme + '". Use one of: ' + Object.keys(THEMES).join(', ')); process.exit(1); }
const root = findAuraRoot(process.cwd());
if (!root) { console.error('Run this from the Lumi folder (the one that contains .aura).'); process.exit(1); }

const slug = (slugArg || title).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 48) || 'deck';
const dir = path.join(root, '.aura', 'temp', 'build', slug);
const file = path.join(dir, 'index.html');
const relDir = path.relative(root, dir).split(path.sep).join('/');
if (fs.existsSync(file) && !force) {
  console.log('Deck already exists (kept as it is): ' + path.relative(root, file).split(path.sep).join('/'));
  console.log('Add --force to start again from the template.');
  process.exit(0);
}
fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
const engineRel = path.relative(dir, path.join(root, '.aura', 'engine')).split(path.sep).join('/');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = fs.readFileSync(path.join(ENGINE, 'deck', 'template.html'), 'utf8')
  .replace(/\{\{ENGINE\}\}/g, engineRel).replace(/\{\{THEME\}\}/g, theme)
  .replace(/\{\{TITLE\}\}/g, esc(title)).replace(/\{\{KICKER\}\}/g, esc(kicker || THEMES[theme]));
fs.writeFileSync(file, html, 'utf8');
console.log('New deck: ' + path.relative(root, file).split(path.sep).join('/'));
console.log('Theme: ' + THEMES[theme] + '  (rules: .aura/engine/deck/themes/' + theme + '.css)');
console.log('Put pictures for the deck in: ' + relDir + '/assets');
console.log('After writing the slides run: node .aura/engine/tools/new_deck.js --ids ' + relDir);
