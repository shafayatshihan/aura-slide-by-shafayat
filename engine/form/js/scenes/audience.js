// "Audience" scene: a mini auditorium seen from the back row. Seats fill with little people, coloured (and hatted) by
// the kinds of audience picked, a dial shows how much they already know, a wall clock turns its hands to the time
// limit and fills the minutes as a pink wedge, and a stack of slide cards grows to the planned slide count (about one
// per minute when Claude decides).

import { C, SPRING, EASE, h, get, clamp, clean, currentScreen, textWidth, star, pill, makeStage } from './talk.js';

// value -> [legend label, shoulder colour, hat kind]
const GROUPS = {
  'Examiners / teachers': ['examiners', C.f6, 'cap'],
  Classmates: ['classmates', C.p1, 'bun'],
  'Researchers / experts': ['experts', C.pill, 'coat'],
  Industry: ['industry', C.or2, 'hard'],
  'General public': ['public', C.f3, 'beanie'],
  'School students': ['students', C.or0, 'cap2'],
};
const ORDER = Object.keys(GROUPS);
const LEVELS = { 'New to the topic': [-62, 'almost nothing'], 'Some background': [0, 'a little'], Experts: [62, 'experts'] };
const HAIR = [C.f6, C.muted, '#3c3452'];
const ROWS = 4, PER = 7, SEATS = ROWS * PER;
const FILL = [0, 12, 17, 21, 24, 26, 27];

// A fixed shuffle of the seats so the crowd looks natural but never jumps around between renders.
const PERM = (() => {
  const a = Array.from({ length: SEATS }, (_, i) => i);
  let s = 7;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
})();

function person(kind, colour, r, k) {
  const hair = HAIR[k % HAIR.length];
  const g = h('g', {}, [
    h('path', { d: `M${-r * 1.7},${r * 1.5}C${-r * 1.7},${r * 0.2} ${-r},${-r * 0.1} 0,${-r * 0.1}C${r},${-r * 0.1} ${r * 1.7},${r * 0.2} ${r * 1.7},${r * 1.5}Z`, fill: colour }),
    h('circle', { cy: -r * 0.9, r, fill: hair })]);
  const hy = -r * 0.9;
  if (kind === 'cap') g.append(h('path', { d: `M${-r * 1.5},${hy - r * 0.75}L0,${hy - r * 1.25}L${r * 1.5},${hy - r * 0.75}L0,${hy - r * 0.3}Z`, fill: C.ink }),
    h('path', { d: `M${r * 1.1},${hy - r * 0.7}v${r * 0.9}`, stroke: C.or, 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
  if (kind === 'bun') g.append(h('circle', { cy: hy - r * 1.05, r: r * 0.5, fill: hair }), h('rect', { x: -r * 0.55, y: hy - r * 0.78, width: r * 1.1, height: r * 0.28, rx: r * 0.14, fill: C.p2 }));
  if (kind === 'coat') g.append(h('path', { d: `M${-r * 0.5},${-r * 0.1}L0,${r * 0.9}L${r * 0.5},${-r * 0.1}`, fill: C.lilac }), h('path', { d: `M${-r * 1.1},${r * 0.2}a${r * 1.2},${r * 0.9} 0 0 1 ${r * 2.2},0`, stroke: C.f4, 'stroke-width': 1.4, fill: 'none' }));
  if (kind === 'hard') g.append(h('path', { d: `M${-r * 1.15},${hy + r * 0.05}a${r * 1.15},${r * 1.15} 0 0 1 ${r * 2.3},0Z`, fill: C.or }), h('rect', { x: -r * 1.35, y: hy - r * 0.05, width: r * 2.7, height: r * 0.3, rx: r * 0.15, fill: C.or2 }));
  if (kind === 'beanie') g.append(h('path', { d: `M${-r * 1.02},${hy}a${r * 1.02},${r * 1.1} 0 0 1 ${r * 2.04},0Z`, fill: C.lilac }), h('circle', { cy: hy - r * 1.15, r: r * 0.32, fill: C.p1 }));
  if (kind === 'cap2') g.append(h('path', { d: `M${-r},${hy}a${r},${r} 0 0 1 ${r * 2},0Z`, fill: C.p2 }), h('rect', { x: -r * 0.2, y: hy - r * 0.1, width: r * 1.5, height: r * 0.32, rx: r * 0.16, fill: C.p2 }),
    h('path', { d: `M${-r * 0.9},${r * 0.2}v${r}M${r * 0.9},${r * 0.2}v${r}`, stroke: C.f5, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  return g;
}

export default {
  mount(el, ctx) {
    const S = makeStage(el, ctx, 'audience');
    S.svg.append(h('style', { text: `
      .s2d-audience .focus{transition:transform .8s ${SPRING}}
      .s2d-audience[data-focus=audience] .f-room,.s2d-audience[data-focus=audience] .f-dial,
      .s2d-audience[data-focus=time] .f-clock,.s2d-audience[data-focus=time] .f-stack{transform:scale(1.04)}
      .s2d-audience .hand{transition:transform 1.2s ${SPRING}}
      .s2d-audience .wedge{transition:stroke-dasharray 1.1s ${EASE}}
      .s2d-audience .needle{transition:transform 1.1s ${SPRING}}
      .s2d-audience .card{transition:transform .8s ${SPRING},opacity .4s ease}` }));
    const back = S.layer(S.svg, 3), mid = S.layer(S.svg, 7), front = S.layer(S.svg, 11);

    // ---- back: floor, room wall
    back.append(
      h('ellipse', { cx: 330, cy: 356, rx: 316, ry: 14, fill: C.f2, opacity: 0.55 }),
      h('path', { d: 'M28,128H362L376,326H14Z', fill: C.f1 }),
      h('path', { d: 'M28,128H362', stroke: C.f3, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    const sp = [star(392, 64, 7, C.or, 'twinkle fb'), star(640, 210, 6, C.p1, 'twinkle fb'), star(20, 90, 7, C.white, 'twinkle fb')];
    sp.forEach((s, i) => { s.style.animationDelay = `${-i * 0.9}s`; back.append(s); });

    // ---- mid: the auditorium
    const room = h('g', { class: 'focus f-room', style: { transformOrigin: '195px 330px' } });
    room.append(
      h('rect', { x: 118, y: 52, width: 154, height: 66, rx: 6, fill: C.pill }),
      h('rect', { x: 110, y: 46, width: 170, height: 8, rx: 4, fill: C.f5 }),
      h('rect', { x: 128, y: 64, width: 64, height: 9, rx: 4.5, fill: C.p1 }),
      h('rect', { x: 128, y: 80, width: 96, height: 6, rx: 3, fill: C.f2 }),
      h('rect', { x: 128, y: 92, width: 72, height: 6, rx: 3, fill: C.f2 }),
      h('circle', { cx: 248, cy: 92, r: 13, fill: C.lilac }),
      h('circle', { cx: 248, cy: 92, r: 5, fill: C.or, class: 'glow' }));
    const seats = [];
    for (let r = 0; r < ROWS; r++) {
      const w = 30 + r * 3.6, gap = 6 + r, y = 150 + r * 44, rowW = PER * w + (PER - 1) * gap, x0 = 195 - rowW / 2;
      const row = h('g');
      row.append(h('rect', { x: x0 - 8, y: y + 18, width: rowW + 16, height: 12, rx: 6, fill: C.f2 }));
      for (let c = 0; c < PER; c++) {
        const x = x0 + c * (w + gap), cx = x + w / 2;
        const rad = 8.5 + r * 1.2;
        const slot = h('g', { transform: `translate(${cx},${y - rad * 0.55})` });
        const seat = h('g', {}, [
          h('rect', { x, y, width: w, height: 24 + r * 2, rx: 7, fill: C.f4 }),
          h('rect', { x: x + 3, y: y + 3, width: w - 6, height: 5, rx: 2.5, fill: C.f3 })]);
        row.append(slot, seat);
        seats.push({ slot, r, grp: null, node: null, rad });
      }
      room.append(row);
    }
    mid.append(room);
    const legend = h('g');
    mid.append(legend);

    // ---- front right: knowledge dial
    const dial = h('g', { class: 'focus f-dial', style: { transformOrigin: '512px 150px' } });
    const arc = (a0, a1, col) => {
      const R = 66, p = a => [512 + R * Math.cos(a * Math.PI / 180), 150 + R * Math.sin(a * Math.PI / 180)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      return h('path', { d: `M${x0},${y0}A${R},${R} 0 0 1 ${x1},${y1}`, stroke: col, 'stroke-width': 16, fill: 'none', 'stroke-linecap': 'round' });
    };
    dial.append(
      h('path', { d: 'M428,150a84,84 0 0 1 168,0Z', fill: C.pill }),
      arc(186, 236, C.f2), arc(244, 296, C.f4), arc(304, 354, C.p2),
      h('text', { x: 450, y: 172, 'font-size': 13, 'text-anchor': 'middle', fill: C.muted, text: 'new' }),
      h('text', { x: 574, y: 172, 'font-size': 13, 'text-anchor': 'middle', fill: C.muted, text: 'expert' }));
    const needle = h('g', { class: 'needle', style: { transformOrigin: '512px 150px' } }, [
      h('path', { d: 'M508,150L512,96L516,150Z', fill: C.ink }), h('circle', { cx: 512, cy: 150, r: 8, fill: C.ink }), h('circle', { cx: 512, cy: 150, r: 3, fill: C.or })]);
    dial.append(needle);
    const levelP = pill({ x: 512, y: 160, ht: 24, pad: 10, size: 13, align: 'center', max: 140 });
    const knowT = h('text', { x: 512, y: 52, 'font-size': 13, 'text-anchor': 'middle', fill: C.muted, text: 'they already know' });
    dial.append(levelP.g, knowT);
    front.append(dial);

    // ---- front right: the clock
    const clock = h('g', { class: 'focus f-clock', style: { transformOrigin: '458px 278px' } });
    const CX = 458, CY = 278, CIRC = 2 * Math.PI * 24;
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = i * 30 * Math.PI / 180, r0 = i % 3 ? 44 : 40;
      return `M${CX + r0 * Math.sin(a)},${CY - r0 * Math.cos(a)}L${CX + 49 * Math.sin(a)},${CY - 49 * Math.cos(a)}`;
    }).join('');
    const wedge = h('circle', { cx: CX, cy: CY, r: 24, fill: 'none', stroke: C.p0, 'stroke-width': 48, class: 'wedge', transform: `rotate(-90 ${CX} ${CY})`, 'stroke-dasharray': `0 ${CIRC}` });
    const minH = h('g', { class: 'hand', style: { transformOrigin: `${CX}px ${CY}px` } }, [h('rect', { x: CX - 2.5, y: CY - 42, width: 5, height: 46, rx: 2.5, fill: C.ink })]);
    const hrH = h('g', { class: 'hand', style: { transformOrigin: `${CX}px ${CY}px` } }, [h('rect', { x: CX - 3.5, y: CY - 28, width: 7, height: 32, rx: 3.5, fill: C.p2 })]);
    clock.append(
      h('circle', { cx: CX + 4, cy: CY + 5, r: 58, fill: C.f4 }),
      h('circle', { cx: CX, cy: CY, r: 58, fill: C.f5 }),
      h('circle', { cx: CX, cy: CY, r: 51, fill: C.pill }),
      wedge,
      h('path', { d: ticks, stroke: C.f5, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
      h('rect', { x: CX - 6, y: CY - 70, width: 12, height: 10, rx: 3, fill: C.f6 }),
      hrH, minH,
      h('circle', { cx: CX, cy: CY, r: 5.5, fill: C.ink }), h('circle', { cx: CX, cy: CY, r: 2, fill: C.or }));
    const minP = pill({ x: CX, y: 350, ht: 26, pad: 11, size: 13, align: 'center', max: 150 });
    const qaP = pill({ x: CX + 44, y: 208, ht: 22, pad: 9, size: 13, fill: C.lilac, color: C.ink, max: 100 });
    clock.append(minP.g, qaP.g);
    front.append(clock);

    // ---- front right: the slide stack
    const stack = h('g', { class: 'focus f-stack', style: { transformOrigin: '590px 320px' } });
    const cards = h('g');
    const stackP = pill({ x: 594, y: 350, ht: 26, pad: 11, size: 13, align: 'center', max: 126 });
    stack.append(h('ellipse', { cx: 594, cy: 334, rx: 44, ry: 6, fill: C.f4, opacity: 0.45 }), cards, stackP.g);
    front.append(stack);
    let cardNodes = [];

    // ---- state
    let last = {};
    const focus = s => { S.wrap.dataset.focus = ['audience', 'time'].includes(s) ? s : ''; };
    focus(currentScreen());
    S.onBus('step:change', d => focus(d.to));

    function renderSeats(who, force) {
      const g = who.length, n = FILL[clamp(g, 0, 6)];
      const want = new Array(SEATS).fill(null);
      for (let k = 0; k < n; k++) want[PERM[k]] = who[k % g];
      let delay = 0;
      seats.forEach((s, i) => {
        if (s.grp === want[i]) return;
        if (s.node) {
          const old = s.node;
          const a = force ? null : S.anim(old, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(14px)', opacity: 0 }], { duration: 300 });
          if (a) S.later(310, () => old.remove()); else old.remove();
          s.node = null;
        }
        s.grp = want[i];
        if (!s.grp) return;
        const [, col, kind] = GROUPS[s.grp];
        const bob = h('g', { class: i % 3 ? '' : 'bob-s', style: { animationDelay: `${-(i * 0.37) % 4.6}s`, animationDuration: `${4 + (i % 5) * 0.35}s` } }, [person(kind, col, s.rad, i)]);
        const node = h('g', {}, [bob]);
        s.slot.append(node);
        s.node = node;
        if (!force) S.anim(node, [{ transform: 'translateY(22px) scale(.6)', opacity: 0 }, { transform: 'translateY(-4px) scale(1.05)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: (delay++) * 28, fill: 'backwards', easing: 'ease-out' });
      });
      // legend chips, flowing over two lines under the room
      legend.replaceChildren();
      if (!g) {
        const p = pill({ x: 195, y: 340, ht: 26, pad: 11, size: 13, fill: C.f1, color: C.muted, align: 'center', max: 200 }).set('who’s coming?');
        legend.append(p.g);
        return;
      }
      let x = 0, y = 0;
      const chips = who.map(v => {
        const [label, col] = GROUPS[v];
        const w = Math.ceil(textWidth(label, 13)) + 34;
        if (x + w > 350 && x > 0) { x = 0; y += 28; }
        const chip = h('g', { transform: `translate(${x},${y})` }, [
          h('rect', { width: w, height: 24, rx: 12, fill: C.pill }),
          h('circle', { cx: 13, cy: 12, r: 6, fill: col, stroke: col === C.pill ? C.f4 : 'none', 'stroke-width': 1.5 }),
          h('text', { x: 24, y: 16.5, 'font-size': 13, fill: C.ink, text: label })]);
        x += w + 6;
        return chip;
      });
      const rows = y / 28 + 1;
      const wrapG = h('g', { transform: `translate(20,${rows > 1 ? 334 : 344})` }, chips);
      legend.append(wrapG);
    }

    function renderLevel(level) {
      const L = LEVELS[level];
      needle.style.transform = `rotate(${L ? L[0] : 0}deg)`;
      levelP.set(L ? L[1] : 'not sure yet');
      levelP.rect.setAttribute('fill', L ? C.ink : C.f4);
    }

    function renderTime(minutes, qa, slides, force) {
      const m = +minutes > 0 ? Math.round(+minutes) : 0;
      minH.style.transform = `rotate(${m * 6}deg)`;
      hrH.style.transform = `rotate(${m * 0.5}deg)`;
      wedge.setAttribute('stroke-dasharray', `${(Math.min(m, 60) / 60) * CIRC} ${CIRC}`);
      wedge.setAttribute('stroke', m > 60 ? C.p1 : C.p0);
      const hh = Math.floor(m / 60), mm = m % 60;
      minP.set(!m ? 'how long?' : hh ? `${hh} h${mm ? ` ${mm} min` : ''}` : `${m} min`);
      minP.rect.setAttribute('fill', m ? C.ink : C.f4);
      const q = qa === '' || qa == null ? null : +qa;
      qaP.g.style.opacity = q != null && !isNaN(q) ? 1 : 0;
      if (q != null && !isNaN(q)) qaP.set(q ? `+${q} min q&a` : 'no q&a');

      const set = +slides > 0 ? Math.round(+slides) : 0;
      const count = set || m;
      const show = Math.min(12, count);
      while (cardNodes.length > Math.max(show, 1)) {
        const c = cardNodes.pop();
        c.style.opacity = 0;
        c.style.transform = `translate(${c._x}px,${c._y - 24}px)`;
        S.later(420, () => c.remove());
      }
      for (let i = 0; i < Math.max(show, 1); i++) {
        let c = cardNodes[i];
        const x = 566 - i * 1.2 + (i % 2 ? 2 : -2), y = 318 - i * 5;
        if (!c) {
          c = h('g', { class: 'card' }, [
            h('rect', { width: 60, height: 40, rx: 6, fill: C.f4 }),
            h('rect', { x: 0, y: -2, width: 60, height: 40, rx: 6, fill: C.pill }),
            h('rect', { x: 8, y: 6, width: 26, height: 6, rx: 3, fill: [C.p1, C.f5, C.or][i % 3] }),
            h('rect', { x: 8, y: 17, width: 40, height: 4, rx: 2, fill: C.f2 }),
            h('rect', { x: 8, y: 25, width: 30, height: 4, rx: 2, fill: C.f2 })]);
          cards.append(c);
          cardNodes[i] = c;
          if (!force) S.anim(c, [{ transform: `translate(${x}px,${y - 60}px) rotate(-8deg)`, opacity: 0 }, { transform: `translate(${x}px,${y}px)`, opacity: 1 }], { duration: 520, delay: (i % 6) * 40, fill: 'backwards', easing: SPRING });
        }
        c._x = x; c._y = y;
        c.style.transform = `translate(${x}px,${y}px) rotate(${i % 3 === 1 ? 2 : i % 3 === 2 ? -1.5 : 0}deg)`;
        c.style.opacity = count ? 1 : 0.45;
      }
      stackP.set(!count ? 'slides?' : set ? `${set} slide${set === 1 ? '' : 's'}` : `about ${m} slides`);
      stackP.rect.setAttribute('fill', count ? (set ? C.ink : C.f6) : C.f4);
    }

    function render(state, force) {
      const who = (Array.isArray(get(state, 'audience.who')) ? get(state, 'audience.who') : []).filter(v => GROUPS[v]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const level = clean(get(state, 'audience.level'));
      const minutes = get(state, 'audience.minutes'), qa = get(state, 'audience.qa'), slides = get(state, 'audience.slides');
      const wk = who.join('|'), tk = [minutes, qa, slides].join('|');
      if (force || wk !== last.wk) renderSeats(who, force);
      if (force || level !== last.level) renderLevel(level);
      if (force || tk !== last.tk) renderTime(minutes, qa, slides, force);
      last = { wk, level, tk };
    }

    let state = ctx.getState ? ctx.getState() : {};
    render(state || {}, true);
    S.fonts(() => { last = {}; seats.forEach(s => { s.grp = null; if (s.node) { s.node.remove(); s.node = null; } }); render(state || {}, true); });
    return {
      update(s) { state = s || {}; render(state, false); },
      destroy() { S.destroy(); cardNodes = []; },
    };
  },
};
