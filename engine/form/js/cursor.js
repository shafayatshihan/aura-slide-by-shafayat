// Custom cursor: an ink dot that tracks the pointer exactly and a soft lilac ring that follows on a gentle spring.
// The ring grows over things you can click (with a short pill label from data-cursor-label), shrinks on press, turns
// into a dashed "drop" ring while files are dragged over the window and steps aside over text fields so the native
// I-beam stays. Off for touch-first devices. The layer never takes clicks: everything in it is pointer-events:none.
//   const cursor = initCursor();
//   cursor.setState('busy', 'working');  // force 'hover' | 'drop' | 'text' | 'hidden' | 'busy' (+ optional label)
//   cursor.setState('press');            // a short press pulse (e.g. for a keyboard Enter); keeps the state
//   cursor.setState('auto');             // back to following the pointer ('default' or no name does the same)
// Markup hooks: data-cursor (grow here), data-cursor="plain" (don't grow), data-cursor-label="next",
// data-cursor-drop="drop to add" (label shown while files are dragged over that element).
import { on } from './bus.js';

const HOVER = ['button', '[role=button]', 'label', '.choice', '[data-cursor]', 'a[href]', 'select', 'summary',
  'input[type=checkbox]', 'input[type=radio]', 'input[type=range]', 'input[type=file]', 'input[type=color]',
  '[role=tab]', '[role=switch]', '[role=option]', '[role=checkbox]', '[role=radio]', '[role=slider]', '[role=menuitem]'].join(',');
const TEXT = ['input:not([type])', 'input[type=text]', 'input[type=email]', 'input[type=search]', 'input[type=url]',
  'input[type=tel]', 'input[type=password]', 'input[type=number]', 'textarea',
  '[contenteditable]:not([contenteditable=false])'].join(',');
const NO_GROW = ':disabled, [aria-disabled="true"], [data-cursor="plain"]';
const FORCED = new Set(['hover', 'drop', 'text', 'hidden', 'busy']);
const K = 320, C = 2 * Math.sqrt(K) * 0.8;   // ring spring: stiffness and damping (slightly under-damped)

let active = null;

// F-15: the custom pointer can be switched off (home screen: "use the normal mouse pointer", remembered here), it is off with
// forced-colors / high-contrast, and ?cursor=native turns it off for one visit. If it ever fails to paint, the native pointer
// comes back by itself (guard below). Text fields always keep the native I-beam and caret (cursor.css).
const PREF = 'aura-pointer';
export const nativePointer = () => {
  try { if (localStorage.getItem(PREF) === 'native' || new URLSearchParams(location.search).get('cursor') === 'native') return true; } catch (e) { /* storage blocked */ }
  return matchMedia('(forced-colors: active)').matches;
};
export function setNativePointer(on) {
  try { if (on) localStorage.setItem(PREF, 'native'); else localStorage.removeItem(PREF); } catch (e) { /* storage blocked */ }
  if (active) active.refresh();
}

export function initCursor() {
  if (active) return active;
  const doc = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.createElement('div');
  root.className = 'aura-cursor';
  root.dataset.state = 'default';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<div class="aura-cursor__ring"><i></i><span class="aura-cursor__label"></span></div>' +
                   '<div class="aura-cursor__dot"><i></i></div>';
  const ring = root.firstChild, dot = root.lastChild, label = ring.lastChild;
  const canTop = typeof root.showPopover === 'function';
  if (canTop) root.popover = 'manual';   // top layer: stays above dialogs and fullscreen elements
  (document.body || doc).appendChild(root);

  let enabled = false, seen = false, dragging = false;
  let x = -100, y = -100, rx = x, ry = y, vx = 0, vy = 0, last = 0, raf = 0;
  let auto = 'default', autoLabel = '', forced = null, forcedLabel = '';
  let flipX = false, flipY = false, labelW = 0;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  let dragTimer = 0;

  function raise() {
    if (!canTop || !root.isConnected) return;
    try { if (root.matches(':popover-open')) root.hidePopover(); root.showPopover(); } catch (e) { /* not fatal */ }
  }

  function render() {
    const state = forced || auto;
    const text = forced ? forcedLabel : autoLabel;
    if (root.dataset.state !== state) root.dataset.state = state;
    if (text && label.textContent !== text) { label.textContent = text; labelW = label.offsetWidth; }
    root.classList.toggle('has-label', !!text);
    if (text) fit();
  }

  // Keep the label pill on screen near the right and bottom edges.
  function fit() {
    const fx = x + 30 + labelW > innerWidth, fy = y + 60 > innerHeight;
    if (fx !== flipX) root.classList.toggle('flip-x', (flipX = fx));
    if (fy !== flipY) root.classList.toggle('flip-y', (flipY = fy));
  }

  function step(now) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    vx += (K * (x - rx) - C * vx) * dt;
    vy += (K * (y - ry) - C * vy) * dt;
    rx += vx * dt;
    ry += vy * dt;
    const done = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1 && Math.abs(vx) < 2 && Math.abs(vy) < 2;
    if (done) { rx = x; ry = y; vx = vy = 0; last = 0; }
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    if (!done) raf = requestAnimationFrame(step);
  }

  function snapRing() {
    cancelAnimationFrame(raf);
    raf = 0; last = 0; rx = x; ry = y; vx = vy = 0;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
  }

  function place(px, py) {
    x = px; y = py;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    if (!seen || still.matches) snapRing();
    else if (!raf) raf = requestAnimationFrame(step);
    if (!seen) { seen = true; doc.classList.add('aura-cursor-on'); later(guard, 800); }
    root.classList.add('is-on');
    if (root.classList.contains('has-label')) fit();
  }

  function classify(target) {
    let state = 'default', text = '';
    if (target instanceof Element) {
      if (target.closest(TEXT)) state = 'text';
      else {
        const el = target.closest(HOVER);
        if (el && !el.matches(NO_GROW)) {
          state = 'hover';
          // a label set on the element, inside it, or on an interactive wrapper (e.g. a .choice card)
          const l = target.closest('[data-cursor-label]');
          if (l && (el.contains(l) || l.matches(HOVER))) text = l.getAttribute('data-cursor-label').trim();
        }
      }
    }
    if (state !== auto || text !== autoLabel) { auto = state; autoLabel = text; render(); }
  }

  // The page can change under a still pointer (screen changes, a clicked button disappears): look again.
  function recheck() {
    if (!enabled || !seen || dragging || !root.classList.contains('is-on')) return;
    classify(document.elementFromPoint(x, y));
  }

  function hideForTouch() { root.classList.remove('is-on', 'is-press'); }

  function onMove(e) {
    if (!enabled) return;
    if (e.pointerType === 'touch') return hideForTouch();
    place(e.clientX, e.clientY);
    classify(e.target);
  }

  function onDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'touch') return hideForTouch();
    place(e.clientX, e.clientY);
    classify(e.target);
    root.classList.add('is-press');
  }

  function onUp() {
    root.classList.remove('is-press');
    if (enabled) { requestAnimationFrame(recheck); later(recheck, 350); }
  }

  function onOut(e) { if (!e.relatedTarget && e.pointerType !== 'touch') root.classList.remove('is-on'); }

  const hasFiles = e => !!e.dataTransfer && Array.prototype.includes.call(e.dataTransfer.types || [], 'Files');

  function onDrag(e) {
    if (!enabled || !hasFiles(e)) return;
    dragging = true;
    place(e.clientX, e.clientY);
    const zone = e.target instanceof Element ? e.target.closest('[data-cursor-drop]') : null;
    const text = zone ? zone.getAttribute('data-cursor-drop').trim() : '';
    if (auto !== 'drop' || autoLabel !== text) { auto = 'drop'; autoLabel = text; render(); }
    clearTimeout(dragTimer);
    dragTimer = setTimeout(endDrag, 700);   // dragover repeats while files hover the window
  }

  function endDrag() {
    clearTimeout(dragTimer);
    dragTimer = 0;
    if (!dragging) return;
    dragging = false;
    auto = 'default'; autoLabel = '';
    render();
  }

  function onDragLeave(e) {
    const out = e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight;
    if (dragging && !e.relatedTarget && out) endDrag();
  }

  function pulse() {
    root.classList.add('is-press');
    later(() => { root.classList.remove('is-press'); recheck(); }, 160);
  }

  function onDrop(e) {
    if (!dragging) return;
    endDrag();
    place(e.clientX, e.clientY);
    pulse();                                              // a small "gulp" as the files land
  }

  function onToggle(e) {
    const t = e.target;
    if (t !== root && e.newState === 'open' && t instanceof Element && (t.localName === 'dialog' || t.hasAttribute('popover'))) raise();
  }

  function onMotion() { if (still.matches) snapRing(); }

  function onStep() { requestAnimationFrame(recheck); later(recheck, 450); later(recheck, 900); }

  // if the custom pointer is not actually on screen shortly after it took over, give the person their own pointer back
  function guard() {
    if (!seen) return;
    const gone = !root.isConnected || getComputedStyle(root).display === 'none' || getComputedStyle(root).visibility === 'hidden';
    if (gone) { enabled = false; seen = false; doc.classList.remove('aura-cursor-on'); }
  }

  function setEnabled() {
    enabled = fine.matches && !nativePointer();
    if (enabled) return;
    root.classList.remove('is-on', 'is-press');
    doc.classList.remove('aura-cursor-on');
    seen = false;
    endDrag();
  }

  const live = { passive: true, capture: true };
  const listeners = [
    ['pointermove', onMove, live], ['pointerdown', onDown, live], ['pointerup', onUp, live],
    ['pointercancel', onUp, live], ['pointerout', onOut, live], ['blur', onUp, false],
    ['dragenter', onDrag, live], ['dragover', onDrag, live], ['dragleave', onDragLeave, live],
    ['drop', onDrop, live], ['dragend', endDrag, live], ['fullscreenchange', raise, false],
  ];
  for (const [type, fn, opt] of listeners) addEventListener(type, fn, opt);
  document.addEventListener('toggle', onToggle, true);
  fine.addEventListener('change', setEnabled);
  still.addEventListener('change', onMotion);
  const offStep = on('step:change', onStep);
  setEnabled();
  raise();

  active = {
    refresh() { setEnabled(); },
    setState(name, text) {
      if (name === 'press') return pulse();
      forced = FORCED.has(name) ? name : null;
      forcedLabel = forced && text ? String(text).trim() : '';
      render();
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(dragTimer);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const [type, fn, opt] of listeners) removeEventListener(type, fn, opt);
      document.removeEventListener('toggle', onToggle, true);
      fine.removeEventListener('change', setEnabled);
      still.removeEventListener('change', onMotion);
      offStep();
      doc.classList.remove('aura-cursor-on');
      root.remove();
      active = null;
    },
  };
  return active;
}
