// "Your files" scene: a big friendly folder for the current upload folder. File-type icons float around it as hints;
// dragging files over the window makes the folder open its flap and pull the icons in, a drop rains paper sheets into
// it, and every finished upload shows a little card (type icon and name) that dives into the folder, colours the
// sheets peeking out and bumps the counter.

import { C, SPRING, EASE, h, clean, currentScreen, get, short, textWidth, star, pill, makeStage } from './talk.js';
import { on } from '../bus.js';

const FOLDERS = ['Report', 'Images and photos', 'Data (csv, excel, graphs)', 'Logo and university template', 'Previous year reports', 'Journal papers', 'Anything else'];
const LABEL = { Report: 'report', 'Images and photos': 'images and photos', 'Data (csv, excel, graphs)': 'data and graphs',
  'Logo and university template': 'logo and template', 'Previous year reports': 'previous reports', 'Journal papers': 'journal papers', 'Anything else': 'anything else' };
const HINTS = { Report: ['pdf', 'doc', 'pdf', 'doc'], 'Images and photos': ['img', 'img', 'vid', 'img'], 'Data (csv, excel, graphs)': ['xls', 'csv', 'img', 'xls'],
  'Logo and university template': ['img', 'ppt', 'img', 'doc'], 'Previous year reports': ['pdf', 'ppt', 'doc', 'pdf'], 'Journal papers': ['pdf', 'pdf', 'doc', 'pdf'],
  'Anything else': ['zip', 'vid', 'file', 'pdf'] };
const TYPE = { pdf: ['PDF', C.p2], doc: ['DOC', C.f6], ppt: ['PPT', C.or2], xls: ['XLS', C.f5], csv: ['CSV', C.f5], img: ['IMG', C.or], vid: ['VID', C.p1], zip: ['ZIP', C.f4], file: ['FILE', C.f4] };
const EXT = { pdf: 'pdf', doc: 'doc', docx: 'doc', txt: 'doc', rtf: 'doc', odt: 'doc', md: 'doc', tex: 'doc', ppt: 'ppt', pptx: 'ppt', key: 'ppt', odp: 'ppt',
  xls: 'xls', xlsx: 'xls', ods: 'xls', csv: 'csv', tsv: 'csv', json: 'csv', mat: 'csv', png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img',
  bmp: 'img', heic: 'img', tif: 'img', tiff: 'img', mp4: 'vid', mov: 'vid', avi: 'vid', webm: 'vid', mkv: 'vid', zip: 'zip', rar: 'zip', '7z': 'zip' };
const kindOf = name => EXT[(/\.([a-z0-9]+)$/i.exec(String(name || '')) || [])[1]?.toLowerCase()] || 'file';
const HINT_POS = [[84, 112], [112, 262], [572, 100], [566, 256]];

// A document icon, centred on 0,0, 48 x 60.
function docIcon(kind) {
  const [lab, col] = TYPE[kind] || TYPE.file;
  const g = h('g', {}, [
    h('path', { d: 'M-21,-27H9L24,-12V30H-21Z', fill: C.f4, transform: 'translate(3,3)' }),
    h('path', { d: 'M-24,-30H6L24,-12V27H-24Z', fill: C.pill }),
    h('path', { d: 'M6,-30V-12H24Z', fill: C.f2 }),
    h('rect', { x: -24, y: 6, width: 48, height: 18, fill: col }),
    h('text', { y: 20, 'font-size': 13, class: 'ep', 'text-anchor': 'middle', fill: C.pill, text: lab })]);
  if (kind === 'img') g.append(h('path', { d: 'M-16,0L-7,-11L0,-3L5,-8L14,0Z', fill: C.f3 }), h('circle', { cx: 8, cy: -18, r: 4, fill: C.or0 }));
  else if (kind === 'vid') g.append(h('path', { d: 'M-6,-20V-2L9,-11Z', fill: C.p1 }));
  else if (kind === 'xls' || kind === 'csv') g.append(h('path', { d: 'M-16,-2V-10M-8,-2V-18M0,-2V-14M8,-2V-22', stroke: C.f5, 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
  else if (kind === 'ppt') g.append(h('rect', { x: -16, y: -22, width: 26, height: 18, rx: 2, fill: C.or0 }), h('path', { d: 'M-12,-15h14', stroke: C.or2, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  else if (kind === 'zip') g.append(h('path', { d: 'M-2,-30v4h4v4h-4v4h4v4h-4', stroke: C.f6, 'stroke-width': 2.4, fill: 'none' }));
  else g.append(h('path', { d: 'M-16,-20h18M-16,-13h28M-16,-6h24', stroke: C.f3, 'stroke-width': 3, 'stroke-linecap': 'round' }));
  return g;
}

export default {
  mount(el, ctx) {
    const S = makeStage(el, ctx, 'files');
    const offs = [];
    S.svg.append(h('style', { text: `
      .s2d-files .flap{transition:transform .55s ${SPRING}}
      .s2d-files.open .flap{transform:skewX(-9deg) scaleY(.74)}
      .s2d-files .hint{transition:transform .8s ${EASE},opacity .5s ease}
      .s2d-files .mouth{transition:opacity .4s ease}
      .s2d-files.open .mouth{opacity:.85}
      .s2d-files .arrow{transition:opacity .35s ease}
      .s2d-files:not(.open) .arrow{opacity:0}
      .s2d-files .lift{transition:transform .6s ${SPRING}}
      .s2d-files.open .lift{transform:translateY(-6px)}
      .s2d-files .sheet{transition:fill .5s ease}` }));
    const back = S.layer(S.svg, 3), mid = S.layer(S.svg, 7), front = S.layer(S.svg, 12);

    // ---- back: floor, sparkles, hint icons
    back.append(h('ellipse', { cx: 330, cy: 344, rx: 250, ry: 14, fill: C.f2, opacity: 0.6 }),
      h('ellipse', { cx: 330, cy: 334, rx: 130, ry: 9, fill: C.f4, opacity: 0.45 }));
    const sp = [star(220, 70, 8, C.or, 'twinkle fb'), star(460, 50, 6, C.p1, 'twinkle fb'), star(630, 180, 7, C.white, 'twinkle fb'), star(36, 200, 6, C.or0, 'twinkle fb')];
    sp.forEach((s, i) => { s.style.animationDelay = `${-i * 0.8}s`; back.append(s); });
    const hintG = h('g');
    mid.append(hintG);
    let hints = [];

    // ---- mid: the folder
    const folder = h('g', { class: 'lift' });
    const gulp = h('g', { class: 'fbb' });
    folder.append(h('g', { transform: 'translate(330,330) scale(1.2) translate(-330,-330)' }, [gulp]));
    gulp.append(
      h('path', { d: 'M230,176a12,12 0 0 1 12,-12H300a12,12 0 0 1 10,5L318,180H418a12,12 0 0 1 12,12V316H230Z', fill: C.f5 }),
      h('ellipse', { cx: 330, cy: 196, rx: 92, ry: 14, fill: C.or0, opacity: 0, class: 'mouth' }));
    const sheetsG = h('g');
    const sheetCols = [C.pill, C.white, C.pill];
    const sheets = [[-62, -6, 'rotate(-7 268 214)'], [0, -14, 'rotate(2 330 206)'], [56, -4, 'rotate(8 386 216)']].map(([dx, dy, tr], i) => {
      const r = h('rect', { x: 300 + dx, y: 188 + dy, width: 60, height: 76, rx: 6, fill: sheetCols[i], transform: tr, class: 'sheet' });
      sheetsG.append(r);
      return r;
    });
    gulp.append(sheetsG);
    const flap = h('g', { class: 'flap fbb' });
    const nameT = h('text', { x: 330, y: 270, 'font-size': 15, class: 'ep', 'text-anchor': 'middle', fill: C.pill });
    flap.append(
      h('rect', { x: 222, y: 200, width: 216, height: 126, rx: 16, fill: C.f4 }),
      h('rect', { x: 222, y: 200, width: 216, height: 14, rx: 7, fill: C.f3 }),
      h('path', { d: 'M240,222h60', stroke: C.white, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.45 }),
      h('rect', { x: 286, y: 288, width: 88, height: 8, rx: 4, fill: C.f5, opacity: 0.6 }),
      nameT);
    gulp.append(flap);
    const badge = h('g', { transform: 'translate(430,196)' });
    const badgeIn = h('g', { class: 'fb' });
    const badgeT = h('text', { y: 6, 'font-size': 16, class: 'ep', 'text-anchor': 'middle', fill: C.pill });
    badgeIn.append(h('circle', { r: 19, fill: '#5b3fa8' }), badgeT);
    badge.append(badgeIn);
    gulp.append(badge);
    const arrow = h('g', { class: 'arrow', transform: 'translate(330,96)' }, [h('g', { class: 'bob' }, [
      h('path', { d: 'M-10,-26H10V0H22L0,22L-22,0H-10Z', fill: C.ink })])]);
    mid.append(folder, arrow);
    const countP = pill({ x: 330, y: 352, ht: 26, pad: 11, size: 13, align: 'center', max: 240 });
    const mainP = pill({ x: 24, y: 24, ht: 24, pad: 10, size: 13, fill: C.lilac, color: C.ink, max: 250 });
    mid.append(countP.g, mainP.g);
    const fly = h('g');
    front.append(fly);

    // ---- state
    const counts = new Map(), recent = new Map();
    let folderName = null, open = false, queueAt = 0, state = ctx.getState ? ctx.getState() : {};
    const fromScreen = id => { const m = /^files-(\d)$/.exec(id || ''); return m ? FOLDERS[+m[1] - 1] : null; };

    function placeHints(pull) {
      hints.forEach((n, i) => {
        const [x, y] = HINT_POS[i];
        n.style.transform = pull ? `translate(${x + (330 - x) * 0.42}px,${y + (210 - y) * 0.42}px) scale(.85)` : `translate(${x}px,${y}px)`;
      });
    }
    function renderHints() {
      const kinds = HINTS[folderName] || HINTS['Anything else'];
      hintG.replaceChildren();
      hints = kinds.map((k, i) => {
        const n = h('g', { class: 'hint' }, [h('g', { class: 'bob', style: { animationDelay: `${-i * 0.8}s`, animationDuration: `${3.2 + i * 0.3}s` } }, [
          h('g', { transform: `rotate(${[-10, 6, 9, -6][i]})`, opacity: 0.9 }, [docIcon(k)])])]);
        hintG.append(n);
        return n;
      });
      placeHints(open);
    }
    function renderCount(pop) {
      const n = counts.get(folderName) || 0;
      badgeT.textContent = n > 99 ? '99+' : n;
      badge.style.display = n ? '' : 'none';
      countP.set(n ? `${n} file${n === 1 ? '' : 's'} added` : open ? 'let go to drop them in' : 'drop files here, or skip');
      countP.rect.setAttribute('fill', n || open ? C.ink : C.f4);
      const kinds = recent.get(folderName) || [];
      sheets.forEach((s, i) => s.setAttribute('fill', kinds[i] ? (TYPE[kinds[i]] || TYPE.file)[1] : sheetCols[i]));
      if (pop) S.anim(badgeIn, [{ transform: 'scale(.4)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'none' }], { duration: 480, easing: SPRING });
    }
    function renderMain() {
      const main = clean(get(state, 'files.mainReport'));
      const show = folderName === 'Report' && main;
      mainP.g.style.opacity = show ? 1 : 0;
      if (show) mainP.set('main report: ' + main.split('/').pop());
    }
    function setFolder(name) {
      const f = name && FOLDERS.includes(name) ? name : folderName || 'Report';
      if (f === folderName) return;
      folderName = f;
      nameT.textContent = short(LABEL[f] || f.toLowerCase(), 15, 190, 'Epilogue');
      renderHints();
      renderCount(false);
      renderMain();
    }
    function setOpen(v) {
      open = v;
      S.wrap.classList.toggle('open', v);
      placeHints(v);
      renderCount(false);
    }
    function gulpIt(delay = 0) {
      S.anim(gulp, [{ transform: 'none' }, { transform: 'scale(1.06,.9)' }, { transform: 'scale(.97,1.04)' }, { transform: 'none' }], { duration: 460, delay, easing: 'ease-out' });
    }

    function rain(count) {
      const n = Math.min(6, Math.max(1, count | 0));
      for (let i = 0; i < n; i++) {
        const x = 290 + ((i * 37) % 80), r0 = (i % 2 ? 1 : -1) * (12 + i * 5);
        const sheet = h('g', {}, [h('rect', { x: -18, y: -23, width: 36, height: 46, rx: 4, fill: C.pill }), h('path', { d: 'M-10,-10h20M-10,-2h20M-10,6h12', stroke: C.f3, 'stroke-width': 3, 'stroke-linecap': 'round' })]);
        fly.append(sheet);
        const a = S.anim(sheet, [
          { transform: `translate(${x}px,-30px) rotate(${r0}deg)`, opacity: 0 },
          { transform: `translate(${x + 8}px,90px) rotate(${-r0 / 2}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(330px,200px) rotate(0deg) scale(.5)`, opacity: 0 }], { duration: 900, delay: i * 110, fill: 'backwards', easing: 'ease-in' });
        if (a) a.onfinish = () => sheet.remove(); else sheet.remove();
      }
      gulpIt(820 + (n - 1) * 110);
    }

    function uploaded(d) {
      const f = d.folder && FOLDERS.includes(d.folder) ? d.folder : folderName;
      const kind = kindOf(d.name);
      const now = performance.now(), at = Math.max(now, queueAt), wait = at - now;
      queueAt = at + 760;
      S.later(wait, () => {
        const name = short(clean(d.name) || 'file', 13, 150);
        const w = Math.max(120, Math.ceil(textWidth(name, 13)) + 66);
        const card = h('g', {}, [
          h('rect', { x: -w / 2, y: -24, width: w, height: 48, rx: 24, fill: '#5b3fa8' }),
          h('g', { transform: `translate(${-w / 2 + 26},0) scale(.6)` }, [docIcon(kind)]),
          h('text', { x: -w / 2 + 50, y: 5, 'font-size': 13, fill: C.pill, text: name })]);
        fly.append(card);
        const done = () => {
          card.remove();
          counts.set(f, (counts.get(f) || 0) + 1);
          recent.set(f, [kind, ...(recent.get(f) || [])].slice(0, 3));
          if (f === folderName) { renderCount(true); gulpIt(); }
        };
        const a = S.anim(card, [
          { transform: 'translate(330px,30px) scale(.6)', opacity: 0 },
          { transform: 'translate(330px,64px) scale(1)', opacity: 1, offset: 0.25 },
          { transform: 'translate(330px,72px) scale(1)', opacity: 1, offset: 0.55 },
          { transform: 'translate(330px,200px) scale(.35)', opacity: 0 }], { duration: 1200, easing: 'ease-in-out' });
        if (a) a.onfinish = done; else done();
      });
    }

    setFolder(fromScreen(currentScreen()) || 'Report');
    offs.push(on('step:change', d => { if (!S.alive()) return; const f = (d && d.step && d.step.folder && d.step.folder.name) || fromScreen(d && d.to); if (f) setFolder(f); }));
    offs.push(on('files:dragover', () => { if (S.alive() && !open) setOpen(true); }));
    offs.push(on('files:dragleave', () => { if (S.alive()) setOpen(false); }));
    offs.push(on('files:drop', d => { if (!S.alive()) return; setOpen(false); rain((d && d.count) || 1); }));
    offs.push(on('files:uploaded', d => { if (S.alive()) uploaded(d || {}); }));
    S.fonts(() => { const f = folderName; folderName = null; setFolder(f); });

    return {
      update(s) { state = s || {}; renderMain(); },
      destroy() { offs.forEach(f => f()); S.destroy(); hints = []; },
    };
  },
};
