// "Extras" scene: presentation day. A hanging screen shows tiles for everything to include (and the citation style),
// a projector, a big TV, a laptop in a video call and a phone appear for each place picked, a wifi sign is crossed
// out when there will be no internet, and the desk in front holds the PDF / PowerPoint backup cards, speaker notes
// (with a stopwatch for a timed script), a clicker, and a sticky note with the deadline and notes for Claude.

import { C, SPRING, h, get, clean, currentScreen, wrap, setLines, short, star, pill, makeStage, DOT } from './talk.js';

const INCLUDE = ['Equations', 'Tables', 'Charts from my data', 'My photos', 'Videos', 'References slide', 'Acknowledgements slide', 'Thank you and questions slide', 'Contact details'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const arr = v => (Array.isArray(v) ? v : []);

// A 40 x 34 tile for one kind of content, top-left at 0,0.
function tile(kind, i) {
  const bg = [C.p0, C.f1, C.or0, C.lilac][i % 4];
  const s = { stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' };
  const g = h('g', {}, [h('rect', { width: 40, height: 34, rx: 7, fill: bg })]);
  const t = (str, size = 14) => h('text', { x: 20, y: 17 + size * 0.36, 'font-size': size, class: 'ep', 'text-anchor': 'middle', fill: C.ink, text: str });
  switch (kind) {
    case 'Equations': g.append(t('x²', 15)); break;
    case 'Tables': g.append(h('rect', { x: 9, y: 8, width: 22, height: 18, rx: 2, ...s }), h('path', { d: 'M9,14H31M20,8V26', ...s, 'stroke-width': 1.8 })); break;
    case 'Charts from my data': g.append(h('path', { d: 'M12,26V18M20,26V10M28,26V15', ...s, 'stroke-width': 4.5, stroke: C.p2 })); break;
    case 'My photos': g.append(h('path', { d: 'M8,26L16,15L22,21L26,17L33,26Z', fill: C.f5 }), h('circle', { cx: 28, cy: 10, r: 3.5, fill: C.or })); break;
    case 'Videos': g.append(h('path', { d: 'M15,9V25L28,17Z', fill: C.p2 })); break;
    case 'References slide': g.append(t('[1]', 13)); break;
    case 'Acknowledgements slide': g.append(h('path', { d: 'M20,26C10,19 10,10 15.5,10C18,10 20,13 20,13C20,13 22,10 24.5,10C30,10 30,19 20,26Z', fill: C.p2 })); break;
    case 'Thank you and questions slide': g.append(t('?', 16)); break;
    case 'Contact details': g.append(h('rect', { x: 9, y: 10, width: 22, height: 15, rx: 2, ...s }), h('path', { d: 'M9,11L20,19L31,11', ...s, 'stroke-width': 1.8 })); break;
  }
  return g;
}
function backupCard(kind) {
  const col = kind === 'PDF' ? C.p2 : C.or2;
  return h('g', {}, [
    h('path', { d: 'M-23,-58H9L27,-40V4H-23Z', fill: C.f4, transform: 'translate(4,0)' }),
    h('path', { d: 'M-27,-62H5L23,-44V0H-27Z', fill: C.pill }),
    h('path', { d: 'M5,-62V-44H23Z', fill: C.f2 }),
    h('rect', { x: -27, y: -26, width: 50, height: 18, fill: col }),
    h('text', { x: -2, y: -12.5, 'font-size': 13, class: 'ep', 'text-anchor': 'middle', fill: C.pill, text: kind === 'PDF' ? 'PDF' : 'PPT' }),
    h('path', { d: 'M-19,-50h16M-19,-42h26', stroke: C.f3, 'stroke-width': 3, 'stroke-linecap': 'round' })]);
}

export default {
  mount(el, ctx) {
    const S = makeStage(el, ctx, 'extras');
    S.svg.append(h('style', { text: `
      .s2d-extras .focus{transition:transform .8s ${SPRING}}
      .s2d-extras[data-focus=content] .f-screen{transform:scale(1.04)}
      .s2d-extras[data-focus=where] .f-dev{transform:scale(1.05)}
      .s2d-extras[data-focus=help] .f-desk{transform:scale(1.04)}
      .s2d-extras[data-focus=extra] .f-sticky{transform:scale(1.08)}
      .s2d-extras .dev{transition:transform .75s ${SPRING},opacity .45s ease;transform-box:fill-box;transform-origin:50% 100%}
      .s2d-extras .dev.off{transform:scale(.6) translateY(16px);opacity:0}
      .s2d-extras .wave{animation:ex-wave 2.4s ease-in-out infinite}
      @keyframes ex-wave{0%,100%{opacity:.35}40%{opacity:1}}` }));
    const back = S.layer(S.svg, 3), mid = S.layer(S.svg, 7), front = S.layer(S.svg, 12);

    // ---- back: wall, sparkles
    back.append(h('ellipse', { cx: 330, cy: 360, rx: 316, ry: 12, fill: C.f2, opacity: 0.55 }));
    const sp = [star(176, 30, 6, C.or, 'twinkle fb'), star(486, 40, 7, C.p1, 'twinkle fb'), star(16, 250, 6, C.white, 'twinkle fb')];
    sp.forEach((s, i) => { s.style.animationDelay = `${-i * 0.9}s`; back.append(s); });

    // ---- mid: the hanging screen with content tiles
    const screen = h('g', { class: 'focus f-screen', style: { transformOrigin: '330px 100px' } });
    screen.append(
      h('path', { d: 'M226,0V24M434,0V24', stroke: C.f6, 'stroke-width': 2 }),
      h('rect', { x: 196, y: 20, width: 268, height: 12, rx: 6, fill: C.f5 }),
      h('rect', { x: 202, y: 30, width: 256, height: 148, rx: 6, fill: C.pill }),
      h('rect', { x: 202, y: 30, width: 256, height: 6, fill: C.f1 }));
    const kicker = pill({ x: 214, y: 42, ht: 22, pad: 9, size: 13, max: 150 });
    const citeP = pill({ x: 446, y: 42, ht: 22, pad: 9, size: 13, fill: C.lilac, color: C.ink, align: 'right', max: 110 });
    const tilesG = h('g');
    const laser = h('circle', { cx: 430, cy: 160, r: 4, fill: C.or2, class: 'glow', style: { opacity: 0 } });
    screen.append(kicker.g, citeP.g, tilesG, laser);
    mid.append(screen);

    // ---- mid: devices
    const devs = h('g', { class: 'focus f-dev', style: { transformOrigin: '330px 200px' } });
    const proj = h('g', { class: 'dev' }, [
      h('path', { d: 'M318,206H342L446,178H214Z', fill: C.white, opacity: 0.45 }),
      h('rect', { x: 296, y: 202, width: 68, height: 26, rx: 9, fill: C.f5 }),
      h('rect', { x: 296, y: 202, width: 68, height: 8, rx: 4, fill: C.f4 }),
      h('circle', { cx: 330, cy: 216, r: 8, fill: C.f6 }), h('circle', { cx: 330, cy: 216, r: 4, fill: C.lilac }),
      h('circle', { cx: 352, cy: 220, r: 3, fill: C.or, class: 'glow' }),
      h('rect', { x: 304, y: 227, width: 9, height: 6, rx: 2, fill: C.f6 }), h('rect', { x: 347, y: 227, width: 9, height: 6, rx: 2, fill: C.f6 })]);
    const tv = h('g', { class: 'dev' }, [
      h('path', { d: 'M86,206L74,232M118,206L130,232', stroke: C.f6, 'stroke-width': 5, 'stroke-linecap': 'round' }),
      h('rect', { x: 30, y: 116, width: 144, height: 92, rx: 8, fill: C.ink }),
      h('rect', { x: 37, y: 123, width: 130, height: 76, rx: 3, fill: C.f1 }),
      h('rect', { x: 47, y: 134, width: 52, height: 9, rx: 4.5, fill: C.p1 }),
      h('rect', { x: 47, y: 150, width: 80, height: 6, rx: 3, fill: C.f3 }), h('rect', { x: 47, y: 162, width: 64, height: 6, rx: 3, fill: C.f3 }),
      h('circle', { cx: 146, cy: 176, r: 12, fill: C.lilac }),
      h('circle', { cx: 160, cy: 203, r: 1.8, fill: C.or, class: 'glow' })]);
    const lap = h('g', { class: 'dev' });
    lap.append(h('rect', { x: 490, y: 128, width: 128, height: 82, rx: 7, fill: C.f6 }), h('rect', { x: 496, y: 134, width: 116, height: 70, rx: 3, fill: C.f1 }));
    [[498, 136], [556, 136], [498, 170], [556, 170]].forEach(([x, y], i) => lap.append(
      h('rect', { x, y, width: 54, height: 32, rx: 3, fill: [C.lilac, C.p0, C.or0, C.f2][i] }),
      h('circle', { cx: x + 27, cy: y + 13, r: 6, fill: [C.f5, C.p2, C.or2, C.f6][i] }),
      h('path', { d: `M${x + 15},${y + 32}a12,9 0 0 1 24,0Z`, fill: [C.f5, C.p2, C.or2, C.f6][i] })));
    lap.append(h('path', { d: 'M478,210H630L620,222H488Z', fill: C.f5 }), h('rect', { x: 540, y: 210, width: 28, height: 4, rx: 2, fill: C.f6 }));
    const phone = h('g', { class: 'dev' }, [
      h('rect', { x: 590, y: 40, width: 40, height: 70, rx: 9, fill: C.ink }),
      h('rect', { x: 594, y: 48, width: 32, height: 52, rx: 3, fill: C.p0 }),
      h('rect', { x: 598, y: 56, width: 18, height: 5, rx: 2.5, fill: C.p2 }), h('rect', { x: 598, y: 66, width: 24, height: 4, rx: 2, fill: C.f3 }),
      h('rect', { x: 604, y: 103, width: 12, height: 3, rx: 1.5, fill: C.f5 })]);
    // the laptop sits a little higher and the phone leans on the desk, clear of the sticky note
    lap.append(h('g', { transform: 'translate(0,-32)' }, [...lap.childNodes]));
    phone.append(h('g', { transform: 'translate(-126,186)' }, [...phone.childNodes]));
    devs.append(proj, tv, lap, phone);
    mid.append(devs);
    const DEV = { 'Projector in a room': proj, 'Big TV': tv, 'Online meeting': lap, Phone: phone };

    // wifi sign
    const wifi = h('g', { class: 'focus f-dev', style: { transformOrigin: '60px 60px' } });
    const arcs = [16, 28, 40].map((r, i) => h('path', { d: `M${60 - r * 0.8},${74 - r * 0.6}A${r},${r} 0 0 1 ${60 + r * 0.8},${74 - r * 0.6}`, stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none', style: { animationDelay: `${i * 0.25}s` } }));
    const slash = h('path', { d: 'M28,28L92,86', stroke: C.p2, 'stroke-width': 6, 'stroke-linecap': 'round', class: 'fade' });
    const wifiP = pill({ x: 60, y: 86, ht: 24, pad: 10, size: 13, align: 'center', max: 130 });
    wifi.append(h('circle', { cx: 60, cy: 56, r: 46, fill: C.pill }), ...arcs, h('circle', { cx: 60, cy: 76, r: 5, fill: C.ink }), slash, wifiP.g);
    mid.append(wifi);

    // ---- front: the desk and what is on it
    const desk = h('g', { class: 'focus f-desk', style: { transformOrigin: '300px 300px' } });
    front.append(
      h('rect', { x: 40, y: 312, width: 14, height: 48, rx: 4, fill: C.f5 }), h('rect', { x: 606, y: 312, width: 14, height: 48, rx: 4, fill: C.f5 }),
      h('rect', { x: 20, y: 296, width: 620, height: 20, rx: 10, fill: C.f4 }),
      h('rect', { x: 30, y: 299, width: 600, height: 3, rx: 1.5, fill: C.white, opacity: 0.5 }));
    front.append(desk);
    const pdfC = h('g', { class: 'dev' }, [h('g', { transform: 'translate(76,296) rotate(-5)' }, [backupCard('PDF')])]);
    const pptC = h('g', { class: 'dev' }, [h('g', { transform: 'translate(132,296) rotate(4)' }, [backupCard('PPT')])]);
    const notes = h('g', { class: 'dev' }, [
      h('rect', { x: 214, y: 236, width: 64, height: 60, rx: 6, fill: C.f4, transform: 'rotate(-3 246 266)' }),
      h('rect', { x: 210, y: 232, width: 64, height: 62, rx: 6, fill: C.or0 }),
      h('rect', { x: 210, y: 232, width: 64, height: 12, rx: 6, fill: C.or }),
      h('path', { d: 'M220,256h44M220,266h38M220,276h42M220,286h26', stroke: C.or2, 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.7 })]);
    const watch = h('g', { class: 'dev' }, [
      h('rect', { x: 307, y: 242, width: 10, height: 8, rx: 2, fill: C.f6 }),
      h('circle', { cx: 312, cy: 272, r: 23, fill: C.f6 }), h('circle', { cx: 312, cy: 272, r: 18, fill: C.pill }),
      h('path', { d: 'M312,272L312,259', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round', class: 'spin', style: { transformOrigin: '312px 272px', animationDuration: '6s' } }),
      h('circle', { cx: 312, cy: 272, r: 3, fill: C.p2 })]);
    const clicker = h('g', { class: 'dev' }, [h('g', { transform: 'rotate(-14 412 276)' }, [
      h('rect', { x: 398, y: 244, width: 28, height: 52, rx: 13, fill: C.f6 }),
      h('circle', { cx: 412, cy: 260, r: 6.5, fill: C.or }), h('rect', { x: 405, y: 274, width: 14, height: 6, rx: 3, fill: C.f4 }),
      h('rect', { x: 405, y: 284, width: 14, height: 6, rx: 3, fill: C.f4 })])]);
    const clickQ = h('g', { class: 'dev' }, [h('g', { class: 'bob' }, [
      h('circle', { cx: 444, cy: 236, r: 14, fill: C.pill }), h('path', { d: 'M434,246L430,256L442,249Z', fill: C.pill }),
      h('text', { x: 444, y: 241.5, 'font-size': 15, class: 'ep', 'text-anchor': 'middle', fill: C.p2, text: '?' })])]);
    desk.append(pdfC, pptC, notes, watch, clicker, clickQ);
    const backP = pill({ x: 104, y: 326, ht: 24, pad: 10, size: 13, align: 'center', max: 150 });
    const helpP = pill({ x: 262, y: 326, ht: 24, pad: 10, size: 13, align: 'center', max: 150 });
    const clickP = pill({ x: 414, y: 326, ht: 24, pad: 10, size: 13, align: 'center', max: 130 });
    desk.append(backP.g, helpP.g, clickP.g);

    // sticky note for the deadline / things to avoid / other notes
    const sticky = h('g', { class: 'focus f-sticky', style: { transformOrigin: '576px 260px' } });
    const stickyIn = h('g', { class: 'sway-s fbt', style: { animationDuration: '5.6s' } });
    const dueT = h('text', { x: 500, y: 228, 'font-size': 15, class: 'ep', fill: C.ink });
    const noteT = h('text', { x: 500, y: 248, 'font-size': 13, fill: C.ink });
    stickyIn.append(
      h('rect', { x: 494, y: 210, width: 132, height: 84, rx: 6, fill: C.f4, transform: 'rotate(3 560 252)' }),
      h('rect', { x: 490, y: 206, width: 132, height: 84, rx: 6, fill: C.lilac }),
      h('rect', { x: 538, y: 200, width: 36, height: 12, rx: 3, fill: C.white, opacity: 0.7 }),
      dueT, noteT);
    sticky.append(h('g', { transform: 'translate(18,4)' }, [stickyIn]));
    front.append(sticky);

    // ---- state
    let last = {};
    const focus = s => { S.wrap.dataset.focus = ['content', 'where', 'help', 'extra'].includes(s) ? s : ''; };
    focus(currentScreen());
    S.onBus('step:change', d => focus(d.to));
    const show = (n, v) => n.classList.toggle('off', !v);

    function renderScreen(include, cite) {
      const items = INCLUDE.filter(k => include.includes(k));
      tilesG.replaceChildren();
      items.forEach((k, i) => {
        const x = 216 + (i % 5) * 48, y = 76 + Math.floor(i / 5) * 44;
        const t = h('g', { transform: `translate(${x},${y})` }, [h('g', { class: 'fb' }, [tile(k, i)])]);
        tilesG.append(t);
        if (!last.items || !last.items.includes(k)) S.anim(t.firstChild, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: i * 30, fill: 'backwards', easing: 'ease-out' });
      });
      if (!items.length) tilesG.append(h('text', { x: 330, y: 112, 'font-size': 13, 'text-anchor': 'middle', fill: C.muted, text: 'pick what to include' }));
      kicker.set(items.length ? `${items.length} extra${items.length === 1 ? '' : 's'} included` : 'your slides');
      kicker.rect.setAttribute('fill', items.length ? C.ink : C.f4);
      citeP.g.style.opacity = cite ? 1 : 0;
      if (cite) citeP.set(cite === 'My department’s style' ? 'dept style' : cite);
      return items;
    }

    function renderWhere(where, offline) {
      Object.entries(DEV).forEach(([k, n]) => show(n, where.includes(k)));
      const off = /no internet/i.test(offline), known = !!offline;
      arcs.forEach(a => { a.setAttribute('stroke', off || !known ? C.f3 : C.ink); a.classList.toggle('wave', known && !off); });
      slash.style.opacity = off ? 1 : 0;
      wifiP.set(!known ? 'internet?' : off ? 'works offline' : 'internet ok');
      wifiP.rect.setAttribute('fill', !known ? C.f4 : off ? C.f6 : C.ink);
    }

    function renderHelp(backups, help, clickerV) {
      show(pdfC, backups.includes('PDF'));
      show(pptC, backups.includes('PowerPoint'));
      backP.set(backups.length ? backups.map(b => (b === 'PowerPoint' ? 'ppt' : b.toLowerCase())).join(' + ') + ' backup' : 'no backups');
      backP.rect.setAttribute('fill', backups.length ? C.ink : C.f4);
      const notesOn = help.includes('Speaker notes') || help.includes('Timed speaker script');
      show(notes, notesOn);
      show(watch, help.includes('Timed speaker script'));
      helpP.set(help.includes('Timed speaker script') ? (help.includes('Speaker notes') ? 'notes + timed script' : 'timed script') : notesOn ? 'speaker notes' : 'no notes');
      helpP.rect.setAttribute('fill', notesOn ? C.ink : C.f4);
      show(clicker, clickerV !== 'No');
      clicker.style.opacity = clickerV === 'Yes' || clickerV === 'No' ? '' : 0.6;
      show(clickQ, clickerV !== 'Yes' && clickerV !== 'No');
      laser.style.opacity = clickerV === 'Yes' ? 1 : 0;
      clickP.set(clickerV === 'Yes' ? 'clicker' : clickerV === 'No' ? 'no clicker' : 'clicker?');
      clickP.rect.setAttribute('fill', clickerV === 'Yes' ? C.ink : C.f4);
    }

    function renderSticky(deadline, avoid, notesV) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline || '');
      dueT.textContent = m ? `due ${+m[3]} ${MONTHS[+m[2] - 1]}` : deadline ? short('due ' + deadline, 15, 116, 'Epilogue') : 'for claude';
      dueT.setAttribute('fill', m || deadline ? C.ink : C.f6);
      const text = [avoid ? 'avoid: ' + avoid : '', notesV].filter(Boolean).join(` ${DOT} `);
      setLines(noteT, wrap(text || 'deadline and notes', { size: 13, width: 118, lines: 2 }).lines, 17);
      noteT.setAttribute('fill', text ? C.ink : C.muted);
    }

    function render(state, force) {
      const include = arr(get(state, 'content.include')), cite = clean(get(state, 'content.citations'));
      const where = arr(get(state, 'delivery.where')), offline = clean(get(state, 'delivery.offline'));
      const backups = arr(get(state, 'delivery.backups')), help = arr(get(state, 'delivery.help')), clickerV = clean(get(state, 'delivery.clicker'));
      const deadline = clean(get(state, 'extra.deadline')), avoid = clean(get(state, 'extra.avoid')), notesV = clean(get(state, 'extra.notes'));
      const k1 = include.join('|') + cite, k2 = where.join('|') + offline, k3 = [backups.join('|'), help.join('|'), clickerV].join('/'), k4 = [deadline, avoid, notesV].join('/');
      let items = last.items;
      if (force || k1 !== last.k1) { if (force) last.items = include; items = renderScreen(include, cite); }
      if (force || k2 !== last.k2) renderWhere(where, offline);
      if (force || k3 !== last.k3) renderHelp(backups, help, clickerV);
      if (force || k4 !== last.k4) renderSticky(deadline, avoid, notesV);
      last = { k1, k2, k3, k4, items };
    }

    let state = ctx.getState ? ctx.getState() : {};
    render(state || {}, true);
    S.fonts(() => render(state || {}, true));
    return {
      update(s) { state = s || {}; render(state, false); },
      destroy() { S.destroy(); },
    };
  },
};
