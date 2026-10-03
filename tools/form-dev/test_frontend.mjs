// Front-end unit tests (X-03): the pure logic of engine/form/js under Node, plus the structural rules the survey found broken
// (duplicated helpers, hard-coded palette, API strings, font floor, modals without focus handling).
//   node tools/form-dev/test_frontend.mjs        prints "PASS ..." / "FAIL ..." lines and "N/M frontend checks passed"
// tools/form-dev/test_frontend.py runs this (and the markers fixtures) and, with --e2e, the Playwright walk.
import fs from 'node:fs';
import path from 'node:path';
import { load, jsDir } from './fe_load.mjs';

let pass = 0, total = 0;
const check = (name, ok, detail = '') => { total++; if (ok) pass++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '   -> ' + String(detail).slice(0, 240)}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const read = f => fs.readFileSync(path.join(jsDir, f), 'utf8');
const cssDir = path.join(jsDir, '..', 'css');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

// ---------------------------------------------------------------- bus.js: ONE answer to "is claude running" (F-10)
{
  const B = await load('bus.js');
  B._resetClaude();
  check('bus: nothing reported -> not running', !B.claudeNow().running);
  B.setClaude({ running: true, deckId: 'a' }, 1000);
  check('bus: a report makes it running for that deck', B.claudeNow('a', 1500).running && !B.claudeNow('a', 1500).elsewhere);
  check('bus: for another deck it is "elsewhere", not running', !B.claudeNow('b', 1500).running && B.claudeNow('b', 1500).elsewhere);
  B.setClaude({ running: false }, 900);                      // an OLDER observation arriving late must not win
  check('bus: an older report never overrides a newer one', B.claudeNow('a', 1500).running);
  B.setClaude({ running: false }, 2000);
  check('bus: the freshest report wins', !B.claudeNow('a', 2100).running);
  B.setClaude({ running: true, deckId: 'a' }, 3000);
  check('bus: a "running" nobody refreshes is not believed for ever (stale)', B.claudeNow('a', 3000 + B.STALE_MS + 1).running === false);
  let n = 0; const off = B.on('claude:change', () => { n++; });
  B.setClaude({ running: true, waiting: false }, 4000); B.setClaude({ running: true }, 4100); B.setClaude({ waiting: true }, 4200);
  off();
  check('bus: claude:change fires only when something really changed', n >= 1 && n <= 2, n);
}

// ---------------------------------------------------------------- api.js: reachability, pacing, timeouts (F-19, F-09)
{
  const realFetch = globalThis.fetch;
  const A = await load('api.js');
  const flips = []; const off = A.onReach(ok => flips.push(ok));
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  let r = await A.getJSON('/api/x');
  check('api: a network failure is {ok:false, error:"offline"}', r.ok === false && r.error === 'offline', JSON.stringify(r));
  check('api: one failure does not flip the state', A.reachable() === true);
  await A.getJSON('/api/x');
  check('api: two failures in a row flip it to unreachable (once)', A.reachable() === false && eq(flips, [false]), JSON.stringify(flips));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  await A.getJSON('/api/x');
  check('api: the next success flips it back', A.reachable() === true && eq(flips, [false, true]));
  globalThis.fetch = (u, o) => new Promise((_, rej) => { o.signal.addEventListener('abort', () => rej(new Error('aborted'))); });
  const t0 = Date.now(); r = await A.getJSON('/api/hang', 60);
  check('api: a hung request is cut off by the timeout and reported offline', r.error === 'offline' && Date.now() - t0 < 2000, JSON.stringify(r));
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: 'no-deck' }) });
  r = await A.getJSON('/api/decks/zz');
  check('api: a real 404 is NOT "offline" (the editor must not say the deck was deleted for an unreachable server)', r.status === 404 && r.error === 'no-deck', JSON.stringify(r));
  off(); globalThis.fetch = realFetch;
  check('api: pace grows with idle polls', A.pace(1000, 0) === 1000 && A.pace(1000, 4) > A.pace(1000, 1));
  check('api: pace is capped', A.pace(1000, 50, { max: 3000 }) === 3000);
}

// ---------------------------------------------------------------- plan.js: the doability matrix and the word counter
{
  const P = await load('plan.js');
  check('plan: one main picture per slide, a second main is refused with a reason', /one main picture/.test(P.clashReason('3d', 'chart')));
  check('plan: a companion fits only its own main picture', P.clashReason('3d', 'stats') === '' && /only works with/.test(P.clashReason('chart', 'stats')));
  check('plan: the same main is no clash', P.clashReason('3d', '3d') === '');
  check('plan: words are counted as the checker counts them (numbers are not words)', P.countWords('Results 2025', '34% faster', 'a b') === 4, P.countWords('Results 2025', '34% faster', 'a b'));
  check('plan: five main pictures', eq(P.MAINS.map(m => m.id), ['3d', 'chart', 'diagram', 'photo', 'text']));
}

// ---------------------------------------------------------------- dom.js + a11y.js load, and expose what the pages rely on
{
  const D = await load('dom.js'), Y = await load('a11y.js');
  check('dom: the one DOM helper and the icon set are exported', typeof D.h === 'function' && D.el === D.h && D.ICON && D.ICON.tick && D.ICON.play && D.ICON.folder);
  check('a11y: openDialog / roving / syncTab / announce exported', ['openDialog', 'roving', 'syncTab', 'announce'].every(k => typeof Y[k] === 'function'));
}

// ---------------------------------------------------------------- structure (the survey's X-07, F-06, F-01, F-14)
const src = Object.fromEntries(jsFiles.map(f => [f, read(f)]));
{
  const dupes = jsFiles.filter(f => f !== 'dom.js' && /^(export )?function (h|el)\(tag/m.test(src[f]));
  check('X-07: the DOM helper h()/el() exists once (dom.js), not once per file', dupes.length === 0, dupes.join(', '));
  const hex = /#(f2a65a|c5b3d5|d89cb3|080909|f7f8fa|e4d3e8|c9c3ef|b09fc7|9281b0|5b3fa8)\b/i;
  const bad = jsFiles.filter(f => !['lumi-play.js'].includes(f) && hex.test(src[f])).map(f => f);
  check('X-07: brand colours in JS are the CSS tokens (var(--...)), not hex copies (lumi-play.js draws on a canvas and cannot)', bad.length === 0, bad.join(', '));
  const raw = jsFiles.filter(f => !['api.js', 'update.js'].includes(f) && /['"`]\/api\//.test(src[f]));
  check('X-07: /api/ strings live in api.js only (update.js polls /api/ping on purpose while the server restarts)', raw.length === 0, raw.join(', '));
  const modal = jsFiles.filter(f => /aria-modal/.test(src[f]) && !/openDialog/.test(src[f]));
  check('F-06: every file that declares aria-modal also moves/traps/restores focus (openDialog)', modal.length === 0, modal.join(', '));
  const rootCss = fs.readFileSync(path.join(cssDir, 'app.css'), 'utf8'), themeCss = fs.readFileSync(path.join(cssDir, 'theme.css'), 'utf8');
  check('X-07: one token root (the brand tokens are not declared in two files)', !/--accent:#/.test(themeCss) && /--accent:#/.test(rootCss));
  check('F-14: the chat log is not a live region (it replays history and gets a line every second)', /role: 'log', 'aria-live': 'off'/.test(src['workshop.js']));
  check('F-14: there is a polite announce region and screen changes announce themselves', /id="announce"/.test(fs.readFileSync(path.join(jsDir, '..', 'index.html'), 'utf8')) && /announce\(t\)/.test(src['app.js']));
  check('F-08: browser zoom is multiplied back into the stage scale, and the page can scroll', /zoomLevel\(\)/.test(src['app.js']) && /html\.scrolls\{overflow:auto\}/.test(themeCss));
  check('F-20: scenes: the token is taken before the fade-out is awaited', /const token = \+\+sceneToken;\s*await dropScene\(\);/.test(src['app.js']));
  check('W-03: beforeunload asks only when something would be lost', /const risky = /.test(src['app.js']) && !/e\.preventDefault\(\); e\.returnValue = ''; return ''; \}\);\n/.test(src['app.js'].replace(/\r/g, '')));
  check('F-15: the custom pointer has an opt-out and a forced-colors guard', /setNativePointer/.test(src['cursor.js']) && /forced-colors:active/.test(fs.readFileSync(path.join(cssDir, 'cursor.css'), 'utf8')));
}
// the font floor (F-01, decided): nothing under 12 px; 12 px only for micro-labels (a short, named allow-list); everything you read is 14+
{
  const allowed12 = /(\.up-chip|\.lk-sugg|\.ch-tag|\.pl-chip-q|\.hm-look|\.ph-n|\.dots|\.ws-stage|\.up-|\.us-asof|\.aura-cursor|\.pg-label|\.ch-stepof|-sub|-tag|-n\b)/;
  const small = [];
  for (const f of fs.readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(cssDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const fs_ = /font-size:\s*([0-9.]+)px/.exec(m[2]);
      if (fs_ && +fs_[1] < 14) small.push({ sel: m[1].trim().split(',')[0].slice(0, 60), px: +fs_[1], file: f });
    }
  }
  check('F-01: no text smaller than 12 stage px anywhere', small.every(s => s.px >= 12), JSON.stringify(small.filter(s => s.px < 12)));
  check('F-01: 12 px text (below the 14 px reading size) is limited to micro-labels', small.every(s => allowed12.test(s.sel)), JSON.stringify(small.filter(s => !allowed12.test(s.sel))));
}

console.log(`\n${pass}/${total} frontend checks passed`);
process.exit(pass === total ? 0 : 1);
