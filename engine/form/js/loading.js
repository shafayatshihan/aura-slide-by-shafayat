// The first screen on every launch: the character in full mode and an animated check list from GET /api/health.
// Failed checks get a friendly fix button (POST /api/fix/<name>, then GET /api/fix/status, or sign-in -> poll health).
// A free Claude plan gets a clear premium message; a newer version a non-blocking banner. All green -> onDone().
// mountLoading(el, { audio, onDone(info) }) -> { destroy() }      info = { health, update: {latest, version}|null }
import * as api from './api.js';

const ORDER = ['engine', 'node', 'modules', 'edge', 'python', 'claude', 'signin', 'disk', 'version'];
const NAMES = { engine: 'aura-slide files', node: 'node.js', modules: 'slide tools', edge: 'microsoft edge', python: 'export tools',
  claude: 'claude', signin: 'claude sign-in', disk: 'free space', version: 'updates' };
const FIX_LABEL = { npm: 'install them', pip: 'install them', signin: 'sign in', update: 'update aura-slide', claude: 'update aura-slide' };
const PREMIUM = ['pro', 'max', 'team', 'enterprise'];
const MIN_MS = 1500;

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
const ICON = {
  ok: '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fail: '<svg viewBox="0 0 24 24"><path d="M12 7v6.5M12 17v.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 7v6.5M12 17v.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lowerFirst = s => { s = String(s || ''); return /^(Aura-Slide|Claude|Microsoft|Node\.js|Python)\b/.test(s) ? s : s.replace(/^[A-Z](?=[a-z ])/, c => c.toLowerCase()); };

export function mountLoading(el, { audio, onDone } = {}) {
  const sfx = n => { try { audio && audio.sfx && audio.sfx(n); } catch (e) { /* optional */ } };
  let alive = true, health = null, rows = new Map(), finished = false, timers = [];
  const later = (fn, ms) => { const t = setTimeout(() => { if (alive) fn(); }, ms); timers.push(t); return t; };

  const badge = h('span', { class: 'badge ld-badge' }, h('i', { class: 'ld-pulse', 'aria-hidden': 'true' }), h('span', { class: 'ld-badge-t' }, 'getting ready'));
  const head = h('h1', { class: 'w-head ld-head' }, 'warming up', h('br'), 'the studio');
  const list = h('ol', { class: 'ld-list', 'aria-label': 'readiness checks', 'aria-live': 'polite' });
  const leftB = h('div', { class: 'ld-left' }, badge, head, list);

  const sideBadge = h('span', { class: 'badge' }, 'one moment');
  const side2 = h('h2', { class: 'w-head2 ld-h2' }, 'checking everything', h('br'), 'so claude can get to work');
  const sideNote = h('p', { class: 'w-note ld-note' }, 'this only takes a few seconds. if something needs fixing, there’s a button for it.');
  const premium = h('div', { class: 'ld-premium', hidden: true });
  const update = h('div', { class: 'ld-update', hidden: true });
  const goBtn = h('button', { type: 'button', class: 'begin ld-go', hidden: true, 'data-nosfx': '', 'data-cursor-label': 'go' },
    h('span', { class: 'lbl' }, 'go to my decks'),
    h('span', { class: 'begin-arrow', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' }));
  const again = h('button', { type: 'button', class: 'soft-pill ld-again', hidden: true }, 'check again');
  const skip = h('button', { type: 'button', class: 'link ld-skip', hidden: true }, 'carry on anyway');
  const sideB = h('div', { class: 'ld-right' }, sideBadge, side2, sideNote, premium, update, h('div', { class: 'ld-acts' }, goBtn, again), skip);
  el.replaceChildren(leftB, sideB);

  // ---- rows
  function row(id) {
    let r = rows.get(id);
    if (r) return r;
    const ico = h('span', { class: 'ld-ico', 'aria-hidden': 'true' });
    const label = h('span', { class: 'ld-l' }, NAMES[id] || id);
    const detail = h('span', { class: 'ld-d' }, 'checking…');
    const fixB = h('button', { type: 'button', class: 'ld-fix', hidden: true, 'data-nosfx': '', 'data-cursor-label': 'fix' });
    const li = h('li', { class: 'ld-row', 'data-id': id, 'data-state': 'wait' }, ico, h('span', { class: 'ld-t' }, label, detail), fixB);
    r = { id, li, ico, label, detail, fixB, check: null, fixing: false };
    fixB.addEventListener('click', () => runFix(r));
    rows.set(id, r);
    list.append(li);
    return r;
  }
  function setRow(r, c, { quiet = false } = {}) {
    r.check = c;
    const state = c.ok ? 'ok' : c.blocking === false ? 'warn' : 'fail';
    r.li.dataset.state = state;
    r.ico.innerHTML = ICON[state] || '';
    r.label.textContent = lowerFirst(c.label || NAMES[r.id]);
    if (!r.fixing) r.detail.textContent = String(c.detail || '').replace(/^\(simulated failure\)\s*/, '(test) ');
    const fx = !c.ok && c.fix && r.id !== 'version' ? c.fix : null;
    r.fixB.hidden = !fx || r.fixing;
    if (fx) r.fixB.textContent = r.id === 'signin' && isFreePlan() ? 'use another account' : FIX_LABEL[fx] || 'fix it';
    if (!quiet) { r.li.classList.remove('ld-pop'); void r.li.offsetWidth; r.li.classList.add('ld-pop'); sfx(c.ok ? 'tick' : 'pop'); }
  }
  const isFreePlan = () => {
    const p = health && health.subscriptionType;
    const si = health && (health.checks || []).find(c => c.id === 'signin');
    return !!(si && !si.ok && p && !PREMIUM.includes(String(p).toLowerCase()));
  };
  ORDER.forEach((id, i) => { const r = row(id); r.li.style.setProperty('--d', `${i * 70}ms`); });

  // ---- the flow
  async function check({ reveal = true } = {}) {
    const t0 = performance.now();
    if (reveal) for (const r of rows.values()) { if (!r.fixing) { r.li.dataset.state = 'wait'; r.detail.textContent = 'checking…'; r.ico.innerHTML = ''; } }
    paintSide('checking');
    const res = await api.health();
    if (!alive) return;
    if (!res || !Array.isArray(res.checks)) { paintSide('offline'); return; }
    health = res;
    if (reveal) await sleep(Math.max(0, MIN_MS - (performance.now() - t0)));
    const ids = ORDER.concat(res.checks.map(c => c.id).filter(id => !ORDER.includes(id)));
    for (const id of ids) {
      const c = res.checks.find(x => x.id === id);
      const r = rows.get(id);
      if (!c) { if (r) { r.li.remove(); rows.delete(id); } continue; }
      setRow(row(id), c, { quiet: !reveal });
      if (reveal) { await sleep(150); if (!alive) return; }
    }
    paintSide(res.ok ? 'ok' : 'fail');
  }
  function paintSide(state) {
    const vc = health && (health.checks || []).find(c => c.id === 'version');
    const newer = vc && !vc.ok && vc.latest;
    update.hidden = !newer;
    if (newer) {
      const ub = h('button', { type: 'button', class: 'ld-ubtn', 'data-cursor-label': 'update' }, 'update now');
      ub.addEventListener('click', () => runFix(rows.get('version') || row('version'), ub));
      update.replaceChildren(h('span', { class: 'ld-uspark', 'aria-hidden': 'true' }), h('span', { class: 'ld-ut' }, `a new version is ready (${String(vc.latest).replace(/^v/, '')})`), ub);
    }
    const free = isFreePlan();
    premium.hidden = !free;
    if (free) {
      const plan = String(health.subscriptionType);
      premium.replaceChildren(h('p', { class: 'ld-p-t' }, 'aura-slide needs claude pro, max or team'),
        h('p', { class: 'ld-p-x' }, `you’re signed in with a ${plan.toLowerCase()} plan, which can’t run claude in the background. upgrade at claude.ai, or sign in with an account that has a paid plan.`));
    }
    const t = el.querySelector('.ld-badge-t');
    badge.dataset.state = state;
    goBtn.hidden = again.hidden = skip.hidden = true;
    if (state === 'checking') {
      t.textContent = 'getting ready';
      head.replaceChildren('warming up', h('br'), 'the studio');
      sideBadge.textContent = 'one moment';
    } else if (state === 'offline') {
      t.textContent = 'can’t reach aura-slide';
      head.replaceChildren('hmm, the studio', h('br'), 'isn’t answering');
      sideBadge.textContent = 'try again';
      side2.replaceChildren('aura-slide’s helper', h('br'), 'stopped running');
      sideNote.textContent = 'close this window and open aura-slide again from your desktop.';
      again.hidden = false;
    } else if (state === 'ok') {
      t.textContent = 'all set';
      head.replaceChildren('all set!', h('br'), 'let’s make slides');
      sideBadge.textContent = 'ready';
      side2.replaceChildren('everything works', h('br'), 'nicely together');
      sideNote.textContent = 'taking you to your decks…';
      goBtn.hidden = false;
      if (!finished) { finished = true; sfx('success'); later(() => done(), 1100); }
    } else {
      const n = (health.checks || []).filter(c => !c.ok && c.blocking !== false).length;
      t.textContent = n === 1 ? '1 thing to fix' : `${n} things to fix`;
      head.replaceChildren(n === 1 ? 'one thing' : 'a couple of', h('br'), n === 1 ? 'to sort out' : 'things to fix');
      sideBadge.textContent = 'almost there';
      side2.replaceChildren('press the button', h('br'), 'next to each one');
      sideNote.textContent = free ? 'claude needs a paid plan to build slides.' : 'aura-slide fixes most things by itself. it can take a minute or two.';
      again.hidden = false; skip.hidden = false;
      sfx('error');
    }
  }
  function done() {
    if (!alive) return;
    const vc = health && (health.checks || []).find(c => c.id === 'version');
    onDone && onDone({ health, update: vc && !vc.ok && vc.latest ? { latest: vc.latest, version: vc.version } : null });
  }

  // ---- fixes
  async function runFix(r, extraBtn) {
    const c = r.check || {}, name = c.fix || (r.id === 'version' ? 'update' : null);
    if (!name || r.fixing) return;
    r.fixing = true; r.fixB.hidden = true; r.li.dataset.state = 'fixing';
    if (extraBtn) extraBtn.disabled = true;
    sfx('launch');
    const say = t => { r.detail.textContent = t; };
    const res = await api.fix(name === 'claude' ? 'update' : name);
    if (!alive) return;
    if (!res || res.ok === false) {
      r.fixing = false;
      say(res && res.message ? res.message : res && res.error === 'offline' ? 'couldn’t reach aura-slide.' : 'that didn’t start. try again?');
      r.li.dataset.state = 'fail'; r.fixB.hidden = false; r.fixB.textContent = 'try again';
      if (extraBtn) extraBtn.disabled = false;
      sfx('error');
      return;
    }
    if (name === 'update' || name === 'claude') {
      if (res.launched === false) { say('the updater would open now (test mode).'); r.li.dataset.state = 'warn'; r.fixing = false; return; }
      say('updating aura-slide… this window refreshes by itself when it’s done.');
      r.li.dataset.state = 'fixing';
      // the updater stops this server, installs, then starts it again: wait for that, then reload in place
      let wentDown = false;
      const t0 = Date.now();
      while (alive && Date.now() - t0 < 15 * 60 * 1000) {
        await sleep(2000);
        const up = await fetch('/api/ping', { cache: 'no-store' }).then(x => x.ok).catch(() => false);
        if (!up) wentDown = true;
        else if (wentDown) { sfx('success'); location.reload(); return; }
      }
      r.fixing = false; say('the update is taking a while. if it finished, click check again.'); r.li.dataset.state = 'warn';
      return;
    }
    if (name === 'signin') {
      say('a sign-in window opened. finish there; this page notices by itself.');
      const t0 = Date.now();
      while (alive && Date.now() - t0 < 6 * 60 * 1000) {
        await sleep(3500);
        if (!alive) return;
        const hh = await api.health();
        if (!alive) return;
        const si = hh && (hh.checks || []).find(x => x.id === 'signin');
        if (si && si.ok) { r.fixing = false; sfx('success'); health = hh; await check({ reveal: false }); return; }
      }
      r.fixing = false; say('still not signed in. try again when you’re ready.'); r.fixB.hidden = false; r.fixB.textContent = 'try again';
      r.li.dataset.state = 'fail';
      return;
    }
    // npm / pip: a background install with its own log
    say('installing… this can take a minute');
    for (;;) {
      await sleep(800);
      if (!alive) return;
      const st = await api.fixStatus();
      if (!alive) return;
      if (st && st.running) { const last = (st.log || []).slice(-1)[0]; if (last) say('installing… ' + String(last).slice(0, 70)); continue; }
      r.fixing = false;
      if (st && st.ok) { sfx('success'); say('installed, checking again…'); await check({ reveal: false }); }
      else { sfx('error'); say((st && st.message) || 'that didn’t finish. try again?'); r.li.dataset.state = 'fail'; r.fixB.hidden = false; r.fixB.textContent = 'try again'; }
      return;
    }
  }

  goBtn.addEventListener('click', () => { finished = true; done(); });
  again.addEventListener('click', () => { sfx('click'); check(); });
  skip.addEventListener('click', () => { sfx('click'); done(); });
  check();

  return { destroy() { alive = false; timers.forEach(clearTimeout); el.replaceChildren(); } };
}
