"""Theme demo slides for the form's "Pick your look" step: ONE animated slide per Aura theme.
Each slide shows the theme's type, colour and illustration style on its own engineering topic, following power-design
(principles/design-principles.md), Aura Blend (aura-slide/aura-blend.md, incl. "diagrams are illustrations") and the
Aura-Slide HARD RULE (no text under 26 px). Animations are CSS, seamless on a 6 s loop, and the slide still reads as a
still frame. tools/build_previews.js records each one to engine/form/themes/<n>-<slug>.mp4 (+ poster .jpg).

  1 Pink Punch       (Gumroad)             chemical   distillation column: bubbles rise, pipes flow, flames flicker
  2 Bold Blue        (Coinbase)            fluid      airfoil, streamlines from a real Joukowski potential flow, air pulses
  3 Flat-Pack        (IKEA)                mechanical gearbox manual: 12-tooth pinion drives a 30-tooth gear (2.5 : 1)
  4 Happy Headspace  (Headspace)           molecular  hydrogen-bonded water, vibrating; orange first, no faces
  5 Yellow Frame     (National Geographic) heat       geothermal cutaway: water loop through hot rock, steam; black as ink
"""
import json, math, os, re
import numpy as np, contourpy

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'docs', 'screenshots', 'theme-previews'); os.makedirs(OUT, exist_ok=True)
FONTDIR = os.path.relpath(os.path.join(ROOT, 'engine', 'fonts'), OUT).replace(os.sep, '/')
COL = lambda k: 96 + 146 * k
SPAN = lambda n: 122 * n + 24 * (n - 1)
AW, AH = SPAN(6), 888            # illustration box (columns 7-12)
VW, VH = SPAN(12), 536           # flowchart / chart box (full width, under the header)
VTOP = 416

BASE = f'''*{{box-sizing:border-box;margin:0}}html,body{{height:100%;background:#1b1b1f}}
body{{display:flex;align-items:center;justify-content:center;overflow:hidden}}
.slide{{position:relative;width:1920px;height:1080px;flex:none;overflow:hidden}}
.abs{{position:absolute}}
.text{{left:{COL(0)}px;top:96px}} .text.half{{width:{SPAN(6) - 48}px}} .text.full{{width:{SPAN(12)}px}}
.kicker{{font-size:28px;line-height:1.2}}
h1{{margin-top:16px;font-size:84px;line-height:1.08}}
p{{margin-top:32px;font-size:36px;line-height:1.5;max-width:30ch}}
.art{{left:{COL(6)}px;top:96px;width:{AW}px;height:{AH}px}}
.viz{{left:{COL(0)}px;top:{VTOP}px;width:{VW}px;height:{VH}px}}
svg{{display:block;overflow:visible}}
.lbl{{font-size:28px}}
@keyframes flow{{to{{stroke-dashoffset:-120}}}}
@keyframes spin{{to{{transform:rotate(360deg)}}}} @keyframes spinr{{to{{transform:rotate(-360deg)}}}}
@keyframes rise{{0%{{transform:translateY(0);opacity:0}}20%{{opacity:1}}80%{{opacity:1}}100%{{transform:translateY(-40px);opacity:0}}}}
@keyframes flick{{0%,100%{{transform:scaleY(1)}}50%{{transform:scaleY(.78)}}}}
@keyframes vib{{0%,100%{{transform:translate(0,0) rotate(0)}}25%{{transform:translate(4px,-3px) rotate(2deg)}}50%{{transform:translate(-3px,3px) rotate(-1.5deg)}}75%{{transform:translate(-4px,-2px) rotate(1deg)}}}}
@keyframes puff{{0%{{transform:translate(0,0) scale(.6);opacity:0}}25%{{opacity:.95}}100%{{transform:translate(46px,-64px) scale(1.35);opacity:0}}}}
@keyframes bob{{0%,100%{{transform:translateY(0)}}50%{{transform:translateY(-5px)}}}}
@keyframes drip{{0%{{transform:translateY(0);opacity:0}}15%{{opacity:1}}85%{{opacity:1}}100%{{transform:translateY(70px);opacity:0}}}}
@keyframes travel{{0%{{transform:translate(0,0);opacity:0}}15%{{opacity:1}}70%{{transform:translate(var(--dx),var(--dy));opacity:1}}85%,100%{{transform:translate(var(--dx),var(--dy));opacity:0}}}}
@keyframes pulse{{0%,100%{{transform:scale(1)}}50%{{transform:scale(1.12)}}}}
@keyframes grow{{0%,100%{{transform:scaleX(.6)}}50%{{transform:scaleX(1.15)}}}}
@keyframes blink{{0%,88%,100%{{opacity:0}}92%{{opacity:.9}}}}
.fl{{animation:flow 2s linear infinite}}
'''
SCALE = ('<script>function f(){var s=Math.min(innerWidth/1920,innerHeight/1080);document.querySelector(".slide").style.transform="scale("+s+")"}'
         'addEventListener("resize",f);f()</script>')
THEMES = {}

def page(T, part, kick, h1, p, svg, wide):
    fonts = ''.join(f"@font-face{{font-family:'{f}';src:url('{FONTDIR}/{src}');font-weight:{w};font-display:block}}" for f, src, w in T['faces'])
    box = (f'<div class="abs viz" data-grid>{svg}</div>' if wide else f'<div class="abs art" data-grid>{svg}</div>')
    html = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{T["name"]} - {part}</title><style>{fonts}{BASE}.slide{{background:{T["canvas"]}}}{T["css"]}</style></head><body>'
            f'<main class="slide" aria-label="{T["name"]}">{box}<div class="abs text {"full" if wide else "half"}" data-grid>'
            f'<div class="kicker">{kick}</div><h1>{h1}</h1><p>{p}</p></div></main>{SCALE}</body></html>')
    open(os.path.join(OUT, f'{T["n"]}-{T["slug"]}{"" if part == "demo" else "-" + part}.html'), 'w', encoding='utf-8').write(html)

svgw = lambda w, h, body, label: f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">{body}</svg>'
txt = lambda x, y, s, cls='lbl', anchor='start', extra='': f'<text class="{cls}" x="{x:.0f}" y="{y:.0f}" text-anchor="{anchor}"{extra}>{s}</text>'
pts = lambda P: ' '.join(f'{x:.1f},{y:.1f}' for x, y in P)
marker = lambda mid, col, size=3.2: (f'<marker id="{mid}" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="{size}" markerHeight="{size}" '
                                     f'orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 Z" fill="{col}"/></marker>')

def hard(shape, dx=8, dy=8):
    """Gumroad hard shadow: a solid black copy offset down-right, then the shape with black 4 px outlines."""
    sh = re.sub(r'fill="(?!none)[^"]*"', 'fill="#000"', shape)
    return f'<g transform="translate({dx} {dy})" fill="#000">{sh}</g><g stroke="#000" stroke-width="4" stroke-linejoin="round">{shape}</g>'

# =================================================================== 1 · PINK PUNCH — distillation column
def art_distillation():
    W, H = AW - 6, AH - 6                            # inside the 3 px CSS border
    pipe = lambda d: (f'<path d="{d}" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
                      f'<path class="fl" d="{d}" fill="none" stroke="#ff90e8" stroke-width="7" stroke-dasharray="10 20"/>')
    arrow = lambda d: f'<path d="{d}" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round" marker-end="url(#pa)"/>'
    o = ['<defs>' + marker('pa', '#000', 3.4) + '</defs>']
    # pipes first (under the vessels)
    o += [pipe('M370 176 V112 H548'), pipe('M650 150 V222'), pipe('M560 256 H456'), pipe('M740 256 H812'),
          pipe('M370 740 V806 H548'), pipe('M606 772 V700 H456'), pipe('M760 806 H812'), pipe('M64 480 H284')]
    o += [arrow('M500 256 H470'), arrow('M790 256 H826'), arrow('M520 700 H470'), arrow('M790 806 H826'), arrow('M210 480 H276'),
          arrow('M596 112 H604')]
    # column shell with hard shadow
    o.append(hard('<rect x="290" y="170" width="160" height="570" rx="36" fill="#ffffff"/>'))
    heat = ['#dc341e', '#dc341e', '#f3a642', '#f3a642', '#ffc900', '#ffc900', '#90a8ed', '#23a094']
    trays = [668, 608, 548, 488, 428, 368, 308, 248]         # bottom -> top
    for k, ty in enumerate(trays):
        left = k % 2 == 0
        a, b = (296, 414) if left else (326, 444)
        o.append(f'<rect x="{a}" y="{ty - 16}" width="{b - a}" height="16" fill="#ffc900" stroke="#000" stroke-width="3"/>')
        o.append(f'<path d="M{a} {ty} H{b}" stroke="#000" stroke-width="5"/>')
        wx = b if left else a
        o.append(f'<path d="M{wx} {ty} V{ty + 30}" stroke="#000" stroke-width="4"/>')
        for j, bx in enumerate((318, 356, 398) if left else (342, 384, 422)):
            o.append(f'<circle cx="{bx}" cy="{ty + 36 + 10 * (j % 2)}" r="{7 + (j % 2) * 3}" fill="{heat[k]}" stroke="#000" stroke-width="3" '
                     f'style="animation:rise 1.5s linear infinite;animation-delay:-{(k * 0.37 + j * 0.5) % 1.5:.2f}s"/>')
    o.append('<rect x="290" y="170" width="160" height="570" rx="36" fill="none" stroke="#000" stroke-width="5"/>')
    # condenser with cooling coil
    o.append(hard('<rect x="540" y="70" width="220" height="80" rx="40" fill="#90a8ed"/>'))
    o.append('<path d="M572 110 l16 -22 l16 44 l16 -44 l16 44 l16 -44 l16 44 l16 -44 l16 44 l16 -44 l16 44 l12 -22" fill="none" stroke="#000" stroke-width="4" stroke-linejoin="round"/>')
    o.append(arrow('M812 128 H776'))
    # reflux drum
    o.append(hard('<rect x="560" y="222" width="180" height="68" rx="34" fill="#ffffff"/>'))
    o.append('<path d="M572 262 H728 V270 Q728 282 716 282 H584 Q572 282 572 270 Z" fill="#ffc900" stroke="#000" stroke-width="3"/>')
    # reboiler + flame
    o.append(hard('<rect x="540" y="772" width="220" height="68" rx="34" fill="#f3a642"/>'))
    for fx in (596, 650, 704):
        o.append(f'<path d="M{fx} 876 C {fx - 18} 866, {fx - 12} 850, {fx} 842 C {fx + 12} 850, {fx + 18} 866, {fx} 876 Z" fill="#dc341e" stroke="#000" stroke-width="3" '
                 f'style="transform-box:fill-box;transform-origin:50% 100%;animation:flick 1s ease-in-out infinite;animation-delay:-{(fx % 7) / 7:.2f}s"/>')
    # sparkle
    o.append(hard('<path d="M150 150 L162 180 L192 192 L162 204 L150 234 L138 204 L108 192 L138 180 Z" fill="#ffc900"/>', 6, 6))
    o += [txt(650, 50, 'Condenser', anchor='middle'), txt(212, 318, 'Trays', anchor='end'),
          '<path d="M224 308 H300" stroke="#000" stroke-width="3"/>', txt(650, 330, 'Distillate', anchor='middle'),
          txt(64, 458, 'Feed'), txt(520, 848, 'Reboiler', anchor='end'), txt(836, 752, 'Bottoms', anchor='end')]
    return svgw(W, H, ''.join(o), 'Distillation column with trays, condenser, reflux drum and reboiler')

def pp_node(i, x, y, w, h):
    return hard(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="24" fill="{["#ffc900", "#ff90e8", "#23a094", "#f3a642"][i]}"/>')
PP = dict(n=1, slug='pink-punch', name='Pink Punch', canvas='#f4f4f0', accent=['#ff90e8'],
    faces=[('Anton', 'Anton-400.woff2', 400), ('Work Sans', 'WorkSans-100-900.ttf', '100 900')],
    css='''.slide{color:#000;font-family:"Work Sans",sans-serif}
 .kicker{display:inline-block;padding:8px 24px;border:3px solid #000;border-radius:9999px;background:#fff;box-shadow:4px 4px 0 #000;font-weight:500}
 h1{font-family:Anton,sans-serif;font-weight:400;letter-spacing:-.01em;text-transform:uppercase}
 h1 .hl{display:inline-block;background:#ff90e8;padding:0 .08em}
 p{font-weight:500;color:#242423}
 .art{background:#ff90e8;border:3px solid #000;border-radius:48px 48px 48px 8px;box-shadow:8px 8px 0 #000;overflow:hidden}
 .lbl,.nt,.tk,.ax,.co{font-family:"Work Sans";font-weight:600;fill:#000}.nn{font-family:Anton;fill:#000}''',
    node=pp_node, num=lambda i, x, y: txt(x + 28, y + 50, str(i + 1), 'nn'), arrow='#000', aw=6,
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y0} V{y1} H{x1}" fill="none" stroke="#000" stroke-width="5" stroke-linejoin="round"/>',
    line=lambda P: f'<g transform="translate(6 6)"><polyline points="{pts(P)}" fill="none" stroke="#000" stroke-width="8" stroke-linejoin="round"/></g><polyline points="{pts(P)}" fill="none" stroke="#ff90e8" stroke-width="8" stroke-linejoin="round"/><polyline points="{pts(P)}" fill="none" stroke="#000" stroke-width="2"/>',
    point=lambda i, x, y, hi: f'<circle cx="{x + 5:.1f}" cy="{y + 5:.1f}" r="13" fill="#000"/><circle cx="{x:.1f}" cy="{y:.1f}" r="13" fill="#ffc900" stroke="#000" stroke-width="4"/>')

# =================================================================== 2 · BOLD BLUE — airfoil (Joukowski potential flow)
def art_airfoil():
    mu, U, al = complex(-0.09, 0.11), 1.0, math.radians(8)
    R = abs(1 - mu); zeta_te = 1 + 0j
    e = np.exp(-1j * al)
    # Kutta condition: velocity zero at the trailing edge (zeta = 1)
    zp = zeta_te - mu
    G = (-2 * math.pi * zp * U * (e - R ** 2 / (e * zp ** 2)) / 1j).real
    def w_of(zeta):
        zp = zeta - mu
        return U * (zp * e + R ** 2 / (e * zp)) + 1j * G / (2 * math.pi) * np.log(zp)
    s, cx, cy = 148, 400, 480                              # px per unit, display origin
    xs = np.linspace(-cx / s, (AW - cx) / s, 420); ys = np.linspace(-(AH - cy) / s, cy / s, 440)
    Xg, Yg = np.meshgrid(xs, ys)
    z = (Xg + 1j * Yg) * np.exp(1j * al)                   # display (flow horizontal) -> model plane
    root = np.sqrt(z * z - 4 + 0j)
    z1, z2 = (z + root) / 2, (z - root) / 2
    zeta = np.where(np.abs(z1 - mu) >= np.abs(z2 - mu), z1, z2)
    inside = np.abs(zeta - mu) < R * 1.0005
    psi = np.ma.masked_array(np.imag(w_of(zeta)), inside)
    dwdz = (U * (e - R ** 2 / (e * (zeta - mu) ** 2)) + 1j * G / (2 * math.pi * (zeta - mu))) / (1 - 1 / zeta ** 2)
    cp = 1 - np.abs(dwdz) ** 2 / U ** 2
    gen = contourpy.contour_generator(Xg, Yg, psi)
    ref = [np.imag(w_of(np.array([complex(xs[0], yy) * np.exp(1j * al)])))[0] for yy in np.linspace(-2.7, 3.0, 19)]
    D = lambda x, y: (cx + s * x, cy - s * y)
    o = ['<defs>' + marker('ba', '#ffffff', 3) + f'<clipPath id="bclip"><rect width="{AW}" height="{AH}" rx="40"/></clipPath></defs>',
         f'<rect width="{AW}" height="{AH}" rx="40" fill="#0052ff"/><g clip-path="url(#bclip)">']
    # halftone pressure field: white = suction (low pressure), black = pressure side
    for gy in range(24, AH, 26):
        for gx in range(24, AW, 26):
            j = min(int(gx / AW * (len(xs) - 1)), len(xs) - 1); i = len(ys) - 1 - min(int(gy / AH * (len(ys) - 1)), len(ys) - 1)
            if inside[i, j]: continue
            c = cp[i, j]
            if c < -0.25: o.append(f'<circle cx="{gx}" cy="{gy}" r="{min(2 + (-c - .25) * 3.2, 7.5):.1f}" fill="#ffffff" opacity="0.5"/>')
            elif c > 0.12: o.append(f'<circle cx="{gx}" cy="{gy}" r="{min(2 + (c - .12) * 8, 7.5):.1f}" fill="#0a0b0d" opacity="0.55"/>')
    for lv in ref:
        for seg in gen.lines(lv):
            if len(seg) < 8: continue
            P = [D(x, y) for x, y in seg[::3]]
            if P[0][0] > P[-1][0]: P.reverse()
            n_line = len(o)
            o.append(f'<polyline points="{pts(P)}" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity=".6" stroke-linejoin="round" stroke-linecap="round"/>'
                     f'<polyline class="fl" points="{pts(P)}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-dasharray="26 94" '
                     f'style="animation-delay:-{(n_line * 0.29) % 2:.2f}s"/>')
    th = np.linspace(0, 2 * math.pi, 360)
    foil = (mu + R * np.exp(1j * th)); foil = (foil + 1 / foil) * np.exp(-1j * al)
    o.append(f'<polygon points="{pts([D(p.real, p.imag) for p in foil])}" fill="#0a0b0d"/>')
    # lift arrow at quarter chord
    qc = (-1.0 + 0.1j) * np.exp(-1j * al); qx, qy = D(qc.real, qc.imag)
    o.append(f'<path d="M{qx:.0f} {qy - 26:.0f} V{qy - 250:.0f}" stroke="#0a0b0d" stroke-width="18" fill="none"/>'
             f'<path d="M{qx - 34:.0f} {qy - 244:.0f} L{qx:.0f} {qy - 300:.0f} L{qx + 34:.0f} {qy - 244:.0f} Z" fill="#0a0b0d"/>')
    # Bauhaus accents
    o.append(f'<circle cx="{AW - 92}" cy="{AH - 92}" r="46" fill="#0a0b0d"/><circle cx="{AW - 92}" cy="{AH - 92}" r="18" fill="#ffffff"/>')
    o.append('</g>')
    tag = lambda x, y, s: (f'<rect x="{x}" y="{y}" width="{len(s) * 16 + 40:.0f}" height="48" rx="24" fill="#0a0b0d"/>' + txt(x + 20, y + 34, s))
    o += [tag(qx + 28, qy - 322, 'Lift'), tag(qx + 120, qy - 150, 'Low pressure'), tag(452, 640, 'High pressure'),
          tag(56, 812, 'Airflow'), f'<path d="M216 836 H330" stroke="#ffffff" stroke-width="6" stroke-linecap="round" marker-end="url(#ba)"/>']
    return svgw(AW, AH, ''.join(o), 'Streamlines of air flowing over a cambered wing at 8 degrees, with a lift arrow')

BB = dict(n=2, slug='bold-blue', name='Bold Blue', canvas='#ffffff', accent=['#0052ff'],
    faces=[('Plus Jakarta Sans', 'PlusJakartaSans-200-800.woff2', '200 800'), ('Work Sans', 'WorkSans-100-900.ttf', '100 900')],
    css='''.slide{color:#0a0b0d;font-family:"Work Sans",sans-serif}
 .kicker{font-weight:600;color:#0052ff}
 h1{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;letter-spacing:-.02em}
 h1 .hl{color:#0052ff}
 p{color:#5b616e}
 .lbl{font-family:"Work Sans";font-weight:600;fill:#ffffff}
 .nt,.nn{font-family:"Work Sans";font-weight:600;fill:#ffffff}
 .tk,.ax{font-family:"Work Sans";font-weight:500;fill:#0a0b0d}.co{font-family:"Work Sans";font-weight:700;fill:#0a0b0d}''',
    node=lambda i, x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="24" fill="{"#0a0b0d" if i == 3 else "#0052ff"}"/>',
    num=lambda i, x, y: txt(x + 28, y + 50, f'0{i + 1}', 'nn'), arrow='#0a0b0d', aw=6, grid='#eef0f3',
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y1} H{x1}" stroke="#0a0b0d" stroke-width="3"/>',
    line=lambda P: f'<polyline points="{pts(P)}" fill="none" stroke="#0052ff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>',
    point=lambda i, x, y, hi: (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="16" fill="#0a0b0d"/>' if hi else
                               f'<circle cx="{x:.1f}" cy="{y:.1f}" r="10" fill="#ffffff" stroke="#0052ff" stroke-width="5"/>'))

# =================================================================== 3 · FLAT-PACK — gearbox (assembly manual)
def gear_poly(cx, cy, N, m, phase=0.0):
    r, ra, rf = m * N / 2, m * N / 2 + m, m * N / 2 - 1.25 * m
    P, p = [], 2 * math.pi / N
    for k in range(N):
        a = phase + k * p
        for frac, rad in ((0.0, rf), (0.10, ra * .97), (0.16, ra), (0.34, ra), (0.40, ra * .97), (0.50, rf), (0.75, rf * .995)):
            P.append((cx + rad * math.cos(a + frac * p), cy + rad * math.sin(a + frac * p)))
    return P

def art_gearbox():
    L = 'stroke="#111111" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'
    o = ['<defs>' + marker('ga', '#111111', 3.4) + '</defs>']
    o += [txt(40, 72, '1', 'nn'), txt(40, 372, '2', 'nn')]
    # step 1: parts inventory
    o.append(f'<ellipse cx="160" cy="166" rx="44" ry="44" fill="#ffffff" {L}/><ellipse cx="160" cy="166" rx="20" ry="20" fill="#f5f5f5" {L}/>'
             + ''.join(f'<circle cx="{160 + 32 * math.cos(a):.1f}" cy="{166 + 32 * math.sin(a):.1f}" r="7" fill="#ffdb00" stroke="#111111" stroke-width="3"/>' for a in np.linspace(0, 2 * math.pi, 9)[:-1]))
    o.append(txt(160, 250, '4x', 'lbl', 'middle'))
    o.append(f'<path d="M290 152 H520 A14 14 0 0 1 520 180 H290 A14 14 0 0 1 290 152 Z" fill="#ffffff" {L}/><path d="M470 152 V180" {L}/>')
    o.append(txt(405, 250, '2x', 'lbl', 'middle'))
    for sx in (610, 660, 710):
        o.append(f'<rect x="{sx - 18}" y="126" width="36" height="18" rx="4" fill="#0058a3" {L}/><path d="M{sx - 8} 144 V204 H{sx + 8} V144" fill="#ffffff" {L}/>'
                 + ''.join(f'<path d="M{sx - 8} {y} L{sx + 8} {y + 6}" stroke="#111111" stroke-width="2"/>' for y in range(152, 200, 10)))
    o.append(txt(660, 250, '6x', 'lbl', 'middle'))
    o.append(f'<path d="M40 300 H{AW - 40}" stroke="#111111" stroke-width="2" stroke-dasharray="12 10"/>')
    # step 2: motor -> pinion -> gear -> output, each part with a back face for depth
    px, py, gx = 300, 610, 300 + 60 + 150
    o.append(f'<rect x="72" y="540" width="140" height="140" rx="14" fill="#ffffff" {L}/>'
             + ''.join(f'<path d="M{x} 556 V664" stroke="#111111" stroke-width="3"/>' for x in range(96, 196, 20))
             + f'<rect x="212" y="598" width="{px - 212}" height="24" fill="#ffffff" {L}/>')
    o.append(f'<rect x="{gx + 100}" y="598" width="{AW - 60 - gx - 100}" height="24" fill="#ffffff" {L}/>')
    for (cx, N, fill, rim, ph) in ((gx, 30, '#ffdb00', '#c9a400', math.pi - 0.73 * 2 * math.pi / 30), (px, 12, '#0058a3', '#003a6e', -0.25 * 2 * math.pi / 12)):
        turn = 'spinr 6s' if N == 30 else 'spin 2.4s'           # 12-tooth pinion: 2.5 turns per gear turn
        o.append(f'<g style="transform-origin:{cx}px {py + 8}px;animation:{turn} linear infinite"><polygon points="{pts(gear_poly(cx, py + 8, N, 10, ph))}" fill="{rim}" {L}/></g>')
        o.append(f'<g style="transform-origin:{cx}px {py}px;animation:{turn} linear infinite">')
        o.append(f'<polygon points="{pts(gear_poly(cx, py, N, 10, ph))}" fill="{fill}" {L}/>')
        rr = 10 * N / 2 - 30
        o.append(f'<circle cx="{cx}" cy="{py}" r="{rr:.0f}" fill="none" stroke="#111111" stroke-width="3" stroke-dasharray="{"6 8" if N == 30 else "4 6"}"/>')
        if N == 30:
            o += [f'<circle cx="{cx + 78 * math.cos(a):.1f}" cy="{py + 78 * math.sin(a):.1f}" r="20" fill="#f5f5f5" {L}/>' for a in np.linspace(0, 2 * math.pi, 7)[:-1] + math.pi / 6]
        o.append(f'<circle cx="{cx}" cy="{py}" r="{36 if N == 30 else 22}" fill="#ffffff" {L}/><circle cx="{cx}" cy="{py}" r="10" fill="#111111"/>'
                 f'<path d="M{cx} {py - (30 if N == 30 else 18)} V{py - 14}" stroke="#111111" stroke-width="5" stroke-linecap="round"/></g>')
    # rotation arrows: the small gear spins fast (double), the big gear slowly the other way
    o.append(f'<path d="M{px - 70} {py - 96} A 110 110 0 0 1 {px + 70} {py - 96}" fill="none" stroke="#111111" stroke-width="5" marker-end="url(#ga)"/>'
             f'<path d="M{px - 56} {py - 118} A 132 132 0 0 1 {px + 56} {py - 118}" fill="none" stroke="#111111" stroke-width="5" marker-end="url(#ga)"/>')
    o.append(f'<path d="M{gx + 120} {py - 180} A 220 220 0 0 0 {gx - 40} {py - 206}" fill="none" stroke="#111111" stroke-width="5" marker-end="url(#ga)"/>')
    # the happy figure
    o.append(f'<g {L} fill="none"><circle cx="720" cy="772" r="26" fill="#ffffff"/><path d="M710 768 v2 M730 768 v2"/><path d="M710 780 Q720 790 730 780"/>'
             '<path d="M720 798 V840 M720 812 L690 790 M720 812 L752 790 M720 840 L700 874 M720 840 L740 874"/></g>')
    o += [txt(142, 726, 'Motor', 'lbl', 'middle'), txt(px, 718, 'Pinion', 'lbl', 'middle'), txt(gx, 368, 'Gear', 'lbl', 'middle'),
          txt(AW - 40, 668, 'Output', 'lbl', 'end')]
    return svgw(AW, AH, ''.join(o), 'Assembly manual: parts, then a motor driving a small blue pinion that turns a large yellow gear')

FP = dict(n=3, slug='flat-pack', name='Flat-Pack', canvas='#ffffff', accent=['#0058a3', '#ffdb00'],
    faces=[('Noto Sans', 'NotoSans-100-900.woff2', '100 900')],
    css='''.slide{color:#111111;font-family:"Noto Sans",sans-serif}
 .kicker{display:inline-block;padding:8px 16px;border-radius:4px;background:#ffdb00;font-weight:700}
 h1{font-weight:800;letter-spacing:-.02em}
 h1 .hl{color:#0058a3}
 p{color:#484848}
 .art{background:#f5f5f5;border-radius:8px}
 .lbl,.nt,.tk,.ax,.co{font-family:"Noto Sans";font-weight:700;fill:#111111}.nn{font-family:"Noto Sans";font-weight:800;font-size:48px;fill:#111111}''',
    node=lambda i, x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{"#ffdb00" if i == 3 else "#f5f5f5"}" stroke="#111111" stroke-width="{0 if i < 3 else 0}"/>',
    num=lambda i, x, y: f'<circle cx="{x + 44}" cy="{y + 44}" r="24" fill="#ffffff" stroke="#111111" stroke-width="3"/>' + txt(x + 44, y + 54, str(i + 1), 'nn', 'middle'),
    arrow='#111111', aw=4, ahead=4,
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y0} V{y1} H{x1}" fill="none" stroke="#111111" stroke-width="4"/>',
    line=lambda P: f'<polyline points="{pts(P)}" fill="none" stroke="#111111" stroke-width="4" stroke-linejoin="round"/>',
    point=lambda i, x, y, hi: f'<rect x="{x - 12:.1f}" y="{y - 12:.1f}" width="24" height="24" fill="#ffdb00" stroke="#111111" stroke-width="3"/>')

# =================================================================== 4 · HAPPY HEADSPACE — hydrogen-bonded water
def molecule(cx, cy, dirdeg, s=1.0, face=None, op=1.0, period=2):
    o = [f'<g opacity="{op}" style="transform-box:fill-box;transform-origin:50% 50%;animation:vib {period}s ease-in-out infinite;animation-delay:-{(cx % 13) / 13 * period:.2f}s">']
    for d in (dirdeg - 52.25, dirdeg + 52.25):
        a = math.radians(d); o.append(f'<circle cx="{cx + 72 * s * math.cos(a):.1f}" cy="{cy + 72 * s * math.sin(a):.1f}" r="{33 * s:.1f}" fill="#ffce00"/>')
    o.append(f'<circle cx="{cx}" cy="{cy}" r="{58 * s:.1f}" fill="#ff7300"/>'
             f'<circle cx="{cx - 18 * s:.1f}" cy="{cy - 20 * s:.1f}" r="{16 * s:.1f}" fill="#ffffff" opacity=".28"/>')
    if face:
        sw = max(3, 6 * s)
        eyes = (f'<path d="M{cx - 30 * s:.1f} {cy - 6 * s:.1f} Q{cx - 19 * s:.1f} {cy - 20 * s:.1f} {cx - 8 * s:.1f} {cy - 6 * s:.1f}"/>'
                f'<path d="M{cx + 8 * s:.1f} {cy - 6 * s:.1f} Q{cx + 19 * s:.1f} {cy - 20 * s:.1f} {cx + 30 * s:.1f} {cy - 6 * s:.1f}"/>')
        if face == 'wink':
            eyes = (f'<path d="M{cx - 30 * s:.1f} {cy - 12 * s:.1f} H{cx - 8 * s:.1f}"/>'
                    f'<path d="M{cx + 8 * s:.1f} {cy - 6 * s:.1f} Q{cx + 19 * s:.1f} {cy - 20 * s:.1f} {cx + 30 * s:.1f} {cy - 6 * s:.1f}"/>')
        o.append(f'<g fill="none" stroke="#2d2c2b" stroke-width="{sw:.1f}" stroke-linecap="round">{eyes}'
                 f'<path d="M{cx - 22 * s:.1f} {cy + 14 * s:.1f} Q{cx:.1f} {cy + 36 * s:.1f} {cx + 22 * s:.1f} {cy + 14 * s:.1f}"/></g>')
    return ''.join(o) + '</g>'

def art_water():
    o = []
    o.append('<path d="M120 120 C 300 20, 640 40, 760 200 C 860 340, 800 640, 660 780 C 520 900, 200 880, 100 720 C 0 560, -20 220, 120 120 Z" fill="#f9f4f2"/>')
    c = (400, 440)
    pos = {'A': (c[0] + 250 * math.cos(math.radians(-38)), c[1] + 250 * math.sin(math.radians(-38))),
           'B': (c[0] + 250 * math.cos(math.radians(-142)), c[1] + 250 * math.sin(math.radians(-142))),
           'C': (c[0] + 250 * math.cos(math.radians(35)), c[1] + 250 * math.sin(math.radians(35))),
           'D': (c[0] + 250 * math.cos(math.radians(145)), c[1] + 250 * math.sin(math.radians(145)))}
    hpos = lambda o_, d: (o_[0] + 72 * math.cos(math.radians(d)), o_[1] + 72 * math.sin(math.radians(d)))
    def hbond(h, oc):
        vx, vy = oc[0] - h[0], oc[1] - h[1]; L = math.hypot(vx, vy); ux, uy = vx / L, vy / L
        a, b = (h[0] + ux * 40, h[1] + uy * 40), (oc[0] - ux * 66, oc[1] - uy * 66)
        return f'<path class="fl" d="M{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f}" stroke="#3b197f" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 18"/>'
    # hydrogen bonds: centre donates to A and B, C and D donate to the centre
    ch = [hpos(c, -90 + 52.25), hpos(c, -90 - 52.25)]
    o += [hbond(ch[0], pos['A']), hbond(ch[1], pos['B']),
          hbond(hpos(pos['C'], 215), c), hbond(hpos(pos['D'], 325), c)]
    # jiggle marks (thermal motion)
    for (x, y, a) in ((150, 470, 0), (650, 470, 180), (400, 800, 90), (430, 110, -90), (760, 620, 150)):
        r = math.radians(a)
        o.append(f'<g transform="translate({x} {y}) rotate({a})" fill="none" stroke="#27455c" stroke-width="6" stroke-linecap="round">'
                 '<path d="M-10 -22 Q -22 0 -10 22"/><path d="M8 -32 Q -10 0 8 32"/></g>')
    # far, faded molecules for depth
    o += [molecule(720, 110, 200, .5, None, .4, 3), molecule(96, 800, -30, .55, None, .4, 3), molecule(770, 800, 250, .45, None, .4, 3)]
    o += [molecule(*pos['A'], -38, 1, None, 1, 1.5), molecule(*pos['B'], -142, 1, None, 1, 2),
          molecule(*pos['C'], 267, 1, None, 1, 2), molecule(*pos['D'], 273, 1, None, 1, 1.5), molecule(*c, -90, 1.08, None, 1, 3)]
    lead = lambda d: f'<path d="{d}" stroke="#2d2c2b" stroke-width="3" stroke-linecap="round" fill="none"/>'
    o += [txt(484, 470, 'Oxygen'), txt(203, 160, 'Hydrogen', 'lbl', 'middle'), txt(560, 400, 'Hydrogen bond'),
          lead('M556 390 L522 370')]
    return svgw(AW, AH, ''.join(o), 'Five smiling water molecules linked by dotted hydrogen bonds')

HS_COL = ['#ffce00', '#ffa1cc', '#ffa500', '#ffa1cc']
HS = dict(n=4, slug='happy-headspace', name='Happy Headspace', canvas='#ffffff', accent=['#ff7300', '#ffce00', '#ffa1cc', '#ffa500', '#3b197f'],
    faces=[('Quicksand', 'Quicksand-300-700.ttf', '300 700'), ('DM Sans', 'DMSans-100-1000.woff2', '100 1000'), ('Reno Mono', 'RenoMono-400.otf', 400)],
    css='''.slide{color:#2d2c2b;font-family:"DM Sans",sans-serif}
 .kicker{display:inline-block;padding:8px 24px;border-radius:9999px;background:#ffce00;font-family:"Reno Mono",monospace;text-transform:uppercase}
 h1{font-family:Quicksand,sans-serif;font-weight:700;letter-spacing:-.02em}
 h1 .hl{text-decoration:underline wavy #ff7300;text-decoration-thickness:6px;text-underline-offset:18px;text-decoration-skip-ink:none}
 p{font-weight:500;color:#44423f}
 .lbl,.nt,.tk,.ax,.co{font-family:"DM Sans";font-weight:600;fill:#2d2c2b}.nn{font-family:"Reno Mono";fill:#2d2c2b}''',
    node=lambda i, x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="116" fill="{HS_COL[i]}"/>',
    num=lambda i, x, y: f'<circle cx="{x + 180}" cy="{y + 40}" r="24" fill="#ffffff"/>' + txt(x + 180, y + 50, str(i + 1), 'nn', 'middle'),
    arrow='#ff7300', aw=8,
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y0} V{y1} H{x1}" fill="none" stroke="#44423f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    line=lambda P: f'<polyline points="{pts(P)}" fill="none" stroke="#ff7300" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>',
    point=lambda i, x, y, hi: f'<circle cx="{x:.1f}" cy="{y:.1f}" r="16" fill="{["#ffce00", "#ffa1cc", "#3b197f", "#ffa500", "#27455c"][i % 5]}" stroke="#ffffff" stroke-width="5"/>')

# =================================================================== 5 · YELLOW FRAME — geothermal power (light documentary cutaway)
def art_geothermal():
    x0, y0, x1, y1 = 48, 48, AW - 48, AH - 48
    wave = lambda base, A, f, ph: ' '.join(f'L{x:.0f} {base + A * math.sin(x * f + ph) + A * .5 * math.sin(x * f * 2.3 + ph * 1.7):.1f}' for x in range(x0, x1 + 1, 12))
    o = ['<defs><clipPath id="yc"><rect x="48" y="48" width="' + str(x1 - x0) + '" height="' + str(y1 - y0) + '"/></clipPath>'
         '<linearGradient id="ysky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7eaf7"/><stop offset="1" stop-color="#f4f7ee"/></linearGradient>'
         '<linearGradient id="yhot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c07c"/><stop offset="1" stop-color="#ee8a45"/></linearGradient>'
         '<linearGradient id="ytower" x1="0" x2="1"><stop offset="0" stop-color="#c9ced3"/><stop offset=".5" stop-color="#f1f3f5"/><stop offset="1" stop-color="#b8bec4"/></linearGradient>'
         '<linearGradient id="yprod" x1="0" x2="1"><stop offset="0" stop-color="#b8441c"/><stop offset=".5" stop-color="#e5733d"/><stop offset="1" stop-color="#b8441c"/></linearGradient>'
         '<linearGradient id="yinj" x1="0" x2="1"><stop offset="0" stop-color="#2d6aa6"/><stop offset=".5" stop-color="#5b9bd5"/><stop offset="1" stop-color="#2d6aa6"/></linearGradient>'
         '<filter id="ysteam"><feGaussianBlur stdDeviation="9"/></filter>' + marker('ya', '#000000', 3) + '</defs><g clip-path="url(#yc)">',
         f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="url(#ysky)"/>',
         f'<path d="M{x0} 250 L120 190 L190 220 L270 160 L360 214 L450 176 L560 222 L650 170 L{x1} 214 V270 H{x0} Z" fill="#c8d8c6"/>']
    layers = [(262, 0, '#9cc47a'), (274, 5, '#e3d0aa'), (350, 10, '#d7be93'), (452, 12, '#caa97e'), (566, 14, '#bd9b75'), (676, 16, 'url(#yhot)')]
    for k, (base, A, fill) in enumerate(layers):
        o.append(f'<path d="M{x0} {base} {wave(base, A, .018 + .004 * k, k * 1.3)} V{y1} H{x0} Z" fill="{fill}"/>')
    # rock texture
    rng = np.random.default_rng(3)
    for _ in range(170):
        x, y = rng.uniform(x0, x1), rng.uniform(360, 670)
        o.append(f'<path d="M{x:.0f} {y:.0f} h{rng.uniform(6, 14):.0f}" stroke="#8c6f50" stroke-width="2" opacity=".45"/>')
    for _ in range(9):
        x = rng.uniform(x0 + 30, x1 - 30); y = rng.uniform(700, 820)
        o.append(f'<path d="M{x:.0f} {y:.0f} l{rng.uniform(-40, 40):.0f} {rng.uniform(20, 40):.0f} l{rng.uniform(-30, 30):.0f} {rng.uniform(20, 40):.0f}" stroke="#a8471b" stroke-width="3" fill="none" opacity=".6"/>')
    # wells
    o += [f'<rect x="250" y="250" width="18" height="520" fill="url(#yprod)" stroke="#000" stroke-width="3"/>',
          f'<rect x="690" y="250" width="18" height="520" fill="url(#yinj)" stroke="#000" stroke-width="3"/>',
          '<path class="fl" d="M259 766 V262" stroke="#ffffff" stroke-width="6" stroke-dasharray="12 28" stroke-linecap="round"/>',
          '<path class="fl" d="M699 262 V766" stroke="#ffffff" stroke-width="6" stroke-dasharray="12 28" stroke-linecap="round"/>']
    for y in range(330, 760, 140):
        o.append(f'<path d="M250 {y + 16} L259 {y} L268 {y + 16}" fill="#000"/><path d="M690 {y} L699 {y + 16} L708 {y}" fill="#000"/>')
    o.append('<path class="fl" d="M699 790 C 600 846, 360 852, 262 790" fill="none" stroke="#000" stroke-width="5" stroke-dasharray="14 16" marker-end="url(#ya)"/>')
    # surface plant: turbine hall, pipes, cooling tower with steam, trees
    o += ['<path d="M259 250 V226 H300" fill="none" stroke="#b8441c" stroke-width="10"/>',
          '<path d="M372 226 H470" fill="none" stroke="#8a929a" stroke-width="10"/>',
          '<path d="M560 240 H699 V250" fill="none" stroke="#2d6aa6" stroke-width="10"/>',
          '<rect x="288" y="190" width="100" height="72" fill="#eef0f2" stroke="#6b737b" stroke-width="2"/><path d="M280 190 L338 160 L396 190 Z" fill="#9aa3ab"/>',
          ''.join(f'<rect x="{x}" y="212" width="16" height="22" fill="#9cc3e0"/>' for x in (302, 330, 358)),
          '<path d="M470 262 C 482 214, 482 190, 474 150 H566 C 558 190, 558 214, 570 262 Z" fill="url(#ytower)" stroke="#8a929a" stroke-width="2"/>',
          '<g filter="url(#ysteam)" fill="#ffffff">' + ''.join(f'<circle cx="{520 + 10 * k}" cy="{126 - 8 * k}" r="{34 + 4 * k}" style="transform-box:fill-box;transform-origin:50% 50%;animation:puff 3s linear infinite;animation-delay:-{k * 0.75:.2f}s"/>' for k in range(4)) + '</g>']
    for tx in (96, 140, 760):
        o.append(f'<path d="M{tx} 262 L{tx + 16} 218 L{tx + 32} 262 Z" fill="#5f8f45"/><rect x="{tx + 14}" y="262" width="4" height="6" fill="#6b4a2b"/>')
    o.append('</g>')
    o.append(f'<rect x="24" y="24" width="{AW - 48}" height="{AH - 48}" fill="none" stroke="#ffcc00" stroke-width="48"/>')
    dot = lambda x, y: f'<circle cx="{x}" cy="{y}" r="6" fill="#000"/>'
    lead = lambda d: f'<path d="{d}" stroke="#000" stroke-width="3" fill="none"/>'
    def tag(x, y, s, end=False):                      # National Geographic infographic callout: white capitals on a black tag
        w = len(s) * 20 + 32; x0 = x - w if end else x
        return f'<rect x="{x0}" y="{y - 36}" width="{w}" height="52" fill="#000"/>' + txt(x0 + 16, y, s)
    o += [tag(72, 152, 'Turbine'), lead('M150 168 V200 H286'), dot(290, 200),
          tag(296, 500, 'Production well'), lead('M296 482 H272'), dot(268, 482),
          tag(670, 620, 'Injection well', True), lead('M670 602 H690'), dot(690, 602),
          tag(AW / 2 - 100, 776, 'Hot rock')]
    return svgw(AW, AH, ''.join(o), 'Cutaway of a geothermal plant: a production well brings hot water up to a turbine, an injection well returns it to hot rock')

YF = dict(n=5, slug='yellow-frame', name='Yellow Frame', canvas='#ffffff', accent=['#ffcc00'],
    faces=[('Source Serif 4', 'SourceSerif4-200-900.woff2', '200 900'), ('Open Sans', 'OpenSans-300-800.woff2', '300 800')],
    css='''.slide{color:#000;font-family:"Open Sans",sans-serif}
 .kicker{font-weight:700;text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;gap:16px}
 .kicker::before{content:"";width:16px;height:24px;border:5px solid #ffcc00;flex:none}
 h1{font-family:"Source Serif 4",serif;font-weight:600;font-variation-settings:"opsz" 60;letter-spacing:-.01em}
 p{color:#333333}
 .text::before{content:"";display:block;width:96px;height:8px;background:#000;margin-bottom:24px}
 .lbl{font-family:"Open Sans";font-weight:700;fill:#ffffff;text-transform:uppercase;letter-spacing:.06em}
 .nt{font-family:"Open Sans";font-weight:600;fill:#000}.nn{font-family:"Open Sans";font-weight:700;fill:#000}
 .tk,.ax{font-family:"Open Sans";font-weight:400;fill:#333333}.co{font-family:"Source Serif 4";font-weight:600;fill:#000}''',
    node=lambda i, x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff" stroke="#000" stroke-width="2"/>',
    num=lambda i, x, y: f'<rect x="{x}" y="{y}" width="56" height="56" fill="#ffcc00"/>' + txt(x + 28, y + 38, str(i + 1), 'nn', 'middle'),
    arrow='#000', aw=3, ahead=5, grid='#e6e6e6',
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y1} H{x1}" stroke="#000" stroke-width="2"/>',
    line=lambda P: f'<polyline points="{pts(P)}" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>',
    point=lambda i, x, y, hi: (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="18" fill="#ffcc00" stroke="#000" stroke-width="2"/>' if hi else
                               f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#000"/>'))

# =================================================================== illustrated, animated process slides (Aura rule: no boxed flowcharts)
def tri(x, y, ang, col='#000', s=14):
    a = math.radians(ang); P = [(x + s * math.cos(a), y + s * math.sin(a)), (x + s * math.cos(a + 2.4), y + s * math.sin(a + 2.4)), (x + s * math.cos(a - 2.4), y + s * math.sin(a - 2.4))]
    return f'<polygon points="{pts(P)}" fill="{col}"/>'
travel = lambda dx, dy, period=3: f'style="--dx:{dx}px;--dy:{dy}px;animation:travel {period}s ease-in-out infinite"'

def flow_distillation():
    pipe = lambda d: (f'<path d="{d}" fill="none" stroke="#000" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>'
                      f'<path d="{d}" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
                      f'<path class="fl" d="{d}" fill="none" stroke="#ff90e8" stroke-width="9" stroke-dasharray="14 26"/>')
    o = [pipe('M200 330 H440'), pipe('M600 300 H840'), pipe('M960 110 H1060 V270 H1180'), pipe('M1340 270 H1560 V330')]
    o += [tri(330, 330, 0), tri(730, 300, 0), tri(1120, 270, 0), tri(1450, 270, 0)]
    # feed tank
    o.append(hard('<rect x="40" y="150" width="160" height="240" rx="24" fill="#ffffff"/>'))
    o.append('<path d="M47 268 Q 84 252 120 268 T 193 268 V 366 Q 193 383 176 383 H 64 Q 47 383 47 366 Z" fill="#ffc900" stroke="#000" stroke-width="3" style="animation:bob 3s ease-in-out infinite"/>')
    # heater
    o.append(hard('<rect x="440" y="230" width="160" height="150" rx="20" fill="#f3a642"/>'))
    o.append('<path d="M466 305 l14 -30 l14 60 l14 -60 l14 60 l14 -60 l14 60 l14 -60 l14 60 l14 -30" fill="none" stroke="#000" stroke-width="4" stroke-linejoin="round"/>')
    for k, fx in enumerate((480, 520, 560)):
        o.append(f'<path d="M{fx} 426 C {fx - 16} 416, {fx - 10} 400, {fx} 390 C {fx + 10} 400, {fx + 16} 416, {fx} 426 Z" fill="#dc341e" stroke="#000" stroke-width="3" '
                 f'style="transform-box:fill-box;transform-origin:50% 100%;animation:flick 1s ease-in-out infinite;animation-delay:-{k * .33:.2f}s"/>')
    # column with trays and rising bubbles
    o.append(hard('<rect x="840" y="60" width="120" height="380" rx="30" fill="#ffffff"/>'))
    heat = ['#dc341e', '#f3a642', '#ffc900', '#ffc900', '#90a8ed', '#23a094']
    for k, ty in enumerate((400, 345, 290, 235, 180, 125)):
        a, b = (846, 930) if k % 2 == 0 else (870, 954)
        o.append(f'<rect x="{a}" y="{ty - 12}" width="{b - a}" height="12" fill="#ffc900" stroke="#000" stroke-width="3"/><path d="M{a} {ty} H{b}" stroke="#000" stroke-width="4"/>')
        for j, bx in enumerate((866, 900, 934)):
            o.append(f'<circle cx="{bx}" cy="{ty + 30}" r="{6 + 2 * (j % 2)}" fill="{heat[k]}" stroke="#000" stroke-width="3" style="animation:rise 1.5s linear infinite;animation-delay:-{(k * .41 + j * .5) % 1.5:.2f}s"/>')
    o.append('<rect x="840" y="60" width="120" height="380" rx="30" fill="none" stroke="#000" stroke-width="5"/>')
    # condenser
    o.append(hard('<rect x="1180" y="230" width="160" height="80" rx="40" fill="#90a8ed"/>'))
    o.append('<path d="M1206 270 l14 -22 l14 44 l14 -44 l14 44 l14 -44 l14 44 l14 -44 l14 44 l14 -22" fill="none" stroke="#000" stroke-width="4" stroke-linejoin="round"/>')
    # product flask with drips
    o.append(hard('<path d="M1540 318 V366 L1484 452 Q1476 468 1494 468 H1626 Q1644 468 1636 452 L1580 366 V318 Z" fill="#ffffff"/>'))
    o.append('<path d="M1505 420 H1615 L1636 452 Q1644 468 1626 468 H1494 Q1476 468 1484 452 Z" fill="#23a094" stroke="#000" stroke-width="3" style="animation:bob 3s ease-in-out infinite"/>')
    o += [f'<circle cx="1560" cy="342" r="7" fill="#23a094" stroke="#000" stroke-width="2" style="animation:drip 1.5s ease-in infinite;animation-delay:-{d:.2f}s"/>' for d in (0, .75)]
    o.append(hard('<path d="M300 90 L310 116 L336 126 L310 136 L300 162 L290 136 L264 126 L290 116 Z" fill="#ffc900"/>', 5, 5))
    o += [txt(520, 470, 'Preheat', anchor='middle'), txt(900, 486, 'Vaporise', anchor='middle'), txt(1260, 206, 'Condense', anchor='middle'), txt(1560, 512, 'Collect', anchor='middle')]
    return svgw(VW, VH, ''.join(o), 'Process: feed is preheated, vaporised in the column, condensed, and collected as pure product')

def flow_tunnel():
    dark = ' style="fill:#0a0b0d"'
    def bounds(x):
        if x < 380:
            s = (x - 40) / 340; s = s * s * (3 - 2 * s); return 70 + 100 * s, 460 - 100 * s
        if x <= 860: return 170, 360
        f = (x - 860) / 440; return 170 - 40 * f, 360 + 40 * f
    o = [f'<path d="M40 70 C 200 70, 260 170, 380 170 H 860 L 1300 130 V 400 L 860 360 H 380 C 260 360, 200 460, 40 460 Z" fill="#0052ff"/>']
    for x in range(120, 176, 14):
        t, b = bounds(x); o.append(f'<path d="M{x} {t + 8:.0f} V{b - 8:.0f}" stroke="#ffffff" stroke-width="3" opacity=".7"/>')
    for k, f in enumerate((.12, .27, .41, .59, .73, .88)):
        P = []
        for x in range(200, 1300, 12):
            t, b = bounds(x); y = t + (b - t) * f
            y += (-1 if f < .5 else 1) * 26 * math.exp(-((x - 640) / 70) ** 2) * (1 - abs(f - .5) * 1.6)
            P.append((x, y))
        o.append(f'<polyline class="fl" points="{pts(P)}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="22 38" style="animation-delay:-{k * .31:.2f}s"/>')
    # wing on its sting, angle gauge, lift arrow
    o.append('<path d="M626 272 V400" stroke="#0a0b0d" stroke-width="8"/><rect x="590" y="400" width="80" height="50" rx="6" fill="#0a0b0d"/>')
    o.append('<g transform="rotate(-8 640 268)"><path d="M570 268 C 590 240, 670 238, 730 262 C 670 272, 610 280, 570 268 Z" fill="#0a0b0d"/></g>')
    o.append('<path d="M520 268 H760" stroke="#ffffff" stroke-width="2" stroke-dasharray="6 8"/><path d="M548 268 A 92 92 0 0 1 551 255" fill="none" stroke="#ffffff" stroke-width="4"/>')
    o.append('<g style="animation:bob 3s ease-in-out infinite"><path d="M640 246 V190" stroke="#ffffff" stroke-width="10"/><path d="M622 196 L640 168 L658 196 Z" fill="#ffffff"/></g>')
    # fan in the diffuser
    o.append('<circle cx="1180" cy="265" r="106" fill="#0a0b0d"/>'
             '<g style="transform-origin:1180px 265px;animation:spin 1s linear infinite">'
             + ''.join(f'<ellipse cx="1180" cy="205" rx="22" ry="56" fill="#ffffff" transform="rotate({a} 1180 265)"/>' for a in (0, 90, 180, 270)) +
             '</g><circle cx="1180" cy="265" r="16" fill="#0052ff"/>')
    # data cable and monitor tracing the lift curve
    o.append('<path d="M670 425 H1360 V300 H1400" fill="none" stroke="#0a0b0d" stroke-width="4"/>'
             '<path class="fl" d="M670 425 H1360 V300 H1400" fill="none" stroke="#0052ff" stroke-width="4" stroke-dasharray="10 20"/>')
    o.append('<rect x="1400" y="140" width="300" height="240" rx="16" fill="#0a0b0d"/><rect x="1416" y="156" width="268" height="184" rx="6" fill="#ffffff"/>'
             '<rect x="1540" y="380" width="20" height="30" fill="#0a0b0d"/><rect x="1496" y="408" width="108" height="12" rx="6" fill="#0a0b0d"/>')
    cl = [(a, 0.2 + 0.1 * a if a <= 14 else 1.6 - 0.14 * (a - 14)) for a in range(0, 19, 1)]
    C = [(1436 + a / 18 * 228, 324 - v / 1.8 * 150) for a, v in cl]
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in C)
    o.append(f'<path d="M1436 324 H1668 M1436 324 V170" stroke="#5b616e" stroke-width="2"/><path d="{d}" fill="none" stroke="#0052ff" stroke-width="5" stroke-linejoin="round"/>'
             f'<circle r="10" fill="#0a0b0d"><animateMotion dur="6s" repeatCount="indefinite" path="{d}"/></circle>')
    o += [txt(640, 150, 'Set angle', 'lbl', 'middle', dark), txt(1180, 112, 'Run tunnel', 'lbl', 'middle', dark),
          txt(630, 494, 'Measure forces', 'lbl', 'middle', dark), txt(1550, 462, 'Compute lift', 'lbl', 'middle', dark)]
    return svgw(VW, VH, ''.join(o), 'Wind tunnel: fan drives air past a wing set at an angle; a balance measures the forces and a screen plots lift')

def flow_assembly():
    L = 'stroke="#111111" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'
    o = ['<defs>' + marker('fa', '#111111', 4) + '</defs>']
    bearing = lambda cx, cy: (f'<circle cx="{cx}" cy="{cy}" r="34" fill="#ffffff" {L}/><circle cx="{cx}" cy="{cy}" r="16" fill="#f5f5f5" {L}/>'
                              + ''.join(f'<circle cx="{cx + 25 * math.cos(a):.1f}" cy="{cy + 25 * math.sin(a):.1f}" r="6" fill="#ffdb00" stroke="#111111" stroke-width="2"/>' for a in np.linspace(0, 2 * math.pi, 9)[:-1]))
    housing = lambda cx: f'<path d="M{cx - 120} 250 H{cx + 120} V400 H{cx - 120} Z" fill="#ffffff" {L}/><path d="M{cx - 120} 250 L{cx - 96} 226 H{cx + 144} L{cx + 120} 250 M{cx + 144} 226 V376 L{cx + 120} 400" fill="#f5f5f5" {L}/>'
    for i in range(4):
        x0, cx = i * 432, i * 432 + 216
        o.append(txt(x0 + 24, 64, str(i + 1), 'nn'))
        if i < 3: o.append(f'<path d="M{x0 + 404} 300 H{x0 + 452}" stroke="#111111" stroke-width="5" marker-end="url(#fa)"/>')
    # 1 bearing pressed into the housing bore
    cx = 216
    o.append(housing(cx) + f'<circle cx="{cx}" cy="310" r="36" fill="#f5f5f5" {L}/>')
    o.append(f'<path d="M{cx} 150 V256" stroke="#111111" stroke-width="3" stroke-dasharray="8 8"/>')
    o.append(f'<g {travel(0, 160)}>{bearing(cx, 150)}</g>')
    # 2 shaft slides through the bearing
    cx = 648
    o.append(housing(cx) + bearing(cx, 310))
    o.append(f'<g {travel(150, 0)}><path d="M{cx - 330} 300 H{cx - 90} A10 10 0 0 1 {cx - 90} 320 H{cx - 330} A10 10 0 0 1 {cx - 330} 300 Z" fill="#ffffff" {L}/></g>')
    # 3 gears mesh and turn
    for (gcx, N, m, fill, turn, ph) in ((1010, 10, 8, '#0058a3', 'spin 3s', -0.25 * 2 * math.pi / 10), (1130, 20, 8, '#ffdb00', 'spinr 6s', math.pi - 0.73 * 2 * math.pi / 20)):
        o.append(f'<g style="transform-origin:{gcx}px 300px;animation:{turn} linear infinite"><polygon points="{pts(gear_poly(gcx, 300, N, m, ph))}" fill="{fill}" {L}/>'
                 f'<circle cx="{gcx}" cy="300" r="14" fill="#ffffff" {L}/><path d="M{gcx} {300 - N * m / 2 + 18:.0f} V286" stroke="#111111" stroke-width="4"/></g>')
    # 4 lid closes, screws go in
    cx = 1512
    o.append(housing(cx))
    o.append(f'<g {travel(0, 76)}><path d="M{cx - 128} 150 H{cx + 128} V174 H{cx - 128} Z" fill="#0058a3" {L}/>'
             + ''.join(f'<rect x="{sx - 8}" y="118" width="16" height="22" fill="#ffffff" {L}/>' for sx in (cx - 90, cx + 90)) + '</g>')
    o += [txt(216, 470, 'Fit bearings', 'lbl', 'middle'), txt(648, 470, 'Mount shafts', 'lbl', 'middle'),
          txt(1070, 470, 'Mesh gears', 'lbl', 'middle'), txt(1512, 470, 'Close housing', 'lbl', 'middle')]
    return svgw(VW, VH, ''.join(o), 'Assembly manual in four moving steps: fit bearings, mount shafts, mesh gears, close housing')

def flow_md_cycle():
    cx, cy, rx, ry = 864, 290, 430, 168
    ring = f'M {cx - rx} {cy} A {rx} {ry} 0 1 1 {cx + rx} {cy} A {rx} {ry} 0 1 1 {cx - rx} {cy}'
    o = [f'<path d="{ring}" fill="none" stroke="#ffe0c7" stroke-width="26"/><path d="{ring}" fill="none" stroke="#ff7300" stroke-width="8"/>']
    for a in (45, 135, 225, 315):
        t = math.radians(a); x, y = cx + rx * math.cos(t), cy + ry * math.sin(t)
        o.append(tri(x, y, a + 90 + (12 if a in (45, 225) else -12), '#ff7300', 18))
    o.append(f'<circle r="18" fill="#ff7300" stroke="#ffffff" stroke-width="6"><animateMotion dur="6s" repeatCount="indefinite" path="M {cx} {cy - ry} A {rx} {ry} 0 1 1 {cx} {cy + ry} A {rx} {ry} 0 1 1 {cx} {cy - ry}"/></circle>')
    disc = lambda x, y: f'<circle cx="{x}" cy="{y}" r="84" fill="#fff1e6"/>'
    # top: compute forces
    x, y = cx, cy - ry
    o.append(disc(x, y) + f'<circle cx="{x - 34}" cy="{y}" r="30" fill="#ff7300"/><circle cx="{x + 38}" cy="{y}" r="22" fill="#ffce00"/>'
             f'<g style="transform-box:fill-box;transform-origin:50% 50%;animation:pulse 1.5s ease-in-out infinite"><path d="M{x - 2} {y} H{x + 12}" stroke="#3b197f" stroke-width="6" stroke-linecap="round"/>{tri(x + 14, y, 0, "#3b197f", 10)}'
             f'<path d="M{x - 66} {y} H{x - 80}" stroke="#3b197f" stroke-width="6" stroke-linecap="round"/>{tri(x - 82, y, 180, "#3b197f", 10)}</g>')
    # right: update velocities
    x, y = cx + rx, cy
    o.append(disc(x, y) + f'<circle cx="{x - 24}" cy="{y}" r="32" fill="#ff7300"/>'
             f'<g style="transform-box:fill-box;transform-origin:0% 50%;animation:grow 3s ease-in-out infinite"><path d="M{x + 12} {y} H{x + 56}" stroke="#27455c" stroke-width="8" stroke-linecap="round"/>{tri(x + 60, y, 0, "#27455c", 14)}</g>'
             f'<path d="M{x - 80} {y - 20} H{x - 64} M{x - 84} {y} H{x - 64} M{x - 80} {y + 20} H{x - 64}" stroke="#ffa500" stroke-width="5" stroke-linecap="round"/>')
    # bottom: move atoms
    x, y = cx, cy + ry
    o.append(disc(x, y))
    for k, (ax, ay, col) in enumerate(((x - 40, y - 24, '#ff7300'), (x + 34, y - 10, '#ffa500'), (x - 6, y + 34, '#ffce00'))):
        o.append(f'<path d="M{ax - 44} {ay + 8} Q{ax - 22} {ay - 10} {ax - 4} {ay}" fill="none" stroke="#3b197f" stroke-width="4" stroke-dasharray="4 8" stroke-linecap="round"/>'
                 f'<circle cx="{ax}" cy="{ay}" r="18" fill="{col}" style="transform-box:fill-box;transform-origin:50% 50%;animation:vib {1.5 + k * .5}s ease-in-out infinite"/>')
    # left: save frame
    x, y = cx - rx, cy
    o.append(disc(x, y) + f'<rect x="{x - 56}" y="{y - 44}" width="112" height="88" rx="12" fill="#27455c"/>'
             + ''.join(f'<rect x="{x - 48 + 22 * k}" y="{y - 38}" width="10" height="8" rx="2" fill="#ffffff"/><rect x="{x - 48 + 22 * k}" y="{y + 30}" width="10" height="8" rx="2" fill="#ffffff"/>' for k in range(5))
             + f'<rect x="{x - 40}" y="{y - 22}" width="80" height="44" rx="6" fill="#fff1e6"/><circle cx="{x - 14}" cy="{y}" r="9" fill="#ff7300"/><circle cx="{x + 14}" cy="{y + 4}" r="7" fill="#ffce00"/>'
             f'<rect x="{x - 40}" y="{y - 22}" width="80" height="44" rx="6" fill="#ffffff" style="animation:blink 3s linear infinite"/>')
    o += [txt(cx + 96, cy - ry - 44, 'Compute forces'), txt(cx + rx + 104, cy + 10, 'Update velocities'),
          txt(cx + 96, cy + ry + 66, 'Move atoms'), txt(cx - rx - 104, cy + 10, 'Save frame', 'lbl', 'end')]
    return svgw(VW, VH, ''.join(o), 'Simulation loop: compute forces, update velocities, move atoms, save a frame, and repeat')

def flow_geo_loop():
    x0, y0, x1, y1 = 24, 24, VW - 24, VH - 24
    o = ['<defs><clipPath id="gc"><rect x="24" y="24" width="' + str(x1 - x0) + '" height="' + str(y1 - y0) + '"/></clipPath>'
         '<linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7eaf7"/><stop offset="1" stop-color="#f4f7ee"/></linearGradient>'
         '<linearGradient id="gh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c07c"/><stop offset="1" stop-color="#ee8a45"/></linearGradient>'
         '<filter id="gst"><feGaussianBlur stdDeviation="8"/></filter>' + marker('ga', '#000', 3) + '</defs><g clip-path="url(#gc)">',
         f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="url(#gs)"/>',
         f'<path d="M{x0} 200 L200 150 L340 180 L520 130 L700 176 L900 140 L1120 180 L1300 136 L1500 172 L{x1} 150 V220 H{x0} Z" fill="#c8d8c6"/>']
    for k, (base, col) in enumerate(((212, '#9cc47a'), (222, '#e3d0aa'), (290, '#d7be93'), (360, '#c9a87d'), (420, 'url(#gh)'))):
        w = ' '.join(f'L{x} {base + (4 + 3 * k) * math.sin(x * .011 + k):.1f}' for x in range(x0, x1 + 1, 16))
        o.append(f'<path d="M{x0} {base} {w} V{y1} H{x0} Z" fill="{col}"/>')
    pipe = lambda d, col: (f'<path d="{d}" fill="none" stroke="#000" stroke-width="16" stroke-linejoin="round"/><path d="{d}" fill="none" stroke="{col}" stroke-width="10" stroke-linejoin="round"/>'
                           f'<path class="fl" d="{d}" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="10 20" stroke-linecap="round"/>')
    o += [pipe('M300 470 V170 H420', '#d8572a'), pipe('M500 120 H640', '#c9ced3'), pipe('M760 180 H1400 V470', '#3f7fc1')]
    o.append('<path class="fl" d="M1400 486 C 1100 510, 600 512, 300 486" fill="none" stroke="#000" stroke-width="5" stroke-dasharray="14 16" marker-end="url(#ga)"/>')
    # flash tank with steam, turbine with spinning rotor, generator, pylon and the grid
    o.append('<rect x="420" y="96" width="80" height="120" rx="36" fill="#eef0f2" stroke="#000" stroke-width="3"/>')
    o.append('<g filter="url(#gst)" fill="#ffffff">' + ''.join(f'<circle cx="{462 + 8 * k}" cy="{80 - 6 * k}" r="{20 + 3 * k}" style="transform-box:fill-box;transform-origin:50% 50%;animation:puff 3s linear infinite;animation-delay:-{k * .75:.2f}s"/>' for k in range(4)) + '</g>')
    o.append('<path d="M640 92 L760 70 V210 L640 188 Z" fill="#d9dee3" stroke="#000" stroke-width="3"/>'
             '<g style="transform-origin:700px 140px;animation:spin 1s linear infinite">' + ''.join(f'<path d="M700 140 L{700 + 40 * math.cos(math.radians(a)):.1f} {140 + 40 * math.sin(math.radians(a)):.1f}" stroke="#000" stroke-width="7" stroke-linecap="round"/>' for a in range(0, 360, 45)) + '</g>'
             '<circle cx="700" cy="140" r="9" fill="#ffcc00" stroke="#000" stroke-width="3"/>'
             '<path d="M760 140 H800" stroke="#000" stroke-width="8"/><rect x="800" y="104" width="96" height="72" rx="8" fill="#eef0f2" stroke="#000" stroke-width="3"/>')
    o.append('<path d="M1040 210 L1070 50 L1100 210 M1050 160 H1090 M1057 120 H1083 M1063 84 H1077 M1048 170 L1088 120 M1092 170 L1052 120" fill="none" stroke="#000" stroke-width="4"/>'
             '<path d="M896 120 Q 980 150 1066 60 Q 1300 110 1700 70" fill="none" stroke="#000" stroke-width="3"/>'
             '<path class="fl" d="M896 120 Q 980 150 1066 60 Q 1300 110 1700 70" fill="none" stroke="#ffcc00" stroke-width="5" stroke-dasharray="12 18"/>')
    for tx in (140, 1200, 1560):
        o.append(f'<path d="M{tx} 214 L{tx + 14} 176 L{tx + 28} 214 Z" fill="#5f8f45"/>')
    o.append('</g>')
    def tag(x, y, s, end=False):
        w = len(s) * 20 + 32; xa = x - w if end else x
        return f'<rect x="{xa}" y="{y - 36}" width="{w}" height="52" fill="#000"/>' + txt(xa + 16, y, s)
    o += [tag(330, 350, 'Pump up brine'), tag(100, 92, 'Flash to steam'), tag(600, 252, 'Spin turbine'), tag(1380, 350, 'Reinject water', True)]
    o.append(f'<rect x="12" y="12" width="{VW - 24}" height="{VH - 24}" fill="none" stroke="#ffcc00" stroke-width="24"/>')
    return svgw(VW, VH, ''.join(o), 'Geothermal loop: brine is pumped up, flashed to steam, spins a turbine for the grid, and is reinjected into hot rock')

# =================================================================== the five demo slides (illustration + illustrated process)
def build(T, kick, h1, p, art, fkick, fh1, fp, flow):
    THEMES[str(T['n'])] = [T['canvas'], T['accent']]
    page(T, 'demo', kick, h1, p, art(), False)
    page(T, 'flow', fkick, fh1, fp, flow(), True)

build(PP, 'Chemical engineering', 'Distillation splits a mixture by <span class="hl">boiling point</span>', 'Light vapour rises; heavy liquid falls.', art_distillation,
      'Process', 'From raw feed to <span class="hl">pure product</span>', 'Reflux sharpens the split.', flow_distillation)
build(BB, 'Fluid mechanics', 'A wing turns airflow into <span class="hl">lift</span>', 'Faster air above means lower pressure.', art_airfoil,
      'Method', 'How we test <span class="hl">a wing</span>', 'Repeat at each angle.', flow_tunnel)
build(FP, 'Mechanical design', 'Gears trade speed for <span class="hl">torque</span>', 'A small gear drives a large one.', art_gearbox,
      'Assembly', 'Build a gearbox in <span class="hl">four steps</span>', 'Check the mesh after each step.', flow_assembly)
build(HS, 'Molecular dynamics', 'Hydrogen bonds hold <span class="hl">water</span> together', 'Each molecule links to about four neighbours.', art_water,
      'Simulation', 'One step of <span class="hl">a simulation</span>', 'Repeat millions of times.', flow_md_cycle)
build(YF, 'Heat and energy', 'Earth&rsquo;s heat can spin a turbine', 'Hot water rises; cooled water returns underground.', art_geothermal,
      'Process', 'From hot rock to the grid', 'A closed water loop.', flow_geo_loop)
json.dump(THEMES, open(os.path.join(OUT, 'themes.json'), 'w'))
print('written to', os.path.abspath(OUT))
