// The editor for one deck. Left: slide thumbnails (paged, never scrolls). Centre: the live deck in edit mode
// (/deck/<id>/?aura=edit#n, synced by postMessage), with a direct text tweak box when a text is clicked. Right: the
// editing bench illustration above the Claude chat (workshop.js in 'edit' mode: [slide N] replies, hints, choices,
// a folder button for files).
// mountEditor(el, { deckId, slide, audio, bus, sceneCtx, mountScene, onHome }) -> { destroy() }
import * as api from './api.js';
import { on } from './bus.js';
import { mountWorkshop } from './workshop.js';

const PER_PAGE = 6;
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const SVG = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pen: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16l1-4 8-8 3 3-8 8zM11.5 5.5l3 3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  tip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg>',
};
const QUALITY = { best: 'best quality', balanced: 'balanced', fast: 'fast' };

export function mountEditor(el, { deckId, slide = 1, audio, bus, sceneCtx, mountScene, onHome } = {}) {
  const sfx = n => { try { audio && audio.sfx && audio.sfx(n); } catch (e) { /* optional */ } };
  let alive = true, deck = null, cur = Math.max(1, slide | 0), count = 0, page = 0, thumbs = [], runtime = false, shim = null;
  let loadT = 0, scene = null, chat = null, editing = null, claudeBusy = false, thumbsT = 0, thumbsVer = 0;
  const offs = [];

  // ---------------------------------------------------------------- layout
  const homeBtn = h('button', { type: 'button', class: 'ed-home', 'data-cursor-label': 'library' }, h('span', { html: SVG.back }), 'my decks');
  const title = h('h1', { class: 'ed-title' }, 'opening your deck…');
  const upB = h('button', { type: 'button', class: 'pg', 'aria-label': 'earlier slides', html: SVG.up });
  const downB = h('button', { type: 'button', class: 'pg', 'aria-label': 'later slides', html: SVG.down });
  const stripList = h('div', { class: 'ed-strip-list', role: 'listbox', 'aria-label': 'slides' });
  const stripPg = h('span', { class: 'ed-strip-pg' });
  const strip = h('div', { class: 'ed-strip' }, h('div', { class: 'ed-strip-top' }, h('span', { class: 'ed-strip-t' }, 'slides'), stripPg, upB), stripList, h('div', { class: 'ed-strip-bot' }, downB));

  const frame = h('iframe', { class: 'ed-frame', title: 'your deck', tabindex: '-1' });
  const veil = h('div', { class: 'ed-veil' }, h('span', { class: 'ed-spin' }), h('span', {}, 'loading your slides…'));
  const work = h('div', { class: 'ed-work', hidden: true }, h('i', { class: 'ed-work-dot' }), h('span', { class: 'ed-work-t' }, 'claude is working on this deck'));
  const pop = h('div', { class: 'ed-pop', hidden: true, role: 'dialog', 'aria-label': 'change this text' });
  const preview = h('div', { class: 'ed-preview' }, frame, veil, work, pop);

  const prevB = h('button', { type: 'button', class: 'pg', 'aria-label': 'previous slide', html: SVG.left });
  const nextB = h('button', { type: 'button', class: 'pg', 'aria-label': 'next slide', html: SVG.right });
  const posTxt = h('span', { class: 'ed-pos' }, 'slide 1');
  const slideName = h('span', { class: 'ed-sname' });
  const presentB = h('button', { type: 'button', class: 'ed-act ed-ink', 'data-cursor-label': 'present' }, h('span', { html: SVG.play }), 'present');
  const folderB = h('button', { type: 'button', class: 'ed-act', 'aria-label': 'open the slides folder', title: 'open the slides folder', 'data-cursor-label': 'folder', html: SVG.folder });
  const nav = h('div', { class: 'ed-nav' }, prevB, posTxt, nextB, slideName, h('span', { class: 'ed-gap' }), presentB, folderB);

  const tip = h('div', { class: 'ed-tip' }, h('span', { class: 'ed-tip-i', html: SVG.tip }),
    h('p', {}, h('span', { class: 'ed-tip-h' }, 'click any text'), ' on the slide to change it yourself. bigger changes? ask claude on the right.'));
  const stats = h('div', { class: 'ed-stats' });
  const toast = h('p', { class: 'ed-toast', role: 'status' });
  const bench = h('div', { class: 'ed-bench' });
  const chatHost = h('div', { class: 'ed-chat' });
  el.replaceChildren(homeBtn, title, strip, preview, nav, tip, stats, toast, bench, chatHost);

  let toastT = 0;
  const say = (t, bad) => { toast.textContent = t; toast.classList.toggle('bad', !!bad); toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 3800); };

  // ---------------------------------------------------------------- slides + preview
  const deckUrl = (v = '') => `/deck/${encodeURIComponent(deckId)}/?aura=edit${v ? '&v=' + v : ''}#${cur}`;
  function loadFrame(v) {
    runtime = false; shim = null;
    veil.hidden = false;
    frame.src = deckUrl(v);
  }
  frame.addEventListener('load', () => {
    if (!alive) return;
    clearTimeout(loadT);
    // A deck without the Aura runtime (made by hand, or by the test stand-in) gets a small same-origin shim instead.
    loadT = setTimeout(() => { if (alive && !runtime) installShim(); }, 650);
  });
  function onMessage(e) {
    if (!alive || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
    const d = e.data;
    if (d.aura === 'slide') {
      runtime = true; veil.hidden = true;
      if (d.count) count = d.count | 0;
      if (d.index && d.index !== cur) { cur = d.index | 0; changed(); } else paintAll();
    } else if (d.aura === 'edit') openEdit(String(d.id || ''), String(d.text || ''), d.slide | 0);
  }
  addEventListener('message', onMessage);

  function installShim() {
    let doc;
    try { doc = frame.contentDocument; } catch (e) { doc = null; }
    if (!doc || !doc.body) { veil.hidden = true; return; }
    const slides = [...doc.querySelectorAll('.slide')].length ? [...doc.querySelectorAll('.slide')] : [...doc.querySelectorAll('body > section')];
    const st = doc.createElement('style');
    st.textContent = 'html,body{margin:0!important;overflow:hidden!important}body{width:1920px;height:1080px;transform-origin:0 0}' +
      '.aura-shim-off{display:none!important}[data-edit]{cursor:text;border-radius:8px;transition:outline-color .2s}' +
      '[data-edit]:hover{outline:4px solid #c9c3ef;outline-offset:8px}';
    doc.head.append(st);
    const fitShim = () => { try { doc.body.style.transform = `scale(${frame.clientWidth / 1920})`; } catch (e) { /* gone */ } };
    const show = n => slides.forEach((s, i) => s.classList.toggle('aura-shim-off', i !== n - 1));
    doc.addEventListener('click', ev => {
      const t = ev.target && ev.target.closest && ev.target.closest('[data-edit]');
      ev.preventDefault();
      if (!t || t.getAttribute('data-edit') === 'no') return;
      const n = slides.findIndex(s => s.contains(t)) + 1;
      openEdit(t.getAttribute('data-edit'), t.textContent.trim(), n || cur);
    }, true);
    shim = { go: n => show(n), fit: fitShim, slides };
    count = slides.length;
    cur = Math.min(Math.max(1, cur), count || 1);
    fitShim(); show(cur);
    veil.hidden = true;
    paintAll();
  }
  function go(n, { sound = true } = {}) {
    if (!count) return;
    n = Math.min(Math.max(1, n), count);
    if (n === cur) return;
    cur = n;
    if (sound) sfx('slide');
    if (shim) shim.go(n);
    else try { frame.contentWindow.postMessage({ aura: 'go', index: n - 1 }, location.origin); } catch (e) { /* not ready */ }
    changed();
  }
  function changed() {
    closeEdit();
    page = Math.floor((cur - 1) / PER_PAGE);
    paintAll();
    if (chat) chat.setSlide(cur);
  }
  const ro = new ResizeObserver(() => { if (shim) shim.fit(); });
  ro.observe(frame);

  function slideTitle(n) {
    const t = thumbs.find(x => x.n === n);
    if (t && t.title) return t.title;
    if (shim && shim.slides[n - 1]) { const hh = shim.slides[n - 1].querySelector('h1,h2,h3'); if (hh) return hh.textContent.trim(); }
    return '';
  }
  function paintStrip() {
    const n = count || thumbs.length;
    const pages = Math.max(1, Math.ceil(n / PER_PAGE));
    page = Math.min(Math.max(0, page), pages - 1);
    const items = [];
    for (let i = page * PER_PAGE + 1; i <= Math.min(n, page * PER_PAGE + PER_PAGE); i++) {
      const t = thumbs.find(x => x.n === i);
      const pic = h('span', { class: 'ed-th-pic' + (t ? '' : ' is-loading') });
      if (t) { const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = t.url; img.onerror = () => { pic.classList.add('is-loading'); img.remove(); }; pic.append(img); }
      else pic.append(h('span', { class: 'hm-shimmer' }));
      const b = h('button', { type: 'button', class: 'ed-th' + (i === cur ? ' on' : ''), role: 'option', 'aria-selected': i === cur ? 'true' : 'false',
        'data-n': i, 'data-cursor-label': `slide ${i}`, 'data-nosfx': '' }, pic, h('span', { class: 'ed-th-n' }, String(i)));
      b.addEventListener('click', () => go(i));
      items.push(b);
    }
    if (!n) for (let i = 1; i <= 4; i++) items.push(h('span', { class: 'ed-th ed-th-ghost' }, h('span', { class: 'ed-th-pic is-loading' }, h('span', { class: 'hm-shimmer' }))));
    stripList.replaceChildren(...items);
    upB.disabled = page === 0; downB.disabled = page >= pages - 1;
    upB.hidden = downB.hidden = pages <= 1;
    stripPg.textContent = n ? `${n}` : '';
  }
  function paintAll() {
    paintStrip();
    posTxt.textContent = count ? `slide ${cur} of ${count}` : `slide ${cur}`;
    const st = slideTitle(cur);
    slideName.textContent = st;
    slideName.title = st;
    prevB.disabled = cur <= 1; nextB.disabled = !count || cur >= count;
    if (scene) scene.update({ editor: { count: count || thumbs.length || 5, selected: cur } });
  }
  upB.addEventListener('click', () => { page--; sfx('slide'); paintStrip(); });
  downB.addEventListener('click', () => { page++; sfx('slide'); paintStrip(); });
  prevB.addEventListener('click', () => go(cur - 1));
  nextB.addEventListener('click', () => go(cur + 1));

  async function loadThumbs(tries = 0) {
    const ver = ++thumbsVer;
    const r = await api.decks.slides(deckId);
    if (!alive || ver !== thumbsVer) return;
    if (r && r.ok && Array.isArray(r.slides)) {
      thumbs = r.slides;
      if (!count) count = r.count || thumbs.length;
      paintAll();
    } else if (tries < 2) thumbsT = setTimeout(() => loadThumbs(tries + 1), 2500);
    else paintAll();
  }

  // ---------------------------------------------------------------- direct text tweak
  function openEdit(id, text, n) {
    if (!id || id === 'no') return;
    if (n && n !== cur) { cur = n; paintAll(); if (chat) chat.setSlide(cur); }
    editing = { id, text };
    sfx('pop');
    const ta = h('textarea', { class: 'ed-pop-in', rows: '2', maxlength: '4000', 'aria-label': 'new text' });
    ta.value = text;
    const msg = h('p', { class: 'ed-pop-msg', role: 'alert' });
    const save = h('button', { type: 'button', class: 'ed-pop-save', 'data-nosfx': '', 'data-cursor-label': 'save' }, 'save');
    const cancel = h('button', { type: 'button', class: 'ed-pop-cancel', 'data-cursor-label': 'cancel' }, 'cancel');
    pop.replaceChildren(h('div', { class: 'ed-pop-head' }, h('span', { class: 'ed-pop-i', html: SVG.pen }), h('span', {}, 'change this text'),
      h('span', { class: 'ed-pop-id' }, `slide ${cur}`)), ta, msg, h('div', { class: 'ed-pop-b' }, cancel, save));
    pop.hidden = false;
    pop.classList.remove('ed-in'); void pop.offsetWidth; pop.classList.add('ed-in');
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 130) + 'px'; };
    fit();
    ta.addEventListener('input', () => { fit(); msg.textContent = ''; pop.classList.remove('is-bad'); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); save.click(); }
      if (e.key === 'Escape') { e.preventDefault(); closeEdit(); }
    });
    cancel.addEventListener('click', () => closeEdit());
    save.addEventListener('click', async () => {
      const value = ta.value.trim();
      if (!value) { msg.textContent = 'type something first (or press cancel).'; pop.classList.add('is-bad'); sfx('error'); return; }
      if (value === text.trim()) { closeEdit(); return; }
      save.disabled = true; save.textContent = 'saving…';
      for (let i = 0; i < 6 && alive; i++) {      // Claude's run may still be closing for a moment after it finished
        const st = await api.claude.status();
        if (!(st && st.running && (!st.deckId || st.deckId === deckId))) break;
        await new Promise(res => setTimeout(res, 800));
      }
      if (!alive) return;
      let r = await api.decks.text(deckId, id, value);
      // right after Claude finishes, the server can still be closing its run for a moment: try a few more times
      for (let i = 0; i < 4 && alive && r && (r.status === 409 || r.error === 'busy') && !claudeBusy; i++) {
        await new Promise(res => setTimeout(res, 1200));
        r = await api.decks.text(deckId, id, value);
      }
      if (!alive) return;
      save.disabled = false; save.textContent = 'save';
      if (r && r.ok) {
        sfx('success'); closeEdit(); say('saved. the slide is updated.');
        loadFrame(r.mtime || Date.now()); thumbs = []; paintStrip(); loadThumbs();
        return;
      }
      sfx('error');
      pop.classList.add('is-bad');
      pop.animate && pop.animate([0, -8, 7, -5, 3, 0].map(x => ({ transform: `translateX(calc(-50% + ${x}px))` })), { duration: 420 });
      msg.textContent = r && r.error === 'rules' ? `${friendlyRule(r.reason)} your slide wasn’t changed.`
        : r && (r.status === 409 || r.error === 'busy') ? 'claude is working on this deck right now. try again when it’s done.'
        : r && r.error === 'no-element' ? 'that text can’t be found any more. the slide may have changed.'
        : r && r.error === 'offline' ? 'couldn’t reach lumi. is it still running?' : 'couldn’t save that. try again?';
    });
    requestAnimationFrame(() => { ta.focus({ preventScroll: true }); ta.select(); });
  }
  const friendlyRule = reason => {
    const s = String(reason || '').trim();
    return s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/\.?$/, '.') : 'text on a slide must stay 26 px or bigger, so try fewer words.';
  };
  function closeEdit() { editing = null; pop.hidden = true; pop.classList.remove('is-bad'); }

  // ---------------------------------------------------------------- deck info + actions
  async function loadDeck() {
    const r = await api.decks.get(deckId);
    if (!alive) return;
    if (!r || r.ok === false || !r.deck) { title.textContent = 'deck not found'; say('this deck isn’t in your library any more.', true); veil.hidden = true; return; }
    deck = r.deck;
    title.textContent = deck.title || 'untitled deck';
    title.title = deck.title || '';
    const look = deck.look && deck.look !== 'Claude chooses' ? deck.look.toLowerCase() : 'claude’s look';
    stats.replaceChildren(...[h('span', { class: 'ed-stat' }, look), h('span', { class: 'ed-stat' }, QUALITY[deck.quality] || 'balanced'),
      deck.exists ? null : h('span', { class: 'ed-stat bad' }, 'file missing')].filter(Boolean));
    presentB.disabled = !deck.exists;
    if (!deck.exists) { veil.hidden = false; veil.lastChild.textContent = 'this deck’s file is missing'; }
  }
  presentB.addEventListener('click', async () => { sfx('launch'); const r = await api.openSlides(deck && deck.file); if (alive && r && r.ok === false) say('couldn’t open it. try the folder.', true); });
  folderB.addEventListener('click', async () => { const r = await api.openSlides(); if (alive && r && r.ok === false) say('couldn’t open the folder.', true); });
  homeBtn.addEventListener('click', () => { sfx('back'); onHome && onHome(); });

  const onKey = e => {
    if (!alive || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
  };
  addEventListener('keydown', onKey);

  offs.push(on('claude:state', d => {
    if (!d || (d.deckId && d.deckId !== deckId)) return;
    claudeBusy = !!d.running;
    work.hidden = !claudeBusy;
    preview.classList.toggle('is-busy', claudeBusy);
    if (claudeBusy) closeEdit();
  }));

  // ---------------------------------------------------------------- mount
  loadDeck();
  loadFrame();
  paintAll();
  loadThumbs();
  if (mountScene) mountScene('edit-bench', bench, sceneCtx || {}).then(s => { if (!alive) { s.destroy(); return; } scene = s; paintAll(); });
  chat = mountWorkshop(null, chatHost, {
    bus, audio, deckId, mode: 'edit', getSlide: () => cur,
    onSlide: n => { if (n && n !== cur) { if (count && n > count) return; go(n); } },
    onDone: () => { if (!alive) return; say('claude’s changes are in. refreshing the preview.'); loadFrame(Date.now()); thumbs = []; paintStrip(); loadThumbs(); loadDeck(); },
  });

  return {
    get slide() { return cur; },
    go,
    destroy() {
      alive = false;
      clearTimeout(loadT); clearTimeout(toastT); clearTimeout(thumbsT);
      removeEventListener('message', onMessage); removeEventListener('keydown', onKey);
      ro.disconnect(); offs.forEach(f => f());
      if (chat) chat.destroy();
      if (scene) scene.destroy();
      frame.src = 'about:blank';
      el.replaceChildren();
    },
  };
}
