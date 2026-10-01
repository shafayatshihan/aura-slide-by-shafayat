// Home: the deck library. A big "make a new deck" card on the left, then one card per deck from GET /api/decks
// (thumbnail, title, date, look badge, status, edit · present · folder), six to a page so nothing ever scrolls.
// mountHome(el, { audio, onNew, onResume, onOpen(deck), draft() -> {step}|null, update }) -> { destroy(), refresh() }
import * as api from './api.js';

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
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  pen: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16l1-4 8-8 3 3-8 8zM11.5 5.5l3 3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// The new-deck card's little drawing: a blank slide on a stand, a pencil and sparkles.
const NEW_ART = `<svg viewBox="0 0 220 130" aria-hidden="true" class="hm-new-art">
  <ellipse cx="110" cy="122" rx="78" ry="6" fill="#c9c3ef" opacity=".35"/>
  <path d="M104 96l-12 26M116 96l12 26" stroke="#9281b0" stroke-width="5" stroke-linecap="round"/>
  <g class="hm-sheet"><rect x="42" y="14" width="136" height="84" rx="12" fill="#f7f8fa"/>
  <rect x="58" y="32" width="60" height="9" rx="4.5" fill="#080909"/><rect x="58" y="49" width="84" height="6" rx="3" fill="#c5b3d5"/>
  <rect x="58" y="61" width="66" height="6" rx="3" fill="#c5b3d5"/><circle cx="150" cy="70" r="14" fill="#d89cb3"/>
  <path d="M144 70.5l4.5 4.5 7.5-8.5" fill="none" stroke="#080909" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
  <g class="hm-pencil"><rect x="176" y="20" width="10" height="58" rx="3" fill="#f2a65a" transform="rotate(28 181 49)"/>
  <path d="M168.5 75.5l9.5 5-1-10.5z" fill="#080909"/><rect x="184" y="16" width="10" height="9" rx="2" fill="#d89cb3" transform="rotate(28 189 20)"/></g>
  <path class="hm-spark s1" d="M30 30c.8 5 2.4 6.6 7.4 7.4-5 .8-6.6 2.4-7.4 7.4-.8-5-2.4-6.6-7.4-7.4 5-.8 6.6-2.4 7.4-7.4z" fill="#c9c3ef"/>
  <path class="hm-spark s2" d="M196 92c.6 3.6 1.8 4.8 5.4 5.4-3.6.6-4.8 1.8-5.4 5.4-.6-3.6-1.8-4.8-5.4-5.4 3.6-.6 4.8-1.8 5.4-5.4z" fill="#f2a65a"/>
</svg>`;
const EMPTY_ART = `<svg viewBox="0 0 300 180" aria-hidden="true">
  <rect x="40" y="40" width="150" height="92" rx="14" fill="#e4d3e8" transform="rotate(-6 115 86)"/>
  <rect x="96" y="28" width="160" height="98" rx="14" fill="#f7f8fa"/>
  <rect x="114" y="48" width="70" height="10" rx="5" fill="#c5b3d5"/><rect x="114" y="66" width="104" height="7" rx="3.5" fill="#e4d3e8"/>
  <rect x="114" y="80" width="84" height="7" rx="3.5" fill="#e4d3e8"/><circle cx="226" cy="100" r="13" fill="#c9c3ef"/>
  <path d="M60 150h200" stroke="#c9c3ef" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 12"/>
  <circle cx="270" cy="34" r="6" fill="#d89cb3"/><circle cx="34" cy="120" r="4" fill="#f2a65a"/>
</svg>`;
const LOOK_DOT = { 'Pink Punch': '#e46fa0', 'Bold Blue': '#2f5cf5', 'Flat-Pack': '#f2a65a', 'Happy Headspace': '#f6c445', 'Yellow Frame': '#ffd23a' };

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date(), day = 864e5;
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((a - b) / day);
  if (diff === 0) return `today, ${t}`;
  if (diff === 1) return `yesterday, ${t}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) }).toLowerCase();
}

export function mountHome(el, { audio, onNew, onResume, onOpen, draft, update } = {}) {
  const sfx = n => { try { audio && audio.sfx && audio.sfx(n); } catch (e) { /* optional */ } };
  let alive = true, decks = [], page = 0, loaded = false, pollT = 0;

  const d = draft ? draft() : null;
  // "make a new deck" is always the main card; an unfinished draft only adds a smaller "continue" card under it.
  const newCard = h('button', { type: 'button', class: 'hm-new', 'data-cursor-label': 'new deck', 'data-nosfx': '' },
    h('span', { class: 'hm-new-top', html: NEW_ART }),
    h('span', { class: 'hm-new-row' }, h('span', { class: 'hm-new-plus', html: SVG.plus }),
      h('span', { class: 'hm-new-t' }, h('span', { class: 'hm-new-h' }, 'make a new deck'),
        h('span', { class: 'hm-new-s' }, 'tell me about your talk. claude builds it.'))));
  newCard.addEventListener('click', () => { sfx('launch'); onNew && onNew(); });
  const contCard = d ? h('button', { type: 'button', class: 'hm-cont', 'data-cursor-label': 'continue', 'data-nosfx': '' },
    h('span', { class: 'hm-cont-h' }, 'continue your draft'),
    h('span', { class: 'hm-cont-s' }, `you’re at step ${d.step}. pick up where you left off.`)) : null;
  if (contCard) contCard.addEventListener('click', () => { sfx('launch'); onResume && onResume(); });
  const left = h('div', { class: 'hm-left' },
    h('span', { class: 'badge' }, 'your library'),
    h('h1', { class: 'q hm-head' }, 'your decks'),
    h('p', { class: 'lead hm-lead' }, 'open one to change it with claude, or start something new.'),
    update ? h('p', { class: 'hm-upd' }, h('span', { class: 'hm-upd-dot' }), `a new version (${String(update.latest).replace(/^v/, '')}) is ready. update from the loading screen next time.`) : null,
    newCard, contCard);
  const grid = h('div', { class: 'hm-grid', role: 'list', 'aria-label': 'your decks' });
  const count = h('span', { class: 'hm-count' });
  const prev = h('button', { type: 'button', class: 'pg', 'aria-label': 'previous page', html: SVG.left });
  const nxt = h('button', { type: 'button', class: 'pg', 'aria-label': 'next page', html: SVG.right });
  const pgLabel = h('span', { class: 'pg-label' });
  const pager = h('div', { class: 'pager hm-pager' }, prev, pgLabel, nxt);
  const toast = h('p', { class: 'hm-toast', role: 'status' });
  const foot = h('div', { class: 'hm-foot' }, count, toast, pager);
  const right = h('div', { class: 'hm-right' }, grid, foot);
  el.replaceChildren(left, right);

  prev.addEventListener('click', () => { if (page > 0) { page--; sfx('slide'); paint(-1); } });
  nxt.addEventListener('click', () => { if ((page + 1) * PER_PAGE < decks.length) { page++; sfx('slide'); paint(1); } });

  let toastT = 0;
  const say = t => { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 3200); };

  function thumb(dk) {
    const box = h('div', { class: 'hm-thumb' });
    if (dk.status === 'building') {
      box.classList.add('is-building');
      box.append(h('span', { class: 'hm-build' }, h('i'), h('i'), h('i')), h('span', { class: 'hm-tlabel' }, 'claude is building it…'));
      return box;
    }
    if (!dk.thumb) {
      box.classList.add('is-empty');
      box.append(h('span', { class: 'hm-tlabel' }, dk.status === 'missing' ? 'the file was moved or deleted' : 'not built yet'));
      return box;
    }
    box.classList.add('is-loading');
    box.append(h('span', { class: 'hm-shimmer' }), h('span', { class: 'hm-tlabel' }, 'drawing a preview…'));
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => { if (!alive) return; box.classList.remove('is-loading'); box.replaceChildren(img); };
    img.onerror = () => { if (!alive) return; box.classList.remove('is-loading'); box.classList.add('is-empty');
      box.replaceChildren(h('span', { class: 'hm-tlabel' }, 'no preview yet')); };
    img.src = dk.thumb;
    return box;
  }
  function statusPill(dk) {
    const map = { building: ['building', 'run'], ready: ['ready', 'ok'], missing: ['file missing', 'bad'], draft: ['not finished', 'wait'] };
    const [t, k] = map[dk.status] || [dk.status, 'wait'];
    return h('span', { class: 'hm-status', 'data-k': k }, h('i'), t);
  }
  function deckCard(dk, i) {
    const look = dk.look && dk.look !== 'Claude chooses' ? dk.look : null;
    const editB = h('button', { type: 'button', class: 'hm-b hm-edit', 'data-cursor-label': dk.exists ? 'edit' : 'open', 'data-nosfx': '' },
      h('span', { html: SVG.pen }), dk.exists ? 'edit' : dk.status === 'building' ? 'watch' : 'open');
    const presentB = h('button', { type: 'button', class: 'hm-b hm-ico', 'aria-label': 'present', title: 'present', html: SVG.play, 'data-cursor-label': 'present' });
    const folderB = h('button', { type: 'button', class: 'hm-b hm-ico', 'aria-label': 'open the folder', title: 'open the folder', html: SVG.folder, 'data-cursor-label': 'folder' });
    presentB.disabled = !dk.exists;
    const card = h('div', { class: 'hm-card', role: 'listitem', style: `--i:${i}`, 'data-id': dk.id },
      h('button', { type: 'button', class: 'hm-tbtn', 'aria-label': `open ${dk.title}`, 'data-cursor-label': 'open', 'data-nosfx': '' }, thumb(dk)),
      h('div', { class: 'hm-meta' },
        h('p', { class: 'hm-title', title: dk.title }, dk.title || 'untitled deck'),
        h('p', { class: 'hm-sub' }, h('span', {}, when(dk.updatedAt || dk.createdAt)), look ? h('span', { class: 'hm-look' }, h('i', { style: `background:${LOOK_DOT[look] || '#c5b3d5'}` }), look.toLowerCase()) : null, statusPill(dk))),
      h('div', { class: 'hm-acts' }, editB, presentB, folderB));
    const open = () => { sfx('launch'); onOpen && onOpen(dk); };
    editB.addEventListener('click', open);
    card.querySelector('.hm-tbtn').addEventListener('click', open);
    presentB.addEventListener('click', async () => { sfx('launch'); const r = await api.openSlides(dk.file); if (alive && r && r.ok === false) say('couldn’t open it. try the folder.'); });
    folderB.addEventListener('click', async () => { const r = await api.openSlides(); if (alive && r && r.ok === false) say('couldn’t open the folder.'); });
    return card;
  }
  function paint(dir = 0) {
    const pages = Math.max(1, Math.ceil(decks.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    const items = decks.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    if (!loaded) {
      grid.replaceChildren(...Array.from({ length: 3 }, (_, i) => h('div', { class: 'hm-card hm-ghost', style: `--i:${i}` }, h('div', { class: 'hm-thumb is-loading' }, h('span', { class: 'hm-shimmer' })))));
    } else if (!decks.length) {
      grid.replaceChildren(h('div', { class: 'hm-empty' }, h('div', { class: 'hm-empty-art', html: EMPTY_ART }),
        h('p', { class: 'hm-empty-t' }, 'no decks yet'), h('p', { class: 'hm-empty-x' }, 'your first one shows up right here once claude has built it.')));
    } else grid.replaceChildren(...items.map(deckCard));
    grid.dataset.dir = dir;
    count.textContent = loaded && decks.length ? `${decks.length} deck${decks.length === 1 ? '' : 's'}` : '';
    pager.hidden = pages <= 1;
    prev.disabled = page === 0; nxt.disabled = page >= pages - 1;
    pgLabel.textContent = `${page + 1} / ${pages}`;
  }
  async function refresh() {
    const r = await api.decks.list();
    if (!alive) return;
    if (r && Array.isArray(r.decks)) {
      const sig = JSON.stringify(r.decks.map(x => [x.id, x.status, x.updatedAt, x.thumb, x.title]));
      const changed = sig !== refresh.sig; refresh.sig = sig;
      decks = r.decks; loaded = true;
      if (changed) paint();
    } else if (!loaded) { loaded = true; paint(); say('couldn’t load your decks. is lumi still running?'); }
    clearTimeout(pollT);
    // keep an eye on decks that are being built
    pollT = setTimeout(refresh, decks.some(x => x.status === 'building') ? 3000 : 15000);
  }
  paint(); refresh();
  return { refresh, destroy() { alive = false; clearTimeout(pollT); clearTimeout(toastT); el.replaceChildren(); } };
}
