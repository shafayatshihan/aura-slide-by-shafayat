// The one DOM helper and the one icon set (X-07: it used to be re-implemented in eleven files).
//   h('div', { class: 'x', html: '<b>raw</b>', onclick: fn, 'aria-label': 'y' }, 'text', childNode, [more, kids])
// Attributes that are null/false are skipped, true becomes an empty attribute, on* become listeners, children may be arrays.
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export const el = h;
const P = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  folder: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" ${P}/></svg>`,
  '3d': `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5M12 12v9" ${P}/></svg>`,
  chart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 17v-5M12 17V7M17 17v-8" ${P}/></svg>`,
  diagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="6" rx="1.5" ${P}/><rect x="14" y="14" width="7" height="6" rx="1.5" ${P}/><path d="M6.5 10v4.5a2 2 0 0 0 2 2H14" ${P}/></svg>`,
  photo: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" ${P}/><circle cx="9" cy="10" r="1.8" ${P}/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" ${P}/></svg>`,
  text: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M12 6v13M9 19h6" ${P}/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6" ${P}/></svg>`,
  up: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" ${P}/></svg>`,
  down: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" ${P}/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" ${P}/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" ${P}/></svg>`,
  bin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" ${P}/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" ${P}/></svg>`,
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></g></svg>',
  tick: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" ${P}/></svg>`,
  q: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.9v.4M12 17.6v.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2c1 6.5 3.4 8.9 10 10-6.6 1.1-9 3.5-10 10-1-6.5-3.4-8.9-10-10 6.6-1.1 9-3.5 10-10z" fill="currentColor"/></svg>',
  right: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" ${P}/></svg>`,
  left: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" ${P}/></svg>`,
  rright: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" ${P}/></svg>`,
  file: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z M14 3v4h4" ${P}/></svg>`,
  pen: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l1.2-4.6L15.8 4.8l3.4 3.4-9.6 9.6zM13.6 7l3.4 3.4" ${P}/></svg>`,
};
