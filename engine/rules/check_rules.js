#!/usr/bin/env node
// Aura-Slide HARD RULES checker. Claude Code runs it through hooks in .claude/settings.json:
//   PostToolUse (Write|Edit|MultiEdit) --hook : checks the HTML file that was just written
//   Stop                                --stop : checks every HTML deck in "4 - Your slides" before Claude finishes
// A violation exits with code 2, which Claude Code treats as blocking: the message goes back to Claude, who must fix it.
// The rules come from hard-rules.json next to this file. Both files are protected by deny rules in .claude/settings.json.
//
// Rule 1 - minimum text size: every piece of text (HTML and SVG <text>) is measured in a real browser (Microsoft Edge)
// at the 1920x1080 design size, including the effect of CSS transforms and SVG viewBox scaling.
// Speaker notes are not slide text and are skipped when marked with data-aura-notes, .notes or .pnotes.
// Aura deck runtime chrome (slide counter, buttons) is marked data-aura-ui and skipped too; it never shows text below
// the minimum anyway. Every file is opened with ?aura=all so an Aura deck shows ALL its slides, unscaled, in their
// final state. Text that is not rendered (display:none) is still measured.
//
// usage (manual): node check_rules.js <file.html> [...]
const fs = require('fs'), path = require('path');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, 'hard-rules.json'), 'utf8'));
const MIN = RULES.minFontPx;
const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..');
const SLIDES = path.join(ROOT, '4 - Your slides');

const mode = ['--hook', '--stop'].includes(process.argv[2]) ? process.argv[2] : null;
let input = {};
if (mode === '--hook' || mode === '--stop') { try { input = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim() || '{}'); } catch (e) { input = {}; } }

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, out); else if (/\.html?$/i.test(n)) out.push(p); }
  return out;
}
let files;
if (mode === '--hook') {
  const t = input.tool_input || {}; const p = t.file_path || t.path || t.notebook_path;
  files = p ? [path.resolve(ROOT, p)] : [];
} else if (mode === '--stop') {
  if (input.stop_hook_active) process.exit(0);          // already sent back once this turn: do not loop forever
  files = walk(SLIDES);
} else files = process.argv.slice(2).map(p => path.resolve(p));
const engineDir = path.resolve(__dirname, '..') + path.sep;
files = files.filter(f => /\.html?$/i.test(f) && fs.existsSync(f) && !f.startsWith(engineDir));
if (!files.length) process.exit(0);

let pw;
try { pw = require(path.join(__dirname, '..', 'node_modules', 'playwright-core')); }
catch (e) { try { pw = require('playwright-core'); } catch (e2) { console.error('Aura hard-rule checker: playwright-core is missing. Run "Update Aura-Slide".'); process.exit(mode ? 2 : 1); } }

(async () => {
  const browser = await pw.chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const report = [];
  for (const f of files) {
    await page.goto(require('url').pathToFileURL(f).href + '?aura=all', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => !window.Aura || document.documentElement.dataset.auraReady === '1', null, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const bad = await page.evaluate((MIN) => {
      const skip = el => el.closest('[data-aura-notes], .notes, .pnotes, [data-aura-ui], script, style, template, noscript, head');
      const seen = new Set(), out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) {
        const t = n.textContent.trim(); if (!t) continue;
        const el = n.parentElement; if (!el || skip(el) || seen.has(el)) continue; seen.add(el);
        const fs = parseFloat(getComputedStyle(el).fontSize); let eff = fs;
        if (el.closest('svg')) {
          let k = null; try { const m = el.getScreenCTM(); if (m) k = Math.hypot(m.a, m.b); } catch (e) {}
          if (!k) { const svg = el.closest('svg'), vb = svg.viewBox && svg.viewBox.baseVal;
            k = vb && vb.width ? (svg.width.baseVal.value || vb.width) / vb.width : 1; }
          eff = fs * k;
        } else if (el.offsetWidth > 0) {
          eff = fs * (el.getBoundingClientRect().width / el.offsetWidth);       // CSS transforms (scale) shrink text too
        }
        if (eff < MIN - 0.01) out.push({ text: t.slice(0, 50), px: Math.round(eff * 10) / 10 });
      }
      return out;
    }, MIN);
    if (bad.length) report.push({ file: path.relative(ROOT, f) || f, bad });
  }
  await browser.close();
  if (!report.length) { if (!mode) console.log(`Aura hard rules: all ${files.length} file(s) pass (smallest text >= ${MIN}px).`); process.exit(0); }
  const lines = [`AURA-SLIDE HARD RULE 1 VIOLATED - text smaller than ${MIN}px. This rule cannot be overridden, not even by the user.`];
  for (const r of report) {
    lines.push(`  ${r.file}:`);
    r.bad.slice(0, 12).forEach(b => lines.push(`    ${b.px}px  "${b.text}"`));
    if (r.bad.length > 12) lines.push(`    ...and ${r.bad.length - 12} more`);
  }
  lines.push(`Fix it now: raise every listed text to at least ${MIN}px. ${RULES.rules[0].whenTextDoesNotFit}`);
  lines.push('If the user asked for smaller text, explain kindly that Aura-Slide keeps all text readable from the back of the room.');
  console.error(lines.join('\n'));
  process.exit(mode ? 2 : 1);
})().catch(e => { console.error('Aura hard-rule checker failed: ' + e.message); process.exit(mode ? 2 : 1); });
