"""Theme previews for the form's "Pick your look" step.
Each Aura theme gets three presenter slides on its own engineering topic: a detailed illustration, a flowchart and a
graph, all following power-design (principles/design-principles.md), Aura Blend (aura-slide/aura-blend.md) and the
Aura-Slide HARD RULE (no text under 26 px). tools/build_previews.js renders them and stitches one preview per theme.

  1 Pink Punch       (Gumroad)             chemical   distillation column
  2 Bold Blue        (Coinbase)            fluid      airfoil lift, streamlines from a real Joukowski potential flow
  3 Flat-Pack        (IKEA)                mechanical gearbox, assembly-manual style with generated gear teeth
  4 Happy Headspace  (Headspace)           molecular  hydrogen-bonded water
  5 Yellow Frame     (National Geographic) heat       geothermal power, documentary cutaway (light palette only)

Charts are labelled "Sample data": they illustrate a style, not a measurement.
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
.lbl,.nt,.nn,.tk,.ax,.co{{font-size:28px}} .nt{{font-size:36px}}
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
    open(os.path.join(OUT, f'{T["n"]}{part}-{T["slug"]}.html'), 'w', encoding='utf-8').write(html)

svgw = lambda w, h, body, label: f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">{body}</svg>'
txt = lambda x, y, s, cls='lbl', anchor='start', extra='': f'<text class="{cls}" x="{x:.0f}" y="{y:.0f}" text-anchor="{anchor}"{extra}>{s}</text>'
pts = lambda P: ' '.join(f'{x:.1f},{y:.1f}' for x, y in P)
marker = lambda mid, col, size=3.2: (f'<marker id="{mid}" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="{size}" markerHeight="{size}" '
                                     f'orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 Z" fill="{col}"/></marker>')

def hard(shape, dx=8, dy=8):
    """Gumroad hard shadow: a solid black copy offset down-right, then the shape with black 4 px outlines."""
    sh = re.sub(r'fill="(?!none)[^"]*"', 'fill="#000"', shape)
    return f'<g transform="translate({dx} {dy})" fill="#000">{sh}</g><g stroke="#000" stroke-width="4" stroke-linejoin="round">{shape}</g>'

# ------------------------------------------------------------------ generic flowchart + chart, themed
def flowchart(T, nodes):
    w, h, gap, y = 360, 232, 96, 136
    out = ['<defs>' + marker('fa', T['arrow'], T.get('ahead', 3.2)) + '</defs>']
    for i, lines in enumerate(nodes):
        x = i * (w + gap)
        out.append(T['node'](i, x, y, w, h))
        cy = y + h / 2 + 12 - (len(lines) - 1) * 23
        out += [txt(x + w / 2, cy + 46 * k, s, 'nt', 'middle') for k, s in enumerate(lines)]
        out.append(T['num'](i, x, y))
        if i < len(nodes) - 1:
            out.append(f'<path d="M{x + w + 14} {y + h / 2} H{x + w + gap - 18}" stroke="{T["arrow"]}" stroke-width="{T["aw"]}" '
                       f'stroke-linecap="round" fill="none" marker-end="url(#fa)"/>')
    return svgw(VW, VH, ''.join(out), 'Flowchart: ' + ', then '.join(' '.join(l) for l in nodes))

def chart(T, C):
    x0, x1, y0, y1 = 200, 1690, 30, 420
    X = lambda v: x0 + (v - C['xr'][0]) / (C['xr'][1] - C['xr'][0]) * (x1 - x0)
    Y = lambda v: y1 - (v - C['yr'][0]) / (C['yr'][1] - C['yr'][0]) * (y1 - y0)
    fmt = C.get('fmt', lambda v: f'{v:g}')
    out = []
    if T.get('grid'):
        out += [f'<path d="M{x0} {Y(v):.1f} H{x1}" stroke="{T["grid"]}" stroke-width="2"/>' for v in C['yt']]
    out.append(T['axes'](x0, x1, y0, y1))
    out += [txt(X(v), y1 + 50, fmt(v), 'tk', 'middle') for v in C['xt']]
    out += [txt(x0 - 24, Y(v) + 10, fmt(v), 'tk', 'end') for v in C['yt']]
    out.append(txt((x0 + x1) / 2, y1 + 104, C['xl'], 'ax', 'middle'))
    out.append(txt(0, 0, C['yl'], 'ax', 'middle', f' transform="translate(48 {(y0 + y1) / 2:.0f}) rotate(-90)"'))
    P = [(X(a), Y(b)) for a, b in C['data']]
    out.append(T['line'](P))
    out += [T['point'](i, x, y, i == C.get('hi')) for i, (x, y) in enumerate(P)]
    if C.get('call'):
        i, s, dx, dy = C['call']; x, y = P[i]
        out.append(txt(x + dx, y + dy, s, 'co', 'start'))
    return svgw(VW, VH, ''.join(out), f'Line chart of {C["yl"]} against {C["xl"]} (sample data)')

# =================================================================== 1 · PINK PUNCH — distillation column
def art_distillation():
    W, H = AW - 6, AH - 6                            # inside the 3 px CSS border
    pipe = lambda d: f'<path d="{d}" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
    arrow = lambda d: f'<path d="{d}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" marker-end="url(#pa)"/>'
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
            o.append(f'<circle cx="{bx}" cy="{ty + 36 + 10 * (j % 2)}" r="{7 + (j % 2) * 3}" fill="{heat[k]}" stroke="#000" stroke-width="3"/>')
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
        o.append(f'<path d="M{fx} 876 C {fx - 18} 866, {fx - 12} 850, {fx} 842 C {fx + 12} 850, {fx + 18} 866, {fx} 876 Z" fill="#dc341e" stroke="#000" stroke-width="3"/>')
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
            o.append(f'<polyline points="{pts(P)}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>')
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
    o += [tag(qx + 28, qy - 322, 'Lift'), tag(56, 176, 'Low pressure'), tag(452, 640, 'High pressure'),
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
        for frac, rad in ((0.0, rf), (0.12, rf), (0.22, ra), (0.40, ra), (0.50, rf), (1.0, rf)):
            if frac == 1.0: continue
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
    dx, dy = 14, -12
    for (cx, N, fill, back, ph) in ((gx, 30, '#ffdb00', '#c9a400', math.pi / 30), (px, 12, '#0058a3', '#003a6e', 0.0)):
        o.append(f'<polygon points="{pts(gear_poly(cx + dx, py + dy, N, 10, ph))}" fill="{back}" {L}/>')
        o.append(f'<polygon points="{pts(gear_poly(cx, py, N, 10, ph))}" fill="{fill}" {L}/>')
        rr = 10 * N / 2 * .45
        o.append(f'<circle cx="{cx}" cy="{py}" r="{rr:.0f}" fill="#ffffff" {L}/><circle cx="{cx}" cy="{py}" r="12" fill="#111111"/>')
        if N == 30:
            o += [f'<circle cx="{cx + 92 * math.cos(a):.1f}" cy="{py + 92 * math.sin(a):.1f}" r="16" fill="#f5f5f5" {L}/>' for a in np.linspace(0, 2 * math.pi, 7)[:-1]]
    o.append(f'<rect x="{gx}" y="598" width="{AW - 60 - gx}" height="24" fill="#ffffff" {L}/>')
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
 .lbl,.nt,.tk,.ax,.co{font-family:"Noto Sans";font-weight:700;fill:#111111}.nn{font-family:"Noto Sans";font-weight:800;font-size:48px;fill:#111111}
 .viz .nn{font-size:28px}''',
    node=lambda i, x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{"#ffdb00" if i == 3 else "#f5f5f5"}" stroke="#111111" stroke-width="{0 if i < 3 else 0}"/>',
    num=lambda i, x, y: f'<circle cx="{x + 44}" cy="{y + 44}" r="24" fill="#ffffff" stroke="#111111" stroke-width="3"/>' + txt(x + 44, y + 54, str(i + 1), 'nn', 'middle'),
    arrow='#111111', aw=4, ahead=4,
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y0} V{y1} H{x1}" fill="none" stroke="#111111" stroke-width="4"/>',
    line=lambda P: f'<polyline points="{pts(P)}" fill="none" stroke="#111111" stroke-width="4" stroke-linejoin="round"/>',
    point=lambda i, x, y, hi: f'<rect x="{x - 12:.1f}" y="{y - 12:.1f}" width="24" height="24" fill="#ffdb00" stroke="#111111" stroke-width="3"/>')

# =================================================================== 4 · HAPPY HEADSPACE — hydrogen-bonded water
def molecule(cx, cy, dirdeg, s=1.0, face='happy', op=1.0):
    o = [f'<g opacity="{op}">']
    for d in (dirdeg - 52.25, dirdeg + 52.25):
        a = math.radians(d); o.append(f'<circle cx="{cx + 72 * s * math.cos(a):.1f}" cy="{cy + 72 * s * math.sin(a):.1f}" r="{33 * s:.1f}" fill="#ffce00"/>')
    o.append(f'<circle cx="{cx}" cy="{cy}" r="{58 * s:.1f}" fill="#ff7300"/>')
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
        return f'<path d="M{a[0]:.1f} {a[1]:.1f} L{b[0]:.1f} {b[1]:.1f}" stroke="#3b197f" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 16"/>'
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
    o += [molecule(720, 110, 200, .5, None, .45), molecule(96, 800, -30, .55, None, .45), molecule(770, 800, 250, .45, None, .45)]
    o += [molecule(*pos['A'], -38, 1, 'happy'), molecule(*pos['B'], -142, 1, 'wink'),
          molecule(*pos['C'], 267, 1, 'happy'), molecule(*pos['D'], 273, 1, 'happy'), molecule(*c, -90, 1.08, 'happy')]
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
    o += [f'<rect x="250" y="250" width="18" height="520" fill="url(#yprod)" stroke="#7a2e10" stroke-width="2"/>',
          f'<rect x="616" y="250" width="18" height="520" fill="url(#yinj)" stroke="#1d4a78" stroke-width="2"/>']
    for y in range(330, 760, 70):
        o.append(f'<path d="M252 {y + 14} L259 {y} L266 {y + 14}" fill="#ffffff"/><path d="M618 {y} L625 {y + 14} L632 {y}" fill="#ffffff"/>')
    o.append('<path d="M622 790 C 560 840, 330 850, 262 790" fill="none" stroke="#7a2e10" stroke-width="4" stroke-dasharray="10 10" marker-end="url(#ya)"/>')
    # surface plant: turbine hall, pipes, cooling tower with steam, trees
    o += ['<path d="M259 250 V226 H300" fill="none" stroke="#b8441c" stroke-width="10"/>',
          '<path d="M372 226 H470" fill="none" stroke="#8a929a" stroke-width="10"/>',
          '<path d="M560 240 H625 V250" fill="none" stroke="#2d6aa6" stroke-width="10"/>',
          '<rect x="288" y="190" width="100" height="72" fill="#eef0f2" stroke="#6b737b" stroke-width="2"/><path d="M280 190 L338 160 L396 190 Z" fill="#9aa3ab"/>',
          ''.join(f'<rect x="{x}" y="212" width="16" height="22" fill="#9cc3e0"/>' for x in (302, 330, 358)),
          '<path d="M470 262 C 482 214, 482 190, 474 150 H566 C 558 190, 558 214, 570 262 Z" fill="url(#ytower)" stroke="#8a929a" stroke-width="2"/>',
          '<g filter="url(#ysteam)" fill="#ffffff" opacity=".95"><circle cx="520" cy="126" r="34"/><circle cx="548" cy="96" r="40"/><circle cx="590" cy="74" r="46"/><circle cx="640" cy="64" r="40"/></g>']
    for tx in (96, 140, 700, 748):
        o.append(f'<path d="M{tx} 262 L{tx + 16} 218 L{tx + 32} 262 Z" fill="#5f8f45"/><rect x="{tx + 14}" y="262" width="4" height="6" fill="#6b4a2b"/>')
    o.append('</g>')
    o.append(f'<rect x="24" y="24" width="{AW - 48}" height="{AH - 48}" fill="none" stroke="#ffcc00" stroke-width="48"/>')
    dot = lambda x, y: f'<circle cx="{x}" cy="{y}" r="5" fill="#000"/>'
    lead = lambda d: f'<path d="{d}" stroke="#000" stroke-width="2" fill="none"/>'
    o += [txt(96, 150, 'Turbine'), lead('M150 160 V200 H286'), dot(290, 200),
          txt(292, 496, 'Production well'), lead('M288 486 H272'), dot(268, 486),
          txt(596, 612, 'Injection well', 'lbl', 'end'), lead('M600 602 H612'), dot(616, 602),
          txt(AW / 2, 770, 'Hot rock', 'lbl', 'middle')]
    return svgw(AW, AH, ''.join(o), 'Cutaway of a geothermal plant: a production well brings hot water up to a turbine, an injection well returns it to hot rock')

YF = dict(n=5, slug='yellow-frame', name='Yellow Frame', canvas='#ffffff', accent=['#ffcc00'],
    faces=[('Source Serif 4', 'SourceSerif4-200-900.woff2', '200 900'), ('Open Sans', 'OpenSans-300-800.woff2', '300 800')],
    css='''.slide{color:#000;font-family:"Open Sans",sans-serif}
 .kicker{font-weight:700;text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;gap:16px}
 .kicker::before{content:"";width:16px;height:24px;border:5px solid #ffcc00;flex:none}
 h1{font-family:"Source Serif 4",serif;font-weight:600;font-variation-settings:"opsz" 60;letter-spacing:-.01em}
 p{color:#333333}
 .lbl{font-family:"Open Sans";font-weight:700;fill:#000;text-transform:uppercase;letter-spacing:.06em}
 .nt{font-family:"Open Sans";font-weight:600;fill:#000}.nn{font-family:"Open Sans";font-weight:700;fill:#000}
 .tk,.ax{font-family:"Open Sans";font-weight:400;fill:#333333}.co{font-family:"Source Serif 4";font-weight:600;fill:#000}''',
    node=lambda i, x, y, w, h: f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff" stroke="#000" stroke-width="2"/>',
    num=lambda i, x, y: f'<rect x="{x}" y="{y}" width="56" height="56" fill="#ffcc00"/>' + txt(x + 28, y + 38, str(i + 1), 'nn', 'middle'),
    arrow='#000', aw=3, ahead=5, grid='#e6e6e6',
    axes=lambda x0, x1, y0, y1: f'<path d="M{x0} {y1} H{x1}" stroke="#000" stroke-width="2"/>',
    line=lambda P: f'<polyline points="{pts(P)}" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>',
    point=lambda i, x, y, hi: (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="18" fill="#ffcc00" stroke="#000" stroke-width="2"/>' if hi else
                               f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#000"/>'))

# =================================================================== content
def build(T, A, B, Cc):
    THEMES[str(T['n'])] = [T['canvas'], T['accent']]
    page(T, 'a', A['kick'], A['h1'], A['p'], A['art'](), False)
    page(T, 'b', B['kick'], B['h1'], B['p'], flowchart(T, B['nodes']), True)
    page(T, 'c', Cc['kick'], Cc['h1'], 'Sample data', chart(T, Cc), True)

build(PP, dict(kick='Chemical engineering', h1='Distillation splits a mixture by <span class="hl">boiling point</span>',
               p='Light vapour rises; heavy liquid falls.', art=art_distillation),
      dict(kick='Process', h1='From raw feed to <span class="hl">pure product</span>', p='Reflux sharpens the split.',
           nodes=[('Preheat', 'the feed'), ('Vaporise', 'on trays'), ('Condense', 'vapour'), ('Collect', 'distillate')]),
      dict(kick='Result', h1='Purity rises with <span class="hl">every tray</span>', xl='Number of trays', yl='Ethanol purity (%)',
           xr=(0, 22), yr=(40, 100), xt=[5, 10, 15, 20], yt=[60, 80, 100], data=[(n, 100 - 60 * math.exp(-n / 5.5)) for n in range(2, 21, 2)]))
build(BB, dict(kick='Fluid mechanics', h1='A wing turns airflow into <span class="hl">lift</span>',
               p='Faster air above means lower pressure.', art=art_airfoil),
      dict(kick='Method', h1='How we test <span class="hl">a wing</span>', p='Repeat at each angle.',
           nodes=[('Set', 'angle'), ('Run', 'tunnel'), ('Measure', 'forces'), ('Compute', 'lift')]),
      dict(kick='Result', h1='Lift rises until <span class="hl">stall</span> hits', xl='Angle of attack (°)', yl='Lift coefficient',
           xr=(0, 20), yr=(0, 1.8), xt=[5, 10, 15], yt=[0.5, 1.0, 1.5], fmt=lambda v: f'{v:g}' if v != 1 else '1.0',
           data=[(a, 0.2 + 0.1 * a if a <= 14 else 1.6 - 0.14 * (a - 14)) for a in range(0, 19, 2)], hi=7, call=(7, 'Stall', 26, -24)))
build(FP, dict(kick='Mechanical design', h1='Gears trade speed for <span class="hl">torque</span>',
               p='A small gear drives a large one.', art=art_gearbox),
      dict(kick='Assembly', h1='Build a gearbox in <span class="hl">four steps</span>', p='Check the mesh after each step.',
           nodes=[('Fit', 'bearings'), ('Mount', 'shafts'), ('Mesh', 'gears'), ('Close', 'housing')]),
      dict(kick='Result', h1='Bigger ratio, <span class="hl">more torque</span>', xl='Gear ratio', yl='Output torque (N·m)',
           xr=(0.5, 4.5), yr=(0, 35), xt=[1, 2, 3, 4], yt=[10, 20, 30], data=[(r / 2, 8 * r / 2 * 0.95) for r in range(2, 9)]))
build(HS, dict(kick='Molecular dynamics', h1='Hydrogen bonds hold <span class="hl">water</span> together',
               p='Each molecule links to about four neighbours.', art=art_water),
      dict(kick='Simulation', h1='One step of <span class="hl">a simulation</span>', p='Repeat millions of times.',
           nodes=[('Compute', 'forces'), ('Update', 'velocities'), ('Move', 'atoms'), ('Save', 'frame')]),
      dict(kick='Result', h1='Molecules move faster <span class="hl">when hot</span>', xl='Temperature (K)', yl='Diffusion (nm²/ns)',
           xr=(270, 350), yr=(0, 6), xt=[280, 300, 320, 340], yt=[2, 4, 6], data=[(t, 2.3 * math.exp(0.0205 * (t - 298))) for t in range(278, 339, 10)]))
build(YF, dict(kick='Heat and energy', h1='Earth&rsquo;s heat can spin a turbine',
               p='Hot water rises; cooled water returns underground.', art=art_geothermal),
      dict(kick='Process', h1='From hot rock to the grid', p='A closed water loop.',
           nodes=[('Pump up', 'brine'), ('Flash', 'to steam'), ('Spin', 'turbine'), ('Reinject', 'water')]),
      dict(kick='Result', h1='Deeper wells reach hotter rock', xl='Depth (km)', yl='Temperature (°C)',
           xr=(0, 4.5), yr=(0, 160), xt=[1, 2, 3, 4], yt=[50, 100, 150], data=[(d / 2, 15 + 30 * d / 2) for d in range(0, 9)], hi=8))
json.dump(THEMES, open(os.path.join(OUT, 'themes.json'), 'w'))
print('written to', os.path.abspath(OUT))
