// "Results" scene: a results board where a bar grows for every key result (taller for bigger numbers, with the value
// on top and a star on the best one), a little mountain whose flag sits on the summit when the work is finished or
// half-way up the trail while it is still going, and a ribbon across the front with the one thing to remember.

import { C, SPRING, EASE, h, get, clean, currentScreen, wrap, fitLines, setLines, textWidth, star, pill, makeStage } from './talk.js';

const COLS = [C.p1, C.f5, C.or, C.p2, C.f4];
// a result without a value shows a tick instead of repeating its name
const TICK = String.fromCharCode(10003);
const BASE = 262, LEFT = 44, AREA = 370, MAXH = 150;

function num(v) {
  const m = /-?\d[\d,]*(\.\d+)?|-?\.\d+/.exec(String(v || ''));
  if (!m) return null;
  const n = parseFloat(m[0].replace(/,/g, ''));
  return isFinite(n) ? Math.abs(n) : null;
}

export default {
  mount(el, ctx) {
    const S = makeStage(el, ctx, 'results');
    S.svg.append(h('style', { text: `
      .s2d-results .focus{transition:transform .8s ${SPRING}}
      .s2d-results[data-focus=results] .f-board,.s2d-results[data-focus=results] .f-ribbon{transform:scale(1.03)}
      .s2d-results[data-focus=status] .f-hill{transform:scale(1.05)}
      .s2d-results .bar{transition:y .9s ${SPRING},height .9s ${SPRING},fill .5s ease}
      .s2d-results .slot{transition:transform .8s ${EASE},opacity .4s ease}
      .s2d-results .lift{transition:transform .9s ${SPRING},opacity .4s ease}
      .s2d-results .flag{transition:transform 1.2s ${SPRING}}` }));
    const back = S.layer(S.svg, 3), mid = S.layer(S.svg, 7), front = S.layer(S.svg, 12);

    // ---- back: floor, sparkles
    back.append(h('ellipse', { cx: 330, cy: 352, rx: 316, ry: 14, fill: C.f2, opacity: 0.55 }));
    const sp = [star(440, 40, 7, C.or, 'twinkle fb'), star(16, 200, 6, C.p1, 'twinkle fb'), star(648, 120, 7, C.white, 'twinkle fb')];
    sp.forEach((s, i) => { s.style.animationDelay = `${-i * 0.9}s`; back.append(s); });

    // ---- mid: the board
    const board = h('g', { class: 'focus f-board', style: { transformOrigin: '225px 320px' } });
    board.append(
      h('rect', { x: 26, y: 44, width: 410, height: 276, rx: 18, fill: C.f4 }),
      h('rect', { x: 20, y: 38, width: 410, height: 276, rx: 18, fill: C.pill }),
      ...[0, 1, 2].map(i => h('path', { d: `M${LEFT - 6},${BASE - 50 * (i + 1)}H${LEFT + AREA}`, stroke: C.f1, 'stroke-width': 2, 'stroke-dasharray': '2 6', 'stroke-linecap': 'round' })),
      h('path', { d: `M${LEFT - 6},${BASE}H${LEFT + AREA}`, stroke: C.f5, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    const head = pill({ x: 36, y: 52, ht: 24, pad: 10, size: 13, max: 200 });
    board.append(head.g);
    const bars = h('g');
    board.append(bars);
    mid.append(board);
    let slots = [];

    // ---- mid: the hill and the flag
    const hill = h('g', { class: 'focus f-hill', style: { transformOrigin: '550px 320px' } });
    hill.append(
      h('path', { d: 'M446,324C480,262 520,176 554,152C590,176 622,262 654,324Z', fill: C.f3 }),
      h('path', { d: 'M534,170C542,160 548,154 554,152C560,154 568,160 576,170C568,176 562,170 556,178C548,170 542,176 534,170Z', fill: C.f1 }),
      h('path', { d: 'M600,324C590,280 600,250 612,236C626,262 640,296 654,324Z', fill: C.f4, opacity: 0.6 }),
      h('path', { d: 'M470,316L520,292L500,266L536,236L520,206L552,166', stroke: C.pill, 'stroke-width': 3, 'stroke-dasharray': '2 7', 'stroke-linecap': 'round', fill: 'none' }));
    const flagPos = { Finished: [552, 158], 'Still going': [520, 210], '': [472, 314] };
    const flag = h('g', { class: 'flag' });
    const cloth = h('path', { d: 'M2,-56H44L36,-45L44,-34H2Z' });
    const clothMark = h('g');
    flag.append(h('ellipse', { cy: 1, rx: 9, ry: 3, fill: C.f5, opacity: 0.6 }),
      h('rect', { x: -2, y: -60, width: 4, height: 61, rx: 2, fill: C.ink }), h('circle', { cy: -61, r: 4, fill: C.or }),
      h('g', { class: 'sway fbt', style: { transformOrigin: '0px -56px', transformBox: 'view-box', animationDuration: '2.6s' } }, [cloth, clothMark]));
    hill.append(flag);
    const statusP = pill({ x: 550, y: 290, ht: 26, pad: 11, size: 13, align: 'center', max: 170 });
    const nextP = pill({ x: 550, y: 52, ht: 24, pad: 10, size: 13, fill: C.lilac, color: C.ink, align: 'center', max: 200 });
    hill.append(statusP.g, nextP.g);
    mid.append(hill);

    // ---- front: the ribbon
    const ribbon = h('g', { class: 'focus f-ribbon', style: { transformOrigin: '330px 356px' } });
    const ribbonSway = h('g', { class: 'sway-s', style: { transformOrigin: '330px 356px', animationDuration: '6s' } });
    ribbonSway.append(
      h('path', { d: 'M18,346H70V384H18L32,365Z', fill: C.p2 }), h('path', { d: 'M642,346H590V384H642L628,365Z', fill: C.p2 }),
      h('path', { d: 'M56,384L70,392V384Z M604,384L590,392V384Z', fill: C.f6 }),
      h('rect', { x: 56, y: 332, width: 548, height: 52, rx: 4, fill: C.p1 }),
      h('path', { d: 'M66,340H594', stroke: C.white, 'stroke-width': 1.6, 'stroke-dasharray': '3 6', opacity: 0.6 }),
      h('path', { d: 'M66,376H594', stroke: C.white, 'stroke-width': 1.6, 'stroke-dasharray': '3 6', opacity: 0.6 }));
    const msgT = h('text', { x: 330, 'text-anchor': 'middle', fill: C.ink });
    ribbonSway.append(msgT);
    ribbon.append(h('g', { transform: 'translate(0,-8)' }, [ribbonSway]));
    front.append(ribbon);

    // ---- state
    let last = {};
    const focus = s => { S.wrap.dataset.focus = ['results', 'status'].includes(s) ? s : ''; };
    focus(currentScreen());
    S.onBus('step:change', d => focus(d.to));

    function makeSlot(i) {
      const g = h('g', { class: 'slot' });
      const body = h('rect', { class: 'bar', rx: 8 });
      const shine = h('rect', { class: 'bar', rx: 3, fill: C.white, opacity: 0.35 });
      const lift = h('g', { class: 'lift' });
      const bob = h('g', { class: 'bob', style: { animationDelay: `${-i * 0.6}s` } });
      const valT = h('text', { class: 'ep', 'text-anchor': 'middle', fill: C.ink });
      const best = h('g', {}, [star(0, 0, 9, C.or, 'twinkle fb')]);
      bob.append(valT, best);
      lift.append(bob);
      const what = h('text', { 'text-anchor': 'middle', 'font-size': 13, fill: C.muted, y: BASE + 20 });
      g.append(body, shine, lift, what);
      return { g, body, shine, lift, valT, best, what, fresh: true };
    }

    function renderBars(list, force) {
      const rows = list.map(r => ({ what: clean(get(r || {}, 'what')), value: clean(get(r || {}, 'value')) }));
      const real = rows.filter(r => r.what || r.value);
      const ghost = !real.length;
      const items = ghost ? [{ g: 1 }, { g: 2 }, { g: 3 }] : rows.filter(r => r.what || r.value);
      const n = items.length, slotW = AREA / n, bw = Math.min(52, slotW * 0.56);
      const nums = items.map(r => (r.g ? null : num(r.value)));
      const max = Math.max(0, ...nums.filter(v => v != null));
      const bestI = nums.filter(v => v != null).length > 1 ? nums.indexOf(max) : -1;
      while (slots.length > n) { const s = slots.pop(); s.g.style.opacity = 0; S.later(400, () => s.g.remove()); }
      items.forEach((r, i) => {
        let s = slots[i];
        if (!s) { s = slots[i] = makeSlot(i); bars.append(s.g); }
        const cx = LEFT + slotW * (i + 0.5);
        const v = nums[i];
        const hgt = r.g ? [56, 92, 128][i] : v != null && max > 0 ? 34 + (MAXH - 34) * (v / max) : r.value ? 96 : 52;
        s.g.style.transform = `translateX(${cx}px)`;
        if (s.fresh) { s.g.style.transition = 'none'; s.g.getBoundingClientRect(); s.g.style.transition = ''; }
        const set = (node, x, w, y, hh) => { node.setAttribute('x', x); node.setAttribute('width', w); node.style.y = `${y}px`; node.style.height = `${hh}px`; };
        if (s.fresh && !force) { set(s.body, -bw / 2, bw, BASE, 0); set(s.shine, -bw / 2 + 7, 6, BASE, 0); s.lift.style.transform = `translateY(${BASE - 14}px)`; s.body.getBoundingClientRect(); }
        set(s.body, -bw / 2, bw, BASE - hgt, hgt);
        set(s.shine, -bw / 2 + 7, 6, BASE - hgt + 8, Math.max(0, hgt - 16));
        s.body.setAttribute('fill', r.g ? C.f1 : COLS[i % COLS.length]);
        s.body.setAttribute('stroke', r.g ? C.f3 : 'none');
        s.body.setAttribute('stroke-dasharray', r.g ? '5 5' : '');
        s.body.setAttribute('stroke-width', r.g ? 2 : 0);
        s.shine.setAttribute('opacity', r.g ? 0 : 0.35);
        s.lift.style.transform = `translateY(${BASE - hgt - 12}px)`;
        const label = r.g ? '?' : r.value || TICK;
        const fit = fitLines(label, { sizes: [20, 17, 15, 13], family: 'Epilogue', width: slotW - 6, lines: 1 });
        s.valT.setAttribute('font-size', fit.size);
        s.valT.setAttribute('fill', r.g ? C.f4 : C.ink);
        s.valT.textContent = fit.lines[0] || '';
        s.best.setAttribute('transform', `translate(${Math.min(slotW / 2 - 10, textWidth(fit.lines[0] || '', fit.size, 'Epilogue') / 2 + 10)},${-fit.size - 2})`);
        s.best.style.display = i === bestI ? '' : 'none';
        s.what.setAttribute('x', 0);
        setLines(s.what, r.g ? [i === 1 ? 'your results' : ''] : wrap(r.what || 'result ' + (i + 1), { size: 13, width: slotW - 8, lines: 2 }).lines, 16);
        s.what.setAttribute('fill', r.g ? C.muted : C.ink);
        s.fresh = false;
      });
      head.set(ghost ? 'key results' : `key results ${String.fromCharCode(183)} ${real.length}`);
      head.rect.setAttribute('fill', ghost ? C.f4 : C.ink);
    }

    function renderStatus(status, next) {
      const k = status === 'Finished' || status === 'Still going' ? status : '';
      const [x, y] = flagPos[k];
      flag.style.transform = `translate(${x}px,${y}px)`;
      cloth.setAttribute('fill', k === 'Finished' ? C.p2 : k ? C.or : C.f2);
      clothMark.replaceChildren(k === 'Finished'
        ? h('path', { d: 'M14,-46l5,5l9,-10', stroke: C.pill, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        : k ? h('path', { d: 'M16,-40a6,6 0 1 1 6,4M22,-36l-4,-1l1,-4', stroke: C.ink, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
          : h('text', { x: 17, y: -40, 'font-size': 13, class: 'ep', fill: C.f4, 'text-anchor': 'middle', text: '?' }));
      statusP.set(k === 'Finished' ? 'finished!' : k ? 'still going' : 'finished?');
      statusP.rect.setAttribute('fill', k ? C.ink : C.f4);
      nextP.g.style.opacity = next ? 1 : 0;
      if (next) nextP.set('next: ' + next);
    }

    function renderMsg(msg) {
      const str = msg || 'the one thing to remember';
      let lines, size;
      const one = fitLines(str, { sizes: [17, 16, 15, 14], width: 500, lines: 1 });
      if (wrap(str, { size: one.size, width: 500, lines: 1 }).overflow) { size = 13; lines = wrap(str, { size: 13, width: 510, lines: 2 }).lines; }
      else { size = one.size; lines = one.lines; }
      msgT.setAttribute('font-size', size);
      msgT.setAttribute('fill', msg ? C.ink : C.f6);
      msgT.setAttribute('y', lines.length > 1 ? 354 : 358 + size * 0.35);
      setLines(msgT, lines, 17);
    }

    function render(state, force) {
      const list = Array.isArray(get(state, 'work.results')) ? get(state, 'work.results') : [];
      const rk = JSON.stringify(list);
      const status = clean(get(state, 'work.status')), next = clean(get(state, 'work.next')), msg = clean(get(state, 'work.message'));
      if (force || rk !== last.rk) renderBars(list, force);
      if (force || status !== last.status || next !== last.next) {
        renderStatus(status, next);
        if (!force && status === 'Finished' && last.status !== 'Finished') S.anim(cloth.parentNode, [{ transform: 'scale(.3)' }, { transform: 'scale(1.15)', offset: 0.6 }, { transform: 'none' }], { duration: 700, delay: 900 });
      }
      if (force || msg !== last.msg) renderMsg(msg);
      last = { rk, status, next, msg };
    }

    let state = ctx.getState ? ctx.getState() : {};
    render(state || {}, true);
    S.fonts(() => render(state || {}, true));
    return {
      update(s) { state = s || {}; render(state, false); },
      destroy() { S.destroy(); slots = []; },
    };
  },
};
