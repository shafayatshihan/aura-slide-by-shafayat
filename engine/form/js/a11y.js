// Small shared accessibility helpers (F-06, F-13, F-14). No dependencies.
//   openDialog(dialog, { host, onEsc }) -> close()   focus moves in, Tab is trapped, everything outside is inert, focus goes back on close
//   roving(group, itemSel)                           arrow-key navigation for a radiogroup / listbox / tablist (one tab stop)
//   syncTab(group, itemSel)                          re-apply the one-tab-stop after the items were repainted
//   announce(text)                                   say something to a screen reader through the one polite live region
const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';
const visible = n => !n.hidden && !n.closest('[hidden]') && (n.offsetWidth || n.offsetHeight || n.getClientRects().length);

export function openDialog(dialog, { host = null, onEsc = null, focus = null } = {}) {
  const returnTo = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  const held = [];
  if (host && host.parentElement) {
    for (const sib of host.parentElement.children) {
      if (sib === host || sib.tagName === 'SCRIPT' || sib.inert) continue;
      sib.inert = true; held.push(sib);
    }
  }
  const items = () => [...dialog.querySelectorAll(FOCUSABLE)].filter(visible);
  const key = e => {
    if (e.key === 'Escape' && onEsc) { e.stopPropagation(); onEsc(); return; }
    if (e.key !== 'Tab') return;
    const f = items();
    if (!f.length) { e.preventDefault(); return; }
    const a = document.activeElement, i = f.indexOf(a);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  };
  dialog.addEventListener('keydown', key);
  if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => {
    const first = (focus && dialog.querySelector(focus)) || items().find(n => !n.classList.contains('pl-fix-x')) || items()[0] || dialog;
    try { first.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  });
  let closed = false;
  return function close(restore = true) {
    if (closed) return; closed = true;
    dialog.removeEventListener('keydown', key);
    for (const s of held) s.inert = false;
    if (restore && returnTo && returnTo.isConnected && !returnTo.disabled) { try { returnTo.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
  };
}

export function syncTab(group, itemSel) {
  const items = [...group.querySelectorAll(itemSel)];
  if (!items.length) return;
  const on = items.find(n => n.getAttribute('aria-checked') === 'true' || n.getAttribute('aria-selected') === 'true') || items.find(n => !n.disabled) || items[0];
  for (const n of items) n.tabIndex = n === on ? 0 : -1;
}
export function roving(group, itemSel, { select = true, orientation = 'both', onMove = null } = {}) {
  const fwd = orientation === 'vertical' ? ['ArrowDown'] : orientation === 'horizontal' ? ['ArrowRight'] : ['ArrowDown', 'ArrowRight'];
  const bwd = orientation === 'vertical' ? ['ArrowUp'] : orientation === 'horizontal' ? ['ArrowLeft'] : ['ArrowUp', 'ArrowLeft'];
  group.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const items = [...group.querySelectorAll(itemSel)].filter(n => !n.disabled && !n.hidden);
    const i = items.indexOf(e.target.closest(itemSel));
    if (i < 0) return;
    let j = i;
    if (fwd.includes(e.key)) j = (i + 1) % items.length;
    else if (bwd.includes(e.key)) j = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = items.length - 1;
    else return;
    e.preventDefault();
    if (j === i) return;
    for (const n of items) n.tabIndex = n === items[j] ? 0 : -1;
    items[j].focus({ preventScroll: true });
    if (select) items[j].click();
    onMove && onMove(items[j]);
  });
}

let region = null, annT = 0;
export function announce(text) {
  if (!region) region = document.getElementById('announce');
  if (!region) return;
  clearTimeout(annT);
  region.textContent = '';
  annT = setTimeout(() => { region.textContent = String(text || ''); }, 60);   // a change after a clear is announced even when the words repeat
}
