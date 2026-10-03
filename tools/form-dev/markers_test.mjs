// Runs the browser marker parser (engine/form/js/markers.js) against the shared fixtures and prints one JSON object:
//   { spec, results: [{ name, ok, detail }] }
// tools/form-dev/test_instructions.py calls this and also compares `spec` with engine/rules/markers.json.
//   node tools/form-dev/markers_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './fe_load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const M = await load('markers.js');         // markers.js and what it imports are loaded from a temp copy as ES modules

const cases = JSON.parse(fs.readFileSync(path.join(here, 'marker_cases.json'), 'utf8')).cases;
const results = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rec = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

for (const c of cases) {
  const r = M.scanMarkers(c.text);
  const got = r.markers.map(m => { const e = { name: m.name, attrs: m.attrs, line: m.line }; if (m.choice) e.choice = m.choice; return e; });
  const gotP = r.problems.map(p => ({ line: p.line, reason: p.reason, marker: p.marker }));
  rec('markers: ' + c.name, eq(got, c.markers), JSON.stringify(got) + ' != ' + JSON.stringify(c.markers));
  rec('problems: ' + c.name, eq(gotP, c.problems), JSON.stringify(gotP) + ' != ' + JSON.stringify(c.problems));
}

// the cards' view of the same lines (parseMarkers): variants, defaults, no question cap, hints in any order
const many = Array.from({ length: 12 }, (_, i) => `[[aura:choice id="q${i + 1}" question="Question ${i + 1}?" options="A|B"]]`).join('\n');
rec('no question is dropped (12 arrive, 12 shown)', M.parseMarkers(many).choices.length === 12);
const pv = M.parseMarkers([
  '[[aura:choice id=q1 slide=3 question="Which?" options="A|B|C" default=B]]',
  '[[aura:choice id="q2" when="q1=2" question="Words?" options="x|y" multi="yes"]]',
  '[[aura:choice id="q2" when="q1=3" question="Words?" options="z|w"]]',
  '[[aura:hint text="Shorter" slide=2]]',
].join('\n'));
rec('parseMarkers: bare-value choice becomes a card question', pv.choices[0] && pv.choices[0].id === 'q1' && pv.choices[0].slide === '3' && eq(pv.choices[0].defaults, ['B']));
rec('parseMarkers: variants keep their own key', eq(pv.choices.map(c => c.key), ['q1', 'q2@q1=2', 'q2@q1=3']));
rec('parseMarkers: a missing default pre-selects the first option', eq(pv.choices[2].defaults, ['z']) && eq(pv.choices[1].defaults, ['x']));
rec('parseMarkers: the when condition is parsed', eq(pv.choices[1].conds, [{ id: 'q1', vals: ['2'] }]));
rec('parseMarkers: a hint in any attribute order is kept', eq(pv.hints, [{ slide: 2, text: 'Shorter' }]));
rec('parseMarkers: malformed lines are reported, not dropped silently', M.parseMarkers('see [[aura:ask]] now\n[[aura:hint slide=1]]').problems.length === 2);
rec('parseAnswer: note lines are the person\'s own words', (() => { const a = M.parseAnswer('q1: B\nq2: A | C\nnote: and quickly'); return a.answers.length === 2 && a.text === 'and quickly'; })());
rec('hasMarker: only whole lines count', M.hasMarker('x\n[[aura:ask]]', 'ask') && !M.hasMarker('x [[aura:ask]]', 'ask'));

process.stdout.write(JSON.stringify({ spec: M.MARKER_SPEC, results }));
