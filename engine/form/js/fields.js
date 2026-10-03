// Field renderers for the right column. renderFields(host, specs, ctx) draws a screen's fields and returns
// { items, refresh(), focusFirst(), validate() -> null | {el, msg}, destroy() }.
// ctx (from app.js): get(key), set(key, value, {touch}), isTouched(key), sfx(name), typed(el), files() -> Promise,
// reduced() -> bool. Every control is a real button / input, so keyboard and screen readers work everywhere.
import { AMOUNT_LABELS, amountLabel } from './steps.js';

// ---------------------------------------------------------------- small drawn icons (flat palette fills + ink lines)
const svg = inner => `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
export const ICONS = {
  cap: svg('<path d="M11 19v7c0 2.6 4 4.6 9 4.6s9-2 9-4.6v-7" fill="var(--fur1)"/><path d="M4 15 20 8l16 7-16 7z" fill="var(--fur3)"/>' +
    '<path d="M33 16.5v8"/><circle cx="33" cy="27" r="2.2" fill="var(--orange)"/>'),
  progress: svg('<circle cx="20" cy="20" r="13" fill="var(--fur1)"/><path d="M20 7a13 13 0 0 1 0 26z" fill="var(--pink)"/>' +
    '<circle cx="20" cy="20" r="13"/><path d="M20 12v8l5 3"/>'),
  rocket: svg('<path d="M14.5 22 9 28l6.5-.8M25.5 22l5.5 6-6.5-.8" fill="var(--pink)"/><path d="M20 5c6.2 4 8.3 11 6 20H14c-2.3-9-.2-16 6-20z" fill="var(--fur3)"/>' +
    '<circle cx="20" cy="15" r="3" fill="var(--pill)"/><path d="M17 29c0 3.5 3 6.5 3 6.5s3-3 3-6.5" fill="var(--orange)"/>'),
  board: svg('<rect x="5" y="7" width="30" height="20" rx="3" fill="var(--fur3)"/><path d="M10 13.5h13M10 18.5h8M13 27l-3 7M27 27l3 7"/>' +
    '<circle cx="29" cy="20" r="2.2" fill="var(--orange)"/>'),
  chat: svg('<path d="M28 17h5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-1v3.5L28 29h-5a3 3 0 0 1-3-3" fill="var(--pink)"/>' +
    '<path d="M6 8h17a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H13l-5 4v-4H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" fill="var(--fur1)"/><path d="M9 13.5h11M9 17.5h7"/>'),
  mic: svg('<rect x="15" y="4" width="10" height="17" rx="5" fill="var(--fur3)"/><path d="M10 17a10 10 0 0 0 20 0M20 27v7M14 34h12M18 9.5h4M18 13.5h4"/>' +
    '<circle cx="34" cy="8" r="1.6" fill="var(--orange)" stroke="none"/><circle cx="6" cy="10" r="1.3" fill="var(--pink)" stroke="none"/>'),
  bulb: svg('<path d="M20 6a10 10 0 0 0-6 18c1 1 2 2.4 2 4h8c0-1.6 1-3 2-4A10 10 0 0 0 20 6z" fill="var(--fur1)"/><path d="M16 32h8M17.5 35.5h5"/>' +
    '<path d="M17 20l3 3 3-3" /><path d="M3.5 15H6M34 15h2.5M7.5 4.5l2 2M32.5 4.5l-2 2" stroke="var(--orange)"/>'),
  book: svg('<path d="M20 10c-4-3-9-3-15-2v22c6-1 11-1 15 2 4-3 9-3 15-2V8c-6-1-11-1-15 2z" fill="var(--fur1)"/><path d="M20 10v22" />' +
    '<path d="M9 14c2.5-.4 5-.2 7 .8M9 19c2.5-.4 5-.2 7 .8M24 14.8c2-1 4.5-1.2 7-.8" /><path d="M24 19.8c2-1 4.5-1.2 7-.8" stroke="#b77292"/>'),
  sparkle: svg('<path d="M17 6c1 7 3 9 10 10-7 1-9 3-10 10-1-7-3-9-10-10 7-1 9-3 10-10z" fill="var(--pink)"/>' +
    '<path d="M30 24c.5 3.3 1.4 4.2 4.7 4.7-3.3.5-4.2 1.4-4.7 4.7-.5-3.3-1.4-4.2-4.7-4.7 3.3-.5 4.2-1.4 4.7-4.7z" fill="var(--orange)"/>'),
  flag: svg('<path d="M11 7h20l-4.5 6.5L31 20H11z" fill="var(--pink)"/><path d="M11 35V5"/><path d="M16 13.5l2.5 2.5 5-5" />' +
    '<path d="M6 35h11"/>'),
  loop: svg('<circle cx="20" cy="20" r="8.5" fill="var(--fur1)" stroke="none"/><path d="M31.5 17A12 12 0 0 0 10 12.5M8.5 23A12 12 0 0 0 30 27.5"/>' +
    '<path d="M10 6.5v6h6M30 33.5v-6h-6"/><circle cx="20" cy="20" r="2.4" fill="var(--orange)"/>'),
  cube: svg('<path d="M20 5l13 7v15l-13 8-13-8V12z" fill="var(--fur3)"/><path d="M20 5l13 7-13 7-13-7z" fill="var(--fur1)"/>' +
    '<path d="M20 19v16M7 12l13 7 13-7"/>'),
  wave: svg('<path d="M4 25c3.5-8 7.5-8 11 0s7.5 8 11 0 6-8 10-4" /><circle cx="15" cy="25" r="3.2" fill="var(--pink)"/>' +
    '<path d="M6 11h7M8 15.5h4" stroke="#b77292"/><circle cx="30" cy="10" r="4" fill="var(--fur1)"/>'),
  wand: svg('<path d="M7 33 25 15" stroke-width="3.2"/><path d="M25 15l2.5-2.5" stroke="var(--orange)" stroke-width="3.2"/>' +
    '<path d="M29 4c.7 3.6 1.6 4.6 5 5.3-3.4.7-4.3 1.7-5 5.3-.7-3.6-1.6-4.6-5-5.3 3.4-.7 4.3-1.7 5-5.3z" fill="var(--pink)"/>' +
    '<circle cx="12" cy="10" r="1.6" fill="var(--fur3)" stroke="none"/><circle cx="33" cy="25" r="1.4" fill="var(--fur3)" stroke="none"/>'),
};
const TICK = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" ' +
  'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------------------------------------------------------------- helpers
import { h as el } from './dom.js';
const isEmpty = v => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let uid = 0;

function pop(node, ctx) {
  if (ctx.reduced() || !node.animate) return;
  node.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }],
    { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
}

// ---------------------------------------------------------------- public entry
export function renderFields(host, specs, ctx) {
  const items = specs.map(spec => makeField(spec, ctx));
  items.forEach(it => host.append(it.wrap));
  const api = {
    items,
    refresh(instant = false) {
      for (const it of items) {
        const show = !it.spec.when || !!it.spec.when(ctx.get);
        if (show !== it.visible) setVisible(it, show, instant || ctx.reduced());
        it.syncTag();
        it.sync && it.sync();
      }
    },
    focusFirst() {
      const it = items.find(i => i.visible);
      if (it && it.focus) it.focus();
    },
    validate() {
      for (const it of items) {
        if (!it.visible || !it.validate) continue;
        const r = it.validate();
        if (r) return { ...r, field: it.wrap };
      }
      return null;
    },
    destroy() { items.forEach(it => it.destroy && it.destroy()); },
  };
  items.forEach(it => { it.visible = true; });
  api.refresh(true);
  return api;
}

function setVisible(it, show, instant) {
  it.visible = show;
  const w = it.wrap;
  w.getAnimations().forEach(a => a.cancel());
  if (instant) { w.hidden = !show; return; }
  if (show) {
    w.hidden = false;
    const h = w.offsetHeight;
    w.animate([{ height: '0px', opacity: 0, marginTop: '-22px' }, { height: h + 'px', opacity: 1, marginTop: '0px' }],
      { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
  } else {
    const h = w.offsetHeight;
    const a = w.animate([{ height: h + 'px', opacity: 1, marginTop: '0px' }, { height: '0px', opacity: 0, marginTop: '-22px' }],
      { duration: 260, easing: 'ease-in' });
    a.onfinish = () => { if (!it.visible) w.hidden = true; };
  }
}

function makeField(spec, ctx) {
  const id = 'f' + (++uid);
  const wrap = el('div', { class: `field f-${spec.type}`, 'data-key': spec.key });
  const tag = spec.default !== undefined ? el('span', { class: 'sugg', 'aria-hidden': 'true' }, 'suggested') : null;
  const count = el('span', { class: 'f-count' });
  const labelTag = ['text', 'textarea', 'date', 'select'].includes(spec.type) ? 'label' : 'div';
  const head = el('div', { class: 'f-head' },
    el(labelTag, { class: 'f-label', id: id + '-l', for: labelTag === 'label' ? id : null }, spec.label),
    spec.required ? el('span', { class: 'f-req', title: 'needed' }) : null, tag, count);
  const R = RENDER[spec.type] || RENDER.text;
  const ctl = R(spec, ctx, { id, labelId: id + '-l', wrap, count });
  if (spec.type === 'toggle') {
    if (tag) ctl.tagHost.append(tag);
  } else wrap.append(head);
  wrap.append(ctl.node);
  if (spec.hint) wrap.append(el('p', { class: 'f-hint' }, spec.hint));
  const item = {
    spec, wrap, visible: true, ...ctl,
    syncTag() {
      if (!tag) return;
      const on = !ctx.isTouched(spec.key) && same(ctx.get(spec.key), spec.default);
      tag.classList.toggle('on', on);
    },
  };
  return item;
}

// ---------------------------------------------------------------- renderers
const RENDER = {
  choice: choiceField, seg: choiceField, multi: multiField, text: textField, textarea: textField, stepper: stepperField,
  date: dateField, toggle: toggleField, slider: sliderField, select: selectField, repeater: repeaterField,
};

function choiceField(spec, ctx, { labelId }) {
  const seg = spec.type === 'seg';
  const cols = spec.cols || 3;
  const group = el('div', { class: seg ? `segs${spec.stack ? ' stack' : ''}` : `cards cols-${cols}`, role: 'radiogroup', 'aria-labelledby': labelId });
  const btns = spec.options.map(o => el('button', { type: 'button', class: `choice ${seg ? 'seg' : 'card'}`, role: 'radio', 'data-value': o.value, 'data-nosfx': '' },
    seg ? el('span', { class: 'dot' }) : el('span', { class: 'c-icon', html: ICONS[o.icon] || '' }),
    el('span', { class: 'c-label' }, o.label)));
  group.append(...btns);
  const paint = () => {
    const v = ctx.get(spec.key);
    const anyOn = btns.some(b => b.dataset.value === v);
    btns.forEach((b, i) => {
      const on = b.dataset.value === v;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on || (!anyOn && i === 0) ? 0 : -1;
    });
  };
  const pick = b => {
    if (ctx.get(spec.key) !== b.dataset.value) { ctx.set(spec.key, b.dataset.value); ctx.sfx('select'); }
    else ctx.sfx('tick');
    pop(b, ctx); paint();
  };
  group.addEventListener('click', e => { const b = e.target.closest('.choice'); if (b) pick(b); });
  group.addEventListener('keydown', e => {
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const stepH = seg && spec.stack ? 0 : 1, stepV = seg ? 1 : cols;
    const d = { ArrowRight: stepH || 1, ArrowLeft: -(stepH || 1), ArrowDown: stepV, ArrowUp: -stepV }[e.key];
    if (!d) return;
    e.preventDefault();
    const j = clamp(i + d, 0, btns.length - 1);
    if (j !== i) { btns[j].focus(); pick(btns[j]); }
  });
  paint();
  return {
    node: group, sync: paint,
    focus() { (btns.find(b => b.tabIndex === 0) || btns[0]).focus({ preventScroll: true }); },
    validate() { return spec.required && isEmpty(ctx.get(spec.key)) ? { el: btns[0], msg: spec.msg } : null; },
  };
}

function multiField(spec, ctx, { labelId }) {
  const group = el('div', { class: 'pills', role: 'group', 'aria-labelledby': labelId });
  const btns = spec.options.map(o => el('button', { type: 'button', class: 'choice pill', 'data-value': o.value, 'aria-pressed': 'false', 'data-nosfx': '' },
    el('span', { class: 'tick', html: TICK }), el('span', { class: 'c-label' }, o.label)));
  group.append(...btns);
  const paint = () => {
    const v = ctx.get(spec.key) || [];
    btns.forEach(b => b.setAttribute('aria-pressed', v.includes(b.dataset.value) ? 'true' : 'false'));
  };
  group.addEventListener('click', e => {
    const b = e.target.closest('.choice');
    if (!b) return;
    const cur = new Set(ctx.get(spec.key) || []);
    const on = !cur.has(b.dataset.value);
    on ? cur.add(b.dataset.value) : cur.delete(b.dataset.value);
    ctx.set(spec.key, spec.options.map(o => o.value).filter(v => cur.has(v)).concat([...cur].filter(v => !spec.options.some(o => o.value === v))));
    ctx.sfx(on ? 'select' : 'deselect');
    pop(b, ctx); paint();
  });
  paint();
  return {
    node: group, sync: paint,
    focus() { btns[0].focus({ preventScroll: true }); },
    validate() { return spec.required && isEmpty(ctx.get(spec.key)) ? { el: btns[0], msg: spec.msg } : null; },
  };
}

function textField(spec, ctx, { id }) {
  const area = spec.type === 'textarea' || spec.multiline;
  const inp = area
    ? el('textarea', { id, class: 'inp', rows: spec.rows || spec.multiline || 4, placeholder: spec.placeholder || '', spellcheck: 'true',
      'data-enter-next': spec.multiline ? '' : null, maxlength: 4000 })
    : el('input', { id, type: 'text', class: 'inp', placeholder: spec.placeholder || '', autocomplete: 'off', maxlength: 300 });
  inp.value = ctx.get(spec.key) || '';
  inp.addEventListener('input', () => {
    if (spec.multiline && /\n/.test(inp.value)) inp.value = inp.value.replace(/\s*\n+\s*/g, ' ');
    ctx.set(spec.key, inp.value);
    ctx.typed(inp);
  });
  const node = el('div', { class: 'inp-wrap' }, inp);
  return {
    node,
    sync() { if (document.activeElement !== inp && inp.value !== (ctx.get(spec.key) || '')) inp.value = ctx.get(spec.key) || ''; },
    focus() { inp.focus({ preventScroll: true }); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} },
    validate() { return spec.required && isEmpty(inp.value) ? { el: inp, msg: spec.msg } : null; },
  };
}

function dateField(spec, ctx, { id }) {
  const inp = el('input', { id, type: 'date', class: 'inp', min: '2000-01-01', max: '2100-12-31' });
  inp.value = ctx.get(spec.key) || '';
  const set = () => { ctx.set(spec.key, inp.value); ctx.sfx('tick'); };
  inp.addEventListener('change', set);
  inp.addEventListener('input', () => ctx.typed(inp, true));
  return {
    node: el('div', { class: 'inp-wrap' }, inp),
    sync() { if (document.activeElement !== inp) inp.value = ctx.get(spec.key) || ''; },
    focus() { inp.focus({ preventScroll: true }); },
    validate() { return spec.required && !inp.value ? { el: inp, msg: spec.msg } : null; },
  };
}

function stepperField(spec, ctx, { id, labelId }) {
  const min = spec.min ?? 0, max = spec.max ?? 999;
  const dec = el('button', { type: 'button', class: 'step-btn', 'aria-label': 'less', 'data-nosfx': '', html: '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M5 10h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' });
  const inc = el('button', { type: 'button', class: 'step-btn', 'aria-label': 'more', 'data-nosfx': '', html: '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M5 10h10M10 5v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' });
  const inp = el('input', { id, type: 'text', inputmode: 'numeric', class: 'inp step-inp', 'aria-labelledby': labelId, placeholder: spec.emptyLabel || '', autocomplete: 'off', maxlength: 3 });
  const unit = el('span', { class: 'step-unit' }, spec.unit || '');
  const mid = el('div', { class: 'step-mid' }, inp, unit);
  const node = el('div', { class: 'stepper' }, dec, mid, inc);
  const val = () => { const v = ctx.get(spec.key); return v === '' || v == null ? '' : +v; };
  const paint = () => {
    const v = val();
    if (document.activeElement !== inp) inp.value = v === '' ? '' : String(v);
    node.classList.toggle('empty', v === '');
    dec.disabled = v === '' || (!spec.allowEmpty && v <= min);
    inc.disabled = v !== '' && v >= max;
  };
  const bump = d => {
    let v = val();
    if (v === '') { if (d < 0) return; v = spec.startAt ? spec.startAt(ctx.get) : (spec.default ?? min); }
    else if (spec.allowEmpty && d < 0 && v <= min) v = '';
    else v = clamp(v + d, min, max);
    if (v === val()) return;
    ctx.set(spec.key, v); ctx.sfx('tick'); paint();
    if (!ctx.reduced()) mid.animate([{ transform: `translateY(${d > 0 ? 5 : -5}px)`, opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  };
  let hold = 0, rep = 0;
  const stop = () => { clearTimeout(hold); clearInterval(rep); };
  for (const [b, d] of [[dec, -1], [inc, 1]]) {
    b.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      bump(d); stop();
      hold = setTimeout(() => { rep = setInterval(() => bump(d), 75); }, 420);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
    b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); bump(d); } });
  }
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '');
    if (inp.value === '') { if (spec.allowEmpty || spec.required) ctx.set(spec.key, ''); }
    else ctx.set(spec.key, clamp(+inp.value, min, max));
    node.classList.toggle('empty', inp.value === '');
    ctx.typed(inp);
  });
  inp.addEventListener('blur', () => { inp.value = ''; paint(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); bump(e.key === 'ArrowUp' ? 1 : -1); inp.value = val() === '' ? '' : String(val()); }
  });
  paint();
  return {
    node, sync: paint, destroy: stop,
    focus() { inp.focus({ preventScroll: true }); inp.select(); },
    validate() { return spec.required && val() === '' ? { el: inp, msg: spec.msg } : null; },
  };
}

function toggleField(spec, ctx) {
  const title = el('span', { class: 'tog-title' }, spec.label);
  const btn = el('button', { type: 'button', class: 'choice tog', role: 'switch', 'aria-checked': 'false', 'data-nosfx': '' },
    el('span', { class: 'c-icon', html: ICONS[spec.icon] || '' }),
    el('span', { class: 'tog-text' }, title, spec.sub ? el('span', { class: 'tog-sub' }, spec.sub) : null),
    el('span', { class: 'switch', 'aria-hidden': 'true' }, el('span', { class: 'knob' })));
  const isOn = () => ctx.get(spec.key) === spec.on;
  const paint = () => btn.setAttribute('aria-checked', isOn() ? 'true' : 'false');
  btn.addEventListener('click', () => { ctx.set(spec.key, isOn() ? spec.off : spec.on); ctx.sfx('toggle'); paint(); pop(btn.querySelector('.c-icon'), ctx); });
  paint();
  return { node: btn, tagHost: btn, sync: paint, focus() { btn.focus({ preventScroll: true }); }, validate: () => null };
}

function sliderField(spec, ctx, { labelId }) {
  const min = spec.min ?? 0, max = spec.max ?? 100;
  const word = el('span', { class: 'sl-word' });
  const num = el('span', { class: 'sl-num' });
  const range = el('input', { type: 'range', class: 'sl-range', min, max, step: 1, 'aria-labelledby': labelId, 'data-nosfx': '' });
  const track = el('div', { class: 'sl-track' }, el('div', { class: 'sl-fill' }), range);
  const ticks = el('div', { class: 'sl-ticks' }, AMOUNT_LABELS.map(([hi, name], i) => {
    const lo = i ? AMOUNT_LABELS[i - 1][0] + 1 : min;
    return el('button', { type: 'button', class: 'sl-tick', 'data-v': Math.round((lo + hi) / 2), 'data-nosfx': '' }, name.toLowerCase());
  }));
  const node = el('div', { class: 'slider' }, el('div', { class: 'sl-value', 'aria-live': 'polite' }, word, num), track, ticks);
  let lastWord = '', lastTick = 0;
  const paint = () => {
    const v = ctx.get(spec.key) ?? spec.default ?? min;
    if (+range.value !== +v) range.value = v;
    node.style.setProperty('--p', (v - min) / (max - min));
    const w = amountLabel(v).toLowerCase();
    word.textContent = w; num.textContent = v;
    [...ticks.children].forEach(b => b.classList.toggle('on', b.textContent === w));
    if (lastWord && w !== lastWord && !ctx.reduced()) word.animate([{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    lastWord = w;
  };
  const setV = v => {
    const before = amountLabel(ctx.get(spec.key));
    ctx.set(spec.key, v); paint();
    const now = performance.now();
    if (amountLabel(v) !== before) ctx.sfx('select');
    else if (now - lastTick > 70) { ctx.sfx('tick'); lastTick = now; }
  };
  range.addEventListener('input', () => setV(+range.value));
  ticks.addEventListener('click', e => { const b = e.target.closest('.sl-tick'); if (b) { setV(+b.dataset.v); pop(b, ctx); } });
  paint();
  return { node, sync: paint, focus() { range.focus({ preventScroll: true }); }, validate: () => null };
}

function fileOptions(groups) {
  const opts = [['', 'no file']];
  (Array.isArray(groups) ? groups : []).forEach(g => (g.files || []).forEach(f => opts.push([f, f.split('/').pop()])));
  return opts;
}

function selectField(spec, ctx, { id }) {
  const sel = el('select', { id, class: 'inp sel' }, spec.options.map(o => el('option', { value: o.value }, o.label)));
  sel.value = ctx.get(spec.key) || '';
  sel.addEventListener('change', () => { ctx.set(spec.key, sel.value); ctx.sfx('select'); });
  return {
    node: el('div', { class: 'inp-wrap' }, sel),
    sync() { if (document.activeElement !== sel) sel.value = ctx.get(spec.key) || ''; },
    focus() { sel.focus({ preventScroll: true }); },
    validate() { return spec.required && !sel.value ? { el: sel, msg: spec.msg } : null; },
  };
}

function repeaterField(spec, ctx, { labelId, count }) {
  const per = spec.perPage || 5;
  const blank = () => Object.fromEntries(spec.cols.map(c => [c.key, '']));
  let page = 0, fileOpts = [['', 'no file']];
  const rows = () => {
    const v = ctx.get(spec.key);
    return Array.isArray(v) ? v.map(r => ({ ...blank(), ...r })) : [];
  };
  const list = el('div', { class: `rep-list ${spec.compact ? 'compact' : ''}`, role: 'list', 'aria-labelledby': labelId });
  const add = el('button', { type: 'button', class: 'rep-add', 'data-nosfx': '' },
    el('span', { class: 'plus', html: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M5 10h10M10 5v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' }),
    el('span', {}, 'add ' + spec.item));
  const prev = el('button', { type: 'button', class: 'pg', 'aria-label': 'previous page', 'data-nosfx': '', html: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
  const next = el('button', { type: 'button', class: 'pg', 'aria-label': 'next page', 'data-nosfx': '', html: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
  const pgLabel = el('span', { class: 'pg-label' });
  const pager = el('div', { class: 'pager' }, prev, pgLabel, next);
  const node = el('div', { class: 'repeater' }, list, el('div', { class: 'rep-foot' }, add, pager));

  const write = arr => ctx.set(spec.key, arr);
  const ensure = () => {
    const r = rows();
    if (r.length < (spec.min || 0)) { while (r.length < spec.min) r.push(blank()); ctx.set(spec.key, r, { touch: false }); }
    return r;
  };
  const pages = n => Math.max(1, Math.ceil(n / per));

  function rowEl(r, i) {
    const inputs = spec.cols.map(c => {
      let inp;
      if (c.type === 'file') {
        inp = el('select', { class: 'inp sm sel', 'aria-label': `${c.label} for ${spec.item} ${i + 1}` }, fileOpts.map(([v, t]) => el('option', { value: v }, t)));
        if (r[c.key] && !fileOpts.some(([v]) => v === r[c.key])) inp.append(el('option', { value: r[c.key] }, r[c.key].split('/').pop()));
        inp.value = r[c.key] || '';
        inp.addEventListener('change', () => { const a = rows(); a[i][c.key] = inp.value; write(a); ctx.sfx('select'); });
      } else {
        inp = el('input', { type: 'text', class: 'inp sm', placeholder: c.placeholder || c.label, 'aria-label': `${c.label} for ${spec.item} ${i + 1}`, autocomplete: 'off', maxlength: 200 });
        inp.value = r[c.key] || '';
        inp.addEventListener('input', () => { const a = rows(); a[i][c.key] = inp.value; write(a); ctx.typed(inp); });
      }
      inp.dataset.col = c.key;
      return inp;
    });
    const rm = el('button', { type: 'button', class: 'rep-rm', 'aria-label': `remove ${spec.item} ${i + 1}`, 'data-nosfx': '',
      html: '<svg viewBox="0 0 20 20" width="16" height="16"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' });
    rm.addEventListener('click', () => remove(i, row));
    const row = el('div', { class: `rep-row l-${spec.layout || 'pair'}`, role: 'listitem', 'data-i': i },
      el('span', { class: 'rep-num', 'aria-hidden': 'true' }, String(i + 1)), ...inputs, rm);
    return row;
  }

  function render(focusIndex = -1, dir = 0) {
    const r = ensure();
    page = clamp(page, 0, pages(r.length) - 1);
    const from = page * per;
    list.replaceChildren(...r.slice(from, from + per).map((x, k) => rowEl(x, from + k)));
    const many = r.length > per;
    pager.hidden = !many;
    pgLabel.textContent = `${page + 1} / ${pages(r.length)}`;
    prev.disabled = page === 0; next.disabled = page >= pages(r.length) - 1;
    add.hidden = r.length >= spec.max;
    count.textContent = `${r.length} of ${spec.max}`;
    if (dir && !ctx.reduced()) list.animate([{ transform: `translateX(${dir * 26}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    if (focusIndex >= 0) {
      const row = list.querySelector(`[data-i="${focusIndex}"]`);
      const f = row && row.querySelector('input,select');
      if (f) f.focus({ preventScroll: true });
      return row;
    }
    return null;
  }

  function remove(i, row) {
    const a = rows();
    const after = () => {
      if (a.length > (spec.min || 0)) a.splice(i, 1); else a[i] = blank();
      write(a); render(Math.min(i, a.length - 1));
    };
    ctx.sfx('deselect');
    if (ctx.reduced()) return after();
    row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(18px) scale(.97)' }], { duration: 200, easing: 'ease-in' }).onfinish = after;
  }

  add.addEventListener('click', () => {
    const a = rows();
    if (a.length >= spec.max) return;
    a.push(blank()); write(a);
    page = pages(a.length) - 1;
    const row = render(a.length - 1);
    ctx.sfx('pop');
    if (row && !ctx.reduced()) row.animate([{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
  });
  prev.addEventListener('click', () => { if (page > 0) { page--; render(-1, -1); ctx.sfx('slide'); } });
  next.addEventListener('click', () => { if (page < pages(rows().length) - 1) { page++; render(-1, 1); ctx.sfx('slide'); } });

  if (spec.cols.some(c => c.type === 'file') && ctx.files) {
    ctx.files().then(g => { fileOpts = fileOptions(g); if (node.isConnected) render(); }).catch(() => {});
  }
  render();

  return {
    node,
    sync() {
      // Re-render only when the data changed from outside (e.g. the field just became visible).
      const n = rows().length;
      if (!list.children.length || (n && n !== +count.textContent.split(' ')[0])) render();
    },
    focus() { const f = list.querySelector('input,select'); if (f) f.focus({ preventScroll: true }); },
    validate() {
      const a = rows(), req = spec.cols.filter(c => c.required);
      if (!req.length) return null;
      const ok = r => req.every(c => (r[c.key] || '').trim());
      const has = r => spec.cols.some(c => (r[c.key] || '').trim());
      let bad = -1, msg = spec.msg;
      if (!a.some(ok)) bad = Math.max(0, a.findIndex(r => !ok(r)));
      else { bad = a.findIndex(r => has(r) && !ok(r)); msg = spec.rowMsg || spec.msg; }
      if (bad < 0) return null;
      page = Math.floor(bad / per); render();
      const row = list.querySelector(`[data-i="${bad}"]`);
      const inp = row && row.querySelector(`[data-col="${req.find(c => !(a[bad][c.key] || '').trim()).key}"]`);
      return { el: inp || row, msg };
    },
  };
}
