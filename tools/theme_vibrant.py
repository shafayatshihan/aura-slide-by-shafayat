"""One slide, five blended brand styles (gumroad, coinbase, ikea, headspace, national geographic): "A flower's beauty is a survival plan".
Same words on every slide; only the brand changes. Rulebook: power-design principles/design-principles.md. Brand DNA:
brands/coinbase/brand-style.md (power-design library) and aura-slide/brands/{gumroad,headspace,ikea,national-geographic}/brand-style.md
(crawled from the live sites; ikea + national geographic via Firecrawl). AURA BLEND: every theme blends 2-4 contrasting typefaces,
all with public licences (engine/fonts, OFL / CC BY, fetched by tools/fetch_fonts.py), blends 3-5 brand colours inside one signature style device, and keeps one accent
for emphasis. Aura-Slide HARD RULE 1: no text under 26 px. Presenter mode, no brand logos (trademarks).

Deck-wide system:
  canvas 1920x1080 · safe zone 96 px · 12-col grid, 122 px columns, 24 px gutters (col k starts at 96 + 146k)
  type scale 1.333 with a 28 px floor -> 28 / 36 / 48 / 64 / 84 / 112 px · 3 sizes per slide
  kicker 28 · headline 84-112 (line-height 1.05-1.08) · body 36 (1.5) · 20 words
  text in columns 1-7, illustration in columns 8-12 (706 x 888) · spacing in {8,16,24,32,48,64,96,128}
"""
import json, math, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots', 'theme-vibrant'); os.makedirs(OUT, exist_ok=True)
COL = lambda k: 96 + 146 * k
SPAN = lambda n: 122 * n + 24 * (n - 1)
IW, IH = SPAN(5), 888
FONTDIR = os.path.relpath(os.path.join(os.path.dirname(__file__), '..', 'engine', 'fonts'), OUT).replace(os.sep, '/')                                        # illustration box

BASE = f'''*{{box-sizing:border-box;margin:0}}html,body{{height:100%;background:#1b1b1f}}
body{{display:flex;align-items:center;justify-content:center;overflow:hidden}}
.slide{{position:relative;width:1920px;height:1080px;flex:none;overflow:hidden}}
.abs{{position:absolute}}
.text{{left:{COL(0)}px;top:96px;width:{SPAN(7)}px}}
.kicker{{font-size:28px;line-height:1.2}}
h1{{margin-top:16px;font-size:112px}}
p{{margin-top:48px;font-size:36px;line-height:1.5;max-width:26ch}}
.art{{left:{COL(7)}px;top:96px;width:{IW}px;height:{IH}px}}
.art svg{{display:block}}
'''
SCALE = ('<script>function f(){var s=Math.min(innerWidth/1920,innerHeight/1080);document.querySelector(".slide").style.transform="scale("+s+")"}'
         'addEventListener("resize",f);f()</script>')
KICK, H1, BODY = 'Why flowers are beautiful', 'A flower&rsquo;s beauty is a survival plan', 'Colour, scent and shape all exist to attract pollinators.'
TEXT = lambda h1: f'<div class="abs text" data-grid><div class="kicker">{KICK}</div><h1>{h1}</h1><p>{BODY}</p></div>'
THEMES = {}

def page(slug, name, faces, canvas, accent, css, art, h1=H1):
    THEMES[slug[0]] = [canvas, accent]
    fonts = ''.join(f"@font-face{{font-family:'{f}';src:url('{FONTDIR}/{src}');font-weight:{w};font-display:block}}" for f, src, w in faces)
    svg = f'<svg width="{IW}" height="{IH}" viewBox="0 0 {IW} {IH}" role="img" aria-label="Illustration of a flower">{art}</svg>'
    html = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{name} - demo slide</title>'
            f'<style>{fonts}{BASE}.slide{{background:{canvas}}}{css}</style></head><body><main class="slide" aria-label="{name}">'
            f'<div class="abs art" data-grid>{svg}</div>{TEXT(h1)}</main>{SCALE}</body></html>')
    open(os.path.join(OUT, slug + '.html'), 'w', encoding='utf-8').write(html)

def ring(n, cx, cy, fn):
    return ''.join(fn(i, 360 * i / n) for i in range(n))

# ---------- 1 · Pink Punch (gumroad, crawled from gumroad.com) ----------
# Brand: grey-cream #f4f4f0 canvas, black ink, hot pink #ff90e8 blocks, black 1-3 px borders, hard offset black shadows
# (4px 4px 0 #000), pill buttons, 24 px cards with one sharp corner, yellow #ffc900 / orange #f3a642 / red #dc341e /
# teal #23a094 pops, huge tight headlines. ABC Favorit -> Work Sans (body); blend display = Anton (OFL condensed).
# Illustration: flat outlined shapes with hard black shadows, and coins.
def hard(shape):                       # shape twice: a black copy offset 10 px, then the colour on top
    return f'<g transform="translate(10 10)" fill="#000" stroke="#000">{shape}</g><g stroke="#000" stroke-width="5">{shape}</g>'
gx, gy = 340, 360
g_petals = ring(6, gx, gy, lambda i, a: f'<ellipse cx="{gx}" cy="{gy - 150}" rx="74" ry="128" fill="#ffc900" transform="rotate({a} {gx} {gy})"/>')
coin = lambda x, y, r: (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffc900"/>', f'<circle cx="{x}" cy="{y}" r="{r * 0.62:.0f}" fill="none"/>')
c1, c2 = coin(590, 128, 58), coin(632, 262, 36)
gum_art = ('<rect width="706" height="888" fill="#ff90e8"/>'
    + hard(f'<rect x="{gx - 18}" y="{gy + 120}" width="36" height="440" fill="#23a094"/>')
    + hard(f'<path d="M{gx} 700 C {gx - 50} 610, {gx - 160} 600, {gx - 220} 640 C {gx - 170} 720, {gx - 70} 730, {gx} 700 Z" fill="#23a094"/>')
    + hard(f'<path d="M{gx} 620 C {gx + 50} 530, {gx + 160} 520, {gx + 220} 560 C {gx + 170} 640, {gx + 70} 650, {gx} 620 Z" fill="#23a094"/>')
    + hard(g_petals)
    + hard(f'<circle cx="{gx}" cy="{gy}" r="88" fill="#f3a642"/>')
    + ''.join(f'<circle cx="{gx + 40 * math.cos(math.radians(a)):.1f}" cy="{gy + 40 * math.sin(math.radians(a)):.1f}" r="9" fill="#000"/>' for a in range(30, 390, 60))
    + hard(c1[0]) + f'<g stroke="#000" stroke-width="5">{c1[1]}</g>' + hard(c2[0]) + f'<g stroke="#000" stroke-width="5">{c2[1]}</g>'
    + hard('<path d="M96 760 L112 800 L152 816 L112 832 L96 872 L80 832 L40 816 L80 800 Z" fill="#dc341e" transform="translate(0 -40)"/>'))
page('1-pink-punch', 'Pink Punch', [('Anton', 'Anton-400.woff2', 400), ('Work Sans', 'WorkSans-100-900.ttf', '100 900')],
 '#f4f4f0', ['#ff90e8'],
 '''.slide{color:#000;font-family:"Work Sans",sans-serif}
 .kicker{display:inline-block;padding:8px 24px;border:3px solid #000;border-radius:9999px;background:#fff;box-shadow:4px 4px 0 #000;font-weight:500}
 h1{font-family:Anton,sans-serif;font-weight:400;line-height:1.05;letter-spacing:-.01em;text-transform:uppercase}
 h1 .hl{display:inline-block;background:#ff90e8;padding:0 .08em}
 p{font-weight:500;color:#242423}
 .art{border:3px solid #000;border-radius:48px 48px 48px 8px;box-shadow:8px 8px 0 #000;overflow:hidden}''',
 gum_art, h1='A flower&rsquo;s beauty is a <span class="hl">survival plan</span>')


# ---------- 2 · Bold Blue (coinbase) ----------
# Brand: pure white canvas, ink #0a0b0d, body #5b616e, Coinbase Blue #0052ff as the single brand colour, black as the
# second voice, Coinbase Display/Sans -> Inter with tight tracking (-2px at 80px), pill and 40px card radii.
# Illustration: flat geometric (Bauhaus) flower in white and black on a solid blue block.
bx, by = 353, 330
vesica = lambda L, w: f'M0 0 A {w} {w} 0 0 1 0 {-L} A {w} {w} 0 0 1 0 0 Z'
cb_art = (f'<rect width="{IW}" height="{IH}" rx="40" fill="#0052ff"/>'
    f'<rect x="{bx - 14}" y="{by + 200}" width="28" height="310" fill="#0a0b0d"/>'
    f'<path d="M{bx} 810 A 150 150 0 0 1 {bx - 150} 660 L{bx} 660 Z" fill="#ffffff"/>'
    f'<path d="M{bx} 730 A 120 120 0 0 0 {bx + 120} 610 L{bx} 610 Z" fill="#0a0b0d"/>'
    + ''.join(f'<path d="{vesica(250, 150)}" fill="#ffffff" transform="translate({bx} {by}) rotate({a})"/>' for a in (0, 90, 180, 270))
    + ''.join(f'<path d="{vesica(180, 110)}" fill="#0a0b0d" transform="translate({bx} {by}) rotate({a})"/>' for a in (45, 135, 225, 315))
    + f'<circle cx="{bx}" cy="{by}" r="64" fill="#0a0b0d"/><circle cx="{bx}" cy="{by}" r="30" fill="#0052ff"/>'
    f'<circle cx="596" cy="116" r="44" fill="none" stroke="#ffffff" stroke-width="12"/><circle cx="596" cy="116" r="14" fill="#0a0b0d"/>'
    + ''.join(f'<circle cx="{72 + 32 * i}" cy="{800 - 32 * j}" r="5" fill="#ffffff" opacity="0.55"/>' for i in range(4) for j in range(3)))
page('2-bold-blue', 'Bold Blue', [('Plus Jakarta Sans', 'PlusJakartaSans-200-800.woff2', '200 800'), ('Work Sans', 'WorkSans-100-900.ttf', '100 900')], '#ffffff', ['#0052ff'],
 '''.slide{color:#0a0b0d;font-family:"Work Sans",sans-serif}
 .kicker{font-weight:600;color:#0052ff}
 h1{font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;line-height:1.05;letter-spacing:-.02em}
 h1 .hl{color:#0052ff}
 p{color:#5b616e}''', cb_art, h1='A flower&rsquo;s beauty is a <span class="hl">survival plan</span>')

# ---------- 3 · Flat-Pack (ikea, Firecrawl scrape of ikea.com) ----------
# Brand: white canvas, ink #111111, IKEA blue #0058a3 (confirmed in the page CSS), IKEA yellow #ffdb00, grey card
# #f5f5f5, 8 px card radius, 64 px pill buttons, yellow price-tag labels. Noto IKEA -> Noto Sans (OFL; Noto IKEA is
# built on it). Illustration: a flat-pack assembly manual, two numbered steps and the happy manual figure.
LINE = 'stroke="#111111" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'
tear = lambda x, y, a, s=1: (f'<path d="M0 0 C -30 -20, -34 -70, 0 -96 C 34 -70, 30 -20, 0 0 Z" fill="#ffdb00" {LINE} '
                             f'transform="translate({x} {y}) rotate({a}) scale({s})"/>')
# step 1: the parts
parts = (''.join(tear(90 + 70 * (i % 3), 190 + 118 * (i // 3), 0, .82) for i in range(6))
    + '<text class="ik" x="112" y="380">6x</text>'
    + f'<circle cx="420" cy="150" r="46" fill="#0058a3" {LINE}/><text class="ik" x="486" y="166">1x</text>'
    + f'<path d="M420 236 V 372" {LINE} fill="none"/><path d="M420 320 C 460 290, 510 294, 530 312 C 500 340, 452 340, 420 320 Z" fill="#ffffff" {LINE}/>'
    + '<path d="M300 250 H 350" stroke="#111111" stroke-width="4" stroke-linecap="round" marker-end="url(#ikarr)"/>')
# step 2: assembled flower + the manual figure
fx2, fy2 = 250, 590
built = (f'<path d="M{fx2} {fy2 + 40} V 820" {LINE} fill="none"/>'
    f'<path d="M{fx2} 760 C {fx2 - 40} 730, {fx2 - 96} 734, {fx2 - 116} 752 C {fx2 - 86} 782, {fx2 - 36} 782, {fx2} 760 Z" fill="#ffffff" {LINE}/>'
    + ''.join(tear(fx2, fy2, a, .9) for a in range(0, 360, 60))
    + f'<circle cx="{fx2}" cy="{fy2}" r="36" fill="#0058a3" {LINE}/>'
    + f'<path d="M150 822 H 350" {LINE}/>'
    # happy figure
    + f'<g {LINE} fill="none"><circle cx="520" cy="640" r="34" fill="#ffffff"/><path d="M506 636 v2 M534 636 v2"/><path d="M506 652 Q 520 664 534 652"/>'
    '<path d="M520 674 V 760"/><path d="M520 700 L 470 660 M520 700 L 574 656"/><path d="M520 760 L 488 820 M520 760 L 552 820"/></g>'
    + '<path d="M448 604 l 10 -18 M430 626 l -18 -8 M596 604 l -10 -18 M614 626 l 18 -8" stroke="#111111" stroke-width="4" stroke-linecap="round"/>')
ikea_art = ('<defs><marker id="ikarr" viewBox="0 0 12 12" refX="7" refY="6" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 L10 6 L1 11 Z" fill="#111111"/></marker></defs>'
    '<text class="ik n" x="48" y="96">1</text>' + parts
    + '<path d="M48 440 H 658" stroke="#111111" stroke-width="2" stroke-dasharray="12 10"/>'
    '<text class="ik n" x="48" y="520">2</text>' + built)
page('3-flat-pack', 'Flat-Pack', [('Noto Sans', 'NotoSans-100-900.woff2', '100 900')],
 '#ffffff', ['#0058a3', '#ffdb00'],
 '''.slide{color:#111111;font-family:"Noto Sans",sans-serif}
 .kicker{display:inline-block;padding:8px 16px;border-radius:4px;background:#ffdb00;font-weight:700}
 h1{font-weight:800;line-height:1.05;letter-spacing:-.02em}
 h1 .hl{color:#0058a3}
 p{font-weight:400;color:#484848}
 .art{background:#f5f5f5;border-radius:8px}
 .art .ik{font-family:"Noto Sans",sans-serif;font-weight:700;font-size:36px;fill:#111111}
 .art .ik.n{font-size:48px}''', ikea_art, h1='A flower&rsquo;s beauty is a <span class="hl">survival plan</span>')


# ---------- 4 · Happy Headspace (headspace, tokens from headspace.com) ----------
# Brand: pure white canvas, warm charcoal #2d2c2b headlines, #44423f body (never pure black), smiley orange #ff7300,
# amber #ffa500, gold #ffce00, candy pink #ffa1cc, meditative purple #3b197f, teal-navy #27455c; Headspace Apercu ->
# Quicksand (rounded display, echoes the smile curves) + DM Sans text + Reno Mono kicker; rounded pills and blobs; illustration = the smiling-character system.
hx, hy = 353, 360
hs_cols = ['#ffce00', '#ffa1cc', '#ffa500', '#ffa1cc']
hs_art = (f'<ellipse cx="353" cy="834" rx="330" ry="54" fill="#3b197f"/>'
    f'<rect x="{hx - 16}" y="{hy + 100}" width="32" height="390" rx="16" fill="#27455c"/>'
    f'<ellipse cx="{hx - 96}" cy="660" rx="92" ry="44" fill="#27455c" transform="rotate(-24 {hx - 96} 660)"/>'
    f'<ellipse cx="{hx + 96}" cy="600" rx="92" ry="44" fill="#27455c" transform="rotate(24 {hx + 96} 600)"/>'
    + ring(8, hx, hy, lambda i, a: f'<circle cx="{hx}" cy="{hy - 196}" r="84" fill="{hs_cols[i % 4]}" transform="rotate({a} {hx} {hy})"/>')
    + f'<circle cx="{hx}" cy="{hy}" r="128" fill="#ff7300"/>'
    f'<g transform="translate({hx} {hy})" fill="none" stroke="#2d2c2b" stroke-width="11" stroke-linecap="round">'
    '<path d="M-62 -8 Q -42 -36 -22 -8"/><path d="M22 -8 Q 42 -36 62 -8"/><path d="M-50 32 Q 0 84 50 32"/></g>'
    '<g transform="translate(596 120)"><ellipse cx="-22" cy="-46" rx="26" ry="34" fill="#ffffff" stroke="#3b197f" stroke-width="6" transform="rotate(-22 -22 -46)"/>'
    '<ellipse cx="22" cy="-46" rx="26" ry="34" fill="#ffffff" stroke="#3b197f" stroke-width="6" transform="rotate(22 22 -46)"/>'
    '<circle r="50" fill="#3b197f"/><circle cx="-16" cy="-6" r="6" fill="#ffffff"/><circle cx="16" cy="-6" r="6" fill="#ffffff"/>'
    '<path d="M-16 14 Q 0 30 16 14" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/></g>'
    '<circle cx="92" cy="150" r="30" fill="#ffce00"/><circle cx="640" cy="560" r="20" fill="#ffa1cc"/>')
page('4-happy-headspace', 'Happy Headspace', [('Quicksand', 'Quicksand-300-700.ttf', '300 700'), ('DM Sans', 'DMSans-100-1000.woff2', '100 1000'), ('Reno Mono', 'RenoMono-400.otf', 400)], '#ffffff', ['#ff7300', '#ffce00', '#ffa1cc', '#ffa500', '#3b197f'],
 '''.slide{color:#2d2c2b;font-family:"DM Sans",sans-serif}
 .kicker{display:inline-block;padding:8px 24px;border-radius:9999px;background:#ffce00;font-family:"Reno Mono",monospace;text-transform:uppercase}
 h1 .hl{text-decoration:underline wavy #ff7300;text-decoration-thickness:6px;text-underline-offset:20px;text-decoration-skip-ink:none}
 h1{font-family:Quicksand,sans-serif;font-weight:700;line-height:1.05;letter-spacing:-.02em}
 p{font-weight:500;color:#44423f}''', hs_art, h1='A flower&rsquo;s beauty is a <span class="hl">survival plan</span>')

# ---------- 5 · Yellow Frame (national geographic, Firecrawl scrape of nationalgeographic.com) ----------
# Brand: white canvas, black #000000 ink, the yellow border #ffcc00, 0 px corners, serif headlines (Georgia on the site)
# over Open Sans text, uppercase section labels. Aura blend (OFL): Source Serif 4 display + Open Sans text/labels.
# Illustration: a bright, daylight nature "photograph" (coneflower + honeybee) inside the iconic yellow rectangle.
# Light only: no dark backgrounds anywhere in this theme.
ng_petals = ''.join(f'<ellipse cx="0" cy="-112" rx="30" ry="98" fill="url(#ngp)" transform="rotate({a})"/>' for a in range(0, 360, 26))
ng_cone = ''.join(f'<circle cx="{r * math.cos(k * 2.39996):.1f}" cy="{r * math.sin(k * 2.39996) * .7:.1f}" r="4.5" fill="#6e2d0c"/>'
                  for k in range(1, 140) for r in [6.2 * math.sqrt(k)] if r < 70)
ng_art = ('<defs><clipPath id="ngc"><rect x="48" y="48" width="610" height="792"/></clipPath>'
    '<linearGradient id="ngsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe7f7"/><stop offset="0.55" stop-color="#e6f2dc"/><stop offset="1" stop-color="#b9d98f"/></linearGradient>'
    '<linearGradient id="ngp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f58bb8"/><stop offset="1" stop-color="#c8327a"/></linearGradient>'
    '<radialGradient id="ngcone" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#e9892f"/><stop offset="1" stop-color="#9a4312"/></radialGradient>'
    '<filter id="ngb1"><feGaussianBlur stdDeviation="18"/></filter><filter id="ngb2"><feGaussianBlur stdDeviation="5"/></filter></defs>'
    '<g clip-path="url(#ngc)"><rect x="48" y="48" width="610" height="792" fill="url(#ngsky)"/>'
    '<g filter="url(#ngb1)" opacity="0.8"><circle cx="140" cy="200" r="70" fill="#ffffff"/><circle cx="560" cy="160" r="54" fill="#fff6c8"/>'
    '<circle cx="600" cy="520" r="80" fill="#d5ecb6"/><circle cx="120" cy="620" r="90" fill="#a9cf7c"/><circle cx="360" cy="800" r="140" fill="#8fbf5e"/></g>'
    '<g filter="url(#ngb2)" opacity="0.9"><ellipse cx="560" cy="700" rx="46" ry="30" fill="#f2a0c4"/><path d="M560 730 C 556 790, 566 830, 560 880" stroke="#6e9b45" stroke-width="10" fill="none"/></g>'
    '<path d="M330 460 C 340 580, 300 700, 320 900" stroke="#4d7d2c" stroke-width="16" fill="none" stroke-linecap="round"/>'
    '<path d="M324 690 C 250 640, 170 660, 140 700 C 200 740, 280 736, 324 690 Z" fill="#5f9138"/>'
    '<g transform="translate(340 380) scale(1 .62)">' + ng_petals + '</g>'
    '<g transform="translate(340 360)"><ellipse cx="0" cy="0" rx="76" ry="56" fill="url(#ngcone)"/>' + ng_cone + '</g>'
    # honeybee on the cone
    '<g transform="translate(380 300) rotate(-18)"><ellipse cx="-4" cy="-30" rx="28" ry="16" fill="#ffffff" opacity="0.7" transform="rotate(-30 -4 -30)"/>'
    '<ellipse cx="22" cy="-30" rx="26" ry="14" fill="#ffffff" opacity="0.6" transform="rotate(20 22 -30)"/>'
    '<ellipse cx="10" cy="0" rx="40" ry="22" fill="#d99a1c"/><path d="M-2 -20 Q 4 0 -2 20 M14 -21 Q 20 0 14 21 M30 -17 Q 34 0 30 17" stroke="#2b1a08" stroke-width="7" fill="none"/>'
    '<circle cx="-36" cy="0" r="16" fill="#2b1a08"/><path d="M-44 -12 L-60 -30 M-38 -14 L-48 -34" stroke="#2b1a08" stroke-width="3"/></g></g>'
    '<rect x="24" y="24" width="658" height="840" fill="none" stroke="#ffcc00" stroke-width="48"/>')
page('5-yellow-frame', 'Yellow Frame', [('Source Serif 4', 'SourceSerif4-200-900.woff2', '200 900'), ('Open Sans', 'OpenSans-300-800.woff2', '300 800')],
 '#ffffff', ['#ffcc00'],
 '''.slide{color:#000000;font-family:"Open Sans",sans-serif}
 .kicker{font-weight:700;text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;gap:16px}
 .kicker::before{content:"";width:16px;height:24px;border:5px solid #ffcc00;flex:none}
 h1{font-family:"Source Serif 4",serif;font-weight:600;font-variation-settings:"opsz" 60;line-height:1.08;letter-spacing:-.01em}
 p{font-weight:400;color:#333333}''', ng_art)

json.dump(THEMES, open(os.path.join(OUT, 'themes.json'), 'w'))
print('written to', os.path.abspath(OUT))
