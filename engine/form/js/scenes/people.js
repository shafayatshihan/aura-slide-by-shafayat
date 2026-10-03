// "People" scene: a little team photo under a string of bunting. Every presenter is a round, friendly figure with an
// initials badge on the chest who hops in when added and waves goodbye when removed. Up to four stand in one row; more
// step onto a riser behind. The supervisor stands to the right in a gown and cap with a rosette, beside a pennant for
// the institution.

import { C, h, get, clean, currentScreen, short, textWidth, star, pill, makeStage, DOT } from './talk.js';

const BODIES = [C.p1, C.f5, C.or, C.f4, C.p2, C.lilac, C.f3, C.or2];
const HEADS = [C.f1, C.f2, C.f1, C.f2];

// "A. B. Doe" -> "Doe" (drops initials and short honorifics for the name tag).
function display(name) {
  const words = clean(name).split(' ').filter(Boolean);
  const kept = words.filter(w => !/^[A-Za-z]{1,3}\.$/.test(w) && !/^[A-Za-z]$/.test(w));
  return (kept.length ? kept : words).join(' ');
}
// The name tag: the whole display name when it fits, else just the first name.
function tagName(name, max) {
  const d = display(name);
  return textWidth(d, 13) <= max ? d : d.split(' ')[0];
}
function initials(name) {
  const words = display(name).split(' ').filter(w => /[A-Za-z0-9À-￿]/.test(w));
  if (!words.length) return '?';
  const a = words[0][0], b = words.length > 1 ? words[words.length - 1][0] : (words[0][1] || '');
  return (a + b).toUpperCase();
}

// One figure, feet at 0,0, about 110 px tall.
function figure(S, i, ghost) {
  const body = ghost ? C.f1 : BODIES[i % BODIES.length];
  const head = HEADS[i % HEADS.length];
  const line = ghost ? { stroke: C.f4, 'stroke-width': 2, 'stroke-dasharray': '4 4' } : {};
  const eyes = h('g', { class: 'blink fb', style: { animationDelay: `${-i * 0.7}s` } }, [
    h('circle', { cx: -7, cy: -88, r: 2.6, fill: C.ink }), h('circle', { cx: 7, cy: -88, r: 2.6, fill: C.ink })]);
  const badgeT = h('text', { y: -31.5, 'font-size': 13, class: 'ep', 'text-anchor': 'middle', fill: C.ink });
  const wave = h('g', { style: { transformOrigin: '22px -50px' } }, [
    h('path', { d: 'M22,-50Q34,-58 36,-74', stroke: body, 'stroke-width': 9, 'stroke-linecap': 'round', fill: 'none' }),
    h('circle', { cx: 36, cy: -76, r: 6, fill: head })]);
  const bob = h('g', { class: 'bob', style: { animationDelay: `${-i * 0.55}s`, animationDuration: `${3.2 + (i % 3) * 0.4}s` } }, [
    h('rect', { x: -15, y: -8, width: 12, height: 9, rx: 4.5, fill: C.f6 }),
    h('rect', { x: 3, y: -8, width: 12, height: 9, rx: 4.5, fill: C.f6 }),
    h('path', { d: 'M-22,-50Q-34,-38 -30,-24', stroke: body, 'stroke-width': 9, 'stroke-linecap': 'round', fill: 'none' }),
    wave,
    h('path', { d: 'M-26,-4V-46a26,26 0 0 1 52,0V-4Z', fill: body, ...line }),
    h('path', { d: 'M-18,-48a18,18 0 0 1 14,-17', stroke: C.white, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none', opacity: ghost ? 0 : 0.45 }),
    h('ellipse', { cx: -13, cy: -103, rx: 6, ry: 8, fill: C.f3, transform: 'rotate(-20 -13 -103)' }),
    h('ellipse', { cx: 13, cy: -103, rx: 6, ry: 8, fill: C.f3, transform: 'rotate(20 13 -103)' }),
    h('circle', { cy: -86, r: 20, fill: head, ...line }),
    eyes,
    h('circle', { cx: -12, cy: -80, r: 3.6, fill: C.p1, opacity: 0.55 }), h('circle', { cx: 12, cy: -80, r: 3.6, fill: C.p1, opacity: 0.55 }),
    h('path', { d: 'M-4,-79q4,4 8,0', stroke: C.ink, 'stroke-width': 1.8, 'stroke-linecap': 'round', fill: 'none' }),
    h('circle', { cy: -36, r: 15, fill: C.pill }),
    badgeT]);
  const inner = h('g', {}, [h('ellipse', { cy: 1, rx: 30, ry: 5, fill: C.f4, opacity: 0.45 }), bob]);
  return { inner, badgeT, wave };
}

export default {
  mount(el, ctx) {
    const S = makeStage(el, ctx, 'people');
    S.svg.append(h('style', { text: `
      .s2d-people .grp{transition:opacity .5s ease}
      .s2d-people[data-focus=presenters] .g-sup,.s2d-people[data-focus=supervisor] .g-team{opacity:.5}
      .s2d-people .wavehi{animation:pp-wave 1.1s ease-in-out 2}
      @keyframes pp-wave{0%,100%{transform:rotate(0)}30%{transform:rotate(-24deg)}70%{transform:rotate(14deg)}}` }));
    const back = S.layer(S.svg, 3), mid = S.layer(S.svg, 8), front = S.layer(S.svg, 12);

    // ---- back: bunting, floor, riser
    const bunting = h('g', { class: 'sway-s fbt', style: { animationDuration: '6.4s' } });
    bunting.append(h('path', { d: 'M14,16Q330,58 646,16', stroke: C.f5, 'stroke-width': 2, fill: 'none' }));
    const flagCols = [C.p1, C.f4, C.or0, C.lilac, C.p2, C.f3];
    for (let k = 0; k < 15; k++) {
      const t = (k + 0.5) / 15, x = 14 + 632 * t, y = 16 + 2 * (1 - t) * t * 42 * 1.0;
      bunting.append(h('path', { d: `M${x - 13},${y}L${x + 13},${y + 1}L${x},${y + 24}Z`, fill: flagCols[k % flagCols.length] }));
    }
    back.append(bunting,
      h('ellipse', { cx: 330, cy: 352, rx: 316, ry: 16, fill: C.f2, opacity: 0.55 }),
      h('path', { d: 'M24,346H636', stroke: C.f3, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }));
    const riser = h('g', { class: 'tr-s', style: { opacity: 0, transform: 'translateY(20px)' } }, [
      h('rect', { x: 22, y: 224, width: 420, height: 100, rx: 14, fill: C.f3 }),
      h('rect', { x: 22, y: 224, width: 420, height: 12, rx: 6, fill: C.f2 }),
      h('path', { d: 'M92,242v76M162,242v76M232,242v76M302,242v76M372,242v76', stroke: C.f4, 'stroke-width': 2, opacity: 0.5 })]);
    back.append(riser);
    const sparks = [star(470, 96, 7, C.or, 'twinkle fb'), star(36, 120, 6, C.p1, 'twinkle fb'), star(640, 250, 8, C.white, 'twinkle fb')];
    sparks.forEach((s, i) => { s.style.animationDelay = `${-i * 0.8}s`; back.append(s); });

    // ---- mid: the team
    const team = h('g', { class: 'grp g-team' });
    const backRow = h('g'), frontRow = h('g');
    team.append(backRow, frontRow);
    mid.append(team);
    const countP = pill({ x: 34, y: 62, ht: 26, pad: 11, size: 13, fill: '#5b3fa8', color: C.pill, max: 220 });
    mid.append(countP.g);

    // ---- front: the supervisor, the pennant
    const sup = h('g', { class: 'grp g-sup' });
    front.append(sup);
    const pole = h('g', { transform: 'translate(626,110)' });
    const pennant = h('g', { class: 'sway fbt', style: { transformOrigin: '0px 0px', animationDuration: '4.8s' } });
    const instT = h('text', { x: -10, y: 26, 'font-size': 13, 'text-anchor': 'end', fill: C.pill });
    const pennantShape = h('path', { fill: C.p2 });
    pennant.append(pennantShape, instT);
    pole.append(h('rect', { x: -2, y: -4, width: 4, height: 236, rx: 2, fill: C.f6 }), h('circle', { cy: -6, r: 5, fill: C.or }), pennant);
    sup.append(pole);

    const supG = h('g', { transform: 'translate(548,318) scale(1.06)' });
    const supInner = h('g');
    supG.append(supInner);
    sup.append(supG);
    const supName = pill({ x: 548, y: 334, ht: 26, pad: 11, size: 13, align: 'center', max: 204 });
    const supTitle = pill({ x: 548, y: 364, ht: 22, pad: 9, size: 13, fill: C.lilac, color: C.ink, align: 'center', max: 204 });
    sup.append(supName.g, supTitle.g);

    function drawSupervisor(filled) {
      supInner.replaceChildren();
      const f = figure(S, 1, !filled);
      if (filled) {
        // gown, cap and rosette over the generic figure
        const bob = f.inner.lastChild;
        bob.children[4].setAttribute('fill', C.f6);
        bob.children[2].setAttribute('stroke', C.f6);
        f.wave.firstChild.setAttribute('stroke', C.f6);
        bob.append(
          h('path', { d: 'M-8,-70L0,-56L8,-70', fill: C.pill }),
          h('rect', { x: -15, y: -112, width: 30, height: 10, rx: 3, fill: C.ink }),
          h('path', { d: 'M-30,-112L0,-124L30,-112L0,-100Z', fill: C.ink }),
          h('path', { d: 'M22,-110v14', stroke: C.or, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
          h('circle', { cx: 22, cy: -95, r: 3, fill: C.or }));
        const ros = h('g', { transform: 'translate(-14,-30)' }, [h('g', { class: 'sway', style: { animationDuration: '3s' } }, [
          h('path', { d: 'M-5,4L-9,22L-3,18L0,24L3,6Z M5,4L9,22L3,18', fill: C.p2 }),
          h('circle', { r: 10, fill: C.or }), h('circle', { r: 6.5, fill: C.or0 }), star(0, 0, 5, C.or2)])]);
        bob.append(ros);
        f.badgeT.textContent = '';
        bob.querySelector('circle[r="15"]').setAttribute('opacity', 0);
      } else {
        f.badgeT.textContent = '?';
        f.badgeT.setAttribute('fill', C.f4);
      }
      supInner.append(f.inner);
      return f;
    }

    // ---- state
    let figs = [], last = {};
    const focus = s => { S.wrap.dataset.focus = ['presenters', 'supervisor'].includes(s) ? s : ''; };
    focus(currentScreen());
    S.onBus('step:change', d => focus(d.to));

    function layout(n) {
      const pos = [];
      if (n <= 4) {
        const sp = Math.min(108, 400 / n);
        for (let i = 0; i < n; i++) pos.push({ x: 232 + (i - (n - 1) / 2) * sp, y: 322, s: 1, row: 'f', slot: sp });
      } else {
        const f = Math.ceil(n / 2), b = n - f, sp = 100;
        const shift = b === f ? sp / 2 - 4 : 0;
        for (let i = 0; i < f; i++) pos.push({ x: 228 + (i - (f - 1) / 2) * sp - shift / 2, y: 326, s: 0.92, row: 'f', slot: sp });
        for (let i = 0; i < b; i++) pos.push({ x: 228 + (i - (b - 1) / 2) * sp + shift / 2, y: 228, s: 0.8, row: 'b', slot: sp });
      }
      return pos;
    }

    function makeFig(i, ghost) {
      const f = figure(S, i, ghost);
      const outer = h('g', { class: 'tr-s' });
      const tag = pill({ ht: 24, pad: 10, size: 13, align: 'center', max: 104 });
      outer.append(f.inner, tag.g);
      return { ...f, outer, tag, ghost, name: null, row: null };
    }

    function renderTeam(list, force) {
      const n = Math.max(1, list.length);
      const pos = layout(n);
      // remove figures that are no longer there
      while (figs.length > n) {
        const f = figs.pop();
        const a = S.anim(f.inner, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-26px) scale(.5)', opacity: 0 }], { duration: 420 });
        f.tag.g.style.opacity = 0;
        if (a) S.later(430, () => f.outer.remove()); else f.outer.remove();
      }
      for (let i = 0; i < n; i++) {
        const name = clean(get(list[i] || {}, 'name'));
        const ghost = !name;
        let f = figs[i], fresh = false;
        if (f && f.ghost !== ghost) {
          // swap between the dashed placeholder and a real person in place
          const nf = makeFig(i, ghost);
          nf.outer.style.transform = f.outer.style.transform;
          f.outer.replaceWith(nf.outer);
          figs[i] = f = nf; fresh = !ghost;
        }
        if (!f) { f = figs[i] = makeFig(i, ghost); fresh = true; }
        const p = pos[i];
        const parent = p.row === 'b' ? backRow : frontRow;
        if (f.outer.parentNode !== parent) parent.append(f.outer);
        f.outer.style.transform = `translate(${p.x}px,${p.y}px) scale(${p.s})`;
        if (f.name !== name || f.row !== p.row || force) {
          f.badgeT.textContent = ghost ? '?' : initials(name);
          f.badgeT.setAttribute('fill', ghost ? C.f4 : C.ink);
          f.tag.set(ghost ? (i ? 'presenter ' + (i + 1) : 'your name') : tagName(name, 84));
          f.tag.rect.setAttribute('fill', ghost ? C.f1 : C.ink);
          f.tag.text.setAttribute('fill', ghost ? C.muted : C.pill);
          f.tag.g.setAttribute('transform', p.row === 'b' ? 'translate(0,-142)' : 'translate(0,9)');
          f.name = name; f.row = p.row;
        }
        if (fresh && !force && S.alive()) {
          S.anim(f.inner, [{ transform: 'translateY(70px) scale(.6)', opacity: 0 }, { transform: 'translateY(-16px) scale(1.04)', opacity: 1, offset: 0.62 }, { transform: 'none', opacity: 1 }], { duration: 720, easing: 'ease-out' });
          f.wave.classList.add('wavehi');
          S.later(2300, () => f.wave.classList.remove('wavehi'));
        }
      }
      const real = list.filter(p => clean(get(p || {}, 'name'))).length;
      countP.set(real ? `the team ${DOT} ${real} presenter${real === 1 ? '' : 's'}` : 'who’s presenting?');
      countP.rect.setAttribute('fill', real ? C.ink : C.f4);
      riser.style.opacity = n > 4 ? 1 : 0;
      riser.style.transform = n > 4 ? 'none' : 'translateY(20px)';
    }

    function renderSup(name, title, inst, dept, force) {
      const filled = !!name;
      if (force || filled !== last.supFilled) {
        drawSupervisor(filled);
        if (!force && filled) S.anim(supInner, [{ transform: 'translateY(70px) scale(.6)', opacity: 0 }, { transform: 'translateY(-16px) scale(1.04)', opacity: 1, offset: 0.62 }, { transform: 'none', opacity: 1 }], { duration: 760, easing: 'ease-out' });
      }
      supName.set(filled ? name : 'supervisor?');
      supName.rect.setAttribute('fill', filled ? C.ink : C.f1);
      supName.text.setAttribute('fill', filled ? C.pill : C.muted);
      const sub = [title, dept].filter(Boolean).join(` ${DOT} `);
      supTitle.set(sub || (filled ? 'supervisor' : 'optional'));
      supTitle.rect.setAttribute('fill', sub ? C.lilac : C.f1);
      supTitle.text.setAttribute('fill', sub ? C.ink : C.muted);
      const label = short(inst || 'your university', 13, 130);
      instT.textContent = label;
      instT.setAttribute('fill', inst ? C.pill : C.muted);
      const w = Math.max(70, Math.ceil(textWidth(label, 13)) + 26);
      pennantShape.setAttribute('d', `M-2,6H${-w}L${-w + 12},22L${-w},38H-2Z`);
      pennantShape.setAttribute('fill', inst ? C.p2 : C.f1);
    }

    function render(state, force) {
      const list = Array.isArray(get(state, 'people.presenters')) ? get(state, 'people.presenters') : [];
      const key = JSON.stringify(list.map(p => clean(get(p || {}, 'name'))));
      if (force || key !== last.key) renderTeam(list, force);
      const name = clean(get(state, 'people.supervisor')), title = clean(get(state, 'people.supervisorTitle'));
      const inst = clean(get(state, 'people.institution')), dept = clean(get(state, 'people.department'));
      const skey = [name, title, inst, dept].join('|');
      if (force || skey !== last.skey) renderSup(name, title, inst, dept, force);
      last = { key, skey, supFilled: !!name };
    }

    let state = ctx.getState ? ctx.getState() : {};
    render(state || {}, true);
    S.fonts(() => render(state || {}, true));
    return {
      update(s) { state = s || {}; render(state, false); },
      destroy() { S.destroy(); figs = []; },
    };
  },
};
