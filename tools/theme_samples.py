"""One thesis title slide per Aura-Slide theme, built with the power-design brand files + slide principles.
Writes docs/screenshots/theme-samples/<n>-<theme>.html (1920x1080, scales to the window) and a PNG of each.
Sizes follow one 1.333 scale (20 / 28 / 64 px), 96 px safe zone, 8-pt spacing, one accent per slide, no brand logos."""
import os, subprocess
OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots', 'theme-samples'); os.makedirs(OUT, exist_ok=True)

T = dict(
    kicker='ME 400 &middot; Project and Thesis &middot; BUET',
    pre='Transient, Spectral, and Flow Regime Characterization of a ',
    hl='Closed-Loop Pulsating Heat Pipe',
    post=' under Varying Sub-Atmospheric Pressures using Binary and Self-Rewetting Fluids',
    r=[('S. M. Shafayat Islam', '2110072'), ('Md. Sadman Sakib', '2110091')],
    sup=('Dr. Aloke Kumar Mozumder', 'Professor, Dept. of Mechanical Engineering, BUET'),
)
LOOP = ('<svg class="loop" viewBox="0 0 400 520" aria-hidden="true"><path d="M60 470 V110 a40 40 0 0 1 80 0 V410 a40 40 0 0 0 80 0 V110 '
        'a40 40 0 0 1 80 0 V470" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path class="hot" d="M40 470 H360"/></svg>')

def people(cls=''):
    rs = ''.join(f'<div class="p"><b>{n}</b><span>{i}</span></div>' for n, i in T['r'])
    return (f'<div class="people {cls}"><div class="grp"><div class="lab">Researchers</div>{rs}</div>'
            f'<div class="grp"><div class="lab">Supervisor</div><div class="p"><b>{T["sup"][0]}</b><span>{T["sup"][1]}</span></div></div></div>')

BASE = '''*{box-sizing:border-box;margin:0}html,body{height:100%;background:#1b1b1f}
body{display:flex;align-items:center;justify-content:center;overflow:hidden}
.slide{position:relative;width:1920px;height:1080px;flex:none;transform-origin:center;overflow:hidden}
.safe{position:absolute;inset:96px}
.kicker{font-size:20px;line-height:1.2}
h1{font-size:64px;line-height:1.1;max-width:30ch}
.people{position:absolute;left:0;bottom:0;display:flex;gap:96px}
.grp{display:flex;flex-direction:column;gap:16px}.lab{font-size:20px;line-height:1.2}
.p b{display:block;font-size:28px;line-height:1.3;font-weight:inherit}.p span{display:block;font-size:20px;line-height:1.4}
'''
SCALE = '<script>function f(){var s=Math.min(innerWidth/1920,innerHeight/1080);document.querySelector(".slide").style.transform="scale("+s+")"}addEventListener("resize",f);f()</script>'

THEMES = [
 ('1-warm-scholar', 'Warm Scholar', 'claude',
  'family=Source+Serif+4:opsz,wght@8..60,400&family=Inter:wght@400;500',
  '''.slide{background:#faf9f5;color:#141413;font-family:Inter,sans-serif}
  .kicker{color:#6c6a64;letter-spacing:.08em;text-transform:uppercase;font-weight:500}
  h1{margin-top:32px;font-family:"Source Serif 4",serif;font-weight:400;letter-spacing:-1.5px;max-width:29ch}
  h1 em{font-style:normal;color:#cc785c}
  .card{position:absolute;right:0;top:0;width:456px;height:600px;background:#efe9de;border-radius:16px;display:flex;align-items:center;justify-content:center}
  .loop{width:300px}.loop path{stroke:#141413;stroke-width:6}.loop .hot{stroke:#8e8b82;stroke-width:6}
  .lab{color:#6c6a64;letter-spacing:.08em;text-transform:uppercase;font-weight:500}.p b{font-weight:500;color:#252523}.p span{color:#6c6a64}
  .people{padding-top:32px;border-top:1px solid #e6dfd8;width:1152px}''', True),
 ('2-engineers-blueprint', "Engineer's Blueprint", 'ibm',
  'family=IBM+Plex+Sans:wght@300;400;600&family=IBM+Plex+Mono:wght@400',
  '''.slide{background:#fff;color:#161616;font-family:"IBM Plex Sans",sans-serif}
  .kicker{font-family:"IBM Plex Mono",monospace;color:#0f62fe}
  h1{margin-top:32px;font-weight:300;letter-spacing:-.5px;max-width:28ch}
  .card{position:absolute;right:0;top:0;width:520px;height:640px;background:#f4f4f4;display:flex;align-items:center;justify-content:center;
    background-image:linear-gradient(#e0e0e0 1px,transparent 1px),linear-gradient(90deg,#e0e0e0 1px,transparent 1px);background-size:64px 64px}
  .loop{width:300px}.loop path{stroke:#161616;stroke-width:4;stroke-linecap:square;stroke-linejoin:miter}.loop .hot{stroke:#525252}
  .lab{font-family:"IBM Plex Mono",monospace;color:#525252}.p b{font-weight:400}.p span{color:#525252}
  .people{gap:0;width:1152px;border-top:1px solid #161616}.people .grp{padding:24px 32px 0 0;width:50%}
  .people .grp+.grp{border-left:1px solid #e0e0e0;padding-left:32px}''', True),
 ('3-modern-gradient', 'Modern Gradient', 'stripe',
  'family=Inter:wght@300;400;500',
  '''.slide{background:#fff;color:#061b31;font-family:Inter,sans-serif;font-feature-settings:"ss01"}
  .ribbon{position:absolute;left:0;right:0;top:-260px;height:400px;transform:skewY(-6deg);transform-origin:0 0;
    background:linear-gradient(100deg,#ffcc4d 0%,#f96bee 38%,#533afd 72%,#1c1e54 100%)}
  .safe{top:224px}
  .kicker{color:#533afd;font-weight:500}
  h1{margin-top:24px;font-weight:300;letter-spacing:-1.4px;max-width:34ch;line-height:1.1}
  .lab{color:#64748d;font-weight:500}.p b{font-weight:400;color:#061b31}.p span{color:#64748d}
  .people{padding:32px 40px;background:#fff;border:1px solid #e5edf5;border-radius:8px;box-shadow:0 16px 32px -16px rgba(50,50,93,.25)}''', False),
 ('4-calm-green', 'Calm Green', 'starbucks',
  'family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700',
  '''.slide{background:#f2f0eb;color:#1e3932;font-family:"Nunito Sans",sans-serif}
  .kicker{display:inline-block;padding:8px 24px;border-radius:50px;background:#00754a;color:#fff;font-weight:600;letter-spacing:.02em}
  h1{margin-top:32px;font-weight:600;letter-spacing:-.16px;color:#006241;max-width:27ch}
  .band{position:absolute;right:0;top:0;bottom:0;width:560px;background:#1e3932;display:flex;align-items:center;justify-content:center}
  .loop{width:280px}.loop path{stroke:#d4e9e2;stroke-width:8}.loop .hot{stroke:#d4e9e2;opacity:.55}
  .safe{right:656px}
  .lab{color:#33433d;font-weight:700;letter-spacing:.02em}.p b{font-weight:600;color:#1e3932}.p span{color:#33433d}''', 'band'),
 ('5-bold-studio', 'Bold Studio', 'figma',
  'family=Inter:wght@400;500&family=JetBrains+Mono:wght@500',
  '''.slide{background:#fff;color:#000;font-family:Inter,sans-serif}
  .kicker{font-family:"JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.06em;font-weight:500}
  h1{margin-top:32px;font-weight:400;letter-spacing:-1.3px;max-width:26ch;line-height:1.08}
  .block{position:absolute;right:96px;top:96px;bottom:96px;width:560px;background:#c5b0f4;border-radius:32px;padding:48px;display:flex;flex-direction:column;justify-content:flex-end}
  .block .people{position:static;flex-direction:column;gap:48px}.block .loop{width:200px;margin:0 0 auto 8px}.block .loop path{stroke:#000;stroke-width:8}.block .loop .hot{stroke:#000}
  .safe{right:752px}
  .lab{font-family:"JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.06em;font-weight:500}.p b{font-weight:500}.p span{color:#000}''', 'block'),
]

pngs = []
for slug, name, brand, fonts, css, extra in THEMES:
    title = f'<h1>{T["pre"]}<em>{T["hl"]}</em>{T["post"]}</h1>' if brand in ('claude',) else f'<h1>{T["pre"]}{T["hl"]}{T["post"]}</h1>'
    if brand == 'ibm': title = title.replace(T['hl'], f'<span style="color:#0f62fe">{T["hl"]}</span>', 1)
    if brand == 'stripe': title = title.replace(T['hl'], f'<span style="color:#533afd;font-weight:400">{T["hl"]}</span>', 1)
    head = f'<div class="kicker">{T["kicker"]}</div>{title}'
    if extra is True:        # right-hand card with the loop drawing; people sit under the title
        body = f'<div class="safe"><div class="card">{LOOP}</div>{head}{people()}</div>'
    elif extra == 'band':
        body = f'<div class="band">{LOOP}</div><div class="safe">{head}{people()}</div>'
    elif extra == 'block':
        body = f'<div class="block">{LOOP}{people()}</div><div class="safe">{head}</div>'
    else:
        body = f'<div class="ribbon"></div><div class="safe">{head}{people()}</div>'
    html = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{name} - thesis title slide</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&display=swap">'
            f'<style>{BASE}{css}</style></head><body><main class="slide" aria-label="{name} theme">{body}</main>{SCALE}</body></html>')
    p = os.path.join(OUT, slug + '.html'); open(p, 'w', encoding='utf-8').write(html); pngs.append(p)
print('\n'.join(pngs))
