"""Five strict demo slides, "Why flowers are beautiful", one per Aura-Slide theme.
Built from the full power-design rulebook (principles/design-principles.md) and the full brand files
(brands/{claude,ibm,stripe,starbucks,figma}/brand-style.md). Presenter mode.

Deck-wide system (from the rulebook):
  canvas 1920x1080 · safe zone 96 px · 12-col grid, 122 px columns, 24 px gutters (col k starts at 96 + 146k)
  type scale 1.333 -> 20 / 28 / 36 / 48 / 64 / 84 / 112 px · <= 4 sizes per slide · body 36 px (projection)
  headline 84 px (headline:body = 2.33) · display line-height 1.05-1.2, body 1.5 · <= 25 words per slide
  spacing in {8,16,24,32,48,64,96,128}; related <= 16 px, unrelated >= 48 px · one accent per slide · no brand logos
"""
import math, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots', 'theme-demo'); os.makedirs(OUT, exist_ok=True)
COL = lambda k: 96 + 146 * k                     # left edge of column k (0-based)
SPAN = lambda n: 122 * n + 24 * (n - 1)          # width of n columns

BASE = '''*{box-sizing:border-box;margin:0}html,body{height:100%;background:#1b1b1f}
body{display:flex;align-items:center;justify-content:center;overflow:hidden}
.slide{position:relative;width:1920px;height:1080px;flex:none;overflow:hidden}
.abs{position:absolute}
'''
SCALE = ('<script>function f(){var s=Math.min(innerWidth/1920,innerHeight/1080);document.querySelector(".slide").style.transform="scale("+s+")"}'
         'addEventListener("resize",f);f()</script>')

def page(slug, name, fonts, css, body):
    html = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{name} - demo slide</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">'
            f'<style>{BASE}{css}</style></head><body><main class="slide" aria-label="{name}">{body}</main>{SCALE}</body></html>')
    open(os.path.join(OUT, slug + '.html'), 'w', encoding='utf-8').write(html)

KICK = 'Why flowers are beautiful'

# ---------- 1 · Warm Scholar (claude) — idea slide + hero-illustration-card ----------
# Brand: cream canvas, Copernicus -> Cormorant Garamond 500 / -0.02em, Inter body, coral only in the line-art (hero
# illustrations "use coral and dark strokes on cream"); coral-active #a9583e keeps the strokes >= 3:1 on the card.
petals = ''.join(f'<ellipse cx="200" cy="112" rx="46" ry="92" transform="rotate({a} 200 200)"/>' for a in range(0, 360, 60))
FLOWER = (f'<svg width="400" height="400" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="#a9583e" stroke-width="6">{petals}</g>'
          '<circle cx="200" cy="200" r="36" fill="#141413"/></svg>')
page('1-warm-scholar', 'Warm Scholar', 'family=Cormorant+Garamond:wght@500&family=Inter:wght@400;500',
 f'''.slide{{background:#faf9f5;color:#141413;font-family:Inter,sans-serif}}
 .text{{left:{COL(0)}px;top:96px;width:{SPAN(6)}px}}
 .kicker{{font-size:20px;line-height:1.2;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#3d3d3a}}
 h1{{margin-top:16px;font:500 84px/1.08 "Cormorant Garamond",serif;letter-spacing:-.02em;max-width:17ch}}
 p{{margin-top:48px;font-size:36px;line-height:1.5;color:#3d3d3a;max-width:30ch}}
 .card{{left:{COL(7)}px;top:96px;width:{SPAN(5)}px;height:888px;background:#efe9de;border-radius:16px;display:flex;align-items:center;justify-content:center}}''',
 f'''<div class="abs card" data-grid>{FLOWER}</div>
 <div class="abs text" data-grid><div class="kicker">{KICK}</div><h1>A flower's beauty is a survival plan</h1>
 <p>Colour, scent and shape all exist to attract pollinators.</p></div>''')

# ---------- 2 · Engineer's Blueprint (ibm) — range chart, blue on the one bar that matters ----------
# Brand: white, Plex Sans 300 display / 400 body +0.16px, sentence-case eyebrow, flat 0px corners, no mono, no grid bg.
W, H = SPAN(12), 464
x = lambda nm: (nm - 300) / 400 * W
ticks = ''.join(f'<line x1="{x(n):.0f}" x2="{x(n):.0f}" y1="400" y2="416" stroke="#161616" stroke-width="2"/>'
                f'<text x="{x(n):.0f}" y="452" text-anchor="{"start" if n == 300 else "end" if n == 700 else "middle"}">{n}{" nm" if n == 700 else ""}</text>'
                for n in range(300, 701, 100))
chart = (f'<svg class="abs chart" data-grid width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         'aria-label="Honeybees see about 300 to 650 nanometres, including ultraviolet; humans see about 380 to 700 nanometres">'
         f'<rect x="0" y="0" width="{x(400):.0f}" height="400" fill="#f4f4f4"/>'
         '<text class="uv" x="16" y="36">ultraviolet</text>'
         f'<rect x="0" y="96" width="{x(650):.0f}" height="96" fill="#0f62fe"/>'
         '<text class="lbl on" x="24" y="154">Honeybees</text>'
         f'<rect x="{x(380):.0f}" y="240" width="{x(700) - x(380):.0f}" height="96" fill="#8c8c8c"/>'
         f'<text class="lbl off" x="{x(380) + 24:.0f}" y="298">Humans</text>'
         f'<line x1="0" x2="{W}" y1="400" y2="400" stroke="#161616" stroke-width="2"/>{ticks}</svg>')
page('2-engineers-blueprint', "Engineer's Blueprint", 'family=IBM+Plex+Sans:wght@300;400',
 f'''.slide{{background:#ffffff;color:#161616;font-family:"IBM Plex Sans",sans-serif}}
 .text{{left:{COL(0)}px;top:96px;width:{SPAN(8)}px}}
 .kicker{{font-size:20px;line-height:1.2;letter-spacing:.16px;color:#525252}}
 h1{{margin-top:16px;font-weight:300;font-size:84px;line-height:1.17;letter-spacing:-.5px}}
 p{{margin-top:48px;font-size:36px;line-height:1.5;letter-spacing:.16px;color:#525252}}
 .chart{{left:{COL(0)}px;top:520px}}
 .chart text{{font-family:"IBM Plex Sans";font-size:20px;fill:#525252;letter-spacing:.16px}}
 .chart .lbl{{font-size:28px}}.chart .lbl.on{{fill:#ffffff}}.chart .lbl.off{{fill:#161616}}''',
 f'''<div class="abs text" data-grid><div class="kicker">{KICK}</div><h1>Bees see colours we cannot</h1>
 <p>Petals hide ultraviolet guides to nectar.</p></div>{chart}''')

# ---------- 3 · Modern Gradient (stripe) — one big number on the signature elevated card ----------
# Brand: white, navy #061b31 headings at weight 300 with tight tracking, purple #533afd as the one accent, 8px card radius,
# blue-tinted multi-layer shadow, tnum for figures. The hero gradient is left out: the rulebook bans gradients on
# non-data surfaces and a second accent colour (see the report).
page('3-modern-gradient', 'Modern Gradient', 'family=Inter:wght@300;400',
 f'''.slide{{background:#ffffff;color:#061b31;font-family:Inter,sans-serif;font-feature-settings:"ss01"}}
 .text{{left:{COL(0)}px;top:96px;width:{SPAN(9)}px}}
 .kicker{{font-size:20px;line-height:1.2;color:#273951}}
 h1{{margin-top:16px;font-weight:300;font-size:84px;line-height:1.08;letter-spacing:-1.4px}}
 .card{{left:{COL(0)}px;top:432px;width:{SPAN(6)}px;padding:48px;background:#fff;border:1px solid #e5edf5;border-radius:8px;
   box-shadow:rgba(50,50,93,.25) 0 30px 45px -30px,rgba(0,0,0,.1) 0 18px 36px -18px}}
 .card b{{display:block;font-size:112px;line-height:1.05;font-weight:300;letter-spacing:-2px;color:#533afd;font-feature-settings:"tnum"}}
 .card span{{display:block;margin-top:16px;font-size:36px;line-height:1.5;color:#273951;max-width:24ch}}
 .src{{left:{COL(0)}px;top:952px;font-size:20px;line-height:1.6;color:#64748d}}''',
 f'''<div class="abs text" data-grid><div class="kicker">{KICK}</div><h1>Most flowers need animals to reproduce</h1></div>
 <div class="abs card" data-grid><b>87.5%</b><span>of flowering plants are pollinated by animals</span></div>
 <div class="abs src" data-grid>Ollerton, Winfree &amp; Tarrant, Oikos, 2011</div>''')

# ---------- 4 · Calm Green (starbucks) — three chunks on white cards ----------
# Brand: warm cream canvas, Starbucks Green #006241 for the heading (the one accent), text black at 87 %, white 12px
# cards with the whisper double shadow, no gradients, no gold (rewards only). SoDoSans -> Nunito Sans, -0.01em.
cards = [('Colour', 'Seen from far away'), ('Scent', 'Guides insects at night'), ('Symmetry', 'Bees prefer balance')]
page('4-calm-green', 'Calm Green', 'family=Nunito+Sans:opsz,wght@6..12,400;6..12,600',
 f'''.slide{{background:#f2f0eb;color:rgba(0,0,0,.87);font-family:"Nunito Sans",sans-serif;letter-spacing:-.01em}}
 .text{{left:{COL(0)}px;top:96px;width:{SPAN(12)}px}}
 .kicker{{font-size:20px;line-height:1.2;font-weight:600}}
 h1{{margin-top:16px;font-weight:600;font-size:84px;line-height:1.1;color:#006241}}
 .c{{top:324px;width:{SPAN(4)}px;padding:48px;background:#fff;border-radius:12px;
   box-shadow:0 0 .5px 0 rgba(0,0,0,.14),0 1px 1px 0 rgba(0,0,0,.24)}}
 .c b{{display:block;font-size:48px;line-height:1.2;font-weight:600}}
 .c span{{display:block;margin-top:16px;font-size:36px;line-height:1.5}}''',
 f'<div class="abs text" data-grid><div class="kicker">{KICK}</div><h1>Three tricks every flower uses</h1></div>'
 + ''.join(f'<div class="abs c" data-grid style="left:{COL(4 * i)}px"><b>{t}</b><span>{d}</span></div>' for i, (t, d) in enumerate(cards)))

# ---------- 5 · Bold Studio (figma) — a diagram inside one colour block ----------
# Brand: monochrome white/black, figmaSans -> Inter at 340 (display) / 330 (body), figmaMono -> JetBrains Mono uppercase
# for eyebrow + caption only, one lime colour block with 24px corners and 48px padding, no mid-grey text, no shadows.
dots = []
for k in range(1, 600):
    r = 16.5 * math.sqrt(k); a = k * math.radians(137.508)
    if r > 320: break
    dots.append(f'<circle cx="{340 + r * math.cos(a):.1f}" cy="{340 + r * math.sin(a):.1f}" r="{3 + r / 64:.1f}"/>')
sun = f'<svg width="680" height="680" viewBox="0 0 680 680" aria-label="Seeds in spirals, each turned 137.5 degrees from the last"><g fill="#000">{"".join(dots)}</g></svg>'
page('5-bold-studio', 'Bold Studio', 'family=Inter:wght@300..700&family=JetBrains+Mono:wght@400',
 f'''.slide{{background:#ffffff;color:#000;font-family:Inter,sans-serif}}
 .text{{left:{COL(0)}px;top:96px;width:{SPAN(5)}px}}
 .kicker,.cap{{font:400 20px/1.2 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase}}
 h1{{margin-top:16px;font-weight:340;font-size:84px;line-height:1.05;letter-spacing:-1.7px}}
 p{{margin-top:48px;font-weight:330;font-size:36px;line-height:1.5}}
 .block{{left:{COL(6)}px;top:96px;width:{SPAN(6)}px;height:888px;padding:48px;background:#dceeb1;border-radius:24px;
   display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}}
 .block .cap{{align-self:flex-start}}''',
 f'''<div class="abs block" data-grid>{sun}<div class="cap">Vogel&rsquo;s model, 1979</div></div>
 <div class="abs text" data-grid><div class="kicker">{KICK}</div><h1>Sunflowers pack seeds at 137.5&deg;</h1>
 <p>This golden angle wastes no space.</p></div>''')
print('written to', os.path.abspath(OUT))
