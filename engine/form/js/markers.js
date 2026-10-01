// Claude's decision and suggestion markers (contract section 8), shared by the first-build workshop and the editor.
//   [[aura:choice id="q1" question="..." options="A|B|C" multi="no" default="B"]]  -> option buttons + a free-text box
//   [[aura:hint slide=3 text="..."]]                                                -> clickable suggestion chips
// Parsing is lenient (attribute order, extra spaces, a missing multi/default) so a slightly-off marker still works.
// Answers go back as a normal reply, one line per question: "q1: B", multi joined with " | ", then the user's own text.

const CHOICE_LINE = /^\[\[aura:choice\s+(.*?)\s*\]\]$/;
const HINT_LINE = /^\[\[aura:hint\s+slide\s*=\s*"?(\d+)"?\s+text\s*=\s*"([^"]*)"\s*\]\]$/;
const ATTR = /([a-z]+)\s*=\s*"([^"]*)"/g;

export function parseMarkers(text) {
  const choices = [], hints = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if ((m = CHOICE_LINE.exec(line))) {
      const a = {};
      let x; ATTR.lastIndex = 0;
      while ((x = ATTR.exec(m[1]))) a[x[1]] = x[2];
      const options = String(a.options || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 5);
      if (!a.id || !/^[a-z0-9-]+$/i.test(a.id) || !a.question || options.length < 2 || choices.length >= 3) continue;
      if (choices.some(c => c.id === a.id)) continue;
      const multi = /^yes$/i.test(a.multi || '');
      const defs = String(a.default || '').split('|').map(s => s.trim()).filter(d => options.includes(d));
      choices.push({ id: a.id, question: a.question, options, multi, defaults: multi ? defs : defs.slice(0, 1) });
    } else if ((m = HINT_LINE.exec(line))) {
      const slide = parseInt(m[1], 10), t = m[2].trim();
      if (slide > 0 && t) hints.push({ slide, text: t });
    }
  }
  return { choices, hints };
}

// "q1: Bold Blue" lines -> [{id, answer}] (used to show a sent answer in a friendly way)
export function parseAnswer(text) {
  const out = [], rest = [];
  for (const ln of String(text || '').split(/\r?\n/)) {
    const m = /^([a-z0-9-]+):\s*(.+)$/i.exec(ln.trim());
    if (m && out.length < 3 && !rest.length) out.push({ id: m[1], answer: m[2] }); else rest.push(ln);
  }
  return { answers: out, text: rest.join('\n').trim() };
}

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const TICK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// A card with one block per question. onSend(text) is called with the composed answer. Returns
// { el, lock(sentText?), compose(extra) , pending }.
export function choiceCard(choices, { onSend, sfx = () => {} } = {}) {
  const picks = new Map(choices.map(c => [c.id, new Set(c.defaults)]));
  let locked = false;
  const blocks = choices.map(c => {
    const row = h('div', { class: 'ch-opts', role: c.multi ? 'group' : 'radiogroup', 'aria-label': c.question });
    const btns = c.options.map(opt => {
      const b = h('button', { type: 'button', class: 'ch-opt', 'data-nosfx': '', 'data-cursor-label': 'pick' },
        h('span', { class: 'ch-tick' }), h('span', {}, opt));
      b.querySelector('.ch-tick').innerHTML = TICK;
      b.addEventListener('click', () => {
        if (locked) return;
        const set = picks.get(c.id);
        if (c.multi) { if (set.has(opt)) { set.delete(opt); sfx('deselect'); } else { set.add(opt); sfx('select'); } }
        else { set.clear(); set.add(opt); sfx('select'); }
        paint();
      });
      return { b, opt };
    });
    row.append(...btns.map(x => x.b));
    const tag = c.multi ? 'pick any' : 'pick one';
    return { c, btns, el: h('div', { class: 'ch-q' }, h('p', { class: 'ch-qt' }, c.question, h('span', { class: 'ch-tag' }, tag)), row) };
  });
  const free = h('textarea', { class: 'ch-free', rows: '1', maxlength: '4000', placeholder: 'anything else? (optional)', 'aria-label': 'your own words' });
  const send = h('button', { type: 'button', class: 'ch-send', 'data-nosfx': '', 'data-cursor-label': 'send' }, 'send my answers');
  const el = h('div', { class: 'ch-card' }, blocks.map(b => b.el), h('div', { class: 'ch-foot' }, free, send));
  function paint() {
    for (const { c, btns } of blocks) {
      const set = picks.get(c.id);
      for (const { b, opt } of btns) {
        const on = set.has(opt);
        b.classList.toggle('on', on);
        b.setAttribute(c.multi ? 'aria-pressed' : 'aria-checked', on ? 'true' : 'false');
        if (!c.multi) b.setAttribute('role', 'radio');
        b.disabled = locked;
      }
    }
    free.disabled = send.disabled = locked;
    el.classList.toggle('is-locked', locked);
  }
  function compose(extra = '') {
    const lines = [];
    for (const c of choices) {
      const sel = c.options.filter(o => picks.get(c.id).has(o));
      if (sel.length) lines.push(`${c.id}: ${sel.join(' | ')}`);
    }
    const own = [free.value.trim(), String(extra || '').trim()].filter(Boolean).join('\n');
    if (own) lines.push(own);
    return lines.join('\n');
  }
  send.addEventListener('click', () => { if (!locked) { const t = compose(); if (t && onSend) onSend(t); } });
  free.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send.click(); } });
  free.addEventListener('input', () => { free.style.height = 'auto'; free.style.height = Math.min(free.scrollHeight, 80) + 'px'; });
  paint();
  return {
    el, compose, choices,
    get pending() { return !locked; },
    // Lock the card; when the sent text is known, show exactly what was answered.
    lock(sent) {
      if (locked) return;
      if (typeof sent === 'string') {
        const { answers } = parseAnswer(sent);
        for (const a of answers) {
          const c = choices.find(x => x.id === a.id);
          if (c) picks.set(c.id, new Set(a.answer.split('|').map(s => s.trim()).filter(o => c.options.includes(o))));
        }
      }
      locked = true; paint();
    },
    setEnabled(on) { if (!locked) { free.disabled = send.disabled = !on; blocks.forEach(b => b.btns.forEach(x => { x.b.disabled = !on; })); } },
  };
}

export function hintChip(hint, onPick, { showSlide = true } = {}) {
  const b = h('button', { type: 'button', class: 'hint-chip', 'data-cursor-label': 'use it', title: hint.text },
    showSlide ? h('span', { class: 'hint-n' }, String(hint.slide)) : null, h('span', { class: 'hint-t' }, hint.text));
  b.addEventListener('click', () => onPick(hint));
  return b;
}

// Gentle defaults for a slide when Claude has not suggested anything for it yet.
export const GENERIC_HINTS = ['make the title shorter', 'make this slide simpler', 'add a picture or diagram', 'add a small animation', 'use bigger text'];
